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
  #orderedAll: WindowManagerWindow[] = [];
  #orderedOpen: WindowManagerWindow[] = [];
  readonly #syncOrderedWindows = () => {
    const source = this.windows.peek();
    const all = new Array<WindowManagerWindow>(source.length);
    const open: WindowManagerWindow[] = [];
    for (let index = 0; index < source.length; index += 1) {
      const entry = source[index]!;
      all[index] = entry;
      if (windowState(entry) !== "closed") open.push(entry);
    }
    all.sort(compareWindowOrder);
    open.sort(compareWindowOrder);
    this.#orderedAll = all;
    this.#orderedOpen = open;
  };

  constructor(options: WindowManagerOptions) {
    const windows = normalizeWindows(options.windows);
    this.windows = new Signal(windows, { deepObserve: true });
    this.activeId = new Signal(normalizeWindowId(windows, options.activeId) ?? firstOpenWindow(windows)?.id);
    this.fullscreenId = new Signal(normalizeWindowId(windows, options.fullscreenId ?? undefined));
    this.tileOptions = new Signal({ ...(options.tileOptions ?? {}) }, { deepObserve: true });
    this.#syncOrderedWindows();
    this.windows.subscribe(this.#syncOrderedWindows);
    this.#repairState();
  }

  ids(options: { includeClosed?: boolean } = {}): string[] {
    const windows = this.#orderedWindows(options.includeClosed);
    const ids = new Array<string>(windows.length);
    for (let index = 0; index < windows.length; index += 1) ids[index] = windows[index]!.id;
    return ids;
  }

  orderedWindows(options: { includeClosed?: boolean } = {}): WindowManagerWindow[] {
    const source = this.#orderedWindows(options.includeClosed);
    const windows = new Array<WindowManagerWindow>(source.length);
    for (let index = 0; index < source.length; index += 1) windows[index] = source[index]!;
    return windows;
  }

  active(): WindowManagerWindow | undefined {
    return findWindowById(this.windows.peek(), this.activeId.peek());
  }

  upsert(window: WindowManagerWindow): WindowManagerWindow {
    const windows = this.windows.peek();
    const existing = findWindowById(windows, window.id);
    const next: WindowManagerWindow = {
      ...existing,
      ...window,
      state: window.state ?? existing?.state ?? "normal",
      order: window.order ?? existing?.order ?? nextWindowOrder(windows),
    };
    if (existing) {
      this.windows.value = replaceWindow(windows, window.id, next);
    } else {
      const nextWindows = new Array<WindowManagerWindow>(windows.length + 1);
      for (let index = 0; index < windows.length; index += 1) nextWindows[index] = windows[index]!;
      nextWindows[windows.length] = next;
      this.windows.value = nextWindows;
    }
    this.#repairState();
    return this.#window(window.id)!;
  }

  rename(id: string, title: string): WindowManagerWindow | undefined {
    const window = this.#window(id);
    if (!window) return undefined;
    const normalizedTitle = title.trim();
    if (!normalizedTitle) return window;
    this.windows.value = replaceWindow(this.windows.peek(), id, { ...window, title: normalizedTitle });
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
    const order = new Map<string, number>();
    for (let nextOrder = 0; nextOrder < reordered.length; nextOrder += 1) {
      order.set(reordered[nextOrder]!.id, nextOrder);
    }
    const source = this.windows.peek();
    const nextWindows = new Array<WindowManagerWindow>(source.length);
    for (let sourceIndex = 0; sourceIndex < source.length; sourceIndex += 1) {
      const entry = source[sourceIndex]!;
      nextWindows[sourceIndex] = { ...entry, order: order.get(entry.id) ?? entry.order };
    }
    this.windows.value = nextWindows;
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
    const windows = this.#orderedWindows(false);
    if (windows.length === 0) return undefined;
    const activeId = this.activeId.peek();
    let currentIndex = -1;
    for (let index = 0; index < windows.length; index += 1) {
      if (windows[index]!.id === activeId) {
        currentIndex = index;
        break;
      }
    }
    const current = Math.max(0, currentIndex);
    return this.focus(windows[(current + delta + windows.length) % windows.length]!.id);
  }

  minimize(id: string | undefined = this.activeId.peek()): WindowManagerWindow | undefined {
    if (!id) return undefined;
    const window = this.#window(id);
    if (!window || windowState(window) === "closed") return undefined;
    this.#setState(id, "minimized");
    if (this.fullscreenId.peek() === id) this.fullscreenId.value = undefined;
    const next = firstNonMinimizedWindow(this.#orderedWindows(false));
    this.activeId.value = next?.id ?? id;
    this.#repairState();
    return this.#window(id);
  }

  close(id: string | undefined = this.activeId.peek()): WindowManagerWindow | undefined {
    if (!id) return undefined;
    const window = this.#window(id);
    if (!window || window.closable === false) return window;
    this.#setState(id, "closed");
    if (this.fullscreenId.peek() === id) this.fullscreenId.value = undefined;
    const next = firstNonMinimizedWindow(this.#orderedWindows(false));
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
    const source = this.windows.peek();
    const nextWindows = new Array<WindowManagerWindow>(source.length);
    for (let index = 0; index < source.length; index += 1) {
      const entry = source[index]!;
      nextWindows[index] = windowState(entry) === "minimized" ? { ...entry, state: "normal" } : entry;
    }
    this.windows.value = nextWindows;
    this.#repairState();
    return this.active();
  }

  restoreNextMinimized(): WindowManagerWindow | undefined {
    const window = firstMinimizedWindow(this.#orderedWindows(false));
    if (!window) return undefined;
    return this.restore(window.id);
  }

  fullscreen(id: string | undefined = this.activeId.peek()): WindowManagerWindow | undefined {
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
    const windows = this.#orderedWindows(true);
    const visible: WindowManagerWindow[] = [];
    for (const entry of windows) {
      if (windowState(entry) === "normal") visible.push(entry);
    }
    let contentHeight = bounds.height;

    if (fullscreenId) {
      const fullscreen = findOpenWindowById(windows, fullscreenId);
      if (fullscreen) rects.set(fullscreen.id, bounds);
    } else if (visible.length > 0) {
      let minWidth = 20;
      let minHeight = 6;
      for (const entry of visible) {
        minWidth = Math.max(minWidth, entry.minWidth ?? 0);
        minHeight = Math.max(minHeight, entry.minHeight ?? 0);
      }
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

    const activeId = this.activeId.peek();
    const inspected = new Array<WindowManagerWindowInspection>(windows.length);
    const visibleInspected: WindowManagerWindowInspection[] = [];
    const tabs: WindowManagerWindowInspection[] = [];
    for (let index = 0; index < windows.length; index += 1) {
      const entry = inspectWindow(windows[index]!, activeId, fullscreenId, rects.get(windows[index]!.id));
      inspected[index] = entry;
      if (entry.rect !== undefined) visibleInspected.push(entry);
      if (!entry.closed) tabs.push(entry);
    }
    return {
      bounds,
      contentHeight,
      activeId,
      fullscreenId,
      windows: inspected,
      visible: visibleInspected,
      tabs,
      zOrder: windowManagerZOrder(inspected),
    };
  }

  inspect(): WindowManagerLayoutInspection {
    return this.layout({ bounds: { column: 0, row: 0, width: 0, height: 0 } });
  }

  dispose(): void {
    this.windows.unsubscribe(this.#syncOrderedWindows);
    this.windows.dispose();
    this.activeId.dispose();
    this.fullscreenId.dispose();
    this.tileOptions.dispose();
  }

  #window(id: string): WindowManagerWindow | undefined {
    return findWindowById(this.windows.peek(), id);
  }

  #setState(id: string, state: WindowManagerWindowState): void {
    const window = this.#window(id);
    if (window) this.windows.value = replaceWindow(this.windows.peek(), id, { ...window, state });
  }

  #repairState(): void {
    const windows = this.#orderedWindows(false);
    if (!hasOpenWindowId(windows, this.activeId.peek())) {
      this.activeId.value = firstOpenWindow(windows)?.id;
    }
    const fullscreenId = this.fullscreenId.peek();
    if (fullscreenId && !hasOpenWindowId(windows, fullscreenId)) {
      this.fullscreenId.value = undefined;
    }
  }

  #orderedWindows(includeClosed = false): readonly WindowManagerWindow[] {
    return includeClosed ? this.#orderedAll : this.#orderedOpen;
  }
}

/** Sorts inspected windows from back to front for renderer-neutral drawing and hit testing. */
export function windowManagerZOrder(
  windows: readonly WindowManagerWindowInspection[],
): WindowManagerWindowInspection[] {
  const zOrder: WindowManagerWindowInspection[] = [];
  for (const entry of windows) {
    if (!entry.closed) zOrder.push(entry);
  }
  zOrder.sort((left, right) => left.zIndex - right.zIndex || (left.order ?? 0) - (right.order ?? 0));
  return zOrder;
}

function normalizeWindows(windows: readonly WindowManagerWindow[]): WindowManagerWindow[] {
  const normalized = new Array<WindowManagerWindow>(windows.length);
  for (let index = 0; index < windows.length; index += 1) {
    const entry = windows[index]!;
    normalized[index] = {
      ...entry,
      state: entry.state ?? "normal",
      order: entry.order ?? index,
    };
  }
  return normalized;
}

function replaceWindow(
  windows: readonly WindowManagerWindow[],
  id: string,
  replacement: WindowManagerWindow,
): WindowManagerWindow[] {
  const next = new Array<WindowManagerWindow>(windows.length);
  for (let index = 0; index < windows.length; index += 1) {
    const entry = windows[index]!;
    next[index] = entry.id === id ? replacement : entry;
  }
  return next;
}

function compareWindowOrder(left: WindowManagerWindow, right: WindowManagerWindow): number {
  return (left.order ?? 0) - (right.order ?? 0);
}

function nextWindowOrder(windows: readonly WindowManagerWindow[]): number {
  let order = -1;
  for (const entry of windows) {
    order = Math.max(order, entry.order ?? 0);
  }
  return order + 1;
}

function normalizeWindowId(windows: readonly WindowManagerWindow[], id?: string | null): string | undefined {
  return id && hasOpenWindowId(windows, id) ? id : undefined;
}

function firstOpenWindow(windows: readonly WindowManagerWindow[]): WindowManagerWindow | undefined {
  for (let index = 0; index < windows.length; index += 1) {
    const window = windows[index]!;
    if (windowState(window) !== "closed") return window;
  }
  return undefined;
}

function firstNonMinimizedWindow(windows: readonly WindowManagerWindow[]): WindowManagerWindow | undefined {
  for (let index = 0; index < windows.length; index += 1) {
    const window = windows[index]!;
    if (windowState(window) !== "minimized") return window;
  }
  return undefined;
}

function firstMinimizedWindow(windows: readonly WindowManagerWindow[]): WindowManagerWindow | undefined {
  for (let index = 0; index < windows.length; index += 1) {
    const window = windows[index]!;
    if (windowState(window) === "minimized") return window;
  }
  return undefined;
}

function findWindowById(
  windows: readonly WindowManagerWindow[],
  id: string | undefined,
): WindowManagerWindow | undefined {
  if (!id) return undefined;
  for (let index = 0; index < windows.length; index += 1) {
    const window = windows[index]!;
    if (window.id === id) return window;
  }
  return undefined;
}

function findOpenWindowById(
  windows: readonly WindowManagerWindow[],
  id: string,
): WindowManagerWindow | undefined {
  const window = findWindowById(windows, id);
  return window && windowState(window) !== "closed" ? window : undefined;
}

function hasOpenWindowId(windows: readonly WindowManagerWindow[], id: string | undefined): boolean {
  return id ? findOpenWindowById(windows, id) !== undefined : false;
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
