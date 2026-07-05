// Copyright 2023 Im-Beast. MIT license.
import type { RuntimeRendererBackendController } from "../runtime/renderer_backends.ts";
import type { RuntimeProfileController, RuntimeProfileControllerOptions } from "../runtime/profiles.ts";
import { createRuntimeProfileController } from "../runtime/profiles.ts";
import type { RuntimeWorkloadRegistry, RuntimeWorkloadReport } from "../runtime/telemetry.ts";
import type { Action } from "./actions.ts";
import type { AppPlugin, AppPluginDisposer, TuiApp } from "./app.ts";
import { bindCommandKeymap, type CommandKeymapBindingOptions } from "./command_bindings.ts";
import type { Command, CommandRegistry } from "./commands.ts";
import { DisposableStack } from "./disposables.ts";
import type { Route } from "./router.ts";
import type { SettingsController } from "./settings.ts";
import {
  bindRuntimeProfileSetting,
  type RuntimeProfileSettingBindingOptions,
  type SettingBinding,
} from "./settings_bindings.ts";

/** Action union emitted by runtime Profile Command command helpers. */
export type RuntimeProfileCommandAction = Action<"runtime.profile.changed", RuntimeProfileChangedPayload>;

/** Payload carried by runtime Profile Changed actions. */
export interface RuntimeProfileChangedPayload {
  id: string;
  previousId: string;
  direction?: number;
}

/** Options for configuring runtime Profile Command. */
export interface RuntimeProfileCommandOptions {
  group?: string;
  prefix?: string;
  includeCycleCommands?: boolean;
  includeProfileCommands?: boolean;
  disableActiveProfile?: boolean;
}

/** Options for configuring the runtime profile plugin. */
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

/** Context object passed to runtime profile plugin install callbacks. */
export interface RuntimeProfilePluginInstallContext {
  app: TuiApp<Action, Route>;
  controller: RuntimeProfileController;
  profileSetting?: SettingBinding<string, unknown>;
}

/** Serializable inspection snapshot for the runtime profile plugin. */
export interface RuntimeProfilePluginInspection {
  id?: string;
  label?: string;
  controller: ReturnType<RuntimeProfileController["inspect"]>;
  commandsEnabled: boolean;
  settingsEnabled: boolean;
  profilePersistenceEnabled: boolean;
  keymapMirroringEnabled: boolean;
}

/** Public interface describing a runtime profile app plugin. */
export interface RuntimeProfileAppPlugin<
  TAction extends Action = RuntimeProfileCommandAction,
  TRoute extends Route = Route,
> extends AppPlugin<TAction, TRoute> {
  readonly controller: RuntimeProfileController;
  inspect(): RuntimeProfilePluginInspection;
}

/** Builds command definitions for runtime Profile. */
export function runtimeProfileCommands(
  controller: RuntimeProfileController,
  options: RuntimeProfileCommandOptions = {},
): Command<RuntimeProfileCommandAction>[] {
  const group = options.group ?? "runtime";
  const prefix = options.prefix ?? "runtime.profile";
  const commands: Command<RuntimeProfileCommandAction>[] = [];

  if (options.includeCycleCommands ?? true) {
    commands.push(
      {
        id: `${prefix}.next`,
        label: "Next Runtime Profile",
        description: "Cycle to the next runtime strategy profile.",
        group,
        keywords: ["runtime", "profile", "next", "strategy"],
        disabled: () => controller.ids().length <= 1,
        action: () => {
          const previousId = controller.activeId.peek();
          const id = controller.nextProfile();
          return { type: "runtime.profile.changed", payload: { id, previousId, direction: 1 } };
        },
      },
      {
        id: `${prefix}.previous`,
        label: "Previous Runtime Profile",
        description: "Cycle to the previous runtime strategy profile.",
        group,
        keywords: ["runtime", "profile", "previous", "strategy"],
        disabled: () => controller.ids().length <= 1,
        action: () => {
          const previousId = controller.activeId.peek();
          const id = controller.previousProfile();
          return { type: "runtime.profile.changed", payload: { id, previousId, direction: -1 } };
        },
      },
    );
  }

  if (options.includeProfileCommands ?? true) {
    for (const profile of controller.registry.inspect()) {
      commands.push({
        id: `${prefix}.set.${profile.id}`,
        label: `Runtime Profile: ${profile.label}`,
        description: profile.description ?? `Switch to the ${profile.label} runtime strategy profile.`,
        group,
        keywords: ["runtime", "profile", "strategy", profile.id, profile.label, ...profile.tags],
        disabled: options.disableActiveProfile ?? true ? () => controller.activeId.peek() === profile.id : false,
        action: () => {
          const previousId = controller.activeId.peek();
          controller.setProfile(profile.id);
          return { type: "runtime.profile.changed", payload: { id: controller.activeId.peek(), previousId } };
        },
      });
    }
  }

  return commands;
}

/** Binds runtime Profile Commands behavior and returns a disposer when applicable. */
export function bindRuntimeProfileCommands<TAction extends Action = RuntimeProfileCommandAction>(
  registry: CommandRegistry<TAction>,
  controller: RuntimeProfileController,
  options: RuntimeProfileCommandOptions = {},
): () => void {
  return registry.registerAll(runtimeProfileCommands(controller, options) as unknown as Command<TAction>[]);
}

/** Creates a runtime profile plugin. */
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
            runtimeProfileSettingOptions(persistProfile),
          );
          profileSetting = binding;
          stack.defer(binding.dispose);
        }

        if (options.commands ?? true) {
          const commandOptions = runtimeProfileCommandOptions(options.commands);
          stack.defer(bindRuntimeProfileCommands(app.commands, controller, commandOptions));
          if (options.mirrorKeymap) {
            stack.defer(
              bindCommandKeymap(
                app.commands,
                app.keymap,
                runtimeProfileKeymapOptions(options.mirrorKeymap, commandOptions),
              ),
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

/** Action union emitted by runtime Renderer Backend Command command helpers. */
export type RuntimeRendererBackendCommandAction = Action<
  "runtime.renderer.changed",
  RuntimeRendererBackendChangedPayload
>;

/** Payload carried by runtime Renderer Backend Changed actions. */
export interface RuntimeRendererBackendChangedPayload {
  id: string;
  previousId: string;
  direction?: number;
  selected?: boolean;
}

/** Options for configuring runtime Renderer Backend Command. */
export interface RuntimeRendererBackendCommandOptions {
  group?: string;
  prefix?: string;
  includeCycleCommands?: boolean;
  includeBackendCommands?: boolean;
  includeSelectCommand?: boolean;
  disableActiveBackend?: boolean;
}

/** Builds command definitions for runtime Renderer Backend. */
export function runtimeRendererBackendCommands(
  controller: RuntimeRendererBackendController,
  options: RuntimeRendererBackendCommandOptions = {},
): Command<RuntimeRendererBackendCommandAction>[] {
  const group = options.group ?? "runtime";
  const prefix = options.prefix ?? "runtime.renderer";
  const commands: Command<RuntimeRendererBackendCommandAction>[] = [];

  if (options.includeCycleCommands ?? true) {
    commands.push(
      {
        id: `${prefix}.next`,
        label: "Next Renderer Backend",
        description: "Cycle to the next renderer backend.",
        group,
        keywords: ["runtime", "renderer", "backend", "next"],
        disabled: () => controller.ids().length <= 1,
        action: () => {
          const previousId = controller.activeId.peek();
          const id = controller.nextBackend();
          return { type: "runtime.renderer.changed", payload: { id, previousId, direction: 1 } };
        },
      },
      {
        id: `${prefix}.previous`,
        label: "Previous Renderer Backend",
        description: "Cycle to the previous renderer backend.",
        group,
        keywords: ["runtime", "renderer", "backend", "previous"],
        disabled: () => controller.ids().length <= 1,
        action: () => {
          const previousId = controller.activeId.peek();
          const id = controller.previousBackend();
          return { type: "runtime.renderer.changed", payload: { id, previousId, direction: -1 } };
        },
      },
    );
  }

  if (options.includeSelectCommand ?? true) {
    commands.push({
      id: `${prefix}.select`,
      label: "Select Renderer Backend",
      description: "Select the best available renderer backend for current runtime capabilities.",
      group,
      keywords: ["runtime", "renderer", "backend", "select", "auto"],
      disabled: () => controller.selected()?.id === controller.activeId.peek(),
      action: () => {
        const previousId = controller.activeId.peek();
        const id = controller.setSelectedBackend();
        return { type: "runtime.renderer.changed", payload: { id, previousId, selected: true } };
      },
    });
  }

  if (options.includeBackendCommands ?? true) {
    for (const backend of controller.registry.inspect(controller.capabilities())) {
      const currentBackend = () => controller.registry.get(backend.id)?.inspect(controller.capabilities());
      const unavailable = () => currentBackend()?.available !== true;
      commands.push({
        id: `${prefix}.set.${backend.id}`,
        label: `Renderer Backend: ${backend.label}`,
        description: backend.description ?? `Switch to the ${backend.label} renderer backend.`,
        group,
        keywords: [
          "runtime",
          "renderer",
          "backend",
          backend.id,
          backend.label,
          backend.strategy,
          ...backend.capabilities,
          ...backend.tags,
        ],
        disabled: () =>
          unavailable() || ((options.disableActiveBackend ?? true) && controller.activeId.peek() === backend.id),
        action: () => {
          const previousId = controller.activeId.peek();
          if (!unavailable()) controller.setBackend(backend.id);
          return { type: "runtime.renderer.changed", payload: { id: controller.activeId.peek(), previousId } };
        },
      });
    }
  }

  return commands;
}

/** Binds runtime Renderer Backend Commands behavior and returns a disposer when applicable. */
export function bindRuntimeRendererBackendCommands<
  TAction extends Action = RuntimeRendererBackendCommandAction,
>(
  registry: CommandRegistry<TAction>,
  controller: RuntimeRendererBackendController,
  options: RuntimeRendererBackendCommandOptions = {},
): () => void {
  return registry.registerAll(runtimeRendererBackendCommands(controller, options) as unknown as Command<TAction>[]);
}

/** Action union emitted by runtime Workload Command command helpers. */
export type RuntimeWorkloadCommandAction = Action<"runtime.workloads.reported", RuntimeWorkloadReportedPayload>;

/** Payload carried by runtime Workload Reported actions. */
export interface RuntimeWorkloadReportedPayload {
  report: RuntimeWorkloadReport;
  markdown?: string;
}

/** Options for configuring runtime Workload Command. */
export interface RuntimeWorkloadCommandOptions {
  group?: string;
  prefix?: string;
  title?: string;
  includeMarkdown?: boolean;
  disableEmpty?: boolean;
}

/** Builds command definitions for runtime Workload. */
export function runtimeWorkloadCommands(
  workloads: RuntimeWorkloadRegistry,
  options: RuntimeWorkloadCommandOptions = {},
): Command<RuntimeWorkloadCommandAction>[] {
  const group = options.group ?? "runtime";
  const prefix = options.prefix ?? "runtime.workloads";
  return [
    {
      id: `${prefix}.report`,
      label: "Runtime Workload Report",
      description: "Capture scheduler and worker-pool pressure telemetry.",
      group,
      keywords: ["runtime", "workload", "pressure", "telemetry", "scheduler", "worker"],
      disabled: options.disableEmpty ?? true ? () => workloads.inspect().count === 0 : false,
      action: () => {
        const report = workloads.report();
        return {
          type: "runtime.workloads.reported",
          payload: {
            report,
            markdown: options.includeMarkdown ?? true
              ? workloads.markdown({ title: options.title ?? "Runtime Workloads" })
              : undefined,
          },
        };
      },
    },
  ];
}

/** Binds runtime Workload Commands behavior and returns a disposer when applicable. */
export function bindRuntimeWorkloadCommands<TAction extends Action = RuntimeWorkloadCommandAction>(
  registry: CommandRegistry<TAction>,
  workloads: RuntimeWorkloadRegistry,
  options: RuntimeWorkloadCommandOptions = {},
): () => void {
  return registry.registerAll(runtimeWorkloadCommands(workloads, options) as unknown as Command<TAction>[]);
}

function runtimeProfileCommandOptions(
  options: boolean | RuntimeProfileCommandOptions | undefined,
): RuntimeProfileCommandOptions {
  return typeof options === "object" ? options : {};
}

function runtimeProfileKeymapOptions(
  options: true | CommandKeymapBindingOptions,
  commandOptions: RuntimeProfileCommandOptions,
): CommandKeymapBindingOptions {
  return options === true ? { group: commandOptions.group ?? "runtime" } : options;
}

function runtimeProfileSettingOptions<TOptions>(options: true | TOptions): TOptions {
  return options === true ? {} as TOptions : options;
}
