import { hideWorkbenchThreeRect, type WorkbenchThreeRectTarget } from "./workbench_three_policy.ts";

export interface WorkbenchThreeInteractivePanel {
  rotateBy(deltaColumns: number, deltaRows: number): unknown;
  zoomBy(scrollSteps: number): unknown;
}

export interface WorkbenchThreeViewportHit<TId extends string> {
  action: { type: "threeViewport"; id: TId } | { type: string };
}

export interface WorkbenchThreeMousePress {
  x: number;
  y: number;
  drag: boolean;
  release: boolean;
  movementX: number;
  movementY: number;
}

export interface WorkbenchThreeMouseScroll {
  x: number;
  y: number;
  scroll: number;
}

export interface WorkbenchThreeViewportInteractionOptions<TId extends string> {
  findHit: (x: number, y: number) => WorkbenchThreeViewportHit<TId> | undefined;
  panelForWindow: (id: TId) => WorkbenchThreeInteractivePanel | undefined;
  focusWindow: (id: TId) => void;
}

export interface WorkbenchThreePointerPressResult<TId extends string> {
  handled: boolean;
  dragWindow: TId | null;
}

export interface WorkbenchThreePanelLifecycle {
  dispose(): void;
}

export interface WorkbenchThreeDisposableSignal {
  dispose(): void;
}

export interface WorkbenchThreeNullableSignal<TValue> {
  peek(): TValue | null;
  value: TValue | null;
}

export interface WorkbenchThreePanelEntry<TPanel extends WorkbenchThreePanelLifecycle, TScene = unknown> {
  rectangle: WorkbenchThreeRectTarget & WorkbenchThreeDisposableSignal;
  graphicsRectangle: WorkbenchThreeRectTarget & WorkbenchThreeDisposableSignal;
  scene: WorkbenchThreeNullableSignal<TScene> & WorkbenchThreeDisposableSignal;
  panel: TPanel;
  resources?: readonly WorkbenchThreeDisposableSignal[];
}

export type WorkbenchThreePanelFactory<TId extends string, TPanel extends WorkbenchThreePanelLifecycle, TScene> = (
  id: TId,
) => WorkbenchThreePanelEntry<TPanel, TScene>;

/** Owns lazily-created Three panel instances for dynamic workbench visualization windows. */
export class WorkbenchThreePanelRegistry<
  TId extends string,
  TPanel extends WorkbenchThreePanelLifecycle,
  TScene = unknown,
> {
  readonly entries = new Map<TId, WorkbenchThreePanelEntry<TPanel, TScene>>();

  constructor(private readonly createEntry: WorkbenchThreePanelFactory<TId, TPanel, TScene>) {}

  ensure(id: TId): WorkbenchThreePanelEntry<TPanel, TScene> {
    const existing = this.entries.get(id);
    if (existing) return existing;
    const entry = this.createEntry(id);
    this.entries.set(id, entry);
    return entry;
  }

  get(id: TId): WorkbenchThreePanelEntry<TPanel, TScene> | undefined {
    return this.entries.get(id);
  }

  hide(id: TId): void {
    const entry = this.entries.get(id);
    if (!entry) return;
    hideWorkbenchThreePanelScene(entry.scene);
    hideWorkbenchThreePanelRect(entry.rectangle);
    hideWorkbenchThreePanelRect(entry.graphicsRectangle);
  }

  hideExcept(visibleIds: ReadonlySet<TId>): void {
    for (const id of this.entries.keys()) {
      if (!visibleIds.has(id)) this.hide(id);
    }
  }

  dispose(id: TId): void {
    const entry = this.entries.get(id);
    if (!entry) return;
    disposeWorkbenchThreePanelEntry(entry);
    this.entries.delete(id);
  }

  clear(): void {
    for (const entry of this.entries.values()) {
      disposeWorkbenchThreePanelEntry(entry);
    }
    this.entries.clear();
  }
}

/** Routes mouse drag and wheel events for workbench-hosted Three renderer viewports. */
export class WorkbenchThreeViewportInteractionController<TId extends string> {
  #dragWindow: TId | null = null;

  constructor(private readonly options: WorkbenchThreeViewportInteractionOptions<TId>) {}

  get dragWindow(): TId | null {
    return this.#dragWindow;
  }

  handlePress(event: WorkbenchThreeMousePress): WorkbenchThreePointerPressResult<TId> {
    if (event.release) {
      this.#dragWindow = null;
      return { handled: true, dragWindow: this.#dragWindow };
    }

    if (event.drag && this.#dragWindow) {
      if (this.rotateWindow(this.#dragWindow, event.movementX, event.movementY)) {
        return { handled: true, dragWindow: this.#dragWindow };
      }
      this.#dragWindow = null;
    }

    const hit = this.options.findHit(event.x, event.y);
    if (!isWorkbenchThreeViewportHit(hit)) {
      this.#dragWindow = null;
      return { handled: false, dragWindow: this.#dragWindow };
    }

    const id = hit.action.id;
    this.#dragWindow = id;
    this.options.focusWindow(id);
    if (event.drag) this.rotateWindow(id, event.movementX, event.movementY);
    return { handled: true, dragWindow: this.#dragWindow };
  }

  handleScroll(event: WorkbenchThreeMouseScroll): boolean {
    const hit = this.options.findHit(event.x, event.y);
    if (!isWorkbenchThreeViewportHit(hit)) return false;
    const panel = this.options.panelForWindow(hit.action.id);
    if (!panel) return false;
    panel.zoomBy(event.scroll);
    this.options.focusWindow(hit.action.id);
    return true;
  }

  rotateWindow(id: TId, movementX: number, movementY: number): boolean {
    const panel = this.options.panelForWindow(id);
    if (!panel) return false;
    panel.rotateBy(movementX, movementY);
    this.options.focusWindow(id);
    return true;
  }
}

function hideWorkbenchThreePanelRect(target: WorkbenchThreeRectTarget): void {
  hideWorkbenchThreeRect(target);
}

function hideWorkbenchThreePanelScene<TScene>(target: WorkbenchThreeNullableSignal<TScene>): void {
  if (target.peek() !== null) target.value = null;
}

function disposeWorkbenchThreePanelEntry<TPanel extends WorkbenchThreePanelLifecycle>(
  entry: WorkbenchThreePanelEntry<TPanel, unknown>,
): void {
  entry.panel.dispose();
  entry.scene.dispose();
  entry.rectangle.dispose();
  entry.graphicsRectangle.dispose();
  for (const resource of entry.resources ?? []) resource.dispose();
}

function isWorkbenchThreeViewportHit<TId extends string>(
  hit: WorkbenchThreeViewportHit<TId> | undefined,
): hit is { action: { type: "threeViewport"; id: TId } } {
  return hit?.action.type === "threeViewport";
}
