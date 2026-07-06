/** Minimal GPU buffer shape needed by reusable three Ascii buffer helpers. */
export interface ThreeAsciiGpuBuffer {
  destroy(): void;
}

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

/** Minimal GPU device shape needed by reusable three Ascii buffer helpers. */
export interface ThreeAsciiGpuBufferDevice<TBuffer extends ThreeAsciiGpuBuffer = ThreeAsciiGpuBuffer> {
  createBuffer(options: { label: string; size: number; usage: number }): TBuffer;
}

/** Cached GPU buffer slot with its allocated byte size. */
export interface ThreeAsciiGpuBufferSlot<TBuffer extends ThreeAsciiGpuBuffer = ThreeAsciiGpuBuffer> {
  gpu: TBuffer;
  byteLength: number;
}

/** Options for allocating or reusing a three Ascii GPU buffer slot. */
export interface ThreeAsciiGpuBufferSlotOptions {
  label: string;
  byteLength: number;
  usage: number;
}

export interface ThreeAsciiComputeResourcePlanInput {
  columns: number;
  rows: number;
  includeFill?: boolean;
  includeEdges: boolean;
  includeDepthColor: boolean;
  currentCellCount: number;
  hasFillOutput?: boolean;
  hasFillBindGroup?: boolean;
  hasEdgeOutput: boolean;
  hasEdgeBindGroup: boolean;
  hasDepthColorBindGroup: boolean;
}

export interface ThreeAsciiComputeResourcePlan {
  cellCount: number;
  fillByteLength: number;
  colorByteLength: number;
  edgeByteLength: number;
  resizeOutputs: boolean;
  ensureFillOutput: boolean;
  releaseFillOutput: boolean;
  ensureEdgeOutput: boolean;
  releaseEdgeOutput: boolean;
  dirty: boolean;
}

export interface ThreeAsciiComputeResourceStateInput {
  currentCellCount: number;
  computeDirty: boolean;
}

export interface ThreeAsciiComputeResourceStateResult {
  outputCellCount: number;
  computeDirty: boolean;
  clearFillBindGroup: boolean;
  clearEdgeBindGroup: boolean;
}

type ThreeAsciiComputeDeviceLike = Pick<GPUDevice, "createBindGroup">;
type ThreeAsciiComputePipelineDeviceLike = Pick<GPUDevice, "createShaderModule" | "createComputePipeline">;
type ThreeAsciiComputePipelineLike = Pick<GPUComputePipeline, "getBindGroupLayout">;
type ThreeAsciiComputeTextureLike = Pick<GPUTexture, "createView">;

const pipelineCache = new WeakMap<object, Map<string, GPUComputePipeline>>();

export const THREE_ASCII_UNIFORM_FLOAT_COUNT = 24;

export interface ThreeAsciiComputePipelineOptions {
  device: ThreeAsciiComputePipelineDeviceLike;
  label: string;
  code: string;
  entryPoint?: string;
}

export interface ThreeAsciiComputeBindGroupInput {
  device: ThreeAsciiComputeDeviceLike;
  paramsBuffer: GPUBuffer;
  fillPipeline?: ThreeAsciiComputePipelineLike;
  edgePipeline?: ThreeAsciiComputePipelineLike;
  colorPipeline: ThreeAsciiComputePipelineLike;
  fillOutput?: GPUBuffer;
  edgeOutput?: GPUBuffer;
  colorOutput: GPUBuffer;
  downscaleTexture: ThreeAsciiComputeTextureLike;
  sobelTexture?: ThreeAsciiComputeTextureLike;
  normalsTexture?: ThreeAsciiComputeTextureLike;
  includeFill?: boolean;
  includeEdges: boolean;
  colorUsesDepthTexture: boolean;
}

export interface ThreeAsciiComputeBindGroups {
  fillBindGroup?: GPUBindGroup;
  edgeBindGroup?: GPUBindGroup;
  colorBindGroup: GPUBindGroup;
}

export interface ThreeAsciiComputePassPlan {
  readonly kind: "fill" | "edge" | "color";
  readonly label: string;
}

export interface ThreeAsciiComputeDispatchPlan {
  readonly workgroupsX: number;
  readonly workgroupsY: number;
  readonly passes: readonly ThreeAsciiComputePassPlan[];
}

export interface ThreeAsciiComputeDispatchResources {
  pipelineForPass(kind: ThreeAsciiComputePassPlan["kind"]): GPUComputePipeline;
  bindGroupForPass(kind: ThreeAsciiComputePassPlan["kind"]): GPUBindGroup;
}

export interface ThreeAsciiComputeCommandEncoderLike {
  beginComputePass(descriptor: GPUComputePassDescriptor): GPUComputePassEncoder;
}

export interface ThreeAsciiComputeDispatchPlanInput {
  columns: number;
  rows: number;
  workgroupSize: number;
  includeFill?: boolean;
  includeEdges: boolean;
}

/** Reuses compute dispatch plan objects while render size and edge mode are unchanged. */
export class ThreeAsciiComputeDispatchPlanCache {
  private cached?: ThreeAsciiComputeDispatchPlan;
  private columns = -1;
  private rows = -1;
  private workgroupSize = -1;
  private includeFill = true;
  private includeEdges = false;

  resolve(options: ThreeAsciiComputeDispatchPlanInput): ThreeAsciiComputeDispatchPlan {
    const columns = Math.max(1, Math.floor(options.columns));
    const rows = Math.max(1, Math.floor(options.rows));
    const workgroupSize = Math.max(1, Math.floor(options.workgroupSize));
    const includeFill = options.includeFill ?? true;
    if (
      this.cached &&
      this.columns === columns &&
      this.rows === rows &&
      this.workgroupSize === workgroupSize &&
      this.includeFill === includeFill &&
      this.includeEdges === options.includeEdges
    ) {
      return this.cached;
    }

    this.columns = columns;
    this.rows = rows;
    this.workgroupSize = workgroupSize;
    this.includeFill = includeFill;
    this.includeEdges = options.includeEdges;
    this.cached = createThreeAsciiComputeDispatchPlan({
      columns,
      rows,
      workgroupSize,
      includeFill,
      includeEdges: options.includeEdges,
    });
    return this.cached;
  }

  clear(): void {
    this.cached = undefined;
    this.columns = -1;
    this.rows = -1;
    this.workgroupSize = -1;
    this.includeFill = true;
    this.includeEdges = false;
  }
}

const FILL_PASS: ThreeAsciiComputePassPlan = {
  kind: "fill",
  label: "deno_tui.three_ascii.fill",
};
const EDGE_PASS: ThreeAsciiComputePassPlan = {
  kind: "edge",
  label: "deno_tui.three_ascii.edge",
};
const COLOR_PASS: ThreeAsciiComputePassPlan = {
  kind: "color",
  label: "deno_tui.three_ascii.color",
};

const FILL_COLOR_PASSES = [FILL_PASS, COLOR_PASS] as const;
const FILL_EDGE_COLOR_PASSES = [FILL_PASS, EDGE_PASS, COLOR_PASS] as const;
const COLOR_PASSES = [COLOR_PASS] as const;
const EDGE_COLOR_PASSES = [EDGE_PASS, COLOR_PASS] as const;

export function createThreeAsciiComputeDispatchPlan(
  options: ThreeAsciiComputeDispatchPlanInput,
): ThreeAsciiComputeDispatchPlan {
  const columns = Math.max(1, Math.floor(options.columns));
  const rows = Math.max(1, Math.floor(options.rows));
  const workgroupSize = Math.max(1, Math.floor(options.workgroupSize));
  const includeFill = options.includeFill ?? true;
  return {
    workgroupsX: Math.ceil(columns / workgroupSize),
    workgroupsY: Math.ceil(rows / workgroupSize),
    passes: includeFill
      ? options.includeEdges ? FILL_EDGE_COLOR_PASSES : FILL_COLOR_PASSES
      : options.includeEdges
      ? EDGE_COLOR_PASSES
      : COLOR_PASSES,
  };
}

/** Encodes the fill/edge/color compute passes for one Three ASCII frame. */
export function encodeThreeAsciiComputeDispatchCommands(
  commandEncoder: ThreeAsciiComputeCommandEncoderLike,
  dispatchPlan: ThreeAsciiComputeDispatchPlan,
  resources: ThreeAsciiComputeDispatchResources,
): void {
  for (const pass of dispatchPlan.passes) {
    encodeThreeAsciiComputePass(commandEncoder, pass, dispatchPlan, resources);
  }
}

function encodeThreeAsciiComputePass(
  commandEncoder: ThreeAsciiComputeCommandEncoderLike,
  pass: ThreeAsciiComputePassPlan,
  dispatchPlan: Pick<ThreeAsciiComputeDispatchPlan, "workgroupsX" | "workgroupsY">,
  resources: ThreeAsciiComputeDispatchResources,
): void {
  const passEncoder = commandEncoder.beginComputePass({ label: pass.label });
  passEncoder.setPipeline(resources.pipelineForPass(pass.kind));
  passEncoder.setBindGroup(0, resources.bindGroupForPass(pass.kind));
  passEncoder.dispatchWorkgroups(dispatchPlan.workgroupsX, dispatchPlan.workgroupsY, 1);
  passEncoder.end();
}

export function createThreeAsciiComputeResourcePlan(
  input: ThreeAsciiComputeResourcePlanInput,
): ThreeAsciiComputeResourcePlan {
  const columns = Math.max(1, Math.floor(input.columns));
  const rows = Math.max(1, Math.floor(input.rows));
  const includeFill = input.includeFill ?? true;
  const cellCount = columns * rows;
  const resizeOutputs = cellCount !== Math.max(0, Math.floor(input.currentCellCount));
  const ensureFillOutput = includeFill;
  const releaseFillOutput = !includeFill && !!input.hasFillOutput;
  const ensureEdgeOutput = input.includeEdges;
  const releaseEdgeOutput = !input.includeEdges && input.hasEdgeOutput;
  const fillSetupDirty = includeFill && (!input.hasFillOutput || !input.hasFillBindGroup);
  const edgeSetupDirty = input.includeEdges && (!input.hasEdgeOutput || !input.hasEdgeBindGroup);
  const colorSetupDirty = input.includeDepthColor !== input.hasDepthColorBindGroup;
  return {
    cellCount,
    fillByteLength: includeFill ? cellCount * Float32Array.BYTES_PER_ELEMENT : 0,
    colorByteLength: cellCount * 4 * Float32Array.BYTES_PER_ELEMENT,
    edgeByteLength: cellCount * 4 * Float32Array.BYTES_PER_ELEMENT,
    resizeOutputs,
    ensureFillOutput,
    releaseFillOutput,
    ensureEdgeOutput,
    releaseEdgeOutput,
    dirty: resizeOutputs || fillSetupDirty || releaseFillOutput || edgeSetupDirty || releaseEdgeOutput ||
      colorSetupDirty,
  };
}

export function applyThreeAsciiComputeResourcePlanState(
  state: ThreeAsciiComputeResourceStateInput,
  plan: ThreeAsciiComputeResourcePlan,
): ThreeAsciiComputeResourceStateResult {
  return {
    outputCellCount: plan.resizeOutputs ? plan.cellCount : Math.max(0, Math.floor(state.currentCellCount)),
    computeDirty: state.computeDirty || plan.dirty,
    clearFillBindGroup: plan.releaseFillOutput,
    clearEdgeBindGroup: plan.releaseEdgeOutput,
  };
}

/** Reuses an existing same-sized GPU buffer slot, or destroys and replaces it when the size changes. */
export function ensureThreeAsciiGpuBufferSlot<TBuffer extends ThreeAsciiGpuBuffer>(
  device: ThreeAsciiGpuBufferDevice<TBuffer>,
  current: ThreeAsciiGpuBufferSlot<TBuffer> | undefined,
  options: ThreeAsciiGpuBufferSlotOptions,
): ThreeAsciiGpuBufferSlot<TBuffer> {
  if (current?.byteLength === options.byteLength) {
    return current;
  }

  destroyThreeAsciiGpuBufferSlot(current);

  return {
    gpu: device.createBuffer({
      label: options.label,
      size: options.byteLength,
      usage: options.usage,
    }),
    byteLength: options.byteLength,
  };
}

/** Destroys an optional three Ascii GPU buffer slot and returns undefined for assignment cleanup. */
export function destroyThreeAsciiGpuBufferSlot<TBuffer extends ThreeAsciiGpuBuffer>(
  current: ThreeAsciiGpuBufferSlot<TBuffer> | undefined,
): undefined {
  current?.gpu.destroy();
  return undefined;
}

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

export function createThreeAsciiComputePipeline(options: ThreeAsciiComputePipelineOptions): GPUComputePipeline {
  const cache = pipelineCacheForDevice(options.device);
  const key = computePipelineCacheKey(options);
  const cached = cache.get(key);
  if (cached) return cached;

  const module = options.device.createShaderModule({
    label: `${options.label}.wgsl`,
    code: options.code,
  });

  const pipeline = options.device.createComputePipeline({
    label: options.label,
    layout: "auto",
    compute: {
      module,
      entryPoint: options.entryPoint ?? "main",
    },
  });
  cache.set(key, pipeline);
  return pipeline;
}

export function createThreeAsciiComputeBindGroups(
  input: ThreeAsciiComputeBindGroupInput,
): ThreeAsciiComputeBindGroups {
  const downscaleView = input.downscaleTexture.createView();
  const fillBindGroup = input.includeFill ?? true ? createThreeAsciiFillBindGroup(input, downscaleView) : undefined;

  const edgeBindGroup = input.includeEdges ? createThreeAsciiEdgeBindGroup(input) : undefined;
  const colorBindGroup = createThreeAsciiColorBindGroup(input, downscaleView);

  return { fillBindGroup, edgeBindGroup, colorBindGroup };
}

function pipelineCacheForDevice(device: ThreeAsciiComputePipelineDeviceLike): Map<string, GPUComputePipeline> {
  const key = device as object;
  let cache = pipelineCache.get(key);
  if (!cache) {
    cache = new Map();
    pipelineCache.set(key, cache);
  }
  return cache;
}

function computePipelineCacheKey(options: Pick<ThreeAsciiComputePipelineOptions, "code" | "entryPoint">): string {
  return `${options.entryPoint ?? "main"}\n${options.code}`;
}

function createThreeAsciiFillBindGroup(
  input: ThreeAsciiComputeBindGroupInput,
  downscaleView: GPUTextureView,
): GPUBindGroup {
  if (!input.fillPipeline || !input.fillOutput) {
    throw new Error("ThreeAsciiRenderer fill compute resources have not been initialized.");
  }

  return input.device.createBindGroup({
    label: "deno_tui.three_ascii.fill.bindings",
    layout: input.fillPipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: { buffer: input.paramsBuffer } },
      { binding: 1, resource: downscaleView },
      { binding: 2, resource: { buffer: input.fillOutput } },
    ],
  });
}

function createThreeAsciiColorBindGroup(
  input: ThreeAsciiComputeBindGroupInput,
  downscaleView: GPUTextureView,
): GPUBindGroup {
  if (!input.colorUsesDepthTexture) {
    return input.device.createBindGroup({
      label: "deno_tui.three_ascii.color.bindings",
      layout: input.colorPipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: input.paramsBuffer } },
        { binding: 1, resource: downscaleView },
        { binding: 2, resource: { buffer: input.colorOutput } },
      ],
    });
  }

  if (!input.normalsTexture) {
    throw new Error("ThreeAsciiRenderer depth color resources have not been initialized.");
  }

  return input.device.createBindGroup({
    label: "deno_tui.three_ascii.color.bindings",
    layout: input.colorPipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: { buffer: input.paramsBuffer } },
      { binding: 1, resource: downscaleView },
      { binding: 2, resource: input.normalsTexture.createView() },
      { binding: 3, resource: { buffer: input.colorOutput } },
    ],
  });
}

function createThreeAsciiEdgeBindGroup(input: ThreeAsciiComputeBindGroupInput): GPUBindGroup {
  if (!input.edgePipeline || !input.edgeOutput || !input.sobelTexture) {
    throw new Error("ThreeAsciiRenderer edge compute resources have not been initialized.");
  }

  return input.device.createBindGroup({
    label: "deno_tui.three_ascii.edge.bindings",
    layout: input.edgePipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: { buffer: input.paramsBuffer } },
      { binding: 1, resource: input.sobelTexture.createView() },
      { binding: 2, resource: { buffer: input.edgeOutput } },
    ],
  });
}
