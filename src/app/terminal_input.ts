// Copyright 2023 Im-Beast. MIT license.
import type { KeyPressEvent, PasteEvent } from "../input_reader/types.ts";

/** Terminal input routing mode for focused process windows. */
export type TerminalInputMode = "workbench" | "raw";

/** Minimal process or PTY target accepted by terminal input routing helpers. */
export interface TerminalInputTarget {
  readonly running?: boolean;
  inspect?: () => { running: boolean };
  writeInput?: (data: string | Uint8Array) => Promise<boolean>;
  write?: (data: string | Uint8Array) => Promise<boolean>;
}

/** Options for encoding and routing terminal input. */
export interface TerminalInputRoutingOptions {
  mode?: TerminalInputMode;
  bracketedPaste?: boolean;
  reservedKeys?: readonly string[];
  reservedCtrlKeys?: readonly string[];
}

/** Serializable decision for whether a key was routed to a child process. */
export interface TerminalInputRouteDecision {
  routed: boolean;
  reason: "encoded" | "workbench-mode" | "reserved" | "unencodable" | "not-running" | "write-failed";
  bytes?: Uint8Array;
}

const textEncoder = new TextEncoder();
const defaultReservedKeys = new Set(["f10", "escape"]);
const defaultReservedCtrlKeys = new Set(["c"]);

/** Encodes a decoded key press into terminal input bytes for a child process. */
export function encodeTerminalKeyPress(event: Pick<KeyPressEvent, "key" | "buffer" | "ctrl" | "meta" | "shift">) {
  if (event.buffer.byteLength > 0) return new Uint8Array(event.buffer);
  if (event.meta) return undefined;
  if (event.ctrl && /^[a-z]$/.test(event.key)) {
    return new Uint8Array([event.key.charCodeAt(0) - 96]);
  }

  const special = specialKeyBytes(event.key);
  if (special) return textEncoder.encode(special);
  if (event.key.length === 1) {
    const value = event.shift && /^[a-z]$/.test(event.key) ? event.key.toUpperCase() : event.key;
    return textEncoder.encode(value);
  }
  return undefined;
}

/** Encodes paste payload text for a child process, optionally using xterm bracketed paste framing. */
export function encodeTerminalPaste(
  event: Pick<PasteEvent, "text" | "buffer">,
  options: Pick<TerminalInputRoutingOptions, "bracketedPaste"> = {},
): Uint8Array {
  if (event.buffer.byteLength > 0) return new Uint8Array(event.buffer);
  const text = options.bracketedPaste ? `\x1b[200~${event.text}\x1b[201~` : event.text;
  return textEncoder.encode(text);
}

/** Returns true when a key should stay with the host workbench instead of the child process. */
export function isReservedTerminalKey(
  event: Pick<KeyPressEvent, "key" | "ctrl" | "meta">,
  options: TerminalInputRoutingOptions = {},
): boolean {
  const reservedKeys = new Set([...(options.reservedKeys ?? defaultReservedKeys)]);
  const reservedCtrlKeys = new Set([...(options.reservedCtrlKeys ?? defaultReservedCtrlKeys)]);
  return event.meta || reservedKeys.has(event.key) || (event.ctrl && reservedCtrlKeys.has(event.key));
}

/** Routes a key press to a process session when raw terminal input mode is active. */
export async function routeTerminalKeyPress(
  session: TerminalInputTarget,
  event: KeyPressEvent,
  options: TerminalInputRoutingOptions = {},
): Promise<TerminalInputRouteDecision> {
  if ((options.mode ?? "workbench") !== "raw") return { routed: false, reason: "workbench-mode" };
  if (isReservedTerminalKey(event, options)) return { routed: false, reason: "reserved" };
  if (!terminalInputTargetRunning(session)) return { routed: false, reason: "not-running" };
  const bytes = encodeTerminalKeyPress(event);
  if (!bytes) return { routed: false, reason: "unencodable" };
  const routed = await writeTerminalInput(session, bytes);
  return routed ? { routed, reason: "encoded", bytes } : { routed, reason: "write-failed", bytes };
}

/** Routes a paste payload to a process session when raw terminal input mode is active. */
export async function routeTerminalPaste(
  session: TerminalInputTarget,
  event: PasteEvent,
  options: TerminalInputRoutingOptions = {},
): Promise<TerminalInputRouteDecision> {
  if ((options.mode ?? "workbench") !== "raw") return { routed: false, reason: "workbench-mode" };
  if (!terminalInputTargetRunning(session)) return { routed: false, reason: "not-running" };
  const bytes = encodeTerminalPaste(event, options);
  const routed = await writeTerminalInput(session, bytes);
  return routed ? { routed, reason: "encoded", bytes } : { routed, reason: "write-failed", bytes };
}

function terminalInputTargetRunning(session: TerminalInputTarget): boolean {
  if (typeof session.running === "boolean") return session.running;
  return session.inspect?.().running ?? false;
}

function writeTerminalInput(session: TerminalInputTarget, data: Uint8Array): Promise<boolean> {
  if (session.writeInput) return session.writeInput(data);
  if (session.write) return session.write(data);
  return Promise.resolve(false);
}

function specialKeyBytes(key: string): string | undefined {
  switch (key) {
    case "return":
      return "\r";
    case "tab":
      return "\t";
    case "backspace":
      return "\x7f";
    case "escape":
      return "\x1b";
    case "space":
      return " ";
    case "up":
      return "\x1b[A";
    case "down":
      return "\x1b[B";
    case "right":
      return "\x1b[C";
    case "left":
      return "\x1b[D";
    case "home":
      return "\x1b[H";
    case "end":
      return "\x1b[F";
    case "insert":
      return "\x1b[2~";
    case "delete":
      return "\x1b[3~";
    case "pageup":
      return "\x1b[5~";
    case "pagedown":
      return "\x1b[6~";
    default:
      return undefined;
  }
}
