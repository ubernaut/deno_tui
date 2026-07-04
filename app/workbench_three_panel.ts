import { ThreePanelFrameView } from "./three_panel.ts";
import { WORKBENCH_THREE_READBACK_STRATEGY, WORKBENCH_THREE_RESCUE_CELLS } from "./workbench_three_policy.ts";

export type WorkbenchThreePanelFrameViewOptions = ConstructorParameters<typeof ThreePanelFrameView>[0];

/** Creates API workbench Three panels with the shared terminal-pressure defaults. */
export function createWorkbenchThreePanelFrameView(
  options: WorkbenchThreePanelFrameViewOptions,
): ThreePanelFrameView {
  return new ThreePanelFrameView({
    ...options,
    idleMaxRenderCells: options.idleMaxRenderCells ?? WORKBENCH_THREE_RESCUE_CELLS,
    readbackStrategy: options.readbackStrategy ?? WORKBENCH_THREE_READBACK_STRATEGY,
  });
}
