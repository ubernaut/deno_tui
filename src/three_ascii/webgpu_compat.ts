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

async function patchQueueWriteBuffer(device: GPUDevice): Promise<GPUDevice> {
  const queue = device.queue as GPUQueue & {
    [WRITE_BUFFER_PATCHED]?: boolean;
    writeBuffer: GPUQueue["writeBuffer"];
  };

  if (queue[WRITE_BUFFER_PATCHED]) {
    return device;
  }

  if (await queueWriteBufferUsesByteOffsets(device)) {
    const originalWriteBuffer = queue.writeBuffer.bind(queue);

    queue.writeBuffer = ((buffer, bufferOffset, data, dataOffset, size) => {
      if (!ArrayBuffer.isView(data)) {
        return originalWriteBuffer(buffer, bufferOffset, data, dataOffset as never, size as never);
      }

      const bytesPerElement = (data as ArrayBufferView & { BYTES_PER_ELEMENT?: number }).BYTES_PER_ELEMENT;
      if (!bytesPerElement) {
        return originalWriteBuffer(buffer, bufferOffset, data, dataOffset as never, size as never);
      }

      const byteOffset = (dataOffset ?? 0) * bytesPerElement;
      const byteSize = size === undefined ? undefined : size * bytesPerElement;
      return originalWriteBuffer(buffer, bufferOffset, data, byteOffset, byteSize as never);
    }) as GPUQueue["writeBuffer"];
  }

  queue[WRITE_BUFFER_PATCHED] = true;
  return device;
}

async function queueWriteBufferUsesByteOffsets(device: GPUDevice): Promise<boolean> {
  const byteLength = 4 * Uint32Array.BYTES_PER_ELEMENT;
  const target = device.createBuffer({
    label: "deno_tui.three_ascii.write_buffer_probe.target",
    size: byteLength,
    usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
  });
  const readback = device.createBuffer({
    label: "deno_tui.three_ascii.write_buffer_probe.readback",
    size: byteLength,
    usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
  });

  try {
    device.queue.writeBuffer(target, 0, new Uint32Array(4));
    device.queue.writeBuffer(target, 0, new Uint32Array([1, 2, 3, 4, 5, 6, 7, 8]), 4, 4);

    const encoder = device.createCommandEncoder({
      label: "deno_tui.three_ascii.write_buffer_probe.commands",
    });
    encoder.copyBufferToBuffer(target, 0, readback, 0, byteLength);
    device.queue.submit([encoder.finish()]);

    await readback.mapAsync(GPUMapMode.READ);
    const values = new Uint32Array(readback.getMappedRange());
    const usesElementOffsets = values[0] === 5 && values[1] === 6 && values[2] === 7 && values[3] === 8;
    const usesByteOffsets = values[0] === 2 && values[1] === 0 && values[2] === 0 && values[3] === 0;

    if (!usesElementOffsets && !usesByteOffsets) {
      throw new Error(`Unsupported GPUQueue.writeBuffer offset semantics: ${[...values].join(",")}`);
    }

    return usesByteOffsets;
  } finally {
    if (readback.mapState === "mapped") {
      readback.unmap();
    }
    target.destroy();
    readback.destroy();
  }
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

/** Public helper for get Compatible Web GPUDevice. */
export async function getCompatibleWebGPUDevice(): Promise<GPUDevice> {
  ensureAnimationFrame();

  compatibleDevicePromise ??= (async () => {
    if (typeof navigator === "undefined" || navigator.gpu === undefined) {
      throw new Error("WebGPU is not available in this Deno runtime.");
    }

    const adapterOptions = {
      featureLevel: "compatibility",
    } as GPURequestAdapterOptions & { featureLevel: "compatibility" };
    const adapter = await navigator.gpu.requestAdapter(adapterOptions);

    if (!adapter) {
      throw new Error("Unable to acquire a WebGPU adapter.");
    }

    const device = await adapter.requestDevice({
      // Requesting every exposed adapter feature can fail on lower-memory
      // runtimes even though the ASCII pipeline only uses baseline WebGPU.
      requiredFeatures: [],
      requiredLimits: {},
    });

    const compatibleDevice = ensureDeviceLostPromise(device);
    await patchQueueWriteBuffer(compatibleDevice);
    return patchErrorScopes(patchShaderModules(compatibleDevice));
  })();

  return await compatibleDevicePromise;
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
