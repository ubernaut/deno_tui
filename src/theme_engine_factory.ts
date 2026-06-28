// Copyright 2023 Im-Beast. MIT license.
import { AsyncScheduler, runTaskBatch, type ScheduledTaskOptions } from "./runtime/scheduler.ts";
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

export interface ThemeEngineFactoryCatalogReportOptions {
  factories: Iterable<ThemeEngineFactory | ThemeEngineFactoryDefinition>;
  query?: ThemeEngineFactoryCatalogQuery;
}

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
      tokenOverrides: sortedThemeTokens(Object.keys(this.options.tokens ?? {})),
      components: Object.keys(components).sort(),
      variants,
      issues,
      valid: issues.length === 0,
    };
  }
}

/** Ordered registry for theme engine factories supplied by apps or plugins. */
export class ThemeEngineFactoryRegistry {
  readonly #factories = new Map<string, ThemeEngineFactory>();

  /** Creates a registry and optionally registers initial factories. */
  constructor(factories: Iterable<ThemeEngineFactory | ThemeEngineFactoryDefinition> = []) {
    for (const factory of factories) {
      this.register(factory);
    }
  }

  /** Registers or replaces a factory by id. */
  register(factory: ThemeEngineFactory | ThemeEngineFactoryDefinition): this {
    const normalized = factory instanceof ThemeEngineFactory ? factory : createThemeEngineFactory(factory);
    this.#factories.set(normalized.id, normalized);
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
    return this.factories().map((factory) => factory.id);
  }

  /** Returns factories sorted by priority and id. */
  factories(): ThemeEngineFactory[] {
    return [...this.#factories.values()].sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id));
  }

  /** Returns serializable inspections for all factories. */
  inspect(): ThemeEngineFactoryInspection[] {
    return this.factories().map((factory) => factory.inspect());
  }

  /** Returns a filtered catalog report for settings panes, docs, and marketplaces. */
  catalog(query: ThemeEngineFactoryCatalogQuery = {}): ThemeEngineFactoryCatalogReport {
    return createThemeEngineFactoryCatalogReport({ factories: this.factories(), query });
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
    const factories = this.factories().filter((factory) => !requested || requested.has(factory.id));
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
  return normalizeFactories(factories)
    .map((factory) => factory.inspect())
    .filter((factory) => matchesFactoryQuery(factory, query))
    .sort((left, right) => right.priority - left.priority || left.label.localeCompare(right.label));
}

/** Aggregates factory catalog metadata for diagnostics and settings screens. */
export function inspectThemeEngineFactoryCatalog(
  factories: readonly ThemeEngineFactoryInspection[],
): ThemeEngineFactoryCatalogInspection {
  return {
    count: factories.length,
    valid: factories.filter((factory) => factory.valid).length,
    invalid: factories.filter((factory) => !factory.valid).length,
    palettes: uniqueSorted(factories.map((factory) => factory.palette)),
    tags: uniqueSorted(factories.flatMap((factory) => factory.tags)),
    components: uniqueSorted(factories.flatMap((factory) => factory.components)),
    tokenOverrides: sortedThemeTokens(factories.flatMap((factory) => factory.tokenOverrides)),
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

  return results.map((result) => result.value);
}

function sortedThemeTokens(values: Iterable<string>): ThemeTokenName[] {
  const requested = new Set(values);
  return themeTokenNames.filter((token) => requested.has(token));
}

function themePaletteId(palette: ThemePaletteReference): string {
  return typeof palette === "string" ? palette : palette.id;
}

function normalizeFactories(
  factories: Iterable<ThemeEngineFactory | ThemeEngineFactoryDefinition>,
): ThemeEngineFactory[] {
  return [...factories].map((factory) =>
    factory instanceof ThemeEngineFactory ? factory : createThemeEngineFactory(factory)
  );
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
  const needle = query.search.trim().toLowerCase();
  if (!needle) return true;
  const haystack = [
    factory.id,
    factory.label,
    factory.description,
    factory.palette,
    ...factory.tags,
    ...factory.components,
    ...factory.tokenOverrides,
    ...Object.values(factory.variants).flat(),
  ].join(" ").toLowerCase();
  return needle.split(/\s+/).every((part) => haystack.includes(part));
}

function uniqueSorted(values: Iterable<string | undefined>): string[] {
  return [...new Set([...values].filter((value): value is string => !!value))].sort();
}
