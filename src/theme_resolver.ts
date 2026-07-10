// Copyright 2023 Im-Beast. MIT license.
import {
  emptyStyle,
  type Style,
  type ThemeEngine,
  type ThemeProvider,
  type ThemeState,
  themeStates,
  type ThemeTokenName,
  themeTokenNames,
} from "./theme.ts";
import {
  createThemeEngineCache,
  createThemeProviderCache,
  type ThemeEngineCache,
  type ThemeEngineCacheInspection,
  type ThemeProviderCache,
  type ThemeProviderCacheInspection,
} from "./theme_engine_cache.ts";
import { escapeMarkdownCell } from "./utils/formatting.ts";

/** Public interface describing a theme Style Request. */
export interface ThemeStyleRequest {
  component: string;
  state: ThemeState;
  variant?: string;
}

/** Public interface describing a theme Token Request. */
export interface ThemeTokenRequest {
  token: ThemeTokenName;
}

/** Public interface describing a theme Style Resolution. */
export interface ThemeStyleResolution extends ThemeStyleRequest {
  variant: string;
  style: Style;
  preview: string;
}

/** Public interface describing a theme Token Resolution. */
export interface ThemeTokenResolution extends ThemeTokenRequest {
  style: Style;
  preview: string;
}

/** Public interface describing a theme Resolution Snapshot. */
export interface ThemeResolutionSnapshot {
  sample: string;
  tokens: ThemeTokenResolution[];
  styles: ThemeStyleResolution[];
  cache: ThemeEngineCacheInspection | ThemeProviderCacheInspection;
}

/** Options for configuring theme Resolution Snapshot. */
export interface ThemeResolutionSnapshotOptions {
  sample?: string;
  tokens?: Iterable<ThemeTokenName>;
  styles?: Iterable<ThemeStyleRequest>;
}

/** Public interface describing a theme Resolver. */
export interface ThemeResolver {
  token(token: ThemeTokenName): Style;
  resolve(component: string, state: ThemeState, variant?: string): Style;
  component(component: string, variant?: string): Record<ThemeState, Style>;
  snapshot(options?: ThemeResolutionSnapshotOptions): ThemeResolutionSnapshot;
  inspect(): ThemeEngineCacheInspection | ThemeProviderCacheInspection;
  clear(): void;
  dispose(): void;
}

/** Options for configuring theme Resolver Markdown. */
export interface ThemeResolverMarkdownOptions extends ThemeResolutionSnapshotOptions {
  title?: string;
  includeCache?: boolean;
}

/** Public class implementing a theme Engine Resolver. */
export class ThemeEngineResolver implements ThemeResolver {
  readonly engine: ThemeEngine;
  readonly #cache: ThemeEngineCache;

  constructor(engine: ThemeEngine, cache: ThemeEngineCache = createThemeEngineCache(engine)) {
    this.engine = engine;
    this.#cache = cache;
  }

  token(token: ThemeTokenName): Style {
    return this.engine.theme.tokens[token] ?? emptyStyle;
  }

  resolve(component: string, state: ThemeState, variant = "default"): Style {
    return this.#cache.resolve(component, state, variant);
  }

  component(component: string, variant = "default"): Record<ThemeState, Style> {
    const theme = this.#cache.component(component, variant);
    return {
      base: theme.base,
      focused: theme.focused,
      active: theme.active,
      disabled: theme.disabled,
    };
  }

  snapshot(options: ThemeResolutionSnapshotOptions = {}): ThemeResolutionSnapshot {
    return createThemeResolutionSnapshot(this, options);
  }

  inspect(): ThemeEngineCacheInspection {
    return this.#cache.inspect();
  }

  clear(): void {
    this.#cache.clear();
  }

  dispose(): void {
    this.clear();
  }
}

/** Public class implementing a theme Provider Resolver. */
export class ThemeProviderResolver implements ThemeResolver {
  readonly provider: ThemeProvider;
  readonly #cache: ThemeProviderCache;

  constructor(provider: ThemeProvider, cache: ThemeProviderCache = createThemeProviderCache(provider)) {
    this.provider = provider;
    this.#cache = cache;
  }

  token(token: ThemeTokenName): Style {
    return this.provider.engineFor(this.provider.activeId.peek()).theme.tokens[token] ?? emptyStyle;
  }

  resolve(component: string, state: ThemeState, variant = "default"): Style {
    return this.#cache.resolve(component, state, variant);
  }

  component(component: string, variant = "default"): Record<ThemeState, Style> {
    const theme = this.#cache.component(component, variant);
    return {
      base: theme.base,
      focused: theme.focused,
      active: theme.active,
      disabled: theme.disabled,
    };
  }

  snapshot(options: ThemeResolutionSnapshotOptions = {}): ThemeResolutionSnapshot {
    return createThemeResolutionSnapshot(this, options);
  }

  inspect(): ThemeProviderCacheInspection {
    return this.#cache.inspect();
  }

  clear(): void {
    this.#cache.clear();
  }

  dispose(): void {
    this.#cache.dispose();
  }
}

/** Creates an theme Engine Resolver. */
export function createThemeEngineResolver(engine: ThemeEngine): ThemeEngineResolver {
  return new ThemeEngineResolver(engine);
}

/** Creates an theme Provider Resolver. */
export function createThemeProviderResolver(provider: ThemeProvider): ThemeProviderResolver {
  return new ThemeProviderResolver(provider);
}

/** Creates an theme Resolution Snapshot. */
export function createThemeResolutionSnapshot(
  resolver: ThemeResolver,
  options: ThemeResolutionSnapshotOptions = {},
): ThemeResolutionSnapshot {
  const sample = options.sample ?? "Aa";
  const tokens = [...(options.tokens ?? themeTokenNames)].map((token) => {
    const style = resolver.token(token);
    return {
      token,
      style,
      preview: style(sample),
    };
  });
  const styles = [...(options.styles ?? [])].map((request) => {
    const variant = request.variant ?? "default";
    const style = resolver.resolve(request.component, request.state, variant);
    return {
      ...request,
      variant,
      style,
      preview: style(sample),
    };
  });

  return {
    sample,
    tokens,
    styles,
    cache: resolver.inspect(),
  };
}

/** Public helper for component Theme Style Requests. */
export function componentThemeStyleRequests(
  components: Iterable<string>,
  options: { variants?: (component: string) => Iterable<string>; states?: Iterable<ThemeState> } = {},
): ThemeStyleRequest[] {
  const states = [...(options.states ?? themeStates)];
  return [...components].flatMap((component) => {
    const variants = [...(options.variants?.(component) ?? ["default"])];
    return variants.flatMap((variant) => states.map((state) => ({ component, variant, state })));
  });
}

/** Formats theme Resolution Markdown for display or diagnostics. */
export function formatThemeResolutionMarkdown(
  resolver: ThemeResolver,
  options: ThemeResolverMarkdownOptions = {},
): string {
  const snapshot = resolver.snapshot(options);
  const lines = [`# ${options.title ?? "Theme Resolution"}`, ""];

  lines.push("| Token | Preview |");
  lines.push("| --- | --- |");
  for (const token of snapshot.tokens) {
    lines.push(`| ${token.token} | ${escapeMarkdownCell(token.preview)} |`);
  }

  if (snapshot.styles.length > 0) {
    lines.push("", "| Component | Variant | State | Preview |");
    lines.push("| --- | --- | --- | --- |");
    for (const style of snapshot.styles) {
      lines.push(
        `| ${escapeMarkdownCell(style.component)} | ${escapeMarkdownCell(style.variant)} | ${style.state} | ${
          escapeMarkdownCell(style.preview)
        } |`,
      );
    }
  }

  if (options.includeCache ?? true) {
    const cache = snapshot.cache;
    lines.push("", "| Cache | Value |");
    lines.push("| --- | --- |");
    lines.push(`| themes | ${cache.themeEntries} |`);
    lines.push(`| styles | ${cache.styleEntries} |`);
    lines.push(`| hits | ${cache.hits} |`);
    lines.push(`| misses | ${cache.misses} |`);
  }

  return lines.join("\n");
}
