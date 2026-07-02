// Copyright 2023 Im-Beast. MIT license.
import { mergeThemeCatalogComponents } from "./theme_catalog.ts";
import type {
  Style,
  ThemeCatalog,
  ThemeEngine,
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
  const themes = new Array<ThemeCatalog["themes"][number]>(inspection.themes.length);
  for (let index = 0; index < inspection.themes.length; index += 1) {
    const theme = inspection.themes[index]!;
    themes[index] = {
      ...theme,
      active: theme.id === inspection.activeId,
    };
  }
  const layers = new Array<ThemeCatalog["layers"][number]>(inspection.layers.length);
  for (let index = 0; index < inspection.layers.length; index += 1) {
    const layer = inspection.layers[index]!;
    layers[index] = {
      ...layer,
      active: layer.enabled,
    };
  }
  const componentSources = new Array<ThemeCatalog["components"]>(
    inspection.themes.length + inspection.layers.length + 1,
  );
  componentSources[0] = inspection.engine.components;
  let sourceIndex = 1;
  for (const theme of inspection.themes) {
    componentSources[sourceIndex] = theme.components;
    sourceIndex += 1;
  }
  for (const layer of inspection.layers) {
    componentSources[sourceIndex] = layer.components;
    sourceIndex += 1;
  }
  return {
    activeId: inspection.activeId,
    tokens: cloneStringArray(tokenNames) as ThemeTokenName[],
    states: cloneStringArray(states) as ThemeState[],
    themes,
    layers,
    components: mergeThemeCatalogComponents(...componentSources),
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
  const requestedTokens = options.tokens
    ? sortedThemeTokenNames(options.tokens, tokenNames)
    : cloneStringArray(tokenNames);
  const componentNames = options.components ? cloneStringArray(options.components) : catalogComponentNames(catalog);
  const stateNames = options.states ? sortedThemeStates(options.states, states) : cloneStringArray(states);

  return {
    sample,
    activeId: provider.activeId.peek(),
    activeLayers: provider.layers.activeIds(),
    catalog,
    tokens: previewTokens(engine.theme.tokens, requestedTokens as readonly ThemeTokenName[], sample),
    components: previewComponents(
      engine,
      componentNames,
      stateNames as readonly ThemeState[],
      sample,
      options.variants,
    ),
  };
}

function previewStyle(style: Style, sample: string): ThemeStylePreview {
  return { raw: sample, styled: style(sample) };
}

function sortedThemeTokenNames(values: Iterable<string>, tokenNames: readonly ThemeTokenName[]): ThemeTokenName[] {
  const requested = new Set(values);
  const tokens: ThemeTokenName[] = [];
  for (const token of tokenNames) {
    if (requested.has(token)) tokens.push(token);
  }
  return tokens;
}

function sortedThemeStates(values: Iterable<string>, states: readonly ThemeState[]): ThemeState[] {
  const requested = new Set(values);
  const selected: ThemeState[] = [];
  for (const state of states) {
    if (requested.has(state)) selected.push(state);
  }
  return selected;
}

function cloneStringArray<T extends string>(values: Iterable<T>): T[] {
  const cloned: T[] = [];
  for (const value of values) {
    cloned.push(value);
  }
  return cloned;
}

function catalogComponentNames(catalog: ThemeCatalog): string[] {
  const names = new Array<string>(catalog.components.length);
  for (let index = 0; index < catalog.components.length; index += 1) {
    names[index] = catalog.components[index]!.name;
  }
  return names;
}

function previewTokens(
  tokens: Record<ThemeTokenName, Style>,
  tokenNames: readonly ThemeTokenName[],
  sample: string,
): ThemeProviderPreview["tokens"] {
  const previews = new Array<ThemeProviderPreview["tokens"][number]>(tokenNames.length);
  for (let index = 0; index < tokenNames.length; index += 1) {
    const token = tokenNames[index]!;
    previews[index] = {
      token,
      preview: previewStyle(tokens[token], sample),
    };
  }
  return previews;
}

function previewComponents(
  engine: ThemeEngine,
  componentNames: readonly string[],
  stateNames: readonly ThemeState[],
  sample: string,
  variantsOption: ThemeProviderPreviewOptions["variants"],
): ThemeProviderPreview["components"] {
  const previews: ThemeProviderPreview["components"] = [];
  for (const component of componentNames) {
    const variants = variantsOption
      ? cloneStringArray(variantsOption(component, engine))
      : defaultVariantNames(engine, component);
    for (const variant of variants) {
      const theme = engine.component(component, variant);
      for (const state of stateNames) {
        previews.push({
          component,
          variant,
          state,
          preview: previewStyle(theme[state], sample),
        });
      }
    }
  }
  return previews;
}

function defaultVariantNames(engine: ReturnType<ThemeProvider["engine"]["peek"]>, component: string): string[] {
  const variants = engine.variants(component);
  const names = new Array<string>(variants.length + 1);
  names[0] = "default";
  for (let index = 0; index < variants.length; index += 1) {
    names[index + 1] = variants[index]!;
  }
  return names;
}
