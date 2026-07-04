import type { Rectangle } from "../src/types.ts";
import { clipRect } from "../src/app/hit_targets.ts";

export interface WorkbenchThreeRectTarget {
  peek(): Rectangle;
  value: Rectangle;
}

export interface WorkbenchWindowRenderContext {
  viewport: Rectangle;
  offset: { columns: number; rows: number };
}

export interface WorkbenchPlacementContext {
  rowDelta: number;
  columnDelta: number;
  clip: Rectangle;
}

export interface WorkbenchThreeGraphicsRectOptions {
  rect: Rectangle;
  window?: WorkbenchWindowRenderContext | null;
  workspace?: WorkbenchPlacementContext | null;
}

export interface WorkbenchThreeContentGraphicsRectOptions {
  window?: WorkbenchWindowRenderContext | null;
  workspace?: WorkbenchPlacementContext | null;
}

export function setWorkbenchThreeRect(target: WorkbenchThreeRectTarget, rect: Rectangle): boolean {
  const current = target.peek();
  if (
    current.column === rect.column && current.row === rect.row && current.width === rect.width &&
    current.height === rect.height
  ) {
    return false;
  }
  target.value = rect;
  return true;
}

export function workbenchThreeGraphicsRect(options: WorkbenchThreeGraphicsRectOptions): Rectangle {
  const rect = options.rect;
  const window = options.window;
  if (!window) return rect;

  const windowRect = {
    column: window.viewport.column + rect.column - window.offset.columns,
    row: window.viewport.row + rect.row - window.offset.rows,
    width: rect.width,
    height: rect.height,
  };
  const visibleInWindow = clipRect(windowRect, window.viewport);
  if (visibleInWindow.width !== rect.width || visibleInWindow.height !== rect.height) {
    return hiddenGraphicsRect(visibleInWindow);
  }

  const workspace = options.workspace;
  if (!workspace) return windowRect;
  const screenRect = {
    ...windowRect,
    column: windowRect.column + workspace.columnDelta,
    row: windowRect.row + workspace.rowDelta,
  };
  const visibleOnScreen = clipRect(screenRect, workspace.clip);
  if (visibleOnScreen.width !== rect.width || visibleOnScreen.height !== rect.height) {
    return hiddenGraphicsRect(visibleOnScreen);
  }
  return screenRect;
}

export function workbenchThreeContentGraphicsRect(
  rect: Rectangle,
  options: WorkbenchThreeContentGraphicsRectOptions = {},
): Rectangle {
  return workbenchThreeGraphicsRect({
    rect,
    window: options.window,
    workspace: options.workspace,
  });
}

function hiddenGraphicsRect(visible: Rectangle): Rectangle {
  return { column: visible.column, row: visible.row, width: 0, height: 0 };
}
