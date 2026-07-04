// Copyright 2023 Im-Beast. MIT license.
import type { AcerolaAsciiRenderProfile } from "./AcerolaAsciiNode.ts";
import { resolveThreeAsciiComputeMode } from "./compute_mode.ts";
import type { ThreeAsciiEffectState } from "./effect_state.ts";
import type { ThreeAsciiRenderFrameSelection } from "./frame_options.ts";
import type { TerminalGlyphStyle } from "./glyphs.ts";

/** Inputs for selecting which Acerola render targets a renderer frame needs. */
export interface ThreeAsciiRenderProfileInput {
  selection: Pick<ThreeAsciiRenderFrameSelection, "renderAnsi" | "renderImage">;
  effectState: Pick<ThreeAsciiEffectState, "edges" | "depthFalloff">;
  terminalGlyphStyle: TerminalGlyphStyle;
}

/** Resolve the Acerola render profile required by one terminal/image renderer frame. */
export function resolveThreeAsciiRenderProfile(
  input: ThreeAsciiRenderProfileInput,
): AcerolaAsciiRenderProfile {
  if (input.selection.renderImage) {
    return { image: true, terminalEdges: true, terminalDepthColor: true };
  }

  const computeMode = resolveThreeAsciiComputeMode(input.effectState, input.terminalGlyphStyle);
  return {
    image: false,
    terminalEdges: input.selection.renderAnsi && computeMode.includeEdges,
    terminalDepthColor: input.selection.renderAnsi && computeMode.includeDepthColor,
  };
}
