import { shouldIncludeThreeAsciiTerminalEdges, type ThreeAsciiEffectState } from "./effect_state.ts";
import type { TerminalGlyphStyle } from "./glyphs.ts";

/** Resolved terminal compute passes needed for the current renderer state. */
export interface ThreeAsciiComputeMode {
  includeEdges: boolean;
  includeDepthColor: boolean;
  includeFillReadback: boolean;
}

/** Resolve compute pass switches without touching WebGPU resources. */
export function resolveThreeAsciiComputeMode(
  effectState: Pick<ThreeAsciiEffectState, "edges" | "depthFalloff">,
  terminalGlyphStyle: TerminalGlyphStyle,
): ThreeAsciiComputeMode {
  return {
    includeEdges: shouldIncludeThreeAsciiTerminalEdges(effectState, terminalGlyphStyle),
    includeDepthColor: effectState.depthFalloff > 0,
    includeFillReadback: terminalGlyphStyle !== "blocks",
  };
}
