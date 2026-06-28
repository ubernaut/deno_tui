// Copyright 2023 Im-Beast. MIT license.

import type { KeyPressEvent, MouseEvent, MousePressEvent, MouseScrollEvent } from "./types.ts";
import type { Stdin } from "../types.ts";
import { decodeMouseSGR, decodeMouseVT_UTF8 } from "./decoders/mouse.ts";
import { decodeKey } from "./decoders/keyboard.ts";
import type { EmitterEvent, EventEmitter } from "../event_emitter.ts";

export type InputEventRecord = {
  keyPress: EmitterEvent<[KeyPressEvent]>;
  mouseEvent: EmitterEvent<[MouseEvent | MousePressEvent | MouseScrollEvent]>;
  mousePress: EmitterEvent<[MousePressEvent]>;
  mouseScroll: EmitterEvent<[MouseScrollEvent]>;
};

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
      if (event.key === "mouse") {
        emitter.emit("mouseEvent", event);

        if ("button" in event) {
          emitter.emit("mousePress", event);
        } else if ("scroll" in event) {
          emitter.emit("mouseScroll", event);
        }
      } else {
        emitter.emit("keyPress", event);
      }
    }

    setTimeout(read, minReadInterval);
  }
  await read();
}

const textDecoder = new TextDecoder();

/**
 * Decode character(s) from buffer that was sent to stdin from terminal on mostly
 * @see https://invisible-island.net/xterm/ctlseqs/ctlseqs.txt for reference used to create this function
 */
export function* decodeBuffer(
  buffer: Uint8Array,
): Generator<KeyPressEvent | MouseEvent | MousePressEvent | MouseScrollEvent, void, void> {
  const { complete } = splitInputBuffer(buffer);
  for (const chunk of iterateInputChunks(complete)) {
    const code = textDecoder.decode(chunk);
    yield decodeMouseVT_UTF8(chunk, code) ?? decodeMouseSGR(chunk, code) ?? decodeKey(chunk, code);
  }
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

function* iterateInputChunks(buffer: Uint8Array): Generator<Uint8Array, void, void> {
  let index = 0;
  while (index < buffer.length) {
    const boundary = nextInputBoundary(buffer, index);
    if (boundary == null) {
      return;
    }
    yield buffer.subarray(index, boundary);
    index = boundary;
  }
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
