import { PerspectiveCamera, Scene } from "npm:three@0.183.2";
import { assertEquals } from "./deps.ts";
import { ThreeAsciiRenderer } from "../src/three_ascii/renderer.ts";

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
