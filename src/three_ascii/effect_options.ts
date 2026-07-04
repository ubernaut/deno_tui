// Copyright 2023 Im-Beast. MIT license.
import type { AcerolaAsciiNodeOptions } from "./AcerolaAsciiNode.ts";
import { colorValue } from "./ansi_grid.ts";

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

export interface ThreeAsciiEffectOptionsPatchResult {
  changed: boolean;
  patch: Partial<AcerolaAsciiNodeOptions>;
  uniformDirty: boolean;
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

function sameThreeAsciiOffset(
  left: AcerolaAsciiNodeOptions["offset"],
  right: NonNullable<AcerolaAsciiNodeOptions["offset"]>,
): boolean {
  return left !== undefined && left.x === right.x && left.y === right.y;
}
