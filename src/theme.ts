// Copyright 2023 Im-Beast. MIT license.
import { Computed, Signal } from "./signals/mod.ts";
import type { AsyncStore } from "./runtime/storage.ts";
import {
  createStandardComponentThemeDefinitions as createStandardComponentThemeDefinitionsInternal,
  standardThemeComponentNames as standardThemeComponentNamesInternal,
} from "./theme_standard_components.ts";
import {
  type AnsiColor as AnsiColorInternal,
  type AnsiColorName as AnsiColorNameInternal,
  type AnsiRgbColor as AnsiRgbColorInternal,
  type AnsiStyleSpec as AnsiStyleSpecInternal,
  createAnsiStyle as createAnsiStyleInternal,
  emptyStyle as emptyStyleInternal,
  replaceEmptyStyle as replaceEmptyStyleInternal,
  type Style as StyleInternal,
} from "./theme_ansi.ts";
import {
  defaultThemePaletteDefinitionsInternal,
  resolveThemePaletteTokensInternal,
  themePaletteIdInternal,
  themePalettesInternal,
} from "./theme_palettes.ts";
import {
  ThemePaletteNotFoundErrorImplementation,
  ThemePaletteRegistryImplementation,
} from "./theme_palette_registry.ts";
import {
  composeStylesCore,
  composeThemeOptionsCore,
  createThemeCore,
  hierarchizeThemeCore,
  mergeComponentThemeDefinitionCore,
  normalizeThemeExtends,
  resolveThemeStateDefinitionCore,
  resolveThemeStyleReferenceCore,
} from "./theme_core.ts";
import {
  compileThemeManifestStateDefinitionCore,
  compileThemeManifestStyleReferenceCore,
} from "./theme_manifest_core.ts";
import { inspectThemeCoverageCore } from "./theme_coverage_core.ts";
import { diffThemeEnginesCore } from "./theme_diff_core.ts";
import { validateThemeComponentsCore } from "./theme_validation_core.ts";
import { formatThemeProviderReportMarkdownFromReport } from "./theme_provider_report.ts";
import { mergeThemeCatalogComponents } from "./theme_catalog.ts";
import {
  ThemeEngine as ThemeEngineImplementation,
  ThemeInheritanceError as ThemeInheritanceErrorImplementation,
} from "./theme_engine.ts";
import { ThemeLayerStackImplementation } from "./theme_layer_stack.ts";
import { ThemePackNotFoundErrorImplementation, ThemeRegistryImplementation } from "./theme_registry.ts";

/** Function that's supposed to return styled text given string as parameter */
export type Style = StyleInternal;

/** Public type alias for an ansi Color Name. */
export type AnsiColorName = AnsiColorNameInternal;

/** Public type alias for an ansi Rgb Color. */
export type AnsiRgbColor = AnsiRgbColorInternal;

/** Public type alias for an ansi Color. */
export type AnsiColor = AnsiColorInternal;

/** Public type alias for an ansi Style Spec. */
export type AnsiStyleSpec = AnsiStyleSpecInternal;

/** Used as placeholder style when one is not supplied, returns the input */
export const emptyStyle: Style = emptyStyleInternal;

/** Returns {replacement} if {style} is an {emptyStyle} otherwise returns {style} back */
export function replaceEmptyStyle(style: Style, replacement: Style): Style {
  return replaceEmptyStyleInternal(style, replacement);
}

/** Creates an ansi Style. */
export function createAnsiStyle(spec: AnsiStyleSpec): Style {
  return createAnsiStyleInternal(spec);
}

/** Public type alias for an ansi Theme Token Specs. */
export type AnsiThemeTokenSpecs = Partial<Record<ThemeTokenName, AnsiStyleSpec>>;

/** Creates an ansi Theme Tokens. */
export function createAnsiThemeTokens(specs: AnsiThemeTokenSpecs): Partial<ThemeTokens> {
  const tokens: Partial<ThemeTokens> = {};
  for (const [name, spec] of Object.entries(specs) as [ThemeTokenName, AnsiStyleSpec][]) {
    tokens[name] = createAnsiStyle(spec);
  }
  return tokens;
}

/** Applies default values to properties (lower one hierarchy or `emptyStyle`) that aren't set */
export function hierarchizeTheme(input: Partial<Theme> = {}): Theme {
  return hierarchizeThemeCore(input);
}

/** Base theme used to style components, can be expanded upon */
export interface Theme {
  /** Default style */
  base: Style;
  /** Style when component is focused */
  focused: Style;
  /** Style when component is active */
  active: Style;
  /** Style when component is disabled */
  disabled: Style;
}

/** Public interface describing a theme Tokens. */
export interface ThemeTokens {
  foreground: Style;
  muted: Style;
  accent: Style;
  success: Style;
  warning: Style;
  danger: Style;
  surface: Style;
}

/** Public type alias for a theme Token Name. */
export type ThemeTokenName = keyof ThemeTokens;
/** Public constant for a theme Token Names. */
export const themeTokenNames = [
  "foreground",
  "muted",
  "accent",
  "success",
  "warning",
  "danger",
  "surface",
] as const satisfies readonly ThemeTokenName[];
/** Public type alias for a theme Style Reference. */
export type ThemeStyleReference = Style | ThemeTokenName | readonly ThemeStyleReference[];
/** Public type alias for a theme State Definition. */
export type ThemeStateDefinition = Partial<Record<ThemeState, ThemeStyleReference>>;

/** Public type alias for a theme Manifest Style Reference. */
export type ThemeManifestStyleReference =
  | string
  | AnsiStyleSpec
  | readonly ThemeManifestStyleReference[];
/** Public type alias for a theme Manifest State Definition. */
export type ThemeManifestStateDefinition = Partial<Record<ThemeState, ThemeManifestStyleReference>>;

/** Public interface describing a theme Manifest Component Definition. */
export interface ThemeManifestComponentDefinition {
  extends?: string | readonly string[];
  base?: ThemeManifestStateDefinition;
  variants?: Record<string, ThemeManifestStateDefinition>;
}

/** Options for configuring theme Manifest. */
export interface ThemeManifestOptions {
  tokens?: Partial<Record<ThemeTokenName, AnsiStyleSpec>>;
  components?: Record<string, ThemeManifestComponentDefinition>;
}

/** Creates an theme. */
export function createTheme(tokens: Partial<ThemeTokens> = {}): Theme & { tokens: ThemeTokens } {
  return createThemeCore(tokens);
}

/** Public type alias for a theme State. */
export type ThemeState = keyof Theme;
/** Public constant for a theme States. */
export const themeStates = ["base", "focused", "active", "disabled"] as const satisfies readonly ThemeState[];

/** Public interface describing a component Theme Definition. */
export interface ComponentThemeDefinition {
  extends?: string | readonly string[];
  base?: ThemeStateDefinition;
  variants?: Record<string, ThemeStateDefinition>;
}

/** Options for configuring theme Engine. */
export interface ThemeEngineOptions {
  tokens?: Partial<ThemeTokens>;
  components?: Record<string, ComponentThemeDefinition>;
}

/** Public interface describing a theme Layer. */
export interface ThemeLayer {
  id: string;
  label?: string;
  enabled?: boolean;
  options: ThemeEngineOptions;
}

/** Serializable inspection snapshot for theme Layer. */
export interface ThemeLayerInspection {
  id: string;
  label: string;
  enabled: boolean;
  components: ThemeComponentInspection[];
}

/** Serializable inspection snapshot for theme Component. */
export interface ThemeComponentInspection {
  name: string;
  variants: string[];
}

/** Serializable inspection snapshot for theme. */
export interface ThemeInspection {
  tokens: Array<keyof ThemeTokens>;
  components: ThemeComponentInspection[];
}

/** Serializable inspection snapshot for theme Variant Coverage. */
export interface ThemeVariantCoverageInspection {
  name: string;
  states: ThemeState[];
  missingStates: ThemeState[];
  complete: boolean;
}

/** Serializable inspection snapshot for theme Component Coverage. */
export interface ThemeComponentCoverageInspection {
  name: string;
  extends: string[];
  variants: ThemeVariantCoverageInspection[];
  stateCount: number;
  coveredStateCount: number;
  missingStateCount: number;
  complete: boolean;
}

/** Serializable inspection snapshot for theme Coverage. */
export interface ThemeCoverageInspection {
  componentCount: number;
  variantCount: number;
  stateCount: number;
  coveredStateCount: number;
  missingStateCount: number;
  complete: boolean;
  components: ThemeComponentCoverageInspection[];
}

/** Options for configuring theme Coverage. */
export interface ThemeCoverageOptions {
  components?: Iterable<string>;
  variants?: (component: string, definition: ComponentThemeDefinition) => Iterable<string>;
}

/** Options for creating the library-standard component theme definitions. */
export interface StandardComponentThemeOptions {
  components?: Iterable<string>;
}

/** Serializable audit result for standard component theme coverage. */
export interface ThemeStandardizationInspection {
  expectedComponents: string[];
  themedComponents: string[];
  missingComponents: string[];
  extraComponents: string[];
  coverage: ThemeCoverageInspection;
  complete: boolean;
}

/** Identifier union for theme Validation Issue variants. */
export type ThemeValidationIssueKind =
  | "unknown-token"
  | "unknown-component"
  | "inheritance-cycle";

/** Public interface describing a theme Validation Issue. */
export interface ThemeValidationIssue {
  kind: ThemeValidationIssueKind;
  path: string;
  message: string;
  component?: string;
  variant?: string;
  state?: ThemeState;
  reference?: string;
}

/** Public interface describing a theme Style Preview. */
export interface ThemeStylePreview {
  raw: string;
  styled: string;
}

/** Public interface describing a theme Token Diff. */
export interface ThemeTokenDiff {
  token: ThemeTokenName;
  before: ThemeStylePreview;
  after: ThemeStylePreview;
}

/** Public interface describing a theme Component State Diff. */
export interface ThemeComponentStateDiff {
  component: string;
  variant: string;
  state: ThemeState;
  before: ThemeStylePreview;
  after: ThemeStylePreview;
}

/** Public interface describing a theme Engine Diff. */
export interface ThemeEngineDiff {
  sample: string;
  tokens: ThemeTokenDiff[];
  components: ThemeComponentStateDiff[];
}

/** Options for configuring theme Engine Diff. */
export interface ThemeEngineDiffOptions {
  sample?: string;
  components?: Iterable<string>;
  variants?: (component: string, engines: readonly [ThemeEngine, ThemeEngine]) => Iterable<string>;
  includeUnchanged?: boolean;
}

/** Serializable inspection snapshot for theme Manifest Variant. */
export interface ThemeManifestVariantInspection {
  name: string;
  states: ThemeState[];
}

/** Serializable inspection snapshot for theme Manifest Component. */
export interface ThemeManifestComponentInspection {
  name: string;
  extends: string[];
  states: ThemeState[];
  variants: ThemeManifestVariantInspection[];
}

/** Serializable inspection snapshot for theme Manifest. */
export interface ThemeManifestInspection {
  id: string;
  label: string;
  palette: ThemePaletteName;
  tokens: ThemeTokenName[];
  components: ThemeManifestComponentInspection[];
  issues: ThemeValidationIssue[];
}

/** Public interface describing a theme Manifest Token Preview. */
export interface ThemeManifestTokenPreview {
  token: ThemeTokenName;
  preview: ThemeStylePreview;
}

/** Public interface describing a theme Manifest Component State Preview. */
export interface ThemeManifestComponentStatePreview {
  component: string;
  variant: string;
  state: ThemeState;
  preview: ThemeStylePreview;
}

/** Public interface describing a theme Manifest Preview. */
export interface ThemeManifestPreview {
  sample: string;
  manifest: ThemeManifestInspection;
  tokens: ThemeManifestTokenPreview[];
  components: ThemeManifestComponentStatePreview[];
}

/** Options for configuring theme Manifest Preview. */
export interface ThemeManifestPreviewOptions {
  sample?: string;
  components?: Iterable<string>;
  variants?: (component: string, engine: ThemeEngine) => Iterable<string>;
  states?: Iterable<ThemeState>;
  tokens?: Iterable<ThemeTokenName>;
}

/** Public interface describing a theme Provider Token Preview. */
export interface ThemeProviderTokenPreview {
  token: ThemeTokenName;
  preview: ThemeStylePreview;
}

/** Public interface describing a theme Provider Component State Preview. */
export interface ThemeProviderComponentStatePreview {
  component: string;
  variant: string;
  state: ThemeState;
  preview: ThemeStylePreview;
}

/** Public interface describing a theme Provider Preview. */
export interface ThemeProviderPreview {
  sample: string;
  activeId: string;
  activeLayers: string[];
  catalog: ThemeCatalog;
  tokens: ThemeProviderTokenPreview[];
  components: ThemeProviderComponentStatePreview[];
}

/** Options for configuring theme Provider Preview. */
export interface ThemeProviderPreviewOptions {
  sample?: string;
  components?: Iterable<string>;
  variants?: (component: string, engine: ThemeEngine) => Iterable<string>;
  states?: Iterable<ThemeState>;
  tokens?: Iterable<ThemeTokenName>;
}

/** Source bucket for a validation issue surfaced by a theme provider report. */
export type ThemeProviderReportIssueSource = "theme" | "layer";

/** Validation issue annotated with the provider source that produced it. */
export interface ThemeProviderReportIssue extends ThemeValidationIssue {
  source: ThemeProviderReportIssueSource;
  sourceId: string;
}

/** Aggregate provider report counts for settings screens, docs, and CI summaries. */
export interface ThemeProviderReportSummary {
  themeCount: number;
  layerCount: number;
  activeLayerCount: number;
  componentCount: number;
  variantCount: number;
  issueCount: number;
  missingStateCount: number;
  completeCoverage: boolean;
}

/** Combined theme provider catalog, preview, coverage, and diagnostics snapshot. */
export interface ThemeProviderReport {
  title: string;
  activeId: string;
  activeLayers: string[];
  catalog: ThemeCatalog;
  preview?: ThemeProviderPreview;
  coverage?: ThemeCoverageInspection;
  issues: ThemeProviderReportIssue[];
  summary: ThemeProviderReportSummary;
}

/** Options for creating or formatting a theme provider report. */
export interface ThemeProviderReportOptions {
  title?: string;
  preview?: ThemeProviderPreviewOptions | false;
  coverage?: ThemeCoverageOptions | false;
}

/** Public type alias for a theme Palette Name. */
export type ThemePaletteName = "plain" | "neon" | "terminal";
/** Built-in palette id or custom palette definition accepted by theme engines. */
export type ThemePaletteReference = ThemePaletteName | ThemePalette;

/** Named semantic token set used to seed a theme engine. */
export interface ThemePalette {
  id: string;
  label?: string;
  tokens: Partial<ThemeTokens>;
}

/** Serializable palette metadata for inspectors and settings UIs. */
export interface ThemePaletteInspection {
  id: string;
  label: string;
  tokens: ThemeTokenName[];
}

/** Public constant for a theme Palettes. */
export const themePalettes: Record<ThemePaletteName, Partial<ThemeTokens>> = themePalettesInternal;

/** Registry for built-in and custom semantic token palettes. */
export class ThemePaletteRegistry extends ThemePaletteRegistryImplementation {
  /** Creates a registry and optionally registers initial palettes. */
  constructor(palettes: Iterable<ThemePalette | ThemePaletteName> = defaultThemePaletteDefinitions()) {
    super(palettes, { createNotFoundError: (id) => new ThemePaletteNotFoundError(id) });
  }
}

/** Error thrown when a palette registry lookup targets an unknown id. */
export class ThemePaletteNotFoundError extends ThemePaletteNotFoundErrorImplementation {}

/** Public helper for merge Component Theme Definition. */
export function mergeComponentThemeDefinition(
  base: ComponentThemeDefinition = {},
  extension: ComponentThemeDefinition = {},
): ComponentThemeDefinition {
  return mergeComponentThemeDefinitionCore(base, extension);
}

/** Public helper for compose Styles. */
export function composeStyles(...styles: Style[]): Style {
  return composeStylesCore(...styles);
}

/** Resolves theme Style Reference from the provided inputs. */
export function resolveThemeStyleReference(reference: ThemeStyleReference, tokens: ThemeTokens): Style {
  return resolveThemeStyleReferenceCore(reference, tokens);
}

/** Resolves theme State Definition from the provided inputs. */
export function resolveThemeStateDefinition(
  definition: ThemeStateDefinition = {},
  tokens: ThemeTokens,
): Partial<Theme> {
  return resolveThemeStateDefinitionCore(definition, tokens);
}

/** Public helper for compose Theme Options. */
export function composeThemeOptions(...options: ThemeEngineOptions[]): ThemeEngineOptions {
  return composeThemeOptionsCore(...options);
}

/** Returns the canonical component names covered by the standard theme preset. */
export function standardThemeComponentNames(): string[] {
  return standardThemeComponentNamesInternal();
}

/** Creates component theme definitions for the built-in widget catalog. */
export function createStandardComponentThemeDefinitions(
  options: StandardComponentThemeOptions = {},
): Record<string, ComponentThemeDefinition> {
  return createStandardComponentThemeDefinitionsInternal(options);
}

/** Composes user options on top of the standard component theme definitions. */
export function composeStandardThemeOptions(options: ThemeEngineOptions = {}): ThemeEngineOptions {
  return composeThemeOptions({ components: createStandardComponentThemeDefinitions() }, options);
}

/** Audits whether a theme option set covers the standard widget component surface. */
export function inspectThemeStandardization(
  options: ThemeEngineOptions,
  coverageOptions: ThemeCoverageOptions = {},
): ThemeStandardizationInspection {
  const expectedComponents = [...(coverageOptions.components ?? standardThemeComponentNames())].sort((a, b) =>
    a.localeCompare(b)
  );
  const expected = new Set(expectedComponents);
  const themedComponents = Object.keys(composeThemeOptions(options).components ?? {}).sort((a, b) =>
    a.localeCompare(b)
  );
  const coverage = inspectThemeCoverage(options, { ...coverageOptions, components: expectedComponents });

  return {
    expectedComponents,
    themedComponents,
    missingComponents: expectedComponents.filter((name) => !themedComponents.includes(name)),
    extraComponents: themedComponents.filter((name) => !expected.has(name)),
    coverage,
    complete: coverage.complete && expectedComponents.every((name) => themedComponents.includes(name)),
  };
}

/** Public helper for compile Theme Manifest Style Reference. */
export function compileThemeManifestStyleReference(
  reference: ThemeManifestStyleReference,
): ThemeStyleReference {
  return compileThemeManifestStyleReferenceCore(reference) as ThemeStyleReference;
}

/** Public helper for compile Theme Manifest State Definition. */
export function compileThemeManifestStateDefinition(
  definition: ThemeManifestStateDefinition = {},
): ThemeStateDefinition {
  return compileThemeManifestStateDefinitionCore<ThemeState>(definition) as ThemeStateDefinition;
}

/** Public helper for compile Theme Manifest Options. */
export function compileThemeManifestOptions(manifest: ThemeManifestOptions = {}): ThemeEngineOptions {
  const components: Record<string, ComponentThemeDefinition> = {};

  for (const [name, definition] of Object.entries(manifest.components ?? {})) {
    const variants: Record<string, ThemeStateDefinition> = {};
    for (const [variant, states] of Object.entries(definition.variants ?? {})) {
      variants[variant] = compileThemeManifestStateDefinition(states);
    }

    components[name] = {
      extends: definition.extends,
      base: compileThemeManifestStateDefinition(definition.base),
      variants,
    };
  }

  return composeThemeOptions({
    tokens: manifest.tokens ? createAnsiThemeTokens(manifest.tokens) : undefined,
    components,
  });
}

/** Public helper for theme Pack From Manifest. */
export function themePackFromManifest(manifest: ThemePackManifest): ThemePack {
  return {
    id: manifest.id,
    label: manifest.label,
    palette: manifest.palette,
    options: compileThemeManifestOptions(manifest.options),
  };
}

/** Creates an theme Engine From Manifest. */
export function createThemeEngineFromManifest(
  manifest: Pick<ThemePackManifest, "palette" | "options">,
  overrides: ThemeEngineOptions = {},
): ThemeEngine {
  return createThemeEngine(
    manifest.palette ?? "plain",
    composeThemeOptions(compileThemeManifestOptions(manifest.options), overrides),
  );
}

/** Creates an theme Registry From Manifests. */
export function createThemeRegistryFromManifests(manifests: Iterable<ThemePackManifest>): ThemeRegistry {
  return createThemeRegistry([...manifests].map(themePackFromManifest));
}

/** Creates a serializable inspection snapshot for theme Manifest. */
export function inspectThemeManifest(manifest: ThemePackManifest): ThemeManifestInspection {
  const options = compileThemeManifestOptions(manifest.options);
  const components = manifest.options?.components ?? {};
  return {
    id: manifest.id,
    label: manifest.label ?? manifest.id,
    palette: manifest.palette ?? "plain",
    tokens: sortedThemeTokenNames(Object.keys(manifest.options?.tokens ?? {})),
    components: Object.entries(components)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, definition]) => ({
        name,
        extends: normalizeThemeExtends(definition.extends),
        states: sortedThemeStates(Object.keys(definition.base ?? {})),
        variants: Object.entries(definition.variants ?? {})
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([variant, states]) => ({
            name: variant,
            states: sortedThemeStates(Object.keys(states)),
          })),
      })),
    issues: validateThemeOptions(options),
  };
}

/** Public helper for preview Theme Manifest. */
export function previewThemeManifest(
  manifest: ThemePackManifest,
  options: ThemeManifestPreviewOptions = {},
): ThemeManifestPreview {
  const sample = options.sample ?? "Aa";
  const engine = createThemeEngineFromManifest(manifest);
  const tokenNames = options.tokens ? sortedThemeTokenNames([...options.tokens]) : [...themeTokenNames];
  const componentNames = options.components ? [...options.components] : engine.componentNames();
  const stateNames = options.states ? sortedThemeStates([...options.states]) : [...themeStates];

  return {
    sample,
    manifest: inspectThemeManifest(manifest),
    tokens: tokenNames.map((token) => ({
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

/** Public helper for validate Theme Options. */
export function validateThemeOptions(options: ThemeEngineOptions): ThemeValidationIssue[] {
  const normalized = composeThemeOptions(options);
  const components = normalized.components ?? {};
  return validateThemeComponentsCore<ThemeState, ThemeTokenName>(components, {
    tokenNames: themeTokenNames,
    normalizeExtends: normalizeThemeExtends,
  }) as ThemeValidationIssue[];
}

/** Public helper for assert Theme Options. */
export function assertThemeOptions(options: ThemeEngineOptions): void {
  const issues = validateThemeOptions(options);
  if (issues.length > 0) {
    throw new ThemeValidationError(issues);
  }
}

/** Public helper for diff Theme Engines. */
export function diffThemeEngines(
  before: ThemeEngine,
  after: ThemeEngine,
  options: ThemeEngineDiffOptions = {},
): ThemeEngineDiff {
  return diffThemeEnginesCore(before, after, {
    sample: options.sample,
    tokenNames: themeTokenNames,
    states: themeStates,
    components: options.components,
    variants: options.variants
      ? (component, engines) => options.variants?.(component, engines as readonly [ThemeEngine, ThemeEngine]) ?? []
      : undefined,
    includeUnchanged: options.includeUnchanged,
  }) as ThemeEngineDiff;
}

/** Creates a serializable inspection snapshot for theme Coverage. */
export function inspectThemeCoverage(
  options: ThemeEngineOptions,
  coverageOptions: ThemeCoverageOptions = {},
): ThemeCoverageInspection {
  const components = composeThemeOptions(options).components ?? {};
  return inspectThemeCoverageCore<ThemeState>(components, {
    states: themeStates,
    components: coverageOptions.components,
    variants: coverageOptions.variants
      ? (component, definition) => coverageOptions.variants?.(component, definition as ComponentThemeDefinition) ?? []
      : undefined,
    normalizeExtends: normalizeThemeExtends,
    createInheritanceError: (cycle) => new ThemeInheritanceError([...cycle]),
  }) as ThemeCoverageInspection;
}

/** Creates an theme Engine. */
export function createThemeEngine(
  palette: ThemePaletteReference = "plain",
  options: Omit<ThemeEngineOptions, "tokens"> & { tokens?: Partial<ThemeTokens> } = {},
): ThemeEngine {
  return createThemeEngineFromPalette(resolveThemePaletteTokensInternal(palette), options);
}

/** Builds a theme engine from concrete palette tokens plus optional overrides. */
export function createThemeEngineFromPalette(
  palette: Partial<ThemeTokens>,
  options: Omit<ThemeEngineOptions, "tokens"> & { tokens?: Partial<ThemeTokens> } = {},
): ThemeEngine {
  return new ThemeEngine({
    ...options,
    tokens: {
      ...palette,
      ...(options.tokens ?? {}),
    },
  });
}

/** Public interface describing a theme Pack. */
export interface ThemePack {
  id: string;
  label?: string;
  description?: string;
  palette?: ThemePaletteReference;
  options?: ThemeEngineOptions;
}

/** Public interface describing a theme Pack Manifest. */
export interface ThemePackManifest {
  id: string;
  label?: string;
  description?: string;
  palette?: ThemePaletteName;
  options?: ThemeManifestOptions;
}

/** Serializable inspection snapshot for theme Pack. */
export interface ThemePackInspection {
  id: string;
  label: string;
  palette: string;
  components: ThemeComponentInspection[];
}

/** Serializable inspection snapshot for theme Provider. */
export interface ThemeProviderInspection {
  activeId: string;
  themes: ThemePackInspection[];
  layers: ThemeLayerInspection[];
  engine: ThemeInspection;
}

/** Public interface describing a theme Catalog Theme. */
export interface ThemeCatalogTheme extends ThemePackInspection {
  active: boolean;
}

/** Public interface describing a theme Catalog Layer. */
export interface ThemeCatalogLayer extends ThemeLayerInspection {
  active: boolean;
}

/** Public interface describing a theme Catalog Component. */
export interface ThemeCatalogComponent extends ThemeComponentInspection {
  variants: string[];
}

/** Public interface describing a theme Catalog. */
export interface ThemeCatalog {
  activeId: string;
  tokens: ThemeTokenName[];
  states: ThemeState[];
  themes: ThemeCatalogTheme[];
  layers: ThemeCatalogLayer[];
  components: ThemeCatalogComponent[];
}

/** Public class implementing a theme Layer Stack. */
export class ThemeLayerStack extends ThemeLayerStackImplementation {}

/** Registry for storing and querying theme definitions. */
export class ThemeRegistry extends ThemeRegistryImplementation {
  constructor(packs: Iterable<ThemePack> = []) {
    super(packs, {
      createEngine: (pack, overrides) => createThemeEngine(pack.palette ?? "plain", overrides),
      paletteId: (palette) => themePaletteIdInternal(palette ?? "plain"),
      createNotFoundError: (id) => new ThemePackNotFoundError(id),
    });
  }

  override engine(id: string, overrides: ThemeEngineOptions = {}): ThemeEngine {
    return super.engine(id, overrides) as ThemeEngine;
  }
}

/** Error thrown for invalid theme Pack Not Found operations. */
export class ThemePackNotFoundError extends ThemePackNotFoundErrorImplementation {}

/** Options for configuring theme Provider. */
export interface ThemeProviderOptions {
  registry?: ThemeRegistry;
  activeId?: string | Signal<string>;
  overrides?: ThemeEngineOptions;
  layers?: ThemeLayerStack | Iterable<ThemeLayer>;
  store?: AsyncStore<string>;
  storageKey?: string;
  onError?: (error: unknown) => void;
}

/** Public class implementing a theme Provider. */
export class ThemeProvider {
  readonly registry: ThemeRegistry;
  readonly activeId: Signal<string>;
  readonly engine: Computed<ThemeEngine>;
  readonly layers: ThemeLayerStack;
  readonly ready: Promise<string>;
  readonly #overrides: ThemeEngineOptions;
  readonly #store?: AsyncStore<string>;
  readonly #storageKey: string;
  readonly #onError?: (error: unknown) => void;
  #loaded = false;
  #dirtyBeforeLoad = false;
  #suspendWrites = false;
  #pendingWrite: Promise<void> = Promise.resolve();

  constructor(options: ThemeProviderOptions = {}) {
    this.registry = options.registry ?? createThemeRegistry(defaultThemePacks);
    this.activeId = options.activeId instanceof Signal
      ? options.activeId
      : new Signal(options.activeId ?? this.registry.ids()[0] ?? "plain");
    this.#overrides = composeThemeOptions(options.overrides ?? {});
    this.layers = options.layers instanceof ThemeLayerStack
      ? options.layers
      : createThemeLayerStack(options.layers ?? []);
    this.#store = options.store;
    this.#storageKey = options.storageKey ?? "theme.active";
    this.#onError = options.onError;
    this.engine = new Computed(() => this.engineFor(this.activeId.value));
    this.activeId.subscribe((id) => this.#persistTheme(id));
    this.ready = this.#loadTheme();
  }

  setTheme(id: string): boolean {
    if (!this.registry.has(id)) return false;
    this.activeId.value = id;
    return true;
  }

  themeIds(): string[] {
    return this.registry.ids();
  }

  cycleTheme(direction = 1): string {
    const ids = this.themeIds();
    if (ids.length === 0) return this.activeId.peek();

    const currentIndex = Math.max(0, ids.indexOf(this.activeId.peek()));
    const nextIndex = positiveModulo(currentIndex + direction, ids.length);
    this.setTheme(ids[nextIndex]);
    return this.activeId.peek();
  }

  nextTheme(): string {
    return this.cycleTheme(1);
  }

  previousTheme(): string {
    return this.cycleTheme(-1);
  }

  engineFor(id: string): ThemeEngine {
    return this.registry.engine(
      id,
      composeThemeOptions(this.#overrides, this.layers.options.value),
    );
  }

  async flush(): Promise<void> {
    await this.ready;
    await this.#pendingWrite;
  }

  async resetTheme(id = this.themeIds()[0] ?? this.activeId.peek()): Promise<boolean> {
    if (!this.registry.has(id)) return false;
    await this.ready;
    this.#suspendWrites = true;
    this.activeId.value = id;
    this.#suspendWrites = false;
    this.#pendingWrite = this.#pendingWrite
      .catch(() => undefined)
      .then(() => this.#store?.delete(this.#storageKey))
      .catch((error) => this.#onError?.(error));
    await this.#pendingWrite;
    return true;
  }

  component(componentName: string, variant = "default"): Computed<Theme> {
    return new Computed(() => this.engine.value.component(componentName, variant));
  }

  resolve(componentName: string, state: ThemeState, variant = "default"): Computed<Style> {
    return new Computed(() => this.engine.value.resolve(componentName, state, variant));
  }

  inspect(): ThemeProviderInspection {
    return {
      activeId: this.activeId.peek(),
      themes: this.registry.inspect(),
      layers: this.layers.inspect(),
      engine: this.engine.peek().inspect(),
    };
  }

  catalog(): ThemeCatalog {
    return createThemeCatalog(this);
  }

  async #loadTheme(): Promise<string> {
    if (!this.#store) {
      this.#loaded = true;
      return this.activeId.peek();
    }

    try {
      const storedId = await this.#store.get(this.#storageKey);
      this.#loaded = true;
      if (storedId && this.registry.has(storedId) && !this.#dirtyBeforeLoad) {
        this.#suspendWrites = true;
        this.activeId.value = storedId;
        this.#suspendWrites = false;
      } else if (this.#dirtyBeforeLoad) {
        this.#writeTheme(this.activeId.peek());
      }
      return this.activeId.peek();
    } catch (error) {
      this.#loaded = true;
      this.#onError?.(error);
      return this.activeId.peek();
    }
  }

  #persistTheme(id: string): void {
    if (this.#suspendWrites || !this.#store) return;
    if (!this.#loaded) {
      this.#dirtyBeforeLoad = true;
      return;
    }
    this.#writeTheme(id);
  }

  #writeTheme(id: string): void {
    this.#pendingWrite = this.#pendingWrite
      .catch(() => undefined)
      .then(() => this.#store?.set(this.#storageKey, id))
      .catch((error) => this.#onError?.(error));
  }
}

/** Public constant for a default Theme Packs. */
export const defaultThemePacks: ThemePack[] = [
  { id: "plain", label: "Plain", palette: "plain", options: composeStandardThemeOptions() },
  { id: "neon", label: "Neon", palette: "neon", options: composeStandardThemeOptions() },
  { id: "terminal", label: "Terminal", palette: "terminal", options: composeStandardThemeOptions() },
];

/** Returns the built-in palette definitions as registerable palette objects. */
export function defaultThemePaletteDefinitions(): ThemePalette[] {
  return defaultThemePaletteDefinitionsInternal();
}

/** Creates a palette registry with built-in palettes by default. */
export function createThemePaletteRegistry(
  palettes: Iterable<ThemePalette | ThemePaletteName> = defaultThemePaletteDefinitions(),
): ThemePaletteRegistry {
  return new ThemePaletteRegistry(palettes);
}

/** Creates an theme Registry. */
export function createThemeRegistry(packs: Iterable<ThemePack> = defaultThemePacks): ThemeRegistry {
  return new ThemeRegistry(packs);
}

/** Creates an theme Layer Stack. */
export function createThemeLayerStack(layers: Iterable<ThemeLayer> = []): ThemeLayerStack {
  return new ThemeLayerStack(layers);
}

/** Creates an theme Provider. */
export function createThemeProvider(options: ThemeProviderOptions = {}): ThemeProvider {
  return new ThemeProvider(options);
}

/** Creates an theme Catalog. */
export function createThemeCatalog(provider: ThemeProvider): ThemeCatalog {
  const inspection = provider.inspect();
  return {
    activeId: inspection.activeId,
    tokens: [...themeTokenNames],
    states: [...themeStates],
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

/** Public helper for preview Theme Provider. */
export function previewThemeProvider(
  provider: ThemeProvider,
  options: ThemeProviderPreviewOptions = {},
): ThemeProviderPreview {
  const sample = options.sample ?? "Aa";
  const engine = provider.engine.peek();
  const catalog = provider.catalog();
  const tokenNames = options.tokens ? sortedThemeTokenNames([...options.tokens]) : [...themeTokenNames];
  const componentNames = options.components
    ? [...options.components]
    : catalog.components.map((component) => component.name);
  const stateNames = options.states ? sortedThemeStates([...options.states]) : [...themeStates];

  return {
    sample,
    activeId: provider.activeId.peek(),
    activeLayers: provider.layers.activeIds(),
    catalog,
    tokens: tokenNames.map((token) => ({
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

/** Creates an audit-ready report for a provider's theme catalog, active composition, preview, and diagnostics. */
export function createThemeProviderReport(
  provider: ThemeProvider,
  options: ThemeProviderReportOptions = {},
): ThemeProviderReport {
  const catalog = provider.catalog();
  const activeLayers = provider.layers.activeIds();
  const coverageOptions = options.coverage === false ? undefined : options.coverage ?? {};
  const coverage = coverageOptions
    ? inspectThemeCoverage(themeProviderActiveOptions(provider), {
      components: catalog.components.map((component) => component.name),
      ...coverageOptions,
    })
    : undefined;
  const preview = options.preview === false ? undefined : previewThemeProvider(provider, options.preview ?? {});
  const issues = inspectThemeProviderIssues(provider);
  const variantCount = catalog.components.reduce((total, component) => total + component.variants.length, 0);

  return {
    title: options.title ?? "Theme Provider Report",
    activeId: catalog.activeId,
    activeLayers,
    catalog,
    preview,
    coverage,
    issues,
    summary: {
      themeCount: catalog.themes.length,
      layerCount: catalog.layers.length,
      activeLayerCount: activeLayers.length,
      componentCount: catalog.components.length,
      variantCount,
      issueCount: issues.length,
      missingStateCount: coverage?.missingStateCount ?? 0,
      completeCoverage: coverage?.complete ?? true,
    },
  };
}

/** Formats a theme provider report as Markdown for demos, docs, and CI summaries. */
export function formatThemeProviderReportMarkdown(
  provider: ThemeProvider,
  options: ThemeProviderReportOptions = {},
): string {
  return formatThemeProviderReportMarkdownFromReport(createThemeProviderReport(provider, options));
}

/** Public class implementing a theme Engine. */
export class ThemeEngine extends ThemeEngineImplementation {
  constructor(options: ThemeEngineOptions = {}) {
    super(options, (chain) => new ThemeInheritanceError(chain));
  }

  override extend(options: ThemeEngineOptions): ThemeEngine {
    return new ThemeEngine(composeThemeOptions({
      tokens: this.theme.tokens,
      components: this.components,
    }, options));
  }
}

/** Error thrown for invalid theme Inheritance operations. */
export class ThemeInheritanceError extends ThemeInheritanceErrorImplementation {}

/** Error thrown for invalid theme Validation operations. */
export class ThemeValidationError extends Error {
  readonly issues: ThemeValidationIssue[];

  constructor(issues: ThemeValidationIssue[]) {
    super(`Theme options are invalid: ${issues.map((issue) => issue.message).join("; ")}`);
    this.name = "ThemeValidationError";
    this.issues = issues;
  }
}

function previewStyle(style: Style, sample: string): ThemeStylePreview {
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

function themeProviderActiveOptions(provider: ThemeProvider): ThemeEngineOptions {
  const activePack = provider.registry.get(provider.activeId.peek());
  return composeThemeOptions(
    activePack?.options ?? {},
    ...provider.layers.activeLayers().map((layer) => layer.options),
  );
}

function inspectThemeProviderIssues(provider: ThemeProvider): ThemeProviderReportIssue[] {
  const issues: ThemeProviderReportIssue[] = [];
  for (const id of provider.registry.ids()) {
    const pack = provider.registry.get(id);
    if (!pack?.options) continue;
    issues.push(
      ...validateThemeOptions(pack.options).map((issue) => ({
        ...issue,
        source: "theme" as const,
        sourceId: id,
      })),
    );
  }

  for (const id of provider.layers.ids()) {
    const layer = provider.layers.get(id);
    if (!layer) continue;
    const layerComponents = new Set(Object.keys(layer.options.components ?? {}));
    issues.push(
      ...validateThemeOptions(composeThemeOptions(...themeRegistryOptions(provider), layer.options))
        .filter((issue) => !issue.component || layerComponents.has(issue.component))
        .map((issue) => ({
          ...issue,
          source: "layer" as const,
          sourceId: id,
        })),
    );
  }
  return issues;
}

function themeRegistryOptions(provider: ThemeProvider): ThemeEngineOptions[] {
  return provider.registry.ids()
    .map((id) => provider.registry.get(id)?.options)
    .filter((options): options is ThemeEngineOptions => options !== undefined);
}

function positiveModulo(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor;
}

function titleCase(value: string): string {
  return value.length === 0 ? value : `${value[0].toUpperCase()}${value.slice(1)}`;
}
