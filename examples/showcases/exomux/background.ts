// Copyright 2023 Im-Beast. MIT license.

import type { Rectangle } from "../../../src/types.ts";
import type { ExomuxRgb, ExomuxThemeSpec } from "./model.ts";

/** Shared cadence for every animated desktop background. */
export const EXOMUX_BACKGROUND_FRAME_INTERVAL_MS = 125;

/** One painted background cell over the theme background color; undefined cells stay blank. */
export interface ExomuxBackgroundCell {
  readonly char: string;
  readonly foreground: ExomuxRgb;
  readonly bold?: boolean;
}

/** Pointer position in desktop cell coordinates. */
export interface ExomuxBackgroundPoint {
  readonly column: number;
  readonly row: number;
}

/** Per-frame simulation inputs shared by every background field. */
export interface ExomuxBackgroundAdvanceOptions {
  readonly bounds: Rectangle;
  /** Workbench window rects the background may avoid or react to. */
  readonly obstacles?: readonly Rectangle[];
  /** Rect of the focused window; backgrounds may emphasize connections to it. */
  readonly activeObstacle?: Rectangle;
  readonly now?: number;
}

/**
 * Contract every selectable Exomux desktop background implements. Fields own
 * only deterministic simulation state; the retained painter applies theme
 * colors from the grid returned by `rasterizeCells`.
 */
export interface ExomuxAnimatedBackground {
  setPointer(point: ExomuxBackgroundPoint, now?: number): void;
  clearPointer(): void;
  /** Advances the simulation once; returns true when the visible field changed. */
  advance(options: ExomuxBackgroundAdvanceOptions): boolean;
  /** Row-major cell grid for `bounds`; index [row][column] relative to the rect origin. */
  rasterizeCells(
    bounds: Rectangle,
    theme: ExomuxThemeSpec,
  ): ReadonlyArray<ReadonlyArray<ExomuxBackgroundCell | undefined>>;
}

/** A single positioned cell for post-window overlay painting. */
export interface ExomuxOverlayCell {
  /** Column relative to the bounds origin. */
  readonly column: number;
  /** Row relative to the bounds origin. */
  readonly row: number;
  readonly cell: ExomuxBackgroundCell;
}

/**
 * Backgrounds that paint effects on top of window chrome (puddles, drizzle,
 * splashes). The overlay is rendered after all windows so it stays visible
 * even when tiled windows cover the background grid.
 */
export interface ExomuxOverlayBackground extends ExomuxAnimatedBackground {
  rasterizeOverlayCells(
    bounds: Rectangle,
    theme: ExomuxThemeSpec,
  ): readonly ExomuxOverlayCell[];
}

/** Narrows a background to one that paints post-window overlays. */
export function exomuxBackgroundHasOverlay(
  field: ExomuxAnimatedBackground | undefined,
): field is ExomuxOverlayBackground {
  return typeof (field as ExomuxOverlayBackground | undefined)?.rasterizeOverlayCells === "function";
}

/**
 * Backgrounds that answer clicks on bare desktop. Implementations return true
 * when the click landed on something they own, which claims the event.
 */
export interface ExomuxInteractiveBackground extends ExomuxAnimatedBackground {
  /** Handles a click at one desktop cell; true when the field consumed it. */
  pick(column: number, row: number, now?: number): boolean;
}

/** Narrows a background to one that accepts clicks. */
export function exomuxBackgroundAcceptsPicks(
  field: ExomuxAnimatedBackground | undefined,
): field is ExomuxInteractiveBackground {
  return typeof (field as ExomuxInteractiveBackground | undefined)?.pick === "function";
}

/** Linear blend between two theme colors; `mix` is clamped to [0, 1]. */
export function mixExomuxRgb(from: ExomuxRgb, to: ExomuxRgb, mix: number): ExomuxRgb {
  const amount = Math.min(1, Math.max(0, mix));
  return [
    Math.round(from[0] + (to[0] - from[0]) * amount),
    Math.round(from[1] + (to[1] - from[1]) * amount),
    Math.round(from[2] + (to[2] - from[2]) * amount),
  ];
}
