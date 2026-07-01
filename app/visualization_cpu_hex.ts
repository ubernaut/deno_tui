import { clamp, formatPercent } from "./styles.ts";
import { buildVisualizationDrive } from "./visualization_drive.ts";
import type { PanelRender, RenderContext, Severity } from "./types.ts";

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

export function renderCpuHexGrid(context: RenderContext): PanelRender {
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

function crop(text: string, width: number) {
  if (width <= 0) return "";
  return text.length > width ? text.slice(0, Math.max(0, width - 1)) + "…" : text;
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
