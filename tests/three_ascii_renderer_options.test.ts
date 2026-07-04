import { assertEquals } from "./deps.ts";
import {
  DEFAULT_THREE_ASCII_DEFERRED_READBACK_MAX_STALE_FRAMES,
  DEFAULT_THREE_ASCII_DEFERRED_READBACK_SLOTS,
  DEFAULT_THREE_ASCII_PIXEL_ASPECT_RATIO,
  DEFAULT_THREE_ASCII_TERMINAL_EDGE_BIAS,
  normalizeThreeAsciiRendererOptions,
  normalizeThreeAsciiRenderSize,
  normalizeThreeAsciiTerminalEdgeBias,
} from "../src/three_ascii/renderer_options.ts";

Deno.test("normalizeThreeAsciiRenderSize floors positive sizes and clamps to one cell", () => {
  assertEquals(normalizeThreeAsciiRenderSize(12.9, 4.2), { columns: 12, rows: 4 });
  assertEquals(normalizeThreeAsciiRenderSize(0, -10), { columns: 1, rows: 1 });
});

Deno.test("normalizeThreeAsciiTerminalEdgeBias preserves configured bias above minimum", () => {
  assertEquals(normalizeThreeAsciiTerminalEdgeBias(), DEFAULT_THREE_ASCII_TERMINAL_EDGE_BIAS);
  assertEquals(normalizeThreeAsciiTerminalEdgeBias(0.25), 0.5);
  assertEquals(normalizeThreeAsciiTerminalEdgeBias(2.25), 2.25);
});

Deno.test("normalizeThreeAsciiRendererOptions fills renderer defaults", () => {
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

Deno.test("normalizeThreeAsciiRendererOptions preserves explicit renderer choices", () => {
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
});

Deno.test("normalizeThreeAsciiRendererOptions clamps deferred stale fallback frames", () => {
  assertEquals(
    normalizeThreeAsciiRendererOptions({
      columns: 5,
      rows: 6,
      deferredReadbackMaxStaleFrames: -2,
    }).deferredReadbackMaxStaleFrames,
    0,
  );
});
