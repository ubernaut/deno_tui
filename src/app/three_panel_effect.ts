import type { TerminalGlyphStyle } from "../three_ascii/glyphs.ts";

export interface ThreePanelAsciiEffectOptions {
  edgeThreshold?: number;
  normalThreshold?: number;
  depthThreshold?: number;
  exposure?: number;
  attenuation?: number;
  blendWithBase?: number;
  depthFalloff?: number;
  depthOffset?: number;
  edges?: boolean;
  fill?: boolean;
  invertLuminance?: boolean;
}

export interface ThreePanelRendererStateSnapshot {
  columns: number;
  rows: number;
  effectOptions?: ThreePanelAsciiEffectOptions;
  terminalEdgeBias?: number;
  terminalGlyphStyle?: TerminalGlyphStyle;
}

export interface ThreePanelRendererStateUpdate {
  next: ThreePanelRendererStateSnapshot;
  resize: boolean;
  effect: boolean;
  terminalEdgeBias: boolean;
  terminalGlyphStyle: boolean;
  changed: boolean;
}

export function emptyThreePanelRendererState(): ThreePanelRendererStateSnapshot {
  return {
    columns: 0,
    rows: 0,
  };
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

export function resolveThreePanelRendererStateUpdate(
  current: ThreePanelRendererStateSnapshot,
  next: ThreePanelRendererStateSnapshot,
): ThreePanelRendererStateUpdate {
  const resize = current.columns !== next.columns || current.rows !== next.rows;
  const effect = next.effectOptions !== undefined &&
    !threePanelAsciiEffectOptionsEqual(current.effectOptions, next.effectOptions);
  const terminalEdgeBias = current.terminalEdgeBias !== next.terminalEdgeBias;
  const terminalGlyphStyle = current.terminalGlyphStyle !== next.terminalGlyphStyle;
  return {
    next,
    resize,
    effect,
    terminalEdgeBias,
    terminalGlyphStyle,
    changed: resize || effect || terminalEdgeBias || terminalGlyphStyle,
  };
}
