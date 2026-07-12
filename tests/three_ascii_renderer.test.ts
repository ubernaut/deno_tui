import { assert, assertEquals } from "./deps.ts";

import { createNeonThreeScene } from "../app/neon_three.ts";
import { ThreeAsciiRenderer } from "../src/three_ascii/renderer.ts";
import { getCompatibleWebGPUDevice, probeCompatibleWebGPUDevice } from "../src/three_ascii/webgpu_compat.ts";

const ESCAPE = "\x1b";
const ANSI_PATTERN = new RegExp(`${ESCAPE}\\[[0-?]*[ -/]*[@-~]`, "g");
const FOREGROUND_PATTERN = new RegExp(`${ESCAPE}\\[38;2;(\\d+);(\\d+);(\\d+)m`);
const canReadRendererAssets = (await Deno.permissions.query({ name: "read" })).state === "granted";

Deno.test("compatible WebGPU queue writes typed-array slices in element units", async () => {
  if (!await probeCompatibleWebGPUDevice()) return;

  const device = await getCompatibleWebGPUDevice();
  const byteLength = 4 * Uint32Array.BYTES_PER_ELEMENT;
  const target = device.createBuffer({
    size: byteLength,
    usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
  });
  const readback = device.createBuffer({
    size: byteLength,
    usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
  });

  try {
    device.queue.writeBuffer(target, 0, new Uint32Array([1, 2, 3, 4, 5, 6, 7, 8]), 4, 4);
    const encoder = device.createCommandEncoder();
    encoder.copyBufferToBuffer(target, 0, readback, 0, byteLength);
    device.queue.submit([encoder.finish()]);
    await readback.mapAsync(GPUMapMode.READ);
    assertEquals([...new Uint32Array(readback.getMappedRange())], [5, 6, 7, 8]);
  } finally {
    if (readback.mapState === "mapped") readback.unmap();
    target.destroy();
    readback.destroy();
  }
});

Deno.test({
  name: "Three ASCII WebGPU renderer produces nonuniform scene cells",
  ignore: !canReadRendererAssets,
  fn: async () => {
    if (!await probeCompatibleWebGPUDevice()) return;

    const bundle = createNeonThreeScene("lattice");
    const renderer = new ThreeAsciiRenderer({
      scene: bundle.scene,
      camera: bundle.camera,
      columns: 16,
      rows: 10,
      terminalGlyphStyle: "glyphs",
      effect: {
        edges: false,
        fill: true,
        exposure: 1,
        attenuation: 1,
        blendWithBase: 1,
        asciiColor: 0xffffff,
        backgroundColor: 0x000000,
        depthFalloff: 0,
      },
    });

    try {
      const cells = (await renderer.renderToAnsiGrid()).flat();
      const glyphs = new Set(cells.map((cell) => cell.replace(ANSI_PATTERN, "")));
      const foregrounds = new Set(cells.map((cell) => cell.match(FOREGROUND_PATTERN)?.slice(1).join(",") ?? ""));

      assert(glyphs.size > 1, `expected scene-dependent glyphs, received ${[...glyphs].join(",")}`);
      assert(foregrounds.size > 1, `expected scene-dependent colors, received ${[...foregrounds].join(",")}`);

      renderer.setTerminalGlyphStyle("blocks");
      const blockCells = (await renderer.renderToAnsiGrid()).flat();
      const blockGlyphs = new Set(blockCells.map((cell) => cell.replace(ANSI_PATTERN, "")));
      assert(blockGlyphs.has("█"), "expected blocks mode to render visible full-cell glyphs");
      assert(
        [...blockGlyphs].every((glyph) => glyph === " " || glyph === "█"),
        `blocks mode emitted partial or character-ramp glyphs: ${[...blockGlyphs].join(",")}`,
      );
    } finally {
      renderer.destroy();
      bundle.dispose();
    }
  },
});
