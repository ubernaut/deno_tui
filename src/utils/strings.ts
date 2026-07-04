// Copyright 2023 Im-Beast. MIT license.

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

interface SgrStyleState {
  bold: boolean;
  italic: boolean;
  underline: boolean;
  inverse: boolean;
  foreground: string[];
  background: string[];
  extra: string[];
}

function mergeSgrStyle(currentStyle: string, sequence: string): string {
  const state: SgrStyleState = {
    bold: false,
    italic: false,
    underline: false,
    inverse: false,
    foreground: [],
    background: [],
    extra: [],
  };
  applySgrSequences(state, currentStyle);
  applySgrSequence(state, sequence);
  return formatSgrStyleState(state);
}

function applySgrSequences(state: SgrStyleState, style: string): void {
  for (let index = 0; index < style.length;) {
    const sequence = readCsiSequenceAt(style, index);
    if (!sequence || !sequence.endsWith("m")) {
      index += 1;
      continue;
    }
    applySgrSequence(state, sequence);
    index += sequence.length;
  }
}

function applySgrSequence(state: SgrStyleState, sequence: string): void {
  const params = sgrParams(sequence);
  if (params.length === 0 || params.includes(0)) {
    resetSgrStyleState(state);
    if (params.length <= 1) return;
  }

  for (let index = 0; index < params.length; index += 1) {
    const value = params[index] ?? 0;
    if (value === 0) continue;
    if (value === 1) {
      state.bold = true;
    } else if (value === 22) {
      state.bold = false;
    } else if (value === 3) {
      state.italic = true;
    } else if (value === 23) {
      state.italic = false;
    } else if (value === 4) {
      state.underline = true;
    } else if (value === 24) {
      state.underline = false;
    } else if (value === 7) {
      state.inverse = true;
    } else if (value === 27) {
      state.inverse = false;
    } else if ((value >= 30 && value <= 37) || (value >= 90 && value <= 97)) {
      state.foreground = [String(value)];
    } else if ((value >= 40 && value <= 47) || (value >= 100 && value <= 107)) {
      state.background = [String(value)];
    } else if (value === 39) {
      state.foreground = [];
    } else if (value === 49) {
      state.background = [];
    } else if ((value === 38 || value === 48) && params[index + 1] === 2 && index + 4 < params.length) {
      const target = value === 38 ? state.foreground : state.background;
      target.length = 0;
      target.push(String(value), "2", String(params[index + 2]), String(params[index + 3]), String(params[index + 4]));
      index += 4;
    } else if ((value === 38 || value === 48) && params[index + 1] === 5 && index + 2 < params.length) {
      const target = value === 38 ? state.foreground : state.background;
      target.length = 0;
      target.push(String(value), "5", String(params[index + 2]));
      index += 2;
    } else {
      const encoded = String(value);
      if (!state.extra.includes(encoded)) state.extra.push(encoded);
    }
  }
}

function sgrParams(sequence: string): number[] {
  const body = sequence.slice(2, -1);
  if (body === "") return [0];
  const params = body.split(";").map((part) => part === "" ? 0 : Number(part));
  return params.filter((value) => Number.isFinite(value)).map((value) => Math.max(0, Math.floor(value)));
}

function isSgrReset(sequence: string): boolean {
  const params = sgrParams(sequence);
  return params.length === 0 || params.every((value) => value === 0);
}

function resetSgrStyleState(state: SgrStyleState): void {
  state.bold = false;
  state.italic = false;
  state.underline = false;
  state.inverse = false;
  state.foreground = [];
  state.background = [];
  state.extra = [];
}

function formatSgrStyleState(state: SgrStyleState): string {
  const params: string[] = [];
  if (state.bold) params.push("1");
  if (state.italic) params.push("3");
  if (state.underline) params.push("4");
  if (state.inverse) params.push("7");
  params.push(...state.foreground, ...state.background, ...state.extra);
  return params.length ? `\x1b[${params.join(";")}m` : "";
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
