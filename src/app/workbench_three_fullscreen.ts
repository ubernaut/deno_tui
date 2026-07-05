import type { ThreeAsciiConfigOptions } from "../three_ascii/options.ts";

/** Inputs for resolving runtime-only fullscreen Three ASCII options. */
export interface WorkbenchThreeFullscreenAsciiOptionsInput<TId extends string> {
  id: TId;
  fullscreenId?: TId | null;
  ascii: ThreeAsciiConfigOptions;
  fullscreenMinCells: number;
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
