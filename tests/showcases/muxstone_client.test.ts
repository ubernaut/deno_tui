// Copyright 2023 Im-Beast. MIT license.

import { assert, assertEquals, assertRejects } from "../deps.ts";
import { TerminalOutputController } from "../../mod.ts";
import {
  connectMuxstoneWebSocket,
  connectOrLaunchMuxstoneLocalHost,
  MuxstoneClientError,
  MuxstoneWebSocketClient,
  type MuxstoneWebSocketLike,
  readMuxstoneHostDescriptor,
  writeMuxstoneHostDescriptor,
} from "../../examples/showcases/muxstone/client.ts";
import { serveMuxstoneHost } from "../../examples/showcases/muxstone/host.ts";
import {
  createMuxstoneAuthToken,
  encodeMuxstoneData,
  encodeMuxstoneMessage,
  type MuxstoneServerMessage,
  type MuxstoneSessionDescriptor,
} from "../../examples/showcases/muxstone/protocol.ts";
import type {
  TerminalBackend,
  TerminalBackendSpawnOptions,
  TerminalSessionHandle,
  TerminalSessionHandleInspection,
} from "../../src/runtime/terminal_backend.ts";
import type { ProcessSessionCommand, ProcessSessionInspection } from "../../src/runtime/process_session.ts";

Deno.test("Muxstone client reports a pre-authentication close without an orphan rejection", async () => {
  await auditUnhandledRejections(async () => {
    const socket = new ScriptedMuxstoneSocket();
    const client = new MuxstoneWebSocketClient(fakeSocketOptions(socket));
    try {
      socket.serverClose();
      await nextMacrotask();
      await assertMuxstoneClientError(client.ready(), "connection-closed", "host connection closed");
    } finally {
      await client.dispose();
    }
  });
});

Deno.test("Muxstone client disposal settles authentication waiters", async () => {
  await auditUnhandledRejections(async () => {
    const socket = new ScriptedMuxstoneSocket();
    const client = new MuxstoneWebSocketClient(fakeSocketOptions(socket));
    await client.dispose();
    await nextMacrotask();
    await assertMuxstoneClientError(client.ready(), "client-disposed", "client was disposed");
  });
});

Deno.test("Muxstone disconnect during an attach request rejects only the caller", async () => {
  await auditUnhandledRejections(async () => {
    const { client, socket } = await connectedScriptedClient();
    try {
      const attachment = client.attach("terminal-1", { onOutput: () => {} });
      const rejected = assertMuxstoneClientError(attachment, "connection-closed", "host connection closed");
      const list = await socket.waitForRequest("list");
      socket.receive(sessionsMessage(list.requestId, [fakeSession("terminal-1", 2)]));
      await socket.waitForRequest("attach");
      socket.serverClose();
      await rejected;
    } finally {
      await client.dispose();
    }
  });
});

Deno.test("Muxstone disconnect during replay rejects the awaited attachment without an orphan", async () => {
  await auditUnhandledRejections(async () => {
    const { client, socket } = await connectedScriptedClient();
    try {
      const attachment = client.attach("terminal-1", { onOutput: () => {} });
      const rejected = assertMuxstoneClientError(attachment, "connection-closed", "host connection closed");
      const list = await socket.waitForRequest("list");
      const session = fakeSession("terminal-1", 2);
      socket.receive(sessionsMessage(list.requestId, [session]));
      const attach = await socket.waitForRequest("attach");
      socket.receive(attachedMessage(attach.requestId, session, 0));
      await Promise.resolve();
      socket.serverClose();
      await rejected;
    } finally {
      await client.dispose();
    }
  });
});

Deno.test("Muxstone disposal during replay rejects the awaited attachment", async () => {
  await auditUnhandledRejections(async () => {
    const { client, socket } = await connectedScriptedClient();
    const attachment = client.attach("terminal-1", { onOutput: () => {} });
    const rejected = assertMuxstoneClientError(attachment, "client-disposed", "client was disposed");
    const list = await socket.waitForRequest("list");
    const session = fakeSession("terminal-1", 2);
    socket.receive(sessionsMessage(list.requestId, [session]));
    const attach = await socket.waitForRequest("attach");
    socket.receive(attachedMessage(attach.requestId, session, 0));
    await Promise.resolve();
    await client.dispose();
    await rejected;
  });
});

Deno.test("Muxstone client bounds legacy-host replay and reports its intentional gap", async () => {
  const { client, socket } = await connectedScriptedClient();
  try {
    const attachment = client.attach("terminal-1", { onOutput: () => {} });
    const list = await socket.waitForRequest("list");
    const session = fakeSession("terminal-1", 100);
    socket.receive(sessionsMessage(list.requestId, [session]));
    const attach = await socket.waitForRequest("attach");
    assertEquals(attach.afterSequence, 84);
    socket.receive(attachedMessage(attach.requestId, session, 85));
    for (let sequence = 85; sequence <= 100; sequence += 1) {
      socket.receive({
        version: 1,
        type: "output",
        sessionId: session.id,
        sequence,
        data: encodeMuxstoneData(String(sequence)),
      });
    }
    const result = await attachment;
    assertEquals(result.replay.map((frame) => frame.sequence), Array.from({ length: 16 }, (_, index) => 85 + index));
    assertEquals(result.truncated, true);
  } finally {
    await client.dispose();
  }
});

Deno.test("Muxstone client serializes replay-producing attach handshakes", async () => {
  const { client, socket } = await connectedScriptedClient();
  try {
    const first = client.attach("terminal-1", { onOutput: () => {} });
    const second = client.attach("terminal-2", { onOutput: () => {} });
    const firstList = await socket.waitForRequest("list");
    await nextMacrotask();
    assertEquals(socket.requests("list").length, 1);
    const sessions = [fakeSession("terminal-1", 0), fakeSession("terminal-2", 0)];
    socket.receive(sessionsMessage(firstList.requestId, sessions));
    const firstAttach = await socket.waitForRequest("attach");
    socket.receive(attachedMessage(firstAttach.requestId, sessions[0]!, 1));
    await first;

    const secondList = await socket.waitForRequest("list", 1);
    socket.receive(sessionsMessage(secondList.requestId, sessions));
    const secondAttach = await socket.waitForRequest("attach", 1);
    socket.receive(attachedMessage(secondAttach.requestId, sessions[1]!, 1));
    await second;
  } finally {
    await client.dispose();
  }
});

Deno.test("Muxstone attach returns post-barrier frames after replay instead of firing live callbacks early", async () => {
  const { client, socket } = await connectedScriptedClient();
  const live: number[] = [];
  try {
    const attachment = client.attach("terminal-1", {
      onOutput: (frame) => live.push(frame.sequence),
    });
    const list = await socket.waitForRequest("list");
    const listed = fakeSession("terminal-1", 20);
    socket.receive(sessionsMessage(list.requestId, [listed]));
    const attach = await socket.waitForRequest("attach");
    const attached = fakeSession("terminal-1", 21);
    socket.receive(attachedMessage(attach.requestId, attached, 21));
    socket.receive(outputMessage("terminal-1", 21));
    socket.receive(outputMessage("terminal-1", 22));

    const result = await attachment;
    assertEquals(live, []);
    assertEquals(result.replay.map((frame) => frame.sequence), [21, 22]);
    socket.receive(outputMessage("terminal-1", 23));
    assertEquals(live, [23]);
  } finally {
    await client.dispose();
  }
});

Deno.test("Muxstone attach settles an empty replay that the host reports as truncated", async () => {
  const { client, socket } = await connectedScriptedClient(1_000, true);
  try {
    const attachment = client.attach("terminal-1", { sinceSequence: 0, onOutput: () => {} });
    const attach = await socket.waitForRequest("attach");
    const session = fakeSession("terminal-1", 1);
    const response = attachedMessage(attach.requestId, session, 2);
    assert(response.type === "attached");
    socket.receive({
      ...response,
      truncated: true,
    });

    const result = await attachment;
    assertEquals(result.replay, []);
    assertEquals(result.truncated, true);
    assertEquals(client.connected, true);
  } finally {
    await client.dispose();
  }
});

Deno.test("Muxstone replay timeout closes only the client lane and rejects retries deterministically", async () => {
  await auditUnhandledRejections(async () => {
    const { client, socket } = await connectedScriptedClient(100);
    const attachment = client.attach("terminal-1", { onOutput: () => {} });
    const rejected = assertMuxstoneClientError(attachment, "request-timeout", "request timed out");
    const list = await socket.waitForRequest("list");
    const session = fakeSession("terminal-1", 1);
    socket.receive(sessionsMessage(list.requestId, [session]));
    const attach = await socket.waitForRequest("attach");
    socket.receive(attachedMessage(attach.requestId, session, 1));
    await rejected;
    assertEquals(client.connected, false);
    assertEquals(socket.closeCalls.at(-1)?.code, 1011);
    await assertMuxstoneClientError(
      client.attach("terminal-1", { onOutput: () => {} }),
      "request-timeout",
      "request timed out",
    );
    await client.dispose();
  });
});

Deno.test("Muxstone capable hosts retain concurrent full-replay attach requests", async () => {
  const { client, socket } = await connectedScriptedClient(1_000, true);
  try {
    const first = client.attach("terminal-1", { sinceSequence: 0, onOutput: () => {} });
    const second = client.attach("terminal-2", { sinceSequence: 0, onOutput: () => {} });
    const firstAttach = await socket.waitForRequest("attach");
    const secondAttach = await socket.waitForRequest("attach", 1);
    assertEquals(socket.requests("list"), []);
    assertEquals(firstAttach.afterSequence, 0);
    assertEquals(secondAttach.afterSequence, 0);
    const firstSession = fakeSession("terminal-1", 0);
    const secondSession = fakeSession("terminal-2", 0);
    socket.receive(attachedMessage(firstAttach.requestId, firstSession, 1));
    socket.receive(attachedMessage(secondAttach.requestId, secondSession, 1));
    assertEquals((await Promise.all([first, second])).map((result) => result.truncated), [false, false]);
  } finally {
    await client.dispose();
  }
});

Deno.test("Muxstone client rejects a duplicate session attachment without replacing the first", async () => {
  const { client, socket } = await connectedScriptedClient(1_000, true);
  try {
    const first = client.attach("terminal-1", { onOutput: () => {} });
    const attach = await socket.waitForRequest("attach");
    await assertMuxstoneClientError(
      client.attach("terminal-1", { onOutput: () => {} }),
      "attachment-exists",
      "already has a client attachment",
    );
    const session = fakeSession("terminal-1", 0);
    socket.receive(attachedMessage(attach.requestId, session, 1));
    await first;
  } finally {
    await client.dispose();
  }
});

Deno.test("Muxstone WebSocket client correlates replay/control and disconnect leaves host PTY alive", async () => {
  const token = createMuxstoneAuthToken();
  const backend = new FakeRetainingBackend();
  const server = serveMuxstoneHost({ authToken: token, backend, port: 0 });
  const address = await server.address;
  const first = await connectMuxstoneWebSocket({ url: address.url, authToken: token, requestTimeoutMs: 2_000 });
  try {
    assertEquals(await first.list(), []);
    const spawned = await first.spawn({ command: "/bin/fake", title: "client smoke", columns: 90, rows: 28 });
    const handle = backend.handles[0]!;
    handle.emit("\x1b[31mretained\x1b[0m");

    const live: string[] = [];
    const attached = await first.attach(spawned.id, {
      sinceSequence: 0,
      onOutput: (frame) => live.push(new TextDecoder().decode(frame.data as Uint8Array)),
    });
    assertEquals(attached.truncated, false);
    assertEquals(attached.replay.length, 1);
    assertEquals(new TextDecoder().decode(attached.replay[0]!.data as Uint8Array), "\x1b[31mretained\x1b[0m");

    handle.emit("live");
    await waitFor(() => live.includes("live"));
    assertEquals(await first.input(spawned.id, "echo exact\n"), true);
    assertEquals(handle.writes, ["echo exact\n"]);
    assertEquals(await first.resize(spawned.id, 101, 31), true);
    assertEquals(handle.resizes.at(-1), { columns: 101, rows: 31 });

    await first.dispose();
    assertEquals(handle.killCalls, 0);
    assertEquals(handle.disposeCalls, 0);
    assertEquals(server.controller.inspect().sessions.map((session) => session.id), [spawned.id]);

    const second = await connectMuxstoneWebSocket({ url: address.url, authToken: token, requestTimeoutMs: 2_000 });
    try {
      const inventory = await second.list();
      assertEquals(inventory.map((session) => session.id), [spawned.id]);
      const reattached = await second.attach(spawned.id, {
        sinceSequence: attached.replay.at(-1)?.sequence,
        onOutput: () => {},
      });
      assertEquals(reattached.replay.length, 1);
      assertEquals(await second.kill(spawned.id), true);
      assertEquals(handle.killCalls, 1);
      assertEquals(handle.disposeCalls, 1);
      assertEquals(await second.list(), []);
    } finally {
      await second.dispose();
    }
  } finally {
    await first.dispose();
    await server.shutdown();
  }
});

Deno.test("Muxstone client keeps sustained attached output sequence bookkeeping bounded", async () => {
  const token = createMuxstoneAuthToken();
  const backend = new FakeRetainingBackend();
  const server = serveMuxstoneHost({ authToken: token, backend, port: 0 });
  const address = await server.address;
  const client = await connectMuxstoneWebSocket({ url: address.url, authToken: token, requestTimeoutMs: 4_000 });
  try {
    const spawned = await client.spawn({ command: "/bin/fake" });
    const output: number[] = [];
    await client.attach(spawned.id, {
      onOutput: (frame) => output.push(frame.sequence),
    });
    const handle = backend.handles[0]!;
    for (let batch = 1; batch <= 100; batch += 1) {
      for (let index = 0; index < 100; index += 1) handle.emit("x");
      await waitFor(() => output.length === batch * 100, 2_000);
    }
    assertEquals(output[0], 1);
    assertEquals(output.at(-1), 10_000);
    assertEquals(new Set(output).size, 10_000);
  } finally {
    await client.dispose();
    await server.shutdown();
  }
});

Deno.test({
  name: "Muxstone daemon starts in an independent Unix session and survives client disposal",
  ignore: Deno.build.os !== "linux",
  async fn() {
    const directory = await Deno.makeTempDir({ prefix: "muxstone-detached-" });
    const descriptorPath = `${directory}/host.json`;
    let first: Awaited<ReturnType<typeof connectOrLaunchMuxstoneLocalHost>> | undefined;
    let second: Awaited<ReturnType<typeof connectMuxstoneWebSocket>> | undefined;
    try {
      first = await connectOrLaunchMuxstoneLocalHost({
        stateDirectory: directory,
        descriptorPath,
        timeoutMs: 10_000,
        requestTimeoutMs: 3_000,
      });
      assertEquals(first.launched, true);
      assertEquals(first.descriptor.flowControlledReplay, true);
      const process = await new Deno.Command("/usr/bin/ps", {
        args: ["-o", "pid=,pgid=,sid=", "-p", String(first.descriptor.pid)],
        stdout: "piped",
        stderr: "piped",
      }).output();
      assert(process.success);
      const fields = new TextDecoder().decode(process.stdout).trim().split(/\s+/).map(Number);
      assertEquals(fields, [first.descriptor.pid, first.descriptor.pid, first.descriptor.pid]);

      await first.client.dispose();
      first = undefined;
      const descriptor = await readMuxstoneHostDescriptor(descriptorPath);
      assert(descriptor);
      assertEquals(descriptor.flowControlledReplay, true);
      second = await connectMuxstoneWebSocket({
        url: descriptor.url,
        authToken: descriptor.token,
        requestTimeoutMs: 3_000,
        flowControlledReplay: descriptor.flowControlledReplay === true,
      });
      assert(Number.isFinite(await second.ping()));
      await second.shutdownHost();
    } finally {
      await first?.client.dispose();
      await second?.dispose();
      try {
        const descriptor = await readMuxstoneHostDescriptor(descriptorPath);
        if (descriptor) {
          const cleanup = await connectMuxstoneWebSocket({
            url: descriptor.url,
            authToken: descriptor.token,
            requestTimeoutMs: 1_000,
            flowControlledReplay: descriptor.flowControlledReplay === true,
          });
          try {
            await cleanup.shutdownHost();
          } finally {
            await cleanup.dispose();
          }
        }
      } catch {
        // The explicitly shut down daemon normally removes its descriptor.
      }
      await Deno.remove(directory, { recursive: true }).catch(() => undefined);
    }
  },
});

Deno.test("Muxstone bootstrap retains an unreachable descriptor for a plausibly live host", async () => {
  const directory = await Deno.makeTempDir({ prefix: "muxstone-live-generation-" });
  const descriptorPath = `${directory}/host.json`;
  const descriptor = {
    schemaVersion: 1 as const,
    hostId: "plausibly-live-generation",
    url: "ws://127.0.0.1:9/muxstone/v1",
    token: createMuxstoneAuthToken(),
    pid: Deno.pid,
    startedAt: Date.now(),
  };
  let spawnCalls = 0;
  try {
    await writeMuxstoneHostDescriptor(descriptorPath, descriptor);
    await assertRejects(
      () =>
        connectOrLaunchMuxstoneLocalHost({
          stateDirectory: directory,
          descriptorPath,
          timeoutMs: 150,
          requestTimeoutMs: 100,
          spawnDaemon: () => {
            spawnCalls += 1;
          },
        }),
      Error,
      "appears alive",
    );
    assertEquals(spawnCalls, 0);
    assertEquals(await readMuxstoneHostDescriptor(descriptorPath), descriptor);
  } finally {
    await Deno.remove(directory, { recursive: true });
  }
});

Deno.test("Muxstone host descriptor is private atomic and strictly normalized", async () => {
  const directory = await Deno.makeTempDir({ prefix: "muxstone-client-" });
  const path = `${directory}/host.json`;
  try {
    const descriptor = {
      schemaVersion: 1 as const,
      hostId: "host-generation-1",
      url: "ws://127.0.0.1:34567/muxstone/v1",
      token: createMuxstoneAuthToken(),
      pid: Deno.pid,
      startedAt: 1234,
    };
    await writeMuxstoneHostDescriptor(path, descriptor);
    assertEquals(await readMuxstoneHostDescriptor(path), descriptor);
    const capableDescriptor = { ...descriptor, flowControlledReplay: true as const };
    await writeMuxstoneHostDescriptor(path, capableDescriptor);
    assertEquals(await readMuxstoneHostDescriptor(path), capableDescriptor);
    if (Deno.build.os !== "windows") assertEquals((await Deno.stat(path)).mode! & 0o777, 0o600);

    if (Deno.build.os !== "windows") {
      await Deno.chmod(path, 0o644);
      await assertRejects(() => readMuxstoneHostDescriptor(path), Error, "accessible by other users");
      await Deno.chmod(path, 0o600);
      await Deno.chmod(directory, 0o755);
      await assertRejects(() => readMuxstoneHostDescriptor(path), Error, "descriptor parent");
      await Deno.chmod(directory, 0o700);
    }

    await Deno.writeTextFile(path, JSON.stringify({ ...descriptor, unexpected: true }));
    await assertRejects(() => readMuxstoneHostDescriptor(path), Error, "invalid");
    await Deno.writeTextFile(path, JSON.stringify({ ...descriptor, flowControlledReplay: false }));
    await assertRejects(() => readMuxstoneHostDescriptor(path), Error, "invalid");
  } finally {
    await Deno.remove(directory, { recursive: true });
  }
});

class ScriptedMuxstoneSocket implements MuxstoneWebSocketLike {
  readyState: number = WebSocket.CONNECTING;
  readonly bufferedAmount = 0;
  binaryType: BinaryType = "blob";
  readonly sent: string[] = [];
  readonly closeCalls: Array<{ code?: number; reason?: string }> = [];
  readonly #listeners = new Map<string, Set<(event: Event & { data?: unknown }) => void>>();

  send(data: string): void {
    if (this.readyState !== WebSocket.OPEN) throw new Error("scripted socket is not open");
    this.sent.push(data);
  }

  close(code?: number, reason?: string): void {
    this.closeCalls.push({ code, reason });
    this.readyState = WebSocket.CLOSED;
  }

  addEventListener(type: string, listener: (event: Event & { data?: unknown }) => void): void {
    const listeners = this.#listeners.get(type) ?? new Set();
    listeners.add(listener);
    this.#listeners.set(type, listeners);
  }

  removeEventListener(type: string, listener: (event: Event & { data?: unknown }) => void): void {
    this.#listeners.get(type)?.delete(listener);
  }

  open(): void {
    this.readyState = WebSocket.OPEN;
    this.#emit("open");
  }

  serverClose(): void {
    this.readyState = WebSocket.CLOSED;
    this.#emit("close");
  }

  receive(message: MuxstoneServerMessage): void {
    this.#emit("message", encodeMuxstoneMessage(message));
  }

  requests(type: string): Array<Record<string, unknown> & { requestId: number }> {
    const requests: Array<Record<string, unknown> & { requestId: number }> = [];
    for (const encoded of this.sent) {
      const value: unknown = JSON.parse(encoded);
      if (!value || typeof value !== "object" || Array.isArray(value)) continue;
      const record = value as Record<string, unknown>;
      if (record.type === type && typeof record.requestId === "number") {
        requests.push({ ...record, requestId: record.requestId });
      }
    }
    return requests;
  }

  async waitForRequest(
    type: string,
    occurrence = 0,
  ): Promise<Record<string, unknown> & { requestId: number }> {
    await waitFor(() => this.requests(type).length > occurrence);
    return this.requests(type)[occurrence]!;
  }

  #emit(type: string, data?: unknown): void {
    const event = { data } as Event & { data?: unknown };
    for (const listener of this.#listeners.get(type) ?? []) listener(event);
  }
}

function fakeSocketOptions(
  socket: ScriptedMuxstoneSocket,
  requestTimeoutMs = 1_000,
  flowControlledReplay = false,
) {
  return {
    url: "ws://127.0.0.1:34567/muxstone/v1",
    authToken: "00".repeat(32),
    requestTimeoutMs,
    flowControlledReplay,
    createWebSocket: () => socket,
  };
}

async function connectedScriptedClient(
  requestTimeoutMs = 1_000,
  flowControlledReplay = false,
): Promise<{
  client: MuxstoneWebSocketClient;
  socket: ScriptedMuxstoneSocket;
}> {
  const socket = new ScriptedMuxstoneSocket();
  const client = new MuxstoneWebSocketClient(fakeSocketOptions(socket, requestTimeoutMs, flowControlledReplay));
  socket.open();
  socket.receive({ version: 1, type: "ready", hostId: "scripted-host" });
  await client.ready();
  return { client, socket };
}

function fakeSession(id: string, latestSequence: number): MuxstoneSessionDescriptor {
  return {
    id,
    backendId: "scripted",
    title: id,
    commandLine: "/bin/fake",
    status: "running",
    running: true,
    columns: 80,
    rows: 24,
    createdAt: 1,
    updatedAt: 1,
    latestSequence,
    attachedClients: 0,
  };
}

function sessionsMessage(
  requestId: number,
  sessions: readonly MuxstoneSessionDescriptor[],
): MuxstoneServerMessage {
  return { version: 1, type: "sessions", requestId, sessions };
}

function attachedMessage(
  requestId: number,
  session: MuxstoneSessionDescriptor,
  replayFromSequence: number,
): MuxstoneServerMessage {
  return {
    version: 1,
    type: "attached",
    requestId,
    session,
    replayFromSequence,
    latestSequence: session.latestSequence,
    truncated: false,
  };
}

function outputMessage(sessionId: string, sequence: number): MuxstoneServerMessage {
  return { version: 1, type: "output", sessionId, sequence, data: encodeMuxstoneData(String(sequence)) };
}

async function assertMuxstoneClientError(
  promise: Promise<unknown>,
  code: string,
  message: string,
): Promise<void> {
  const error = await assertRejects(() => promise, MuxstoneClientError, message);
  assertEquals(error.code, code);
}

async function auditUnhandledRejections(run: () => Promise<void>): Promise<void> {
  const reasons: unknown[] = [];
  const listener = (event: PromiseRejectionEvent) => {
    reasons.push(event.reason);
    event.preventDefault();
  };
  globalThis.addEventListener("unhandledrejection", listener);
  try {
    await run();
    await nextMacrotask();
    assertEquals(reasons, []);
  } finally {
    globalThis.removeEventListener("unhandledrejection", listener);
  }
}

function nextMacrotask(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

class FakeRetainingBackend implements TerminalBackend {
  readonly id = "fake-retaining";
  readonly label = "Fake retaining PTY";
  readonly pty = true;
  readonly detachable = false;
  readonly reconnectable = false;
  readonly handles: FakeTerminalHandle[] = [];

  spawn(options: TerminalBackendSpawnOptions): TerminalSessionHandle {
    const handle = new FakeTerminalHandle(options, this.id);
    this.handles.push(handle);
    return handle;
  }
}

class FakeTerminalHandle implements TerminalSessionHandle {
  readonly id = crypto.randomUUID();
  readonly output = new TerminalOutputController();
  readonly command: ProcessSessionCommand;
  readonly closed: Promise<ProcessSessionInspection>;
  readonly writes: string[] = [];
  readonly resizes: Array<{ columns: number; rows: number }> = [];
  readonly #onData?: TerminalBackendSpawnOptions["onData"];
  #resolveClosed!: (inspection: ProcessSessionInspection) => void;
  #running = true;
  #columns: number;
  #rows: number;
  killCalls = 0;
  disposeCalls = 0;

  constructor(options: TerminalBackendSpawnOptions, readonly backendId: string) {
    this.command = {
      command: options.command,
      ...(options.args ? { args: [...options.args] } : {}),
      ...(options.cwd ? { cwd: options.cwd } : {}),
      ...(options.env ? { env: { ...options.env } } : {}),
    };
    this.#columns = options.columns ?? 80;
    this.#rows = options.rows ?? 24;
    this.#onData = options.onData;
    this.closed = new Promise((resolve) => this.#resolveClosed = resolve);
  }

  emit(data: string): void {
    this.#onData?.(data, "stdout");
  }

  write(data: string | Uint8Array): Promise<boolean> {
    this.writes.push(typeof data === "string" ? data : new TextDecoder().decode(data));
    return Promise.resolve(this.#running);
  }

  resize(columns: number, rows: number): Promise<boolean> {
    this.#columns = columns;
    this.#rows = rows;
    this.resizes.push({ columns, rows });
    return Promise.resolve(this.#running);
  }

  kill(): Promise<boolean> {
    this.killCalls += 1;
    const wasRunning = this.#running;
    this.#running = false;
    this.#resolveClosed(this.#processInspection());
    return Promise.resolve(wasRunning);
  }

  inspect(): TerminalSessionHandleInspection {
    return {
      id: this.id,
      backendId: this.backendId,
      pty: true,
      title: "fake",
      commandLine: this.command.command,
      status: this.#running ? "running" : "exited",
      running: this.#running,
      columns: this.#columns,
      rows: this.#rows,
      resizeSupported: true,
    };
  }

  dispose(): Promise<void> {
    this.disposeCalls += 1;
    return Promise.resolve();
  }

  #processInspection(): ProcessSessionInspection {
    return {
      status: this.#running ? "running" : "exited",
      running: this.#running,
      command: { ...this.command },
      commandLine: this.command.command,
      output: this.output.inspect(),
    };
  }
}

async function waitFor(predicate: () => boolean, timeoutMs = 1_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!predicate()) {
    if (Date.now() >= deadline) throw new Error("waitFor timed out");
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
}
