// Copyright 2023 Im-Beast. MIT license.
import { textWidth } from "../utils/strings.ts";
import { compactSpaces, wrapPlainText } from "./workbench_text.ts";
import type { ThreeAsciiRendererPerformance } from "../three_ascii/renderer.ts";

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

interface ThreeHeaderLabels {
  title: string;
  titleWidth: number;
  compactTitle: string;
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
  pressureChangedRows?: number;
  pressureRenderedRows?: number;
}

export interface ThreeHeaderWorkbenchTelemetry {
  sourceMaxCells?: number;
  targetFps?: number;
  measuredFps?: number;
  pressureCells?: number;
  pressureHighFrames?: number;
  pressureLowFrames?: number;
  pressureByteRate?: number;
  pressureScoped?: boolean;
  pressureChangedRows?: number;
  pressureRenderedRows?: number;
}

export interface ThreeHeaderRuntimeTelemetry {
  sourceMaxCells: number;
  frameIntervalMs: number;
  measuredFps?: number;
  pressure: {
    currentCells: number;
    highFrames: number;
    lowFrames: number;
    lastByteRate: number;
    lastScoped: boolean;
    lastChangedRows: number;
    lastRenderedRows: number;
  };
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
  return threeHeaderRowsInto([], mode, width, theme, performance);
}

/** Builds responsive Three ASCII header rows into caller-owned storage. */
export function threeHeaderRowsInto(
  target: RowStyle[],
  mode: string,
  width: number,
  theme: WorkbenchRowTheme,
  performance?: ThreeHeaderPerformance,
): RowStyle[] {
  const labels = threeHeaderLabels(mode);
  const perf = performance ? threeHeaderPerformanceText(performance, width) : "";
  const titleText = width >= labels.titleWidth ? labels.title : labels.compactTitle;
  const detailBase = width >= THREE_HEADER_GEOMETRY_WIDTH ? THREE_HEADER_GEOMETRY : THREE_HEADER_COMPACT_GEOMETRY;
  const detailText = perf && width >= textWidth(`${detailBase} · ${perf}`)
    ? `${detailBase} · ${perf}`
    : perf && width >= textWidth(perf)
    ? perf
    : detailBase;
  target.length = 3;
  target[0] = writeRowStyle(target[0], titleText, theme.buttonActiveText, theme.buttonActiveBg, true);
  target[1] = writeRowStyle(target[1], detailText, theme.soft, theme.surface);
  target[2] = writeRowStyle(target[2], "", undefined, theme.surface);
  return target;
}

/** Copies renderer and workbench telemetry into a caller-owned header snapshot. */
export function writeThreeHeaderPerformance(
  target: ThreeHeaderPerformance,
  renderer: ThreeAsciiRendererPerformance,
  telemetry: ThreeHeaderWorkbenchTelemetry = {},
): ThreeHeaderPerformance {
  target.totalMs = renderer.totalMs;
  target.initMs = renderer.initMs;
  target.sceneMs = renderer.sceneMs;
  target.readbackMs = renderer.readbackMs;
  target.assemblyMs = renderer.assemblyMs;
  target.cells = renderer.cells;
  target.deferredReadbackSlots = renderer.deferredReadbackSlots;
  target.deferredReadbackPending = renderer.deferredReadbackPending;
  target.deferredReadbackUnresolved = renderer.deferredReadbackUnresolved;
  target.deferredReadbackSaturated = renderer.deferredReadbackSaturated;
  target.sourceMaxCells = telemetry.sourceMaxCells;
  target.targetFps = telemetry.targetFps;
  target.measuredFps = telemetry.measuredFps;
  target.pressureCells = telemetry.pressureCells;
  target.pressureHighFrames = telemetry.pressureHighFrames;
  target.pressureLowFrames = telemetry.pressureLowFrames;
  target.pressureByteRate = telemetry.pressureByteRate;
  target.pressureScoped = telemetry.pressureScoped;
  target.pressureChangedRows = telemetry.pressureChangedRows;
  target.pressureRenderedRows = telemetry.pressureRenderedRows;
  return target;
}

/** Copies renderer telemetry plus workbench runtime pressure/cadence into a caller-owned header snapshot. */
export function writeThreeHeaderRuntimePerformance(
  target: ThreeHeaderPerformance,
  renderer: ThreeAsciiRendererPerformance,
  telemetry: ThreeHeaderRuntimeTelemetry,
): ThreeHeaderPerformance {
  return writeThreeHeaderPerformance(target, renderer, {
    sourceMaxCells: telemetry.sourceMaxCells,
    targetFps: telemetry.frameIntervalMs > 0 ? 1000 / telemetry.frameIntervalMs : undefined,
    measuredFps: telemetry.measuredFps,
    pressureCells: telemetry.pressure.currentCells,
    pressureHighFrames: telemetry.pressure.highFrames,
    pressureLowFrames: telemetry.pressure.lowFrames,
    pressureByteRate: telemetry.pressure.lastByteRate,
    pressureScoped: telemetry.pressure.lastScoped,
    pressureChangedRows: telemetry.pressure.lastChangedRows,
    pressureRenderedRows: telemetry.pressure.lastRenderedRows,
  });
}

/** Builds the responsive performance segment shown in the workbench Three header. */
export function threeHeaderPerformanceText(performance: ThreeHeaderPerformance, width: number): string {
  const total = `${Math.round(performance.totalMs)}ms`;
  const cells = `${performance.cells}c`;
  const cap = performance.sourceMaxCells && performance.sourceMaxCells !== performance.cells
    ? ` cap ${performance.sourceMaxCells}c`
    : "";
  const target = performance.targetFps ? ` @${Math.round(performance.targetFps)}fps` : "";
  const measured = performance.measuredFps ? ` live ${Math.round(performance.measuredFps)}fps` : "";
  const queue = threeHeaderQueuePressureText(performance);
  const pressure = threeHeaderTerminalPressureText(performance);
  const init = performance.initMs && performance.initMs > 0 ? ` init ${Math.round(performance.initMs)}` : "";
  const detailed = `frame ${total}${init} scene ${Math.round(performance.sceneMs)} read ${
    Math.round(performance.readbackMs)
  } asm ${Math.round(performance.assemblyMs)} ${cells}${cap}${target}${measured}${queue ? ` ${queue}` : ""}${
    pressure ? ` ${pressure}` : ""
  }`;
  if (width >= detailed.length) return detailed;

  const compact = `${total} ${cells}${measured || target}${queue ? ` ${queue}` : ""}${pressure ? ` ${pressure}` : ""}`;
  if (width >= compact.length) return compact;

  const essential = `${total} ${cells}${measured || target}`;
  return width >= essential.length ? essential : `${total} ${cells}`;
}

function threeHeaderQueuePressureText(performance: ThreeHeaderPerformance): string {
  if (
    performance.deferredReadbackSlots === undefined ||
    performance.deferredReadbackUnresolved === undefined
  ) return "";
  const prefix = performance.deferredReadbackSaturated ? "sat" : "q";
  return `${prefix}${performance.deferredReadbackUnresolved}/${performance.deferredReadbackSlots}`;
}

function threeHeaderTerminalPressureText(performance: ThreeHeaderPerformance): string {
  if (performance.pressureCells === undefined) return "";
  const byteRate = performance.pressureByteRate && performance.pressureByteRate > 0
    ? ` ${formatCompactByteRate(performance.pressureByteRate)}`
    : "";
  const high = Math.max(0, Math.floor(performance.pressureHighFrames ?? 0));
  const low = Math.max(0, Math.floor(performance.pressureLowFrames ?? 0));
  const scoped = performance.pressureScoped === false ? "wide" : "io";
  const rows = threeHeaderTerminalPressureRowsText(performance);
  return `${scoped}${byteRate}${rows} tier ${Math.max(1, Math.floor(performance.pressureCells))}c h${high}/l${low}`;
}

function threeHeaderTerminalPressureRowsText(performance: ThreeHeaderPerformance): string {
  if (performance.pressureChangedRows === undefined && performance.pressureRenderedRows === undefined) return "";
  const changed = Math.max(0, Math.floor(performance.pressureChangedRows ?? 0));
  const rendered = Math.max(0, Math.floor(performance.pressureRenderedRows ?? 0));
  return ` rows ${changed}/${rendered}`;
}

function formatCompactByteRate(bytesPerSecond: number): string {
  const value = Math.max(0, bytesPerSecond);
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(value >= 10_000_000 ? 0 : 1)}MB/s`;
  if (value >= 1_000) return `${Math.round(value / 1_000)}KB/s`;
  return `${Math.round(value)}B/s`;
}

function writeRowStyle(
  target: RowStyle | undefined,
  text: string,
  fg: string | undefined,
  bg: string | undefined,
  bold?: boolean,
): RowStyle {
  const row = target ?? { text: "" };
  row.text = text;
  if (fg === undefined) delete row.fg;
  else row.fg = fg;
  if (bg === undefined) delete row.bg;
  else row.bg = bg;
  if (bold === undefined) delete row.bold;
  else row.bold = bold;
  return row;
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
