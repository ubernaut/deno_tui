import { neonThreeSceneModeLabel } from "./neon_three_catalog.ts";
import type { RenderContext, ThreeSceneMode } from "./types.ts";
import type { VisualizationDrive } from "./visualization_drive.ts";
import { circularField, harmonicField, heatmap, psychograph, routeBoard } from "./visualization_fields.ts";
import { sourceNameMatrix } from "./visualization_panel_helpers.ts";
import { crop, monitorGlyph, signalChart } from "./visualization_primitives.ts";

export const THREE_FALLBACK_BLOCKS = [" ", "▁", "▂", "▃", "▄", "▅", "▆", "▇", "█"] as const;

export function threeSceneModeLabel(mode: ThreeSceneMode) {
  return neonThreeSceneModeLabel(mode);
}

export function appendThreeSceneFooter(footer: string, mode: ThreeSceneMode, width: number): string {
  const suffix = `${threeSceneModeLabel(mode)} PRIMITIVES`;
  if (!footer) return suffix;
  return `${crop(footer, Math.max(0, width - suffix.length - 3))} / ${suffix}`;
}

export function renderThreeFallbackBody(context: RenderContext, drive: VisualizationDrive, mode: ThreeSceneMode) {
  const width = Math.max(12, context.width);
  const infoLines = [
    crop(
      `${threeSceneModeLabel(mode)} DRIVE ${Math.round(drive.hazard * 100)}%  Δ${Math.round(drive.divergence * 100)}`,
      width,
    ),
  ];

  if (context.height >= 6) {
    infoLines.push(crop(sourceNameMatrix(context.sources), width));
  }

  const chartHeight = Math.max(2, context.height - infoLines.length);
  const chart = (() => {
    switch (mode) {
      case "lattice":
      case "solenoid":
        return signalChart(drive.pulseSeries, width, chartHeight, drive.hazard >= 0.78 ? "█" : "▇");
      case "atfield":
      case "capture":
        return harmonicField(width, chartHeight, drive, monitorGlyph(drive, "violet"));
      case "hexshell":
        return heatmap(width, chartHeight, drive, THREE_FALLBACK_BLOCKS);
      case "mapslab":
        return routeBoard(width, chartHeight, drive, THREE_FALLBACK_BLOCKS);
      case "studio":
        return harmonicField(width, chartHeight, drive, "◆");
      case "emergency":
      case "counter":
      case "relay":
        return routeBoard(width, chartHeight, drive, [" ", "░", "▒", "▓", "█"]);
      case "launch":
      case "gate":
      case "route":
        return signalChart(drive.spreadSeries, width, chartHeight, drive.hazard >= 0.78 ? "▓" : "▒");
      case "harmonic":
        return harmonicField(width, chartHeight, drive, monitorGlyph(drive, "violet"));
      case "field":
        return circularField(width, chartHeight, drive);
      case "magi":
      case "angel":
      case "plug":
      case "rack":
      case "heat":
      case "command":
        return heatmap(width, chartHeight, drive, THREE_FALLBACK_BLOCKS);
      case "target":
        return circularField(width, chartHeight, drive);
      case "waveform":
      case "scope":
      case "biosignal":
      case "psychograph":
      case "surveillance":
      case "topology":
        return psychograph(width, chartHeight, drive, monitorGlyph(drive, "signal"));
    }
  })();

  return [...infoLines, chart].join("\n");
}
