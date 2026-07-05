/** Minimal theme tokens needed to style API workbench controls. */
export interface ApiWorkbenchControlStyleTheme {
  background: string;
  text: string;
  surface: string;
  warn: string;
}

/** Plain renderer style returned by shared API workbench control paint helpers. */
export interface ApiWorkbenchControlPaintStyle {
  fg: string;
  bg: string;
  bold: boolean;
}

export type ApiWorkbenchControlLineStyleRole = "base" | "button" | "detail";

export interface ApiWorkbenchTextboxStyleCommand {
  role: "label" | "body";
  header: boolean;
}

/** Shared active/inactive style for non-button API workbench control rows. */
export function apiWorkbenchControlBaseStyle(
  theme: ApiWorkbenchControlStyleTheme,
  active: boolean,
): ApiWorkbenchControlPaintStyle {
  return {
    fg: active ? theme.background : theme.text,
    bg: active ? theme.warn : theme.surface,
    bold: active,
  };
}

/** Shared style for button-row detail text next to themed button spans. */
export function apiWorkbenchControlButtonDetailStyle(
  theme: ApiWorkbenchControlStyleTheme,
  active: boolean,
): ApiWorkbenchControlPaintStyle {
  return {
    fg: active ? theme.warn : theme.text,
    bg: theme.surface,
    bold: active,
  };
}

/** Selects the non-button fallback style for a control-line render command. */
export function apiWorkbenchControlLineFallbackStyle(
  theme: ApiWorkbenchControlStyleTheme,
  role: ApiWorkbenchControlLineStyleRole,
  active: boolean,
): ApiWorkbenchControlPaintStyle {
  return role === "detail"
    ? apiWorkbenchControlButtonDetailStyle(theme, active)
    : apiWorkbenchControlBaseStyle(theme, active);
}

/** Shared style for textbox label/body rows. */
export function apiWorkbenchTextboxCommandStyle(
  theme: ApiWorkbenchControlStyleTheme,
  command: ApiWorkbenchTextboxStyleCommand,
  active: boolean,
): ApiWorkbenchControlPaintStyle {
  const highlighted = active && (command.role === "body" || command.header);
  return {
    fg: highlighted ? theme.background : theme.text,
    bg: highlighted ? theme.warn : theme.surface,
    bold: highlighted,
  };
}

/** Shared style for wrapped combo/radio option rows. */
export function apiWorkbenchWrappedOptionStyle(
  theme: ApiWorkbenchControlStyleTheme,
  active: boolean,
): ApiWorkbenchControlPaintStyle {
  return apiWorkbenchControlBaseStyle(theme, active);
}
