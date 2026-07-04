// Copyright 2023 Im-Beast. MIT license.
import type { AcerolaAsciiRenderProfile } from "./AcerolaAsciiNode.ts";
import { resolveThreeAsciiComputeMode } from "./compute_mode.ts";
import type { ThreeAsciiEffectState } from "./effect_state.ts";
import type { ThreeAsciiRenderFrameSelection } from "./frame_options.ts";
import type { TerminalGlyphStyle } from "./glyphs.ts";

/** Inputs for selecting which Acerola render targets a renderer frame needs. */
export interface ThreeAsciiRenderProfileInput {
  selection: Pick<ThreeAsciiRenderFrameSelection, "renderAnsi" | "renderImage">;
  effectState?: Pick<ThreeAsciiEffectState, "edges" | "depthFalloff">;
  terminalGlyphStyle: TerminalGlyphStyle;
}

/** Resolve the Acerola render profile required by one terminal/image renderer frame. */
export function resolveThreeAsciiRenderProfile(
  input: ThreeAsciiRenderProfileInput,
): AcerolaAsciiRenderProfile {
  return resolveThreeAsciiRenderProfileInto(input, {
    image: false,
    terminalEdges: false,
    terminalDepthColor: false,
  });
}

/** Resolve the Acerola render profile into a caller-owned object. */
export function resolveThreeAsciiRenderProfileInto(
  input: ThreeAsciiRenderProfileInput,
  target: AcerolaAsciiRenderProfile,
): AcerolaAsciiRenderProfile {
  if (input.selection.renderImage) {
    target.image = true;
    target.terminalEdges = true;
    target.terminalDepthColor = true;
    return target;
  }

  if (!input.effectState) {
    target.image = false;
    target.terminalEdges = false;
    target.terminalDepthColor = false;
    return target;
  }

  const computeMode = resolveThreeAsciiComputeMode(input.effectState, input.terminalGlyphStyle);
  target.image = false;
  target.terminalEdges = input.selection.renderAnsi && computeMode.includeEdges;
  target.terminalDepthColor = input.selection.renderAnsi && computeMode.includeDepthColor;
  return target;
}
