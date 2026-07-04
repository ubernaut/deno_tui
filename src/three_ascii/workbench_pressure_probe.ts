import { average } from "./probe_cli.ts";

export interface WorkbenchThreePressureProbeSample {
  index: number;
  rendererMs: number;
  sceneMs: number;
  readbackMs: number;
  assemblyMs: number;
  flushMs: number;
  bytes: number;
  changedRows: number;
  columns: number;
  rows: number;
  cells: number;
}

export interface WorkbenchThreePressureProbeSummary {
  warmup?: WorkbenchThreePressureProbeSample;
  latest?: WorkbenchThreePressureProbeSample;
  steady: WorkbenchThreePressureProbeSample[];
  averageRendererMs: number;
  averageFlushMs: number;
  averageBytes: number;
  averageChangedRows: number;
}

/** Summarizes workbench Three pressure samples while excluding placeholder and startup renderer frames. */
export function summarizeWorkbenchThreePressureProbe(
  samples: readonly WorkbenchThreePressureProbeSample[],
): WorkbenchThreePressureProbeSummary {
  const valid = samples.filter((sample) =>
    sample.rows > 0 && sample.columns > 0 && sample.cells > 0 && sample.rendererMs > 0
  );
  const steady = valid.slice(1);
  return {
    warmup: valid[0],
    latest: samples.at(-1),
    steady,
    averageRendererMs: average(steady.map((sample) => sample.rendererMs)),
    averageFlushMs: average(steady.map((sample) => sample.flushMs)),
    averageBytes: average(steady.map((sample) => sample.bytes)),
    averageChangedRows: average(steady.map((sample) => sample.changedRows)),
  };
}
