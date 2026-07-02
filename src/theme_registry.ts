// Copyright 2023 Im-Beast. MIT license.
import type { ThemeEngineOptions, ThemePack, ThemePackInspection } from "./theme.ts";
import { composeThemeOptionsCore } from "./theme_core.ts";
import { ThemeEngine } from "./theme_engine.ts";
import { resolveThemePaletteTokensInternal, themePaletteIdInternal } from "./theme_palettes.ts";

/** Options for wiring theme registry implementation dependencies. */
export interface ThemeRegistryImplementationOptions {
  createEngine?: (pack: ThemePack, overrides: ThemeEngineOptions) => ThemeEngine;
  paletteId?: (palette: ThemePack["palette"]) => string;
  createNotFoundError?: (id: string) => Error;
}

/** Shared implementation for storing and resolving theme packs. */
export class ThemeRegistryImplementation {
  readonly #packs = new Map<string, ThemePack>();
  readonly #createEngine: (pack: ThemePack, overrides: ThemeEngineOptions) => ThemeEngine;
  readonly #paletteId: (palette: ThemePack["palette"]) => string;
  readonly #createNotFoundError: (id: string) => Error;
  #ids?: string[];

  constructor(packs: Iterable<ThemePack> = [], options: ThemeRegistryImplementationOptions = {}) {
    this.#createEngine = options.createEngine ?? ((pack, engineOptions) =>
      new ThemeEngine({
        ...engineOptions,
        tokens: {
          ...resolveThemePaletteTokensInternal(pack.palette ?? "plain"),
          ...(engineOptions.tokens ?? {}),
        },
      }));
    this.#paletteId = options.paletteId ?? ((palette) => themePaletteIdInternal(palette ?? "plain"));
    this.#createNotFoundError = options.createNotFoundError ?? ((id) => new ThemePackNotFoundErrorImplementation(id));
    for (const pack of packs) {
      this.register(pack);
    }
  }

  register(pack: ThemePack): this {
    this.#packs.set(pack.id, {
      ...pack,
      options: pack.options ? composeThemeOptionsCore(pack.options) : undefined,
    });
    this.#ids = undefined;
    return this;
  }

  has(id: string): boolean {
    return this.#packs.has(id);
  }

  get(id: string): ThemePack | undefined {
    const pack = this.#packs.get(id);
    return pack
      ? {
        ...pack,
        options: pack.options ? composeThemeOptionsCore(pack.options) : undefined,
      }
      : undefined;
  }

  ids(): string[] {
    if (!this.#ids) {
      const ids: string[] = [];
      for (const id of this.#packs.keys()) ids.push(id);
      ids.sort();
      this.#ids = ids;
    }
    return cloneStringArray(this.#ids);
  }

  engine(id: string, overrides: ThemeEngineOptions = {}): ThemeEngine {
    const pack = this.#packs.get(id);
    if (!pack) {
      throw this.#createNotFoundError(id);
    }

    return this.#createEngine(
      pack,
      composeThemeOptionsCore(pack.options ?? {}, overrides),
    );
  }

  inspect(): ThemePackInspection[] {
    const ids = this.ids();
    const inspections = new Array<ThemePackInspection>(ids.length);
    for (let index = 0; index < ids.length; index += 1) {
      const id = ids[index]!;
      const pack = this.#packs.get(id)!;
      inspections[index] = {
        id,
        label: pack.label ?? id,
        palette: this.#paletteId(pack.palette),
        components: this.engine(id).inspect().components,
      };
    }
    return inspections;
  }
}

function cloneStringArray(values: readonly string[]): string[] {
  const output = new Array<string>(values.length);
  for (let index = 0; index < values.length; index += 1) output[index] = values[index]!;
  return output;
}

/** Error thrown for invalid theme pack lookup operations. */
export class ThemePackNotFoundErrorImplementation extends Error {
  constructor(id: string) {
    super(`Theme pack "${id}" is not registered`);
    this.name = "ThemePackNotFoundError";
  }
}
