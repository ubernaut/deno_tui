// Copyright 2023 Im-Beast. MIT license.
import { Component, type ComponentOptions } from "../component.ts";
import type { TextRectangle } from "../canvas/text.ts";
import { Computed, Signal } from "../signals/mod.ts";
import { signalify } from "../utils/signals.ts";
import { clamp } from "../utils/numbers.ts";
import { Text } from "./text.ts";

export interface ListOptions extends ComponentOptions {
  items: string[] | Signal<string[]>;
  selectedIndex?: number | Signal<number>;
}

export function visibleListRows(items: readonly string[], selectedIndex: number, height: number): string[] {
  const safeHeight = Math.max(0, height);
  const selected = clamp(selectedIndex, 0, Math.max(0, items.length - 1));
  const offset = clamp(selected - Math.floor(safeHeight / 2), 0, Math.max(0, items.length - safeHeight));
  return items.slice(offset, offset + safeHeight).map((item, index) => {
    const itemIndex = offset + index;
    return `${itemIndex === selected ? ">" : " "} ${item}`;
  });
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
      this.selectedIndex.value = clamp(this.selectedIndex.peek(), 0, Math.max(0, this.items.peek().length - 1));
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
