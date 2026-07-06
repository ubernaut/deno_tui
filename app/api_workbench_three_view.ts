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
import type { Rectangle } from "../src/types.ts";
import type { ApiWorkbenchThemeSpec } from "./api_workbench_catalog.ts";
import type { AsciiOptions } from "./types.ts";
import { workbenchThreeFallbackRowsInto, workbenchThreeStatusRowsInto } from "./workbench_visualization_window.ts";

interface ApiWorkbenchThreePaintStyle {
  bg?: string;
}

export interface ApiWorkbenchThreeHeaderRenderOptions {
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

export interface ApiWorkbenchThreeFallbackRenderOptions {
  frame: WorkbenchFrame;
  rect: Rectangle;
  terminalGlyphStyle: AsciiOptions["terminalGlyphStyle"];
  rendererAvailable: boolean;
  rows: RowStyle[];
  theme: ApiWorkbenchThemeSpec;
  center: (text: string, width: number) => string;
  writeRows: (frame: WorkbenchFrame, rect: Rectangle, rows: readonly RowStyle[]) => void;
}

export interface ApiWorkbenchThreeSurfaceRenderOptions {
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
