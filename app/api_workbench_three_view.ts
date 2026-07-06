import type { WorkbenchFrame } from "../src/app/workbench_frame.ts";
import {
  type RowStyle,
  type ThreeHeaderPerformance,
  threeHeaderRowsInto,
  writeThreeHeaderRuntimePerformance,
} from "../src/app/workbench_rows.ts";
import {
  renderWorkbenchThreeSurface,
  type WorkbenchThreeGridProjectionCache,
  type WorkbenchThreeGridScaleMode,
  type WorkbenchThreeSurfaceRenderResult,
} from "../src/app/workbench_three_grid.ts";
import type { ApiWorkbenchThreePressureInspection } from "../src/app/workbench_three_runtime.ts";
import type { ThreeAsciiRendererPerformance } from "../src/three_ascii/renderer.ts";
import { terminalGlyphStyleLabel } from "../src/three_ascii/options.ts";
import type { Rectangle } from "../src/types.ts";
import type { ApiWorkbenchThemeSpec } from "./api_workbench_catalog.ts";
import type { AsciiOptions } from "./types.ts";

interface ApiWorkbenchThreePaintStyle {
  bg?: string;
}

interface ApiWorkbenchThreeHeaderRenderOptions {
  frame: WorkbenchFrame;
  rect: Rectangle;
  mode: string;
  theme: ApiWorkbenchThemeSpec;
  rows: RowStyle[];
  performanceTarget: ThreeHeaderPerformance;
  rendererPerformance?: ThreeAsciiRendererPerformance;
  sourceMaxCells: number;
  frameIntervalMs: number;
  measuredFps?: number;
  pressure: ApiWorkbenchThreePressureInspection;
  writeRows: (frame: WorkbenchFrame, rect: Rectangle, rows: readonly RowStyle[]) => void;
}

interface ApiWorkbenchThreeFallbackRenderOptions {
  frame: WorkbenchFrame;
  rect: Rectangle;
  terminalGlyphStyle: AsciiOptions["terminalGlyphStyle"];
  rendererAvailable: boolean;
  rows: RowStyle[];
  theme: ApiWorkbenchThemeSpec;
  center: (text: string, width: number) => string;
  writeRows: (frame: WorkbenchFrame, rect: Rectangle, rows: readonly RowStyle[]) => void;
}

interface ApiWorkbenchThreeSurfaceRenderOptions {
  frame: WorkbenchFrame;
  rect: Rectangle;
  grid: readonly (readonly string[] | undefined)[];
  theme: ApiWorkbenchThemeSpec;
  projectionCache: WorkbenchThreeGridProjectionCache;
  statusRows: RowStyle[];
  paint: (text: string, style: ApiWorkbenchThreePaintStyle) => string;
  center: (text: string, width: number) => string;
  writeRows: (frame: WorkbenchFrame, rect: Rectangle, rows: readonly RowStyle[]) => void;
  scale?: WorkbenchThreeGridScaleMode;
  countForPressure?: boolean;
  statusMessage: string;
  onPressureRows?: (rows: number) => void;
}

const WORKBENCH_THREE_FALLBACK_BODY: readonly string[] = [
  "         .-=========-.         ",
  "      .-#%%%@@@@@@%%%#-.       ",
  "    .+%%@*=-.     .-=*@%+.     ",
  "   :#%@-     TORUS     -@%#:   ",
  "   *%@=   <> SPHERE <>  =@%*   ",
  "   :#%@-      CUBE      -@%#:  ",
  "    .+%%@*=-.     .-=*@%+.     ",
  "      .-#%%%@@@@@@%%%#-.       ",
  "         `-=========-'         ",
] as const;

/** Renders the built-in Three window header and runtime telemetry into caller-owned row storage. */
export function renderApiWorkbenchThreeHeader(options: ApiWorkbenchThreeHeaderRenderOptions): void {
  const {
    frame,
    rect,
    mode,
    theme,
    rows,
    performanceTarget,
    rendererPerformance,
    sourceMaxCells,
    frameIntervalMs,
    measuredFps,
    pressure,
    writeRows,
  } = options;
  writeRows(
    frame,
    rect,
    threeHeaderRowsInto(
      rows,
      mode,
      rect.width,
      theme,
      rendererPerformance
        ? writeThreeHeaderRuntimePerformance(performanceTarget, rendererPerformance, {
          sourceMaxCells,
          frameIntervalMs,
          measuredFps,
          pressure,
        })
        : undefined,
    ),
  );
}

/** Renders the text fallback shown while the built-in Three renderer cannot provide a grid. */
export function renderApiWorkbenchThreeFallback(options: ApiWorkbenchThreeFallbackRenderOptions): void {
  const { frame, rect, terminalGlyphStyle, rendererAvailable, rows, theme, center, writeRows } = options;
  writeRows(
    frame,
    rect,
    workbenchThreeFallbackRowsInto(rows, {
      width: rect.width,
      height: rect.height,
      terminalGlyphStyle,
      rendererAvailable,
      theme,
      center,
    }),
  );
}

/** Renders a Three ASCII grid or a status body using the shared projection cache. */
export function renderApiWorkbenchThreeSurface(
  options: ApiWorkbenchThreeSurfaceRenderOptions,
): WorkbenchThreeSurfaceRenderResult {
  const { frame, rect, grid, theme, projectionCache, statusRows, paint, center, writeRows } = options;
  return renderWorkbenchThreeSurface({
    frame,
    rect,
    grid,
    fallbackCell: paint(" ", { bg: theme.surface }),
    projectionCache,
    writeRows,
    statusRows: () =>
      workbenchThreeStatusRowsInto(statusRows, {
        width: rect.width,
        height: rect.height,
        message: options.statusMessage,
        theme,
        center,
      }),
    scale: options.scale,
    countForPressure: options.countForPressure,
    onPressureRows: options.onPressureRows,
  });
}

function workbenchThreeFallbackRowsInto(
  target: RowStyle[],
  options: {
    width: number;
    height: number;
    terminalGlyphStyle: AsciiOptions["terminalGlyphStyle"];
    rendererAvailable: boolean;
    theme: ApiWorkbenchThemeSpec;
    center?: (text: string, width: number) => string;
  },
): RowStyle[] {
  const t = options.theme;
  const center = options.center ?? centerText;
  const title = ` THREE ASCII FALLBACK · ${terminalGlyphStyleLabel(options.terminalGlyphStyle).toUpperCase()} `;
  target.length = 0;
  target.push(
    { text: title, fg: t.buttonActiveText, bg: t.buttonActiveBg, bold: true },
    {
      text: options.rendererAvailable ? "renderer warming up" : "WebGPU/WebGL backend unavailable; text preview active",
      fg: t.warn,
      bg: t.surface,
      bold: !options.rendererAvailable,
    },
    { text: "", bg: t.surface },
  );
  const bodyRows = Math.min(WORKBENCH_THREE_FALLBACK_BODY.length, Math.max(0, options.height - 5));
  for (let index = 0; index < bodyRows; index += 1) {
    target.push({
      text: center(WORKBENCH_THREE_FALLBACK_BODY[index]!, options.width),
      fg: index % 3 === 0 ? t.accent : index % 3 === 1 ? t.good : t.warn,
      bg: t.surface,
      bold: true,
    });
  }
  target.push({ text: "scene: torus knot + sphere + box + floor", fg: t.soft, bg: t.surface });
  return target;
}

function workbenchThreeStatusRowsInto(
  target: RowStyle[],
  options: {
    width: number;
    height: number;
    message: string;
    theme: ApiWorkbenchThemeSpec;
    center?: (text: string, width: number) => string;
  },
): RowStyle[] {
  const width = Math.max(0, Math.floor(options.width));
  const height = Math.max(0, Math.floor(options.height));
  const center = options.center ?? centerText;
  target.length = height;
  const messageRow = Math.max(0, Math.floor(height / 2));
  const blank = " ".repeat(width);
  for (let rowIndex = 0; rowIndex < height; rowIndex += 1) {
    const row = target[rowIndex] ?? { text: "" };
    row.text = rowIndex === messageRow ? center(options.message, width).padEnd(width) : blank;
    row.fg = rowIndex === messageRow ? options.theme.warn : undefined;
    row.bg = options.theme.surface;
    row.bold = undefined;
    target[rowIndex] = row;
  }
  return target;
}

function centerText(text: string, width: number): string {
  const safeWidth = Math.max(0, Math.floor(width));
  if (text.length >= safeWidth) return text.slice(0, safeWidth);
  const left = Math.floor((safeWidth - text.length) / 2);
  return `${" ".repeat(left)}${text}`;
}
