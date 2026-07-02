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

/** Reuses readback layout metadata while the GPU output buffer shape is unchanged. */
export class ThreeAsciiReadbackLayoutCache {
  private cached?: ThreeAsciiReadbackLayout;
  private fillByteLength = -1;
  private edgeByteLength = -1;
  private colorByteLength = -1;
  private includeEdges = false;

  resolve(options: ThreeAsciiReadbackLayoutOptions): ThreeAsciiReadbackLayout {
    const edgeByteLength = options.includeEdges ? options.edgeByteLength : 0;
    if (
      this.cached &&
      this.fillByteLength === options.fillByteLength &&
      this.edgeByteLength === edgeByteLength &&
      this.colorByteLength === options.colorByteLength &&
      this.includeEdges === options.includeEdges
    ) {
      return this.cached;
    }

    this.cached = createThreeAsciiReadbackLayout({ ...options, edgeByteLength });
    this.fillByteLength = options.fillByteLength;
    this.edgeByteLength = edgeByteLength;
    this.colorByteLength = options.colorByteLength;
    this.includeEdges = options.includeEdges;
    return this.cached;
  }

  clear(): void {
    this.cached = undefined;
    this.fillByteLength = -1;
    this.edgeByteLength = -1;
    this.colorByteLength = -1;
    this.includeEdges = false;
  }
}

/** Reuses typed readback views while the mapped range and layout are unchanged. */
export class ThreeAsciiReadbackViewCache {
  private source?: ArrayBuffer;
  private fillOffset = -1;
  private edgeOffset = -2;
  private colorOffset = -1;
  private byteLength = -1;
  private fillFloatLength = -1;
  private edgeFloatLength = -1;
  private colorFloatLength = -1;
  private cached?: ThreeAsciiReadbackViews;

  resolve(source: ArrayBuffer, layout: ThreeAsciiReadbackLayout): ThreeAsciiReadbackViews {
    const edgeOffset = layout.edgeOffset ?? -1;
    if (
      this.cached &&
      this.source === source &&
      this.fillOffset === layout.fillOffset &&
      this.edgeOffset === edgeOffset &&
      this.colorOffset === layout.colorOffset &&
      this.byteLength === layout.byteLength &&
      this.fillFloatLength === layout.fillFloatLength &&
      this.edgeFloatLength === layout.edgeFloatLength &&
      this.colorFloatLength === layout.colorFloatLength
    ) {
      return this.cached;
    }

    this.source = source;
    this.fillOffset = layout.fillOffset;
    this.edgeOffset = edgeOffset;
    this.colorOffset = layout.colorOffset;
    this.byteLength = layout.byteLength;
    this.fillFloatLength = layout.fillFloatLength;
    this.edgeFloatLength = layout.edgeFloatLength;
    this.colorFloatLength = layout.colorFloatLength;
    this.cached = createThreeAsciiReadbackViews(source, layout);
    return this.cached;
  }

  clear(): void {
    this.source = undefined;
    this.fillOffset = -1;
    this.edgeOffset = -2;
    this.colorOffset = -1;
    this.byteLength = -1;
    this.fillFloatLength = -1;
    this.edgeFloatLength = -1;
    this.colorFloatLength = -1;
    this.cached = undefined;
  }
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
