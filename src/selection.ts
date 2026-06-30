// Copyright 2023 Im-Beast. MIT license.
import { Signal } from "./signals/mod.ts";
import { signalify } from "./utils/signals.ts";
import { viewportWindow } from "./viewport.ts";

/** Selection behavior for list-like widgets. */
export type SelectionMode = "single" | "multiple";

/** Index-based selection state shared by lists, tables, trees, and custom browsers. */
export interface SelectionState {
  activeIndex: number;
  anchorIndex: number;
  selected: number[];
}

/** Options for moving the active selection index. */
export interface SelectionMoveOptions {
  mode?: SelectionMode;
  extend?: boolean;
  wrap?: boolean;
}

/** Reactive controller setup for a bounded selection model. */
export interface SelectionControllerOptions {
  length: number | Signal<number>;
  mode?: SelectionMode | Signal<SelectionMode>;
  initialState?: Partial<SelectionState>;
  wrap?: boolean | Signal<boolean>;
}

/** Mapping options for converting selected indices to stable domain values. */
export interface SelectionValueOptions<TItem, TValue = TItem> {
  valueForItem?: (item: TItem, index: number) => TValue;
  equals?: (left: TValue, right: TValue) => boolean;
}

/** Creates normalized selection state for a collection length. */
export function createSelection(length: number, activeIndex = 0, mode: SelectionMode = "single"): SelectionState {
  return normalizeSelection({ activeIndex, anchorIndex: activeIndex, selected: [activeIndex] }, length, mode);
}

/** Public helper for normalize Selection. */
export function normalizeSelection(
  state: Partial<SelectionState>,
  length: number,
  mode: SelectionMode = "single",
): SelectionState {
  const activeIndex = clampSelectionIndex(length, state.activeIndex ?? 0);
  const anchorIndex = clampSelectionIndex(length, state.anchorIndex ?? activeIndex);
  const selected = mode === "single"
    ? (length > 0 ? [activeIndex] : [])
    : uniqueSorted((state.selected ?? [activeIndex]).map((index) => clampSelectionIndex(length, index)))
      .filter((index) => length > 0 && index >= 0 && index < length);

  return { activeIndex, anchorIndex, selected };
}

/** Clamps an index to the valid selection range for a collection length. */
export function clampSelectionIndex(length: number, index: number): number {
  if (length <= 0) return 0;
  return Math.max(0, Math.min(Math.floor(index), length - 1));
}

/** Moves the active index and optionally extends a multiple selection range. */
export function moveSelection(
  state: SelectionState,
  length: number,
  delta: number,
  options: SelectionMoveOptions = {},
): SelectionState {
  const mode = options.mode ?? "single";
  const activeIndex = nextSelectionIndex(length, state.activeIndex, delta, options.wrap ?? false);
  if (mode === "multiple" && options.extend) {
    return selectRange({ ...state, activeIndex }, length, activeIndex);
  }
  return normalizeSelection({ activeIndex, anchorIndex: activeIndex, selected: [activeIndex] }, length, mode);
}

/** Selects one index, replacing single selection or adding to multiple selection. */
export function selectIndex(
  state: SelectionState,
  length: number,
  index: number,
  mode: SelectionMode = "single",
): SelectionState {
  const activeIndex = clampSelectionIndex(length, index);
  if (mode === "single") {
    return normalizeSelection({ activeIndex, anchorIndex: activeIndex, selected: [activeIndex] }, length, mode);
  }
  return normalizeSelection(
    {
      activeIndex,
      anchorIndex: activeIndex,
      selected: uniqueSorted([...state.selected, activeIndex]),
    },
    length,
    mode,
  );
}

/** Toggles an index in multiple-selection state. */
export function toggleSelection(state: SelectionState, length: number, index = state.activeIndex): SelectionState {
  const activeIndex = clampSelectionIndex(length, index);
  const selected = new Set(state.selected);
  if (selected.has(activeIndex)) {
    selected.delete(activeIndex);
  } else {
    selected.add(activeIndex);
  }
  return normalizeSelection(
    {
      activeIndex,
      anchorIndex: activeIndex,
      selected: [...selected],
    },
    length,
    "multiple",
  );
}

/** Selects the inclusive range between the anchor index and target index. */
export function selectRange(state: SelectionState, length: number, toIndex: number): SelectionState {
  const activeIndex = clampSelectionIndex(length, toIndex);
  const anchorIndex = clampSelectionIndex(length, state.anchorIndex);
  const start = Math.min(anchorIndex, activeIndex);
  const end = Math.max(anchorIndex, activeIndex);
  const selected = Array.from({ length: end - start + 1 }, (_, index) => start + index);
  return normalizeSelection({ activeIndex, anchorIndex, selected }, length, "multiple");
}

/** Computes the visible window that should contain the active selection. */
export function selectionWindow(length: number, activeIndex: number, capacity: number): { start: number; end: number } {
  return viewportWindow(length, activeIndex, capacity);
}

/** Returns selected domain values for the selected indices. */
export function selectedValues<TItem, TValue = TItem>(
  items: readonly TItem[],
  state: SelectionState,
  options: SelectionValueOptions<TItem, TValue> = {},
): TValue[] {
  const valueForItem = options.valueForItem ?? ((item: TItem) => item as unknown as TValue);
  return state.selected
    .map((index) => {
      const item = items[index];
      return item === undefined ? undefined : valueForItem(item, index);
    })
    .filter((value): value is TValue => value !== undefined);
}

/** Reconstructs selection state from stable domain values. */
export function selectionFromValues<TItem, TValue = TItem>(
  items: readonly TItem[],
  values: readonly TValue[],
  options: SelectionValueOptions<TItem, TValue> & {
    mode?: SelectionMode;
    fallbackIndex?: number;
  } = {},
): SelectionState {
  const valueForItem = options.valueForItem ?? ((item: TItem) => item as unknown as TValue);
  const equals = options.equals ?? Object.is;
  const selected = values
    .map((value) => items.findIndex((item, index) => equals(valueForItem(item, index), value)))
    .filter((index) => index >= 0);
  const activeIndex = selected[0] ?? clampSelectionIndex(items.length, options.fallbackIndex ?? 0);

  return normalizeSelection(
    {
      activeIndex,
      anchorIndex: activeIndex,
      selected: selected.length > 0 ? selected : [activeIndex],
    },
    items.length,
    options.mode ?? "single",
  );
}

/** Reactive selection controller for reusable keyboard and data widgets. */
export class SelectionController {
  readonly length: Signal<number>;
  readonly mode: Signal<SelectionMode>;
  readonly wrap: Signal<boolean>;
  readonly state: Signal<SelectionState>;
  readonly #ownsLength: boolean;
  readonly #ownsMode: boolean;
  readonly #ownsWrap: boolean;
  readonly #normalize = () => this.normalize();

  /** Creates a controller and subscribes to reactive length/mode changes. */
  constructor(options: SelectionControllerOptions) {
    this.#ownsLength = !(options.length instanceof Signal);
    this.#ownsMode = !(options.mode instanceof Signal);
    this.#ownsWrap = !(options.wrap instanceof Signal);
    this.length = signalify(options.length);
    this.mode = signalify(options.mode ?? "single");
    this.wrap = signalify(options.wrap ?? false);
    this.state = new Signal(normalizeSelection(options.initialState ?? {}, this.length.peek(), this.mode.peek()), {
      deepObserve: true,
    });

    this.length.subscribe(this.#normalize);
    this.mode.subscribe(this.#normalize);
  }

  /** Re-normalizes state after bounds or mode changes. */
  normalize(): void {
    this.state.value = normalizeSelection(this.state.peek(), this.length.peek(), this.mode.peek());
  }

  /** Moves the active index by a delta. */
  move(delta: number, extend = false): void {
    this.state.value = moveSelection(this.state.peek(), this.length.peek(), delta, {
      mode: this.mode.peek(),
      extend,
      wrap: this.wrap.peek(),
    });
  }

  /** Selects an index according to the active selection mode. */
  select(index: number): void {
    this.state.value = selectIndex(this.state.peek(), this.length.peek(), index, this.mode.peek());
  }

  /** Toggles an index in multiple-selection mode. */
  toggle(index = this.state.peek().activeIndex): void {
    this.state.value = toggleSelection(this.state.peek(), this.length.peek(), index);
  }

  /** Selects a range from the anchor index to the target index. */
  range(toIndex: number): void {
    this.state.value = selectRange(this.state.peek(), this.length.peek(), toIndex);
  }

  /** Clears selected indices while preserving the active index. */
  clear(): void {
    this.state.value = normalizeSelection(
      { activeIndex: this.state.peek().activeIndex, selected: [] },
      this.length.peek(),
      "multiple",
    );
  }

  /** Returns a visible window around the active index. */
  window(capacity: number): { start: number; end: number } {
    return selectionWindow(this.length.peek(), this.state.peek().activeIndex, capacity);
  }

  /** Releases owned signals and subscriptions. */
  dispose(): void {
    this.length.unsubscribe(this.#normalize);
    this.mode.unsubscribe(this.#normalize);
    if (this.#ownsLength) this.length.dispose();
    if (this.#ownsMode) this.mode.dispose();
    if (this.#ownsWrap) this.wrap.dispose();
    this.state.dispose();
  }
}

function nextSelectionIndex(length: number, activeIndex: number, delta: number, wrap: boolean): number {
  if (length <= 0) return 0;
  const next = Math.floor(activeIndex) + Math.floor(delta);
  if (!wrap) return clampSelectionIndex(length, next);
  return ((next % length) + length) % length;
}

function uniqueSorted(values: number[]): number[] {
  return [...new Set(values)].sort((left, right) => left - right);
}
