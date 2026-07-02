import { assert, assertEquals, assertNotEquals } from "./deps.ts";
import { AudioRegistry } from "../app/audio.ts";
import { getSourceFrame } from "../app/sources.ts";
import {
  buildVisualizationDrive,
  cpuActivityRgb,
  cpuHexTileLayout,
  nextCpuHexLabel,
  processMatchesCpuLabel,
  renderVisualization,
  topCpuProcessLabelForCpu,
  visualizations,
} from "../app/visualizations.ts";
import { visualizationCatalog, visualizationFamily, visualizationsByFamily } from "../app/visualization_catalog.ts";
import type { RenderContext, SlotConfig, SourceFrame, SystemSnapshot } from "../app/types.ts";
import { createWorkbenchVisualizationWindowOptions } from "../src/app/workbench_window_registry.ts";
import { stripStyles, textWidth } from "../src/utils/strings.ts";

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
  wireframeThickness: 8,
  edges: false,
  fill: true,
  invertLuminance: false,
  kittyGraphics: false,
  kittyDisableAscii: true,
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
  diagnostics: [],
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

Deno.test("visualization catalog classifies every workbench visualization by family", () => {
  assertEquals(visualizationCatalog.length, visualizations.length);
  assertEquals(new Set(visualizationCatalog.map((entry) => entry.id)).size, visualizations.length);
  assertEquals(visualizationsByFamily("monitor").some((entry) => entry.id === "cpu-hex-grid"), true);
  assertEquals(visualizationsByFamily("neon").some((entry) => entry.id === "magi-board"), true);
  assertEquals(visualizationsByFamily("neon3d").some((entry) => entry.id === "three-lattice"), true);

  const options = createWorkbenchVisualizationWindowOptions(visualizationCatalog);
  const groupsById = new Map(options.map((option) => [option.id, option.group]));
  for (const visualization of visualizations) {
    const family = visualizationFamily(visualization.id);
    assert(family, `${visualization.id} should have family metadata`);
    const group = groupsById.get(visualization.id);
    assert(group, `${visualization.id} should map to a workbench group`);
    assert(["Monitor", "Neon", "Neon 3D"].includes(group), `${visualization.id} should map to a known group`);
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

Deno.test("cpu hex grid renders every core with unique truecolor activity shades", () => {
  assertEquals(cpuActivityRgb(0), [45, 112, 255]);
  assertEquals(cpuActivityRgb(25), [22, 214, 107]);
  assertEquals(cpuActivityRgb(50), [255, 226, 74]);
  assertEquals(cpuActivityRgb(75), [255, 159, 36]);
  assertEquals(cpuActivityRgb(100), [255, 66, 49]);

  const uniquePercentShades = new Set(
    Array.from({ length: 101 }, (_, percent) => cpuActivityRgb(percent).join(",")),
  );
  assertEquals(uniquePercentShades.size, 101);

  const usages = [0, 25, 50, 75, 100, 6, 14, 33, 42, 58, 61, 70, 83, 91, 97, 99];
  const manyCoreSystem = {
    ...calmSystem,
    cpuOverall: 52,
    cpuCores: usages.map((usage, index) => ({
      label: String(index),
      usage,
    })),
  };
  const rendered = renderVisualization({
    ...makeContext("cpu-hex-grid", manyCoreSystem, calmSources, 0),
    width: 36,
    height: 5,
  });
  const lines = rendered.body.split("\n");
  const gridPlain = stripStyles(lines.slice(2).join("\n"));

  assertEquals((gridPlain.match(/CPU\d{3}/g) ?? []).length, 16);
  assert(gridPlain.includes("CPU015"));
  assertEquals(cpuHexTileLayout(manyCoreSystem.cpuCores, 36, 5).length, 16);
  assertEquals(cpuHexTileLayout(manyCoreSystem.cpuCores, 36, 5)[0]?.height, 2);
  assert(rendered.body.includes("\x1b[38;2;45;112;255m"));
  assert(rendered.body.includes("\x1b[38;2;22;214;107m"));
  assert(rendered.body.includes("\x1b[38;2;255;226;74m"));
  assert(rendered.body.includes("\x1b[38;2;255;159;36m"));
  assert(rendered.body.includes("\x1b[38;2;255;66;49m"));
  for (const line of lines) {
    assert(textWidth(line) <= 36, `${stripStyles(line)} should fit within the pane`);
  }

  const highCoreSystem = {
    ...manyCoreSystem,
    cpuCores: Array.from({ length: 88 }, (_, index) => ({
      label: String(index),
      usage: index % 101,
    })),
  };
  const highCoreGrid = renderVisualization({
    ...makeContext("cpu-hex-grid", highCoreSystem, calmSources, 0),
    width: 72,
    height: 8,
  });
  const highCoreLines = highCoreGrid.body.split("\n");
  const highCorePlain = stripStyles(highCoreLines.slice(2).join("\n"));
  assertEquals((highCorePlain.match(/CPU\d{3}/g) ?? []).length, 88);
  assert(highCorePlain.includes("CPU087"));
  for (const line of highCoreLines) {
    assert(textWidth(line) <= 72, `${stripStyles(line)} should fit within the pane`);
  }
});

Deno.test("cpu hex grid selection shows cpu id range and processes for that processor", () => {
  const selectedSystem: SystemSnapshot = {
    ...calmSystem,
    cpuOverall: 44,
    cpuCores: Array.from({ length: 4 }, (_, index) => ({
      label: String(index),
      usage: 20 + index * 10,
    })),
    processes: [
      {
        pid: 9001,
        name: "deno-worker",
        state: "R",
        cpuPercent: 34.2,
        memoryPercent: 2.4,
        memoryBytes: 128 * 1024 ** 2,
        processor: 2,
      },
      {
        pid: 9002,
        name: "renderer",
        state: "S",
        cpuPercent: 8.8,
        memoryPercent: 1.1,
        memoryBytes: 96 * 1024 ** 2,
        processor: 2,
      },
      {
        pid: 9003,
        name: "network",
        state: "S",
        cpuPercent: 5.1,
        memoryPercent: 0.8,
        memoryBytes: 48 * 1024 ** 2,
        processor: 1,
      },
    ],
  };

  const rendered = renderVisualization({
    ...makeContext("cpu-hex-grid", selectedSystem, calmSources, 0),
    selectedCpuLabel: "2",
    width: 64,
    height: 8,
  });
  const plain = stripStyles(rendered.body);

  assert(plain.includes("SELECTED CPU ID 2 (0-3)"));
  assert(plain.includes("TOP PROCESSES LAST SEEN ON CPU"));
  assert(plain.includes("9001"));
  assert(plain.includes("deno-worker"));
  assert(plain.includes("9002"));
  assert(!plain.includes("9003"));
  assert(rendered.body.includes("\x1b[1;38;2;5;7;13;48;2;"));
});

Deno.test("cpu hex helpers navigate tiles and summarize processor samples", () => {
  const cores = Array.from({ length: 8 }, (_, index) => ({ label: String(index), usage: index * 10 }));
  assertEquals(nextCpuHexLabel(cores, undefined, "right", 4), "1");
  assertEquals(nextCpuHexLabel(cores, "4", "up", 4), "0");
  assertEquals(nextCpuHexLabel(cores, "4", "down", 4), "7");
  assertEquals(nextCpuHexLabel(cores, "6", "end", 4), "7");
  assertEquals(nextCpuHexLabel([], undefined, "home", 4), undefined);

  const processes = [
    { pid: 1, name: "alpha", state: "R", cpuPercent: 18.2, memoryPercent: 1, memoryBytes: 1, processor: 2 },
    { pid: 2, name: "beta", state: "S", cpuPercent: 9.6, memoryPercent: 1, memoryBytes: 1, processor: 2 },
    { pid: 3, name: "gamma", state: "S", cpuPercent: 4.1, memoryPercent: 1, memoryBytes: 1, processor: 3 },
  ];
  assertEquals(processMatchesCpuLabel(processes[0]!, "2"), true);
  assertEquals(processMatchesCpuLabel(processes[2]!, "2"), false);
  assertEquals(topCpuProcessLabelForCpu("2", processes), "alpha:18%, beta:10%");
  assertEquals(topCpuProcessLabelForCpu("4", processes), "no top process in sample");
});

Deno.test("network monitor adapts to narrow and short panes", () => {
  const rendered = renderVisualization({
    ...makeContext("network-monitor", hotSystem, hotSources, 0),
    width: 18,
    height: 4,
  });
  const lines = rendered.body.split("\n");

  assert(lines.length <= 4);
  for (const line of [...lines, rendered.footer]) {
    assert(textWidth(line) <= 18, `${line} should fit within the pane`);
  }
});

Deno.test("process monitor exposes the top 100 rows for scrolling", () => {
  const processSystem = {
    ...calmSystem,
    processes: Array.from({ length: 120 }, (_, index) => ({
      pid: 10_000 + index,
      name: `worker-${index}`,
      state: index % 2 === 0 ? "R" : "S",
      cpuPercent: 120 - index,
      memoryPercent: index / 10,
      memoryBytes: (64 + index) * 1024 ** 2,
    })),
  };
  const rendered = renderVisualization({
    ...makeContext("process-monitor", processSystem, calmSources, 0),
    height: 5,
  });
  const lines = rendered.body.split("\n");

  assertEquals(lines.length, 101);
  assert(rendered.body.includes("worker-99"));
  assert(!rendered.body.includes("worker-100"));
});
