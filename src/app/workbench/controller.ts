// Copyright 2023 Im-Beast. MIT license.
import { WindowManagerController, type WindowManagerOptions } from "../../layout/window_manager.ts";
import {
  moveWorkbenchMenuIndex,
  WorkbenchTopMenuController,
  type WorkbenchTopMenuControllerOptions,
  type WorkbenchTopMenuInspection,
} from "../workbench_menu.ts";

/** Options for configuring the renderer-neutral workbench controller. */
export interface WorkbenchControllerOptions<MenuId extends string = string> extends WindowManagerOptions {
  menu?: WorkbenchTopMenuControllerOptions<MenuId>;
  menuIndexes?: Partial<Record<MenuId, number>>;
}

/** Serializable inspection snapshot for renderer-neutral workbench coordination state. */
export interface WorkbenchControllerInspection<MenuId extends string = string> {
  activeWindowId?: string;
  fullscreenWindowId?: string;
  menu: WorkbenchTopMenuInspection<MenuId>;
  menuIndexes: Partial<Record<MenuId, number>>;
  windowIds: string[];
  visibleWindowIds: string[];
  minimizedWindowIds: string[];
  closedWindowIds: string[];
}

/** Shared controller for workbench menus, launcher indices, and window-manager state. */
export class WorkbenchController<MenuId extends string = string> {
  readonly menus: WorkbenchTopMenuController<MenuId>;
  readonly windows: WindowManagerController;
  #menuIndexes: Partial<Record<MenuId, number>>;

  constructor(options: WorkbenchControllerOptions<MenuId>) {
    this.menus = new WorkbenchTopMenuController(options.menu);
    this.windows = new WindowManagerController(options);
    this.#menuIndexes = { ...(options.menuIndexes ?? {}) };
  }

  inspect(): WorkbenchControllerInspection<MenuId> {
    const windows = this.windows.inspect().windows;
    const windowIds: string[] = [];
    const visibleWindowIds: string[] = [];
    const minimizedWindowIds: string[] = [];
    const closedWindowIds: string[] = [];
    for (let index = 0; index < windows.length; index += 1) {
      const window = windows[index]!;
      windowIds.push(window.id);
      if (window.rect !== undefined || (!window.minimized && !window.closed)) visibleWindowIds.push(window.id);
      if (window.minimized) minimizedWindowIds.push(window.id);
      if (window.closed) closedWindowIds.push(window.id);
    }
    return {
      activeWindowId: this.windows.activeId.peek(),
      fullscreenWindowId: this.windows.fullscreenId.peek(),
      menu: this.menus.inspect(),
      menuIndexes: { ...this.#menuIndexes },
      windowIds,
      visibleWindowIds,
      minimizedWindowIds,
      closedWindowIds,
    };
  }

  menuIndex(id: MenuId): number {
    return this.#menuIndexes[id] ?? 0;
  }

  setMenuIndex(id: MenuId, index: number, itemCount = Number.POSITIVE_INFINITY): number {
    const clamped = clampMenuIndex(index, itemCount);
    this.#menuIndexes = { ...this.#menuIndexes, [id]: clamped };
    return clamped;
  }

  moveMenuIndex(id: MenuId, itemCount: number, key: string, pageSize?: number): number {
    return this.setMenuIndex(
      id,
      moveWorkbenchMenuIndex(this.menuIndex(id), itemCount, { key }, { pageSize }),
      itemCount,
    );
  }

  openMenu(id: MenuId, itemCount?: number): WorkbenchTopMenuInspection<MenuId> {
    if (itemCount !== undefined) this.setMenuIndex(id, this.menuIndex(id), itemCount);
    return this.menus.open(id);
  }

  toggleMenu(id: MenuId, itemCount?: number): WorkbenchTopMenuInspection<MenuId> {
    if (itemCount !== undefined) this.setMenuIndex(id, this.menuIndex(id), itemCount);
    return this.menus.toggle(id);
  }

  closeMenus(clearFocus = true): WorkbenchTopMenuInspection<MenuId> {
    return this.menus.close(clearFocus);
  }

  focusWindow(id: string): string | undefined {
    return this.windows.focus(id)?.id;
  }

  focusNextWindow(delta = 1): string | undefined {
    return this.windows.focusNext(delta)?.id;
  }

  minimizeWindow(id?: string): string | undefined {
    return this.windows.minimize(id)?.id;
  }

  closeWindow(id?: string): string | undefined {
    return this.windows.close(id)?.id;
  }

  restoreWindows(id?: string): string | undefined {
    return this.windows.restore(id)?.id;
  }

  toggleFullscreenWindow(id?: string): string | undefined {
    return this.windows.fullscreen(id)?.id;
  }

  selectFullscreenTab(id: string): string | undefined {
    return this.windows.selectTab(id)?.id;
  }

  dispose(): void {
    this.windows.dispose();
  }
}

function clampMenuIndex(index: number, itemCount: number): number {
  const normalized = Number.isFinite(index) ? Math.trunc(index) : 0;
  if (itemCount <= 0) return 0;
  return Math.max(0, Math.min(itemCount - 1, normalized));
}
