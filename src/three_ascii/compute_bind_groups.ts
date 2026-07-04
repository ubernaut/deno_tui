type ThreeAsciiComputeDeviceLike = Pick<GPUDevice, "createBindGroup">;
type ThreeAsciiComputePipelineLike = Pick<GPUComputePipeline, "getBindGroupLayout">;
type ThreeAsciiComputeTextureLike = Pick<GPUTexture, "createView">;

export interface ThreeAsciiComputeBindGroupInput {
  device: ThreeAsciiComputeDeviceLike;
  paramsBuffer: GPUBuffer;
  fillPipeline: ThreeAsciiComputePipelineLike;
  edgePipeline?: ThreeAsciiComputePipelineLike;
  colorPipeline: ThreeAsciiComputePipelineLike;
  fillOutput: GPUBuffer;
  edgeOutput?: GPUBuffer;
  colorOutput: GPUBuffer;
  downscaleTexture: ThreeAsciiComputeTextureLike;
  sobelTexture?: ThreeAsciiComputeTextureLike;
  normalsTexture?: ThreeAsciiComputeTextureLike;
  includeEdges: boolean;
  colorUsesDepthTexture: boolean;
}

export interface ThreeAsciiComputeBindGroups {
  fillBindGroup: GPUBindGroup;
  edgeBindGroup?: GPUBindGroup;
  colorBindGroup: GPUBindGroup;
}

export function createThreeAsciiComputeBindGroups(
  input: ThreeAsciiComputeBindGroupInput,
): ThreeAsciiComputeBindGroups {
  const downscaleView = input.downscaleTexture.createView();
  const fillBindGroup = input.device.createBindGroup({
    label: "deno_tui.three_ascii.fill.bindings",
    layout: input.fillPipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: { buffer: input.paramsBuffer } },
      { binding: 1, resource: downscaleView },
      { binding: 2, resource: { buffer: input.fillOutput } },
    ],
  });

  const edgeBindGroup = input.includeEdges ? createThreeAsciiEdgeBindGroup(input) : undefined;
  const colorBindGroup = createThreeAsciiColorBindGroup(input, downscaleView);

  return { fillBindGroup, edgeBindGroup, colorBindGroup };
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
