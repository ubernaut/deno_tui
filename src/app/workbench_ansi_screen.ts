import { moveCursor } from "../utils/ansi_codes.ts";
import type { CanvasStdout } from "../canvas/sink.ts";
import { type WorkbenchAnsiScreenFlushStats, writeWorkbenchAnsiScreenOutput } from "./workbench_ansi_output.ts";
import { cleanWorkbenchFrameRowFingerprint, fitCellText, markWorkbenchFrameRowRendered } from "./workbench_frame.ts";
import { type ChangedSpan, changedSpansInto, snapshotChangedSpans, snapshotFrameRow } from "./workbench_ansi_spans.ts";

interface WorkbenchAnsiScreenRowCache {
  width: number;
  fingerprint: string;
  line: string;
}

export type { WorkbenchAnsiScreenFlushStats } from "./workbench_ansi_output.ts";

/** Retained ANSI-row painter for full-screen workbench frames. */
export class WorkbenchAnsiScreenPainter {
  #rows: string[] = [];
  #cells: string[][] = [];
  #widths: number[] = [];
  #changedSpans: ChangedSpan[] = [];
  #changedSpanPool: ChangedSpan[] = [];
  #rowCache = new WeakMap<string[], WorkbenchAnsiScreenRowCache>();
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
      const blank = this.blankLine(columns);
      this.#rows[row] = "";
      output.push(moveCursor(row, 0), blank);
      cleared += 1;
    }
    this.#rows.length = rows;

    return writeWorkbenchAnsiScreenOutput(this.stdout, output, { rows, changed, cleared });
  }

  reset(): void {
    this.#rows.length = 0;
    this.#cells.length = 0;
    this.#widths.length = 0;
    this.#changedSpans.length = 0;
    this.#blankWidth = -1;
    this.#blankLine = "";
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
      const blank = this.blankLine(columns);
      output.push(moveCursor(row, 0), blank);
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
}
