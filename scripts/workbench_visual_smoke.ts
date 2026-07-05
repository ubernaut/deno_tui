export interface WorkbenchVisualSmokeOptions {
  command?: readonly string[];
  columns?: number;
  rows?: number;
  timeoutMs?: number;
}

export interface WorkbenchVisualSmokeResult {
  passed: boolean;
  columns: number;
  rows: number;
  missing: string[];
  forbidden: string[];
  statusLine: string;
  threeLine: string;
  nonBlankRows: number;
  outputBytes: number;
  truecolorBackgroundWrites: number;
}

interface ReplayState {
  row: number;
  column: number;
}

const DEFAULT_COMMAND = ["deno", "task", "api-workbench"] as const;
const REQUIRED_TOKENS: readonly string[] = ["API WORKBENCH", "THREE ASCII", "live", "fps"];
const FORBIDDEN_TOKENS: readonly string[] = ["ReferenceError", "RangeError", "Maximum call stack", ")F10"];

if (import.meta.main) {
  const result = await runWorkbenchVisualSmoke();
  console.log(formatWorkbenchVisualSmokeResult(result));
  if (!result.passed) Deno.exit(1);
}

export async function runWorkbenchVisualSmoke(
  options: WorkbenchVisualSmokeOptions = {},
): Promise<WorkbenchVisualSmokeResult> {
  const columns = Math.max(1, Math.floor(options.columns ?? 118));
  const rows = Math.max(1, Math.floor(options.rows ?? 34));
  const output = await captureWorkbenchPty({
    command: options.command ?? DEFAULT_COMMAND,
    columns,
    rows,
    timeoutMs: options.timeoutMs ?? 8_000,
  });
  return inspectWorkbenchVisualSmokeOutput(output, { columns, rows });
}

export async function captureWorkbenchPty(options: Required<WorkbenchVisualSmokeOptions>): Promise<string> {
  const shellCommand = [
    `stty cols ${options.columns} rows ${options.rows}`,
    `timeout ${Math.max(0.1, options.timeoutMs / 1000)}s ${quoteCommand(options.command)}`,
  ].join("; ");
  const output = await new Deno.Command("script", {
    args: ["-q", "-c", shellCommand, "/dev/null"],
    stdout: "piped",
    stderr: "piped",
  }).output();
  const text = new TextDecoder().decode(output.stdout);
  if (text.length === 0) {
    const error = new TextDecoder().decode(output.stderr).trim();
    throw new Error(error || "workbench visual smoke produced no PTY output");
  }
  return text;
}

export function inspectWorkbenchVisualSmokeOutput(
  output: string,
  options: { columns: number; rows: number },
): WorkbenchVisualSmokeResult {
  const screen = replayWorkbenchScreen(output, options);
  const lines = screen.map((row) => row.join("").trimEnd());
  const text = lines.join("\n");
  const statusLine = lines.at(-1) ?? "";
  const threeLine = lines.find((line) => line.includes("fps") && line.includes("live")) ?? "";
  const missing = REQUIRED_TOKENS.filter((token) => !text.includes(token));
  const forbidden = FORBIDDEN_TOKENS.filter((token) => text.includes(token));
  const nonBlankRows = lines.filter((line) => line.trim().length > 0).length;
  const truecolorBackgroundWrites = countOccurrences(output, "\x1b[48;2;");
  if (threeLine.length === 0) missing.push("three telemetry line");
  if (statusLine.trim().length === 0) missing.push("status line");
  return {
    passed: missing.length === 0 && forbidden.length === 0 && nonBlankRows >= Math.min(4, options.rows),
    columns: options.columns,
    rows: options.rows,
    missing,
    forbidden,
    statusLine,
    threeLine,
    nonBlankRows,
    outputBytes: new TextEncoder().encode(output).byteLength,
    truecolorBackgroundWrites,
  };
}

export function formatWorkbenchVisualSmokeResult(result: WorkbenchVisualSmokeResult): string {
  return [
    "# Workbench Visual Smoke",
    "",
    `Status: ${result.passed ? "pass" : "fail"}`,
    `Size: ${result.columns}x${result.rows}`,
    `Output: ${result.outputBytes} bytes`,
    `Truecolor backgrounds: ${result.truecolorBackgroundWrites}`,
    `Nonblank rows: ${result.nonBlankRows}`,
    `Missing: ${result.missing.join(", ") || "-"}`,
    `Forbidden: ${result.forbidden.join(", ") || "-"}`,
    "",
    "Status line:",
    result.statusLine,
    "",
    "Three line:",
    result.threeLine,
  ].join("\n");
}

export function replayWorkbenchScreen(
  output: string,
  options: { columns: number; rows: number },
): string[][] {
  const columns = Math.max(1, Math.floor(options.columns));
  const rows = Math.max(1, Math.floor(options.rows));
  const screen = Array.from({ length: rows }, () => Array.from({ length: columns }, () => " "));
  const state: ReplayState = { row: 0, column: 0 };
  let index = 0;
  while (index < output.length) {
    const char = output[index]!;
    if (char === "\x1b") {
      const skipped = skipEscape(output, index, screen, state);
      if (skipped > index) {
        index = skipped;
        continue;
      }
    }
    if (char === "\r") {
      state.column = 0;
      index += 1;
      continue;
    }
    if (char === "\n") {
      state.row = Math.min(rows - 1, state.row + 1);
      state.column = 0;
      index += 1;
      continue;
    }
    const codePoint = output.codePointAt(index) ?? char.charCodeAt(0);
    const glyph = String.fromCodePoint(codePoint);
    if (glyph >= " ") {
      screen[state.row]![state.column] = glyph;
      state.column += 1;
      if (state.column >= columns) {
        state.column = columns - 1;
      }
    }
    index += codePoint > 0xffff ? 2 : 1;
  }
  return screen;
}

function skipEscape(output: string, start: number, screen: string[][], state: ReplayState): number {
  const next = output[start + 1];
  if (next === "[") return applyCsi(output, start, screen, state);
  if (next === "]") return skipOsc(output, start);
  if (next === "P" || next === "_") return skipStringTerminatedEscape(output, start);
  return start + 1;
}

function applyCsi(output: string, start: number, screen: string[][], state: ReplayState): number {
  let index = start + 2;
  while (index < output.length) {
    const code = output.charCodeAt(index);
    if (code >= 0x40 && code <= 0x7e) {
      applyCsiCommand(output.slice(start + 2, index), output[index]!, screen, state);
      return index + 1;
    }
    index += 1;
  }
  return output.length;
}

function applyCsiCommand(raw: string, command: string, screen: string[][], state: ReplayState): void {
  const params = raw.replace(/^\?/, "").split(";");
  const rows = screen.length;
  const columns = screen[0]?.length ?? 0;
  switch (command) {
    case "H":
    case "f":
      state.row = clamp(numberParam(params[0], 1) - 1, 0, rows - 1);
      state.column = clamp(numberParam(params[1], 1) - 1, 0, columns - 1);
      return;
    case "G":
      state.column = clamp(numberParam(params[0], 1) - 1, 0, columns - 1);
      return;
    case "A":
      state.row = clamp(state.row - numberParam(params[0], 1), 0, rows - 1);
      return;
    case "B":
      state.row = clamp(state.row + numberParam(params[0], 1), 0, rows - 1);
      return;
    case "C":
      state.column = clamp(state.column + numberParam(params[0], 1), 0, columns - 1);
      return;
    case "D":
      state.column = clamp(state.column - numberParam(params[0], 1), 0, columns - 1);
      return;
    case "J":
      if (numberParam(params[0], 0) === 2 || numberParam(params[0], 0) === 3) clearScreen(screen);
      return;
    case "K":
      clearRow(screen[state.row]!, state.column, numberParam(params[0], 0));
      return;
  }
  if (raw === "?1049h") clearScreen(screen);
}

function skipOsc(output: string, start: number): number {
  let index = start + 2;
  while (index < output.length) {
    if (output[index] === "\x07") return index + 1;
    if (output[index] === "\x1b" && output[index + 1] === "\\") return index + 2;
    index += 1;
  }
  return output.length;
}

function skipStringTerminatedEscape(output: string, start: number): number {
  let index = start + 2;
  while (index < output.length) {
    if (output[index] === "\x1b" && output[index + 1] === "\\") return index + 2;
    index += 1;
  }
  return output.length;
}

function quoteCommand(command: readonly string[]): string {
  return command.map((part) => `'${part.replaceAll("'", "'\\''")}'`).join(" ");
}

function clearScreen(screen: string[][]): void {
  for (const row of screen) row.fill(" ");
}

function clearRow(row: string[], column: number, mode: number): void {
  const start = mode === 1 || mode === 2 ? 0 : Math.max(0, column);
  const end = mode === 0 || mode === 2 ? row.length : Math.min(row.length, column + 1);
  for (let index = start; index < end; index += 1) row[index] = " ";
}

function numberParam(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function countOccurrences(value: string, needle: string): number {
  let count = 0;
  let index = 0;
  while (true) {
    index = value.indexOf(needle, index);
    if (index < 0) return count;
    count += 1;
    index += needle.length;
  }
}
