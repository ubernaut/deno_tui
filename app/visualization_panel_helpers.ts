import type { Accent, RenderContext, SourceFrame } from "./types.ts";
import type { VisualizationDrive } from "./visualization_drive.ts";
import { crop } from "./visualization_primitives.ts";

export function alertText(context: RenderContext) {
  const alert = context.system.alerts[0];
  return alert ? `${alert.title} / ${alert.detail}` : "";
}

export function driveAlert(drive: VisualizationDrive) {
  if (drive.hazard >= 0.92) {
    return "LIMIT CASCADE";
  }
  if (drive.divergence >= 0.66) {
    return "CHANNEL FRACTURE";
  }
  if (drive.volatility >= 0.58) {
    return "OSCILLATION SPIKE";
  }
  if (drive.slope >= 0.24) {
    return "SURGE FRONT";
  }
  return "";
}

export function hottestAccent(sources: readonly SourceFrame[]): Accent {
  if (sources.some((source) => source.accent === "alarm")) {
    return "alarm";
  }
  if (sources.some((source) => source.accent === "amber")) {
    return "amber";
  }
  return sources[0]?.accent ?? "signal";
}

export function sourceFooter(sources: readonly SourceFrame[]) {
  return `SRC ${sources.map((source) => crop(source.name.toUpperCase(), 12)).join(" + ") || "NONE"}`;
}

export function sourceDetailFooter(sources: readonly SourceFrame[]) {
  const details = sources.slice(0, 2).map((source) => {
    const detail = source.detailLines[0] ?? `${Math.round(source.value * 100)}%`;
    return `${crop(source.name.toUpperCase(), 8)} ${crop(detail, 20)}`;
  });
  return details.join(" / ") || sourceFooter(sources);
}

export function sceneAlert(sources: readonly SourceFrame[]) {
  const hottest = sources.find((source) => source.accent === "alarm") ??
    sources.find((source) => source.accent === "amber");
  if (!hottest) {
    return "";
  }

  return hottest.accent === "alarm"
    ? `${crop(hottest.name.toUpperCase(), 10)} CRIT`
    : `${crop(hottest.name.toUpperCase(), 10)} WARN`;
}

export function sourceWarnings(sources: readonly SourceFrame[], drive: VisualizationDrive) {
  return [
    ...sources.flatMap((source) => source.detailLines.map((line) => `${source.name.toUpperCase()}  ${line}`)),
    `VECTOR DRIVE ${(drive.current * 100).toFixed(0)}%`,
    `OSCILLATION ${(drive.volatility * 100).toFixed(0)}%`,
    drive.divergence >= 0.6
      ? `CHANNEL SPLIT ${(drive.divergence * 100).toFixed(0)}%`
      : `DENSITY ${(drive.density * 100).toFixed(0)}%`,
  ].slice(0, 4);
}

export function sourceNameMatrix(sources: readonly SourceFrame[]) {
  return sources.map((source) => crop(source.name.toUpperCase(), 8)).join(" / ");
}
