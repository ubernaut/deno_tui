// Copyright 2023 Im-Beast. MIT license.

/** Parsed terminal control sequence emitted by the lightweight terminal parser. */
export interface ParsedTerminalControlSequence {
  kind: "csi" | "osc" | "esc";
  private: boolean;
  params: string;
  intermediates: string;
  command: string;
  length: number;
}

/** Parses an OSC, CSI, or supported single-character ESC sequence at `start`. */
export function parseTerminalControlSequence(
  value: string,
  start = 0,
): ParsedTerminalControlSequence | undefined {
  const osc = parseOscSequence(value, start);
  if (osc) return osc;
  if (isSingleCharacterEscSequence(value, start)) {
    return {
      kind: "esc",
      private: false,
      params: "",
      intermediates: "",
      command: value[start + 1]!,
      length: 2,
    };
  }
  const intermediateEsc = parseIntermediateEscSequence(value, start);
  if (intermediateEsc) return intermediateEsc;
  if (value.charCodeAt(start) !== 0x1b || value[start + 1] !== "[") return undefined;

  let index = start + 2;
  const privateMarker = value[index] === "?";
  if (privateMarker) index++;

  const paramsStart = index;
  while (index < value.length) {
    const code = value.charCodeAt(index);
    if ((code >= 0x30 && code <= 0x39) || code === 0x3b || code === 0x3a) {
      index++;
      continue;
    }
    break;
  }
  const paramsEnd = index;

  const intermediatesStart = index;
  while (index < value.length) {
    const code = value.charCodeAt(index);
    if (code >= 0x20 && code <= 0x2f) {
      index++;
      continue;
    }
    break;
  }
  const intermediatesEnd = index;

  const commandCode = value.charCodeAt(index);
  if (!(commandCode >= 0x40 && commandCode <= 0x7e)) return undefined;

  return {
    kind: "csi",
    private: privateMarker,
    params: value.slice(paramsStart, paramsEnd),
    intermediates: value.slice(intermediatesStart, intermediatesEnd),
    command: value[index]!,
    length: index - start + 1,
  };
}

/** Parses semicolon/colon-separated numeric terminal parameters. */
export function parseTerminalParams(params: string): number[] {
  if (!params) return [];
  const values: number[] = [];
  let value = 0;
  let sawDigit = false;
  for (let index = 0; index <= params.length; index += 1) {
    const code = index < params.length ? params.charCodeAt(index) : 0x3b;
    if (code >= 0x30 && code <= 0x39) {
      value = value * 10 + code - 0x30;
      sawDigit = true;
      continue;
    }
    if (code !== 0x3b && code !== 0x3a) continue;
    values.push(sawDigit ? value : 0);
    value = 0;
    sawDigit = false;
  }
  return values;
}

function parseOscSequence(value: string, start: number): ParsedTerminalControlSequence | undefined {
  if (!value.startsWith("\x1b]", start)) return undefined;
  const contentStart = start + 2;
  const belEnd = value.indexOf("\x07", contentStart);
  const stEnd = value.indexOf("\x1b\\", contentStart);
  const end = belEnd >= 0 && stEnd >= 0 ? Math.min(belEnd, stEnd) : belEnd >= 0 ? belEnd : stEnd;
  if (end < 0) return undefined;
  return {
    kind: "osc",
    private: false,
    params: value.slice(contentStart, end),
    intermediates: "",
    command: "]",
    length: end - start + (end === stEnd ? 2 : 1),
  };
}

function isSingleCharacterEscSequence(value: string, start: number): boolean {
  if (value.charCodeAt(start) !== 0x1b) return false;
  const command = value[start + 1];
  return command === "7" || command === "8" || command === "M" || command === "H" || command === "D" ||
    command === "E" || command === "c" || command === "=" || command === ">";
}

/** Parses ECMA-35 ESC sequences with 0x20-0x2F intermediates (charset designation, DECALN, `ESC % G`). */
function parseIntermediateEscSequence(
  value: string,
  start: number,
): ParsedTerminalControlSequence | undefined {
  if (value.charCodeAt(start) !== 0x1b) return undefined;
  let index = start + 1;
  const intermediatesStart = index;
  while (index < value.length) {
    const code = value.charCodeAt(index);
    if (code >= 0x20 && code <= 0x2f) {
      index++;
      continue;
    }
    break;
  }
  if (index === intermediatesStart) return undefined;
  const finalCode = value.charCodeAt(index);
  if (!(finalCode >= 0x30 && finalCode <= 0x7e)) return undefined;
  return {
    kind: "esc",
    private: false,
    params: "",
    intermediates: value.slice(intermediatesStart, index),
    command: value[index]!,
    length: index - start + 1,
  };
}
