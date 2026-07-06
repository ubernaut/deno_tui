import { workbenchAsciiRendererModeLabel } from "../src/app/workbench_ascii.ts";
import type { WorkbenchFrame } from "../src/app/workbench_frame.ts";
import type { RowStyle } from "../src/app/workbench_rows.ts";
import { compactSpaces } from "../src/app/workbench_text.ts";
import { workbenchThreeBodyRect } from "../src/app/workbench_three_policy.ts";
import { terminalGlyphStyleLabel } from "../src/three_ascii/options.ts";
import type { Rectangle } from "../src/types.ts";
import type { ApiWorkbenchThemeSpec } from "./api_workbench_catalog.ts";
import type { AsciiOptions, PanelRender, SystemSnapshot } from "./types.ts";
import { type CpuHexTileLayout, cpuHexTileLayoutInto } from "./visualization_system.ts";

interface ApiWorkbenchVisualizationPaintStyle {
  fg?: string;
  bg?: string;
  bold?: boolean;
}

interface WorkbenchVisualizationWindowOption {
  label: string;
  description: string;
  group: string;
}

interface WorkbenchVisualizationRowsTheme {
  background: string;
  danger: string;
  muted: string;
  panelSoft: string;
  soft: string;
  surface: string;
  text: string;
  warn: string;
}

interface ApiWorkbenchVisualizationMissingRenderOptions {
  frame: WorkbenchFrame;
  rect: Rectangle;
  theme: ApiWorkbenchThemeSpec;
  writeRows: (frame: WorkbenchFrame, rect: Rectangle, rows: readonly RowStyle[]) => void;
}

interface ApiWorkbenchVisualizationThreeChromeRenderOptions {
  frame: WorkbenchFrame;
  rect: Rectangle;
  option: WorkbenchVisualizationWindowOption;
  rendered: PanelRender;
  ascii: AsciiOptions;
  accent: string;
  theme: ApiWorkbenchThemeSpec;
  contrastText: (background: string, dark: string, light: string) => string;
  fit: (text: string, width: number) => string;
  paint: (text: string, style: ApiWorkbenchVisualizationPaintStyle) => string;
  write: (frame: WorkbenchFrame, row: number, column: number, value: string) => void;
  writeRows: (frame: WorkbenchFrame, rect: Rectangle, rows: readonly RowStyle[]) => void;
}

interface ApiWorkbenchVisualizationTextRenderOptions {
  frame: WorkbenchFrame;
  rect: Rectangle;
  option: WorkbenchVisualizationWindowOption;
  rendered: PanelRender;
  accent: string;
  rows: RowStyle[];
  textRows: string[];
  theme: ApiWorkbenchThemeSpec;
  contrastText: (background: string, dark: string, light: string) => string;
  writeRows: (frame: WorkbenchFrame, rect: Rectangle, rows: readonly RowStyle[]) => void;
}

interface ApiWorkbenchCpuHexTileHitOptions<TId extends string> {
  id: TId;
  rect: Rectangle;
  cores: SystemSnapshot["cpuCores"];
  width: number;
  height: number;
  tiles: CpuHexTileLayout[];
  addHit: (
    rect: Rectangle,
    action: { type: "cpuHexTile"; id: TId; label: string },
  ) => void;
}

/** Renders the missing-visualization placeholder used by dynamic workbench windows. */
export function renderApiWorkbenchVisualizationMissing(options: ApiWorkbenchVisualizationMissingRenderOptions): void {
  const { frame, rect, theme, writeRows } = options;
  writeRows(frame, rect, [
    { text: "Visualization window not found", fg: theme.warn, bg: theme.surface, bold: true },
  ]);
}

/** Renders visualization Three-window chrome and returns the viewport rect for the grid body. */
export function renderApiWorkbenchVisualizationThreeChrome(
  options: ApiWorkbenchVisualizationThreeChromeRenderOptions,
): Rectangle {
  const { frame, rect, option, rendered, ascii, accent, theme: t, contrastText, fit, paint, write, writeRows } =
    options;
  writeRows(frame, rect, [
    {
      text: ` ${option.group.toUpperCase()} · ${rendered.title ?? option.label.toUpperCase()} `,
      fg: contrastText(accent, t.background, t.text),
      bg: accent,
      bold: true,
    },
    {
      text: rendered.alert ? `! ${rendered.alert}` : option.description,
      fg: rendered.severity === "alarm" ? t.danger : rendered.severity === "warning" ? t.warn : t.soft,
      bg: t.surface,
      bold: rendered.severity !== "info",
    },
    {
      text: visualizationThreeStatusLine(rendered, option, ascii),
      fg: t.buttonActiveText,
      bg: t.buttonActiveBg,
      bold: true,
    },
  ]);
  if (rect.height > 3) {
    write(
      frame,
      rect.row + rect.height - 1,
      rect.column,
      paint(fit(rendered.footer, rect.width), { fg: t.muted, bg: t.panelSoft }),
    );
  }
  return workbenchThreeBodyRect(rect, { headerRows: 3, footerRows: 1 });
}

/** Renders a text-backed visualization window into caller-owned row buffers. */
export function renderApiWorkbenchVisualizationTextWindow(options: ApiWorkbenchVisualizationTextRenderOptions): void {
  const { frame, rect, option, rendered, accent, rows, textRows, theme, contrastText, writeRows } = options;
  writeRows(
    frame,
    rect,
    workbenchVisualizationRowsInto(rows, textRows, option, rendered, {
      accent,
      theme,
      contrast: contrastText,
    }),
  );
}

function workbenchVisualizationRowsInto(
  target: RowStyle[],
  textRows: string[],
  option: WorkbenchVisualizationWindowOption,
  rendered: PanelRender,
  options: {
    accent: string;
    theme: WorkbenchVisualizationRowsTheme;
    contrast: (color: string, darkFallback: string, lightFallback: string) => string;
  },
): RowStyle[] {
  const rows = visualizationWindowRowsInto(textRows, option, rendered);
  const { accent, theme: t, contrast } = options;
  target.length = rows.length;
  for (let index = 0; index < rows.length; index += 1) {
    const row = target[index] ?? { text: "" };
    row.text = rows[index]!;
    if (index === 0) {
      row.fg = contrast(accent, t.background, t.text);
      row.bg = accent;
      row.bold = true;
    } else if (index === 1) {
      row.fg = rendered.severity === "alarm" ? t.danger : rendered.severity === "warning" ? t.warn : t.soft;
      row.bg = t.surface;
      row.bold = rendered.severity !== "info";
    } else if (index === rows.length - 1) {
      row.fg = t.muted;
      row.bg = t.panelSoft;
      row.bold = undefined;
    } else {
      const bodyIndex = index - 2;
      row.fg = bodyIndex % 3 === 0 ? accent : bodyIndex % 3 === 1 ? t.text : t.soft;
      row.bg = t.surface;
      row.bold = bodyIndex === 0;
    }
    target[index] = row;
  }
  return target;
}

function visualizationWindowRowsInto(
  target: string[],
  option: WorkbenchVisualizationWindowOption,
  rendered: PanelRender,
): string[] {
  target.length = 0;
  target.push(
    ` ${option.group.toUpperCase()} · ${rendered.title ?? option.label.toUpperCase()} `,
    rendered.alert ? `! ${rendered.alert}` : option.description,
  );
  appendBodyLines(target, rendered.body);
  target.push(rendered.footer);
  return target;
}

function visualizationThreeStatusLine(
  rendered: PanelRender,
  option: WorkbenchVisualizationWindowOption,
  options: AsciiOptions,
): string {
  const mode = rendered.three?.mode.toUpperCase() ?? "TEXT";
  return compactSpaces(`ACEROLA ${mode} · ${threeRendererModeLabel(options).toUpperCase()} · ${option.label}`);
}

function threeRendererModeLabel(options: AsciiOptions): string {
  return workbenchAsciiRendererModeLabel(options, terminalGlyphStyleLabel);
}

function appendBodyLines(target: string[], body: string): void {
  let start = 0;
  for (let index = 0; index <= body.length; index += 1) {
    if (index < body.length && body[index] !== "\n") continue;
    target.push(body.slice(start, index));
    start = index + 1;
  }
}

/** Registers hit targets for CPU hex tiles in the rendered visualization body. */
export function addApiWorkbenchCpuHexTileHits<TId extends string>(
  options: ApiWorkbenchCpuHexTileHitOptions<TId>,
): void {
  const { id, rect, cores, width, height, tiles, addHit } = options;
  const laidOutTiles = cpuHexTileLayoutInto(tiles, cores, width, height);
  const bodyHeaderRows = 2;
  const cpuHexSummaryRows = 2;
  const rowOffset = rect.row + bodyHeaderRows + cpuHexSummaryRows;
  for (const tile of laidOutTiles) {
    addHit({
      column: rect.column + tile.column,
      row: rowOffset + tile.row,
      width: tile.width,
      height: tile.height,
    }, { type: "cpuHexTile", id, label: tile.label });
  }
}
