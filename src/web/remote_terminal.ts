/// <reference lib="dom" />
/// <reference lib="dom.iterable" />
// Copyright 2023 Im-Beast. MIT license.
import { EventEmitter } from "../event_emitter.ts";
import { encodeTerminalKeyPress, encodeTerminalPaste } from "../app/terminal_input.ts";
import { formatTerminalOutputLine, type TerminalOutputLine } from "../components/terminal_output.ts";
import type { ConsoleSize } from "../types.ts";
import type {
  KeyPressEvent,
  MousePressEvent,
  MouseScrollEvent,
  PasteEvent,
  TerminalFocusEvent,
} from "../input_reader/types.ts";
import type { TerminalSessionHandle } from "../runtime/terminal_backend.ts";

export type RemoteTerminalInputEvent =
  | { kind: "keyPress"; event: KeyPressEvent }
  | { kind: "mousePress"; event: MousePressEvent }
  | { kind: "mouseScroll"; event: MouseScrollEvent }
  | { kind: "paste"; event: PasteEvent }
  | { kind: "terminalFocus"; event: TerminalFocusEvent };

export type RemoteTerminalClientMessage =
  | { type: "input"; input: RemoteTerminalInputEvent }
  | { type: "resize"; size: ConsoleSize }
  | { type: "ping"; id: string };

export type RemoteTerminalServerMessage =
  | { type: "data"; data: string }
  | { type: "binary"; data: Uint8Array }
  | { type: "resize"; size: ConsoleSize }
  | { type: "pong"; id: string }
  | { type: "error"; message: string }
  | { type: "close"; reason?: string };

export interface RemoteTerminalTransport {
  send(message: string | Uint8Array): void;
  close(code?: number, reason?: string): void;
  onMessage(listener: (message: string | Uint8Array) => void): () => void;
  onClose(listener: (reason?: string) => void): () => void;
  onError?(listener: (error: unknown) => void): () => void;
}

export interface RemoteTerminalClientInspection {
  open: boolean;
  dataMessages: number;
  inputMessages: number;
  resizeMessages: number;
}

export type RemoteTerminalClientEvents = {
  data: { args: [string | Uint8Array] };
  resize: { args: [ConsoleSize] };
  error: { args: [unknown] };
  close: { args: [string | undefined] };
  pong: { args: [string] };
};

export interface RemoteTerminalBridgeInspection {
  open: boolean;
  dataMessages: number;
  inputMessages: number;
  resizeMessages: number;
  errorMessages: number;
}

export class RemoteTerminalClient extends EventEmitter<RemoteTerminalClientEvents> {
  readonly #transport: RemoteTerminalTransport;
  readonly #removeListeners: Array<() => void>;
  #open = true;
  #dataMessages = 0;
  #inputMessages = 0;
  #resizeMessages = 0;

  constructor(transport: RemoteTerminalTransport) {
    super();
    this.#transport = transport;
    this.#removeListeners = [
      transport.onMessage((message) => this.#handleMessage(message)),
      transport.onClose((reason) => {
        this.#open = false;
        this.emit("close", reason);
      }),
    ];
    const removeError = transport.onError?.((error) => this.emit("error", error));
    if (removeError) this.#removeListeners.push(removeError);
  }

  sendInput(input: RemoteTerminalInputEvent): void {
    this.#inputMessages += 1;
    this.#send({ type: "input", input });
  }

  sendKeyPress(event: KeyPressEvent): void {
    this.sendInput({ kind: "keyPress", event });
  }

  sendMousePress(event: MousePressEvent): void {
    this.sendInput({ kind: "mousePress", event });
  }

  sendMouseScroll(event: MouseScrollEvent): void {
    this.sendInput({ kind: "mouseScroll", event });
  }

  sendPaste(event: PasteEvent): void {
    this.sendInput({ kind: "paste", event });
  }

  sendTerminalFocus(event: TerminalFocusEvent): void {
    this.sendInput({ kind: "terminalFocus", event });
  }

  resize(size: ConsoleSize): void {
    this.#resizeMessages += 1;
    this.#send({ type: "resize", size });
  }

  ping(id = crypto.randomUUID()): string {
    this.#send({ type: "ping", id });
    return id;
  }

  close(code?: number, reason?: string): void {
    if (!this.#open) return;
    this.#open = false;
    this.#transport.close(code, reason);
    for (const remove of this.#removeListeners) remove();
    this.#removeListeners.length = 0;
  }

  inspectClient(): RemoteTerminalClientInspection {
    return {
      open: this.#open,
      dataMessages: this.#dataMessages,
      inputMessages: this.#inputMessages,
      resizeMessages: this.#resizeMessages,
    };
  }

  #send(message: RemoteTerminalClientMessage): void {
    this.#transport.send(encodeRemoteTerminalMessage(message));
  }

  #handleMessage(message: string | Uint8Array): void {
    const decoded = decodeRemoteTerminalServerMessage(message);
    if (decoded.type === "data") {
      this.#dataMessages += 1;
      this.emit("data", decoded.data);
    } else if (decoded.type === "binary") {
      this.#dataMessages += 1;
      this.emit("data", decoded.data);
    } else if (decoded.type === "resize") {
      this.emit("resize", decoded.size);
    } else if (decoded.type === "pong") {
      this.emit("pong", decoded.id);
    } else if (decoded.type === "error") {
      this.emit("error", new Error(decoded.message));
    } else {
      this.#open = false;
      this.emit("close", decoded.reason);
    }
  }
}

export class WebSocketRemoteTerminalTransport implements RemoteTerminalTransport {
  readonly #socket: WebSocket;

  constructor(url: string | URL, protocols?: string | string[]) {
    this.#socket = new WebSocket(url, protocols);
    this.#socket.binaryType = "arraybuffer";
  }

  send(message: string | Uint8Array): void {
    this.#socket.send(message);
  }

  close(code?: number, reason?: string): void {
    this.#socket.close(code, reason);
  }

  onMessage(listener: (message: string | Uint8Array) => void): () => void {
    const handler = (event: MessageEvent) => {
      if (typeof event.data === "string") {
        listener(event.data);
      } else if (event.data instanceof ArrayBuffer) {
        listener(new Uint8Array(event.data));
      } else if (event.data instanceof Blob) {
        void event.data.arrayBuffer().then((buffer) => listener(new Uint8Array(buffer)));
      }
    };
    this.#socket.addEventListener("message", handler);
    return () => this.#socket.removeEventListener("message", handler);
  }

  onClose(listener: (reason?: string) => void): () => void {
    const handler = (event: CloseEvent) => listener(event.reason);
    this.#socket.addEventListener("close", handler);
    return () => this.#socket.removeEventListener("close", handler);
  }

  onError(listener: (error: unknown) => void): () => void {
    const handler = (event: Event) => listener(event);
    this.#socket.addEventListener("error", handler);
    return () => this.#socket.removeEventListener("error", handler);
  }
}

export function createRemoteTerminalClient(transport: RemoteTerminalTransport): RemoteTerminalClient {
  return new RemoteTerminalClient(transport);
}

export function createWebSocketRemoteTerminalClient(
  url: string | URL,
  protocols?: string | string[],
): RemoteTerminalClient {
  return new RemoteTerminalClient(new WebSocketRemoteTerminalTransport(url, protocols));
}

export interface RemoteTerminalBridgeOptions {
  killOnClose?: boolean;
  sourcePrefix?: boolean;
}

export class RemoteTerminalBridge {
  readonly #transport: RemoteTerminalTransport;
  readonly #session: TerminalSessionHandle;
  readonly #options: RemoteTerminalBridgeOptions;
  readonly #removeListeners: Array<() => void>;
  #open = true;
  #dataMessages = 0;
  #inputMessages = 0;
  #resizeMessages = 0;
  #errorMessages = 0;
  #lineCount = 0;

  constructor(
    transport: RemoteTerminalTransport,
    session: TerminalSessionHandle,
    options: RemoteTerminalBridgeOptions = {},
  ) {
    this.#transport = transport;
    this.#session = session;
    this.#options = options;
    this.#lineCount = session.output.lines.peek().length;
    const outputListener = (lines: TerminalOutputLine[]) => this.#sendNewOutputLines(lines);
    session.output.lines.subscribe(outputListener);
    this.#removeListeners = [
      transport.onMessage((message) => void this.#handleClientMessage(message)),
      transport.onClose((reason) => {
        const wasOpen = this.#open;
        this.#open = false;
        if (this.#options.killOnClose) void this.#session.kill();
        this.#disposeListeners();
        if (wasOpen && reason) this.#send({ type: "close", reason });
      }),
      () => session.output.lines.unsubscribe(outputListener),
    ];
    const removeError = transport.onError?.((error) =>
      this.#sendError(error instanceof Error ? error.message : String(error))
    );
    if (removeError) this.#removeListeners.push(removeError);
  }

  sendData(data: string | Uint8Array): void {
    if (typeof data === "string") this.#send({ type: "data", data });
    else this.#send({ type: "binary", data });
  }

  close(reason?: string): void {
    if (!this.#open) return;
    this.#open = false;
    this.#send({ type: "close", reason });
    this.#disposeListeners();
    this.#transport.close(undefined, reason);
  }

  inspectBridge(): RemoteTerminalBridgeInspection {
    return {
      open: this.#open,
      dataMessages: this.#dataMessages,
      inputMessages: this.#inputMessages,
      resizeMessages: this.#resizeMessages,
      errorMessages: this.#errorMessages,
    };
  }

  async #handleClientMessage(message: string | Uint8Array): Promise<void> {
    if (!this.#open) return;
    let decoded: RemoteTerminalClientMessage;
    try {
      decoded = decodeRemoteTerminalClientMessage(message);
    } catch (error) {
      this.#sendError(error instanceof Error ? error.message : String(error));
      return;
    }

    if (decoded.type === "ping") {
      this.#send({ type: "pong", id: decoded.id });
      return;
    }
    if (decoded.type === "resize") {
      this.#resizeMessages += 1;
      const resized = await this.#session.resize(decoded.size.columns, decoded.size.rows);
      if (!resized && this.#session.inspect().resizeSupported) {
        this.#sendError("terminal resize was not accepted");
      }
      this.#send({ type: "resize", size: decoded.size });
      return;
    }

    this.#inputMessages += 1;
    const bytes = encodeRemoteTerminalInput(decoded.input);
    if (!bytes) return;
    const written = await this.#session.write(bytes);
    if (!written) this.#sendError("terminal input was not accepted");
  }

  #sendNewOutputLines(lines: readonly TerminalOutputLine[]): void {
    if (!this.#open || lines.length <= this.#lineCount) return;
    const next = lines.slice(this.#lineCount);
    this.#lineCount = lines.length;
    for (const line of next) {
      this.#send({
        type: "data",
        data: `${formatTerminalOutputLine(line, { sourcePrefix: this.#options.sourcePrefix ?? true })}\n`,
      });
    }
  }

  #sendError(message: string): void {
    this.#errorMessages += 1;
    this.#send({ type: "error", message });
  }

  #send(message: RemoteTerminalServerMessage): void {
    if (message.type === "data" || message.type === "binary") this.#dataMessages += 1;
    this.#transport.send(encodeRemoteTerminalServerMessage(message));
  }

  #disposeListeners(): void {
    for (const remove of this.#removeListeners) remove();
    this.#removeListeners.length = 0;
  }
}

export function createRemoteTerminalBridge(
  transport: RemoteTerminalTransport,
  session: TerminalSessionHandle,
  options: RemoteTerminalBridgeOptions = {},
): RemoteTerminalBridge {
  return new RemoteTerminalBridge(transport, session, options);
}

export function encodeRemoteTerminalInput(input: RemoteTerminalInputEvent): Uint8Array | undefined {
  if (input.kind === "keyPress") return encodeTerminalKeyPress(input.event);
  if (input.kind === "paste") return encodeTerminalPaste(input.event);
  if (input.event.buffer.byteLength > 0) return new Uint8Array(input.event.buffer);
  return undefined;
}

export function encodeRemoteTerminalMessage(message: RemoteTerminalClientMessage): string {
  return JSON.stringify(message, (_key, value) => {
    if (value instanceof Uint8Array) {
      return { __type: "Uint8Array", data: Array.from(value) };
    }
    return value;
  });
}

export function encodeRemoteTerminalServerMessage(message: RemoteTerminalServerMessage): string | Uint8Array {
  if (message.type === "binary") return message.data;
  return JSON.stringify(message, (_key, value) => {
    if (value instanceof Uint8Array) {
      return { __type: "Uint8Array", data: Array.from(value) };
    }
    return value;
  });
}

export function decodeRemoteTerminalClientMessage(message: string | Uint8Array): RemoteTerminalClientMessage {
  return JSON.parse(decodeMessage(message), reviveRemoteValue) as RemoteTerminalClientMessage;
}

export function decodeRemoteTerminalServerMessage(message: string | Uint8Array): RemoteTerminalServerMessage {
  if (message instanceof Uint8Array) {
    return { type: "binary", data: message };
  }
  return JSON.parse(message, reviveRemoteValue) as RemoteTerminalServerMessage;
}

function decodeMessage(message: string | Uint8Array): string {
  return typeof message === "string" ? message : new TextDecoder().decode(message);
}

function reviveRemoteValue(_key: string, value: unknown): unknown {
  if (
    value && typeof value === "object" && "__type" in value && value.__type === "Uint8Array" && "data" in value &&
    Array.isArray(value.data)
  ) {
    return new Uint8Array(value.data);
  }
  return value;
}
