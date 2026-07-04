import { assertEquals, assertThrows } from "./deps.ts";
import {
  defaultThreeAsciiProbeOptions,
  parseThreeAsciiProbeOptions,
  summarizeThreeAsciiProbeTimings,
  threeAsciiProbeReport,
} from "../src/three_ascii/probe.ts";

Deno.test("parseThreeAsciiProbeOptions accepts task forwarded options", () => {
  assertEquals(
    parseThreeAsciiProbeOptions([
      "--",
      "--columns=80",
      "--rows",
      "30",
      "--frames=24",
      "--warmup=4",
      "--delay=70",
      "--style=mixed",
      "--readback=blocking",
    ]),
    {
      columns: 80,
      rows: 30,
      frames: 24,
      warmup: 4,
      delayMs: 70,
      style: "mixed",
      readbackStrategy: "blocking",
    },
  );
});

Deno.test("parseThreeAsciiProbeOptions rejects invalid modes and numeric values", () => {
  assertThrows(() => parseThreeAsciiProbeOptions(["--style=emoji"]), Error, "Unsupported style");
  assertThrows(() => parseThreeAsciiProbeOptions(["--readback=sync"]), Error, "Unsupported readback");
  assertThrows(() => parseThreeAsciiProbeOptions(["--columns=0"]), Error, "Expected positive columns");
  assertThrows(() => parseThreeAsciiProbeOptions(["--delay=-1"]), Error, "Expected non-negative delay");
});

Deno.test("summarizeThreeAsciiProbeTimings rounds stable timing percentiles", () => {
  assertEquals(summarizeThreeAsciiProbeTimings([]), { min: 0, avg: 0, p50: 0, p95: 0, max: 0 });
  assertEquals(summarizeThreeAsciiProbeTimings([10.125, 20.125, 30.125, 40.125]), {
    min: 10.13,
    avg: 25.13,
    p50: 20.13,
    p95: 30.13,
    max: 40.13,
  });
});

Deno.test("threeAsciiProbeReport projects renderer performance samples", () => {
  const options = defaultThreeAsciiProbeOptions();
  options.columns = 2;
  options.rows = 3;
  const report = threeAsciiProbeReport(options, [
    {
      columns: 2,
      rows: 3,
      cells: 6,
      terminalGlyphStyle: "blocks",
      totalMs: 10,
      sceneMs: 6,
      ansiMs: 4,
      readbackMs: 3,
      assemblyMs: 1,
      deferredReadbackSlots: 6,
      deferredReadbackPending: 1,
      deferredReadbackUnresolved: 1,
      deferredReadbackResolved: 0,
      deferredReadbackSaturated: false,
    },
  ]);

  assertEquals(report.frames, 1);
  assertEquals(report.cells, 6);
  assertEquals(report.totalMs.avg, 10);
  assertEquals(report.deferred, {
    slots: 6,
    pending: 1,
    unresolved: 1,
    resolved: 0,
    saturated: false,
  });
});
