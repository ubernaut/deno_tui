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
  return width >= compact.length ? compact : `${total} ${cells}`;
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
  return `${scoped}${byteRate} tier ${Math.max(1, Math.floor(performance.pressureCells))}c h${high}/l${low}`;
}

function formatCompactByteRate(bytesPerSecond: number): string {
  const value = Math.max(0, bytesPerSecond);
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(value >= 10_000_000 ? 0 : 1)}MB/s`;
  if (value >= 1_000) return `${Math.round(value / 1_000)}KB/s`;
  return `${Math.round(value)}B/s`;
}
