export type ThreePanelLifecycleState =
  | "idle"
  | "initializing"
  | "rendering"
  | "resizing"
  | "reconfiguring"
  | "stopping"
  | "failed"
  | "disposed";

export interface ThreePanelLifecycleStateInput {
  disposed: boolean;
  failed: boolean;
  destroyPending: boolean;
  rebuildPending: boolean;
  syncPending: boolean;
  rendering: boolean;
  hasRenderer: boolean;
  visible: boolean;
  gridRows: number;
}

export function resolveThreePanelLifecycleState(input: ThreePanelLifecycleStateInput): ThreePanelLifecycleState {
  if (input.disposed) return "disposed";
  if (input.failed) return "failed";
  if (input.rebuildPending) return "reconfiguring";
  if (input.syncPending) return "resizing";
  if (input.destroyPending) return "stopping";
  if (input.rendering) return "rendering";
  if (input.hasRenderer && input.visible && input.gridRows === 0) return "initializing";
  return "idle";
}
