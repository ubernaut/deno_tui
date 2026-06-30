// Copyright 2023 Im-Beast. MIT license.
import type { Style, Theme, ThemeEngine, ThemeProvider, ThemeState } from "./theme.ts";

/** Serializable inspection snapshot for theme Engine Cache. */
export interface ThemeEngineCacheInspection {
  themeEntries: number;
  styleEntries: number;
  hits: number;
  misses: number;
}

/** Serializable inspection snapshot for theme Provider Cache. */
export interface ThemeProviderCacheInspection extends ThemeEngineCacheInspection {
  activeId: string;
}

/** Public class implementing a theme Engine Cache. */
export class ThemeEngineCache {
  readonly engine: ThemeEngine;
  #themes = new Map<string, Theme>();
  #styles = new Map<string, Style>();
  #hits = 0;
  #misses = 0;

  constructor(engine: ThemeEngine) {
    this.engine = engine;
  }

  component(componentName: string, variant = "default"): Theme {
    const key = componentKey(componentName, variant);
    const cached = this.#themes.get(key);
    if (cached) {
      this.#hits++;
      return cached;
    }

    const theme = this.engine.component(componentName, variant);
    this.#themes.set(key, theme);
    this.#misses++;
    return theme;
  }

  resolve(componentName: string, state: ThemeState, variant = "default"): Style {
    const key = styleKey(componentName, variant, state);
    const cached = this.#styles.get(key);
    if (cached) {
      this.#hits++;
      return cached;
    }

    const style = this.component(componentName, variant)[state];
    this.#styles.set(key, style);
    this.#misses++;
    return style;
  }

  clear(): void {
    this.#themes.clear();
    this.#styles.clear();
  }

  inspect(): ThemeEngineCacheInspection {
    return {
      themeEntries: this.#themes.size,
      styleEntries: this.#styles.size,
      hits: this.#hits,
      misses: this.#misses,
    };
  }
}

/** Public class implementing a theme Provider Cache. */
export class ThemeProviderCache {
  readonly provider: ThemeProvider;
  #cache: ThemeEngineCache;
  #signature: string;
  readonly #syncCache = () => {
    this.#signature = providerSignature(this.provider);
    this.#cache = new ThemeEngineCache(this.provider.engineFor(this.provider.activeId.peek()));
  };

  constructor(provider: ThemeProvider) {
    this.provider = provider;
    this.#signature = providerSignature(provider);
    this.#cache = new ThemeEngineCache(provider.engineFor(provider.activeId.peek()));
    this.provider.engine.subscribe(this.#syncCache);
  }

  component(componentName: string, variant = "default"): Theme {
    this.#syncIfChanged();
    return this.#cache.component(componentName, variant);
  }

  resolve(componentName: string, state: ThemeState, variant = "default"): Style {
    this.#syncIfChanged();
    return this.#cache.resolve(componentName, state, variant);
  }

  clear(): void {
    this.#cache.clear();
  }

  inspect(): ThemeProviderCacheInspection {
    return {
      activeId: this.provider.activeId.peek(),
      ...this.#cache.inspect(),
    };
  }

  dispose(): void {
    this.provider.engine.unsubscribe(this.#syncCache);
    this.clear();
  }

  #syncIfChanged(): void {
    if (this.#signature !== providerSignature(this.provider)) {
      this.#syncCache();
    }
  }
}

/** Creates an theme Engine Cache. */
export function createThemeEngineCache(engine: ThemeEngine): ThemeEngineCache {
  return new ThemeEngineCache(engine);
}

/** Creates an theme Provider Cache. */
export function createThemeProviderCache(provider: ThemeProvider): ThemeProviderCache {
  return new ThemeProviderCache(provider);
}

function componentKey(componentName: string, variant: string): string {
  return `${componentName}\0${variant}`;
}

function styleKey(componentName: string, variant: string, state: ThemeState): string {
  return `${componentName}\0${variant}\0${state}`;
}

function providerSignature(provider: ThemeProvider): string {
  return `${provider.activeId.peek()}\0${provider.layers.activeIds().join("\0")}`;
}
