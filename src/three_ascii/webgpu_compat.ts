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
  (device.queue as GPUQueue & { [WRITE_BUFFER_PATCHED]?: boolean })[WRITE_BUFFER_PATCHED] = true;
  return device;
}

function patchErrorScopes(device: GPUDevice): GPUDevice {
  const originalPopErrorScope = device.popErrorScope.bind(device);

  device.popErrorScope = (): Promise<GPUError | null> => {
    const result = originalPopErrorScope();
    return result ?? Promise.resolve(null);
  };

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

    const device = await adapter.requestDevice({
      // Requesting every exposed adapter feature can fail on lower-memory
      // runtimes even though the ASCII pipeline only uses baseline WebGPU.
      requiredFeatures: [],
      requiredLimits: {},
    });

    return patchErrorScopes(patchShaderModules(patchQueueWriteBuffer(ensureDeviceLostPromise(device))));
  })();

  return await compatibleDevicePromise;
}

export async function probeCompatibleWebGPUDevice(): Promise<boolean> {
  try {
    await getCompatibleWebGPUDevice();
    return true;
  } catch {
    return false;
  }
}
