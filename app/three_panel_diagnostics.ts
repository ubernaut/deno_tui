import type { DiagnosticInput } from "../src/runtime/diagnostics.ts";
import type { ThreeAsciiRendererPerformance } from "../src/three_ascii/renderer.ts";

export interface ThreePanelAdaptiveDiagnosticOptions {
  direction: "down" | "up" | "steady";
  maxCells: number;
  requestedMaxCells: number;
  frameMs: number;
  targetMs: number;
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
