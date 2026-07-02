// Copyright 2023 Im-Beast. MIT license.
import { CLEAR_SCREEN, moveCursor } from "../utils/ansi_codes.ts";
import type { CanvasRenderStats } from "./canvas.ts";

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

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
    let lastRow = -1;
    let lastColumn = -1;

    for (const update of updates) {
      const value = typeof update.value === "string" ? update.value : textDecoder.decode(update.value);
      if (update.row !== lastRow || update.column !== lastColumn + 1) {
        drawSequence += moveCursor(update.row, update.column);
      }

      if (drawSequence.length + value.length > this.#flushLimit) {
        this.#stdout.writeSync(textEncoder.encode(drawSequence));
        drawSequence = moveCursor(update.row, update.column);
      }

      drawSequence += value;
      lastRow = update.row;
      lastColumn = update.column;
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
      for (const value of range.values) {
        const text = typeof value === "string" ? value : textDecoder.decode(value);
        if (drawSequence.length + text.length > this.#flushLimit) {
          this.#stdout.writeSync(textEncoder.encode(drawSequence));
          drawSequence = moveCursor(range.row, column);
        }
        drawSequence += text;
        column += 1;
      }
    }

    if (drawSequence.length > 0) {
      this.#stdout.writeSync(textEncoder.encode(drawSequence));
    }
  }
}

/** Public class implementing a memory Canvas Sink. */
export class MemoryCanvasSink implements CanvasCellSink {
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
export function coalesceCanvasRowRanges(updates: readonly CanvasCellUpdate[]): CanvasRowRangeUpdate[] {
  const ranges: CanvasRowRangeUpdate[] = [];
  let active: { row: number; startColumn: number; nextColumn: number; values: (string | Uint8Array)[] } | undefined;

  for (const update of updates) {
    if (!active || update.row !== active.row || update.column !== active.nextColumn) {
      if (active) {
        ranges.push({ row: active.row, startColumn: active.startColumn, values: active.values });
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
    ranges.push({ row: active.row, startColumn: active.startColumn, values: active.values });
  }
  return ranges;
}

function defaultAnsiFlushLimit(): number {
  const deno = globalThis as typeof globalThis & { Deno?: { build?: { os?: string } } };
  return deno.Deno?.build?.os === "windows" ? 1024 : 16384;
}
