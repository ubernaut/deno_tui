import { assert, assertEquals } from "./deps.ts";
import { ExomuxButterchurnGpu } from "../butterchurn_gpu.ts";
import { EXOMUX_BUTTERCHURN_CATALOG } from "../butterchurn_catalog.ts";
import { ExomuxButterchurnPreset } from "../butterchurn_preset.ts";

/** Counts every GPU object the renderer asks for, so per-frame churn shows up. */
interface Counts {
  bindGroup: number;
  view: number;
  texture: number;
  buffer: number;
  pipeline: number;
  /** Textures and buffers explicitly released, so leaks can be told from churn. */
  destroyed: number;
}

/**
 * The smallest stand-in for a GPUDevice the render graph can be driven through.
 *
 * A real device is not available in CI, and the property under test — how many
 * GPU objects a frame creates — is observable without one.
 */
function stubDevice(counts: Counts) {
  const pass = {
    setPipeline: () => {},
    setBindGroup: () => {},
    setVertexBuffer: () => {},
    draw: () => {},
    end: () => {},
  };
  const encoder = {
    beginRenderPass: () => pass,
    copyTextureToBuffer: () => {},
    finish: () => ({}),
  };
  const makeTexture = (width: number, height: number) => {
    counts.texture += 1;
    return {
      width,
      height,
      destroy: () => {
        counts.destroyed += 1;
      },
      createView: () => {
        counts.view += 1;
        return {};
      },
    };
  };
  return {
    limits: {},
    lost: new Promise(() => {}),
    queue: { writeBuffer: () => {}, writeTexture: () => {}, submit: () => {} },
    createTexture: (descriptor: { size: number[] }) => makeTexture(descriptor.size[0] ?? 1, descriptor.size[1] ?? 1),
    createBuffer: () => {
      counts.buffer += 1;
      return {
        size: 1 << 20,
        destroy: () => {
          counts.destroyed += 1;
        },
        mapAsync: () => new Promise(() => {}),
        getMappedRange: () => new ArrayBuffer(0),
        unmap: () => {},
      };
    },
    createSampler: () => ({}),
    createShaderModule: () => ({}),
    createBindGroupLayout: () => ({}),
    createPipelineLayout: () => ({}),
    createRenderPipeline: () => {
      counts.pipeline += 1;
      return { getBindGroupLayout: () => ({}) };
    },
    createBindGroup: () => {
      counts.bindGroup += 1;
      return {};
    },
    createCommandEncoder: () => encoder,
  } as unknown as GPUDevice;
}

Deno.test("butterchurn gpu: a steady frame creates no new GPU objects", () => {
  // The render path once created roughly ten bind groups and twenty-five
  // texture views per frame. At 8 Hz that exhausted the driver's object budget
  // within minutes, after which every allocation failed, readback stopped, and
  // the background froze on its last frame — taking the GPU down for other
  // processes with it. Views and bind groups are cached now, and this is the
  // guard that keeps them that way.
  const counts: Counts = { bindGroup: 0, view: 0, texture: 0, buffer: 0, pipeline: 0, destroyed: 0 };
  const gpu = new ExomuxButterchurnGpu(stubDevice(counts), { width: 80, height: 24, random: () => 0.5 });
  const entry = EXOMUX_BUTTERCHURN_CATALOG[0]!;
  assert(gpu.prepare(entry.name, entry.warp, entry.comp), "the first preset should compile");

  const preset = new ExomuxButterchurnPreset(entry, { random: () => 0.5 });
  preset.setSize(80, 24);
  const waveform = new Float32Array(256);
  const q = new Float32Array(32);
  const frame = (index: number) => {
    preset.advance(
      { bass: 1, mid: 1, treb: 1, bassAttack: 1, midAttack: 1, trebleAttack: 1, waveform },
      index * 0.125,
      index,
      8,
    );
    gpu.render(entry.name, {
      mesh: preset.mesh,
      meshWidth: preset.meshWidth,
      meshHeight: preset.meshHeight,
      wave: preset.wave,
      waveCount: preset.waveCount,
      waveColor: [1, 1, 1, 1],
      q,
      time: index * 0.125,
      frame: index,
      fps: 8,
      decay: 0.95,
      bass: 1,
      mid: 1,
      treb: 1,
      bassAttack: 1,
      midAttack: 1,
      trebleAttack: 1,
      aspectX: 1,
      aspectY: 1,
    });
  };

  // Warm up: the first frames legitimately create the caches, and the main
  // targets ping-pong so each needs its own set.
  for (let index = 0; index < 8; index += 1) frame(index);
  const warm = { ...counts };

  for (let index = 8; index < 48; index += 1) frame(index);
  assertEquals(counts.bindGroup, warm.bindGroup, "bind groups must be cached, not rebuilt per frame");
  assertEquals(counts.view, warm.view, "texture views must be cached, not rebuilt per frame");
  assertEquals(counts.texture, warm.texture, "a steady frame must not allocate textures");
  assertEquals(counts.buffer, warm.buffer, "a steady frame must not allocate buffers");
  gpu.destroy();
});

Deno.test("butterchurn gpu: resizing replaces its targets rather than accumulating them", () => {
  const counts: Counts = { bindGroup: 0, view: 0, texture: 0, buffer: 0, pipeline: 0, destroyed: 0 };
  const gpu = new ExomuxButterchurnGpu(stubDevice(counts), { width: 80, height: 24, random: () => 0.5 });
  const afterConstruction = counts.texture + counts.buffer - counts.destroyed;

  // Resizing necessarily rebuilds render targets and invalidates the caches
  // pointing at them. What matters is that each round releases what it
  // replaced, so a terminal being dragged about cannot exhaust the device.
  for (let step = 0; step < 20; step += 1) gpu.setSize(80 + (step % 7), 24 + (step % 5));
  const live = counts.texture + counts.buffer - counts.destroyed;
  assert(
    live <= afterConstruction + 4,
    `resizing left ${live} live GPU objects, up from ${afterConstruction} after construction`,
  );
  gpu.destroy();
});
