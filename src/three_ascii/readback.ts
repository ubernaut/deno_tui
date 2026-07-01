// Copyright 2023 Im-Beast. MIT license.

const FLOAT_BYTE_LENGTH = Float32Array.BYTES_PER_ELEMENT;

export interface ThreeAsciiReadbackLayoutOptions {
  fillByteLength: number;
  edgeByteLength: number;
  colorByteLength: number;
  includeEdges: boolean;
}

export interface ThreeAsciiReadbackLayout {
  fillOffset: number;
  edgeOffset?: number;
  colorOffset: number;
  byteLength: number;
  fillFloatLength: number;
  edgeFloatLength: number;
  colorFloatLength: number;
}

export interface ThreeAsciiReadbackViews {
  fillGlyphs: Float32Array;
  edgeGlyphs?: Float32Array;
  colors: Float32Array;
}

export function createThreeAsciiReadbackLayout(options: ThreeAsciiReadbackLayoutOptions): ThreeAsciiReadbackLayout {
  const fillByteLength = validateByteLength("fill", options.fillByteLength);
  const edgeByteLength = validateByteLength("edge", options.edgeByteLength);
  const colorByteLength = validateByteLength("color", options.colorByteLength);
  const fillOffset = 0;
  const edgeOffset = options.includeEdges ? fillOffset + fillByteLength : undefined;
  const colorOffset = fillOffset + fillByteLength + (options.includeEdges ? edgeByteLength : 0);

  return {
    fillOffset,
    edgeOffset,
    colorOffset,
    byteLength: colorOffset + colorByteLength,
    fillFloatLength: fillByteLength / FLOAT_BYTE_LENGTH,
    edgeFloatLength: edgeByteLength / FLOAT_BYTE_LENGTH,
    colorFloatLength: colorByteLength / FLOAT_BYTE_LENGTH,
  };
}

export function createThreeAsciiReadbackViews(
  source: ArrayBuffer,
  layout: ThreeAsciiReadbackLayout,
): ThreeAsciiReadbackViews {
  return {
    fillGlyphs: new Float32Array(source, layout.fillOffset, layout.fillFloatLength),
    edgeGlyphs: layout.edgeOffset === undefined
      ? undefined
      : new Float32Array(source, layout.edgeOffset, layout.edgeFloatLength),
    colors: new Float32Array(source, layout.colorOffset, layout.colorFloatLength),
  };
}

function validateByteLength(label: string, value: number): number {
  if (!Number.isFinite(value) || value < 0 || !Number.isInteger(value)) {
    throw new RangeError(`Three ASCII ${label} readback byte length must be a non-negative integer.`);
  }
  if (value % FLOAT_BYTE_LENGTH !== 0) {
    throw new RangeError(`Three ASCII ${label} readback byte length must be Float32-aligned.`);
  }
  return value;
}
