// Copyright 2023 Im-Beast. MIT license.
import { Color } from "three";

import type { AcerolaAsciiNodeOptions } from "./AcerolaAsciiNode.ts";
import { colorValue } from "./colors.ts";
import type { ThreeAsciiUniformEffectState } from "./compute_resources.ts";
import type { TerminalGlyphStyle } from "./glyphs.ts";

const EFFECT_SCALAR_OPTION_KEYS = [
  "resolutionScale",
  "zoom",
  "kernelSize",
  "sigma",
  "sigmaScale",
  "tau",
  "threshold",
  "useDepth",
  "depthThreshold",
  "useNormals",
  "normalThreshold",
  "depthCutoff",
  "edgeThreshold",
  "edges",
  "fill",
  "exposure",
  "attenuation",
  "invertLuminance",
  "blendWithBase",
  "depthFalloff",
  "depthOffset",
  "viewDog",
  "viewUncompressed",
  "viewEdges",
] as const;

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

export interface ThreeAsciiEffectOptionsPatchResult {
  changed: boolean;
  patch: Partial<AcerolaAsciiNodeOptions>;
  uniformDirty: boolean;
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

export function patchThreeAsciiEffectOptions(
  target: AcerolaAsciiNodeOptions,
  options: Partial<AcerolaAsciiNodeOptions>,
): ThreeAsciiEffectOptionsPatchResult {
  const patch: Partial<AcerolaAsciiNodeOptions> = {};
  let uniformDirty = false;

  if (options.asciiColor !== undefined) {
    const next = colorValue(options.asciiColor, 0xffffff);
    const previous = colorValue(target.asciiColor, 0xffffff);
    if (!previous.equals(next)) {
      target.asciiColor = next;
      patch.asciiColor = next;
      uniformDirty = true;
    }
  }

  if (options.backgroundColor !== undefined) {
    const next = colorValue(options.backgroundColor, 0x000000);
    const previous = colorValue(target.backgroundColor, 0x000000);
    if (!previous.equals(next)) {
      target.backgroundColor = next;
      patch.backgroundColor = next;
      uniformDirty = true;
    }
  }

  for (const key of EFFECT_SCALAR_OPTION_KEYS) {
    const value = options[key];
    if (value === undefined || target[key] === value) continue;
    (target as Record<string, unknown>)[key] = value;
    (patch as Record<string, unknown>)[key] = value;
  }

  if (options.offset !== undefined && !sameThreeAsciiOffset(target.offset, options.offset)) {
    target.offset = options.offset;
    patch.offset = options.offset;
  }

  uniformDirty = uniformDirty || threeAsciiEffectOptionsAffectComputeUniforms(patch);
  return {
    changed: Object.keys(patch).length > 0,
    patch,
    uniformDirty,
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

export function threeAsciiEffectOptionsAffectComputeUniforms(options: Partial<AcerolaAsciiNodeOptions>): boolean {
  return options.edgeThreshold !== undefined ||
    options.edges !== undefined ||
    options.fill !== undefined ||
    options.exposure !== undefined ||
    options.attenuation !== undefined ||
    options.invertLuminance !== undefined ||
    options.blendWithBase !== undefined ||
    options.depthFalloff !== undefined ||
    options.depthOffset !== undefined;
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

function sameThreeAsciiOffset(
  left: AcerolaAsciiNodeOptions["offset"],
  right: NonNullable<AcerolaAsciiNodeOptions["offset"]>,
): boolean {
  return left !== undefined && left.x === right.x && left.y === right.y;
}
