// Copyright 2023 Im-Beast. MIT license.
import { Component, type ComponentOptions } from "../component.ts";
import type { TextRectangle } from "../canvas/text.ts";
import { clampSelectionIndex, selectionWindow } from "../selection.ts";
import { Computed, Signal } from "../signals/mod.ts";
import { signalify } from "../utils/signals.ts";
import { Text } from "./text.ts";

export interface ListOptions extends ComponentOptions {
  items: string[] | Signal<string[]>;
  selectedIndex?: number | Signal<number>;
}

export interface VirtualRow<T> {
  item: T;
  index: number;
  selected: boolean;
}

export function virtualRows<T>(
  items: readonly T[],
  selectedIndex: number,
  height: number,
): VirtualRow<T>[] {
  const safeHeight = Math.max(0, height);
  const selected = clampSelectionIndex(items.length, selectedIndex);
  const window = selectionWindow(items.length, selected, safeHeight);
  return items.slice(window.start, window.end).map((item, index) => ({
    item,
    index: window.start + index,
    selected: window.start + index === selected,
  }));
}

export function visibleListRows(items: readonly string[], selectedIndex: number, height: number): string[] {
  return virtualRows(items, selectedIndex, height).map((row) => `${row.selected ? ">" : " "} ${row.item}`);
}

export class List extends Component {
  items: Signal<string[]>;
  selectedIndex: Signal<number>;

  constructor(options: ListOptions) {
    super(options);
    this.items = signalify(options.items, { deepObserve: true });
    this.selectedIndex = signalify(options.selectedIndex ?? 0);

    this.on("keyPress", ({ key, ctrl, meta, shift }) => {
      if (ctrl || meta || shift) return;
      if (key === "up") this.selectedIndex.value -= 1;
      if (key === "down") this.selectedIndex.value += 1;
      this.selectedIndex.value = clampSelectionIndex(this.items.peek().length, this.selectedIndex.peek());
    });
  }

  override draw(): void {
    super.draw();

    const lines = new Computed(() =>
      visibleListRows(this.items.value, this.selectedIndex.value, this.rectangle.value.height)
    );
    Array.from({ length: this.rectangle.peek().height }, (_, index) => {
      const row = new Text({
        parent: this,
        theme: this.theme,
        zIndex: this.zIndex,
        text: new Computed(() => lines.value[index] ?? ""),
        overwriteWidth: true,
        rectangle: new Computed<TextRectangle>(() => ({
          column: this.rectangle.value.column,
          row: this.rectangle.value.row + index,
          width: this.rectangle.value.width,
        })),
        visible: this.visible,
      });
      row.subComponentOf = this;
      this.subComponents[`row-${index}`] = row;
      return row;
    });
  }
}
