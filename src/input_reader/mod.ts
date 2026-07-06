// Copyright 2023 Im-Beast. MIT license.

import type {
  InputEvent,
  KeyPressEvent,
  MouseEvent,
  MousePressEvent,
  MouseScrollEvent,
  PasteEvent,
  TerminalFocusEvent,
} from "./types.ts";
import type { Stdin } from "../types.ts";
import { decodeKey } from "./decoders/keyboard.ts";
import type { EmitterEvent, EventEmitter } from "../event_emitter.ts";

/** Public type alias for an input Event Record. */
export type InputEventRecord = {
  inputEvent: EmitterEvent<[InputEvent]>;
  keyPress: EmitterEvent<[KeyPressEvent]>;
  mouseEvent: EmitterEvent<[MouseEvent | MousePressEvent | MouseScrollEvent]>;
  mousePress: EmitterEvent<[MousePressEvent]>;
  mouseScroll: EmitterEvent<[MouseScrollEvent]>;
  paste: EmitterEvent<[PasteEvent]>;
  terminalFocus: EmitterEvent<[TerminalFocusEvent]>;
};

const BRACKETED_PASTE_START_TEXT = "\x1b[200~";
const BRACKETED_PASTE_END_TEXT = "\x1b[201~";
const BRACKETED_PASTE_START = new TextEncoder().encode(BRACKETED_PASTE_START_TEXT);
const BRACKETED_PASTE_END = new TextEncoder().encode(BRACKETED_PASTE_END_TEXT);

/**
 * Read keypresses from given stdin, parse them and emit to given emitter.
 */
export async function emitInputEvents(
  stdin: Stdin,
  emitter: EventEmitter<InputEventRecord>,
  minReadInterval = 1000 / 60,
) {
  try {
    stdin.setRaw(true, { cbreak: Deno.build.os !== "windows" });
  } catch {
    // omit
  }

  const maxbuffer = new Uint8Array(1024);
  let pending = new Uint8Array(0);
  async function read() {
    const size = await stdin.read(maxbuffer);
    if (size == null) {
      return;
    }

    const buffer = maxbuffer.subarray(0, size);
    const combined = pending.length > 0 ? concatBuffers(pending, buffer) : buffer;
    const { complete, remainder } = splitInputBuffer(combined);
    pending = new Uint8Array(remainder);

    for (const event of decodeBuffer(complete)) {
      emitter.emit("inputEvent", event);
      if (event.key === "mouse") {
        emitter.emit("mouseEvent", event);

        if ("button" in event) {
          emitter.emit("mousePress", event);
        } else if ("scroll" in event) {
          emitter.emit("mouseScroll", event);
        }
      } else if (event.key === "paste") {
        emitter.emit("paste", event);
      } else if (event.key === "focus") {
        emitter.emit("terminalFocus", event);
      } else {
        emitter.emit("keyPress", event);
      }
    }

    setTimeout(read, minReadInterval);
  }
  await read();
}

const textDecoder = new TextDecoder();

let mouseEvent: MouseEvent = {
  key: "mouse",
  x: 0,
  y: 0,
  movementX: 0,
  movementY: 0,
  buffer: undefined as unknown as Uint8Array,
  shift: false,
  ctrl: false,
  meta: false,
};
let lastMouseEvent: MouseEvent = { ...mouseEvent };

/**
 * Decode character(s) from buffer that was sent to stdin from terminal on mostly
 * @see https://invisible-island.net/xterm/ctlseqs/ctlseqs.txt for reference used to create this function
 */
export function* decodeBuffer(
  buffer: Uint8Array,
): Generator<InputEvent, void, void> {
  let index = 0;
  while (index < buffer.length) {
    const boundary = nextInputBoundary(buffer, index);
    if (boundary == null) return;
    const chunk = buffer.subarray(index, boundary);
    const code = textDecoder.decode(chunk);
    yield decodeBracketedPaste(chunk, code) ?? decodeTerminalFocus(chunk, code) ??
      decodeMouseVT_UTF8(chunk, code) ?? decodeMouseSGR(chunk, code) ?? decodeKey(chunk, code);
    index = boundary;
  }
}

function decodeBracketedPaste(
  buffer: Uint8Array,
  code: string,
  decoder = textDecoder,
): PasteEvent | undefined {
  if (!code.startsWith(BRACKETED_PASTE_START_TEXT) || !code.endsWith(BRACKETED_PASTE_END_TEXT)) {
    return undefined;
  }
  const payload = buffer.subarray(BRACKETED_PASTE_START.length, buffer.length - BRACKETED_PASTE_END.length);
  return {
    key: "paste",
    text: decoder.decode(payload),
    buffer,
  };
}

function decodeTerminalFocus(buffer: Uint8Array, code: string): TerminalFocusEvent | undefined {
  if (code === "\x1b[I") {
    return { key: "focus", focused: true, buffer };
  }
  if (code === "\x1b[O") {
    return { key: "focus", focused: false, buffer };
  }
  return undefined;
}

function decodeMouseSGR(
  buffer: Uint8Array,
  code: string,
): MousePressEvent | MouseScrollEvent | undefined {
  const action = code.at(-1);
  if (!code.startsWith("\x1b[<") || (action !== "m" && action !== "M")) {
    return undefined;
  }

  const release = action === "m";

  const xSeparator = code.indexOf(";");
  let modifiers = +code.slice(3, xSeparator);
  const ySeparator = code.indexOf(";", xSeparator + 1);
  let x = +code.slice(xSeparator + 1, ySeparator);
  let y = +code.slice(ySeparator + 1, code.length - 1);

  x -= 1;
  y -= 1;

  const movementX = lastMouseEvent ? x - lastMouseEvent.x : 0;
  const movementY = lastMouseEvent ? y - lastMouseEvent.y : 0;

  let scroll: MouseScrollEvent["scroll"] = 0;
  if (modifiers >= 64) {
    scroll = modifiers % 2 === 0 ? -1 : 1;
    modifiers -= scroll < 0 ? 64 : 65;
  }

  let drag = false;
  if (modifiers >= 32) {
    drag = true;
    modifiers -= 32;
  }

  let ctrl = false;
  if (modifiers >= 16) {
    ctrl = true;
    modifiers -= 16;
  }

  let meta = false;
  if (modifiers >= 8) {
    meta = true;
    modifiers -= 8;
  }

  let shift = false;
  if (modifiers >= 4) {
    shift = true;
    modifiers -= 4;
  }

  let button: MousePressEvent["button"];
  if (!scroll) {
    button = modifiers as MousePressEvent["button"];
  }

  lastMouseEvent = mouseEvent;
  const previous = lastMouseEvent;
  mouseEvent = previous;

  const allMouseEvents = mouseEvent as Partial<MousePressEvent & MouseScrollEvent>;
  delete allMouseEvents.scroll;
  delete allMouseEvents.drag;
  delete allMouseEvents.button;
  delete allMouseEvents.release;

  mouseEvent.buffer = buffer;
  mouseEvent.x = x;
  mouseEvent.y = y;
  mouseEvent.ctrl = ctrl;
  mouseEvent.meta = meta;
  mouseEvent.shift = shift;
  mouseEvent.movementX = movementX;
  mouseEvent.movementY = movementY;

  if (scroll) {
    const mouseScrollEvent = mouseEvent as MouseScrollEvent;
    mouseScrollEvent.scroll = scroll;
    return mouseScrollEvent;
  }

  const mousePressEvent = mouseEvent as MousePressEvent;
  mousePressEvent.drag = drag;
  mousePressEvent.button = button!;
  mousePressEvent.release = release;
  return mousePressEvent;
}

function decodeMouseVT_UTF8(
  buffer: Uint8Array,
  code: string,
): MousePressEvent | MouseScrollEvent | undefined {
  if (!code.startsWith("\x1b[M")) return undefined;

  const modifiers = code.charCodeAt(3);
  let x = code.charCodeAt(4);
  let y = code.charCodeAt(5);

  x -= 0o41;
  y -= 0o41;

  const movementX = lastMouseEvent ? x - lastMouseEvent.x : 0;
  const movementY = lastMouseEvent ? y - lastMouseEvent.y : 0;

  const buttonInfo = modifiers & 3;
  let release = false;

  let button: MousePressEvent["button"];
  if (buttonInfo === 3) {
    release = true;
  } else {
    button = buttonInfo as MousePressEvent["button"];
  }

  const shift = !!(modifiers & 4);
  const meta = !!(modifiers & 8);
  const ctrl = !!(modifiers & 16);
  const scroll = button && !!(modifiers & 32) && !!(modifiers & 64) ? (modifiers & 3 ? 1 : -1) : 0;
  if (scroll) button = undefined;
  const drag = !scroll && !!(modifiers & 64);

  lastMouseEvent = mouseEvent;
  const previous = lastMouseEvent;
  mouseEvent = previous;

  const allMouseEvents = mouseEvent as Partial<MousePressEvent & MouseScrollEvent>;
  delete allMouseEvents.scroll;
  delete allMouseEvents.drag;
  delete allMouseEvents.button;
  delete allMouseEvents.release;

  mouseEvent.buffer = buffer;
  mouseEvent.x = x;
  mouseEvent.y = y;
  mouseEvent.ctrl = ctrl;
  mouseEvent.meta = meta;
  mouseEvent.shift = shift;
  mouseEvent.movementX = movementX;
  mouseEvent.movementY = movementY;

  if (scroll) {
    const mouseScrollEvent = mouseEvent as MouseScrollEvent;
    mouseScrollEvent.scroll = scroll;
    return mouseScrollEvent;
  }

  const mousePressEvent = mouseEvent as MousePressEvent;
  mousePressEvent.drag = drag;
  mousePressEvent.button = button!;
  mousePressEvent.release = release;
  return mousePressEvent;
}

function splitInputBuffer(buffer: Uint8Array) {
  let end = 0;
  let nextIndex = 0;
  while (nextIndex < buffer.length) {
    const boundary = nextInputBoundary(buffer, nextIndex);
    if (boundary == null) {
      break;
    }
    end = boundary;
    nextIndex = boundary;
  }

  return {
    complete: buffer.subarray(0, end),
    remainder: buffer.subarray(end),
  };
}

function nextInputBoundary(buffer: Uint8Array, start: number): number | null {
  const first = buffer[start];
  if (first == null) {
    return null;
  }

  if (first !== 0x1b) {
    const width = utf8ByteWidth(first);
    return start + width <= buffer.length ? start + width : null;
  }

  const second = buffer[start + 1];
  if (second == null) {
    return null;
  }
  if (second === 0x1b) {
    return start + 1;
  }

  if (second === 0x5b) {
    const third = buffer[start + 2];
    if (third == null) {
      return null;
    }

    if (startsWithBytes(buffer, BRACKETED_PASTE_START, start)) {
      const end = indexOfBytes(buffer, BRACKETED_PASTE_END, start + BRACKETED_PASTE_START.length);
      return end < 0 ? null : end + BRACKETED_PASTE_END.length;
    }

    if (third === 0x4d) {
      return start + 6 <= buffer.length ? start + 6 : null;
    }

    if (third === 0x3c) {
      for (let index = start + 3; index < buffer.length; index += 1) {
        const byte = buffer[index];
        if (byte === 0x4d || byte === 0x6d) {
          return index + 1;
        }
      }
      return null;
    }

    return scanEscapeSequence(buffer, start + 2);
  }

  if (second === 0x4f) {
    return scanEscapeSequence(buffer, start + 2);
  }

  const width = utf8ByteWidth(second);
  return start + 1 + width <= buffer.length ? start + 1 + width : null;
}

function scanEscapeSequence(buffer: Uint8Array, start: number): number | null {
  for (let index = start; index < buffer.length; index += 1) {
    const byte = buffer[index];
    if (byte >= 0x40 && byte <= 0x7e) {
      return index + 1;
    }
  }
  return null;
}

function utf8ByteWidth(byte: number) {
  if ((byte & 0x80) === 0) {
    return 1;
  }
  if ((byte & 0xe0) === 0xc0) {
    return 2;
  }
  if ((byte & 0xf0) === 0xe0) {
    return 3;
  }
  if ((byte & 0xf8) === 0xf0) {
    return 4;
  }
  return 1;
}

function concatBuffers(left: Uint8Array, right: Uint8Array) {
  const merged = new Uint8Array(left.length + right.length);
  merged.set(left);
  merged.set(right, left.length);
  return merged;
}

function startsWithBytes(buffer: Uint8Array, sequence: Uint8Array, start: number): boolean {
  if (start + sequence.length > buffer.length) return false;
  for (let index = 0; index < sequence.length; index += 1) {
    if (buffer[start + index] !== sequence[index]) return false;
  }
  return true;
}

function indexOfBytes(buffer: Uint8Array, sequence: Uint8Array, start: number): number {
  for (let index = start; index <= buffer.length - sequence.length; index += 1) {
    if (startsWithBytes(buffer, sequence, index)) return index;
  }
  return -1;
}
