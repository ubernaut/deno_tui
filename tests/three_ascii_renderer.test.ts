import { PerspectiveCamera, Scene } from "npm:three@0.183.2";
import { assertEquals, assertRejects } from "./deps.ts";
import { ThreeAsciiReadbackError, ThreeAsciiRenderer } from "../src/three_ascii/renderer.ts";

Deno.test("ThreeAsciiRenderer skips unchanged uniform buffer uploads", () => {
  const renderer = new ThreeAsciiRenderer({
    scene: new Scene(),
    camera: new PerspectiveCamera(),
    columns: 8,
    rows: 4,
  });
  let writes = 0;
  const internals = renderer as unknown as {
    device: { queue: { writeBuffer: () => void } };
    paramsBuffer: object;
    writeUniforms(effectState: unknown): void;
  };
  internals.device = { queue: { writeBuffer: () => writes += 1 } };
  internals.paramsBuffer = {};
  const effectState = {
    edges: true,
    fill: true,
    invertLuminance: false,
    exposure: 1,
    attenuation: 1,
    blendWithBase: 0,
    depthFalloff: 0,
    depthOffset: 0,
    edgeThreshold: 8,
    asciiColor: { r: 1, g: 1, b: 1 },
    backgroundColor: { r: 0, g: 0, b: 0 },
  };

  internals.writeUniforms(effectState);
  internals.writeUniforms(effectState);
  assertEquals(writes, 1);

  renderer.setTerminalEdgeBias(renderer.getTerminalEdgeBias());
  internals.writeUniforms(effectState);
  assertEquals(writes, 1);

  renderer.setTerminalEdgeBias(1.5);
  internals.writeUniforms(effectState);
  assertEquals(writes, 2);

  renderer.setSize(8, 4);
  internals.writeUniforms(effectState);
  assertEquals(writes, 2);

  renderer.setSize(9, 4);
  internals.writeUniforms(effectState);
  assertEquals(writes, 3);
});

Deno.test("ThreeAsciiRenderer marks compute resources dirty when terminal glyph style changes", () => {
  const renderer = new ThreeAsciiRenderer({
    scene: new Scene(),
    camera: new PerspectiveCamera(),
    columns: 8,
    rows: 4,
    terminalGlyphStyle: "blocks",
  });
  const internals = renderer as unknown as {
    computeDirty: boolean;
  };

  internals.computeDirty = false;
  renderer.setTerminalGlyphStyle("blocks");
  assertEquals(internals.computeDirty, false);

  renderer.setTerminalGlyphStyle("glyphs");
  assertEquals(internals.computeDirty, true);
});

Deno.test("ThreeAsciiRenderer wraps failed GPU readback mapping with a stable error", async () => {
  const renderer = new ThreeAsciiRenderer({
    scene: new Scene(),
    camera: new PerspectiveCamera(),
    columns: 1,
    rows: 1,
  });
  const cause = new Error("validation error occurred");
  let unmapped = false;
  const internals = renderer as unknown as {
    outputReadback: unknown;
    fillOutput: unknown;
    colorOutput: unknown;
    buildAnsiGridFromReadback(layout: unknown, backgroundColor: unknown): Promise<string[][]>;
  };
  internals.outputReadback = {
    byteLength: 8,
    gpu: {
      mapAsync: () => Promise.reject(cause),
      getMappedRange: () => new ArrayBuffer(8),
      unmap: () => {
        unmapped = true;
      },
    },
  };
  internals.fillOutput = { byteLength: 4, gpu: {} };
  internals.colorOutput = { byteLength: 4, gpu: {} };

  const error = await assertRejects(
    () =>
      internals.buildAnsiGridFromReadback(
        { byteLength: 8, fillOffset: 0, colorOffset: 4 },
        { r: 0, g: 0, b: 0 },
      ),
    ThreeAsciiReadbackError,
    "GPU readback unavailable",
  );

  assertEquals(error.code, "three-ascii-readback-unavailable");
  assertEquals(error.cause, cause);
  assertEquals(unmapped, false);
});
