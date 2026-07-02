// Copyright 2023 Im-Beast. MIT license.
import type { TerminalScreenController } from "./terminal_screen.ts";

/** Terminal scrollback interaction mode. */
export type TerminalScrollbackMode = "live" | "copy";

/** Line range selected in terminal copy mode. */
export interface TerminalScrollbackSelection {
  anchor: number;
  focus: number;
}

/** Options for constructing a terminal scrollback controller. */
export interface TerminalScrollbackControllerOptions {
  screen: TerminalScreenController;
  viewportRows?: number;
  mode?: TerminalScrollbackMode;
  offset?: number;
  query?: string;
  selection?: TerminalScrollbackSelection;
}

/** Serializable terminal scrollback/copy-mode inspection. */
export interface TerminalScrollbackInspection {
  mode: TerminalScrollbackMode;
  offset: number;
  maxOffset: number;
  viewportRows: number;
  totalRows: number;
  scrollbackRows: number;
  liveRows: number;
  visibleRows: string[];
  query?: string;
  matches: number[];
  activeMatch?: number;
  selection?: TerminalScrollbackSelection;
  selectedText?: string;
}

/** Renderer-neutral scrollback and copy-mode controller for terminal screen models. */
export class TerminalScrollbackController {
  readonly screen: TerminalScreenController;
  #viewportRows: number;
  #mode: TerminalScrollbackMode;
  #offset: number;
  #query?: string;
  #matches: number[] = [];
  #activeMatch = -1;
  #selection?: TerminalScrollbackSelection;

  constructor(options: TerminalScrollbackControllerOptions) {
    this.screen = options.screen;
    this.#viewportRows = normalizePositiveInteger(options.viewportRows, this.screen.rows);
    this.#mode = options.mode ?? "live";
    this.#offset = Math.max(0, Math.floor(options.offset ?? this.#maxOffset()));
    this.#query = normalizeQuery(options.query);
    this.#selection = normalizeSelection(options.selection, this.#rows().length);
    this.#refreshSearch();
    this.#clampOffset();
  }

  get mode(): TerminalScrollbackMode {
    return this.#mode;
  }

  get offset(): number {
    return this.#mode === "live" ? this.#maxOffset() : this.#offset;
  }

  enterCopyMode(): void {
    if (this.#mode === "copy") return;
    this.#mode = "copy";
    this.#offset = this.#maxOffset();
  }

  exitCopyMode(): void {
    this.#mode = "live";
    this.#selection = undefined;
    this.#clampOffset();
  }

  toggleCopyMode(): TerminalScrollbackMode {
    if (this.#mode === "copy") this.exitCopyMode();
    else this.enterCopyMode();
    return this.#mode;
  }

  setViewportRows(rows: number): void {
    this.#viewportRows = normalizePositiveInteger(rows, this.#viewportRows);
    this.#clampOffset();
  }

  scrollLines(delta: number): number {
    if (this.#mode !== "copy") this.enterCopyMode();
    this.#offset = clamp(this.#offset + Math.trunc(delta), 0, this.#maxOffset());
    return this.#offset;
  }

  page(delta: number): number {
    return this.scrollLines(Math.trunc(delta) * this.#viewportRows);
  }

  toTop(): number {
    if (this.#mode !== "copy") this.enterCopyMode();
    this.#offset = 0;
    return this.#offset;
  }

  toBottom(): number {
    if (this.#mode !== "copy") this.enterCopyMode();
    this.#offset = this.#maxOffset();
    return this.#offset;
  }

  search(query: string | undefined): number[] {
    this.#query = normalizeQuery(query);
    this.#refreshSearch();
    if (this.#matches.length > 0) {
      this.enterCopyMode();
      this.#activeMatch = 0;
      this.#offset = clamp(this.#matches[0]!, 0, this.#maxOffset());
    }
    return cloneNumberArray(this.#matches);
  }

  nextMatch(delta = 1): number | undefined {
    if (this.#matches.length === 0) return undefined;
    this.enterCopyMode();
    this.#activeMatch = (this.#activeMatch + Math.trunc(delta) + this.#matches.length) % this.#matches.length;
    const row = this.#matches[this.#activeMatch]!;
    this.#offset = clamp(row, 0, this.#maxOffset());
    return row;
  }

  setSelection(anchor: number, focus = anchor): TerminalScrollbackSelection | undefined {
    const rows = this.#rows();
    this.#selection = normalizeSelection({ anchor, focus }, rows.length);
    if (this.#selection) {
      this.enterCopyMode();
      this.#offset = clamp(Math.min(this.#selection.anchor, this.#selection.focus), 0, this.#maxOffset());
    }
    return this.#selection ? { ...this.#selection } : undefined;
  }

  clearSelection(): void {
    this.#selection = undefined;
  }

  copySelection(): string {
    const rows = this.#rows();
    return selectedRowsText(rows, this.#selection);
  }

  inspect(): TerminalScrollbackInspection {
    this.#refreshSearch();
    this.#clampOffset();
    const rows = this.#rows();
    const offset = this.offset;
    const selection = this.#selection ? { ...this.#selection } : undefined;
    const inspection: TerminalScrollbackInspection = {
      mode: this.#mode,
      offset,
      maxOffset: this.#maxOffset(rows.length),
      viewportRows: this.#viewportRows,
      totalRows: rows.length,
      scrollbackRows: this.screen.inspect().scrollbackRows,
      liveRows: this.screen.rows,
      visibleRows: visibleRows(rows, offset, this.#viewportRows),
      matches: cloneNumberArray(this.#matches),
    };
    if (this.#query) inspection.query = this.#query;
    if (this.#activeMatch >= 0) inspection.activeMatch = this.#activeMatch;
    if (selection) {
      inspection.selection = selection;
      inspection.selectedText = selectedRowsText(rows, selection);
    }
    return inspection;
  }

  #rows(): string[] {
    const scrollbackRows = this.screen.scrollbackTextRows();
    const liveRows = this.screen.textRows();
    const rows = new Array<string>(scrollbackRows.length + liveRows.length);
    let write = 0;
    for (let index = 0; index < scrollbackRows.length; index += 1) rows[write++] = scrollbackRows[index]!;
    for (let index = 0; index < liveRows.length; index += 1) rows[write++] = liveRows[index]!;
    return rows;
  }

  #maxOffset(rowCount = this.#rows().length): number {
    return Math.max(0, rowCount - this.#viewportRows);
  }

  #clampOffset(): void {
    this.#offset = this.#mode === "live" ? this.#maxOffset() : clamp(this.#offset, 0, this.#maxOffset());
  }

  #refreshSearch(): void {
    const query = this.#query;
    if (!query) {
      this.#matches = [];
    } else {
      const rows = this.#rows();
      const matches: number[] = [];
      for (let index = 0; index < rows.length; index += 1) {
        if (rows[index]!.toLowerCase().includes(query)) matches.push(index);
      }
      this.#matches = matches;
    }
    if (this.#matches.length === 0) this.#activeMatch = -1;
    else this.#activeMatch = clamp(this.#activeMatch, 0, this.#matches.length - 1);
  }
}

function normalizePositiveInteger(value: number | undefined, fallback: number): number {
  if (!Number.isFinite(value)) return Math.max(1, Math.floor(fallback));
  return Math.max(1, Math.floor(value!));
}

function normalizeQuery(query: string | undefined): string | undefined {
  const trimmed = query?.trim().toLowerCase();
  return trimmed ? trimmed : undefined;
}

function normalizeSelection(
  selection: TerminalScrollbackSelection | undefined,
  rowCount: number,
): TerminalScrollbackSelection | undefined {
  if (!selection || rowCount <= 0) return undefined;
  return {
    anchor: clamp(Math.trunc(selection.anchor), 0, rowCount - 1),
    focus: clamp(Math.trunc(selection.focus), 0, rowCount - 1),
  };
}

function selectedRowsText(rows: readonly string[], selection: TerminalScrollbackSelection | undefined): string {
  if (!selection) return "";
  const start = Math.min(selection.anchor, selection.focus);
  const end = Math.max(selection.anchor, selection.focus);
  let text = "";
  for (let index = start; index <= end; index += 1) {
    if (index > start) text += "\n";
    text += rows[index] ?? "";
  }
  return text;
}

function visibleRows(rows: readonly string[], offset: number, viewportRows: number): string[] {
  const end = Math.min(rows.length, offset + viewportRows);
  const visible: string[] = [];
  for (let index = offset; index < end; index += 1) visible.push(rows[index]!);
  return visible;
}

function cloneNumberArray(values: readonly number[]): number[] {
  const cloned = new Array<number>(values.length);
  for (let index = 0; index < values.length; index += 1) cloned[index] = values[index]!;
  return cloned;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
