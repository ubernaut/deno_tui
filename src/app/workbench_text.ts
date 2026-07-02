// Copyright 2023 Im-Beast. MIT license.
import { stripStyles, textWidth } from "../utils/strings.ts";

/** Mutable visible menu projection used by render adapters that redraw often. */
export interface VisibleMenuSlice {
  items: string[];
  indexes: number[];
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
  const safeWidth = Math.max(1, width);
  const normalized = compactSpaces(stripStyles(value));
  if (!normalized) return [""];
  const words = normalized.split(" ");
  const rows: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line.length > 0 ? `${line} ${word}` : word;
    if (textWidth(next) <= safeWidth) {
      line = next;
      continue;
    }
    if (line.length > 0) rows.push(line);
    line = textWidth(word) <= safeWidth ? word : fit(word, safeWidth).trimEnd();
  }
  if (line.length > 0) rows.push(line);
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
