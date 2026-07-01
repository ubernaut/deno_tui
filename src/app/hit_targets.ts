// Copyright 2023 Im-Beast. MIT license.
import type { Rectangle } from "../types.ts";

/** Hit target record used by pointer routers and immediate-mode workbench renderers. */
export interface HitTarget<Action> {
  rect: Rectangle;
  action: Action;
}

/** LIFO hit target stack where later targets are visually above earlier targets. */
export class HitTargetStack<Action> {
  #targets: Array<HitTarget<Action>> = [];

  get length(): number {
    return this.#targets.length;
  }

  add(rect: Rectangle, action: Action): void {
    this.#targets.push({ rect, action });
  }

  clear(): void {
    this.#targets = [];
  }

  at(index: number): HitTarget<Action> | undefined {
    return this.#targets[index];
  }

  remove(index: number): void {
    this.#targets.splice(index, 1);
  }

  updateRect(index: number, rect: Rectangle): void {
    const target = this.#targets[index];
    if (!target) return;
    target.rect = rect;
  }

  find(x: number, y: number): HitTarget<Action> | undefined {
    for (let index = this.#targets.length - 1; index >= 0; index -= 1) {
      const target = this.#targets[index]!;
      if (contains(target.rect, x, y)) return target;
    }
  }

  entries(): Array<HitTarget<Action>> {
    return this.#targets.map((target) => ({ rect: { ...target.rect }, action: target.action }));
  }
}

/** Options for translating and clipping a suffix of a hit target stack. */
export interface TranslateHitTargetsOptions {
  startIndex: number;
  columnDelta?: number;
  rowDelta?: number;
  clip: Rectangle;
}

/**
 * Translates all hit targets added after a known stack index, clipping or removing targets that leave the viewport.
 */
export function translateHitTargets<Action>(
  targets: HitTargetStack<Action>,
  options: TranslateHitTargetsOptions,
): void {
  const columnDelta = options.columnDelta ?? 0;
  const rowDelta = options.rowDelta ?? 0;
  for (let index = targets.length - 1; index >= options.startIndex; index -= 1) {
    const target = targets.at(index)!;
    const translated = {
      ...target.rect,
      column: target.rect.column + columnDelta,
      row: target.rect.row + rowDelta,
    };
    if (!intersects(translated, options.clip)) {
      targets.remove(index);
      continue;
    }
    targets.updateRect(index, clipRect(translated, options.clip));
  }
}

/** Returns true when a terminal-cell coordinate is inside a rectangle. */
export function contains(rect: Rectangle, x: number, y: number): boolean {
  return x >= rect.column && x < rect.column + rect.width && y >= rect.row && y < rect.row + rect.height;
}

/** Returns true when two rectangles overlap. */
export function intersects(left: Rectangle, right: Rectangle): boolean {
  return left.column < right.column + right.width && left.column + left.width > right.column &&
    left.row < right.row + right.height && left.row + left.height > right.row;
}

/** Clips a rectangle to another rectangle. */
export function clipRect(rect: Rectangle, clip: Rectangle): Rectangle {
  const column = Math.max(rect.column, clip.column);
  const row = Math.max(rect.row, clip.row);
  const right = Math.min(rect.column + rect.width, clip.column + clip.width);
  const bottom = Math.min(rect.row + rect.height, clip.row + clip.height);
  return { column, row, width: Math.max(0, right - column), height: Math.max(0, bottom - row) };
}

/** Insets a rectangle by the same amount on every side. */
export function inset(rect: Rectangle, amount: number): Rectangle {
  return {
    column: rect.column + amount,
    row: rect.row + amount,
    width: Math.max(0, rect.width - amount * 2),
    height: Math.max(0, rect.height - amount * 2),
  };
}
