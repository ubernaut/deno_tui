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

export type ThemePaletteName = "plain" | "neon" | "terminal";

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

export function createThemeEngine(
  palette: ThemePaletteName = "plain",
  options: Omit<ThemeEngineOptions, "tokens"> & { tokens?: Partial<ThemeTokens> } = {},
): ThemeEngine {
  return new ThemeEngine({
    ...options,
    tokens: {
      ...themePalettes[palette],
      ...(options.tokens ?? {}),
    },
  });
}

export interface ThemePack {
  id: string;
  label?: string;
  palette?: ThemePaletteName;
  options?: ThemeEngineOptions;
}

export interface ThemePackInspection {
  id: string;
  label: string;
  palette: ThemePaletteName;
  components: ThemeComponentInspection[];
}

export interface ThemeProviderInspection {
  activeId: string;
  themes: ThemePackInspection[];
  layers: ThemeLayerInspection[];
  engine: ThemeInspection;
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
        palette: pack.palette ?? "plain",
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
    this.engine = new Computed(() =>
      this.registry.engine(
        this.activeId.value,
        composeThemeOptions(this.#overrides, this.layers.options.value),
      )
    );
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

export function createThemeRegistry(packs: Iterable<ThemePack> = defaultThemePacks): ThemeRegistry {
  return new ThemeRegistry(packs);
}

export function createThemeLayerStack(layers: Iterable<ThemeLayer> = []): ThemeLayerStack {
  return new ThemeLayerStack(layers);
}

export function createThemeProvider(options: ThemeProviderOptions = {}): ThemeProvider {
  return new ThemeProvider(options);
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

function isThemeStyleReferencePipeline(
  reference: ThemeStyleReference,
): reference is readonly ThemeStyleReference[] {
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

function themeDiffVariants(component: string, before: ThemeEngine, after: ThemeEngine): string[] {
  return [...new Set(["default", ...before.variants(component), ...after.variants(component)])].sort((a, b) => {
    if (a === "default") return -1;
    if (b === "default") return 1;
    return a.localeCompare(b);
  });
}

function positiveModulo(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor;
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
