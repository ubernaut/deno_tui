// Copyright 2023 Im-Beast. MIT license.
import { workbenchAsciiRendererModeLabel } from "../src/app/workbench_ascii.ts";
import { compactSpaces, maxTrimmedTextWidth } from "../src/app/workbench_text.ts";
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
  return visualizationWindowRowsInto([], option, rendered);
}

/** Builds visualization rows into caller-owned storage. */
export function visualizationWindowRowsInto(
  target: string[],
  option: WorkbenchVisualizationWindowOption,
  rendered: PanelRender,
): string[] {
  target.length = 0;
  target.push(
    ` ${option.group.toUpperCase()} · ${rendered.title ?? option.label.toUpperCase()} `,
    rendered.alert ? `! ${rendered.alert}` : option.description,
  );
  appendBodyLines(target, rendered.body);
  target.push(rendered.footer);
  return target;
}

/** Computes scrollable text dimensions for a rendered visualization panel. */
export function visualizationTextContentSize(
  option: WorkbenchVisualizationWindowOption,
  rendered: PanelRender,
  baseWidth: number,
  baseHeight: number,
): WorkbenchVisualizationContentSize {
  let rowCount = 3;
  let width = Math.max(baseWidth, rendered.footer.trimEnd().length);
  let start = 0;
  for (let index = 0; index <= rendered.body.length; index += 1) {
    if (index < rendered.body.length && rendered.body[index] !== "\n") continue;
    width = Math.max(width, rendered.body.slice(start, index).trimEnd().length);
    rowCount += 1;
    start = index + 1;
  }
  return {
    width,
    height: Math.max(baseHeight, rowCount),
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

export { compactSpaces, maxTrimmedTextWidth };

function appendBodyLines(target: string[], body: string): void {
  let start = 0;
  for (let index = 0; index <= body.length; index += 1) {
    if (index < body.length && body[index] !== "\n") continue;
    target.push(body.slice(start, index));
    start = index + 1;
  }
}
