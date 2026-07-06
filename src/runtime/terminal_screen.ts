// Copyright 2023 Im-Beast. MIT license.
import {
  type ParsedTerminalControlSequence,
  parseTerminalControlSequence,
  parseTerminalParams,
} from "./terminal_sequences.ts";
import { clamp } from "../utils/numbers.ts";
import { textWidth, UNICODE_CHAR_REGEXP } from "../utils/strings.ts";

/** Styled terminal cell tracked by TerminalScreenController. */
export interface TerminalScreenCell {
  char: string;
  bold?: boolean;
  foreground?: number;
  background?: number;
  hyperlink?: string;
}

/** Cursor position inside a terminal screen model. */
export interface TerminalScreenCursor {
  column: number;
  row: number;
}

/** Terminal cursor style reported by TerminalScreenController inspection. */
export interface TerminalScreenCursorStyle {
  shape: "block" | "underline" | "bar";
  blinking: boolean;
}

/** Options for configuring Terminal Screen Controller. */
export interface TerminalScreenControllerOptions {
  columns?: number;
  rows?: number;
  scrollbackLimit?: number;
}

/** Serializable inspection snapshot for Terminal Screen Controller. */
export interface TerminalScreenInspection {
  columns: number;
  rows: number;
  cursor: TerminalScreenCursor;
  cursorVisible: boolean;
  cursorStyle: TerminalScreenCursorStyle;
  privateModes: number[];
  scrollbackRows: number;
  alternate: boolean;
  title?: string;
}

interface TerminalScreenState {
  cells: TerminalScreenCell[][];
  cursor: TerminalScreenCursor;
}

const DEFAULT_COLUMNS = 80;
const DEFAULT_ROWS = 24;
const DEFAULT_SCROLLBACK_LIMIT = 1000;
const BLANK_CELL: TerminalScreenCell = Object.freeze({ char: " " });

/** Lightweight ANSI terminal screen model for process and PTY output renderers. */
export class TerminalScreenController {
  #columns: number;
  #rows: number;
  #scrollbackLimit: number;
  #state: TerminalScreenState;
  #mainState?: TerminalScreenState;
  #scrollback: TerminalScreenCell[][] = [];
  #style: Omit<TerminalScreenCell, "char"> = {};
  #savedCursor?: TerminalScreenCursor;
  #title?: string;
  #hyperlink?: string;
  #scrollRegion: TerminalScreenScrollRegion;
  #cursorVisible = true;
  #cursorStyle: TerminalScreenCursorStyle = { shape: "block", blinking: true };
  #privateModes = new Set<number>();
  #originMode = false;
  #autoWrap = true;
  #insertMode = false;
  #lastPrintableCell?: TerminalScreenCell;
  #lastPrintableWidth = 1;
  #tabStops: Set<number>;
  readonly #decoder = new TextDecoder();

  constructor(options: TerminalScreenControllerOptions = {}) {
    this.#columns = normalizeDimension(options.columns, DEFAULT_COLUMNS);
    this.#rows = normalizeDimension(options.rows, DEFAULT_ROWS);
    this.#scrollbackLimit = Math.max(0, Math.floor(options.scrollbackLimit ?? DEFAULT_SCROLLBACK_LIMIT));
    this.#state = {
      cells: createRows(this.#columns, this.#rows),
      cursor: { column: 0, row: 0 },
    };
    this.#scrollRegion = fullScrollRegion(this.#rows);
    this.#tabStops = defaultTabStops(this.#columns);
  }

  get columns(): number {
    return this.#columns;
  }

  get rows(): number {
    return this.#rows;
  }

  get cursor(): TerminalScreenCursor {
    return { ...this.#state.cursor };
  }

  get alternate(): boolean {
    return this.#mainState !== undefined;
  }

  write(data: string | Uint8Array): void {
    const text = typeof data === "string" ? data : this.#decoder.decode(data);
    for (let index = 0; index < text.length;) {
      const char = readTerminalGraphic(text, index);
      if (char === "\x1b") {
        const parsed = parseTerminalControlSequence(text, index);
        if (parsed) {
          this.#applyControl(parsed);
          index += parsed.length;
          continue;
        }
      }
      this.#writeChar(char);
      index += char.length;
    }
  }

  resize(columns: number, rows: number): void {
    const nextColumns = normalizeDimension(columns, this.#columns);
    const nextRows = normalizeDimension(rows, this.#rows);
    if (nextColumns === this.#columns && nextRows === this.#rows) return;
    this.#columns = nextColumns;
    this.#rows = nextRows;
    this.#state = resizeState(this.#state, nextColumns, nextRows);
    if (this.#mainState) this.#mainState = resizeState(this.#mainState, nextColumns, nextRows);
    this.#scrollRegion = fullScrollRegion(this.#rows);
    this.#tabStops = resizeTabStops(this.#tabStops, this.#columns);
  }

  clear(): void {
    this.#state.cells = createRows(this.#columns, this.#rows);
    this.#state.cursor = { column: 0, row: 0 };
    this.#scrollRegion = fullScrollRegion(this.#rows);
    this.#tabStops = defaultTabStops(this.#columns);
  }

  textRows(): string[] {
    return terminalCellRowsToText(this.#state.cells);
  }

  cellRows(): TerminalScreenCell[][] {
    return cloneTerminalCellRows(this.#state.cells);
  }

  scrollbackTextRows(): string[] {
    return terminalCellRowsToText(this.#scrollback);
  }

  inspect(): TerminalScreenInspection {
    return {
      columns: this.#columns,
      rows: this.#rows,
      cursor: this.cursor,
      cursorVisible: this.#cursorVisible,
      cursorStyle: { ...this.#cursorStyle },
      privateModes: sortedPrivateModes(this.#privateModes),
      scrollbackRows: this.#scrollback.length,
      alternate: this.alternate,
      title: this.#title,
    };
  }

  #writeChar(char: string): void {
    if (char === "\n") {
      this.#newline();
      return;
    }
    if (char === "\r") {
      this.#state.cursor.column = 0;
      return;
    }
    if (char === "\b") {
      this.#state.cursor.column = Math.max(0, this.#state.cursor.column - 1);
      return;
    }
    if (char === "\t") {
      this.#state.cursor.column = nextTabStop(this.#tabStops, this.#state.cursor.column, this.#columns);
      return;
    }
    if (char < " ") return;

    const width = terminalGraphicWidth(char);
    const cell = this.#styledCell(char);
    this.#writeCell(cell);
    for (let index = 1; index < width; index += 1) {
      this.#writeCell(BLANK_CELL);
    }
    this.#lastPrintableCell = { ...cell };
    this.#lastPrintableWidth = width;
  }

  #writeCell(cell: TerminalScreenCell): void {
    const row = this.#state.cells[this.#state.cursor.row]!;
    if (this.#insertMode) {
      row.splice(this.#state.cursor.column, 0, { char: " " });
      row.length = this.#columns;
    }
    row[this.#state.cursor.column] = cell;
    if (this.#state.cursor.column >= this.#columns - 1) {
      if (!this.#autoWrap) return;
      this.#state.cursor.column = 0;
      this.#newline();
    } else {
      this.#state.cursor.column += 1;
    }
  }

  #newline(): void {
    this.#state.cursor.column = 0;
    this.#index();
  }

  #index(): void {
    if (this.#state.cursor.row === this.#scrollRegion.bottom) {
      this.#scrollRegionUp(this.#scrollRegion.top, this.#scrollRegion.bottom, 1);
      return;
    }
    if (this.#state.cursor.row < this.#rows - 1) {
      this.#state.cursor.row += 1;
      return;
    }
    this.#scrollRegionUp(0, this.#rows - 1, 1);
  }

  #applyControl(sequence: ParsedTerminalControlSequence): void {
    if (sequence.kind === "osc") {
      this.#applyOsc(sequence.params);
      return;
    }
    const params = parseTerminalParams(sequence.params);
    if (sequence.private && (sequence.command === "h" || sequence.command === "l")) {
      this.#applyPrivateModes(params, sequence.command === "h");
      return;
    }
    if (sequence.command === "h" || sequence.command === "l") {
      this.#applyModes(params, sequence.command === "h");
      return;
    }
    switch (sequence.command) {
      case "m":
        this.#applySgr(params);
        break;
      case "H":
        if (sequence.kind === "esc") {
          this.#setTabStop();
          break;
        }
        this.#setCursorPosition(params[0] ?? 1, params[1] ?? 1);
        break;
      case "f":
        this.#setCursorPosition(params[0] ?? 1, params[1] ?? 1);
        break;
      case "A":
        this.#state.cursor.row = clamp(this.#state.cursor.row - (params[0] || 1), 0, this.#rows - 1);
        break;
      case "B":
        this.#state.cursor.row = clamp(this.#state.cursor.row + (params[0] || 1), 0, this.#rows - 1);
        break;
      case "C":
        this.#state.cursor.column = clamp(this.#state.cursor.column + (params[0] || 1), 0, this.#columns - 1);
        break;
      case "a":
        this.#state.cursor.column = clamp(this.#state.cursor.column + (params[0] || 1), 0, this.#columns - 1);
        break;
      case "D":
        if (sequence.kind === "esc") {
          this.#index();
          break;
        }
        this.#state.cursor.column = clamp(this.#state.cursor.column - (params[0] || 1), 0, this.#columns - 1);
        break;
      case "E":
        if (sequence.kind === "esc") {
          this.#state.cursor.column = 0;
          this.#index();
          break;
        }
        this.#state.cursor.row = clamp(this.#state.cursor.row + (params[0] || 1), 0, this.#rows - 1);
        this.#state.cursor.column = 0;
        break;
      case "F":
        this.#state.cursor.row = clamp(this.#state.cursor.row - (params[0] || 1), 0, this.#rows - 1);
        this.#state.cursor.column = 0;
        break;
      case "G":
        this.#state.cursor.column = clamp((params[0] || 1) - 1, 0, this.#columns - 1);
        break;
      case "`":
        this.#state.cursor.column = clamp((params[0] || 1) - 1, 0, this.#columns - 1);
        break;
      case "d":
        this.#setCursorPosition(params[0] || 1, this.#state.cursor.column + 1);
        break;
      case "e":
        this.#state.cursor.row = clamp(this.#state.cursor.row + (params[0] || 1), 0, this.#rows - 1);
        break;
      case "I":
        this.#cursorForwardTabs(params[0] || 1);
        break;
      case "Z":
        this.#cursorBackwardTabs(params[0] || 1);
        break;
      case "b":
        this.#repeatLastPrintable(params[0] || 1);
        break;
      case "c":
        if (sequence.kind === "esc") this.#reset();
        break;
      case "g":
        this.#clearTabStops(params[0] ?? 0);
        break;
      case "J":
        this.#eraseDisplay(params[0] ?? 0);
        break;
      case "K":
        this.#eraseLine(params[0] ?? 0);
        break;
      case "@":
        this.#insertCharacters(params[0] || 1);
        break;
      case "P":
        this.#deleteCharacters(params[0] || 1);
        break;
      case "X":
        this.#eraseCharacters(params[0] || 1);
        break;
      case "L":
        this.#insertLines(params[0] || 1);
        break;
      case "M":
        if (sequence.kind === "esc") this.#reverseIndex();
        else this.#deleteLines(params[0] || 1);
        break;
      case "S":
        this.#scrollRegionUp(this.#scrollRegion.top, this.#scrollRegion.bottom, params[0] || 1);
        break;
      case "T":
        this.#scrollRegionDown(this.#scrollRegion.top, this.#scrollRegion.bottom, params[0] || 1);
        break;
      case "r":
        this.#setScrollRegion(params);
        break;
      case "q":
        if (sequence.intermediates === " ") this.#applyCursorStyle(params[0] ?? 0);
        break;
      case "s":
      case "7":
        this.#saveCursor();
        break;
      case "u":
      case "8":
        this.#restoreCursor();
        break;
    }
  }

  #applyOsc(payload: string): void {
    const separator = payload.indexOf(";");
    if (separator < 0) return;
    const code = payload.slice(0, separator);
    if (code === "0" || code === "2") {
      this.#title = payload.slice(separator + 1);
      return;
    }
    if (code === "8") this.#applyHyperlink(payload.slice(separator + 1));
  }

  #applyHyperlink(payload: string): void {
    const separator = payload.indexOf(";");
    if (separator < 0) return;
    const uri = payload.slice(separator + 1);
    this.#hyperlink = uri || undefined;
  }

  #styledCell(char: string): TerminalScreenCell {
    const cell: TerminalScreenCell = { char, ...this.#style };
    if (this.#hyperlink) cell.hyperlink = this.#hyperlink;
    return cell;
  }

  #applyPrivateModes(params: number[], enabled: boolean): void {
    for (const mode of params) {
      if (mode === 25) this.#cursorVisible = enabled;
      else {
        if (enabled) this.#privateModes.add(mode);
        else this.#privateModes.delete(mode);
        if (mode === 6) {
          this.#originMode = enabled;
          this.#state.cursor = {
            column: 0,
            row: enabled ? this.#scrollRegion.top : 0,
          };
        }
        if (mode === 7) this.#autoWrap = enabled;
        if (mode === 47 || mode === 1047) enabled ? this.#enterAlternate() : this.#exitAlternate();
        if (mode === 1048) enabled ? this.#saveCursor() : this.#restoreCursor();
        if (mode === 1049) {
          if (enabled) {
            this.#saveCursor();
            this.#enterAlternate();
          } else {
            this.#exitAlternate();
            this.#restoreCursor();
          }
        }
      }
    }
  }

  #applyModes(params: number[], enabled: boolean): void {
    for (const mode of params) {
      if (mode === 4) this.#insertMode = enabled;
    }
  }

  #setCursorPosition(row: number, column: number): void {
    const nextColumn = clamp(column - 1, 0, this.#columns - 1);
    if (!this.#originMode) {
      this.#state.cursor = {
        column: nextColumn,
        row: clamp(row - 1, 0, this.#rows - 1),
      };
      return;
    }
    this.#state.cursor = {
      column: nextColumn,
      row: clamp(this.#scrollRegion.top + row - 1, this.#scrollRegion.top, this.#scrollRegion.bottom),
    };
  }

  #setTabStop(): void {
    this.#tabStops.add(this.#state.cursor.column);
  }

  #saveCursor(): void {
    this.#savedCursor = { ...this.#state.cursor };
  }

  #restoreCursor(): void {
    if (!this.#savedCursor) return;
    this.#state.cursor = {
      column: clamp(this.#savedCursor.column, 0, this.#columns - 1),
      row: clamp(this.#savedCursor.row, 0, this.#rows - 1),
    };
  }

  #clearTabStops(mode: number): void {
    if (mode === 3) {
      this.#tabStops.clear();
      return;
    }
    if (mode === 0) this.#tabStops.delete(this.#state.cursor.column);
  }

  #cursorForwardTabs(count: number): void {
    const amount = Math.max(1, Math.floor(count));
    for (let index = 0; index < amount; index += 1) {
      this.#state.cursor.column = nextTabStop(this.#tabStops, this.#state.cursor.column, this.#columns);
    }
  }

  #cursorBackwardTabs(count: number): void {
    const amount = Math.max(1, Math.floor(count));
    for (let index = 0; index < amount; index += 1) {
      this.#state.cursor.column = previousTabStop(this.#tabStops, this.#state.cursor.column);
    }
  }

  #repeatLastPrintable(count: number): void {
    if (!this.#lastPrintableCell) return;
    const amount = Math.max(1, Math.floor(count));
    for (let index = 0; index < amount; index += 1) {
      this.#writeCell({ ...this.#lastPrintableCell });
      for (let width = 1; width < this.#lastPrintableWidth; width += 1) {
        this.#writeCell(BLANK_CELL);
      }
    }
  }

  #applyCursorStyle(style: number): void {
    switch (style) {
      case 3:
        this.#cursorStyle = { shape: "underline", blinking: true };
        break;
      case 4:
        this.#cursorStyle = { shape: "underline", blinking: false };
        break;
      case 5:
        this.#cursorStyle = { shape: "bar", blinking: true };
        break;
      case 6:
        this.#cursorStyle = { shape: "bar", blinking: false };
        break;
      case 2:
        this.#cursorStyle = { shape: "block", blinking: false };
        break;
      case 0:
      case 1:
      default:
        this.#cursorStyle = { shape: "block", blinking: true };
        break;
    }
  }

  #applySgr(params: number[]): void {
    const values = params.length === 0 ? [0] : params;
    for (let index = 0; index < values.length; index += 1) {
      const value = values[index]!;
      if (value === 0) this.#style = {};
      else if (value === 1) this.#style.bold = true;
      else if (value === 22) this.#style.bold = false;
      else if (value >= 30 && value <= 37) this.#style.foreground = value;
      else if (value >= 90 && value <= 97) this.#style.foreground = value;
      else if (value === 39) delete this.#style.foreground;
      else if (value >= 40 && value <= 47) this.#style.background = value;
      else if (value >= 100 && value <= 107) this.#style.background = value;
      else if (value === 49) delete this.#style.background;
      else if (value === 38 || value === 48) {
        const parsed = parseExtendedSgrColor(values, index);
        if (parsed) {
          if (value === 38) this.#style.foreground = parsed.color;
          else this.#style.background = parsed.color;
          index = parsed.nextIndex;
        }
      }
    }
  }

  #eraseDisplay(mode: number): void {
    if (mode === 2 || mode === 3) {
      this.clear();
      return;
    }
    if (mode === 1) {
      for (let row = 0; row <= this.#state.cursor.row; row += 1) {
        const end = row === this.#state.cursor.row ? this.#state.cursor.column + 1 : this.#columns;
        fillBlankCells(this.#state.cells[row]!, 0, end);
      }
      return;
    }
    for (let row = this.#state.cursor.row; row < this.#rows; row += 1) {
      const start = row === this.#state.cursor.row ? this.#state.cursor.column : 0;
      fillBlankCells(this.#state.cells[row]!, start, this.#columns - start);
    }
  }

  #eraseLine(mode: number): void {
    const row = this.#state.cells[this.#state.cursor.row]!;
    const start = mode === 1 || mode === 2 ? 0 : this.#state.cursor.column;
    const end = mode === 1 ? this.#state.cursor.column + 1 : this.#columns;
    fillBlankCells(row, start, end - start);
  }

  #insertCharacters(count: number): void {
    const row = this.#state.cells[this.#state.cursor.row]!;
    const column = this.#state.cursor.column;
    const amount = clamp(Math.floor(count), 1, this.#columns - column);
    shiftCellsRight(row, column, amount, this.#columns);
  }

  #deleteCharacters(count: number): void {
    const row = this.#state.cells[this.#state.cursor.row]!;
    const column = this.#state.cursor.column;
    const amount = clamp(Math.floor(count), 1, this.#columns - column);
    shiftCellsLeft(row, column, amount, this.#columns);
  }

  #eraseCharacters(count: number): void {
    const row = this.#state.cells[this.#state.cursor.row]!;
    const column = this.#state.cursor.column;
    const amount = clamp(Math.floor(count), 1, this.#columns - column);
    fillBlankCells(row, column, amount);
  }

  #insertLines(count: number): void {
    const row = this.#state.cursor.row;
    if (row < this.#scrollRegion.top || row > this.#scrollRegion.bottom) return;
    const amount = clamp(Math.floor(count), 1, this.#scrollRegion.bottom - row + 1);
    for (let index = 0; index < amount; index += 1) {
      this.#state.cells.splice(row, 0, blankRow(this.#columns));
      this.#state.cells.splice(this.#scrollRegion.bottom + 1, 1);
    }
  }

  #deleteLines(count: number): void {
    const row = this.#state.cursor.row;
    if (row < this.#scrollRegion.top || row > this.#scrollRegion.bottom) return;
    const amount = clamp(Math.floor(count), 1, this.#scrollRegion.bottom - row + 1);
    for (let index = 0; index < amount; index += 1) {
      this.#state.cells.splice(row, 1);
      this.#state.cells.splice(this.#scrollRegion.bottom, 0, blankRow(this.#columns));
    }
  }

  #setScrollRegion(params: number[]): void {
    if (params.length === 0) {
      this.#scrollRegion = fullScrollRegion(this.#rows);
      this.#state.cursor = { column: 0, row: 0 };
      return;
    }
    const top = clamp((params[0] || 1) - 1, 0, this.#rows - 1);
    const bottom = clamp((params[1] || this.#rows) - 1, 0, this.#rows - 1);
    if (bottom <= top) {
      this.#scrollRegion = fullScrollRegion(this.#rows);
      this.#state.cursor = { column: 0, row: 0 };
      return;
    }
    this.#scrollRegion = { top, bottom };
    this.#state.cursor = { column: 0, row: 0 };
  }

  #scrollRegionUp(top: number, bottom: number, count: number): void {
    const amount = clamp(Math.floor(count), 1, bottom - top + 1);
    for (let index = 0; index < amount; index += 1) {
      const shifted = this.#state.cells.splice(top, 1)[0] ?? blankRow(this.#columns);
      if (top === 0 && bottom === this.#rows - 1 && !this.alternate) {
        this.#scrollback.push(shifted);
        if (this.#scrollback.length > this.#scrollbackLimit) this.#scrollback.shift();
      }
      this.#state.cells.splice(bottom, 0, blankRow(this.#columns));
    }
  }

  #scrollRegionDown(top: number, bottom: number, count: number): void {
    const amount = clamp(Math.floor(count), 1, bottom - top + 1);
    for (let index = 0; index < amount; index += 1) {
      this.#state.cells.splice(bottom, 1);
      this.#state.cells.splice(top, 0, blankRow(this.#columns));
    }
  }

  #reverseIndex(): void {
    if (this.#state.cursor.row === this.#scrollRegion.top) {
      this.#scrollRegionDown(this.#scrollRegion.top, this.#scrollRegion.bottom, 1);
      return;
    }
    this.#state.cursor.row = Math.max(0, this.#state.cursor.row - 1);
  }

  #reset(): void {
    this.#mainState = undefined;
    this.#scrollback = [];
    this.#style = {};
    this.#savedCursor = undefined;
    this.#title = undefined;
    this.#hyperlink = undefined;
    this.#cursorVisible = true;
    this.#cursorStyle = { shape: "block", blinking: true };
    this.#privateModes.clear();
    this.#originMode = false;
    this.#autoWrap = true;
    this.#insertMode = false;
    this.#lastPrintableCell = undefined;
    this.#lastPrintableWidth = 1;
    this.clear();
  }

  #enterAlternate(): void {
    if (this.#mainState) return;
    this.#mainState = cloneState(this.#state);
    this.#state = { cells: createRows(this.#columns, this.#rows), cursor: { column: 0, row: 0 } };
    this.#scrollRegion = fullScrollRegion(this.#rows);
  }

  #exitAlternate(): void {
    if (!this.#mainState) return;
    this.#state = this.#mainState;
    this.#mainState = undefined;
    this.#scrollRegion = fullScrollRegion(this.#rows);
    this.#originMode = false;
  }
}

interface TerminalScreenScrollRegion {
  top: number;
  bottom: number;
}

function parseExtendedSgrColor(
  values: readonly number[],
  index: number,
): { color: number; nextIndex: number } | undefined {
  const mode = values[index + 1];
  if (mode === 5) {
    const color = values[index + 2];
    if (color === undefined) return undefined;
    return { color: clampByte(color), nextIndex: index + 2 };
  }
  if (mode === 2) {
    const red = values[index + 2];
    const green = values[index + 3];
    const blue = values[index + 4];
    if (red === undefined || green === undefined || blue === undefined) return undefined;
    return {
      color: (clampByte(red) << 16) | (clampByte(green) << 8) | clampByte(blue),
      nextIndex: index + 4,
    };
  }
  return undefined;
}

function sortedPrivateModes(modes: ReadonlySet<number>): number[] {
  const sorted: number[] = [];
  for (const mode of modes) {
    let insertAt = sorted.length;
    while (insertAt > 0 && sorted[insertAt - 1]! > mode) insertAt -= 1;
    sorted.splice(insertAt, 0, mode);
  }
  return sorted;
}

function createRows(columns: number, rows: number): TerminalScreenCell[][] {
  const output = new Array<TerminalScreenCell[]>(rows);
  for (let row = 0; row < rows; row += 1) {
    output[row] = blankRow(columns);
  }
  return output;
}

function blankRow(columns: number): TerminalScreenCell[] {
  return new Array<TerminalScreenCell>(columns).fill(BLANK_CELL);
}

function readTerminalGraphic(text: string, index: number): string {
  const code = text.charCodeAt(index);
  if (code < 0x80) return text[index] ?? "";

  UNICODE_CHAR_REGEXP.lastIndex = index;
  const match = UNICODE_CHAR_REGEXP.exec(text);
  if (match?.index === index) return match[0];

  const codePoint = text.codePointAt(index);
  return codePoint === undefined ? text[index] ?? "" : String.fromCodePoint(codePoint);
}

function terminalGraphicWidth(char: string): number {
  return Math.max(1, Math.min(2, textWidth(char)));
}

function fillBlankCells(row: TerminalScreenCell[], start: number, count: number): void {
  const end = Math.min(row.length, start + Math.max(0, count));
  for (let column = Math.max(0, start); column < end; column += 1) {
    row[column] = BLANK_CELL;
  }
}

function shiftCellsRight(row: TerminalScreenCell[], start: number, amount: number, columns: number): void {
  const shift = Math.max(0, amount);
  if (shift === 0) return;
  for (let column = columns - 1; column >= start + shift; column -= 1) {
    row[column] = row[column - shift] ?? BLANK_CELL;
  }
  fillBlankCells(row, start, Math.min(shift, columns - start));
}

function shiftCellsLeft(row: TerminalScreenCell[], start: number, amount: number, columns: number): void {
  const shift = Math.max(0, amount);
  if (shift === 0) return;
  const fillStart = Math.max(start, columns - shift);
  for (let column = start; column < columns - shift; column += 1) {
    row[column] = row[column + shift] ?? BLANK_CELL;
  }
  fillBlankCells(row, fillStart, columns - fillStart);
}

function terminalCellRowsToText(rows: readonly TerminalScreenCell[][]): string[] {
  const output = new Array<string>(rows.length);
  for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
    const row = rows[rowIndex]!;
    let lastContentColumn = -1;
    for (let column = row.length - 1; column >= 0; column--) {
      if ((row[column]?.char ?? " ") !== " ") {
        lastContentColumn = column;
        break;
      }
    }
    const chars = new Array<string>(lastContentColumn + 1);
    for (let column = 0; column <= lastContentColumn; column++) {
      chars[column] = row[column]?.char ?? " ";
    }
    output[rowIndex] = chars.join("");
  }
  return output;
}

function cloneTerminalCellRows(rows: readonly TerminalScreenCell[][]): TerminalScreenCell[][] {
  const output = new Array<TerminalScreenCell[]>(rows.length);
  for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
    const row = rows[rowIndex]!;
    const cloned = new Array<TerminalScreenCell>(row.length);
    for (let column = 0; column < row.length; column++) {
      cloned[column] = { ...row[column]! };
    }
    output[rowIndex] = cloned;
  }
  return output;
}

function fullScrollRegion(rows: number): TerminalScreenScrollRegion {
  return { top: 0, bottom: rows - 1 };
}

function defaultTabStops(columns: number): Set<number> {
  const stops = new Set<number>();
  for (let column = 8; column < columns; column += 8) stops.add(column);
  return stops;
}

function resizeTabStops(stops: Set<number>, columns: number): Set<number> {
  const resized = new Set<number>();
  for (const stop of stops) {
    if (stop > 0 && stop < columns) resized.add(stop);
  }
  for (let column = 8; column < columns; column += 8) {
    if (stops.has(column)) resized.add(column);
  }
  return resized;
}

function nextTabStop(stops: Set<number>, column: number, columns: number): number {
  let next = columns - 1;
  for (const stop of stops) {
    if (stop > column && stop < next) next = stop;
  }
  return next;
}

function previousTabStop(stops: Set<number>, column: number): number {
  let previous = 0;
  for (const stop of stops) {
    if (stop < column && stop > previous) previous = stop;
  }
  return previous;
}

function resizeState(state: TerminalScreenState, columns: number, rows: number): TerminalScreenState {
  const cells = createRows(columns, rows);
  for (let row = 0; row < Math.min(rows, state.cells.length); row += 1) {
    for (let column = 0; column < Math.min(columns, state.cells[row]!.length); column += 1) {
      cells[row]![column] = { ...state.cells[row]![column]! };
    }
  }
  return {
    cells,
    cursor: {
      column: clamp(state.cursor.column, 0, columns - 1),
      row: clamp(state.cursor.row, 0, rows - 1),
    },
  };
}

function cloneState(state: TerminalScreenState): TerminalScreenState {
  return {
    cells: cloneTerminalCellRows(state.cells),
    cursor: { ...state.cursor },
  };
}

function normalizeDimension(value: number | undefined, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(1, Math.floor(value!));
}

function clampByte(value: number): number {
  return clamp(Math.floor(value), 0, 255);
}
