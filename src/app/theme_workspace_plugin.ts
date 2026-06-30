// Copyright 2023 Im-Beast. MIT license.
import type { Route } from "./router.ts";
import type { Action } from "./actions.ts";
import type { AppPlugin, AppPluginDisposer } from "./app.ts";
import type { CommandKeymapBindingOptions } from "./command_bindings.ts";
import { DisposableStack } from "./disposables.ts";
import type { SettingsController } from "./settings.ts";
import type { ThemeLayerSettingBindingOptions, ThemeSettingBindingOptions } from "./settings_bindings.ts";
import type { ThemeCommandAction, ThemeCommandOptions } from "./theme_commands.ts";
import {
  bindThemeEngineCommands,
  type ThemeEngineCommandAction,
  type ThemeEngineCommandOptions,
} from "./theme_engine_commands.ts";
import type { ThemePipelineCommandAction } from "./theme_pipeline_commands.ts";
import {
  createThemePlugin,
  type ThemePluginInspection,
  type ThemePluginInstallContext,
  type ThemePluginPipelineCommandOptions,
  type ThemePluginPipelineSettingOptions,
} from "./theme_plugin.ts";
import { createThemeWorkspace, type ThemeWorkspace, type ThemeWorkspaceOptions } from "../theme_workspace.ts";

/** Options for configuring theme Workspace Plugin. */
export interface ThemeWorkspacePluginOptions {
  id?: string;
  label?: string;
  workspace?: ThemeWorkspace;
  workspaceOptions?: ThemeWorkspaceOptions;
  settings?: SettingsController;
  persistTheme?: boolean | ThemeSettingBindingOptions<unknown>;
  persistLayers?: boolean | ThemeLayerSettingBindingOptions<unknown>;
  persistPipelines?: ThemePluginPipelineSettingOptions;
  commands?: boolean | ThemeCommandOptions;
  engineCommands?: boolean | ThemeEngineCommandOptions;
  pipelineCommands?: ThemePluginPipelineCommandOptions;
  mirrorKeymap?: boolean | CommandKeymapBindingOptions;
  install?: (context: ThemeWorkspacePluginInstallContext) => AppPluginDisposer;
}

/** Context object passed to theme Workspace Plugin Install callbacks. */
export interface ThemeWorkspacePluginInstallContext extends ThemePluginInstallContext {
  workspace: ThemeWorkspace;
}

/** Serializable inspection snapshot for theme Workspace Plugin. */
export interface ThemeWorkspacePluginInspection {
  id?: string;
  label?: string;
  theme: ThemePluginInspection;
  engineCommandsEnabled: boolean;
  workspace: ReturnType<ThemeWorkspace["inspect"]>;
}

/** Public interface describing a theme Workspace App Plugin. */
export interface ThemeWorkspaceAppPlugin<
  TAction extends Action = ThemeCommandAction | ThemePipelineCommandAction | ThemeEngineCommandAction,
  TRoute extends Route = Route,
> extends AppPlugin<TAction, TRoute> {
  readonly workspace: ThemeWorkspace;
  inspect(): ThemeWorkspacePluginInspection;
}

/** Creates an theme Workspace Plugin. */
export function createThemeWorkspacePlugin<
  TAction extends Action = ThemeCommandAction | ThemePipelineCommandAction | ThemeEngineCommandAction,
  TRoute extends Route = Route,
>(
  options: ThemeWorkspacePluginOptions = {},
): ThemeWorkspaceAppPlugin<TAction, TRoute> {
  const workspace = options.workspace ?? createThemeWorkspace(options.workspaceOptions);
  const id = options.id ?? "theme-workspace";
  const label = options.label ?? "Theme Workspace";
  const theme = createThemePlugin<TAction, TRoute>({
    id,
    label,
    provider: workspace.provider,
    pipelines: workspace.pipelines,
    settings: options.settings,
    persistTheme: options.persistTheme,
    persistLayers: options.persistLayers,
    persistPipelines: options.persistPipelines,
    commands: options.commands,
    pipelineCommands: options.pipelineCommands,
    mirrorKeymap: options.mirrorKeymap,
    install: (context) =>
      options.install?.({
        ...context,
        workspace,
      }),
  });

  return {
    id,
    label,
    workspace,
    install(app) {
      const stack = new DisposableStack();
      try {
        stack.defer(theme.install(app));
        if (options.engineCommands ?? true) {
          stack.defer(
            bindThemeEngineCommands(
              app.commands,
              workspace,
              themeEngineCommandOptionsFrom(options.engineCommands),
            ) as () => void,
          );
        }
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
        theme: theme.inspect(),
        engineCommandsEnabled: (options.engineCommands ?? true) !== false,
        workspace: workspace.inspect(),
      };
    },
  };
}

function themeEngineCommandOptionsFrom(
  options: boolean | ThemeEngineCommandOptions | undefined,
): ThemeEngineCommandOptions {
  return typeof options === "object" ? options : {};
}
