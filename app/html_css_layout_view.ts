// Copyright 2023 Im-Beast. MIT license.
import type { ComputedLayoutBox } from "../src/layout/mod.ts";

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
  surface: string;
  text: string;
  warn: string;
}

/** Paint style for one computed HTML/CSS layout demo box. */
export interface HtmlCssLayoutBoxStyle {
  fg: string;
  bg: string;
  border: string;
  bold?: boolean;
}

/** Minimal contrast picker used by extracted layout-demo styling. */
export type HtmlCssLayoutContrast = (color: string, dark: string, light: string) => string;

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
export function htmlCssLayoutBoxPaintOrder(box: Pick<ComputedLayoutBox, "id">): number {
  if (box.id === "layout-demo") return 0;
  if (box.id === "layout-stage") return 1;
  if (box.id === "layout-grid") return 2;
  if (box.id.startsWith("grid-")) return 3;
  if (box.id.startsWith("metric-")) return 2;
  if (box.id === "layout-badge") return 4;
  return 2;
}
