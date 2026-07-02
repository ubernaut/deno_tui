// Copyright 2023 Im-Beast. MIT license.
import { terminalStatusTone } from "../runtime/terminal_status.ts";
import type { ProcessSessionStatus } from "../runtime/process_session.ts";

/** Theme colors used by workbench terminal surface renderers. */
export interface WorkbenchTerminalTheme {
  accent: string;
  background: string;
  borderStrong: string;
  danger: string;
  good: string;
  panelSoft: string;
  surface: string;
  text: string;
  warn: string;
}

/** Minimal terminal screen cell style consumed by the workbench shell renderer. */
export interface WorkbenchTerminalCellStyleInput {
  foreground?: number;
  background?: number;
  bold?: boolean;
}

/** Maps process output streams to theme-aware line styles. */
export function terminalOutputLineStyle(
  source: "stdout" | "stderr" | "system",
  theme: WorkbenchTerminalTheme,
): { fg: string; bg: string; bold?: boolean } {
  if (source === "stderr") return { fg: theme.danger, bg: theme.surface, bold: true };
  if (source === "system") return { fg: theme.warn, bg: theme.panelSoft, bold: true };
  return { fg: theme.text, bg: theme.surface };
}

/** Maps runtime terminal status onto the active workbench terminal theme. */
export function terminalStatusToneColor(
  status: ProcessSessionStatus | "starting" | undefined,
  theme: WorkbenchTerminalTheme,
): string {
  switch (terminalStatusTone(status)) {
    case "good":
      return theme.good;
    case "danger":
      return theme.danger;
    case "warning":
      return theme.warn;
    case "accent":
      return theme.accent;
    case "muted":
      return theme.borderStrong;
  }
}

/** Maps ANSI 8-color foreground/background codes onto the active workbench theme. */
export function terminalAnsiColor(
  code: number | undefined,
  theme: WorkbenchTerminalTheme,
  background: boolean,
): string | undefined {
  if (code === undefined) return undefined;
  const normalized = background ? code - 40 : code - 30;
  switch (normalized) {
    case 0:
      return theme.background;
    case 1:
      return theme.danger;
    case 2:
      return theme.good;
    case 3:
      return theme.warn;
    case 4:
      return theme.accent;
    case 5:
      return theme.borderStrong;
    case 6:
      return theme.accent;
    case 7:
      return theme.text;
    default:
      return undefined;
  }
}

/** Builds a theme-aware paint style for one terminal screen cell. */
export function terminalCellStyle(
  cell: WorkbenchTerminalCellStyleInput,
  theme: WorkbenchTerminalTheme,
  cursor: boolean,
): { fg: string; bg: string; bold?: boolean } {
  if (cursor) return { fg: theme.background, bg: theme.accent, bold: true };
  return {
    fg: terminalAnsiColor(cell.foreground, theme, false) ?? theme.text,
    bg: terminalAnsiColor(cell.background, theme, true) ?? theme.surface,
    bold: cell.bold,
  };
}
