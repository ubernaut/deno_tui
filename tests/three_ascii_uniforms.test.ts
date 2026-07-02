import { assertEquals, assertThrows } from "./deps.ts";
import { THREE_ASCII_UNIFORM_FLOAT_COUNT, writeThreeAsciiUniformValues } from "../src/three_ascii/uniforms.ts";

Deno.test("writeThreeAsciiUniformValues packs dimensions flags effects and colors", () => {
  const target = new Float32Array(THREE_ASCII_UNIFORM_FLOAT_COUNT);
  const result = writeThreeAsciiUniformValues(target, {
    columns: 12,
    rows: 5,
    tileSize: 8,
    terminalEdgeBias: 1.5,
    terminalEdgeThresholdScale: 2,
    effectState: {
      edges: true,
      fill: false,
      invertLuminance: true,
      exposure: 1.25,
      attenuation: 0.75,
      blendWithBase: 0.5,
      depthFalloff: 3,
      depthOffset: 4,
      edgeThreshold: 6,
      asciiColor: { r: 0.1, g: 0.2, b: 0.3 },
      backgroundColor: { r: 0.4, g: 0.5, b: 0.6 },
    },
  });

  assertEquals(result, target);
  assertEquals(Array.from(target), [
    12,
    5,
    96,
    40,
    1,
    0,
    1,
    18,
    1.25,
    0.75,
    0.5,
    3,
    4,
    0,
    0,
    0,
    0.10000000149011612,
    0.20000000298023224,
    0.30000001192092896,
    1,
    0.4000000059604645,
    0.5,
    0.6000000238418579,
    1,
  ]);
});

Deno.test("writeThreeAsciiUniformValues rejects short target buffers", () => {
  assertThrows(
    () =>
      writeThreeAsciiUniformValues(new Float32Array(4), {
        columns: 1,
        rows: 1,
        tileSize: 8,
        terminalEdgeBias: 1,
        terminalEdgeThresholdScale: 2,
        effectState: {
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
        },
      }),
    RangeError,
    "requires 24 floats",
  );
});
