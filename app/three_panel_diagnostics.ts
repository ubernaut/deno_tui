import type { DiagnosticInput } from "../src/runtime/diagnostics.ts";
import type { GraphicsSurfaceInspection } from "../src/runtime/graphics_surface.ts";
import type { ThreeAsciiRendererPerformance } from "../src/three_ascii/renderer.ts";

export interface ThreePanelAdaptiveDiagnosticOptions {
  direction: "down" | "up" | "steady";
  maxCells: number;
  requestedMaxCells: number;
  frameMs: number;
  targetMs: number;
}

export interface ThreePanelGraphicsFallbackReasonOptions {
  inspection?: GraphicsSurfaceInspection;
  rect: Pick<{ width: number; height: number }, "width" | "height">;
  rendererSupportsImage: boolean;
}

export interface ThreePanelGraphicsFallbackDiagnosticOptions extends ThreePanelGraphicsFallbackReasonOptions {
  kittyDisableAscii: boolean;
}

export function threePanelSlowFrameDiagnostic(performance: ThreeAsciiRendererPerformance): DiagnosticInput {
  return {
    source: "three-panel",
    code: "three-ascii-slow-frame",
    severity: "debug",
    message: `Three ASCII frame ${performance.totalMs.toFixed(1)}ms at ${performance.columns}x${performance.rows}`,
    detail: `scene ${performance.sceneMs.toFixed(1)}ms, ansi ${performance.ansiMs.toFixed(1)}ms, readback ${
      performance.readbackMs.toFixed(1)
    }ms, assembly ${performance.assemblyMs.toFixed(1)}ms${threePanelReadbackQueueDetail(performance)}`,
    context: threePanelPerformanceContext(performance),
  };
}

export function threePanelAdaptiveRenderCellsDiagnostic(
  options: ThreePanelAdaptiveDiagnosticOptions,
): DiagnosticInput {
  return {
    source: "three-panel",
    code: "three-ascii-adaptive-render-cells",
    severity: "debug",
    message: `Three ASCII render budget ${
      options.direction === "down" ? "reduced" : "raised"
    } to ${options.maxCells} cells.`,
    detail: `frame ${options.frameMs.toFixed(1)}ms, target ${options.targetMs.toFixed(1)}ms`,
    context: {
      direction: options.direction,
      maxCells: options.maxCells,
      requestedMaxCells: options.requestedMaxCells,
      frameMs: roundTenth(options.frameMs),
      targetMs: roundTenth(options.targetMs),
    },
  };
}

export function threePanelGraphicsFallbackReason(options: ThreePanelGraphicsFallbackReasonOptions): string {
  const inspection = options.inspection;
  if (!inspection) return "missing-surface";
  if (!inspection.available) return inspection.reason ?? "surface-unavailable";
  if (options.rect.width <= 0 || options.rect.height <= 0) return "empty-graphics-rectangle";
  if (!options.rendererSupportsImage) return "renderer-image-frame-unsupported";
  return "inactive";
}

export function threePanelGraphicsFallbackDiagnostic(
  options: ThreePanelGraphicsFallbackDiagnosticOptions,
): DiagnosticInput {
  const reason = threePanelGraphicsFallbackReason(options);
  const inspection = options.inspection;
  return {
    source: "three-panel",
    code: "kitty-graphics-fallback",
    severity: "warning",
    message: "Kitty graphics requested but unavailable; rendering ASCII fallback.",
    detail: inspection?.reason ?? reason,
    context: {
      reason,
      surface: inspection?.kind ?? "none",
      available: inspection?.available ?? false,
      asciiFallback: true,
      kittyDisableAscii: options.kittyDisableAscii,
    },
  };
}

function threePanelPerformanceContext(performance: ThreeAsciiRendererPerformance): Record<string, unknown> {
  return {
    columns: performance.columns,
    rows: performance.rows,
    cells: performance.cells,
    glyphStyle: performance.terminalGlyphStyle,
    totalMs: roundTenth(performance.totalMs),
    sceneMs: roundTenth(performance.sceneMs),
    ansiMs: roundTenth(performance.ansiMs),
    readbackMs: roundTenth(performance.readbackMs),
    assemblyMs: roundTenth(performance.assemblyMs),
    deferredReadbackSlots: performance.deferredReadbackSlots,
    deferredReadbackPending: performance.deferredReadbackPending,
    deferredReadbackUnresolved: performance.deferredReadbackUnresolved,
    deferredReadbackSaturated: performance.deferredReadbackSaturated,
  };
}

function threePanelReadbackQueueDetail(performance: ThreeAsciiRendererPerformance): string {
  return performance.deferredReadbackSlots
    ? `, queue ${performance.deferredReadbackUnresolved ?? 0}/${performance.deferredReadbackSlots}`
    : "";
}

function roundTenth(value: number): number {
  return Math.round(value * 10) / 10;
}
