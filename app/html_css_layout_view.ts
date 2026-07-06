// Copyright 2023 Im-Beast. MIT license.
import { clipRect } from "../src/app/hit_targets.ts";
import type { ComputedLayoutBox } from "../src/layout/mod.ts";
import { htmlCssLayoutDemoBoxLabel } from "../src/markup/demo_fixtures.ts";
import type { Rectangle } from "../src/types.ts";

/** Theme colors consumed by the HTML/CSS layout demo renderer. */
export interface HtmlCssLayoutTheme {
  accent: string;
  accentDeep: string;
  background: string;
  border: string;
  borderStrong: string;
  buttonActiveBg: string;
  buttonActiveText: string;
  danger: string;
  muted: string;
  panel: string;
  panelSoft: string;
  soft: string;
  surface: string;
  text: string;
  warn: string;
}

/** Paint style for one computed HTML/CSS layout demo box. */
interface HtmlCssLayoutBoxStyle {
  fg: string;
  bg: string;
  border: string;
  bold?: boolean;
}

/** Minimal contrast picker used by extracted layout-demo styling. */
type HtmlCssLayoutContrast = (color: string, dark: string, light: string) => string;

/** Renderer-neutral paint command for the HTML/CSS layout demo. */
export type HtmlCssLayoutRenderCommand =
  | HtmlCssLayoutFillRenderCommand
  | HtmlCssLayoutTextRenderCommand;

/** Renderer-neutral fill command for one HTML/CSS layout box. */
interface HtmlCssLayoutFillRenderCommand {
  kind: "fill";
  rect: Rectangle;
  bg: string;
}

/** Renderer-neutral text command for one HTML/CSS layout row. */
interface HtmlCssLayoutTextRenderCommand {
  kind: "text";
  row: number;
  column: number;
  text: string;
  maxWidth: number;
  fg: string;
  bg: string;
  bold?: boolean;
}

/** Options for projecting an HTML/CSS layout demo into renderer-neutral commands. */
interface HtmlCssLayoutRenderCommandOptions {
  bounds: Rectangle;
  boxes: readonly ComputedLayoutBox[];
  theme: HtmlCssLayoutTheme;
  contrast: HtmlCssLayoutContrast;
  summaryRows: readonly string[];
}

/** Host profile for the HTML/CSS layout demo explanatory summary. */
type HtmlCssLayoutSummaryProfile = "terminal" | "web";

/** Returns the compact summary rows shown below the HTML/CSS layout demo. */
export function htmlCssLayoutSummaryRows(profile: HtmlCssLayoutSummaryProfile = "terminal"): readonly string[] {
  if (profile === "web") {
    return WEB_HTML_CSS_LAYOUT_SUMMARY_ROWS;
  }
  return TERMINAL_HTML_CSS_LAYOUT_SUMMARY_ROWS;
}

const TERMINAL_HTML_CSS_LAYOUT_SUMMARY_ROWS: readonly string[] = [
  "parseTuiMarkup -> parseCssStylesheet -> applyCssCascade -> LayoutEngine",
  "Default solver supports flex-wrap, CSS Grid tracks, fr units, and absolute inset.",
  "Resize this window: metric cards wrap; nested grid retessellates with media rules.",
];

const WEB_HTML_CSS_LAYOUT_SUMMARY_ROWS: readonly string[] = [
  "parseTuiMarkup -> parseCssStylesheet -> applyCssCascade -> LayoutEngine",
  "Flex rows wrap; nested CSS Grid uses fr tracks, spans, and media rules.",
  "Resize the browser to recalculate terminal-cell layout through the web host.",
];

/** Resolves workbench theme colors for a computed HTML/CSS layout demo box. */
export function htmlCssLayoutBoxStyle(
  box: Pick<ComputedLayoutBox, "id">,
  theme: HtmlCssLayoutTheme,
  contrast: HtmlCssLayoutContrast,
): HtmlCssLayoutBoxStyle {
  if (box.id === "layout-toolbar") {
    return {
      fg: contrast(theme.accentDeep, theme.background, theme.text),
      bg: theme.accentDeep,
      border: theme.accent,
      bold: true,
    };
  }
  if (box.id === "layout-stage") {
    return { fg: theme.text, bg: theme.panelSoft, border: theme.borderStrong, bold: true };
  }
  if (box.id === "layout-grid") {
    return { fg: theme.text, bg: theme.surface, border: theme.accent, bold: true };
  }
  if (box.id === "grid-shell") {
    return { fg: theme.buttonActiveText, bg: theme.buttonActiveBg, border: theme.accent, bold: true };
  }
  if (box.id === "grid-worker") {
    return {
      fg: contrast(theme.warn, theme.background, theme.text),
      bg: theme.warn,
      border: theme.danger,
      bold: true,
    };
  }
  if (box.id.startsWith("grid-")) {
    return { fg: theme.text, bg: theme.panel, border: theme.accent };
  }
  if (box.id === "layout-badge") {
    return {
      fg: contrast(theme.warn, theme.background, theme.text),
      bg: theme.warn,
      border: theme.danger,
      bold: true,
    };
  }
  if (box.id === "layout-footer") {
    return { fg: theme.muted, bg: theme.panel, border: theme.border };
  }
  if (box.id === "metric-cpu") {
    return { fg: theme.buttonActiveText, bg: theme.buttonActiveBg, border: theme.accent, bold: true };
  }
  if (box.id.startsWith("metric-")) {
    return { fg: theme.text, bg: theme.panel, border: theme.accent };
  }
  return { fg: theme.text, bg: theme.surface, border: theme.border };
}

/** Returns a stable back-to-front paint order for overlapping layout demo boxes. */
function htmlCssLayoutBoxPaintOrder(box: Pick<ComputedLayoutBox, "id">): number {
  if (box.id === "layout-demo") return 0;
  if (box.id === "layout-stage") return 1;
  if (box.id === "layout-grid") return 2;
  if (box.id.startsWith("grid-")) return 3;
  if (box.id.startsWith("metric-")) return 2;
  if (box.id === "layout-badge") return 4;
  return 2;
}

/** Copies visible layout boxes into caller-owned storage in back-to-front paint order. */
export function htmlCssVisibleLayoutBoxesInto<T extends Pick<ComputedLayoutBox, "id" | "visible" | "zIndex">>(
  target: T[],
  boxes: readonly T[],
): T[] {
  target.length = 0;
  for (let index = 0; index < boxes.length; index += 1) {
    const box = boxes[index]!;
    if (box.visible) target.push(box);
  }
  target.sort(compareHtmlCssLayoutPaintOrder);
  return target;
}

/** Compares computed layout boxes by z-index and stable demo paint layer. */
function compareHtmlCssLayoutPaintOrder(
  left: Pick<ComputedLayoutBox, "id" | "zIndex">,
  right: Pick<ComputedLayoutBox, "id" | "zIndex">,
): number {
  return left.zIndex - right.zIndex || htmlCssLayoutBoxPaintOrder(left) - htmlCssLayoutBoxPaintOrder(right);
}

/** Projects layout-demo boxes and summary rows into reusable renderer-neutral paint commands. */
export function htmlCssLayoutRenderCommandsInto(
  target: HtmlCssLayoutRenderCommand[],
  options: HtmlCssLayoutRenderCommandOptions,
): HtmlCssLayoutRenderCommand[] {
  target.length = 0;
  let written = 0;

  for (const box of options.boxes) {
    written = writeHtmlCssLayoutBoxCommands(target, written, box, options);
  }

  const summaryStart = Math.max(
    options.bounds.row,
    options.bounds.row + options.bounds.height - options.summaryRows.length,
  );
  for (
    let index = 0;
    index < options.summaryRows.length && summaryStart + index < options.bounds.row + options.bounds.height;
    index += 1
  ) {
    written = writeTextCommand(target, written, {
      row: summaryStart + index,
      column: options.bounds.column,
      text: options.summaryRows[index]!,
      maxWidth: options.bounds.width,
      fg: index === 0 ? options.theme.accent : options.theme.soft,
      bg: options.theme.panelSoft,
      bold: index === 0,
    });
  }

  target.length = written;
  return target;
}

function writeHtmlCssLayoutBoxCommands(
  target: HtmlCssLayoutRenderCommand[],
  written: number,
  box: ComputedLayoutBox,
  options: HtmlCssLayoutRenderCommandOptions,
): number {
  const rect = clipRect(box.rect, options.bounds);
  if (rect.width <= 0 || rect.height <= 0) return written;
  const style = htmlCssLayoutBoxStyle(box, options.theme, options.contrast);
  written = writeFillCommand(target, written, rect, style.bg);
  if (box.id !== "layout-demo") {
    written = writeHtmlCssLayoutOutlineCommands(target, written, rect, style);
  }

  const content = clipRect(box.contentRect, options.bounds);
  if (content.width <= 0 || content.height <= 0) return written;
  written = writeTextCommand(target, written, {
    row: content.row,
    column: content.column,
    text: htmlCssLayoutDemoBoxLabel(box),
    maxWidth: content.width,
    fg: style.fg,
    bg: style.bg,
    bold: style.bold,
  });

  if (content.height > 1 && box.text) {
    written = writeTextCommand(target, written, {
      row: content.row + 1,
      column: content.column,
      text: box.text,
      maxWidth: content.width,
      fg: options.theme.text,
      bg: style.bg,
    });
  }

  if (content.height > 2 && (box.id.startsWith("metric-") || box.id.startsWith("grid-"))) {
    written = writeTextCommand(target, written, {
      row: content.row + 2,
      column: content.column,
      text: `${box.rect.width}x${box.rect.height} content ${box.contentRect.width}x${box.contentRect.height}`,
      maxWidth: content.width,
      fg: options.theme.muted,
      bg: style.bg,
    });
  }

  return written;
}

function writeHtmlCssLayoutOutlineCommands(
  target: HtmlCssLayoutRenderCommand[],
  written: number,
  rect: Rectangle,
  style: HtmlCssLayoutBoxStyle,
): number {
  if (rect.width < 2 || rect.height < 2) return written;
  written = writeTextCommand(target, written, {
    row: rect.row,
    column: rect.column,
    text: `┌${"─".repeat(Math.max(0, rect.width - 2))}┐`,
    maxWidth: rect.width,
    fg: style.border,
    bg: style.bg,
    bold: style.bold,
  });
  for (let row = rect.row + 1; row < rect.row + rect.height - 1; row += 1) {
    written = writeTextCommand(target, written, {
      row,
      column: rect.column,
      text: "│",
      maxWidth: 1,
      fg: style.border,
      bg: style.bg,
      bold: style.bold,
    });
    written = writeTextCommand(target, written, {
      row,
      column: rect.column + rect.width - 1,
      text: "│",
      maxWidth: 1,
      fg: style.border,
      bg: style.bg,
      bold: style.bold,
    });
  }
  return writeTextCommand(target, written, {
    row: rect.row + rect.height - 1,
    column: rect.column,
    text: `└${"─".repeat(Math.max(0, rect.width - 2))}┘`,
    maxWidth: rect.width,
    fg: style.border,
    bg: style.bg,
    bold: style.bold,
  });
}

function writeFillCommand(
  target: HtmlCssLayoutRenderCommand[],
  index: number,
  rect: Rectangle,
  bg: string,
): number {
  target[index] = {
    kind: "fill",
    rect,
    bg,
  };
  return index + 1;
}

function writeTextCommand(
  target: HtmlCssLayoutRenderCommand[],
  index: number,
  command: Omit<HtmlCssLayoutTextRenderCommand, "kind">,
): number {
  target[index] = { kind: "text", ...command };
  return index + 1;
}
