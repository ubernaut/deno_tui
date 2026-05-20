import { flexRects } from "./flex.ts";
import type { Rect } from "./types.ts";

export const wizardTabIds = ["overview", "launch", "board", "output", "model", "goal"] as const;
export type WizardTabId = typeof wizardTabIds[number];

export const dashboardPanelIds = ["goal", "progress", "model", "board", "output", "main"] as const;
export type DashboardPanelId = typeof dashboardPanelIds[number];

export const wizardViewportIds = ["tiny", "small", "medium", "large"] as const;
export type WizardViewport = typeof wizardViewportIds[number];

function hiddenRect(): Rect {
  return { column: 0, row: 0, width: 0, height: 0 };
}

function hiddenPanels(): Record<DashboardPanelId, Rect> {
  return {
    goal: hiddenRect(),
    progress: hiddenRect(),
    model: hiddenRect(),
    board: hiddenRect(),
    output: hiddenRect(),
    main: hiddenRect(),
  };
}

export function detectWizardViewport(bounds: Rect): WizardViewport {
  if (bounds.width < 76 || bounds.height < 20) {
    return "tiny";
  }
  if (bounds.width < 100 || bounds.height < 28) {
    return "small";
  }
  if (bounds.width < 136 || bounds.height < 36) {
    return "medium";
  }
  return "large";
}

export function layoutDashboardPanels(
  bounds: Rect,
  viewport: WizardViewport,
  tab: WizardTabId,
): Record<DashboardPanelId, Rect> {
  const panels = hiddenPanels();
  if (bounds.width <= 0 || bounds.height <= 0) {
    return panels;
  }

  if (tab !== "overview" || viewport === "tiny") {
    panels.main = bounds;
    return panels;
  }

  if (viewport === "small") {
    const stack = flexRects(bounds, "column", [
      { id: "goal", basis: 8, grow: 1, min: 7 },
      { id: "board", basis: Math.floor(bounds.height * 0.48), grow: 2, min: 9 },
      { id: "output", basis: 8, grow: 1, min: 6 },
    ], 1);
    panels.goal = stack.goal;
    panels.board = stack.board;
    panels.output = stack.output;
    return panels;
  }

  if (viewport === "medium") {
    const columns = flexRects(bounds, "row", [
      { id: "left", basis: Math.floor(bounds.width * 0.36), grow: 36, min: 30 },
      { id: "right", basis: Math.floor(bounds.width * 0.64), grow: 64, min: 42 },
    ], 1);
    const left = flexRects(columns.left, "column", [
      { id: "goal", basis: 9, grow: 1, min: 8 },
      { id: "progress", basis: 8, grow: 1, min: 7 },
      { id: "model", basis: 10, grow: 1, min: 8 },
    ], 1);
    const right = flexRects(columns.right, "column", [
      { id: "board", basis: Math.floor(bounds.height * 0.58), grow: 3, min: 12 },
      { id: "output", basis: Math.floor(bounds.height * 0.42), grow: 2, min: 8 },
    ], 1);
    panels.goal = left.goal;
    panels.progress = left.progress;
    panels.model = left.model;
    panels.board = right.board;
    panels.output = right.output;
    return panels;
  }

  const columns = flexRects(bounds, "row", [
    { id: "left", basis: Math.floor(bounds.width * 0.28), grow: 28, min: 28 },
    { id: "center", basis: Math.floor(bounds.width * 0.41), grow: 41, min: 44 },
    { id: "right", basis: Math.floor(bounds.width * 0.31), grow: 31, min: 30 },
  ], 1);
  const left = flexRects(columns.left, "column", [
    { id: "goal", basis: 10, grow: 1, min: 8 },
    { id: "progress", basis: 9, grow: 1, min: 8 },
    { id: "model", basis: 10, grow: 1, min: 8 },
  ], 1);
  panels.goal = left.goal;
  panels.progress = left.progress;
  panels.model = left.model;
  panels.board = columns.center;
  panels.output = columns.right;
  return panels;
}
