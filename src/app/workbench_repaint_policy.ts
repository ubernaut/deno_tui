import type { ConsoleSize, Rectangle } from "../types.ts";

export const DEFAULT_WORKBENCH_FULL_REPAINT_INTERVAL_MS = 15_000;
export const DEFAULT_WORKBENCH_RESIZE_REPAINT_WINDOW_MS = 2_500;

export interface WorkbenchFullRepaintPolicyOptions {
  intervalMs?: number;
  now?: () => number;
}

export interface WorkbenchScreenRepaintInspection {
  changed: boolean;
  size: ConsoleSize;
}

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

/** Tracks when a retained full-screen renderer should drop its diff cache and repaint all rows. */
export class WorkbenchFullRepaintPolicy {
  readonly intervalMs: number;
  readonly now: () => number;
  #lastFullRepaintAt: number;
  #lastObservedSize: ConsoleSize = { columns: 0, rows: 0 };
  #forceFullRepaintUntil = 0;

  constructor(options: WorkbenchFullRepaintPolicyOptions = {}) {
    this.intervalMs = normalizeWorkbenchFullRepaintInterval(options.intervalMs);
    this.now = options.now ?? (() => performance.now());
    this.#lastFullRepaintAt = this.now();
  }

  shouldForceFullRepaint(now = this.now()): boolean {
    if (now < this.#forceFullRepaintUntil) return true;
    if (this.intervalMs <= 0) return false;
    if (now - this.#lastFullRepaintAt < this.intervalMs) return false;
    this.#lastFullRepaintAt = now;
    return true;
  }

  inspectScreenSize(size: ConsoleSize): WorkbenchScreenRepaintInspection {
    const next = normalizeWorkbenchScreenRepaintSize(size);
    const changed = this.#lastObservedSize.columns !== next.columns || this.#lastObservedSize.rows !== next.rows;
    if (changed) this.#lastObservedSize = next;
    return { changed, size: next };
  }

  resetFullRepaintClock(now = this.now()): void {
    this.#lastFullRepaintAt = now;
  }

  requestFullRepaintWindow(durationMs = DEFAULT_WORKBENCH_RESIZE_REPAINT_WINDOW_MS, now = this.now()): void {
    const duration = Math.max(0, Math.floor(durationMs));
    this.#forceFullRepaintUntil = Math.max(this.#forceFullRepaintUntil, now + duration);
  }
}

export function normalizeWorkbenchFullRepaintInterval(value: number | undefined): number {
  if (value === undefined || !Number.isFinite(value)) return DEFAULT_WORKBENCH_FULL_REPAINT_INTERVAL_MS;
  return Math.max(0, Math.floor(value));
}

/** Synchronizes a canvas-size signal with the host terminal size. */
export function syncWorkbenchTerminalSize(
  target: WorkbenchScreenSizeTarget,
  readSize: WorkbenchConsoleSizeReader = () => Deno.consoleSize(),
): WorkbenchScreenSizeSyncResult {
  try {
    const next = normalizeWorkbenchScreenRepaintSize(readSize());
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

function normalizeWorkbenchScreenRepaintSize(size: ConsoleSize): ConsoleSize {
  return {
    columns: Math.max(1, Math.floor(size.columns)),
    rows: Math.max(1, Math.floor(size.rows)),
  };
}
