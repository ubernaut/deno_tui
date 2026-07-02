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

/** Renderer adapter state mirrored from a WindowManagerController. */
export interface WorkbenchWindowSignalState<TWindowId extends string = string> {
  activeId?: TWindowId;
  fullscreenId?: TWindowId | null;
  minimized: Record<TWindowId, boolean>;
}

/** Options for projecting window-manager state into renderer adapter signals. */
export interface InspectWorkbenchWindowSignalStateOptions<TWindowId extends string = string> {
  windowIds: readonly TWindowId[];
  defaultActiveId?: TWindowId;
}

/** Options for applying renderer adapter signals back to a WindowManagerController. */
export interface ApplyWorkbenchWindowSignalStateOptions<TWindowId extends string = string> {
  windowIds: readonly TWindowId[];
  createWindow: (id: TWindowId, order: number) => WindowManagerOptions["windows"][number];
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

/** Projects window-manager state into the small signal shape used by renderer adapters. */
export function inspectWorkbenchWindowSignalState<TWindowId extends string>(
  controller: WindowManagerController,
  options: InspectWorkbenchWindowSignalStateOptions<TWindowId>,
): WorkbenchWindowSignalState<TWindowId> {
  const validIds = new Set<string>(options.windowIds);
  const inspection = controller.inspect();
  const minimized = {} as Record<TWindowId, boolean>;
  for (let index = 0; index < options.windowIds.length; index += 1) {
    minimized[options.windowIds[index]!] = false;
  }
  for (let index = 0; index < inspection.windows.length; index += 1) {
    const entry = inspection.windows[index]!;
    if (validIds.has(entry.id)) minimized[entry.id as TWindowId] = entry.minimized;
  }
  const activeId = validIds.has(inspection.activeId ?? "") ? inspection.activeId as TWindowId : options.defaultActiveId;
  const fullscreenId = validIds.has(inspection.fullscreenId ?? "") ? inspection.fullscreenId as TWindowId : null;
  return { activeId, fullscreenId, minimized };
}

/** Applies renderer adapter signal state to a WindowManagerController without renderer-specific branching. */
export function applyWorkbenchWindowSignalState<TWindowId extends string>(
  controller: WindowManagerController,
  state: Partial<WorkbenchWindowSignalState<TWindowId>>,
  options: ApplyWorkbenchWindowSignalStateOptions<TWindowId>,
): void {
  const validIds = new Set<string>(options.windowIds);
  const fullscreenId = validIds.has(state.fullscreenId ?? "") ? state.fullscreenId ?? undefined : undefined;
  const activeId = validIds.has(state.activeId ?? "") ? state.activeId : undefined;
  const minimized = state.minimized ?? ({} as Record<TWindowId, boolean>);
  controller.activeId.value = activeId;
  controller.fullscreenId.value = fullscreenId;
  controller.windows.value = options.windowIds.map((id, order) => ({
    ...options.createWindow(id, order),
    order,
    state: minimized[id] && id !== fullscreenId ? "minimized" : "normal",
  }));
}

function clampMenuIndex(index: number, itemCount: number): number {
  const normalized = Number.isFinite(index) ? Math.trunc(index) : 0;
  if (itemCount <= 0) return 0;
  return Math.max(0, Math.min(itemCount - 1, normalized));
}
