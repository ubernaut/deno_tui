import { moveCursor } from "../utils/ansi_codes.ts";
import type { CanvasStdout } from "../canvas/sink.ts";
import { fitCellText } from "./workbench_frame.ts";

const encoder = new TextEncoder();

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

  constructor(private readonly stdout: CanvasStdout) {}

  flush(
    frame: readonly (string[] | undefined)[],
    width: number,
    height: number,
    renderRow: (cells: string[], width: number) => string,
  ): WorkbenchAnsiScreenFlushStats {
    const rows = Math.max(0, Math.floor(height));
    const columns = Math.max(0, Math.floor(width));
    let changed = 0;
    let cleared = 0;
    let output = "";

    for (let row = 0; row < rows; row += 1) {
      const next = renderRow(frame[row] ?? [], columns);
      if (this.#rows[row] === next) continue;
      this.#rows[row] = next;
      output += `${moveCursor(row, 0)}${next}`;
      changed += 1;
    }

    for (let row = rows; row < this.#rows.length; row += 1) {
      if (this.#rows[row] === "") continue;
      const blank = fitCellText("", columns);
      this.#rows[row] = "";
      output += `${moveCursor(row, 0)}${blank}`;
      cleared += 1;
    }
    this.#rows.length = rows;

    if (output.length === 0) {
      return { rows, changed, cleared, bytes: 0 };
    }
    const bytes = encoder.encode(output);
    this.stdout.writeSync(bytes);
    return { rows, changed, cleared, bytes: bytes.byteLength };
  }

  reset(): void {
    this.#rows.length = 0;
  }

  inspectRows(): readonly string[] {
    return this.#rows;
  }
}
