// Copyright 2023 Im-Beast. MIT license.
import { workbenchAsciiRendererModeLabel } from "../src/app/workbench_ascii.ts";
import { textWidth } from "../src/utils/strings.ts";
import { terminalGlyphStyleLabel } from "./ascii_options.ts";
import type { AsciiOptions, PanelRender } from "./types.ts";

/** Minimal visualization option metadata needed by workbench window helpers. */
export interface WorkbenchVisualizationWindowOption {
  label: string;
  description: string;
  group: string;
}

/** Content dimensions for a rendered visualization panel inside a scrollable workbench window. */
export interface WorkbenchVisualizationContentSize {
  width: number;
  height: number;
}

/** Builds the rows shown for text-rendered visualization windows. */
export function visualizationWindowRows(
  option: WorkbenchVisualizationWindowOption,
  rendered: PanelRender,
): string[] {
  return [
    ` ${option.group.toUpperCase()} · ${rendered.title ?? option.label.toUpperCase()} `,
    rendered.alert ? `! ${rendered.alert}` : option.description,
    ...rendered.body.split("\n"),
    rendered.footer,
  ];
}

/** Computes scrollable text dimensions for a rendered visualization panel. */
export function visualizationTextContentSize(
  option: WorkbenchVisualizationWindowOption,
  rendered: PanelRender,
  baseWidth: number,
  baseHeight: number,
): WorkbenchVisualizationContentSize {
  const rows = visualizationWindowRows(option, rendered);
  const scrollableRows = [
    ...rendered.body.split("\n"),
    rendered.footer,
  ];
  return {
    width: Math.max(baseWidth, maxTrimmedTextWidth(scrollableRows)),
    height: Math.max(baseHeight, rows.length),
  };
}

/** Builds the status line for Three-backed visualization windows. */
export function visualizationThreeStatusLine(
  rendered: PanelRender,
  option: WorkbenchVisualizationWindowOption,
  options: AsciiOptions,
): string {
  const mode = rendered.three?.mode.toUpperCase() ?? "TEXT";
  return compactSpaces(`ACEROLA ${mode} · ${threeRendererModeLabel(options).toUpperCase()} · ${option.label}`);
}

/** Reports the current ASCII renderer mode label for workbench visualization status text. */
export function threeRendererModeLabel(options: AsciiOptions): string {
  return workbenchAsciiRendererModeLabel(options, terminalGlyphStyleLabel);
}

/** Returns the maximum printable width among non-empty trimmed rows. */
export function maxTrimmedTextWidth(values: readonly string[]): number {
  return values.reduce((max, value) => Math.max(max, textWidth(value.trimEnd())), 0);
}

/** Collapses repeated whitespace to a single display-space. */
export function compactSpaces(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}
