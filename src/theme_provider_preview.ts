// Copyright 2023 Im-Beast. MIT license.
import { mergeThemeCatalogComponents } from "./theme_catalog.ts";
import type {
  Style,
  ThemeCatalog,
  ThemeProvider,
  ThemeProviderInspection,
  ThemeProviderPreview,
  ThemeProviderPreviewOptions,
  ThemeState,
  ThemeStylePreview,
  ThemeTokenName,
} from "./theme.ts";

/** Builds a provider catalog snapshot from an inspection result and stable ordering inputs. */
export function createThemeCatalogFromInspection(
  inspection: ThemeProviderInspection,
  tokenNames: readonly ThemeTokenName[],
  states: readonly ThemeState[],
): ThemeCatalog {
  return {
    activeId: inspection.activeId,
    tokens: [...tokenNames],
    states: [...states],
    themes: inspection.themes.map((theme) => ({
      ...theme,
      active: theme.id === inspection.activeId,
    })),
    layers: inspection.layers.map((layer) => ({
      ...layer,
      active: layer.enabled,
    })),
    components: mergeThemeCatalogComponents(
      inspection.engine.components,
      ...inspection.themes.map((theme) => theme.components),
      ...inspection.layers.map((layer) => layer.components),
    ),
  };
}

/** Builds rendered token and component samples for a provider's active theme engine. */
export function previewThemeProviderCore(
  provider: ThemeProvider,
  options: ThemeProviderPreviewOptions,
  tokenNames: readonly ThemeTokenName[],
  states: readonly ThemeState[],
): ThemeProviderPreview {
  const sample = options.sample ?? "Aa";
  const engine = provider.engine.peek();
  const catalog = provider.catalog();
  const requestedTokens = options.tokens ? sortedThemeTokenNames(options.tokens, tokenNames) : [...tokenNames];
  const componentNames = options.components
    ? [...options.components]
    : catalog.components.map((component) => component.name);
  const stateNames = options.states ? sortedThemeStates(options.states, states) : [...states];

  return {
    sample,
    activeId: provider.activeId.peek(),
    activeLayers: provider.layers.activeIds(),
    catalog,
    tokens: requestedTokens.map((token) => ({
      token,
      preview: previewStyle(engine.theme.tokens[token], sample),
    })),
    components: componentNames.flatMap((component) => {
      const variants = options.variants
        ? [...options.variants(component, engine)]
        : ["default", ...engine.variants(component)];
      return variants.flatMap((variant) => {
        const theme = engine.component(component, variant);
        return stateNames.map((state) => ({
          component,
          variant,
          state,
          preview: previewStyle(theme[state], sample),
        }));
      });
    }),
  };
}

function previewStyle(style: Style, sample: string): ThemeStylePreview {
  return { raw: sample, styled: style(sample) };
}

function sortedThemeTokenNames(values: Iterable<string>, tokenNames: readonly ThemeTokenName[]): ThemeTokenName[] {
  const requested = new Set(values);
  return tokenNames.filter((token) => requested.has(token));
}

function sortedThemeStates(values: Iterable<string>, states: readonly ThemeState[]): ThemeState[] {
  const requested = new Set(values);
  return states.filter((state) => requested.has(state));
}
