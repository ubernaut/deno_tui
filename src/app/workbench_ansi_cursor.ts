import { moveCursor } from "../utils/ansi_codes.ts";

/** Small cache for repeated terminal cursor-position escape sequences. */
export class WorkbenchAnsiCursorCache {
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
