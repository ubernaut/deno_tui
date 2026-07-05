import { demos as neonDemos, formatCountdown as neonFormatCountdown } from "./neon_theme.ts";
import { formatRate } from "./styles.ts";
import {
  neonThreeVisualizationIds,
  neonVisualizationIds,
  visualizationCatalog,
  visualizationCatalogById,
} from "./visualization_catalog.ts";
import {
  buildVisualizationDrive,
  fallbackSource,
  sampleSeriesValue,
  type VisualizationDrive,
} from "./visualization_drive.ts";
import {
  cpuActivityRgb,
  cpuHexGridColumnCount,
  cpuHexTileLayout,
  cpuHexTileLayoutInto,
  renderCpuHexGrid,
} from "./visualization_cpu_hex.ts";
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
import {
  alertText,
  barChart,
  crop,
  driveAlert,
  hottestAccent,
  miniMeter,
  monitorGlyph,
  plotHistory,
  sceneAlert,
  sourceDetailFooter,
  sourceFooter,
  sourceNameMatrix,
  sourceWarnings,
} from "./visualization_primitives.ts";
import {
  appendThreeSceneFooter,
  driveThreeSignal,
  renderThreeFallbackBody,
  THREE_FALLBACK_BLOCKS,
} from "./visualization_three.ts";
import {
  renderCpuLegend,
  renderCpuMonitor,
  renderDiskMonitor,
  renderMemoryMonitor,
  renderProcessMonitor,
  renderTemperatureMonitor,
} from "./visualization_system.ts";
import type { Accent, PanelRender, RenderContext, ThreeSceneMode, VisualizationDescriptor } from "./types.ts";

export { buildVisualizationDrive } from "./visualization_drive.ts";
export type { VisualizationDrive, VisualizationSourceDrive } from "./visualization_drive.ts";
export { defaultVisualizationForSlot, orderVisualizationsForSlot } from "./visualization_catalog.ts";
export {
  cpuActivityRgb,
  cpuHexGridColumnCount,
  cpuHexTileLayout,
  cpuHexTileLayoutInto,
  cpuHexTileScrollTarget,
  nextCpuHexLabel,
  processMatchesCpuLabel,
  selectedCpuHexTilesWith,
  topCpuProcessLabelForCpu,
} from "./visualization_cpu_hex.ts";
export type {
  CpuHexNavigationKey,
  CpuHexScrollOffset,
  CpuHexScrollTargetOptions,
  CpuHexTileLayout,
} from "./visualization_cpu_hex.ts";

export const visualizations: VisualizationDescriptor[] = visualizationCatalog.map((entry) => ({ ...entry }));

const visualizationMap = new Map(visualizationCatalogById);
const neonDemoIds = new Set(neonDemos.map((demo) => demo.id));
const neonDemoTitles = new Array<string>(neonDemos.length);
for (let index = 0; index < neonDemos.length; index += 1) {
  neonDemoTitles[index] = neonDemos[index]!.title;
}
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

interface NetworkMonitorRenderDependencies {
  plotHistory(values: number[], width: number, height: number, glyph: string): string;
  monitorGlyph(drive: VisualizationDrive, accent: Accent): string;
}

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

export function visualizationUsesThreeRenderer(visualizationId: string): boolean {
  return visualizationId in threeSceneVisualizationModes || visualizationId in ngePrimitiveSceneModes;
}

function renderNetworkMonitor(
  context: RenderContext,
  dependencies: NetworkMonitorRenderDependencies,
): PanelRender {
  const { system } = context;
  const width = Math.max(1, context.width);
  const height = Math.max(1, context.height);
  const drive = buildVisualizationDrive(context, Math.max(width, 24));
  const alert = networkAlert(context);
  const network = busiestNetwork(system.networks);
  const isSurging = Boolean(network && network.rxRate + network.txRate > 125_000_000);

  return {
    body: networkMonitorLines(system, drive, width, height, dependencies).join("\n"),
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
  dependencies: NetworkMonitorRenderDependencies,
): string[] {
  const lineBudget = Math.max(1, height);
  const chartWidth = Math.max(1, width);

  if (lineBudget <= 3 || width < 20) {
    const lines: string[] = [
      networkSummaryLine(system, width),
      compactNetworkTrace(system, chartWidth),
    ];
    appendNetworkInterfaceRows(lines, system, width, lineBudget - 2);
    return fitNetworkLines(lines, width, lineBudget);
  }

  if (lineBudget <= 6) {
    const interfaceRows = Math.min(system.networks.length, Math.max(0, lineBudget - 3));
    const chartHeight = Math.max(1, lineBudget - 1 - interfaceRows);
    const lines: string[] = [width >= 32 ? "RX/TX BUS" : "RX/TX"];
    appendSplitLines(
      lines,
      dependencies.plotHistory(
        combinedNetworkHistory(system),
        chartWidth,
        chartHeight,
        dependencies.monitorGlyph(drive, "signal"),
      ),
    );
    appendNetworkInterfaceRows(lines, system, width, interfaceRows);
    return fitNetworkLines(lines, width, lineBudget);
  }

  const interfaceRows = Math.min(system.networks.length, width >= 36 ? 2 : 1, Math.max(0, lineBudget - 6));
  const graphRows = Math.max(2, lineBudget - 2 - interfaceRows);
  const rxHeight = Math.max(1, Math.floor(graphRows / 2));
  const txHeight = Math.max(1, graphRows - rxHeight);

  const lines: string[] = [width >= 28 ? "RX BUS" : "RX"];
  appendSplitLines(
    lines,
    dependencies.plotHistory(system.rxHistory, chartWidth, rxHeight, dependencies.monitorGlyph(drive, "signal")),
  );
  lines.push(width >= 28 ? "TX BUS" : "TX");
  appendSplitLines(
    lines,
    dependencies.plotHistory(system.txHistory, chartWidth, txHeight, dependencies.monitorGlyph(drive, "amber")),
  );
  appendNetworkInterfaceRows(lines, system, width, interfaceRows);
  return fitNetworkLines(lines, width, lineBudget);
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
  let trace = "";
  for (let index = 0; index < width; index++) {
    const rxValue = sampleSeriesValue(system.rxHistory, index, width);
    const txValue = sampleSeriesValue(system.txHistory, index, width);
    const combined = Math.max(rxValue, txValue);
    if (combined >= 0.82) trace += "█";
    else if (rxValue >= 0.5 && txValue >= 0.5) trace += "▓";
    else if (rxValue >= txValue && rxValue >= 0.22) trace += "▄";
    else if (txValue > rxValue && txValue >= 0.22) trace += "▀";
    else trace += "·";
  }
  return trace;
}

function appendNetworkInterfaceRows(
  lines: string[],
  system: RenderContext["system"],
  width: number,
  count: number,
): void {
  if (count <= 0) {
    return;
  }
  if (system.networks.length === 0) {
    lines.push("NO ACTIVE INTERFACES");
    return;
  }
  const limit = Math.min(count, system.networks.length);
  for (let index = 0; index < limit; index++) {
    lines.push(networkInterfaceLine(system.networks[index], width));
  }
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
  const combined = new Array<number>(length);
  for (let index = 0; index < length; index++) {
    combined[index] = Math.max(system.rxHistory[index] ?? 0, system.txHistory[index] ?? 0);
  }
  return combined;
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
  const limit = Math.min(lines.length, Math.max(1, height));
  const fitted = new Array<string>(limit);
  for (let index = 0; index < limit; index++) {
    fitted[index] = crop(lines[index].trimEnd(), width);
  }
  return fitted;
}

function appendSplitLines(lines: string[], text: string): void {
  let start = 0;
  while (start <= text.length) {
    const next = text.indexOf("\n", start);
    if (next === -1) {
      lines.push(text.slice(start));
      return;
    }
    lines.push(text.slice(start, next));
    start = next + 1;
  }
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

function applyNgePrimitiveScene(context: RenderContext, panel: PanelRender): PanelRender {
  const visualizationId = context.slot.visualizationId;
  if (!neonDemoIds.has(visualizationId) || textOnlyNeonDemoIds.has(visualizationId)) {
    return panel;
  }

  if (panel.three) {
    return {
      ...panel,
      footer: appendThreeSceneFooter(panel.footer, panel.three.mode, context.width),
    };
  }

  const mode = ngePrimitiveSceneModes[visualizationId];
  if (!mode) return panel;
  const drive = buildVisualizationDrive(context, Math.max(32, context.width));

  return {
    ...panel,
    footer: appendThreeSceneFooter(panel.footer, mode, context.width),
    three: {
      mode,
      signal: driveThreeSignal(context, drive, mode),
    },
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

function renderWarningStack(context: RenderContext): PanelRender {
  const drive = buildVisualizationDrive(context, 24);
  const lines = warningStackLines(context, drive, Math.max(1, context.height));

  return {
    body: lines.join("\n"),
    footer: sourceFooter(context.sources),
    alert: alertText(context) || driveAlert(drive),
    accent: drive.hazard >= 0.88 ? "alarm" : "amber",
    severity: drive.hazard >= 0.88 ? "alarm" : "warning",
  };
}

function warningStackLines(context: RenderContext, drive: VisualizationDrive, limit: number): string[] {
  const lines: string[] = [];
  for (let index = 0; index < context.system.alerts.length && lines.length < limit; index += 1) {
    const alert = context.system.alerts[index]!;
    lines.push(`${alert.title}  ${alert.detail}`);
  }
  if (lines.length > 0) return lines;

  for (let index = 0; index < context.system.diagnostics.length && lines.length < limit; index += 1) {
    const diagnostic = context.system.diagnostics[index]!;
    if (diagnostic.status === "ok") continue;
    lines.push(`${diagnostic.source.toUpperCase()}  ${diagnostic.status.toUpperCase()}  ${diagnostic.detail}`);
  }
  if (lines.length > 0) return lines;

  const warnings = sourceWarnings(context.sources, drive);
  for (let index = 0; index < warnings.length && lines.length < limit; index += 1) {
    lines.push(warnings[index]!);
  }
  return lines;
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
  const lines = eventLogLines(context, drive, Math.max(1, context.height));

  return {
    body: lines.join("\n"),
    footer: sourceFooter(context.sources),
    alert: alertText(context) || driveAlert(drive),
    accent: drive.hazard >= 0.88 ? "alarm" : context.system.alerts.length > 0 ? "amber" : "signal",
    severity: drive.hazard >= 0.88 ? "alarm" : context.system.alerts.length > 0 ? "warning" : "info",
  };
}

function eventLogLines(context: RenderContext, drive: VisualizationDrive, limit: number): string[] {
  const lines: string[] = [];
  for (let index = 0; index < context.system.alerts.length && lines.length < limit; index += 1) {
    const alert = context.system.alerts[index]!;
    lines.push(`${String(223229 + index * 17)}  ${alert.title} ${alert.detail}`);
  }
  for (let index = 0; index < context.sources.length && lines.length < limit; index += 1) {
    const source = context.sources[index]!;
    const detailLimit = Math.min(2, source.detailLines.length);
    for (let detailIndex = 0; detailIndex < detailLimit && lines.length < limit; detailIndex += 1) {
      const line = source.detailLines[detailIndex]!;
      lines.push(`${String(223500 + index * 31 + detailIndex * 7)}  ${source.name.toUpperCase()} ${line}`);
    }
  }
  if (lines.length < limit) {
    lines.push(`${String(224100 + Math.round(drive.phase % 800))}  VECTOR DRIVE ${(drive.current * 100).toFixed(0)}%`);
  }
  if (lines.length < limit) {
    lines.push(
      `${String(224280 + Math.round(drive.divergence * 100))}  PHASE SLEW ${(drive.volatility * 100).toFixed(0)}%`,
    );
  }
  return lines;
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
      neonDemoTitles,
    ),
    footer: sourceFooter(context.sources),
    alert: drive.hazard >= 0.92 ? "SUITE SATURATION" : "",
    accent: "amber",
    severity: drive.hazard >= 0.92 ? "warning" : "info",
  };
}
