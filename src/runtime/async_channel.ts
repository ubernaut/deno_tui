// Copyright 2023 Im-Beast. MIT license.

/** Buffer behavior when an async channel cannot immediately accept a value. */
export type AsyncChannelOverflowPolicy =
  | "block"
  | "drop-newest"
  | "drop-oldest"
  | "conflate"
  | "error";

/** Observable lifecycle of a bounded async channel. */
export type AsyncChannelStatus = "open" | "closing" | "closed" | "aborted" | "disposed";

/** Settlement kind for one successful send operation. */
export type AsyncChannelSendStatus =
  | "delivered"
  | "buffered"
  | "dropped-newest"
  | "dropped-oldest"
  | "conflated";

/** Construction options for a bounded async channel. */
export interface AsyncChannelOptions {
  /** Maximum buffered values. Zero is supported only as a blocking rendezvous channel. */
  capacity: number;
  /** Full-buffer behavior. Defaults to `block`. */
  overflowPolicy?: AsyncChannelOverflowPolicy;
  /** First sequence assigned to a send attempt. Defaults to one. */
  initialSequence?: number;
  /** Maximum concurrently blocked sends. Defaults to 1024. */
  maxPendingSends?: number;
  /** Maximum concurrently blocked receives. Defaults to 1024. */
  maxPendingReceives?: number;
}

/** Optional cancellation for one send or receive operation. */
export interface AsyncChannelOperationOptions {
  signal?: AbortSignal;
}

/** Optional cancellation shared by every receive started through one iterator. */
export interface AsyncChannelIteratorOptions {
  signal?: AbortSignal;
}

/** Value-free result of a successful send. */
export interface AsyncChannelSendResult {
  readonly sequence: number;
  readonly status: AsyncChannelSendStatus;
  readonly accepted: boolean;
  readonly dropped: 0 | 1;
}

/** One received channel value. */
export interface AsyncChannelValueResult<Value> {
  readonly done: false;
  readonly value: Value;
  readonly sequence: number;
}

/** Graceful end marker returned after a closed channel drains. */
export interface AsyncChannelEndResult {
  readonly done: true;
  readonly value: undefined;
}

/** Result of one channel receive operation. */
export type AsyncChannelReceiveResult<Value> = AsyncChannelValueResult<Value> | AsyncChannelEndResult;

/** Fixed-size per-cause dropped-value counters. */
export interface AsyncChannelDroppedInspection {
  dropNewest: number;
  dropOldest: number;
  conflate: number;
  abort: number;
  dispose: number;
}

/** Clone-safe terminal error summary. Raw causes are never included. */
export interface AsyncChannelErrorInspection {
  name: string;
  message: string;
}

/**
 * Fixed-size clone-safe channel state. Values, signals, callbacks, and raw
 * error causes are deliberately excluded, so inspection cannot grow with a
 * buffer or waiter queue.
 */
export interface AsyncChannelInspection {
  status: AsyncChannelStatus;
  overflowPolicy: AsyncChannelOverflowPolicy;
  capacity: number;
  maxPendingSends: number;
  maxPendingReceives: number;
  depth: number;
  pendingSends: number;
  pendingReceives: number;
  sendAttempts: number;
  sent: number;
  received: number;
  dropped: number;
  droppedByPolicy: AsyncChannelDroppedInspection;
  overflowErrors: number;
  exhausted: boolean;
  nextSequence?: number;
  terminalError?: AsyncChannelErrorInspection;
}

/** Async iterator whose early return releases only its own pending receives. */
export interface AsyncChannelIterator<Value> extends AsyncIterableIterator<Value> {
  next(): Promise<AsyncChannelReceiveResult<Value>>;
  return(): Promise<AsyncChannelEndResult>;
}

/** Raised when a send starts after graceful close has begun. */
export class AsyncChannelClosedError extends Error {
  readonly code = "ASYNC_CHANNEL_CLOSED";

  constructor() {
    super("Async channel is closed.");
    this.name = "AsyncChannelClosedError";
  }
}

/** Raised for operations on an explicitly aborted channel. */
export class AsyncChannelAbortedError extends Error {
  readonly code = "ASYNC_CHANNEL_ABORTED";

  constructor(override readonly cause?: unknown) {
    super("Async channel was aborted.", { cause });
    this.name = "AsyncChannelAbortedError";
  }
}

/** Raised for operations on a disposed channel. */
export class AsyncChannelDisposedError extends Error {
  readonly code = "ASYNC_CHANNEL_DISPOSED";

  constructor() {
    super("Async channel is disposed.");
    this.name = "AsyncChannelDisposedError";
  }
}

/** Raised by the `error` policy when a send observes a full buffer. */
export class AsyncChannelOverflowError extends Error {
  readonly code = "ASYNC_CHANNEL_OVERFLOW";

  constructor(
    readonly sequence: number,
    readonly capacity: number,
    readonly depth: number,
  ) {
    super(`Async channel capacity ${capacity} is exhausted.`);
    this.name = "AsyncChannelOverflowError";
  }
}

/** Raised when a caller-owned AbortSignal cancels one pending operation. */
export class AsyncChannelOperationAbortedError extends Error {
  readonly code = "ASYNC_CHANNEL_OPERATION_ABORTED";

  constructor(
    readonly operation: "send" | "receive",
    override readonly cause?: unknown,
  ) {
    super(`Async channel ${operation} was aborted.`, { cause });
    this.name = "AsyncChannelOperationAbortedError";
  }
}

/** Raised after the channel has assigned Number.MAX_SAFE_INTEGER. */
export class AsyncChannelSequenceOverflowError extends Error {
  readonly code = "ASYNC_CHANNEL_SEQUENCE_OVERFLOW";

  constructor() {
    super("Async channel send sequence is exhausted.");
    this.name = "AsyncChannelSequenceOverflowError";
  }
}

/** Raised when a bounded pending-operation queue cannot accept another waiter. */
export class AsyncChannelWaiterLimitError extends Error {
  readonly code = "ASYNC_CHANNEL_WAITER_LIMIT";

  constructor(
    readonly operation: "send" | "receive",
    readonly limit: number,
    readonly pending: number,
  ) {
    super(`Async channel pending ${operation} limit ${limit} is exhausted.`);
    this.name = "AsyncChannelWaiterLimitError";
  }
}

interface BufferedValue<Value> {
  readonly sequence: number;
  readonly value: Value;
}

interface PendingSender<Value> extends BufferedValue<Value> {
  readonly resolve: (result: AsyncChannelSendResult) => void;
  readonly reject: (error: unknown) => void;
  readonly signal?: AbortSignal;
  abort?: () => void;
  settled: boolean;
}

interface PendingReceiver<Value> {
  readonly resolve: (result: AsyncChannelReceiveResult<Value>) => void;
  readonly reject: (error: unknown) => void;
  readonly signal?: AbortSignal;
  readonly iteratorReturnSignal?: AbortSignal;
  abort?: () => void;
  iteratorReturn?: () => void;
  settled: boolean;
}

const OVERFLOW_POLICIES: readonly AsyncChannelOverflowPolicy[] = [
  "block",
  "drop-newest",
  "drop-oldest",
  "conflate",
  "error",
];

const END_RESULT: AsyncChannelEndResult = Object.freeze({ done: true, value: undefined });
const DEFAULT_PENDING_WAITER_LIMIT = 1024;
const ABORT_SIGNAL_ABORTED_GETTER = Object.getOwnPropertyDescriptor(AbortSignal.prototype, "aborted")?.get;
const ABORT_SIGNAL_REASON_GETTER = Object.getOwnPropertyDescriptor(AbortSignal.prototype, "reason")?.get;
const ABORT_SIGNAL_ADD_EVENT_LISTENER = AbortSignal.prototype.addEventListener;
const ABORT_SIGNAL_REMOVE_EVENT_LISTENER = AbortSignal.prototype.removeEventListener;

type AbortSignalState =
  | { readonly kind: "active" }
  | { readonly kind: "aborted"; readonly reason: unknown }
  | { readonly kind: "invalid"; readonly error: unknown };

/** Renderer-neutral bounded multi-producer, multi-consumer async channel. */
export class AsyncChannel<Value> implements AsyncIterable<Value> {
  readonly capacity: number;
  readonly overflowPolicy: AsyncChannelOverflowPolicy;
  readonly maxPendingSends: number;
  readonly maxPendingReceives: number;

  readonly #buffer: BufferedValue<Value>[] = [];
  readonly #pendingSenders: PendingSender<Value>[] = [];
  readonly #pendingReceivers: PendingReceiver<Value>[] = [];
  #status: AsyncChannelStatus = "open";
  #nextSequence?: number;
  #sendAttempts = 0;
  #sent = 0;
  #received = 0;
  #dropNewest = 0;
  #dropOldest = 0;
  #conflated = 0;
  #droppedOnAbort = 0;
  #droppedOnDispose = 0;
  #overflowErrors = 0;
  #closeError?: AsyncChannelClosedError;
  #terminalError?: AsyncChannelAbortedError | AsyncChannelDisposedError;
  #terminalErrorInspection?: Readonly<AsyncChannelErrorInspection>;

  constructor(options: AsyncChannelOptions) {
    if (!options || typeof options !== "object") {
      throw new TypeError("Async channel options are required.");
    }
    this.capacity = validateCapacity(options.capacity);
    this.overflowPolicy = validateOverflowPolicy(options.overflowPolicy ?? "block");
    if (this.capacity === 0 && this.overflowPolicy !== "block") {
      throw new RangeError("A zero-capacity rendezvous channel requires the block overflow policy.");
    }
    this.#nextSequence = validateInitialSequence(options.initialSequence ?? 1);
    this.maxPendingSends = validateWaiterLimit(
      options.maxPendingSends ?? DEFAULT_PENDING_WAITER_LIMIT,
      "maxPendingSends",
    );
    this.maxPendingReceives = validateWaiterLimit(
      options.maxPendingReceives ?? DEFAULT_PENDING_WAITER_LIMIT,
      "maxPendingReceives",
    );
  }

  /** Current channel lifecycle state. */
  get status(): AsyncChannelStatus {
    return this.#status;
  }

  /**
   * Sends one value. Immediate policies still settle through a Promise;
   * `block` waits in FIFO order until the value is accepted.
   */
  send(
    value: Value,
    options: AsyncChannelOperationOptions = {},
  ): Promise<AsyncChannelSendResult> {
    const unavailable = this.sendUnavailableError();
    if (unavailable) return Promise.reject(unavailable);
    const signalState = inspectAbortSignal(options.signal);
    if (signalState.kind === "invalid") return Promise.reject(signalState.error);
    if (signalState.kind === "aborted") {
      return Promise.reject(new AsyncChannelOperationAbortedError("send", signalState.reason));
    }

    const sequence = this.allocateSequence();
    if (sequence instanceof Error) return Promise.reject(sequence);

    const receiver = this.takeReceiver();
    if (receiver) {
      const receiveResult = valueResult(sequence, value);
      const result = sendResult(sequence, "delivered", true, 0);
      this.#sent += 1;
      this.#received += 1;
      this.cleanupReceiver(receiver);
      receiver.resolve(receiveResult);
      return Promise.resolve(result);
    }

    if (this.#buffer.length < this.capacity) {
      this.#buffer.push({ sequence, value });
      this.#sent += 1;
      return Promise.resolve(sendResult(sequence, "buffered", true, 0));
    }

    switch (this.overflowPolicy) {
      case "block":
        return this.enqueueSender(sequence, value, options.signal);
      case "drop-newest":
        this.#dropNewest += 1;
        return Promise.resolve(sendResult(sequence, "dropped-newest", false, 1));
      case "drop-oldest":
        this.#buffer.shift();
        this.#buffer.push({ sequence, value });
        this.#sent += 1;
        this.#dropOldest += 1;
        return Promise.resolve(sendResult(sequence, "dropped-oldest", true, 1));
      case "conflate":
        this.#buffer[this.#buffer.length - 1] = { sequence, value };
        this.#sent += 1;
        this.#conflated += 1;
        return Promise.resolve(sendResult(sequence, "conflated", true, 1));
      case "error": {
        this.#overflowErrors += 1;
        return Promise.reject(new AsyncChannelOverflowError(sequence, this.capacity, this.#buffer.length));
      }
    }
  }

  /** Receives the oldest accepted value or the graceful end marker. */
  receive(options: AsyncChannelOperationOptions = {}): Promise<AsyncChannelReceiveResult<Value>> {
    return this.receiveInternal(options.signal);
  }

  /**
   * Stops accepting sends, rejects not-yet-accepted blocked sends, drains the
   * buffer through receives, and then returns the graceful end marker.
   */
  close(): boolean {
    if (this.#status !== "open") return false;
    this.#status = "closing";
    this.#closeError = Object.freeze(new AsyncChannelClosedError());
    this.rejectAllSenders(this.#closeError);
    this.finishGracefulCloseIfDrained();
    return true;
  }

  /** Aborts immediately, discarding buffered values and rejecting every waiter. */
  abort(reason?: unknown): boolean {
    if (this.#status === "closed" || this.#status === "aborted" || this.#status === "disposed") return false;
    const error = new AsyncChannelAbortedError(reason);
    this.#status = "aborted";
    this.#terminalError = Object.freeze(error);
    this.#terminalErrorInspection = Object.freeze({
      name: "AsyncChannelAbortedError",
      message: "Async channel was aborted.",
    });
    this.#droppedOnAbort += this.#buffer.length;
    this.#buffer.length = 0;
    this.rejectAllSenders(error);
    this.rejectAllReceivers(error);
    return true;
  }

  /**
   * Disposes immediately. Disposal supersedes any prior terminal state and is
   * idempotent; live buffers and waiters are discarded or rejected.
   */
  dispose(): boolean {
    if (this.#status === "disposed") return false;
    const error = new AsyncChannelDisposedError();
    this.#status = "disposed";
    this.#terminalError = Object.freeze(error);
    this.#terminalErrorInspection = Object.freeze({
      name: "AsyncChannelDisposedError",
      message: "Async channel is disposed.",
    });
    this.#droppedOnDispose += this.#buffer.length;
    this.#buffer.length = 0;
    this.rejectAllSenders(error);
    this.rejectAllReceivers(error);
    return true;
  }

  /** Returns a fresh fixed-size clone-safe status snapshot. */
  inspect(): AsyncChannelInspection {
    const droppedByPolicy: AsyncChannelDroppedInspection = {
      dropNewest: this.#dropNewest,
      dropOldest: this.#dropOldest,
      conflate: this.#conflated,
      abort: this.#droppedOnAbort,
      dispose: this.#droppedOnDispose,
    };
    const inspection: AsyncChannelInspection = {
      status: this.#status,
      overflowPolicy: this.overflowPolicy,
      capacity: this.capacity,
      maxPendingSends: this.maxPendingSends,
      maxPendingReceives: this.maxPendingReceives,
      depth: this.#buffer.length,
      pendingSends: this.#pendingSenders.length,
      pendingReceives: this.#pendingReceivers.length,
      sendAttempts: this.#sendAttempts,
      sent: this.#sent,
      received: this.#received,
      dropped: droppedByPolicy.dropNewest + droppedByPolicy.dropOldest + droppedByPolicy.conflate +
        droppedByPolicy.abort + droppedByPolicy.dispose,
      droppedByPolicy,
      overflowErrors: this.#overflowErrors,
      exhausted: this.#nextSequence === undefined,
      nextSequence: this.#nextSequence,
    };
    const terminalError = this.#terminalErrorInspection;
    if (terminalError) {
      inspection.terminalError = {
        name: terminalError.name,
        message: terminalError.message,
      };
    }
    return inspection;
  }

  /** Creates an independently cancellable iterator over channel receives. */
  values(options: AsyncChannelIteratorOptions = {}): AsyncChannelIterator<Value> {
    const iteratorController = new AbortController();
    let returned = false;
    const iterator: AsyncChannelIterator<Value> = {
      next: (): Promise<AsyncChannelReceiveResult<Value>> => {
        if (returned) return Promise.resolve(END_RESULT);
        return this.receiveInternal(options.signal, iteratorController.signal).then((result) => {
          if (result.done) returned = true;
          return result;
        });
      },
      return: (): Promise<AsyncChannelEndResult> => {
        if (!returned) {
          returned = true;
          iteratorController.abort();
        }
        return Promise.resolve(END_RESULT);
      },
      [Symbol.asyncIterator](): AsyncChannelIterator<Value> {
        return this;
      },
    };
    return iterator;
  }

  /** Creates a fresh iterator; iteration never claims ownership of the channel. */
  [Symbol.asyncIterator](): AsyncChannelIterator<Value> {
    return this.values();
  }

  private receiveInternal(
    signal?: AbortSignal,
    iteratorReturnSignal?: AbortSignal,
  ): Promise<AsyncChannelReceiveResult<Value>> {
    const iteratorState = inspectAbortSignal(iteratorReturnSignal);
    if (iteratorState.kind === "invalid") return Promise.reject(iteratorState.error);
    if (iteratorState.kind === "aborted") return Promise.resolve(END_RESULT);
    const unavailable = this.receiveUnavailableError();
    if (unavailable) return Promise.reject(unavailable);
    const signalState = inspectAbortSignal(signal);
    if (signalState.kind === "invalid") return Promise.reject(signalState.error);
    if (signalState.kind === "aborted") {
      return Promise.reject(new AsyncChannelOperationAbortedError("receive", signalState.reason));
    }

    const buffered = this.#buffer.shift();
    if (buffered) {
      this.#received += 1;
      this.promoteBlockedSenders();
      this.finishGracefulCloseIfDrained();
      return Promise.resolve(valueResult(buffered.sequence, buffered.value));
    }

    const sender = this.takeSender();
    if (sender) {
      this.#sent += 1;
      this.#received += 1;
      const received = valueResult(sender.sequence, sender.value);
      this.cleanupSender(sender);
      sender.resolve(sendResult(sender.sequence, "delivered", true, 0));
      return Promise.resolve(received);
    }

    if (this.#status === "closing" || this.#status === "closed") {
      this.finishGracefulCloseIfDrained();
      return Promise.resolve(END_RESULT);
    }
    return this.enqueueReceiver(signal, iteratorReturnSignal);
  }

  private sendUnavailableError(): Error | undefined {
    if (this.#status === "aborted" || this.#status === "disposed") return this.#terminalError;
    if (this.#status === "closing" || this.#status === "closed") {
      return this.#closeError ?? new AsyncChannelClosedError();
    }
    return undefined;
  }

  private receiveUnavailableError(): Error | undefined {
    if (this.#status === "aborted" || this.#status === "disposed") return this.#terminalError;
    return undefined;
  }

  private allocateSequence(): number | AsyncChannelSequenceOverflowError {
    const sequence = this.#nextSequence;
    if (sequence === undefined) return new AsyncChannelSequenceOverflowError();
    this.#nextSequence = sequence === Number.MAX_SAFE_INTEGER ? undefined : sequence + 1;
    this.#sendAttempts += 1;
    return sequence;
  }

  private enqueueSender(
    sequence: number,
    value: Value,
    signal?: AbortSignal,
  ): Promise<AsyncChannelSendResult> {
    if (this.#pendingSenders.length >= this.maxPendingSends) {
      return Promise.reject(
        new AsyncChannelWaiterLimitError("send", this.maxPendingSends, this.#pendingSenders.length),
      );
    }
    return new Promise((resolve, reject) => {
      const sender: PendingSender<Value> = {
        sequence,
        value,
        resolve,
        reject,
        signal,
        settled: false,
      };
      this.#pendingSenders.push(sender);
      if (!signal) return;

      sender.abort = () => {
        const error = operationAbortError("send", signal);
        if (!this.removeSender(sender)) return;
        this.cleanupSender(sender);
        sender.reject(error);
      };
      try {
        addAbortListener(signal, sender.abort);
        const signalState = inspectAbortSignal(signal);
        if (signalState.kind === "invalid") {
          if (this.removeSender(sender)) {
            this.cleanupSender(sender);
            sender.reject(signalState.error);
          }
        } else if (signalState.kind === "aborted") {
          sender.abort();
        }
      } catch (error) {
        if (this.removeSender(sender)) {
          this.cleanupSender(sender);
          sender.reject(error);
        }
      }
    });
  }

  private enqueueReceiver(
    signal?: AbortSignal,
    iteratorReturnSignal?: AbortSignal,
  ): Promise<AsyncChannelReceiveResult<Value>> {
    if (this.#pendingReceivers.length >= this.maxPendingReceives) {
      return Promise.reject(
        new AsyncChannelWaiterLimitError("receive", this.maxPendingReceives, this.#pendingReceivers.length),
      );
    }
    return new Promise((resolve, reject) => {
      const receiver: PendingReceiver<Value> = {
        resolve,
        reject,
        signal,
        iteratorReturnSignal,
        settled: false,
      };
      this.#pendingReceivers.push(receiver);

      receiver.abort = signal
        ? () => {
          const error = operationAbortError("receive", signal);
          if (!this.removeReceiver(receiver)) return;
          this.cleanupReceiver(receiver);
          receiver.reject(error);
        }
        : undefined;
      receiver.iteratorReturn = iteratorReturnSignal
        ? () => {
          if (!this.removeReceiver(receiver)) return;
          this.cleanupReceiver(receiver);
          receiver.resolve(END_RESULT);
        }
        : undefined;

      try {
        if (receiver.abort) {
          addAbortListener(signal!, receiver.abort);
          const signalState = inspectAbortSignal(signal);
          if (signalState.kind === "invalid") {
            if (this.removeReceiver(receiver)) {
              this.cleanupReceiver(receiver);
              receiver.reject(signalState.error);
            }
          } else if (signalState.kind === "aborted") {
            receiver.abort();
          }
          if (receiver.settled) return;
        }
        if (receiver.iteratorReturn) {
          addAbortListener(iteratorReturnSignal!, receiver.iteratorReturn);
          const iteratorState = inspectAbortSignal(iteratorReturnSignal);
          if (iteratorState.kind === "invalid") {
            if (this.removeReceiver(receiver)) {
              this.cleanupReceiver(receiver);
              receiver.reject(iteratorState.error);
            }
          } else if (iteratorState.kind === "aborted") {
            receiver.iteratorReturn();
          }
        }
      } catch (error) {
        if (this.removeReceiver(receiver)) {
          this.cleanupReceiver(receiver);
          receiver.reject(error);
        }
      }
    });
  }

  private takeSender(): PendingSender<Value> | undefined {
    while (true) {
      const sender = this.#pendingSenders.shift();
      if (!sender) return undefined;
      if (sender.settled) continue;
      const signalState = inspectAbortSignal(sender.signal);
      if (signalState.kind !== "active") {
        sender.settled = true;
        this.cleanupSender(sender);
        sender.reject(
          signalState.kind === "aborted"
            ? new AsyncChannelOperationAbortedError("send", signalState.reason)
            : signalState.error,
        );
        continue;
      }
      sender.settled = true;
      return sender;
    }
  }

  private takeReceiver(): PendingReceiver<Value> | undefined {
    while (true) {
      const receiver = this.#pendingReceivers.shift();
      if (!receiver) return undefined;
      if (receiver.settled) continue;
      const iteratorState = inspectAbortSignal(receiver.iteratorReturnSignal);
      if (iteratorState.kind !== "active") {
        receiver.settled = true;
        this.cleanupReceiver(receiver);
        if (iteratorState.kind === "aborted") receiver.resolve(END_RESULT);
        else receiver.reject(iteratorState.error);
        continue;
      }
      const signalState = inspectAbortSignal(receiver.signal);
      if (signalState.kind !== "active") {
        receiver.settled = true;
        this.cleanupReceiver(receiver);
        receiver.reject(
          signalState.kind === "aborted"
            ? new AsyncChannelOperationAbortedError("receive", signalState.reason)
            : signalState.error,
        );
        continue;
      }
      receiver.settled = true;
      return receiver;
    }
  }

  private removeSender(sender: PendingSender<Value>): boolean {
    if (sender.settled) return false;
    const index = this.#pendingSenders.indexOf(sender);
    if (index < 0) return false;
    this.#pendingSenders.splice(index, 1);
    sender.settled = true;
    return true;
  }

  private removeReceiver(receiver: PendingReceiver<Value>): boolean {
    if (receiver.settled) return false;
    const index = this.#pendingReceivers.indexOf(receiver);
    if (index < 0) return false;
    this.#pendingReceivers.splice(index, 1);
    receiver.settled = true;
    return true;
  }

  private cleanupSender(sender: PendingSender<Value>): void {
    if (!sender.abort || !sender.signal) return;
    try {
      removeAbortListener(sender.signal, sender.abort);
    } catch {
      // Hostile signal cleanup cannot change channel ownership or settlement.
    }
    sender.abort = undefined;
  }

  private cleanupReceiver(receiver: PendingReceiver<Value>): void {
    if (receiver.abort && receiver.signal) {
      try {
        removeAbortListener(receiver.signal, receiver.abort);
      } catch {
        // Hostile signal cleanup cannot change channel ownership or settlement.
      }
      receiver.abort = undefined;
    }
    if (receiver.iteratorReturn && receiver.iteratorReturnSignal) {
      try {
        removeAbortListener(receiver.iteratorReturnSignal, receiver.iteratorReturn);
      } catch {
        // Hostile signal cleanup cannot change channel ownership or settlement.
      }
      receiver.iteratorReturn = undefined;
    }
  }

  private promoteBlockedSenders(): void {
    while (this.#status === "open" && this.#buffer.length < this.capacity) {
      const sender = this.takeSender();
      if (!sender) return;
      this.#buffer.push({ sequence: sender.sequence, value: sender.value });
      this.#sent += 1;
      this.cleanupSender(sender);
      sender.resolve(sendResult(sender.sequence, "buffered", true, 0));
    }
  }

  private rejectAllSenders(error: Error): void {
    const senders = this.#pendingSenders.splice(0);
    for (const sender of senders) {
      if (sender.settled) continue;
      sender.settled = true;
      this.cleanupSender(sender);
      sender.reject(error);
    }
  }

  private rejectAllReceivers(error: Error): void {
    const receivers = this.#pendingReceivers.splice(0);
    for (const receiver of receivers) {
      if (receiver.settled) continue;
      receiver.settled = true;
      this.cleanupReceiver(receiver);
      receiver.reject(error);
    }
  }

  private finishGracefulCloseIfDrained(): void {
    if (this.#status !== "closing" || this.#buffer.length > 0) return;
    this.#status = "closed";
    const receivers = this.#pendingReceivers.splice(0);
    for (const receiver of receivers) {
      if (receiver.settled) continue;
      receiver.settled = true;
      this.cleanupReceiver(receiver);
      receiver.resolve(END_RESULT);
    }
  }
}

/** Creates a renderer-neutral bounded async channel. */
export function createAsyncChannel<Value>(options: AsyncChannelOptions): AsyncChannel<Value> {
  return new AsyncChannel<Value>(options);
}

function validateCapacity(value: number): number {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError("Async channel capacity must be a non-negative safe integer.");
  }
  return value;
}

function validateInitialSequence(value: number): number {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new RangeError("Async channel initialSequence must be a positive safe integer.");
  }
  return value;
}

function validateWaiterLimit(value: number, option: "maxPendingSends" | "maxPendingReceives"): number {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`Async channel ${option} must be a non-negative safe integer.`);
  }
  return value;
}

function validateOverflowPolicy(value: AsyncChannelOverflowPolicy): AsyncChannelOverflowPolicy {
  if (!OVERFLOW_POLICIES.includes(value)) {
    throw new TypeError(`Unknown async channel overflow policy: ${String(value)}`);
  }
  return value;
}

function sendResult(
  sequence: number,
  status: AsyncChannelSendStatus,
  accepted: boolean,
  dropped: 0 | 1,
): AsyncChannelSendResult {
  return Object.freeze({ sequence, status, accepted, dropped });
}

function valueResult<Value>(sequence: number, value: Value): AsyncChannelValueResult<Value> {
  return Object.freeze({ done: false, value, sequence });
}

function inspectAbortSignal(signal?: AbortSignal): AbortSignalState {
  if (!signal) return { kind: "active" };
  try {
    if (!ABORT_SIGNAL_ABORTED_GETTER || !ABORT_SIGNAL_REASON_GETTER) {
      throw new TypeError("This runtime does not expose standard AbortSignal state accessors.");
    }
    const aborted = Boolean(Reflect.apply(ABORT_SIGNAL_ABORTED_GETTER, signal, []));
    if (!aborted) return { kind: "active" };
    return {
      kind: "aborted",
      reason: Reflect.apply(ABORT_SIGNAL_REASON_GETTER, signal, []),
    };
  } catch (error) {
    return { kind: "invalid", error };
  }
}

function operationAbortError(
  operation: "send" | "receive",
  signal: AbortSignal,
): unknown {
  const signalState = inspectAbortSignal(signal);
  return signalState.kind === "invalid" ? signalState.error : new AsyncChannelOperationAbortedError(
    operation,
    signalState.kind === "aborted" ? signalState.reason : undefined,
  );
}

function addAbortListener(signal: AbortSignal, listener: () => void): void {
  Reflect.apply(ABORT_SIGNAL_ADD_EVENT_LISTENER, signal, ["abort", listener, { once: true }]);
}

function removeAbortListener(signal: AbortSignal, listener: () => void): void {
  Reflect.apply(ABORT_SIGNAL_REMOVE_EVENT_LISTENER, signal, ["abort", listener]);
}
