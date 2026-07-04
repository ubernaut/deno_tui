import type { TerminalGlyphStyle } from "./glyphs.ts";

/** Last-frame timing breakdown for terminal Three ASCII rendering. */
export interface ThreeAsciiRendererPerformance {
  columns: number;
  rows: number;
  cells: number;
  terminalGlyphStyle: TerminalGlyphStyle;
  totalMs: number;
  initMs: number;
  sceneMs: number;
  sceneUpdateMs?: number;
  sceneRenderMs?: number;
  ansiMs: number;
  readbackMs: number;
  assemblyMs: number;
  deferredReadbackSlots?: number;
  deferredReadbackPending?: number;
  deferredReadbackUnresolved?: number;
  deferredReadbackResolved?: number;
  deferredReadbackSaturated?: boolean;
}

/** Snapshot of deferred GPU readback queue pressure. */
export interface ThreeAsciiReadbackQueueInspection {
  slotCount: number;
  pending: number;
  unresolved: number;
  resolved: number;
  saturated: boolean;
}

/** Input used to assemble normal renderer performance telemetry. */
export interface ThreeAsciiRendererPerformanceInput {
  columns: number;
  rows: number;
  terminalGlyphStyle: TerminalGlyphStyle;
  frameMs: number;
  initMs?: number;
  sceneMs: number;
  sceneUpdateMs?: number;
  sceneRenderMs?: number;
  ansiMs: number;
  readbackMs: number;
  assemblyMs: number;
  queue?: ThreeAsciiReadbackQueueInspection;
}

/** Input used to report a saturated deferred-readback frame without new scene output. */
export interface ThreeAsciiRendererSaturatedPerformanceInput {
  columns: number;
  rows: number;
  terminalGlyphStyle: TerminalGlyphStyle;
  frameMs: number;
  previousFrameMs?: number;
  readbackMs: number;
  queue: Pick<ThreeAsciiReadbackQueueInspection, "slotCount" | "pending" | "unresolved" | "resolved">;
}

/** Creates a renderer performance snapshot from measured frame timings. */
export function createThreeAsciiRendererPerformance(
  input: ThreeAsciiRendererPerformanceInput,
): ThreeAsciiRendererPerformance {
  return {
    columns: input.columns,
    rows: input.rows,
    cells: input.columns * input.rows,
    terminalGlyphStyle: input.terminalGlyphStyle,
    totalMs: input.frameMs,
    initMs: input.initMs ?? 0,
    sceneMs: input.sceneMs,
    sceneUpdateMs: input.sceneUpdateMs,
    sceneRenderMs: input.sceneRenderMs,
    ansiMs: input.ansiMs,
    readbackMs: input.readbackMs,
    assemblyMs: input.assemblyMs,
    deferredReadbackSlots: input.queue?.slotCount,
    deferredReadbackPending: input.queue?.pending,
    deferredReadbackUnresolved: input.queue?.unresolved,
    deferredReadbackResolved: input.queue?.resolved,
    deferredReadbackSaturated: input.queue?.saturated,
  };
}

/** Creates a renderer performance snapshot for a saturated deferred-readback frame. */
export function createThreeAsciiRendererSaturatedPerformance(
  input: ThreeAsciiRendererSaturatedPerformanceInput,
): ThreeAsciiRendererPerformance {
  return {
    columns: input.columns,
    rows: input.rows,
    cells: input.columns * input.rows,
    terminalGlyphStyle: input.terminalGlyphStyle,
    totalMs: input.previousFrameMs ?? input.frameMs,
    initMs: 0,
    sceneMs: 0,
    sceneUpdateMs: 0,
    sceneRenderMs: 0,
    ansiMs: 0,
    readbackMs: input.readbackMs,
    assemblyMs: 0,
    deferredReadbackSlots: input.queue.slotCount,
    deferredReadbackPending: input.queue.pending,
    deferredReadbackUnresolved: input.queue.unresolved,
    deferredReadbackResolved: input.queue.resolved,
    deferredReadbackSaturated: true,
  };
}
