// Copyright 2023 Im-Beast. MIT license.
import type { WindowManagerLayoutInspection, WindowManagerWindowInspection } from "../layout/window_manager.ts";
import type { TerminalSessionHandle } from "../runtime/terminal_backend.ts";

/** Terminal handle bound to a managed window id. */
export interface TerminalWindowBinding {
  windowId: string;
  session: TerminalSessionHandle;
  insetColumns?: number;
  insetRows?: number;
  minColumns?: number;
  minRows?: number;
}

/** Options for syncing terminal windows from a window-manager layout. */
export interface TerminalWindowLayoutSyncOptions {
  insetColumns?: number;
  insetRows?: number;
  minColumns?: number;
  minRows?: number;
}

/** Result for one terminal-window resize decision. */
export interface TerminalWindowLayoutSyncResult {
  windowId: string;
  visible: boolean;
  changed: boolean;
  resized: boolean;
  resizeSupported: boolean;
  columns: number;
  rows: number;
}

/** Resize terminal sessions to match visible window content geometry. */
export async function syncTerminalWindowLayout(
  layout: WindowManagerLayoutInspection,
  bindings: readonly TerminalWindowBinding[],
  options: TerminalWindowLayoutSyncOptions = {},
): Promise<TerminalWindowLayoutSyncResult[]> {
  const windows = new Map(layout.visible.map((entry) => [entry.id, entry]));
  const results: TerminalWindowLayoutSyncResult[] = [];
  for (const binding of bindings) {
    const window = windows.get(binding.windowId);
    if (!window?.rect) {
      const inspection = binding.session.inspect();
      results.push({
        windowId: binding.windowId,
        visible: false,
        changed: false,
        resized: false,
        resizeSupported: inspection.resizeSupported,
        columns: inspection.columns,
        rows: inspection.rows,
      });
      continue;
    }
    results.push(await syncTerminalWindow(binding, window, options));
  }
  return results;
}

/** Compute terminal content cells for a window-manager window. */
export function terminalWindowContentSize(
  window: Pick<WindowManagerWindowInspection, "rect">,
  binding: Pick<TerminalWindowBinding, "insetColumns" | "insetRows" | "minColumns" | "minRows"> = {},
  options: TerminalWindowLayoutSyncOptions = {},
): { columns: number; rows: number } {
  const rect = window.rect;
  if (!rect) return { columns: 1, rows: 1 };
  const insetColumns = binding.insetColumns ?? options.insetColumns ?? 2;
  const insetRows = binding.insetRows ?? options.insetRows ?? 2;
  const minColumns = binding.minColumns ?? options.minColumns ?? 1;
  const minRows = binding.minRows ?? options.minRows ?? 1;
  return {
    columns: Math.max(minColumns, rect.width - insetColumns),
    rows: Math.max(minRows, rect.height - insetRows),
  };
}

async function syncTerminalWindow(
  binding: TerminalWindowBinding,
  window: WindowManagerWindowInspection,
  options: TerminalWindowLayoutSyncOptions,
): Promise<TerminalWindowLayoutSyncResult> {
  const size = terminalWindowContentSize(window, binding, options);
  const inspection = binding.session.inspect();
  const changed = inspection.columns !== size.columns || inspection.rows !== size.rows;
  const resized = changed ? await binding.session.resize(size.columns, size.rows) : false;
  return {
    windowId: binding.windowId,
    visible: true,
    changed,
    resized,
    resizeSupported: inspection.resizeSupported,
    columns: size.columns,
    rows: size.rows,
  };
}
