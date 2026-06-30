// Copyright 2023 Im-Beast. MIT license.
import type { DataTableController } from "../components/data_table.ts";
import type { DataQueryController, DataQueryControllerOptions, DataQueryParams } from "../runtime/data_query.ts";
import { createDataQueryController } from "../runtime/data_query.ts";
import type { Signal } from "../signals/mod.ts";
import type { Action } from "./actions.ts";
import type { AppPlugin, AppPluginDisposer, TuiApp } from "./app.ts";
import { bindCommandKeymap, type CommandKeymapBindingOptions } from "./command_bindings.ts";
import type { DataQueryParamsBindingHandle, DataQueryTableBindingHandle } from "./data_query_bindings.ts";
import { bindDataQueryParams, bindDataQueryTable, type DataQueryTableBindingOptions } from "./data_query_bindings.ts";
import {
  bindDataQueryCommands,
  type DataQueryCommandAction,
  type DataQueryCommandOptions,
} from "./data_query_commands.ts";
import { DisposableStack } from "./disposables.ts";
import type { Route } from "./router.ts";
import type { SettingsController } from "./settings.ts";
import { bindDataQuerySetting, type DataQuerySettingBindingOptions, type SettingBinding } from "./settings_bindings.ts";

/** Options for configuring data Query Plugin. */
export interface DataQueryPluginOptions<
  TRow extends Record<string, unknown>,
  TParams extends DataQueryParams = DataQueryParams,
> {
  id?: string;
  label?: string;
  controller?: DataQueryController<TRow>;
  controllerOptions?: DataQueryControllerOptions<TRow>;
  params?: Signal<TParams>;
  bindParams?: boolean | Omit<Parameters<typeof bindDataQueryParams<TRow, TParams>>[2], "initialRestore">;
  table?: DataTableController<TRow>;
  tableBinding?: boolean | DataQueryTableBindingOptions<TRow>;
  settings?: SettingsController;
  persistParams?: boolean | DataQuerySettingBindingOptions;
  commands?: boolean | DataQueryCommandOptions;
  mirrorKeymap?: boolean | CommandKeymapBindingOptions;
  install?: (context: DataQueryPluginInstallContext<TRow, TParams>) => AppPluginDisposer;
}

/** Context object passed to data Query Plugin Install callbacks. */
export interface DataQueryPluginInstallContext<
  TRow extends Record<string, unknown>,
  TParams extends DataQueryParams = DataQueryParams,
> {
  app: TuiApp<Action, Route>;
  controller: DataQueryController<TRow>;
  paramsBinding?: DataQueryParamsBindingHandle<TParams>;
  tableBinding?: DataQueryTableBindingHandle;
  paramsSetting?: SettingBinding<ReturnType<DataQueryController<TRow>["params"]["peek"]>, unknown>;
}

/** Serializable inspection snapshot for data Query Plugin. */
export interface DataQueryPluginInspection<TRow = unknown> {
  id?: string;
  label?: string;
  query: ReturnType<DataQueryController<TRow>["inspect"]>;
  commandsEnabled: boolean;
  settingsEnabled: boolean;
  paramsPersistenceEnabled: boolean;
  paramsBindingEnabled: boolean;
  tableBindingEnabled: boolean;
  keymapMirroringEnabled: boolean;
}

/** Public interface describing a data Query App Plugin. */
export interface DataQueryAppPlugin<
  TRow extends Record<string, unknown>,
  TAction extends Action = DataQueryCommandAction<TRow>,
  TRoute extends Route = Route,
> extends AppPlugin<TAction, TRoute> {
  readonly controller: DataQueryController<TRow>;
  inspect(): DataQueryPluginInspection<TRow>;
}

/** Creates an data Query Plugin. */
export function createDataQueryPlugin<
  TRow extends Record<string, unknown>,
  TAction extends Action = DataQueryCommandAction<TRow>,
  TRoute extends Route = Route,
  TParams extends DataQueryParams = DataQueryParams,
>(
  options: DataQueryPluginOptions<TRow, TParams>,
): DataQueryAppPlugin<TRow, TAction, TRoute> {
  const controller = options.controller ?? createController(options.controllerOptions);
  const id = options.id ?? "data-query";
  const label = options.label ?? "Data Query";

  return {
    id,
    label,
    controller,
    install(app) {
      const stack = new DisposableStack();
      let paramsBinding: DataQueryParamsBindingHandle<TParams> | undefined;
      let tableBinding: DataQueryTableBindingHandle | undefined;
      let paramsSetting: SettingBinding<ReturnType<DataQueryController<TRow>["params"]["peek"]>, unknown> | undefined;

      try {
        if (options.params && (options.bindParams ?? true)) {
          paramsBinding = bindDataQueryParams(
            controller,
            options.params,
            paramsBindingOptions(enabled(options.bindParams)),
          );
          stack.defer(paramsBinding.dispose);
        }

        if (options.table && (options.tableBinding ?? true)) {
          tableBinding = bindDataQueryTable(
            controller,
            options.table,
            tableBindingOptions(enabled(options.tableBinding)),
          );
          stack.defer(tableBinding.dispose);
        }

        const persistParams = options.persistParams ?? true;
        if (options.settings && persistParams) {
          const binding = bindDataQuerySetting(controller, options.settings, settingOptions(persistParams));
          paramsSetting = binding as SettingBinding<ReturnType<DataQueryController<TRow>["params"]["peek"]>, unknown>;
          stack.defer(binding.dispose);
        }

        if (options.commands ?? true) {
          const commandOptions = commandOptionsFrom(options.commands);
          stack.defer(bindDataQueryCommands(app.commands, controller, commandOptions));
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
            paramsBinding,
            tableBinding,
            paramsSetting,
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
        query: controller.inspect(),
        commandsEnabled: (options.commands ?? true) !== false,
        settingsEnabled: options.settings !== undefined,
        paramsPersistenceEnabled: options.settings !== undefined && (options.persistParams ?? true) !== false,
        paramsBindingEnabled: options.params !== undefined && (options.bindParams ?? true) !== false,
        tableBindingEnabled: options.table !== undefined && (options.tableBinding ?? true) !== false,
        keymapMirroringEnabled: options.mirrorKeymap !== undefined && options.mirrorKeymap !== false,
      };
    },
  };
}

function createController<TRow extends Record<string, unknown>>(
  options: DataQueryControllerOptions<TRow> | undefined,
): DataQueryController<TRow> {
  if (!options) {
    throw new Error("createDataQueryPlugin requires either controller or controllerOptions.");
  }
  return createDataQueryController(options);
}

function commandOptionsFrom(options: boolean | DataQueryCommandOptions | undefined): DataQueryCommandOptions {
  return typeof options === "object" ? options : {};
}

function keymapOptionsFrom(
  options: true | CommandKeymapBindingOptions,
  commandOptions: DataQueryCommandOptions,
): CommandKeymapBindingOptions {
  return options === true ? { group: commandOptions.group ?? "query" } : options;
}

function paramsBindingOptions<TRow, TParams extends DataQueryParams>(
  options: true | DataQueryPluginOptions<TRow & Record<string, unknown>, TParams>["bindParams"],
): Omit<Parameters<typeof bindDataQueryParams<TRow & Record<string, unknown>, TParams>>[2], "initialRestore"> {
  return typeof options === "object" ? options : {};
}

function tableBindingOptions<TRow extends Record<string, unknown>>(
  options: true | DataQueryTableBindingOptions<TRow>,
): DataQueryTableBindingOptions<TRow> {
  return typeof options === "object" ? options : {};
}

function settingOptions<TOptions>(options: true | TOptions): TOptions {
  return options === true ? {} as TOptions : options;
}

function enabled<TOptions>(options: boolean | TOptions | undefined): true | TOptions {
  return options === undefined || options === true ? true : options as TOptions;
}
