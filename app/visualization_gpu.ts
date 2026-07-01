import { clamp, formatBytes, formatPercent } from "./styles.ts";
import { buildVisualizationDrive, type VisualizationDrive } from "./visualization_drive.ts";
import type { Accent, PanelRender, RenderContext, Severity } from "./types.ts";

export interface GpuMonitorRenderDependencies {
  plotHistory(values: number[], width: number, height: number, glyph: string): string;
  barChart(values: number[], width: number, height: number, glyphs: readonly string[]): string;
  miniMeter(value: number, width: number, heat: number): string;
  monitorGlyph(drive: VisualizationDrive, accent: Accent): string;
}

export function renderGpuCombinedMonitor(
  context: RenderContext,
  dependencies: GpuMonitorRenderDependencies,
): PanelRender {
  const { system, width, height } = context;
  const drive = buildVisualizationDrive(context, Math.max(width, 48));
  if (!system.gpu.available) return renderGpuOfflinePanel("GPU FUSION OFFLINE", "violet");

  const graphHeight = Math.max(2, Math.floor((height - 5) / 2));
  const chipGraph = dependencies.plotHistory(
    system.gpuUtilizationHistory,
    Math.max(12, width),
    graphHeight,
    dependencies.monitorGlyph(drive, "violet"),
  );
  const memoryGraph = dependencies.plotHistory(
    system.gpuMemoryHistory,
    Math.max(12, width),
    graphHeight,
    dependencies.monitorGlyph(drive, "phosphor"),
  );
  return {
    body: [
      crop(system.gpu.name.toUpperCase(), width),
      `CHIP ${formatPercent(system.gpu.utilizationPercent)} ${
        dependencies.miniMeter(system.gpu.utilizationPercent / 100, 12, drive.hazard)
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

export function renderGpuChipMonitor(context: RenderContext, dependencies: GpuMonitorRenderDependencies): PanelRender {
  const { system, width, height } = context;
  const drive = buildVisualizationDrive(context, Math.max(width, 40));
  if (!system.gpu.available) return renderGpuOfflinePanel("GPU CHIP OFFLINE", "violet");

  const graphHeight = Math.max(3, height - 5);
  const graph = dependencies.plotHistory(
    system.gpuUtilizationHistory,
    Math.max(12, width),
    graphHeight,
    dependencies.monitorGlyph(drive, "violet"),
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

export function renderGpuMemoryMonitor(
  context: RenderContext,
  dependencies: GpuMonitorRenderDependencies,
): PanelRender {
  const { system, width, height } = context;
  const drive = buildVisualizationDrive(context, Math.max(width, 40));
  if (!system.gpu.available) return renderGpuOfflinePanel("GPU MEMORY OFFLINE", "phosphor");

  const bankCount = Math.max(4, Math.min(12, Math.floor(width / 5)));
  const banks = new Array<number>(bankCount);
  for (let index = 0; index < bankCount; index++) {
    const phaseShift = Math.sin(context.phase * 0.11 + index * 0.9) * 0.06;
    banks[index] = clamp(system.gpu.memoryPercent / 100 + phaseShift, 0, 1);
  }
  const bankRows = dependencies.barChart(banks, bankCount * 3, Math.max(3, Math.min(8, height - 5)), [
    " ",
    "░",
    "▒",
    "▓",
    "█",
  ]);
  return {
    body: [
      `VRAM ${formatPercent(system.gpu.memoryPercent)} ${
        dependencies.miniMeter(system.gpu.memoryPercent / 100, 14, drive.hazard)
      }`,
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

export function gpuAccent(utilization: number, memory: number, available: boolean): Accent {
  if (!available) return "violet";
  const pressure = Math.max(utilization, memory);
  return pressure >= 92 ? "alarm" : pressure >= 75 ? "amber" : memory > utilization ? "phosphor" : "violet";
}

export function gpuSeverity(utilization: number, memory: number): Severity {
  const pressure = Math.max(utilization, memory);
  return pressure >= 92 ? "alarm" : pressure >= 75 ? "warning" : "info";
}

export function gpuAlert(context: RenderContext) {
  const { gpu } = context.system;
  if (!gpu.available) return "";
  if (gpu.memoryPercent >= 92) return "VRAM LIMIT";
  if (gpu.utilizationPercent >= 95) return "GPU EXECUTION WALL";
  if ((gpu.temperatureCelsius ?? 0) >= 84) return "GPU THERMAL LIMIT";
  return "";
}

export function formatNullable(value: number | null, suffix: string) {
  return value === null ? "--" : `${value.toFixed(value >= 100 ? 0 : 1)}${suffix}`;
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

function crop(text: string, width: number) {
  if (width <= 0) return "";
  return text.length > width ? text.slice(0, Math.max(0, width - 1)) + "…" : text;
}
