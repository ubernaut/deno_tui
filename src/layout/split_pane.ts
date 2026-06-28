// Copyright 2023 Im-Beast. MIT license.
import type { Rectangle } from "../types.ts";

export type SplitPaneDirection = "row" | "column";

export interface SplitPaneOptions {
  direction: SplitPaneDirection;
  ratio?: number;
  firstSize?: number;
  minFirst?: number;
  minSecond?: number;
  maxFirst?: number;
  gap?: number;
}

export interface SplitPaneRects {
  first: Rectangle;
  separator: Rectangle;
  second: Rectangle;
  firstSize: number;
  ratio: number;
}

export function splitPaneRects(bounds: Rectangle, options: SplitPaneOptions): SplitPaneRects {
  const direction = options.direction;
  const mainSize = direction === "row" ? bounds.width : bounds.height;
  const crossSize = direction === "row" ? bounds.height : bounds.width;
  const gap = Math.max(0, Math.floor(options.gap ?? 1));
  const available = Math.max(0, mainSize - gap);
  const firstSize = resolveFirstPaneSize(available, options);
  const secondSize = Math.max(0, available - firstSize);

  if (direction === "row") {
    const separatorColumn = bounds.column + firstSize;
    return {
      first: { column: bounds.column, row: bounds.row, width: firstSize, height: crossSize },
      separator: { column: separatorColumn, row: bounds.row, width: gap, height: crossSize },
      second: { column: separatorColumn + gap, row: bounds.row, width: secondSize, height: crossSize },
      firstSize,
      ratio: ratioFor(firstSize, available),
    };
  }

  const separatorRow = bounds.row + firstSize;
  return {
    first: { column: bounds.column, row: bounds.row, width: crossSize, height: firstSize },
    separator: { column: bounds.column, row: separatorRow, width: crossSize, height: gap },
    second: { column: bounds.column, row: separatorRow + gap, width: crossSize, height: secondSize },
    firstSize,
    ratio: ratioFor(firstSize, available),
  };
}

export function resizeSplitPane(bounds: Rectangle, options: SplitPaneOptions, delta: number): SplitPaneOptions {
  const current = splitPaneRects(bounds, options);
  return {
    ...options,
    firstSize: resolveFirstPaneSize(
      paneAvailableSize(bounds, options.direction, options.gap),
      { ...options, firstSize: current.firstSize + Math.floor(delta) },
    ),
  };
}

function resolveFirstPaneSize(available: number, options: SplitPaneOptions): number {
  if (available <= 0) return 0;
  const minFirst = Math.max(0, Math.floor(options.minFirst ?? 0));
  const minSecond = Math.max(0, Math.floor(options.minSecond ?? 0));
  const maxBySecond = Math.max(0, available - minSecond);
  const maxFirst = Math.min(maxBySecond, Math.max(minFirst, Math.floor(options.maxFirst ?? available)));
  const requested = options.firstSize == null
    ? Math.floor(available * clampRatio(options.ratio ?? 0.5))
    : Math.floor(options.firstSize);

  return Math.max(0, Math.min(maxFirst, Math.max(minFirst, requested)));
}

function paneAvailableSize(bounds: Rectangle, direction: SplitPaneDirection, gap = 1): number {
  const mainSize = direction === "row" ? bounds.width : bounds.height;
  return Math.max(0, mainSize - Math.max(0, Math.floor(gap)));
}

function ratioFor(size: number, available: number): number {
  return available <= 0 ? 0 : size / available;
}

function clampRatio(value: number): number {
  if (Number.isNaN(value)) return 0.5;
  return Math.max(0, Math.min(1, value));
}
