import { assertEquals } from "./deps.ts";
import {
  threePanelAdaptiveRenderCellsDiagnostic,
  threePanelGraphicsFallbackDiagnostic,
  threePanelGraphicsFallbackReason,
  threePanelSlowFrameDiagnostic,
} from "../app/three_panel_diagnostics.ts";

Deno.test("threePanelSlowFrameDiagnostic formats renderer timings and readback queue state", () => {
  const diagnostic = threePanelSlowFrameDiagnostic({
    columns: 24,
    rows: 10,
    cells: 240,
    terminalGlyphStyle: "blocks",
    totalMs: 123.45,
    initMs: 15.12,
    sceneMs: 70.12,
    sceneUpdateMs: 12.34,
    sceneRenderMs: 57.78,
    ansiMs: 30.34,
    readbackMs: 20.56,
    assemblyMs: 9.87,
    deferredReadbackSlots: 6,
    deferredReadbackPending: 4,
    deferredReadbackUnresolved: 2,
    deferredReadbackSaturated: false,
  });

  assertEquals(diagnostic.source, "three-panel");
  assertEquals(diagnostic.code, "three-ascii-slow-frame");
  assertEquals(diagnostic.message, "Three ASCII frame 123.5ms at 24x10");
  assertEquals(
    diagnostic.detail,
    "init 15.1ms, scene 70.1ms, update 12.3ms, render 57.8ms, ansi 30.3ms, readback 20.6ms, assembly 9.9ms, queue 2/6",
  );
  assertEquals(diagnostic.context, {
    columns: 24,
    rows: 10,
    cells: 240,
    glyphStyle: "blocks",
    totalMs: 123.5,
    initMs: 15.1,
    sceneMs: 70.1,
    sceneUpdateMs: 12.3,
    sceneRenderMs: 57.8,
    ansiMs: 30.3,
    readbackMs: 20.6,
    assemblyMs: 9.9,
    deferredReadbackSlots: 6,
    deferredReadbackPending: 4,
    deferredReadbackUnresolved: 2,
    deferredReadbackSaturated: false,
  });
});

Deno.test("threePanelAdaptiveRenderCellsDiagnostic formats direction and rounded frame timing", () => {
  assertEquals(
    threePanelAdaptiveRenderCellsDiagnostic({
      direction: "down",
      maxCells: 480,
      requestedMaxCells: 960,
      frameMs: 81.26,
      targetMs: 55.55,
    }),
    {
      source: "three-panel",
      code: "three-ascii-adaptive-render-cells",
      severity: "debug",
      message: "Three ASCII render budget reduced to 480 cells.",
      detail: "frame 81.3ms, target 55.5ms",
      context: {
        direction: "down",
        maxCells: 480,
        requestedMaxCells: 960,
        frameMs: 81.3,
        targetMs: 55.6,
      },
    },
  );
});

Deno.test("threePanelGraphicsFallbackReason classifies unavailable image surfaces", () => {
  assertEquals(
    threePanelGraphicsFallbackReason({
      rect: { width: 4, height: 2 },
      rendererSupportsImage: true,
    }),
    "missing-surface",
  );
  assertEquals(
    threePanelGraphicsFallbackReason({
      inspection: {
        kind: "kitty",
        available: false,
        reason: "tmux passthrough disabled",
        handles: [],
        commandCount: 0,
      },
      rect: { width: 4, height: 2 },
      rendererSupportsImage: true,
    }),
    "tmux passthrough disabled",
  );
  assertEquals(
    threePanelGraphicsFallbackReason({
      inspection: { kind: "kitty", available: true, handles: [], commandCount: 0 },
      rect: { width: 0, height: 2 },
      rendererSupportsImage: true,
    }),
    "empty-graphics-rectangle",
  );
  assertEquals(
    threePanelGraphicsFallbackReason({
      inspection: { kind: "kitty", available: true, handles: [], commandCount: 0 },
      rect: { width: 4, height: 2 },
      rendererSupportsImage: false,
    }),
    "renderer-image-frame-unsupported",
  );
});

Deno.test("threePanelGraphicsFallbackDiagnostic includes ascii fallback context", () => {
  assertEquals(
    threePanelGraphicsFallbackDiagnostic({
      inspection: {
        kind: "kitty",
        available: false,
        reason: "raster graphics surface is unavailable",
        handles: [],
        commandCount: 0,
      },
      rect: { width: 8, height: 4 },
      rendererSupportsImage: true,
      kittyDisableAscii: true,
    }),
    {
      source: "three-panel",
      code: "kitty-graphics-fallback",
      severity: "warning",
      message: "Kitty graphics requested but unavailable; rendering ASCII fallback.",
      detail: "raster graphics surface is unavailable",
      context: {
        reason: "raster graphics surface is unavailable",
        surface: "kitty",
        available: false,
        asciiFallback: true,
        kittyDisableAscii: true,
      },
    },
  );
});
