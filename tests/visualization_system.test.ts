import { assert, assertEquals, assertStringIncludes } from "./deps.ts";
import {
  type GpuMonitorRenderDependencies,
  renderCpuLegend,
  renderCpuMonitor,
  renderDiskMonitor,
  renderGpuChipMonitor,
  renderGpuCombinedMonitor,
  renderGpuMemoryMonitor,
  renderMemoryMonitor,
  renderProcessMonitor,
  renderTemperatureMonitor,
  type SystemMonitorRenderDependencies,
} from "../app/visualization_system.ts";
import type { RenderContext, SlotConfig, SystemSnapshot } from "../app/types.ts";

const dependencies: SystemMonitorRenderDependencies = {
  plotHistory: (_values, width, height, glyph) =>
    Array.from({ length: Math.max(1, height) }, () => glyph.repeat(Math.max(1, Math.min(width, 10)))).join("\n"),
  miniMeter: (value, width) => {
    const fill = Math.round(value * width);
    return `[${"#".repeat(fill).padEnd(width, ".")}]`;
  },
  monitorGlyph: (_drive, accent) => accent[0]?.toUpperCase() ?? "*",
};

const gpuDependencies: GpuMonitorRenderDependencies = {
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
  id: "cpu",
  name: "CPU",
  visualizationId: "cpu-monitor",
  inputSourceIds: [],
  cycleEnabled: false,
  cycleIntervalMs: 0,
  ascii: {} as SlotConfig["ascii"],
};

const gpuSlot: SlotConfig = {
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
  uptimeSeconds: 12345,
  loadavg: [0.42, 0.36, 0.31],
  cpuOverall: 32,
  cpuCores: [
    { label: "0", usage: 21 },
    { label: "1", usage: 42 },
    { label: "2", usage: 63 },
    { label: "3", usage: 84 },
  ],
  cpuHistory: [0.2, 0.25, 0.32],
  gpu: {
    available: false,
    name: "",
    utilizationPercent: 0,
    memoryUsed: 0,
    memoryTotal: 0,
    memoryPercent: 0,
    temperatureCelsius: null,
    powerWatts: null,
    graphicsClockMhz: null,
    memoryClockMhz: null,
  },
  gpuUtilizationHistory: [],
  gpuMemoryHistory: [],
  memory: {
    total: 16 * 1024 ** 3,
    used: 6 * 1024 ** 3,
    available: 10 * 1024 ** 3,
    free: 5 * 1024 ** 3,
    swapTotal: 4 * 1024 ** 3,
    swapUsed: 512 * 1024 ** 2,
    percent: 37,
    swapPercent: 12,
  },
  memoryHistory: [0.3, 0.35, 0.37],
  swapHistory: [0.08, 0.1, 0.12],
  temperatures: [
    { label: "Package", celsius: 48.5 },
    { label: "Core 0", celsius: 45.2 },
  ],
  disks: [
    {
      filesystem: "/dev/nvme0n1p2",
      mount: "/",
      total: 500 * 1024 ** 3,
      used: 210 * 1024 ** 3,
      available: 290 * 1024 ** 3,
      percent: 42,
    },
  ],
  networks: [],
  rxHistory: [],
  txHistory: [],
  processes: [
    { pid: 101, name: "deno", state: "R", cpuPercent: 12.4, memoryPercent: 3.2, memoryBytes: 512 * 1024 ** 2 },
  ],
  alerts: [],
  diagnostics: [],
};

function context(system: SystemSnapshot = baseSystem, width = 48, height = 10): RenderContext {
  return {
    slot,
    system,
    sources: [],
    phase: 0,
    width,
    height,
  };
}

function gpuContext(system: SystemSnapshot = gpuSystem(), width = 42, height = 12): RenderContext {
  return {
    slot: gpuSlot,
    system,
    sources: [],
    phase: 0,
    width,
    height,
  };
}

function gpuSystem(overrides: Partial<SystemSnapshot["gpu"]> = {}): SystemSnapshot {
  return {
    ...baseSystem,
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
      ...overrides,
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
    processes: [],
  };
}

Deno.test("system CPU monitor renders load, history, and hottest cores", () => {
  const panel = renderCpuMonitor(context(), dependencies);
  assertStringIncludes(panel.body, "AVG 32.0%");
  assertStringIncludes(panel.body, "CPU03  84%");
  assertStringIncludes(panel.footer, "HOST TEST-RIG");
  assertEquals(panel.accent, "signal");
});

Deno.test("system CPU monitor shows only the hottest four cores", () => {
  const panel = renderCpuMonitor(
    context({
      ...baseSystem,
      cpuCores: [
        { label: "0", usage: 10 },
        { label: "1", usage: 95 },
        { label: "2", usage: 40 },
        { label: "3", usage: 91 },
        { label: "4", usage: 85 },
        { label: "5", usage: 84 },
        { label: "6", usage: 83 },
      ],
    }),
    dependencies,
  );

  assertStringIncludes(panel.body, "CPU01  95%");
  assertStringIncludes(panel.body, "CPU03  91%");
  assertStringIncludes(panel.body, "CPU04  85%");
  assertStringIncludes(panel.body, "CPU05  84%");
  assertEquals(panel.body.includes("CPU06  83%"), false);
});

Deno.test("system CPU legend includes every core across wrapped rows", () => {
  const panel = renderCpuLegend(context(baseSystem, 30, 8), dependencies);
  assertStringIncludes(panel.body, "000");
  assertStringIncludes(panel.body, "001");
  assertStringIncludes(panel.body, "002");
  assertStringIncludes(panel.body, "003");
  assertStringIncludes(panel.footer, "CORES 04");
});

Deno.test("system memory monitor reports pressure and swap alerts", () => {
  const pressured = {
    ...baseSystem,
    memory: {
      ...baseSystem.memory,
      used: 15 * 1024 ** 3,
      available: 1 * 1024 ** 3,
      percent: 94,
      swapUsed: 3.8 * 1024 ** 3,
      swapPercent: 95,
    },
  };

  const panel = renderMemoryMonitor(context(pressured), dependencies);
  assertStringIncludes(panel.body, "RAM  94.0%");
  assertEquals(panel.alert, "MEMORY SATURATION EVENT");
  assertEquals(panel.severity, "alarm");
});

Deno.test("system thermal and disk monitors handle missing sources", () => {
  const missing = {
    ...baseSystem,
    temperatures: [],
    disks: [],
  };
  const thermal = renderTemperatureMonitor(context(missing), dependencies);
  const disk = renderDiskMonitor(context(missing), dependencies);

  assertEquals(thermal.body, "NO THERMAL ZONES REPORTED");
  assertEquals(thermal.footer, "THERMAL BUS OFFLINE");
  assertEquals(disk.body, "NO DISK METRICS AVAILABLE");
  assertEquals(disk.footer, "FILESYSTEM BUS IDLE");
});

Deno.test("system process monitor caps output at the top 100 processes", () => {
  const processSystem = {
    ...baseSystem,
    processes: Array.from({ length: 120 }, (_, index) => ({
      pid: 1000 + index,
      name: `proc-${index}`,
      state: "R",
      cpuPercent: 120 - index,
      memoryPercent: index / 10,
      memoryBytes: index * 1024,
    })),
  };

  const panel = renderProcessMonitor(context(processSystem));
  const rows = panel.body.split("\n");
  assertEquals(rows.length, 101);
  assertStringIncludes(panel.footer, "TOP 100");
  assertEquals(panel.alert, "PROCESS SPIKE DETECTED");
});

Deno.test("GPU monitors classify pressure and nullable telemetry through rendered panels", () => {
  const idle = renderGpuCombinedMonitor(gpuContext(), gpuDependencies);
  assertStringIncludes(idle.body, "TEMP 51.0C  POWER 120W");
  assertStringIncludes(idle.footer, "GFX 1815MHz");
  assertEquals(idle.accent, "violet");
  assertEquals(idle.severity, "info");

  const memoryLed = renderGpuCombinedMonitor(
    gpuContext(gpuSystem({ utilizationPercent: 20, memoryPercent: 60 })),
    gpuDependencies,
  );
  assertEquals(memoryLed.accent, "phosphor");
  assertEquals(memoryLed.severity, "info");

  const warning = renderGpuCombinedMonitor(
    gpuContext(gpuSystem({ utilizationPercent: 80, memoryPercent: 20 })),
    gpuDependencies,
  );
  assertEquals(warning.accent, "amber");
  assertEquals(warning.severity, "warning");

  const alarm = renderGpuCombinedMonitor(
    gpuContext(gpuSystem({ utilizationPercent: 95, memoryPercent: 20 })),
    gpuDependencies,
  );
  assertEquals(alarm.alert, "GPU EXECUTION WALL");
  assertEquals(alarm.accent, "alarm");
  assertEquals(alarm.severity, "alarm");

  const nullable = renderGpuChipMonitor(
    gpuContext(gpuSystem({
      temperatureCelsius: null,
      powerWatts: null,
      graphicsClockMhz: null,
      memoryClockMhz: null,
    })),
    gpuDependencies,
  );
  assertStringIncludes(nullable.body, "TEMP --  POWER --");
  assertStringIncludes(nullable.body, "GFX --  MEMORY --");
});

Deno.test("GPU combined monitor renders chip and memory telemetry", () => {
  const panel = renderGpuCombinedMonitor(gpuContext(), gpuDependencies);
  assertStringIncludes(panel.body, "ADA TEST");
  assertStringIncludes(panel.body, "CHIP 34.0%");
  assertStringIncludes(panel.body, "VRAM 25.0%");
  assertStringIncludes(panel.footer, "GFX 1815MHz");
  assertEquals(panel.alert, "");
  assertEquals(panel.accent, "violet");
  assertEquals(panel.severity, "info");
});

Deno.test("GPU monitors report unavailable sources without crashing", () => {
  const panel = renderGpuChipMonitor(gpuContext(gpuSystem({ available: false })), gpuDependencies);
  assertStringIncludes(panel.body, "GPU CHIP OFFLINE");
  assertStringIncludes(panel.body, "NVIDIA-SMI TELEMETRY NOT AVAILABLE");
  assertEquals(panel.footer, "GPU BUS OFFLINE");
  assertEquals(panel.severity, "info");
});

Deno.test("GPU chip and memory monitors surface alarm states", () => {
  const hot = gpuSystem({
    utilizationPercent: 97,
    memoryPercent: 94,
    memoryUsed: 11.3 * 1024 ** 3,
    temperatureCelsius: 86,
  });
  hot.gpuUtilizationHistory = [0.8, 0.9, 0.97];
  hot.gpuMemoryHistory = [0.8, 0.88, 0.94];

  const chip = renderGpuChipMonitor(gpuContext(hot, 30, 8), gpuDependencies);
  assertStringIncludes(chip.body, "UTIL 97.0%");
  assertEquals(chip.alert, "GPU EXECUTION WALL");
  assertEquals(chip.severity, "alarm");

  const memory = renderGpuMemoryMonitor(gpuContext(hot, 24, 9), gpuDependencies);
  assertStringIncludes(memory.body, "VRAM 94.0%");
  assertEquals(memory.alert, "VRAM CAPACITY WALL");
  assertEquals(memory.accent, "alarm");

  const combined = renderGpuCombinedMonitor(gpuContext(hot, 30, 8), gpuDependencies);
  assertEquals(combined.alert, "VRAM LIMIT");
});

Deno.test("GPU memory monitor keeps narrow bank charts bounded", () => {
  const panel = renderGpuMemoryMonitor(gpuContext(gpuSystem(), 18, 7), gpuDependencies);
  const lines = panel.body.split("\n");
  assert(lines.every((line) => line.length <= 46));
  assertStringIncludes(panel.footer, "VRAM BANKS 4");
});
