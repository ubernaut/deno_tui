// Copyright 2023 Im-Beast. MIT license.
import type { ThemeEngineOptions, ThemeInspection } from "../theme.ts";
import {
  formatThemeEngineFactoryCatalogMarkdown,
  type ThemeEngineFactoryCatalogQuery,
  type ThemeEngineFactoryCatalogReport,
  type ThemeEngineFactoryCatalogReportOptions,
  type ThemeEngineFactoryInspection,
  type ThemeEngineFactoryRegistry,
} from "../theme_engine_factory.ts";
import type { ThemeWorkspace } from "../theme_workspace.ts";
import type { Action } from "./actions.ts";
import type { Command, CommandRegistry } from "./commands.ts";

/** Action union emitted by theme Engine Command command helpers. */
export type ThemeEngineCommandAction =
  | Action<"theme.engine.previewed", ThemeEnginePreviewPayload>
  | Action<"theme.engine.catalog.reported", ThemeEngineCatalogPayload>;

/** Payload carried by theme Engine Preview actions. */
export interface ThemeEnginePreviewPayload {
  id: string;
  inspection: ThemeEngineFactoryInspection;
  engine: ThemeInspection;
}

/** Payload carried by theme Engine Catalog actions. */
export interface ThemeEngineCatalogPayload {
  report: ThemeEngineFactoryCatalogReport;
  markdown?: string;
}

/** Options for configuring theme Engine Command. */
export interface ThemeEngineCommandOptions {
  group?: string;
  prefix?: string;
  includeFactoryCommands?: boolean;
  includeCatalogCommand?: boolean;
  disableInvalidFactories?: boolean;
  disableEmptyCatalog?: boolean;
  query?: ThemeEngineFactoryCatalogQuery;
  title?: string;
  includeMarkdown?: boolean;
  overrides?: ThemeEngineOptions;
  pipelines?: Iterable<string> | false;
}

/** Public type alias for a theme Engine Command Source. */
export type ThemeEngineCommandSource = ThemeWorkspace | ThemeEngineFactoryRegistry;

/** Builds command definitions for theme Engine. */
export function themeEngineCommands(
  source: ThemeEngineCommandSource,
  options: ThemeEngineCommandOptions = {},
): Command<ThemeEngineCommandAction>[] {
  return [
    ...themeEngineFactoryCommands(source, options),
    ...themeEngineCatalogCommands(source, options),
  ];
}

/** Binds theme Engine Commands behavior and returns a disposer when applicable. */
export function bindThemeEngineCommands<TAction extends Action = ThemeEngineCommandAction>(
  registry: CommandRegistry<TAction>,
  source: ThemeEngineCommandSource,
  options: ThemeEngineCommandOptions = {},
): () => void {
  return registry.registerAll(themeEngineCommands(source, options) as unknown as Command<TAction>[]);
}

/** Builds command definitions for theme Engine Factory. */
export function themeEngineFactoryCommands(
  source: ThemeEngineCommandSource,
  options: ThemeEngineCommandOptions = {},
): Command<ThemeEngineCommandAction>[] {
  if (!(options.includeFactoryCommands ?? true)) return [];

  const registry = factoryRegistry(source);
  const group = options.group ?? "theme";
  const prefix = options.prefix ?? "theme.engine";

  return registry.inspect().map((factory) => ({
    id: `${prefix}.preview.${factory.id}`,
    label: `Theme Engine: ${factory.label}`,
    description: factory.description ?? `Preview the ${factory.label} theme engine.`,
    group,
    keywords: [
      "theme",
      "engine",
      "factory",
      "preview",
      factory.id,
      factory.label,
      factory.palette,
      ...factory.tags,
      ...factory.components,
      ...Object.values(factory.variants).flat(),
    ],
    disabled: options.disableInvalidFactories ?? true ? () => !registry.get(factory.id)?.inspect().valid : false,
    action: () => {
      const engine = buildFactoryEngine(source, factory.id, options);
      return {
        type: "theme.engine.previewed",
        payload: {
          id: factory.id,
          inspection: registry.get(factory.id)?.inspect() ?? factory,
          engine: engine.inspect(),
        },
      };
    },
  }));
}

/** Builds command definitions for theme Engine Catalog. */
export function themeEngineCatalogCommands(
  source: ThemeEngineCommandSource,
  options: ThemeEngineCommandOptions = {},
): Command<ThemeEngineCommandAction>[] {
  if (!(options.includeCatalogCommand ?? true)) return [];

  const registry = factoryRegistry(source);
  const group = options.group ?? "theme";
  const prefix = options.prefix ?? "theme.engine";
  return [
    {
      id: `${prefix}.catalog`,
      label: "Theme Engine Catalog",
      description: "Capture the registered theme engine factory catalog.",
      group,
      keywords: ["theme", "engine", "factory", "catalog", "palette", "preset"],
      disabled: options.disableEmptyCatalog ?? true
        ? () => registry.catalog(options.query).inspection.count === 0
        : false,
      action: () => {
        const report = registry.catalog(options.query);
        return {
          type: "theme.engine.catalog.reported",
          payload: {
            report,
            markdown: options.includeMarkdown ?? true
              ? formatThemeEngineFactoryCatalogMarkdown(markdownOptions(source, options))
              : undefined,
          },
        };
      },
    },
  ];
}

function factoryRegistry(source: ThemeEngineCommandSource): ThemeEngineFactoryRegistry {
  return isThemeWorkspace(source) ? source.factories : source;
}

function buildFactoryEngine(
  source: ThemeEngineCommandSource,
  id: string,
  options: Pick<ThemeEngineCommandOptions, "overrides" | "pipelines">,
) {
  if (isThemeWorkspace(source)) {
    return source.factoryEngine(id, { overrides: options.overrides, pipelines: options.pipelines });
  }
  return source.build(id, options.overrides);
}

function isThemeWorkspace(source: ThemeEngineCommandSource): source is ThemeWorkspace {
  return "factoryEngine" in source && typeof source.factoryEngine === "function";
}

function markdownOptions(
  source: ThemeEngineCommandSource,
  options: Pick<ThemeEngineCommandOptions, "query" | "title">,
): ThemeEngineFactoryCatalogReportOptions & { title?: string } {
  return {
    factories: factoryRegistry(source).factories(),
    query: options.query,
    title: options.title ?? "Theme Engine Catalog",
  };
}
