// Copyright 2023 Im-Beast. MIT license.
import { Component, type ComponentOptions } from "../component.ts";
import type { KeyPressEvent } from "../input_reader/types.ts";
import {
  selectedValues,
  SelectionController,
  selectionFromValues,
  type SelectionMode,
  type SelectionState,
  type SelectionValueOptions,
  selectionWindow,
} from "../selection.ts";
import { Computed, Signal } from "../signals/mod.ts";
import { signalify } from "../utils/signals.ts";
import { drawTextRows } from "./text_children.ts";

/** Public interface describing a virtual List Row. */
export interface VirtualListRow<T> {
  item: T;
  index: number;
  active: boolean;
  selected: boolean;
  text: string;
}

/** Options for configuring virtual List. */
export interface VirtualListOptions<T> extends ComponentOptions {
  items: T[] | Signal<T[]>;
  mode?: SelectionMode | Signal<SelectionMode>;
  selection?: SelectionController | Signal<SelectionState>;
  controller?: VirtualListController<T>;
  format?: (item: T, index: number) => string;
  onSelect?: (item: T, index: number, state: SelectionState) => void | Promise<void>;
}

/** Options for configuring virtual List Controller. */
export interface VirtualListControllerOptions<T, TValue = T> {
  items: T[] | Signal<T[]>;
  mode?: SelectionMode | Signal<SelectionMode>;
  selection?: SelectionController | Signal<SelectionState>;
  format?: (item: T, index: number) => string;
  valueForItem?: (item: T, index: number) => TValue;
}

/** Serializable inspection snapshot for virtual List. */
export interface VirtualListInspection<T> {
  itemCount: number;
  mode: SelectionMode;
  activeIndex: number;
  selected: number[];
  selectedItems: T[];
  window: { start: number; end: number };
}

/** Public helper for virtual List Rows. */
export function virtualListRows<T>(
  items: readonly T[],
  state: SelectionState,
  height: number,
  format: (item: T, index: number) => string = String,
): VirtualListRow<T>[] {
  const window = selectionWindow(items.length, state.activeIndex, height);
  const selected = state.selected.length > 8 ? new Set(state.selected) : undefined;
  const rows = new Array<VirtualListRow<T>>(Math.max(0, window.end - window.start));
  for (let offset = 0; offset < rows.length; offset += 1) {
    const index = window.start + offset;
    const item = items[index]!;
    rows[offset] = {
      item,
      index,
      active: index === state.activeIndex,
      selected: selected ? selected.has(index) : virtualListIndexSelected(state.selected, index),
      text: format(item, index),
    };
  }
  return rows;
}

/** Renders virtual List Rows into deterministic text rows. */
export function renderVirtualListRows<T>(
  items: readonly T[],
  state: SelectionState,
  height: number,
  format?: (item: T, index: number) => string,
): string[] {
  return renderVirtualListRowsInto([], items, state, height, format);
}

/** Renders virtual List Rows into a caller-owned deterministic text row buffer. */
export function renderVirtualListRowsInto<T>(
  target: string[],
  items: readonly T[],
  state: SelectionState,
  height: number,
  format: (item: T, index: number) => string = String,
): string[] {
  const window = selectionWindow(items.length, state.activeIndex, height);
  const count = Math.max(0, window.end - window.start);
  const selected = state.selected.length > 8 ? new Set(state.selected) : undefined;
  target.length = count;
  for (let offset = 0; offset < count; offset += 1) {
    const index = window.start + offset;
    const cursor = index === state.activeIndex ? ">" : " ";
    const marker = (selected ? selected.has(index) : virtualListIndexSelected(state.selected, index)) ? "●" : " ";
    target[offset] = `${cursor} ${marker} ${format(items[index]!, index)}`;
  }
  return target;
}

/** State controller for virtual List behavior. */
export class VirtualListController<T, TValue = T> {
  readonly items: Signal<T[]>;
  readonly rows: Signal<Array<VirtualListRow<T>>>;
  readonly selection: SelectionController;
  readonly format: (item: T, index: number) => string;
  readonly valueForItem?: (item: T, index: number) => TValue;
  readonly #length: Signal<number>;
  readonly #capacity = new Signal(0);
  readonly #externalSelection?: Signal<SelectionState>;
  readonly #ownsItems: boolean;
  readonly #ownsSelection: boolean;
  readonly #syncLength = (items: T[]) => {
    this.#length.value = items.length;
    this.selection.normalize();
    this.refreshRows();
  };
  readonly #syncRows = () => {
    this.refreshRows();
  };
  readonly #syncExternalSelection = (state: SelectionState) => {
    if (this.#externalSelection) this.#externalSelection.value = state;
  };

  constructor(options: VirtualListControllerOptions<T, TValue>) {
    this.#ownsItems = !(options.items instanceof Signal);
    this.items = signalify(options.items, { deepObserve: true });
    this.format = options.format ?? ((item) => String(item));
    this.valueForItem = options.valueForItem;
    this.#length = new Signal(this.items.peek().length);
    this.#externalSelection = options.selection instanceof Signal ? options.selection : undefined;
    this.#ownsSelection = !(options.selection instanceof SelectionController);
    this.selection = options.selection instanceof SelectionController ? options.selection : new SelectionController({
      length: this.#length,
      mode: options.mode ?? "single",
      initialState: this.#externalSelection?.peek(),
    });
    this.rows = new Signal(virtualListRows(this.items.peek(), this.selection.state.peek(), 0, this.format), {
      deepObserve: true,
    });

    this.items.subscribe(this.#syncLength);
    this.selection.state.subscribe(this.#syncRows);
    this.#capacity.subscribe(this.#syncRows);
    if (this.#externalSelection) {
      this.selection.state.subscribe(this.#syncExternalSelection);
    }
    this.refreshRows();
  }

  setViewportHeight(height: number): void {
    this.#capacity.value = Math.max(0, Math.floor(height));
  }

  move(delta: number, extend = false): void {
    this.selection.move(delta, extend);
  }

  page(delta: number, extend = false): void {
    this.move(delta * Math.max(1, this.#capacity.peek()), extend);
  }

  first(): void {
    this.selection.select(0);
  }

  last(): void {
    this.selection.select(this.items.peek().length - 1);
  }

  toggle(): void {
    this.selection.toggle();
  }

  selectedItem(): T | undefined {
    return this.items.peek()[this.selection.state.peek().activeIndex];
  }

  selectedValues(options?: SelectionValueOptions<T, TValue>): TValue[];
  selectedValues<TSelectedValue>(options: SelectionValueOptions<T, TSelectedValue>): TSelectedValue[];
  selectedValues<TSelectedValue>(
    options: SelectionValueOptions<T, TSelectedValue | TValue> = {},
  ): Array<TSelectedValue | TValue> {
    return selectedValues(this.items.peek(), this.selection.state.peek(), this.valueOptions(options));
  }

  selectValues(
    values: readonly TValue[],
    options?: SelectionValueOptions<T, TValue> & {
      mode?: SelectionMode;
      fallbackIndex?: number;
    },
  ): void;
  selectValues<TSelectedValue>(
    values: readonly TSelectedValue[],
    options: SelectionValueOptions<T, TSelectedValue> & {
      mode?: SelectionMode;
      fallbackIndex?: number;
    },
  ): void;
  selectValues<TSelectedValue>(
    values: readonly TSelectedValue[],
    options: SelectionValueOptions<T, TSelectedValue | TValue> & {
      mode?: SelectionMode;
      fallbackIndex?: number;
    } = {},
  ): void {
    this.selection.state.value = selectionFromValues(this.items.peek(), values, {
      mode: this.selection.mode.peek(),
      ...this.valueOptions(options),
    });
  }

  handleKeyPress(event: KeyPressEvent): T | undefined {
    if (event.ctrl || event.meta) return undefined;
    if (event.key === "up") this.move(-1, event.shift);
    else if (event.key === "down") this.move(1, event.shift);
    else if (event.key === "pageup") this.page(-1, event.shift);
    else if (event.key === "pagedown") this.page(1, event.shift);
    else if (event.key === "home") this.first();
    else if (event.key === "end") this.last();
    else if (event.key === "space") this.toggle();
    else if (event.key === "return") return this.selectedItem();
    return undefined;
  }

  inspect(height: number = this.#capacity.peek()): VirtualListInspection<T> {
    const state = this.selection.state.peek();
    return {
      itemCount: this.items.peek().length,
      mode: this.selection.mode.peek(),
      activeIndex: state.activeIndex,
      selected: [...state.selected],
      selectedItems: selectedValues(this.items.peek(), state),
      window: selectionWindow(this.items.peek().length, state.activeIndex, height),
    };
  }

  refreshRows(): Array<VirtualListRow<T>> {
    const rows = virtualListRows(this.items.peek(), this.selection.state.peek(), this.#capacity.peek(), this.format);
    this.rows.value = rows;
    return rows;
  }

  dispose(): void {
    this.items.unsubscribe(this.#syncLength);
    this.selection.state.unsubscribe(this.#syncRows);
    this.#capacity.unsubscribe(this.#syncRows);
    if (this.#externalSelection) {
      this.selection.state.unsubscribe(this.#syncExternalSelection);
    }
    this.rows.dispose();
    this.#capacity.dispose();
    this.#length.dispose();
    if (this.#ownsItems) this.items.dispose();
    if (this.#ownsSelection) this.selection.dispose();
  }

  private valueOptions<TSelectedValue>(
    options: SelectionValueOptions<T, TSelectedValue>,
  ): SelectionValueOptions<T, TSelectedValue> {
    if (options.valueForItem || !this.valueForItem) return options;
    return {
      ...options,
      valueForItem: this.valueForItem as unknown as (item: T, index: number) => TSelectedValue,
    };
  }
}

/** Public class implementing a virtual List. */
export class VirtualList<T> extends Component {
  readonly items: Signal<T[]>;
  readonly selection: SelectionController;
  readonly format: (item: T, index: number) => string;
  readonly controller: VirtualListController<T>;
  readonly #displayRows: Computed<string[]>;
  readonly #displayBuffer: string[] = [];
  readonly #syncViewportHeight = () => {
    this.controller.setViewportHeight(this.rectangle.peek().height);
  };

  constructor(private readonly listOptions: VirtualListOptions<T>) {
    super(listOptions);
    const ownsController = !listOptions.controller;
    this.controller = listOptions.controller ??
      new VirtualListController({
        items: listOptions.items,
        mode: listOptions.mode,
        selection: listOptions.selection,
        format: listOptions.format,
      });
    this.items = this.controller.items;
    this.selection = this.controller.selection;
    this.format = this.controller.format;
    this.#displayRows = new Computed(() => renderVirtualRowsInto(this.#displayBuffer, this.controller.rows.value));
    this.#syncViewportHeight();
    this.rectangle.subscribe(this.#syncViewportHeight);

    this.on("keyPress", (event) => {
      const item = this.controller.handleKeyPress(event);
      if (item !== undefined) {
        const state = this.selection.state.peek();
        void this.listOptions.onSelect?.(item, state.activeIndex, state);
      }
    });
    this.on("destroy", () => {
      this.rectangle.unsubscribe(this.#syncViewportHeight);
      this.#displayRows.dispose();
      if (ownsController) this.controller.dispose();
    });
  }

  override draw(): void {
    super.draw();
    drawTextRows(this, this.#displayRows);
  }
}

function renderVirtualRowsInto<T>(target: string[], rows: readonly VirtualListRow<T>[]): string[] {
  target.length = rows.length;
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index]!;
    const cursor = row.active ? ">" : " ";
    const marker = row.selected ? "●" : " ";
    target[index] = `${cursor} ${marker} ${row.text}`;
  }
  return target;
}

function virtualListIndexSelected(selected: readonly number[], index: number): boolean {
  for (let offset = 0; offset < selected.length; offset += 1) {
    if (selected[offset] === index) return true;
  }
  return false;
}
