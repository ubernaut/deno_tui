import { moveCursor } from "../utils/ansi_codes.ts";
import type { CanvasStdout } from "../canvas/sink.ts";
import { cleanWorkbenchFrameRowFingerprint, fitCellText, markWorkbenchFrameRowRendered } from "./workbench_frame.ts";

const encoder = new TextEncoder();

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
}

/** Retained ANSI-row painter for full-screen workbench frames. */
export class WorkbenchAnsiScreenPainter {
  #rows: string[] = [];
  #cells: string[][] = [];
  #widths: number[] = [];
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
      return { rows, changed, cleared, bytes: 0 };
    }
    const bytes = encoder.encode(output.join(""));
    this.stdout.writeSync(bytes);
    return { rows, changed, cleared, bytes: bytes.byteLength };
  }

  reset(): void {
    this.#rows.length = 0;
    this.#cells.length = 0;
    this.#widths.length = 0;
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
      let start = fullRow ? 0 : -1;
      let end = fullRow ? columns - 1 : -1;

      if (!fullRow) {
        for (let column = 0; column < columns; column += 1) {
          const nextCell = frameRow[column] ?? " ";
          if (previous[column] === nextCell) continue;
          start = column;
          break;
        }
        if (start < 0) continue;
        for (let column = columns - 1; column >= start; column -= 1) {
          const nextCell = frameRow[column] ?? " ";
          if (previous[column] === nextCell) continue;
          end = column;
          break;
        }
      }

      const spanWidth = end - start + 1;
      if (spanWidth <= 0) continue;
      output.push(
        moveCursor(row, start),
        fullRow ? renderRow(frameRow, columns) : renderSlice(frameRow, start, spanWidth),
      );
      this.#cells[row] = snapshotFrameRow(frameRow, columns, previous);
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
      return { rows, changed, cleared, bytes: 0 };
    }
    const bytes = encoder.encode(output.join(""));
    this.stdout.writeSync(bytes);
    return { rows, changed, cleared, bytes: bytes.byteLength };
  }
}

function snapshotFrameRow(row: readonly string[], width: number, reuse?: string[]): string[] {
  const snapshot = reuse ?? [];
  snapshot.length = width;
  for (let column = 0; column < width; column += 1) {
    snapshot[column] = row[column] ?? " ";
  }
  return snapshot;
}
