import { formatBytes, formatDuration, formatPercent } from "./styles.ts";
import { buildVisualizationDrive, type VisualizationDrive } from "./visualization_drive.ts";
import type { Accent, PanelRender, RenderContext, Severity } from "./types.ts";

export interface SystemMonitorRenderDependencies {
  plotHistory(values: number[], width: number, height: number, glyph: string): string;
  miniMeter(value: number, width: number, heat: number): string;
  monitorGlyph(drive: VisualizationDrive, accent: Accent): string;
}

export function renderCpuMonitor(
  context: RenderContext,
  dependencies: SystemMonitorRenderDependencies,
): PanelRender {
  const { system, width, height } = context;
  const drive = buildVisualizationDrive(context, Math.max(width, 48));
  const graphHeight = Math.max(4, height - 3);
  const graph = dependencies.plotHistory(
    system.cpuHistory,
    Math.max(12, width),
    graphHeight,
    dependencies.monitorGlyph(drive, "signal"),
  );
  const topCores = topCpuCoreSummary(system.cpuCores);

  return {
    body: [
      `AVG ${system.cpuOverall.toFixed(1)}%   LOAD ${formatLoadAverage(system.loadavg)}`,
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

export function renderCpuLegend(
  context: RenderContext,
  dependencies: SystemMonitorRenderDependencies,
): PanelRender {
  const drive = buildVisualizationDrive(context, 24);
  const lines = [
    `TOTAL  ${formatPercent(context.system.cpuOverall)}`,
    ...cpuLegendRows(context.system.cpuCores, context.width, drive.hazard, dependencies),
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

export function renderMemoryMonitor(
  context: RenderContext,
  dependencies: SystemMonitorRenderDependencies,
): PanelRender {
  const { system, width, height } = context;
  const drive = buildVisualizationDrive(context, Math.max(width, 48));
  const graphWidth = Math.max(12, width);
  const graphHeight = Math.max(3, Math.floor((height - 4) / 2));
  const memoryGraph = dependencies.plotHistory(
    system.memoryHistory,
    graphWidth,
    graphHeight,
    dependencies.monitorGlyph(drive, "phosphor"),
  );
  const swapGraph = dependencies.plotHistory(
    system.swapHistory,
    graphWidth,
    graphHeight,
    drive.hazard >= 0.88 ? "█" : dependencies.monitorGlyph(drive, "amber"),
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

export function renderTemperatureMonitor(
  context: RenderContext,
  dependencies: SystemMonitorRenderDependencies,
): PanelRender {
  const drive = buildVisualizationDrive(context, 24);
  const temperatures = context.system.temperatures;
  return {
    body: temperatures.length === 0
      ? "NO THERMAL ZONES REPORTED"
      : temperatureRows(temperatures, Math.max(1, context.height), drive.hazard, dependencies).join("\n"),
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

export function renderDiskMonitor(
  context: RenderContext,
  dependencies: SystemMonitorRenderDependencies,
): PanelRender {
  const drive = buildVisualizationDrive(context, 32);
  const disks = context.system.disks;
  return {
    body: disks.length === 0
      ? "NO DISK METRICS AVAILABLE"
      : diskRows(disks, Math.max(1, context.height), drive.hazard, dependencies).join("\n"),
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

export function renderProcessMonitor(context: RenderContext): PanelRender {
  const drive = buildVisualizationDrive(context, 24);
  const header = "PID     NAME             CPU%   MEM%";
  const rows = processRows(context.system.processes, 100);

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

function topCpuCoreSummary(cores: RenderContext["system"]["cpuCores"]): string {
  if (cores.length === 0) return "";
  const sorted = cores.slice().sort((a, b) => b.usage - a.usage);
  const count = Math.min(4, sorted.length);
  const rows = new Array<string>(count);
  for (let index = 0; index < count; index += 1) {
    const core = sorted[index]!;
    rows[index] = `CPU${core.label.padStart(2, "0")} ${core.usage.toFixed(0).padStart(3, " ")}%`;
  }
  return rows.join("  ");
}

function formatLoadAverage(values: readonly number[]): string {
  if (values.length === 0) return "";
  const parts = new Array<string>(values.length);
  for (let index = 0; index < values.length; index += 1) {
    parts[index] = values[index]!.toFixed(2);
  }
  return parts.join(" / ");
}

function temperatureRows(
  temperatures: RenderContext["system"]["temperatures"],
  limit: number,
  hazard: number,
  dependencies: SystemMonitorRenderDependencies,
): string[] {
  const count = Math.min(limit, temperatures.length);
  const rows = new Array<string>(count);
  for (let index = 0; index < count; index += 1) {
    const entry = temperatures[index]!;
    rows[index] = `${entry.label.toUpperCase().padEnd(18, " ")} ${entry.celsius.toFixed(1).padStart(6, " ")}C ${
      heatMeter(entry.celsius / 100, hazard, dependencies)
    }`;
  }
  return rows;
}

function diskRows(
  disks: RenderContext["system"]["disks"],
  limit: number,
  hazard: number,
  dependencies: SystemMonitorRenderDependencies,
): string[] {
  const count = Math.min(limit, disks.length);
  const rows = new Array<string>(count);
  for (let index = 0; index < count; index += 1) {
    const disk = disks[index]!;
    rows[index] = `${crop(disk.mount.toUpperCase(), 12).padEnd(12, " ")} ${String(disk.percent).padStart(3, " ")}% ${
      dependencies.miniMeter(disk.percent / 100, 7, hazard)
    } ${formatBytes(disk.available).padStart(8, " ")} FREE`;
  }
  return rows;
}

function processRows(processes: RenderContext["system"]["processes"], limit: number): string[] {
  const count = Math.min(limit, processes.length);
  const rows = new Array<string>(count);
  for (let index = 0; index < count; index += 1) {
    const process = processes[index]!;
    rows[index] = `${String(process.pid).padEnd(7, " ")}${crop(process.name, 16).padEnd(16, " ")}${
      process.cpuPercent.toFixed(1).padStart(6, " ")
    }${process.memoryPercent.toFixed(1).padStart(7, " ")}`;
  }
  return rows;
}

function cpuLegendRows(
  cores: RenderContext["system"]["cpuCores"],
  width: number,
  hazard: number,
  dependencies: SystemMonitorRenderDependencies,
): string[] {
  if (cores.length === 0) return ["NO CORE DATA"];

  const sample = coreLegendCell(cores[0]!, hazard, dependencies);
  const cellWidth = Math.max(12, sample.length);
  const columns = Math.max(1, Math.min(8, Math.floor((Math.max(12, width) + 2) / (cellWidth + 2))));
  const rows = Math.ceil(cores.length / columns);
  const result: string[] = new Array(rows);

  for (let row = 0; row < rows; row++) {
    let line = "";
    for (let column = 0; column < columns; column++) {
      const core = cores[row + column * rows];
      if (!core) continue;
      if (line.length > 0) line += "  ";
      line += coreLegendCell(core, hazard, dependencies).padEnd(cellWidth, " ");
    }
    result[row] = crop(line, Math.max(12, width));
  }

  return result;
}

function coreLegendCell(
  core: RenderContext["system"]["cpuCores"][number],
  hazard: number,
  dependencies: SystemMonitorRenderDependencies,
): string {
  return `${core.label.padStart(3, "0")} ${dependencies.miniMeter(core.usage / 100, 6, hazard)} ${
    formatPercent(core.usage)
  }`;
}

function heatMeter(value: number, heat: number, dependencies: SystemMonitorRenderDependencies) {
  const width = heat >= 0.9 ? 5 : 4;
  return dependencies.miniMeter(value, width, heat);
}

function alertText(context: RenderContext) {
  const alert = context.system.alerts[0];
  return alert ? `${alert.title} / ${alert.detail}` : "";
}

function severityForValue(value: number, warning: number, alarm: number): Severity {
  return value >= alarm ? "alarm" : value >= warning ? "warning" : "info";
}

function crop(text: string, width: number) {
  if (width <= 0) return "";
  return text.length > width ? text.slice(0, Math.max(0, width - 1)) + "…" : text;
}
