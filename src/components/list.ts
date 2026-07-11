// Copyright 2023 Im-Beast. MIT license.
import { Component, type ComponentOptions } from "../component.ts";
import { clampSelectionIndex, selectionWindow } from "../selection.ts";
import { Computed, Signal } from "../signals/mod.ts";
import { signalify } from "../utils/signals.ts";
import { drawTextRows } from "./text_children.ts";

/** Options for configuring list. */
export interface ListOptions extends ComponentOptions, ListControllerOptions {
  controller?: ListController;
}

/** Public interface describing a virtual Row. */
export interface VirtualRow<T> {
  item: T;
  index: number;
  selected: boolean;
}

/** Public helper for virtual Rows. */
export function virtualRows<T>(
  items: readonly T[],
  selectedIndex: number,
  height: number,
): VirtualRow<T>[] {
  const safeHeight = Math.max(0, height);
  const selected = clampSelectionIndex(items.length, selectedIndex);
  const window = selectionWindow(items.length, selected, safeHeight);
  const rows = new Array<VirtualRow<T>>(Math.max(0, window.end - window.start));
  for (let offset = 0; offset < rows.length; offset += 1) {
    const index = window.start + offset;
    rows[offset] = {
      item: items[index]!,
      index,
      selected: index === selected,
    };
  }
  return rows;
}

/** Public helper for visible List Rows. */
export function visibleListRows(items: readonly string[], selectedIndex: number, height: number): string[] {
  return visibleListRowsInto([], items, selectedIndex, height);
}

/** Renders visible List Rows into a caller-owned buffer. */
export function visibleListRowsInto(
  target: string[],
  items: readonly string[],
  selectedIndex: number,
  height: number,
): string[] {
  const safeHeight = Math.max(0, height);
  const selected = clampSelectionIndex(items.length, selectedIndex);
  const window = selectionWindow(items.length, selected, safeHeight);
  const count = Math.max(0, window.end - window.start);
  target.length = count;
  for (let offset = 0; offset < count; offset += 1) {
    const index = window.start + offset;
    target[offset] = `${index === selected ? ">" : " "} ${items[index]!}`;
  }
  return target;
}

/** Options for configuring list Controller. */
export interface ListControllerOptions {
  items: string[] | Signal<string[]>;
  selectedIndex?: number | Signal<number>;
  onSelect?: (item: string, index: number) => void | Promise<void>;
}

/** Serializable inspection snapshot for list. */
export interface ListInspection {
  items: string[];
  itemCount: number;
  selectedIndex: number;
  selected?: string;
  window: { start: number; end: number };
  empty: boolean;
}

/** State controller for list behavior. */
export class ListController {
  readonly items: Signal<string[]>;
  readonly selectedIndex: Signal<number>;
  readonly #ownsItems: boolean;
  readonly #ownsSelectedIndex: boolean;
  readonly #onSelect?: (item: string, index: number) => void | Promise<void>;
  readonly #syncSelection = () => {
    this.selectedIndex.value = clampSelectionIndex(this.items.peek().length, this.selectedIndex.peek());
  };

  constructor(options: ListControllerOptions) {
    this.#ownsItems = !(options.items instanceof Signal);
    this.#ownsSelectedIndex = !(options.selectedIndex instanceof Signal);
    this.items = signalify(options.items, { deepObserve: true });
    this.selectedIndex = signalify(options.selectedIndex ?? 0);
    this.#onSelect = options.onSelect;
    this.items.subscribe(this.#syncSelection);
    this.#syncSelection();
  }

  rows(height: number): string[] {
    return visibleListRows(this.items.peek(), this.selectedIndex.peek(), height);
  }

  selected(): string | undefined {
    return this.items.peek()[clampSelectionIndex(this.items.peek().length, this.selectedIndex.peek())];
  }

  move(delta: number): string | undefined {
    return this.setSelectedIndex(this.selectedIndex.peek() + delta);
  }

  page(delta: number, height: number): string | undefined {
    return this.move(delta * Math.max(1, Math.floor(height)));
  }

  first(): string | undefined {
    return this.setSelectedIndex(0);
  }

  last(): string | undefined {
    return this.setSelectedIndex(this.items.peek().length - 1);
  }

  setSelectedIndex(index: number): string | undefined {
    this.selectedIndex.value = clampSelectionIndex(this.items.peek().length, index);
    return this.selected();
  }

  selectActive(): string | undefined {
    const index = clampSelectionIndex(this.items.peek().length, this.selectedIndex.peek());
    const item = this.items.peek()[index];
    if (item !== undefined) {
      void this.#onSelect?.(item, index);
    }
    return item;
  }

  handleKeyPress(
    { key, ctrl, meta, shift }: { key: string; ctrl?: boolean; meta?: boolean; shift?: boolean },
    height = 1,
  ): string | undefined {
    if (ctrl || meta || shift) return undefined;
    if (key === "up") this.move(-1);
    else if (key === "down") this.move(1);
    else if (key === "pageup") this.page(-1, height);
    else if (key === "pagedown") this.page(1, height);
    else if (key === "home") this.first();
    else if (key === "end") this.last();
    else if (key === "return" || key === "space") return this.selectActive();
    return undefined;
  }

  inspect(height: number = this.items.peek().length): ListInspection {
    const items = [...this.items.peek()];
    const selectedIndex = clampSelectionIndex(items.length, this.selectedIndex.peek());
    return {
      items,
      itemCount: items.length,
      selectedIndex,
      selected: items[selectedIndex],
      window: selectionWindow(items.length, selectedIndex, Math.max(0, Math.floor(height))),
      empty: items.length === 0,
    };
  }

  dispose(): void {
    this.items.unsubscribe(this.#syncSelection);
    if (this.#ownsItems) this.items.dispose();
    if (this.#ownsSelectedIndex) this.selectedIndex.dispose();
  }
}

/** Public class implementing a list. */
export class List extends Component {
  items: Signal<string[]>;
  selectedIndex: Signal<number>;
  readonly controller: ListController;
  readonly #rows: Computed<string[]>;
  readonly #rowBuffer: string[] = [];

  constructor(options: ListOptions) {
    super(options);
    const ownsController = !options.controller;
    this.controller = options.controller ??
      new ListController({
        items: options.items,
        selectedIndex: options.selectedIndex,
        onSelect: options.onSelect,
      });
    this.items = this.controller.items;
    this.selectedIndex = this.controller.selectedIndex;
    this.#rows = new Computed(() =>
      visibleListRowsInto(this.#rowBuffer, this.items.value, this.selectedIndex.value, this.rectangle.value.height)
    );

    this.on("keyPress", (event) => {
      this.controller.handleKeyPress(event, this.rectangle.peek().height);
    });
    this.on("destroy", () => this.#rows.dispose());
    if (ownsController) this.on("destroy", () => this.controller.dispose());
  }

  override draw(): void {
    super.draw();
    drawTextRows(this, this.#rows);
  }
}
