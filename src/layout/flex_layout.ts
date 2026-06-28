// Copyright 2023 Im-Beast. MIT license.
import type { Rectangle } from "../types.ts";

export interface FlexItem<T extends string = string> {
  id: T;
  basis?: number;
  grow?: number;
  shrink?: number;
  min?: number;
  max?: number;
}

export type FlexDirection = "row" | "column";

const MAX_FLEX_SIZE = Number.MAX_SAFE_INTEGER;

export function flexRects<T extends string>(
  bounds: Rectangle,
  direction: FlexDirection,
  items: readonly FlexItem<T>[],
  gap = 0,
): Record<T, Rectangle> {
  const rects = {} as Record<T, Rectangle>;
  const mainSize = direction === "row" ? bounds.width : bounds.height;
  const crossSize = direction === "row" ? bounds.height : bounds.width;
  const safeGap = Math.max(0, gap);
  const available = Math.max(0, mainSize - Math.max(0, items.length - 1) * safeGap);
  const sizes = solveFlexSizes(available, items);

  let cursor = direction === "row" ? bounds.column : bounds.row;
  for (let index = 0; index < items.length; index += 1) {
    const item = items[index]!;
    const size = sizes[index] ?? 0;
    rects[item.id] = direction === "row"
      ? { column: cursor, row: bounds.row, width: size, height: crossSize }
      : { column: bounds.column, row: cursor, width: crossSize, height: size };
    cursor += size + safeGap;
  }

  return rects;
}

function solveFlexSizes<T extends string>(total: number, items: readonly FlexItem<T>[]) {
  if (items.length === 0 || total <= 0) {
    return items.map(() => 0);
  }

  const minimums = items.map((item) => Math.max(0, Math.floor(item.min ?? 0)));
  const maximums = items.map((item, index) => {
    const rawMax = item.max == null ? MAX_FLEX_SIZE : Math.floor(item.max);
    return Math.max(minimums[index] ?? 0, rawMax);
  });
  const sizes = items.map((item, index) => {
    const min = minimums[index] ?? 0;
    const max = maximums[index] ?? MAX_FLEX_SIZE;
    const basis = item.basis == null ? min : Math.floor(item.basis);
    return Math.min(max, Math.max(min, basis));
  });

  let delta = total - sum(sizes);
  if (delta > 0) {
    distributePositive(sizes, delta, items.map((item) => Math.max(0, item.grow ?? 1)), maximums);
    return sizes;
  }

  if (delta < 0) {
    const weights = items.map((item) => Math.max(0, item.shrink ?? 1));
    delta = -delta;
    distributeNegative(sizes, delta, weights, minimums);

    const overflow = sum(sizes) - total;
    if (overflow > 0) {
      distributeNegative(sizes, overflow, weights, items.map(() => 0));
    }
  }

  return sizes;
}

function distributePositive(sizes: number[], extra: number, weights: number[], maximums: number[]) {
  let remaining = extra;
  while (remaining > 0) {
    const active = sizes
      .map((size, index) => ({ index, room: Math.max(0, (maximums[index] ?? MAX_FLEX_SIZE) - size) }))
      .filter((entry) => entry.room > 0);
    if (active.length === 0) break;

    const totalWeight = active.reduce((sum, entry) => sum + Math.max(1, weights[entry.index] ?? 1), 0);
    let used = 0;
    for (const entry of active) {
      if (remaining <= 0) break;
      const weight = Math.max(1, weights[entry.index] ?? 1);
      let share = Math.floor(remaining * (weight / Math.max(1, totalWeight)));
      if (share <= 0) share = 1;
      const delta = Math.min(entry.room, share, remaining);
      sizes[entry.index] = (sizes[entry.index] ?? 0) + delta;
      remaining -= delta;
      used += delta;
    }

    if (used === 0) break;
  }
}

function distributeNegative(sizes: number[], deficit: number, weights: number[], minimums: number[]) {
  let remaining = deficit;
  while (remaining > 0) {
    const active = sizes
      .map((size, index) => ({ index, room: Math.max(0, size - (minimums[index] ?? 0)) }))
      .filter((entry) => entry.room > 0);
    if (active.length === 0) break;

    const totalWeight = active.reduce((sum, entry) => sum + Math.max(1, weights[entry.index] ?? 1), 0);
    let used = 0;
    for (const entry of active) {
      if (remaining <= 0) break;
      const weight = Math.max(1, weights[entry.index] ?? 1);
      let share = Math.floor(remaining * (weight / Math.max(1, totalWeight)));
      if (share <= 0) share = 1;
      const delta = Math.min(entry.room, share, remaining);
      sizes[entry.index] = (sizes[entry.index] ?? 0) - delta;
      remaining -= delta;
      used += delta;
    }

    if (used === 0) break;
  }
}

function sum(values: number[]) {
  return values.reduce((total, value) => total + value, 0);
}
