// Copyright 2023 Im-Beast. MIT license.
import { AsyncScheduler, runTaskBatch, type ScheduledTaskOptions } from "./runtime/scheduler.ts";
import { OrderedIdCollection, orderedSubset, sortedSetValues } from "./utils/collections.ts";
import { isAsciiWhitespaceCharacter } from "./utils/formatting.ts";
import {
  composeThemeOptions,
  createThemeEngine,
  type ThemeEngine,
  type ThemeEngineOptions,
  type ThemePaletteReference,
  type ThemeTokenName,
  themeTokenNames,
  type ThemeValidationIssue,
  validateThemeOptions,
} from "./theme.ts";

/** Serializable definition for constructing reusable theme engines. */
export interface ThemeEngineFactoryDefinition {
  id: string;
  label?: string;
  description?: string;
  palette?: ThemePaletteReference;
  options?: ThemeEngineOptions;
  tags?: readonly string[];
  priority?: number;
}

/** Normalized factory metadata for catalogs, settings panes, and inspectors. */
export interface ThemeEngineFactoryInspection {
  id: string;
  label: string;
  description?: string;
  palette: string;
  tags: string[];
  priority: number;
  tokenOverrides: ThemeTokenName[];
  components: string[];
  variants: Record<string, string[]>;
  issues: ThemeValidationIssue[];
  valid: boolean;
}

/** Built theme engine plus the factory metadata that produced it. */
export interface ThemeEngineFactoryBuildResult {
  id: string;
  engine: ThemeEngine;
  inspection: ThemeEngineFactoryInspection;
}

/** Options for asynchronously prewarming one or more theme engines. */
export interface ThemeEnginePrewarmOptions extends ScheduledTaskOptions {
  scheduler?: AsyncScheduler;
  ids?: Iterable<string>;
  overrides?: ThemeEngineOptions | ((id: string, factory: ThemeEngineFactory) => ThemeEngineOptions);
}

/** Query filters for searchable theme engine factory catalogs. */
export interface ThemeEngineFactoryCatalogQuery {
  search?: string;
  tag?: string;
  palette?: string;
  valid?: boolean;
  hasComponents?: boolean;
  hasTokenOverrides?: boolean;
}

/** Aggregate metadata for theme engine factory catalogs. */
export interface ThemeEngineFactoryCatalogInspection {
  count: number;
  valid: number;
  invalid: number;
  palettes: string[];
  tags: string[];
  components: string[];
  tokenOverrides: ThemeTokenName[];
}

/** Searchable catalog report for settings panes, docs, and marketplaces. */
export interface ThemeEngineFactoryCatalogReport {
  factories: ThemeEngineFactoryInspection[];
  inspection: ThemeEngineFactoryCatalogInspection;
}

/** Options for configuring theme Engine Factory Catalog Report. */
export interface ThemeEngineFactoryCatalogReportOptions {
  factories: Iterable<ThemeEngineFactory | ThemeEngineFactoryDefinition>;
  query?: ThemeEngineFactoryCatalogQuery;
}

/** Options for configuring theme Engine Factory Catalog Markdown. */
export interface ThemeEngineFactoryCatalogMarkdownOptions extends ThemeEngineFactoryCatalogReportOptions {
  title?: string;
  includeSummary?: boolean;
}

/** Reusable theme engine preset that can validate, inspect, and build engines. */
export class ThemeEngineFactory {
  readonly id: string;
  readonly label: string;
  readonly description?: string;
  readonly palette: ThemePaletteReference;
  readonly tags: readonly string[];
  readonly priority: number;
  readonly options: ThemeEngineOptions;

  /** Creates a normalized factory from a definition object. */
  constructor(definition: ThemeEngineFactoryDefinition) {
    this.id = definition.id;
    this.label = definition.label ?? definition.id;
    this.description = definition.description;
    this.palette = definition.palette ?? "plain";
    this.tags = [...new Set(definition.tags ?? [])].sort();
    this.priority = definition.priority ?? 0;
    this.options = composeThemeOptions(definition.options ?? {});
  }

  /** Builds a theme engine with optional per-app overrides. */
  build(overrides: ThemeEngineOptions = {}): ThemeEngine {
    return createThemeEngine(this.palette, composeThemeOptions(this.options, overrides));
  }

  /** Validates the factory's theme options without building a provider. */
  validate(): ThemeValidationIssue[] {
    return validateThemeOptions(this.options);
  }

  /** Returns serializable metadata for UI catalogs and diagnostics. */
  inspect(): ThemeEngineFactoryInspection {
    const components = this.options.components ?? {};
    const variants: Record<string, string[]> = {};
    for (const [component, definition] of Object.entries(components).sort(([a], [b]) => a.localeCompare(b))) {
      variants[component] = Object.keys(definition.variants ?? {}).sort();
    }

    const issues = this.validate();
    return {
      id: this.id,
      label: this.label,
      description: this.description,
      palette: themePaletteId(this.palette),
      tags: [...this.tags],
      priority: this.priority,
      tokenOverrides: orderedSubset(Object.keys(this.options.tokens ?? {}), themeTokenNames),
      components: Object.keys(components).sort(),
      variants,
      issues,
      valid: issues.length === 0,
    };
  }
}

/** Ordered registry for theme engine factories supplied by apps or plugins. */
export class ThemeEngineFactoryRegistry {
  readonly #factories = new OrderedIdCollection<ThemeEngineFactory>(compareThemeEngineFactories);

  /** Creates a registry and optionally registers initial factories. */
  constructor(factories: Iterable<ThemeEngineFactory | ThemeEngineFactoryDefinition> = []) {
    for (const factory of factories) {
      this.register(factory);
    }
  }

  /** Registers or replaces a factory by id. */
  register(factory: ThemeEngineFactory | ThemeEngineFactoryDefinition): this {
    const normalized = factory instanceof ThemeEngineFactory ? factory : createThemeEngineFactory(factory);
    this.#factories.set(normalized);
    return this;
  }

  /** Removes a factory by id. */
  unregister(id: string): boolean {
    return this.#factories.delete(id);
  }

  /** Returns whether a factory id is registered. */
  has(id: string): boolean {
    return this.#factories.has(id);
  }

  /** Looks up a factory by id. */
  get(id: string): ThemeEngineFactory | undefined {
    return this.#factories.get(id);
  }

  /** Returns factory ids in priority order. */
  ids(): string[] {
    return this.#factories.ids();
  }

  /** Returns factories sorted by priority and id. */
  factories(): ThemeEngineFactory[] {
    return Array.from(this.#factories.ordered());
  }

  /** Returns serializable inspections for all factories. */
  inspect(): ThemeEngineFactoryInspection[] {
    return inspectThemeEngineFactories(this.#factories.ordered());
  }

  /** Returns a filtered catalog report for settings panes, docs, and marketplaces. */
  catalog(query: ThemeEngineFactoryCatalogQuery = {}): ThemeEngineFactoryCatalogReport {
    return createThemeEngineFactoryCatalogReport({ factories: this.#factories.ordered(), query });
  }

  /** Builds one registered factory by id. */
  build(id: string, overrides: ThemeEngineOptions = {}): ThemeEngine {
    const factory = this.get(id);
    if (!factory) {
      throw new ThemeEngineFactoryNotFoundError(id);
    }
    return factory.build(overrides);
  }

  /** Builds registered factories through the scheduler for startup prewarming. */
  prewarm(options: ThemeEnginePrewarmOptions = {}): Promise<ThemeEngineFactoryBuildResult[]> {
    const requested = options.ids ? new Set(options.ids) : undefined;
    const sorted = this.#factories.ordered();
    const factories: ThemeEngineFactory[] = [];
    for (const factory of sorted) {
      if (!requested || requested.has(factory.id)) factories.push(factory);
    }
    return prewarmThemeEngines(factories, options);
  }
}

/** Error thrown when a registry build targets an unknown factory id. */
export class ThemeEngineFactoryNotFoundError extends Error {
  constructor(id: string) {
    super(`Theme engine factory "${id}" is not registered`);
    this.name = "ThemeEngineFactoryNotFoundError";
  }
}

/** Creates a normalized theme engine factory. */
export function createThemeEngineFactory(definition: ThemeEngineFactoryDefinition): ThemeEngineFactory {
  return new ThemeEngineFactory(definition);
}

/** Creates an ordered registry for theme engine factories. */
export function createThemeEngineFactoryRegistry(
  factories: Iterable<ThemeEngineFactory | ThemeEngineFactoryDefinition> = [],
): ThemeEngineFactoryRegistry {
  return new ThemeEngineFactoryRegistry(factories);
}

/** Filters and ranks theme engine factory inspections for searchable UIs. */
export function queryThemeEngineFactories(
  factories: Iterable<ThemeEngineFactory | ThemeEngineFactoryDefinition>,
  query: ThemeEngineFactoryCatalogQuery = {},
): ThemeEngineFactoryInspection[] {
  const matches: ThemeEngineFactoryInspection[] = [];
  for (const factory of normalizeFactories(factories)) {
    const inspection = factory.inspect();
    if (matchesFactoryQuery(inspection, query)) matches.push(inspection);
  }
  return matches.sort(compareThemeEngineFactoryInspections);
}

/** Aggregates factory catalog metadata for diagnostics and settings screens. */
export function inspectThemeEngineFactoryCatalog(
  factories: readonly ThemeEngineFactoryInspection[],
): ThemeEngineFactoryCatalogInspection {
  let valid = 0;
  const palettes = new Set<string>();
  const tags = new Set<string>();
  const components = new Set<string>();
  const tokenOverrides = new Set<string>();
  for (const factory of factories) {
    if (factory.valid) valid += 1;
    if (factory.palette) palettes.add(factory.palette);
    for (const tag of factory.tags) tags.add(tag);
    for (const component of factory.components) components.add(component);
    for (const token of factory.tokenOverrides) tokenOverrides.add(token);
  }
  return {
    count: factories.length,
    valid,
    invalid: factories.length - valid,
    palettes: sortedSetValues(palettes),
    tags: sortedSetValues(tags),
    components: sortedSetValues(components),
    tokenOverrides: orderedSubset(tokenOverrides, themeTokenNames),
  };
}

/** Creates a filtered theme engine factory catalog report. */
export function createThemeEngineFactoryCatalogReport(
  options: ThemeEngineFactoryCatalogReportOptions,
): ThemeEngineFactoryCatalogReport {
  const factories = queryThemeEngineFactories(options.factories, options.query);
  return {
    factories,
    inspection: inspectThemeEngineFactoryCatalog(factories),
  };
}

/** Formats a factory catalog report as compact markdown for generated docs. */
export function formatThemeEngineFactoryCatalogMarkdown(
  options: ThemeEngineFactoryCatalogMarkdownOptions,
): string {
  const report = createThemeEngineFactoryCatalogReport(options);
  const lines = [`# ${options.title ?? "Theme Engine Factories"}`, ""];
  if (options.includeSummary ?? true) {
    lines.push(
      `${report.inspection.count} factories, ${report.inspection.valid} valid, ${report.inspection.invalid} invalid.`,
      "",
    );
  }
  lines.push("| Factory | Palette | Priority | Tags | Components | Valid |");
  lines.push("| --- | --- | ---: | --- | ---: | --- |");
  for (const factory of report.factories) {
    lines.push(
      `| ${factory.label} | ${factory.palette} | ${factory.priority} | ${
        factory.tags.join(", ") || "-"
      } | ${factory.components.length} | ${factory.valid ? "yes" : "no"} |`,
    );
  }
  return lines.join("\n");
}

/** Builds a list of factories through an optional scheduler while preserving result order. */
export async function prewarmThemeEngines(
  factories: readonly ThemeEngineFactory[],
  options: Omit<ThemeEnginePrewarmOptions, "ids"> = {},
): Promise<ThemeEngineFactoryBuildResult[]> {
  const scheduler = options.scheduler ?? new AsyncScheduler();
  const results = await runTaskBatch(factories, {
    scheduler,
    priority: options.priority,
    signal: options.signal,
    task: (factory) => {
      const overrides = typeof options.overrides === "function"
        ? options.overrides(factory.id, factory)
        : options.overrides ?? {};
      return {
        id: factory.id,
        engine: factory.build(overrides),
        inspection: factory.inspect(),
      };
    },
  });

  const values = new Array<ThemeEngineFactoryBuildResult>(results.length);
  for (let index = 0; index < results.length; index += 1) {
    values[index] = results[index]!.value;
  }
  return values;
}

function themePaletteId(palette: ThemePaletteReference): string {
  return typeof palette === "string" ? palette : palette.id;
}

function normalizeFactories(
  factories: Iterable<ThemeEngineFactory | ThemeEngineFactoryDefinition>,
): ThemeEngineFactory[] {
  const normalized: ThemeEngineFactory[] = [];
  for (const factory of factories) {
    normalized.push(factory instanceof ThemeEngineFactory ? factory : createThemeEngineFactory(factory));
  }
  return normalized;
}

function matchesFactoryQuery(
  factory: ThemeEngineFactoryInspection,
  query: ThemeEngineFactoryCatalogQuery,
): boolean {
  if (query.tag && !factory.tags.includes(query.tag)) return false;
  if (query.palette && factory.palette !== query.palette) return false;
  if (query.valid !== undefined && factory.valid !== query.valid) return false;
  if (query.hasComponents !== undefined && (factory.components.length > 0) !== query.hasComponents) return false;
  if (
    query.hasTokenOverrides !== undefined &&
    (factory.tokenOverrides.length > 0) !== query.hasTokenOverrides
  ) return false;
  if (!query.search) return true;
  return factoryMatchesSearch(factory, query.search);
}

function inspectThemeEngineFactories(factories: readonly ThemeEngineFactory[]): ThemeEngineFactoryInspection[] {
  const inspections = new Array<ThemeEngineFactoryInspection>(factories.length);
  for (let index = 0; index < factories.length; index += 1) {
    inspections[index] = factories[index]!.inspect();
  }
  return inspections;
}

function compareThemeEngineFactoryInspections(
  left: ThemeEngineFactoryInspection,
  right: ThemeEngineFactoryInspection,
): number {
  return right.priority - left.priority || left.label.localeCompare(right.label);
}

function compareThemeEngineFactories(left: ThemeEngineFactory, right: ThemeEngineFactory): number {
  return right.priority - left.priority || left.id.localeCompare(right.id);
}

function factoryMatchesSearch(factory: ThemeEngineFactoryInspection, search: string): boolean {
  let start = -1;
  const normalized = search.toLowerCase();
  for (let index = 0; index <= normalized.length; index += 1) {
    const char = index < normalized.length ? normalized[index] : " ";
    if (char !== undefined && !isAsciiWhitespaceCharacter(char)) {
      if (start < 0) start = index;
      continue;
    }
    if (start < 0) continue;
    if (!factoryIncludesSearchPart(factory, normalized.slice(start, index))) return false;
    start = -1;
  }
  return true;
}

function factoryIncludesSearchPart(factory: ThemeEngineFactoryInspection, part: string): boolean {
  if (factory.id.toLowerCase().includes(part)) return true;
  if (factory.label.toLowerCase().includes(part)) return true;
  if (factory.description?.toLowerCase().includes(part)) return true;
  if (factory.palette.toLowerCase().includes(part)) return true;
  for (const tag of factory.tags) {
    if (tag.toLowerCase().includes(part)) return true;
  }
  for (const component of factory.components) {
    if (component.toLowerCase().includes(part)) return true;
  }
  for (const token of factory.tokenOverrides) {
    if (token.toLowerCase().includes(part)) return true;
  }
  for (const variant in factory.variants) {
    const states = factory.variants[variant]!;
    for (const state of states) {
      if (state.toLowerCase().includes(part)) return true;
    }
  }
  return false;
}
