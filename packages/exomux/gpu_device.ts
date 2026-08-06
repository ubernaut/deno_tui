// Copyright 2023 Im-Beast. MIT license.

// The desktop's single WebGPU device.
//
// Deno allows one device per process: a second `requestDevice` throws
// "Not enough memory left", whatever the GPU actually has spare. Two
// backgrounds want one — turbulence for its lattice-Boltzmann compute pass and
// butterchurn for MilkDrop's render graph — and they sit next to each other in
// the cycle order, so reaching butterchurn with the background key always went
// through turbulence first. Turbulence took the device, never gave it back, and
// butterchurn silently spent the rest of the session on its software renderer.
//
// One shared device fixes that, and is how WebGPU is meant to be used anyway.
// Neither consumer may destroy it; they own their own resources and nothing
// more.

let pending: Promise<GPUDevice | undefined> | undefined;

/**
 * The shared device, requested once and reused.
 *
 * Resolves to undefined when there is no adapter, when `--unstable-webgpu` is
 * absent, or when the request fails — every caller is expected to have a path
 * that works without a GPU.
 */
export function exomuxGpuDevice(): Promise<GPUDevice | undefined> {
  pending ??= (async () => {
    try {
      const adapter = await navigator.gpu?.requestAdapter();
      if (!adapter) return undefined;
      const device = await adapter.requestDevice();
      // A lost device must not stay cached, or every later caller is handed a
      // corpse and there is no way back short of restarting the client.
      device.lost.then(() => {
        pending = undefined;
      }).catch(() => {
        pending = undefined;
      });
      return device;
    } catch {
      return undefined;
    }
  })();
  return pending;
}

/** Forgets the cached device, so the next caller requests a fresh one. */
export function resetExomuxGpuDevice(): void {
  pending = undefined;
}
