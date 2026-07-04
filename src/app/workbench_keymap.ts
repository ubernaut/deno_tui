// Copyright 2023 Im-Beast. MIT license.

/** Minimal key event shape for global workbench key resolution. */
export interface WorkbenchGlobalKey {
  key: string;
  ctrl?: boolean;
  meta?: boolean;
  shift?: boolean;
}

/** Global workbench key actions that are renderer-neutral but still app-specific. */
export type WorkbenchGlobalKeyAction =
  | { kind: "ignore" }
  | { kind: "quit" }
  | { kind: "focusMenu" }
  | { kind: "help" }
  | { kind: "openNewWindowMenu" }
  | { kind: "openThemeMenu" }
  | { kind: "cycleTheme" }
  | { kind: "openThreeConfig" }
  | { kind: "closeWindow" }
  | { kind: "minimizeWindow" }
  | { kind: "toggleMaximize" }
  | { kind: "restoreAll" }
  | { kind: "focusControl"; delta: -1 | 1 }
  | { kind: "focusWindow"; delta: -1 | 1 }
  | { kind: "focusWindowNumber"; index: number }
  | { kind: "restoreNextMinimized" }
  | { kind: "adjustTileDensity"; delta: -1 | 1 }
  | { kind: "scrollPage"; delta: -1 | 1 }
  | { kind: "scrollHome" }
  | { kind: "scrollEnd" }
  | { kind: "scrollHorizontal"; delta: number }
  | { kind: "incrementDensity"; delta: -1 | 1 }
  | { kind: "toggleLivePreview" }
  | { kind: "scrollLine"; columns: number; rows: number };

/** Resolve a global workbench key before window-specific fallback handling. */
export function resolveWorkbenchGlobalKey(
  event: WorkbenchGlobalKey,
  options: { activeWindowId?: string; controlsWindowId?: string } = {},
): WorkbenchGlobalKeyAction {
  if (event.ctrl || event.meta) return { kind: "ignore" };
  const controlsWindowId = options.controlsWindowId ?? "controls";
  switch (event.key) {
    case "q":
      return { kind: "quit" };
    case "f10":
      return { kind: "focusMenu" };
    case "?":
    case "h":
      return { kind: "help" };
    case "n":
      return { kind: "openNewWindowMenu" };
    case "t":
      return event.shift ? { kind: "openThemeMenu" } : { kind: "cycleTheme" };
    case "g":
      return { kind: "openThreeConfig" };
    case "c":
      return { kind: "closeWindow" };
    case "m":
      return { kind: "minimizeWindow" };
    case "f":
    case "return":
      return { kind: "toggleMaximize" };
    case "r":
    case "escape":
      return { kind: "restoreAll" };
    case "tab":
      return options.activeWindowId === controlsWindowId
        ? { kind: "focusControl", delta: event.shift ? -1 : 1 }
        : { kind: "focusWindow", delta: event.shift ? -1 : 1 };
    case "0":
      return { kind: "restoreNextMinimized" };
    case "[":
      return { kind: "adjustTileDensity", delta: -1 };
    case "]":
      return { kind: "adjustTileDensity", delta: 1 };
    case "pageup":
      return { kind: "scrollPage", delta: -1 };
    case "pagedown":
      return { kind: "scrollPage", delta: 1 };
    case "home":
      return { kind: "scrollHome" };
    case "end":
      return { kind: "scrollEnd" };
    case "left":
      return event.shift ? { kind: "scrollHorizontal", delta: -4 } : { kind: "scrollLine", columns: -1, rows: 0 };
    case "right":
      return event.shift ? { kind: "scrollHorizontal", delta: 4 } : { kind: "scrollLine", columns: 1, rows: 0 };
    case "up":
      return { kind: "scrollLine", columns: 0, rows: -1 };
    case "down":
      return { kind: "scrollLine", columns: 0, rows: 1 };
    case "+":
    case "=":
      return { kind: "incrementDensity", delta: 1 };
    case "-":
    case "_":
      return { kind: "incrementDensity", delta: -1 };
    case "x":
    case "space":
      return { kind: "toggleLivePreview" };
  }

  const numberIndex = Number.parseInt(event.key, 10);
  if (Number.isInteger(numberIndex) && numberIndex >= 1) {
    return { kind: "focusWindowNumber", index: numberIndex - 1 };
  }
  return { kind: "ignore" };
}
