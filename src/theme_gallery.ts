// Copyright 2023 Im-Beast. MIT license.
import { rankCommandPaletteItems } from "./components/command_palette.ts";
import type { CommandPaletteItem } from "./components/command_palette.ts";
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

export interface ThemeGalleryMatch {
  item: ThemeGalleryItem;
  score: number;
  matched: string[];
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
  const items = provider.themeIds().map((id) => createThemeGalleryItem(provider, id, options));
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
  const byId = new Map(items.map((item) => [item.id, item]));
  return rankCommandPaletteItems(items.map(themeGalleryCommandItem), query).map((match) => ({
    item: byId.get(match.item.id)!,
    score: match.score,
    matched: match.matched,
  }));
}

/** Filters and ranks prebuilt theme gallery items for picker views. */
export function filterThemeGalleryItems(
  items: readonly ThemeGalleryItem[],
  query: string,
): ThemeGalleryItem[] {
  return rankThemeGalleryItems(items, query).map((match) => match.item);
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
  const tokenNames = options.tokens ? sortedThemeTokenNames(options.tokens) : [...themeTokenNames];
  const componentNames = options.components
    ? [...options.components]
    : inspection.components.map((component) => component.name);
  const stateNames = options.states ? sortedThemeStates(options.states) : [...themeStates];
  const variants: Record<string, string[]> = {};

  for (const component of inspection.components) {
    variants[component.name] = component.variants;
  }

  const issues = pack?.options ? validateThemeOptions(pack.options) : [];
  const activeLayers = provider.layers.activeIds();
  return {
    id,
    label: pack?.label ?? id,
    palette,
    active: provider.activeId.peek() === id,
    valid: issues.length === 0,
    issues,
    activeLayers,
    tokens: tokenNames,
    components: componentNames,
    variants,
    keywords: themeGalleryKeywords(id, pack?.label, palette, activeLayers, componentNames, variants, issues),
    preview: {
      sample,
      tokens: tokenNames.map((token) => ({
        token,
        preview: previewStyle(engine.theme.tokens[token], sample),
      })),
      components: componentNames.flatMap((component) => {
        const variantNames = options.variants
          ? [...options.variants(component, engine)]
          : ["default", ...engine.variants(component)];
        return variantNames.flatMap((variant) => {
          const theme = engine.component(component, variant);
          return stateNames.map((state) => ({
            component,
            variant,
            state,
            preview: previewStyle(theme[state], sample),
          }));
        });
      }),
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
  palette: ThemeGalleryItem["palette"] | undefined,
  activeLayers: readonly string[],
  components: readonly string[],
  variants: Record<string, string[]>,
  issues: readonly ThemeValidationIssue[],
): string[] {
  return [
    ...new Set([
      "theme",
      "engine",
      id,
      label ?? id,
      palette ?? "plain",
      ...activeLayers,
      ...components,
      ...Object.values(variants).flat(),
      ...(issues.length === 0 ? ["valid"] : ["invalid", ...issues.map((issue) => issue.kind)]),
    ]),
  ].filter(Boolean).sort();
}

function previewStyle(style: (text: string) => string, sample: string): ThemeStylePreview {
  return { raw: sample, styled: style(sample) };
}

function sortedThemeTokenNames(values: Iterable<string>): ThemeTokenName[] {
  const requested = new Set(values);
  return themeTokenNames.filter((token) => requested.has(token));
}

function sortedThemeStates(values: Iterable<string>): ThemeState[] {
  const requested = new Set(values);
  return themeStates.filter((state) => requested.has(state));
}
