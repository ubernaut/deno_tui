// Copyright 2023 Im-Beast. MIT license.
import { workbenchAsciiRendererModeLabel } from "../src/app/workbench_ascii.ts";
import { compactSpaces } from "../src/app/workbench_text.ts";
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
interface WorkbenchVisualizationContentSize {
  width: number;
  height: number;
}

/** Minimal theme tokens needed to style generic visualization text rows. */
interface WorkbenchVisualizationRowsTheme {
  background: string;
  danger: string;
  muted: string;
  panelSoft: string;
  soft: string;
  surface: string;
  text: string;
  warn: string;
}

/** Options for projecting the browser workbench Three preview rows. */
interface WorkbenchThreePreviewRowsOptions {
  width: number;
  height: number;
  phase: number;
  tileDensity: number;
  themeLabel: string;
  asciiOptions?: Pick<AsciiOptions, "preset" | "terminalGlyphStyle" | "kittyGraphics" | "kittyDisableAscii">;
  orbRows?: string[];
}

/** Builds visualization rows into caller-owned storage. */
function visualizationWindowRowsInto(
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
function workbenchThreePreviewMode(tileDensity: number): string {
  return ["BLOCKS", "GLYPHS", "MIXED"][Math.abs(Math.trunc(tileDensity)) % 3] ?? "MIXED";
}

function appendBodyLines(target: string[], body: string): void {
  let start = 0;
  for (let index = 0; index <= body.length; index += 1) {
    if (index < body.length && body[index] !== "\n") continue;
    target.push(body.slice(start, index));
    start = index + 1;
  }
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
