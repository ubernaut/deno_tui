import type { ThreeAsciiReadbackStrategy } from "../three_ascii/renderer_options.ts";
import { WORKBENCH_THREE_READBACK_STRATEGY, WORKBENCH_THREE_RESCUE_CELLS } from "./workbench_three_policy.ts";

/** Minimal Three panel option shape that can receive workbench runtime defaults. */
export interface WorkbenchThreePanelDefaultableOptions {
  idleMaxRenderCells?: unknown;
  readbackStrategy?: ThreeAsciiReadbackStrategy;
}

/** Default values applied to workbench-hosted Three panels. */
export interface WorkbenchThreePanelDefaults {
  idleMaxRenderCells: number;
  readbackStrategy: ThreeAsciiReadbackStrategy;
}

export const DEFAULT_WORKBENCH_THREE_PANEL_DEFAULTS: WorkbenchThreePanelDefaults = {
  idleMaxRenderCells: WORKBENCH_THREE_RESCUE_CELLS,
  readbackStrategy: WORKBENCH_THREE_READBACK_STRATEGY,
};

export type WorkbenchThreePanelDefaultedOptions<TOptions extends WorkbenchThreePanelDefaultableOptions> =
  & Omit<TOptions, "idleMaxRenderCells" | "readbackStrategy">
  & {
    idleMaxRenderCells: Exclude<TOptions["idleMaxRenderCells"], undefined> | number;
    readbackStrategy: ThreeAsciiReadbackStrategy;
  };

/** Applies shared workbench Three panel defaults while preserving explicit per-panel overrides. */
export function applyWorkbenchThreePanelFrameDefaults<TOptions extends WorkbenchThreePanelDefaultableOptions>(
  options: TOptions,
  defaults: WorkbenchThreePanelDefaults = DEFAULT_WORKBENCH_THREE_PANEL_DEFAULTS,
): WorkbenchThreePanelDefaultedOptions<TOptions> {
  return {
    ...options,
    idleMaxRenderCells: options.idleMaxRenderCells ?? defaults.idleMaxRenderCells,
    readbackStrategy: options.readbackStrategy ?? defaults.readbackStrategy,
  } as WorkbenchThreePanelDefaultedOptions<TOptions>;
}
