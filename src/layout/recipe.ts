// Copyright 2023 Im-Beast. MIT license.
import type { Rectangle } from "../types.ts";
import { Computed, Signal } from "../signals/mod.ts";
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

/** Static metadata for one responsive layout recipe breakpoint. */
export interface LayoutRecipeBreakpointInspection<T extends string = string> {
  id: string;
  minWidth?: number;
  minHeight?: number;
  hasLayout: boolean;
  slots: T[];
}

/** Static metadata for a responsive layout recipe. */
export interface LayoutRecipeInspection<T extends string = string> {
  breakpoints: LayoutRecipeBreakpointInspection<T>[];
  fallback?: string;
  layoutIds: string[];
  slotIds: T[];
  missingLayouts: string[];
}

/** Options for formatting a responsive layout recipe as Markdown. */
export interface LayoutRecipeMarkdownOptions {
  title?: string;
  includeSummary?: boolean;
}

export interface LayoutRecipeControllerInspection<T extends string = string> extends ResolvedLayoutRecipe<T> {
  slots: T[];
}

export class LayoutRecipeController<T extends string = string> {
  readonly bounds: Signal<Rectangle>;
  readonly resolved: Computed<ResolvedLayoutRecipe<T>>;
  readonly breakpoint: Computed<string>;
  readonly rects: Computed<Partial<Record<T, Rectangle>>>;
  readonly #ownsBounds: boolean;

  constructor(
    bounds: Rectangle | Signal<Rectangle>,
    readonly recipe: ResponsiveLayoutRecipe<T>,
  ) {
    this.bounds = bounds instanceof Signal ? bounds : new Signal(bounds);
    this.#ownsBounds = !(bounds instanceof Signal);
    this.resolved = new Computed(() => resolveLayoutRecipe(this.bounds.value, this.recipe));
    this.breakpoint = new Computed(() => this.resolved.value.breakpoint);
    this.rects = new Computed(() => this.resolved.value.rects);
  }

  update(bounds: Rectangle): void {
    this.bounds.value = bounds;
  }

  rect(id: T): Computed<Rectangle | undefined> {
    return new Computed(() => this.rects.value[id]);
  }

  slots(breakpoint = this.breakpoint.peek()): T[] {
    const region = this.recipe.layouts[breakpoint] ?? this.recipe.layouts[this.recipe.fallback ?? ""] ??
      firstLayout(this.recipe.layouts);
    return region ? layoutRecipeSlots(region) : [];
  }

  inspect(): LayoutRecipeControllerInspection<T> {
    const resolved = this.resolved.peek();
    return {
      ...resolved,
      slots: this.slots(resolved.breakpoint),
    };
  }

  dispose(): void {
    this.resolved.dispose();
    this.breakpoint.dispose();
    this.rects.dispose();
    if (this.#ownsBounds) {
      this.bounds.dispose();
    }
  }
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

/** Inspects breakpoint coverage and visible slot ids for a responsive layout recipe. */
export function inspectLayoutRecipe<T extends string>(
  recipe: ResponsiveLayoutRecipe<T>,
): LayoutRecipeInspection<T> {
  const layoutIds = Object.keys(recipe.layouts).sort();
  const breakpoints = recipe.breakpoints.map((breakpoint) => {
    const layout = recipe.layouts[breakpoint.id];
    return {
      id: breakpoint.id,
      minWidth: breakpoint.minWidth,
      minHeight: breakpoint.minHeight,
      hasLayout: layout !== undefined,
      slots: layout ? layoutRecipeSlots(layout) : [],
    };
  });
  const slotIds = uniqueSlots(layoutIds.flatMap((id) => layoutRecipeSlots(recipe.layouts[id]!)));
  return {
    breakpoints,
    fallback: recipe.fallback,
    layoutIds,
    slotIds,
    missingLayouts: recipe.breakpoints
      .map((breakpoint) => breakpoint.id)
      .filter((id) => recipe.layouts[id] === undefined),
  };
}

/** Formats responsive layout recipe metadata as a Markdown table. */
export function formatLayoutRecipeMarkdown<T extends string>(
  recipe: ResponsiveLayoutRecipe<T>,
  options: LayoutRecipeMarkdownOptions = {},
): string {
  const inspection = inspectLayoutRecipe(recipe);
  const lines: string[] = [];
  lines.push(`# ${options.title ?? "Layout Recipe"}`);
  lines.push("");

  if (options.includeSummary ?? true) {
    lines.push(`Breakpoints: ${inspection.breakpoints.length}`);
    lines.push(`Layouts: ${inspection.layoutIds.join(", ") || "none"}`);
    lines.push(`Slots: ${inspection.slotIds.join(", ") || "none"}`);
    if (inspection.missingLayouts.length > 0) {
      lines.push(`Missing layouts: ${inspection.missingLayouts.join(", ")}`);
    }
    lines.push("");
  }

  lines.push("| Breakpoint | Min size | Layout | Slots |");
  lines.push("| --- | --- | --- | --- |");
  for (const breakpoint of inspection.breakpoints) {
    const minSize = [
      breakpoint.minWidth === undefined ? undefined : `w>=${breakpoint.minWidth}`,
      breakpoint.minHeight === undefined ? undefined : `h>=${breakpoint.minHeight}`,
    ].filter((value): value is string => value !== undefined).join(" ");
    lines.push(
      `| ${breakpoint.id} | ${minSize || "default"} | ${breakpoint.hasLayout ? "yes" : "no"} | ${
        breakpoint.slots.join(", ") || "none"
      } |`,
    );
  }

  return lines.join("\n");
}

export function createLayoutRecipeController<T extends string>(
  bounds: Rectangle | Signal<Rectangle>,
  recipe: ResponsiveLayoutRecipe<T>,
): LayoutRecipeController<T> {
  return new LayoutRecipeController(bounds, recipe);
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

function uniqueSlots<T extends string>(slots: readonly T[]): T[] {
  return [...new Set(slots)].sort();
}

function mainSize(bounds: Rectangle, direction: LayoutRegionDirection): number {
  return direction === "row" ? bounds.width : bounds.height;
}

function clampRatio(value: number): number {
  if (Number.isNaN(value)) return 0.5;
  return Math.max(0, Math.min(1, value));
}
