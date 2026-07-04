import { assertEquals } from "./deps.ts";
import {
  summarizeWorkbenchThreePressureProbe,
  type WorkbenchThreePressureProbeSample,
} from "../src/three_ascii/workbench_pressure_probe.ts";

Deno.test("summarizeWorkbenchThreePressureProbe excludes placeholder and startup samples", () => {
  const samples: WorkbenchThreePressureProbeSample[] = [
    sample({ index: 1, rendererMs: 0, rows: 8, columns: 26, cells: 208 }),
    sample({ index: 2, rendererMs: 1680, rows: 8, columns: 26, cells: 208 }),
    sample({ index: 3, rendererMs: 0.8, flushMs: 0.03, bytes: 45, changedRows: 1 }),
    sample({ index: 4, rendererMs: 1.2, flushMs: 0.05, bytes: 55, changedRows: 3 }),
  ];

  const summary = summarizeWorkbenchThreePressureProbe(samples);

  assertEquals(summary.warmup?.index, 2);
  assertEquals(summary.latest?.index, 4);
  assertEquals(summary.steady.map((entry) => entry.index), [3, 4]);
  assertEquals(summary.averageRendererMs, 1);
  assertEquals(summary.averageFlushMs, 0.04);
  assertEquals(summary.averageBytes, 50);
  assertEquals(summary.averageChangedRows, 2);
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
  assertEquals(summary.averageChangedRows, 0);
});

function sample(
  overrides: Partial<WorkbenchThreePressureProbeSample> & Pick<WorkbenchThreePressureProbeSample, "index">,
): WorkbenchThreePressureProbeSample {
  return {
    index: overrides.index,
    rendererMs: overrides.rendererMs ?? 1,
    sceneMs: overrides.sceneMs ?? 0.5,
    readbackMs: overrides.readbackMs ?? 0.1,
    assemblyMs: overrides.assemblyMs ?? 0.05,
    flushMs: overrides.flushMs ?? 0.01,
    bytes: overrides.bytes ?? 10,
    changedRows: overrides.changedRows ?? 1,
    columns: overrides.columns ?? 26,
    rows: overrides.rows ?? 8,
    cells: overrides.cells ?? 208,
  };
}
