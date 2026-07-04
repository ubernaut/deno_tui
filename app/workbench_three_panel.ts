import { ThreePanelFrameView } from "./three_panel.ts";
import { applyWorkbenchThreePanelFrameDefaults } from "../src/app/workbench_three_panel_defaults.ts";

export type WorkbenchThreePanelFrameViewOptions = ConstructorParameters<typeof ThreePanelFrameView>[0];

/** Creates API workbench Three panels with the shared terminal-pressure defaults. */
export function createWorkbenchThreePanelFrameView(
  options: WorkbenchThreePanelFrameViewOptions,
): ThreePanelFrameView {
  return new ThreePanelFrameView(applyWorkbenchThreePanelFrameDefaults(options));
}
