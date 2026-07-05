// Copyright 2023 Im-Beast. MIT license.
import { bindFocusNavigation, FocusManager, type FocusNavigationOptions } from "../focus.ts";
import { KeymapRegistry } from "../keymap.ts";
import { RuntimeWorkloadRegistry } from "../runtime/telemetry.ts";
import { Tui, type TuiOptions } from "../tui.ts";
import { type Action, ActionBus, type ActionHandler, type ActionMiddleware, type ActionOfType } from "./actions.ts";
import {
  bindCommandKeymap,
  bindCommandKeys,
  type CommandKeyBindingOptions,
  type CommandKeymapBindingOptions,
} from "./command_bindings.ts";
import { CommandRegistry, insertUniqueSortedString } from "./commands.ts";
import { DisposableStack } from "./disposables.ts";
import { bindMouseInteractions, MouseInteractionRouter } from "./mouse_bindings.ts";
import { type Route, RouteManager } from "./router.ts";

/** Construction options for a high-level TUI application shell. */
export interface TuiAppOptions<TRoute extends Route = Route> {
  tui?: Tui;
  tuiOptions?: TuiOptions;
  routes?: readonly TRoute[];
  initialRouteId?: string;
}

/** Cleanup callback returned by an app plugin installer. */
export type AppPluginDisposer = void | (() => void);

/** Reusable app module that can install commands, routes, bindings, and runtime resources. */
export interface AppPlugin<TAction extends Action = Action, TRoute extends Route = Route> {
  id?: string;
  label?: string;
  install(app: TuiApp<TAction, TRoute>): AppPluginDisposer;
}

/** Function-form app plugin installer. */
export type AppPluginFactory<TAction extends Action = Action, TRoute extends Route = Route> = (
  app: TuiApp<TAction, TRoute>,
) => AppPluginDisposer;

/** Object or function app plugin accepted by `TuiApp.use()`. */
export type AppPluginInstaller<TAction extends Action = Action, TRoute extends Route = Route> =
  | AppPlugin<TAction, TRoute>
  | AppPluginFactory<TAction, TRoute>;

/** Options for installing, labeling, or replacing an app plugin. */
export interface AppPluginUseOptions {
  id?: string;
  label?: string;
  replace?: boolean;
}

/** Serializable metadata for an installed app plugin. */
export interface AppPluginInspection {
  id: string;
  label: string;
}

/** Serializable route state for app diagnostics. */
export interface AppRouteInspection<TRoute extends Route = Route> {
  count: number;
  activeRouteId: string;
  active?: TRoute;
  ids: string[];
}

/** Serializable command registry state for app diagnostics. */
export interface AppCommandInspection {
  count: number;
  enabled: number;
  disabled: number;
  groups: string[];
}

/** Serializable keymap registry state for app diagnostics. */
export interface AppKeymapInspection {
  count: number;
  groups: string[];
}

/** Aggregate app state snapshot for status bars, diagnostics, and tests. */
export interface TuiAppInspection<TRoute extends Route = Route> {
  destroyed: boolean;
  disposers: number;
  actions: ReturnType<ActionBus["inspect"]>;
  routes: AppRouteInspection<TRoute>;
  commands: AppCommandInspection;
  keymap: AppKeymapInspection;
  focus: ReturnType<FocusManager["inspect"]>;
  mouse: ReturnType<MouseInteractionRouter["inspect"]>;
  workloads: ReturnType<RuntimeWorkloadRegistry["inspect"]>;
  plugins: AppPluginInspection[];
}

/** High-level composition root for routes, commands, focus, mouse, plugins, and runtime workloads. */
export class TuiApp<TAction extends Action = Action, TRoute extends Route = Route> {
  readonly tui: Tui;
  readonly actions = new ActionBus<TAction>();
  readonly commands = new CommandRegistry<TAction>();
  readonly focus = new FocusManager();
  readonly keymap = new KeymapRegistry();
  readonly mouse = new MouseInteractionRouter();
  readonly workloads = new RuntimeWorkloadRegistry();
  readonly routes: RouteManager<TRoute>;
  readonly #disposers = new Set<() => void>();
  readonly #plugins = new Map<string, AppPluginInspection & { dispose: () => void }>();
  #pluginIds: string[] | undefined;
  #pluginInspections: AppPluginInspection[] | undefined;
  #destroyed = false;

  constructor(options: TuiAppOptions<TRoute> = {}) {
    this.tui = options.tui ?? new Tui(options.tuiOptions ?? {});
    this.routes = new RouteManager(options.routes ?? [], options.initialRouteId);
  }

  /** Starts rendering and input dispatch on the underlying `Tui`. */
  start(): void {
    this.tui.dispatch();
    this.tui.run();
  }

  /** Disposes app resources and destroys the underlying `Tui` once. */
  destroy(): void {
    if (this.#destroyed) return;
    this.#destroyed = true;
    this.dispose();
    this.tui.destroy();
  }

  /** Executes a registered command by id through the app action bus. */
  executeCommand(id: string): Promise<boolean> {
    return this.commands.execute(id, (action) => this.actions.dispatch(action));
  }

  /** Subscribes to every action and automatically removes the handler on app disposal. */
  onAction(handler: ActionHandler<TAction>): () => void {
    return this.onDispose(this.actions.subscribe(handler));
  }

  /** Subscribes to one action type and automatically removes the handler on app disposal. */
  onActionType<TType extends TAction["type"]>(
    type: TType,
    handler: ActionHandler<ActionOfType<TAction, TType>>,
  ): () => void {
    return this.onDispose(this.actions.subscribeType(type, handler));
  }

  /** Installs action middleware and automatically removes it on app disposal. */
  useActionMiddleware(middleware: ActionMiddleware<TAction>): () => void {
    return this.onDispose(this.actions.use(middleware));
  }

  /** Binds keyboard focus traversal to the app `Tui` and focus manager. */
  enableFocusNavigation(options: FocusNavigationOptions = {}): () => void {
    return this.onDispose(bindFocusNavigation(this.tui, this.focus, options));
  }

  /** Binds command key handling to the app `Tui`, command registry, and action bus. */
  enableCommandKeys(options: CommandKeyBindingOptions = {}): () => void {
    return this.onDispose(bindCommandKeys(this.tui, this.commands, (action) => this.actions.dispatch(action), options));
  }

  /** Mirrors command key bindings into the app keymap registry. */
  enableCommandKeymap(options: CommandKeymapBindingOptions = {}): () => void {
    return this.onDispose(bindCommandKeymap(this.commands, this.keymap, options));
  }

  /** Routes decoded terminal mouse events through the app mouse interaction router. */
  enableMouseInteractions(): () => void {
    return this.onDispose(bindMouseInteractions(this.tui, this.mouse));
  }

  /** Installs one plugin and tracks its disposer with the app lifecycle. */
  use(plugin: AppPluginInstaller<TAction, TRoute>, options: AppPluginUseOptions = {}): () => void {
    return this.onDispose(this.installPlugin(plugin, options));
  }

  /** Installs multiple plugins with rollback if a later plugin fails. */
  useAll(
    plugins: Iterable<AppPluginInstaller<TAction, TRoute>>,
    options: AppPluginUseOptions = {},
  ): () => void {
    const stack = new DisposableStack();
    try {
      for (const plugin of plugins) {
        stack.defer(this.installPlugin(plugin, options));
      }
    } catch (error) {
      stack.dispose();
      throw error;
    }
    return this.onDispose(stack.dispose);
  }

  /** Returns whether an identified plugin is currently installed. */
  hasPlugin(id: string): boolean {
    return this.#plugins.has(id);
  }

  /** Returns installed plugin ids in registration order. */
  pluginIds(): string[] {
    return cloneStringArray(this.#cachedPluginIds());
  }

  /** Returns installed plugin metadata without exposing internal disposers. */
  plugins(): AppPluginInspection[] {
    return clonePluginInspections(this.#cachedPluginInspections());
  }

  /** Returns an aggregate app state snapshot. */
  inspect(): TuiAppInspection<TRoute> {
    const routes = this.routes.routes.peek();
    const commands = this.commands.list();
    const keyBindings = this.keymap.list();
    const routeIds: string[] = [];
    for (let index = 0; index < routes.length; index += 1) routeIds.push(routes[index]!.id);
    const commandGroups: string[] = [];
    let enabledCommands = 0;
    for (let index = 0; index < commands.length; index += 1) {
      const command = commands[index]!;
      if (this.commands.enabled(command)) enabledCommands += 1;
      if (command.group) insertUniqueSortedString(commandGroups, command.group);
    }
    const keymapGroups: string[] = [];
    for (let index = 0; index < keyBindings.length; index += 1) {
      const group = keyBindings[index]!.group;
      if (group) insertUniqueSortedString(keymapGroups, group);
    }
    return {
      destroyed: this.#destroyed,
      disposers: this.#disposers.size,
      actions: this.actions.inspect(),
      routes: {
        count: routes.length,
        activeRouteId: this.routes.activeRouteId.peek(),
        active: this.routes.active(),
        ids: routeIds,
      },
      commands: {
        count: commands.length,
        enabled: enabledCommands,
        disabled: commands.length - enabledCommands,
        groups: cloneStringArray(commandGroups),
      },
      keymap: {
        count: keyBindings.length,
        groups: cloneStringArray(keymapGroups),
      },
      focus: this.focus.inspect(),
      mouse: this.mouse.inspect(),
      workloads: this.workloads.inspect(),
      plugins: this.plugins(),
    };
  }

  /** Registers a disposer that runs at most once when removed or when the app is disposed. */
  onDispose(disposer: () => void): () => void {
    let active = true;
    const wrapped = () => {
      if (!active) return;
      active = false;
      this.#disposers.delete(wrapped);
      disposer();
    };
    if (this.#destroyed) {
      wrapped();
    } else {
      this.#disposers.add(wrapped);
    }
    return wrapped;
  }

  /** Runs tracked disposers without destroying the underlying `Tui`. */
  dispose(): void {
    for (const disposer of [...this.#disposers]) {
      disposer();
    }
  }

  private installPlugin(
    plugin: AppPluginInstaller<TAction, TRoute>,
    options: AppPluginUseOptions,
  ): () => void {
    const metadata = pluginMetadata(plugin, options);
    if (metadata?.id && this.#plugins.has(metadata.id)) {
      if (!options.replace) {
        return () => undefined;
      }
      this.#plugins.get(metadata.id)?.dispose();
    }

    let active = true;
    const pluginDisposer = typeof plugin === "function" ? plugin(this) : plugin.install(this);
    const dispose = () => {
      if (!active) return;
      active = false;
      if (metadata?.id && this.#plugins.get(metadata.id)?.dispose === dispose) {
        this.#plugins.delete(metadata.id);
        this.#invalidatePluginCache();
      }
      pluginDisposer?.();
    };
    if (metadata?.id) {
      this.#plugins.set(metadata.id, {
        ...metadata,
        dispose,
      });
      this.#invalidatePluginCache();
    }
    return dispose;
  }

  #cachedPluginIds(): readonly string[] {
    if (!this.#pluginIds) {
      const ids: string[] = [];
      for (const id of this.#plugins.keys()) ids.push(id);
      this.#pluginIds = ids;
    }
    return this.#pluginIds;
  }

  #cachedPluginInspections(): readonly AppPluginInspection[] {
    if (!this.#pluginInspections) {
      const plugins: AppPluginInspection[] = [];
      for (const plugin of this.#plugins.values()) plugins.push({ id: plugin.id, label: plugin.label });
      this.#pluginInspections = plugins;
    }
    return this.#pluginInspections;
  }

  #invalidatePluginCache(): void {
    this.#pluginIds = undefined;
    this.#pluginInspections = undefined;
  }
}

function cloneStringArray(values: readonly string[]): string[] {
  const output = new Array<string>(values.length);
  for (let index = 0; index < values.length; index += 1) output[index] = values[index]!;
  return output;
}

function clonePluginInspections(values: readonly AppPluginInspection[]): AppPluginInspection[] {
  const output = new Array<AppPluginInspection>(values.length);
  for (let index = 0; index < values.length; index += 1) {
    const plugin = values[index]!;
    output[index] = { id: plugin.id, label: plugin.label };
  }
  return output;
}

function pluginMetadata<TAction extends Action, TRoute extends Route>(
  plugin: AppPluginInstaller<TAction, TRoute>,
  options: AppPluginUseOptions,
): AppPluginInspection | undefined {
  const id = options.id ?? (typeof plugin === "function" ? undefined : plugin.id);
  if (!id) return undefined;
  return {
    id,
    label: options.label ?? (typeof plugin === "function" ? id : plugin.label ?? id),
  };
}

/** Creates a high-level TUI application shell. */
export function createApp<TAction extends Action = Action, TRoute extends Route = Route>(
  options: TuiAppOptions<TRoute> = {},
): TuiApp<TAction, TRoute> {
  return new TuiApp<TAction, TRoute>(options);
}
