import { assert, assertEquals, assertStringIncludes, assertThrows } from "./deps.ts";
import { translateShaderBody } from "../glsl_wgsl.ts";
import { EXOMUX_BUTTERCHURN_CATALOG } from "../butterchurn_catalog.ts";

Deno.test("glsl→wgsl: translates the whole shipped shader corpus", () => {
  // The corpus is the point: a translator that handles the easy shaders and
  // throws on the rest would silently drop presets to the software path.
  let bodies = 0;
  for (const preset of EXOMUX_BUTTERCHURN_CATALOG) {
    for (const source of [preset.warp, preset.comp]) {
      if (!source.trim()) continue;
      bodies += 1;
      translateShaderBody(source);
    }
  }
  // 500 across the 293 vendored presets; most carry both a warp and a comp
  // shader, a handful only one.
  assertEquals(bodies, 500, "the shipped shader count changed");
});

Deno.test("glsl→wgsl: expands multi-component swizzle assignment", () => {
  // WGSL permits assigning one component at a time only, and this idiom is in
  // nearly every preset the GLSL optimizer touched.
  const { body } = translateShaderBody("shader_body { vec4 t; t.xyz = vec3(1.0, 2.0, 3.0); ret = t.xyz; }");
  assert(!/\.xyz\s*=/.test(body), `swizzle assignment survived translation:\n${body}`);
  assertStringIncludes(body, "t.x =");
  assertStringIncludes(body, "t.y =");
  assertStringIncludes(body, "t.z =");
});

Deno.test("glsl→wgsl: rewrites texture sampling and reports the samplers used", () => {
  const result = translateShaderBody("shader_body { ret = texture(sampler_blur1, uv).xyz; }");
  assertStringIncludes(result.body, "textureSampleLevel(sampler_blur1_tex, sampler_blur1_smp");
  assertEquals(result.samplers, ["sampler_blur1"]);
});

Deno.test("glsl→wgsl: maps types, builtins and constructors", () => {
  const { body } = translateShaderBody(
    "shader_body { float a = inversesqrt(4.0); vec2 b = vec2(1.0); float c = mod(5.0, 3.0); ret = vec3(a, b.x, c); }",
  );
  assertStringIncludes(body, "var a: f32");
  assertStringIncludes(body, "vec2<f32>(1.0)");
  assertStringIncludes(body, "inverseSqrt");
  // GLSL `mod` is a floored remainder, which WGSL has no builtin for.
  assertStringIncludes(body, "floor(");
});

Deno.test("glsl→wgsl: handles hoisted globals, uniform declarations and loops", () => {
  const result = translateShaderBody(`
    vec3 xlat_mutablescratch;
    uniform sampler2D sampler_cells;
    shader_body {
      xlat_mutablescratch = vec3(0.0);
      for (int i = 0; i < 4; i++) { xlat_mutablescratch += vec3(0.1); }
      ret = xlat_mutablescratch + texture(sampler_cells, uv).xyz;
    }
  `);
  assertStringIncludes(result.body, "var xlat_mutablescratch: vec3<f32>");
  assertStringIncludes(result.body, "loop {");
  // A texture the preset expects from an image pack we do not ship is reported
  // so the renderer can bind something in its place.
  assert(result.custom.includes("sampler_cells"), `custom samplers: ${result.custom.join(", ")}`);
});

Deno.test("glsl→wgsl: rejects source it does not understand", () => {
  // Emitting partial WGSL would compile into a wrong image rather than a
  // failure, and the caller could not tell the difference.
  assertThrows(() => translateShaderBody("shader_body { ret = nosuchfunc(1.0); }"), SyntaxError);
  assertThrows(() => translateShaderBody("shader_body { ret = ; }"), SyntaxError);
});
