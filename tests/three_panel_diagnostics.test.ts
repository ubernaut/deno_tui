import { assertEquals } from "./deps.ts";
import {
  threePanelAdaptiveRenderCellsDiagnostic,
  threePanelSlowFrameDiagnostic,
} from "../app/three_panel_diagnostics.ts";

Deno.test("threePanelSlowFrameDiagnostic formats renderer timings and readback queue state", () => {
  const diagnostic = threePanelSlowFrameDiagnostic({
    columns: 24,
    rows: 10,
    cells: 240,
    terminalGlyphStyle: "blocks",
    totalMs: 123.45,
    sceneMs: 70.12,
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
  assertEquals(diagnostic.detail, "scene 70.1ms, ansi 30.3ms, readback 20.6ms, assembly 9.9ms, queue 2/6");
  assertEquals(diagnostic.context, {
    columns: 24,
    rows: 10,
    cells: 240,
    glyphStyle: "blocks",
    totalMs: 123.5,
    sceneMs: 70.1,
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
