import { assert, assertEquals, assertStringIncludes } from "./deps.ts";
import {
  formatNullable,
  gpuAccent,
  gpuAlert,
  type GpuMonitorRenderDependencies,
  gpuSeverity,
  renderGpuChipMonitor,
  renderGpuCombinedMonitor,
  renderGpuMemoryMonitor,
} from "../app/visualization_gpu.ts";
import type { RenderContext, SlotConfig, SystemSnapshot } from "../app/types.ts";

const dependencies: GpuMonitorRenderDependencies = {
  plotHistory: (_values, width, height, glyph) =>
    Array.from({ length: Math.max(1, height) }, () => glyph.repeat(Math.max(1, Math.min(width, 8)))).join("\n"),
  barChart: (_values, width, height, glyphs) =>
    Array.from(
      { length: Math.max(1, height) },
      (_, index) => (glyphs[Math.min(glyphs.length - 1, index + 1)] ?? "#").repeat(Math.max(1, Math.min(width, 9))),
    ).join("\n"),
  miniMeter: (value, width) => {
    const fill = Math.round(value * width);
    return `[${"#".repeat(fill).padEnd(width, ".")}]`;
  },
  monitorGlyph: (_drive, accent) => accent[0]?.toUpperCase() ?? "*",
};

const slot: SlotConfig = {
  id: "gpu",
  name: "GPU",
  visualizationId: "gpu-combined-monitor",
  inputSourceIds: [],
  cycleEnabled: false,
  cycleIntervalMs: 0,
  ascii: {} as SlotConfig["ascii"],
};

const baseSystem: SystemSnapshot = {
  timestamp: 0,
  hostname: "test-rig",
  osRelease: "linux",
  uptimeSeconds: 42,
  loadavg: [0.1, 0.2, 0.3],
  cpuOverall: 12,
  cpuCores: [{ label: "0", usage: 12 }],
  cpuHistory: [0.1, 0.2, 0.3],
  gpu: {
    available: true,
    name: "Ada Test",
    utilizationPercent: 34,
    memoryUsed: 3 * 1024 ** 3,
    memoryTotal: 12 * 1024 ** 3,
    memoryPercent: 25,
    temperatureCelsius: 51,
    powerWatts: 120,
    graphicsClockMhz: 1815,
    memoryClockMhz: 9000,
  },
  gpuUtilizationHistory: [0.2, 0.3, 0.34],
  gpuMemoryHistory: [0.2, 0.24, 0.25],
  memory: {
    total: 16,
    used: 8,
    available: 8,
    free: 8,
    swapTotal: 0,
    swapUsed: 0,
    percent: 50,
    swapPercent: 0,
  },
  memoryHistory: [0.5],
  swapHistory: [0],
  temperatures: [],
  disks: [],
  networks: [],
  rxHistory: [],
  txHistory: [],
  processes: [],
  alerts: [],
  diagnostics: [],
};

function context(system: SystemSnapshot = baseSystem, width = 42, height = 12): RenderContext {
  return {
    slot,
    system,
    sources: [],
    phase: 0,
    width,
    height,
  };
}

Deno.test("GPU monitor helpers classify pressure and nullable telemetry", () => {
  assertEquals(gpuAccent(20, 15, true), "violet");
  assertEquals(gpuAccent(20, 60, true), "phosphor");
  assertEquals(gpuAccent(80, 20, true), "amber");
  assertEquals(gpuAccent(95, 20, true), "alarm");
  assertEquals(gpuAccent(95, 20, false), "violet");
  assertEquals(gpuSeverity(74, 20), "info");
  assertEquals(gpuSeverity(75, 20), "warning");
  assertEquals(gpuSeverity(20, 92), "alarm");
  assertEquals(formatNullable(null, "W"), "--");
  assertEquals(formatNullable(99.4, "W"), "99.4W");
  assertEquals(formatNullable(1815, "MHz"), "1815MHz");
});

Deno.test("GPU combined monitor renders chip and memory telemetry", () => {
  const panel = renderGpuCombinedMonitor(context(), dependencies);
  assertStringIncludes(panel.body, "ADA TEST");
  assertStringIncludes(panel.body, "CHIP 34.0%");
  assertStringIncludes(panel.body, "VRAM 25.0%");
  assertStringIncludes(panel.footer, "GFX 1815MHz");
  assertEquals(panel.alert, "");
  assertEquals(panel.accent, "violet");
  assertEquals(panel.severity, "info");
});

Deno.test("GPU monitors report unavailable sources without crashing", () => {
  const unavailable = {
    ...baseSystem,
    gpu: { ...baseSystem.gpu, available: false },
  };
  const panel = renderGpuChipMonitor(context(unavailable), dependencies);
  assertStringIncludes(panel.body, "GPU CHIP OFFLINE");
  assertStringIncludes(panel.body, "NVIDIA-SMI TELEMETRY NOT AVAILABLE");
  assertEquals(panel.footer, "GPU BUS OFFLINE");
  assertEquals(panel.severity, "info");
});

Deno.test("GPU chip and memory monitors surface alarm states", () => {
  const hot = {
    ...baseSystem,
    gpu: {
      ...baseSystem.gpu,
      utilizationPercent: 97,
      memoryPercent: 94,
      memoryUsed: 11.3 * 1024 ** 3,
      temperatureCelsius: 86,
    },
    gpuUtilizationHistory: [0.8, 0.9, 0.97],
    gpuMemoryHistory: [0.8, 0.88, 0.94],
  };

  const chip = renderGpuChipMonitor(context(hot, 30, 8), dependencies);
  assertStringIncludes(chip.body, "UTIL 97.0%");
  assertEquals(chip.alert, "GPU EXECUTION WALL");
  assertEquals(chip.severity, "alarm");

  const memory = renderGpuMemoryMonitor(context(hot, 24, 9), dependencies);
  assertStringIncludes(memory.body, "VRAM 94.0%");
  assertEquals(memory.alert, "VRAM CAPACITY WALL");
  assertEquals(memory.accent, "alarm");
  assertEquals(gpuAlert(context(hot)), "VRAM LIMIT");
});

Deno.test("GPU memory monitor keeps narrow bank charts bounded", () => {
  const panel = renderGpuMemoryMonitor(context(baseSystem, 18, 7), dependencies);
  const lines = panel.body.split("\n");
  assert(lines.every((line) => line.length <= 46));
  assertStringIncludes(panel.footer, "VRAM BANKS 4");
});
