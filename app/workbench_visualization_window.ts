// Copyright 2023 Im-Beast. MIT license.
import { workbenchAsciiRendererModeLabel } from "../src/app/workbench_ascii.ts";
import { compactSpaces, maxTrimmedTextWidth } from "../src/app/workbench_text.ts";
import { terminalGlyphStyleLabel } from "./ascii_options.ts";
import type { RowStyle } from "./workbench_rows.ts";
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

/** Minimal color tokens needed to format the built-in Three fallback rows. */
export interface WorkbenchThreeFallbackTheme {
  buttonActiveText: string;
  buttonActiveBg: string;
  accent: string;
  good: string;
  warn: string;
  soft: string;
  surface: string;
}

/** Options for building the built-in Three ASCII fallback rows. */
export interface WorkbenchThreeFallbackRowsOptions {
  width: number;
  height: number;
  terminalGlyphStyle: AsciiOptions["terminalGlyphStyle"];
  rendererAvailable: boolean;
  theme: WorkbenchThreeFallbackTheme;
  center?: (text: string, width: number) => string;
}

export const WORKBENCH_THREE_FALLBACK_BODY: readonly string[] = [
  "         .-=========-.         ",
  "      .-#%%%@@@@@@%%%#-.       ",
  "    .+%%@*=-.     .-=*@%+.     ",
  "   :#%@-     TORUS     -@%#:   ",
  "   *%@=   <> SPHERE <>  =@%*   ",
  "   :#%@-      CUBE      -@%#:  ",
  "    .+%%@*=-.     .-=*@%+.     ",
  "      .-#%%%@@@@@@%%%#-.       ",
  "         `-=========-'         ",
] as const;

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

/** Builds the text fallback used while the built-in Three ASCII renderer is unavailable or warming up. */
export function workbenchThreeFallbackRowsInto(
  target: RowStyle[],
  options: WorkbenchThreeFallbackRowsOptions,
): RowStyle[] {
  const t = options.theme;
  const center = options.center ?? centerText;
  const title = ` THREE ASCII FALLBACK · ${terminalGlyphStyleLabel(options.terminalGlyphStyle).toUpperCase()} `;
  target.length = 0;
  target.push(
    { text: title, fg: t.buttonActiveText, bg: t.buttonActiveBg, bold: true },
    {
      text: options.rendererAvailable ? "renderer warming up" : "WebGPU/WebGL backend unavailable; text preview active",
      fg: t.warn,
      bg: t.surface,
      bold: !options.rendererAvailable,
    },
    { text: "", bg: t.surface },
  );
  const bodyRows = Math.min(WORKBENCH_THREE_FALLBACK_BODY.length, Math.max(0, options.height - 5));
  for (let index = 0; index < bodyRows; index += 1) {
    target.push({
      text: center(WORKBENCH_THREE_FALLBACK_BODY[index]!, options.width),
      fg: index % 3 === 0 ? t.accent : index % 3 === 1 ? t.good : t.warn,
      bg: t.surface,
      bold: true,
    });
  }
  target.push({ text: "scene: torus knot + sphere + box + floor", fg: t.soft, bg: t.surface });
  return target;
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

function centerText(text: string, width: number): string {
  const safeWidth = Math.max(0, Math.floor(width));
  if (text.length >= safeWidth) return text.slice(0, safeWidth);
  const left = Math.floor((safeWidth - text.length) / 2);
  return `${" ".repeat(left)}${text}`;
}
