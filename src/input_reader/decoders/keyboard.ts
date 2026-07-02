// Copyright 2023 Im-Beast. MIT license.
/** Decode code sequence to {KeyPress} object. */
import type { Alphabet, Key, KeyPressEvent } from "../types.ts";

const lowerCaseAlphabet = "abcdefghijklmnopqrstuvwxyz";
const sequenceMap: Partial<Record<string, Key>> = {
  OP: "f1",
  "[P": "f1",
  OQ: "f2",
  "[Q": "f2",
  OR: "f3",
  "[R": "f3",
  OS: "f4",
  "[S": "f4",
  "[[A": "f1",
  "[[B": "f2",
  "[[C": "f3",
  "[[D": "f4",
  "[[E": "f5",
  "[11~": "f1",
  "[12~": "f2",
  "[13~": "f3",
  "[14~": "f4",
  "[15~": "f5",
  "[17~": "f6",
  "[18~": "f7",
  "[19~": "f8",
  "[20~": "f9",
  "[21~": "f10",
  "[23~": "f11",
  "[24~": "f12",
  OA: "up",
  "[A": "up",
  OB: "down",
  "[B": "down",
  OC: "right",
  "[C": "right",
  OD: "left",
  "[D": "left",
  OH: "home",
  "[H": "home",
  OF: "end",
  "[F": "end",
  "[2~": "insert",
  "[3~": "delete",
  "[5~": "pageup",
  "[6~": "pagedown",
  "[E": "clear",
};

const keyPress: KeyPressEvent = {
  buffer: undefined as unknown as Uint8Array,
  key: "-",
  meta: false,
  ctrl: false,
  shift: false,
};
let modifierStart = -1;
let modifierEnd = -1;

/**
 * Decode {buffer} and/or {code} to {KeyPressEvent} object
 *
 * **Don't hold onto event object reference that gets returned!**
 *
 * **It gets reused to save CPU usage and minimize GC.**
 */
export function decodeKey(buffer: Uint8Array, code: string): KeyPressEvent {
  if (code[0] === "\x1b") code = code.slice(1);
  keyPress.buffer = buffer;
  keyPress.key = code as Key;
  keyPress.ctrl = false;
  keyPress.meta = false;
  keyPress.shift = false;

  switch (code) {
    case "\r":
    case "\n":
      keyPress.key = "return";
      break;
    case "\t":
      keyPress.key = "tab";
      break;
    case "\b":
    case "\x7f":
      keyPress.key = "backspace";
      break;
    case "\x1b":
      keyPress.key = "escape";
      break;
    case " ":
      keyPress.key = "space";
      break;
    default:
      {
        if (buffer[0] !== 27) {
          const offset96 = String.fromCharCode(buffer[0] + 96);
          if (lowerCaseAlphabet.indexOf(offset96) !== -1) {
            keyPress.key = offset96 as Alphabet;
            keyPress.ctrl = true;
            break;
          }
        }

        if (code.length === 1) {
          keyPress.shift = code !== code.toLowerCase();
          keyPress.meta = buffer[0] === 27;
          break;
        } else if (buffer.length === 1) {
          keyPress.key = "escape";
          break;
        }

        const modifier = terminalKeyModifier(code);
        switch (modifier) {
          case 5:
            keyPress.ctrl = true;
            break;
          case 3:
            keyPress.meta = true;
            break;
          case 2:
            keyPress.shift = true;
            break;
        }

        if (modifier > 0) {
          code = normalizeModifiedKeySequence(code, modifierStart, modifierEnd);
        }
        const normalizedKey = sequenceMap[code];
        if (normalizedKey) {
          keyPress.key = normalizedKey;
        }
      }
      break;
  }

  return keyPress;
}

function terminalKeyModifier(code: string): number {
  const semicolon = code.lastIndexOf(";");
  modifierStart = -1;
  modifierEnd = -1;
  if (semicolon < 0 || semicolon + 1 >= code.length) return 0;

  let value = 0;
  let end = semicolon + 1;
  for (; end < code.length; end += 1) {
    const char = code.charCodeAt(end);
    if (char < 48 || char > 57) break;
    value = value * 10 + char - 48;
  }
  if (end === semicolon + 1) return 0;
  modifierStart = semicolon + 1;
  modifierEnd = end;
  return value;
}

function normalizeModifiedKeySequence(code: string, modifierStart: number, modifierEnd: number): string {
  if (modifierStart >= 2 && code.charCodeAt(modifierStart - 2) === 49) {
    return `${code.slice(0, modifierStart - 2)}${code.slice(modifierEnd)}`;
  }
  return `${code.slice(0, modifierStart - 1)}${code.slice(modifierEnd)}`;
}
