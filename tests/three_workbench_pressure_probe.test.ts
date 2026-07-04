import { assertEquals, assertStringIncludes } from "./deps.ts";
import {
  countWorkbenchThreeProbeChangedGridRows,
  formatWorkbenchThreePressureProbeLines,
  formatWorkbenchThreePressureProbeSummaryLines,
  parseWorkbenchThreePressureProbeCliOptions,
  snapshotWorkbenchThreeProbeGridRows,
  snapshotWorkbenchThreeProbeGridRowsInto,
  summarizeWorkbenchThreePressureProbe,
  validateWorkbenchThreePressureProbe,
  validateWorkbenchThreePressureProbeSummary,
  type WorkbenchThreePressureProbeSample,
} from "../src/three_ascii/workbench_pressure_probe.ts";

Deno.test("summarizeWorkbenchThreePressureProbe excludes placeholder and startup samples", () => {
  const samples: WorkbenchThreePressureProbeSample[] = [
    sample({ index: 1, rendererMs: 0, rows: 8, columns: 26, cells: 208 }),
    sample({ index: 2, rendererMs: 1680, rows: 8, columns: 26, cells: 208 }),
    sample({ index: 3, rendererMs: 0.8, flushMs: 0.03, bytes: 45, changedRows: 1, sourceChangedRows: 8 }),
    sample({ index: 4, rendererMs: 1.2, flushMs: 0.05, bytes: 55, changedRows: 3, sourceChangedRows: 4 }),
  ];

  const summary = summarizeWorkbenchThreePressureProbe(samples);

  assertEquals(summary.warmup?.index, 2);
  assertEquals(summary.latest?.index, 4);
  assertEquals(summary.steady.map((entry) => entry.index), [3, 4]);
  assertEquals(summary.averageRendererMs, 1);
  assertEquals(summary.averageFlushMs, 0.04);
  assertEquals(summary.averageBytes, 50);
  assertEquals(summary.averageByteRate, 1000);
  assertEquals(summary.averageChangedRows, 2);
  assertEquals(summary.averageSourceChangedRows, 6);
  assertEquals(summary.averageObservedFps, 0);
});

Deno.test("summarizeWorkbenchThreePressureProbe reports empty steady metrics without valid renderer frames", () => {
  const summary = summarizeWorkbenchThreePressureProbe([
    sample({ index: 1, rendererMs: 0, rows: 0, columns: 0, cells: 0 }),
  ]);

  assertEquals(summary.warmup, undefined);
  assertEquals(summary.latest?.index, 1);
  assertEquals(summary.steady, []);
  assertEquals(summary.averageRendererMs, 0);
  assertEquals(summary.averageFlushMs, 0);
  assertEquals(summary.averageBytes, 0);
  assertEquals(summary.averageByteRate, 0);
  assertEquals(summary.averageChangedRows, 0);
  assertEquals(summary.averageSourceChangedRows, 0);
  assertEquals(summary.averageObservedFps, 0);
});

Deno.test("workbench Three probe grid snapshots preserve mutable renderer frame history", () => {
  const grid = [
    ["a", "b"],
    ["c", "d"],
  ];
  const snapshot = snapshotWorkbenchThreeProbeGridRows(grid);

  grid[0]![1] = "B";
  grid.push(["e"]);

  assertEquals(snapshot, [["a", "b"], ["c", "d"]]);
  assertEquals(countWorkbenchThreeProbeChangedGridRows(snapshot, grid), 2);
});

Deno.test("workbench Three probe grid snapshots can reuse caller-owned rows", () => {
  const target = [["stale", "row"], ["keep"]];
  const firstRow = target[0]!;
  const secondRow = target[1]!;
  const snapshot = snapshotWorkbenchThreeProbeGridRowsInto(target, [["a"], undefined, ["c", "d"]]);

  assertEquals(snapshot, [["a"], [], ["c", "d"]]);
  assertEquals(snapshot, target);
  assertEquals(snapshot[0], firstRow);
  assertEquals(snapshot[1], secondRow);

  const next = snapshotWorkbenchThreeProbeGridRowsInto(target, [["x", "y"]]);
  assertEquals(next, [["x", "y"]]);
  assertEquals(next[0], firstRow);
});

Deno.test("workbench Three probe changed-row counter handles equal sparse and resized grids", () => {
  assertEquals(
    countWorkbenchThreeProbeChangedGridRows(
      [["a"], undefined, ["c"]],
      [["a"], [], ["C"], ["d"]],
    ),
    2,
  );
});

Deno.test("validateWorkbenchThreePressureProbe accepts real changing renderer frames", () => {
  const samples = [
    sample({ index: 1, rendererMs: 0, rows: 8, columns: 26, cells: 208, gridUpdates: 1 }),
    sample({ index: 2, rendererMs: 5, rows: 8, columns: 26, cells: 208, gridUpdates: 2 }),
    sample({ index: 3, rendererMs: 4, rows: 8, columns: 26, cells: 208, sourceChangedRows: 5, gridUpdates: 3 }),
    sample({ index: 4, rendererMs: 4, rows: 8, columns: 26, cells: 208, sourceChangedRows: 3, gridUpdates: 4 }),
  ];
  const options = {
    minSteadyFrames: 2,
    minGridUpdates: 3,
    minAverageSourceChangedRows: 1,
  };
  const result = validateWorkbenchThreePressureProbe(samples, options);

  assertEquals(result, { ok: true, errors: [] });
  assertEquals(
    validateWorkbenchThreePressureProbeSummary(summarizeWorkbenchThreePressureProbe(samples), options),
    result,
  );
});

Deno.test("validateWorkbenchThreePressureProbe rejects cached grids without renderer telemetry", () => {
  const result = validateWorkbenchThreePressureProbe([
    sample({ index: 1, rendererMs: 0, rows: 8, columns: 26, cells: 208, sourceChangedRows: 2, gridUpdates: 1 }),
    sample({ index: 2, rendererMs: 0, rows: 8, columns: 26, cells: 208, sourceChangedRows: 0, gridUpdates: 4 }),
  ], {
    minSteadyFrames: 2,
    minGridUpdates: 2,
    minAverageSourceChangedRows: 1,
  });

  assertEquals(result.ok, false);
  assertEquals(result.errors, [
    "no valid renderer frame was observed",
    "steady renderer frames 0 < 2",
    "average source-changed rows 0.0 < 1",
  ]);
});

Deno.test("formatWorkbenchThreePressureProbeLines reports source changes and update counts", () => {
  const options = {
    mode: "studio",
    glyphs: "blocks",
    readback: "deferred",
    frameWidth: 168,
    frameHeight: 54,
    panelWidth: 96,
    panelHeight: 32,
    maxCells: 960,
    intervalMs: 50,
    totalBytes: 12345,
  };
  const samples = [
    sample({ index: 1, rendererMs: 0, rows: 17, columns: 53, cells: 901, sourceChangedRows: 17, gridUpdates: 1 }),
    sample({ index: 2, rendererMs: 1000, rows: 17, columns: 53, cells: 901, sourceChangedRows: 0, gridUpdates: 1 }),
    sample({
      index: 3,
      rendererMs: 12,
      sceneUpdateMs: 3,
      sceneRenderMs: 7,
      rows: 17,
      columns: 53,
      cells: 901,
      bytes: 20,
      sampleDurationMs: 100,
      observedFps: 12.5,
      observedFrameCount: 2,
      sourceChangedRows: 16,
      gridUpdates: 2,
    }),
  ];
  const lines = formatWorkbenchThreePressureProbeLines(options, samples);
  assertEquals(
    formatWorkbenchThreePressureProbeSummaryLines(options, samples, summarizeWorkbenchThreePressureProbe(samples)),
    lines,
  );

  assertEquals(lines[0], "three-workbench pressure probe");
  assertStringIncludes(lines[1], "mode=studio glyphs=blocks readback=deferred");
  assertStringIncludes(lines[1], "frame=168x54 panel=96x32 maxCells=960 interval=50.00ms");
  assertStringIncludes(lines[2], "renderer=12.00ms");
  assertStringIncludes(lines[2], "observed=12.5fps");
  assertStringIncludes(lines[2], "rate=200B/s");
  assertStringIncludes(lines[2], "sourceRows=16.0");
  assertStringIncludes(lines[2], "updates=2");
  assertStringIncludes(lines[2], "latest=53x17/901c");
  assertStringIncludes(lines[2], "totalBytes=12345");
  assertStringIncludes(lines[5], "03 renderer=12.00ms init=0.00ms");
  assertStringIncludes(lines[5], "update=3.00ms render=7.00ms");
  assertStringIncludes(lines[5], "bytes=20 rate=200B/s");
  assertStringIncludes(lines[5], "sourceChanged=16 cap=960 interval=100.00ms observed=12.5fps observedFrames=2");
  assertStringIncludes(lines[5], "updates=2 grid=53x17");
});

Deno.test("parseWorkbenchThreePressureProbeCliOptions separates pressure and saved ASCII cell budgets", () => {
  const options = parseWorkbenchThreePressureProbeCliOptions(
    [
      "--frames",
      "40",
      "--max-cells",
      "120",
      "--ascii-cells",
      "1920",
      "--mode",
      "relay",
      "--glyphs",
      "mixed",
      "--readback",
      "deferred",
      "--adaptive",
      "--check",
      "--min-steady-frames",
      "5",
      "--min-grid-updates=7",
      "--min-source-rows",
      "2",
    ],
    probeDefaults(),
  );

  assertEquals(options.frames, 40);
  assertEquals(options.maxCells, 120);
  assertEquals(options.asciiCells, 1920);
  assertEquals(options.mode, "relay");
  assertEquals(options.glyphs, "mixed");
  assertEquals(options.readbackStrategy, "deferred");
  assertEquals(options.adaptive, true);
  assertEquals(options.check, true);
  assertEquals(options.minSteadyFrames, 5);
  assertEquals(options.minGridUpdates, 7);
  assertEquals(options.minAverageSourceChangedRows, 2);
  assertEquals(options.intervalMs, 33);
});

Deno.test("parseWorkbenchThreePressureProbeCliOptions falls back to pressure cells for ASCII cells", () => {
  const options = parseWorkbenchThreePressureProbeCliOptions(["--max-cells=240", "--interval", "50"], probeDefaults());

  assertEquals(options.maxCells, 240);
  assertEquals(options.asciiCells, 240);
  assertEquals(options.intervalMs, 50);
});

function sample(
  overrides: Partial<WorkbenchThreePressureProbeSample> & Pick<WorkbenchThreePressureProbeSample, "index">,
): WorkbenchThreePressureProbeSample {
  return {
    index: overrides.index,
    maxCells: overrides.maxCells ?? 960,
    sampleDurationMs: overrides.sampleDurationMs ?? 50,
    rendererMs: overrides.rendererMs ?? 1,
    initMs: overrides.initMs ?? 0,
    sceneMs: overrides.sceneMs ?? 0.5,
    sceneUpdateMs: overrides.sceneUpdateMs,
    sceneRenderMs: overrides.sceneRenderMs,
    readbackMs: overrides.readbackMs ?? 0.1,
    assemblyMs: overrides.assemblyMs ?? 0.05,
    flushMs: overrides.flushMs ?? 0.01,
    bytes: overrides.bytes ?? 10,
    changedRows: overrides.changedRows ?? 1,
    sourceChangedRows: overrides.sourceChangedRows ?? 1,
    observedFps: overrides.observedFps,
    observedFrameCount: overrides.observedFrameCount,
    gridUpdates: overrides.gridUpdates ?? 1,
    columns: overrides.columns ?? 26,
    rows: overrides.rows ?? 8,
    cells: overrides.cells ?? 208,
  };
}

function probeDefaults() {
  return {
    initialCells: 120,
    readbackStrategy: "blocking" as const,
    mode: "studio",
    modes: ["studio", "relay"] as const,
    frameIntervalForCells: (cells: number) => cells === 120 ? 33 : 66,
  };
}
