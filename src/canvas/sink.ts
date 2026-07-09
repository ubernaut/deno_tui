// Copyright 2023 Im-Beast. MIT license.
import { CLEAR_SCREEN, moveCursor } from "../utils/ansi_codes.ts";
import type { CanvasRenderStats } from "./canvas.ts";

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();
const MAX_ANSI_CELL_PARTS_CACHE_SIZE = 32768;
const MAX_ANSI_PREFIX_STATE_CACHE_SIZE = 8192;
const ansiCellPartsCache = new Map<string, AnsiCellParts>();
const emptyAnsiPrefixState: AnsiPrefixState = { foreground: false, background: false, other: false };
const ansiPrefixStateCache = new Map<string, AnsiPrefixState>();

/** Public interface describing a canvas Stdout. */
export interface CanvasStdout {
  writeSync(data: Uint8Array): number;
}

/** Public interface describing a canvas Cell Update. */
export interface CanvasCellUpdate {
  row: number;
  column: number;
  value: string | Uint8Array;
}

/** Public interface describing a contiguous row range of canvas cell updates. */
export interface CanvasRowRangeUpdate {
  row: number;
  startColumn: number;
  values: readonly (string | Uint8Array)[];
}

/** Public interface describing a canvas Cell Sink. */
export interface CanvasCellSink {
  /** Set false when a range-aware sink does not need legacy per-cell update objects for range flushes. */
  requiresCellUpdates?: boolean;
  resize?(columns: number, rows: number): void;
  flush(updates: readonly CanvasCellUpdate[], stats: CanvasRenderStats): void;
  flushRanges?(
    ranges: readonly CanvasRowRangeUpdate[],
    stats: CanvasRenderStats,
    updates: readonly CanvasCellUpdate[],
  ): void;
}

/** Options for configuring ansi Canvas Sink. */
export interface AnsiCanvasSinkOptions {
  stdout: CanvasStdout;
  flushLimit?: number;
}

/** Terminal sink that converts dirty canvas cells into cursor-addressed ANSI writes. */
export class AnsiCanvasSink implements CanvasCellSink {
  readonly requiresCellUpdates = false;

  readonly #stdout: CanvasStdout;
  readonly #flushLimit: number;

  constructor(options: AnsiCanvasSinkOptions) {
    this.#stdout = options.stdout;
    this.#flushLimit = options.flushLimit ?? defaultAnsiFlushLimit();
  }

  resize(_columns: number, _rows: number): void {
    this.#stdout.writeSync(textEncoder.encode(`${moveCursor(0, 0)}${CLEAR_SCREEN}`));
  }

  flush(updates: readonly CanvasCellUpdate[], _stats?: CanvasRenderStats): void {
    let drawSequence = "";
    for (let index = 0; index < updates.length;) {
      const span = compactAnsiUpdateSpan(updates, index);
      drawSequence += moveCursor(span.row, span.column);

      if (drawSequence.length + span.text.length > this.#flushLimit) {
        this.#stdout.writeSync(textEncoder.encode(drawSequence));
        drawSequence = moveCursor(span.row, span.column);
      }

      drawSequence += span.text;
      index += span.cells;
    }

    if (drawSequence.length > 0) {
      this.#stdout.writeSync(textEncoder.encode(drawSequence));
    }
  }

  flushRanges(ranges: readonly CanvasRowRangeUpdate[], _stats: CanvasRenderStats): void {
    let drawSequence = "";
    for (const range of ranges) {
      drawSequence += moveCursor(range.row, range.startColumn);
      const text = compactAnsiCellRange(range.values);
      if (drawSequence.length + text.length > this.#flushLimit) {
        this.#stdout.writeSync(textEncoder.encode(drawSequence));
        drawSequence = moveCursor(range.row, range.startColumn);
      }
      drawSequence += text;
    }

    if (drawSequence.length > 0) {
      this.#stdout.writeSync(textEncoder.encode(drawSequence));
    }
  }
}

interface AnsiCellParts {
  prefix: string;
  text: string;
  suffix: string;
}

interface AnsiCellSpan {
  text: string;
  cells: number;
  first: AnsiCellParts;
}

interface AnsiUpdateSpan {
  text: string;
  cells: number;
  row: number;
  column: number;
}

function compactAnsiUpdateSpan(updates: readonly CanvasCellUpdate[], start: number): AnsiUpdateSpan {
  const firstUpdate = updates[start]!;
  const first = splitAnsiCellValue(firstUpdate.value);
  let text = first.text;
  let index = start + 1;
  let column = firstUpdate.column;
  while (index < updates.length) {
    const update = updates[index]!;
    if (update.row !== firstUpdate.row || update.column !== column + 1) break;
    const current = splitAnsiCellValue(update.value);
    if (current.prefix !== first.prefix || current.suffix !== first.suffix) break;
    text += current.text;
    column = update.column;
    index += 1;
  }
  return {
    row: firstUpdate.row,
    column: firstUpdate.column,
    text: `${first.prefix}${text}${first.suffix}`,
    cells: index - start,
  };
}

function compactAnsiCellSpan(values: readonly (string | Uint8Array)[], start: number): AnsiCellSpan {
  const firstValue = values[start]!;
  const first = splitAnsiCellValue(firstValue);
  let repeatedCells = 1;
  while (start + repeatedCells < values.length && values[start + repeatedCells] === firstValue) {
    repeatedCells += 1;
  }
  if (repeatedCells > 1) {
    return {
      text: first.text.repeat(repeatedCells),
      cells: repeatedCells,
      first,
    };
  }

  let text = first.text;
  let index = start + 1;
  while (index < values.length) {
    const current = splitAnsiCellValue(values[index]!);
    if (current.prefix !== first.prefix || current.suffix !== first.suffix) break;
    text += current.text;
    index += 1;
  }
  return {
    text,
    cells: index - start,
    first,
  };
}

function compactAnsiCellRange(values: readonly (string | Uint8Array)[]): string {
  let output = "";
  let activePrefix = "";
  let activeState = ansiPrefixState("");
  let needsReset = false;

  for (let index = 0; index < values.length;) {
    const span = compactAnsiCellSpan(values, index);
    const { first } = span;
    if (first.prefix !== activePrefix) {
      const nextState = ansiPrefixState(first.prefix);
      if (needsReset && !ansiPrefixCanOverrideActive(activeState, nextState)) {
        output += "\x1b[0m";
        needsReset = false;
      }
      output += first.prefix;
      activePrefix = first.prefix;
      activeState = nextState;
    }
    output += span.text;
    if (first.prefix || first.suffix) needsReset = true;
    index += span.cells;
  }

  if (needsReset) output += "\x1b[0m";
  return output;
}

interface AnsiPrefixState {
  foreground: boolean;
  background: boolean;
  other: boolean;
}

function ansiPrefixState(prefix: string): AnsiPrefixState {
  if (!prefix) return emptyAnsiPrefixState;
  const cached = ansiPrefixStateCache.get(prefix);
  if (cached) return cached;
  const state = {
    foreground: prefix.includes("[38;") || prefix.includes(";38;"),
    background: prefix.includes("[48;") || prefix.includes(";48;"),
    other: prefix.includes("[0m") || prefix.includes("[1m") || prefix.includes(";1m"),
  };
  if (ansiPrefixStateCache.size > MAX_ANSI_PREFIX_STATE_CACHE_SIZE) {
    ansiPrefixStateCache.clear();
  }
  ansiPrefixStateCache.set(prefix, state);
  return state;
}

function ansiPrefixCanOverrideActive(active: AnsiPrefixState, next: AnsiPrefixState): boolean {
  if (active.other) return false;
  if (active.foreground && !next.foreground) return false;
  if (active.background && !next.background) return false;
  return true;
}

function splitAnsiCellValue(value: string | Uint8Array): AnsiCellParts {
  const cell = typeof value === "string" ? value : textDecoder.decode(value);
  if (!cell.includes("\x1b[")) {
    return { prefix: "", text: cell, suffix: "" };
  }
  const cached = ansiCellPartsCache.get(cell);
  if (cached) return cached;

  let textStart = 0;
  let prefix = "";
  while (textStart < cell.length) {
    const sequence = readCsiSequenceAt(cell, textStart);
    if (!sequence) break;
    prefix += sequence;
    textStart += sequence.length;
  }

  const text = Array.from(cell.slice(textStart))[0];
  if (!text || text.charCodeAt(0) === 0x1b) {
    return { prefix: "", text: cell, suffix: "" };
  }
  const suffix = cell.slice(textStart + text.length);
  if (!isAnsiSuffix(suffix)) {
    return { prefix: "", text: cell, suffix: "" };
  }

  const split = { prefix, text, suffix };
  if (ansiCellPartsCache.size > MAX_ANSI_CELL_PARTS_CACHE_SIZE) {
    ansiCellPartsCache.clear();
  }
  ansiCellPartsCache.set(cell, split);
  return split;
}

function isAnsiSuffix(value: string): boolean {
  if (!value) return true;
  let index = 0;
  while (index < value.length) {
    const sequence = readCsiSequenceAt(value, index);
    if (!sequence) return false;
    index += sequence.length;
  }
  return true;
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

/** Public class implementing a memory Canvas Sink. */
export class MemoryCanvasSink implements CanvasCellSink {
  readonly requiresCellUpdates = true;

  readonly updates: CanvasCellUpdate[] = [];
  readonly rowRanges: CanvasRowRangeUpdate[] = [];
  lastStats?: CanvasRenderStats;
  columns = 0;
  rows = 0;

  resize(columns: number, rows: number): void {
    this.columns = columns;
    this.rows = rows;
  }

  flush(updates: readonly CanvasCellUpdate[], stats: CanvasRenderStats): void {
    for (const update of updates) {
      this.updates.push({ ...update });
    }
    this.lastStats = { ...stats };
  }

  flushRanges(
    ranges: readonly CanvasRowRangeUpdate[],
    stats: CanvasRenderStats,
    updates: readonly CanvasCellUpdate[],
  ): void {
    for (const range of ranges) {
      this.rowRanges.push({ ...range, values: Array.from(range.values) });
    }
    this.flush(updates, stats);
  }

  clear(): void {
    this.updates.length = 0;
    this.rowRanges.length = 0;
    this.lastStats = undefined;
  }
}

/** Coalesces sorted canvas cell updates into contiguous row ranges. */
export function coalesceCanvasRowRanges(
  updates: readonly CanvasCellUpdate[],
  target: CanvasRowRangeUpdate[] = [],
): CanvasRowRangeUpdate[] {
  let active: { row: number; startColumn: number; nextColumn: number; values: (string | Uint8Array)[] } | undefined;
  let written = 0;

  for (const update of updates) {
    if (!active || update.row !== active.row || update.column !== active.nextColumn) {
      if (active) {
        target[written] = writeCanvasRowRangeUpdate(
          target[written],
          active.row,
          active.startColumn,
          active.values,
        );
        written += 1;
      }
      const values = retainedCanvasRowRangeValues(target[written]);
      values.length = 0;
      active = {
        row: update.row,
        startColumn: update.column,
        nextColumn: update.column,
        values,
      };
    }
    active.values.push(update.value);
    active.nextColumn = update.column + 1;
  }

  if (active) {
    target[written] = writeCanvasRowRangeUpdate(
      target[written],
      active.row,
      active.startColumn,
      active.values,
    );
    written += 1;
  }
  target.length = written;
  return target;
}

function retainedCanvasRowRangeValues(range: CanvasRowRangeUpdate | undefined): (string | Uint8Array)[] {
  return Array.isArray(range?.values) && !Object.isFrozen(range.values) ? range.values as (string | Uint8Array)[] : [];
}

function writeCanvasRowRangeUpdate(
  target: CanvasRowRangeUpdate | undefined,
  row: number,
  startColumn: number,
  values: readonly (string | Uint8Array)[],
): CanvasRowRangeUpdate {
  if (!target) return { row, startColumn, values };
  target.row = row;
  target.startColumn = startColumn;
  target.values = values;
  return target;
}

function defaultAnsiFlushLimit(): number {
  const deno = globalThis as typeof globalThis & { Deno?: { build?: { os?: string } } };
  return deno.Deno?.build?.os === "windows" ? 1024 : 16384;
}
