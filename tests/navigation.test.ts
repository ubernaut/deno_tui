import { assertEquals } from "./deps.ts";
import { shiftOutputTarget, shiftVisualizationForSlot, toggleFullscreenLayout } from "../app/navigation.ts";

Deno.test("toggleFullscreenLayout switches between fullscreen and the remembered split layout", () => {
  assertEquals(toggleFullscreenLayout("monitor", "quad"), "single");
  assertEquals(toggleFullscreenLayout("single", "quad"), "quad");
  assertEquals(toggleFullscreenLayout("single", "monitor"), "monitor");
});

Deno.test("shiftVisualizationForSlot follows slot-aware order in both directions", () => {
  const entries = [
    { id: "process-monitor" },
    { id: "event-log" },
    { id: "channel-matrix" },
    { id: "telemetry-rack" },
    { id: "warning-stack" },
  ] as const;

  assertEquals(
    shiftVisualizationForSlot("processes", "process-monitor", 1, entries),
    "event-log",
  );
  assertEquals(
    shiftVisualizationForSlot("processes", "event-log", -1, entries),
    "process-monitor",
  );
  assertEquals(
    shiftVisualizationForSlot("processes", "process-monitor", -1, entries),
    "warning-stack",
  );
});

Deno.test("shiftOutputTarget cycles visible outputs in split layouts and all outputs in single layout", () => {
  assertEquals(shiftOutputTarget("quad", "cpu", 1), "memory");
  assertEquals(shiftOutputTarget("quad", "cpu", -1), "processes");
  assertEquals(shiftOutputTarget("single", "cpu", 1), "cpuLegend");
  assertEquals(shiftOutputTarget("single", "cpu", -1), "processes");
});
