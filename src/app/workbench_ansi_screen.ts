import { moveCursor } from "../utils/ansi_codes.ts";
import type { CanvasStdout } from "../canvas/sink.ts";
import { cleanWorkbenchFrameRowFingerprint, fitCellText, markWorkbenchFrameRowRendered } from "./workbench_frame.ts";

const encoder = new TextEncoder();
const MAX_CHANGED_SPANS_PER_ROW = 8;
const MERGE_CHANGED_SPAN_GAP = 2;

interface WorkbenchAnsiScreenRowCache {
  width: number;
  fingerprint: string;
  line: string;
}

/** Diagnostics returned from a retained ANSI screen-row flush. */
export interface WorkbenchAnsiScreenFlushStats {
  rows: number;
  changed: number;
  cleared: number;
  bytes: number;
  durationMs: number;
}

/** Retained ANSI-row painter for full-screen workbench frames. */
export class WorkbenchAnsiScreenPainter {
  #rows: string[] = [];
  #cells: string[][] = [];
  #widths: number[] = [];
  #changedSpans: ChangedSpan[] = [];
  #changedSpanPool: ChangedSpan[] = [];
  #rowCache = new WeakMap<string[], WorkbenchAnsiScreenRowCache>();

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
    const rows = Math.max(0, Math.floor(height));
    const columns = Math.max(0, Math.floor(width));
    let changed = 0;
    let cleared = 0;
    const output: string[] = [];

    for (let row = 0; row < rows; row += 1) {
      const frameRow = frame[row] ?? [];
      const fingerprint = cleanWorkbenchFrameRowFingerprint(frameRow, columns);
      const cached = this.#rowCache.get(frameRow);
      const next = fingerprint !== undefined && cached?.width === columns && cached.fingerprint === fingerprint
        ? cached.line
        : renderRow(frameRow, columns);
      const nextFingerprint = fingerprint ?? markWorkbenchFrameRowRendered(frameRow, columns, next);
      if (!cached || cached.line !== next || cached.width !== columns || cached.fingerprint !== nextFingerprint) {
        this.#rowCache.set(frameRow, { width: columns, fingerprint: nextFingerprint, line: next });
      }
      if (this.#rows[row] === next) continue;
      this.#rows[row] = next;
      output.push(moveCursor(row, 0), next);
      changed += 1;
    }

    for (let row = rows; row < this.#rows.length; row += 1) {
      if (this.#rows[row] === "") continue;
      const blank = fitCellText("", columns);
      this.#rows[row] = "";
      output.push(moveCursor(row, 0), blank);
      cleared += 1;
    }
    this.#rows.length = rows;

    if (output.length === 0) {
      return { rows, changed, cleared, bytes: 0, durationMs: 0 };
    }
    const flushStart = performance.now();
    const bytes = encoder.encode(output.join(""));
    this.stdout.writeSync(bytes);
    return { rows, changed, cleared, bytes: bytes.byteLength, durationMs: performance.now() - flushStart };
  }

  reset(): void {
    this.#rows.length = 0;
    this.#cells.length = 0;
    this.#widths.length = 0;
    this.#changedSpans.length = 0;
    this.#rowCache = new WeakMap();
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
    const output: string[] = [];

    for (let row = 0; row < rows; row += 1) {
      const frameRow = frame[row] ?? [];
      const previous = this.#cells[row];
      const previousWidth = this.#widths[row] ?? -1;
      const fullRow = !previous || previousWidth !== columns;
      if (fullRow) {
        output.push(moveCursor(row, 0), renderRow(frameRow, columns));
        this.#cells[row] = snapshotFrameRow(frameRow, columns, previous, 0, columns - 1);
        this.#widths[row] = columns;
        this.#rows[row] = "";
        changed += 1;
        continue;
      }

      const spans = changedSpansInto(
        this.#changedSpans,
        this.#changedSpanPool,
        previous,
        frameRow,
        columns,
      );
      if (spans.length === 0) continue;
      for (const span of spans) {
        output.push(moveCursor(row, span.start), renderSlice(frameRow, span.start, span.width));
      }
      this.#cells[row] = snapshotChangedSpans(frameRow, previous, spans);
      this.#widths[row] = columns;
      this.#rows[row] = "";
      changed += 1;
    }

    for (let row = rows; row < this.#cells.length; row += 1) {
      if (!this.#cells[row] && this.#rows[row] === "") continue;
      const blank = fitCellText("", columns);
      output.push(moveCursor(row, 0), blank);
      this.#cells[row] = [];
      this.#widths[row] = columns;
      this.#rows[row] = "";
      cleared += 1;
    }
    this.#cells.length = rows;
    this.#widths.length = rows;
    this.#rows.length = rows;

    if (output.length === 0) {
      return { rows, changed, cleared, bytes: 0, durationMs: 0 };
    }
    const flushStart = performance.now();
    const bytes = encoder.encode(output.join(""));
    this.stdout.writeSync(bytes);
    return { rows, changed, cleared, bytes: bytes.byteLength, durationMs: performance.now() - flushStart };
  }
}

interface ChangedSpan {
  start: number;
  end: number;
  width: number;
}

function changedSpansInto(
  spans: ChangedSpan[],
  pool: ChangedSpan[],
  previous: readonly string[],
  next: readonly string[],
  width: number,
): ChangedSpan[] {
  spans.length = 0;
  let spanStart = -1;
  let lastChanged = -1;

  for (let column = 0; column < width; column += 1) {
    const nextCell = next[column] ?? " ";
    if (previous[column] === nextCell) continue;

    if (spanStart < 0) {
      spanStart = column;
    } else if (column - lastChanged > MERGE_CHANGED_SPAN_GAP + 1) {
      writeChangedSpan(spans, pool, spans.length, spanStart, lastChanged);
      if (spans.length >= MAX_CHANGED_SPANS_PER_ROW) {
        spanStart = column;
        lastChanged = column;
        break;
      }
      spanStart = column;
    }
    lastChanged = column;
  }

  if (spanStart < 0) return spans;
  if (spans.length >= MAX_CHANGED_SPANS_PER_ROW) {
    writeChangedSpan(spans, pool, spans.length - 1, spans[spans.length - 1]!.start, width - 1);
    return spans;
  }
  writeChangedSpan(spans, pool, spans.length, spanStart, lastChanged);
  return spans;
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
  if (snapshot.length !== width) {
    snapshot.length = width;
  }
  const first = Math.max(0, Math.floor(start));
  const last = Math.min(width - 1, Math.floor(end));
  for (let column = first; column <= last; column += 1) {
    snapshot[column] = row[column] ?? " ";
  }
  return snapshot;
}
