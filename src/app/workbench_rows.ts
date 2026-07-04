// Copyright 2023 Im-Beast. MIT license.
import { textWidth } from "../utils/strings.ts";
import { compactSpaces, wrapPlainText } from "./workbench_text.ts";
import { type ThreeHeaderPerformance, threeHeaderPerformanceText } from "./workbench_three_header.ts";

export type { ThreeHeaderPerformance } from "./workbench_three_header.ts";

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
  const perf = performance ? threeHeaderPerformanceText(performance, width) : "";
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
