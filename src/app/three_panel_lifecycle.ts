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

export interface ThreePanelFrameOwnershipInput<TRenderer, TBundle> {
  disposed: boolean;
  currentGeneration: number;
  frameGeneration: number;
  currentRenderer: TRenderer | undefined;
  frameRenderer: TRenderer;
  currentBundle: TBundle | undefined;
  frameBundle: TBundle;
}

export interface ThreePanelCurrentFrameInput<TRenderer, TBundle>
  extends ThreePanelFrameOwnershipInput<TRenderer, TBundle> {
  running: boolean;
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

export function ownsThreePanelFrame<TRenderer, TBundle>(
  input: ThreePanelFrameOwnershipInput<TRenderer, TBundle>,
): boolean {
  return !input.disposed && input.currentGeneration === input.frameGeneration &&
    input.currentRenderer === input.frameRenderer && input.currentBundle === input.frameBundle;
}

export function isCurrentThreePanelFrame<TRenderer, TBundle>(
  input: ThreePanelCurrentFrameInput<TRenderer, TBundle>,
): boolean {
  return input.running && ownsThreePanelFrame(input);
}
