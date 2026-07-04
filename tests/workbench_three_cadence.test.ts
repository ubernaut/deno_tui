import { assertEquals } from "./deps.ts";
import { WorkbenchThreeCadenceMeter } from "../app/workbench_three_cadence.ts";

Deno.test("WorkbenchThreeCadenceMeter reports observed frame cadence after repeated updates", () => {
  const meter = new WorkbenchThreeCadenceMeter({ alpha: 0.5 });

  assertEquals(meter.inspect(), { updates: 0, averageFrameMs: undefined, measuredFps: undefined });
  assertEquals(meter.record(100), { updates: 1, averageFrameMs: undefined, measuredFps: undefined });
  assertEquals(meter.record(150), { updates: 2, averageFrameMs: 50, measuredFps: 20 });
  assertEquals(meter.record(250), { updates: 3, averageFrameMs: 75, measuredFps: 1000 / 75 });
});

Deno.test("WorkbenchThreeCadenceMeter resets stale gaps without retaining old cadence", () => {
  const meter = new WorkbenchThreeCadenceMeter({ resetAfterMs: 100 });

  meter.record(0);
  meter.record(50);
  assertEquals(meter.inspect().averageFrameMs, 50);

  meter.record(500);
  assertEquals(meter.inspect().averageFrameMs, 450);

  meter.reset();
  assertEquals(meter.inspect(), { updates: 0, averageFrameMs: undefined, measuredFps: undefined });
});

Deno.test("WorkbenchThreeCadenceMeter hides stale measured fps before the next update", () => {
  const meter = new WorkbenchThreeCadenceMeter({ resetAfterMs: 100 });

  meter.record(0);
  meter.record(50);

  assertEquals(meter.inspectAt(75), { updates: 2, averageFrameMs: 50, measuredFps: 20 });
  assertEquals(meter.measuredFps(151), undefined);
  assertEquals(meter.inspectAt(151), { updates: 2, averageFrameMs: undefined, measuredFps: undefined });
});
