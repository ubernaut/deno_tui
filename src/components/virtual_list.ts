// Copyright 2023 Im-Beast. MIT license.
import type { TextRectangle } from "../canvas/text.ts";
import { Component, type ComponentOptions } from "../component.ts";
import { SelectionController, type SelectionMode, type SelectionState, selectionWindow } from "../selection.ts";
import { Computed, Signal } from "../signals/mod.ts";
import { signalify } from "../utils/signals.ts";
import { Text } from "./text.ts";

export interface VirtualListRow<T> {
  item: T;
  index: number;
  active: boolean;
  selected: boolean;
  text: string;
}

export interface VirtualListOptions<T> extends ComponentOptions {
  items: T[] | Signal<T[]>;
  mode?: SelectionMode | Signal<SelectionMode>;
  selection?: SelectionController | Signal<SelectionState>;
  format?: (item: T, index: number) => string;
  onSelect?: (item: T, index: number, state: SelectionState) => void | Promise<void>;
}

export function virtualListRows<T>(
  items: readonly T[],
  state: SelectionState,
  height: number,
  format: (item: T, index: number) => string = String,
): VirtualListRow<T>[] {
  const window = selectionWindow(items.length, state.activeIndex, height);
  const selected = new Set(state.selected);
  return items.slice(window.start, window.end).map((item, offset) => {
    const index = window.start + offset;
    return {
      item,
      index,
      active: index === state.activeIndex,
      selected: selected.has(index),
      text: format(item, index),
    };
  });
}

export function renderVirtualListRows<T>(
  items: readonly T[],
  state: SelectionState,
  height: number,
  format?: (item: T, index: number) => string,
): string[] {
  return virtualListRows(items, state, height, format).map((row) => {
    const cursor = row.active ? ">" : " ";
    const marker = row.selected ? "●" : " ";
    return `${cursor} ${marker} ${row.text}`;
  });
}

export class VirtualList<T> extends Component {
  readonly items: Signal<T[]>;
  readonly selection: SelectionController;
  readonly format: (item: T, index: number) => string;

  constructor(private readonly listOptions: VirtualListOptions<T>) {
    super(listOptions);
    this.items = signalify(listOptions.items, { deepObserve: true });
    this.format = listOptions.format ?? ((item) => String(item));
    this.selection = listOptions.selection instanceof SelectionController
      ? listOptions.selection
      : new SelectionController({
        length: new Computed(() => this.items.value.length),
        mode: listOptions.mode ?? "single",
        initialState: listOptions.selection instanceof Signal ? listOptions.selection.peek() : undefined,
      });

    const externalSelection = listOptions.selection instanceof Signal ? listOptions.selection : undefined;
    if (externalSelection) {
      this.selection.state.subscribe((state) => {
        externalSelection.value = state;
      });
    }

    this.on("keyPress", ({ key, ctrl, meta, shift }) => {
      if (ctrl || meta) return;
      if (key === "up") this.selection.move(-1, shift);
      else if (key === "down") this.selection.move(1, shift);
      else if (key === "pageup") this.selection.move(-Math.max(1, this.rectangle.peek().height), shift);
      else if (key === "pagedown") this.selection.move(Math.max(1, this.rectangle.peek().height), shift);
      else if (key === "home") this.selection.select(0);
      else if (key === "end") this.selection.select(this.items.peek().length - 1);
      else if (key === "space") this.selection.toggle();
      else if (key === "return") {
        const state = this.selection.state.peek();
        const item = this.items.peek()[state.activeIndex];
        if (item !== undefined) {
          void this.listOptions.onSelect?.(item, state.activeIndex, state);
        }
      }
    });
  }

  override draw(): void {
    super.draw();
    const rows = new Computed(() =>
      renderVirtualListRows(
        this.items.value,
        this.selection.state.value,
        this.rectangle.value.height,
        this.format,
      )
    );
    Array.from({ length: this.rectangle.peek().height }, (_, index) => {
      const row = new Text({
        parent: this,
        theme: this.theme,
        zIndex: this.zIndex,
        text: new Computed(() => rows.value[index] ?? ""),
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
