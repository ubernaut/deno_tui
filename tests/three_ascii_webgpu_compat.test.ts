import { assertEquals, assertRejects } from "./deps.ts";
import { getCompatibleWebGPUDevice, resetCompatibleWebGPUDeviceCache } from "../src/three_ascii/webgpu_compat.ts";

Deno.test("getCompatibleWebGPUDevice clears cached failures so later probes can retry", async () => {
  const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, "navigator");
  const firstError = new Error("transient gpu allocation failure");
  const device = fakeDevice();
  const adapter = {
    calls: 0,
    requestDevice() {
      this.calls += 1;
      if (this.calls === 1) throw firstError;
      return Promise.resolve(device as GPUDevice);
    },
  };
  installNavigatorGpu({
    requestAdapter: () => Promise.resolve(adapter),
  });
  resetCompatibleWebGPUDeviceCache();

  try {
    await assertRejects(() => getCompatibleWebGPUDevice(), Error, "transient gpu allocation failure");
    assertEquals(await getCompatibleWebGPUDevice(), device);
    assertEquals(adapter.calls, 2);
  } finally {
    resetCompatibleWebGPUDeviceCache();
    restoreNavigator(originalNavigator);
  }
});

Deno.test("getCompatibleWebGPUDevice refreshes after a native device lost signal", async () => {
  const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, "navigator");
  const firstLost = deferred<GPUDeviceLostInfo>();
  const first = fakeDevice({ lost: firstLost.promise });
  const second = fakeDevice({ lost: new Promise<GPUDeviceLostInfo>(() => {}) });
  const devices = [first, second];
  const adapter = {
    calls: 0,
    requestDevice() {
      return Promise.resolve(devices[this.calls++] as GPUDevice);
    },
  };
  installNavigatorGpu({
    requestAdapter: () => Promise.resolve(adapter),
  });
  resetCompatibleWebGPUDeviceCache();

  try {
    assertEquals(await getCompatibleWebGPUDevice(), first);
    assertEquals(await getCompatibleWebGPUDevice(), first);
    firstLost.resolve({ reason: "destroyed", message: "lost for test" } as GPUDeviceLostInfo);
    await Promise.resolve();
    assertEquals(await getCompatibleWebGPUDevice(), second);
    assertEquals(adapter.calls, 2);
  } finally {
    resetCompatibleWebGPUDeviceCache();
    restoreNavigator(originalNavigator);
  }
});

function installNavigatorGpu(gpu: { requestAdapter: () => Promise<unknown> }): void {
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: { gpu },
  });
}

function restoreNavigator(descriptor: PropertyDescriptor | undefined): void {
  if (descriptor) {
    Object.defineProperty(globalThis, "navigator", descriptor);
    return;
  }
  Reflect.deleteProperty(globalThis, "navigator");
}

function fakeDevice(options: { lost?: Promise<GPUDeviceLostInfo> } = {}): Partial<GPUDevice> {
  return {
    lost: options.lost,
    queue: {
      writeBuffer() {},
    } as unknown as GPUQueue,
    popErrorScope: () => Promise.resolve(null),
    createShaderModule: (descriptor) => descriptor as unknown as GPUShaderModule,
    createBuffer: (descriptor) =>
      ({
        descriptor,
        getMappedRange: () => new ArrayBuffer(Number(descriptor.size) || 0),
        unmap() {},
        destroy() {},
      }) as unknown as GPUBuffer,
  };
}

function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void; reject: (error: unknown) => void } {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}
