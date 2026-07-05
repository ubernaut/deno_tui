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
  screenLines: readonly string[];
  missing: string[];
  forbidden: string[];
  statusLine: string;
  threeLine: string;
  nonBlankRows: number;
  outputBytes: number;
  truecolorBackgroundWrites: number;
  finalTruecolorBackgroundRows: number;
}

export interface WorkbenchFullscreenVisualSmokeResult extends WorkbenchVisualSmokeResult {
  fullscreen: boolean;
  fullscreenCells: number;
  fullscreenCap: number;
  truecolorBackgroundRows: number;
}

interface ReplayState {
  row: number;
  column: number;
  truecolorBackground: boolean;
}

export interface WorkbenchStyledScreenReplay {
  screen: string[][];
  truecolorBackground: boolean[][];
  truecolorBackgroundRows: number;
}

const DEFAULT_COMMAND = ["deno", "task", "api-workbench"] as const;
const REQUIRED_TOKENS: readonly string[] = ["API WORKBENCH", "THREE ASCII", "live", "fps"];
const FORBIDDEN_TOKENS: readonly string[] = ["ReferenceError", "RangeError", "Maximum call stack", ")F10"];
const FULLSCREEN_THREE_CELL_PATTERN = /(\d+)c cap (\d+)c/;

if (import.meta.main) {
  const result = await runWorkbenchVisualSmoke(parseWorkbenchVisualSmokeArgs(Deno.args));
  console.log(formatWorkbenchVisualSmokeResult(result));
  if (!result.passed) Deno.exit(1);
}

export function parseWorkbenchVisualSmokeArgs(args: readonly string[]): WorkbenchVisualSmokeOptions {
  const options: WorkbenchVisualSmokeOptions = {};
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]!;
    if (arg === "--") continue;
    const [name, inlineValue] = arg.split("=", 2);
    const value = inlineValue ?? args[index + 1];
    if (inlineValue === undefined && name.startsWith("--")) index += 1;
    if (value === undefined) continue;
    const number = Number.parseInt(value, 10);
    if (!Number.isFinite(number)) continue;
    if (name === "--columns") options.columns = number;
    else if (name === "--rows") options.rows = number;
    else if (name === "--timeout-ms") options.timeoutMs = number;
  }
  return options;
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
    `timeout -k 1s ${Math.max(0.1, options.timeoutMs / 1000)}s ${quoteCommand(options.command)}`,
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
  const replay = replayWorkbenchStyledScreen(output, options);
  const screen = replay.screen;
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
    screenLines: lines,
    missing,
    forbidden,
    statusLine,
    threeLine,
    nonBlankRows,
    outputBytes: new TextEncoder().encode(output).byteLength,
    truecolorBackgroundWrites,
    finalTruecolorBackgroundRows: replay.truecolorBackgroundRows,
  };
}

export function inspectWorkbenchFullscreenVisualSmokeOutput(
  output: string,
  options: { columns: number; rows: number; minCells?: number; minTruecolorRows?: number },
): WorkbenchFullscreenVisualSmokeResult {
  const base = inspectWorkbenchVisualSmokeOutput(output, options);
  const cellMatch = base.threeLine.match(FULLSCREEN_THREE_CELL_PATTERN);
  const fullscreenCells = cellMatch ? Number.parseInt(cellMatch[1]!, 10) : 0;
  const fullscreenCap = cellMatch ? Number.parseInt(cellMatch[2]!, 10) : 0;
  const truecolorBackgroundRows = base.finalTruecolorBackgroundRows;
  const missing = [...base.missing];
  const minCells = Math.max(1, Math.floor(options.minCells ?? 1_800));
  const minTruecolorRows = Math.max(1, Math.floor(options.minTruecolorRows ?? Math.min(12, options.rows)));
  if (fullscreenCells < minCells) missing.push(`fullscreen three cells >= ${minCells}`);
  if (truecolorBackgroundRows < minTruecolorRows) missing.push(`truecolor rows >= ${minTruecolorRows}`);
  const fullscreen = fullscreenCells >= minCells && truecolorBackgroundRows >= minTruecolorRows;
  return {
    ...base,
    passed: base.forbidden.length === 0 && missing.length === 0,
    missing,
    fullscreen,
    fullscreenCells,
    fullscreenCap,
    truecolorBackgroundRows,
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
    `Final truecolor rows: ${result.finalTruecolorBackgroundRows}`,
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
  return replayWorkbenchStyledScreen(output, options).screen;
}

export function replayWorkbenchStyledScreen(
  output: string,
  options: { columns: number; rows: number },
): WorkbenchStyledScreenReplay {
  const columns = Math.max(1, Math.floor(options.columns));
  const rows = Math.max(1, Math.floor(options.rows));
  const screen = Array.from({ length: rows }, () => Array.from({ length: columns }, () => " "));
  const truecolorBackground = Array.from({ length: rows }, () => Array.from({ length: columns }, () => false));
  const state: ReplayState = { row: 0, column: 0, truecolorBackground: false };
  let index = 0;
  while (index < output.length) {
    const char = output[index]!;
    if (char === "\x1b") {
      const skipped = skipEscape(output, index, screen, truecolorBackground, state);
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
      truecolorBackground[state.row]![state.column] = state.truecolorBackground;
      state.column += 1;
      if (state.column >= columns) {
        state.column = columns - 1;
      }
    }
    index += codePoint > 0xffff ? 2 : 1;
  }
  return {
    screen,
    truecolorBackground,
    truecolorBackgroundRows: truecolorBackground.filter((row) => row.some(Boolean)).length,
  };
}

function skipEscape(
  output: string,
  start: number,
  screen: string[][],
  truecolorBackground: boolean[][],
  state: ReplayState,
): number {
  const next = output[start + 1];
  if (next === "[") return applyCsi(output, start, screen, truecolorBackground, state);
  if (next === "]") return skipOsc(output, start);
  if (next === "P" || next === "_") return skipStringTerminatedEscape(output, start);
  return start + 1;
}

function applyCsi(
  output: string,
  start: number,
  screen: string[][],
  truecolorBackground: boolean[][],
  state: ReplayState,
): number {
  let index = start + 2;
  while (index < output.length) {
    const code = output.charCodeAt(index);
    if (code >= 0x40 && code <= 0x7e) {
      applyCsiCommand(output.slice(start + 2, index), output[index]!, screen, truecolorBackground, state);
      return index + 1;
    }
    index += 1;
  }
  return output.length;
}

function applyCsiCommand(
  raw: string,
  command: string,
  screen: string[][],
  truecolorBackground: boolean[][],
  state: ReplayState,
): void {
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
      if (numberParam(params[0], 0) === 2 || numberParam(params[0], 0) === 3) {
        clearScreen(screen);
        clearBooleanScreen(truecolorBackground);
      }
      return;
    case "K":
      clearRow(screen[state.row]!, state.column, numberParam(params[0], 0));
      clearBooleanRow(truecolorBackground[state.row]!, state.column, numberParam(params[0], 0));
      return;
    case "m":
      state.truecolorBackground = nextTruecolorBackgroundState(raw, state.truecolorBackground);
      return;
  }
  if (raw === "?1049h") {
    clearScreen(screen);
    clearBooleanScreen(truecolorBackground);
  }
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

function clearBooleanScreen(screen: boolean[][]): void {
  for (const row of screen) row.fill(false);
}

function clearRow(row: string[], column: number, mode: number): void {
  const start = mode === 1 || mode === 2 ? 0 : Math.max(0, column);
  const end = mode === 0 || mode === 2 ? row.length : Math.min(row.length, column + 1);
  for (let index = start; index < end; index += 1) row[index] = " ";
}

function clearBooleanRow(row: boolean[], column: number, mode: number): void {
  const start = mode === 1 || mode === 2 ? 0 : Math.max(0, column);
  const end = mode === 0 || mode === 2 ? row.length : Math.min(row.length, column + 1);
  for (let index = start; index < end; index += 1) row[index] = false;
}

function nextTruecolorBackgroundState(raw: string, current: boolean): boolean {
  const params = raw.replace(/^\?/, "").split(";").map((value) => Number.parseInt(value, 10));
  for (let index = 0; index < params.length; index += 1) {
    const value = params[index];
    if (value === 0) return false;
    if (value === 49) current = false;
    if (value === 48 && params[index + 1] === 2) current = true;
  }
  return current;
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

export function countTruecolorBackgroundRows(output: string): number {
  const rows = new Set<number>();
  let row = 1;
  let index = 0;
  while (index < output.length) {
    const char = output[index]!;
    if (char === "\x1b") {
      const applied = applyTruecolorRowCsi(output, index, rows, row);
      if (applied.next > index) {
        row = applied.row;
        index = applied.next;
        continue;
      }
    }
    if (output.startsWith("\x1b[48;2;", index)) rows.add(row);
    if (char === "\n") row += 1;
    index += 1;
  }
  return rows.size;
}

function applyTruecolorRowCsi(
  output: string,
  start: number,
  rows: Set<number>,
  currentRow: number,
): { row: number; next: number } {
  if (output[start + 1] !== "[") return { row: currentRow, next: start };
  let index = start + 2;
  while (index < output.length) {
    const code = output.charCodeAt(index);
    if (code >= 0x40 && code <= 0x7e) {
      const command = output[index]!;
      const raw = output.slice(start + 2, index);
      if (command === "H" || command === "f") {
        const row = numberParam(raw.replace(/^\?/, "").split(";")[0], 1);
        return { row, next: index + 1 };
      }
      if (command === "B") return { row: currentRow + numberParam(raw, 1), next: index + 1 };
      if (command === "A") return { row: Math.max(1, currentRow - numberParam(raw, 1)), next: index + 1 };
      if (command === "m" && raw.includes("48;2;")) rows.add(currentRow);
      return { row: currentRow, next: index + 1 };
    }
    index += 1;
  }
  return { row: currentRow, next: output.length };
}
