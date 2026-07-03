// Copyright 2023 Im-Beast. MIT license.
import { maxTextWidth, maxTextWidthBy } from "../src/app/workbench_text.ts";
import type { Rectangle } from "../src/types.ts";

/** Minimal column metadata needed to estimate API workbench data-table width. */
export interface WorkbenchContentSizeColumn {
  width?: number;
}

/** Static and dynamic inputs used to estimate scrollable workbench window content size. */
export interface WorkbenchContentSizeOptions {
  id: string;
  viewport: Rectangle;
  docs: readonly string[];
  explorerRows: readonly string[];
  dataColumns: readonly WorkbenchContentSizeColumn[];
  dataRowCount: number;
  terminalOutputLines: readonly string[];
  terminalOutputWindowId: string;
  terminalShellWindowId: string;
  isVisualizationWindow: (id: string) => boolean;
  visualizationContentSize: (
    id: string,
    viewport: Rectangle,
    baseWidth: number,
    baseHeight: number,
  ) => WorkbenchContentSize;
}

/** Scrollable content dimensions for a workbench window. */
export interface WorkbenchContentSize {
  width: number;
  height: number;
}

/** Estimates scrollable content size for API workbench windows. */
export function workbenchWindowContentSize(options: WorkbenchContentSizeOptions): WorkbenchContentSize {
  const baseWidth = Math.max(1, Math.floor(options.viewport.width));
  const baseHeight = Math.max(1, Math.floor(options.viewport.height));
  const id = options.id;
  if (id === "explorer") {
    return {
      width: Math.max(baseWidth, maxTextWidth(options.explorerRows) + 2),
      height: Math.max(baseHeight, options.explorerRows.length),
    };
  }
  if (id === "controls") return { width: baseWidth, height: Math.max(baseHeight, 44) };
  if (id === "inspector") return { width: baseWidth, height: Math.max(baseHeight, 18) };
  if (id === "logs") {
    return {
      width: Math.max(baseWidth, maxTextWidth(options.docs) + 2),
      height: Math.max(baseHeight, options.docs.length),
    };
  }
  if (id === "data") {
    return {
      width: Math.max(baseWidth, workbenchDataContentWidth(options.dataColumns)),
      height: Math.max(baseHeight, options.dataRowCount + 4),
    };
  }
  if (id === "three") return { width: baseWidth, height: baseHeight };
  if (id === "htmlLayout") return { width: baseWidth, height: Math.max(baseHeight, 20) };
  if (id === options.terminalShellWindowId) return { width: Math.max(baseWidth, 72), height: Math.max(baseHeight, 24) };
  if (id === options.terminalOutputWindowId) {
    const outputWidth = maxTextWidth(options.terminalOutputLines);
    return {
      width: Math.max(baseWidth, Math.min(120, Math.max(64, outputWidth + 2))),
      height: Math.max(baseHeight, options.terminalOutputLines.length + 4, 16),
    };
  }
  if (options.isVisualizationWindow(id)) {
    return options.visualizationContentSize(id, options.viewport, baseWidth, baseHeight);
  }
  return { width: baseWidth, height: Math.max(baseHeight, 16) };
}

/** Estimates the scrollable width needed for data-table columns. */
export function workbenchDataContentWidth(columns: readonly WorkbenchContentSizeColumn[]): number {
  let width = 8;
  for (let index = 0; index < columns.length; index += 1) {
    width += (columns[index]?.width ?? 12) + 2;
  }
  return width;
}

/** Projects explorer entry text before passing it to {@link workbenchWindowContentSize}. */
export function explorerTextRowsInto<T>(
  target: string[],
  entries: Iterable<T>,
  project: (entry: T) => string,
): string[] {
  target.length = 0;
  for (const entry of entries) target.push(project(entry));
  return target;
}

/** Measures projected text without retaining rows. */
export function projectedTextWidth<T>(values: Iterable<T>, project: (value: T) => string): number {
  return maxTextWidthBy(values, project);
}
