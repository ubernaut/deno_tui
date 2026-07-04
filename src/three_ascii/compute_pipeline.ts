type ThreeAsciiComputePipelineDeviceLike = Pick<GPUDevice, "createShaderModule" | "createComputePipeline">;

export interface ThreeAsciiComputePipelineOptions {
  device: ThreeAsciiComputePipelineDeviceLike;
  label: string;
  code: string;
  entryPoint?: string;
}

export function createThreeAsciiComputePipeline(options: ThreeAsciiComputePipelineOptions): GPUComputePipeline {
  const module = options.device.createShaderModule({
    label: `${options.label}.wgsl`,
    code: options.code,
  });

  return options.device.createComputePipeline({
    label: options.label,
    layout: "auto",
    compute: {
      module,
      entryPoint: options.entryPoint ?? "main",
    },
  });
}
