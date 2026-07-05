// Copyright 2023 Im-Beast. MIT license.
import { previewThemeProvider, type ThemeLayerStack, type ThemeProvider } from "../theme.ts";
import type {
  ThemeEngineOptions,
  ThemeInspection,
  ThemeProviderPreview,
  ThemeProviderPreviewOptions,
} from "../theme.ts";
import {
  formatThemeEngineFactoryCatalogMarkdown,
  type ThemeEngineFactoryCatalogQuery,
  type ThemeEngineFactoryCatalogReport,
  type ThemeEngineFactoryCatalogReportOptions,
  type ThemeEngineFactoryInspection,
  type ThemeEngineFactoryRegistry,
} from "../theme_engine_factory.ts";
import type { ThemeEnginePipeline } from "../theme_engine_pipeline.ts";
import type { ThemeWorkspace } from "../theme_workspace.ts";
import type { Action } from "./actions.ts";
import type { Command, CommandRegistry } from "./commands.ts";

/** Action union emitted by theme Command command helpers. */
export type ThemeCommandAction =
  | Action<"theme.changed", ThemeChangedPayload>
  | Action<"theme.layer.changed", ThemeLayerChangedPayload>
  | Action<"theme.previewed", ThemePreviewPayload>;

/** Payload carried by theme Changed actions. */
export interface ThemeChangedPayload {
  id: string;
  previousId: string;
  direction?: number;
}

/** Payload carried by theme Layer Changed actions. */
export interface ThemeLayerChangedPayload {
  id: string;
  enabled: boolean;
}

/** Payload carried by theme Preview actions. */
export interface ThemePreviewPayload {
  preview: ThemeProviderPreview;
}

/** Action union emitted by theme Pipeline Command command helpers. */
export type ThemePipelineCommandAction = Action<"theme.pipeline.step.changed", ThemePipelineStepChangedPayload>;

/** Action union emitted by theme Engine Command command helpers. */
export type ThemeEngineCommandAction =
  | Action<"theme.engine.previewed", ThemeEnginePreviewPayload>
  | Action<"theme.engine.catalog.reported", ThemeEngineCatalogPayload>;

/** Payload carried by theme Pipeline Step Changed actions. */
export interface ThemePipelineStepChangedPayload {
  pipelineId: string;
  id: string;
  enabled: boolean;
}

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

/** Options for configuring theme Command. */
export interface ThemeCommandOptions {
  group?: string;
  themePrefix?: string;
  layerPrefix?: string;
  previewPrefix?: string;
  includeCycleCommands?: boolean;
  includeThemeCommands?: boolean;
  includeLayerCommands?: boolean;
  includePreviewCommand?: boolean;
  disableActiveTheme?: boolean;
  disableInactiveLayerStates?: boolean;
  preview?: ThemeProviderPreviewOptions;
}

/** Options for configuring theme Pipeline Command. */
export interface ThemePipelineCommandOptions {
  group?: string;
  prefix?: string;
  includeToggleCommands?: boolean;
  includeEnableCommands?: boolean;
  includeDisableCommands?: boolean;
  disableInactiveStepStates?: boolean;
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

/** Builds command definitions for theme. */
export function themeCommands(
  provider: ThemeProvider,
  options: ThemeCommandOptions = {},
): Command<ThemeCommandAction>[] {
  return [
    ...themeSelectionCommands(provider, options),
    ...themeLayerCommands(provider, options),
    ...themePreviewCommands(provider, options),
  ];
}

/** Binds theme Commands behavior and returns a disposer when applicable. */
export function bindThemeCommands<TAction extends Action = ThemeCommandAction>(
  registry: CommandRegistry<TAction>,
  provider: ThemeProvider,
  options: ThemeCommandOptions = {},
): () => void {
  return registry.registerAll(themeCommands(provider, options) as unknown as Command<TAction>[]);
}

/** Builds command definitions for theme Pipeline. */
export function themePipelineCommands(
  pipeline: ThemeEnginePipeline,
  options: ThemePipelineCommandOptions = {},
): Command<ThemePipelineCommandAction>[] {
  const group = options.group ?? "theme";
  const prefix = options.prefix ?? `theme.pipeline.${pipeline.id}`;
  const commands: Command<ThemePipelineCommandAction>[] = [];

  for (const step of pipeline.inspect().steps) {
    if (options.includeToggleCommands ?? true) {
      commands.push({
        id: `${prefix}.toggle.${step.id}`,
        label: `Toggle ${step.label}`,
        description: `Toggle the ${step.label} theme pipeline step.`,
        group,
        keywords: ["theme", "pipeline", "step", "toggle", pipeline.id, step.id, step.label],
        action: () => {
          pipeline.toggle(step.id);
          return {
            type: "theme.pipeline.step.changed",
            payload: { pipelineId: pipeline.id, id: step.id, enabled: pipelineStepActive(pipeline, step.id) },
          };
        },
      });
    }

    if (options.includeEnableCommands ?? true) {
      commands.push({
        id: `${prefix}.enable.${step.id}`,
        label: `Enable ${step.label}`,
        description: `Enable the ${step.label} theme pipeline step.`,
        group,
        keywords: ["theme", "pipeline", "step", "enable", pipeline.id, step.id, step.label],
        disabled: options.disableInactiveStepStates ?? true ? () => pipelineStepActive(pipeline, step.id) : false,
        action: () => {
          pipeline.enable(step.id);
          return {
            type: "theme.pipeline.step.changed",
            payload: { pipelineId: pipeline.id, id: step.id, enabled: true },
          };
        },
      });
    }

    if (options.includeDisableCommands ?? true) {
      commands.push({
        id: `${prefix}.disable.${step.id}`,
        label: `Disable ${step.label}`,
        description: `Disable the ${step.label} theme pipeline step.`,
        group,
        keywords: ["theme", "pipeline", "step", "disable", pipeline.id, step.id, step.label],
        disabled: options.disableInactiveStepStates ?? true ? () => !pipelineStepActive(pipeline, step.id) : false,
        action: () => {
          pipeline.disable(step.id);
          return {
            type: "theme.pipeline.step.changed",
            payload: { pipelineId: pipeline.id, id: step.id, enabled: false },
          };
        },
      });
    }
  }

  return commands;
}

/** Binds theme Pipeline Commands behavior and returns a disposer when applicable. */
export function bindThemePipelineCommands<TAction extends Action = ThemePipelineCommandAction>(
  registry: CommandRegistry<TAction>,
  pipeline: ThemeEnginePipeline,
  options: ThemePipelineCommandOptions = {},
): () => void {
  return registry.registerAll(themePipelineCommands(pipeline, options) as unknown as Command<TAction>[]);
}

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
  const factories = registry.inspect();
  const commands = new Array<Command<ThemeEngineCommandAction>>(factories.length);

  for (let index = 0; index < factories.length; index += 1) {
    const factory = factories[index]!;
    commands[index] = {
      id: `${prefix}.preview.${factory.id}`,
      label: `Theme Engine: ${factory.label}`,
      description: factory.description ?? `Preview the ${factory.label} theme engine.`,
      group,
      keywords: themeEngineFactoryKeywords(factory),
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
    };
  }
  return commands;
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

/** Builds command definitions for theme Selection. */
export function themeSelectionCommands(
  provider: ThemeProvider,
  options: ThemeCommandOptions = {},
): Command<ThemeCommandAction>[] {
  const group = options.group ?? "theme";
  const prefix = options.themePrefix ?? "theme";
  const commands: Command<ThemeCommandAction>[] = [];

  if (options.includeCycleCommands ?? true) {
    commands.push(
      {
        id: `${prefix}.next`,
        label: "Next Theme",
        description: "Cycle to the next registered theme pack.",
        group,
        keywords: ["theme", "next", "cycle"],
        action: () => {
          const previousId = provider.activeId.peek();
          const id = provider.nextTheme();
          return { type: "theme.changed", payload: { id, previousId, direction: 1 } };
        },
      },
      {
        id: `${prefix}.previous`,
        label: "Previous Theme",
        description: "Cycle to the previous registered theme pack.",
        group,
        keywords: ["theme", "previous", "cycle"],
        action: () => {
          const previousId = provider.activeId.peek();
          const id = provider.previousTheme();
          return { type: "theme.changed", payload: { id, previousId, direction: -1 } };
        },
      },
    );
  }

  if (options.includeThemeCommands ?? true) {
    for (const id of provider.themeIds()) {
      const pack = provider.registry.get(id);
      commands.push({
        id: `${prefix}.set.${id}`,
        label: `Theme: ${pack?.label ?? id}`,
        description: `Switch to the ${pack?.label ?? id} theme pack.`,
        group,
        keywords: ["theme", "set", id, pack?.label ?? id],
        disabled: options.disableActiveTheme ?? true ? () => provider.activeId.peek() === id : false,
        action: () => {
          const previousId = provider.activeId.peek();
          provider.setTheme(id);
          return { type: "theme.changed", payload: { id: provider.activeId.peek(), previousId } };
        },
      });
    }
  }

  return commands;
}

/** Builds command definitions for theme Preview. */
export function themePreviewCommands(
  provider: ThemeProvider,
  options: ThemeCommandOptions = {},
): Command<ThemeCommandAction>[] {
  if (!(options.includePreviewCommand ?? true)) return [];

  const group = options.group ?? "theme";
  const prefix = options.previewPrefix ?? "theme.preview";
  return [
    {
      id: `${prefix}.snapshot`,
      label: "Preview Theme",
      description: "Capture the active theme provider catalog and rendered style samples.",
      group,
      keywords: ["theme", "preview", "catalog", "tokens", "layers"],
      action: () => ({
        type: "theme.previewed",
        payload: { preview: previewThemeProvider(provider, options.preview) },
      }),
    },
  ];
}

/** Builds command definitions for theme Layer. */
export function themeLayerCommands(
  target: ThemeProvider | ThemeLayerStack,
  options: ThemeCommandOptions = {},
): Command<ThemeCommandAction>[] {
  const layers = "layers" in target ? target.layers : target;
  const group = options.group ?? "theme";
  const prefix = options.layerPrefix ?? "theme.layer";
  const commands: Command<ThemeCommandAction>[] = [];

  if (!(options.includeLayerCommands ?? true)) return commands;

  for (const layer of layers.inspect()) {
    commands.push(
      {
        id: `${prefix}.toggle.${layer.id}`,
        label: `Toggle ${layer.label}`,
        description: `Toggle the ${layer.label} theme layer.`,
        group,
        keywords: ["theme", "layer", "toggle", layer.id, layer.label],
        action: () => {
          layers.toggle(layer.id);
          return {
            type: "theme.layer.changed",
            payload: { id: layer.id, enabled: layers.activeIds().includes(layer.id) },
          };
        },
      },
      {
        id: `${prefix}.enable.${layer.id}`,
        label: `Enable ${layer.label}`,
        description: `Enable the ${layer.label} theme layer.`,
        group,
        keywords: ["theme", "layer", "enable", layer.id, layer.label],
        disabled: options.disableInactiveLayerStates ?? true ? () => layers.activeIds().includes(layer.id) : false,
        action: () => {
          layers.enable(layer.id);
          return { type: "theme.layer.changed", payload: { id: layer.id, enabled: true } };
        },
      },
      {
        id: `${prefix}.disable.${layer.id}`,
        label: `Disable ${layer.label}`,
        description: `Disable the ${layer.label} theme layer.`,
        group,
        keywords: ["theme", "layer", "disable", layer.id, layer.label],
        disabled: options.disableInactiveLayerStates ?? true ? () => !layers.activeIds().includes(layer.id) : false,
        action: () => {
          layers.disable(layer.id);
          return { type: "theme.layer.changed", payload: { id: layer.id, enabled: false } };
        },
      },
    );
  }

  return commands;
}

function pipelineStepActive(pipeline: ThemeEnginePipeline, id: string): boolean {
  const activeIds = pipeline.activeIds();
  for (let index = 0; index < activeIds.length; index += 1) {
    if (activeIds[index] === id) return true;
  }
  return false;
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

function themeEngineFactoryKeywords(factory: ReturnType<ThemeEngineFactoryRegistry["inspect"]>[number]): string[] {
  const keywords = [
    "theme",
    "engine",
    "factory",
    "preview",
    factory.id,
    factory.label,
    factory.palette,
  ];
  for (const tag of factory.tags) keywords.push(tag);
  for (const component of factory.components) keywords.push(component);
  for (const variant in factory.variants) {
    for (const state of factory.variants[variant]!) {
      keywords.push(state);
    }
  }
  return keywords;
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
