// Copyright 2023 Im-Beast. MIT license.
import { createThemeEngineFromPalette } from "./theme.ts";
import { defaultThemePaletteDefinitionsInternal, normalizeThemePaletteInternal } from "./theme_palettes.ts";
import type {
  ThemeEngine,
  ThemeEngineOptions,
  ThemePalette,
  ThemePaletteInspection,
  ThemePaletteName,
  ThemeTokenName,
  ThemeTokens,
} from "./theme.ts";

/** Options for configuring the extracted palette registry implementation. */
export interface ThemePaletteRegistryImplementationOptions {
  createNotFoundError?: (id: string) => Error;
}

/** Registry implementation for built-in and custom semantic token palettes. */
export class ThemePaletteRegistryImplementation {
  readonly #palettes = new Map<string, ThemePalette>();
  readonly #createNotFoundError: (id: string) => Error;

  /** Creates a registry and optionally registers initial palettes. */
  constructor(
    palettes: Iterable<ThemePalette | ThemePaletteName> = defaultThemePaletteDefinitionsInternal(),
    options: ThemePaletteRegistryImplementationOptions = {},
  ) {
    this.#createNotFoundError = options.createNotFoundError ??
      ((id) => new ThemePaletteNotFoundErrorImplementation(id));
    for (const palette of palettes) {
      this.register(palette);
    }
  }

  /** Registers or replaces a palette by id. */
  register(palette: ThemePalette | ThemePaletteName): this {
    const normalized = normalizeThemePaletteInternal(palette);
    this.#palettes.set(normalized.id, normalized);
    return this;
  }

  /** Removes a palette by id. */
  unregister(id: string): boolean {
    return this.#palettes.delete(id);
  }

  /** Returns whether a palette id is registered. */
  has(id: string): boolean {
    return this.#palettes.has(id);
  }

  /** Looks up a palette by id and returns a defensive copy. */
  get(id: string): ThemePalette | undefined {
    const palette = this.#palettes.get(id);
    return palette
      ? {
        ...palette,
        tokens: { ...palette.tokens },
      }
      : undefined;
  }

  /** Returns registered palette ids in stable order. */
  ids(): string[] {
    return [...this.#palettes.keys()].sort();
  }

  /** Returns palette tokens or throws when the id is unknown. */
  tokens(id: string): Partial<ThemeTokens> {
    const palette = this.get(id);
    if (!palette) {
      throw this.#createNotFoundError(id);
    }
    return palette.tokens;
  }

  /** Builds a theme engine from a registered palette and optional overrides. */
  engine(id: string, options: ThemeEngineOptions = {}): ThemeEngine {
    return createThemeEngineFromPalette(this.tokens(id), options);
  }

  /** Returns serializable palette metadata. */
  inspect(): ThemePaletteInspection[] {
    return this.ids().map((id) => {
      const palette = this.#palettes.get(id)!;
      return {
        id,
        label: palette.label ?? id,
        tokens: sortedThemeTokenNames(Object.keys(palette.tokens)),
      };
    });
  }
}

/** Error implementation thrown when a palette registry lookup targets an unknown id. */
export class ThemePaletteNotFoundErrorImplementation extends Error {
  constructor(id: string) {
    super(`Theme palette "${id}" is not registered`);
    this.name = "ThemePaletteNotFoundError";
  }
}

function sortedThemeTokenNames(values: Iterable<string>): ThemeTokenName[] {
  const requested = new Set(values);
  return themeTokenNames.filter((token) => requested.has(token));
}

const themeTokenNames: ThemeTokenName[] = [
  "foreground",
  "muted",
  "accent",
  "success",
  "warning",
  "danger",
  "surface",
];
