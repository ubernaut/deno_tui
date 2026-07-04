import { formatFps, formatMs } from "./probe_cli.ts";

export interface ThreePanelProbeSample {
  index: number;
  elapsedMs: number;
  totalMs: number;
  initMs: number;
  sceneMs: number;
  sceneUpdateMs?: number;
  sceneRenderMs?: number;
  readbackMs: number;
  assemblyMs: number;
  columns: number;
  rows: number;
  cells: number;
  updates: number;
  deferredPending?: number;
  deferredUnresolved?: number;
  deferredResolved?: number;
  deferredSaturated?: boolean;
  lifecycle: string;
}

export interface ThreePanelProbeOptions {
  mode: string;
  glyphs: string;
  readback?: string;
  width: number;
  height: number;
  maxCells: number;
  intervalMs: number;
}

export interface ThreePanelProbeSummary {
  first?: ThreePanelProbeSample;
  latest?: ThreePanelProbeSample;
  steady: ThreePanelProbeSample[];
  averageTotalMs: number;
  averageInitMs: number;
  averageSceneMs: number;
  averageSceneUpdateMs: number;
  averageSceneRenderMs: number;
  averageReadbackMs: number;
  averageAssemblyMs: number;
}

export interface ThreePanelProbeValidationOptions {
  minSteadyFrames: number;
  minGridUpdates: number;
  maxAverageTotalMs: number;
}

export interface ThreePanelProbeValidationResult {
  ok: boolean;
  errors: string[];
}

export function summarizeThreePanelProbe(samples: readonly ThreePanelProbeSample[]): ThreePanelProbeSummary {
  const steady: ThreePanelProbeSample[] = [];
  let totalMs = 0;
  let initMs = 0;
  let sceneMs = 0;
  let sceneUpdateMs = 0;
  let sceneUpdateCount = 0;
  let sceneRenderMs = 0;
  let sceneRenderCount = 0;
  let readbackMs = 0;
  let assemblyMs = 0;

  for (let index = 1; index < samples.length; index += 1) {
    const sample = samples[index]!;
    if (sample.rows <= 0 || sample.columns <= 0) continue;
    steady.push(sample);
    totalMs += sample.totalMs;
    initMs += sample.initMs;
    sceneMs += sample.sceneMs;
    if (sample.sceneUpdateMs !== undefined) {
      sceneUpdateMs += sample.sceneUpdateMs;
      sceneUpdateCount += 1;
    }
    if (sample.sceneRenderMs !== undefined) {
      sceneRenderMs += sample.sceneRenderMs;
      sceneRenderCount += 1;
    }
    readbackMs += sample.readbackMs;
    assemblyMs += sample.assemblyMs;
  }

  const steadyCount = steady.length;
  return {
    first: samples[0],
    latest: samples.at(-1),
    steady,
    averageTotalMs: averageFromSum(totalMs, steadyCount),
    averageInitMs: averageFromSum(initMs, steadyCount),
    averageSceneMs: averageFromSum(sceneMs, steadyCount),
    averageSceneUpdateMs: averageFromSum(sceneUpdateMs, sceneUpdateCount),
    averageSceneRenderMs: averageFromSum(sceneRenderMs, sceneRenderCount),
    averageReadbackMs: averageFromSum(readbackMs, steadyCount),
    averageAssemblyMs: averageFromSum(assemblyMs, steadyCount),
  };
}

/** Validates that a live Three panel probe observed real renderer frames and acceptable steady timing. */
export function validateThreePanelProbeSummary(
  summary: ThreePanelProbeSummary,
  options: ThreePanelProbeValidationOptions,
): ThreePanelProbeValidationResult {
  const errors: string[] = [];
  if (summary.steady.length < options.minSteadyFrames) {
    errors.push(`steady renderer frames ${summary.steady.length} < ${options.minSteadyFrames}`);
  }
  if ((summary.latest?.updates ?? 0) < options.minGridUpdates) {
    errors.push(`grid updates ${summary.latest?.updates ?? 0} < ${options.minGridUpdates}`);
  }
  if (summary.averageTotalMs <= 0) {
    errors.push("average renderer frame time was not observed");
  } else if (summary.averageTotalMs > options.maxAverageTotalMs) {
    errors.push(
      `average renderer frame ${formatMs(summary.averageTotalMs)} > ${formatMs(options.maxAverageTotalMs)}`,
    );
  }
  return { ok: errors.length === 0, errors };
}

export function formatThreePanelProbeLines(
  options: ThreePanelProbeOptions,
  samples: readonly ThreePanelProbeSample[],
  firstGridElapsedMs: number | undefined,
): string[] {
  const summary = summarizeThreePanelProbe(samples);
  const latest = summary.latest;
  const readback = options.readback ? ` readback=${options.readback}` : "";
  const lines = [
    "three-panel live probe",
    `mode=${options.mode} glyphs=${options.glyphs}${readback} rect=${options.width}x${options.height} maxCells=${options.maxCells} interval=${
      formatMs(options.intervalMs)
    }`,
    `warmup=${formatMs(summary.first?.totalMs)} steady=${formatMs(summary.averageTotalMs)} fps=${
      formatFps(summary.averageTotalMs)
    } latest=${latest ? `${latest.columns}x${latest.rows}/${latest.cells}c` : "none"} firstGrid=${
      formatMs(firstGridElapsedMs)
    }`,
    `init=${formatMs(summary.averageInitMs)} scene=${formatMs(summary.averageSceneMs)}${
      formatScenePhaseSummary(summary)
    } readback=${formatMs(summary.averageReadbackMs)} assembly=${formatMs(summary.averageAssemblyMs)} updates=${
      latest?.updates ?? 0
    }${formatDeferredQueueSummary(latest)}`,
  ];
  for (const sample of samples) {
    lines.push(
      `${sample.index.toString().padStart(2, "0")} total=${formatMs(sample.totalMs)} init=${
        formatMs(sample.initMs)
      } elapsed=${
        formatMs(sample.elapsedMs)
      } grid=${sample.columns}x${sample.rows} cells=${sample.cells} state=${sample.lifecycle} updates=${sample.updates}${
        formatDeferredQueueSummary(sample)
      }`,
    );
  }
  return lines;
}

function formatDeferredQueueSummary(sample: ThreePanelProbeSample | undefined): string {
  if (!sample || sample.deferredPending === undefined) return "";
  const saturation = sample.deferredSaturated ? " saturated" : "";
  return ` queue=${sample.deferredPending}/${sample.deferredUnresolved ?? 0}/${
    sample.deferredResolved ?? 0
  }${saturation}`;
}

function formatScenePhaseSummary(summary: ThreePanelProbeSummary): string {
  if (summary.averageSceneUpdateMs === 0 && summary.averageSceneRenderMs === 0) return "";
  return ` update=${formatMs(summary.averageSceneUpdateMs)} render=${formatMs(summary.averageSceneRenderMs)}`;
}

function averageFromSum(total: number, count: number): number {
  return count === 0 ? 0 : total / count;
}
