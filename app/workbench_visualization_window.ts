// Copyright 2023 Im-Beast. MIT license.
import { workbenchAsciiRendererModeLabel } from "../src/app/workbench_ascii.ts";
import { compactSpaces, maxTrimmedTextWidth } from "../src/app/workbench_text.ts";
import { prepareWorkbenchRows } from "../src/app/workbench_frame.ts";
import { terminalGlyphStyleLabel } from "../src/three_ascii/options.ts";
import type { RowStyle } from "../src/app/workbench_rows.ts";
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

/** Minimal theme tokens needed to style generic visualization text rows. */
export interface WorkbenchVisualizationRowsTheme {
  background: string;
  danger: string;
  muted: string;
  panelSoft: string;
  soft: string;
  surface: string;
  text: string;
  warn: string;
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

/** Options for projecting the browser workbench Three preview rows. */
export interface WorkbenchThreePreviewRowsOptions {
  width: number;
  height: number;
  phase: number;
  tileDensity: number;
  themeLabel: string;
  asciiOptions?: Pick<AsciiOptions, "preset" | "terminalGlyphStyle" | "kittyGraphics" | "kittyDisableAscii">;
  orbRows?: string[];
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

/** Projects styled rows for a text-rendered visualization window. */
export function workbenchVisualizationRowsInto(
  target: RowStyle[],
  textRows: string[],
  option: WorkbenchVisualizationWindowOption,
  rendered: PanelRender,
  options: {
    accent: string;
    theme: WorkbenchVisualizationRowsTheme;
    contrast: (color: string, darkFallback: string, lightFallback: string) => string;
  },
): RowStyle[] {
  const rows = visualizationWindowRowsInto(textRows, option, rendered);
  const { accent, theme: t, contrast } = options;
  target.length = rows.length;
  for (let index = 0; index < rows.length; index += 1) {
    const row = target[index] ?? { text: "" };
    row.text = rows[index]!;
    if (index === 0) {
      row.fg = contrast(accent, t.background, t.text);
      row.bg = accent;
      row.bold = true;
    } else if (index === 1) {
      row.fg = rendered.severity === "alarm" ? t.danger : rendered.severity === "warning" ? t.warn : t.soft;
      row.bg = t.surface;
      row.bold = rendered.severity !== "info";
    } else if (index === rows.length - 1) {
      row.fg = t.muted;
      row.bg = t.panelSoft;
      row.bold = undefined;
    } else {
      const bodyIndex = index - 2;
      row.fg = bodyIndex % 3 === 0 ? accent : bodyIndex % 3 === 1 ? t.text : t.soft;
      row.bg = t.surface;
      row.bold = bodyIndex === 0;
    }
    target[index] = row;
  }
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

/** Builds the web-safe Three preview rows shown in the browser API workbench pane. */
export function workbenchThreePreviewRowsInto(
  target: string[],
  options: WorkbenchThreePreviewRowsOptions,
): string[] {
  const mode = options.asciiOptions
    ? terminalGlyphStyleLabel(options.asciiOptions.terminalGlyphStyle).toUpperCase()
    : workbenchThreePreviewMode(options.tileDensity);
  const preset = options.asciiOptions?.preset ?? "mixed-best";
  const transport = options.asciiOptions?.kittyGraphics
    ? options.asciiOptions.kittyDisableAscii ? "kitty only" : "kitty + ascii"
    : "ascii";
  target.length = 0;
  target.push(
    ` ACEROLA THREE ASCII · ${mode} · WEB SAFE PREVIEW `,
    "Full WebGPU renderer is mounted below this workbench on the Pages build.",
    "Use the standalone Three demo for live WebGPU; this pane mirrors controls and state.",
    "",
  );
  const bodyHeight = Math.max(3, Math.floor(options.height) - 6);
  const orbRows = asciiOrbInto(options.orbRows ?? [], options.width, bodyHeight, options.phase);
  for (let index = 0; index < orbRows.length; index += 1) {
    if (target.length >= options.height) return target;
    target.push(orbRows[index]!);
  }
  if (target.length < options.height) target.push("");
  if (target.length < options.height) {
    target.push(
      `preset ${preset}  glyph ${mode.toLowerCase()}  ${transport}  density ${
        Math.trunc(options.tileDensity)
      }  theme ${options.themeLabel}`,
    );
  }
  return target;
}

/** Maps tile-density state into the web Three preview renderer mode label. */
export function workbenchThreePreviewMode(tileDensity: number): string {
  return ["BLOCKS", "GLYPHS", "MIXED"][Math.abs(Math.trunc(tileDensity)) % 3] ?? "MIXED";
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

function asciiOrbInto(target: string[], width: number, height: number, phase: number): string[] {
  const columns = Math.max(8, Math.floor(width));
  const rows = Math.max(3, Math.floor(height));
  const glyphs = " .:-=+*#%@";
  return prepareWorkbenchRows(target, rows, () => "", (_line, row) => {
    let line = "";
    for (let column = 0; column < columns; column += 1) {
      const x = (column / Math.max(1, columns - 1)) * 2 - 1;
      const y = (row / Math.max(1, rows - 1)) * 2 - 1;
      const ring = Math.abs(Math.sqrt(x * x * 2.8 + y * y * 1.8) - 0.62);
      const wave = Math.sin(column * 0.32 + phase * 0.18) + Math.cos(row * 0.7 - phase * 0.14);
      const value = Math.max(0, Math.min(1, 1 - ring * 3.5 + wave * 0.15));
      line += glyphs[Math.floor(value * (glyphs.length - 1))] ?? " ";
    }
    return line;
  });
}
