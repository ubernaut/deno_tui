import { assert, assertEquals, assertNotEquals } from "jsr:@std/assert";
import {
  monitorSourceIds,
  monitorSourceIdsInto,
  syntheticWorkbenchSources,
  syntheticWorkbenchSourcesInto,
  syntheticWorkbenchSystem,
  unitWave,
} from "../app/workbench_synthetic.ts";

Deno.test("workbench synthetic monitor source ids cover specialized monitor widgets", () => {
  assertEquals(monitorSourceIds("cpu-hex-grid"), ["sys:cpu-cores", "sys:processes"]);
  assertEquals(monitorSourceIds("gpu-combined-monitor"), ["sys:gpu", "sys:gpu-chip", "sys:gpu-memory"]);
  assertEquals(monitorSourceIds("network-monitor"), ["sys:network"]);
  assertEquals(monitorSourceIds("unknown-widget"), ["sys:cpu", "sys:memory", "sys:alerts"]);
});

Deno.test("workbench monitor source ids can reuse caller buffers", () => {
  const target = ["stale", "values"];
  assertEquals(monitorSourceIdsInto(target, "memory-monitor"), ["sys:memory", "sys:swap", "sys:load"]);
  assertEquals(target, ["sys:memory", "sys:swap", "sys:load"]);
  assertEquals(monitorSourceIdsInto(target, "network-monitor"), ["sys:network"]);
  assertEquals(target, ["sys:network"]);
});

Deno.test("workbench synthetic sources are deterministic and bounded", () => {
  const first = syntheticWorkbenchSources("three-lattice", "Neon 3D", 12);
  const second = syntheticWorkbenchSources("three-lattice", "Neon 3D", 12);

  assertEquals(first, second);
  assertEquals(first.length, 3);
  assertEquals(first[0]?.id, "workbench:three-lattice:primary");
  assertEquals(first[0]?.series.length, 72);
  assert(first.every((source) => source.value >= 0 && source.value <= 1));
  assert(first.every((source) => source.detailLines.at(-1) === "Neon 3D"));
});

Deno.test("workbench synthetic sources can reuse caller buffers", () => {
  const target = [
    { id: "stale", name: "Stale", accent: "signal" as const, value: 0, series: [], detailLines: [] },
    { id: "trim", name: "Trim", accent: "signal" as const, value: 0, series: [], detailLines: [] },
    { id: "trim2", name: "Trim2", accent: "signal" as const, value: 0, series: [], detailLines: [] },
    { id: "trim3", name: "Trim3", accent: "signal" as const, value: 0, series: [], detailLines: [] },
  ];

  assertEquals(syntheticWorkbenchSourcesInto(target, "magi-board", "Neon", 8), target);
  assertEquals(target.length, 3);
  assertEquals(target.map((source) => source.id), [
    "workbench:magi-board:primary",
    "workbench:magi-board:secondary",
    "workbench:magi-board:noise",
  ]);
  assertEquals(target[0]?.name, "Neon");
  assertEquals(target[1]?.name, "Harmonic");
  assert(target.every((source) => source.series.length === 72));
});

Deno.test("workbench synthetic system supports injected cpu count and timestamp", () => {
  const snapshot = syntheticWorkbenchSystem(42, "Monitor", { cpuCoreCount: 88, timestamp: 1234 });

  assertEquals(snapshot.timestamp, 1234);
  assertEquals(snapshot.cpuCores.length, 88);
  assertEquals(snapshot.processes.length, 8);
  assert(snapshot.processes.every((process) => typeof process.processor === "number" && process.processor < 88));
  assert(snapshot.gpu.available);
  assertEquals(snapshot.memoryHistory.length, 72);
  assertEquals(snapshot.rxHistory.length, 72);
});

Deno.test("workbench unit wave clamps values while remaining phase sensitive", () => {
  assert(unitWave(0, 0.07, 0.1) >= 0);
  assert(unitWave(10_000, 3, 99) <= 1);
  assertNotEquals(unitWave(1, 0.07, 0.1), unitWave(2, 0.07, 0.1));
});
