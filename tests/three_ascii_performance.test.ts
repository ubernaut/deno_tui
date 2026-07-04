import { assertEquals } from "./deps.ts";
import {
  createThreeAsciiRendererPerformance,
  createThreeAsciiRendererSaturatedPerformance,
} from "../src/three_ascii/performance.ts";

Deno.test("createThreeAsciiRendererPerformance projects frame and queue timings", () => {
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

Deno.test("createThreeAsciiRendererSaturatedPerformance preserves previous frame timing", () => {
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
