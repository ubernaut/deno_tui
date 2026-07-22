// Copyright 2023 Im-Beast. MIT license.
import type { TerminalScreenController } from "./terminal_screen.ts";
import { clamp } from "../utils/numbers.ts";

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

/** Allocation-light viewport state for render and input hot paths. */
export interface TerminalScrollbackViewportInspection {
  mode: TerminalScrollbackMode;
  offset: number;
  maxOffset: number;
  viewportRows: number;
  totalRows: number;
  scrollbackRows: number;
  liveRows: number;
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
    this.#selection = normalizeSelection(options.selection, this.#rowCount());
    this.#refreshSearch();
    this.#clampOffset();
  }

  get mode(): TerminalScrollbackMode {
    this.#enforceLiveWhileAlternate();
    return this.#mode;
  }

  get offset(): number {
    this.#enforceLiveWhileAlternate();
    return this.#mode === "live" ? this.#maxOffset() : this.#offset;
  }

  enterCopyMode(): void {
    // The alternate screen has no scrollback of its own, and the main buffer's
    // history belongs to a different screen. Full-screen apps (tmux, vim, less)
    // own their viewport, so copy mode stays disabled while they are attached.
    if (this.#enforceLiveWhileAlternate()) return;
    if (this.#mode === "copy") return;
    this.#mode = "copy";
    this.#offset = this.#maxOffset();
  }

  /**
   * Snaps back to live mode whenever the alternate screen is active so a copy
   * mode entered before a full-screen app started cannot survive into it and
   * paint stale main-buffer history over the app.
   */
  #enforceLiveWhileAlternate(): boolean {
    if (!this.screen.alternate) return false;
    if (this.#mode !== "live") {
      this.#mode = "live";
      this.#offset = this.#maxOffset();
    }
    this.#selection = undefined;
    return true;
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
    if (this.#enforceLiveWhileAlternate()) return this.offset;
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
    return Array.from(this.#matches);
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
    const rowCount = this.#rowCount();
    this.#selection = normalizeSelection({ anchor, focus }, rowCount);
    if (this.#selection) {
      this.enterCopyMode();
      this.#offset = clamp(Math.min(this.#selection.anchor, this.#selection.focus), 0, this.#maxOffset());
    }
    return this.#selection ? { ...this.#selection } : undefined;
  }

  selectVisibleRow(row: number, extend = false): TerminalScrollbackSelection | undefined {
    const rowCount = this.#rowCount();
    if (rowCount === 0) return undefined;
    const focus = clamp(this.offset + Math.trunc(row), 0, rowCount - 1);
    const anchor = extend && this.#selection ? this.#selection.anchor : focus;
    return this.#setSelectionAndReveal(anchor, focus, rowCount);
  }

  moveSelection(delta: number, extend = true): TerminalScrollbackSelection | undefined {
    const rowCount = this.#rowCount();
    if (rowCount === 0) return undefined;
    const current = this.#selection?.focus ?? this.offset;
    const focus = clamp(current + Math.trunc(delta), 0, rowCount - 1);
    const anchor = extend ? this.#selection?.anchor ?? current : focus;
    return this.#setSelectionAndReveal(anchor, focus, rowCount);
  }

  clearSelection(): void {
    this.#selection = undefined;
  }

  copySelection(): string {
    const rows = this.#rows();
    return selectedRowsText(rows, this.#selection);
  }

  inspect(): TerminalScrollbackInspection {
    const rows = this.#rows();
    this.#refreshSearch(rows);
    const viewport = this.#viewportInspection(rows.length);
    const selection = this.#selection ? { ...this.#selection } : undefined;
    const inspection: TerminalScrollbackInspection = {
      ...viewport,
      visibleRows: visibleRows(rows, viewport.offset, viewport.viewportRows),
      matches: Array.from(this.#matches),
    };
    if (this.#query) inspection.query = this.#query;
    if (this.#activeMatch >= 0) inspection.activeMatch = this.#activeMatch;
    if (selection) {
      inspection.selection = selection;
      inspection.selectedText = selectedRowsText(rows, selection);
    }
    return inspection;
  }

  /** Returns viewport metrics without cloning or converting terminal rows. */
  inspectViewport(): TerminalScrollbackViewportInspection {
    return this.#viewportInspection(this.#rowCount());
  }

  #viewportInspection(totalRows: number): TerminalScrollbackViewportInspection {
    this.#clampOffset(totalRows);
    const maxOffset = this.#maxOffset(totalRows);
    return {
      mode: this.#mode,
      offset: this.#mode === "live" ? maxOffset : this.#offset,
      maxOffset,
      viewportRows: this.#viewportRows,
      totalRows,
      scrollbackRows: this.screen.scrollbackRows,
      liveRows: this.screen.rows,
    };
  }

  #rows(): string[] {
    // While the alternate screen is active only its live rows exist; the main
    // buffer's scrollback belongs to the screen underneath it.
    if (this.screen.alternate) return this.screen.textRows();
    const scrollbackRows = this.screen.scrollbackTextRows();
    const liveRows = this.screen.textRows();
    const rows = new Array<string>(scrollbackRows.length + liveRows.length);
    let write = 0;
    for (let index = 0; index < scrollbackRows.length; index += 1) rows[write++] = scrollbackRows[index]!;
    for (let index = 0; index < liveRows.length; index += 1) rows[write++] = liveRows[index]!;
    return rows;
  }

  #maxOffset(rowCount = this.#rowCount()): number {
    return Math.max(0, rowCount - this.#viewportRows);
  }

  #rowCount(): number {
    if (this.screen.alternate) return this.screen.rows;
    return this.screen.scrollbackRows + this.screen.rows;
  }

  #clampOffset(rowCount = this.#rowCount()): void {
    const maxOffset = this.#maxOffset(rowCount);
    this.#offset = this.#mode === "live" ? maxOffset : clamp(this.#offset, 0, maxOffset);
  }

  #refreshSearch(rowSnapshot?: readonly string[]): void {
    const query = this.#query;
    if (!query) {
      this.#matches = [];
    } else {
      const rows = rowSnapshot ?? this.#rows();
      const matches: number[] = [];
      for (let index = 0; index < rows.length; index += 1) {
        if (rows[index]!.toLowerCase().includes(query)) matches.push(index);
      }
      this.#matches = matches;
    }
    if (this.#matches.length === 0) this.#activeMatch = -1;
    else this.#activeMatch = clamp(this.#activeMatch, 0, this.#matches.length - 1);
  }

  #setSelectionAndReveal(
    anchor: number,
    focus: number,
    rowCount: number,
  ): TerminalScrollbackSelection | undefined {
    this.#selection = normalizeSelection({ anchor, focus }, rowCount);
    if (!this.#selection) return undefined;
    this.enterCopyMode();
    this.#revealRow(this.#selection.focus);
    return { ...this.#selection };
  }

  #revealRow(row: number): void {
    const target = clamp(Math.trunc(row), 0, Math.max(0, this.#rowCount() - 1));
    if (target < this.#offset) {
      this.#offset = target;
    } else if (target >= this.#offset + this.#viewportRows) {
      this.#offset = clamp(target - this.#viewportRows + 1, 0, this.#maxOffset());
    }
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
