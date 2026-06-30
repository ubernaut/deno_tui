// Copyright 2023 Im-Beast. MIT license.
import type { KeyPressEvent } from "../input_reader/types.ts";
import { Signal } from "../signals/mod.ts";
import type { Offset } from "../types.ts";
import { signalify } from "../utils/signals.ts";
import {
  ScrollAreaController,
  type ScrollAreaControllerOptions,
  type ScrollAreaInspection,
  scrollbarOffsetForPointer,
} from "./scroll_area.ts";

/** Content accepted by a renderer-neutral pad surface. */
export type PadContent = string | readonly string[];

/** Cursor position inside pad content coordinates. */
export interface PadCursor {
  row: number;
  column: number;
}

/** Normalized content dimensions for a pad. */
export interface PadContentSize {
  width: number;
  height: number;
}

/** One rendered viewport row from a pad. */
export interface PadViewportRow {
  row: number;
  sourceRow: number;
  text: string;
}

/** Options for rendering visible pad rows. */
export interface RenderPadRowsOptions {
  width: number;
  height: number;
  offset?: Partial<Offset>;
  fill?: string;
}

/** Options for revealing pad content coordinates. */
export interface PadRevealOptions {
  rowMargin?: number;
  columnMargin?: number;
}

/** Options for configuring a PadController. */
export interface PadControllerOptions extends Omit<ScrollAreaControllerOptions, "contentWidth" | "contentHeight"> {
  content?: PadContent | Signal<PadContent>;
  cursor?: PadCursor | Signal<PadCursor | undefined>;
}

/** Serializable inspection snapshot for a pad. */
export interface PadInspection extends ScrollAreaInspection {
  cursor?: PadCursor;
  lines: number;
  viewportRows: PadViewportRow[];
}

/** Normalizes pad content into immutable logical lines. */
export function normalizePadLines(content: PadContent): string[] {
  if (typeof content === "string") return content.replaceAll("\r\n", "\n").replaceAll("\r", "\n").split("\n");
  return content.map((line) => String(line));
}

/** Measures normalized width and height for pad content. */
export function measurePadContent(content: PadContent): PadContentSize {
  const lines = normalizePadLines(content);
  return {
    width: lines.reduce((max, line) => Math.max(max, line.length), 0),
    height: lines.length,
  };
}

/** Clamps a cursor to valid pad content coordinates. */
export function clampPadCursor(cursor: PadCursor, size: PadContentSize): PadCursor {
  return {
    row: clampInteger(cursor.row, 0, Math.max(0, size.height - 1)),
    column: clampInteger(cursor.column, 0, Math.max(0, size.width - 1)),
  };
}

/** Renders a rectangular slice of pad content. */
export function renderPadRows(content: PadContent, options: RenderPadRowsOptions): PadViewportRow[] {
  const lines = normalizePadLines(content);
  const width = normalizeDimension(options.width);
  const height = normalizeDimension(options.height);
  const offset = {
    columns: normalizeDimension(options.offset?.columns ?? 0),
    rows: normalizeDimension(options.offset?.rows ?? 0),
  };
  const fill = normalizeFill(options.fill);
  const rows: PadViewportRow[] = [];

  for (let row = 0; row < height; row += 1) {
    const sourceRow = offset.rows + row;
    const source = lines[sourceRow] ?? "";
    const sliced = source.slice(offset.columns, offset.columns + width);
    rows.push({
      row,
      sourceRow,
      text: fill ? sliced.padEnd(width, fill) : sliced,
    });
  }

  return rows;
}

/** State controller for curses-style off-screen pad content. */
export class PadController {
  readonly content: Signal<PadContent>;
  readonly cursor: Signal<PadCursor | undefined>;
  readonly scroll: ScrollAreaController;
  readonly #ownsContent: boolean;
  readonly #ownsCursor: boolean;
  readonly #contentSubscription = () => {
    this.#syncContentSize();
  };

  constructor(options: PadControllerOptions = {}) {
    this.#ownsContent = !(options.content instanceof Signal);
    this.#ownsCursor = !(options.cursor instanceof Signal);
    this.content = signalify(options.content ?? []);
    this.cursor = signalify(options.cursor);
    const size = measurePadContent(this.content.peek());
    this.scroll = new ScrollAreaController({
      ...options,
      contentWidth: size.width,
      contentHeight: size.height,
    });

    this.content.subscribe(this.#contentSubscription);
  }

  lines(): string[] {
    return normalizePadLines(this.content.peek());
  }

  setContent(content: PadContent): PadContentSize {
    this.content.value = content;
    return this.#syncContentSize();
  }

  appendLine(line = ""): PadContentSize {
    return this.setContent([...this.lines(), line]);
  }

  write(row: number, column: number, text: string): PadContentSize {
    const lines = this.lines();
    const startRow = normalizeDimension(row);
    const startColumn = normalizeDimension(column);
    const parts = normalizePadLines(text);
    while (lines.length <= startRow + parts.length - 1) lines.push("");

    for (const [index, part] of parts.entries()) {
      const targetRow = startRow + index;
      const existing = lines[targetRow] ?? "";
      const prefix = existing.slice(0, startColumn).padEnd(startColumn, " ");
      const suffix = existing.slice(startColumn + part.length);
      lines[targetRow] = `${prefix}${part}${suffix}`;
    }

    return this.setContent(lines);
  }

  clear(): PadContentSize {
    this.cursor.value = undefined;
    this.scroll.scrollTo(0, 0);
    return this.setContent([]);
  }

  viewportRows(options: Partial<RenderPadRowsOptions> = {}): PadViewportRow[] {
    return renderPadRows(this.content.peek(), {
      width: options.width ?? this.scroll.viewportWidth.peek(),
      height: options.height ?? this.scroll.viewportHeight.peek(),
      offset: options.offset ?? this.scroll.offset.peek(),
      fill: options.fill,
    });
  }

  setViewportSize(width: number, height: number): Offset {
    return this.scroll.setViewportSize(width, height);
  }

  scrollBy(columns: number, rows: number): Offset {
    return this.scroll.scrollBy(columns, rows);
  }

  scrollTo(columns: number, rows: number): Offset {
    return this.scroll.scrollTo(columns, rows);
  }

  setCursor(row: number, column: number, options: PadRevealOptions & { reveal?: boolean } = {}): PadCursor {
    const cursor = clampPadCursor({ row, column }, measurePadContent(this.content.peek()));
    this.cursor.value = cursor;
    if (options.reveal ?? true) this.reveal(cursor.row, cursor.column, options);
    return cursor;
  }

  reveal(row: number, column: number, options: PadRevealOptions = {}): Offset {
    const maxOffset = this.scroll.maxOffset();
    const offset = this.scroll.offset.peek();
    const nextRows = offsetForRevealCoordinate(
      normalizeDimension(row),
      offset.rows,
      this.scroll.viewportHeight.peek(),
      maxOffset.rows,
      options.rowMargin,
    );
    const nextColumns = offsetForRevealCoordinate(
      normalizeDimension(column),
      offset.columns,
      this.scroll.viewportWidth.peek(),
      maxOffset.columns,
      options.columnMargin,
    );
    return this.scroll.scrollTo(nextColumns, nextRows);
  }

  scrollbarOffsetForPointer(axis: "horizontal" | "vertical", pointerIndex: number): number {
    if (axis === "horizontal") {
      return scrollbarOffsetForPointer(
        this.scroll.contentWidth.peek(),
        this.scroll.viewportWidth.peek(),
        pointerIndex,
      );
    }
    return scrollbarOffsetForPointer(
      this.scroll.contentHeight.peek(),
      this.scroll.viewportHeight.peek(),
      pointerIndex,
    );
  }

  handleKeyPress(
    { key, ctrl, meta, shift }: Pick<KeyPressEvent, "key" | "ctrl" | "meta" | "shift">,
  ): Offset | undefined {
    if (ctrl || meta) return undefined;
    const pageRows = Math.max(1, this.scroll.viewportHeight.peek() - 1);
    const pageColumns = Math.max(1, this.scroll.viewportWidth.peek() - 1);
    if (key === "up") return this.scrollBy(0, -1);
    if (key === "down") return this.scrollBy(0, 1);
    if (key === "left") return this.scrollBy(-1, 0);
    if (key === "right") return this.scrollBy(1, 0);
    if (key === "pageup") return shift ? this.scrollBy(-pageColumns, 0) : this.scrollBy(0, -pageRows);
    if (key === "pagedown") return shift ? this.scrollBy(pageColumns, 0) : this.scrollBy(0, pageRows);
    if (key === "home") return this.scrollTo(shift ? 0 : this.scroll.offset.peek().columns, 0);
    if (key === "end") {
      return this.scrollTo(
        shift ? this.scroll.maxOffset().columns : this.scroll.offset.peek().columns,
        this.scroll.maxOffset().rows,
      );
    }
    return undefined;
  }

  inspect(): PadInspection {
    this.#syncContentSize();
    return {
      ...this.scroll.inspect(),
      cursor: this.cursor.peek(),
      lines: this.lines().length,
      viewportRows: this.viewportRows(),
    };
  }

  dispose(): void {
    this.content.unsubscribe(this.#contentSubscription);
    this.scroll.dispose();
    if (this.#ownsContent) this.content.dispose();
    if (this.#ownsCursor) this.cursor.dispose();
  }

  #syncContentSize(): PadContentSize {
    const next = measurePadContent(this.content.peek());
    if (this.scroll.contentWidth.peek() !== next.width || this.scroll.contentHeight.peek() !== next.height) {
      this.scroll.setContentSize(next.width, next.height);
    }
    const cursor = this.cursor.peek();
    if (cursor) {
      const clamped = clampPadCursor(cursor, next);
      if (clamped.row !== cursor.row || clamped.column !== cursor.column) this.cursor.value = clamped;
    }
    return next;
  }
}

function offsetForRevealCoordinate(
  position: number,
  offset: number,
  viewportLength: number,
  maxOffset: number,
  margin = 0,
): number {
  const viewport = normalizeDimension(viewportLength);
  if (viewport <= 0) return 0;
  const safeMargin = clampInteger(margin, 0, Math.max(0, viewport - 1));
  if (position < offset + safeMargin) return clampInteger(position - safeMargin, 0, maxOffset);
  if (position >= offset + viewport - safeMargin) {
    return clampInteger(position - viewport + 1 + safeMargin, 0, maxOffset);
  }
  return clampInteger(offset, 0, maxOffset);
}

function normalizeFill(fill = " "): string {
  return fill.length === 0 ? "" : fill.slice(0, 1);
}

function normalizeDimension(value: number): number {
  return Math.max(0, Math.floor(Number.isFinite(value) ? value : 0));
}

function clampInteger(value: number, min: number, max: number): number {
  const normalized = Math.floor(Number.isFinite(value) ? value : min);
  return Math.max(min, Math.min(max, normalized));
}
