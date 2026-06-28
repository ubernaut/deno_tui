// Copyright 2023 Im-Beast. MIT license.
import type { Route } from "./router.ts";
import type { Action } from "./actions.ts";
import type { AppPlugin, AppPluginDisposer, TuiApp } from "./app.ts";
import { bindCommandKeymap, type CommandKeymapBindingOptions } from "./command_bindings.ts";
import type { Command } from "./commands.ts";
import type { SettingsController } from "./settings.ts";
import {
  bindThemeLayerSetting,
  bindThemeSetting,
  type SettingBinding,
  type ThemeLayerSettingBindingOptions,
  type ThemeSettingBindingOptions,
} from "./settings_bindings.ts";
import { type ThemeCommandAction, type ThemeCommandOptions, themeCommands } from "./theme_commands.ts";
import { createThemeProvider, type ThemeProvider, type ThemeProviderOptions } from "../theme.ts";

export interface ThemePluginOptions {
  id?: string;
  label?: string;
  provider?: ThemeProvider;
  providerOptions?: ThemeProviderOptions;
  settings?: SettingsController;
  persistTheme?: boolean | ThemeSettingBindingOptions<unknown>;
  persistLayers?: boolean | ThemeLayerSettingBindingOptions<unknown>;
  commands?: boolean | ThemeCommandOptions;
  mirrorKeymap?: boolean | CommandKeymapBindingOptions;
  install?: (context: ThemePluginInstallContext) => AppPluginDisposer;
}

export interface ThemePluginInstallContext {
  app: TuiApp<Action, Route>;
  provider: ThemeProvider;
  themeSetting?: SettingBinding<string, unknown>;
  layerSetting?: SettingBinding<readonly string[], unknown>;
}

export interface ThemePluginInspection {
  id?: string;
  label?: string;
  provider: ReturnType<ThemeProvider["inspect"]>;
  commandsEnabled: boolean;
  settingsEnabled: boolean;
  themePersistenceEnabled: boolean;
  layerPersistenceEnabled: boolean;
  keymapMirroringEnabled: boolean;
}

export interface ThemeAppPlugin<TAction extends Action = ThemeCommandAction, TRoute extends Route = Route>
  extends AppPlugin<TAction, TRoute> {
  readonly provider: ThemeProvider;
  inspect(): ThemePluginInspection;
}

export function createThemePlugin<TAction extends Action = ThemeCommandAction, TRoute extends Route = Route>(
  options: ThemePluginOptions = {},
): ThemeAppPlugin<TAction, TRoute> {
  const provider = options.provider ?? createThemeProvider(options.providerOptions);
  const id = options.id ?? "theme";
  const label = options.label ?? "Theme Engine";

  return {
    id,
    label,
    provider,
    install(app) {
      const disposers: Array<() => void> = [];
      let themeSetting: SettingBinding<string, unknown> | undefined;
      let layerSetting: SettingBinding<readonly string[], unknown> | undefined;

      try {
        if (options.settings) {
          const persistTheme = options.persistTheme ?? true;
          const persistLayers = options.persistLayers ?? provider.layers.ids().length > 0;

          if (persistTheme) {
            const binding = bindThemeSetting<unknown>(provider, options.settings, settingOptions(persistTheme));
            themeSetting = binding;
            disposers.push(binding.dispose);
          }

          if (persistLayers) {
            const binding = bindThemeLayerSetting<unknown>(provider, options.settings, settingOptions(persistLayers));
            layerSetting = binding;
            disposers.push(binding.dispose);
          }
        }

        if (options.commands ?? true) {
          const commandOptions = commandOptionsFrom(options.commands);
          disposers.push(
            app.commands.registerAll(themeCommands(provider, commandOptions) as unknown as Command<TAction>[]),
          );
          if (options.mirrorKeymap) {
            disposers.push(
              bindCommandKeymap(app.commands, app.keymap, keymapOptionsFrom(options.mirrorKeymap, commandOptions)),
            );
          }
        }

        const customDisposer = options.install?.({
          app: app as unknown as TuiApp<Action, Route>,
          provider,
          themeSetting,
          layerSetting,
        });
        if (customDisposer) disposers.push(customDisposer);
      } catch (error) {
        disposeReverse(disposers);
        throw error;
      }

      return () => disposeReverse(disposers);
    },
    inspect() {
      return {
        id,
        label,
        provider: provider.inspect(),
        commandsEnabled: (options.commands ?? true) !== false,
        settingsEnabled: options.settings !== undefined,
        themePersistenceEnabled: options.settings !== undefined && (options.persistTheme ?? true) !== false,
        layerPersistenceEnabled: options.settings !== undefined &&
          (options.persistLayers ?? provider.layers.ids().length > 0) !== false,
        keymapMirroringEnabled: options.mirrorKeymap !== undefined && options.mirrorKeymap !== false,
      };
    },
  };
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

function disposeReverse(disposers: Array<() => void>): void {
  for (const dispose of [...disposers].reverse()) {
    dispose();
  }
}
