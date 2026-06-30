// Copyright 2023 Im-Beast. MIT license.
import type {
  RuntimeRendererBackendController,
  RuntimeRendererBackendControllerOptions,
} from "../runtime/renderer_backends.ts";
import { createRuntimeRendererBackendController } from "../runtime/renderer_backends.ts";
import type { Action } from "./actions.ts";
import type { AppPlugin, AppPluginDisposer, TuiApp } from "./app.ts";
import { bindCommandKeymap, type CommandKeymapBindingOptions } from "./command_bindings.ts";
import { DisposableStack } from "./disposables.ts";
import type { Route } from "./router.ts";
import type { SettingsController } from "./settings.ts";
import {
  bindRuntimeRendererBackendSetting,
  type RuntimeRendererBackendSettingBindingOptions,
  type SettingBinding,
} from "./settings_bindings.ts";
import {
  bindRuntimeRendererBackendCommands,
  type RuntimeRendererBackendCommandAction,
  type RuntimeRendererBackendCommandOptions,
} from "./runtime_renderer_commands.ts";

/** Options for configuring runtime Renderer Backend Plugin. */
export interface RuntimeRendererBackendPluginOptions {
  id?: string;
  label?: string;
  controller?: RuntimeRendererBackendController;
  controllerOptions?: RuntimeRendererBackendControllerOptions;
  settings?: SettingsController;
  persistBackend?: boolean | RuntimeRendererBackendSettingBindingOptions<unknown>;
  commands?: boolean | RuntimeRendererBackendCommandOptions;
  mirrorKeymap?: boolean | CommandKeymapBindingOptions;
  install?: (context: RuntimeRendererBackendPluginInstallContext) => AppPluginDisposer;
}

/** Context object passed to runtime Renderer Backend Plugin Install callbacks. */
export interface RuntimeRendererBackendPluginInstallContext {
  app: TuiApp<Action, Route>;
  controller: RuntimeRendererBackendController;
  backendSetting?: SettingBinding<string, unknown>;
}

/** Serializable inspection snapshot for runtime Renderer Backend Plugin. */
export interface RuntimeRendererBackendPluginInspection {
  id?: string;
  label?: string;
  controller: ReturnType<RuntimeRendererBackendController["inspect"]>;
  commandsEnabled: boolean;
  settingsEnabled: boolean;
  backendPersistenceEnabled: boolean;
  keymapMirroringEnabled: boolean;
}

/** Public interface describing a runtime Renderer Backend App Plugin. */
export interface RuntimeRendererBackendAppPlugin<
  TAction extends Action = RuntimeRendererBackendCommandAction,
  TRoute extends Route = Route,
> extends AppPlugin<TAction, TRoute> {
  readonly controller: RuntimeRendererBackendController;
  inspect(): RuntimeRendererBackendPluginInspection;
}

/** Creates an runtime Renderer Backend Plugin. */
export function createRuntimeRendererBackendPlugin<
  TAction extends Action = RuntimeRendererBackendCommandAction,
  TRoute extends Route = Route,
>(
  options: RuntimeRendererBackendPluginOptions = {},
): RuntimeRendererBackendAppPlugin<TAction, TRoute> {
  const controller = options.controller ?? createRuntimeRendererBackendController(options.controllerOptions);
  const id = options.id ?? "runtime-renderer";
  const label = options.label ?? "Runtime Renderer";

  return {
    id,
    label,
    controller,
    install(app) {
      const stack = new DisposableStack();
      let backendSetting: SettingBinding<string, unknown> | undefined;

      try {
        const persistBackend = options.persistBackend ?? true;
        if (options.settings && persistBackend) {
          const binding = bindRuntimeRendererBackendSetting<unknown>(
            controller,
            options.settings,
            settingOptions(persistBackend),
          );
          backendSetting = binding;
          stack.defer(binding.dispose);
        }

        if (options.commands ?? true) {
          const commandOptions = commandOptionsFrom(options.commands);
          stack.defer(bindRuntimeRendererBackendCommands(app.commands, controller, commandOptions));
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
            backendSetting,
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
        backendPersistenceEnabled: options.settings !== undefined && (options.persistBackend ?? true) !== false,
        keymapMirroringEnabled: options.mirrorKeymap !== undefined && options.mirrorKeymap !== false,
      };
    },
  };
}

function commandOptionsFrom(
  options: boolean | RuntimeRendererBackendCommandOptions | undefined,
): RuntimeRendererBackendCommandOptions {
  return typeof options === "object" ? options : {};
}

function keymapOptionsFrom(
  options: true | CommandKeymapBindingOptions,
  commandOptions: RuntimeRendererBackendCommandOptions,
): CommandKeymapBindingOptions {
  return options === true ? { group: commandOptions.group ?? "runtime" } : options;
}

function settingOptions<TOptions>(options: true | TOptions): TOptions {
  return options === true ? {} as TOptions : options;
}
