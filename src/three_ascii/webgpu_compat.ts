let compatibleDevicePromise: Promise<GPUDevice> | undefined;
let compatibleDevice: GPUDevice | undefined;
type RafCallback = (time: number) => void;
const WRITE_BUFFER_PATCHED = Symbol.for("deno_tui.three_ascii.write_buffer_patched");
const SHADER_MODULE_PATCHED = Symbol.for("deno_tui.three_ascii.shader_module_patched");
const CREATE_BUFFER_PATCHED = Symbol.for("deno_tui.three_ascii.create_buffer_patched");

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

function hasNativeDeviceLostPromise(device: GPUDevice): boolean {
  return (device as GPUDevice & { lost?: Promise<GPUDeviceLostInfo> }).lost !== undefined;
}

function watchCompatibleDeviceLoss(device: GPUDevice): void {
  const lost = (device as GPUDevice & { lost?: Promise<GPUDeviceLostInfo> }).lost;
  if (!lost) return;
  lost.then(
    () => {
      if (compatibleDevice !== device) return;
      compatibleDevice = undefined;
      compatibleDevicePromise = undefined;
    },
    () => {
      if (compatibleDevice !== device) return;
      compatibleDevice = undefined;
      compatibleDevicePromise = undefined;
    },
  );
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

function patchMappedAtCreationBuffers(device: GPUDevice): GPUDevice {
  const patchedDevice = device as GPUDevice & {
    [CREATE_BUFFER_PATCHED]?: boolean;
    createBuffer: GPUDevice["createBuffer"];
  };

  if (patchedDevice[CREATE_BUFFER_PATCHED]) {
    return device;
  }

  const originalCreateBuffer = patchedDevice.createBuffer.bind(device);

  patchedDevice.createBuffer = ((descriptor) => {
    if (!descriptor.mappedAtCreation) {
      return originalCreateBuffer(descriptor);
    }

    const byteLength = Math.max(0, Math.ceil(Number(descriptor.size) || 0));
    const canAddCopyDst = (descriptor.usage & GPUBufferUsage.MAP_WRITE) === 0;
    const usage = canAddCopyDst ? descriptor.usage | GPUBufferUsage.COPY_DST : descriptor.usage;
    const buffer = originalCreateBuffer({ ...descriptor, mappedAtCreation: false, usage });
    let shadow: ArrayBuffer | undefined = new ArrayBuffer(byteLength);
    let uploaded = false;

    buffer.getMappedRange = ((offset = 0, size?: number) => {
      if (!shadow) {
        throw new Error("GPUBuffer mapping is no longer available.");
      }
      if (offset === 0 && (size === undefined || size === shadow.byteLength)) {
        return shadow;
      }
      return shadow.slice(offset, size === undefined ? undefined : offset + size);
    }) as GPUBuffer["getMappedRange"];

    buffer.unmap = (() => {
      if (!shadow || uploaded) {
        return;
      }
      device.queue.writeBuffer(buffer, 0, shadow);
      shadow = undefined;
      uploaded = true;
    }) as GPUBuffer["unmap"];

    return buffer;
  }) as GPUDevice["createBuffer"];

  patchedDevice[CREATE_BUFFER_PATCHED] = true;
  return device;
}

/** Public helper for get Compatible Web GPUDevice. */
export async function getCompatibleWebGPUDevice(): Promise<GPUDevice> {
  ensureAnimationFrame();

  if (compatibleDevice) return compatibleDevice;
  const promise = compatibleDevicePromise ??= (async () => {
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
    const nativeLost = hasNativeDeviceLostPromise(device);

    const patched = patchMappedAtCreationBuffers(
      patchErrorScopes(patchShaderModules(patchQueueWriteBuffer(ensureDeviceLostPromise(device)))),
    );
    compatibleDevice = patched;
    if (nativeLost) watchCompatibleDeviceLoss(patched);
    return patched;
  })();

  try {
    return await promise;
  } catch (error) {
    if (compatibleDevicePromise === promise) {
      compatibleDevicePromise = undefined;
      compatibleDevice = undefined;
    }
    throw error;
  }
}

/** Public helper for probe Compatible Web GPUDevice. */
export async function probeCompatibleWebGPUDevice(): Promise<boolean> {
  try {
    await getCompatibleWebGPUDevice();
    return true;
  } catch {
    return false;
  }
}

/** Clears the shared WebGPU device cache for tests and explicit recovery probes. */
export function resetCompatibleWebGPUDeviceCache(): void {
  compatibleDevicePromise = undefined;
  compatibleDevice = undefined;
}
