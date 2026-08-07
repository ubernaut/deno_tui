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
let current: GPUDevice | undefined;

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
      current = device;
      // A lost device must not stay cached, or every later caller is handed a
      // corpse and there is no way back short of restarting the client.
      device.lost.then(() => {
        pending = undefined;
        current = undefined;
      }).catch(() => {
        pending = undefined;
        current = undefined;
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

/**
 * Destroys the shared device outright, freeing everything it owns.
 *
 * Called on client shutdown. Process exit is supposed to make this redundant,
 * but a teardown that hangs before `Deno.exit` leaves the client alive and
 * animating with the device held — the machine's one WebGPU seat, invisible
 * to anyone grepping for a process that looks stuck. `GPUDevice.destroy()` is
 * immediate and unconditional, so calling it here makes quit release the GPU
 * even when the rest of shutdown goes wrong.
 */
export function destroyExomuxGpuDevice(): void {
  const device = current;
  pending = undefined;
  current = undefined;
  try {
    device?.destroy();
  } catch {
    // A device that is already lost has nothing left to destroy.
  }
}
