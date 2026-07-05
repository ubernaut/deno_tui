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
type ThreeAsciiComputePipelineLike = Pick<GPUComputePipeline, "getBindGroupLayout">;
type ThreeAsciiComputeTextureLike = Pick<GPUTexture, "createView">;

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

export function createThreeAsciiComputeBindGroups(
  input: ThreeAsciiComputeBindGroupInput,
): ThreeAsciiComputeBindGroups {
  const downscaleView = input.downscaleTexture.createView();
  const fillBindGroup = input.includeFill ?? true ? createThreeAsciiFillBindGroup(input, downscaleView) : undefined;

  const edgeBindGroup = input.includeEdges ? createThreeAsciiEdgeBindGroup(input) : undefined;
  const colorBindGroup = createThreeAsciiColorBindGroup(input, downscaleView);

  return { fillBindGroup, edgeBindGroup, colorBindGroup };
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
