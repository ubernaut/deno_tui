import type { ConsoleSize, Rectangle } from "../types.ts";

/** Minimal signal-like size target used by workbench terminal resize synchronization. */
export interface WorkbenchScreenSizeTarget {
  peek(): ConsoleSize;
  value: ConsoleSize;
}

/** Result returned after polling the host terminal size. */
export interface WorkbenchScreenSizeSyncResult {
  changed: boolean;
  size: ConsoleSize;
  error?: unknown;
}

/** Reads the current host terminal size. */
export type WorkbenchConsoleSizeReader = () => ConsoleSize;

/** Synchronizes a canvas-size signal with the host terminal size. */
export function syncWorkbenchTerminalSize(
  target: WorkbenchScreenSizeTarget,
  readSize: WorkbenchConsoleSizeReader = () => Deno.consoleSize(),
): WorkbenchScreenSizeSyncResult {
  try {
    const next = normalizeConsoleSize(readSize());
    const current = target.peek();
    if (current.columns === next.columns && current.rows === next.rows) {
      return { changed: false, size: current };
    }
    target.value = next;
    return { changed: true, size: next };
  } catch (error) {
    return { changed: false, size: target.peek(), error };
  }
}

/** Returns the current workbench width from a rectangle-like signal, clamped for rendering. */
export function workbenchScreenWidth(rectangle: Pick<Rectangle, "width">): number {
  return Math.max(1, Math.floor(rectangle.width));
}

/** Returns the current workbench height from a rectangle-like signal, clamped for rendering. */
export function workbenchScreenHeight(rectangle: Pick<Rectangle, "height">): number {
  return Math.max(1, Math.floor(rectangle.height));
}

function normalizeConsoleSize(size: ConsoleSize): ConsoleSize {
  return {
    columns: Math.max(1, Math.floor(size.columns)),
    rows: Math.max(1, Math.floor(size.rows)),
  };
}
