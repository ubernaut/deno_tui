import { demos as neonDemos, formatCountdown as neonFormatCountdown } from "./neon_theme.ts";
import { neonThreeSceneModeLabel } from "./neon_three_catalog.ts";
import {
  neonThreeVisualizationIds,
  neonVisualizationIds,
  visualizationCatalog,
  visualizationCatalogById,
} from "./visualization_catalog.ts";
import { buildVisualizationDrive, fallbackSource, type VisualizationDrive } from "./visualization_drive.ts";
import { driveThreeSignal } from "./visualization_three_signal.ts";
import { cpuActivityRgb, cpuHexGridColumnCount, cpuHexTileLayout, renderCpuHexGrid } from "./visualization_cpu_hex.ts";
import {
  biosignalStrip,
  channelMatrix,
  circularField,
  componentIndex,
  harmonicField,
  heatmap,
  liveFeed,
  networkTopology,
  psychograph,
  routeBoard,
  tacticalMap,
  telemetryRack,
} from "./visualization_fields.ts";
import { renderGpuChipMonitor, renderGpuCombinedMonitor, renderGpuMemoryMonitor } from "./visualization_gpu.ts";
import { renderNetworkMonitor } from "./visualization_network.ts";
import { barChart, crop, miniMeter, monitorGlyph, plotHistory, signalChart } from "./visualization_primitives.ts";
import {
  renderCpuLegend,
  renderCpuMonitor,
  renderDiskMonitor,
  renderMemoryMonitor,
  renderProcessMonitor,
  renderTemperatureMonitor,
} from "./visualization_system.ts";
import type {
  Accent,
  PanelRender,
  RenderContext,
  SourceFrame,
  ThreeSceneMode,
  VisualizationDescriptor,
} from "./types.ts";

export { buildVisualizationDrive } from "./visualization_drive.ts";
export type { VisualizationDrive, VisualizationSourceDrive } from "./visualization_drive.ts";
export { cpuActivityRgb, cpuHexGridColumnCount, cpuHexTileLayout } from "./visualization_cpu_hex.ts";

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

type VisualizationRenderFn = (context: RenderContext, descriptor: VisualizationDescriptor) => PanelRender;

const threeSceneVisualizationModes: Record<string, ThreeSceneMode> = {
  "three-lattice": "lattice",
  "three-atfield": "atfield",
  "three-hexshell": "hexshell",
  "three-capture": "capture",
  "three-mapslab": "mapslab",
  "three-solenoid": "solenoid",
  "three-ascii-studio": "studio",
};

const directVisualizationRenderers: Record<string, (context: RenderContext) => PanelRender> = {
  "cpu-monitor": (context) => renderCpuMonitor(context, systemMonitorDependencies),
  "cpu-legend": (context) => renderCpuLegend(context, systemMonitorDependencies),
  "cpu-hex-grid": renderCpuHexGrid,
  "gpu-combined-monitor": (context) => renderGpuCombinedMonitor(context, gpuMonitorDependencies),
  "gpu-chip-monitor": (context) => renderGpuChipMonitor(context, gpuMonitorDependencies),
  "gpu-memory-monitor": (context) => renderGpuMemoryMonitor(context, gpuMonitorDependencies),
  "memory-monitor": (context) => renderMemoryMonitor(context, systemMonitorDependencies),
  "temperature-monitor": (context) => renderTemperatureMonitor(context, systemMonitorDependencies),
  "disk-monitor": (context) => renderDiskMonitor(context, systemMonitorDependencies),
  "network-monitor": (context) => renderNetworkMonitor(context, { plotHistory, monitorGlyph }),
  "process-monitor": renderProcessMonitor,
  "warning-stack": renderWarningStack,
  "counter-board": renderCounterBoard,
  "profile-card": renderProfileCard,
  "live-feed": renderLiveFeed,
  "event-log": renderEventLog,
  "channel-matrix": renderChannelMatrix,
  "telemetry-rack": renderTelemetryRack,
  "biosignal-strip": renderBiosignalStrip,
  "harmonic-graph": renderHarmonicGraph,
  "psychograph": renderPsychograph,
  "field-ring": renderFieldRing,
  "hex-heatmap": renderHeatmap,
  "magi-board": renderMagiBoard,
  "route-board": renderRouteBoard,
  "gate-status": renderGateStatus,
  "tactical-map": renderTacticalMap,
  "network-topology": renderNetworkTopology,
  "component-index": renderComponentIndex,
};

const visualizationRenderers: Record<string, VisualizationRenderFn> = Object.fromEntries([
  ...Object.entries(threeSceneVisualizationModes).map(([id, mode]) =>
    [
      id,
      (context: RenderContext, descriptor: VisualizationDescriptor) =>
        renderThreeScene(context, mode, descriptor.accent),
    ] satisfies [string, VisualizationRenderFn]
  ),
  ...Object.entries(directVisualizationRenderers).map(([id, renderer]) =>
    [
      id,
      (context: RenderContext) => renderer(context),
    ] satisfies [string, VisualizationRenderFn]
  ),
]);

const gpuMonitorDependencies = { plotHistory, barChart, miniMeter, monitorGlyph };
const systemMonitorDependencies = { plotHistory, miniMeter, monitorGlyph };

export function renderVisualization(context: RenderContext): PanelRender {
  const descriptor = visualizationMap.get(context.slot.visualizationId) ?? visualizations[0]!;
  const renderPanel = visualizationRenderers[context.slot.visualizationId] ??
    ((fallbackContext: RenderContext) => renderTelemetryRack(fallbackContext));
  const panel = renderPanel(context, descriptor);

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
    body: telemetryRack(Math.max(12, context.width), Math.max(4, context.height), drive, THREE_FALLBACK_BLOCKS),
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
    body: componentIndex(
      Math.max(18, context.width),
      Math.max(4, context.height),
      drive,
      neonDemos.map((demo) => demo.title),
    ),
    footer: sourceFooter(context.sources),
    alert: drive.hazard >= 0.92 ? "SUITE SATURATION" : "",
    accent: "amber",
    severity: drive.hazard >= 0.92 ? "warning" : "info",
  };
}

const THREE_FALLBACK_BLOCKS = [" ", "▁", "▂", "▃", "▄", "▅", "▆", "▇", "█"] as const;

function modeLabel(mode: ThreeSceneMode) {
  return neonThreeSceneModeLabel(mode);
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
