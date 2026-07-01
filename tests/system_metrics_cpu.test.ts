import { assertEquals } from "./deps.ts";
import { sampleCpuStatRows } from "../app/system_metrics_cpu.ts";

Deno.test("sampleCpuStatRows computes overall and per-core usage deltas", () => {
  const previous = sampleCpuStatRows(
    [
      "cpu  100 0 0 100 0 0 0 0 0 0",
      "cpu0 40 0 0 60 0 0 0 0 0 0",
      "cpu1 60 0 0 40 0 0 0 0 0 0",
    ].join("\n"),
    [],
    [],
  );

  const next = sampleCpuStatRows(
    [
      "cpu  150 0 0 150 0 0 0 0 0 0",
      "cpu0 80 0 0 80 0 0 0 0 0 0",
      "cpu1 70 0 0 70 0 0 0 0 0 0",
    ].join("\n"),
    previous.times,
    [],
  );

  assertEquals(next.overall, 50);
  assertEquals(next.totalDelta, 100);
  assertEquals(next.cores, [
    { label: "0", usage: 66.66666666666667 },
    { label: "1", usage: 25 },
  ]);
});

Deno.test("sampleCpuStatRows falls back to previous core list when no core rows are available", () => {
  const fallback = [{ label: "0", usage: 33 }];
  const sample = sampleCpuStatRows("cpu  1 0 0 9 0 0 0 0 0 0", [], fallback);

  assertEquals(sample.overall, 0);
  assertEquals(sample.totalDelta, 1);
  assertEquals(sample.cores, fallback);
  assertEquals(sample.cores === fallback, false);
});
