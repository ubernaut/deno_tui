// Copyright 2023 Im-Beast. MIT license.

import type { Rectangle } from "@ubernaut/deno-tui";
import type { ExomuxBackgroundId, ExomuxRgb, ExomuxThemeSpec } from "./model.ts";

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
  /**
   * Every window rect, including ones the desktop has begun reclaiming and so
   * dropped from `obstacles`. Fields that model physical collision read this:
   * an overgrown window still occupies its rectangle, and water pooled on its
   * roof must not fall through the moment the reclaim starts.
   */
  readonly solidObstacles?: readonly Rectangle[];
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
  /**
   * True when the field owns this cell even though a window covers it. Fields
   * that paint a fixture into the post-window overlay — the rain drain plug —
   * opt in here; without it a window tiled over the fixture eats the click.
   */
  picksOverWindows?(column: number, row: number): boolean;
}

/** Narrows a background to one that accepts clicks. */
export function exomuxBackgroundAcceptsPicks(
  field: ExomuxAnimatedBackground | undefined,
): field is ExomuxInteractiveBackground {
  return typeof (field as ExomuxInteractiveBackground | undefined)?.pick === "function";
}

/**
 * Backgrounds built from a catalog of presets the user can step through.
 *
 * Auto-cycling is the default, but a field with hundreds of presets needs a way
 * to move on from one you do not like without waiting out its slot.
 */
export interface ExomuxPresetBackground extends ExomuxAnimatedBackground {
  /** Index of the preset on screen, within this field's own rotation. */
  readonly presetIndex: number;
  readonly presetName: string;
  readonly presetCount: number;
  /** Selects a preset by rotation index, wrapping in both directions. */
  selectPreset(index: number): void;
  /**
   * Moves through the field's own play order by `delta`.
   *
   * Distinct from `selectPreset(presetIndex + delta)`, which assumes the order
   * is the catalog's. A field that shuffles steps back through what it actually
   * showed, not to a catalog neighbour nobody has seen.
   */
  stepPreset?(delta: number): void;
}

/** Narrows a background to one the user can step through. */
export function exomuxBackgroundHasPresets(
  field: ExomuxAnimatedBackground | undefined,
): field is ExomuxPresetBackground {
  return typeof (field as ExomuxPresetBackground | undefined)?.selectPreset === "function";
}

/** A background field that holds a resource it must give back when idle. */
export interface ExomuxDisposableBackground extends ExomuxAnimatedBackground {
  dispose(): void;
}

/** Narrows a background to one that owns a releasable resource. */
export function exomuxBackgroundIsDisposable(
  field: ExomuxAnimatedBackground | undefined,
): field is ExomuxDisposableBackground {
  return typeof (field as ExomuxDisposableBackground | undefined)?.dispose === "function";
}

/**
 * Disposes and drops every cached field except `keep`, in place.
 *
 * The desktop caches one field per background so switching away and back
 * resumes the same simulation rather than restarting it. That is only safe for
 * fields made of plain arithmetic: one that owns an operating-system handle —
 * the butterchurn field opens the microphone — has to give it back the moment
 * the desktop stops drawing it, which is what this enforces. Fields with no
 * `dispose` are left cached, so the resume behavior is unchanged for them.
 */
export function releaseExomuxIdleBackgrounds(
  fields: Map<ExomuxBackgroundId, ExomuxAnimatedBackground>,
  keep?: ExomuxBackgroundId,
): void {
  for (const [id, field] of fields) {
    if (id === keep || !exomuxBackgroundIsDisposable(field)) continue;
    field.dispose();
    fields.delete(id);
  }
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
