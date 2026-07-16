// Copyright 2023 Im-Beast. MIT license.
import type { Rectangle } from "../types.ts";
import { visibleMenuSliceInto } from "./workbench_text.ts";

/** Minimal key event shape for workbench dropdown/menu navigation helpers. */
export interface WorkbenchMenuKey {
  key: string;
}

/** Options for moving a selected workbench dropdown index. */
export interface MoveWorkbenchMenuIndexOptions {
  pageSize?: number;
}

/** Minimal menu item shape used for top-menu anchor layout. */
export interface WorkbenchMenuBarItemShape {
  id: string;
  label: string;
  disabled?: boolean;
}

/** Options for locating a top-menu dropdown relative to its menu-bar item. */
export interface WorkbenchTopMenuItemRectOptions {
  menuStart: number;
  itemId: string;
  items: readonly WorkbenchMenuBarItemShape[];
  activeIndex?: number;
  preferredWidth: number;
  preferredHeight: number;
  maxWidth: number;
  row?: number;
  minAnchoredWidth?: number;
  measureText?: (value: string) => number;
}

/** Caller-owned visible dropdown menu label/index storage. */
export interface WorkbenchTopMenuVisibleSlice {
  items: string[];
  indexes: number[];
}

/** Options for projecting a standard top-menu dropdown overlay. */
export interface WorkbenchTopMenuDropdownOverlayOptions {
  menuStart: number;
  menuId: WorkbenchStandardTopMenuId;
  itemId: string;
  menuItems: readonly WorkbenchMenuBarItemShape[];
  menuActiveIndex?: number;
  labels: readonly string[];
  selectedIndex?: number;
  preferredWidth: number;
  maxWidth: number;
  maxVisibleItems?: number;
  measureText?: (value: string) => number;
}

/** Per-menu label and selection data used to project one standard top-menu overlay. */
export interface WorkbenchStandardTopMenuDropdownEntry {
  visible: WorkbenchTopMenuVisibleSlice;
  labels: readonly string[];
  selectedIndex?: number;
  preferredWidth: number;
  maxVisibleItems?: number;
  itemId?: string;
}

/** Options for projecting whichever standard top-menu dropdown is currently open. */
export interface WorkbenchStandardTopMenuDropdownOverlayOptions {
  openId: WorkbenchStandardTopMenuId | null;
  menuStart: number;
  menuItems: readonly WorkbenchMenuBarItemShape[];
  menuActiveIndex?: number;
  maxWidth: number;
  entries: Partial<Record<WorkbenchStandardTopMenuId, WorkbenchStandardTopMenuDropdownEntry>>;
  measureText?: (value: string) => number;
}

/** Renderer-neutral dropdown overlay projected from a standard top menu item. */
export interface WorkbenchTopMenuDropdownOverlay {
  kind: WorkbenchStandardTopMenuId;
  coordinate: "screen";
  rect: Rectangle;
  items: string[];
  itemIndexes?: number[];
  selectedIndex: number;
}

/** Hit rectangle produced for a visible top-menu item. */
export interface WorkbenchMenuBarHitLayout {
  index: number;
  rect: Rectangle;
  token: string;
}

/** Options for laying out clickable top-menu item hit regions. */
export interface WorkbenchMenuBarHitLayoutOptions {
  column: number;
  row: number;
  width: number;
  items: readonly WorkbenchMenuBarItemShape[];
  activeIndex?: number;
  measureText?: (value: string) => number;
}

/** Options for laying out a workbench top header menu and optional close button. */
export interface WorkbenchHeaderLayoutOptions {
  width: number;
  menuStart?: number;
  row?: number;
  closeWidth?: number;
  closeMinWidth?: number;
  reserveCloseWhenHidden?: boolean;
}

/** Renderer-neutral geometry for a workbench header row. */
export interface WorkbenchHeaderLayout {
  menu: Rectangle;
  close?: Rectangle;
}

/** Serializable inspection snapshot for mutually-exclusive top menu disclosure state. */
export interface WorkbenchTopMenuInspection<MenuId extends string = string> {
  openId: MenuId | null;
  focused: boolean;
}

/** Built-in top-menu dropdown ids used by the API/workbench demos. */
export type WorkbenchStandardTopMenuId = "theme" | "newWindow" | "workspace" | "view" | "layout";

/** Renderer adapter signal state projected from standard top-menu disclosure state. */
export interface WorkbenchStandardTopMenuSignalState {
  themeMenuOpen: boolean;
  newWindowMenuOpen: boolean;
  workspaceMenuOpen: boolean;
  viewMenuOpen: boolean;
  layoutMenuOpen: boolean;
  menuFocused: boolean;
}

/** Minimal key event shape for top-menu dropdown navigation. */
export interface WorkbenchScreenDropdownKey {
  key: string;
  ctrl?: boolean;
  meta?: boolean;
  shift?: boolean;
}

/** Minimal key event shape for global workbench key resolution. */
export interface WorkbenchGlobalKey {
  key: string;
  ctrl?: boolean;
  meta?: boolean;
  shift?: boolean;
}

/** Renderer-neutral action requested by a focused top menu-bar key press. */
export type WorkbenchMenuFocusKeyAction =
  | { kind: "ignore" }
  | { kind: "close" }
  | { kind: "focusWindow"; delta: -1 | 1 }
  | { kind: "moveMenu" }
  | { kind: "selectActive" };

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
  | { kind: "toggleLayoutMode" }
  | { kind: "moveWindow"; delta: -1 | 1 }
  | { kind: "resizeWindow"; columns: number; rows: number }
  | { kind: "adjustTileDensity"; delta: -1 | 1 }
  | { kind: "scrollPage"; delta: -1 | 1 }
  | { kind: "scrollHome" }
  | { kind: "scrollEnd" }
  | { kind: "scrollHorizontal"; delta: number }
  | { kind: "incrementDensity"; delta: -1 | 1 }
  | { kind: "toggleLivePreview" }
  | { kind: "scrollLine"; columns: number; rows: number };

/** Inputs for resolving a key press while a workbench top-menu dropdown is active. */
export interface WorkbenchScreenDropdownKeyOptions {
  event: WorkbenchScreenDropdownKey;
  openId: WorkbenchStandardTopMenuId | null;
  indexes: Partial<Record<WorkbenchStandardTopMenuId, number>>;
  counts: Partial<Record<WorkbenchStandardTopMenuId, number>>;
}

/** Renderer-neutral action requested by a top-menu dropdown key press. */
export type WorkbenchScreenDropdownKeyAction =
  | { kind: "ignore" }
  | { kind: "quit" }
  | { kind: "help" }
  | { kind: "close" }
  | { kind: "focusWindow"; delta: -1 | 1 }
  | { kind: "moveTopMenu"; delta: -1 | 1 }
  | { kind: "menuItem"; menuId: WorkbenchStandardTopMenuId; index: number; activate: boolean };

/** Options for configuring a renderer-neutral top menu disclosure controller. */
export interface WorkbenchTopMenuControllerOptions<MenuId extends string> {
  onChange?: (inspection: WorkbenchTopMenuInspection<MenuId>) => void;
}

/** Controls mutually-exclusive top menu/dropdown disclosure state for workbench render adapters. */
export class WorkbenchTopMenuController<MenuId extends string = string> {
  #openId: MenuId | null = null;
  #focused = false;
  #onChange?: (inspection: WorkbenchTopMenuInspection<MenuId>) => void;

  constructor(options: WorkbenchTopMenuControllerOptions<MenuId> = {}) {
    this.#onChange = options.onChange;
  }

  open(id: MenuId): WorkbenchTopMenuInspection<MenuId> {
    this.#openId = id;
    this.#focused = true;
    return this.#emit();
  }

  toggle(id: MenuId): WorkbenchTopMenuInspection<MenuId> {
    return this.#openId === id ? this.close(false) : this.open(id);
  }

  close(clearFocus = true): WorkbenchTopMenuInspection<MenuId> {
    this.#openId = null;
    if (clearFocus) this.#focused = false;
    return this.#emit();
  }

  focus(): WorkbenchTopMenuInspection<MenuId> {
    this.#focused = true;
    return this.#emit();
  }

  isOpen(id: MenuId): boolean {
    return this.#openId === id;
  }

  inspect(): WorkbenchTopMenuInspection<MenuId> {
    return { openId: this.#openId, focused: this.#focused };
  }

  #emit(): WorkbenchTopMenuInspection<MenuId> {
    const inspection = this.inspect();
    this.#onChange?.(inspection);
    return inspection;
  }
}

/** Resolve a global workbench key before window-specific fallback handling. */
export function resolveWorkbenchGlobalKey(
  event: WorkbenchGlobalKey,
  options: { activeWindowId?: string; controlsWindowId?: string; layoutMode?: boolean } = {},
): WorkbenchGlobalKeyAction {
  const controlsWindowId = options.controlsWindowId ?? "controls";
  const key = event.key.toLowerCase();
  if (key === "f6") return { kind: "toggleLayoutMode" };
  if (options.layoutMode) {
    if (key === "escape") return { kind: "toggleLayoutMode" };
    if (key === "return") return { kind: "toggleMaximize" };
    if (key === "left" || key === "right" || key === "up" || key === "down") {
      const delta = key === "left" || key === "up" ? -1 : 1;
      if (event.meta) return { kind: "ignore" };
      if (event.ctrl) {
        return {
          kind: "resizeWindow",
          columns: key === "left" || key === "right" ? delta * 2 : 0,
          rows: key === "up" || key === "down" ? delta : 0,
        };
      }
      return event.shift ? { kind: "moveWindow", delta } : { kind: "focusWindow", delta };
    }
    return { kind: "ignore" };
  }
  if (event.ctrl || event.meta) return { kind: "ignore" };
  switch (key) {
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

  const numberIndex = Number.parseInt(key, 10);
  if (Number.isInteger(numberIndex) && numberIndex >= 1) {
    return { kind: "focusWindowNumber", index: numberIndex - 1 };
  }
  return { kind: "ignore" };
}

/** Return whether a key should activate the selected dropdown/menu item. */
export function isWorkbenchMenuActivationKey(key: string): boolean {
  return key === "return" || key === "space";
}

/** Return whether a key should close the active dropdown/menu. */
export function isWorkbenchMenuCloseKey(key: string): boolean {
  return key === "escape" || key === "tab";
}

/** Maps a top menu-bar item id to the standard dropdown id it opens. */
export function workbenchStandardTopMenuIdForItem(
  itemId: string | null | undefined,
): WorkbenchStandardTopMenuId | null {
  switch (itemId) {
    case "theme":
      return "theme";
    case "new":
      return "newWindow";
    case "workspace":
      return "workspace";
    case "view":
      return "view";
    case "layout":
      return "layout";
    default:
      return null;
  }
}

/** Projects standard top-menu disclosure state into renderer adapter booleans. */
export function projectWorkbenchStandardTopMenuState(
  state: WorkbenchTopMenuInspection<WorkbenchStandardTopMenuId>,
): WorkbenchStandardTopMenuSignalState {
  return {
    themeMenuOpen: state.openId === "theme",
    newWindowMenuOpen: state.openId === "newWindow",
    workspaceMenuOpen: state.openId === "workspace",
    viewMenuOpen: state.openId === "view",
    layoutMenuOpen: state.openId === "layout",
    menuFocused: state.focused,
  };
}

/** Resolve keyboard behavior while focus is on the top menu bar but no dropdown is necessarily active. */
export function resolveWorkbenchMenuFocusKey(event: WorkbenchScreenDropdownKey): WorkbenchMenuFocusKeyAction {
  if (event.ctrl || event.meta) return { kind: "ignore" };
  switch (event.key) {
    case "escape":
      return { kind: "close" };
    case "tab":
      return { kind: "focusWindow", delta: event.shift ? -1 : 1 };
    case "left":
    case "right":
    case "home":
    case "end":
      return { kind: "moveMenu" };
    case "down":
    case "return":
    case "space":
      return { kind: "selectActive" };
    default:
      return { kind: "ignore" };
  }
}

/** Resolve global/menu-local keyboard behavior while a top menu dropdown is visible. */
export function resolveWorkbenchScreenDropdownKey(
  options: WorkbenchScreenDropdownKeyOptions,
): WorkbenchScreenDropdownKeyAction {
  const { event } = options;
  if (event.ctrl || event.meta) return { kind: "ignore" };
  switch (event.key) {
    case "q":
      return { kind: "quit" };
    case "?":
    case "h":
      return { kind: "help" };
    case "escape":
      return { kind: "close" };
    case "tab":
      return { kind: "focusWindow", delta: event.shift ? -1 : 1 };
    case "left":
      return { kind: "moveTopMenu", delta: -1 };
    case "right":
      return { kind: "moveTopMenu", delta: 1 };
  }

  const menuId = options.openId;
  if (!menuId) return { kind: "ignore" };
  const count = Math.max(0, Math.floor(options.counts[menuId] ?? 0));
  if (count <= 0) return { kind: "ignore" };
  const current = options.indexes[menuId] ?? 0;
  return {
    kind: "menuItem",
    menuId,
    index: moveWorkbenchMenuIndex(current, count, event),
    activate: isWorkbenchMenuActivationKey(event.key),
  };
}

/** Move a selected dropdown/menu index according to common workbench key bindings. */
export function moveWorkbenchMenuIndex(
  current: number,
  count: number,
  event: WorkbenchMenuKey,
  options: MoveWorkbenchMenuIndexOptions = {},
): number {
  if (count <= 0) return 0;
  const pageSize = Math.max(1, options.pageSize ?? 6);
  const index = ((current % count) + count) % count;
  switch (event.key) {
    case "up":
      return (index - 1 + count) % count;
    case "down":
      return (index + 1) % count;
    case "home":
      return 0;
    case "end":
      return count - 1;
    case "pageup":
      return Math.max(0, index - pageSize);
    case "pagedown":
      return Math.min(count - 1, index + pageSize);
    default:
      return index;
  }
}

/** Locates a dropdown/popover rectangle below a top-menu item. */
export function layoutWorkbenchTopMenuItemRect(options: WorkbenchTopMenuItemRectOptions): Rectangle {
  const measureText = options.measureText ?? ((value) => value.length);
  const row = options.row ?? 1;
  const maxWidth = Math.max(0, Math.floor(options.maxWidth));
  const preferredWidth = Math.max(0, Math.floor(options.preferredWidth));
  const preferredHeight = Math.max(0, Math.floor(options.preferredHeight));
  const minAnchoredWidth = Math.max(0, Math.floor(options.minAnchoredWidth ?? 20));
  let cursor = Math.max(0, Math.floor(options.menuStart));

  for (const [index, item] of options.items.entries()) {
    const label = item.disabled ? `(${item.label})` : item.label;
    const token = index === options.activeIndex ? `[${label}]` : label;
    if (item.id === options.itemId) {
      return {
        column: cursor,
        row,
        width: Math.min(preferredWidth, Math.max(minAnchoredWidth, maxWidth - cursor)),
        height: preferredHeight,
      };
    }
    cursor += measureText(token) + 1;
  }

  return {
    column: Math.max(0, Math.floor(options.menuStart)),
    row,
    width: Math.min(preferredWidth, maxWidth),
    height: preferredHeight,
  };
}

/** Projects a standard top-menu dropdown overlay while reusing caller-owned visible slice arrays. */
export function workbenchTopMenuDropdownOverlayInto(
  visible: WorkbenchTopMenuVisibleSlice,
  options: WorkbenchTopMenuDropdownOverlayOptions,
): WorkbenchTopMenuDropdownOverlay {
  const measureText = options.measureText ?? ((value) => value.length);
  const maxVisibleItems = Math.max(0, Math.floor(options.maxVisibleItems ?? options.labels.length));

  const selectedIndex = clampMenuSelection(options.selectedIndex ?? 0, options.labels.length);
  visibleMenuSliceInto(visible, options.labels, selectedIndex, maxVisibleItems);

  const rect = layoutWorkbenchTopMenuItemRect({
    menuStart: options.menuStart,
    itemId: options.itemId,
    items: options.menuItems,
    activeIndex: options.menuActiveIndex,
    preferredWidth: Math.max(options.preferredWidth, maxMeasuredTextWidth(options.labels, measureText) + 6),
    preferredHeight: visible.items.length + 2,
    maxWidth: options.maxWidth,
    measureText,
  });

  return {
    kind: options.menuId,
    coordinate: "screen",
    rect,
    items: visible.items,
    itemIndexes: visible.indexes,
    selectedIndex: visible.indexes.indexOf(selectedIndex),
  };
}

/** Projects the active standard top-menu dropdown overlay, if one is open and configured. */
export function workbenchStandardTopMenuDropdownOverlayInto(
  options: WorkbenchStandardTopMenuDropdownOverlayOptions,
): WorkbenchTopMenuDropdownOverlay | null {
  const openId = options.openId;
  if (!openId) return null;
  const entry = options.entries[openId];
  if (!entry) return null;
  return workbenchTopMenuDropdownOverlayInto(entry.visible, {
    menuStart: options.menuStart,
    menuId: openId,
    itemId: entry.itemId ?? workbenchTopMenuItemIdForStandardMenu(openId),
    menuItems: options.menuItems,
    menuActiveIndex: options.menuActiveIndex,
    labels: entry.labels,
    selectedIndex: entry.selectedIndex,
    preferredWidth: entry.preferredWidth,
    maxWidth: options.maxWidth,
    maxVisibleItems: entry.maxVisibleItems,
    measureText: options.measureText,
  });
}

/** Lays out visible top-menu item hit rectangles within an available row width. */
export function layoutWorkbenchMenuBarHits(options: WorkbenchMenuBarHitLayoutOptions): WorkbenchMenuBarHitLayout[] {
  return layoutWorkbenchMenuBarHitsInto([], options);
}

/** Lays out visible top-menu item hit rectangles into caller-owned storage. */
export function layoutWorkbenchMenuBarHitsInto(
  target: WorkbenchMenuBarHitLayout[],
  options: WorkbenchMenuBarHitLayoutOptions,
): WorkbenchMenuBarHitLayout[] {
  const measureText = options.measureText ?? ((value) => value.length);
  const start = Math.max(0, Math.floor(options.column));
  const end = start + Math.max(0, Math.floor(options.width));
  const row = Math.max(0, Math.floor(options.row));
  target.length = 0;
  let cursor = start;

  for (const [index, item] of options.items.entries()) {
    const label = item.disabled ? `(${item.label})` : item.label;
    const token = index === options.activeIndex ? `[${label}]` : label;
    const tokenWidth = measureText(token);
    if (cursor + tokenWidth > end) break;
    target.push({
      index,
      rect: { column: cursor, row, width: tokenWidth, height: 1 },
      token,
    });
    cursor += tokenWidth + 1;
  }

  return target;
}

/** Lays out the header menu strip and optional close button for workbench render adapters. */
export function layoutWorkbenchHeader(options: WorkbenchHeaderLayoutOptions): WorkbenchHeaderLayout {
  return layoutWorkbenchHeaderInto({ menu: { column: 0, row: 0, width: 0, height: 1 } }, options);
}

/** Lays out the header menu strip into caller-owned storage. */
export function layoutWorkbenchHeaderInto(
  target: WorkbenchHeaderLayout,
  options: WorkbenchHeaderLayoutOptions,
): WorkbenchHeaderLayout {
  const width = Math.max(0, Math.floor(options.width));
  const row = Math.max(0, Math.floor(options.row ?? 0));
  const menuStart = Math.max(0, Math.floor(options.menuStart ?? 17));
  const closeWidth = Math.max(0, Math.floor(options.closeWidth ?? 0));
  const closeVisible = closeWidth > 0 && width >= Math.max(0, Math.floor(options.closeMinWidth ?? 0));
  const reservedCloseWidth = closeVisible || options.reserveCloseWhenHidden ? closeWidth : 0;
  const menuWidth = Math.max(0, width - menuStart - reservedCloseWidth);
  target.menu.column = menuStart;
  target.menu.row = row;
  target.menu.width = menuWidth;
  target.menu.height = 1;
  if (closeVisible) {
    const close = target.close ?? { column: 0, row, width: 0, height: 1 };
    close.column = Math.max(0, width - closeWidth);
    close.row = row;
    close.width = closeWidth;
    close.height = 1;
    target.close = close;
  } else {
    target.close = undefined;
  }
  return target;
}

function workbenchTopMenuItemIdForStandardMenu(menuId: WorkbenchStandardTopMenuId): string {
  return menuId === "newWindow" ? "new" : menuId;
}

function clampMenuSelection(index: number, count: number): number {
  if (count <= 0) return 0;
  return Math.max(0, Math.min(count - 1, Math.floor(index)));
}

function maxMeasuredTextWidth(values: readonly string[], measureText: (value: string) => number): number {
  let width = 0;
  for (const value of values) width = Math.max(width, measureText(value));
  return width;
}
