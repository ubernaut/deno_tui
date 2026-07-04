// Copyright 2023 Im-Beast. MIT license.
import { Color } from "npm:three@0.183.2";

import type { AcerolaAsciiNodeOptions } from "./AcerolaAsciiNode.ts";
import { colorValue } from "./ansi_grid.ts";
import type { TerminalGlyphStyle } from "./glyphs.ts";
import type { ThreeAsciiUniformEffectState } from "./uniforms.ts";

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

export function defaultThreeAsciiEffectState(
  options: Partial<AcerolaAsciiNodeOptions> = {},
): ThreeAsciiEffectState {
  return {
    edges: true,
    fill: true,
    invertLuminance: false,
    exposure: 1,
    attenuation: 1,
    blendWithBase: 0,
    depthFalloff: 0,
    depthOffset: 0,
    edgeThreshold: 8,
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
