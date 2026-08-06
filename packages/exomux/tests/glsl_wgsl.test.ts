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

Deno.test("glsl→wgsl: splats scalars where WGSL demands a matching vector", () => {
  // `clamp(v2, 0.0, 1.0)` is ordinary GLSL and a compile error in WGSL. A third
  // of the catalog writes it, and before it was handled those presets fell
  // silently to the software renderer.
  const { body } = translateShaderBody(`shader_body {
    vec2 a = clamp(uv, 0.0, 1.0);
    vec3 b = min(hue_shader, 1.0);
    vec3 c = max(hue_shader, 0.0);
    vec2 d = step(0.5, uv);
    vec2 e = smoothstep(0.0, 1.0, uv);
    vec3 f = mix(hue_shader, hue_shader, 0.5);
    ret = vec3(a.x, b.y, c.z) + vec3(d.x, e.y, f.z);
  }`);
  assertStringIncludes(body, "clamp(uv, vec2<f32>(0.0), vec2<f32>(1.0))");
  assertStringIncludes(body, "min(hue_shader, vec3<f32>(1.0))");
  assertStringIncludes(body, "max(hue_shader, vec3<f32>(0.0))");
  assertStringIncludes(body, "step(vec2<f32>(0.5), uv)");
  assertStringIncludes(body, "smoothstep(vec2<f32>(0.0), vec2<f32>(1.0), uv)");
  // `mix` is the exception: WGSL overloads its interpolant for a scalar, so
  // splatting it would be noise.
  assertStringIncludes(body, "mix(hue_shader, hue_shader, 0.5)");
});

Deno.test("glsl→wgsl: leaves scalar-only and unknown-typed calls alone", () => {
  const { body } = translateShaderBody(
    "shader_body { float a = clamp(bass, 0.0, 1.0); ret = vec3(a, mix(0.0, 1.0, 0.5), 0.0); }",
  );
  assertStringIncludes(body, "clamp(bass, 0.0, 1.0)");
  assert(!body.includes("vec2<f32>(0.0)"), `a scalar clamp was splatted:\n${body}`);
});

Deno.test("glsl→wgsl: keeps integers integral for subscripts and counters", () => {
  // Every numeric literal is emitted as a float, because that is what almost
  // every position wants. Subscripts and integer variables are the exceptions,
  // and WGSL mixes neither with floats.
  const { body } = translateShaderBody(
    "shader_body { vec4 v = vec4(1.0); int n = 0; for (int i = 0; i < 4; i++) { n = n + 1; } ret = vec3(v[1], v[n], 0.0); }",
  );
  assertStringIncludes(body, "var n: i32 = 0;");
  assertStringIncludes(body, "var i: i32 = 0;");
  assertStringIncludes(body, "(i < 4)");
  assertStringIncludes(body, "v[1]");
  assertStringIncludes(body, "v[n]");
  assert(!/\[\s*\d+\.0\s*\]/.test(body), `a float literal was used as a subscript:\n${body}`);
});
