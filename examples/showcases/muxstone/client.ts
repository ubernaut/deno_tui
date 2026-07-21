// Copyright 2023 Im-Beast. MIT license.

import {
  createMuxstoneAuthToken,
  decodeMuxstoneData,
  decodeMuxstoneServerMessage,
  encodeMuxstoneData,
  encodeMuxstoneMessage,
  isMuxstoneAuthToken,
  MUXSTONE_PROTOCOL_VERSION,
  type MuxstoneAcknowledgedMessage,
  type MuxstoneAttachedMessage,
  type MuxstoneClientRequest,
  type MuxstoneErrorMessage,
  type MuxstoneServerMessage,
  type MuxstoneSessionDescriptor,
} from "./protocol.ts";
import type {
  MuxstoneAttachResult,
  MuxstoneClientPort,
  MuxstoneOutputFrame,
  MuxstoneSessionSummary,
  MuxstoneSpawnOptions,
} from "./model.ts";

const DESCRIPTOR_SCHEMA_VERSION = 1 as const;
const DEFAULT_CONNECT_TIMEOUT_MS = 6_000;
const DEFAULT_REQUEST_TIMEOUT_MS = 8_000;
const STARTUP_POLL_MS = 40;
const STARTUP_LOCK_STALE_MS = 30_000;
// One maximum-sized output frame is about 87.5 KiB after base64/JSON encoding.
// Sixteen frames leave useful headroom beneath legacy hosts' 2 MiB outbound cap.
const MAX_ATTACH_REPLAY_FRAMES = 16;

/** Private descriptor written by the daemon after its loopback listener is ready. */
export interface MuxstoneLocalHostDescriptor {
  readonly schemaVersion: typeof DESCRIPTOR_SCHEMA_VERSION;
  readonly hostId: string;
  readonly url: string;
  readonly token: string;
  readonly pid: number;
  readonly startedAt: number;
  /** New hosts advertise replay backpressure; absence identifies legacy queue behavior. */
  readonly flowControlledReplay?: true;
}

/** Minimal WebSocket seam used by deterministic client tests. */
export interface MuxstoneWebSocketLike {
  readonly readyState: number;
  readonly bufferedAmount: number;
  binaryType: BinaryType;
  send(data: string): void;
  close(code?: number, reason?: string): void;
  addEventListener(type: string, listener: (event: Event & { data?: unknown }) => void): void;
  removeEventListener(type: string, listener: (event: Event & { data?: unknown }) => void): void;
}

export interface ConnectMuxstoneWebSocketOptions {
  readonly url: string;
  readonly authToken: string;
  readonly requestTimeoutMs?: number;
  readonly flowControlledReplay?: boolean;
  readonly createWebSocket?: (url: string) => MuxstoneWebSocketLike;
}

/** Bounded client bootstrap options for reusing or launching the local host. */
export interface ConnectMuxstoneLocalHostOptions {
  readonly stateDirectory?: string;
  readonly descriptorPath?: string;
  readonly mainModuleUrl?: URL;
  readonly timeoutMs?: number;
  readonly requestTimeoutMs?: number;
  readonly createWebSocket?: (url: string) => MuxstoneWebSocketLike;
  readonly spawnDaemon?: (options: {
    readonly descriptorPath: string;
    readonly authToken: string;
    readonly mainModuleUrl: URL;
  }) => void | Promise<void>;
}

export interface ConnectedMuxstoneLocalHost {
  readonly client: MuxstoneWebSocketClient;
  readonly descriptor: MuxstoneLocalHostDescriptor;
  readonly launched: boolean;
}

interface MuxstoneStartupLock {
  readonly file: Deno.FsFile;
  readonly token: string;
}

export class MuxstoneClientError extends Error {
  constructor(readonly code: string, message: string) {
    super(message);
    this.name = "MuxstoneClientError";
  }
}

interface PendingRequest {
  readonly expected: ReadonlySet<MuxstoneServerMessage["type"]>;
  readonly resolve: (message: MuxstoneServerMessage) => void;
  readonly reject: (error: Error) => void;
  readonly timer: ReturnType<typeof setTimeout>;
}

type MuxstoneRequestWithoutId = MuxstoneClientRequest extends infer Request
  ? Request extends MuxstoneClientRequest ? Omit<Request, "requestId"> : never
  : never;

interface ClientAttachment {
  readonly sessionId: string;
  readonly onOutput: (frame: MuxstoneOutputFrame) => void;
  readonly onSession?: (session: MuxstoneSessionSummary) => void;
  readonly replay: MuxstoneOutputFrame[];
  readonly liveQueue: MuxstoneOutputFrame[];
  /** WebSocket delivery and host replay are monotonic for each session. */
  highestSequence: number;
  barrier?: number;
  collecting: boolean;
  /** Fulfilled with an error when replay cannot complete; never rejects orphaned. */
  readonly replayReady: Promise<Error | undefined>;
  readonly settleReplay: (error?: Error) => void;
}

interface MuxstoneAttachmentOptions {
  readonly sinceSequence?: number;
  readonly onOutput: (frame: MuxstoneOutputFrame) => void;
  readonly onSession?: (session: MuxstoneSessionSummary) => void;
}

/** Strict request-correlated client for the detached local WebSocket host. */
export class MuxstoneWebSocketClient implements MuxstoneClientPort {
  readonly #socket: MuxstoneWebSocketLike;
  readonly #authToken: string;
  readonly #requestTimeoutMs: number;
  readonly #flowControlledReplay: boolean;
  readonly #pending = new Map<number, PendingRequest>();
  readonly #attachments = new Map<string, ClientAttachment>();
  readonly #latestSequences = new Map<string, number>();
  /** Authentication completion is a result so late consumers cannot orphan a rejection. */
  readonly #readyResult: Promise<Error | undefined>;
  #attachTail: Promise<void> = Promise.resolve();
  #settleReady!: (error?: Error) => void;
  #readyTimer?: ReturnType<typeof setTimeout>;
  #hostId?: string;
  #terminalError?: Error;
  #connected = false;
  #disposed = false;
  #requestId = 0;

  readonly #onOpen = (_event: Event & { data?: unknown }) => {
    if (this.#disposed || this.#terminalError) return;
    try {
      this.#socket.send(encodeMuxstoneMessage({
        version: MUXSTONE_PROTOCOL_VERSION,
        type: "auth",
        token: this.#authToken,
      }));
    } catch {
      this.#failConnection(new MuxstoneClientError("auth-send-failed", "Could not authenticate with Muxstone host."));
    }
  };
  readonly #onMessage = (event: Event & { data?: unknown }) => this.#acceptMessage(event.data);
  readonly #onClose = (_event: Event & { data?: unknown }) => {
    if (this.#disposed) return;
    this.#failConnection(new MuxstoneClientError("connection-closed", "Muxstone host connection closed."));
  };
  readonly #onError = (_event: Event & { data?: unknown }) => {
    if (this.#disposed) return;
    this.#failConnection(new MuxstoneClientError("connection-error", "Muxstone host connection failed."));
  };

  constructor(options: ConnectMuxstoneWebSocketOptions) {
    const url = normalizeLoopbackWebSocketUrl(options.url);
    if (!isMuxstoneAuthToken(options.authToken)) {
      throw new MuxstoneClientError("invalid-auth", "Muxstone host token is invalid.");
    }
    this.#authToken = options.authToken;
    this.#requestTimeoutMs = normalizeTimeout(options.requestTimeoutMs, DEFAULT_REQUEST_TIMEOUT_MS);
    this.#flowControlledReplay = options.flowControlledReplay === true;
    this.#socket = options.createWebSocket?.(url) ?? new WebSocket(url);
    this.#socket.binaryType = "arraybuffer";
    this.#readyResult = new Promise<Error | undefined>((resolve) => {
      this.#settleReady = resolve;
    });
    this.#socket.addEventListener("open", this.#onOpen);
    this.#socket.addEventListener("message", this.#onMessage);
    this.#socket.addEventListener("close", this.#onClose);
    this.#socket.addEventListener("error", this.#onError);
    this.#readyTimer = setTimeout(() => {
      this.#failConnection(new MuxstoneClientError("connect-timeout", "Muxstone host authentication timed out."));
    }, this.#requestTimeoutMs);
  }

  get connected(): boolean {
    return this.#connected && !this.#disposed;
  }

  get hostId(): string | undefined {
    return this.#hostId;
  }

  /** Waits until the host has accepted the first-message authentication token. */
  async ready(): Promise<this> {
    const error = await this.#readyResult;
    if (error) throw error;
    if (this.#terminalError) throw this.#terminalError;
    return this;
  }

  list(): Promise<readonly MuxstoneSessionSummary[]> {
    return this.#list();
  }

  async #list(deadline?: number): Promise<readonly MuxstoneSessionSummary[]> {
    const response = await this.#request({ version: 1, type: "list" }, ["sessions"], deadline);
    if (response.type !== "sessions") throw responseMismatch();
    const sessions = response.sessions.map(sessionSummary);
    for (const session of sessions) this.#rememberSession(session);
    return sessions;
  }

  async spawn(options: MuxstoneSpawnOptions): Promise<MuxstoneSessionSummary> {
    const response = await this.#request({
      version: 1,
      type: "spawn",
      command: options.command,
      ...(options.args ? { args: [...options.args] } : {}),
      ...(options.cwd !== undefined ? { cwd: options.cwd } : {}),
      ...(options.env ? { env: { ...options.env } } : {}),
      ...(options.columns !== undefined ? { columns: options.columns } : {}),
      ...(options.rows !== undefined ? { rows: options.rows } : {}),
      ...(options.title !== undefined ? { title: options.title } : {}),
    }, ["spawned"]);
    if (response.type !== "spawned") throw responseMismatch();
    const session = sessionSummary(response.session);
    this.#rememberSession(session);
    return session;
  }

  attach(
    sessionId: string,
    options: MuxstoneAttachmentOptions,
  ): Promise<MuxstoneAttachResult> {
    const deadline = Date.now() + this.#requestTimeoutMs;
    if (this.#flowControlledReplay) return this.#attachSession(sessionId, options, deadline);
    // Legacy hosts enqueue a complete replay synchronously. Serialize these
    // handshakes so several terminals cannot aggregate past one socket's cap.
    const operation = this.#attachTail.then(() => this.#attachSession(sessionId, options, deadline));
    this.#attachTail = operation.then(() => undefined, () => undefined);
    return operation;
  }

  async #attachSession(
    sessionId: string,
    options: MuxstoneAttachmentOptions,
    deadline: number,
  ): Promise<MuxstoneAttachResult> {
    if (this.#attachments.has(sessionId)) {
      throw new MuxstoneClientError("attachment-exists", "Muxstone session already has a client attachment.");
    }
    // Refresh immediately before attaching: an initial inventory may be stale
    // by the time earlier serialized terminals finish replaying.
    if (!this.#flowControlledReplay) await this.#list(deadline);
    const requestedSince = options.sinceSequence ?? 0;
    const expectedLatest = this.#latestSequences.get(sessionId);
    const boundedSince = this.#flowControlledReplay || expectedLatest === undefined
      ? requestedSince
      : Math.max(requestedSince, expectedLatest - MAX_ATTACH_REPLAY_FRAMES);
    let settleReplay!: (error?: Error) => void;
    const replayReady = new Promise<Error | undefined>((resolve) => {
      settleReplay = resolve;
    });
    const attachment: ClientAttachment = {
      sessionId,
      onOutput: options.onOutput,
      onSession: options.onSession,
      replay: [],
      liveQueue: [],
      highestSequence: boundedSince,
      collecting: true,
      replayReady,
      settleReplay,
    };
    this.#attachments.set(sessionId, attachment);
    let response: MuxstoneAttachedMessage;
    try {
      const message = await this.#request(
        {
          version: 1,
          type: "attach",
          sessionId,
          ...(boundedSince > 0 || options.sinceSequence !== undefined ? { afterSequence: boundedSince } : {}),
        },
        ["attached"],
        deadline,
      );
      if (message.type !== "attached") throw responseMismatch();
      response = message;
      this.#rememberSession(sessionSummary(response.session));
      attachment.barrier = response.latestSequence;
      if (
        response.latestSequence <= boundedSince ||
        response.replayFromSequence > response.latestSequence ||
        attachment.replay.some((frame) => frame.sequence >= response.latestSequence)
      ) {
        attachment.settleReplay();
      }
      const replayError = await this.#waitForReplay(attachment, deadline);
      if (replayError) {
        // Once the host acknowledges an attach, abandoning its replay barrier
        // would leave an active server-side replay lane. Closing only this
        // client connection cancels that lane while daemon PTYs remain alive.
        if (!this.#terminalError) this.#failConnection(replayError);
        throw replayError;
      }
    } catch (error) {
      if (this.#attachments.get(sessionId) === attachment) this.#attachments.delete(sessionId);
      throw error;
    }
    attachment.collecting = false;
    // Frames received past the attach barrier must still be returned in order.
    // Delivering them through onOutput before this promise resolves lets the
    // caller advance its watermark (or clear on truncation) before replaying
    // the older snapshot, which can silently discard the replay.
    const replay = [...attachment.replay.splice(0), ...attachment.liveQueue.splice(0)]
      .sort((left, right) => left.sequence - right.sequence);
    return {
      session: sessionSummary(response.session),
      replay,
      truncated: response.truncated || boundedSince > requestedSince,
    };
  }

  async detach(sessionId: string): Promise<boolean> {
    const response = await this.#request({ version: 1, type: "detach", sessionId }, ["ack"]);
    assertAck(response, "detach", sessionId);
    this.#attachments.delete(sessionId);
    return true;
  }

  async input(sessionId: string, data: string | Uint8Array): Promise<boolean> {
    const response = await this.#request({
      version: 1,
      type: "input",
      sessionId,
      data: encodeMuxstoneData(data),
    }, ["ack"]);
    assertAck(response, "input", sessionId);
    return true;
  }

  async resize(sessionId: string, columns: number, rows: number): Promise<boolean> {
    const response = await this.#request({ version: 1, type: "resize", sessionId, columns, rows }, ["ack"]);
    assertAck(response, "resize", sessionId);
    return true;
  }

  async kill(sessionId: string): Promise<boolean> {
    const response = await this.#request({ version: 1, type: "kill", sessionId }, ["ack"]);
    assertAck(response, "kill", sessionId);
    this.#attachments.delete(sessionId);
    this.#latestSequences.delete(sessionId);
    return true;
  }

  async ping(): Promise<number> {
    const response = await this.#request({ version: 1, type: "ping" }, ["pong"]);
    if (response.type !== "pong") throw responseMismatch();
    return response.timestamp;
  }

  async shutdownHost(): Promise<boolean> {
    const response = await this.#request({ version: 1, type: "shutdown" }, ["ack"]);
    assertAck(response, "shutdown");
    return true;
  }

  dispose(): Promise<void> {
    if (this.#disposed) return Promise.resolve();
    this.#disposed = true;
    this.#connected = false;
    this.#clearReadyTimer();
    this.#removeSocketListeners();
    const error = this.#terminalError ?? new MuxstoneClientError("client-disposed", "Muxstone client was disposed.");
    this.#terminalError = error;
    this.#settleReady(error);
    this.#rejectPending(error);
    for (const attachment of this.#attachments.values()) attachment.settleReplay(error);
    this.#attachments.clear();
    this.#latestSequences.clear();
    try {
      this.#socket.close(1000, "client-disposed");
    } catch {
      // Socket teardown remains best effort and never owns host PTYs.
    }
    return Promise.resolve();
  }

  async #request(
    request: MuxstoneRequestWithoutId,
    expected: readonly MuxstoneServerMessage["type"][],
    deadline?: number,
  ): Promise<MuxstoneServerMessage> {
    const readyError = await this.#readyResult;
    if (readyError) throw readyError;
    if (!this.connected) {
      throw this.#terminalError ?? new MuxstoneClientError("not-connected", "Muxstone client is not connected.");
    }
    const timeoutMs = this.#remainingRequestTimeout(deadline);
    const requestId = this.#nextRequestId();
    const message = { ...request, requestId } as MuxstoneClientRequest;
    return await new Promise<MuxstoneServerMessage>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.#pending.delete(requestId);
        reject(requestTimeoutError());
      }, timeoutMs);
      this.#pending.set(requestId, { expected: new Set(expected), resolve, reject, timer });
      try {
        this.#socket.send(encodeMuxstoneMessage(message));
      } catch {
        clearTimeout(timer);
        this.#pending.delete(requestId);
        reject(new MuxstoneClientError("send-failed", "Muxstone host request could not be sent."));
      }
    });
  }

  #acceptMessage(raw: unknown): void {
    if (this.#disposed || this.#terminalError) return;
    if (typeof raw !== "string") {
      this.#failConnection(new MuxstoneClientError("binary-message", "Muxstone host sent an unsupported frame."));
      return;
    }
    let message: MuxstoneServerMessage;
    try {
      message = decodeMuxstoneServerMessage(raw);
    } catch {
      this.#failConnection(new MuxstoneClientError("invalid-message", "Muxstone host sent an invalid message."));
      return;
    }
    if (message.type === "ready") {
      if (this.#connected) {
        this.#failConnection(new MuxstoneClientError("duplicate-ready", "Muxstone host repeated authentication."));
        return;
      }
      this.#connected = true;
      this.#hostId = message.hostId;
      this.#clearReadyTimer();
      this.#settleReady();
      return;
    }
    if (!this.#connected) {
      this.#failConnection(new MuxstoneClientError("ready-required", "Muxstone host did not authenticate first."));
      return;
    }
    if (message.type === "output") {
      this.#acceptOutput(message.sessionId, message.sequence, message.data);
      return;
    }
    if (message.type === "session-state") {
      const session = sessionSummary(message.session);
      this.#rememberSession(session);
      this.#attachments.get(message.session.id)?.onSession?.(session);
      return;
    }
    if (message.type === "error") {
      this.#acceptError(message);
      return;
    }
    const requestId = "requestId" in message ? message.requestId : undefined;
    if (requestId === undefined) {
      this.#failConnection(new MuxstoneClientError("uncorrelated-message", "Muxstone host response was uncorrelated."));
      return;
    }
    const pending = this.#pending.get(requestId);
    if (!pending) return;
    this.#pending.delete(requestId);
    clearTimeout(pending.timer);
    if (!pending.expected.has(message.type)) {
      pending.reject(responseMismatch());
      return;
    }
    pending.resolve(message);
  }

  #acceptOutput(sessionId: string, sequence: number, encoded: string): void {
    const attachment = this.#attachments.get(sessionId);
    if (!attachment) return;
    this.#rememberSequence(sessionId, sequence);
    let data: Uint8Array;
    try {
      data = decodeMuxstoneData(encoded);
    } catch {
      this.#failConnection(new MuxstoneClientError("invalid-output", "Muxstone host sent invalid terminal output."));
      return;
    }
    const frame = { sessionId, sequence, data };
    // The host assigns strictly increasing per-session sequences and WebSocket
    // preserves frame order. A watermark therefore rejects replay/live overlap
    // without retaining one Set entry for every byte stream frame forever.
    if (sequence <= attachment.highestSequence) return;
    attachment.highestSequence = sequence;
    if (!attachment.collecting) {
      attachment.onOutput(frame);
      return;
    }
    if (attachment.barrier !== undefined && sequence > attachment.barrier) attachment.liveQueue.push(frame);
    else attachment.replay.push(frame);
    if (attachment.barrier !== undefined && sequence >= attachment.barrier) attachment.settleReplay();
  }

  #acceptError(message: MuxstoneErrorMessage): void {
    const error = new MuxstoneClientError(message.code, message.message);
    if (message.requestId === undefined) {
      this.#failConnection(error);
      return;
    }
    const pending = this.#pending.get(message.requestId);
    if (!pending) return;
    this.#pending.delete(message.requestId);
    clearTimeout(pending.timer);
    pending.reject(error);
  }

  #nextRequestId(): number {
    if (this.#requestId >= Number.MAX_SAFE_INTEGER) {
      throw new MuxstoneClientError("request-id-exhausted", "Muxstone request ids are exhausted.");
    }
    return ++this.#requestId;
  }

  #rememberSession(session: MuxstoneSessionSummary): void {
    this.#rememberSequence(session.id, session.sequence);
  }

  #rememberSequence(sessionId: string, sequence: number): void {
    this.#latestSequences.set(sessionId, Math.max(sequence, this.#latestSequences.get(sessionId) ?? 0));
  }

  async #waitForReplay(attachment: ClientAttachment, deadline: number): Promise<Error | undefined> {
    const timeoutMs = this.#remainingRequestTimeout(deadline);
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<Error>((resolve) => {
      timer = setTimeout(() => resolve(requestTimeoutError()), timeoutMs);
    });
    try {
      return await Promise.race([attachment.replayReady, timeout]);
    } finally {
      if (timer !== undefined) clearTimeout(timer);
    }
  }

  #remainingRequestTimeout(deadline?: number): number {
    const remaining = deadline === undefined
      ? this.#requestTimeoutMs
      : Math.min(this.#requestTimeoutMs, Math.ceil(deadline - Date.now()));
    if (remaining <= 0) throw requestTimeoutError();
    return remaining;
  }

  #failConnection(error: Error): void {
    if (this.#disposed || this.#terminalError) return;
    this.#terminalError = error;
    this.#connected = false;
    this.#clearReadyTimer();
    this.#settleReady(error);
    this.#rejectPending(error);
    for (const attachment of this.#attachments.values()) attachment.settleReplay(error);
    this.#attachments.clear();
    try {
      this.#socket.close(1011, "client-failed");
    } catch {
      // Connection is already unusable.
    }
  }

  #rejectPending(error: Error): void {
    for (const pending of this.#pending.values()) {
      clearTimeout(pending.timer);
      pending.reject(error);
    }
    this.#pending.clear();
  }

  #clearReadyTimer(): void {
    if (this.#readyTimer !== undefined) clearTimeout(this.#readyTimer);
    this.#readyTimer = undefined;
  }

  #removeSocketListeners(): void {
    this.#socket.removeEventListener("open", this.#onOpen);
    this.#socket.removeEventListener("message", this.#onMessage);
    this.#socket.removeEventListener("close", this.#onClose);
    this.#socket.removeEventListener("error", this.#onError);
  }
}

/** Opens and authenticates one existing loopback host connection. */
export async function connectMuxstoneWebSocket(
  options: ConnectMuxstoneWebSocketOptions,
): Promise<MuxstoneWebSocketClient> {
  return await new MuxstoneWebSocketClient(options).ready();
}

/** Reuses a healthy daemon or atomically launches one detached local host. */
export async function connectOrLaunchMuxstoneLocalHost(
  options: ConnectMuxstoneLocalHostOptions = {},
): Promise<ConnectedMuxstoneLocalHost> {
  const stateDirectory = options.stateDirectory ?? defaultMuxstoneStateDirectory();
  const descriptorPath = options.descriptorPath ?? joinLocalPath(stateDirectory, "host.json");
  const lockPath = `${descriptorPath}.lock`;
  const timeoutMs = normalizeTimeout(options.timeoutMs, DEFAULT_CONNECT_TIMEOUT_MS);
  const deadline = Date.now() + timeoutMs;
  await ensurePrivateDirectory(stateDirectory);

  const existing = await connectExistingDescriptorOrRetain(descriptorPath, options, deadline);
  if (existing) return { ...existing, launched: false };

  let lock: MuxstoneStartupLock | undefined;
  while (!lock) {
    lock = await tryAcquireStartupLock(lockPath);
    if (lock) break;
    const raced = await connectExistingDescriptorOrRetain(descriptorPath, options, deadline);
    if (raced) return { ...raced, launched: false };
    if (Date.now() >= deadline) {
      throw new MuxstoneClientError("startup-timeout", "Timed out waiting for the local Muxstone host.");
    }
    await removeStaleStartupLock(lockPath);
    await delay(STARTUP_POLL_MS);
  }

  try {
    const raced = await connectExistingDescriptorOrRetain(descriptorPath, options, deadline);
    if (raced) return { ...raced, launched: false };
    const authToken = createMuxstoneAuthToken();
    const mainModuleUrl = options.mainModuleUrl ?? new URL("./main.ts", import.meta.url);
    if (options.spawnDaemon) {
      await options.spawnDaemon({ descriptorPath, authToken, mainModuleUrl });
    } else {
      spawnDetachedMuxstoneDaemon({ descriptorPath, authToken, mainModuleUrl });
    }
    while (Date.now() < deadline) {
      const launched = await tryConnectDescriptor(descriptorPath, options);
      if (launched) return { ...launched, launched: true };
      await delay(STARTUP_POLL_MS);
    }
    throw new MuxstoneClientError("startup-timeout", "The local Muxstone host did not become ready.");
  } finally {
    try {
      lock.file.close();
    } finally {
      await removeStartupLockIfOwned(lockPath, lock.token);
    }
  }
}

/** Reads and strictly validates a private local-host descriptor. */
export async function readMuxstoneHostDescriptor(path: string): Promise<MuxstoneLocalHostDescriptor | undefined> {
  await assertPrivateExistingDirectory(localDirname(path));
  let info: Deno.FileInfo;
  try {
    info = await Deno.lstat(path);
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) return undefined;
    throw error;
  }
  if (!info.isFile || info.isSymlink) {
    throw new MuxstoneClientError("unsafe-descriptor", "Host descriptor is not a file.");
  }
  if (Deno.build.os !== "windows" && info.mode !== null && (info.mode & 0o077) !== 0) {
    throw new MuxstoneClientError("unsafe-descriptor", "Host descriptor must not be accessible by other users.");
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(await Deno.readTextFile(path));
  } catch {
    return undefined;
  }
  return normalizeMuxstoneHostDescriptor(parsed);
}

/** Atomically writes one owner-readable descriptor after the daemon is listening. */
export async function writeMuxstoneHostDescriptor(
  path: string,
  descriptorValue: MuxstoneLocalHostDescriptor,
): Promise<void> {
  const descriptor = normalizeMuxstoneHostDescriptor(descriptorValue);
  const parent = localDirname(path);
  await ensurePrivateDirectory(parent);
  const temporary = `${path}.tmp-${crypto.randomUUID()}`;
  let file: Deno.FsFile | undefined;
  try {
    file = await Deno.open(temporary, { createNew: true, write: true, mode: 0o600 });
    const bytes = new TextEncoder().encode(`${JSON.stringify(descriptor)}\n`);
    let offset = 0;
    while (offset < bytes.length) {
      const written = await file.write(bytes.subarray(offset));
      if (written <= 0) throw new MuxstoneClientError("descriptor-write-failed", "Host descriptor write stalled.");
      offset += written;
    }
    await file.sync();
    file.close();
    file = undefined;
    await Deno.rename(temporary, path);
    await chmodPrivateFile(path);
  } finally {
    file?.close();
    await removeRegularFile(temporary);
  }
}

/** Removes a descriptor only when it still identifies the caller's host generation. */
export async function removeMuxstoneHostDescriptor(path: string, hostId: string): Promise<void> {
  const descriptor = await readMuxstoneHostDescriptor(path).catch(() => undefined);
  if (descriptor?.hostId === hostId) await removeRegularFile(path);
}

/** Default private state directory shared by the launcher and detached daemon. */
export function defaultMuxstoneStateDirectory(): string {
  let root: string | undefined;
  try {
    root = Deno.build.os === "windows"
      ? Deno.env.get("LOCALAPPDATA") ?? Deno.env.get("USERPROFILE")
      : Deno.env.get("XDG_STATE_HOME") ??
        (Deno.env.get("HOME") ? joinLocalPath(Deno.env.get("HOME")!, ".local/state") : undefined);
  } catch {
    root = undefined;
  }
  if (!root) throw new MuxstoneClientError("state-directory-unavailable", "No private state directory is available.");
  return joinLocalPath(root, "deno-tui/muxstone");
}

function sessionSummary(descriptor: MuxstoneSessionDescriptor): MuxstoneSessionSummary {
  const status = descriptor.running
    ? "running"
    : descriptor.status === "exited" || descriptor.status === "cancelled"
    ? "exited"
    : "failed";
  return Object.freeze({
    id: descriptor.id,
    title: descriptor.title,
    commandLine: descriptor.commandLine,
    status,
    running: descriptor.running,
    columns: descriptor.columns,
    rows: descriptor.rows,
    sequence: descriptor.latestSequence,
    createdAt: descriptor.createdAt,
    updatedAt: descriptor.updatedAt,
  });
}

function assertAck(
  message: MuxstoneServerMessage,
  operation: MuxstoneAcknowledgedMessage["operation"],
  sessionId?: string,
): asserts message is MuxstoneAcknowledgedMessage {
  if (
    message.type !== "ack" || message.operation !== operation ||
    (sessionId !== undefined && message.sessionId !== sessionId)
  ) {
    throw responseMismatch();
  }
}

function responseMismatch(): MuxstoneClientError {
  return new MuxstoneClientError("response-mismatch", "Muxstone host response did not match its request.");
}

function requestTimeoutError(): MuxstoneClientError {
  return new MuxstoneClientError("request-timeout", "Muxstone host request timed out.");
}

function normalizeLoopbackWebSocketUrl(value: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new MuxstoneClientError("invalid-url", "Muxstone host URL is invalid.");
  }
  if (
    url.protocol !== "ws:" || url.username || url.password || url.hash ||
    (url.hostname !== "127.0.0.1" && url.hostname !== "[::1]" && url.hostname !== "::1")
  ) {
    throw new MuxstoneClientError("invalid-url", "Muxstone host must use an explicit loopback WebSocket URL.");
  }
  return url.href;
}

function normalizeMuxstoneHostDescriptor(value: unknown): MuxstoneLocalHostDescriptor {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw invalidDescriptor();
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const keys = Object.keys(descriptors);
  const required = ["schemaVersion", "hostId", "url", "token", "pid", "startedAt"];
  const optional = ["flowControlledReplay"];
  if (
    Object.getPrototypeOf(value) !== Object.prototype || Object.getOwnPropertySymbols(value).length > 0 ||
    required.some((key) => !keys.includes(key)) ||
    keys.some((key) => !required.includes(key) && !optional.includes(key)) ||
    keys.some((key) => !("value" in descriptors[key]!) || !descriptors[key]!.enumerable)
  ) {
    throw invalidDescriptor();
  }
  const record = value as Record<string, unknown>;
  if (
    record.schemaVersion !== DESCRIPTOR_SCHEMA_VERSION || typeof record.hostId !== "string" ||
    !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(record.hostId) || !isMuxstoneAuthToken(record.token) ||
    !Number.isSafeInteger(record.pid) || (record.pid as number) < 1 ||
    typeof record.startedAt !== "number" || !Number.isFinite(record.startedAt) || record.startedAt < 0 ||
    (keys.includes("flowControlledReplay") && record.flowControlledReplay !== true)
  ) {
    throw invalidDescriptor();
  }
  return Object.freeze({
    schemaVersion: 1,
    hostId: record.hostId,
    url: normalizeLoopbackWebSocketUrl(record.url as string),
    token: record.token,
    pid: record.pid as number,
    startedAt: Math.floor(record.startedAt),
    ...(record.flowControlledReplay === true ? { flowControlledReplay: true as const } : {}),
  });
}

function invalidDescriptor(): MuxstoneClientError {
  return new MuxstoneClientError("invalid-descriptor", "Muxstone host descriptor is invalid.");
}

async function tryConnectDescriptor(
  path: string,
  options: ConnectMuxstoneLocalHostOptions,
): Promise<Omit<ConnectedMuxstoneLocalHost, "launched"> | undefined> {
  const descriptor = await readMuxstoneHostDescriptor(path).catch(() => undefined);
  if (!descriptor) return undefined;
  let client: MuxstoneWebSocketClient | undefined;
  try {
    client = await connectMuxstoneWebSocket({
      url: descriptor.url,
      authToken: descriptor.token,
      requestTimeoutMs: options.requestTimeoutMs ?? Math.min(1_500, options.timeoutMs ?? DEFAULT_CONNECT_TIMEOUT_MS),
      flowControlledReplay: descriptor.flowControlledReplay === true,
      createWebSocket: options.createWebSocket,
    });
    await client.ping();
    if (client.hostId !== descriptor.hostId) throw new MuxstoneClientError("host-generation-mismatch", "Host changed.");
    return { client, descriptor };
  } catch {
    await client?.dispose();
    return undefined;
  }
}

async function connectExistingDescriptorOrRetain(
  path: string,
  options: ConnectMuxstoneLocalHostOptions,
  deadline: number,
): Promise<Omit<ConnectedMuxstoneLocalHost, "launched"> | undefined> {
  let descriptor = await readMuxstoneHostDescriptor(path);
  if (!descriptor) return undefined;
  while (true) {
    const connected = await tryConnectDescriptor(path, options);
    if (connected) return connected;
    const current = await readMuxstoneHostDescriptor(path);
    if (!current) return undefined;
    descriptor = current;
    if (!(await isPlausiblyLiveLocalProcess(descriptor.pid))) {
      await removeMuxstoneHostDescriptor(path, descriptor.hostId);
      return undefined;
    }
    if (Date.now() >= deadline) {
      throw new MuxstoneClientError(
        "existing-host-unreachable",
        "The recorded Muxstone host still appears alive but did not respond; its descriptor was retained.",
      );
    }
    await delay(STARTUP_POLL_MS);
  }
}

async function isPlausiblyLiveLocalProcess(pid: number): Promise<boolean> {
  if (Deno.build.os !== "linux") return true;
  try {
    const info = await Deno.stat(`/proc/${pid}`);
    return info.isDirectory;
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) return false;
    return true;
  }
}

function spawnDetachedMuxstoneDaemon(options: {
  descriptorPath: string;
  authToken: string;
  mainModuleUrl: URL;
}): void {
  const daemonArgs = [
    "run",
    "-A",
    fileUrlToLocalPath(options.mainModuleUrl),
    "--daemon",
    `--descriptor=${options.descriptorPath}`,
  ];
  const launch = detachedDaemonCommand(daemonArgs);
  const child = new Deno.Command(launch.command, {
    args: launch.args,
    env: { MUXSTONE_TOKEN: options.authToken },
    stdin: "null",
    stdout: "null",
    stderr: "null",
  }).spawn();
  child.unref();
}

function detachedDaemonCommand(daemonArgs: readonly string[]): { command: string; args: string[] } {
  if (Deno.build.os === "windows") {
    // Windows has no POSIX controlling terminal or session signal group. With
    // all standard handles detached, unref is sufficient to release the UI.
    return { command: Deno.execPath(), args: [...daemonArgs] };
  }
  if (Deno.build.os !== "linux") {
    throw new MuxstoneClientError(
      "daemon-detach-unavailable",
      `True detached daemon sessions are not supported on ${Deno.build.os}.`,
    );
  }
  const setsid = trustedSetsidPath();
  if (!setsid) {
    throw new MuxstoneClientError(
      "daemon-detach-unavailable",
      "Muxstone requires a trusted setsid executable to detach its local host.",
    );
  }
  // --fork guarantees the program is not a process-group leader before
  // setsid(2), so the daemon receives a new SID/PGID even in unusual parents.
  return { command: setsid, args: ["--fork", Deno.execPath(), ...daemonArgs] };
}

function trustedSetsidPath(): string | undefined {
  for (const path of ["/usr/bin/setsid", "/bin/setsid"]) {
    try {
      const info = Deno.lstatSync(path);
      if (info.isFile && !info.isSymlink) return path;
    } catch (error) {
      if (!(error instanceof Deno.errors.NotFound)) throw error;
    }
  }
  return undefined;
}

async function ensurePrivateDirectory(path: string): Promise<void> {
  let created = false;
  let info: Deno.FileInfo;
  try {
    info = await Deno.lstat(path);
  } catch (error) {
    if (!(error instanceof Deno.errors.NotFound)) throw error;
    await Deno.mkdir(path, { recursive: true, mode: 0o700 });
    created = true;
    info = await Deno.lstat(path);
  }
  if (!info.isDirectory || info.isSymlink) {
    throw new MuxstoneClientError("unsafe-state-directory", "Muxstone state path is not a private directory.");
  }
  if (Deno.build.os !== "windows") {
    if (created) await Deno.chmod(path, 0o700);
    const mode = (await Deno.stat(path)).mode;
    if (mode !== null && (mode & 0o077) !== 0) {
      throw new MuxstoneClientError(
        "unsafe-state-directory",
        "Muxstone state directory must not be accessible by group or other users.",
      );
    }
  }
}

async function assertPrivateExistingDirectory(path: string): Promise<void> {
  let info: Deno.FileInfo;
  try {
    info = await Deno.lstat(path);
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      throw new MuxstoneClientError("unsafe-state-directory", "Muxstone descriptor parent does not exist.");
    }
    throw error;
  }
  if (!info.isDirectory || info.isSymlink) {
    throw new MuxstoneClientError("unsafe-state-directory", "Muxstone descriptor parent is not a private directory.");
  }
  if (Deno.build.os !== "windows" && info.mode !== null && (info.mode & 0o077) !== 0) {
    throw new MuxstoneClientError(
      "unsafe-state-directory",
      "Muxstone descriptor parent must not be accessible by other users.",
    );
  }
}

async function chmodPrivateFile(path: string): Promise<void> {
  if (Deno.build.os !== "windows") await Deno.chmod(path, 0o600);
}

async function tryAcquireStartupLock(path: string): Promise<MuxstoneStartupLock | undefined> {
  const token = crypto.randomUUID();
  let file: Deno.FsFile;
  try {
    file = await Deno.open(path, { createNew: true, write: true, mode: 0o600 });
  } catch (error) {
    if (error instanceof Deno.errors.AlreadyExists) return undefined;
    throw error;
  }
  try {
    const bytes = new TextEncoder().encode(JSON.stringify({ token, pid: Deno.pid, startedAt: Date.now() }));
    let offset = 0;
    while (offset < bytes.byteLength) {
      const written = await file.write(bytes.subarray(offset));
      if (written <= 0) throw new MuxstoneClientError("startup-lock-write-failed", "Startup lock write stalled.");
      offset += written;
    }
    await file.sync();
    return { file, token };
  } catch (error) {
    file.close();
    await removeStartupLockIfOwned(path, token);
    throw error;
  }
}

async function removeStaleStartupLock(path: string): Promise<void> {
  try {
    const info = await Deno.lstat(path);
    if (!info.isFile || info.isSymlink) return;
    const modified = info.mtime?.getTime();
    if (modified === undefined || Date.now() - modified <= STARTUP_LOCK_STALE_MS) return;
    const owner = normalizeStartupLock(await Deno.readTextFile(path));
    if (!owner || await isPlausiblyLiveLocalProcess(owner.pid)) return;
    await removeStartupLockIfOwned(path, owner.token);
  } catch (error) {
    if (!(error instanceof Deno.errors.NotFound)) throw error;
  }
}

async function removeStartupLockIfOwned(path: string, token: string): Promise<void> {
  try {
    const info = await Deno.lstat(path);
    if (!info.isFile || info.isSymlink) return;
    const owner = normalizeStartupLock(await Deno.readTextFile(path));
    if (owner?.token === token) await Deno.remove(path);
  } catch (error) {
    if (!(error instanceof Deno.errors.NotFound)) throw error;
  }
}

function normalizeStartupLock(value: string): { token: string; pid: number } | undefined {
  try {
    const parsed: unknown = JSON.parse(value);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return undefined;
    const record = parsed as Record<string, unknown>;
    if (
      typeof record.token !== "string" || !/^[0-9a-f-]{36}$/.test(record.token) ||
      !Number.isSafeInteger(record.pid) || (record.pid as number) < 1
    ) return undefined;
    return { token: record.token, pid: record.pid as number };
  } catch {
    return undefined;
  }
}

async function removeRegularFile(path: string): Promise<void> {
  try {
    const info = await Deno.lstat(path);
    if (info.isFile && !info.isSymlink) await Deno.remove(path);
  } catch (error) {
    if (!(error instanceof Deno.errors.NotFound)) throw error;
  }
}

function normalizeTimeout(value: number | undefined, fallback: number): number {
  const timeout = value ?? fallback;
  if (!Number.isSafeInteger(timeout) || timeout < 100 || timeout > 120_000) {
    throw new MuxstoneClientError("invalid-timeout", "Muxstone timeout is outside the supported range.");
  }
  return timeout;
}

function joinLocalPath(parent: string, child: string): string {
  const separator = Deno.build.os === "windows" ? "\\" : "/";
  return `${parent.replace(/[\\/]+$/g, "")}${separator}${child.replace(/^[\\/]+/g, "")}`;
}

function localDirname(path: string): string {
  const index = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
  return index <= 0 ? "." : path.slice(0, index);
}

function fileUrlToLocalPath(url: URL): string {
  if (url.protocol !== "file:") throw new MuxstoneClientError("invalid-main-module", "Daemon module must be local.");
  let path = decodeURIComponent(url.pathname);
  if (Deno.build.os === "windows" && /^\/[A-Za-z]:/.test(path)) path = path.slice(1).replaceAll("/", "\\");
  return path;
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
