// Copyright 2023 Im-Beast. MIT license.
import { Color } from "npm:three@0.183.2";

import { assertEquals, assertNotStrictEquals, assertStrictEquals, assertStringIncludes } from "./deps.ts";
import { ThreeAsciiAnsiBackgroundState } from "../src/three_ascii/ansi_background.ts";
import { ThreeAsciiAnsiColorKeyCache } from "../src/three_ascii/ansi_color_cache.ts";
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
  computeThreeAsciiCameraAspect,
  shouldUpdateThreeAsciiCameraAspect,
  THREE_ASCII_CAMERA_ASPECT_EPSILON,
} from "../src/three_ascii/camera_aspect.ts";
import {
  colorToBytes,
  colorValue,
  createLinearByteCache,
  linearUnitToByte,
  rgbToAnsiBackground,
  rgbToAnsiForeground,
} from "../src/three_ascii/colors.ts";
import { resolveThreeAsciiComputeMode } from "../src/three_ascii/compute_mode.ts";
import {
  emptyThreeAsciiRenderFrame,
  resolveThreeAsciiRenderFrameSelection,
  resolveThreeAsciiRenderFrameSelectionInto,
  THREE_ASCII_ANSI_FRAME_OPTIONS,
  THREE_ASCII_IMAGE_FRAME_OPTIONS,
} from "../src/three_ascii/frame_options.ts";
import { readThreeAsciiImageFrame } from "../src/three_ascii/image_frame.ts";
import { loadAsciiLutTextures } from "../src/three_ascii/loadAsciiLuts.ts";
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
  THREE_ASCII_COLOR_SHADER,
  THREE_ASCII_EDGE_SHADER,
  THREE_ASCII_FILL_SHADER,
  THREE_ASCII_FLAT_COLOR_SHADER,
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
