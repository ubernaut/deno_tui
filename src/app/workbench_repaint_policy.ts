import type { ConsoleSize } from "../types.ts";

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

function normalizeWorkbenchScreenRepaintSize(size: ConsoleSize): ConsoleSize {
  return {
    columns: Math.max(1, Math.floor(size.columns)),
    rows: Math.max(1, Math.floor(size.rows)),
  };
}
