import { assert, assertEquals, assertNotEquals } from "./deps.ts";
import { AudioRegistry } from "../app/audio.ts";
import { getSourceFrame } from "../app/sources.ts";
import { buildVisualizationDrive, renderVisualization, visualizations } from "../app/visualizations.ts";
import type { RenderContext, SlotConfig, SourceFrame, SystemSnapshot } from "../app/types.ts";

const ascii = {
  preset: "opentui-blocks",
  border: "sharp" as const,
  terminalGlyphStyle: "blocks" as const,
  terminalEdgeBias: 1.45,
  edgeThreshold: 14,
  normalThreshold: 0.24,
  depthThreshold: 0.15,
  exposure: 1.28,
  attenuation: 0.96,
  blendWithBase: 1,
  depthFalloff: 0.04,
  depthOffset: 150,
  edges: false,
  fill: true,
  invertLuminance: false,
};

const calmSystem: SystemSnapshot = {
  timestamp: Date.now(),
  hostname: "signal-desk",
  osRelease: "linux",
  uptimeSeconds: 1234,
  loadavg: [0.42, 0.36, 0.31],
  cpuOverall: 28,
  cpuCores: [
    { label: "0", usage: 21 },
    { label: "1", usage: 34 },
    { label: "2", usage: 19 },
    { label: "3", usage: 37 },
  ],
  cpuHistory: [0.18, 0.2, 0.24, 0.22, 0.27, 0.28, 0.25, 0.3],
  gpu: {
    available: true,
    name: "NERV CUDA-00",
    utilizationPercent: 34,
    memoryUsed: 5 * 1024 ** 3,
    memoryTotal: 16 * 1024 ** 3,
    memoryPercent: 31,
    temperatureCelsius: 51,
    powerWatts: 116,
    graphicsClockMhz: 1815,
    memoryClockMhz: 9500,
  },
  gpuUtilizationHistory: [0.18, 0.22, 0.27, 0.31, 0.33, 0.35, 0.32, 0.34],
  gpuMemoryHistory: [0.24, 0.25, 0.27, 0.28, 0.29, 0.3, 0.31, 0.31],
  memory: {
    total: 16 * 1024 ** 3,
    used: 6 * 1024 ** 3,
    available: 10 * 1024 ** 3,
    free: 5 * 1024 ** 3,
    swapTotal: 4 * 1024 ** 3,
    swapUsed: 0.5 * 1024 ** 3,
    percent: 37,
    swapPercent: 12,
  },
  memoryHistory: [0.31, 0.34, 0.36, 0.35, 0.38, 0.37, 0.39, 0.4],
  swapHistory: [0.08, 0.09, 0.12, 0.1, 0.11, 0.12, 0.11, 0.12],
  temperatures: [
    { label: "Package", celsius: 46.2 },
    { label: "Core 0", celsius: 44.8 },
    { label: "Core 1", celsius: 45.1 },
  ],
  disks: [
    {
      filesystem: "/dev/nvme0n1p2",
      mount: "/",
      total: 500 * 1024 ** 3,
      used: 220 * 1024 ** 3,
      available: 280 * 1024 ** 3,
      percent: 44,
    },
    {
      filesystem: "/dev/nvme0n1p3",
      mount: "/home",
      total: 1000 * 1024 ** 3,
      used: 410 * 1024 ** 3,
      available: 590 * 1024 ** 3,
      percent: 41,
    },
  ],
  networks: [
    { name: "eth0", addresses: ["10.0.0.8"], rxBytes: 0, txBytes: 0, rxRate: 1_200_000, txRate: 620_000 },
  ],
  rxHistory: [0.05, 0.07, 0.08, 0.09, 0.1, 0.08, 0.07, 0.09],
  txHistory: [0.03, 0.04, 0.05, 0.06, 0.04, 0.03, 0.05, 0.04],
  processes: [
    { pid: 101, name: "deno", state: "R", cpuPercent: 12.3, memoryPercent: 3.1, memoryBytes: 512 * 1024 ** 2 },
    { pid: 202, name: "tmux", state: "S", cpuPercent: 4.8, memoryPercent: 0.4, memoryBytes: 72 * 1024 ** 2 },
    { pid: 303, name: "bottom", state: "S", cpuPercent: 3.2, memoryPercent: 0.9, memoryBytes: 128 * 1024 ** 2 },
  ],
  alerts: [],
};

const hotSystem: SystemSnapshot = {
  ...calmSystem,
  loadavg: [9.4, 8.2, 7.1],
  cpuOverall: 93,
  cpuCores: [
    { label: "0", usage: 97 },
    { label: "1", usage: 94 },
    { label: "2", usage: 88 },
    { label: "3", usage: 96 },
  ],
  cpuHistory: [0.48, 0.56, 0.64, 0.72, 0.83, 0.91, 0.97, 0.93],
  gpu: {
    available: true,
    name: "NERV CUDA-00",
    utilizationPercent: 97,
    memoryUsed: 15 * 1024 ** 3,
    memoryTotal: 16 * 1024 ** 3,
    memoryPercent: 94,
    temperatureCelsius: 86,
    powerWatts: 312,
    graphicsClockMhz: 2475,
    memoryClockMhz: 10501,
  },
  gpuUtilizationHistory: [0.5, 0.62, 0.74, 0.83, 0.91, 0.96, 0.99, 0.97],
  gpuMemoryHistory: [0.68, 0.72, 0.78, 0.84, 0.89, 0.92, 0.94, 0.94],
  memory: {
    total: calmSystem.memory.total,
    used: 15 * 1024 ** 3,
    available: 1 * 1024 ** 3,
    free: 0.4 * 1024 ** 3,
    swapTotal: 4 * 1024 ** 3,
    swapUsed: 3.4 * 1024 ** 3,
    percent: 94,
    swapPercent: 85,
  },
  memoryHistory: [0.62, 0.7, 0.76, 0.84, 0.9, 0.94, 0.97, 0.95],
  swapHistory: [0.3, 0.41, 0.58, 0.64, 0.72, 0.8, 0.88, 0.85],
  temperatures: [
    { label: "Package", celsius: 87.8 },
    { label: "Core 0", celsius: 84.5 },
    { label: "Core 1", celsius: 85.2 },
  ],
  disks: [
    {
      filesystem: "/dev/nvme0n1p2",
      mount: "/",
      total: 500 * 1024 ** 3,
      used: 471 * 1024 ** 3,
      available: 29 * 1024 ** 3,
      percent: 94,
    },
    {
      filesystem: "/dev/nvme0n1p3",
      mount: "/home",
      total: 1000 * 1024 ** 3,
      used: 923 * 1024 ** 3,
      available: 77 * 1024 ** 3,
      percent: 92,
    },
  ],
  networks: [
    { name: "eth0", addresses: ["10.0.0.8"], rxBytes: 0, txBytes: 0, rxRate: 194_000_000, txRate: 136_000_000 },
  ],
  rxHistory: [0.22, 0.34, 0.46, 0.58, 0.71, 0.84, 0.95, 0.92],
  txHistory: [0.18, 0.28, 0.36, 0.47, 0.62, 0.76, 0.88, 0.83],
  processes: [
    { pid: 101, name: "deno", state: "R", cpuPercent: 98.1, memoryPercent: 9.4, memoryBytes: 2.1 * 1024 ** 3 },
    { pid: 404, name: "ffmpeg", state: "R", cpuPercent: 82.4, memoryPercent: 3.3, memoryBytes: 820 * 1024 ** 2 },
    { pid: 505, name: "denort", state: "R", cpuPercent: 61.8, memoryPercent: 1.9, memoryBytes: 410 * 1024 ** 2 },
  ],
  alerts: [
    { severity: "alarm", title: "SYSTEM LIMIT", detail: "CPU AND MEMORY NEAR CAPACITY" },
    { severity: "warning", title: "NET SURGE", detail: "INGRESS SPIKE DETECTED" },
  ],
};

const calmSources: SourceFrame[] = [
  {
    id: "sys:cpu",
    name: "CPU",
    accent: "signal",
    value: 0.32,
    series: [0.24, 0.27, 0.3, 0.31, 0.33, 0.34, 0.31, 0.32],
    detailLines: ["AVG 32%", "LOAD 0.42 / 0.36 / 0.31"],
  },
  {
    id: "sys:memory",
    name: "Memory",
    accent: "phosphor",
    value: 0.38,
    series: [0.31, 0.34, 0.36, 0.35, 0.37, 0.38, 0.39, 0.4],
    detailLines: ["USED 37%", "AVAIL 10GiB"],
  },
  {
    id: "synth:pulse",
    name: "Synthetic Pulse",
    accent: "signal",
    value: 0.44,
    series: [0.28, 0.34, 0.39, 0.41, 0.45, 0.49, 0.46, 0.44],
    detailLines: ["CONTROL BUS", "STABLE"],
  },
];

const hotSources: SourceFrame[] = [
  {
    id: "sys:cpu",
    name: "CPU",
    accent: "alarm",
    value: 0.94,
    series: [0.58, 0.64, 0.73, 0.82, 0.9, 0.96, 0.99, 0.94],
    detailLines: ["AVG 94%", "LOAD 9.40 / 8.20 / 7.10"],
  },
  {
    id: "sys:memory",
    name: "Memory",
    accent: "alarm",
    value: 0.91,
    series: [0.48, 0.57, 0.66, 0.74, 0.85, 0.91, 0.97, 0.91],
    detailLines: ["USED 94%", "AVAIL 1GiB"],
  },
  {
    id: "audio:test",
    name: "System Audio",
    accent: "violet",
    value: 0.76,
    series: [0.12, 0.3, 0.42, 0.58, 0.76, 0.92, 0.81, 0.76],
    detailLines: ["RMS 76%", "PEAK 92%"],
  },
];

function makeSlot(visualizationId: string): SlotConfig {
  return {
    id: "cpu",
    name: "CPU",
    visualizationId,
    inputSourceIds: calmSources.map((source) => source.id),
    cycleEnabled: false,
    cycleIntervalMs: 10000,
    ascii,
  };
}

function makeContext(
  visualizationId: string,
  system: SystemSnapshot,
  sources: SourceFrame[],
  phase = 24,
): RenderContext {
  return {
    slot: makeSlot(visualizationId),
    system,
    sources,
    phase,
    width: 32,
    height: 10,
  };
}

Deno.test("visualization drive expands narrow source bounds into dramatic normalized motion", () => {
  const drive = buildVisualizationDrive({
    system: calmSystem,
    phase: 12,
    sources: [{
      id: "narrow",
      name: "Narrow Band",
      accent: "signal",
      value: 0.45,
      series: [0.41, 0.42, 0.43, 0.44, 0.45],
      detailLines: ["NARROW BAND SOURCE"],
    }],
  }, 16);

  assert(drive.current > 0.75);
  assert(drive.span > 0.5);
  assert(drive.sources[0]!.volatility > 0);
});

Deno.test("every visualization renders and reacts to changed inputs", () => {
  for (const visualization of visualizations) {
    const calm = renderVisualization(makeContext(visualization.id, calmSystem, calmSources, 18));
    const hot = renderVisualization(makeContext(visualization.id, hotSystem, hotSources, 18));

    assert(calm.body.trim().length > 0, `${visualization.id} should render a non-empty calm body`);
    assert(hot.body.trim().length > 0, `${visualization.id} should render a non-empty hot body`);
    assertNotEquals(calm.body, hot.body, `${visualization.id} body should change with different inputs`);
  }
});

Deno.test("cpu legend exposes every core for scrollable panels", () => {
  const manyCoreSystem = {
    ...calmSystem,
    cpuCores: Array.from({ length: 16 }, (_, index) => ({
      label: String(index),
      usage: 10 + index,
    })),
  };
  const source = getSourceFrame("sys:cpu-cores", manyCoreSystem, new AudioRegistry([]), 0);
  const legend = renderVisualization({
    ...makeContext("cpu-legend", manyCoreSystem, [source], 0),
    height: 4,
  });

  assertEquals(source.detailLines.length, 16);
  assertEquals(legend.body.split("\n").length, 17);
  assert(legend.body.includes("015"));
});
