import type { asciiEffectOptions } from "./ascii_options.ts";
import type { AsciiOptions } from "./types.ts";

export type ThreePanelAsciiEffectOptions = ReturnType<typeof asciiEffectOptions>;

export interface ThreePanelRendererStateSnapshot {
  columns: number;
  rows: number;
  effectOptions?: ThreePanelAsciiEffectOptions;
  terminalEdgeBias?: number;
  terminalGlyphStyle?: AsciiOptions["terminalGlyphStyle"];
}

/** Compare the Three panel ASCII effect fields that require renderer effect updates. */
export function threePanelAsciiEffectOptionsEqual(
  left: ThreePanelAsciiEffectOptions | undefined,
  right: ThreePanelAsciiEffectOptions,
): boolean {
  if (!left) return false;
  return left.edgeThreshold === right.edgeThreshold &&
    left.normalThreshold === right.normalThreshold &&
    left.depthThreshold === right.depthThreshold &&
    left.exposure === right.exposure &&
    left.attenuation === right.attenuation &&
    left.blendWithBase === right.blendWithBase &&
    left.depthFalloff === right.depthFalloff &&
    left.depthOffset === right.depthOffset &&
    left.edges === right.edges &&
    left.fill === right.fill &&
    left.invertLuminance === right.invertLuminance;
}

/** Compare applied and requested renderer state without considering scene signal changes. */
export function threePanelRendererStateMatches(
  current: ThreePanelRendererStateSnapshot,
  next: ThreePanelRendererStateSnapshot,
): boolean {
  return current.columns === next.columns &&
    current.rows === next.rows &&
    next.effectOptions !== undefined &&
    threePanelAsciiEffectOptionsEqual(current.effectOptions, next.effectOptions) &&
    current.terminalEdgeBias === next.terminalEdgeBias &&
    current.terminalGlyphStyle === next.terminalGlyphStyle;
}
