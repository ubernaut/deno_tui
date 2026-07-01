// Copyright 2023 Im-Beast. MIT license.

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
