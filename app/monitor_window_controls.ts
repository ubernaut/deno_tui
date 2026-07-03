import type { Rect } from "./types.ts";

export const MONITOR_WINDOW_CONTROL_TEXT = "[-] [□] [↺] [x]";
export const MONITOR_WINDOW_CONTROL_WIDTH = 15;
export const MONITOR_WINDOW_CONTROL_MIN_WIDTH = MONITOR_WINDOW_CONTROL_WIDTH + 1;

export type MonitorWindowControl = "minimize" | "maximize" | "restore" | "close";

/** Returns whether compact monitor window controls fit in a panel titlebar. */
export function monitorWindowControlsVisible(rect: Pick<Rect, "width" | "height">): boolean {
  return rect.width >= MONITOR_WINDOW_CONTROL_MIN_WIDTH && rect.height >= 1;
}

/** Calculates the monitor window control strip rectangle, returning width 0 when it cannot fit. */
export function monitorWindowControlRect(rect: Rect): Rect {
  const visible = monitorWindowControlsVisible(rect);
  return {
    column: visible ? rect.column + Math.max(0, rect.width - MONITOR_WINDOW_CONTROL_MIN_WIDTH) : 0,
    row: visible ? rect.row : 0,
    width: visible ? MONITOR_WINDOW_CONTROL_WIDTH : 0,
    height: visible ? 1 : 0,
  };
}

/** Resolves a point in the monitor titlebar to the compact control it hits. */
export function monitorWindowControlAt(rect: Rect, x: number, y: number): MonitorWindowControl | undefined {
  const controls = monitorWindowControlRect(rect);
  if (controls.width <= 0 || y !== controls.row) return undefined;
  if (x >= controls.column && x < controls.column + 3) return "minimize";
  if (x >= controls.column + 4 && x < controls.column + 7) return "maximize";
  if (x >= controls.column + 8 && x < controls.column + 11) return "restore";
  if (x >= controls.column + 12 && x < controls.column + 15) return "close";
  return undefined;
}
