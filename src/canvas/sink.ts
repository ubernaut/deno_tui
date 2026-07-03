// Copyright 2023 Im-Beast. MIT license.
import { CLEAR_SCREEN, moveCursor } from "../utils/ansi_codes.ts";
import type { CanvasRenderStats } from "./canvas.ts";

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();
const MAX_ANSI_CELL_PARTS_CACHE_SIZE = 32768;
const ansiCellPartsCache = new Map<string, AnsiCellParts>();

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
      let column = range.startColumn;
      drawSequence += moveCursor(range.row, column);
      for (let index = 0; index < range.values.length;) {
        const span = compactAnsiCellSpan(range.values, index);
        if (drawSequence.length + span.text.length > this.#flushLimit) {
          this.#stdout.writeSync(textEncoder.encode(drawSequence));
          drawSequence = moveCursor(range.row, column);
        }
        drawSequence += span.text;
        column += span.cells;
        index += span.cells;
      }
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
}

interface AnsiUpdateSpan extends AnsiCellSpan {
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
  const first = splitAnsiCellValue(values[start]!);
  let text = first.text;
  let index = start + 1;
  while (index < values.length) {
    const current = splitAnsiCellValue(values[index]!);
    if (current.prefix !== first.prefix || current.suffix !== first.suffix) break;
    text += current.text;
    index += 1;
  }
  return {
    text: `${first.prefix}${text}${first.suffix}`,
    cells: index - start,
  };
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
      this.rowRanges.push({ ...range, values: cloneCanvasRangeValues(range.values) });
    }
    this.flush(updates, stats);
  }

  clear(): void {
    this.updates.length = 0;
    this.rowRanges.length = 0;
    this.lastStats = undefined;
  }
}

function cloneCanvasRangeValues(values: readonly (string | Uint8Array)[]): (string | Uint8Array)[] {
  const output = new Array<string | Uint8Array>(values.length);
  for (let index = 0; index < values.length; index += 1) {
    output[index] = values[index]!;
  }
  return output;
}

/** Coalesces sorted canvas cell updates into contiguous row ranges. */
export function coalesceCanvasRowRanges(
  updates: readonly CanvasCellUpdate[],
  target: CanvasRowRangeUpdate[] = [],
): CanvasRowRangeUpdate[] {
  target.length = 0;
  let active: { row: number; startColumn: number; nextColumn: number; values: (string | Uint8Array)[] } | undefined;

  for (const update of updates) {
    if (!active || update.row !== active.row || update.column !== active.nextColumn) {
      if (active) {
        target.push({ row: active.row, startColumn: active.startColumn, values: active.values });
      }
      active = {
        row: update.row,
        startColumn: update.column,
        nextColumn: update.column,
        values: [],
      };
    }
    active.values.push(update.value);
    active.nextColumn = update.column + 1;
  }

  if (active) {
    target.push({ row: active.row, startColumn: active.startColumn, values: active.values });
  }
  return target;
}

function defaultAnsiFlushLimit(): number {
  const deno = globalThis as typeof globalThis & { Deno?: { build?: { os?: string } } };
  return deno.Deno?.build?.os === "windows" ? 1024 : 16384;
}
