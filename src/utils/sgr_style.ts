// Copyright 2023 Im-Beast. MIT license.

interface SgrStyleState {
  bold: boolean;
  italic: boolean;
  underline: boolean;
  inverse: boolean;
  foreground: string[];
  background: string[];
  extra: string[];
}

/** Merges an SGR escape sequence into an existing compact SGR style prefix. */
export function mergeSgrStyle(currentStyle: string, sequence: string): string {
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

export function isSgrReset(sequence: string): boolean {
  const params = sgrParams(sequence);
  return params.length === 0 || params.every((value) => value === 0);
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

function readCsiSequenceAt(value: string, start: number): string | undefined {
  if (value.charCodeAt(start) !== 0x1b || value[start + 1] !== "[") return undefined;
  let index = start + 2;
  while (index < value.length) {
    const code = value.charCodeAt(index);
    if (code >= 0x30 && code <= 0x3f) {
      index += 1;
      continue;
    }
    break;
  }
  while (index < value.length) {
    const code = value.charCodeAt(index);
    if (code >= 0x20 && code <= 0x2f) {
      index += 1;
      continue;
    }
    break;
  }
  const finalCode = value.charCodeAt(index);
  if (!(finalCode >= 0x40 && finalCode <= 0x7e)) return undefined;
  return value.slice(start, index + 1);
}
