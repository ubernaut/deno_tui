// Copyright 2023 Im-Beast. MIT license.
import { rankCommandPaletteItems } from "./components/command_palette.ts";
import type { CommandPaletteItem } from "./components/command_palette.ts";
import { orderedSubset } from "./utils/collections.ts";
import {
  type ThemeEngine,
  type ThemeProvider,
  type ThemeState,
  themeStates,
  type ThemeStylePreview,
  type ThemeTokenName,
  themeTokenNames,
  type ThemeValidationIssue,
  validateThemeOptions,
} from "./theme.ts";

/** Rendered semantic token sample for one theme gallery item. */
export interface ThemeGalleryTokenPreview {
  token: ThemeTokenName;
  preview: ThemeStylePreview;
}

/** Rendered component-state sample for one theme gallery item. */
export interface ThemeGalleryComponentStatePreview {
  component: string;
  variant: string;
  state: ThemeState;
  preview: ThemeStylePreview;
}

/** Searchable theme picker item with metadata, validation, and rendered previews. */
export interface ThemeGalleryItem {
  id: string;
  label: string;
  description?: string;
  palette: string;
  active: boolean;
  valid: boolean;
  issues: ThemeValidationIssue[];
  activeLayers: string[];
  tokens: ThemeTokenName[];
  components: string[];
  variants: Record<string, string[]>;
  keywords: string[];
  preview: {
    sample: string;
    tokens: ThemeGalleryTokenPreview[];
    components: ThemeGalleryComponentStatePreview[];
  };
}

/** Search result for one ranked theme gallery item. */
export interface ThemeGalleryMatch {
  item: ThemeGalleryItem;
  score: number;
  matched: string[];
}

/** Result of applying a gallery item to a provider. */
export interface ThemeGallerySelection {
  selected: boolean;
  id: string;
  previousId: string;
  activeId: string;
  reason?: "unknown" | "invalid";
  item?: ThemeGalleryItem;
}

/** Complete theme gallery snapshot for settings panes, demos, and command surfaces. */
export interface ThemeGallery {
  activeId: string;
  query: string;
  count: number;
  items: ThemeGalleryItem[];
  matches: ThemeGalleryMatch[];
}

/** Options controlling theme gallery search and preview sampling. */
export interface ThemeGalleryOptions {
  query?: string;
  sample?: string;
  tokens?: Iterable<ThemeTokenName>;
  components?: Iterable<string>;
  states?: Iterable<ThemeState>;
  variants?: (component: string, engine: ThemeEngine) => Iterable<string>;
}

/** Builds searchable preview items for every theme registered with a provider. */
export function createThemeGallery(
  provider: ThemeProvider,
  options: ThemeGalleryOptions = {},
): ThemeGallery {
  const query = options.query ?? "";
  const themeIds = provider.themeIds();
  const items = new Array<ThemeGalleryItem>(themeIds.length);
  for (let index = 0; index < themeIds.length; index += 1) {
    items[index] = createThemeGalleryItem(provider, themeIds[index]!, options);
  }
  const matches = rankThemeGalleryItems(items, query);
  return {
    activeId: provider.activeId.peek(),
    query,
    count: items.length,
    items,
    matches,
  };
}

/** Ranks prebuilt theme gallery items using the command palette search scorer. */
export function rankThemeGalleryItems(
  items: readonly ThemeGalleryItem[],
  query: string,
): ThemeGalleryMatch[] {
  const byId = new Map<string, ThemeGalleryItem>();
  const commandItems = new Array<CommandPaletteItem>(items.length);
  for (let index = 0; index < items.length; index += 1) {
    const item = items[index]!;
    byId.set(item.id, item);
    commandItems[index] = themeGalleryCommandItem(item);
  }
  const ranked = rankCommandPaletteItems(commandItems, query);
  const matches = new Array<ThemeGalleryMatch>(ranked.length);
  for (let index = 0; index < ranked.length; index += 1) {
    const match = ranked[index]!;
    matches[index] = {
      item: byId.get(match.item.id)!,
      score: match.score,
      matched: match.matched,
    };
  }
  return matches;
}

/** Filters and ranks prebuilt theme gallery items for picker views. */
export function filterThemeGalleryItems(
  items: readonly ThemeGalleryItem[],
  query: string,
): ThemeGalleryItem[] {
  const matches = rankThemeGalleryItems(items, query);
  const filtered = new Array<ThemeGalleryItem>(matches.length);
  for (let index = 0; index < matches.length; index += 1) {
    filtered[index] = matches[index]!.item;
  }
  return filtered;
}

/** Selects a gallery item on the provider after checking registration and theme validation. */
export function selectThemeGalleryItem(
  provider: ThemeProvider,
  id: string,
  options: ThemeGalleryOptions & { allowInvalid?: boolean } = {},
): ThemeGallerySelection {
  const previousId = provider.activeId.peek();
  if (!provider.registry.has(id)) {
    return { selected: false, id, previousId, activeId: previousId, reason: "unknown" };
  }

  const item = createThemeGalleryItem(provider, id, options);
  if (!item.valid && options.allowInvalid !== true) {
    return { selected: false, id, previousId, activeId: previousId, reason: "invalid", item };
  }

  provider.setTheme(id);
  return {
    selected: provider.activeId.peek() === id,
    id,
    previousId,
    activeId: provider.activeId.peek(),
    item: createThemeGalleryItem(provider, id, options),
  };
}

function createThemeGalleryItem(
  provider: ThemeProvider,
  id: string,
  options: ThemeGalleryOptions,
): ThemeGalleryItem {
  const pack = provider.registry.get(id);
  const engine = provider.engineFor(id);
  const inspection = engine.inspect();
  const palette = typeof pack?.palette === "string" ? pack.palette : pack?.palette?.id ?? "plain";
  const sample = options.sample ?? "Aa";
  const tokenNames = options.tokens ? orderedSubset(options.tokens, themeTokenNames) : themeTokenNames.slice();
  const componentNames = options.components
    ? Array.from(options.components)
    : inspectedComponentNames(inspection.components);
  const stateNames = options.states ? orderedSubset(options.states, themeStates) : themeStates.slice();
  const variants: Record<string, string[]> = {};

  for (const component of inspection.components) {
    variants[component.name] = component.variants;
  }

  const issues = pack?.options ? validateThemeOptions(pack.options) : [];
  const activeLayers = provider.layers.activeIds();
  return {
    id,
    label: pack?.label ?? id,
    description: pack?.description,
    palette,
    active: provider.activeId.peek() === id,
    valid: issues.length === 0,
    issues,
    activeLayers,
    tokens: tokenNames,
    components: componentNames,
    variants,
    keywords: themeGalleryKeywords(
      id,
      pack?.label,
      pack?.description,
      palette,
      activeLayers,
      componentNames,
      variants,
      issues,
    ),
    preview: {
      sample,
      tokens: previewThemeGalleryTokens(engine, tokenNames, sample),
      components: previewThemeGalleryComponents(engine, componentNames, stateNames, sample, options.variants),
    },
  };
}

function themeGalleryCommandItem(item: ThemeGalleryItem): CommandPaletteItem {
  return {
    id: item.id,
    label: item.label,
    keywords: item.keywords,
    disabled: !item.valid,
  };
}

function themeGalleryKeywords(
  id: string,
  label: string | undefined,
  description: string | undefined,
  palette: ThemeGalleryItem["palette"] | undefined,
  activeLayers: readonly string[],
  components: readonly string[],
  variants: Record<string, string[]>,
  issues: readonly ThemeValidationIssue[],
): string[] {
  const keywords = new Set<string>();
  addThemeGalleryKeyword(keywords, "theme");
  addThemeGalleryKeyword(keywords, "engine");
  addThemeGalleryKeyword(keywords, id);
  addThemeGalleryKeyword(keywords, label ?? id);
  addThemeGalleryKeyword(keywords, description);
  addThemeGalleryKeyword(keywords, palette ?? "plain");
  for (const layer of activeLayers) addThemeGalleryKeyword(keywords, layer);
  for (const component of components) addThemeGalleryKeyword(keywords, component);
  for (const variant in variants) {
    for (const state of variants[variant]!) {
      addThemeGalleryKeyword(keywords, state);
    }
  }
  if (issues.length === 0) {
    addThemeGalleryKeyword(keywords, "valid");
  } else {
    addThemeGalleryKeyword(keywords, "invalid");
    for (const issue of issues) addThemeGalleryKeyword(keywords, issue.kind);
  }
  return [...keywords].sort();
}

function previewStyle(style: (text: string) => string, sample: string): ThemeStylePreview {
  return { raw: sample, styled: style(sample) };
}

function inspectedComponentNames(components: ReturnType<ThemeEngine["inspect"]>["components"]): string[] {
  const names = new Array<string>(components.length);
  for (let index = 0; index < components.length; index += 1) {
    names[index] = components[index]!.name;
  }
  return names;
}

function previewThemeGalleryTokens(
  engine: ThemeEngine,
  tokenNames: readonly ThemeTokenName[],
  sample: string,
): ThemeGalleryTokenPreview[] {
  const previews = new Array<ThemeGalleryTokenPreview>(tokenNames.length);
  for (let index = 0; index < tokenNames.length; index += 1) {
    const token = tokenNames[index]!;
    previews[index] = {
      token,
      preview: previewStyle(engine.theme.tokens[token], sample),
    };
  }
  return previews;
}

function previewThemeGalleryComponents(
  engine: ThemeEngine,
  componentNames: readonly string[],
  stateNames: readonly ThemeState[],
  sample: string,
  variantsOption: ThemeGalleryOptions["variants"],
): ThemeGalleryComponentStatePreview[] {
  const previews: ThemeGalleryComponentStatePreview[] = [];
  for (const component of componentNames) {
    const variantNames = variantsOption
      ? Array.from(variantsOption(component, engine))
      : defaultVariantNames(engine, component);
    for (const variant of variantNames) {
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

function defaultVariantNames(engine: ThemeEngine, component: string): string[] {
  const variants = engine.variants(component);
  const names = new Array<string>(variants.length + 1);
  names[0] = "default";
  for (let index = 0; index < variants.length; index += 1) {
    names[index + 1] = variants[index]!;
  }
  return names;
}

function addThemeGalleryKeyword(keywords: Set<string>, value: string | undefined): void {
  if (typeof value === "string" && value.length > 0) keywords.add(value);
}
