import type { CanvasStdout } from "../canvas/sink.ts";
import { moveCursor } from "../utils/ansi_codes.ts";
import { type WorkbenchAnsiScreenFlushStats, writeWorkbenchAnsiScreenOutput } from "./workbench_ansi_output.ts";
import {
  cleanWorkbenchFrameRowFingerprint,
  fitCellText,
  markWorkbenchFrameRowRendered,
  workbenchFrameRowRenderedHint,
} from "./workbench_frame.ts";
import { type ChangedSpan, changedSpansInto, snapshotChangedSpans, snapshotFrameRow } from "./workbench_ansi_spans.ts";

interface WorkbenchAnsiScreenRowCache {
  width: number;
  fingerprint: string;
  line: string;
}

const CLEAR_TO_END_OF_LINE = "\x1b[K";

/** Small cache for repeated terminal cursor-position escape sequences. */
class WorkbenchAnsiCursorCache {
  #rows: string[][] = [];

  move(row: number, column: number): string {
    const safeRow = Math.max(0, Math.floor(row));
    const safeColumn = Math.max(0, Math.floor(column));
    const rowCache = this.#rows[safeRow] ??= [];
    return rowCache[safeColumn] ??= moveCursor(safeRow, safeColumn);
  }

  clear(): void {
    this.#rows.length = 0;
  }
}

interface WorkbenchAnsiScreenSpanRowCache {
  width: number;
  fingerprint: string;
  line?: string;
}

function workbenchAnsiSpanRowCleanCacheMatches(
  cache: WorkbenchAnsiScreenSpanRowCache | undefined,
  width: number,
  fingerprint: string | undefined,
): boolean {
  return fingerprint !== undefined && cache?.width === Math.max(0, Math.floor(width)) &&
    cache.fingerprint === fingerprint;
}

function workbenchAnsiSpanRowRenderedHintCacheMatches(
  cache: WorkbenchAnsiScreenSpanRowCache | undefined,
  width: number,
  renderedHint: string | undefined,
): boolean {
  return renderedHint !== undefined && cache?.width === Math.max(0, Math.floor(width)) &&
    cache.line === renderedHint;
}

export type { WorkbenchAnsiScreenFlushStats } from "./workbench_ansi_output.ts";

/** Retained ANSI-row painter for full-screen workbench frames. */
export class WorkbenchAnsiScreenPainter {
  #rows: string[] = [];
  #cells: string[][] = [];
  #widths: number[] = [];
  #rowWidths: number[] = [];
  #changedSpans: ChangedSpan[] = [];
  #changedSpanPool: ChangedSpan[] = [];
  #output: string[] = [];
  #rowCache = new WeakMap<string[], WorkbenchAnsiScreenRowCache>();
  #spanRowCache = new WeakMap<string[], WorkbenchAnsiScreenSpanRowCache>();
  #cursorCache = new WorkbenchAnsiCursorCache();
  #blankWidth = -1;
  #blankLine = "";

  constructor(private readonly stdout: CanvasStdout) {}

  flush(
    frame: readonly (string[] | undefined)[],
    width: number,
    height: number,
    renderRow: (cells: string[], width: number) => string,
    renderSlice?: (cells: string[], start: number, width: number) => string,
  ): WorkbenchAnsiScreenFlushStats {
    if (renderSlice) return this.flushChangedSpans(frame, width, height, renderRow, renderSlice);
    this.#cells.length = 0;
    this.#widths.length = 0;
    this.#spanRowCache = new WeakMap();
    const rows = Math.max(0, Math.floor(height));
    const columns = Math.max(0, Math.floor(width));
    let changed = 0;
    let cleared = 0;
    const output = this.#output;
    output.length = 0;

    for (let row = 0; row < rows; row += 1) {
      const frameRow = frame[row] ?? [];
      const previousWidth = this.#rowWidths[row] ?? -1;
      const fingerprint = cleanWorkbenchFrameRowFingerprint(frameRow, columns);
      const cached = this.#rowCache.get(frameRow);
      const next = fingerprint !== undefined && cached?.width === columns && cached.fingerprint === fingerprint
        ? cached.line
        : renderRow(frameRow, columns);
      const nextFingerprint = fingerprint ?? markWorkbenchFrameRowRendered(frameRow, columns, next);
      if (!cached || cached.line !== next || cached.width !== columns || cached.fingerprint !== nextFingerprint) {
        this.#rowCache.set(frameRow, { width: columns, fingerprint: nextFingerprint, line: next });
      }
      if (this.#rows[row] === next) {
        if (previousWidth > columns) {
          this.#rowWidths[row] = columns;
          output.push(this.#cursorCache.move(row, 0), next, CLEAR_TO_END_OF_LINE);
          changed += 1;
        }
        continue;
      }
      this.#rows[row] = next;
      this.#rowWidths[row] = columns;
      output.push(this.#cursorCache.move(row, 0), next);
      if (previousWidth > columns) output.push(CLEAR_TO_END_OF_LINE);
      changed += 1;
    }

    for (let row = rows; row < this.#rows.length; row += 1) {
      if (this.#rows[row] === "") continue;
      const blank = this.blankLine(columns);
      this.#rows[row] = "";
      output.push(this.#cursorCache.move(row, 0), blank);
      cleared += 1;
    }
    this.#rows.length = rows;
    this.#rowWidths.length = rows;

    return writeWorkbenchAnsiScreenOutput(this.stdout, output, { rows, changed, cleared });
  }

  reset(): void {
    this.#rows.length = 0;
    this.#cells.length = 0;
    this.#widths.length = 0;
    this.#rowWidths.length = 0;
    this.#changedSpans.length = 0;
    this.#output.length = 0;
    this.#blankWidth = -1;
    this.#blankLine = "";
    this.#rowCache = new WeakMap();
    this.#spanRowCache = new WeakMap();
    this.#cursorCache.clear();
  }

  inspectRows(): readonly string[] {
    return this.#rows;
  }

  private flushChangedSpans(
    frame: readonly (string[] | undefined)[],
    width: number,
    height: number,
    renderRow: (cells: string[], width: number) => string,
    renderSlice: (cells: string[], start: number, width: number) => string,
  ): WorkbenchAnsiScreenFlushStats {
    const rows = Math.max(0, Math.floor(height));
    const columns = Math.max(0, Math.floor(width));
    let changed = 0;
    let cleared = 0;
    const output = this.#output;
    output.length = 0;

    for (let row = 0; row < rows; row += 1) {
      const frameRow = frame[row] ?? [];
      const previous = this.#cells[row];
      const previousWidth = this.#widths[row] ?? -1;
      const fullRow = !previous || previousWidth !== columns;
      if (fullRow) {
        output.push(this.#cursorCache.move(row, 0), renderRow(frameRow, columns));
        if (previousWidth > columns) output.push(CLEAR_TO_END_OF_LINE);
        this.#cells[row] = snapshotFrameRow(frameRow, columns, previous, 0, columns - 1);
        this.#widths[row] = columns;
        this.markSpanRowRendered(frameRow, columns);
        this.#rows[row] = "";
        changed += 1;
        continue;
      }

      const fingerprint = cleanWorkbenchFrameRowFingerprint(frameRow, columns);
      const cached = this.#spanRowCache.get(frameRow);
      if (workbenchAnsiSpanRowCleanCacheMatches(cached, columns, fingerprint)) {
        continue;
      }
      const renderedHint = workbenchFrameRowRenderedHint(frameRow, columns);
      if (workbenchAnsiSpanRowRenderedHintCacheMatches(cached, columns, renderedHint)) {
        this.markSpanRowRendered(frameRow, columns, renderedHint);
        continue;
      }

      const spans = changedSpansInto(
        this.#changedSpans,
        this.#changedSpanPool,
        previous,
        frameRow,
        columns,
      );
      if (spans.length === 0) {
        this.markSpanRowRendered(frameRow, columns, renderedHint);
        continue;
      }
      for (const span of spans) {
        output.push(this.#cursorCache.move(row, span.start), renderSlice(frameRow, span.start, span.width));
      }
      this.#cells[row] = snapshotChangedSpans(frameRow, previous, spans);
      this.#widths[row] = columns;
      this.markSpanRowRendered(frameRow, columns, renderedHint);
      this.#rows[row] = "";
      changed += 1;
    }

    for (let row = rows; row < this.#cells.length; row += 1) {
      if (!this.#cells[row] && this.#rows[row] === "") continue;
      const blank = this.blankLine(columns);
      output.push(this.#cursorCache.move(row, 0), blank);
      this.#cells[row] = [];
      this.#widths[row] = columns;
      this.#rows[row] = "";
      cleared += 1;
    }
    this.#cells.length = rows;
    this.#widths.length = rows;
    this.#rows.length = rows;

    return writeWorkbenchAnsiScreenOutput(this.stdout, output, { rows, changed, cleared });
  }

  private blankLine(columns: number): string {
    if (this.#blankWidth === columns) return this.#blankLine;
    this.#blankWidth = columns;
    this.#blankLine = fitCellText("", columns);
    return this.#blankLine;
  }

  private markSpanRowRendered(
    frameRow: string[],
    columns: number,
    line = workbenchFrameRowRenderedHint(frameRow, columns),
  ): void {
    this.#spanRowCache.set(frameRow, {
      width: columns,
      fingerprint: markWorkbenchFrameRowRendered(frameRow, columns, ""),
      line,
    });
  }
}
