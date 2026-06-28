// Copyright 2023 Im-Beast. MIT license.
import type { TextRectangle } from "../canvas/text.ts";
import { Component, type ComponentOptions } from "../component.ts";
import { Computed, Effect, Signal } from "../signals/mod.ts";
import type { Offset, Rectangle } from "../types.ts";
import { clamp } from "../utils/numbers.ts";
import { signalify } from "../utils/signals.ts";
import { View } from "../view.ts";
import { Text } from "./text.ts";

export interface ScrollAreaOptions extends ComponentOptions {
  contentWidth?: number | Signal<number>;
  contentHeight?: number | Signal<number>;
  offset?: Offset | Signal<Offset>;
  showScrollbar?: boolean | Signal<boolean>;
}

export interface ScrollbarThumb {
  start: number;
  size: number;
  visible: boolean;
}

export function maxScrollOffset(
  contentWidth: number,
  contentHeight: number,
  viewportWidth: number,
  viewportHeight: number,
): Offset {
  return {
    columns: Math.max(0, contentWidth - Math.max(0, viewportWidth)),
    rows: Math.max(0, contentHeight - Math.max(0, viewportHeight)),
  };
}

export function clampScrollOffset(offset: Offset, maxOffset: Offset): Offset {
  return {
    columns: clamp(offset.columns, 0, Math.max(0, maxOffset.columns)),
    rows: clamp(offset.rows, 0, Math.max(0, maxOffset.rows)),
  };
}

export function scrollOffsetBy(offset: Offset, maxOffset: Offset, columns: number, rows: number): Offset {
  return clampScrollOffset({
    columns: offset.columns + columns,
    rows: offset.rows + rows,
  }, maxOffset);
}

export function scrollbarThumb(contentLength: number, viewportLength: number, offset: number): ScrollbarThumb {
  const viewport = Math.max(0, viewportLength);
  const content = Math.max(0, contentLength);
  if (viewport === 0 || content <= viewport) {
    return { start: 0, size: viewport, visible: false };
  }

  const size = clamp(Math.round((viewport / content) * viewport), 1, viewport);
  const maxStart = Math.max(0, viewport - size);
  const maxOffset = Math.max(1, content - viewport);
  return {
    start: clamp(Math.round((offset / maxOffset) * maxStart), 0, maxStart),
    size,
    visible: true,
  };
}

export function scrollbarGlyph(row: number, thumb: ScrollbarThumb): string {
  if (!thumb.visible) return " ";
  return row >= thumb.start && row < thumb.start + thumb.size ? "█" : "│";
}

export class ScrollArea extends Component {
  readonly contentWidth: Signal<number>;
  readonly contentHeight: Signal<number>;
  readonly offset: Signal<Offset>;
  readonly showScrollbar: Signal<boolean>;
  readonly contentView: View;

  constructor(options: ScrollAreaOptions) {
    super(options);
    this.contentWidth = signalify(options.contentWidth ?? this.rectangle.peek().width);
    this.contentHeight = signalify(options.contentHeight ?? this.rectangle.peek().height);
    this.offset = signalify(options.offset ?? { columns: 0, rows: 0 }, { deepObserve: true });
    this.showScrollbar = signalify(options.showScrollbar ?? true);
    this.contentView = new View({
      rectangle: this.rectangle.peek(),
      offset: this.offset.peek(),
      maxOffset: maxScrollOffset(
        this.contentWidth.peek(),
        this.contentHeight.peek(),
        this.rectangle.peek().width,
        this.rectangle.peek().height,
      ),
    });

    new Effect(() => {
      const rectangle = this.rectangle.value;
      const maxOffset = maxScrollOffset(
        this.contentWidth.value,
        this.contentHeight.value,
        rectangle.width,
        rectangle.height,
      );
      const offset = clampScrollOffset(this.offset.value, maxOffset);
      const currentOffset = this.offset.peek();

      this.contentView.rectangle.value = { ...rectangle };
      this.contentView.maxOffset.value = maxOffset;
      this.contentView.offset.value = offset;
      if (currentOffset.columns !== offset.columns || currentOffset.rows !== offset.rows) {
        this.offset.value = offset;
      }
    });

    this.on("keyPress", ({ key, ctrl, meta }) => {
      if (ctrl || meta) return;
      const rectangle = this.rectangle.peek();
      if (key === "up") this.scrollBy(0, -1);
      else if (key === "down") this.scrollBy(0, 1);
      else if (key === "left") this.scrollBy(-1, 0);
      else if (key === "right") this.scrollBy(1, 0);
      else if (key === "pageup") this.scrollBy(0, -Math.max(1, rectangle.height - 1));
      else if (key === "pagedown") this.scrollBy(0, Math.max(1, rectangle.height - 1));
      else if (key === "home") this.scrollTo(0, 0);
      else if (key === "end") this.scrollTo(0, this.contentView.maxOffset.peek().rows);
    });

    this.on("mouseScroll", ({ scroll }) => {
      if (scroll !== 0) this.scrollBy(0, scroll);
    });
  }

  scrollBy(columns: number, rows: number): Offset {
    return this.setOffset(scrollOffsetBy(this.offset.peek(), this.contentView.maxOffset.peek(), columns, rows));
  }

  scrollTo(columns: number, rows: number): Offset {
    return this.setOffset(clampScrollOffset({ columns, rows }, this.contentView.maxOffset.peek()));
  }

  override draw(): void {
    super.draw();
    const rowCount = this.rectangle.peek().height;
    for (let index = 0; index < rowCount; index += 1) {
      const text = new Text({
        parent: this,
        theme: this.theme,
        zIndex: this.zIndex,
        text: new Computed(() => {
          if (!this.showScrollbar.value) return "";
          const rect = this.rectangle.value;
          const thumb = scrollbarThumb(this.contentHeight.value, rect.height, this.offset.value.rows);
          return scrollbarGlyph(index, thumb);
        }),
        overwriteWidth: true,
        rectangle: new Computed<TextRectangle>(() => {
          const rect = this.rectangle.value;
          return {
            column: rect.column + Math.max(0, rect.width - 1),
            row: rect.row + index,
            width: 1,
          };
        }),
        visible: new Computed(() => this.visible.value && this.showScrollbar.value),
      });
      text.subComponentOf = this;
      this.subComponents[`scrollbar-${index}`] = text;
    }
  }

  private setOffset(offset: Offset): Offset {
    this.offset.value = offset;
    this.contentView.offset.value = offset;
    return offset;
  }
}
