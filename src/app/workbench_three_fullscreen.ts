import type { ThreeAsciiConfigOptions } from "../three_ascii/options.ts";
import { apiWorkbenchThreeEffectiveMaxCells, workbenchThreeFullscreenRenderCells } from "./workbench_three_policy.ts";

/** Inputs for resolving runtime-only fullscreen Three ASCII options. */
export interface WorkbenchThreeFullscreenAsciiOptionsInput<TId extends string> {
  id: TId;
  fullscreenId?: TId | null;
  ascii: ThreeAsciiConfigOptions;
  fullscreenMinCells: number;
}

/** Inputs for resolving one workbench Three runtime render budget snapshot. */
export interface WorkbenchThreeRuntimeBudgetSnapshotInput<TId extends string> {
  id: TId;
  fullscreenId?: TId | null;
  ascii: ThreeAsciiConfigOptions;
  liveMaxCells: number;
  fullscreenMaxCells: number;
  viewport: { width: number; height: number };
  fullscreenViewportPadding?: { columns?: number; rows?: number };
  isThreeWindow?: (id: TId) => boolean;
}

/** Runtime render budget values derived from the current viewport and fullscreen state. */
export interface WorkbenchThreeRuntimeBudgetSnapshot {
  fullscreenTargetCells: number;
  effectiveMaxCells: number;
  runtimeAscii: ThreeAsciiConfigOptions;
}

/** Raises a fullscreen Three pane's runtime render-cell budget without mutating saved ASCII options. */
export function resolveWorkbenchThreeFullscreenAsciiOptions<TId extends string>(
  input: WorkbenchThreeFullscreenAsciiOptionsInput<TId>,
): ThreeAsciiConfigOptions {
  const fullscreenMinCells = Math.max(1, Math.floor(input.fullscreenMinCells));
  if (input.fullscreenId !== input.id || input.ascii.renderMaxCells >= fullscreenMinCells) {
    return input.ascii;
  }
  return {
    ...input.ascii,
    renderMaxCells: fullscreenMinCells,
  };
}

/** Resolves fullscreen target, active pressure cap, and runtime ASCII options for a Three workbench pane. */
export function resolveWorkbenchThreeRuntimeBudgetSnapshot<TId extends string>(
  input: WorkbenchThreeRuntimeBudgetSnapshotInput<TId>,
): WorkbenchThreeRuntimeBudgetSnapshot {
  const padding = input.fullscreenViewportPadding ?? {};
  const fullscreenTargetCells = workbenchThreeFullscreenRenderCells({
    width: Math.max(0, input.viewport.width - Math.max(0, Math.floor(padding.columns ?? 0))),
    height: Math.max(0, input.viewport.height - Math.max(0, Math.floor(padding.rows ?? 0))),
  });
  const fullscreenThree = input.fullscreenId !== undefined && input.fullscreenId !== null &&
    (input.isThreeWindow?.(input.fullscreenId) ?? input.fullscreenId === input.id);
  const effectiveMaxCells = fullscreenThree
    ? apiWorkbenchThreeEffectiveMaxCells(input.fullscreenMaxCells, {
      fullscreenThree: true,
      fullscreenMinCells: fullscreenTargetCells,
    })
    : Math.max(1, Math.floor(input.liveMaxCells));
  return {
    fullscreenTargetCells,
    effectiveMaxCells,
    runtimeAscii: resolveWorkbenchThreeFullscreenAsciiOptions({
      id: input.id,
      fullscreenId: input.fullscreenId,
      ascii: input.ascii,
      fullscreenMinCells: fullscreenTargetCells,
    }),
  };
}

/** Compares every persisted/runtime Three ASCII option field used by the workbench. */
export function sameWorkbenchThreeAsciiOptions(
  left: ThreeAsciiConfigOptions,
  right: ThreeAsciiConfigOptions,
): boolean {
  return left.preset === right.preset && left.border === right.border &&
    left.terminalGlyphStyle === right.terminalGlyphStyle &&
    left.terminalEdgeBias === right.terminalEdgeBias &&
    left.edgeThreshold === right.edgeThreshold &&
    left.normalThreshold === right.normalThreshold &&
    left.depthThreshold === right.depthThreshold &&
    left.exposure === right.exposure &&
    left.attenuation === right.attenuation &&
    left.blendWithBase === right.blendWithBase &&
    left.depthFalloff === right.depthFalloff &&
    left.depthOffset === right.depthOffset &&
    left.wireframeThickness === right.wireframeThickness &&
    left.renderMaxCells === right.renderMaxCells &&
    left.deferredReadbackSlots === right.deferredReadbackSlots &&
    left.edges === right.edges &&
    left.fill === right.fill &&
    left.invertLuminance === right.invertLuminance &&
    left.kittyGraphics === right.kittyGraphics &&
    left.kittyDisableAscii === right.kittyDisableAscii;
}
