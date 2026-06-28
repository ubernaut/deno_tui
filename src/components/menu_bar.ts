// Copyright 2023 Im-Beast. MIT license.
import type { TextRectangle } from "../canvas/text.ts";
import { Component, type ComponentOptions } from "../component.ts";
import { Computed, Signal } from "../signals/mod.ts";
import { signalify } from "../utils/signals.ts";
import { Text } from "./text.ts";

export interface MenuBarItem {
  id: string;
  label: string;
  disabled?: boolean;
}

export interface MenuBarOptions extends ComponentOptions {
  items: MenuBarItem[] | Signal<MenuBarItem[]>;
  activeIndex?: number | Signal<number>;
}

export function renderMenuBar(items: readonly MenuBarItem[], activeIndex: number): string {
  return items.map((item, index) => {
    const label = item.disabled ? `(${item.label})` : item.label;
    return index === activeIndex ? `[${label}]` : label;
  }).join(" ");
}

export function shiftMenuIndex(items: readonly MenuBarItem[], activeIndex: number, delta: number): number {
  if (items.length === 0) return -1;
  let next = activeIndex;
  for (let count = 0; count < items.length; count += 1) {
    next = (next + delta + items.length) % items.length;
    if (!items[next]?.disabled) return next;
  }
  return activeIndex;
}

export class MenuBar extends Component {
  items: Signal<MenuBarItem[]>;
  activeIndex: Signal<number>;

  constructor(options: MenuBarOptions) {
    super(options);
    this.items = signalify(options.items, { deepObserve: true });
    this.activeIndex = signalify(options.activeIndex ?? 0);

    this.on("keyPress", ({ key, ctrl, meta, shift }) => {
      if (ctrl || meta || shift) return;
      if (key === "left") {
        this.activeIndex.value = shiftMenuIndex(this.items.peek(), this.activeIndex.peek(), -1);
      } else if (key === "right") {
        this.activeIndex.value = shiftMenuIndex(this.items.peek(), this.activeIndex.peek(), 1);
      }
    });
  }

  override draw(): void {
    super.draw();
    const text = new Text({
      parent: this,
      theme: this.theme,
      zIndex: this.zIndex,
      text: new Computed(() => renderMenuBar(this.items.value, this.activeIndex.value)),
      overwriteWidth: true,
      rectangle: new Computed<TextRectangle>(() => ({
        column: this.rectangle.value.column,
        row: this.rectangle.value.row,
        width: this.rectangle.value.width,
      })),
      visible: this.visible,
    });
    text.subComponentOf = this;
    this.subComponents.text = text;
  }
}
