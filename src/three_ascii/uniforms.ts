// Copyright 2023 Im-Beast. MIT license.

/** RGB-like color object accepted by the Three ASCII uniform packer. */
export interface ThreeAsciiUniformColor {
  r: number;
  g: number;
  b: number;
}

/** Effect state packed into the Three ASCII compute uniform buffer. */
export interface ThreeAsciiUniformEffectState {
  edges: boolean;
  fill: boolean;
  invertLuminance: boolean;
  exposure: number;
  attenuation: number;
  blendWithBase: number;
  depthFalloff: number;
  depthOffset: number;
  edgeThreshold: number;
  asciiColor: ThreeAsciiUniformColor;
  backgroundColor: ThreeAsciiUniformColor;
}

/** Geometry and terminal settings needed to pack Three ASCII compute uniforms. */
export interface ThreeAsciiUniformPackOptions {
  columns: number;
  rows: number;
  tileSize: number;
  terminalEdgeBias: number;
  terminalEdgeThresholdScale: number;
  effectState: ThreeAsciiUniformEffectState;
}

export const THREE_ASCII_UNIFORM_FLOAT_COUNT = 24;

/** Packs Three ASCII compute parameters into a caller-owned Float32Array. */
export function writeThreeAsciiUniformValues(
  target: Float32Array,
  options: ThreeAsciiUniformPackOptions,
): Float32Array {
  if (target.length < THREE_ASCII_UNIFORM_FLOAT_COUNT) {
    throw new RangeError(`Three ASCII uniform buffer requires ${THREE_ASCII_UNIFORM_FLOAT_COUNT} floats.`);
  }

  const effect = options.effectState;
  target[0] = options.columns;
  target[1] = options.rows;
  target[2] = options.columns * options.tileSize;
  target[3] = options.rows * options.tileSize;

  target[4] = effect.edges ? 1 : 0;
  target[5] = effect.fill ? 1 : 0;
  target[6] = effect.invertLuminance ? 1 : 0;
  // Browser output uses sparse 8x8 bitmap masks inside each tile. A terminal
  // edge glyph fills the whole cell much more aggressively, so the effective
  // threshold is biased upward to keep fill glyphs from being overwhelmed.
  target[7] = effect.edgeThreshold * options.terminalEdgeThresholdScale * options.terminalEdgeBias;

  target[8] = effect.exposure;
  target[9] = effect.attenuation;
  target[10] = effect.blendWithBase;
  target[11] = effect.depthFalloff;

  target[12] = effect.depthOffset;
  target[13] = 0;
  target[14] = 0;
  target[15] = 0;

  target[16] = effect.asciiColor.r;
  target[17] = effect.asciiColor.g;
  target[18] = effect.asciiColor.b;
  target[19] = 1;

  target[20] = effect.backgroundColor.r;
  target[21] = effect.backgroundColor.g;
  target[22] = effect.backgroundColor.b;
  target[23] = 1;

  return target;
}
