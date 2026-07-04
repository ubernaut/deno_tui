// Copyright 2023 Im-Beast. MIT license.

const FLOAT_BYTE_LENGTH = Float32Array.BYTES_PER_ELEMENT;

export interface ThreeAsciiReadbackLayoutOptions {
  fillByteLength: number;
  edgeByteLength: number;
  colorByteLength: number;
  includeFill?: boolean;
  includeEdges: boolean;
}

export interface ThreeAsciiReadbackLayout {
  fillOffset: number;
  edgeOffset?: number;
  colorOffset: number;
  byteLength: number;
  includeFill: boolean;
  fillFloatLength: number;
  edgeFloatLength: number;
  colorFloatLength: number;
}

export interface ThreeAsciiReadbackViews {
  fillGlyphs: Float32Array;
  edgeGlyphs?: Float32Array;
  colors: Float32Array;
}

export interface ThreeAsciiReadbackCopySource {
  label: "fill" | "edge" | "color";
  byteLength: number;
}

export interface ThreeAsciiReadbackCopyCommand extends ThreeAsciiReadbackCopySource {
  targetOffset: number;
}

export interface ThreeAsciiReadbackCopyPlan {
  layout: ThreeAsciiReadbackLayout;
  commands: ThreeAsciiReadbackCopyCommand[];
}

export interface ThreeAsciiReadbackCopySources<TBuffer> {
  fill?: TBuffer;
  edge?: TBuffer;
  color: TBuffer;
}

export interface ThreeAsciiReadbackCopyTarget<TBuffer> {
  gpu: TBuffer;
}

export interface ThreeAsciiReadbackCopySourceSlots<TBuffer> {
  fill?: ThreeAsciiReadbackCopyTarget<TBuffer>;
  edge?: ThreeAsciiReadbackCopyTarget<TBuffer>;
  color: ThreeAsciiReadbackCopyTarget<TBuffer>;
}

export interface ThreeAsciiReadbackCommandEncoder<TBuffer> {
  copyBufferToBuffer(
    source: TBuffer,
    sourceOffset: number,
    target: TBuffer,
    targetOffset: number,
    byteLength: number,
  ): void;
}

/** Reuses readback copy commands while the packed output shape is unchanged. */
export class ThreeAsciiReadbackCopyPlanCache {
  private cached?: ThreeAsciiReadbackCopyPlan;
  private layout?: ThreeAsciiReadbackLayout;
  private fillByteLength = -1;
  private edgeByteLength = -1;
  private colorByteLength = -1;
  private includeFill = true;
  private includeEdges = false;

  resolve(options: {
    fill: ThreeAsciiReadbackCopySource;
    edge?: ThreeAsciiReadbackCopySource;
    color: ThreeAsciiReadbackCopySource;
    includeFill?: boolean;
    includeEdges: boolean;
    layout: ThreeAsciiReadbackLayout;
  }): ThreeAsciiReadbackCopyPlan {
    const includeFill = options.includeFill ?? true;
    const edgeByteLength = options.includeEdges ? options.edge?.byteLength ?? -1 : 0;
    if (
      this.cached &&
      this.layout === options.layout &&
      this.fillByteLength === options.fill.byteLength &&
      this.edgeByteLength === edgeByteLength &&
      this.colorByteLength === options.color.byteLength &&
      this.includeFill === includeFill &&
      this.includeEdges === options.includeEdges
    ) {
      return this.cached;
    }

    this.cached = createThreeAsciiReadbackCopyPlan(options);
    this.layout = options.layout;
    this.fillByteLength = options.fill.byteLength;
    this.edgeByteLength = edgeByteLength;
    this.colorByteLength = options.color.byteLength;
    this.includeFill = includeFill;
    this.includeEdges = options.includeEdges;
    return this.cached;
  }

  clear(): void {
    this.cached = undefined;
    this.layout = undefined;
    this.fillByteLength = -1;
    this.edgeByteLength = -1;
    this.colorByteLength = -1;
    this.includeFill = true;
    this.includeEdges = false;
  }
}

/** Reuses readback layout metadata while the GPU output buffer shape is unchanged. */
export class ThreeAsciiReadbackLayoutCache {
  private cached?: ThreeAsciiReadbackLayout;
  private fillByteLength = -1;
  private edgeByteLength = -1;
  private colorByteLength = -1;
  private includeFill = true;
  private includeEdges = false;

  resolve(options: ThreeAsciiReadbackLayoutOptions): ThreeAsciiReadbackLayout {
    const includeFill = options.includeFill ?? true;
    const edgeByteLength = options.includeEdges ? options.edgeByteLength : 0;
    if (
      this.cached &&
      this.fillByteLength === options.fillByteLength &&
      this.edgeByteLength === edgeByteLength &&
      this.colorByteLength === options.colorByteLength &&
      this.includeFill === includeFill &&
      this.includeEdges === options.includeEdges
    ) {
      return this.cached;
    }

    this.cached = createThreeAsciiReadbackLayout({ ...options, includeFill, edgeByteLength });
    this.fillByteLength = options.fillByteLength;
    this.edgeByteLength = edgeByteLength;
    this.colorByteLength = options.colorByteLength;
    this.includeFill = includeFill;
    this.includeEdges = options.includeEdges;
    return this.cached;
  }

  clear(): void {
    this.cached = undefined;
    this.fillByteLength = -1;
    this.edgeByteLength = -1;
    this.colorByteLength = -1;
    this.includeFill = true;
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
  const includeFill = options.includeFill ?? true;
  const fillByteLength = includeFill ? validateByteLength("fill", options.fillByteLength) : 0;
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
    includeFill,
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

export function createThreeAsciiReadbackCopyPlan(options: {
  fill: ThreeAsciiReadbackCopySource;
  edge?: ThreeAsciiReadbackCopySource;
  color: ThreeAsciiReadbackCopySource;
  includeFill?: boolean;
  includeEdges: boolean;
  layout: ThreeAsciiReadbackLayout;
}): ThreeAsciiReadbackCopyPlan {
  const includeFill = options.includeFill ?? true;
  const commands: ThreeAsciiReadbackCopyCommand[] = [];
  if (includeFill && options.fill.byteLength > 0) {
    commands.push({
      label: "fill",
      byteLength: options.fill.byteLength,
      targetOffset: options.layout.fillOffset,
    });
  }

  if (options.includeEdges) {
    if (!options.edge || options.layout.edgeOffset === undefined) {
      throw new Error("Three ASCII edge readback requested without an edge output layout.");
    }
    if (options.edge.byteLength > 0) {
      commands.push({
        label: "edge",
        byteLength: options.edge.byteLength,
        targetOffset: options.layout.edgeOffset,
      });
    }
  }

  if (options.color.byteLength > 0) {
    commands.push({
      label: "color",
      byteLength: options.color.byteLength,
      targetOffset: options.layout.colorOffset,
    });
  }

  return { layout: options.layout, commands };
}

export function executeThreeAsciiReadbackCopyPlan<TBuffer>(
  commandEncoder: ThreeAsciiReadbackCommandEncoder<TBuffer>,
  plan: ThreeAsciiReadbackCopyPlan,
  sources: ThreeAsciiReadbackCopySources<TBuffer>,
  target: ThreeAsciiReadbackCopyTarget<TBuffer> | undefined,
): void {
  if (!target) {
    throw new Error("ThreeAsciiRenderer readback buffer has not been initialized.");
  }
  for (const command of plan.commands) {
    const source = sources[command.label];
    if (!source) {
      throw new Error(`ThreeAsciiRenderer missing ${command.label} output buffer for readback.`);
    }
    commandEncoder.copyBufferToBuffer(
      source,
      0,
      target.gpu,
      command.targetOffset,
      command.byteLength,
    );
  }
}

/** Writes current GPU readback source buffers into a caller-owned source map. */
export function writeThreeAsciiReadbackCopySources<TBuffer>(
  target: ThreeAsciiReadbackCopySources<TBuffer>,
  sources: ThreeAsciiReadbackCopySourceSlots<TBuffer>,
): ThreeAsciiReadbackCopySources<TBuffer> {
  if (sources.fill) {
    target.fill = sources.fill.gpu;
  } else {
    delete (target as Partial<ThreeAsciiReadbackCopySources<TBuffer>>).fill;
  }
  if (sources.edge) {
    target.edge = sources.edge.gpu;
  } else {
    delete target.edge;
  }
  target.color = sources.color.gpu;
  return target;
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
