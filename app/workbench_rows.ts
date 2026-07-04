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
}

/** Builds responsive title/detail rows for the built-in Three ASCII workbench window. */
export function threeHeaderRows(
  mode: string,
  width: number,
  theme: WorkbenchRowTheme,
  performance?: ThreeHeaderPerformance,
): RowStyle[] {
  const title = compactSpaces(`ACEROLA THREE.JS ASCII · ${mode} · STUDIO GEOMETRY`);
  const compactTitle = compactSpaces(`THREE ASCII · ${mode}`);
  const geometry = "torus knot · sphere · block · floor plane";
  const compactGeometry = "torus · sphere · block · floor";
  const perf = performance ? formatThreeHeaderPerformance(performance, width) : "";
  const titleText = width >= textWidth(` ${title} `) ? ` ${title} ` : ` ${compactTitle} `;
  const detailBase = width >= textWidth(geometry) ? geometry : compactGeometry;
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

function formatThreeHeaderPerformance(performance: ThreeHeaderPerformance, width: number): string {
  const total = `${Math.round(performance.totalMs)}ms`;
  const cells = `${performance.cells}c`;
  const cap = performance.sourceMaxCells && performance.sourceMaxCells !== performance.cells
    ? ` cap ${performance.sourceMaxCells}c`
    : "";
  const target = performance.targetFps ? ` @${Math.round(performance.targetFps)}fps` : "";
  const queue = formatThreeHeaderQueuePressure(performance);
  const detailed = `frame ${total} scene ${Math.round(performance.sceneMs)} read ${
    Math.round(performance.readbackMs)
  } asm ${Math.round(performance.assemblyMs)} ${cells}${cap}${target}${queue ? ` ${queue}` : ""}`;
  if (width >= textWidth(detailed)) return detailed;
  const compact = `${total} ${cells}${target}${queue ? ` ${queue}` : ""}`;
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
