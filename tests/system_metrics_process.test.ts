import { assertEquals } from "./deps.ts";
import { parseProcessStat, processComparator } from "../app/system_metrics_process.ts";
import type { ProcessSnapshot } from "../app/types.ts";

Deno.test("parseProcessStat reads selected proc fields without splitting names", () => {
  const tail = Array.from({ length: 37 }, () => "0");
  tail[0] = "S";
  tail[11] = "120";
  tail[12] = "30";
  tail[21] = "256";
  tail[36] = "17";

  assertEquals(parseProcessStat(`42 (worker (render) thread) ${tail.join(" ")}`, 4096), {
    name: "worker (render) thread",
    state: "S",
    cpuTime: 150,
    memoryBytes: 256 * 4096,
    processor: 17,
  });
});

Deno.test("processComparator applies stable sort key fallbacks", () => {
  const rows: ProcessSnapshot[] = [
    processRow(30, "zeta", 10, 1024),
    processRow(10, "alpha", 10, 4096),
    processRow(20, "alpha", 20, 1024),
  ];

  assertEquals([...rows].sort(processComparator("cpu")).map((row) => row.pid), [20, 10, 30]);
  assertEquals([...rows].sort(processComparator("memory")).map((row) => row.pid), [10, 20, 30]);
  assertEquals([...rows].sort(processComparator("pid")).map((row) => row.pid), [10, 20, 30]);
  assertEquals([...rows].sort(processComparator("name")).map((row) => row.pid), [20, 10, 30]);
});

function processRow(pid: number, name: string, cpuPercent: number, memoryBytes: number): ProcessSnapshot {
  return {
    pid,
    name,
    state: "R",
    cpuPercent,
    memoryPercent: 0,
    memoryBytes,
  };
}
