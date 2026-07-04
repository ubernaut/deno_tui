import { assertEquals } from "./deps.ts";
import { threeHeaderPerformanceText } from "../app/workbench_three_header.ts";

Deno.test("threeHeaderPerformanceText formats detailed target measured queue and pressure telemetry", () => {
  assertEquals(
    threeHeaderPerformanceText({
      totalMs: 17.4,
      sceneMs: 12.2,
      readbackMs: 4.1,
      assemblyMs: 1.3,
      cells: 1920,
      deferredReadbackSlots: 6,
      deferredReadbackUnresolved: 2,
      sourceMaxCells: 3840,
      targetFps: 14.2,
      measuredFps: 11.8,
      pressureCells: 60,
      pressureHighFrames: 0,
      pressureLowFrames: 12,
      pressureByteRate: 12_581,
      pressureScoped: true,
    }, 120),
    "frame 17ms scene 12 read 4 asm 1 1920c cap 3840c @14fps live 12fps q2/6 io 13KB/s tier 60c h0/l12",
  );
});

Deno.test("threeHeaderPerformanceText prefers measured fps in compact mode and falls back when narrow", () => {
  const input = {
    totalMs: 17.4,
    sceneMs: 12.2,
    readbackMs: 4.1,
    assemblyMs: 1.3,
    cells: 1920,
    deferredReadbackSlots: 6,
    deferredReadbackUnresolved: 6,
    deferredReadbackSaturated: true,
    targetFps: 18,
    measuredFps: 9.7,
    pressureCells: 30,
    pressureHighFrames: 1,
    pressureLowFrames: 0,
    pressureScoped: false,
  };

  assertEquals(threeHeaderPerformanceText(input, 64), "17ms 1920c live 10fps sat6/6 wide tier 30c h1/l0");
  assertEquals(threeHeaderPerformanceText(input, 30), "17ms 1920c");
});
