import type { Rectangle } from "../src/types.ts";
import { setWorkbenchThreeRect, type WorkbenchThreeRectTarget } from "./workbench_three_geometry.ts";
import {
  setWorkbenchThreeSceneSignal,
  type WorkbenchThreeScene,
  type WorkbenchThreeSceneSignalTarget,
} from "./workbench_three_scene.ts";

export interface WorkbenchThreePanelLifecycle {
  dispose(): void;
}

export interface WorkbenchThreeDisposableSignal {
  dispose(): void;
}

export interface WorkbenchThreePanelEntry<TPanel extends WorkbenchThreePanelLifecycle> {
  rectangle: WorkbenchThreeRectTarget & WorkbenchThreeDisposableSignal;
  graphicsRectangle: WorkbenchThreeRectTarget & WorkbenchThreeDisposableSignal;
  scene: WorkbenchThreeSceneSignalTarget & WorkbenchThreeDisposableSignal;
  panel: TPanel;
}

export type WorkbenchThreePanelFactory<TId extends string, TPanel extends WorkbenchThreePanelLifecycle> = (
  id: TId,
) => WorkbenchThreePanelEntry<TPanel>;

/** Owns lazily-created Three panel instances for dynamic workbench visualization windows. */
export class WorkbenchThreePanelRegistry<TId extends string, TPanel extends WorkbenchThreePanelLifecycle> {
  readonly entries = new Map<TId, WorkbenchThreePanelEntry<TPanel>>();

  constructor(private readonly createEntry: WorkbenchThreePanelFactory<TId, TPanel>) {}

  ensure(id: TId): WorkbenchThreePanelEntry<TPanel> {
    const existing = this.entries.get(id);
    if (existing) return existing;
    const entry = this.createEntry(id);
    this.entries.set(id, entry);
    return entry;
  }

  get(id: TId): WorkbenchThreePanelEntry<TPanel> | undefined {
    return this.entries.get(id);
  }

  hide(id: TId): void {
    const entry = this.entries.get(id);
    if (!entry) return;
    setWorkbenchThreeSceneSignal(entry.scene, null);
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

function disposeWorkbenchThreePanelEntry<TPanel extends WorkbenchThreePanelLifecycle>(
  entry: WorkbenchThreePanelEntry<TPanel>,
): void {
  entry.panel.dispose();
  entry.scene.dispose();
  entry.rectangle.dispose();
  entry.graphicsRectangle.dispose();
}
