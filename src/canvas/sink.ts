// Copyright 2023 Im-Beast. MIT license.
import { moveCursor } from "../utils/ansi_codes.ts";
import type { CanvasRenderStats } from "./canvas.ts";

const textEncoder = new TextEncoder();

export interface CanvasStdout {
  writeSync(data: Uint8Array): number;
}

export interface CanvasCellUpdate {
  row: number;
  column: number;
  value: string | Uint8Array;
}

export interface CanvasCellSink {
  resize?(columns: number, rows: number): void;
  flush(updates: readonly CanvasCellUpdate[], stats: CanvasRenderStats): void;
}

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

  flush(updates: readonly CanvasCellUpdate[], _stats?: CanvasRenderStats): void {
    let drawSequence = "";
    let lastRow = -1;
    let lastColumn = -1;

    for (const update of updates) {
      const value = typeof update.value === "string" ? update.value : new TextDecoder().decode(update.value);
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
}

export class MemoryCanvasSink implements CanvasCellSink {
  readonly updates: CanvasCellUpdate[] = [];
  lastStats?: CanvasRenderStats;
  columns = 0;
  rows = 0;

  resize(columns: number, rows: number): void {
    this.columns = columns;
    this.rows = rows;
  }

  flush(updates: readonly CanvasCellUpdate[], stats: CanvasRenderStats): void {
    this.updates.push(...updates.map((update) => ({ ...update })));
    this.lastStats = { ...stats };
  }

  clear(): void {
    this.updates.length = 0;
    this.lastStats = undefined;
  }
}

function defaultAnsiFlushLimit(): number {
  const deno = globalThis as typeof globalThis & { Deno?: { build?: { os?: string } } };
  return deno.Deno?.build?.os === "windows" ? 1024 : 16384;
}
