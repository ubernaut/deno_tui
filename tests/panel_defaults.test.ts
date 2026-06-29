import { assertEquals } from "./deps.ts";
import { defaultVisualizationForSlot, orderVisualizationsForSlot } from "../app/panel_defaults.ts";
import { visualizations } from "../app/visualizations.ts";

Deno.test("panel defaults pick the curated monitor wall demos", () => {
  assertEquals(defaultVisualizationForSlot("cpu"), "three-lattice");
  assertEquals(defaultVisualizationForSlot("gpu"), "gpu-combined-monitor");
  assertEquals(defaultVisualizationForSlot("gpuChip"), "gpu-chip-monitor");
  assertEquals(defaultVisualizationForSlot("gpuMemory"), "gpu-memory-monitor");
  assertEquals(defaultVisualizationForSlot("memory"), "three-hexshell");
  assertEquals(defaultVisualizationForSlot("temperature"), "three-capture");
  assertEquals(defaultVisualizationForSlot("disk"), "three-mapslab");
  assertEquals(defaultVisualizationForSlot("network"), "three-solenoid");
  assertEquals(defaultVisualizationForSlot("processes"), "process-monitor");
});

Deno.test("slot-aware ordering puts recommended process views first", () => {
  const ordered = orderVisualizationsForSlot("processes", visualizations).slice(0, 5).map((entry) => entry.id);
  assertEquals(ordered, [
    "process-monitor",
    "event-log",
    "channel-matrix",
    "telemetry-rack",
    "warning-stack",
  ]);
});

Deno.test("slot-aware ordering keeps cpu monitors ahead of unrelated demos", () => {
  const ordered = orderVisualizationsForSlot("cpu", visualizations).slice(0, 4).map((entry) => entry.id);
  assertEquals(ordered, [
    "three-lattice",
    "harmonic-graph",
    "biosignal-strip",
    "telemetry-rack",
  ]);
});

Deno.test("slot-aware ordering favors dense memory views", () => {
  const ordered = orderVisualizationsForSlot("memory", visualizations).slice(0, 5).map((entry) => entry.id);
  assertEquals(ordered, [
    "three-hexshell",
    "hex-heatmap",
    "field-ring",
    "telemetry-rack",
    "memory-monitor",
  ]);
});
