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

/** Parses a leading OSC, CSI, or supported single-character ESC sequence. */
export function parseTerminalControlSequence(value: string): ParsedTerminalControlSequence | undefined {
  const osc = parseOscSequence(value);
  if (osc) return osc;
  if (isSingleCharacterEscSequence(value)) {
    return {
      kind: "esc",
      private: false,
      params: "",
      intermediates: "",
      command: value[1]!,
      length: 2,
    };
  }
  // deno-lint-ignore no-control-regex -- terminal parser intentionally matches ESC.
  const match = /^\x1b\[([?]?)([0-9;:]*)([ -/]*)([@-~])/.exec(value);
  if (!match) return undefined;
  return {
    kind: "csi",
    private: match[1] === "?",
    params: match[2] ?? "",
    intermediates: match[3] ?? "",
    command: match[4]!,
    length: match[0].length,
  };
}

/** Parses semicolon/colon-separated numeric terminal parameters. */
export function parseTerminalParams(params: string): number[] {
  if (!params) return [];
  return params.split(/[;:]/).map((value) => Number.parseInt(value || "0", 10)).filter(Number.isFinite);
}

function parseOscSequence(value: string): ParsedTerminalControlSequence | undefined {
  if (!value.startsWith("\x1b]")) return undefined;
  const belEnd = value.indexOf("\x07", 2);
  const stEnd = value.indexOf("\x1b\\", 2);
  const end = belEnd >= 0 && stEnd >= 0 ? Math.min(belEnd, stEnd) : belEnd >= 0 ? belEnd : stEnd;
  if (end < 0) return undefined;
  return {
    kind: "osc",
    private: false,
    params: value.slice(2, end),
    intermediates: "",
    command: "]",
    length: end + (end === stEnd ? 2 : 1),
  };
}

function isSingleCharacterEscSequence(value: string): boolean {
  return value.startsWith("\x1b7") || value.startsWith("\x1b8") || value.startsWith("\x1bM") ||
    value.startsWith("\x1bH") || value.startsWith("\x1bD") || value.startsWith("\x1bE") || value.startsWith("\x1bc");
}
