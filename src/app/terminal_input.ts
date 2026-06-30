// Copyright 2023 Im-Beast. MIT license.
import type { KeyPressEvent, PasteEvent } from "../input_reader/types.ts";
import type { ProcessSessionController } from "../runtime/process_session.ts";

/** Terminal input routing mode for focused process windows. */
export type TerminalInputMode = "workbench" | "raw";

/** Options for encoding and routing terminal input. */
export interface TerminalInputRoutingOptions {
  mode?: TerminalInputMode;
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

/** Encodes bracketed paste payload text for a child process. */
export function encodeTerminalPaste(event: Pick<PasteEvent, "text" | "buffer">): Uint8Array {
  return event.buffer.byteLength > 0 ? new Uint8Array(event.buffer) : textEncoder.encode(event.text);
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
  session: ProcessSessionController,
  event: KeyPressEvent,
  options: TerminalInputRoutingOptions = {},
): Promise<TerminalInputRouteDecision> {
  if ((options.mode ?? "workbench") !== "raw") return { routed: false, reason: "workbench-mode" };
  if (isReservedTerminalKey(event, options)) return { routed: false, reason: "reserved" };
  if (!session.running) return { routed: false, reason: "not-running" };
  const bytes = encodeTerminalKeyPress(event);
  if (!bytes) return { routed: false, reason: "unencodable" };
  const routed = await session.writeInput(bytes);
  return routed ? { routed, reason: "encoded", bytes } : { routed, reason: "write-failed", bytes };
}

/** Routes a paste payload to a process session when raw terminal input mode is active. */
export async function routeTerminalPaste(
  session: ProcessSessionController,
  event: PasteEvent,
  options: TerminalInputRoutingOptions = {},
): Promise<TerminalInputRouteDecision> {
  if ((options.mode ?? "workbench") !== "raw") return { routed: false, reason: "workbench-mode" };
  if (!session.running) return { routed: false, reason: "not-running" };
  const bytes = encodeTerminalPaste(event);
  const routed = await session.writeInput(bytes);
  return routed ? { routed, reason: "encoded", bytes } : { routed, reason: "write-failed", bytes };
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
