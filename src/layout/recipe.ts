// Copyright 2023 Im-Beast. MIT license.
import type { Rectangle } from "../types.ts";
import { dockRect, insetRect, resolveBreakpoint, splitRect } from "./responsive.ts";

export type LayoutRegionDirection = "row" | "column";
export type LayoutRegionEdge = "top" | "right" | "bottom" | "left";

export interface LayoutRegionLeaf<T extends string = string> {
  id: T;
  hidden?: boolean;
  inset?: number;
  minWidth?: number;
  minHeight?: number;
}

export interface LayoutRegionSplit<T extends string = string> {
  split: LayoutRegionDirection;
  firstSize?: number;
  ratio?: number;
  gap?: number;
  first: LayoutRegion<T>;
  second: LayoutRegion<T>;
}

export interface LayoutRegionDock<T extends string = string> {
  dock: LayoutRegionEdge;
  size: number;
  gap?: number;
  panel: LayoutRegion<T>;
  body: LayoutRegion<T>;
}

export type LayoutRegion<T extends string = string> =
  | LayoutRegionLeaf<T>
  | LayoutRegionSplit<T>
  | LayoutRegionDock<T>;

export interface ResponsiveLayoutRecipe<T extends string = string> {
  breakpoints: readonly { id: string; minWidth?: number; minHeight?: number }[];
  layouts: Record<string, LayoutRegion<T>>;
  fallback?: string;
}

export interface ResolvedLayoutRecipe<T extends string = string> {
  breakpoint: string;
  rects: Partial<Record<T, Rectangle>>;
}

export function resolveLayoutRecipe<T extends string>(
  bounds: Rectangle,
  recipe: ResponsiveLayoutRecipe<T>,
): ResolvedLayoutRecipe<T> {
  const breakpoint = resolveBreakpoint(bounds, recipe.breakpoints);
  const region = recipe.layouts[breakpoint] ?? recipe.layouts[recipe.fallback ?? ""] ?? firstLayout(recipe.layouts);
  const rects: Partial<Record<T, Rectangle>> = {};
  if (region) {
    assignRegionRects(bounds, region, rects);
  }
  return { breakpoint, rects };
}

export function layoutRecipeSlots<T extends string>(region: LayoutRegion<T>): T[] {
  const slots = new Set<T>();
  visitRegion(region, (leaf) => {
    if (!leaf.hidden) slots.add(leaf.id);
  });
  return [...slots];
}

function assignRegionRects<T extends string>(
  bounds: Rectangle,
  region: LayoutRegion<T>,
  rects: Partial<Record<T, Rectangle>>,
): void {
  if ("id" in region) {
    if (region.hidden || bounds.width < (region.minWidth ?? 0) || bounds.height < (region.minHeight ?? 0)) {
      return;
    }
    rects[region.id] = region.inset ? insetRect(bounds, region.inset) : bounds;
    return;
  }

  if ("split" in region) {
    const firstSize = region.firstSize ?? Math.floor(mainSize(bounds, region.split) * clampRatio(region.ratio ?? 0.5));
    const split = splitRect(bounds, region.split, firstSize, region.gap ?? 0);
    assignRegionRects(split.first, region.first, rects);
    assignRegionRects(split.second, region.second, rects);
    return;
  }

  const dock = dockRect(bounds, region.dock, region.size, region.gap ?? 0);
  assignRegionRects(dock.first, region.panel, rects);
  assignRegionRects(dock.second, region.body, rects);
}

function visitRegion<T extends string>(
  region: LayoutRegion<T>,
  visit: (leaf: LayoutRegionLeaf<T>) => void,
): void {
  if ("id" in region) {
    visit(region);
    return;
  }
  if ("split" in region) {
    visitRegion(region.first, visit);
    visitRegion(region.second, visit);
    return;
  }
  visitRegion(region.panel, visit);
  visitRegion(region.body, visit);
}

function firstLayout<T extends string>(layouts: Record<string, LayoutRegion<T>>): LayoutRegion<T> | undefined {
  return Object.values(layouts)[0];
}

function mainSize(bounds: Rectangle, direction: LayoutRegionDirection): number {
  return direction === "row" ? bounds.width : bounds.height;
}

function clampRatio(value: number): number {
  if (Number.isNaN(value)) return 0.5;
  return Math.max(0, Math.min(1, value));
}
