// Copyright 2023 Im-Beast. MIT license.

import type { Rectangle } from "../../../src/types.ts";
import type { MuxstoneRgb, MuxstoneThemeSpec } from "./model.ts";

/** Shared cadence for every animated desktop background. */
export const MUXSTONE_BACKGROUND_FRAME_INTERVAL_MS = 125;

/** One painted background cell over the theme background color; undefined cells stay blank. */
export interface MuxstoneBackgroundCell {
  readonly char: string;
  readonly foreground: MuxstoneRgb;
  readonly bold?: boolean;
}

/** Pointer position in desktop cell coordinates. */
export interface MuxstoneBackgroundPoint {
  readonly column: number;
  readonly row: number;
}

/** Per-frame simulation inputs shared by every background field. */
export interface MuxstoneBackgroundAdvanceOptions {
  readonly bounds: Rectangle;
  /** Workbench window rects the background may avoid or react to. */
  readonly obstacles?: readonly Rectangle[];
  /** Rect of the focused window; backgrounds may emphasize connections to it. */
  readonly activeObstacle?: Rectangle;
  readonly now?: number;
}

/**
 * Contract every selectable Muxstone desktop background implements. Fields own
 * only deterministic simulation state; the retained painter applies theme
 * colors from the grid returned by `rasterizeCells`.
 */
export interface MuxstoneAnimatedBackground {
  setPointer(point: MuxstoneBackgroundPoint, now?: number): void;
  clearPointer(): void;
  /** Advances the simulation once; returns true when the visible field changed. */
  advance(options: MuxstoneBackgroundAdvanceOptions): boolean;
  /** Row-major cell grid for `bounds`; index [row][column] relative to the rect origin. */
  rasterizeCells(
    bounds: Rectangle,
    theme: MuxstoneThemeSpec,
  ): ReadonlyArray<ReadonlyArray<MuxstoneBackgroundCell | undefined>>;
}

/**
 * Backgrounds that answer clicks on bare desktop. Implementations return true
 * when the click landed on something they own, which claims the event.
 */
export interface MuxstoneInteractiveBackground extends MuxstoneAnimatedBackground {
  /** Handles a click at one desktop cell; true when the field consumed it. */
  pick(column: number, row: number, now?: number): boolean;
}

/** Narrows a background to one that accepts clicks. */
export function muxstoneBackgroundAcceptsPicks(
  field: MuxstoneAnimatedBackground | undefined,
): field is MuxstoneInteractiveBackground {
  return typeof (field as MuxstoneInteractiveBackground | undefined)?.pick === "function";
}

/** Linear blend between two theme colors; `mix` is clamped to [0, 1]. */
export function mixMuxstoneRgb(from: MuxstoneRgb, to: MuxstoneRgb, mix: number): MuxstoneRgb {
  const amount = Math.min(1, Math.max(0, mix));
  return [
    Math.round(from[0] + (to[0] - from[0]) * amount),
    Math.round(from[1] + (to[1] - from[1]) * amount),
    Math.round(from[2] + (to[2] - from[2]) * amount),
  ];
}
