// Copyright 2023 Im-Beast. MIT license.
import type { TextRectangle } from "../canvas/text.ts";
import { Component, type ComponentOptions } from "../component.ts";
import { Computed, Effect, Signal } from "../signals/mod.ts";
import type { Offset, Rectangle } from "../types.ts";
import { signalify } from "../utils/signals.ts";
import { View } from "../view.ts";
import {
  clampViewportOffset,
  inspectViewport,
  maxViewportOffset,
  type ViewportInspection,
  viewportOffsetBy,
  type ViewportThumb,
  viewportThumb,
  viewportThumbGlyph,
} from "../viewport.ts";
import { Text } from "./text.ts";

export interface ScrollAreaOptions extends ComponentOptions {
  contentWidth?: number | Signal<number>;
  contentHeight?: number | Signal<number>;
  offset?: Offset | Signal<Offset>;
  showScrollbar?: boolean | Signal<boolean>;
}

export interface ScrollAreaControllerOptions {
  contentWidth?: number | Signal<number>;
  contentHeight?: number | Signal<number>;
  viewportWidth?: number | Signal<number>;
  viewportHeight?: number | Signal<number>;
  offset?: Offset | Signal<Offset>;
  showScrollbar?: boolean | Signal<boolean>;
}

export interface ScrollAreaInspection extends ViewportInspection {
  showScrollbar: boolean;
}

export type ScrollbarThumb = ViewportThumb;

export function maxScrollOffset(
  contentWidth: number,
  contentHeight: number,
  viewportWidth: number,
  viewportHeight: number,
): Offset {
  return maxViewportOffset(contentWidth, contentHeight, viewportWidth, viewportHeight);
}

export function clampScrollOffset(offset: Offset, maxOffset: Offset): Offset {
  return clampViewportOffset(offset, maxOffset);
}

export function scrollOffsetBy(offset: Offset, maxOffset: Offset, columns: number, rows: number): Offset {
  return viewportOffsetBy(offset, maxOffset, columns, rows);
}

export function scrollbarThumb(contentLength: number, viewportLength: number, offset: number): ScrollbarThumb {
  return viewportThumb(contentLength, viewportLength, offset);
}

export function scrollbarGlyph(row: number, thumb: ScrollbarThumb): string {
  return viewportThumbGlyph(row, thumb);
}

export function scrollbarOffsetForPointer(
  contentLength: number,
  viewportLength: number,
  pointerIndex: number,
): number {
  const content = normalizedScrollDimension(contentLength);
  const viewport = normalizedScrollDimension(viewportLength);
  const maxOffset = Math.max(0, content - viewport);
  if (maxOffset === 0) return 0;
  const trackLength = Math.max(1, viewport);
  const local = Math.max(0, Math.min(trackLength - 1, Math.floor(pointerIndex)));
  const ratio = trackLength <= 1 ? 0 : local / (trackLength - 1);
  return Math.max(0, Math.min(maxOffset, Math.round(maxOffset * ratio)));
}

export class ScrollAreaController {
  readonly contentWidth: Signal<number>;
  readonly contentHeight: Signal<number>;
  readonly viewportWidth: Signal<number>;
  readonly viewportHeight: Signal<number>;
  readonly offset: Signal<Offset>;
  readonly showScrollbar: Signal<boolean>;
  readonly #ownsContentWidth: boolean;
  readonly #ownsContentHeight: boolean;
  readonly #ownsViewportWidth: boolean;
  readonly #ownsViewportHeight: boolean;
  readonly #ownsOffset: boolean;
  readonly #ownsShowScrollbar: boolean;

  constructor(options: ScrollAreaControllerOptions = {}) {
    this.#ownsContentWidth = !(options.contentWidth instanceof Signal);
    this.#ownsContentHeight = !(options.contentHeight instanceof Signal);
    this.#ownsViewportWidth = !(options.viewportWidth instanceof Signal);
    this.#ownsViewportHeight = !(options.viewportHeight instanceof Signal);
    this.#ownsOffset = !(options.offset instanceof Signal);
    this.#ownsShowScrollbar = !(options.showScrollbar instanceof Signal);
    this.contentWidth = signalify(options.contentWidth ?? 0);
    this.contentHeight = signalify(options.contentHeight ?? 0);
    this.viewportWidth = signalify(options.viewportWidth ?? 0);
    this.viewportHeight = signalify(options.viewportHeight ?? 0);
    this.offset = signalify(options.offset ?? { columns: 0, rows: 0 }, { deepObserve: true });
    this.showScrollbar = signalify(options.showScrollbar ?? true);
    this.#clampOffset();
  }

  maxOffset(): Offset {
    return maxScrollOffset(
      this.contentWidth.peek(),
      this.contentHeight.peek(),
      this.viewportWidth.peek(),
      this.viewportHeight.peek(),
    );
  }

  scrollBy(columns: number, rows: number): Offset {
    return this.setOffset(scrollOffsetBy(this.offset.peek(), this.maxOffset(), columns, rows));
  }

  scrollTo(columns: number, rows: number): Offset {
    return this.setOffset(clampScrollOffset({ columns, rows }, this.maxOffset()));
  }

  setContentSize(width: number, height: number): Offset {
    this.contentWidth.value = normalizedScrollDimension(width);
    this.contentHeight.value = normalizedScrollDimension(height);
    return this.#clampOffset();
  }

  setViewportSize(width: number, height: number): Offset {
    this.viewportWidth.value = normalizedScrollDimension(width);
    this.viewportHeight.value = normalizedScrollDimension(height);
    return this.#clampOffset();
  }

  setScrollbarVisible(visible: boolean): void {
    this.showScrollbar.value = visible;
  }

  inspect(): ScrollAreaInspection {
    return {
      ...inspectViewport(
        this.contentWidth.peek(),
        this.contentHeight.peek(),
        this.viewportWidth.peek(),
        this.viewportHeight.peek(),
        this.offset.peek(),
      ),
      showScrollbar: this.showScrollbar.peek(),
    };
  }

  dispose(): void {
    if (this.#ownsContentWidth) this.contentWidth.dispose();
    if (this.#ownsContentHeight) this.contentHeight.dispose();
    if (this.#ownsViewportWidth) this.viewportWidth.dispose();
    if (this.#ownsViewportHeight) this.viewportHeight.dispose();
    if (this.#ownsOffset) this.offset.dispose();
    if (this.#ownsShowScrollbar) this.showScrollbar.dispose();
  }

  private setOffset(offset: Offset): Offset {
    this.offset.value = offset;
    return offset;
  }

  #clampOffset(): Offset {
    return this.setOffset(clampScrollOffset(this.offset.peek(), this.maxOffset()));
  }
}

export class ScrollArea extends Component {
  readonly contentWidth: Signal<number>;
  readonly contentHeight: Signal<number>;
  readonly offset: Signal<Offset>;
  readonly showScrollbar: Signal<boolean>;
  readonly contentView: View;
  #syncingView = false;
  #syncEffect?: Effect;
  readonly #offsetSubscription = () => this.syncContentView();

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

    this.offset.subscribe(this.#offsetSubscription);

    this.#syncEffect = new Effect(() => {
      this.rectangle.value;
      this.contentWidth.value;
      this.contentHeight.value;
      this.syncContentView();
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

  override destroy(): void {
    this.offset.unsubscribe(this.#offsetSubscription);
    this.#syncEffect?.dispose();
    super.destroy();
  }

  private syncContentView(): void {
    if (this.#syncingView) return;
    this.#syncingView = true;
    try {
      const rectangle = this.rectangle.peek();
      const maxOffset = maxScrollOffset(
        this.contentWidth.peek(),
        this.contentHeight.peek(),
        rectangle.width,
        rectangle.height,
      );
      const currentOffset = this.offset.peek();
      const offset = clampScrollOffset(currentOffset, maxOffset);

      this.contentView.rectangle.value = { ...rectangle };
      this.contentView.maxOffset.value = maxOffset;
      this.contentView.offset.value = offset;
      if (currentOffset.columns !== offset.columns || currentOffset.rows !== offset.rows) {
        this.offset.value = offset;
      }
    } finally {
      this.#syncingView = false;
    }
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

function normalizedScrollDimension(value: number): number {
  return Math.max(0, Math.floor(Number.isFinite(value) ? value : 0));
}
