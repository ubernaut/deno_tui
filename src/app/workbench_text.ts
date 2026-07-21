// Copyright 2023 Im-Beast. MIT license.
import { stripStyles, textWidth } from "../utils/strings.ts";
import { graphemeBoundaries, previousGraphemeBoundary, truncateGraphemeUtf16 } from "../unicode/grapheme.ts";

/** Mutable visible menu projection used by render adapters that redraw often. */
export interface VisibleMenuSlice {
  items: string[];
  indexes: number[];
}

/** Minimal key event shape for shared single-line workbench prompt editors. */
export interface WorkbenchTextPromptInputEvent {
  key: string;
  ctrl?: boolean;
  meta?: boolean;
}

/** Action selected by {@link applyWorkbenchTextPromptInput}. */
export type WorkbenchTextPromptInputAction = "ignore" | "cancel" | "submit" | "update";

/** Options for applying one key event to a single-line prompt draft. */
export interface WorkbenchTextPromptInputOptions {
  event: WorkbenchTextPromptInputEvent;
  value: string;
  maxLength?: number;
  measureText?: (text: string) => number;
}

/** Result of applying one key event to a single-line prompt draft. */
export interface WorkbenchTextPromptInputResult {
  action: WorkbenchTextPromptInputAction;
  value: string;
}

/** Callbacks for applying a prompt input result to host-owned state. */
export interface WorkbenchTextPromptInputHandlers {
  onCancel?: (value: string) => void;
  onSubmit?: (value: string) => void;
  onUpdate?: (value: string) => void;
}

/** Collapses repeated whitespace to a single display-space. */
export function compactSpaces(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

/** Returns the maximum printable width among raw rows. */
export function maxTextWidth(values: readonly string[]): number {
  let max = 0;
  for (let index = 0; index < values.length; index += 1) {
    max = Math.max(max, textWidth(values[index]!));
  }
  return max;
}

/** Returns the maximum printable width among values projected to display text. */
export function maxTextWidthBy<T>(values: Iterable<T>, project: (value: T) => string): number {
  let max = 0;
  for (const value of values) {
    max = Math.max(max, textWidth(project(value)));
  }
  return max;
}

/** Returns the maximum printable width among non-empty trimmed rows. */
export function maxTrimmedTextWidth(values: readonly string[]): number {
  let max = 0;
  for (let index = 0; index < values.length; index += 1) {
    max = Math.max(max, textWidth(values[index]!.trimEnd()));
  }
  return max;
}

/** Wraps plain text to terminal-cell width after stripping ANSI styles and normalizing whitespace. */
export function wrapPlainText(value: string, width: number, fit: (value: string, width: number) => string): string[] {
  return wrapPlainTextInto([], value, width, fit);
}

/** Wraps plain text into caller-owned row storage. */
export function wrapPlainTextInto(
  rows: string[],
  value: string,
  width: number,
  fit: (value: string, width: number) => string,
): string[] {
  const safeWidth = Math.max(1, width);
  const normalized = compactSpaces(stripStyles(value));
  if (!normalized) {
    rows[0] = "";
    rows.length = 1;
    return rows;
  }
  const words = normalized.split(" ");
  let rowCount = 0;
  let line = "";
  for (const word of words) {
    const next = line.length > 0 ? `${line} ${word}` : word;
    if (textWidth(next) <= safeWidth) {
      line = next;
      continue;
    }
    if (line.length > 0) {
      rows[rowCount] = line;
      rowCount += 1;
    }
    line = textWidth(word) <= safeWidth ? word : fit(word, safeWidth).trimEnd();
  }
  if (line.length > 0) {
    rows[rowCount] = line;
    rowCount += 1;
  }
  rows.length = rowCount;
  return rows;
}

/** Projects a selected item into a bounded visible menu slice with source indexes. */
export function visibleMenuSlice(
  items: readonly string[],
  selectedIndex: number,
  maxItems: number,
): VisibleMenuSlice {
  return visibleMenuSliceInto({ items: [], indexes: [] }, items, selectedIndex, maxItems);
}

/** Projects a selected item into a caller-owned visible menu slice buffer. */
export function visibleMenuSliceInto(
  target: VisibleMenuSlice,
  items: readonly string[],
  selectedIndex: number,
  maxItems: number,
): VisibleMenuSlice {
  return visibleProjectedMenuSliceInto(target, items, selectedIndex, maxItems, (item) => item);
}

/** Projects source values into a caller-owned visible menu slice buffer. */
export function visibleProjectedMenuSliceInto<T>(
  target: VisibleMenuSlice,
  items: readonly T[],
  selectedIndex: number,
  maxItems: number,
  project: (item: T, index: number) => string,
): VisibleMenuSlice {
  const count = Math.max(1, maxItems);
  const visibleCount = Math.min(items.length, count);
  const start = items.length <= count
    ? 0
    : Math.max(0, Math.min(selectedIndex - Math.floor(count / 2), items.length - count));

  target.items.length = visibleCount;
  target.indexes.length = visibleCount;
  for (let offset = 0; offset < visibleCount; offset += 1) {
    const index = start + offset;
    target.items[offset] = project(items[index]!, index);
    target.indexes[offset] = index;
  }
  return target;
}

/** Applies common Escape/Backspace/Return/printable-key behavior for workbench text prompts. */
export function applyWorkbenchTextPromptInput(
  options: WorkbenchTextPromptInputOptions,
): WorkbenchTextPromptInputResult {
  const event = options.event;
  const value = options.value;
  if (event.ctrl || event.meta) return { action: "ignore", value };
  if (event.key === "escape") return { action: "cancel", value };
  if (event.key === "backspace") {
    return { action: "update", value: value.slice(0, previousGraphemeBoundary(value, value.length)) };
  }
  if (event.key === "return") return { action: "submit", value };
  if (graphemeBoundaries(event.key).length === 2 && (options.measureText ?? textWidth)(event.key) === 1) {
    const requestedMaximum = options.maxLength ?? 80;
    const maximum = requestedMaximum === Number.POSITIVE_INFINITY
      ? Number.MAX_SAFE_INTEGER
      : Number.isFinite(requestedMaximum)
      ? Math.min(Number.MAX_SAFE_INTEGER, Math.max(0, Math.floor(requestedMaximum)))
      : 0;
    return {
      action: "update",
      value: truncateGraphemeUtf16(`${value}${event.key}`, maximum),
    };
  }
  return { action: "ignore", value };
}

/** Applies one text-prompt key event and dispatches the resulting host action. */
export function dispatchWorkbenchTextPromptInput(
  options: WorkbenchTextPromptInputOptions,
  handlers: WorkbenchTextPromptInputHandlers,
): boolean {
  const input = applyWorkbenchTextPromptInput(options);
  switch (input.action) {
    case "ignore":
      return false;
    case "cancel":
      handlers.onCancel?.(input.value);
      return true;
    case "submit":
      handlers.onSubmit?.(input.value);
      return true;
    case "update":
      handlers.onUpdate?.(input.value);
      return true;
  }
}
