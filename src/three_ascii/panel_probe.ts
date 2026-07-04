import { average, formatFps, formatMs } from "./probe_cli.ts";

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

export function summarizeThreePanelProbe(samples: readonly ThreePanelProbeSample[]): ThreePanelProbeSummary {
  const steady = samples.slice(1).filter((sample) => sample.rows > 0 && sample.columns > 0);
  return {
    first: samples[0],
    latest: samples.at(-1),
    steady,
    averageTotalMs: average(steady.map((sample) => sample.totalMs)),
    averageInitMs: average(steady.map((sample) => sample.initMs)),
    averageSceneMs: average(steady.map((sample) => sample.sceneMs)),
    averageSceneUpdateMs: averageDefined(steady.map((sample) => sample.sceneUpdateMs)),
    averageSceneRenderMs: averageDefined(steady.map((sample) => sample.sceneRenderMs)),
    averageReadbackMs: average(steady.map((sample) => sample.readbackMs)),
    averageAssemblyMs: average(steady.map((sample) => sample.assemblyMs)),
  };
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
    } readback=${
      formatMs(summary.averageReadbackMs)
    } assembly=${formatMs(summary.averageAssemblyMs)} updates=${latest?.updates ?? 0}${
      formatDeferredQueueSummary(latest)
    }`,
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

function averageDefined(values: readonly (number | undefined)[]): number {
  return average(values.filter((value): value is number => value !== undefined));
}
