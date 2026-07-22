// Copyright 2023 Im-Beast. MIT license.

import type { Rectangle } from "../../../mod.ts";
import type { MuxstoneBackgroundId } from "./model.ts";

/**
 * Backgrounds that reclaim idle windows. Only the organic/structural fields
 * read well creeping across a terminal; the sun, skull and metaball fields are
 * composed around a focal point and smear into noise when tiled over chrome.
 */
export const MUXSTONE_OVERGROWTH_BACKGROUND_IDS: readonly MuxstoneBackgroundId[] = Object.freeze([
  "jungle",
  "matrix",
  "circuit",
  "ivy",
]);

/** True when the given background participates in inactive-window overgrowth. */
export function muxstoneBackgroundOvergrows(id: MuxstoneBackgroundId): boolean {
  return MUXSTONE_OVERGROWTH_BACKGROUND_IDS.includes(id);
}

/**
 * Fraction of an inactive window the background has reclaimed. Ramps linearly
 * from 0 at the moment focus is lost to MAX_OVERGROWTH_RATIO after `fullMs`.
 */
export const MUXSTONE_MAX_OVERGROWTH_RATIO = 0.82;

/** Computes the reclaim ratio for one window from how long it has been idle. */
export function muxstoneOvergrowthRatio(idleMs: number, fullMs: number): number {
  if (!Number.isFinite(idleMs) || idleMs <= 0) return 0;
  const span = Number.isFinite(fullMs) && fullMs > 0 ? fullMs : 1;
  return Math.min(MUXSTONE_MAX_OVERGROWTH_RATIO, (idleMs / span) * MUXSTONE_MAX_OVERGROWTH_RATIO);
}

/**
 * Per-cell resistance to being reclaimed, in [0, 1]. Cells nearest the window
 * border fall first and the centre holds out longest, so growth reads as
 * creeping inward rather than dissolving uniformly; a stable hash breaks up the
 * contour so the frontier looks organic instead of like a shrinking rectangle.
 */
export function muxstoneOvergrowthThreshold(column: number, row: number, rect: Rectangle): number {
  if (rect.width <= 0 || rect.height <= 0) return 1;
  const insetColumns = Math.min(column - rect.column, rect.column + rect.width - 1 - column);
  const insetRows = Math.min(row - rect.row, rect.row + rect.height - 1 - row);
  if (insetColumns < 0 || insetRows < 0) return 1;
  const reach = Math.max(1, Math.min((rect.width - 1) / 2, (rect.height - 1) / 2));
  const edge = Math.min(1, Math.min(insetColumns, insetRows) / reach);
  return Math.min(1, edge * 0.72 + overgrowthNoise(column, row) * 0.28);
}

/** True when the background has reclaimed this cell at the given ratio. */
export function muxstoneOvergrowthCovers(
  column: number,
  row: number,
  rect: Rectangle,
  ratio: number,
): boolean {
  if (ratio <= 0) return false;
  return muxstoneOvergrowthThreshold(column, row, rect) < ratio;
}

/**
 * True when a reclaimed cell is actually visible. Windows stacked above the
 * reclaimed one clip it, so an idle window's overgrowth can never sprout
 * background characters across the focused window sitting on top of it.
 */
export function muxstoneOvergrowthVisible(
  column: number,
  row: number,
  rect: Rectangle,
  ratio: number,
  occluders: readonly Rectangle[],
): boolean {
  if (!muxstoneOvergrowthCovers(column, row, rect, ratio)) return false;
  for (const occluder of occluders) {
    if (
      column >= occluder.column && column < occluder.column + occluder.width &&
      row >= occluder.row && row < occluder.row + occluder.height
    ) {
      return false;
    }
  }
  return true;
}

/** Stable per-cell hash in [0, 1); no Math.random so frames stay reproducible. */
function overgrowthNoise(column: number, row: number): number {
  let hash = Math.imul(column + 0x9e3779b9, 0x85ebca6b) ^ Math.imul(row + 0x165667b1, 0xc2b2ae35);
  hash = Math.imul(hash ^ (hash >>> 15), 0x2545f491);
  return ((hash >>> 0) % 100_000) / 100_000;
}

/** Tracks how long each window has been unfocused, in wall-clock milliseconds. */
export class MuxstoneOvergrowthTracker {
  readonly #idleSince = new Map<string, number>();

  /** Records the current focus state; the active window resets to zero idle. */
  sync(windowIds: readonly string[], activeWindowId: string | undefined, now: number): void {
    for (const id of windowIds) {
      if (id === activeWindowId) this.#idleSince.delete(id);
      else if (!this.#idleSince.has(id)) this.#idleSince.set(id, now);
    }
    for (const id of [...this.#idleSince.keys()]) {
      if (!windowIds.includes(id)) this.#idleSince.delete(id);
    }
  }

  /** Milliseconds the window has been unfocused, or 0 while it holds focus. */
  idleMs(windowId: string, now: number): number {
    const since = this.#idleSince.get(windowId);
    return since === undefined ? 0 : Math.max(0, now - since);
  }

  /** Drops all tracked idle state, e.g. when overgrowth is switched off. */
  clear(): void {
    this.#idleSince.clear();
  }
}
