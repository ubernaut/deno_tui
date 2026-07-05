// Copyright 2023 Im-Beast. MIT license.
import { Color } from "npm:three@0.183.2";

import type { AcerolaAsciiNodeOptions } from "./AcerolaAsciiNode.ts";
import { colorValue } from "./colors.ts";
import type { ThreeAsciiUniformEffectState } from "./compute_resources.ts";
import type { TerminalGlyphStyle } from "./glyphs.ts";

interface ThreeAsciiEffectUniformLike<T> {
  value: T;
}

export interface ThreeAsciiEffectStateSource {
  edges: ThreeAsciiEffectUniformLike<unknown>;
  fill: ThreeAsciiEffectUniformLike<unknown>;
  invertLuminance: ThreeAsciiEffectUniformLike<unknown>;
  exposure: ThreeAsciiEffectUniformLike<unknown>;
  attenuation: ThreeAsciiEffectUniformLike<unknown>;
  blendWithBase: ThreeAsciiEffectUniformLike<unknown>;
  depthFalloff: ThreeAsciiEffectUniformLike<unknown>;
  depthOffset: ThreeAsciiEffectUniformLike<unknown>;
  edgeThreshold: ThreeAsciiEffectUniformLike<unknown>;
  asciiColor: ThreeAsciiEffectUniformLike<unknown>;
  backgroundColor: ThreeAsciiEffectUniformLike<unknown>;
}

export interface ThreeAsciiEffectState extends ThreeAsciiUniformEffectState {
  asciiColor: Color;
  backgroundColor: Color;
}

/** Resolved terminal compute passes needed for the current renderer state. */
export interface ThreeAsciiComputeMode {
  includeFill: boolean;
  includeEdges: boolean;
  includeDepthColor: boolean;
  includeFillReadback: boolean;
}

export function defaultThreeAsciiEffectState(
  options: Partial<AcerolaAsciiNodeOptions> = {},
): ThreeAsciiEffectState {
  return {
    edges: options.edges ?? true,
    fill: options.fill ?? true,
    invertLuminance: options.invertLuminance ?? false,
    exposure: options.exposure ?? 1,
    attenuation: options.attenuation ?? 1,
    blendWithBase: options.blendWithBase ?? 0,
    depthFalloff: options.depthFalloff ?? 0,
    depthOffset: options.depthOffset ?? 0,
    edgeThreshold: options.edgeThreshold ?? 8,
    asciiColor: colorValue(options.asciiColor, 0xffffff),
    backgroundColor: colorValue(options.backgroundColor, 0x000000),
  };
}

export function threeAsciiEffectStateFromSource(
  source: ThreeAsciiEffectStateSource | undefined,
  fallbackOptions: Partial<AcerolaAsciiNodeOptions> = {},
): ThreeAsciiEffectState {
  if (!source) {
    return defaultThreeAsciiEffectState(fallbackOptions);
  }

  return {
    edges: Boolean(source.edges.value),
    fill: Boolean(source.fill.value),
    invertLuminance: Boolean(source.invertLuminance.value),
    exposure: Number(source.exposure.value),
    attenuation: Number(source.attenuation.value),
    blendWithBase: Number(source.blendWithBase.value),
    depthFalloff: Number(source.depthFalloff.value),
    depthOffset: Number(source.depthOffset.value),
    edgeThreshold: Number(source.edgeThreshold.value),
    asciiColor: source.asciiColor.value as Color,
    backgroundColor: source.backgroundColor.value as Color,
  };
}

export function shouldIncludeThreeAsciiTerminalEdges(
  effectState: Pick<ThreeAsciiEffectState, "edges">,
  terminalGlyphStyle: TerminalGlyphStyle,
): boolean {
  return effectState.edges && terminalGlyphStyle !== "blocks";
}

/** Resolve compute pass switches without touching WebGPU resources. */
export function resolveThreeAsciiComputeMode(
  effectState: Pick<ThreeAsciiEffectState, "edges" | "depthFalloff">,
  terminalGlyphStyle: TerminalGlyphStyle,
): ThreeAsciiComputeMode {
  return {
    includeFill: terminalGlyphStyle !== "blocks",
    includeEdges: shouldIncludeThreeAsciiTerminalEdges(effectState, terminalGlyphStyle),
    includeDepthColor: effectState.depthFalloff > 0,
    includeFillReadback: terminalGlyphStyle !== "blocks",
  };
}
