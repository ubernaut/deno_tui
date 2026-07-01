// Copyright 2023 Im-Beast. MIT license.

/** Styled terminal cell tracked by TerminalScreenController. */
export interface TerminalScreenCell {
  char: string;
  bold?: boolean;
  foreground?: number;
  background?: number;
}

/** Cursor position inside a terminal screen model. */
export interface TerminalScreenCursor {
  column: number;
  row: number;
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

  constructor(options: TerminalScreenControllerOptions = {}) {
    this.#columns = normalizeDimension(options.columns, DEFAULT_COLUMNS);
    this.#rows = normalizeDimension(options.rows, DEFAULT_ROWS);
    this.#scrollbackLimit = Math.max(0, Math.floor(options.scrollbackLimit ?? DEFAULT_SCROLLBACK_LIMIT));
    this.#state = {
      cells: createRows(this.#columns, this.#rows),
      cursor: { column: 0, row: 0 },
    };
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
    const text = typeof data === "string" ? data : new TextDecoder().decode(data);
    for (let index = 0; index < text.length;) {
      const char = text[index]!;
      if (char === "\x1b") {
        const parsed = parseControlSequence(text.slice(index));
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
  }

  clear(): void {
    this.#state.cells = createRows(this.#columns, this.#rows);
    this.#state.cursor = { column: 0, row: 0 };
  }

  textRows(): string[] {
    return this.#state.cells.map((row) => row.map((cell) => cell.char).join("").trimEnd());
  }

  cellRows(): TerminalScreenCell[][] {
    return this.#state.cells.map((row) => row.map((cell) => ({ ...cell })));
  }

  scrollbackTextRows(): string[] {
    return this.#scrollback.map((row) => row.map((cell) => cell.char).join("").trimEnd());
  }

  inspect(): TerminalScreenInspection {
    return {
      columns: this.#columns,
      rows: this.#rows,
      cursor: this.cursor,
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
      const next = Math.min(this.#columns - 1, this.#state.cursor.column + (8 - this.#state.cursor.column % 8));
      this.#state.cursor.column = next;
      return;
    }
    if (char < " ") return;

    const row = this.#state.cells[this.#state.cursor.row]!;
    row[this.#state.cursor.column] = { char, ...this.#style };
    if (this.#state.cursor.column >= this.#columns - 1) {
      this.#state.cursor.column = 0;
      this.#newline();
    } else {
      this.#state.cursor.column += 1;
    }
  }

  #newline(): void {
    this.#state.cursor.column = 0;
    this.#state.cursor.row += 1;
    if (this.#state.cursor.row < this.#rows) return;
    const shifted = this.#state.cells.shift() ?? blankRow(this.#columns);
    if (!this.alternate) {
      this.#scrollback.push(shifted);
      if (this.#scrollback.length > this.#scrollbackLimit) this.#scrollback.shift();
    }
    this.#state.cells.push(blankRow(this.#columns));
    this.#state.cursor.row = this.#rows - 1;
  }

  #applyControl(sequence: ParsedControlSequence): void {
    if (sequence.kind === "osc") {
      this.#applyOsc(sequence.params);
      return;
    }
    const params = parseParams(sequence.params);
    if (sequence.private && (sequence.command === "h" || sequence.command === "l")) {
      if (params.includes(1049)) sequence.command === "h" ? this.#enterAlternate() : this.#exitAlternate();
      return;
    }
    switch (sequence.command) {
      case "m":
        this.#applySgr(params);
        break;
      case "H":
      case "f":
        this.#state.cursor.row = clamp((params[0] ?? 1) - 1, 0, this.#rows - 1);
        this.#state.cursor.column = clamp((params[1] ?? 1) - 1, 0, this.#columns - 1);
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
      case "D":
        this.#state.cursor.column = clamp(this.#state.cursor.column - (params[0] || 1), 0, this.#columns - 1);
        break;
      case "J":
        this.#eraseDisplay(params[0] ?? 0);
        break;
      case "K":
        this.#eraseLine(params[0] ?? 0);
        break;
      case "s":
      case "7":
        this.#savedCursor = { ...this.#state.cursor };
        break;
      case "u":
      case "8":
        if (this.#savedCursor) {
          this.#state.cursor = {
            column: clamp(this.#savedCursor.column, 0, this.#columns - 1),
            row: clamp(this.#savedCursor.row, 0, this.#rows - 1),
          };
        }
        break;
    }
  }

  #applyOsc(payload: string): void {
    const separator = payload.indexOf(";");
    if (separator < 0) return;
    const code = payload.slice(0, separator);
    if (code !== "0" && code !== "2") return;
    this.#title = payload.slice(separator + 1);
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
    for (let row = this.#state.cursor.row; row < this.#rows; row += 1) {
      const start = row === this.#state.cursor.row ? this.#state.cursor.column : 0;
      this.#state.cells[row]!.splice(start, this.#columns - start, ...blankRow(this.#columns - start));
    }
  }

  #eraseLine(mode: number): void {
    const row = this.#state.cells[this.#state.cursor.row]!;
    const start = mode === 1 ? 0 : this.#state.cursor.column;
    const end = mode === 1 ? this.#state.cursor.column + 1 : this.#columns;
    row.splice(start, end - start, ...blankRow(end - start));
  }

  #enterAlternate(): void {
    if (this.#mainState) return;
    this.#mainState = cloneState(this.#state);
    this.#state = { cells: createRows(this.#columns, this.#rows), cursor: { column: 0, row: 0 } };
  }

  #exitAlternate(): void {
    if (!this.#mainState) return;
    this.#state = this.#mainState;
    this.#mainState = undefined;
  }
}

interface ParsedControlSequence {
  kind: "csi" | "osc";
  private: boolean;
  params: string;
  command: string;
  length: number;
}

function parseControlSequence(value: string): ParsedControlSequence | undefined {
  const osc = parseOscSequence(value);
  if (osc) return osc;
  if (value.startsWith("\x1b7") || value.startsWith("\x1b8")) {
    return {
      kind: "csi",
      private: false,
      params: "",
      command: value[1]!,
      length: 2,
    };
  }
  // deno-lint-ignore no-control-regex -- terminal parser intentionally matches ESC.
  const match = /^\x1b\[([?]?)([0-9;]*)([A-Za-z])/.exec(value);
  if (!match) return undefined;
  return {
    kind: "csi",
    private: match[1] === "?",
    params: match[2] ?? "",
    command: match[3]!,
    length: match[0].length,
  };
}

function parseOscSequence(value: string): ParsedControlSequence | undefined {
  if (!value.startsWith("\x1b]")) return undefined;
  const belEnd = value.indexOf("\x07", 2);
  const stEnd = value.indexOf("\x1b\\", 2);
  const end = belEnd >= 0 && stEnd >= 0 ? Math.min(belEnd, stEnd) : belEnd >= 0 ? belEnd : stEnd;
  if (end < 0) return undefined;
  return {
    kind: "osc",
    private: false,
    params: value.slice(2, end),
    command: "]",
    length: end + (end === stEnd ? 2 : 1),
  };
}

function parseParams(params: string): number[] {
  if (!params) return [];
  return params.split(";").map((value) => Number.parseInt(value || "0", 10)).filter(Number.isFinite);
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

function createRows(columns: number, rows: number): TerminalScreenCell[][] {
  return Array.from({ length: rows }, () => blankRow(columns));
}

function blankRow(columns: number): TerminalScreenCell[] {
  return Array.from({ length: columns }, () => ({ char: " " }));
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
    cells: state.cells.map((row) => row.map((cell) => ({ ...cell }))),
    cursor: { ...state.cursor },
  };
}

function normalizeDimension(value: number | undefined, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(1, Math.floor(value!));
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function clampByte(value: number): number {
  return clamp(Math.floor(value), 0, 255);
}
