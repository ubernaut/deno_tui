// Copyright 2023 Im-Beast. MIT license.

import { MUXSTONE_PROTOCOL_LIMITS } from "./protocol.ts";

const INPUT_PIPELINE_DEPTH = 4;
const MAX_BUFFERED_INPUT_BYTES = MUXSTONE_PROTOCOL_LIMITS.inputBytes * INPUT_PIPELINE_DEPTH;
const inputEncoder = new TextEncoder();

type MuxstonePreparedInput =
  | Readonly<{ kind: "empty" }>
  | Readonly<{ kind: "rejected" }>
  | Readonly<{ kind: "accepted"; bytes: Uint8Array }>;

interface MuxstoneOperationQueueOptions {
  readonly write: (sessionId: string, data: Uint8Array) => Promise<boolean>;
  readonly reportError: (error: unknown) => void;
}

interface MuxstonePendingInput {
  readonly sessionId: string;
  readonly bytes: Uint8Array;
}

interface MuxstoneInputQueueEntry {
  readonly kind: "input";
  readonly pending: MuxstonePendingInput[];
  readonly waiters: Array<() => void>;
  inFlight: number;
}

interface MuxstoneBarrierQueueEntry {
  readonly kind: "barrier";
  readonly operation: () => void | Promise<unknown>;
  readonly onSettled?: () => void;
  readonly resolve: () => void;
  running: boolean;
}

type MuxstoneQueueEntry = MuxstoneInputQueueEntry | MuxstoneBarrierQueueEntry;

/**
 * Ordered input/control scheduler with bounded memory and a bounded raw-write
 * pipeline. The host serializes protocol requests in send order, while the
 * client need not wait for one ACK per typed character before sending more.
 */
export class MuxstoneOperationQueue {
  readonly #write: (sessionId: string, data: Uint8Array) => Promise<boolean>;
  readonly #reportError: (error: unknown) => void;
  readonly #entries: MuxstoneQueueEntry[] = [];
  #bufferedInputBytes = 0;
  #pendingBarriers = 0;
  #disposed = false;
  #idlePromise: Promise<void> = Promise.resolve();
  #resolveIdle?: () => void;

  constructor(options: MuxstoneOperationQueueOptions) {
    this.#write = options.write;
    this.#reportError = options.reportError;
  }

  enqueueInput(sessionId: string, data: string | Uint8Array): Promise<void> {
    if (this.#disposed) return this.whenIdle();
    const prepared = this.#prepareInput(data);
    if (prepared.kind === "empty") return this.whenIdle();
    if (prepared.kind === "rejected") {
      this.#reportInputLimit();
      return this.whenIdle();
    }
    const bytes = prepared.bytes;
    this.#bufferedInputBytes += bytes.byteLength;
    this.#markBusy();
    let entry = this.#entries.at(-1);
    if (!entry || entry.kind !== "input") {
      entry = { kind: "input", pending: [], waiters: [], inFlight: 0 };
      this.#entries.push(entry);
    }
    appendTargetedProtocolChunks(entry.pending, sessionId, bytes);
    const completed = new Promise<void>((resolve) => entry.waiters.push(resolve));
    queueMicrotask(() => this.#pump());
    return completed;
  }

  enqueueBarrier(operation: () => void | Promise<unknown>): Promise<void> {
    return this.#enqueueBarrier(operation);
  }

  /**
   * Reserves, bounds, and protocol-chunks input at ingress, then decides at
   * its ordered barrier whether the payload is still allowed to reach the PTY.
   */
  enqueueGuardedInput(
    sessionId: string,
    data: string | Uint8Array,
    shouldWrite: () => boolean | Promise<boolean>,
  ): Promise<void> {
    if (this.#disposed) return this.whenIdle();
    const prepared = this.#prepareInput(data);
    if (prepared.kind === "empty") return this.whenIdle();
    const bytes = prepared.kind === "accepted" ? prepared.bytes : undefined;
    if (bytes) this.#bufferedInputBytes += bytes.byteLength;
    const chunks: Uint8Array[] = [];
    if (bytes) appendProtocolChunks(chunks, bytes);
    return this.#enqueueBarrier(
      async () => {
        if (!await shouldWrite()) return;
        if (!bytes) {
          this.#reportInputLimit();
          return;
        }
        for (let offset = 0; offset < chunks.length && !this.#disposed; offset += INPUT_PIPELINE_DEPTH) {
          const batch = chunks.slice(offset, offset + INPUT_PIPELINE_DEPTH);
          await Promise.all(batch.map((chunk) =>
            Promise.resolve().then(() => this.#write(sessionId, chunk)).then(
              () => undefined,
              (error) => this.#reportError(error),
            )
          ));
        }
      },
      bytes ? () => this.#bufferedInputBytes -= bytes.byteLength : undefined,
    );
  }

  #enqueueBarrier(operation: () => void | Promise<unknown>, onSettled?: () => void): Promise<void> {
    if (this.#disposed) return this.whenIdle();
    this.#markBusy();
    const completed = new Promise<void>((resolve) => {
      this.#entries.push({ kind: "barrier", operation, onSettled, resolve, running: false });
      this.#pendingBarriers += 1;
    });
    queueMicrotask(() => this.#pump());
    return completed;
  }

  hasPendingBarrier(): boolean {
    return this.#pendingBarriers > 0;
  }

  async whenIdle(): Promise<void> {
    let observed: Promise<void>;
    do {
      observed = this.#idlePromise;
      await observed;
    } while (observed !== this.#idlePromise);
  }

  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    this.#pump();
  }

  #pump(): void {
    const entry = this.#entries[0];
    if (!entry) {
      this.#markIdle();
      return;
    }
    if (entry.kind === "barrier") {
      if (entry.running) return;
      entry.running = true;
      const operation = this.#disposed ? Promise.resolve() : Promise.resolve().then(entry.operation);
      void operation.catch(this.#reportError).finally(() => {
        entry.onSettled?.();
        if (this.#entries[0] === entry) {
          this.#entries.shift();
          this.#pendingBarriers = Math.max(0, this.#pendingBarriers - 1);
        }
        entry.resolve();
        this.#pump();
      });
      return;
    }
    if (this.#disposed) {
      for (const pending of entry.pending.splice(0)) this.#bufferedInputBytes -= pending.bytes.byteLength;
    }
    while (!this.#disposed && entry.inFlight < INPUT_PIPELINE_DEPTH && entry.pending.length > 0) {
      const pending = entry.pending.shift()!;
      entry.inFlight += 1;
      void Promise.resolve().then(() => this.#write(pending.sessionId, pending.bytes)).catch(this.#reportError).finally(
        () => {
          entry.inFlight -= 1;
          this.#bufferedInputBytes -= pending.bytes.byteLength;
          this.#pump();
        },
      );
    }
    if (entry.pending.length > 0 || entry.inFlight > 0) return;
    this.#entries.shift();
    for (const resolve of entry.waiters.splice(0)) resolve();
    this.#pump();
  }

  #markBusy(): void {
    if (this.#resolveIdle) return;
    this.#idlePromise = new Promise<void>((resolve) => this.#resolveIdle = resolve);
  }

  #markIdle(): void {
    const resolve = this.#resolveIdle;
    if (!resolve) return;
    this.#resolveIdle = undefined;
    resolve();
  }

  #prepareInput(data: string | Uint8Array): MuxstonePreparedInput {
    if (data.length === 0) return { kind: "empty" };
    const available = Math.max(0, MAX_BUFFERED_INPUT_BYTES - this.#bufferedInputBytes);

    // UTF-8 is never shorter than the source's UTF-16 code-unit count. This
    // preflight rejects oversized strings and byte arrays before copying them.
    if (data.length > available) return { kind: "rejected" };
    if (data instanceof Uint8Array) return { kind: "accepted", bytes: data.slice() };

    // Three bytes per UTF-16 code unit is a safe UTF-8 upper bound (surrogate
    // pairs consume four bytes for two units). encodeInto keeps the temporary
    // allocation bounded even when the encoded result crosses the queue cap.
    const scratch = new Uint8Array(Math.min(available, data.length * 3));
    const encoded = inputEncoder.encodeInto(data, scratch);
    if (encoded.read !== data.length) return { kind: "rejected" };
    return { kind: "accepted", bytes: scratch.slice(0, encoded.written) };
  }

  #reportInputLimit(): void {
    this.#reportError(
      new RangeError(`raw input buffer limit exceeded (${MAX_BUFFERED_INPUT_BYTES} bytes)`),
    );
  }
}

function appendTargetedProtocolChunks(
  pending: MuxstonePendingInput[],
  sessionId: string,
  bytes: Uint8Array,
): void {
  let offset = 0;
  const previous = pending.at(-1);
  if (
    previous?.sessionId === sessionId &&
    previous.bytes.byteLength < MUXSTONE_PROTOCOL_LIMITS.inputBytes
  ) {
    const take = Math.min(bytes.byteLength, MUXSTONE_PROTOCOL_LIMITS.inputBytes - previous.bytes.byteLength);
    const combined = new Uint8Array(previous.bytes.byteLength + take);
    combined.set(previous.bytes);
    combined.set(bytes.subarray(0, take), previous.bytes.byteLength);
    pending[pending.length - 1] = { sessionId, bytes: combined };
    offset = take;
  }
  while (offset < bytes.byteLength) {
    const end = Math.min(bytes.byteLength, offset + MUXSTONE_PROTOCOL_LIMITS.inputBytes);
    pending.push({ sessionId, bytes: bytes.slice(offset, end) });
    offset = end;
  }
}

function appendProtocolChunks(pending: Uint8Array[], bytes: Uint8Array): void {
  let offset = 0;
  const previous = pending.at(-1);
  if (previous && previous.byteLength < MUXSTONE_PROTOCOL_LIMITS.inputBytes) {
    const take = Math.min(bytes.byteLength, MUXSTONE_PROTOCOL_LIMITS.inputBytes - previous.byteLength);
    const combined = new Uint8Array(previous.byteLength + take);
    combined.set(previous);
    combined.set(bytes.subarray(0, take), previous.byteLength);
    pending[pending.length - 1] = combined;
    offset = take;
  }
  while (offset < bytes.byteLength) {
    const end = Math.min(bytes.byteLength, offset + MUXSTONE_PROTOCOL_LIMITS.inputBytes);
    pending.push(bytes.slice(offset, end));
    offset = end;
  }
}
