import { assertEquals, assertStringIncludes } from "./deps.ts";
import {
  formatThreePanelProbeLines,
  summarizeThreePanelProbe,
  type ThreePanelProbeSample,
} from "../src/three_ascii/panel_probe.ts";

const samples: ThreePanelProbeSample[] = [
  {
    index: 1,
    elapsedMs: 500,
    totalMs: 2,
    sceneMs: 0,
    readbackMs: 0,
    assemblyMs: 0,
    columns: 0,
    rows: 0,
    cells: 480,
    updates: 2,
    deferredPending: 2,
    deferredUnresolved: 2,
    deferredResolved: 0,
    deferredSaturated: true,
    lifecycle: "initializing",
  },
  {
    index: 2,
    elapsedMs: 56,
    totalMs: 10,
    sceneMs: 8,
    readbackMs: 11,
    assemblyMs: 0.5,
    columns: 40,
    rows: 12,
    cells: 480,
    updates: 3,
    deferredPending: 1,
    deferredUnresolved: 1,
    deferredResolved: 0,
    deferredSaturated: false,
    lifecycle: "idle",
  },
  {
    index: 3,
    elapsedMs: 56,
    totalMs: 14,
    sceneMs: 12,
    readbackMs: 13,
    assemblyMs: 0.7,
    columns: 40,
    rows: 12,
    cells: 480,
    updates: 4,
    deferredPending: 2,
    deferredUnresolved: 1,
    deferredResolved: 1,
    deferredSaturated: false,
    lifecycle: "idle",
  },
];

Deno.test("summarizeThreePanelProbe skips startup samples for steady timing", () => {
  const summary = summarizeThreePanelProbe(samples);

  assertEquals(summary.first?.index, 1);
  assertEquals(summary.latest?.index, 3);
  assertEquals(summary.steady.map((sample) => sample.index), [2, 3]);
  assertEquals(summary.averageTotalMs, 12);
  assertEquals(summary.averageSceneMs, 10);
  assertEquals(summary.averageReadbackMs, 12);
  assertEquals(summary.averageAssemblyMs, 0.6);
});

Deno.test("formatThreePanelProbeLines includes first-grid latency and frame rows", () => {
  const lines = formatThreePanelProbeLines(
    {
      mode: "studio",
      glyphs: "blocks",
      readback: "blocking",
      width: 80,
      height: 24,
      maxCells: 480,
      intervalMs: 1000 / 18,
    },
    samples,
    420.25,
  );

  assertEquals(lines[0], "three-panel live probe");
  assertStringIncludes(lines[1], "readback=blocking");
  assertStringIncludes(lines[1], "rect=80x24");
  assertStringIncludes(lines[2], "steady=12.00ms");
  assertStringIncludes(lines[2], "latest=40x12/480c");
  assertStringIncludes(lines[2], "firstGrid=420.25ms");
  assertStringIncludes(lines[3], "updates=4");
  assertStringIncludes(lines[3], "queue=2/1/1");
  assertStringIncludes(lines.at(-1)!, "03 total=14.00ms");
  assertStringIncludes(lines[4], "queue=2/2/0 saturated");
  assertStringIncludes(lines.at(-1)!, "state=idle");
});
