// Copyright 2023 Im-Beast. MIT license.
import type { Rectangle } from "../types.ts";
import { Signal } from "../signals/mod.ts";
import { type TileLayoutOptions, tileRects } from "./responsive.ts";

/** Public type alias for a window Manager Window State. */
export type WindowManagerWindowState = "normal" | "minimized" | "fullscreen" | "closed";

/** Render layer used by window manager inspections. */
export type WindowManagerLayer = "closed" | "minimized" | "window" | "fullscreen";

/** Public interface describing a window Manager Window. */
export interface WindowManagerWindow {
  id: string;
  title: string;
  state?: WindowManagerWindowState;
  closable?: boolean;
  order?: number;
  minWidth?: number;
  minHeight?: number;
}

/** Options for configuring window Manager. */
export interface WindowManagerOptions {
  windows: readonly WindowManagerWindow[];
  activeId?: string;
  fullscreenId?: string | null;
  tileOptions?: Partial<Omit<TileLayoutOptions, "itemCount">>;
}

/** Options for configuring window Manager Layout. */
export interface WindowManagerLayoutOptions {
  bounds: Rectangle;
  tileOptions?: Partial<Omit<TileLayoutOptions, "itemCount">>;
}

/** Serializable inspection snapshot for window Manager Window. */
export interface WindowManagerWindowInspection extends WindowManagerWindow {
  state: WindowManagerWindowState;
  layer: WindowManagerLayer;
  zIndex: number;
  active: boolean;
  fullscreen: boolean;
  minimized: boolean;
  closed: boolean;
  rect?: Rectangle;
}

/** Serializable inspection snapshot for window Manager Layout. */
export interface WindowManagerLayoutInspection {
  bounds: Rectangle;
  contentHeight: number;
  activeId?: string;
  fullscreenId?: string;
  windows: WindowManagerWindowInspection[];
  visible: WindowManagerWindowInspection[];
  tabs: WindowManagerWindowInspection[];
  zOrder: WindowManagerWindowInspection[];
}

/** Base z-index values used by the renderer-neutral window manager. */
export const WINDOW_MANAGER_LAYER_Z_INDEX: Record<WindowManagerLayer, number> = {
  closed: 0,
  minimized: 1_000,
  window: 2_000,
  fullscreen: 3_000,
};

/** State controller for window Manager behavior. */
export class WindowManagerController {
  readonly windows: Signal<WindowManagerWindow[]>;
  readonly activeId: Signal<string | undefined>;
  readonly fullscreenId: Signal<string | undefined>;
  readonly tileOptions: Signal<Partial<Omit<TileLayoutOptions, "itemCount">>>;

  constructor(options: WindowManagerOptions) {
    const windows = normalizeWindows(options.windows);
    this.windows = new Signal(windows, { deepObserve: true });
    this.activeId = new Signal(normalizeWindowId(windows, options.activeId) ?? firstOpenWindow(windows)?.id);
    this.fullscreenId = new Signal(normalizeWindowId(windows, options.fullscreenId ?? undefined));
    this.tileOptions = new Signal({ ...(options.tileOptions ?? {}) }, { deepObserve: true });
    this.#repairState();
  }

  ids(options: { includeClosed?: boolean } = {}): string[] {
    return this.orderedWindows(options).map((entry) => entry.id);
  }

  orderedWindows(options: { includeClosed?: boolean } = {}): WindowManagerWindow[] {
    return [...this.windows.peek()]
      .filter((entry) => options.includeClosed || windowState(entry) !== "closed")
      .sort((left, right) => (left.order ?? 0) - (right.order ?? 0));
  }

  active(): WindowManagerWindow | undefined {
    return this.windows.peek().find((entry) => entry.id === this.activeId.peek());
  }

  upsert(window: WindowManagerWindow): WindowManagerWindow {
    const windows = this.windows.peek();
    const existing = windows.find((entry) => entry.id === window.id);
    const next: WindowManagerWindow = {
      ...existing,
      ...window,
      state: window.state ?? existing?.state ?? "normal",
      order: window.order ?? existing?.order ?? nextWindowOrder(windows),
    };
    this.windows.value = existing ? windows.map((entry) => entry.id === window.id ? next : entry) : [...windows, next];
    this.#repairState();
    return this.#window(window.id)!;
  }

  rename(id: string, title: string): WindowManagerWindow | undefined {
    const window = this.#window(id);
    if (!window) return undefined;
    const normalizedTitle = title.trim();
    if (!normalizedTitle) return window;
    this.windows.value = this.windows.peek().map((entry) =>
      entry.id === id ? { ...entry, title: normalizedTitle } : entry
    );
    this.#repairState();
    return this.#window(id);
  }

  move(id: string, delta: number): WindowManagerWindow | undefined {
    const windows = this.orderedWindows({ includeClosed: true });
    const index = windows.findIndex((entry) => entry.id === id);
    if (index < 0) return undefined;
    const target = Math.max(0, Math.min(windows.length - 1, index + Math.trunc(delta)));
    if (target === index) return this.#window(id);
    const reordered = [...windows];
    const [window] = reordered.splice(index, 1);
    reordered.splice(target, 0, window!);
    const order = new Map(reordered.map((entry, nextOrder) => [entry.id, nextOrder]));
    this.windows.value = this.windows.peek().map((entry) => ({ ...entry, order: order.get(entry.id) ?? entry.order }));
    this.#repairState();
    return this.#window(id);
  }

  focus(id: string): WindowManagerWindow | undefined {
    const window = this.#window(id);
    if (!window || windowState(window) === "closed") return undefined;
    this.#setState(id, "normal");
    this.activeId.value = id;
    if (this.fullscreenId.peek()) this.fullscreenId.value = id;
    this.#repairState();
    return this.active();
  }

  focusNext(delta = 1): WindowManagerWindow | undefined {
    const ids = this.ids();
    if (ids.length === 0) return undefined;
    const current = Math.max(0, ids.indexOf(this.activeId.peek() ?? ""));
    return this.focus(ids[(current + delta + ids.length) % ids.length]!);
  }

  minimize(id = this.activeId.peek()): WindowManagerWindow | undefined {
    if (!id) return undefined;
    const window = this.#window(id);
    if (!window || windowState(window) === "closed") return undefined;
    this.#setState(id, "minimized");
    if (this.fullscreenId.peek() === id) this.fullscreenId.value = undefined;
    const next = this.orderedWindows().find((entry) => windowState(entry) !== "minimized");
    this.activeId.value = next?.id ?? id;
    this.#repairState();
    return this.#window(id);
  }

  close(id = this.activeId.peek()): WindowManagerWindow | undefined {
    if (!id) return undefined;
    const window = this.#window(id);
    if (!window || window.closable === false) return window;
    this.#setState(id, "closed");
    if (this.fullscreenId.peek() === id) this.fullscreenId.value = undefined;
    const next = this.orderedWindows().find((entry) => windowState(entry) !== "minimized");
    this.activeId.value = next?.id;
    this.#repairState();
    return this.#window(id);
  }

  restore(id?: string): WindowManagerWindow | undefined {
    if (id) {
      this.#setState(id, "normal");
      this.activeId.value = id;
      this.#repairState();
      return this.#window(id);
    }
    this.fullscreenId.value = undefined;
    this.windows.value = this.windows.peek().map((entry) =>
      windowState(entry) === "minimized" ? { ...entry, state: "normal" } : entry
    );
    this.#repairState();
    return this.active();
  }

  fullscreen(id = this.activeId.peek()): WindowManagerWindow | undefined {
    if (!id) return undefined;
    const window = this.#window(id);
    if (!window || windowState(window) === "closed") return undefined;
    this.#setState(id, "normal");
    this.fullscreenId.value = this.fullscreenId.peek() === id ? undefined : id;
    this.activeId.value = id;
    this.#repairState();
    return this.active();
  }

  selectTab(id: string): WindowManagerWindow | undefined {
    const window = this.focus(id);
    if (window) this.fullscreenId.value = id;
    return window;
  }

  layout(options: WindowManagerLayoutOptions): WindowManagerLayoutInspection {
    const bounds = options.bounds;
    const rects = new Map<string, Rectangle>();
    const fullscreenId = this.fullscreenId.peek();
    const windows = this.orderedWindows({ includeClosed: true });
    const visible = windows.filter((entry) => windowState(entry) === "normal");
    let contentHeight = bounds.height;

    if (fullscreenId) {
      const fullscreen = windows.find((entry) => entry.id === fullscreenId && windowState(entry) !== "closed");
      if (fullscreen) rects.set(fullscreen.id, bounds);
    } else if (visible.length > 0) {
      const minWidth = Math.max(20, ...visible.map((entry) => entry.minWidth ?? 0));
      const minHeight = Math.max(6, ...visible.map((entry) => entry.minHeight ?? 0));
      const layout = tileRects(bounds, {
        itemCount: visible.length,
        minTileWidth: minWidth,
        minTileHeight: minHeight,
        maxColumns: bounds.width >= 172 ? 4 : 3,
        gap: 1,
        targetAspectRatio: 2.25,
        allowVerticalOverflow: true,
        ...this.tileOptions.peek(),
        ...options.tileOptions,
      });
      for (const [index, entry] of visible.entries()) {
        rects.set(entry.id, layout.rects[index]!);
      }
      contentHeight = Math.max(bounds.height, layout.contentHeight);
    }

    const inspected = windows.map((entry) =>
      inspectWindow(entry, this.activeId.peek(), fullscreenId, rects.get(entry.id))
    );
    return {
      bounds,
      contentHeight,
      activeId: this.activeId.peek(),
      fullscreenId,
      windows: inspected,
      visible: inspected.filter((entry) => entry.rect !== undefined),
      tabs: inspected.filter((entry) => !entry.closed),
      zOrder: windowManagerZOrder(inspected),
    };
  }

  inspect(): WindowManagerLayoutInspection {
    return this.layout({ bounds: { column: 0, row: 0, width: 0, height: 0 } });
  }

  dispose(): void {
    this.windows.dispose();
    this.activeId.dispose();
    this.fullscreenId.dispose();
    this.tileOptions.dispose();
  }

  #window(id: string): WindowManagerWindow | undefined {
    return this.windows.peek().find((entry) => entry.id === id);
  }

  #setState(id: string, state: WindowManagerWindowState): void {
    this.windows.value = this.windows.peek().map((entry) => entry.id === id ? { ...entry, state } : entry);
  }

  #repairState(): void {
    const windows = this.orderedWindows();
    if (!windows.some((entry) => entry.id === this.activeId.peek())) {
      this.activeId.value = firstOpenWindow(windows)?.id;
    }
    const fullscreenId = this.fullscreenId.peek();
    if (fullscreenId && !windows.some((entry) => entry.id === fullscreenId && windowState(entry) !== "closed")) {
      this.fullscreenId.value = undefined;
    }
  }
}

/** Sorts inspected windows from back to front for renderer-neutral drawing and hit testing. */
export function windowManagerZOrder(
  windows: readonly WindowManagerWindowInspection[],
): WindowManagerWindowInspection[] {
  return [...windows]
    .filter((entry) => !entry.closed)
    .sort((left, right) => left.zIndex - right.zIndex || (left.order ?? 0) - (right.order ?? 0));
}

function normalizeWindows(windows: readonly WindowManagerWindow[]): WindowManagerWindow[] {
  return windows.map((entry, index) => ({
    ...entry,
    state: entry.state ?? "normal",
    order: entry.order ?? index,
  }));
}

function nextWindowOrder(windows: readonly WindowManagerWindow[]): number {
  let order = -1;
  for (const entry of windows) {
    order = Math.max(order, entry.order ?? 0);
  }
  return order + 1;
}

function normalizeWindowId(windows: readonly WindowManagerWindow[], id?: string | null): string | undefined {
  return id && windows.some((entry) => entry.id === id && windowState(entry) !== "closed") ? id : undefined;
}

function firstOpenWindow(windows: readonly WindowManagerWindow[]): WindowManagerWindow | undefined {
  return windows.find((entry) => windowState(entry) !== "closed");
}

function windowState(window: WindowManagerWindow): WindowManagerWindowState {
  return window.state ?? "normal";
}

function inspectWindow(
  window: WindowManagerWindow,
  activeId: string | undefined,
  fullscreenId: string | undefined,
  rect: Rectangle | undefined,
): WindowManagerWindowInspection {
  const state = windowState(window);
  const fullscreen = window.id === fullscreenId;
  const active = window.id === activeId;
  const layer = windowLayer(state, fullscreen);
  return {
    ...window,
    state,
    layer,
    zIndex: windowZIndex(window, layer, active),
    active,
    fullscreen,
    minimized: state === "minimized",
    closed: state === "closed",
    rect,
  };
}

function windowLayer(state: WindowManagerWindowState, fullscreen: boolean): WindowManagerLayer {
  if (state === "closed") return "closed";
  if (state === "minimized") return "minimized";
  return fullscreen ? "fullscreen" : "window";
}

function windowZIndex(window: WindowManagerWindow, layer: WindowManagerLayer, active: boolean): number {
  return WINDOW_MANAGER_LAYER_Z_INDEX[layer] + (window.order ?? 0) + (active ? 500 : 0);
}
