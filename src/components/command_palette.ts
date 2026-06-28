// Copyright 2023 Im-Beast. MIT license.
import type { TextRectangle } from "../canvas/text.ts";
import { Component, type ComponentOptions } from "../component.ts";
import { Computed, Signal } from "../signals/mod.ts";
import { signalify } from "../utils/signals.ts";
import { List, visibleListRows } from "./list.ts";
import { Text } from "./text.ts";

export interface CommandPaletteItem {
  id: string;
  label: string;
  keywords?: readonly string[];
}

export interface CommandPaletteOptions extends ComponentOptions {
  items: CommandPaletteItem[] | Signal<CommandPaletteItem[]>;
  query?: string | Signal<string>;
  selectedIndex?: number | Signal<number>;
}

export function filterCommandPaletteItems(
  items: readonly CommandPaletteItem[],
  query: string,
): CommandPaletteItem[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [...items];
  return items.filter((item) => {
    const haystack = [item.label, item.id, ...(item.keywords ?? [])].join(" ").toLowerCase();
    return needle.split(/\s+/).every((part) => haystack.includes(part));
  });
}

export class CommandPalette extends Component {
  items: Signal<CommandPaletteItem[]>;
  query: Signal<string>;
  selectedIndex: Signal<number>;

  constructor(options: CommandPaletteOptions) {
    super(options);
    this.items = signalify(options.items, { deepObserve: true });
    this.query = signalify(options.query ?? "");
    this.selectedIndex = signalify(options.selectedIndex ?? 0);

    this.on("keyPress", ({ key, ctrl, meta, shift }) => {
      if (ctrl || meta) return;

      if (key === "backspace") {
        this.query.value = this.query.peek().slice(0, -1);
      } else if (key === "up") {
        this.selectedIndex.value = Math.max(0, this.selectedIndex.peek() - 1);
      } else if (key === "down") {
        this.selectedIndex.value += 1;
      } else if (key.length === 1) {
        this.query.value += shift ? key.toUpperCase() : key;
      }

      this.selectedIndex.value = Math.max(
        0,
        Math.min(
          this.selectedIndex.peek(),
          Math.max(0, filterCommandPaletteItems(this.items.peek(), this.query.peek()).length - 1),
        ),
      );
    });
  }

  override draw(): void {
    super.draw();

    const filtered = new Computed(() => filterCommandPaletteItems(this.items.value, this.query.value));
    const input = new Text({
      parent: this,
      theme: this.theme,
      zIndex: this.zIndex,
      text: new Computed(() => `> ${this.query.value}`),
      overwriteWidth: true,
      rectangle: new Computed<TextRectangle>(() => ({
        column: this.rectangle.value.column,
        row: this.rectangle.value.row,
        width: this.rectangle.value.width,
      })),
      visible: this.visible,
    });
    const list = new List({
      parent: this,
      theme: this.theme,
      zIndex: this.zIndex,
      items: new Computed(() => filtered.value.map((item) => item.label)),
      selectedIndex: this.selectedIndex,
      rectangle: new Computed(() => ({
        column: this.rectangle.value.column,
        row: this.rectangle.value.row + 1,
        width: this.rectangle.value.width,
        height: Math.max(0, this.rectangle.value.height - 1),
      })),
      visible: this.visible,
    });
    input.subComponentOf = list.subComponentOf = this;
    this.subComponents.input = input;
    this.subComponents.list = list;
  }

  selected(): CommandPaletteItem | undefined {
    const filtered = filterCommandPaletteItems(this.items.peek(), this.query.peek());
    return filtered[this.selectedIndex.peek()];
  }
}

export function renderCommandPaletteRows(
  items: readonly CommandPaletteItem[],
  query: string,
  selectedIndex: number,
  height: number,
): string[] {
  return visibleListRows(filterCommandPaletteItems(items, query).map((item) => item.label), selectedIndex, height);
}
