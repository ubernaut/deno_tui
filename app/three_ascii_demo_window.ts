// Copyright 2023 Im-Beast. MIT license.

export interface ThreeAsciiDemoRect {
  column: number;
  row: number;
  width: number;
  height: number;
}

export interface ThreeAsciiDemoWindowOptions {
  terminalWidth: number;
  terminalHeight: number;
  menuVisible: boolean;
  minimized: boolean;
  maximized: boolean;
  menuOuterWidth?: number;
  panelGap?: number;
  minBodyWidth?: number;
}

export type ThreeAsciiDemoTitlebarControl = "minimize" | "maximize" | "restore" | "close";

export const THREE_ASCII_DEMO_WINDOW_CONTROL_TEXT = "[-] [M] [R] [x]";
export const THREE_ASCII_DEMO_WINDOW_CONTROL_WIDTH = 15;

/** Returns whether the standalone Three ASCII side panel should reserve layout space. */
export function threeAsciiDemoSidePanelVisible(
  options: Pick<ThreeAsciiDemoWindowOptions, "menuVisible" | "minimized" | "maximized">,
): boolean {
  return options.menuVisible && !options.maximized && !options.minimized;
}

/** Calculates the standalone Three ASCII renderer window rectangle. */
export function layoutThreeAsciiDemoWindow(options: ThreeAsciiDemoWindowOptions): ThreeAsciiDemoRect {
  const menuOuterWidth = Math.max(0, Math.floor(options.menuOuterWidth ?? 36));
  const panelGap = Math.max(0, Math.floor(options.panelGap ?? 2));
  const minBodyWidth = Math.max(1, Math.floor(options.minBodyWidth ?? 64));
  const terminalWidth = Math.max(0, Math.floor(options.terminalWidth));
  const terminalHeight = Math.max(0, Math.floor(options.terminalHeight));
  const availableWidth = Math.max(0, terminalWidth - 4);
  const reservePanel = threeAsciiDemoSidePanelVisible(options) &&
    terminalWidth >= minBodyWidth + menuOuterWidth + panelGap + 4;

  return {
    column: 2,
    row: 2,
    width: Math.max(1, availableWidth - (reservePanel ? menuOuterWidth + panelGap : 0)),
    height: options.minimized ? 3 : Math.max(10, terminalHeight - 4),
  };
}

/** Calculates the inner renderer body rectangle for a standalone Three ASCII window. */
export function threeAsciiDemoBodyRect(rect: ThreeAsciiDemoRect): ThreeAsciiDemoRect {
  return {
    column: rect.column + 1,
    row: rect.row + 1,
    width: Math.max(1, rect.width - 2),
    height: Math.max(1, rect.height - 2),
  };
}

/** Calculates the title text rectangle for a standalone Three ASCII window. */
export function threeAsciiDemoTitleRect(rect: ThreeAsciiDemoRect): ThreeAsciiDemoRect {
  return {
    column: rect.column + 2,
    row: rect.row,
    width: Math.max(0, rect.width - THREE_ASCII_DEMO_WINDOW_CONTROL_WIDTH - 4),
    height: 1,
  };
}

/** Calculates the titlebar control rectangle, returning width 0 when controls cannot fit. */
export function threeAsciiDemoControlRect(rect: ThreeAsciiDemoRect): ThreeAsciiDemoRect {
  const visible = rect.width >= THREE_ASCII_DEMO_WINDOW_CONTROL_WIDTH + 2;
  return {
    column: rect.column + Math.max(1, rect.width - THREE_ASCII_DEMO_WINDOW_CONTROL_WIDTH - 1),
    row: rect.row,
    width: visible ? THREE_ASCII_DEMO_WINDOW_CONTROL_WIDTH : 0,
    height: 1,
  };
}

/** Resolves a titlebar pointer position to the standalone Three ASCII window control under it. */
export function threeAsciiDemoTitlebarControlAt(
  rect: ThreeAsciiDemoRect,
  x: number,
  y: number,
): ThreeAsciiDemoTitlebarControl | undefined {
  const controls = threeAsciiDemoControlRect(rect);
  if (controls.width <= 0 || y !== controls.row) return undefined;
  if (x >= controls.column && x < controls.column + 3) return "minimize";
  if (x >= controls.column + 4 && x < controls.column + 7) return "maximize";
  if (x >= controls.column + 8 && x < controls.column + 11) return "restore";
  if (x >= controls.column + 12 && x < controls.column + 15) return "close";
  return undefined;
}
