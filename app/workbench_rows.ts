// Copyright 2023 Im-Beast. MIT license.
import { compactSpaces, wrapPlainText } from "../src/app/workbench_text.ts";
import { textWidth } from "../src/utils/strings.ts";

export interface WorkbenchRowTheme {
  buttonActiveText: string;
  buttonActiveBg: string;
  muted: string;
  panelSoft: string;
  soft: string;
  surface: string;
}

export interface RowStyle {
  text: string;
  fg?: string;
  bg?: string;
  bold?: boolean;
}

export interface DataFooterRowsOptions {
  page: number;
  pageCount: number;
  selectedKey?: string;
  width: number;
  theme: WorkbenchRowTheme;
  fit: (text: string, width: number) => string;
}

export interface ThreeHeaderPerformance {
  totalMs: number;
  initMs?: number;
  sceneMs: number;
  readbackMs: number;
  assemblyMs: number;
  cells: number;
  deferredReadbackSlots?: number;
  deferredReadbackPending?: number;
  deferredReadbackUnresolved?: number;
  deferredReadbackSaturated?: boolean;
  sourceMaxCells?: number;
  targetFps?: number;
  measuredFps?: number;
  pressureCells?: number;
  pressureHighFrames?: number;
  pressureLowFrames?: number;
  pressureByteRate?: number;
  pressureScoped?: boolean;
}

interface ThreeHeaderLabels {
  title: string;
  titleWidth: number;
  compactTitle: string;
}

const THREE_HEADER_GEOMETRY = "torus knot · sphere · block · floor plane";
const THREE_HEADER_COMPACT_GEOMETRY = "torus · sphere · block · floor";
const THREE_HEADER_GEOMETRY_WIDTH = textWidth(THREE_HEADER_GEOMETRY);
const threeHeaderLabelCache = new Map<string, ThreeHeaderLabels>();

/** Builds responsive title/detail rows for the built-in Three ASCII workbench window. */
export function threeHeaderRows(
  mode: string,
  width: number,
  theme: WorkbenchRowTheme,
  performance?: ThreeHeaderPerformance,
): RowStyle[] {
  const labels = threeHeaderLabels(mode);
  const perf = performance ? formatThreeHeaderPerformance(performance, width) : "";
  const titleText = width >= labels.titleWidth ? labels.title : labels.compactTitle;
  const detailBase = width >= THREE_HEADER_GEOMETRY_WIDTH ? THREE_HEADER_GEOMETRY : THREE_HEADER_COMPACT_GEOMETRY;
  const detailText = perf && width >= textWidth(`${detailBase} · ${perf}`)
    ? `${detailBase} · ${perf}`
    : perf && width >= textWidth(perf)
    ? perf
    : detailBase;
  return [
    {
      text: titleText,
      fg: theme.buttonActiveText,
      bg: theme.buttonActiveBg,
      bold: true,
    },
    { text: detailText, fg: theme.soft, bg: theme.surface },
    { text: "", bg: theme.surface },
  ];
}

function threeHeaderLabels(mode: string): ThreeHeaderLabels {
  const cached = threeHeaderLabelCache.get(mode);
  if (cached) return cached;
  const title = ` ${compactSpaces(`ACEROLA THREE.JS ASCII · ${mode} · STUDIO GEOMETRY`)} `;
  const compactTitle = ` ${compactSpaces(`THREE ASCII · ${mode}`)} `;
  const labels = {
    title,
    titleWidth: textWidth(title),
    compactTitle,
  };
  threeHeaderLabelCache.set(mode, labels);
  return labels;
}

function formatThreeHeaderPerformance(performance: ThreeHeaderPerformance, width: number): string {
  const total = `${Math.round(performance.totalMs)}ms`;
  const cells = `${performance.cells}c`;
  const cap = performance.sourceMaxCells && performance.sourceMaxCells !== performance.cells
    ? ` cap ${performance.sourceMaxCells}c`
    : "";
  const target = performance.targetFps ? ` @${Math.round(performance.targetFps)}fps` : "";
  const measured = performance.measuredFps ? ` live ${Math.round(performance.measuredFps)}fps` : "";
  const queue = formatThreeHeaderQueuePressure(performance);
  const pressure = formatThreeHeaderTerminalPressure(performance);
  const init = performance.initMs && performance.initMs > 0 ? ` init ${Math.round(performance.initMs)}` : "";
  const detailed = `frame ${total}${init} scene ${Math.round(performance.sceneMs)} read ${
    Math.round(performance.readbackMs)
  } asm ${Math.round(performance.assemblyMs)} ${cells}${cap}${target}${measured}${queue ? ` ${queue}` : ""}${
    pressure ? ` ${pressure}` : ""
  }`;
  if (width >= textWidth(detailed)) return detailed;
  const compact = `${total} ${cells}${measured || target}${queue ? ` ${queue}` : ""}${pressure ? ` ${pressure}` : ""}`;
  return width >= textWidth(compact) ? compact : `${total} ${cells}`;
}

function formatThreeHeaderQueuePressure(performance: ThreeHeaderPerformance): string {
  if (
    performance.deferredReadbackSlots === undefined ||
    performance.deferredReadbackUnresolved === undefined
  ) return "";
  const prefix = performance.deferredReadbackSaturated ? "sat" : "q";
  return `${prefix}${performance.deferredReadbackUnresolved}/${performance.deferredReadbackSlots}`;
}

function formatThreeHeaderTerminalPressure(performance: ThreeHeaderPerformance): string {
  if (performance.pressureCells === undefined) return "";
  const byteRate = performance.pressureByteRate && performance.pressureByteRate > 0
    ? ` ${formatCompactByteRate(performance.pressureByteRate)}`
    : "";
  const high = Math.max(0, Math.floor(performance.pressureHighFrames ?? 0));
  const low = Math.max(0, Math.floor(performance.pressureLowFrames ?? 0));
  const scoped = performance.pressureScoped === false ? "wide" : "io";
  return `${scoped}${byteRate} tier ${Math.max(1, Math.floor(performance.pressureCells))}c h${high}/l${low}`;
}

function formatCompactByteRate(bytesPerSecond: number): string {
  const value = Math.max(0, bytesPerSecond);
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(value >= 10_000_000 ? 0 : 1)}MB/s`;
  if (value >= 1_000) return `${Math.round(value / 1_000)}KB/s`;
  return `${Math.round(value)}B/s`;
}

/** Builds responsive footer rows for the API Workbench data table. */
export function dataFooterRows(options: DataFooterRowsOptions): RowStyle[] {
  const selected = options.selectedKey ?? "-";
  const full = compactSpaces(
    `page ${options.page}/${options.pageCount}  selected ${selected}  arrows/page keys  S sort`,
  );
  const texts = textWidth(full) <= options.width ? [full] : wrapPlainText(
    `page ${options.page}/${options.pageCount} selected ${selected} arrows/page keys S sort`,
    options.width,
    options.fit,
  );
  const rows = new Array<RowStyle>(texts.length);
  for (let index = 0; index < texts.length; index++) {
    rows[index] = { text: texts[index]!, fg: options.theme.muted, bg: options.theme.panelSoft };
  }
  return rows;
}
