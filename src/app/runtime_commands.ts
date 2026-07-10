// Copyright 2023 Im-Beast. MIT license.
import type {
  RuntimeRendererBackendController,
  RuntimeRendererBackendControllerOptions,
} from "../runtime/renderer_backends.ts";
import { createRuntimeRendererBackendController } from "../runtime/renderer_backends.ts";
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
  bindRuntimeRendererBackendSetting,
  type RuntimeProfileSettingBindingOptions,
  type RuntimeRendererBackendSettingBindingOptions,
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
    commands.push(...runtimeCycleCommands<RuntimeProfileCommandAction>(prefix, group, {
      type: "runtime.profile.changed",
      label: "Runtime Profile",
      description: "runtime strategy profile",
      keywords: (kind) => ["runtime", "profile", kind, "strategy"],
      activeId: () => controller.activeId.peek(),
      ids: () => controller.ids(),
      cycle: (direction) => direction === 1 ? controller.nextProfile() : controller.previousProfile(),
    }));
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
      return DisposableStack.collect((stack) => {
        let profileSetting: SettingBinding<string, unknown> | undefined;
        const persistProfile = options.persistProfile ?? true;
        if (options.settings && persistProfile) {
          const binding = bindRuntimeProfileSetting<unknown>(
            controller,
            options.settings,
            runtimeSettingOptions(persistProfile),
          );
          profileSetting = binding;
          stack.defer(binding.dispose);
        }

        if (options.commands ?? true) {
          const commandOptions = runtimeCommandOptions<RuntimeProfileCommandOptions>(options.commands);
          stack.defer(bindRuntimeProfileCommands(app.commands, controller, commandOptions));
          if (options.mirrorKeymap) {
            stack.defer(
              bindCommandKeymap(
                app.commands,
                app.keymap,
                runtimeKeymapOptions(options.mirrorKeymap, commandOptions),
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
      });
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

/** Options for configuring the runtime renderer backend plugin. */
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

/** Context object passed to runtime renderer backend plugin install callbacks. */
export interface RuntimeRendererBackendPluginInstallContext {
  app: TuiApp<Action, Route>;
  controller: RuntimeRendererBackendController;
  backendSetting?: SettingBinding<string, unknown>;
}

/** Serializable inspection snapshot for the runtime renderer backend plugin. */
export interface RuntimeRendererBackendPluginInspection {
  id?: string;
  label?: string;
  controller: ReturnType<RuntimeRendererBackendController["inspect"]>;
  commandsEnabled: boolean;
  settingsEnabled: boolean;
  backendPersistenceEnabled: boolean;
  keymapMirroringEnabled: boolean;
}

/** Public interface describing a runtime renderer backend app plugin. */
export interface RuntimeRendererBackendAppPlugin<
  TAction extends Action = RuntimeRendererBackendCommandAction,
  TRoute extends Route = Route,
> extends AppPlugin<TAction, TRoute> {
  readonly controller: RuntimeRendererBackendController;
  inspect(): RuntimeRendererBackendPluginInspection;
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
    commands.push(...runtimeCycleCommands<RuntimeRendererBackendCommandAction>(prefix, group, {
      type: "runtime.renderer.changed",
      label: "Renderer Backend",
      description: "renderer backend",
      keywords: (kind) => ["runtime", "renderer", "backend", kind],
      activeId: () => controller.activeId.peek(),
      ids: () => controller.ids(),
      cycle: (direction) => direction === 1 ? controller.nextBackend() : controller.previousBackend(),
    }));
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

/** Creates a runtime renderer backend plugin. */
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
      return DisposableStack.collect((stack) => {
        let backendSetting: SettingBinding<string, unknown> | undefined;
        const persistBackend = options.persistBackend ?? true;
        if (options.settings && persistBackend) {
          const binding = bindRuntimeRendererBackendSetting<unknown>(
            controller,
            options.settings,
            runtimeSettingOptions(persistBackend),
          );
          backendSetting = binding;
          stack.defer(binding.dispose);
        }

        if (options.commands ?? true) {
          const commandOptions = runtimeCommandOptions<RuntimeRendererBackendCommandOptions>(options.commands);
          stack.defer(bindRuntimeRendererBackendCommands(app.commands, controller, commandOptions));
          if (options.mirrorKeymap) {
            stack.defer(
              bindCommandKeymap(
                app.commands,
                app.keymap,
                runtimeKeymapOptions(options.mirrorKeymap, commandOptions),
              ),
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
      });
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

type RuntimeCycleCommandKind = "next" | "previous";
type RuntimeCycleDirection = -1 | 1;

interface RuntimeCycleCommandProfile<TAction extends Action> {
  type: TAction["type"] & string;
  label: string;
  description: string;
  keywords: (kind: RuntimeCycleCommandKind) => readonly string[];
  activeId: () => string;
  ids: () => readonly string[];
  cycle: (direction: RuntimeCycleDirection) => string;
}

function runtimeCycleCommands<TAction extends Action>(
  idPrefix: string,
  group: string,
  profile: RuntimeCycleCommandProfile<TAction>,
): Command<TAction>[] {
  const command = (kind: RuntimeCycleCommandKind, direction: RuntimeCycleDirection): Command<TAction> => ({
    id: `${idPrefix}.${kind}`,
    label: `${kind === "next" ? "Next" : "Previous"} ${profile.label}`,
    description: `Cycle to the ${kind} ${profile.description}.`,
    group,
    keywords: profile.keywords(kind),
    disabled: () => profile.ids().length <= 1,
    action: () => {
      const previousId = profile.activeId();
      const id = profile.cycle(direction);
      return { type: profile.type, payload: { id, previousId, direction } } as TAction;
    },
  });
  return [command("next", 1), command("previous", -1)];
}

function runtimeCommandOptions<TOptions>(options: boolean | TOptions | undefined): TOptions {
  return typeof options === "object" ? options : {} as TOptions;
}

function runtimeKeymapOptions(
  options: true | CommandKeymapBindingOptions,
  commandOptions: { group?: string },
): CommandKeymapBindingOptions {
  return options === true ? { group: commandOptions.group ?? "runtime" } : options;
}

function runtimeSettingOptions<TOptions>(options: true | TOptions): TOptions {
  return options === true ? {} as TOptions : options;
}
