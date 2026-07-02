// Copyright 2023 Im-Beast. MIT license.
import type { KeyPressEvent, MousePressEvent, MouseScrollEvent, PasteEvent } from "../input_reader/types.ts";

/** Terminal input routing mode for focused process windows. */
export type TerminalInputMode = "workbench" | "raw";

/** DEC mouse tracking mode currently negotiated by a child terminal application. */
export type TerminalMouseTrackingMode = "none" | "press" | "button" | "any";

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
  mouseTracking?: TerminalMouseTrackingMode;
  sgrMouse?: boolean;
  mouseOrigin?: { column: number; row: number };
  reservedKeys?: readonly string[];
  reservedCtrlKeys?: readonly string[];
}

/** Serializable decision for whether a key was routed to a child process. */
export interface TerminalInputRouteDecision {
  routed: boolean;
  reason: "encoded" | "workbench-mode" | "reserved" | "unencodable" | "not-running" | "write-failed";
  bytes?: Uint8Array;
}

/** Minimal mouse event shape accepted by terminal mouse encoders. */
export interface TerminalMouseInputEvent {
  buffer: Uint8Array;
  x: number;
  y: number;
  meta: boolean;
  ctrl: boolean;
  shift: boolean;
  drag?: boolean;
  release?: boolean;
  button?: 0 | 1 | 2;
  scroll?: -1 | 0 | 1;
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

/** Encodes a mouse press or wheel event as xterm SGR mouse input for a child process. */
export function encodeTerminalMouse(
  event: TerminalMouseInputEvent,
  options: Pick<TerminalInputRoutingOptions, "mouseTracking" | "sgrMouse" | "mouseOrigin"> = {},
): Uint8Array | undefined {
  if (event.buffer.byteLength > 0) return new Uint8Array(event.buffer);
  const tracking = options.mouseTracking ?? "none";
  if (tracking === "none" || !options.sgrMouse) return undefined;
  const scroll = event.scroll ?? 0;
  const drag = Boolean(event.drag);
  if (drag && tracking === "press") return undefined;

  const localX = event.x - (options.mouseOrigin?.column ?? 0);
  const localY = event.y - (options.mouseOrigin?.row ?? 0);
  if (localX < 0 || localY < 0) return undefined;

  let code: number;
  let suffix = "M";
  if (scroll !== 0) {
    code = scroll < 0 ? 64 : 65;
  } else if (event.release) {
    code = 3;
    suffix = "m";
  } else if (event.button === undefined) {
    return undefined;
  } else {
    code = event.button;
    if (drag) code += 32;
  }
  if (event.shift) code += 4;
  if (event.meta) code += 8;
  if (event.ctrl) code += 16;
  return textEncoder.encode(`\x1b[<${code};${Math.floor(localX) + 1};${Math.floor(localY) + 1}${suffix}`);
}

/** Derives supported xterm mouse routing settings from DEC private modes tracked by a terminal screen. */
export function terminalMouseRoutingFromPrivateModes(
  modes: Iterable<number>,
): Pick<TerminalInputRoutingOptions, "mouseTracking" | "sgrMouse"> {
  const active = new Set(modes);
  const mouseTracking: TerminalMouseTrackingMode = active.has(1003)
    ? "any"
    : active.has(1002)
    ? "button"
    : active.has(1000)
    ? "press"
    : "none";
  return {
    mouseTracking,
    sgrMouse: active.has(1006),
  };
}

/** Returns true when a key should stay with the host workbench instead of the child process. */
export function isReservedTerminalKey(
  event: Pick<KeyPressEvent, "key" | "ctrl" | "meta">,
  options: TerminalInputRoutingOptions = {},
): boolean {
  return event.meta ||
    terminalReservedKeyIncludes(options.reservedKeys, defaultReservedKeys, event.key) ||
    (event.ctrl && terminalReservedKeyIncludes(options.reservedCtrlKeys, defaultReservedCtrlKeys, event.key));
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

/** Routes a mouse event to a process session when raw terminal input and negotiated mouse mode are active. */
export async function routeTerminalMouse(
  session: TerminalInputTarget,
  event: MousePressEvent | MouseScrollEvent,
  options: TerminalInputRoutingOptions = {},
): Promise<TerminalInputRouteDecision> {
  if ((options.mode ?? "workbench") !== "raw") return { routed: false, reason: "workbench-mode" };
  if (!terminalInputTargetRunning(session)) return { routed: false, reason: "not-running" };
  const bytes = encodeTerminalMouse(event, options);
  if (!bytes) return { routed: false, reason: "unencodable" };
  const routed = await writeTerminalInput(session, bytes);
  return routed ? { routed, reason: "encoded", bytes } : { routed: false, reason: "write-failed", bytes };
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

function terminalReservedKeyIncludes(
  override: readonly string[] | undefined,
  defaults: ReadonlySet<string>,
  key: string,
): boolean {
  if (!override) return defaults.has(key);
  for (let index = 0; index < override.length; index += 1) {
    if (override[index] === key) return true;
  }
  return false;
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
