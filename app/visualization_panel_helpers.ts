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
  let hasAmber = false;
  for (const source of sources) {
    if (source.accent === "alarm") return "alarm";
    if (source.accent === "amber") hasAmber = true;
  }
  if (hasAmber) return "amber";
  return sources[0]?.accent ?? "signal";
}

export function sourceFooter(sources: readonly SourceFrame[]) {
  if (sources.length === 0) return "SRC NONE";
  let footer = "SRC ";
  for (let index = 0; index < sources.length; index += 1) {
    if (index > 0) footer += " + ";
    footer += crop(sources[index]!.name.toUpperCase(), 12);
  }
  return footer;
}

export function sourceDetailFooter(sources: readonly SourceFrame[]) {
  if (sources.length === 0) return sourceFooter(sources);
  let footer = "";
  const count = Math.min(2, sources.length);
  for (let index = 0; index < count; index += 1) {
    const source = sources[index]!;
    const detail = source.detailLines[0] ?? `${Math.round(source.value * 100)}%`;
    if (index > 0) footer += " / ";
    footer += `${crop(source.name.toUpperCase(), 8)} ${crop(detail, 20)}`;
  }
  return footer || sourceFooter(sources);
}

export function sceneAlert(sources: readonly SourceFrame[]) {
  let hottest: SourceFrame | undefined;
  for (const source of sources) {
    if (source.accent === "alarm") {
      hottest = source;
      break;
    }
    if (!hottest && source.accent === "amber") hottest = source;
  }
  if (!hottest) {
    return "";
  }

  return hottest.accent === "alarm"
    ? `${crop(hottest.name.toUpperCase(), 10)} CRIT`
    : `${crop(hottest.name.toUpperCase(), 10)} WARN`;
}

export function sourceWarnings(sources: readonly SourceFrame[], drive: VisualizationDrive) {
  const warnings: string[] = [];
  for (const source of sources) {
    const name = source.name.toUpperCase();
    for (const line of source.detailLines) {
      warnings.push(`${name}  ${line}`);
      if (warnings.length >= 4) return warnings;
    }
  }
  warnings.push(`VECTOR DRIVE ${(drive.current * 100).toFixed(0)}%`);
  if (warnings.length >= 4) return warnings;
  warnings.push(`OSCILLATION ${(drive.volatility * 100).toFixed(0)}%`);
  if (warnings.length >= 4) return warnings;
  warnings.push(
    drive.divergence >= 0.6
      ? `CHANNEL SPLIT ${(drive.divergence * 100).toFixed(0)}%`
      : `DENSITY ${(drive.density * 100).toFixed(0)}%`,
  );
  return warnings;
}

export function sourceNameMatrix(sources: readonly SourceFrame[]) {
  let matrix = "";
  for (let index = 0; index < sources.length; index += 1) {
    if (index > 0) matrix += " / ";
    matrix += crop(sources[index]!.name.toUpperCase(), 8);
  }
  return matrix;
}
