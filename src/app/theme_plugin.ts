// Copyright 2023 Im-Beast. MIT license.
import type { Route } from "./router.ts";
import type { Action } from "./actions.ts";
import type { AppPlugin, AppPluginDisposer, TuiApp } from "./app.ts";
import { bindCommandKeymap, type CommandKeymapBindingOptions } from "./command_bindings.ts";
import type { Command } from "./commands.ts";
import { DisposableStack } from "./disposables.ts";
import type { SettingsController } from "./settings.ts";
import {
  bindThemeLayerSetting,
  bindThemePipelineSetting,
  bindThemeSetting,
  type SettingBinding,
  type ThemeLayerSettingBindingOptions,
  type ThemePipelineSettingBindingOptions,
  type ThemeSettingBindingOptions,
} from "./settings_bindings.ts";
import { type ThemeCommandAction, type ThemeCommandOptions, themeCommands } from "./theme_commands.ts";
import {
  bindThemePipelineCommands,
  type ThemePipelineCommandAction,
  type ThemePipelineCommandOptions,
} from "./theme_pipeline_commands.ts";
import { createThemeProvider, type ThemeProvider, type ThemeProviderOptions } from "../theme.ts";
import type { ThemeEnginePipeline } from "../theme_engine_pipeline.ts";

/** Public type alias for a theme Plugin Pipeline Setting Option. */
export type ThemePluginPipelineSettingOption = boolean | ThemePipelineSettingBindingOptions<unknown>;
/** Public type alias for a theme Plugin Pipeline Setting Options. */
export type ThemePluginPipelineSettingOptions =
  | ThemePluginPipelineSettingOption
  | Record<string, ThemePluginPipelineSettingOption>;
/** Public type alias for a theme Plugin Pipeline Command Options. */
export type ThemePluginPipelineCommandOptions =
  | boolean
  | ThemePipelineCommandOptions
  | Record<string, boolean | ThemePipelineCommandOptions>;

/** Options for configuring theme Plugin. */
export interface ThemePluginOptions {
  id?: string;
  label?: string;
  provider?: ThemeProvider;
  providerOptions?: ThemeProviderOptions;
  pipelines?: ThemeEnginePipeline | readonly ThemeEnginePipeline[];
  settings?: SettingsController;
  persistTheme?: boolean | ThemeSettingBindingOptions<unknown>;
  persistLayers?: boolean | ThemeLayerSettingBindingOptions<unknown>;
  persistPipelines?: ThemePluginPipelineSettingOptions;
  commands?: boolean | ThemeCommandOptions;
  pipelineCommands?: ThemePluginPipelineCommandOptions;
  mirrorKeymap?: boolean | CommandKeymapBindingOptions;
  install?: (context: ThemePluginInstallContext) => AppPluginDisposer;
}

/** Context object passed to theme Plugin Install callbacks. */
export interface ThemePluginInstallContext {
  app: TuiApp<Action, Route>;
  provider: ThemeProvider;
  pipelines: readonly ThemeEnginePipeline[];
  themeSetting?: SettingBinding<string, unknown>;
  layerSetting?: SettingBinding<readonly string[], unknown>;
  pipelineSettings: Record<string, SettingBinding<readonly string[], unknown>>;
}

/** Serializable inspection snapshot for theme Plugin. */
export interface ThemePluginInspection {
  id?: string;
  label?: string;
  provider: ReturnType<ThemeProvider["inspect"]>;
  pipelines: ReturnType<ThemeEnginePipeline["inspect"]>[];
  commandsEnabled: boolean;
  pipelineCommandsEnabled: boolean;
  settingsEnabled: boolean;
  themePersistenceEnabled: boolean;
  layerPersistenceEnabled: boolean;
  pipelinePersistenceIds: string[];
  keymapMirroringEnabled: boolean;
}

/** Public interface describing a theme App Plugin. */
export interface ThemeAppPlugin<
  TAction extends Action = ThemeCommandAction | ThemePipelineCommandAction,
  TRoute extends Route = Route,
> extends AppPlugin<TAction, TRoute> {
  readonly provider: ThemeProvider;
  readonly pipelines: readonly ThemeEnginePipeline[];
  inspect(): ThemePluginInspection;
}

/** Creates an theme Plugin. */
export function createThemePlugin<
  TAction extends Action = ThemeCommandAction | ThemePipelineCommandAction,
  TRoute extends Route = Route,
>(
  options: ThemePluginOptions = {},
): ThemeAppPlugin<TAction, TRoute> {
  const provider = options.provider ?? createThemeProvider(options.providerOptions);
  const pipelines = normalizePipelines(options.pipelines);
  const id = options.id ?? "theme";
  const label = options.label ?? "Theme Engine";

  return {
    id,
    label,
    provider,
    pipelines,
    install(app) {
      const stack = new DisposableStack();
      let themeSetting: SettingBinding<string, unknown> | undefined;
      let layerSetting: SettingBinding<readonly string[], unknown> | undefined;
      const pipelineSettings: Record<string, SettingBinding<readonly string[], unknown>> = {};

      try {
        if (options.settings) {
          const persistTheme = options.persistTheme ?? true;
          const persistLayers = options.persistLayers ?? provider.layers.ids().length > 0;
          const persistPipelines = options.persistPipelines ?? pipelines.length > 0;

          if (persistTheme) {
            const binding = bindThemeSetting<unknown>(provider, options.settings, settingOptions(persistTheme));
            themeSetting = binding;
            stack.defer(binding.dispose);
          }

          if (persistLayers) {
            const binding = bindThemeLayerSetting<unknown>(provider, options.settings, settingOptions(persistLayers));
            layerSetting = binding;
            stack.defer(binding.dispose);
          }

          for (const pipeline of pipelines) {
            const pipelineSettingOptions = pipelineSettingOptionsFor(persistPipelines, pipeline.id);
            if (!pipelineSettingOptions) continue;
            const binding = bindThemePipelineSetting<unknown>(
              pipeline,
              options.settings,
              settingOptions(pipelineSettingOptions),
            );
            pipelineSettings[pipeline.id] = binding;
            stack.defer(binding.dispose);
          }
        }

        if (options.commands ?? true) {
          const commandOptions = commandOptionsFrom(options.commands);
          stack.defer(
            app.commands.registerAll(themeCommands(provider, commandOptions) as unknown as Command<TAction>[]),
          );
          for (const pipeline of pipelines) {
            const pipelineCommandOptions = pipelineCommandOptionsFor(options.pipelineCommands ?? true, pipeline.id);
            if (!pipelineCommandOptions) continue;
            stack.defer(
              bindThemePipelineCommands(
                app.commands,
                pipeline,
                pipelineCommandOptions === true ? { group: commandOptions.group } : pipelineCommandOptions,
              ) as () => void,
            );
          }
          if (options.mirrorKeymap) {
            stack.defer(
              bindCommandKeymap(app.commands, app.keymap, keymapOptionsFrom(options.mirrorKeymap, commandOptions)),
            );
          }
        }

        stack.defer(
          options.install?.({
            app: app as unknown as TuiApp<Action, Route>,
            provider,
            pipelines,
            themeSetting,
            layerSetting,
            pipelineSettings,
          }),
        );
      } catch (error) {
        stack.dispose();
        throw error;
      }

      return stack.dispose;
    },
    inspect() {
      return {
        id,
        label,
        provider: provider.inspect(),
        pipelines: inspectThemePluginPipelines(pipelines),
        commandsEnabled: (options.commands ?? true) !== false,
        pipelineCommandsEnabled: (options.commands ?? true) !== false &&
          pipelines.some((pipeline) =>
            pipelineCommandOptionsFor(options.pipelineCommands ?? true, pipeline.id) !== false
          ),
        settingsEnabled: options.settings !== undefined,
        themePersistenceEnabled: options.settings !== undefined && (options.persistTheme ?? true) !== false,
        layerPersistenceEnabled: options.settings !== undefined &&
          (options.persistLayers ?? provider.layers.ids().length > 0) !== false,
        pipelinePersistenceIds: options.settings === undefined ? [] : persistedThemePluginPipelineIds(
          pipelines,
          options.persistPipelines ?? pipelines.length > 0,
        ),
        keymapMirroringEnabled: options.mirrorKeymap !== undefined && options.mirrorKeymap !== false,
      };
    },
  };
}

function inspectThemePluginPipelines(
  pipelines: readonly ThemeEnginePipeline[],
): ReturnType<ThemeEnginePipeline["inspect"]>[] {
  const inspections = new Array<ReturnType<ThemeEnginePipeline["inspect"]>>(pipelines.length);
  for (let index = 0; index < pipelines.length; index += 1) {
    inspections[index] = pipelines[index]!.inspect();
  }
  return inspections;
}

function persistedThemePluginPipelineIds(
  pipelines: readonly ThemeEnginePipeline[],
  persist: ThemePluginOptions["persistPipelines"] | undefined,
): string[] {
  if (persist === undefined) return [];
  const ids: string[] = [];
  for (const pipeline of pipelines) {
    if (pipelineSettingOptionsFor(persist, pipeline.id)) ids.push(pipeline.id);
  }
  return ids;
}

function commandOptionsFrom(options: boolean | ThemeCommandOptions | undefined): ThemeCommandOptions {
  return typeof options === "object" ? options : {};
}

function keymapOptionsFrom(
  options: true | CommandKeymapBindingOptions,
  commandOptions: ThemeCommandOptions,
): CommandKeymapBindingOptions {
  return options === true ? { group: commandOptions.group ?? "theme" } : options;
}

function settingOptions<TOptions>(options: true | TOptions): TOptions {
  return options === true ? {} as TOptions : options;
}

function normalizePipelines(pipelines: ThemePluginOptions["pipelines"]): ThemeEnginePipeline[] {
  if (!pipelines) return [];
  if (Array.isArray(pipelines)) return [...pipelines as readonly ThemeEnginePipeline[]];
  return [pipelines as ThemeEnginePipeline];
}

function pipelineSettingOptionsFor(
  options: ThemePluginPipelineSettingOptions,
  id: string,
): false | true | ThemePipelineSettingBindingOptions<unknown> {
  if (typeof options === "boolean") return options;
  if (isPipelineSettingOptions(options)) return options;
  return options[id] ?? false;
}

function pipelineCommandOptionsFor(
  options: ThemePluginPipelineCommandOptions,
  id: string,
): false | true | ThemePipelineCommandOptions {
  if (typeof options === "boolean") return options;
  if (isPipelineCommandOptions(options)) return options;
  return options[id] ?? false;
}

function isPipelineSettingOptions(
  options: Exclude<ThemePluginPipelineSettingOptions, boolean>,
): options is ThemePipelineSettingBindingOptions<unknown> {
  return "key" in options ||
    "initialValue" in options ||
    "setting" in options ||
    "serialize" in options ||
    "deserialize" in options ||
    "initialSync" in options ||
    "equals" in options;
}

function isPipelineCommandOptions(
  options: Exclude<ThemePluginPipelineCommandOptions, boolean>,
): options is ThemePipelineCommandOptions {
  return "group" in options ||
    "prefix" in options ||
    "includeToggleCommands" in options ||
    "includeEnableCommands" in options ||
    "includeDisableCommands" in options ||
    "disableInactiveStepStates" in options;
}
