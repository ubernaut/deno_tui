// Copyright 2023 Im-Beast. MIT license.

/** Human-readable density bucket for adaptive workbench tile layouts. */
export type WorkbenchTileDensityLabel = "wide" | "balanced" | "dense";

/** Options for composing a compact workbench status-bar left segment. */
export interface WorkbenchStatusLeftOptions {
  focus: string;
  theme: string;
  tileDensity: number;
  diagnostics?: string;
}

/** Converts a signed tile-density preference into a status-bar label. */
export function workbenchTileDensityLabel(value: number): WorkbenchTileDensityLabel {
  if (value === 0 || !Number.isFinite(value)) return "balanced";
  return value > 0 ? "dense" : "wide";
}

/** Builds the common focus/theme/layout/diagnostics status text used by workbench adapters. */
export function workbenchStatusLeft(options: WorkbenchStatusLeftOptions): string {
  const parts = [
    `focus ${options.focus}`,
    options.theme,
    `tiles ${workbenchTileDensityLabel(options.tileDensity)}`,
  ];
  const diagnostics = options.diagnostics?.trim();
  if (diagnostics) parts.push(diagnostics);
  return parts.join(" | ");
}
