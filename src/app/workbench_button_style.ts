// Copyright 2023 Im-Beast. MIT license.
import { buttonText, fitCellText } from "./workbench_frame.ts";
import { textWidth } from "../utils/strings.ts";

/** Theme colors consumed by workbench button paint helpers. */
export interface WorkbenchButtonTheme {
  background: string;
  border: string;
  buttonActiveBg: string;
  buttonBg: string;
  buttonMutedBg: string;
  buttonMutedText: string;
  danger: string;
  good: string;
  text: string;
  warn: string;
}

/** Visual state for a workbench button. */
export type WorkbenchButtonState = "base" | "active" | "disabled";

/** Semantic tone for a workbench button. */
export type WorkbenchButtonTone = "default" | "danger" | "warning" | "success" | "muted";

/** Minimal contrast picker used by extracted button styling. */
export type WorkbenchButtonContrast = (color: string, dark: string, light: string) => string;

/** Options for projecting a workbench button into clipped display text and paint metadata. */
export interface WorkbenchButtonProjectionOptions {
  state?: WorkbenchButtonState;
  tone?: WorkbenchButtonTone;
  compact?: boolean;
  maxWidth?: number;
}

/** Renderer-neutral clipped button text and paint metadata. */
export interface WorkbenchButtonProjection {
  text: string;
  width: number;
  style: { fg: string; bg: string; bold: boolean };
}

/** Options for projecting an already laid-out button command. */
export interface WorkbenchButtonCommandProjectionOptions {
  text: string;
  state?: WorkbenchButtonState;
  tone?: WorkbenchButtonTone;
}

/** Resolves theme-derived foreground/background styling for clickable workbench buttons. */
export function workbenchButtonPaintOptions(
  theme: WorkbenchButtonTheme,
  contrast: WorkbenchButtonContrast,
  state: WorkbenchButtonState = "base",
  tone: WorkbenchButtonTone = "default",
): { fg: string; bg: string; bold: boolean } {
  if (state === "disabled") {
    return { fg: theme.buttonMutedText, bg: theme.buttonMutedBg, bold: false };
  }
  const toneBg = tone === "danger"
    ? theme.danger
    : tone === "warning"
    ? theme.warn
    : tone === "success"
    ? theme.good
    : tone === "muted"
    ? theme.border
    : undefined;
  if (toneBg) {
    return { fg: contrast(toneBg, theme.background, theme.text), bg: toneBg, bold: true };
  }
  if (state === "active") {
    return {
      fg: contrast(theme.buttonActiveBg, theme.background, theme.text),
      bg: theme.buttonActiveBg,
      bold: true,
    };
  }
  return { fg: contrast(theme.buttonBg, theme.background, theme.text), bg: theme.buttonBg, bold: true };
}

/** Projects one button label into clipped text, width, and theme-derived paint options. */
export function projectWorkbenchButton(
  label: string,
  theme: WorkbenchButtonTheme,
  contrast: WorkbenchButtonContrast,
  options: WorkbenchButtonProjectionOptions = {},
): WorkbenchButtonProjection {
  const rawText = buttonText(label, { compact: options.compact });
  const rawWidth = textWidth(rawText);
  const width = Math.max(0, Math.min(rawWidth, options.maxWidth ?? rawWidth));
  return {
    text: fitCellText(rawText, width),
    width,
    style: workbenchButtonPaintOptions(theme, contrast, options.state ?? "base", options.tone ?? "default"),
  };
}

/** Projects an already-clipped button command into reusable text, width, and paint metadata. */
export function projectWorkbenchButtonCommand(
  command: WorkbenchButtonCommandProjectionOptions,
  theme: WorkbenchButtonTheme,
  contrast: WorkbenchButtonContrast,
): WorkbenchButtonProjection {
  return {
    text: command.text,
    width: textWidth(command.text),
    style: workbenchButtonPaintOptions(theme, contrast, command.state ?? "base", command.tone ?? "default"),
  };
}
