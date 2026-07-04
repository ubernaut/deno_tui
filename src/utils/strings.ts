// Copyright 2023 Im-Beast. MIT license.
import { isSgrReset, mergeSgrStyle } from "./sgr_style.ts";

/**
 * Regexp that allows for extracting unicode sequences that are supposed to represent single character
 *
 * Used reference: https://github.com/lodash/lodash/blob/master/.internal/unicodeSize.js
 */
export const UNICODE_CHAR_REGEXP =
  /\ud83c[\udffb-\udfff](?=\ud83c[\udffb-\udfff])|(?:(?:\ud83c\udff4\udb40\udc67\udb40\udc62\udb40(?:\udc65|\udc73|\udc77)\udb40(?:\udc6e|\udc63|\udc6c)\udb40(?:\udc67|\udc74|\udc73)\udb40\udc7f)|[^\ud800-\udfff][\u0300-\u036f\ufe20-\ufe2f\u20d0-\u20ff\u1ab0-\u1aff\u1dc0-\u1dff]?|[\u0300-\u036f\ufe20-\ufe2f\u20d0-\u20ff\u1ab0-\u1aff\u1dc0-\u1dff]|(?:\ud83c[\udde6-\uddff]){2}|[\ud800-\udbff][\udc00-\udfff]|[\ud800-\udfff])[\ufe0e\ufe0f]?(?:[\u0300-\u036f\ufe20-\ufe2f\u20d0-\u20ff\u1ab0-\u1aff\u1dc0-\u1dff]|\ud83c[\udffb-\udfff])?(?:\u200d(?:[^\ud800-\udfff]|(?:\ud83c[\udde6-\uddff]){2}|[\ud800-\udbff][\udc00-\udfff])[\ufe0e\ufe0f]?(?:[\u0300-\u036f\ufe20-\ufe2f\u20d0-\u20ff\u1ab0-\u1aff\u1dc0-\u1dff]|\ud83c[\udffb-\udfff])?)*/g;

const empty: string[] = [];
const ESC_PATTERN = "\\x1b";
const BEL_PATTERN = "\\x07";
const STRIP_CSI_SEQUENCE_REGEXP = new RegExp(`${ESC_PATTERN}\\[[0-?]*[ -/]*[@-~]`, "g");
const STRIP_OSC_SEQUENCE_REGEXP = new RegExp(
  `${ESC_PATTERN}\\][^${BEL_PATTERN}]*(?:${BEL_PATTERN}|${ESC_PATTERN}\\\\)`,
  "g",
);

/** Converts given text to array of strings which consist of sequences which represent a single character */
export function getMultiCodePointCharacters(text: string): string[] {
  if (!text) return empty;

  if (text.includes("\x1b")) {
    return getStyledCharacters(text);
  }

  const plainAscii = getPlainAsciiCharacters(text);
  if (plainAscii) return plainAscii;

  const matched = text.match(UNICODE_CHAR_REGEXP);

  return matched ?? empty;
}

function getPlainAsciiCharacters(text: string): string[] | undefined {
  const cells = new Array<string>(text.length);
  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index);
    if (code >= 0x80) return undefined;
    cells[index] = text[index] ?? "";
  }
  return cells;
}

function getStyledCharacters(text: string): string[] {
  const simpleStyledAscii = getSimpleStyledAsciiCharacters(text);
  if (simpleStyledAscii) return simpleStyledAscii;

  const cells: string[] = [];
  let style = "";
  let lastStyle = "";
  let lastChar = "";
  let lastCell = "";

  for (let index = 0; index < text.length;) {
    if (text.charCodeAt(index) === 0x1b) {
      const sequence = readCsiSequenceAt(text, index);
      if (sequence) {
        if (sequence.endsWith("m")) {
          style = mergeSgrStyle(style, sequence);
        }
        index += sequence.length;
        continue;
      }
    }

    const char = nextTextCharacter(text, index);
    if (style === lastStyle && char === lastChar) {
      cells.push(lastCell);
    } else {
      lastStyle = style;
      lastChar = char;
      lastCell = style ? `${style}${char}\x1b[0m` : char;
      cells.push(lastCell);
    }
    index += char.length;
  }

  return cells;
}

function getSimpleStyledAsciiCharacters(text: string): string[] | undefined {
  if (text.charCodeAt(0) !== 0x1b) return undefined;
  let style = "";
  let bodyStart = 0;
  for (let index = 0; index < text.length;) {
    const sequence = readCsiSequenceAt(text, index);
    if (!sequence || !sequence.endsWith("m")) break;
    style = mergeSgrStyle(style, sequence);
    index += sequence.length;
    bodyStart = index;
  }
  if (bodyStart <= 0 || bodyStart >= text.length) return undefined;

  let bodyEnd = text.length;
  while (bodyEnd > bodyStart) {
    const resetStart = previousCsiSequenceStart(text, bodyEnd);
    if (resetStart === undefined || resetStart < bodyStart) break;
    const sequence = text.slice(resetStart, bodyEnd);
    if (!sequence.endsWith("m") || !isSgrReset(sequence)) break;
    bodyEnd = resetStart;
  }
  if (bodyEnd <= bodyStart) return undefined;
  for (let index = bodyStart; index < bodyEnd; index += 1) {
    const code = text.charCodeAt(index);
    if (code === 0x1b || code >= 0x80) return undefined;
  }

  const bodyLength = bodyEnd - bodyStart;
  const cells = new Array<string>(bodyLength);
  if (!style) {
    for (let index = 0; index < bodyLength; index += 1) {
      cells[index] = text[bodyStart + index] ?? "";
    }
    return cells;
  }

  let lastChar = "";
  let lastCell = "";
  for (let index = 0; index < bodyLength; index += 1) {
    const char = text[bodyStart + index] ?? "";
    if (char === lastChar) {
      cells[index] = lastCell;
      continue;
    }
    lastChar = char;
    lastCell = `${style}${char}\x1b[0m`;
    cells[index] = lastCell;
  }
  return cells;
}

/** Strips string of all its styles */
export function stripStyles(string: string): string {
  return string
    .replace(STRIP_CSI_SEQUENCE_REGEXP, "")
    .replace(STRIP_OSC_SEQUENCE_REGEXP, "");
}

/** Inserts {value} into {string} on given {index} */
export function insertAt(string: string, index: number, value: string): string {
  return string.slice(0, index) + value + string.slice(index);
}

/** Returns real {text} width */
export function textWidth(text: string, start = 0): number {
  if (!text) return 0;
  const asciiWidth = plainAsciiWidth(text, start);
  if (asciiWidth !== undefined) return asciiWidth;
  const narrowAnsiWidth = narrowAnsiTextWidth(text, start);
  if (narrowAnsiWidth !== undefined) return narrowAnsiWidth;

  let width = 0;
  for (let index = Math.max(0, Math.floor(start)); index < text.length;) {
    if (text.charCodeAt(index) === 0x1b) {
      const sequence = readAnsiSequenceAt(text, index);
      if (sequence) {
        index += sequence.length;
        continue;
      }
    }

    const char = nextTextCharacter(text, index);
    if (char === "\n") break;
    width += characterWidth(char);
    index += char.length;
  }

  return width;
}

/** Crops {text} to given {width} */
export function cropToWidth(text: string, width: number): string {
  const asciiCropped = cropPlainAsciiToWidth(text, width);
  if (asciiCropped !== undefined) return asciiCropped;
  const narrowAnsiCropped = cropNarrowAnsiToWidth(text, width);
  if (narrowAnsiCropped !== undefined) return narrowAnsiCropped;

  let cropped = "";
  let croppedWidth = 0;
  let prefix = "";

  for (let index = 0; index < text.length;) {
    if (text.charCodeAt(index) === 0x1b) {
      const sequence = readAnsiSequenceAt(text, index);
      if (sequence) {
        prefix += sequence;
        index += sequence.length;
        continue;
      }
    }

    const char = nextTextCharacter(text, index);
    if (char === "\n") break;
    const charWidth = characterWidth(char);

    if (croppedWidth + charWidth > width) {
      if (prefix && isAnsiResetOnly(prefix)) {
        cropped += prefix;
      }
      if (croppedWidth + 1 === width) {
        cropped += " ";
      }
      prefix = "";
      break;
    } else {
      croppedWidth += charWidth;
    }

    cropped += prefix + char;
    prefix = "";
    index += char.length;
  }

  if (prefix) {
    cropped += prefix;
  }

  return cropped;
}

function plainAsciiWidth(text: string, start = 0): number | undefined {
  const offset = Math.max(0, Math.floor(start));
  for (let index = offset; index < text.length; index += 1) {
    const code = text.charCodeAt(index);
    if (code === 0x0a) return index - offset;
    if (code === 0x1b || code >= 0x80) return undefined;
  }
  return Math.max(0, text.length - offset);
}

function cropPlainAsciiToWidth(text: string, width: number): string | undefined {
  const safeWidth = Math.max(0, Math.floor(width));
  const limit = Math.min(text.length, safeWidth);
  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index);
    if (code === 0x0a) return text.slice(0, Math.min(index, safeWidth));
    if (code === 0x1b || code >= 0x80) return undefined;
  }
  return text.length <= safeWidth ? text : text.slice(0, limit);
}

function narrowAnsiTextWidth(text: string, start = 0): number | undefined {
  let width = 0;
  for (let index = Math.max(0, Math.floor(start)); index < text.length;) {
    const code = text.charCodeAt(index);
    if (code === 0x0a) return width;
    if (code === 0x1b) {
      const sequence = readAnsiSequenceAt(text, index);
      if (!sequence) return undefined;
      index += sequence.length;
      continue;
    }
    if (isFastNarrowCodePoint(code)) {
      width += 1;
      index += 1;
      continue;
    }
    return undefined;
  }
  return width;
}

function cropNarrowAnsiToWidth(text: string, width: number): string | undefined {
  const safeWidth = Math.max(0, Math.floor(width));
  let cropped = "";
  let croppedWidth = 0;
  let prefix = "";

  for (let index = 0; index < text.length;) {
    const code = text.charCodeAt(index);
    if (code === 0x1b) {
      const sequence = readAnsiSequenceAt(text, index);
      if (!sequence) return undefined;
      prefix += sequence;
      index += sequence.length;
      continue;
    }
    if (code === 0x0a) break;
    if (!isFastNarrowCodePoint(code)) return undefined;

    if (croppedWidth + 1 > safeWidth) {
      if (prefix && isAnsiResetOnly(prefix)) cropped += prefix;
      prefix = "";
      break;
    }

    cropped += prefix + (text[index] ?? "");
    prefix = "";
    croppedWidth += 1;
    index += 1;
  }

  if (prefix) cropped += prefix;
  return cropped;
}

function isFastNarrowCodePoint(code: number): boolean {
  return (code >= 0x20 && code < 0x7f) || code === 0x2588 || code === 0x2587;
}

function nextTextCharacter(text: string, index: number): string {
  const codeUnit = text.charCodeAt(index);
  if (codeUnit < 0x80) return text[index] ?? "";

  UNICODE_CHAR_REGEXP.lastIndex = index;
  const match = UNICODE_CHAR_REGEXP.exec(text);
  if (match?.index === index) return match[0];
  return String.fromCodePoint(text.codePointAt(index) ?? codeUnit);
}

function isAnsiResetOnly(value: string): boolean {
  if (!value) return false;
  let index = 0;
  while (index < value.length) {
    const sequence = readAnsiSequenceAt(value, index);
    if (!sequence || !sequence.endsWith("m") || !isSgrReset(sequence)) return false;
    index += sequence.length;
  }
  return true;
}

function readAnsiSequenceAt(value: string, start: number): string | undefined {
  return readCsiSequenceAt(value, start) ?? readOscSequenceAt(value, start);
}

function readCsiSequenceAt(value: string, start: number): string | undefined {
  if (value.charCodeAt(start) !== 0x1b || value[start + 1] !== "[") return undefined;
  let index = start + 2;
  while (index < value.length) {
    const code = value.charCodeAt(index);
    if (code >= 0x30 && code <= 0x3f) {
      index++;
      continue;
    }
    break;
  }
  while (index < value.length) {
    const code = value.charCodeAt(index);
    if (code >= 0x20 && code <= 0x2f) {
      index++;
      continue;
    }
    break;
  }
  const finalCode = value.charCodeAt(index);
  if (!(finalCode >= 0x40 && finalCode <= 0x7e)) return undefined;
  return value.slice(start, index + 1);
}

function previousCsiSequenceStart(value: string, end: number): number | undefined {
  const start = value.lastIndexOf("\x1b[", end - 1);
  if (start < 0) return undefined;
  const sequence = readCsiSequenceAt(value, start);
  return sequence && start + sequence.length === end ? start : undefined;
}

function readOscSequenceAt(value: string, start: number): string | undefined {
  if (!value.startsWith("\x1b]", start)) return undefined;
  const contentStart = start + 2;
  const belEnd = value.indexOf("\x07", contentStart);
  const stEnd = value.indexOf("\x1b\\", contentStart);
  const end = belEnd >= 0 && stEnd >= 0 ? Math.min(belEnd, stEnd) : belEnd >= 0 ? belEnd : stEnd;
  if (end < 0) return undefined;
  return value.slice(start, end + (end === stEnd ? 2 : 1));
}

/** Public helper for is Final Ansi Byte. */
export function isFinalAnsiByte(character: string): boolean {
  const codePoint = character.charCodeAt(0);
  // don't include 0x70–0x7E range because its considered "private"
  return codePoint >= 0x40 && codePoint < 0x70;
}

/**
 * Return width of given character
 *
 * Originally created by sindresorhus: https://github.com/sindresorhus/is-fullwidth-code-point/blob/main/index.js
 */
export function characterWidth(character: string): number {
  const plain = character.includes("\x1b") ? stripStyles(character) : character;
  if (!plain) return 0;

  if (plain.length === 1) {
    return codePointWidth(plain.charCodeAt(0));
  }
  const firstCodePoint = plain.codePointAt(0) ?? 0;
  if (plain.length === 2 && firstCodePoint > 0xffff) {
    return codePointWidth(firstCodePoint);
  }

  let firstScannedCodePoint = 0;
  let count = 0;
  let allRegional = true;
  let hasZeroWidthJoiner = false;
  let hasEmojiVariation = false;
  let hasEmoji = false;

  for (let index = 0; index < plain.length;) {
    const codePoint = plain.codePointAt(index) ?? 0;
    if (count === 0) firstScannedCodePoint = codePoint;
    count += 1;
    if (codePoint === 0x200d) hasZeroWidthJoiner = true;
    if (codePoint === 0xfe0f) hasEmojiVariation = true;
    if (isEmojiSymbol(codePoint)) hasEmoji = true;
    if (!isRegionalIndicator(codePoint)) allRegional = false;
    index += codePoint > 0xffff ? 2 : 1;
  }

  if (hasZeroWidthJoiner) return 2;
  if (count === 2 && allRegional) return 2;
  if (hasEmojiVariation && hasEmoji) return 2;

  return codePointWidth(firstScannedCodePoint);
}

function codePointWidth(codePoint: number): number {
  if (
    codePoint === 0x200b ||
    codePoint === 0x200d ||
    isCombiningMark(codePoint) ||
    isVariationSelector(codePoint) ||
    isEmojiModifier(codePoint)
  ) {
    return 0;
  }

  if (
    codePoint >= 0x1100 &&
    (codePoint <= 0x115f ||
      codePoint === 0x2329 ||
      codePoint === 0x232a ||
      (0x2e80 <= codePoint && codePoint <= 0x3247 && codePoint !== 0x303f) ||
      (0x3250 <= codePoint && codePoint <= 0x4dbf) ||
      (0x4e00 <= codePoint && codePoint <= 0xa4c6) ||
      (0xa960 <= codePoint && codePoint <= 0xa97c) ||
      (0xac00 <= codePoint && codePoint <= 0xd7a3) ||
      (0xf900 <= codePoint && codePoint <= 0xfaff) ||
      (0xfe10 <= codePoint && codePoint <= 0xfe19) ||
      (0xfe30 <= codePoint && codePoint <= 0xfe6b) ||
      (0xff01 <= codePoint && codePoint <= 0xff60) ||
      (0xffe0 <= codePoint && codePoint <= 0xffe6) ||
      (0x1b000 <= codePoint && codePoint <= 0x1b001) ||
      (0x1f000 <= codePoint && codePoint <= 0x1faff) ||
      (0x1f200 <= codePoint && codePoint <= 0x1f251) ||
      (0x20000 <= codePoint && codePoint <= 0x3fffd))
  ) {
    return 2;
  }

  return 1;
}

function isCombiningMark(codePoint: number): boolean {
  return (0x0300 <= codePoint && codePoint <= 0x036f) ||
    (0x1ab0 <= codePoint && codePoint <= 0x1aff) ||
    (0x1dc0 <= codePoint && codePoint <= 0x1dff) ||
    (0x20d0 <= codePoint && codePoint <= 0x20ff) ||
    (0xfe20 <= codePoint && codePoint <= 0xfe2f);
}

function isVariationSelector(codePoint: number): boolean {
  return (0xfe00 <= codePoint && codePoint <= 0xfe0f) ||
    (0xe0100 <= codePoint && codePoint <= 0xe01ef);
}

function isEmojiModifier(codePoint: number): boolean {
  return 0x1f3fb <= codePoint && codePoint <= 0x1f3ff;
}

function isRegionalIndicator(codePoint: number): boolean {
  return 0x1f1e6 <= codePoint && codePoint <= 0x1f1ff;
}

function isEmojiSymbol(codePoint: number): boolean {
  return (0x2600 <= codePoint && codePoint <= 0x27bf) ||
    (0x1f000 <= codePoint && codePoint <= 0x1faff);
}

/** Returns capitalized string created from {text} */
export function capitalize<T extends string>(text: T): Capitalize<T> {
  return (text[0].toUpperCase() + text.slice(1)) as Capitalize<T>;
}
