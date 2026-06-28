// Copyright 2023 Im-Beast. MIT license.
import type { RuntimeProfileController, RuntimeProfileControllerOptions } from "../runtime/profiles.ts";
import { createRuntimeProfileController } from "../runtime/profiles.ts";
import type { Action } from "./actions.ts";
import type { AppPlugin, AppPluginDisposer, TuiApp } from "./app.ts";
import { bindCommandKeymap, type CommandKeymapBindingOptions } from "./command_bindings.ts";
import { DisposableStack } from "./disposables.ts";
import type { Route } from "./router.ts";
import type { SettingsController } from "./settings.ts";
import {
  bindRuntimeProfileSetting,
  type RuntimeProfileSettingBindingOptions,
  type SettingBinding,
} from "./settings_bindings.ts";
import {
  bindRuntimeProfileCommands,
  type RuntimeProfileCommandAction,
  type RuntimeProfileCommandOptions,
} from "./runtime_profile_commands.ts";

export interface RuntimeProfilePluginOptions {
  id?: string;
  label?: string;
  controller?: RuntimeProfileController;
  controllerOptions?: RuntimeProfileControllerOptions;
  settings?: SettingsController;
  persistProfile?: boolean | RuntimeProfileSettingBindingOptions<unknown>;
  commands?: boolean | RuntimeProfileCommandOptions;
  mirrorKeymap?: boolean | CommandKeymapBindingOptions;
  install?: (context: RuntimeProfilePluginInstallContext) => AppPluginDisposer;
}

export interface RuntimeProfilePluginInstallContext {
  app: TuiApp<Action, Route>;
  controller: RuntimeProfileController;
  profileSetting?: SettingBinding<string, unknown>;
}

export interface RuntimeProfilePluginInspection {
  id?: string;
  label?: string;
  controller: ReturnType<RuntimeProfileController["inspect"]>;
  commandsEnabled: boolean;
  settingsEnabled: boolean;
  profilePersistenceEnabled: boolean;
  keymapMirroringEnabled: boolean;
}

export interface RuntimeProfileAppPlugin<
  TAction extends Action = RuntimeProfileCommandAction,
  TRoute extends Route = Route,
> extends AppPlugin<TAction, TRoute> {
  readonly controller: RuntimeProfileController;
  inspect(): RuntimeProfilePluginInspection;
}

export function createRuntimeProfilePlugin<
  TAction extends Action = RuntimeProfileCommandAction,
  TRoute extends Route = Route,
>(
  options: RuntimeProfilePluginOptions = {},
): RuntimeProfileAppPlugin<TAction, TRoute> {
  const controller = options.controller ?? createRuntimeProfileController(options.controllerOptions);
  const id = options.id ?? "runtime-profile";
  const label = options.label ?? "Runtime Profile";

  return {
    id,
    label,
    controller,
    install(app) {
      const stack = new DisposableStack();
      let profileSetting: SettingBinding<string, unknown> | undefined;

      try {
        const persistProfile = options.persistProfile ?? true;
        if (options.settings && persistProfile) {
          const binding = bindRuntimeProfileSetting<unknown>(
            controller,
            options.settings,
            settingOptions(persistProfile),
          );
          profileSetting = binding;
          stack.defer(binding.dispose);
        }

        if (options.commands ?? true) {
          const commandOptions = commandOptionsFrom(options.commands);
          stack.defer(bindRuntimeProfileCommands(app.commands, controller, commandOptions));
          if (options.mirrorKeymap) {
            stack.defer(
              bindCommandKeymap(app.commands, app.keymap, keymapOptionsFrom(options.mirrorKeymap, commandOptions)),
            );
          }
        }

        stack.defer(
          options.install?.({
            app: app as unknown as TuiApp<Action, Route>,
            controller,
            profileSetting,
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
        controller: controller.inspect(),
        commandsEnabled: (options.commands ?? true) !== false,
        settingsEnabled: options.settings !== undefined,
        profilePersistenceEnabled: options.settings !== undefined && (options.persistProfile ?? true) !== false,
        keymapMirroringEnabled: options.mirrorKeymap !== undefined && options.mirrorKeymap !== false,
      };
    },
  };
}

function commandOptionsFrom(options: boolean | RuntimeProfileCommandOptions | undefined): RuntimeProfileCommandOptions {
  return typeof options === "object" ? options : {};
}

function keymapOptionsFrom(
  options: true | CommandKeymapBindingOptions,
  commandOptions: RuntimeProfileCommandOptions,
): CommandKeymapBindingOptions {
  return options === true ? { group: commandOptions.group ?? "runtime" } : options;
}

function settingOptions<TOptions>(options: true | TOptions): TOptions {
  return options === true ? {} as TOptions : options;
}
