// Copyright 2023 Im-Beast. MIT license.
import { Color } from "npm:three@0.183.2";

import { assertEquals, assertNotStrictEquals, assertStrictEquals, assertStringIncludes, assertThrows } from "./deps.ts";
import { ThreeAsciiAnsiBackgroundState } from "../src/three_ascii/ansi_background.ts";
import {
  fillGlyphKeyForIndex,
  GLYPH_MODE_BLOCKS,
  glyphForKey,
  isSolidBlockFillGlyphKey,
  terminalFillGlyphKeysForMode,
  terminalGlyphForCell,
  terminalGlyphModeForStyle,
} from "../src/three_ascii/ansi_glyph_keys.ts";
import {
  colorToBytes,
  colorValue,
  createLinearByteCache,
  linearUnitToByte,
  rgbToAnsiBackground,
  rgbToAnsiForeground,
  ThreeAsciiAnsiColorKeyCache,
} from "../src/three_ascii/colors.ts";
import {
  createThreeAsciiComputeDispatchPlan,
  encodeThreeAsciiComputeDispatchCommands,
  ThreeAsciiComputeDispatchPlanCache,
} from "../src/three_ascii/compute_plan.ts";
import {
  applyThreeAsciiComputeResourcePlanState,
  createThreeAsciiComputeBindGroups,
  createThreeAsciiComputePipeline,
  createThreeAsciiComputeResourcePlan,
} from "../src/three_ascii/compute_resources.ts";
import {
  patchThreeAsciiEffectOptions,
  threeAsciiEffectOptionsAffectComputeUniforms,
} from "../src/three_ascii/effect_options.ts";
import {
  defaultThreeAsciiEffectState,
  resolveThreeAsciiComputeMode,
  shouldIncludeThreeAsciiTerminalEdges,
  threeAsciiEffectStateFromSource,
  type ThreeAsciiEffectStateSource,
} from "../src/three_ascii/effect_state.ts";
import {
  emptyThreeAsciiRenderFrame,
  resolveThreeAsciiRenderFrameSelection,
  resolveThreeAsciiRenderFrameSelectionInto,
  THREE_ASCII_ANSI_FRAME_OPTIONS,
  THREE_ASCII_IMAGE_FRAME_OPTIONS,
} from "../src/three_ascii/frame_options.ts";
import {
  destroyThreeAsciiGpuBufferSlot,
  ensureThreeAsciiGpuBufferSlot,
  type ThreeAsciiGpuBuffer,
  type ThreeAsciiGpuBufferDevice,
} from "../src/three_ascii/gpu_buffers.ts";
import { compactMappedRgbaRows } from "../src/three_ascii/headless_canvas.ts";
import { loadAsciiLutTextures } from "../src/three_ascii/loadAsciiLuts.ts";
import {
  createThreeAsciiRendererPerformance,
  createThreeAsciiRendererSaturatedPerformance,
} from "../src/three_ascii/performance.ts";
import {
  resolveThreeAsciiRenderProfile,
  resolveThreeAsciiRenderProfileInto,
} from "../src/three_ascii/render_profile.ts";
import {
  DEFAULT_THREE_ASCII_DEFERRED_READBACK_MAX_STALE_FRAMES,
  DEFAULT_THREE_ASCII_DEFERRED_READBACK_SLOTS,
  DEFAULT_THREE_ASCII_PIXEL_ASPECT_RATIO,
  DEFAULT_THREE_ASCII_TERMINAL_EDGE_BIAS,
  normalizeThreeAsciiRendererOptions,
  normalizeThreeAsciiRenderSize,
  normalizeThreeAsciiTerminalEdgeBias,
} from "../src/three_ascii/renderer_options.ts";
import {
  computeThreeAsciiCameraAspect,
  handleThreeAsciiDeferredReadbackFailure,
  readThreeAsciiImageFrame,
  resolveThreeAsciiDeferredReadbackSubmission,
  shouldUpdateThreeAsciiCameraAspect,
  THREE_ASCII_CAMERA_ASPECT_EPSILON,
  ThreeAsciiReadbackError,
} from "../src/three_ascii/renderer.ts";
import {
  resolveThreeAsciiDeferredPreSceneFrame,
  resolveThreeAsciiDeferredReadbackStaleness,
} from "../src/three_ascii/deferred_frame.ts";
import {
  THREE_ASCII_COLOR_SHADER,
  THREE_ASCII_EDGE_SHADER,
  THREE_ASCII_FILL_SHADER,
  THREE_ASCII_FLAT_COLOR_SHADER,
  THREE_ASCII_TERMINAL_EDGE_THRESHOLD_SCALE,
  THREE_ASCII_TILE_SIZE,
  THREE_ASCII_WORKGROUP_SIZE,
} from "../src/three_ascii/shaders.ts";
import { THREE_ASCII_UNIFORM_FLOAT_COUNT, writeThreeAsciiUniformValues } from "../src/three_ascii/uniforms.ts";

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
  assertStringIncludes(THREE_ASCII_FLAT_COLOR_SHADER, "@binding(2) var<storage, read_write> colors: array<vec4<f32>>;");
  assertEquals(THREE_ASCII_FLAT_COLOR_SHADER.includes("normalsTex"), false);
});

Deno.test("loadAsciiLutTextures caches decoded bitmaps while returning fresh textures", async () => {
  const originalCreateImageBitmap = globalThis.createImageBitmap;
  let bitmapCount = 0;
  const bitmaps: ImageBitmap[] = [];
  globalThis.createImageBitmap = (() => {
    const bitmap = { id: bitmapCount++ } as unknown as ImageBitmap;
    bitmaps.push(bitmap);
    return Promise.resolve(bitmap);
  }) as typeof createImageBitmap;

  try {
    const edges = "data:image/png;base64,ZWQ=";
    const fill = "data:image/png;base64,ZmlsbA==";
    const first = await loadAsciiLutTextures(edges, fill);
    const second = await loadAsciiLutTextures(edges, fill);

    assertEquals(bitmapCount, 2);
    assertNotStrictEquals(first.edgesTexture, second.edgesTexture);
    assertNotStrictEquals(first.fillTexture, second.fillTexture);
    assertStrictEquals(first.edgesTexture.image, bitmaps[0]);
    assertStrictEquals(second.edgesTexture.image, bitmaps[0]);
    assertStrictEquals(first.fillTexture.image, bitmaps[1]);
    assertStrictEquals(second.fillTexture.image, bitmaps[1]);
  } finally {
    globalThis.createImageBitmap = originalCreateImageBitmap;
  }
});

Deno.test("three ascii color helpers preserve Color inputs and resolve fallbacks", () => {
  const color = new Color("#112233");

  assertStrictEquals(colorValue(color, 0), color);
  assertEquals(colorValue(undefined, 0xff0000).getHex(), 0xff0000);
  assertEquals(colorValue("#00ff00", 0).getHex(), 0x00ff00);
});

Deno.test("three ascii color helpers convert linear channels to srgb bytes", () => {
  assertEquals(linearUnitToByte(-1), 0);
  assertEquals(linearUnitToByte(0), 0);
  assertEquals(linearUnitToByte(1), 255);
  assertEquals(colorToBytes(new Color(0.25, 0.5, 1)), [137, 188, 255]);
});

Deno.test("three ascii color helpers format terminal truecolor sequences", () => {
  assertEquals(rgbToAnsiForeground(1, 2, 3), "\x1b[38;2;1;2;3m");
  assertEquals(rgbToAnsiBackground(4, 5, 6), "\x1b[48;2;4;5;6m");
});

Deno.test("three ascii linear byte cache preserves conversion through clear and prune", () => {
  const cache = createLinearByteCache();
  const expected = linearUnitToByte(0.5);

  assertEquals(cache(0.5), expected);
  assertEquals(cache(0.5), expected);
  cache.clear();
  assertEquals(cache(0.5), expected);
  cache.prune();
  assertEquals(cache(0.5), expected);
});

Deno.test("ThreeAsciiAnsiColorKeyCache converts and preserves linear RGB byte keys", () => {
  const cache = new ThreeAsciiAnsiColorKeyCache();
  cache.prepare(2);

  assertEquals(cache.keyForIndex(0, 1, 0, 0), 0xff0000);
  assertEquals(cache.keyForIndex(1, 0, 1, 0), 0x00ff00);
  const first = cache.keyForIndex(0, 0.25, 0.5, 1);
  assertEquals(cache.keyForIndex(0, 0.25, 0.5, 1), first);

  cache.clear();
  cache.prepare(1);
  assertEquals(cache.keyForIndex(0, 0.25, 0.5, 1), first);
});

Deno.test("ThreeAsciiAnsiColorKeyCache resizes indexed frame cache", () => {
  const cache = new ThreeAsciiAnsiColorKeyCache();
  cache.prepare(2);
  cache.keyForIndex(1, 0, 1, 0);

  cache.prepare(1);
  assertEquals(cache.keyForIndex(0, 1, 0, 0), 0xff0000);
});

Deno.test("ThreeAsciiAnsiBackgroundState reports only effective background changes", () => {
  const state = new ThreeAsciiAnsiBackgroundState();

  assertEquals(state.set(0x010203), true);
  assertEquals(state.key, 0x010203);
  assertEquals(state.ansi, "\x1b[48;2;1;2;3m");
  assertEquals(state.blankAnsi, "\x1b[48;2;1;2;3m \x1b[0m");
  assertEquals(state.set(0x010203), false);
  assertEquals(state.set("#010203"), false);
  assertEquals(state.set(0x030201), true);
  assertEquals(state.key, 0x030201);
});

Deno.test("ThreeAsciiAnsiBackgroundState tracks mutable Color inputs and clear", () => {
  const state = new ThreeAsciiAnsiBackgroundState();
  const color = new Color(0x010203);

  assertEquals(state.set(color), true);
  assertEquals(state.set(color), false);
  color.set(0x030201);
  assertEquals(state.set(color), true);
  assertEquals(state.key, 0x030201);

  state.clear();
  assertEquals(state.key, -1);
  assertEquals(state.ansi, "");
  assertEquals(state.blankAnsi, "");
  assertEquals(state.set(0x030201), true);
});

Deno.test("three ascii glyph keys map block mode to full-cell block fills", () => {
  const mode = terminalGlyphModeForStyle("blocks");
  const keys = terminalFillGlyphKeysForMode(mode);

  assertEquals(mode, GLYPH_MODE_BLOCKS);
  assertEquals(glyphForKey(fillGlyphKeyForIndex(keys, 0)), " ");
  assertEquals(glyphForKey(fillGlyphKeyForIndex(keys, 14)), "█");
  assertEquals(isSolidBlockFillGlyphKey(fillGlyphKeyForIndex(keys, 14)), true);
});

Deno.test("three ascii glyph and mixed modes keep distinct fill glyph tables", () => {
  const glyphKeys = terminalFillGlyphKeysForMode(terminalGlyphModeForStyle("glyphs"));
  const mixedKeys = terminalFillGlyphKeysForMode(terminalGlyphModeForStyle("mixed"));
  const glyphKey = fillGlyphKeyForIndex(glyphKeys, 14);
  const mixedKey = fillGlyphKeyForIndex(mixedKeys, 14);

  assertEquals(glyphForKey(glyphKey), "=");
  assertEquals(glyphForKey(mixedKey).length > 0, true);
  assertEquals(isSolidBlockFillGlyphKey(glyphKey), false);
  assertEquals(isSolidBlockFillGlyphKey(mixedKey), false);
});

Deno.test("three ascii glyph keys promote strong edges in edge-capable modes", () => {
  const glyphKeys = terminalFillGlyphKeysForMode(terminalGlyphModeForStyle("glyphs"));

  const edgeKey = terminalGlyphForCell(glyphKeys, 1, 64, 64, 0, 14, 1);
  const weakKey = terminalGlyphForCell(glyphKeys, 1, 1, 64, 0, 14, 1);

  assertEquals(glyphForKey(edgeKey), "|");
  assertEquals(glyphForKey(weakKey), "=");
});

Deno.test("three ascii camera aspect accounts for terminal cell geometry", () => {
  assertEquals(computeThreeAsciiCameraAspect({ columns: 80, rows: 40, pixelAspectRatio: 0.5 }), 1);
  assertEquals(computeThreeAsciiCameraAspect({ columns: 120, rows: 40, pixelAspectRatio: 0.5 }), 1.5);
  assertEquals(computeThreeAsciiCameraAspect({ columns: 10, rows: 0, pixelAspectRatio: 0.5 }), 5);
  assertEquals(computeThreeAsciiCameraAspect({ columns: 10, rows: -2, pixelAspectRatio: 0.5 }), 5);
});

Deno.test("three ascii camera aspect update threshold ignores epsilon-sized differences", () => {
  assertEquals(
    shouldUpdateThreeAsciiCameraAspect(1, 1 + THREE_ASCII_CAMERA_ASPECT_EPSILON),
    false,
  );
  assertEquals(
    shouldUpdateThreeAsciiCameraAspect(1, 1 + THREE_ASCII_CAMERA_ASPECT_EPSILON * 2),
    true,
  );
});

Deno.test("three ascii compute mode matches terminal glyph style requirements", () => {
  assertEquals(resolveThreeAsciiComputeMode({ edges: true, depthFalloff: 0 }, "blocks"), {
    includeFill: false,
    includeEdges: false,
    includeDepthColor: false,
    includeFillReadback: false,
  });
  assertEquals(resolveThreeAsciiComputeMode({ edges: true, depthFalloff: 0 }, "glyphs").includeEdges, true);
  assertEquals(resolveThreeAsciiComputeMode({ edges: true, depthFalloff: 0 }, "mixed").includeFillReadback, true);
  assertEquals(resolveThreeAsciiComputeMode({ edges: false, depthFalloff: 0 }, "glyphs"), {
    includeFill: true,
    includeEdges: false,
    includeDepthColor: false,
    includeFillReadback: true,
  });
  assertEquals(resolveThreeAsciiComputeMode({ edges: false, depthFalloff: 0.1 }, "blocks"), {
    includeFill: false,
    includeEdges: false,
    includeDepthColor: true,
    includeFillReadback: false,
  });
});

Deno.test("three ascii effect option patches report changed values and uniform dirtiness", () => {
  const target = { normalThreshold: 0.1, edgeThreshold: 8 };

  const noOp = patchThreeAsciiEffectOptions(target, { normalThreshold: 0.1 });
  assertEquals(noOp.changed, false);
  assertEquals(noOp.patch, {});
  assertEquals(noOp.uniformDirty, false);
  assertEquals(target.normalThreshold, 0.1);

  const changed = patchThreeAsciiEffectOptions(target, { normalThreshold: 0.2, edgeThreshold: 6 });
  assertEquals(changed.changed, true);
  assertEquals(changed.patch, { normalThreshold: 0.2, edgeThreshold: 6 });
  assertEquals(changed.uniformDirty, true);
  assertEquals(target.normalThreshold, 0.2);
  assertEquals(target.edgeThreshold, 6);
  assertEquals(threeAsciiEffectOptionsAffectComputeUniforms({ edgeThreshold: 4 }), true);
  assertEquals(threeAsciiEffectOptionsAffectComputeUniforms({ exposure: 1.2 }), true);
  assertEquals(threeAsciiEffectOptionsAffectComputeUniforms({ normalThreshold: 0.2 }), false);
  assertEquals(threeAsciiEffectOptionsAffectComputeUniforms({ offset: { x: 1, y: 1 } }), false);
});

Deno.test("three ascii effect option patches normalize colors and compare offsets by value", () => {
  const colors = {
    asciiColor: new Color(0xffffff),
    backgroundColor: 0x000000,
  };

  const noColorOp = patchThreeAsciiEffectOptions(colors, {
    asciiColor: "#ffffff",
    backgroundColor: new Color(0x000000),
  });
  assertEquals(noColorOp.changed, false);
  assertEquals(noColorOp.uniformDirty, false);

  const colorChange = patchThreeAsciiEffectOptions(colors, { backgroundColor: "#010203" });
  assertEquals(colorChange.changed, true);
  assertEquals(colorChange.uniformDirty, true);
  assertEquals((colorChange.patch.backgroundColor as Color).getHex(), 0x010203);
  assertEquals((colors.backgroundColor as Color).getHex(), 0x010203);

  const offset = { offset: { x: 1, y: 2 } };
  assertEquals(patchThreeAsciiEffectOptions(offset, { offset: { x: 1, y: 2 } }).changed, false);
  const offsetChange = patchThreeAsciiEffectOptions(offset, { offset: { x: 2, y: 2 } });
  assertEquals(offsetChange.changed, true);
  assertEquals(offsetChange.patch.offset, { x: 2, y: 2 });
  assertEquals(offsetChange.uniformDirty, false);
});

Deno.test("three ascii effect state applies defaults and projects Acerola node state", () => {
  const defaults = defaultThreeAsciiEffectState({
    asciiColor: 0x123456,
    backgroundColor: "#010203",
  });

  assertEquals(defaults.edges, true);
  assertEquals(defaults.fill, true);
  assertEquals(defaults.invertLuminance, false);
  assertEquals(defaults.exposure, 1);
  assertEquals(defaults.attenuation, 1);
  assertEquals(defaults.blendWithBase, 0);
  assertEquals(defaults.depthFalloff, 0);
  assertEquals(defaults.depthOffset, 0);
  assertEquals(defaults.edgeThreshold, 8);
  assertEquals(defaults.asciiColor.getHex(), 0x123456);
  assertEquals(defaults.backgroundColor.getHex(), 0x010203);

  const configured = defaultThreeAsciiEffectState({
    edges: false,
    fill: false,
    invertLuminance: true,
    exposure: 1.4,
    attenuation: 0.8,
    blendWithBase: 0.5,
    depthFalloff: 0.18,
    depthOffset: 110,
    edgeThreshold: 12,
  });
  assertEquals(configured.edges, false);
  assertEquals(configured.fill, false);
  assertEquals(configured.invertLuminance, true);
  assertEquals(configured.exposure, 1.4);
  assertEquals(configured.attenuation, 0.8);
  assertEquals(configured.blendWithBase, 0.5);
  assertEquals(configured.depthFalloff, 0.18);
  assertEquals(configured.depthOffset, 110);
  assertEquals(configured.edgeThreshold, 12);

  const asciiColor = new Color(0xff3300);
  const backgroundColor = new Color(0x001122);
  const source: ThreeAsciiEffectStateSource = {
    edges: { value: 0 },
    fill: { value: 1 },
    invertLuminance: { value: "yes" },
    exposure: { value: "1.5" },
    attenuation: { value: 0.75 },
    blendWithBase: { value: "0.25" },
    depthFalloff: { value: "2" },
    depthOffset: { value: 3 },
    edgeThreshold: { value: "9" },
    asciiColor: { value: asciiColor },
    backgroundColor: { value: backgroundColor },
  };
  const projected = threeAsciiEffectStateFromSource(source);
  assertEquals(projected.edges, false);
  assertEquals(projected.fill, true);
  assertEquals(projected.invertLuminance, true);
  assertEquals(projected.exposure, 1.5);
  assertEquals(projected.attenuation, 0.75);
  assertEquals(projected.blendWithBase, 0.25);
  assertEquals(projected.depthFalloff, 2);
  assertEquals(projected.depthOffset, 3);
  assertEquals(projected.edgeThreshold, 9);
  assertEquals(projected.asciiColor, asciiColor);
  assertEquals(projected.backgroundColor, backgroundColor);
});

Deno.test("three ascii terminal edge overlay is disabled for block rendering", () => {
  assertEquals(shouldIncludeThreeAsciiTerminalEdges({ edges: true }, "glyphs"), true);
  assertEquals(shouldIncludeThreeAsciiTerminalEdges({ edges: true }, "mixed"), true);
  assertEquals(shouldIncludeThreeAsciiTerminalEdges({ edges: true }, "blocks"), false);
  assertEquals(shouldIncludeThreeAsciiTerminalEdges({ edges: false }, "glyphs"), false);
});

Deno.test("three ascii frame selection resolves ANSI and image outputs", () => {
  assertEquals(resolveThreeAsciiRenderFrameSelection(), { renderAnsi: true, renderImage: false });
  assertEquals(resolveThreeAsciiRenderFrameSelection({}), { renderAnsi: true, renderImage: false });
  assertEquals(resolveThreeAsciiRenderFrameSelection(THREE_ASCII_ANSI_FRAME_OPTIONS), {
    renderAnsi: true,
    renderImage: false,
  });
  assertEquals(resolveThreeAsciiRenderFrameSelection({ ansi: false, image: true }), {
    renderAnsi: false,
    renderImage: true,
  });
  assertEquals(resolveThreeAsciiRenderFrameSelection(THREE_ASCII_IMAGE_FRAME_OPTIONS), {
    renderAnsi: false,
    renderImage: true,
  });
  assertEquals(resolveThreeAsciiRenderFrameSelection({ ansi: true, image: true }), {
    renderAnsi: true,
    renderImage: true,
  });
});

Deno.test("three ascii frame selection reuses caller-owned records", () => {
  const target = { renderAnsi: false, renderImage: true };

  assertEquals(resolveThreeAsciiRenderFrameSelectionInto(target, THREE_ASCII_ANSI_FRAME_OPTIONS), target);
  assertEquals(target, { renderAnsi: true, renderImage: false });
  resolveThreeAsciiRenderFrameSelectionInto(target, { ansi: true, image: true });
  assertEquals(target, { renderAnsi: true, renderImage: true });
  resolveThreeAsciiRenderFrameSelectionInto(target, { ansi: false });
  assertEquals(target, { renderAnsi: false, renderImage: false });
  assertEquals(emptyThreeAsciiRenderFrame({ renderAnsi: true, renderImage: false }), { grid: [] });
  assertEquals(emptyThreeAsciiRenderFrame({ renderAnsi: false, renderImage: true }), { grid: undefined });
});

Deno.test("three ascii image frames read sync and async RGBA data", async () => {
  const syncData = new Uint8Array([1, 2, 3, 4]);
  let reads = 0;

  const syncFrame = await readThreeAsciiImageFrame({
    width: 2,
    height: 1,
    context: {
      readRGBA: () => {
        reads += 1;
        return syncData;
      },
    },
  });

  assertEquals(reads, 1);
  assertStrictEquals(syncFrame.data, syncData);
  assertEquals(syncFrame.encoding, "bytes");
  assertEquals(syncFrame.format, 32);
  assertEquals(syncFrame.pixelWidth, 2);
  assertEquals(syncFrame.pixelHeight, 1);

  const asyncData = new Uint8Array([5, 6, 7, 8]);
  const asyncFrame = await readThreeAsciiImageFrame({
    width: 1,
    height: 1,
    context: {
      readRGBA: () => Promise.resolve(asyncData),
    },
  });

  assertStrictEquals(asyncFrame.data, asyncData);
  assertEquals(asyncFrame.pixelWidth, 1);
  assertEquals(asyncFrame.pixelHeight, 1);
});

Deno.test("three ascii render profile follows output and glyph requirements", () => {
  assertEquals(
    resolveThreeAsciiRenderProfile({
      selection: { renderAnsi: false, renderImage: true },
      terminalGlyphStyle: "blocks",
    }),
    { image: true, terminalEdges: true, terminalDepthColor: true },
  );
  assertEquals(
    resolveThreeAsciiRenderProfile({
      selection: { renderAnsi: true, renderImage: false },
      effectState: { edges: true, depthFalloff: 0 },
      terminalGlyphStyle: "blocks",
    }),
    { image: false, terminalEdges: false, terminalDepthColor: false },
  );
  assertEquals(
    resolveThreeAsciiRenderProfile({
      selection: { renderAnsi: true, renderImage: false },
      effectState: { edges: true, depthFalloff: 0.25 },
      terminalGlyphStyle: "glyphs",
    }),
    { image: false, terminalEdges: true, terminalDepthColor: true },
  );
  assertEquals(
    resolveThreeAsciiRenderProfile({
      selection: { renderAnsi: false, renderImage: false },
      terminalGlyphStyle: "glyphs",
    }),
    { image: false, terminalEdges: false, terminalDepthColor: false },
  );
});

Deno.test("three ascii render profile reuses caller-owned profile objects", () => {
  const target = { image: true, terminalEdges: true, terminalDepthColor: true };
  const resolved = resolveThreeAsciiRenderProfileInto(
    {
      selection: { renderAnsi: true, renderImage: false },
      effectState: { edges: true, depthFalloff: 0 },
      terminalGlyphStyle: "blocks",
    },
    target,
  );

  assertEquals(resolved, target);
  assertEquals(target, { image: false, terminalEdges: false, terminalDepthColor: false });

  resolveThreeAsciiRenderProfileInto(
    {
      selection: { renderAnsi: true, renderImage: false },
      effectState: { edges: true, depthFalloff: 0.2 },
      terminalGlyphStyle: "glyphs",
    },
    target,
  );

  assertEquals(target, { image: false, terminalEdges: true, terminalDepthColor: true });
});

Deno.test("three ascii renderer options normalize size, edge bias, and defaults", () => {
  assertEquals(normalizeThreeAsciiRenderSize(12.9, 4.2), { columns: 12, rows: 4 });
  assertEquals(normalizeThreeAsciiRenderSize(0, -10), { columns: 1, rows: 1 });
  assertEquals(normalizeThreeAsciiTerminalEdgeBias(), DEFAULT_THREE_ASCII_TERMINAL_EDGE_BIAS);
  assertEquals(normalizeThreeAsciiTerminalEdgeBias(0.25), 0.5);
  assertEquals(normalizeThreeAsciiTerminalEdgeBias(2.25), 2.25);

  assertEquals(normalizeThreeAsciiRendererOptions({ columns: 3, rows: 2 }), {
    columns: 3,
    rows: 2,
    pixelAspectRatio: DEFAULT_THREE_ASCII_PIXEL_ASPECT_RATIO,
    terminalEdgeBias: DEFAULT_THREE_ASCII_TERMINAL_EDGE_BIAS,
    terminalGlyphStyle: "blocks",
    readbackStrategy: "blocking",
    deferredReadbackSlots: DEFAULT_THREE_ASCII_DEFERRED_READBACK_SLOTS,
    deferredReadbackMaxStaleFrames: DEFAULT_THREE_ASCII_DEFERRED_READBACK_MAX_STALE_FRAMES,
  });
});

Deno.test("three ascii renderer options preserve explicit choices and clamp stale frames", () => {
  assertEquals(
    normalizeThreeAsciiRendererOptions({
      columns: 5.8,
      rows: 6.2,
      pixelAspectRatio: 0.75,
      terminalEdgeBias: 1.5,
      terminalGlyphStyle: "mixed",
      readbackStrategy: "deferred",
      deferredReadbackSlots: 3,
      deferredReadbackMaxStaleFrames: 2.9,
    }),
    {
      columns: 5,
      rows: 6,
      pixelAspectRatio: 0.75,
      terminalEdgeBias: 1.5,
      terminalGlyphStyle: "mixed",
      readbackStrategy: "deferred",
      deferredReadbackSlots: 3,
      deferredReadbackMaxStaleFrames: 2,
    },
  );
  assertEquals(
    normalizeThreeAsciiRendererOptions({
      columns: 5,
      rows: 6,
      deferredReadbackMaxStaleFrames: -2,
    }).deferredReadbackMaxStaleFrames,
    0,
  );
});

Deno.test("three ascii GPU buffer slots reuse same-sized buffers", () => {
  const device = new FakeGpuBufferDevice();
  const first = ensureThreeAsciiGpuBufferSlot(device, undefined, {
    label: "first",
    byteLength: 64,
    usage: 3,
  });
  const second = ensureThreeAsciiGpuBufferSlot(device, first, {
    label: "second",
    byteLength: 64,
    usage: 7,
  });

  assertStrictEquals(second, first);
  assertEquals(device.buffers.length, 1);
  assertEquals(first.gpu.destroyed, false);
  assertEquals(first.gpu.label, "first");
  assertEquals(first.gpu.usage, 3);
});

Deno.test("three ascii GPU buffer slots replace resized buffers and destroy optional slots", () => {
  const device = new FakeGpuBufferDevice();
  const first = ensureThreeAsciiGpuBufferSlot(device, undefined, {
    label: "small",
    byteLength: 16,
    usage: 1,
  });
  const second = ensureThreeAsciiGpuBufferSlot(device, first, {
    label: "large",
    byteLength: 32,
    usage: 5,
  });

  assertEquals(first.gpu.destroyed, true);
  assertEquals(second === first, false);
  assertEquals(second.byteLength, 32);
  assertEquals(second.gpu.label, "large");
  assertEquals(second.gpu.usage, 5);
  assertEquals(device.buffers.length, 2);
  assertEquals(destroyThreeAsciiGpuBufferSlot(second), undefined);
  assertEquals(second.gpu.destroyed, true);
  assertEquals(destroyThreeAsciiGpuBufferSlot(undefined), undefined);
});

Deno.test("three ascii uniforms pack dimensions flags effects and colors", () => {
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

Deno.test("three ascii uniforms reject short target buffers", () => {
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

Deno.test("three ascii renderer performance projects frame and queue timings", () => {
  assertEquals(
    createThreeAsciiRendererPerformance({
      columns: 12,
      rows: 8,
      terminalGlyphStyle: "blocks",
      frameMs: 16,
      initMs: 5,
      sceneMs: 9,
      ansiMs: 7,
      readbackMs: 4,
      assemblyMs: 2,
      queue: {
        slotCount: 6,
        pending: 1,
        unresolved: 2,
        resolved: 3,
        saturated: false,
      },
    }),
    {
      columns: 12,
      rows: 8,
      cells: 96,
      terminalGlyphStyle: "blocks",
      totalMs: 16,
      initMs: 5,
      sceneMs: 9,
      sceneUpdateMs: undefined,
      sceneRenderMs: undefined,
      ansiMs: 7,
      readbackMs: 4,
      assemblyMs: 2,
      deferredReadbackSlots: 6,
      deferredReadbackPending: 1,
      deferredReadbackUnresolved: 2,
      deferredReadbackResolved: 3,
      deferredReadbackSaturated: false,
    },
  );
});

Deno.test("three ascii saturated performance preserves previous frame timing", () => {
  assertEquals(
    createThreeAsciiRendererSaturatedPerformance({
      columns: 10,
      rows: 5,
      terminalGlyphStyle: "mixed",
      frameMs: 3,
      previousFrameMs: 22,
      readbackMs: 6,
      queue: {
        slotCount: 4,
        pending: 4,
        unresolved: 4,
        resolved: 0,
      },
    }),
    {
      columns: 10,
      rows: 5,
      cells: 50,
      terminalGlyphStyle: "mixed",
      totalMs: 22,
      initMs: 0,
      sceneMs: 0,
      sceneUpdateMs: 0,
      sceneRenderMs: 0,
      ansiMs: 0,
      readbackMs: 6,
      assemblyMs: 0,
      deferredReadbackSlots: 4,
      deferredReadbackPending: 4,
      deferredReadbackUnresolved: 4,
      deferredReadbackResolved: 0,
      deferredReadbackSaturated: true,
    },
  );
});

Deno.test("three ascii headless canvas compacts tightly packed and padded mapped rows", () => {
  const tightSource = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
  const tightTarget = new Uint8Array(8);
  const tightResult = compactMappedRgbaRows(tightSource, 1, 2, 4, tightTarget);

  assertEquals(tightResult === tightTarget, true);
  assertEquals(Array.from(tightResult), [1, 2, 3, 4, 5, 6, 7, 8]);

  const padded = new Uint8Array([
    1,
    2,
    3,
    4,
    5,
    6,
    7,
    8,
    99,
    99,
    99,
    99,
    9,
    10,
    11,
    12,
    13,
    14,
    15,
    16,
    88,
    88,
    88,
    88,
  ]);
  assertEquals(Array.from(compactMappedRgbaRows(padded, 2, 2, 12)), [
    1,
    2,
    3,
    4,
    5,
    6,
    7,
    8,
    9,
    10,
    11,
    12,
    13,
    14,
    15,
    16,
  ]);
});

Deno.test("three ascii headless canvas handles empty dimensions without touching target", () => {
  const target = new Uint8Array([7, 8]);
  const result = compactMappedRgbaRows(new Uint8Array([1, 2, 3, 4]), 0, 2, 4, target);

  assertEquals(result === target, true);
  assertEquals(Array.from(result), [7, 8]);
});

Deno.test("three ascii deferred readback staleness resets and gates blocking recovery", () => {
  assertEquals(
    resolveThreeAsciiDeferredReadbackStaleness({
      staleFrames: 3,
      maxStaleFrames: 2,
      completedGrid: true,
      hasCachedGrid: true,
    }),
    { staleFrames: 0, forceBlockingReadback: false },
  );
  assertEquals(
    resolveThreeAsciiDeferredReadbackStaleness({
      staleFrames: 1,
      maxStaleFrames: 0,
      completedGrid: false,
      hasCachedGrid: true,
    }),
    { staleFrames: 1, forceBlockingReadback: false },
  );
  assertEquals(
    resolveThreeAsciiDeferredReadbackStaleness({
      staleFrames: 1,
      maxStaleFrames: 2,
      completedGrid: false,
      hasCachedGrid: false,
    }),
    { staleFrames: 2, forceBlockingReadback: true },
  );
  assertEquals(
    resolveThreeAsciiDeferredReadbackStaleness({
      staleFrames: 1,
      maxStaleFrames: 3,
      completedGrid: false,
      hasCachedGrid: true,
    }),
    { staleFrames: 2, forceBlockingReadback: false },
  );
  assertEquals(
    resolveThreeAsciiDeferredReadbackStaleness({
      staleFrames: 2,
      maxStaleFrames: 3,
      completedGrid: false,
      hasCachedGrid: true,
    }),
    { staleFrames: 3, forceBlockingReadback: true },
  );
});

Deno.test("resolveThreeAsciiDeferredPreSceneFrame is inactive outside ANSI-only deferred mode", () => {
  const base = {
    completed: {},
    staleFrames: 2,
    maxStaleFrames: 3,
    hasCachedGrid: true,
    saturated: true,
  };

  assertEquals(
    resolveThreeAsciiDeferredPreSceneFrame({
      ...base,
      renderAnsi: false,
      renderImage: true,
      readbackStrategy: "deferred",
    }),
    { kind: "inactive", staleFrames: 2, forceBlockingReadback: false },
  );
  assertEquals(
    resolveThreeAsciiDeferredPreSceneFrame({
      ...base,
      renderAnsi: true,
      renderImage: false,
      readbackStrategy: "blocking",
    }),
    { kind: "inactive", staleFrames: 2, forceBlockingReadback: false },
  );
});

Deno.test("resolveThreeAsciiDeferredPreSceneFrame preserves cached grids after unavailable readback", () => {
  assertEquals(
    resolveThreeAsciiDeferredPreSceneFrame({
      renderAnsi: true,
      renderImage: false,
      readbackStrategy: "deferred",
      completed: { grid: [["cached"]], readbackUnavailable: true },
      staleFrames: 2,
      maxStaleFrames: 3,
      hasCachedGrid: true,
      saturated: true,
    }),
    { kind: "readbackUnavailable", staleFrames: 2, forceBlockingReadback: false },
  );
});

Deno.test("resolveThreeAsciiDeferredPreSceneFrame reports saturated queues before scene submission", () => {
  assertEquals(
    resolveThreeAsciiDeferredPreSceneFrame({
      renderAnsi: true,
      renderImage: false,
      readbackStrategy: "deferred",
      completed: {},
      staleFrames: 0,
      maxStaleFrames: 3,
      hasCachedGrid: true,
      saturated: true,
    }),
    { kind: "saturated", staleFrames: 1, forceBlockingReadback: false },
  );
});

Deno.test("resolveThreeAsciiDeferredPreSceneFrame forces blocking after saturated stale cached frames", () => {
  assertEquals(
    resolveThreeAsciiDeferredPreSceneFrame({
      renderAnsi: true,
      renderImage: false,
      readbackStrategy: "deferred",
      completed: {},
      staleFrames: 1,
      maxStaleFrames: 2,
      hasCachedGrid: true,
      pendingReadbacks: 2,
      saturated: true,
    }),
    { kind: "saturated", staleFrames: 2, forceBlockingReadback: true },
  );
});

Deno.test("resolveThreeAsciiDeferredPreSceneFrame forces blocking after saturated uncached startup frames", () => {
  assertEquals(
    resolveThreeAsciiDeferredPreSceneFrame({
      renderAnsi: true,
      renderImage: false,
      readbackStrategy: "deferred",
      completed: {},
      staleFrames: 2,
      maxStaleFrames: 3,
      hasCachedGrid: false,
      pendingReadbacks: 2,
      saturated: true,
    }),
    { kind: "saturated", staleFrames: 3, forceBlockingReadback: true },
  );
});

Deno.test("resolveThreeAsciiDeferredPreSceneFrame forces blocking after stale cached frames", () => {
  assertEquals(
    resolveThreeAsciiDeferredPreSceneFrame({
      renderAnsi: true,
      renderImage: false,
      readbackStrategy: "deferred",
      completed: {},
      staleFrames: 1,
      maxStaleFrames: 2,
      hasCachedGrid: true,
      saturated: false,
    }),
    { kind: "continue", staleFrames: 2, forceBlockingReadback: true },
  );
  assertEquals(
    resolveThreeAsciiDeferredPreSceneFrame({
      renderAnsi: true,
      renderImage: false,
      readbackStrategy: "deferred",
      completed: {},
      staleFrames: 1,
      maxStaleFrames: 2,
      hasCachedGrid: true,
      pendingReadbacks: 1,
      saturated: false,
    }),
    { kind: "continue", staleFrames: 2, forceBlockingReadback: false },
  );
  assertEquals(
    resolveThreeAsciiDeferredPreSceneFrame({
      renderAnsi: true,
      renderImage: false,
      readbackStrategy: "deferred",
      completed: { grid: [["fresh"]] },
      staleFrames: 2,
      maxStaleFrames: 2,
      hasCachedGrid: true,
      saturated: false,
    }),
    { kind: "continue", staleFrames: 0, forceBlockingReadback: false },
  );
});

Deno.test("three ascii deferred readback submission uses cached grids while queuing available slots", () => {
  const cached = [["cached"]];
  const completed = [["completed"]];
  const readback = { id: 1 };

  assertEquals(
    resolveThreeAsciiDeferredReadbackSubmission({ grid: cached, readbackUnavailable: true }, "slot", [["last"]]),
    { grid: cached, submit: false, queue: false },
  );
  assertEquals(
    resolveThreeAsciiDeferredReadbackSubmission({ readbackUnavailable: true }, "slot", [["last"]]),
    { grid: [], submit: false, queue: false },
  );
  assertEquals(
    resolveThreeAsciiDeferredReadbackSubmission({ grid: completed }, undefined, [["last"]]),
    { grid: completed, submit: false, queue: false },
  );
  assertEquals(
    resolveThreeAsciiDeferredReadbackSubmission({}, undefined, [["last"]]),
    { grid: [["last"]], submit: false, queue: false },
  );
  assertEquals(
    resolveThreeAsciiDeferredReadbackSubmission({}, readback, [["last"]]),
    { readback, grid: [["last"]], submit: true, queue: true },
  );
  assertEquals(
    resolveThreeAsciiDeferredReadbackSubmission({ grid: completed }, readback, [["last"]]),
    { readback, grid: completed, submit: true, queue: true },
  );
});

Deno.test("three ascii deferred readback failure preserves cached grids and surfaces cleanup errors", () => {
  const cachedGrid = [["cached"]];
  let destroyed = 0;
  const handled = handleThreeAsciiDeferredReadbackFailure(
    new ThreeAsciiReadbackError(new Error("map rejected")),
    ThreeAsciiReadbackError,
    {
      lastCompletedGrid: () => cachedGrid,
      destroy: () => {
        destroyed += 1;
      },
    },
  );

  assertEquals(handled, {
    handled: true,
    result: { grid: cachedGrid, readbackUnavailable: true },
  });
  assertEquals(destroyed, 1);
  assertEquals(
    handleThreeAsciiDeferredReadbackFailure(new Error("boom"), ThreeAsciiReadbackError, {
      lastCompletedGrid: () => {
        throw new Error("should not read cached grid");
      },
      destroy: () => {
        throw new Error("should not destroy queue");
      },
    }),
    { handled: false },
  );
  assertThrows(
    () =>
      handleThreeAsciiDeferredReadbackFailure(
        new ThreeAsciiReadbackError(new Error("map rejected")),
        ThreeAsciiReadbackError,
        {
          lastCompletedGrid: () => [["cached"]],
          destroy: () => {
            throw new Error("destroy failed");
          },
        },
      ),
    Error,
    "destroy failed",
  );
});

Deno.test("three ascii compute pipeline creates shader module and auto-layout pipeline", () => {
  const device = new FakeComputePipelineDevice();
  const pipeline = createThreeAsciiComputePipeline({
    device,
    label: "deno_tui.three_ascii.fill",
    code: "fn main() {}",
  });

  assertEquals(pipeline, "pipeline:deno_tui.three_ascii.fill" as unknown as GPUComputePipeline);
  assertEquals(device.shaderModules, [
    { label: "deno_tui.three_ascii.fill.wgsl", code: "fn main() {}" },
  ]);
  assertEquals(device.computePipelines, [
    {
      label: "deno_tui.three_ascii.fill",
      layout: "auto",
      module: "shader:deno_tui.three_ascii.fill.wgsl",
      entryPoint: "main",
    },
  ]);
});

Deno.test("three ascii compute pipeline accepts custom entrypoints", () => {
  const device = new FakeComputePipelineDevice();
  createThreeAsciiComputePipeline({
    device,
    label: "custom",
    code: "fn alternate() {}",
    entryPoint: "alternate",
  });

  assertEquals(device.computePipelines[0]?.entryPoint, "alternate");
});

Deno.test("three ascii compute pipeline reuses pipelines by device shader and entrypoint", () => {
  const device = new FakeComputePipelineDevice();
  const first = createThreeAsciiComputePipeline({
    device,
    label: "first",
    code: "fn main() {}",
  });
  const second = createThreeAsciiComputePipeline({
    device,
    label: "second",
    code: "fn main() {}",
  });
  const alternate = createThreeAsciiComputePipeline({
    device,
    label: "alternate",
    code: "fn alternate() {}",
    entryPoint: "alternate",
  });

  assertEquals(second, first);
  assertEquals(device.shaderModules.length, 2);
  assertEquals(device.computePipelines.length, 2);
  assertEquals(alternate, "pipeline:alternate" as unknown as GPUComputePipeline);
});

Deno.test("createThreeAsciiComputeDispatchPlan omits edge pass for block/fill-only modes", () => {
  assertEquals(
    createThreeAsciiComputeDispatchPlan({
      columns: 40,
      rows: 24,
      workgroupSize: 8,
      includeEdges: false,
    }),
    {
      workgroupsX: 5,
      workgroupsY: 3,
      passes: [
        { kind: "fill", label: "deno_tui.three_ascii.fill" },
        { kind: "color", label: "deno_tui.three_ascii.color" },
      ],
    },
  );
});

Deno.test("createThreeAsciiComputeDispatchPlan can emit color-only block passes", () => {
  assertEquals(
    createThreeAsciiComputeDispatchPlan({
      columns: 40,
      rows: 24,
      workgroupSize: 8,
      includeFill: false,
      includeEdges: false,
    }),
    {
      workgroupsX: 5,
      workgroupsY: 3,
      passes: [
        { kind: "color", label: "deno_tui.three_ascii.color" },
      ],
    },
  );
});

Deno.test("createThreeAsciiComputeDispatchPlan includes edge pass between fill and color", () => {
  assertEquals(
    createThreeAsciiComputeDispatchPlan({
      columns: 41,
      rows: 25,
      workgroupSize: 8,
      includeEdges: true,
    }),
    {
      workgroupsX: 6,
      workgroupsY: 4,
      passes: [
        { kind: "fill", label: "deno_tui.three_ascii.fill" },
        { kind: "edge", label: "deno_tui.three_ascii.edge" },
        { kind: "color", label: "deno_tui.three_ascii.color" },
      ],
    },
  );
});

Deno.test("createThreeAsciiComputeDispatchPlan clamps invalid dimensions", () => {
  assertEquals(
    createThreeAsciiComputeDispatchPlan({
      columns: 0,
      rows: -4,
      workgroupSize: 0,
      includeEdges: false,
    }).workgroupsX,
    1,
  );
});

Deno.test("ThreeAsciiComputeDispatchPlanCache reuses stable dispatch plans", () => {
  const cache = new ThreeAsciiComputeDispatchPlanCache();
  const first = cache.resolve({ columns: 40, rows: 24, workgroupSize: 8, includeEdges: false });
  const second = cache.resolve({ columns: 40.9, rows: 24.1, workgroupSize: 8.8, includeEdges: false });
  assertEquals(second === first, true);

  const edge = cache.resolve({ columns: 40, rows: 24, workgroupSize: 8, includeEdges: true });
  assertEquals(edge === first, false);
  assertEquals(edge.passes.map((pass) => pass.kind), ["fill", "edge", "color"]);

  const colorOnly = cache.resolve({ columns: 40, rows: 24, workgroupSize: 8, includeFill: false, includeEdges: false });
  assertEquals(colorOnly === edge, false);
  assertEquals(colorOnly.passes.map((pass) => pass.kind), ["color"]);

  cache.clear();
  const afterClear = cache.resolve({ columns: 40, rows: 24, workgroupSize: 8, includeEdges: true });
  assertEquals(afterClear === edge, false);
  assertEquals(afterClear, edge);
});

Deno.test("createThreeAsciiComputeResourcePlan sizes fill color and edge buffers", () => {
  assertEquals(
    createThreeAsciiComputeResourcePlan({
      columns: 12,
      rows: 8,
      includeFill: true,
      includeEdges: true,
      includeDepthColor: true,
      currentCellCount: 0,
      hasFillOutput: false,
      hasFillBindGroup: false,
      hasEdgeOutput: false,
      hasEdgeBindGroup: false,
      hasDepthColorBindGroup: false,
    }),
    {
      cellCount: 96,
      fillByteLength: 384,
      colorByteLength: 1536,
      edgeByteLength: 1536,
      resizeOutputs: true,
      ensureFillOutput: true,
      releaseFillOutput: false,
      ensureEdgeOutput: true,
      releaseEdgeOutput: false,
      dirty: true,
    },
  );
});

Deno.test("createThreeAsciiComputeResourcePlan keeps stable no-edge resources clean", () => {
  assertEquals(
    createThreeAsciiComputeResourcePlan({
      columns: 10,
      rows: 5,
      includeFill: true,
      includeEdges: false,
      includeDepthColor: false,
      currentCellCount: 50,
      hasFillOutput: true,
      hasFillBindGroup: true,
      hasEdgeOutput: false,
      hasEdgeBindGroup: false,
      hasDepthColorBindGroup: false,
    }).dirty,
    false,
  );
});

Deno.test("createThreeAsciiComputeResourcePlan marks edge release dirty", () => {
  const plan = createThreeAsciiComputeResourcePlan({
    columns: 10,
    rows: 5,
    includeFill: true,
    includeEdges: false,
    includeDepthColor: false,
    currentCellCount: 50,
    hasFillOutput: true,
    hasFillBindGroup: true,
    hasEdgeOutput: true,
    hasEdgeBindGroup: true,
    hasDepthColorBindGroup: false,
  });

  assertEquals(plan.releaseEdgeOutput, true);
  assertEquals(plan.dirty, true);
});

Deno.test("createThreeAsciiComputeResourcePlan marks fill release dirty", () => {
  const plan = createThreeAsciiComputeResourcePlan({
    columns: 10,
    rows: 5,
    includeFill: false,
    includeEdges: false,
    includeDepthColor: false,
    currentCellCount: 50,
    hasFillOutput: true,
    hasFillBindGroup: true,
    hasEdgeOutput: false,
    hasEdgeBindGroup: false,
    hasDepthColorBindGroup: false,
  });

  assertEquals(plan.fillByteLength, 0);
  assertEquals(plan.ensureFillOutput, false);
  assertEquals(plan.releaseFillOutput, true);
  assertEquals(plan.dirty, true);
});

Deno.test("createThreeAsciiComputeResourcePlan marks missing edge bind group dirty", () => {
  const plan = createThreeAsciiComputeResourcePlan({
    columns: 10,
    rows: 5,
    includeFill: true,
    includeEdges: true,
    includeDepthColor: false,
    currentCellCount: 50,
    hasFillOutput: true,
    hasFillBindGroup: true,
    hasEdgeOutput: true,
    hasEdgeBindGroup: false,
    hasDepthColorBindGroup: false,
  });

  assertEquals(plan.resizeOutputs, false);
  assertEquals(plan.ensureEdgeOutput, true);
  assertEquals(plan.dirty, true);
});

Deno.test("createThreeAsciiComputeResourcePlan marks depth color mode switches dirty", () => {
  assertEquals(
    createThreeAsciiComputeResourcePlan({
      columns: 10,
      rows: 5,
      includeFill: true,
      includeEdges: false,
      includeDepthColor: true,
      currentCellCount: 50,
      hasFillOutput: true,
      hasFillBindGroup: true,
      hasEdgeOutput: false,
      hasEdgeBindGroup: false,
      hasDepthColorBindGroup: false,
    }).dirty,
    true,
  );
});

Deno.test("applyThreeAsciiComputeResourcePlanState preserves stable clean resources", () => {
  const plan = createThreeAsciiComputeResourcePlan({
    columns: 10,
    rows: 5,
    includeFill: true,
    includeEdges: false,
    includeDepthColor: false,
    currentCellCount: 50,
    hasFillOutput: true,
    hasFillBindGroup: true,
    hasEdgeOutput: false,
    hasEdgeBindGroup: false,
    hasDepthColorBindGroup: false,
  });

  assertEquals(
    applyThreeAsciiComputeResourcePlanState({ currentCellCount: 50, computeDirty: false }, plan),
    { outputCellCount: 50, computeDirty: false, clearFillBindGroup: false, clearEdgeBindGroup: false },
  );
});

Deno.test("applyThreeAsciiComputeResourcePlanState marks resized outputs dirty", () => {
  const plan = createThreeAsciiComputeResourcePlan({
    columns: 12,
    rows: 8,
    includeFill: true,
    includeEdges: false,
    includeDepthColor: false,
    currentCellCount: 50,
    hasFillOutput: true,
    hasFillBindGroup: true,
    hasEdgeOutput: false,
    hasEdgeBindGroup: false,
    hasDepthColorBindGroup: false,
  });

  assertEquals(
    applyThreeAsciiComputeResourcePlanState({ currentCellCount: 50, computeDirty: false }, plan),
    { outputCellCount: 96, computeDirty: true, clearFillBindGroup: false, clearEdgeBindGroup: false },
  );
});

Deno.test("applyThreeAsciiComputeResourcePlanState clears stale edge bind groups", () => {
  const plan = createThreeAsciiComputeResourcePlan({
    columns: 10,
    rows: 5,
    includeFill: true,
    includeEdges: false,
    includeDepthColor: false,
    currentCellCount: 50,
    hasFillOutput: true,
    hasFillBindGroup: true,
    hasEdgeOutput: true,
    hasEdgeBindGroup: true,
    hasDepthColorBindGroup: false,
  });

  assertEquals(
    applyThreeAsciiComputeResourcePlanState({ currentCellCount: 50, computeDirty: false }, plan),
    { outputCellCount: 50, computeDirty: true, clearFillBindGroup: false, clearEdgeBindGroup: true },
  );
});

Deno.test("encodeThreeAsciiComputeDispatchCommands encodes fill and color passes", () => {
  const encoder = new FakeCommandEncoder();
  const resources = new FakeDispatchResources();
  encodeThreeAsciiComputeDispatchCommands(
    encoder,
    createThreeAsciiComputeDispatchPlan({ columns: 17, rows: 9, workgroupSize: 8, includeEdges: false }),
    resources,
  );

  assertEquals(encoder.records, [
    {
      label: "deno_tui.three_ascii.fill",
      pipeline: "pipeline:fill",
      bindGroup: "bind-group:fill",
      workgroups: [3, 2, 1],
      ended: true,
    },
    {
      label: "deno_tui.three_ascii.color",
      pipeline: "pipeline:color",
      bindGroup: "bind-group:color",
      workgroups: [3, 2, 1],
      ended: true,
    },
  ]);
  assertEquals(resources.pipelineLookups, ["fill", "color"]);
  assertEquals(resources.bindGroupLookups, ["fill", "color"]);
});

Deno.test("encodeThreeAsciiComputeDispatchCommands encodes color-only passes", () => {
  const encoder = new FakeCommandEncoder();
  const resources = new FakeDispatchResources();
  encodeThreeAsciiComputeDispatchCommands(
    encoder,
    createThreeAsciiComputeDispatchPlan({
      columns: 17,
      rows: 9,
      workgroupSize: 8,
      includeFill: false,
      includeEdges: false,
    }),
    resources,
  );

  assertEquals(encoder.records, [
    {
      label: "deno_tui.three_ascii.color",
      pipeline: "pipeline:color",
      bindGroup: "bind-group:color",
      workgroups: [3, 2, 1],
      ended: true,
    },
  ]);
  assertEquals(resources.pipelineLookups, ["color"]);
  assertEquals(resources.bindGroupLookups, ["color"]);
});

Deno.test("encodeThreeAsciiComputeDispatchCommands includes edge pass when planned", () => {
  const encoder = new FakeCommandEncoder();
  const resources = new FakeDispatchResources();
  encodeThreeAsciiComputeDispatchCommands(
    encoder,
    createThreeAsciiComputeDispatchPlan({ columns: 8, rows: 8, workgroupSize: 8, includeEdges: true }),
    resources,
  );

  assertEquals(encoder.records.map((record) => record.label), [
    "deno_tui.three_ascii.fill",
    "deno_tui.three_ascii.edge",
    "deno_tui.three_ascii.color",
  ]);
  assertEquals(encoder.records.map((record) => record.workgroups), [
    [1, 1, 1],
    [1, 1, 1],
    [1, 1, 1],
  ]);
});

Deno.test("createThreeAsciiComputeBindGroups creates fill and color bindings without edges", () => {
  const device = new FakeBindGroupDevice();
  const groups = createThreeAsciiComputeBindGroups({
    device,
    paramsBuffer: fakeBuffer("params"),
    fillPipeline: fakePipeline("fill-layout"),
    colorPipeline: fakePipeline("color-layout"),
    fillOutput: fakeBuffer("fill"),
    colorOutput: fakeBuffer("color"),
    downscaleTexture: fakeTexture("downscale"),
    includeEdges: false,
    colorUsesDepthTexture: false,
  });

  assertEquals(groups.fillBindGroup, "deno_tui.three_ascii.fill.bindings" as unknown as GPUBindGroup);
  assertEquals(groups.edgeBindGroup, undefined);
  assertEquals(groups.colorBindGroup, "deno_tui.three_ascii.color.bindings" as unknown as GPUBindGroup);
  assertEquals(device.labels(), [
    "deno_tui.three_ascii.fill.bindings",
    "deno_tui.three_ascii.color.bindings",
  ]);
  assertEquals(device.created[0]?.entries.map((entry) => entry.binding), [0, 1, 2]);
  assertEquals(device.created[1]?.entries.map((entry) => entry.binding), [0, 1, 2]);
});

Deno.test("createThreeAsciiComputeBindGroups can create color-only bindings", () => {
  const device = new FakeBindGroupDevice();
  const groups = createThreeAsciiComputeBindGroups({
    device,
    paramsBuffer: fakeBuffer("params"),
    colorPipeline: fakePipeline("color-layout"),
    colorOutput: fakeBuffer("color"),
    downscaleTexture: fakeTexture("downscale"),
    includeFill: false,
    includeEdges: false,
    colorUsesDepthTexture: false,
  });

  assertEquals(groups.fillBindGroup, undefined);
  assertEquals(groups.edgeBindGroup, undefined);
  assertEquals(groups.colorBindGroup, "deno_tui.three_ascii.color.bindings" as unknown as GPUBindGroup);
  assertEquals(device.labels(), ["deno_tui.three_ascii.color.bindings"]);
  assertEquals(device.created[0]?.entries.map((entry) => entry.binding), [0, 1, 2]);
});

Deno.test("createThreeAsciiComputeBindGroups rejects missing requested fill resources", () => {
  assertThrows(
    () =>
      createThreeAsciiComputeBindGroups({
        device: new FakeBindGroupDevice(),
        paramsBuffer: fakeBuffer("params"),
        colorPipeline: fakePipeline("color-layout"),
        colorOutput: fakeBuffer("color"),
        downscaleTexture: fakeTexture("downscale"),
        includeFill: true,
        includeEdges: false,
        colorUsesDepthTexture: false,
      }),
    Error,
    "fill compute resources",
  );
});

Deno.test("createThreeAsciiComputeBindGroups creates edge bindings when requested", () => {
  const device = new FakeBindGroupDevice();
  const groups = createThreeAsciiComputeBindGroups({
    device,
    paramsBuffer: fakeBuffer("params"),
    fillPipeline: fakePipeline("fill-layout"),
    edgePipeline: fakePipeline("edge-layout"),
    colorPipeline: fakePipeline("color-layout"),
    fillOutput: fakeBuffer("fill"),
    edgeOutput: fakeBuffer("edge"),
    colorOutput: fakeBuffer("color"),
    downscaleTexture: fakeTexture("downscale"),
    sobelTexture: fakeTexture("sobel"),
    includeEdges: true,
    colorUsesDepthTexture: false,
  });

  assertEquals(groups.edgeBindGroup, "deno_tui.three_ascii.edge.bindings" as unknown as GPUBindGroup);
  assertEquals(device.labels(), [
    "deno_tui.three_ascii.fill.bindings",
    "deno_tui.three_ascii.edge.bindings",
    "deno_tui.three_ascii.color.bindings",
  ]);
});

Deno.test("createThreeAsciiComputeBindGroups rejects incomplete edge resources", () => {
  assertThrows(
    () =>
      createThreeAsciiComputeBindGroups({
        device: new FakeBindGroupDevice(),
        paramsBuffer: fakeBuffer("params"),
        fillPipeline: fakePipeline("fill-layout"),
        colorPipeline: fakePipeline("color-layout"),
        fillOutput: fakeBuffer("fill"),
        colorOutput: fakeBuffer("color"),
        downscaleTexture: fakeTexture("downscale"),
        includeEdges: true,
        colorUsesDepthTexture: false,
      }),
    Error,
    "edge compute resources",
  );
});

Deno.test("createThreeAsciiComputeBindGroups binds normals only for depth color", () => {
  const device = new FakeBindGroupDevice();
  createThreeAsciiComputeBindGroups({
    device,
    paramsBuffer: fakeBuffer("params"),
    fillPipeline: fakePipeline("fill-layout"),
    colorPipeline: fakePipeline("color-layout"),
    fillOutput: fakeBuffer("fill"),
    colorOutput: fakeBuffer("color"),
    downscaleTexture: fakeTexture("downscale"),
    normalsTexture: fakeTexture("normals"),
    includeEdges: false,
    colorUsesDepthTexture: true,
  });

  assertEquals(device.created[1]?.entries.map((entry) => entry.binding), [0, 1, 2, 3]);
});

Deno.test("createThreeAsciiComputeBindGroups rejects missing depth color resources", () => {
  assertThrows(
    () =>
      createThreeAsciiComputeBindGroups({
        device: new FakeBindGroupDevice(),
        paramsBuffer: fakeBuffer("params"),
        fillPipeline: fakePipeline("fill-layout"),
        colorPipeline: fakePipeline("color-layout"),
        fillOutput: fakeBuffer("fill"),
        colorOutput: fakeBuffer("color"),
        downscaleTexture: fakeTexture("downscale"),
        includeEdges: false,
        colorUsesDepthTexture: true,
      }),
    Error,
    "depth color resources",
  );
});

class FakeGpuBuffer implements ThreeAsciiGpuBuffer {
  destroyed = false;

  constructor(readonly label: string, readonly size: number, readonly usage: number) {}

  destroy(): void {
    this.destroyed = true;
  }
}

class FakeGpuBufferDevice implements ThreeAsciiGpuBufferDevice<FakeGpuBuffer> {
  readonly buffers: FakeGpuBuffer[] = [];

  createBuffer(options: { label: string; size: number; usage: number }): FakeGpuBuffer {
    const buffer = new FakeGpuBuffer(options.label, options.size, options.usage);
    this.buffers.push(buffer);
    return buffer;
  }
}

interface FakeShaderModuleDescriptor {
  label?: string;
  code: string;
}

interface FakeComputePipelineDescriptor {
  label?: string;
  layout: string;
  module: string;
  entryPoint?: string;
}

class FakeComputePipelineDevice {
  readonly shaderModules: FakeShaderModuleDescriptor[] = [];
  readonly computePipelines: FakeComputePipelineDescriptor[] = [];

  createShaderModule(descriptor: GPUShaderModuleDescriptor): GPUShaderModule {
    this.shaderModules.push({ label: String(descriptor.label), code: descriptor.code });
    return `shader:${String(descriptor.label)}` as unknown as GPUShaderModule;
  }

  createComputePipeline(descriptor: GPUComputePipelineDescriptor): GPUComputePipeline {
    this.computePipelines.push({
      label: String(descriptor.label),
      layout: descriptor.layout as string,
      module: descriptor.compute.module as unknown as string,
      entryPoint: descriptor.compute.entryPoint,
    });
    return `pipeline:${String(descriptor.label)}` as unknown as GPUComputePipeline;
  }
}

interface ComputePassRecord {
  label: string;
  pipeline?: string;
  bindGroup?: string;
  workgroups?: [number, number, number];
  ended: boolean;
}

class FakeCommandEncoder {
  readonly records: ComputePassRecord[] = [];

  beginComputePass(descriptor: GPUComputePassDescriptor): GPUComputePassEncoder {
    const record: ComputePassRecord = { label: String(descriptor.label), ended: false };
    this.records.push(record);
    return {
      setPipeline: (pipeline: GPUComputePipeline) => {
        record.pipeline = String(pipeline);
      },
      setBindGroup: (_index: number, bindGroup: GPUBindGroup) => {
        record.bindGroup = String(bindGroup);
      },
      dispatchWorkgroups: (x: number, y: number, z: number) => {
        record.workgroups = [x, y, z];
      },
      end: () => {
        record.ended = true;
      },
    } as unknown as GPUComputePassEncoder;
  }
}

class FakeDispatchResources {
  readonly pipelineLookups: string[] = [];
  readonly bindGroupLookups: string[] = [];

  pipelineForPass(kind: "fill" | "edge" | "color"): GPUComputePipeline {
    this.pipelineLookups.push(kind);
    return `pipeline:${kind}` as unknown as GPUComputePipeline;
  }

  bindGroupForPass(kind: "fill" | "edge" | "color"): GPUBindGroup {
    this.bindGroupLookups.push(kind);
    return `bind-group:${kind}` as unknown as GPUBindGroup;
  }
}

class FakeBindGroupDevice {
  readonly created: GPUBindGroupDescriptor[] = [];

  createBindGroup(descriptor: GPUBindGroupDescriptor): GPUBindGroup {
    this.created.push(descriptor);
    return descriptor.label as unknown as GPUBindGroup;
  }

  labels(): string[] {
    return this.created.map((descriptor) => String(descriptor.label));
  }
}

function fakePipeline(layout: string): Pick<GPUComputePipeline, "getBindGroupLayout"> {
  return {
    getBindGroupLayout: () => layout as unknown as GPUBindGroupLayout,
  };
}

function fakeTexture(label: string): Pick<GPUTexture, "createView"> {
  return {
    createView: () => `${label}-view` as unknown as GPUTextureView,
  };
}

function fakeBuffer(label: string): GPUBuffer {
  return label as unknown as GPUBuffer;
}
