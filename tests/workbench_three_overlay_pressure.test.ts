import { assertEquals } from "./deps.ts";
import { WorkbenchThreeOverlayPressureGate } from "../src/app/workbench_three_overlay_pressure.ts";

Deno.test("WorkbenchThreeOverlayPressureGate allows steady frames to update pressure", () => {
  const gate = new WorkbenchThreeOverlayPressureGate(2);

  assertEquals(gate.resolve(false), {
    resetCadence: false,
    resetPressureCounters: false,
    updatePressure: true,
  });
  assertEquals(gate.inspect(), { wasOpen: false, cooldownFrames: 0 });
});

Deno.test("WorkbenchThreeOverlayPressureGate suppresses pressure while overlay is open", () => {
  const gate = new WorkbenchThreeOverlayPressureGate(2);

  assertEquals(gate.resolve(true), {
    resetCadence: true,
    resetPressureCounters: true,
    updatePressure: false,
  });
  assertEquals(gate.inspect(), { wasOpen: true, cooldownFrames: 2 });

  assertEquals(gate.resolve(true), {
    resetCadence: true,
    resetPressureCounters: true,
    updatePressure: false,
  });
  assertEquals(gate.inspect(), { wasOpen: true, cooldownFrames: 2 });
});

Deno.test("WorkbenchThreeOverlayPressureGate suppresses pressure during close cooldown", () => {
  const gate = new WorkbenchThreeOverlayPressureGate(2);

  gate.resolve(true);

  assertEquals(gate.resolve(false), {
    resetCadence: true,
    resetPressureCounters: true,
    updatePressure: false,
  });
  assertEquals(gate.inspect(), { wasOpen: false, cooldownFrames: 1 });

  assertEquals(gate.resolve(false), {
    resetCadence: false,
    resetPressureCounters: false,
    updatePressure: false,
  });
  assertEquals(gate.inspect(), { wasOpen: false, cooldownFrames: 0 });

  assertEquals(gate.resolve(false), {
    resetCadence: false,
    resetPressureCounters: false,
    updatePressure: true,
  });
});

Deno.test("WorkbenchThreeOverlayPressureGate clamps invalid cooldowns and resets state", () => {
  const gate = new WorkbenchThreeOverlayPressureGate(-3);

  gate.resolve(true);
  assertEquals(gate.inspect(), { wasOpen: true, cooldownFrames: 0 });

  assertEquals(gate.resolve(false), {
    resetCadence: true,
    resetPressureCounters: true,
    updatePressure: true,
  });

  gate.resolve(true);
  gate.reset();
  assertEquals(gate.inspect(), { wasOpen: false, cooldownFrames: 0 });
  assertEquals(gate.resolve(false).updatePressure, true);
});
