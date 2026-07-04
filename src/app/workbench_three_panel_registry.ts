import { setWorkbenchThreeRect, type WorkbenchThreeRectTarget } from "./workbench_three_geometry.ts";

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

function hideWorkbenchThreePanelRect(target: WorkbenchThreeRectTarget): void {
  setWorkbenchThreeRect(target, { column: 0, row: 0, width: 0, height: 0 });
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
}
