// Copyright 2023 Im-Beast. MIT license.
import { AsyncScheduler, runTaskBatch, type ScheduledTaskOptions } from "./runtime/scheduler.ts";
import {
  composeThemeOptions,
  createThemeEngine,
  type ThemeEngine,
  type ThemeEngineOptions,
  type ThemePaletteName,
  type ThemeTokenName,
  themeTokenNames,
  type ThemeValidationIssue,
  validateThemeOptions,
} from "./theme.ts";

export interface ThemeEngineFactoryDefinition {
  id: string;
  label?: string;
  description?: string;
  palette?: ThemePaletteName;
  options?: ThemeEngineOptions;
  tags?: readonly string[];
  priority?: number;
}

export interface ThemeEngineFactoryInspection {
  id: string;
  label: string;
  description?: string;
  palette: ThemePaletteName;
  tags: string[];
  priority: number;
  tokenOverrides: ThemeTokenName[];
  components: string[];
  variants: Record<string, string[]>;
  issues: ThemeValidationIssue[];
  valid: boolean;
}

export interface ThemeEngineFactoryBuildResult {
  id: string;
  engine: ThemeEngine;
  inspection: ThemeEngineFactoryInspection;
}

export interface ThemeEnginePrewarmOptions extends ScheduledTaskOptions {
  scheduler?: AsyncScheduler;
  ids?: Iterable<string>;
  overrides?: ThemeEngineOptions | ((id: string, factory: ThemeEngineFactory) => ThemeEngineOptions);
}

export class ThemeEngineFactory {
  readonly id: string;
  readonly label: string;
  readonly description?: string;
  readonly palette: ThemePaletteName;
  readonly tags: readonly string[];
  readonly priority: number;
  readonly options: ThemeEngineOptions;

  constructor(definition: ThemeEngineFactoryDefinition) {
    this.id = definition.id;
    this.label = definition.label ?? definition.id;
    this.description = definition.description;
    this.palette = definition.palette ?? "plain";
    this.tags = [...new Set(definition.tags ?? [])].sort();
    this.priority = definition.priority ?? 0;
    this.options = composeThemeOptions(definition.options ?? {});
  }

  build(overrides: ThemeEngineOptions = {}): ThemeEngine {
    return createThemeEngine(this.palette, composeThemeOptions(this.options, overrides));
  }

  validate(): ThemeValidationIssue[] {
    return validateThemeOptions(this.options);
  }

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
      palette: this.palette,
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

export class ThemeEngineFactoryRegistry {
  readonly #factories = new Map<string, ThemeEngineFactory>();

  constructor(factories: Iterable<ThemeEngineFactory | ThemeEngineFactoryDefinition> = []) {
    for (const factory of factories) {
      this.register(factory);
    }
  }

  register(factory: ThemeEngineFactory | ThemeEngineFactoryDefinition): this {
    const normalized = factory instanceof ThemeEngineFactory ? factory : createThemeEngineFactory(factory);
    this.#factories.set(normalized.id, normalized);
    return this;
  }

  unregister(id: string): boolean {
    return this.#factories.delete(id);
  }

  has(id: string): boolean {
    return this.#factories.has(id);
  }

  get(id: string): ThemeEngineFactory | undefined {
    return this.#factories.get(id);
  }

  ids(): string[] {
    return this.factories().map((factory) => factory.id);
  }

  factories(): ThemeEngineFactory[] {
    return [...this.#factories.values()].sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id));
  }

  inspect(): ThemeEngineFactoryInspection[] {
    return this.factories().map((factory) => factory.inspect());
  }

  build(id: string, overrides: ThemeEngineOptions = {}): ThemeEngine {
    const factory = this.get(id);
    if (!factory) {
      throw new ThemeEngineFactoryNotFoundError(id);
    }
    return factory.build(overrides);
  }

  prewarm(options: ThemeEnginePrewarmOptions = {}): Promise<ThemeEngineFactoryBuildResult[]> {
    const requested = options.ids ? new Set(options.ids) : undefined;
    const factories = this.factories().filter((factory) => !requested || requested.has(factory.id));
    return prewarmThemeEngines(factories, options);
  }
}

export class ThemeEngineFactoryNotFoundError extends Error {
  constructor(id: string) {
    super(`Theme engine factory "${id}" is not registered`);
    this.name = "ThemeEngineFactoryNotFoundError";
  }
}

export function createThemeEngineFactory(definition: ThemeEngineFactoryDefinition): ThemeEngineFactory {
  return new ThemeEngineFactory(definition);
}

export function createThemeEngineFactoryRegistry(
  factories: Iterable<ThemeEngineFactory | ThemeEngineFactoryDefinition> = [],
): ThemeEngineFactoryRegistry {
  return new ThemeEngineFactoryRegistry(factories);
}

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
