// Copyright 2023 Im-Beast. MIT license.
import { Computed, Signal } from "./signals/mod.ts";
import type { AsyncStore } from "./runtime/storage.ts";

/** Function that's supposed to return styled text given string as parameter */
export type Style = (text: string) => string;

/** Used as placeholder style when one is not supplied, returns the input */
export function emptyStyle(text: string): string {
  return text;
}

/** Returns {replacement} if {style} is an {emptyStyle} otherwise returns {style} back */
export function replaceEmptyStyle(style: Style, replacement: Style): Style {
  return style === emptyStyle ? replacement : style;
}

export type AnsiColorName =
  | "black"
  | "red"
  | "green"
  | "yellow"
  | "blue"
  | "magenta"
  | "cyan"
  | "white"
  | "brightBlack"
  | "brightRed"
  | "brightGreen"
  | "brightYellow"
  | "brightBlue"
  | "brightMagenta"
  | "brightCyan"
  | "brightWhite";

export type AnsiRgbColor = readonly [red: number, green: number, blue: number];
export type AnsiColor = AnsiColorName | AnsiRgbColor | number;

const ANSI_COLOR_NAMES: readonly AnsiColorName[] = [
  "black",
  "red",
  "green",
  "yellow",
  "blue",
  "magenta",
  "cyan",
  "white",
  "brightBlack",
  "brightRed",
  "brightGreen",
  "brightYellow",
  "brightBlue",
  "brightMagenta",
  "brightCyan",
  "brightWhite",
];

export interface AnsiStyleSpec {
  foreground?: AnsiColor;
  background?: AnsiColor;
  bold?: boolean;
  dim?: boolean;
  italic?: boolean;
  underline?: boolean;
  inverse?: boolean;
  strikethrough?: boolean;
}

export type AnsiThemeTokenSpecs = Partial<Record<ThemeTokenName, AnsiStyleSpec>>;

export function createAnsiStyle(spec: AnsiStyleSpec): Style {
  const codes = ansiStyleCodes(spec);
  if (codes.length === 0) return emptyStyle;
  const open = `\x1b[${codes.join(";")}m`;
  return (value) => `${open}${value}\x1b[0m`;
}

export function createAnsiThemeTokens(specs: AnsiThemeTokenSpecs): Partial<ThemeTokens> {
  const tokens: Partial<ThemeTokens> = {};
  for (const [name, spec] of Object.entries(specs) as [ThemeTokenName, AnsiStyleSpec][]) {
    tokens[name] = createAnsiStyle(spec);
  }
  return tokens;
}

/** Applies default values to properties (lower one hierarchy or `emptyStyle`) that aren't set */
export function hierarchizeTheme(input: Partial<Theme> = {}): Theme {
  input.base ??= emptyStyle;
  input.disabled ??= input.base;
  input.focused ??= input.base;
  input.active ??= input.focused;

  const output = input as Theme & Record<string, Theme>;
  for (const key in output) {
    if (key === "base" || key === "focused" || key === "active" || key === "disabled" || output === output[key]) {
      continue;
    }
    output[key] = hierarchizeTheme(output[key]);
  }

  return output;
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

export interface ThemeTokens {
  foreground: Style;
  muted: Style;
  accent: Style;
  success: Style;
  warning: Style;
  danger: Style;
  surface: Style;
}

export type ThemeTokenName = keyof ThemeTokens;
export const themeTokenNames = [
  "foreground",
  "muted",
  "accent",
  "success",
  "warning",
  "danger",
  "surface",
] as const satisfies readonly ThemeTokenName[];
export type ThemeStyleReference = Style | ThemeTokenName | readonly ThemeStyleReference[];
export type ThemeStateDefinition = Partial<Record<ThemeState, ThemeStyleReference>>;

export type ThemeManifestStyleReference =
  | string
  | AnsiStyleSpec
  | readonly ThemeManifestStyleReference[];
export type ThemeManifestStateDefinition = Partial<Record<ThemeState, ThemeManifestStyleReference>>;

export interface ThemeManifestComponentDefinition {
  extends?: string | readonly string[];
  base?: ThemeManifestStateDefinition;
  variants?: Record<string, ThemeManifestStateDefinition>;
}

export interface ThemeManifestOptions {
  tokens?: Partial<Record<ThemeTokenName, AnsiStyleSpec>>;
  components?: Record<string, ThemeManifestComponentDefinition>;
}

export function createTheme(tokens: Partial<ThemeTokens> = {}): Theme & { tokens: ThemeTokens } {
  const fallback = tokens.foreground ?? emptyStyle;
  return {
    base: fallback,
    focused: tokens.accent ?? fallback,
    active: tokens.success ?? tokens.accent ?? fallback,
    disabled: tokens.muted ?? fallback,
    tokens: {
      foreground: fallback,
      muted: tokens.muted ?? fallback,
      accent: tokens.accent ?? fallback,
      success: tokens.success ?? fallback,
      warning: tokens.warning ?? fallback,
      danger: tokens.danger ?? fallback,
      surface: tokens.surface ?? emptyStyle,
    },
  };
}

export type ThemeState = keyof Theme;
export const themeStates = ["base", "focused", "active", "disabled"] as const satisfies readonly ThemeState[];

export interface ComponentThemeDefinition {
  extends?: string | readonly string[];
  base?: ThemeStateDefinition;
  variants?: Record<string, ThemeStateDefinition>;
}

export interface ThemeEngineOptions {
  tokens?: Partial<ThemeTokens>;
  components?: Record<string, ComponentThemeDefinition>;
}

export interface ThemeLayer {
  id: string;
  label?: string;
  enabled?: boolean;
  options: ThemeEngineOptions;
}

export interface ThemeLayerInspection {
  id: string;
  label: string;
  enabled: boolean;
  components: ThemeComponentInspection[];
}

export interface ThemeComponentInspection {
  name: string;
  variants: string[];
}

export interface ThemeInspection {
  tokens: Array<keyof ThemeTokens>;
  components: ThemeComponentInspection[];
}

export interface ThemeVariantCoverageInspection {
  name: string;
  states: ThemeState[];
  missingStates: ThemeState[];
  complete: boolean;
}

export interface ThemeComponentCoverageInspection {
  name: string;
  extends: string[];
  variants: ThemeVariantCoverageInspection[];
  stateCount: number;
  coveredStateCount: number;
  missingStateCount: number;
  complete: boolean;
}

export interface ThemeCoverageInspection {
  componentCount: number;
  variantCount: number;
  stateCount: number;
  coveredStateCount: number;
  missingStateCount: number;
  complete: boolean;
  components: ThemeComponentCoverageInspection[];
}

export interface ThemeCoverageOptions {
  components?: Iterable<string>;
  variants?: (component: string, definition: ComponentThemeDefinition) => Iterable<string>;
}

export type ThemeValidationIssueKind =
  | "unknown-token"
  | "unknown-component"
  | "inheritance-cycle";

export interface ThemeValidationIssue {
  kind: ThemeValidationIssueKind;
  path: string;
  message: string;
  component?: string;
  variant?: string;
  state?: ThemeState;
  reference?: string;
}

export interface ThemeStylePreview {
  raw: string;
  styled: string;
}

export interface ThemeTokenDiff {
  token: ThemeTokenName;
  before: ThemeStylePreview;
  after: ThemeStylePreview;
}

export interface ThemeComponentStateDiff {
  component: string;
  variant: string;
  state: ThemeState;
  before: ThemeStylePreview;
  after: ThemeStylePreview;
}

export interface ThemeEngineDiff {
  sample: string;
  tokens: ThemeTokenDiff[];
  components: ThemeComponentStateDiff[];
}

export interface ThemeEngineDiffOptions {
  sample?: string;
  components?: Iterable<string>;
  variants?: (component: string, engines: readonly [ThemeEngine, ThemeEngine]) => Iterable<string>;
  includeUnchanged?: boolean;
}

export interface ThemeManifestVariantInspection {
  name: string;
  states: ThemeState[];
}

export interface ThemeManifestComponentInspection {
  name: string;
  extends: string[];
  states: ThemeState[];
  variants: ThemeManifestVariantInspection[];
}

export interface ThemeManifestInspection {
  id: string;
  label: string;
  palette: ThemePaletteName;
  tokens: ThemeTokenName[];
  components: ThemeManifestComponentInspection[];
  issues: ThemeValidationIssue[];
}

export interface ThemeManifestTokenPreview {
  token: ThemeTokenName;
  preview: ThemeStylePreview;
}

export interface ThemeManifestComponentStatePreview {
  component: string;
  variant: string;
  state: ThemeState;
  preview: ThemeStylePreview;
}

export interface ThemeManifestPreview {
  sample: string;
  manifest: ThemeManifestInspection;
  tokens: ThemeManifestTokenPreview[];
  components: ThemeManifestComponentStatePreview[];
}

export interface ThemeManifestPreviewOptions {
  sample?: string;
  components?: Iterable<string>;
  variants?: (component: string, engine: ThemeEngine) => Iterable<string>;
  states?: Iterable<ThemeState>;
  tokens?: Iterable<ThemeTokenName>;
}

export interface ThemeProviderTokenPreview {
  token: ThemeTokenName;
  preview: ThemeStylePreview;
}

export interface ThemeProviderComponentStatePreview {
  component: string;
  variant: string;
  state: ThemeState;
  preview: ThemeStylePreview;
}

export interface ThemeProviderPreview {
  sample: string;
  activeId: string;
  activeLayers: string[];
  catalog: ThemeCatalog;
  tokens: ThemeProviderTokenPreview[];
  components: ThemeProviderComponentStatePreview[];
}

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

export const themePalettes: Record<ThemePaletteName, Partial<ThemeTokens>> = {
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
    ...createAnsiThemeTokens({
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
    ...createAnsiThemeTokens({
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

/** Registry for built-in and custom semantic token palettes. */
export class ThemePaletteRegistry {
  readonly #palettes = new Map<string, ThemePalette>();

  /** Creates a registry and optionally registers initial palettes. */
  constructor(palettes: Iterable<ThemePalette | ThemePaletteName> = defaultThemePaletteDefinitions()) {
    for (const palette of palettes) {
      this.register(palette);
    }
  }

  /** Registers or replaces a palette by id. */
  register(palette: ThemePalette | ThemePaletteName): this {
    const normalized = normalizeThemePalette(palette);
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
      throw new ThemePaletteNotFoundError(id);
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

/** Error thrown when a palette registry lookup targets an unknown id. */
export class ThemePaletteNotFoundError extends Error {
  constructor(id: string) {
    super(`Theme palette "${id}" is not registered`);
    this.name = "ThemePaletteNotFoundError";
  }
}

export function mergeComponentThemeDefinition(
  base: ComponentThemeDefinition = {},
  extension: ComponentThemeDefinition = {},
): ComponentThemeDefinition {
  const variants = { ...(base.variants ?? {}) };
  for (const [name, variant] of Object.entries(extension.variants ?? {})) {
    variants[name] = {
      ...(variants[name] ?? {}),
      ...variant,
    };
  }

  return {
    extends: mergeThemeExtends(base.extends, extension.extends),
    base: {
      ...(base.base ?? {}),
      ...(extension.base ?? {}),
    },
    variants,
  };
}

export function composeStyles(...styles: Style[]): Style {
  const active = styles.filter((style) => style !== emptyStyle);
  if (active.length === 0) return emptyStyle;
  if (active.length === 1) return active[0];
  return (value) => active.reduce((text, style) => style(text), value);
}

export function resolveThemeStyleReference(reference: ThemeStyleReference, tokens: ThemeTokens): Style {
  if (isThemeStyleReferencePipeline(reference)) {
    return composeStyles(...reference.map((part) => resolveThemeStyleReference(part, tokens)));
  }
  return typeof reference === "string" ? tokens[reference] : reference;
}

export function resolveThemeStateDefinition(
  definition: ThemeStateDefinition = {},
  tokens: ThemeTokens,
): Partial<Theme> {
  const resolved: Partial<Theme> = {};
  for (const [state, reference] of Object.entries(definition) as [ThemeState, ThemeStyleReference][]) {
    if (reference === undefined) continue;
    resolved[state] = resolveThemeStyleReference(reference, tokens);
  }
  return resolved;
}

export function composeThemeOptions(...options: ThemeEngineOptions[]): ThemeEngineOptions {
  const tokens: Partial<ThemeTokens> = {};
  const components: Record<string, ComponentThemeDefinition> = {};

  for (const option of options) {
    Object.assign(tokens, option.tokens ?? {});
    for (const [name, definition] of Object.entries(option.components ?? {})) {
      components[name] = mergeComponentThemeDefinition(components[name], definition);
    }
  }

  return { tokens, components };
}

export function compileThemeManifestStyleReference(
  reference: ThemeManifestStyleReference,
): ThemeStyleReference {
  if (isThemeManifestStyleReferencePipeline(reference)) {
    return reference.map((part) => compileThemeManifestStyleReference(part));
  }
  return typeof reference === "string" ? reference as ThemeTokenName : createAnsiStyle(reference);
}

export function compileThemeManifestStateDefinition(
  definition: ThemeManifestStateDefinition = {},
): ThemeStateDefinition {
  const output: ThemeStateDefinition = {};
  for (const [state, reference] of Object.entries(definition) as [ThemeState, ThemeManifestStyleReference][]) {
    if (reference === undefined) continue;
    output[state] = compileThemeManifestStyleReference(reference);
  }
  return output;
}

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

export function themePackFromManifest(manifest: ThemePackManifest): ThemePack {
  return {
    id: manifest.id,
    label: manifest.label,
    palette: manifest.palette,
    options: compileThemeManifestOptions(manifest.options),
  };
}

export function createThemeEngineFromManifest(
  manifest: Pick<ThemePackManifest, "palette" | "options">,
  overrides: ThemeEngineOptions = {},
): ThemeEngine {
  return createThemeEngine(
    manifest.palette ?? "plain",
    composeThemeOptions(compileThemeManifestOptions(manifest.options), overrides),
  );
}

export function createThemeRegistryFromManifests(manifests: Iterable<ThemePackManifest>): ThemeRegistry {
  return createThemeRegistry([...manifests].map(themePackFromManifest));
}

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

export function validateThemeOptions(options: ThemeEngineOptions): ThemeValidationIssue[] {
  const normalized = composeThemeOptions(options);
  const components = normalized.components ?? {};
  const issues: ThemeValidationIssue[] = [];

  for (const [component, definition] of Object.entries(components)) {
    for (const parent of normalizeThemeExtends(definition.extends)) {
      if (!components[parent]) {
        issues.push({
          kind: "unknown-component",
          path: `components.${component}.extends`,
          component,
          reference: parent,
          message: `Theme component "${component}" extends unknown component "${parent}"`,
        });
      }
    }

    validateThemeStateDefinitionReferences(issues, definition.base, {
      component,
      path: `components.${component}.base`,
    });

    for (const [variant, states] of Object.entries(definition.variants ?? {})) {
      validateThemeStateDefinitionReferences(issues, states, {
        component,
        variant,
        path: `components.${component}.variants.${variant}`,
      });
    }
  }

  for (const cycle of findThemeInheritanceCycles(components)) {
    issues.push({
      kind: "inheritance-cycle",
      path: `components.${cycle[0]}.extends`,
      component: cycle[0],
      message: `Theme component inheritance cycle detected: ${cycle.join(" -> ")}`,
    });
  }

  return issues;
}

export function assertThemeOptions(options: ThemeEngineOptions): void {
  const issues = validateThemeOptions(options);
  if (issues.length > 0) {
    throw new ThemeValidationError(issues);
  }
}

export function diffThemeEngines(
  before: ThemeEngine,
  after: ThemeEngine,
  options: ThemeEngineDiffOptions = {},
): ThemeEngineDiff {
  const sample = options.sample ?? "Aa";
  const includeUnchanged = options.includeUnchanged ?? false;
  const tokenDiffs: ThemeTokenDiff[] = [];
  const componentDiffs: ThemeComponentStateDiff[] = [];

  for (const token of themeTokenNames) {
    const beforePreview = previewStyle(before.theme.tokens[token], sample);
    const afterPreview = previewStyle(after.theme.tokens[token], sample);
    if (includeUnchanged || beforePreview.styled !== afterPreview.styled) {
      tokenDiffs.push({ token, before: beforePreview, after: afterPreview });
    }
  }

  const componentNames = options.components
    ? [...options.components]
    : [...new Set([...before.componentNames(), ...after.componentNames()])].sort();

  for (const component of componentNames) {
    const variants = options.variants
      ? [...options.variants(component, [before, after])]
      : themeDiffVariants(component, before, after);
    for (const variant of variants) {
      const beforeTheme = before.component(component, variant);
      const afterTheme = after.component(component, variant);
      for (const state of themeStates) {
        const beforePreview = previewStyle(beforeTheme[state], sample);
        const afterPreview = previewStyle(afterTheme[state], sample);
        if (includeUnchanged || beforePreview.styled !== afterPreview.styled) {
          componentDiffs.push({ component, variant, state, before: beforePreview, after: afterPreview });
        }
      }
    }
  }

  return { sample, tokens: tokenDiffs, components: componentDiffs };
}

export function inspectThemeCoverage(
  options: ThemeEngineOptions,
  coverageOptions: ThemeCoverageOptions = {},
): ThemeCoverageInspection {
  const components = composeThemeOptions(options).components ?? {};
  const componentNames = coverageOptions.components
    ? [...new Set(coverageOptions.components)].sort()
    : Object.keys(components).sort();
  const componentCoverage = componentNames.map((name) =>
    inspectThemeComponentCoverage(name, components, coverageOptions)
  );
  const variantCount = componentCoverage.reduce((total, component) => total + component.variants.length, 0);
  const coveredStateCount = componentCoverage.reduce((total, component) => total + component.coveredStateCount, 0);
  const missingStateCount = componentCoverage.reduce((total, component) => total + component.missingStateCount, 0);

  return {
    componentCount: componentCoverage.length,
    variantCount,
    stateCount: variantCount * themeStates.length,
    coveredStateCount,
    missingStateCount,
    complete: componentCoverage.every((component) => component.complete),
    components: componentCoverage,
  };
}

export function createThemeEngine(
  palette: ThemePaletteReference = "plain",
  options: Omit<ThemeEngineOptions, "tokens"> & { tokens?: Partial<ThemeTokens> } = {},
): ThemeEngine {
  return createThemeEngineFromPalette(resolveThemePaletteTokens(palette), options);
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

export interface ThemePack {
  id: string;
  label?: string;
  description?: string;
  palette?: ThemePaletteReference;
  options?: ThemeEngineOptions;
}

export interface ThemePackManifest {
  id: string;
  label?: string;
  description?: string;
  palette?: ThemePaletteName;
  options?: ThemeManifestOptions;
}

export interface ThemePackInspection {
  id: string;
  label: string;
  palette: string;
  components: ThemeComponentInspection[];
}

export interface ThemeProviderInspection {
  activeId: string;
  themes: ThemePackInspection[];
  layers: ThemeLayerInspection[];
  engine: ThemeInspection;
}

export interface ThemeCatalogTheme extends ThemePackInspection {
  active: boolean;
}

export interface ThemeCatalogLayer extends ThemeLayerInspection {
  active: boolean;
}

export interface ThemeCatalogComponent extends ThemeComponentInspection {
  variants: string[];
}

export interface ThemeCatalog {
  activeId: string;
  tokens: ThemeTokenName[];
  states: ThemeState[];
  themes: ThemeCatalogTheme[];
  layers: ThemeCatalogLayer[];
  components: ThemeCatalogComponent[];
}

export class ThemeLayerStack {
  readonly options: Computed<ThemeEngineOptions>;
  readonly #layers = new Map<string, ThemeLayer>();
  readonly #enabled = new Set<string>();
  readonly #revision = new Signal(0);

  constructor(layers: Iterable<ThemeLayer> = []) {
    for (const layer of layers) {
      this.register(layer);
    }
    this.options = new Computed(() => {
      this.#revision.value;
      return composeThemeOptions(...this.activeLayers().map((layer) => layer.options));
    });
  }

  register(layer: ThemeLayer): this {
    const enabled = layer.enabled ?? (this.#enabled.has(layer.id) || !this.#layers.has(layer.id));
    this.#layers.set(layer.id, {
      ...layer,
      enabled,
      options: composeThemeOptions(layer.options),
    });
    if (enabled) {
      this.#enabled.add(layer.id);
    } else {
      this.#enabled.delete(layer.id);
    }
    this.#touch();
    return this;
  }

  unregister(id: string): boolean {
    const removed = this.#layers.delete(id);
    const disabled = this.#enabled.delete(id);
    if (removed || disabled) this.#touch();
    return removed;
  }

  has(id: string): boolean {
    return this.#layers.has(id);
  }

  get(id: string): ThemeLayer | undefined {
    const layer = this.#layers.get(id);
    return layer
      ? {
        ...layer,
        enabled: this.#enabled.has(id),
        options: composeThemeOptions(layer.options),
      }
      : undefined;
  }

  ids(): string[] {
    return [...this.#layers.keys()];
  }

  activeIds(): string[] {
    return this.ids().filter((id) => this.#enabled.has(id));
  }

  activeLayers(): ThemeLayer[] {
    return this.activeIds().map((id) => this.get(id)!);
  }

  setActiveIds(ids: Iterable<string>): string[] {
    const next = new Set(ids);
    let changed = false;

    for (const id of this.ids()) {
      const enabled = next.has(id);
      if (enabled && !this.#enabled.has(id)) {
        this.#enabled.add(id);
        changed = true;
      } else if (!enabled && this.#enabled.has(id)) {
        this.#enabled.delete(id);
        changed = true;
      }
    }

    if (changed) this.#touch();
    return this.activeIds();
  }

  setEnabled(id: string, enabled: boolean): boolean {
    if (!this.#layers.has(id)) return false;
    const changed = enabled ? !this.#enabled.has(id) : this.#enabled.has(id);
    if (!changed) return true;
    if (enabled) {
      this.#enabled.add(id);
    } else {
      this.#enabled.delete(id);
    }
    this.#touch();
    return true;
  }

  enable(id: string): boolean {
    return this.setEnabled(id, true);
  }

  disable(id: string): boolean {
    return this.setEnabled(id, false);
  }

  toggle(id: string): boolean {
    if (!this.#layers.has(id)) return false;
    return this.setEnabled(id, !this.#enabled.has(id));
  }

  compose(overrides: ThemeEngineOptions = {}): ThemeEngineOptions {
    return composeThemeOptions(overrides, this.options.peek());
  }

  inspect(): ThemeLayerInspection[] {
    return this.ids().map((id) => {
      const layer = this.#layers.get(id)!;
      return {
        id,
        label: layer.label ?? id,
        enabled: this.#enabled.has(id),
        components: new ThemeEngine(layer.options).inspect().components,
      };
    });
  }

  dispose(): void {
    this.options.dispose();
    this.#revision.dispose();
  }

  #touch(): void {
    this.#revision.value++;
  }
}

export class ThemeRegistry {
  readonly #packs = new Map<string, ThemePack>();

  constructor(packs: Iterable<ThemePack> = []) {
    for (const pack of packs) {
      this.register(pack);
    }
  }

  register(pack: ThemePack): this {
    this.#packs.set(pack.id, {
      ...pack,
      options: pack.options ? composeThemeOptions(pack.options) : undefined,
    });
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
        options: pack.options ? composeThemeOptions(pack.options) : undefined,
      }
      : undefined;
  }

  ids(): string[] {
    return [...this.#packs.keys()].sort();
  }

  engine(id: string, overrides: ThemeEngineOptions = {}): ThemeEngine {
    const pack = this.#packs.get(id);
    if (!pack) {
      throw new ThemePackNotFoundError(id);
    }

    return createThemeEngine(
      pack.palette ?? "plain",
      composeThemeOptions(pack.options ?? {}, overrides),
    );
  }

  inspect(): ThemePackInspection[] {
    return this.ids().map((id) => {
      const pack = this.#packs.get(id)!;
      return {
        id,
        label: pack.label ?? id,
        palette: themePaletteId(pack.palette ?? "plain"),
        components: this.engine(id).inspect().components,
      };
    });
  }
}

export class ThemePackNotFoundError extends Error {
  constructor(id: string) {
    super(`Theme pack "${id}" is not registered`);
    this.name = "ThemePackNotFoundError";
  }
}

export interface ThemeProviderOptions {
  registry?: ThemeRegistry;
  activeId?: string | Signal<string>;
  overrides?: ThemeEngineOptions;
  layers?: ThemeLayerStack | Iterable<ThemeLayer>;
  store?: AsyncStore<string>;
  storageKey?: string;
  onError?: (error: unknown) => void;
}

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

export const defaultThemePacks: ThemePack[] = [
  { id: "plain", label: "Plain", palette: "plain" },
  { id: "neon", label: "Neon", palette: "neon" },
  { id: "terminal", label: "Terminal", palette: "terminal" },
];

/** Returns the built-in palette definitions as registerable palette objects. */
export function defaultThemePaletteDefinitions(): ThemePalette[] {
  return (Object.entries(themePalettes) as [ThemePaletteName, Partial<ThemeTokens>][]).map(([id, tokens]) => ({
    id,
    label: titleCase(id),
    tokens,
  }));
}

/** Creates a palette registry with built-in palettes by default. */
export function createThemePaletteRegistry(
  palettes: Iterable<ThemePalette | ThemePaletteName> = defaultThemePaletteDefinitions(),
): ThemePaletteRegistry {
  return new ThemePaletteRegistry(palettes);
}

export function createThemeRegistry(packs: Iterable<ThemePack> = defaultThemePacks): ThemeRegistry {
  return new ThemeRegistry(packs);
}

export function createThemeLayerStack(layers: Iterable<ThemeLayer> = []): ThemeLayerStack {
  return new ThemeLayerStack(layers);
}

export function createThemeProvider(options: ThemeProviderOptions = {}): ThemeProvider {
  return new ThemeProvider(options);
}

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
  const report = createThemeProviderReport(provider, options);
  const lines = [`# ${report.title}`, ""];
  lines.push(
    `Active theme: ${report.activeId}. Active layers: ${report.activeLayers.join(", ") || "none"}.`,
    "",
  );
  lines.push(
    `${report.summary.themeCount} themes, ${report.summary.layerCount} layers, ${report.summary.componentCount} components, ${report.summary.variantCount} variants, ${report.summary.issueCount} issues.`,
    "",
  );

  lines.push("| Theme | Label | Palette | Active | Components |");
  lines.push("| --- | --- | --- | --- | ---: |");
  for (const theme of report.catalog.themes) {
    lines.push(
      `| ${escapeMarkdownCell(theme.id)} | ${escapeMarkdownCell(theme.label)} | ${
        escapeMarkdownCell(theme.palette)
      } | ${theme.active ? "yes" : "no"} | ${theme.components.length} |`,
    );
  }

  if (report.catalog.layers.length > 0) {
    lines.push("", "| Layer | Label | Active | Components |");
    lines.push("| --- | --- | --- | ---: |");
    for (const layer of report.catalog.layers) {
      lines.push(
        `| ${escapeMarkdownCell(layer.id)} | ${escapeMarkdownCell(layer.label)} | ${
          layer.active ? "yes" : "no"
        } | ${layer.components.length} |`,
      );
    }
  }

  if (report.issues.length > 0) {
    lines.push("", "| Issue | Source | Path | Message |");
    lines.push("| --- | --- | --- | --- |");
    for (const issue of report.issues) {
      lines.push(
        `| ${issue.kind} | ${issue.source}:${escapeMarkdownCell(issue.sourceId)} | ${
          escapeMarkdownCell(issue.path)
        } | ${escapeMarkdownCell(issue.message)} |`,
      );
    }
  }

  if (report.coverage) {
    lines.push("", "| Component | Variant | Complete | Missing States |");
    lines.push("| --- | --- | --- | --- |");
    for (const component of report.coverage.components) {
      for (const variant of component.variants) {
        lines.push(
          `| ${escapeMarkdownCell(component.name)} | ${escapeMarkdownCell(variant.name)} | ${
            variant.complete ? "yes" : "no"
          } | ${variant.missingStates.join(", ") || "-"} |`,
        );
      }
    }
  }

  return lines.join("\n");
}

export class ThemeEngine {
  readonly theme: Theme & { tokens: ThemeTokens };
  private readonly components: Record<string, ComponentThemeDefinition>;

  constructor(options: ThemeEngineOptions = {}) {
    this.theme = createTheme(options.tokens);
    this.components = composeThemeOptions({ components: options.components }).components ?? {};
  }

  component(componentName: string, variant = "default"): Theme {
    const definition = this.resolveComponentDefinition(componentName);
    return hierarchizeTheme({
      base: this.theme.base,
      focused: this.theme.focused,
      active: this.theme.active,
      disabled: this.theme.disabled,
      ...resolveThemeStateDefinition(definition?.base, this.theme.tokens),
      ...(variant === "default" ? {} : resolveThemeStateDefinition(definition?.variants?.[variant], this.theme.tokens)),
    });
  }

  resolve(componentName: string, state: ThemeState, variant = "default"): Style {
    return this.component(componentName, variant)[state];
  }

  extend(options: ThemeEngineOptions): ThemeEngine {
    return new ThemeEngine(composeThemeOptions({
      tokens: this.theme.tokens,
      components: this.components,
    }, options));
  }

  componentNames(): string[] {
    return Object.keys(this.components).sort();
  }

  variants(componentName: string): string[] {
    return Object.keys(this.resolveComponentDefinition(componentName).variants ?? {}).sort();
  }

  inspect(): ThemeInspection {
    return {
      tokens: [...themeTokenNames],
      components: this.componentNames().map((name) => ({
        name,
        variants: this.variants(name),
      })),
    };
  }

  private resolveComponentDefinition(
    componentName: string,
    seen = new Set<string>(),
  ): ComponentThemeDefinition {
    const definition = this.components[componentName];
    if (!definition) return {};
    if (seen.has(componentName)) {
      throw new ThemeInheritanceError([...seen, componentName]);
    }
    seen.add(componentName);

    let resolved: ComponentThemeDefinition = {};
    for (const parent of normalizeThemeExtends(definition.extends)) {
      resolved = mergeComponentThemeDefinition(
        resolved,
        this.resolveComponentDefinition(parent, new Set(seen)),
      );
    }

    return mergeComponentThemeDefinition(resolved, {
      base: definition.base,
      variants: definition.variants,
    });
  }
}

export class ThemeInheritanceError extends Error {
  constructor(chain: string[]) {
    super(`Theme component inheritance cycle detected: ${chain.join(" -> ")}`);
    this.name = "ThemeInheritanceError";
  }
}

export class ThemeValidationError extends Error {
  readonly issues: ThemeValidationIssue[];

  constructor(issues: ThemeValidationIssue[]) {
    super(`Theme options are invalid: ${issues.map((issue) => issue.message).join("; ")}`);
    this.name = "ThemeValidationError";
    this.issues = issues;
  }
}

function mergeThemeExtends(
  base: string | readonly string[] | undefined,
  extension: string | readonly string[] | undefined,
): string | readonly string[] | undefined {
  const names = [...normalizeThemeExtends(base), ...normalizeThemeExtends(extension)];
  return names.length === 0 ? undefined : [...new Set(names)];
}

function normalizeThemeExtends(value: string | readonly string[] | undefined): string[] {
  if (value === undefined) return [];
  return typeof value === "string" ? [value] : [...value];
}

function normalizeThemePalette(palette: ThemePalette | ThemePaletteName): ThemePalette {
  if (typeof palette === "string") {
    return {
      id: palette,
      label: titleCase(palette),
      tokens: { ...themePalettes[palette] },
    };
  }
  return {
    ...palette,
    tokens: { ...palette.tokens },
  };
}

function resolveThemePaletteTokens(palette: ThemePaletteReference): Partial<ThemeTokens> {
  return typeof palette === "string" ? themePalettes[palette] : palette.tokens;
}

function themePaletteId(palette: ThemePaletteReference): string {
  return typeof palette === "string" ? palette : palette.id;
}

function isThemeStyleReferencePipeline(
  reference: ThemeStyleReference,
): reference is readonly ThemeStyleReference[] {
  return Array.isArray(reference);
}

function isThemeManifestStyleReferencePipeline(
  reference: ThemeManifestStyleReference,
): reference is readonly ThemeManifestStyleReference[] {
  return Array.isArray(reference);
}

function validateThemeStateDefinitionReferences(
  issues: ThemeValidationIssue[],
  definition: ThemeStateDefinition | undefined,
  context: { component: string; variant?: string; path: string },
): void {
  for (const [state, reference] of Object.entries(definition ?? {}) as [ThemeState, ThemeStyleReference][]) {
    validateThemeStyleReference(issues, reference, {
      ...context,
      state,
      path: `${context.path}.${state}`,
    });
  }
}

function validateThemeStyleReference(
  issues: ThemeValidationIssue[],
  reference: ThemeStyleReference,
  context: { component: string; variant?: string; state: ThemeState; path: string },
): void {
  if (isThemeStyleReferencePipeline(reference)) {
    reference.forEach((part, index) =>
      validateThemeStyleReference(issues, part, {
        ...context,
        path: `${context.path}[${index}]`,
      })
    );
    return;
  }

  if (typeof reference !== "string" || themeTokenNames.includes(reference as ThemeTokenName)) return;

  issues.push({
    kind: "unknown-token",
    path: context.path,
    component: context.component,
    variant: context.variant,
    state: context.state,
    reference,
    message: `Theme state "${context.component}.${
      context.variant ? `${context.variant}.` : ""
    }${context.state}" references unknown token "${reference}"`,
  });
}

function findThemeInheritanceCycles(
  components: Record<string, ComponentThemeDefinition>,
): string[][] {
  const cycles: string[][] = [];
  const visited = new Set<string>();
  const visiting = new Set<string>();

  const visit = (component: string, path: string[]): void => {
    if (visiting.has(component)) {
      cycles.push([...path.slice(path.indexOf(component)), component]);
      return;
    }
    if (visited.has(component)) return;

    visiting.add(component);
    for (const parent of normalizeThemeExtends(components[component]?.extends)) {
      if (components[parent]) visit(parent, [...path, parent]);
    }
    visiting.delete(component);
    visited.add(component);
  };

  for (const component of Object.keys(components).sort()) {
    visit(component, [component]);
  }

  return cycles;
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

function themeDiffVariants(component: string, before: ThemeEngine, after: ThemeEngine): string[] {
  return [...new Set(["default", ...before.variants(component), ...after.variants(component)])].sort((a, b) => {
    if (a === "default") return -1;
    if (b === "default") return 1;
    return a.localeCompare(b);
  });
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

function escapeMarkdownCell(value: string): string {
  return value.replaceAll("|", "\\|").replaceAll("\n", " ");
}

function inspectThemeComponentCoverage(
  name: string,
  components: Record<string, ComponentThemeDefinition>,
  options: ThemeCoverageOptions,
): ThemeComponentCoverageInspection {
  const resolved = resolveThemeCoverageDefinition(name, components);
  const variants = coverageVariantNames(name, resolved, options).map((variant) => {
    const states = coveredThemeStates(resolved, variant);
    const missingStates = themeStates.filter((state) => !states.includes(state));
    return {
      name: variant,
      states,
      missingStates,
      complete: missingStates.length === 0,
    };
  });
  const coveredStateCount = variants.reduce((total, variant) => total + variant.states.length, 0);
  const missingStateCount = variants.reduce((total, variant) => total + variant.missingStates.length, 0);

  return {
    name,
    extends: normalizeThemeExtends(components[name]?.extends),
    variants,
    stateCount: variants.length * themeStates.length,
    coveredStateCount,
    missingStateCount,
    complete: variants.every((variant) => variant.complete),
  };
}

function resolveThemeCoverageDefinition(
  componentName: string,
  components: Record<string, ComponentThemeDefinition>,
  seen = new Set<string>(),
): ComponentThemeDefinition {
  const definition = components[componentName];
  if (!definition) return {};
  if (seen.has(componentName)) {
    throw new ThemeInheritanceError([...seen, componentName]);
  }
  seen.add(componentName);

  let resolved: ComponentThemeDefinition = {};
  for (const parent of normalizeThemeExtends(definition.extends)) {
    resolved = mergeComponentThemeDefinition(
      resolved,
      resolveThemeCoverageDefinition(parent, components, new Set(seen)),
    );
  }

  return mergeComponentThemeDefinition(resolved, {
    base: definition.base,
    variants: definition.variants,
  });
}

function coverageVariantNames(
  component: string,
  definition: ComponentThemeDefinition,
  options: ThemeCoverageOptions,
): string[] {
  const variants = options.variants
    ? [...options.variants(component, definition)]
    : Object.keys(definition.variants ?? {});
  return [...new Set(["default", ...variants])].sort((a, b) => {
    if (a === "default") return -1;
    if (b === "default") return 1;
    return a.localeCompare(b);
  });
}

function coveredThemeStates(definition: ComponentThemeDefinition, variant: string): ThemeState[] {
  const states = new Set<string>(Object.keys(definition.base ?? {}));
  if (variant !== "default") {
    for (const state of Object.keys(definition.variants?.[variant] ?? {})) {
      states.add(state);
    }
  }
  return sortedThemeStates(states);
}

function mergeThemeCatalogComponents(
  ...groups: readonly ThemeComponentInspection[][]
): ThemeCatalogComponent[] {
  const components = new Map<string, Set<string>>();

  for (const group of groups) {
    for (const component of group) {
      const variants = components.get(component.name) ?? new Set<string>(["default"]);
      variants.add("default");
      for (const variant of component.variants) variants.add(variant);
      components.set(component.name, variants);
    }
  }

  return [...components.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, variants]) => ({
      name,
      variants: [...variants].sort((a, b) => {
        if (a === "default") return -1;
        if (b === "default") return 1;
        return a.localeCompare(b);
      }),
    }));
}

function positiveModulo(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor;
}

function titleCase(value: string): string {
  return value.length === 0 ? value : `${value[0].toUpperCase()}${value.slice(1)}`;
}

function ansiStyleCodes(spec: AnsiStyleSpec): number[] {
  const codes: number[] = [];
  if (spec.bold) codes.push(1);
  if (spec.dim) codes.push(2);
  if (spec.italic) codes.push(3);
  if (spec.underline) codes.push(4);
  if (spec.inverse) codes.push(7);
  if (spec.strikethrough) codes.push(9);
  if (spec.foreground !== undefined) codes.push(...ansiColorCodes(spec.foreground, false));
  if (spec.background !== undefined) codes.push(...ansiColorCodes(spec.background, true));
  return codes;
}

function ansiColorCodes(color: AnsiColor, background: boolean): number[] {
  if (typeof color === "number") {
    return [background ? 48 : 38, 5, clampAnsiByte(color)];
  }

  if (typeof color !== "string") {
    return [background ? 48 : 38, 2, ...color.map(clampAnsiByte)];
  }

  return [ansiNamedColorCode(color, background)];
}

function ansiNamedColorCode(color: AnsiColorName, background: boolean): number {
  const index = ANSI_COLOR_NAMES.indexOf(color);
  const base = background ? 40 : 30;
  return index < 8 ? base + index : base + 60 + index - 8;
}

function clampAnsiByte(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)));
}
