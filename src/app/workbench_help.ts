// Copyright 2023 Im-Beast. MIT license.

/** Workbench host profile used for navigation help text. */
export type WorkbenchHelpProfile = "terminal" | "web";

/** Options for composing workbench navigation help rows. */
export interface WorkbenchHelpRowsOptions {
  profile?: WorkbenchHelpProfile;
}

/** Builds workbench navigation help rows shared by terminal and browser adapters. */
export function workbenchHelpRows(options: WorkbenchHelpRowsOptions = {}): string[] {
  return options.profile === "web" ? webWorkbenchHelpRows() : terminalWorkbenchHelpRows();
}

function webWorkbenchHelpRows(): string[] {
  return [
    "Keyboard: Tab cycles panels. Use 1-8 to focus Explorer, Inspector, Data, Controls, Logs, Three ASCII, HTML/CSS Layout, and Terminal.",
    "Use M to minimize, F or Enter to maximize/restore, R to restore all panels, T for themes, H for help, and Q to quit.",
    "Controls: arrow keys adjust sliders, radio groups, combo boxes, steppers, and dropdowns. Enter or Space activates.",
    "Mouse: click panels to focus, click rows to select, click controls to change values, and click scrollbars to jump.",
    "Touch: use the compact command strip, tap larger hit zones around controls, and drag inside panels to scroll.",
    "Resize the browser. The same tiled layout helper used by the terminal workbench recomputes panel geometry.",
  ];
}

function terminalWorkbenchHelpRows(): string[] {
  return [
    "Keyboard: Tab moves focus through windows. Inside Controls, Tab moves through controls and leaves the pane after the last control. Shift+Tab moves backward.",
    "Use F10 to focus the top menu, Left/Right to move, Down or Enter to open, arrows to choose menu items, Enter to activate, and Escape to leave.",
    "Use N to open the New menu, Shift+T to open Theme, T to cycle themes, H or ? for help, Q to request quit, and 0 to restore the next minimized window.",
    "Use 1-8 to focus built-in windows, and higher numbers for added windows. Use M to minimize, F or Enter to maximize, C to close, and R or Escape to restore windows.",
    "When a window is fullscreen, use the bottom tabs, Tab, or number shortcuts to switch between fullscreen windows.",
    "Use G from any Three ASCII, Neon 3D, or NGE primitive window to open renderer config. In config, use Up/Down to select settings and Left/Right or Enter to change them.",
    "Use arrows in the Data Table, Explorer, Logs, and overflow windows. In Data Table, S cycles the sort column. Shift+Left/Right scrolls horizontally when content is wider than the pane.",
    "In Controls, arrows adjust sliders, radio groups, combo boxes, steppers, and dropdown selections. Enter or Space activates the selected control.",
    "Three ASCII widgets: mousewheel over the rendered scene zooms; click and drag the scene to rotate the model.",
    "Mouse: click windows to focus them, click rows to select them, click controls to change values, drag or click scrollbars to move through overflow content.",
    "Use the New menu to add Monitor, Neon Exodus, and Neon 3D widget windows to the workspace.",
    "The New menu also includes Shell, Terminal Output, and HTML/CSS Layout windows for interactive shells, process output, and markup/CSS layout demos.",
    "In Shell, P/S/U/K start, stop, restart, and clear. N opens a new shell, - splits horizontally, \\ splits vertically, Z toggles pane zoom, / searches scrollback, and I enters raw input.",
    "While Shell raw input is active, type normal commands, Ctrl+C interrupts the shell, and Escape returns to Workbench mode.",
    "In Terminal Output, P/S/U/K/V/Y run, stop, restart, clear, follow, and copy the command. Press I while the process is running to send printable keys to child stdin; Escape returns to workbench mode.",
    "Use the Workspace menu to save, open, rename, or delete workspace layouts. Opening a saved workspace replaces the currently loaded widget windows.",
    "Use the Theme menu to switch palettes. Click the [x] button in the top-right menu bar or press Q to open quit confirmation.",
  ];
}
