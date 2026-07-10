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

/** Creates or updates a renderer performance snapshot from measured frame timings. */
export function createThreeAsciiRendererPerformance(
  input: ThreeAsciiRendererPerformanceInput,
  target = emptyThreeAsciiRendererPerformance(input.terminalGlyphStyle),
): ThreeAsciiRendererPerformance {
  target.columns = input.columns;
  target.rows = input.rows;
  target.cells = input.columns * input.rows;
  target.terminalGlyphStyle = input.terminalGlyphStyle;
  target.totalMs = input.frameMs;
  target.initMs = input.initMs ?? 0;
  target.sceneMs = input.sceneMs;
  target.sceneUpdateMs = input.sceneUpdateMs;
  target.sceneRenderMs = input.sceneRenderMs;
  target.ansiMs = input.ansiMs;
  target.readbackMs = input.readbackMs;
  target.assemblyMs = input.assemblyMs;
  target.deferredReadbackSlots = input.queue?.slotCount;
  target.deferredReadbackPending = input.queue?.pending;
  target.deferredReadbackUnresolved = input.queue?.unresolved;
  target.deferredReadbackResolved = input.queue?.resolved;
  target.deferredReadbackSaturated = input.queue?.saturated;
  return target;
}

/** Creates or updates a performance snapshot for a saturated deferred-readback frame. */
export function createThreeAsciiRendererSaturatedPerformance(
  input: ThreeAsciiRendererSaturatedPerformanceInput,
  target = emptyThreeAsciiRendererPerformance(input.terminalGlyphStyle),
): ThreeAsciiRendererPerformance {
  target.columns = input.columns;
  target.rows = input.rows;
  target.cells = input.columns * input.rows;
  target.terminalGlyphStyle = input.terminalGlyphStyle;
  target.totalMs = input.previousFrameMs ?? input.frameMs;
  target.initMs = 0;
  target.sceneMs = 0;
  target.sceneUpdateMs = 0;
  target.sceneRenderMs = 0;
  target.ansiMs = 0;
  target.readbackMs = input.readbackMs;
  target.assemblyMs = 0;
  target.deferredReadbackSlots = input.queue.slotCount;
  target.deferredReadbackPending = input.queue.pending;
  target.deferredReadbackUnresolved = input.queue.unresolved;
  target.deferredReadbackResolved = input.queue.resolved;
  target.deferredReadbackSaturated = true;
  return target;
}

function emptyThreeAsciiRendererPerformance(terminalGlyphStyle: TerminalGlyphStyle): ThreeAsciiRendererPerformance {
  return {
    columns: 0,
    rows: 0,
    cells: 0,
    terminalGlyphStyle,
    totalMs: 0,
    initMs: 0,
    sceneMs: 0,
    ansiMs: 0,
    readbackMs: 0,
    assemblyMs: 0,
  };
}
