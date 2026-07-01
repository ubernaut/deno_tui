import { clamp, formatBytes, formatDuration, formatPercent, formatRate } from "./styles.ts";
import { demos as neonDemos, formatCountdown as neonFormatCountdown } from "./neon_theme.ts";
import {
  neonThreeVisualizationIds,
  neonVisualizationIds,
  visualizationCatalog,
  visualizationCatalogById,
} from "./visualization_catalog.ts";
import {
  buildVisualizationDrive,
  fallbackSource,
  moduloUnit,
  sampleSeries,
  type VisualizationDrive,
} from "./visualization_drive.ts";
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

export { buildVisualizationDrive } from "./visualization_drive.ts";
export type { VisualizationDrive, VisualizationSourceDrive } from "./visualization_drive.ts";

export const visualizations: VisualizationDescriptor[] = visualizationCatalog.map((entry) => ({ ...entry }));

const visualizationMap = new Map(visualizationCatalogById);
const neonDemoIds = new Set(neonDemos.map((demo) => demo.id));
const textOnlyNeonDemoIds = new Set(["warning-stack", "event-log", "component-index"]);
const ngePrimitiveSceneModes: Record<string, ThreeSceneMode> = {
  "counter-board": "counter",
  "profile-card": "plug",
  "live-feed": "surveillance",
  "channel-matrix": "relay",
  "telemetry-rack": "rack",
  "biosignal-strip": "biosignal",
  "harmonic-graph": "harmonic",
  "psychograph": "psychograph",
  "field-ring": "field",
  "hex-heatmap": "heat",
  "magi-board": "magi",
  "route-board": "route",
  "gate-status": "gate",
  "tactical-map": "command",
  "network-topology": "topology",
};

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
      case "cpu-hex-grid":
        return renderCpuHexGrid(context);
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

  const enhancedPanel = applyNgePrimitiveScene(context, panel);
  const footerBase = enhancedPanel.footer || sourceFooter(context.sources);
  return {
    title: descriptor.name.toUpperCase(),
    accent: enhancedPanel.accent ?? descriptor.accent,
    severity: enhancedPanel.severity ?? "info",
    alert: enhancedPanel.alert ?? "",
    body: enhancedPanel.body,
    footer: footerBase,
    three: enhancedPanel.three,
  };
}

function applyNgePrimitiveScene(context: RenderContext, panel: PanelRender): PanelRender {
  const visualizationId = context.slot.visualizationId;
  if (!neonDemoIds.has(visualizationId) || textOnlyNeonDemoIds.has(visualizationId)) {
    return panel;
  }

  if (panel.three) {
    return {
      ...panel,
      footer: appendSceneFooter(panel.footer, panel.three.mode, context.width),
    };
  }

  const mode = ngePrimitiveSceneModes[visualizationId];
  if (!mode) return panel;
  const drive = buildVisualizationDrive(context, Math.max(32, context.width));

  return {
    ...panel,
    footer: appendSceneFooter(panel.footer, mode, context.width),
    three: {
      mode,
      signal: driveThreeSignal(context, drive, mode),
    },
  };
}

function appendSceneFooter(footer: string, mode: ThreeSceneMode, width: number): string {
  const suffix = `${modeLabel(mode)} PRIMITIVES`;
  if (!footer) return suffix;
  return `${crop(footer, Math.max(0, width - suffix.length - 3))} / ${suffix}`;
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
    ...cpuLegendRows(context.system.cpuCores, context.width, drive.hazard),
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

const cpuHexColorStops = [
  { percent: 0, rgb: [45, 112, 255] },
  { percent: 25, rgb: [22, 214, 107] },
  { percent: 50, rgb: [255, 226, 74] },
  { percent: 75, rgb: [255, 159, 36] },
  { percent: 100, rgb: [255, 66, 49] },
] as const;

export function cpuActivityRgb(percent: number): [number, number, number] {
  const value = Number.isFinite(percent) ? clamp(percent, 0, 100) : 0;
  const upperIndex = cpuHexColorStops.findIndex((stop) => value <= stop.percent);
  const upper = cpuHexColorStops[Math.max(0, upperIndex)] ?? cpuHexColorStops[cpuHexColorStops.length - 1]!;
  const lower = cpuHexColorStops[Math.max(0, upperIndex - 1)] ?? upper;
  const span = Math.max(1, upper.percent - lower.percent);
  const position = clamp((value - lower.percent) / span, 0, 1);

  return [
    Math.round(lerp(lower.rgb[0], upper.rgb[0], position)),
    Math.round(lerp(lower.rgb[1], upper.rgb[1], position)),
    Math.round(lerp(lower.rgb[2], upper.rgb[2], position)),
  ];
}

function lerp(start: number, end: number, position: number) {
  return start + (end - start) * position;
}

export interface CpuHexTileLayout {
  core: RenderContext["system"]["cpuCores"][number];
  label: string;
  column: number;
  row: number;
  width: number;
  height: number;
}

type CpuHexTileMode = "compact" | "labeled" | "cell";

export function cpuHexGridColumnCount(
  cores: RenderContext["system"]["cpuCores"],
  width: number,
  height: number,
): number {
  if (cores.length === 0) return 1;
  const labelWidth = Math.max(3, ...cores.map((core) => core.label.length));
  const mode = cpuHexTileMode(width, height, cores.length, labelWidth);
  return cpuHexColumns(width, cpuHexTileWidth(mode, labelWidth));
}

export function cpuHexTileLayout(
  cores: RenderContext["system"]["cpuCores"],
  width: number,
  height: number,
): CpuHexTileLayout[] {
  if (cores.length === 0) return [];
  const labelWidth = Math.max(3, ...cores.map((core) => core.label.length));
  const mode = cpuHexTileMode(width, height, cores.length, labelWidth);
  const tileWidth = cpuHexTileWidth(mode, labelWidth);
  const tileHeight = cpuHexTileHeight(mode);
  const columns = cpuHexColumns(width, tileWidth);

  return cores.map((core, index) => {
    const logicalRow = Math.floor(index / columns);
    const columnIndex = index % columns;
    const indent = logicalRow % 2 === 1 ? cpuHexIndent(width, tileWidth) : 0;
    return {
      core,
      label: core.label,
      column: indent + columnIndex * (tileWidth + 1),
      row: logicalRow * tileHeight,
      width: tileWidth,
      height: tileHeight,
    };
  });
}

function renderCpuHexGrid(context: RenderContext): PanelRender {
  const { system, width, height } = context;
  const drive = buildVisualizationDrive(context, Math.max(width, 48));
  const cores = system.cpuCores;

  if (cores.length === 0) {
    return {
      body: "NO CORE DATA",
      footer: `HOST ${system.hostname.toUpperCase()}  LOAD ${
        system.loadavg.map((value) => value.toFixed(2)).join("/")
      }`,
      alert: "",
      accent: "signal",
      severity: "info",
    };
  }

  const hotCore = cores.reduce((hot, core) => core.usage > hot.usage ? core : hot, cores[0]!);
  const selectedCore = selectedCpuCore(cores, context.selectedCpuLabel);
  const lines = [
    crop(
      `AVG ${formatPercent(system.cpuOverall)}  CORES ${cores.length}  HOT CPU${hotCore.label} ${
        formatPercent(hotCore.usage)
      }`,
      width,
    ),
    cpuHexGradientLegend(width),
    ...cpuHexGridRows(cores, width, height, selectedCore?.label),
    "",
    ...cpuHexSelectionLines(system, selectedCore, width),
  ];

  return {
    body: lines.join("\n"),
    footer: `HEX GRID  BLUE 0  GREEN 25  YELLOW 50  ORANGE 75  RED 100`,
    alert: system.cpuOverall >= 88 ? "PULSE LIMIT" : drive.divergence >= 0.6 ? "CORE DESYNC" : "",
    accent: system.cpuOverall >= 88 ? "alarm" : system.cpuOverall >= 72 ? "amber" : "signal",
    severity: severityForValue(system.cpuOverall, 72, 88),
  };
}

function cpuHexGradientLegend(width: number): string {
  const stops = [
    ["0", 0],
    ["25", 25],
    ["50", 50],
    ["75", 75],
    ["100", 100],
  ] as const;
  const full = `LOAD ${stops.map(([label, percent]) => `${cpuHexColorize(percent, "⬢")}${label}`).join(" ")}`;
  if (width >= 26) return full;
  if (width >= 10) return stops.map(([, percent]) => cpuHexColorize(percent, "⬢")).join(" ");
  return stops
    .slice(0, Math.max(1, Math.min(width, stops.length)))
    .map(([, percent]) => cpuHexColorize(percent, "⬢"))
    .join("");
}

function cpuHexGridRows(
  cores: RenderContext["system"]["cpuCores"],
  width: number,
  height: number,
  selectedCpuLabel?: string,
): string[] {
  const labelWidth = Math.max(3, ...cores.map((core) => core.label.length));
  const mode = cpuHexTileMode(width, height, cores.length, labelWidth);
  const tileWidth = cpuHexTileWidth(mode, labelWidth);
  const layout = cpuHexTileLayout(cores, width, height);
  const rows = Math.max(1, Math.max(...layout.map((tile) => tile.row + tile.height)));
  const cursors = Array.from({ length: rows }, () => 0);
  const lines = Array.from({ length: rows }, () => "");

  for (const tile of layout) {
    const rendered = cpuHexTile(tile.core, mode, labelWidth, tileWidth, tile.label === selectedCpuLabel);
    for (let lineIndex = 0; lineIndex < rendered.length; lineIndex += 1) {
      const row = tile.row + lineIndex;
      const padding = Math.max(0, tile.column - cursors[row]!);
      lines[row] += " ".repeat(padding) + rendered[lineIndex]!;
      cursors[row] = tile.column + tile.width;
    }
  }

  return lines;
}

function cpuHexTileMode(width: number, height: number, coreCount: number, labelWidth: number): CpuHexTileMode {
  const cellWidth = cpuHexTileWidth("cell", labelWidth);
  const cellColumns = cpuHexColumns(width, cellWidth);
  const cellRows = Math.ceil(coreCount / cellColumns) * cpuHexTileHeight("cell");
  if (width >= 32 && height >= 5) {
    return "cell";
  }
  if (width >= 72 && cellRows <= Math.max(4, height + 4)) {
    return "cell";
  }
  return width >= 18 ? "labeled" : "compact";
}

function cpuHexTileWidth(mode: CpuHexTileMode, labelWidth: number) {
  switch (mode) {
    case "cell":
      return labelWidth + 5;
    case "labeled":
      return labelWidth + 1;
    case "compact":
      return 1;
  }
}

function cpuHexTileHeight(mode: CpuHexTileMode) {
  return mode === "cell" ? 2 : 1;
}

function cpuHexColumns(width: number, tileWidth: number) {
  const available = Math.max(1, width - cpuHexIndent(width, tileWidth));
  return Math.max(1, Math.floor((available + 1) / (tileWidth + 1)));
}

function cpuHexIndent(width: number, tileWidth: number) {
  return width >= tileWidth * 3 ? Math.floor(tileWidth / 2) : 0;
}

function cpuHexTile(
  core: RenderContext["system"]["cpuCores"][number],
  mode: CpuHexTileMode,
  labelWidth: number,
  tileWidth: number,
  selected = false,
): string[] {
  const label = core.label.padStart(labelWidth, "0");
  const usage = Number.isFinite(core.usage) ? clamp(core.usage, 0, 100) : 0;
  const percent = `${Math.round(usage).toString().padStart(3, " ")}%`;
  if (mode === "cell") {
    const innerWidth = Math.max(2, tileWidth - 2);
    const top = `╱${centerText(`CPU${label}`, innerWidth)}╲`;
    const bottom = `╲${centerText(percent, innerWidth)}╱`;
    return [
      cpuHexColorize(usage, top.padEnd(tileWidth, " "), selected, "top"),
      cpuHexColorize(usage, bottom.padEnd(tileWidth, " "), selected, "bottom"),
    ];
  }

  const text = mode === "labeled" ? `⬢${label}` : "⬢";
  return [cpuHexColorize(usage, text.padEnd(tileWidth, " "), selected, "compact")];
}

function centerText(text: string, width: number): string {
  if (text.length >= width) return text.slice(0, width);
  const left = Math.floor((width - text.length) / 2);
  return `${" ".repeat(left)}${text}${" ".repeat(width - text.length - left)}`;
}

function cpuHexColorize(
  percent: number,
  text: string,
  selected = false,
  part: "top" | "bottom" | "compact" = "compact",
): string {
  const [r, g, b] = cpuActivityRgb(percent);
  if (selected) {
    return `\x1b[1;38;2;5;7;13;48;2;${r};${g};${b}m${text}\x1b[0m`;
  }
  if (part !== "compact") {
    const backgroundScale = part === "top" ? 0.13 : 0.18;
    const bg = [
      Math.max(0, Math.round(r * backgroundScale)),
      Math.max(0, Math.round(g * backgroundScale)),
      Math.max(0, Math.round(b * backgroundScale)),
    ];
    return `\x1b[38;2;${r};${g};${b};48;2;${bg[0]};${bg[1]};${bg[2]}m${text}\x1b[0m`;
  }
  return `\x1b[38;2;${r};${g};${b}m${text}\x1b[0m`;
}

function selectedCpuCore(
  cores: RenderContext["system"]["cpuCores"],
  selectedCpuLabel: string | undefined,
) {
  if (!selectedCpuLabel) return undefined;
  const selectedNumber = Number(selectedCpuLabel);
  return cores.find((core) =>
    core.label === selectedCpuLabel ||
    (Number.isFinite(selectedNumber) && Number(core.label) === selectedNumber)
  );
}

function cpuHexSelectionLines(
  system: RenderContext["system"],
  core: RenderContext["system"]["cpuCores"][number] | undefined,
  width: number,
): string[] {
  if (!core) {
    return [crop("SELECT A HEX TILE FOR CPU ID + PROCESS SAMPLE", width)];
  }

  const range = cpuIdRange(system.cpuCores);
  const header = crop(
    `SELECTED CPU ID ${core.label}${range ? ` (${range})` : ""}  LOAD ${formatPercent(core.usage)}`,
    width,
  );
  const hasProcessorSamples = system.processes.some((process) => Number.isFinite(process.processor));
  if (!hasProcessorSamples) {
    return [header, crop("PROCESSOR FIELD UNAVAILABLE IN THIS SAMPLE", width)];
  }

  const cpuId = Number(core.label);
  const matches = Number.isFinite(cpuId)
    ? system.processes.filter((process) => process.processor === cpuId)
    : system.processes.filter((process) => String(process.processor) === core.label);
  if (matches.length === 0) {
    return [header, crop("NO TOP PROCESS LAST SEEN ON THIS CPU", width)];
  }

  const rows = [
    header,
    crop("TOP PROCESSES LAST SEEN ON CPU", width),
    crop(width >= 48 ? "PID      CPU%   MEM%  S  NAME" : "PID     CPU%  MEM% NAME", width),
    ...matches.slice(0, width >= 48 ? 6 : 4).map((process) => cpuHexProcessLine(process, width)),
  ];
  return rows;
}

function cpuIdRange(cores: RenderContext["system"]["cpuCores"]): string {
  const ids = cores.map((core) => Number(core.label)).filter(Number.isFinite);
  if (ids.length !== cores.length || ids.length === 0) return "";
  return `${Math.min(...ids)}-${Math.max(...ids)}`;
}

function cpuHexProcessLine(process: RenderContext["system"]["processes"][number], width: number): string {
  const nameWidth = width >= 48 ? Math.max(8, width - 27) : Math.max(6, width - 21);
  const name = crop(process.name, nameWidth).padEnd(nameWidth, " ");
  if (width >= 48) {
    return crop(
      `${String(process.pid).padEnd(8, " ")}${process.cpuPercent.toFixed(1).padStart(6, " ")} ${
        process.memoryPercent.toFixed(1).padStart(6, " ")
      }  ${crop(process.state, 1).padEnd(1, " ")}  ${name}`,
      width,
    );
  }
  return crop(
    `${String(process.pid).padEnd(7, " ")}${process.cpuPercent.toFixed(0).padStart(4, " ")}% ${
      process.memoryPercent.toFixed(0).padStart(4, " ")
    }% ${name}`,
    width,
  );
}

function cpuLegendRows(cores: RenderContext["system"]["cpuCores"], width: number, hazard: number): string[] {
  if (cores.length === 0) return ["NO CORE DATA"];

  const sample = coreLegendCell(cores[0]!, hazard);
  const cellWidth = Math.max(12, sample.length);
  const columns = Math.max(1, Math.min(8, Math.floor((Math.max(12, width) + 2) / (cellWidth + 2))));
  const rows = Math.ceil(cores.length / columns);

  return Array.from({ length: rows }, (_, row) => {
    const cells = Array.from({ length: columns }, (_, column) => {
      const core = cores[row + column * rows];
      return core ? coreLegendCell(core, hazard).padEnd(cellWidth, " ") : "";
    }).filter(Boolean);
    return crop(cells.join("  "), Math.max(12, width));
  });
}

function coreLegendCell(core: RenderContext["system"]["cpuCores"][number], hazard: number): string {
  return `${core.label.padStart(3, "0")} ${miniMeter(core.usage / 100, 6, hazard)} ${formatPercent(core.usage)}`;
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
  const { system } = context;
  const width = Math.max(1, context.width);
  const height = Math.max(1, context.height);
  const drive = buildVisualizationDrive(context, Math.max(width, 24));
  const alert = networkAlert(context);
  const network = busiestNetwork(system.networks);
  const isSurging = Boolean(network && network.rxRate + network.txRate > 125_000_000);

  return {
    body: networkMonitorLines(system, drive, width, height).join("\n"),
    footer: networkFooter(system, drive, width),
    alert,
    accent: isSurging ? "amber" : "signal",
    severity: isSurging ? "warning" : "info",
  };
}

function networkMonitorLines(
  system: RenderContext["system"],
  drive: VisualizationDrive,
  width: number,
  height: number,
): string[] {
  const lineBudget = Math.max(1, height);
  const chartWidth = Math.max(1, width);

  if (lineBudget <= 3 || width < 20) {
    return fitNetworkLines(
      [
        networkSummaryLine(system, width),
        compactNetworkTrace(system, chartWidth),
        ...networkInterfaceRows(system, width, lineBudget - 2),
      ],
      width,
      lineBudget,
    );
  }

  if (lineBudget <= 6) {
    const interfaceRows = Math.min(system.networks.length, Math.max(0, lineBudget - 3));
    const chartHeight = Math.max(1, lineBudget - 1 - interfaceRows);
    return fitNetworkLines(
      [
        width >= 32 ? "RX/TX BUS" : "RX/TX",
        ...plotHistory(
          combinedNetworkHistory(system),
          chartWidth,
          chartHeight,
          monitorGlyph(drive, "signal"),
        ).split("\n"),
        ...networkInterfaceRows(system, width, interfaceRows),
      ],
      width,
      lineBudget,
    );
  }

  const interfaceRows = Math.min(system.networks.length, width >= 36 ? 2 : 1, Math.max(0, lineBudget - 6));
  const graphRows = Math.max(2, lineBudget - 2 - interfaceRows);
  const rxHeight = Math.max(1, Math.floor(graphRows / 2));
  const txHeight = Math.max(1, graphRows - rxHeight);

  return fitNetworkLines(
    [
      width >= 28 ? "RX BUS" : "RX",
      ...plotHistory(system.rxHistory, chartWidth, rxHeight, monitorGlyph(drive, "signal")).split("\n"),
      width >= 28 ? "TX BUS" : "TX",
      ...plotHistory(system.txHistory, chartWidth, txHeight, monitorGlyph(drive, "amber")).split("\n"),
      ...networkInterfaceRows(system, width, interfaceRows),
    ],
    width,
    lineBudget,
  );
}

function networkSummaryLine(system: RenderContext["system"], width: number): string {
  const network = busiestNetwork(system.networks);
  if (!network) {
    return "NET IDLE";
  }

  const name = crop(network.name.toUpperCase(), width < 24 ? 5 : 10);
  if (width < 28) {
    return `NET ${name} ${compactRate(network.rxRate)}↓ ${compactRate(network.txRate)}↑`;
  }
  return `NET ${name} RX ${formatRate(network.rxRate)}  TX ${formatRate(network.txRate)}`;
}

function compactNetworkTrace(system: RenderContext["system"], width: number): string {
  const rx = sampleSeries(system.rxHistory, width);
  const tx = sampleSeries(system.txHistory, width);
  return Array.from({ length: width }, (_, index) => {
    const rxValue = rx[index] ?? 0;
    const txValue = tx[index] ?? 0;
    const combined = Math.max(rxValue, txValue);
    if (combined >= 0.82) return "█";
    if (rxValue >= 0.5 && txValue >= 0.5) return "▓";
    if (rxValue >= txValue && rxValue >= 0.22) return "▄";
    if (txValue > rxValue && txValue >= 0.22) return "▀";
    return "·";
  }).join("");
}

function networkInterfaceRows(system: RenderContext["system"], width: number, count: number): string[] {
  if (count <= 0) {
    return [];
  }
  if (system.networks.length === 0) {
    return ["NO ACTIVE INTERFACES"];
  }
  return system.networks.slice(0, count).map((network) => networkInterfaceLine(network, width));
}

function networkInterfaceLine(
  network: RenderContext["system"]["networks"][number],
  width: number,
): string {
  const name = crop(network.name.toUpperCase(), width < 28 ? 6 : 10);
  if (width < 30) {
    return `${name} R${compactRate(network.rxRate)} T${compactRate(network.txRate)}`;
  }
  if (width < 48) {
    return `${name.padEnd(10, " ")} R ${formatRate(network.rxRate)}  T ${formatRate(network.txRate)}`;
  }
  const address = network.addresses[0] ? ` ${network.addresses[0]}` : "";
  return `${name.padEnd(10, " ")}${address}  RX ${formatRate(network.rxRate)}  TX ${formatRate(network.txRate)}`;
}

function networkFooter(system: RenderContext["system"], drive: VisualizationDrive, width: number): string {
  const network = busiestNetwork(system.networks);
  if (!network) {
    return "NO ACTIVE INTERFACES";
  }
  const name = crop(network.name.toUpperCase(), width < 30 ? 6 : 10);
  if (width < 34) {
    return crop(`${name} ${compactRate(network.rxRate)}↓ ${compactRate(network.txRate)}↑`, width);
  }
  const address = network.addresses[0] ?? "NO ADDRESS";
  return crop(
    `${name} ${address}  RX ${formatRate(network.rxRate)}  TX ${formatRate(network.txRate)}  BURST ${
      (drive.volatility * 100).toFixed(0)
    }%`,
    width,
  );
}

function combinedNetworkHistory(system: RenderContext["system"]): number[] {
  const length = Math.max(system.rxHistory.length, system.txHistory.length, 1);
  return Array.from(
    { length },
    (_, index) => Math.max(system.rxHistory[index] ?? 0, system.txHistory[index] ?? 0),
  );
}

function compactRate(value: number): string {
  return formatRate(value)
    .replace(/\s+/g, "")
    .replace("KiB/s", "K/s")
    .replace("MiB/s", "M/s")
    .replace("GiB/s", "G/s")
    .replace("TiB/s", "T/s");
}

function fitNetworkLines(lines: string[], width: number, height: number): string[] {
  return lines.slice(0, Math.max(1, height)).map((line) => crop(line.trimEnd(), width));
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
      case "emergency":
      case "counter":
      case "relay":
        return routeBoard(width, chartHeight, drive, [" ", "░", "▒", "▓", "█"]);
      case "launch":
      case "gate":
      case "route":
        return signalChart(drive.spreadSeries, width, chartHeight, drive.hazard >= 0.78 ? "▓" : "▒");
      case "harmonic":
        return harmonicField(width, chartHeight, drive, monitorGlyph(drive, "violet"));
      case "field":
        return circularField(width, chartHeight, drive);
      case "magi":
      case "angel":
      case "plug":
      case "rack":
      case "heat":
      case "command":
        return heatmap(width, chartHeight, drive, THREE_FALLBACK_BLOCKS);
      case "target":
        return circularField(width, chartHeight, drive);
      case "waveform":
      case "scope":
      case "biosignal":
      case "psychograph":
      case "surveillance":
      case "topology":
        return psychograph(width, chartHeight, drive, monitorGlyph(drive, "signal"));
    }
  })();

  return [...infoLines, chart].join("\n");
}

function renderWarningStack(context: RenderContext): PanelRender {
  const drive = buildVisualizationDrive(context, 24);
  const diagnostics = context.system.diagnostics
    .filter((diagnostic) => diagnostic.status !== "ok")
    .map((diagnostic) =>
      `${diagnostic.source.toUpperCase()}  ${diagnostic.status.toUpperCase()}  ${diagnostic.detail}`
    );
  const alerts = context.system.alerts.length > 0
    ? context.system.alerts.map((alert) => `${alert.title}  ${alert.detail}`)
    : diagnostics.length > 0
    ? diagnostics
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
    case "emergency":
      return "EMERGENCY";
    case "counter":
      return "COUNTER";
    case "plug":
      return "TEST PLUG";
    case "surveillance":
      return "SURVEIL";
    case "relay":
      return "RELAY";
    case "rack":
      return "RACK";
    case "scope":
      return "SCOPE";
    case "biosignal":
      return "BIOSIGNAL";
    case "harmonic":
      return "HARMONIC";
    case "psychograph":
      return "PSYCHO";
    case "field":
      return "FIELD";
    case "heat":
      return "HEX FIELD";
    case "route":
      return "ROUTE";
    case "topology":
      return "TOPOLOGY";
    case "command":
      return "COMMAND";
    case "launch":
      return "LAUNCH";
    case "magi":
      return "MAGI";
    case "target":
      return "TARGET";
    case "waveform":
      return "WAVEFORM";
    case "angel":
      return "ANGEL";
    case "gate":
      return "GATE";
  }
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
  const network = busiestNetwork(context.system.networks);
  if (!network) {
    return "";
  }
  const totalRate = network.rxRate + network.txRate;
  return totalRate > 125_000_000 ? `${network.name.toUpperCase()} SURGE ABOVE ${formatRate(totalRate)}` : "";
}

function busiestNetwork(networks: RenderContext["system"]["networks"]) {
  return networks.reduce<RenderContext["system"]["networks"][number] | undefined>((busiest, network) => {
    if (!busiest) {
      return network;
    }
    return network.rxRate + network.txRate > busiest.rxRate + busiest.txRate ? network : busiest;
  }, undefined);
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
    case "emergency":
      return { phase: 29, speed: 0.16, offset: 0.32, lift: 0.16 };
    case "counter":
      return { phase: 31, speed: 0.13, offset: 0.18, lift: 0.12 };
    case "plug":
      return { phase: 32, speed: 0.08, offset: 0.16, lift: 0.3 };
    case "surveillance":
      return { phase: 34, speed: 0.09, offset: 0.24, lift: 0.18 };
    case "relay":
      return { phase: 35, speed: 0.15, offset: 0.26, lift: 0.2 };
    case "rack":
      return { phase: 36, speed: 0.14, offset: 0.2, lift: 0.16 };
    case "scope":
      return { phase: 38, speed: 0.18, offset: 0.34, lift: 0.34 };
    case "biosignal":
      return { phase: 38, speed: 0.2, offset: 0.32, lift: 0.3 };
    case "harmonic":
      return { phase: 39, speed: 0.09, offset: 0.22, lift: 0.24 };
    case "psychograph":
      return { phase: 40, speed: 0.17, offset: 0.36, lift: 0.32 };
    case "field":
      return { phase: 41, speed: 0.13, offset: 0.28, lift: 0.24 };
    case "heat":
      return { phase: 39, speed: 0.1, offset: 0.22, lift: 0.42 };
    case "route":
      return { phase: 40, speed: 0.1, offset: 0.2, lift: 0.48 };
    case "topology":
      return { phase: 42, speed: 0.09, offset: 0.22, lift: 0.24 };
    case "command":
      return { phase: 44, speed: 0.07, offset: 0.16, lift: 0.18 };
    case "launch":
      return { phase: 33, speed: 0.1, offset: 0.2, lift: 0.5 };
    case "magi":
      return { phase: 37, speed: 0.06, offset: 0.14, lift: 0.18 };
    case "target":
      return { phase: 41, speed: 0.13, offset: 0.28, lift: 0.22 };
    case "waveform":
      return { phase: 45, speed: 0.18, offset: 0.34, lift: 0.34 };
    case "angel":
      return { phase: 49, speed: 0.08, offset: 0.22, lift: 0.48 };
    case "gate":
      return { phase: 53, speed: 0.12, offset: 0.18, lift: 0.42 };
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
