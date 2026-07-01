// Copyright 2023 Im-Beast. MIT license.
import { stripStyles, textWidth } from "../utils/strings.ts";

/** Collapses repeated whitespace to a single display-space. */
export function compactSpaces(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

/** Returns the maximum printable width among raw rows. */
export function maxTextWidth(values: readonly string[]): number {
  return values.reduce((max, value) => Math.max(max, textWidth(value)), 0);
}

/** Returns the maximum printable width among non-empty trimmed rows. */
export function maxTrimmedTextWidth(values: readonly string[]): number {
  return values.reduce((max, value) => Math.max(max, textWidth(value.trimEnd())), 0);
}

/** Wraps plain text to terminal-cell width after stripping ANSI styles and normalizing whitespace. */
export function wrapPlainText(value: string, width: number, fit: (value: string, width: number) => string): string[] {
  const safeWidth = Math.max(1, width);
  const words = stripStyles(value).replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  if (words.length === 0) return [""];
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
): { items: string[]; indexes: number[] } {
  const count = Math.max(1, maxItems);
  if (items.length <= count) {
    return { items: [...items], indexes: items.map((_, index) => index) };
  }
  const start = Math.max(0, Math.min(selectedIndex - Math.floor(count / 2), items.length - count));
  return {
    items: items.slice(start, start + count),
    indexes: Array.from({ length: count }, (_, index) => start + index),
  };
}
