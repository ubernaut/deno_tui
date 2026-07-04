type ThreeAsciiComputePipelineDeviceLike = Pick<GPUDevice, "createShaderModule" | "createComputePipeline">;
const pipelineCache = new WeakMap<object, Map<string, GPUComputePipeline>>();

export interface ThreeAsciiComputePipelineOptions {
  device: ThreeAsciiComputePipelineDeviceLike;
  label: string;
  code: string;
  entryPoint?: string;
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
