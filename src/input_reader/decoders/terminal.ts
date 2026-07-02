// Copyright 2023 Im-Beast. MIT license.
import type { PasteEvent, TerminalFocusEvent } from "../types.ts";

const PASTE_START = "\x1b[200~";
const PASTE_END = "\x1b[201~";
const textDecoder = new TextDecoder();

/** Decode xterm bracketed paste as one payload event. */
export function decodeBracketedPaste(
  buffer: Uint8Array,
  code: string,
  decoder = textDecoder,
): PasteEvent | undefined {
  if (!code.startsWith(PASTE_START) || !code.endsWith(PASTE_END)) return undefined;
  const payload = buffer.subarray(PASTE_START.length, buffer.length - PASTE_END.length);
  return {
    key: "paste",
    text: decoder.decode(payload),
    buffer,
  };
}

/** Decode xterm focus-in/focus-out reporting sequences. */
export function decodeTerminalFocus(buffer: Uint8Array, code: string): TerminalFocusEvent | undefined {
  if (code === "\x1b[I") {
    return { key: "focus", focused: true, buffer };
  }
  if (code === "\x1b[O") {
    return { key: "focus", focused: false, buffer };
  }
  return undefined;
}
