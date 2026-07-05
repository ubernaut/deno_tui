import type { CanvasStdout } from "../canvas/sink.ts";
import { CLEAR_SCREEN, moveCursor } from "../utils/ansi_codes.ts";
import {
  cleanWorkbenchFrameRowFingerprint,
  fitCellText,
  markWorkbenchFrameRowRendered,
  workbenchFrameRowRenderedHint,
} from "./workbench_frame.ts";

const encoder = new TextEncoder();
const CLEAR_TO_END_OF_LINE = "\x1b[K";
const DEFAULT_MAX_CHANGED_SPANS_PER_ROW = 8;
const DEFAULT_MERGE_CHANGED_SPAN_GAP = 2;

interface ChangedSpan {
  start: number;
  end: number;
  width: number;
}

interface ChangedSpansOptions {
  maxSpans?: number;
  mergeGap?: number;
}

function changedSpansInto(
  spans: ChangedSpan[],
  pool: ChangedSpan[],
  previous: readonly string[],
  next: readonly string[],
  width: number,
  options?: ChangedSpansOptions,
): ChangedSpan[] {
  spans.length = 0;
  const columns = Math.max(0, Math.floor(width));
  const maxSpans = options?.maxSpans === undefined
    ? DEFAULT_MAX_CHANGED_SPANS_PER_ROW
    : Math.max(1, Math.floor(options.maxSpans));
  const mergeGap = options?.mergeGap === undefined
    ? DEFAULT_MERGE_CHANGED_SPAN_GAP
    : Math.max(0, Math.floor(options.mergeGap));
  let spanStart = -1;
  let lastChanged = -1;

  for (let column = 0; column < columns; column += 1) {
    const nextCell = next[column] ?? " ";
    if (previous[column] === nextCell) continue;

    if (spanStart < 0) {
      spanStart = column;
    } else if (column - lastChanged > mergeGap + 1) {
      writeChangedSpan(spans, pool, spans.length, spanStart, lastChanged);
      if (spans.length >= maxSpans) {
        spanStart = column;
        lastChanged = column;
        break;
      }
      spanStart = column;
    }
    lastChanged = column;
  }

  if (spanStart < 0) return spans;
  if (spans.length >= maxSpans) {
    writeChangedSpan(spans, pool, spans.length - 1, spans[spans.length - 1]!.start, columns - 1);
    return spans;
  }
  writeChangedSpan(spans, pool, spans.length, spanStart, lastChanged);
  return spans;
}

function snapshotChangedSpans(
  row: readonly string[],
  snapshot: string[],
  spans: readonly ChangedSpan[],
): string[] {
  for (const span of spans) {
    for (let column = span.start; column <= span.end; column += 1) {
      snapshot[column] = row[column] ?? " ";
    }
  }
  return snapshot;
}

function snapshotFrameRow(
  row: readonly string[],
  width: number,
  reuse?: string[],
  start = 0,
  end = width - 1,
): string[] {
  const snapshot = reuse ?? [];
  const columns = Math.max(0, Math.floor(width));
  if (snapshot.length !== columns) {
    snapshot.length = columns;
  }
  const first = Math.max(0, Math.floor(start));
  const last = Math.min(columns - 1, Math.floor(end));
  for (let column = first; column <= last; column += 1) {
    snapshot[column] = row[column] ?? " ";
  }
  return snapshot;
}

/** Terminal flush statistics returned by retained workbench ANSI screen painters. */
export interface WorkbenchAnsiScreenFlushStats {
  rows: number;
  changed: number;
  cleared: number;
  bytes: number;
  durationMs: number;
}

/** Encodes and writes assembled ANSI rows while measuring byte count and write duration. */
export function writeWorkbenchAnsiScreenOutput(
  stdout: CanvasStdout,
  output: readonly string[],
  stats: Pick<WorkbenchAnsiScreenFlushStats, "rows" | "changed" | "cleared">,
): WorkbenchAnsiScreenFlushStats {
  if (output.length === 0) {
    return { ...stats, bytes: 0, durationMs: 0 };
  }

  const flushStart = performance.now();
  const bytes = encoder.encode(output.join(""));
  stdout.writeSync(bytes);
  return { ...stats, bytes: bytes.byteLength, durationMs: performance.now() - flushStart };
}

interface WorkbenchAnsiScreenRowCache {
  width: number;
  fingerprint: string;
  line: string;
}

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

  clearScreen(): WorkbenchAnsiScreenFlushStats {
    this.reset();
    return writeWorkbenchAnsiScreenOutput(this.stdout, [CLEAR_SCREEN, moveCursor(0, 0)], {
      rows: 0,
      changed: 0,
      cleared: 0,
    });
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

function writeChangedSpan(
  spans: ChangedSpan[],
  pool: ChangedSpan[],
  index: number,
  start: number,
  end: number,
): void {
  const span = pool[index];
  if (span) {
    span.start = start;
    span.end = end;
    span.width = end - start + 1;
    spans[index] = span;
    return;
  }
  const nextSpan = { start, end, width: end - start + 1 };
  pool[index] = nextSpan;
  spans[index] = nextSpan;
}
