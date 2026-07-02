import { clamp, formatPercent } from "./styles.ts";
import { buildVisualizationDrive } from "./visualization_drive.ts";
import type { PanelRender, RenderContext, Severity } from "./types.ts";

type CpuCoreSnapshot = RenderContext["system"]["cpuCores"][number];
type CpuProcessSnapshot = RenderContext["system"]["processes"][number];
export type CpuHexNavigationKey = "left" | "right" | "up" | "down" | "home" | "end";

const cpuHexColorStops = [
  { percent: 0, rgb: [45, 112, 255] },
  { percent: 25, rgb: [22, 214, 107] },
  { percent: 50, rgb: [255, 226, 74] },
  { percent: 75, rgb: [255, 159, 36] },
  { percent: 100, rgb: [255, 66, 49] },
] as const;

export function cpuActivityRgb(percent: number): [number, number, number] {
  const value = Number.isFinite(percent) ? clamp(percent, 0, 100) : 0;
  let upperIndex = cpuHexColorStops.length - 1;
  for (let index = 0; index < cpuHexColorStops.length; index += 1) {
    if (value <= cpuHexColorStops[index]!.percent) {
      upperIndex = index;
      break;
    }
  }
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
  const labelWidth = cpuHexLabelWidth(cores);
  const mode = cpuHexTileMode(width, height, cores.length, labelWidth);
  return cpuHexColumns(width, cpuHexTileWidth(mode, labelWidth));
}

export function cpuHexTileLayout(
  cores: RenderContext["system"]["cpuCores"],
  width: number,
  height: number,
): CpuHexTileLayout[] {
  if (cores.length === 0) return [];
  const labelWidth = cpuHexLabelWidth(cores);
  const mode = cpuHexTileMode(width, height, cores.length, labelWidth);
  const tileWidth = cpuHexTileWidth(mode, labelWidth);
  const tileHeight = cpuHexTileHeight(mode);
  const columns = cpuHexColumns(width, tileWidth);
  const layout = new Array<CpuHexTileLayout>(cores.length);
  for (let index = 0; index < cores.length; index++) {
    const core = cores[index]!;
    const logicalRow = Math.floor(index / columns);
    const columnIndex = index % columns;
    const indent = logicalRow % 2 === 1 ? cpuHexIndent(width, tileWidth) : 0;
    layout[index] = {
      core,
      label: core.label,
      column: indent + columnIndex * (tileWidth + 1),
      row: logicalRow * tileHeight,
      width: tileWidth,
      height: tileHeight,
    };
  }
  return layout;
}

export function processMatchesCpuLabel(process: CpuProcessSnapshot, label: string): boolean {
  const cpuId = Number(label);
  return Number.isFinite(cpuId) ? process.processor === cpuId : String(process.processor) === label;
}

export function topCpuProcessLabelForCpu(
  label: string,
  processes: readonly CpuProcessSnapshot[],
  limit = 3,
): string {
  const boundedLimit = Math.max(0, Math.floor(limit));
  let count = 0;
  let output = "";
  for (let index = 0; index < processes.length && count < boundedLimit; index += 1) {
    const process = processes[index]!;
    if (!processMatchesCpuLabel(process, label)) continue;
    if (count > 0) output += ", ";
    output += `${process.name}:${process.cpuPercent.toFixed(0)}%`;
    count += 1;
  }
  return count > 0 ? output : "no top process in sample";
}

export function nextCpuHexLabel(
  cores: readonly CpuCoreSnapshot[],
  currentLabel: string | undefined,
  key: CpuHexNavigationKey,
  columns: number,
): string | undefined {
  if (cores.length === 0) return undefined;
  const currentIndex = Math.max(0, cores.findIndex((core) => core.label === currentLabel));
  const clampedColumns = Math.max(1, Math.floor(columns));
  const rawNextIndex = key === "home"
    ? 0
    : key === "end"
    ? cores.length - 1
    : key === "left"
    ? currentIndex - 1
    : key === "right"
    ? currentIndex + 1
    : key === "up"
    ? currentIndex - clampedColumns
    : currentIndex + clampedColumns;
  return cores[Math.max(0, Math.min(cores.length - 1, rawNextIndex))]!.label;
}

export function renderCpuHexGrid(context: RenderContext): PanelRender {
  const { system, width, height } = context;
  const drive = buildVisualizationDrive(context, Math.max(width, 48));
  const cores = system.cpuCores;

  if (cores.length === 0) {
    return {
      body: "NO CORE DATA",
      footer: `HOST ${system.hostname.toUpperCase()}  LOAD ${formatLoadAverage(system.loadavg)}`,
      alert: "",
      accent: "signal",
      severity: "info",
    };
  }

  let hotCore = cores[0]!;
  for (let index = 1; index < cores.length; index += 1) {
    const core = cores[index]!;
    if (core.usage > hotCore.usage) hotCore = core;
  }
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
  if (width >= 26) {
    let full = "LOAD ";
    for (let index = 0; index < stops.length; index += 1) {
      const [label, percent] = stops[index]!;
      if (index > 0) full += " ";
      full += cpuHexColorize(percent, "⬢") + label;
    }
    return full;
  }
  if (width >= 10) {
    let compact = "";
    for (let index = 0; index < stops.length; index += 1) {
      if (index > 0) compact += " ";
      compact += cpuHexColorize(stops[index]![1], "⬢");
    }
    return compact;
  }
  const count = Math.max(1, Math.min(width, stops.length));
  let narrow = "";
  for (let index = 0; index < count; index += 1) {
    narrow += cpuHexColorize(stops[index]![1], "⬢");
  }
  return narrow;
}

function cpuHexGridRows(
  cores: RenderContext["system"]["cpuCores"],
  width: number,
  height: number,
  selectedCpuLabel?: string,
): string[] {
  const labelWidth = cpuHexLabelWidth(cores);
  const mode = cpuHexTileMode(width, height, cores.length, labelWidth);
  const tileWidth = cpuHexTileWidth(mode, labelWidth);
  const layout = cpuHexTileLayout(cores, width, height);
  let rows = 1;
  for (const tile of layout) {
    rows = Math.max(rows, tile.row + tile.height);
  }
  const cursors = new Array<number>(rows);
  const lines = new Array<string>(rows);
  for (let index = 0; index < rows; index++) {
    cursors[index] = 0;
    lines[index] = "";
  }

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

function cpuHexLabelWidth(cores: RenderContext["system"]["cpuCores"]): number {
  let width = 3;
  for (const core of cores) {
    width = Math.max(width, core.label.length);
  }
  return width;
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
  for (const core of cores) {
    if (
      core.label === selectedCpuLabel ||
      (Number.isFinite(selectedNumber) && Number(core.label) === selectedNumber)
    ) {
      return core;
    }
  }
  return undefined;
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
  let hasProcessorSamples = false;
  for (const process of system.processes) {
    if (Number.isFinite(process.processor)) {
      hasProcessorSamples = true;
      break;
    }
  }
  if (!hasProcessorSamples) {
    return [header, crop("PROCESSOR FIELD UNAVAILABLE IN THIS SAMPLE", width)];
  }

  const maxProcesses = width >= 48 ? 6 : 4;
  let matchCount = 0;
  for (const process of system.processes) {
    if (processMatchesCpuLabel(process, core.label)) matchCount += 1;
  }
  if (matchCount === 0) {
    return [header, crop("NO TOP PROCESS LAST SEEN ON THIS CPU", width)];
  }

  const rows = new Array<string>(Math.min(maxProcesses, matchCount) + 3);
  rows[0] = header;
  rows[1] = crop("TOP PROCESSES LAST SEEN ON CPU", width);
  rows[2] = crop(width >= 48 ? "PID      CPU%   MEM%  S  NAME" : "PID     CPU%  MEM% NAME", width);
  let rowIndex = 3;
  for (const process of system.processes) {
    if (!processMatchesCpuLabel(process, core.label)) continue;
    rows[rowIndex] = cpuHexProcessLine(process, width);
    rowIndex += 1;
    if (rowIndex >= rows.length) break;
  }
  return rows;
}

function cpuIdRange(cores: RenderContext["system"]["cpuCores"]): string {
  if (cores.length === 0) return "";
  let min = Infinity;
  let max = -Infinity;
  for (const core of cores) {
    const id = Number(core.label);
    if (!Number.isFinite(id)) return "";
    min = Math.min(min, id);
    max = Math.max(max, id);
  }
  return `${min}-${max}`;
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

function crop(text: string, width: number) {
  if (width <= 0) return "";
  return text.length > width ? text.slice(0, Math.max(0, width - 1)) + "…" : text;
}

function formatLoadAverage(loadavg: readonly number[]): string {
  if (loadavg.length === 0) return "";
  let text = "";
  for (let index = 0; index < loadavg.length; index += 1) {
    if (index > 0) text += "/";
    text += loadavg[index]!.toFixed(2);
  }
  return text;
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
