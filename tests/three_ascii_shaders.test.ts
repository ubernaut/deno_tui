import { assertEquals, assertStringIncludes } from "./deps.ts";
import {
  THREE_ASCII_COLOR_SHADER,
  THREE_ASCII_EDGE_SHADER,
  THREE_ASCII_FILL_SHADER,
  THREE_ASCII_TERMINAL_EDGE_THRESHOLD_SCALE,
  THREE_ASCII_TILE_SIZE,
  THREE_ASCII_WORKGROUP_SIZE,
} from "../src/three_ascii/shaders.ts";

Deno.test("three ascii shader constants preserve renderer dimensions", () => {
  assertEquals(THREE_ASCII_TILE_SIZE, 8);
  assertEquals(THREE_ASCII_WORKGROUP_SIZE, 8);
  assertEquals(THREE_ASCII_TERMINAL_EDGE_THRESHOLD_SCALE, 2);
});

Deno.test("three ascii WGSL shaders include expected bindings and workgroup size", () => {
  assertStringIncludes(THREE_ASCII_FILL_SHADER, "@binding(2) var<storage, read_write> glyphs: array<f32>;");
  assertStringIncludes(
    THREE_ASCII_EDGE_SHADER,
    `@workgroup_size(${THREE_ASCII_WORKGROUP_SIZE}, ${THREE_ASCII_WORKGROUP_SIZE}, 1)`,
  );
  assertStringIncludes(THREE_ASCII_EDGE_SHADER, `for (var row = 0; row < ${THREE_ASCII_TILE_SIZE}; row += 1)`);
  assertStringIncludes(THREE_ASCII_COLOR_SHADER, "@binding(3) var<storage, read_write> colors: array<vec4<f32>>;");
});
