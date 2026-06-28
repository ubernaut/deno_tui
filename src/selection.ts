// Copyright 2023 Im-Beast. MIT license.
import { Signal } from "./signals/mod.ts";
import { signalify } from "./utils/signals.ts";

export type SelectionMode = "single" | "multiple";

export interface SelectionState {
  activeIndex: number;
  anchorIndex: number;
  selected: number[];
}

export interface SelectionMoveOptions {
  mode?: SelectionMode;
  extend?: boolean;
  wrap?: boolean;
}

export interface SelectionControllerOptions {
  length: number | Signal<number>;
  mode?: SelectionMode | Signal<SelectionMode>;
  initialState?: Partial<SelectionState>;
  wrap?: boolean | Signal<boolean>;
}

export function createSelection(length: number, activeIndex = 0, mode: SelectionMode = "single"): SelectionState {
  return normalizeSelection({ activeIndex, anchorIndex: activeIndex, selected: [activeIndex] }, length, mode);
}

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

export function clampSelectionIndex(length: number, index: number): number {
  if (length <= 0) return 0;
  return Math.max(0, Math.min(Math.floor(index), length - 1));
}

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

export function selectRange(state: SelectionState, length: number, toIndex: number): SelectionState {
  const activeIndex = clampSelectionIndex(length, toIndex);
  const anchorIndex = clampSelectionIndex(length, state.anchorIndex);
  const start = Math.min(anchorIndex, activeIndex);
  const end = Math.max(anchorIndex, activeIndex);
  const selected = Array.from({ length: end - start + 1 }, (_, index) => start + index);
  return normalizeSelection({ activeIndex, anchorIndex, selected }, length, "multiple");
}

export function selectionWindow(length: number, activeIndex: number, capacity: number): { start: number; end: number } {
  const safeCapacity = Math.max(0, Math.floor(capacity));
  if (length <= 0 || safeCapacity <= 0) return { start: 0, end: 0 };
  const active = clampSelectionIndex(length, activeIndex);
  const start = Math.max(0, Math.min(active - Math.floor(safeCapacity / 2), Math.max(0, length - safeCapacity)));
  return { start, end: Math.min(length, start + safeCapacity) };
}

export class SelectionController {
  readonly length: Signal<number>;
  readonly mode: Signal<SelectionMode>;
  readonly wrap: Signal<boolean>;
  readonly state: Signal<SelectionState>;

  constructor(options: SelectionControllerOptions) {
    this.length = signalify(options.length);
    this.mode = signalify(options.mode ?? "single");
    this.wrap = signalify(options.wrap ?? false);
    this.state = new Signal(normalizeSelection(options.initialState ?? {}, this.length.peek(), this.mode.peek()), {
      deepObserve: true,
    });

    this.length.subscribe(() => this.normalize());
    this.mode.subscribe(() => this.normalize());
  }

  normalize(): void {
    this.state.value = normalizeSelection(this.state.peek(), this.length.peek(), this.mode.peek());
  }

  move(delta: number, extend = false): void {
    this.state.value = moveSelection(this.state.peek(), this.length.peek(), delta, {
      mode: this.mode.peek(),
      extend,
      wrap: this.wrap.peek(),
    });
  }

  select(index: number): void {
    this.state.value = selectIndex(this.state.peek(), this.length.peek(), index, this.mode.peek());
  }

  toggle(index = this.state.peek().activeIndex): void {
    this.state.value = toggleSelection(this.state.peek(), this.length.peek(), index);
  }

  range(toIndex: number): void {
    this.state.value = selectRange(this.state.peek(), this.length.peek(), toIndex);
  }

  clear(): void {
    this.state.value = normalizeSelection(
      { activeIndex: this.state.peek().activeIndex, selected: [] },
      this.length.peek(),
      "multiple",
    );
  }

  window(capacity: number): { start: number; end: number } {
    return selectionWindow(this.length.peek(), this.state.peek().activeIndex, capacity);
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
