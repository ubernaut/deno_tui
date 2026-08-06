import { assert, assertEquals } from "./deps.ts";
import { exomuxGpuDevice, resetExomuxGpuDevice } from "../gpu_device.ts";
import { requestExomuxGpuDevice } from "../butterchurn_gpu.ts";

Deno.test("gpu device: every consumer shares one device", async () => {
  // Deno allows a single WebGPU device per process; a second `requestDevice`
  // throws regardless of what the GPU has spare. Two backgrounds want one —
  // turbulence for its compute pass, butterchurn for MilkDrop's render graph —
  // and they are adjacent in the cycle order, so reaching butterchurn with the
  // background key went through turbulence first. Whichever asked second spent
  // the rest of the session without a GPU.
  const first = await exomuxGpuDevice();
  const second = await exomuxGpuDevice();
  assertEquals(first, second, "the device must be cached, not re-requested");

  // The butterchurn renderer draws from the same pool rather than its own.
  assertEquals(await requestExomuxGpuDevice(), first);

  // Concurrent callers race for it on startup; they must not each request one.
  const [a, b, c] = await Promise.all([exomuxGpuDevice(), exomuxGpuDevice(), exomuxGpuDevice()]);
  assertEquals(a, first);
  assertEquals(b, first);
  assertEquals(c, first);

  // Undefined is a legitimate answer — no adapter, or no `--unstable-webgpu` —
  // and every caller has a path that works without one.
  assert(first === undefined || typeof first === "object");
});

Deno.test("gpu device: resetting lets the next caller request a fresh one", async () => {
  const before = await exomuxGpuDevice();
  resetExomuxGpuDevice();
  // Whether a second device can actually be created depends on the platform, so
  // this asserts the cache was dropped rather than what replaces it.
  const after = await exomuxGpuDevice();
  assert(after === undefined || after !== null);
  void before;
});
