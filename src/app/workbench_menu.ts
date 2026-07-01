// Copyright 2023 Im-Beast. MIT license.
import type { Rectangle } from "../types.ts";

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

/** Serializable inspection snapshot for mutually-exclusive top menu disclosure state. */
export interface WorkbenchTopMenuInspection<MenuId extends string = string> {
  openId: MenuId | null;
  focused: boolean;
}

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

/** Return whether a key should activate the selected dropdown/menu item. */
export function isWorkbenchMenuActivationKey(key: string): boolean {
  return key === "return" || key === "space";
}

/** Return whether a key should close the active dropdown/menu. */
export function isWorkbenchMenuCloseKey(key: string): boolean {
  return key === "escape" || key === "tab";
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

/** Lays out visible top-menu item hit rectangles within an available row width. */
export function layoutWorkbenchMenuBarHits(options: WorkbenchMenuBarHitLayoutOptions): WorkbenchMenuBarHitLayout[] {
  const measureText = options.measureText ?? ((value) => value.length);
  const start = Math.max(0, Math.floor(options.column));
  const end = start + Math.max(0, Math.floor(options.width));
  const row = Math.max(0, Math.floor(options.row));
  const hits: WorkbenchMenuBarHitLayout[] = [];
  let cursor = start;

  for (const [index, item] of options.items.entries()) {
    const label = item.disabled ? `(${item.label})` : item.label;
    const token = index === options.activeIndex ? `[${label}]` : label;
    const tokenWidth = measureText(token);
    if (cursor + tokenWidth > end) break;
    hits.push({
      index,
      rect: { column: cursor, row, width: tokenWidth, height: 1 },
      token,
    });
    cursor += tokenWidth + 1;
  }

  return hits;
}
