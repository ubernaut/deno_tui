// Copyright 2023 Im-Beast. MIT license.
import { createAnsiStyleMap, emptyStyle } from "./theme_ansi.ts";
import type { ThemePalette, ThemePaletteName, ThemePaletteReference, ThemeTokenName, ThemeTokens } from "./theme.ts";

/** Built-in semantic theme palette token definitions. */
export const themePalettesInternal: Record<ThemePaletteName, Partial<ThemeTokens>> = {
  plain: {
    foreground: emptyStyle,
    muted: emptyStyle,
    accent: emptyStyle,
    success: emptyStyle,
    warning: emptyStyle,
    danger: emptyStyle,
    surface: emptyStyle,
  },
  neon: {
    ...createAnsiStyleMap<ThemeTokenName>({
      foreground: { foreground: [230, 255, 246] },
      muted: { foreground: [104, 124, 132] },
      accent: { foreground: [31, 231, 210] },
      success: { foreground: [156, 255, 58] },
      warning: { foreground: [255, 196, 87] },
      danger: { foreground: [255, 79, 216] },
      surface: { background: [7, 16, 23] },
    }),
  },
  terminal: {
    ...createAnsiStyleMap<ThemeTokenName>({
      foreground: { foreground: "white" },
      muted: { foreground: "brightBlack" },
      accent: { foreground: "cyan" },
      success: { foreground: "green" },
      warning: { foreground: "yellow" },
      danger: { foreground: "red" },
    }),
    surface: emptyStyle,
  },
};

/** Returns built-in palette definitions as registerable palette objects. */
export function defaultThemePaletteDefinitionsInternal(): ThemePalette[] {
  return (Object.entries(themePalettesInternal) as [ThemePaletteName, Partial<ThemeTokens>][]).map(([id, tokens]) => ({
    id,
    label: titleCase(id),
    tokens,
  }));
}

/** Normalizes a built-in palette id or custom palette object into a defensive copy. */
export function normalizeThemePaletteInternal(palette: ThemePalette | ThemePaletteName): ThemePalette {
  if (typeof palette === "string") {
    return {
      id: palette,
      label: titleCase(palette),
      tokens: { ...themePalettesInternal[palette] },
    };
  }
  return {
    ...palette,
    tokens: { ...palette.tokens },
  };
}

/** Resolves a built-in palette id or custom palette object to semantic tokens. */
export function resolveThemePaletteTokensInternal(palette: ThemePaletteReference): Partial<ThemeTokens> {
  return typeof palette === "string" ? themePalettesInternal[palette] : palette.tokens;
}

/** Returns the stable palette id for built-in or custom palette references. */
export function themePaletteIdInternal(palette: ThemePaletteReference): string {
  return typeof palette === "string" ? palette : palette.id;
}

function titleCase(value: string): string {
  return value.replace(/\b\w/g, (character) => character.toUpperCase());
}
