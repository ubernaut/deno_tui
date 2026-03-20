import { GPUFeatureName } from "npm:three@0.183.2/src/renderers/webgpu/utils/WebGPUConstants.js";

let compatibleDevicePromise: Promise<GPUDevice> | undefined;
type RafCallback = (time: number) => void;
const WRITE_BUFFER_PATCHED = Symbol.for("deno_tui.three_ascii.write_buffer_patched");
const SHADER_MODULE_PATCHED = Symbol.for("deno_tui.three_ascii.shader_module_patched");

function ensureAnimationFrame(): void {
  if (!("requestAnimationFrame" in globalThis)) {
    (globalThis as typeof globalThis & {
      requestAnimationFrame: (callback: RafCallback) => number;
    }).requestAnimationFrame = (callback) => (
      setTimeout(() => callback(performance.now()), 16) as unknown as number
    );
  }

  if (!("cancelAnimationFrame" in globalThis)) {
    (globalThis as typeof globalThis & {
      cancelAnimationFrame: (handle: number) => void;
    }).cancelAnimationFrame = (handle) => {
      clearTimeout(handle);
    };
  }
}

function ensureDeviceLostPromise(device: GPUDevice): GPUDevice {
  if ((device as GPUDevice & { lost?: Promise<GPUDeviceLostInfo> }).lost === undefined) {
    (device as GPUDevice & { lost?: Promise<GPUDeviceLostInfo> }).lost = Promise.resolve({
      reason: "destroyed",
      message: "GPUDevice.lost is unavailable in this Deno runtime.",
    } as GPUDeviceLostInfo);
  }

  return device;
}

function patchQueueWriteBuffer(device: GPUDevice): GPUDevice {
  const queue = device.queue as GPUQueue & {
    [WRITE_BUFFER_PATCHED]?: boolean;
    writeBuffer: GPUQueue["writeBuffer"];
  };

  if (queue[WRITE_BUFFER_PATCHED]) {
    return device;
  }

  const originalWriteBuffer = queue.writeBuffer.bind(queue);

  queue.writeBuffer = ((buffer, bufferOffset, data, dataOffset, size) => {
    if (size === undefined || !ArrayBuffer.isView(data)) {
      return originalWriteBuffer(buffer, bufferOffset, data, dataOffset as never, size as never);
    }

    const view = data as ArrayBufferView & { BYTES_PER_ELEMENT: number };
    const byteOffset = (dataOffset ?? 0) * view.BYTES_PER_ELEMENT;
    const byteSize = size * view.BYTES_PER_ELEMENT;

    return originalWriteBuffer(buffer, bufferOffset, data, byteOffset, byteSize);
  }) as GPUQueue["writeBuffer"];

  queue[WRITE_BUFFER_PATCHED] = true;
  return device;
}

function patchShaderModules(device: GPUDevice): GPUDevice {
  const patchedDevice = device as GPUDevice & {
    [SHADER_MODULE_PATCHED]?: boolean;
    createShaderModule: GPUDevice["createShaderModule"];
  };

  if (patchedDevice[SHADER_MODULE_PATCHED]) {
    return device;
  }

  const originalCreateShaderModule = patchedDevice.createShaderModule.bind(device);

  patchedDevice.createShaderModule = ((descriptor) => {
    let code = descriptor.code;

    if (code.includes("textureLoad(")) {
      code = code
        .split("\n")
        .map((line) => (line.includes("textureLoad(") ? line.replace(/,\s*u32\(/g, ", i32(") : line))
        .join("\n");
    }

    return originalCreateShaderModule({ ...descriptor, code });
  }) as GPUDevice["createShaderModule"];

  patchedDevice[SHADER_MODULE_PATCHED] = true;
  return device;
}

export async function getCompatibleWebGPUDevice(): Promise<GPUDevice> {
  ensureAnimationFrame();

  compatibleDevicePromise ??= (async () => {
    if (typeof navigator === "undefined" || navigator.gpu === undefined) {
      throw new Error("WebGPU is not available in this Deno runtime.");
    }

    const adapter = await navigator.gpu.requestAdapter({
      featureLevel: "compatibility",
    } as any);

    if (!adapter) {
      throw new Error("Unable to acquire a WebGPU adapter.");
    }

    const requiredFeatures = Object.values(GPUFeatureName).filter((feature) => (
      adapter.features.has(feature as GPUFeatureName)
    )) as GPUFeatureName[];
    const device = await adapter.requestDevice({
      requiredFeatures,
      requiredLimits: {},
    });

    return patchShaderModules(patchQueueWriteBuffer(ensureDeviceLostPromise(device)));
  })();

  return await compatibleDevicePromise;
}
