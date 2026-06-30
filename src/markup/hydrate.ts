// Copyright 2023 Im-Beast. MIT license.
import type { Rectangle } from "../types.ts";
import { createLayoutEngine } from "../layout/engine.ts";
import type { LayoutSolver, LayoutSolverResult } from "../layout/solver.ts";
import { applyCssCascade, type ApplyCssCascadeOptions } from "./cascade.ts";
import { parseCssStylesheet, type TuiCssStylesheet } from "./css.ts";
import { parseTuiMarkup, type TuiMarkupDocument, type TuiMarkupParseOptions } from "./html.ts";
import { hydrateMarkupWidgets, MarkupWidgetHydration, type MarkupWidgetHydrationOptions } from "./widgets.ts";

/** Options for creating a layout result from markup and CSS-like styles. */
export interface MarkupLayoutOptions {
  markup: string;
  css?: string;
  stylesheet?: TuiCssStylesheet;
  bounds: Rectangle;
  solver?: LayoutSolver;
  parse?: TuiMarkupParseOptions;
  cascade?: ApplyCssCascadeOptions;
  widgets?: MarkupWidgetHydrationOptions | false;
}

/** Result of parsing, styling, and laying out markup. */
export interface MarkupLayoutResult {
  document: TuiMarkupDocument;
  styledRoot: TuiMarkupDocument["root"];
  layout: LayoutSolverResult;
  widgets: MarkupWidgetHydration;
}

/** Parses markup, applies CSS-like styles, and computes layout boxes. */
export function createMarkupLayout(options: MarkupLayoutOptions): MarkupLayoutResult {
  const document = parseTuiMarkup(options.markup, options.parse);
  const stylesheet = options.stylesheet ?? parseCssStylesheet(options.css ?? "");
  const styledRoot = applyCssCascade(document.root, stylesheet, options.cascade);
  const layout = createLayoutEngine({ solver: options.solver }).layout({
    root: styledRoot,
    bounds: options.bounds,
  });
  const widgets = options.widgets === false
    ? new MarkupWidgetHydration([])
    : hydrateMarkupWidgets(styledRoot, { layout, ...(options.widgets ?? {}) });
  return { document, styledRoot, layout, widgets };
}
