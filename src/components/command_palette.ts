// Copyright 2023 Im-Beast. MIT license.
import type { TextRectangle } from "../canvas/text.ts";
import { Component, type ComponentOptions } from "../component.ts";
import { Computed, Signal } from "../signals/mod.ts";
import { signalify } from "../utils/signals.ts";
import { List, visibleListRows } from "./list.ts";
import { Text } from "./text.ts";
import type { KeyPressEvent } from "../input_reader/types.ts";

export interface CommandPaletteItem {
  id: string;
  label: string;
  keywords?: readonly string[];
  disabled?: boolean;
}

export interface CommandPaletteOptions extends ComponentOptions {
  items: CommandPaletteItem[] | Signal<CommandPaletteItem[]>;
  query?: string | Signal<string>;
  selectedIndex?: number | Signal<number>;
  controller?: CommandPaletteController;
  onSelect?: (item: CommandPaletteItem) => void | Promise<void>;
}

export interface CommandPaletteControllerOptions {
  items: CommandPaletteItem[] | Signal<CommandPaletteItem[]>;
  query?: string | Signal<string>;
  selectedIndex?: number | Signal<number>;
}

export interface CommandPaletteInspection {
  query: string;
  selectedIndex: number;
  filteredCount: number;
  selected?: CommandPaletteItem;
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

export function shiftCommandPaletteSelection(
  items: readonly CommandPaletteItem[],
  selectedIndex: number,
  delta: number,
): number {
  if (items.length === 0) return 0;
  let next = selectedIndex;
  for (let count = 0; count < items.length; count += 1) {
    next = Math.max(0, Math.min(items.length - 1, next + delta));
    if (!items[next]?.disabled) return next;
    if (next === 0 || next === items.length - 1) break;
  }
  return selectedIndex;
}

export function clampCommandPaletteSelection(
  items: readonly CommandPaletteItem[],
  selectedIndex: number,
): number {
  if (items.length === 0) return 0;
  const clamped = Math.max(0, Math.min(selectedIndex, items.length - 1));
  if (!items[clamped]?.disabled) return clamped;

  const next = shiftCommandPaletteSelection(items, clamped, 1);
  if (!items[next]?.disabled) return next;
  const previous = shiftCommandPaletteSelection(items, clamped, -1);
  return items[previous]?.disabled ? clamped : previous;
}

export class CommandPaletteController {
  readonly items: Signal<CommandPaletteItem[]>;
  readonly query: Signal<string>;
  readonly selectedIndex: Signal<number>;
  readonly filtered: Signal<CommandPaletteItem[]>;
  readonly #ownsItems: boolean;
  readonly #ownsQuery: boolean;
  readonly #ownsSelectedIndex: boolean;
  readonly #syncFiltered = () => {
    this.filtered.value = filterCommandPaletteItems(this.items.peek(), this.query.peek());
  };

  constructor(options: CommandPaletteControllerOptions) {
    this.#ownsItems = !(options.items instanceof Signal);
    this.#ownsQuery = !(options.query instanceof Signal);
    this.#ownsSelectedIndex = !(options.selectedIndex instanceof Signal);
    this.items = signalify(options.items, { deepObserve: true });
    this.query = signalify(options.query ?? "");
    this.selectedIndex = signalify(options.selectedIndex ?? 0);
    this.filtered = new Signal(filterCommandPaletteItems(this.items.peek(), this.query.peek()), { deepObserve: true });
    this.items.subscribe(this.#syncFiltered);
    this.query.subscribe(this.#syncFiltered);
    this.clamp();
  }

  setQuery(query: string): void {
    this.query.value = query;
    this.clamp();
  }

  append(value: string): void {
    this.setQuery(this.query.peek() + value);
  }

  backspace(): void {
    this.setQuery(this.query.peek().slice(0, -1));
  }

  move(delta: number): void {
    this.selectedIndex.value = shiftCommandPaletteSelection(this.filteredItems(), this.selectedIndex.peek(), delta);
    this.clamp();
  }

  clamp(): void {
    this.selectedIndex.value = clampCommandPaletteSelection(this.filteredItems(), this.selectedIndex.peek());
  }

  selected(): CommandPaletteItem | undefined {
    const item = this.filteredItems()[this.selectedIndex.peek()];
    return item?.disabled ? undefined : item;
  }

  handleKeyPress(event: KeyPressEvent): CommandPaletteItem | undefined {
    if (event.ctrl || event.meta) return undefined;

    if (event.key === "backspace") {
      this.backspace();
    } else if (event.key === "return") {
      return this.selected();
    } else if (event.key === "up") {
      this.move(-1);
    } else if (event.key === "down") {
      this.move(1);
    } else if (event.key.length === 1) {
      this.append(event.shift ? event.key.toUpperCase() : event.key);
    }

    this.clamp();
    return undefined;
  }

  inspect(): CommandPaletteInspection {
    return {
      query: this.query.peek(),
      selectedIndex: this.selectedIndex.peek(),
      filteredCount: this.filteredItems().length,
      selected: this.selected(),
    };
  }

  dispose(): void {
    this.items.unsubscribe(this.#syncFiltered);
    this.query.unsubscribe(this.#syncFiltered);
    this.filtered.dispose();
    if (this.#ownsItems) this.items.dispose();
    if (this.#ownsQuery) this.query.dispose();
    if (this.#ownsSelectedIndex) this.selectedIndex.dispose();
  }

  private filteredItems(): CommandPaletteItem[] {
    return filterCommandPaletteItems(this.items.peek(), this.query.peek());
  }
}

export class CommandPalette extends Component {
  items: Signal<CommandPaletteItem[]>;
  query: Signal<string>;
  selectedIndex: Signal<number>;
  readonly controller: CommandPaletteController;

  constructor(private readonly options: CommandPaletteOptions) {
    super(options);
    const ownsController = !options.controller;
    this.controller = options.controller ??
      new CommandPaletteController({
        items: options.items,
        query: options.query,
        selectedIndex: options.selectedIndex,
      });
    this.items = this.controller.items;
    this.query = this.controller.query;
    this.selectedIndex = this.controller.selectedIndex;

    this.on("keyPress", (event) => {
      const item = this.controller.handleKeyPress(event);
      if (item) void this.options.onSelect?.(item);
    });
    if (ownsController) this.on("destroy", () => this.controller.dispose());
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
    return this.controller.selected();
  }
}

export function renderCommandPaletteRows(
  items: readonly CommandPaletteItem[],
  query: string,
  selectedIndex: number,
  height: number,
): string[] {
  return visibleListRows(
    filterCommandPaletteItems(items, query).map((item) => item.disabled ? `(${item.label})` : item.label),
    selectedIndex,
    height,
  );
}
