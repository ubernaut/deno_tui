import { clamp, formatBytes, formatDuration, formatPercent, formatRate } from "./styles.ts";
import { demos as neonDemos, formatCountdown as neonFormatCountdown } from "./neon_theme.ts";
import type {
  Accent,
  PanelRender,
  RenderContext,
  Severity,
  SourceFrame,
  ThreeSceneMode,
  ThreeSceneSignal,
  VisualizationDescriptor,
} from "./types.ts";

const monitorVisualizations: VisualizationDescriptor[] = [
  {
    id: "cpu-monitor",
    name: "CPU Monitor",
    accent: "signal",
    description: "Bottom-style CPU overview and history plot.",
  },
  { id: "cpu-legend", name: "CPU Legend", accent: "signal", description: "Per-core legend wall." },
  {
    id: "gpu-combined-monitor",
    name: "GPU Fusion",
    accent: "violet",
    description: "Combined GPU chip and VRAM pressure view.",
  },
  {
    id: "gpu-chip-monitor",
    name: "GPU Chip",
    accent: "violet",
    description: "GPU utilization, thermals, power, and clocks.",
  },
  {
    id: "gpu-memory-monitor",
    name: "GPU Memory",
    accent: "phosphor",
    description: "Dedicated GPU memory bank pressure.",
  },
  { id: "memory-monitor", name: "Memory Monitor", accent: "phosphor", description: "Memory, swap, and load pressure." },
  { id: "temperature-monitor", name: "Temperature Monitor", accent: "violet", description: "Thermal zone readout." },
  { id: "disk-monitor", name: "Disk Monitor", accent: "amber", description: "Filesystem capacity board." },
  {
    id: "network-monitor",
    name: "Network Monitor",
    accent: "signal",
    description: "Ingress, egress, and interface status.",
  },
  { id: "process-monitor", name: "Process Monitor", accent: "amber", description: "Top process activity table." },
];

const neonThreeVisualizationIds = [
  "three-lattice",
  "three-atfield",
  "three-hexshell",
  "three-capture",
  "three-mapslab",
  "three-solenoid",
  "three-ascii-studio",
] as const;

const neonVisualizationIds = [
  "warning-stack",
  "counter-board",
  "profile-card",
  "live-feed",
  "event-log",
  "channel-matrix",
  "telemetry-rack",
  "biosignal-strip",
  "harmonic-graph",
  "psychograph",
  "field-ring",
  "hex-heatmap",
  "magi-board",
  "route-board",
  "gate-status",
  "tactical-map",
  "network-topology",
  "component-index",
] as const;

const neonVisualizationMap = new Map(
  neonDemos
    .filter((demo) =>
      neonVisualizationIds.includes(demo.id as typeof neonVisualizationIds[number]) ||
      neonThreeVisualizationIds.includes(demo.id as typeof neonThreeVisualizationIds[number])
    )
    .map((demo) => [demo.id, demo] as const),
);

export const visualizations: VisualizationDescriptor[] = [
  ...monitorVisualizations,
  ...neonThreeVisualizationIds.map((id) => {
    const demo = neonVisualizationMap.get(id);
    return {
      id,
      name: demo?.title ?? id,
      accent: (demo?.accent ?? "signal") as Accent,
      description: demo?.subtitle ?? "Neon Exodus 3D visualization.",
    };
  }),
  ...neonVisualizationIds.map((id) => {
    const demo = neonVisualizationMap.get(id);
    return {
      id,
      name: demo?.title ?? id,
      accent: (demo?.accent ?? "signal") as Accent,
      description: demo?.subtitle ?? "Neon Exodus visualization.",
    };
  }),
];

const visualizationMap = new Map(visualizations.map((entry) => [entry.id, entry]));

export interface VisualizationSourceDrive {
  source: SourceFrame;
  rawSeries: number[];
  normalizedSeries: number[];
  value: number;
  normalizedValue: number;
  average: number;
  floor: number;
  ceiling: number;
  span: number;
  slope: number;
  volatility: number;
  energy: number;
}

export interface VisualizationDrive {
  sources: VisualizationSourceDrive[];
  primary: VisualizationSourceDrive;
  secondary: VisualizationSourceDrive;
  rawSeries: number[];
  normalizedSeries: number[];
  spreadSeries: number[];
  motionSeries: number[];
  pulseSeries: number[];
  current: number;
  absolute: number;
  peak: number;
  floor: number;
  ceiling: number;
  span: number;
  slope: number;
  jerk: number;
  volatility: number;
  divergence: number;
  imbalance: number;
  cadence: number;
  density: number;
  hazard: number;
  alertPressure: number;
  activeCount: number;
  phase: number;
  scan: number;
}

export function renderVisualization(context: RenderContext): PanelRender {
  const descriptor = visualizationMap.get(context.slot.visualizationId) ?? visualizations[0]!;

  const panel = (() => {
    switch (context.slot.visualizationId) {
      case "three-lattice":
        return renderThreeScene(context, "lattice", descriptor.accent);
      case "three-atfield":
        return renderThreeScene(context, "atfield", descriptor.accent);
      case "three-hexshell":
        return renderThreeScene(context, "hexshell", descriptor.accent);
      case "three-capture":
        return renderThreeScene(context, "capture", descriptor.accent);
      case "three-mapslab":
        return renderThreeScene(context, "mapslab", descriptor.accent);
      case "three-solenoid":
        return renderThreeScene(context, "solenoid", descriptor.accent);
      case "three-ascii-studio":
        return renderThreeScene(context, "studio", descriptor.accent);
      case "cpu-monitor":
        return renderCpuMonitor(context);
      case "cpu-legend":
        return renderCpuLegend(context);
      case "gpu-combined-monitor":
        return renderGpuCombinedMonitor(context);
      case "gpu-chip-monitor":
        return renderGpuChipMonitor(context);
      case "gpu-memory-monitor":
        return renderGpuMemoryMonitor(context);
      case "memory-monitor":
        return renderMemoryMonitor(context);
      case "temperature-monitor":
        return renderTemperatureMonitor(context);
      case "disk-monitor":
        return renderDiskMonitor(context);
      case "network-monitor":
        return renderNetworkMonitor(context);
      case "process-monitor":
        return renderProcessMonitor(context);
      case "warning-stack":
        return renderWarningStack(context);
      case "counter-board":
        return renderCounterBoard(context);
      case "profile-card":
        return renderProfileCard(context);
      case "live-feed":
        return renderLiveFeed(context);
      case "event-log":
        return renderEventLog(context);
      case "channel-matrix":
        return renderChannelMatrix(context);
      case "telemetry-rack":
        return renderTelemetryRack(context);
      case "biosignal-strip":
        return renderBiosignalStrip(context);
      case "harmonic-graph":
        return renderHarmonicGraph(context);
      case "psychograph":
        return renderPsychograph(context);
      case "field-ring":
        return renderFieldRing(context);
      case "hex-heatmap":
        return renderHeatmap(context);
      case "magi-board":
        return renderMagiBoard(context);
      case "route-board":
        return renderRouteBoard(context);
      case "gate-status":
        return renderGateStatus(context);
      case "tactical-map":
        return renderTacticalMap(context);
      case "network-topology":
        return renderNetworkTopology(context);
      case "component-index":
        return renderComponentIndex(context);
      default:
        return renderTelemetryRack(context);
    }
  })();

  const footerBase = panel.footer || sourceFooter(context.sources);
  return {
    title: descriptor.name.toUpperCase(),
    accent: panel.accent ?? descriptor.accent,
    severity: panel.severity ?? "info",
    alert: panel.alert ?? "",
    body: panel.body,
    footer: footerBase,
    three: panel.three,
  };
}

export function buildVisualizationDrive(
  context: Pick<RenderContext, "sources" | "phase" | "system">,
  width = 48,
): VisualizationDrive {
  const sampleWidth = Math.max(8, width);
  const sourceFrames = context.sources.length > 0 ? context.sources : [fallbackSource(context.phase)];
  const sources = sourceFrames.map((source) => {
    const rawSeries = sampleSeries(source.series.length > 0 ? source.series : [source.value], sampleWidth);
    const floor = Math.min(source.value, ...rawSeries);
    const ceiling = Math.max(source.value, ...rawSeries);
    const span = Math.max(0, ceiling - floor);
    const normalizedSeries = rawSeries.map((value, index) => {
      const local = span < 0.035 ? value : clamp((value - floor) / Math.max(span, 0.001), 0, 1);
      const motion = index === 0 ? Math.abs(source.value - value) : Math.abs(value - (rawSeries[index - 1] ?? value));
      return clamp(local * 0.72 + value * 0.22 + motion * 0.48, 0, 1);
    });
    const normalizedValue = (() => {
      const local = span < 0.035 ? source.value : clamp((source.value - floor) / Math.max(span, 0.001), 0, 1);
      return clamp(local * 0.72 + source.value * 0.28, 0, 1);
    })();
    const average = mergeValueFromSeries(normalizedSeries);
    const slope = seriesSlope(normalizedSeries, Math.min(6, sampleWidth - 1));
    const volatility = seriesVolatility(normalizedSeries);
    const energy = clamp(
      normalizedValue * 0.44 + average * 0.18 + volatility * 0.24 + Math.abs(slope) * 0.14,
      0,
      1,
    );

    return {
      source,
      rawSeries,
      normalizedSeries,
      value: clamp(source.value, 0, 1),
      normalizedValue,
      average,
      floor,
      ceiling,
      span,
      slope,
      volatility,
      energy,
    };
  });

  const primary = sources[0]!;
  const secondary = sources[1] ?? primary;
  const rawSeries = averageSeries(sources.map((source) => source.rawSeries), sampleWidth);
  const normalizedSeries = averageSeries(sources.map((source) => source.normalizedSeries), sampleWidth);
  const spreadSeries = Array.from({ length: sampleWidth }, (_, index) => {
    const values = sources.map((source) => source.normalizedSeries[index] ?? source.normalizedValue);
    return clamp(Math.max(...values) - Math.min(...values), 0, 1);
  });
  const motionSeries = normalizedSeries.map((value, index) =>
    index === 0 ? 0 : Math.abs(value - (normalizedSeries[index - 1] ?? value))
  );
  const pulseSeries = normalizedSeries.map((value, index) =>
    clamp(value * 0.6 + motionSeries[index] * 0.18 + spreadSeries[index] * 0.22, 0, 1)
  );
  const current = last(normalizedSeries);
  const absolute = clamp(sources.reduce((sum, source) => sum + source.value, 0) / sources.length, 0, 1);
  const peak = clamp(Math.max(...sources.map((source) => source.value), current, absolute), 0, 1);
  const floor = Math.min(...normalizedSeries);
  const ceiling = Math.max(...normalizedSeries);
  const span = clamp(ceiling - floor, 0, 1);
  const slope = seriesSlope(normalizedSeries, Math.min(6, sampleWidth - 1));
  const previousSlope = seriesSlope(
    normalizedSeries.slice(0, Math.max(2, normalizedSeries.length - 2)),
    Math.min(6, sampleWidth - 1),
  );
  const jerk = clamp(slope - previousSlope, -1, 1);
  const volatility = clamp(
    mergeValueFromSeries(sources.map((source) => source.volatility)) * 0.55 + seriesVolatility(normalizedSeries) * 0.45,
    0,
    1,
  );
  const divergence = clamp(
    mergeValueFromSeries(sources.map((source) => Math.abs(source.normalizedValue - current))) * 1.4 +
      Math.abs(primary.normalizedValue - secondary.normalizedValue) * 0.25,
    0,
    1,
  );
  const imbalance = clamp(primary.normalizedValue - secondary.normalizedValue, -1, 1);
  const alertPressure = context.system.alerts.some((alert) => alert.severity === "alarm")
    ? 1
    : context.system.alerts.length > 0
    ? 0.76
    : 0;
  const activeCount = sources.filter((source) => source.energy >= 0.55 || source.value >= 0.62).length;
  const cadence = clamp(0.16 + volatility * 0.34 + Math.abs(slope) * 0.26 + divergence * 0.24, 0, 1);
  const density = clamp(
    0.18 + current * 0.34 + volatility * 0.24 + divergence * 0.12 + (activeCount / sources.length) * 0.12,
    0,
    1,
  );
  const hazard = clamp(
    Math.max(alertPressure, absolute * 0.24 + current * 0.28 + peak * 0.2 + volatility * 0.16 + divergence * 0.12),
    0,
    1,
  );
  const phase = context.phase +
    Math.round(current * 37 + volatility * 29 + divergence * 23 + absolute * 17 + activeCount * 7);
  const scan = moduloUnit(context.phase * 0.027 + current * 0.31 + volatility * 0.21 + divergence * 0.17);

  return {
    sources,
    primary,
    secondary,
    rawSeries,
    normalizedSeries,
    spreadSeries,
    motionSeries,
    pulseSeries,
    current,
    absolute,
    peak,
    floor,
    ceiling,
    span,
    slope,
    jerk,
    volatility,
    divergence,
    imbalance,
    cadence,
    density,
    hazard,
    alertPressure,
    activeCount,
    phase,
    scan,
  };
}

function renderCpuMonitor(context: RenderContext): PanelRender {
  const { system, width, height } = context;
  const drive = buildVisualizationDrive(context, Math.max(width, 48));
  const graphHeight = Math.max(4, height - 3);
  const graph = plotHistory(system.cpuHistory, Math.max(12, width), graphHeight, monitorGlyph(drive, "signal"));
  const topCores = system.cpuCores.slice().sort((a, b) => b.usage - a.usage).slice(0, 4)
    .map((core) => `CPU${core.label.padStart(2, "0")} ${core.usage.toFixed(0).padStart(3, " ")}%`)
    .join("  ");

  return {
    body: [
      `AVG ${system.cpuOverall.toFixed(1)}%   LOAD ${system.loadavg.map((value) => value.toFixed(2)).join(" / ")}`,
      graph,
      topCores || "NO CORE DATA",
    ].join("\n"),
    footer: `HOST ${system.hostname.toUpperCase()}  UPTIME ${formatDuration(system.uptimeSeconds)}  SURGE ${
      (drive.volatility * 100).toFixed(0)
    }%`,
    alert: alertText(context) || (drive.hazard >= 0.9 ? "CORE CASCADE RISK" : ""),
    accent: drive.hazard >= 0.9 ? "alarm" : system.cpuOverall >= 72 ? "amber" : "signal",
    severity: drive.hazard >= 0.9 ? "alarm" : severityForValue(system.cpuOverall, 72, 88),
  };
}

function renderCpuLegend(context: RenderContext): PanelRender {
  const drive = buildVisualizationDrive(context, 24);
  const lines = [
    `TOTAL  ${formatPercent(context.system.cpuOverall)}`,
    ...context.system.cpuCores.map((core) =>
      `${core.label.padStart(3, "0")} ${miniMeter(core.usage / 100, 6, drive.hazard)} ${formatPercent(core.usage)}`
    ),
  ];

  return {
    body: lines.join("\n"),
    footer: `CORES ${String(context.system.cpuCores.length).padStart(2, "0")}  LOAD ${
      (drive.current * 100).toFixed(0)
    }%`,
    alert: context.system.cpuOverall >= 88 ? "PULSE LIMIT" : drive.divergence >= 0.6 ? "CORE DESYNC" : "",
    accent: context.system.cpuOverall >= 88 ? "alarm" : drive.divergence >= 0.6 ? "amber" : "signal",
    severity: context.system.cpuOverall >= 88 ? "alarm" : drive.divergence >= 0.6 ? "warning" : "info",
  };
}

function renderGpuCombinedMonitor(context: RenderContext): PanelRender {
  const { system, width, height } = context;
  const drive = buildVisualizationDrive(context, Math.max(width, 48));
  if (!system.gpu.available) return renderGpuOfflinePanel("GPU FUSION OFFLINE", "violet");

  const graphHeight = Math.max(2, Math.floor((height - 5) / 2));
  const chipGraph = plotHistory(
    system.gpuUtilizationHistory,
    Math.max(12, width),
    graphHeight,
    monitorGlyph(drive, "violet"),
  );
  const memoryGraph = plotHistory(
    system.gpuMemoryHistory,
    Math.max(12, width),
    graphHeight,
    monitorGlyph(drive, "phosphor"),
  );
  return {
    body: [
      crop(system.gpu.name.toUpperCase(), width),
      `CHIP ${formatPercent(system.gpu.utilizationPercent)} ${
        miniMeter(system.gpu.utilizationPercent / 100, 12, drive.hazard)
      }`,
      chipGraph,
      `VRAM ${formatPercent(system.gpu.memoryPercent)} ${formatBytes(system.gpu.memoryUsed)} / ${
        formatBytes(system.gpu.memoryTotal)
      }`,
      memoryGraph,
      `TEMP ${formatNullable(system.gpu.temperatureCelsius, "C")}  POWER ${formatNullable(system.gpu.powerWatts, "W")}`,
    ].join("\n"),
    footer: `GPU FUSION  GFX ${formatNullable(system.gpu.graphicsClockMhz, "MHz")}  MEMCLK ${
      formatNullable(system.gpu.memoryClockMhz, "MHz")
    }`,
    alert: gpuAlert(context),
    accent: gpuAccent(system.gpu.utilizationPercent, system.gpu.memoryPercent, true),
    severity: gpuSeverity(system.gpu.utilizationPercent, system.gpu.memoryPercent),
  };
}

function renderGpuChipMonitor(context: RenderContext): PanelRender {
  const { system, width, height } = context;
  const drive = buildVisualizationDrive(context, Math.max(width, 40));
  if (!system.gpu.available) return renderGpuOfflinePanel("GPU CHIP OFFLINE", "violet");

  const graphHeight = Math.max(3, height - 5);
  const graph = plotHistory(
    system.gpuUtilizationHistory,
    Math.max(12, width),
    graphHeight,
    monitorGlyph(drive, "violet"),
  );
  const pulse = gpuPulseGlyphs(
    system.gpu.utilizationPercent / 100,
    Math.min(18, Math.max(8, width - 14)),
    drive.hazard,
  );
  return {
    body: [
      `${crop(system.gpu.name.toUpperCase(), Math.max(8, width - 8))} CORE`,
      `UTIL ${formatPercent(system.gpu.utilizationPercent)} ${pulse}`,
      graph,
      `TEMP ${formatNullable(system.gpu.temperatureCelsius, "C")}  POWER ${formatNullable(system.gpu.powerWatts, "W")}`,
      `GFX ${formatNullable(system.gpu.graphicsClockMhz, "MHz")}  MEMORY ${
        formatNullable(system.gpu.memoryClockMhz, "MHz")
      }`,
    ].join("\n"),
    footer: `CHIP BUS  VOLATILITY ${(drive.volatility * 100).toFixed(0)}%  SURGE ${
      (Math.max(0, drive.slope) * 100).toFixed(0)
    }%`,
    alert: system.gpu.utilizationPercent >= 95
      ? "GPU EXECUTION WALL"
      : drive.volatility >= 0.58
      ? "GPU PULSE SHEAR"
      : "",
    accent: gpuAccent(system.gpu.utilizationPercent, 0, true),
    severity: gpuSeverity(system.gpu.utilizationPercent, 0),
  };
}

function renderGpuMemoryMonitor(context: RenderContext): PanelRender {
  const { system, width, height } = context;
  const drive = buildVisualizationDrive(context, Math.max(width, 40));
  if (!system.gpu.available) return renderGpuOfflinePanel("GPU MEMORY OFFLINE", "phosphor");

  const bankCount = Math.max(4, Math.min(12, Math.floor(width / 5)));
  const banks = Array.from({ length: bankCount }, (_, index) => {
    const phaseShift = Math.sin(context.phase * 0.11 + index * 0.9) * 0.06;
    return clamp(system.gpu.memoryPercent / 100 + phaseShift, 0, 1);
  });
  const bankRows = barChart(banks, bankCount * 3, Math.max(3, Math.min(8, height - 5)), [" ", "░", "▒", "▓", "█"]);
  return {
    body: [
      `VRAM ${formatPercent(system.gpu.memoryPercent)} ${miniMeter(system.gpu.memoryPercent / 100, 14, drive.hazard)}`,
      `${formatBytes(system.gpu.memoryUsed)} USED`,
      `${formatBytes(Math.max(0, system.gpu.memoryTotal - system.gpu.memoryUsed))} FREE`,
      bankRows,
      `TOTAL ${formatBytes(system.gpu.memoryTotal)}  MEMCLK ${formatNullable(system.gpu.memoryClockMhz, "MHz")}`,
    ].join("\n"),
    footer: `VRAM BANKS ${bankCount}  FRAGMENT ${(drive.divergence * 100).toFixed(0)}%`,
    alert: system.gpu.memoryPercent >= 92
      ? "VRAM CAPACITY WALL"
      : system.gpu.memoryPercent >= 78
      ? "VRAM PRESSURE"
      : "",
    accent: gpuAccent(0, system.gpu.memoryPercent, true),
    severity: gpuSeverity(0, system.gpu.memoryPercent),
  };
}

function renderMemoryMonitor(context: RenderContext): PanelRender {
  const { system, width, height } = context;
  const drive = buildVisualizationDrive(context, Math.max(width, 48));
  const graphWidth = Math.max(12, width);
  const graphHeight = Math.max(3, Math.floor((height - 4) / 2));
  const memoryGraph = plotHistory(system.memoryHistory, graphWidth, graphHeight, monitorGlyph(drive, "phosphor"));
  const swapGraph = plotHistory(
    system.swapHistory,
    graphWidth,
    graphHeight,
    drive.hazard >= 0.88 ? "█" : monitorGlyph(drive, "amber"),
  );

  return {
    body: [
      `RAM  ${formatPercent(system.memory.percent)}  USED ${formatBytes(system.memory.used)}  AVAIL ${
        formatBytes(system.memory.available)
      }`,
      memoryGraph,
      `SWAP ${formatPercent(system.memory.swapPercent)}  USED ${formatBytes(system.memory.swapUsed)} / ${
        formatBytes(system.memory.swapTotal)
      }`,
      swapGraph,
    ].join("\n"),
    footer: `OS ${system.osRelease}  RANGE ${(drive.span * 100).toFixed(0)}%`,
    alert: system.memory.percent >= 90
      ? "MEMORY SATURATION EVENT"
      : system.memory.swapPercent >= 90
      ? "SWAP CRITICAL EVENT"
      : drive.volatility >= 0.52
      ? "MEMORY SHEAR DETECTED"
      : "",
    accent: system.memory.percent >= 90 || system.memory.swapPercent >= 90
      ? "alarm"
      : system.memory.percent >= 75
      ? "amber"
      : "phosphor",
    severity: system.memory.percent >= 90 || system.memory.swapPercent >= 90
      ? "alarm"
      : system.memory.percent >= 75
      ? "warning"
      : "info",
  };
}

function renderTemperatureMonitor(context: RenderContext): PanelRender {
  const drive = buildVisualizationDrive(context, 24);
  const temperatures = context.system.temperatures;
  return {
    body: temperatures.length === 0
      ? "NO THERMAL ZONES REPORTED"
      : temperatures.slice(0, Math.max(1, context.height)).map((entry) =>
        `${entry.label.toUpperCase().padEnd(18, " ")} ${entry.celsius.toFixed(1).padStart(6, " ")}C ${
          heatMeter(entry.celsius / 100, drive.hazard)
        }`
      ).join("\n"),
    footer: temperatures[0]
      ? `HOTTEST ${temperatures[0].label.toUpperCase()} ${temperatures[0].celsius.toFixed(1)}C  FLUX ${
        (drive.volatility * 100).toFixed(0)
      }%`
      : "THERMAL BUS OFFLINE",
    alert: temperatures[0]?.celsius >= 82 ? "THERMAL LIMIT ALERT" : "",
    accent: temperatures[0]?.celsius >= 82 ? "alarm" : temperatures[0]?.celsius >= 70 ? "amber" : "violet",
    severity: temperatures[0]?.celsius >= 82 ? "alarm" : temperatures[0]?.celsius >= 70 ? "warning" : "info",
  };
}

function renderDiskMonitor(context: RenderContext): PanelRender {
  const drive = buildVisualizationDrive(context, 32);
  const disks = context.system.disks;
  return {
    body: disks.length === 0
      ? "NO DISK METRICS AVAILABLE"
      : disks.slice(0, Math.max(1, context.height)).map((disk) =>
        `${crop(disk.mount.toUpperCase(), 12).padEnd(12, " ")} ${String(disk.percent).padStart(3, " ")}% ${
          miniMeter(disk.percent / 100, 7, drive.hazard)
        } ${formatBytes(disk.available).padStart(8, " ")} FREE`
      ).join("\n"),
    footer: disks[0]
      ? `FULL ${disks[0].mount.toUpperCase()} ${disks[0].percent}%  ${formatBytes(disks[0].used)} / ${
        formatBytes(disks[0].total)
      }`
      : "FILESYSTEM BUS IDLE",
    alert: disks[0]?.percent >= 95 ? "CAPACITY WALL IMMINENT" : disks[0]?.percent >= 85 ? "DISK PRESSURE WARNING" : "",
    accent: disks[0]?.percent >= 95 ? "alarm" : disks[0]?.percent >= 85 ? "amber" : "amber",
    severity: disks[0]?.percent >= 95 ? "alarm" : disks[0]?.percent >= 85 ? "warning" : "info",
  };
}

function renderNetworkMonitor(context: RenderContext): PanelRender {
  const { system, width, height } = context;
  const drive = buildVisualizationDrive(context, Math.max(width, 48));
  const graphHeight = Math.max(3, height - 4);
  const rx = plotHistory(system.rxHistory, Math.max(12, width), graphHeight, monitorGlyph(drive, "signal"));
  const tx = plotHistory(system.txHistory, Math.max(12, width), graphHeight, monitorGlyph(drive, "amber"));

  return {
    body: [
      `RX BUS`,
      rx,
      `TX BUS`,
      tx,
      ...system.networks.slice(0, 2).map((network) =>
        `${network.name.toUpperCase()} ${formatRate(network.rxRate)}↓ ${formatRate(network.txRate)}↑`
      ),
    ].join("\n"),
    footer: system.networks[0]
      ? `${system.networks[0].name.toUpperCase()} ${system.networks[0].addresses[0] ?? "NO ADDRESS"}  BURST ${
        (drive.volatility * 100).toFixed(0)
      }%`
      : "NO ACTIVE INTERFACES",
    alert: networkAlert(context),
    accent: context.system.networks[0] &&
        (context.system.networks[0].rxRate + context.system.networks[0].txRate) > 125_000_000
      ? "amber"
      : "signal",
    severity: context.system.networks[0] &&
        (context.system.networks[0].rxRate + context.system.networks[0].txRate) > 125_000_000
      ? "warning"
      : "info",
  };
}

function renderProcessMonitor(context: RenderContext): PanelRender {
  const drive = buildVisualizationDrive(context, 24);
  const header = "PID     NAME             CPU%   MEM%";
  const rows = context.system.processes.slice(0, 100).map((process) =>
    `${String(process.pid).padEnd(7, " ")}${crop(process.name, 16).padEnd(16, " ")}${
      process.cpuPercent.toFixed(1).padStart(6, " ")
    }${process.memoryPercent.toFixed(1).padStart(7, " ")}`
  );

  return {
    body: [header, ...rows].join("\n"),
    footer: context.system.processes[0]
      ? `HOT ${context.system.processes[0].name.toUpperCase()} ${
        context.system.processes[0].cpuPercent.toFixed(1)
      }% CPU  TOP ${Math.min(100, context.system.processes.length)}  RISE ${
        (Math.max(0, drive.slope) * 100).toFixed(0)
      }%`
      : "PROCESS TABLE EMPTY",
    alert: context.system.processes[0]?.cpuPercent >= 90 ? "PROCESS SPIKE DETECTED" : "",
    accent: context.system.processes[0]?.cpuPercent >= 90 ? "alarm" : "amber",
    severity: context.system.processes[0]?.cpuPercent >= 90 ? "alarm" : "info",
  };
}

function renderThreeScene(context: RenderContext, mode: ThreeSceneMode, accent: Accent): PanelRender {
  const drive = buildVisualizationDrive(context, Math.max(32, context.width));
  const severity = drive.hazard >= 0.88 ? "alarm" : drive.hazard >= 0.7 ? "warning" : "info";
  const headerAlert = sceneAlert(context.sources) || driveAlert(drive);

  return {
    body: renderThreeFallbackBody(context, drive, mode),
    footer: sourceDetailFooter(context.sources),
    alert: headerAlert,
    accent: severity === "alarm" ? "alarm" : severity === "warning" ? "amber" : accent,
    severity,
    three: {
      mode,
      signal: driveThreeSignal(context, drive, mode),
    },
  };
}

function renderThreeFallbackBody(context: RenderContext, drive: VisualizationDrive, mode: ThreeSceneMode) {
  const width = Math.max(12, context.width);
  const infoLines = [
    crop(`${modeLabel(mode)} DRIVE ${Math.round(drive.hazard * 100)}%  Δ${Math.round(drive.divergence * 100)}`, width),
  ];

  if (context.height >= 6) {
    infoLines.push(crop(sourceNameMatrix(context.sources), width));
  }

  const chartHeight = Math.max(2, context.height - infoLines.length);
  const chart = (() => {
    switch (mode) {
      case "lattice":
      case "solenoid":
        return signalChart(drive.pulseSeries, width, chartHeight, drive.hazard >= 0.78 ? "█" : "▇");
      case "atfield":
      case "capture":
        return harmonicField(width, chartHeight, drive, monitorGlyph(drive, "violet"));
      case "hexshell":
        return heatmap(width, chartHeight, drive, THREE_FALLBACK_BLOCKS);
      case "mapslab":
        return routeBoard(width, chartHeight, drive, THREE_FALLBACK_BLOCKS);
      case "studio":
        return harmonicField(width, chartHeight, drive, "◆");
    }
  })();

  return [...infoLines, chart].join("\n");
}

function renderWarningStack(context: RenderContext): PanelRender {
  const drive = buildVisualizationDrive(context, 24);
  const alerts = context.system.alerts.length > 0
    ? context.system.alerts.map((alert) => `${alert.title}  ${alert.detail}`)
    : sourceWarnings(context.sources, drive);

  return {
    body: alerts.slice(0, Math.max(1, context.height)).join("\n"),
    footer: sourceFooter(context.sources),
    alert: alertText(context) || driveAlert(drive),
    accent: drive.hazard >= 0.88 ? "alarm" : "amber",
    severity: drive.hazard >= 0.88 ? "alarm" : "warning",
  };
}

function renderCounterBoard(context: RenderContext): PanelRender {
  const now = new Date();
  const primary = context.sources[0] ?? fallbackSource(context.phase);
  const drive = buildVisualizationDrive(context, 24);
  return {
    body: [
      `CLOCK      ${now.toLocaleTimeString("en-US", { hour12: false })}`,
      `COUNTDOWN  ${neonFormatCountdown(drive.phase)}`,
      `SEQUENCE   ${String(drive.phase).padStart(6, "0")}`,
      `PRIMARY    ${primary.name.toUpperCase()}`,
      `AMPLITUDE  ${(drive.current * 100).toFixed(1).padStart(5, " ")}%`,
      `VELOCITY   ${(Math.abs(drive.slope) * 100).toFixed(1).padStart(5, " ")}%`,
      `VECTOR     ${sourceNameMatrix(context.sources)}`,
    ].join("\n"),
    footer: sourceFooter(context.sources),
    alert: drive.hazard >= 0.92 ? "SOURCE DRIVE MAXIMUM" : drive.divergence >= 0.64 ? "VECTOR SEPARATION" : "",
    accent: drive.hazard >= 0.92 ? "alarm" : primary.accent,
    severity: drive.hazard >= 0.92 ? "alarm" : drive.divergence >= 0.64 ? "warning" : "info",
  };
}

function renderProfileCard(context: RenderContext): PanelRender {
  const primary = context.sources[0] ?? fallbackSource(context.phase);
  const secondary = context.sources[1];
  const drive = buildVisualizationDrive(context, 24);
  const confidence = Math.round(drive.current * 100);
  return {
    body: [
      "SIGNAL PROFILE",
      `PRIMARY   ${primary.name.toUpperCase()}`,
      `SECONDARY ${secondary ? secondary.name.toUpperCase() : "NONE"}`,
      `SYNC      ${confidence.toString().padStart(3, " ")}%`,
      `DELTA     ${(drive.divergence * 100).toFixed(0).padStart(3, " ")}%`,
      `STATUS    ${drive.hazard >= 0.86 ? "OVERTAKEN" : confidence >= 60 ? "LIVE" : "STABLE"}`,
      `BIND      ${context.slot.id.toUpperCase()}`,
    ].join("\n"),
    footer: sourceFooter(context.sources),
    alert: confidence >= 90 ? "SYNC THRESHOLD EXCEEDED" : drive.divergence >= 0.62 ? "CHANNEL SPLIT DETECTED" : "",
    accent: confidence >= 90 ? "alarm" : "violet",
    severity: confidence >= 90 ? "alarm" : drive.divergence >= 0.62 ? "warning" : confidence >= 70 ? "warning" : "info",
  };
}

function renderLiveFeed(context: RenderContext): PanelRender {
  const width = Math.max(16, context.width);
  const height = Math.max(6, context.height);
  const drive = buildVisualizationDrive(context, Math.max(width, 32));
  const noise = liveFeed(width, height, drive);
  return {
    body: noise,
    footer: sourceFooter(context.sources),
    alert: alertText(context) || driveAlert(drive),
    accent: "alarm",
    severity: drive.hazard >= 0.88 ? "alarm" : "warning",
  };
}

function renderEventLog(context: RenderContext): PanelRender {
  const drive = buildVisualizationDrive(context, 24);
  const lines = [
    ...context.system.alerts.map((alert, index) => `${String(223229 + index * 17)}  ${alert.title} ${alert.detail}`),
    ...context.sources.flatMap((source, index) =>
      source.detailLines.slice(0, 2).map((line, detailIndex) =>
        `${String(223500 + index * 31 + detailIndex * 7)}  ${source.name.toUpperCase()} ${line}`
      )
    ),
    `${String(224100 + Math.round(drive.phase % 800))}  VECTOR DRIVE ${(drive.current * 100).toFixed(0)}%`,
    `${String(224280 + Math.round(drive.divergence * 100))}  PHASE SLEW ${(drive.volatility * 100).toFixed(0)}%`,
  ];

  return {
    body: lines.slice(0, Math.max(1, context.height)).join("\n"),
    footer: sourceFooter(context.sources),
    alert: alertText(context) || driveAlert(drive),
    accent: drive.hazard >= 0.88 ? "alarm" : context.system.alerts.length > 0 ? "amber" : "signal",
    severity: drive.hazard >= 0.88 ? "alarm" : context.system.alerts.length > 0 ? "warning" : "info",
  };
}

function renderChannelMatrix(context: RenderContext): PanelRender {
  const drive = buildVisualizationDrive(context, Math.max(24, context.width));
  return {
    body: channelMatrix(Math.max(18, context.width), Math.max(4, context.height), drive),
    footer: sourceFooter(context.sources),
    alert: alertText(context) || driveAlert(drive),
    accent: drive.hazard >= 0.88 ? "alarm" : "phosphor",
    severity: drive.hazard >= 0.88 ? "alarm" : drive.volatility >= 0.58 ? "warning" : "info",
  };
}

function renderTelemetryRack(context: RenderContext): PanelRender {
  const drive = buildVisualizationDrive(context, Math.max(24, context.width));
  return {
    body: telemetryRack(Math.max(12, context.width), Math.max(4, context.height), drive),
    footer: sourceFooter(context.sources),
    alert: alertText(context) || driveAlert(drive),
    accent: drive.hazard >= 0.88 ? "alarm" : hottestAccent(context.sources),
    severity: drive.hazard >= 0.88 ? "alarm" : drive.hazard >= 0.7 ? "warning" : "info",
  };
}

function renderBiosignalStrip(context: RenderContext): PanelRender {
  const drive = buildVisualizationDrive(context, Math.max(24, context.width));
  return {
    body: biosignalStrip(Math.max(18, context.width), Math.max(4, context.height), drive),
    footer: sourceFooter(context.sources),
    alert: alertText(context) || driveAlert(drive),
    accent: "phosphor",
    severity: drive.hazard >= 0.92 ? "alarm" : drive.volatility >= 0.54 ? "warning" : "info",
  };
}

function renderHarmonicGraph(context: RenderContext): PanelRender {
  const drive = buildVisualizationDrive(context, Math.max(24, context.width));
  return {
    body: harmonicField(Math.max(18, context.width), Math.max(4, context.height), drive, monitorGlyph(drive, "violet")),
    footer: sourceFooter(context.sources),
    alert: alertText(context) || driveAlert(drive),
    accent: "violet",
    severity: drive.hazard >= 0.92 ? "alarm" : drive.hazard >= 0.7 ? "warning" : "info",
  };
}

function renderPsychograph(context: RenderContext): PanelRender {
  const drive = buildVisualizationDrive(context, Math.max(24, context.width));
  return {
    body: psychograph(Math.max(18, context.width), Math.max(4, context.height), drive, monitorGlyph(drive, "amber")),
    footer: sourceFooter(context.sources),
    alert: alertText(context) || driveAlert(drive),
    accent: "amber",
    severity: drive.hazard >= 0.88 ? "warning" : "info",
  };
}

function renderFieldRing(context: RenderContext): PanelRender {
  const drive = buildVisualizationDrive(context, Math.max(24, context.width));
  return {
    body: circularField(Math.max(18, context.width), Math.max(4, context.height), drive),
    footer: sourceFooter(context.sources),
    alert: alertText(context) || driveAlert(drive),
    accent: "signal",
    severity: drive.hazard >= 0.88 ? "warning" : "info",
  };
}

function renderHeatmap(context: RenderContext): PanelRender {
  const drive = buildVisualizationDrive(context, Math.max(24, context.width));
  return {
    body: heatmap(Math.max(16, context.width), Math.max(4, context.height), drive, THREE_FALLBACK_BLOCKS),
    footer: sourceFooter(context.sources),
    alert: alertText(context) || driveAlert(drive),
    accent: "amber",
    severity: drive.hazard >= 0.88 ? "warning" : "info",
  };
}

function renderMagiBoard(context: RenderContext): PanelRender {
  const drive = buildVisualizationDrive(context, 24);
  const balthasar = drive.current >= 0.84 ? "OVERRIDE" : drive.current >= 0.62 ? "REVIEW" : "HOLD";
  const melchior = drive.divergence >= 0.62 ? "REJECT" : drive.hazard >= 0.82 ? "CAUTION" : "TRACK";
  const casper = drive.volatility >= 0.54 ? "REROUTE" : drive.slope >= 0.18 ? "PURSUE" : "STABLE";
  return {
    body: [
      "╭──── BALTHASAR-2 ────╮",
      `│ ${balthasar.padEnd(18, " ")}│`,
      `│ ${casper.padEnd(8, " ")} / ${melchior.padEnd(7, " ")} │`,
      "╰── CASPER-3 ── MELCHIOR-1 ─╯",
    ].join("\n"),
    footer: sourceFooter(context.sources),
    alert: drive.hazard >= 0.88 ? "MAGI CONFLICT STATE" : drive.divergence >= 0.62 ? "TRIPLE-VOTE SPLIT" : "",
    accent: drive.hazard >= 0.88 ? "alarm" : drive.divergence >= 0.62 ? "amber" : "phosphor",
    severity: drive.hazard >= 0.88 ? "alarm" : drive.divergence >= 0.62 ? "warning" : "info",
  };
}

function renderRouteBoard(context: RenderContext): PanelRender {
  const drive = buildVisualizationDrive(context, Math.max(24, context.width));
  return {
    body: routeBoard(Math.max(14, context.width), Math.max(4, context.height), drive, THREE_FALLBACK_BLOCKS),
    footer: sourceFooter(context.sources),
    alert: alertText(context) || driveAlert(drive),
    accent: "alarm",
    severity: drive.hazard >= 0.9 ? "alarm" : drive.divergence >= 0.58 ? "warning" : "info",
  };
}

function renderGateStatus(context: RenderContext): PanelRender {
  const drive = buildVisualizationDrive(context, 24);
  return {
    body: [
      drive.current >= 0.86 ? "LOCKED    DRIVE CHANNEL HELD CLOSED" : "LOCKED    WAITING FOR PERMISSION KEY",
      drive.divergence >= 0.58 ? "PURGE     OUTER GATE FORCE-CYCLE" : "OPEN      OUTER AND LOCK GATE IMMEDIATELY",
      drive.hazard >= 0.92 ? "REJECT    EMERGENCY DIRECTION REFUSAL" : "REFUSED   ENTRY PLUG DIRECTION CHECK",
    ].join("\n"),
    footer: sourceFooter(context.sources),
    alert: drive.hazard >= 0.92 ? "DIRECTION REFUSAL STATE" : drive.divergence >= 0.58 ? "GATE RECONFIGURATION" : "",
    accent: drive.hazard >= 0.92 ? "alarm" : drive.hazard >= 0.75 ? "amber" : "signal",
    severity: drive.hazard >= 0.92 ? "alarm" : drive.hazard >= 0.75 ? "warning" : "info",
  };
}

function renderTacticalMap(context: RenderContext): PanelRender {
  const drive = buildVisualizationDrive(context, Math.max(24, context.width));
  return {
    body: tacticalMap(Math.max(18, context.width), Math.max(4, context.height), drive),
    footer: sourceFooter(context.sources),
    alert: alertText(context) || driveAlert(drive),
    accent: "phosphor",
    severity: drive.hazard >= 0.88 ? "warning" : "info",
  };
}

function renderNetworkTopology(context: RenderContext): PanelRender {
  const drive = buildVisualizationDrive(context, Math.max(24, context.width));
  return {
    body: networkTopology(Math.max(18, context.width), Math.max(4, context.height), drive),
    footer: sourceFooter(context.sources),
    alert: alertText(context) || driveAlert(drive),
    accent: "amber",
    severity: drive.hazard >= 0.88 ? "warning" : "info",
  };
}

function renderComponentIndex(context: RenderContext): PanelRender {
  const drive = buildVisualizationDrive(context, Math.max(24, context.width));
  return {
    body: componentIndex(Math.max(18, context.width), Math.max(4, context.height), drive),
    footer: sourceFooter(context.sources),
    alert: drive.hazard >= 0.92 ? "SUITE SATURATION" : "",
    accent: "amber",
    severity: drive.hazard >= 0.92 ? "warning" : "info",
  };
}

const THREE_FALLBACK_BLOCKS = [" ", "▁", "▂", "▃", "▄", "▅", "▆", "▇", "█"] as const;

function modeLabel(mode: ThreeSceneMode) {
  switch (mode) {
    case "lattice":
      return "LATTICE";
    case "atfield":
      return "AT-FIELD";
    case "hexshell":
      return "HEX SHELL";
    case "capture":
      return "CAPTURE";
    case "mapslab":
      return "MAP SLAB";
    case "solenoid":
      return "SOLENOID";
    case "studio":
      return "ACEROLA";
  }
}

function fallbackSource(phase: number): SourceFrame {
  return {
    id: "fallback",
    name: "Fallback Pulse",
    accent: "signal",
    value: (Math.sin(phase * 0.18) + 1) / 2,
    series: Array.from({ length: 48 }, (_, index) => (Math.sin((phase + index) * 0.18) + 1) / 2),
    detailLines: ["FALLBACK SOURCE"],
  };
}

function monitorGlyph(drive: VisualizationDrive, accent: Accent) {
  if (drive.hazard >= 0.9) {
    return "█";
  }
  if (drive.volatility >= 0.52) {
    return accent === "amber" ? "▓" : accent === "violet" ? "◆" : "▒";
  }
  return accent === "alarm" ? "╳" : accent === "amber" ? "■" : accent === "violet" ? "◆" : "●";
}

function miniMeter(value: number, width: number, heat: number) {
  const ramp = heat >= 0.9 ? "█" : heat >= 0.72 ? "▓" : "▒";
  const fill = Math.round(clamp(value, 0, 1) * width);
  return `[${ramp.repeat(fill).padEnd(width, "·")}]`;
}

function heatMeter(value: number, heat: number) {
  const width = heat >= 0.9 ? 5 : 4;
  return miniMeter(value, width, heat);
}

function gpuPulseGlyphs(value: number, width: number, heat: number) {
  const fill = Math.round(clamp(value, 0, 1) * width);
  const active = heat >= 0.85 ? "◆" : "◇";
  return active.repeat(fill).padEnd(width, "·");
}

function renderGpuOfflinePanel(message: string, accent: Accent): PanelRender {
  return {
    body: [
      message,
      "NVIDIA-SMI TELEMETRY NOT AVAILABLE",
      "GPU PANEL WILL AUTO-LINK WHEN DRIVER METRICS APPEAR",
    ].join("\n"),
    footer: "GPU BUS OFFLINE",
    alert: "",
    accent,
    severity: "info",
  };
}

function gpuAccent(utilization: number, memory: number, available: boolean): Accent {
  if (!available) return "violet";
  const pressure = Math.max(utilization, memory);
  return pressure >= 92 ? "alarm" : pressure >= 75 ? "amber" : memory > utilization ? "phosphor" : "violet";
}

function gpuSeverity(utilization: number, memory: number): Severity {
  const pressure = Math.max(utilization, memory);
  return pressure >= 92 ? "alarm" : pressure >= 75 ? "warning" : "info";
}

function gpuAlert(context: RenderContext) {
  const { gpu } = context.system;
  if (!gpu.available) return "";
  if (gpu.memoryPercent >= 92) return "VRAM LIMIT";
  if (gpu.utilizationPercent >= 95) return "GPU EXECUTION WALL";
  if ((gpu.temperatureCelsius ?? 0) >= 84) return "GPU THERMAL LIMIT";
  return "";
}

function formatNullable(value: number | null, suffix: string) {
  return value === null ? "--" : `${value.toFixed(value >= 100 ? 0 : 1)}${suffix}`;
}

function alertText(context: RenderContext) {
  const alert = context.system.alerts[0];
  return alert ? `${alert.title} / ${alert.detail}` : "";
}

function driveAlert(drive: VisualizationDrive) {
  if (drive.hazard >= 0.92) {
    return "LIMIT CASCADE";
  }
  if (drive.divergence >= 0.66) {
    return "CHANNEL FRACTURE";
  }
  if (drive.volatility >= 0.58) {
    return "OSCILLATION SPIKE";
  }
  if (drive.slope >= 0.24) {
    return "SURGE FRONT";
  }
  return "";
}

function networkAlert(context: RenderContext) {
  const network = context.system.networks[0];
  if (!network) {
    return "";
  }
  const totalRate = network.rxRate + network.txRate;
  return totalRate > 125_000_000 ? `${network.name.toUpperCase()} SURGE ABOVE ${formatRate(totalRate)}` : "";
}

function severityForValue(value: number, warning: number, alarm: number): Severity {
  if (value >= alarm) {
    return "alarm";
  }
  if (value >= warning) {
    return "warning";
  }
  return "info";
}

function hottestAccent(sources: SourceFrame[]) {
  if (sources.some((source) => source.accent === "alarm")) {
    return "alarm";
  }
  if (sources.some((source) => source.accent === "amber")) {
    return "amber";
  }
  return sources[0]?.accent ?? "signal";
}

function sourceFooter(sources: SourceFrame[]) {
  return `SRC ${sources.map((source) => crop(source.name.toUpperCase(), 12)).join(" + ") || "NONE"}`;
}

function sourceDetailFooter(sources: SourceFrame[]) {
  const details = sources.slice(0, 2).map((source) => {
    const detail = source.detailLines[0] ?? `${Math.round(source.value * 100)}%`;
    return `${crop(source.name.toUpperCase(), 8)} ${crop(detail, 20)}`;
  });
  return details.join(" / ") || sourceFooter(sources);
}

function sceneAlert(sources: SourceFrame[]) {
  const hottest = sources.find((source) => source.accent === "alarm") ??
    sources.find((source) => source.accent === "amber");
  if (!hottest) {
    return "";
  }

  return hottest.accent === "alarm"
    ? `${crop(hottest.name.toUpperCase(), 10)} CRIT`
    : `${crop(hottest.name.toUpperCase(), 10)} WARN`;
}

function driveThreeSignal(context: RenderContext, drive: VisualizationDrive, mode: ThreeSceneMode): ThreeSceneSignal {
  const modeBias = modeTwist(mode);
  const wobble = Math.sin((drive.phase + modeBias.phase) * modeBias.speed);
  const twist = clamp(
    drive.imbalance * 1.2 + wobble * modeBias.offset * (0.6 + drive.divergence * 0.8),
    -1,
    1,
  );
  const lift = clamp(
    drive.slope * 1.7 + drive.jerk * 0.55 + modeBias.lift * (drive.current - 0.5) + Math.cos(drive.phase * 0.09) * 0.12,
    -1,
    1,
  );
  const pulse = clamp(0.12 + drive.current * 0.3 + drive.volatility * 0.2 + drive.hazard * 0.38, 0.12, 1);
  const depth = clamp(0.14 + drive.absolute * 0.24 + drive.divergence * 0.16 + drive.hazard * 0.34, 0.12, 0.98);

  return {
    x: clamp(0.5 + twist * 0.22 + Math.sin((drive.phase + modeBias.phase) * 0.04) * drive.cadence * 0.08, 0, 1),
    y: clamp(0.5 - lift * 0.22 + Math.cos((drive.phase + modeBias.phase) * 0.05) * drive.volatility * 0.07, 0, 1),
    depth,
    twist,
    lift,
    pulse,
    active: pulse > 0.18 || drive.activeCount > 0,
    pressed: context.system.alerts.some((alert) => alert.severity === "alarm") || drive.hazard >= 0.9,
  };
}

function modeTwist(mode: ThreeSceneMode) {
  switch (mode) {
    case "lattice":
      return { phase: 0, speed: 0.12, offset: 0.18, lift: 0.32 };
    case "atfield":
      return { phase: 5, speed: 0.1, offset: 0.24, lift: 0.24 };
    case "hexshell":
      return { phase: 9, speed: 0.08, offset: 0.2, lift: 0.5 };
    case "capture":
      return { phase: 13, speed: 0.11, offset: 0.26, lift: 0.18 };
    case "mapslab":
      return { phase: 17, speed: 0.07, offset: 0.14, lift: 0.58 };
    case "solenoid":
      return { phase: 21, speed: 0.14, offset: 0.22, lift: 0.28 };
    case "studio":
      return { phase: 25, speed: 0.09, offset: 0.3, lift: 0.2 };
  }
}

function sourceWarnings(sources: SourceFrame[], drive: VisualizationDrive) {
  return [
    ...sources.flatMap((source) => source.detailLines.map((line) => `${source.name.toUpperCase()}  ${line}`)),
    `VECTOR DRIVE ${(drive.current * 100).toFixed(0)}%`,
    `OSCILLATION ${(drive.volatility * 100).toFixed(0)}%`,
    drive.divergence >= 0.6
      ? `CHANNEL SPLIT ${(drive.divergence * 100).toFixed(0)}%`
      : `DENSITY ${(drive.density * 100).toFixed(0)}%`,
  ].slice(0, 4);
}

function sourceNameMatrix(sources: SourceFrame[]) {
  return sources.map((source) => crop(source.name.toUpperCase(), 8)).join(" / ");
}

function averageSeries(series: number[][], width: number) {
  if (series.length === 0) {
    return Array.from({ length: width }, () => 0);
  }
  return Array.from(
    { length: width },
    (_, index) => clamp(series.reduce((sum, values) => sum + (values[index] ?? 0), 0) / series.length, 0, 1),
  );
}

function sampleSeries(values: number[], width: number) {
  if (width <= 0) {
    return [];
  }
  if (values.length === 0) {
    return Array.from({ length: width }, () => 0);
  }
  return Array.from({ length: width }, (_, index) => {
    const ratio = width === 1 ? 0 : index / (width - 1);
    const position = Math.round(ratio * (values.length - 1));
    return clamp(values[position] ?? 0, 0, 1);
  });
}

function plotHistory(values: number[], width: number, height: number, glyph: string) {
  return signalChart(sampleSeries(values, width), width, height, glyph);
}

function barChart(values: number[], width: number, height: number, glyphs: readonly string[]) {
  const columns = sampleSeries(values, width);
  const matrix = createMatrix(width, height, " ");
  for (let x = 0; x < width; x += 1) {
    const filled = Math.max(1, Math.round((columns[x] ?? 0) * height));
    for (let row = 0; row < height; row += 1) {
      const fromBottom = height - row;
      if (fromBottom <= filled) {
        const normalized = clamp(fromBottom / Math.max(1, filled), 0, 1);
        const glyphIndex = Math.min(glyphs.length - 1, Math.max(1, Math.ceil(normalized * (glyphs.length - 1))));
        setCell(matrix, x, row, glyphs[glyphIndex] ?? glyphs[glyphs.length - 1] ?? "#");
      }
    }
  }
  return renderMatrix(matrix);
}

function signalChart(values: number[], width: number, height: number, glyph: string) {
  const sampled = sampleSeries(values, width);
  const matrix = createMatrix(width, height, " ");
  const threshold = Math.floor(height / 2);
  for (let x = 0; x < width; x += 1) {
    setCell(matrix, x, threshold, "─");
  }
  let previousY = threshold;
  for (let x = 0; x < width; x += 1) {
    const y = Math.round((1 - (sampled[x] ?? 0)) * Math.max(0, height - 1));
    if (x > 0) {
      drawLine(matrix, x - 1, previousY, x, y, glyph);
    }
    setCell(matrix, x, y, glyph);
    previousY = y;
  }
  return renderMatrix(matrix);
}

function telemetryRack(width: number, height: number, drive: VisualizationDrive) {
  const lines: string[] = [];
  const meterWidth = Math.max(4, Math.min(12, width - 18));
  const sourceLines = Math.min(drive.sources.length, Math.max(1, Math.min(3, height - 2)));
  for (let index = 0; index < sourceLines; index += 1) {
    const source = drive.sources[index]!;
    lines.push(
      `${crop(source.source.name.toUpperCase(), 8).padEnd(8, " ")} ${
        miniMeter(source.normalizedValue, meterWidth, drive.hazard)
      } ${Math.round(source.normalizedValue * 100).toString().padStart(3, " ")}`,
    );
  }
  const chartHeight = Math.max(1, height - lines.length);
  const chart = barChart(drive.pulseSeries, width, chartHeight, THREE_FALLBACK_BLOCKS);
  return [...lines, chart].join("\n");
}

function biosignalStrip(width: number, height: number, drive: VisualizationDrive) {
  const header = height >= 6
    ? [
      `PULSE ${(drive.current * 100).toFixed(0)}%  NOISE ${(drive.volatility * 100).toFixed(0)}%  Δ${
        (drive.divergence * 100).toFixed(0)
      }%`,
    ]
    : [];
  const chartHeight = Math.max(2, height - header.length);
  return [...header, signalChart(drive.pulseSeries, width, chartHeight, monitorGlyph(drive, "phosphor"))].join("\n");
}

function harmonicField(width: number, height: number, drive: VisualizationDrive, glyph: string) {
  const matrix = createMatrix(width, height, " ");
  const spacing = Math.max(3, 7 - Math.round(drive.divergence * 4));
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if ((x + y + Math.floor(drive.phase * 0.25)) % spacing === 0) {
        setCell(matrix, x, y, "·");
      }
    }
  }

  const centerX = Math.floor(width / 2);
  const centerY = Math.floor(height / 2);
  const amplitudeX = Math.max(3, Math.floor(width * (0.16 + drive.current * 0.24 + drive.divergence * 0.08)));
  const amplitudeY = Math.max(2, Math.floor(height * (0.18 + drive.density * 0.26)));
  const traces = Math.max(2, Math.min(4, drive.activeCount + 1));

  for (let trace = 0; trace < traces; trace += 1) {
    const source = drive.sources[trace % drive.sources.length]!;
    let previousX = centerX;
    let previousY = centerY;
    for (let step = 0; step < Math.max(width * 2, 48); step += 1) {
      const t = (step / Math.max(width * 2 - 1, 1)) * Math.PI * 2;
      const phase = drive.phase * 0.04 + trace * 0.9 + source.normalizedValue * 1.6;
      const x = Math.round(
        centerX +
          Math.sin(t * (2 + drive.cadence * 2 + trace * 0.25) + phase) * amplitudeX * (0.72 + trace * 0.08),
      );
      const y = Math.round(
        centerY +
          Math.sin(t * (3 + drive.divergence * 2.5) - phase) * amplitudeY +
          Math.cos(t * (1.5 + source.volatility * 3) + phase) * amplitudeY * 0.34,
      );
      drawLine(matrix, previousX, previousY, x, y, glyph);
      previousX = x;
      previousY = y;
    }
  }

  return renderMatrix(matrix);
}

function psychograph(width: number, height: number, drive: VisualizationDrive, glyph: string) {
  const matrix = createMatrix(width, height, " ");
  const drift = drive.current * 0.9 + drive.volatility * 0.8;
  let previousX = 0;
  let previousY = Math.floor(height / 2);
  for (let x = 0; x < width; x += 1) {
    const local = drive.pulseSeries[x % drive.pulseSeries.length] ?? drive.current;
    const y = Math.round(
      height / 2 +
        Math.sin(x * (0.26 + drive.cadence * 0.24) + drive.phase * 0.13) * (height * 0.18 + drift * 2.4) +
        Math.cos(x * (0.09 + drive.divergence * 0.18) - drive.phase * 0.07) * (height * 0.1 + local * 2.2) +
        Math.sin(x * 0.51 + drive.phase * 0.17) * drive.volatility * 2.6,
    );
    drawLine(matrix, previousX, previousY, x, y, glyph);
    if ((x + drive.phase) % Math.max(5, 11 - Math.round(drive.volatility * 8)) === 0) {
      setCell(matrix, x, clampInt(y + Math.round(local * 2 - 1), 0, height - 1), "•");
    }
    previousX = x;
    previousY = y;
  }
  return renderMatrix(matrix);
}

function circularField(width: number, height: number, drive: VisualizationDrive) {
  const matrix = createMatrix(width, height, " ");
  const centerX = Math.floor(width / 2);
  const centerY = Math.floor(height / 2);
  const outerX = Math.max(4, Math.floor(width * (0.2 + drive.current * 0.12 + drive.divergence * 0.08)));
  const outerY = Math.max(2, Math.floor(height * (0.26 + drive.density * 0.12)));
  const ringCount = Math.max(2, Math.min(4, 2 + Math.round(drive.hazard * 2)));

  for (let ring = 0; ring < ringCount; ring += 1) {
    const inset = ring * 2;
    drawEllipse(
      matrix,
      centerX,
      centerY,
      Math.max(2, outerX - inset),
      Math.max(1, outerY - Math.floor(inset / 2)),
      ring === ringCount - 1 ? "◎" : "◌",
    );
  }

  drawLine(
    matrix,
    centerX,
    Math.max(0, centerY - outerY - 2),
    centerX,
    Math.min(height - 1, centerY + outerY + 2),
    "│",
  );
  drawLine(matrix, Math.max(0, centerX - outerX - 4), centerY, Math.min(width - 1, centerX + outerX + 4), centerY, "─");
  drawLine(
    matrix,
    Math.max(0, centerX - outerX),
    Math.max(0, centerY - outerY),
    Math.min(width - 1, centerX + outerX),
    Math.min(height - 1, centerY + outerY),
    "╱",
  );
  drawLine(
    matrix,
    Math.max(0, centerX - outerX),
    Math.min(height - 1, centerY + outerY),
    Math.min(width - 1, centerX + outerX),
    Math.max(0, centerY - outerY),
    "╲",
  );
  setCell(matrix, centerX, centerY, drive.hazard >= 0.88 ? "█" : "◆");
  return renderMatrix(matrix);
}

function heatmap(width: number, height: number, drive: VisualizationDrive, glyphs: readonly string[]) {
  const matrix = createMatrix(width, height, " ");
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const seed = drive.normalizedSeries[(x + y) % drive.normalizedSeries.length] ?? drive.current;
      const pulse = drive.pulseSeries[(x * 2 + y) % drive.pulseSeries.length] ?? drive.current;
      const spread = drive.spreadSeries[(x + y * 2) % drive.spreadSeries.length] ?? drive.divergence;
      const value = clamp(
        seed * 0.42 +
          pulse * 0.24 +
          spread * 0.16 +
          ((Math.sin((x + drive.phase) * (0.13 + drive.cadence * 0.08)) +
              Math.cos((y - drive.phase) * (0.21 + drive.volatility * 0.12)) +
              2) / 4) * 0.18,
        0,
        1,
      );
      const glyphIndex = Math.min(glyphs.length - 1, Math.floor(value * glyphs.length));
      setCell(matrix, x, y, glyphs[glyphIndex] ?? glyphs[glyphs.length - 1] ?? "#");
    }
  }
  return renderMatrix(matrix);
}

function routeBoard(width: number, rows: number, drive: VisualizationDrive, glyphs: readonly string[]) {
  const matrix = createMatrix(width, rows, " ");
  const lanes = Math.max(2, Math.min(4, drive.sources.length + 1));
  for (let row = 0; row < rows; row += 1) {
    const source = drive.sources[row % drive.sources.length] ?? drive.primary;
    const spread = drive.spreadSeries[row % drive.spreadSeries.length] ?? drive.divergence;
    const limit = Math.floor(
      clamp(source.normalizedSeries[row % source.normalizedSeries.length] * 0.72 + spread * 0.28, 0, 1) * (width - 1),
    );
    const cursor = Math.floor(moduloUnit(drive.scan + row / Math.max(rows, 1) + source.slope * 0.25) * (width - 1));
    for (let column = 0; column < width; column += 1) {
      const onLane = (row + column + lanes) % Math.max(3, lanes + 1) === 0;
      const filled = column <= limit;
      const glyph = column === cursor
        ? "█"
        : filled
        ? glyphs[glyphs.length - 1] ?? "#"
        : onLane
        ? glyphs[2] ?? "▂"
        : glyphs[1] ?? ".";
      setCell(matrix, column, row, glyph);
    }
  }
  return renderMatrix(matrix);
}

function tacticalMap(width: number, height: number, drive: VisualizationDrive) {
  const matrix = createMatrix(width, height, " ");
  const bias = 2 + drive.divergence * 5;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if ((x + Math.floor(Math.sin(y * (0.42 + drive.cadence * 0.22) + drive.phase * 0.08) * bias)) % 7 === 0) {
        setCell(matrix, x, y, "~");
      }
    }
  }

  const scanX = Math.floor(moduloUnit(drive.scan + drive.cadence * 0.2) * Math.max(1, width - 1));
  for (let y = 0; y < height; y += 1) {
    const x = clampInt(scanX - Math.floor(y / 2), 0, width - 1);
    setCell(matrix, x, y, "/");
    setCell(matrix, Math.min(width - 1, x + 1), y, "/");
  }

  const targets = Math.max(1, Math.min(3, drive.activeCount + 1));
  for (let target = 0; target < targets; target += 1) {
    const left = clampInt(Math.floor(width * (0.18 + target * 0.23 + drive.divergence * 0.08)), 1, width - 4);
    const top = clampInt(Math.floor(height * (0.18 + target * 0.16)), 1, height - 3);
    const right = clampInt(left + Math.max(3, Math.floor(width * 0.12)), left + 2, width - 2);
    const bottom = clampInt(top + Math.max(2, Math.floor(height * 0.18)), top + 1, height - 2);
    drawLine(matrix, left, top, right, top, "┄");
    drawLine(matrix, left, bottom, right, bottom, "┄");
    drawLine(matrix, left, top, left, bottom, "┆");
    drawLine(matrix, right, top, right, bottom, "┆");
  }

  return renderMatrix(matrix);
}

function networkTopology(width: number, height: number, drive: VisualizationDrive) {
  const matrix = createMatrix(width, height, " ");
  const offset = Math.floor(drive.divergence * 4 + drive.volatility * 3);
  const nodes = [
    [2, 2],
    [Math.floor(width * 0.24), 5],
    [Math.floor(width * 0.46), 2],
    [Math.floor(width * 0.7), 6],
    [width - 4, 3],
    [6, height - 4],
    [Math.floor(width * 0.34), height - 5],
    [Math.floor(width * 0.6), height - 3],
    [width - 8, height - 4],
  ] as const;

  const edges = [
    [0, 1],
    [1, 2],
    [2, 3],
    [3, 4],
    [0, 5],
    [1, 6],
    [2, 6],
    [2, 7],
    [3, 7],
    [4, 8],
    [5, 6],
    [6, 7],
    [7, 8],
  ] as const;

  edges.forEach(([from, to], edgeIndex) => {
    const pulse = drive.pulseSeries[(edgeIndex * 3 + offset) % drive.pulseSeries.length] ?? drive.current;
    const hot = pulse >= 0.68 || (drive.phase + edgeIndex + offset) % 7 === 0;
    drawLine(matrix, nodes[from][0], nodes[from][1], nodes[to][0], nodes[to][1], hot ? "╳" : "─");
  });

  nodes.forEach(([x, y], index) => {
    const pulse = drive.normalizedSeries[(index * 2 + offset) % drive.normalizedSeries.length] ?? drive.current;
    setCell(matrix, x, y, pulse >= 0.72 ? "█" : (drive.phase + index + offset) % 9 === 0 ? "◆" : "●");
  });

  return renderMatrix(matrix);
}

function liveFeed(width: number, height: number, drive: VisualizationDrive) {
  const matrix = createMatrix(width, height, " ");
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const wave = drive.pulseSeries[(x + y) % drive.pulseSeries.length] ?? drive.current;
      const noise = Math.sin((x + drive.phase) * (0.28 + drive.cadence * 0.2) + wave) +
        Math.cos((y - drive.phase) * (0.6 + drive.volatility * 0.3) - drive.current);
      setCell(matrix, x, y, noise > 1.05 ? "█" : noise > 0.55 ? "▓" : noise > 0.08 ? "▒" : noise > -0.3 ? "░" : " ");
    }
  }

  const left = Math.floor(width * (0.22 + drive.divergence * 0.08));
  const top = Math.floor(height * (0.16 + drive.volatility * 0.08));
  const right = Math.min(width - 2, left + Math.max(4, Math.floor(width * (0.28 + drive.current * 0.12))));
  const bottom = Math.min(height - 2, top + Math.max(3, Math.floor(height * (0.42 + drive.density * 0.1))));
  drawLine(matrix, left, top, right, top, "─");
  drawLine(matrix, left, bottom, right, bottom, "─");
  drawLine(matrix, left, top, left, bottom, "│");
  drawLine(matrix, right, top, right, bottom, "│");
  return renderMatrix(matrix);
}

function channelMatrix(width: number, height: number, drive: VisualizationDrive) {
  const matrix = createMatrix(width, height, " ");
  const sourceCount = Math.max(1, drive.sources.length);
  const laneWidth = Math.max(3, Math.floor(width / sourceCount));
  drive.sources.forEach((source, index) => {
    const start = index * laneWidth;
    const end = Math.min(width - 1, start + laneWidth - 1);
    const sampled = sampleSeries(source.normalizedSeries, Math.max(1, end - start));
    for (let x = start; x < end; x += 1) {
      const local = sampled[x - start] ?? source.normalizedValue;
      const filled = Math.max(1, Math.round(local * Math.max(1, height - 1)));
      for (let row = height - 1; row >= 0; row -= 1) {
        const fromBottom = height - row;
        if (fromBottom <= filled) {
          setCell(matrix, x, row, drive.hazard >= 0.9 ? "█" : local >= 0.66 ? "▓" : "▒");
        } else if ((row + x + drive.phase) % Math.max(3, 8 - Math.round(drive.volatility * 5)) === 0) {
          setCell(matrix, x, row, "·");
        }
      }
    }
    if (end < width) {
      for (let row = 0; row < height; row += 1) {
        setCell(matrix, end, row, "│");
      }
    }
  });
  return renderMatrix(matrix);
}

function componentIndex(width: number, height: number, drive: VisualizationDrive) {
  const header = `INDEX ${(drive.current * 100).toFixed(0)}%  Δ${
    (drive.divergence * 100).toFixed(0)
  }  SRC ${drive.activeCount}/${drive.sources.length}`;
  const entries = neonDemos.map((demo, index) => {
    const pulse = drive.pulseSeries[index % drive.pulseSeries.length] ?? drive.current;
    const marker = pulse >= 0.82 ? "█" : pulse >= 0.6 ? "▓" : pulse >= 0.36 ? "▒" : "░";
    return `${marker} ${demo.title.toUpperCase()}`;
  });
  return [header, ...gridify(entries, width).split("\n")].slice(0, Math.max(1, height)).join("\n");
}

function seriesSlope(values: number[], steps = 4) {
  if (values.length <= 1) {
    return 0;
  }
  const end = values.length - 1;
  const start = Math.max(0, end - Math.max(1, steps));
  return clamp((values[end]! - values[start]!) * 1.4, -1, 1);
}

function seriesVolatility(values: number[]) {
  if (values.length <= 1) {
    return 0;
  }
  let total = 0;
  for (let index = 1; index < values.length; index += 1) {
    total += Math.abs(values[index]! - values[index - 1]!);
  }
  return clamp((total / (values.length - 1)) * 2.4, 0, 1);
}

function moduloUnit(value: number) {
  const remainder = value % 1;
  return remainder < 0 ? remainder + 1 : remainder;
}

function clampInt(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function gridify(entries: string[], width: number) {
  const itemWidth = width >= 72 ? 28 : width >= 52 ? 24 : width >= 40 ? 20 : 16;
  const columns = Math.max(1, Math.floor((width + 1) / (itemWidth + 1)));
  const rows = Math.ceil(entries.length / columns);
  return Array.from(
    { length: rows },
    (_, row) =>
      Array.from({ length: columns }, (_, column) => entries[row + column * rows])
        .filter((value): value is string => Boolean(value))
        .map((value) => crop(value, itemWidth).padEnd(itemWidth, " "))
        .join(" "),
  ).join("\n");
}

function crop(text: string, width: number) {
  if (text.length <= width) {
    return text;
  }
  return `${text.slice(0, Math.max(0, width - 1))}…`;
}

function mergeValueFromSeries(values: number[]) {
  if (values.length === 0) {
    return 0.12;
  }
  return clamp(values.reduce((sum, value) => sum + value, 0) / values.length, 0, 1);
}

function last(values: number[]) {
  return values[values.length - 1] ?? 0;
}

function createMatrix(width: number, height: number, fill = " ") {
  return Array.from({ length: height }, () => Array.from({ length: width }, () => fill));
}

function renderMatrix(matrix: string[][]) {
  return matrix.map((row) => row.join("")).join("\n");
}

function setCell(matrix: string[][], x: number, y: number, char: string) {
  const row = matrix[y];
  if (!row || x < 0 || x >= row.length) {
    return;
  }
  row[x] = char;
}

function drawLine(matrix: string[][], x1: number, y1: number, x2: number, y2: number, char: string) {
  const steps = Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1), 1);
  for (let step = 0; step <= steps; step += 1) {
    const x = Math.round(x1 + ((x2 - x1) * step) / steps);
    const y = Math.round(y1 + ((y2 - y1) * step) / steps);
    setCell(matrix, x, y, char);
  }
}

function drawEllipse(
  matrix: string[][],
  centerX: number,
  centerY: number,
  radiusX: number,
  radiusY: number,
  glyph: string,
) {
  const steps = Math.max(24, Math.round(Math.max(radiusX, radiusY) * 8));
  for (let step = 0; step < steps; step += 1) {
    const theta = (step / steps) * Math.PI * 2;
    const x = Math.round(centerX + Math.cos(theta) * radiusX);
    const y = Math.round(centerY + Math.sin(theta) * radiusY);
    setCell(matrix, x, y, glyph);
  }
}
