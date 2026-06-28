// Copyright 2023 Im-Beast. MIT license.
import { bindFocusNavigation, FocusManager, type FocusNavigationOptions } from "../focus.ts";
import { KeymapRegistry } from "../keymap.ts";
import { Tui, type TuiOptions } from "../tui.ts";
import { type Action, ActionBus, type ActionHandler, type ActionMiddleware, type ActionOfType } from "./actions.ts";
import {
  bindCommandKeymap,
  bindCommandKeys,
  type CommandKeyBindingOptions,
  type CommandKeymapBindingOptions,
} from "./command_bindings.ts";
import { CommandRegistry } from "./commands.ts";
import { type Route, RouteManager } from "./router.ts";

export interface TuiAppOptions<TRoute extends Route = Route> {
  tui?: Tui;
  tuiOptions?: TuiOptions;
  routes?: readonly TRoute[];
  initialRouteId?: string;
}

export type AppPluginDisposer = void | (() => void);

export interface AppPlugin<TAction extends Action = Action, TRoute extends Route = Route> {
  id?: string;
  label?: string;
  install(app: TuiApp<TAction, TRoute>): AppPluginDisposer;
}

export type AppPluginFactory<TAction extends Action = Action, TRoute extends Route = Route> = (
  app: TuiApp<TAction, TRoute>,
) => AppPluginDisposer;

export type AppPluginInstaller<TAction extends Action = Action, TRoute extends Route = Route> =
  | AppPlugin<TAction, TRoute>
  | AppPluginFactory<TAction, TRoute>;

export interface AppPluginUseOptions {
  id?: string;
  label?: string;
  replace?: boolean;
}

export interface AppPluginInspection {
  id: string;
  label: string;
}

export interface AppRouteInspection<TRoute extends Route = Route> {
  count: number;
  activeRouteId: string;
  active?: TRoute;
  ids: string[];
}

export interface AppCommandInspection {
  count: number;
  enabled: number;
  disabled: number;
  groups: string[];
}

export interface AppKeymapInspection {
  count: number;
  groups: string[];
}

export interface TuiAppInspection<TRoute extends Route = Route> {
  destroyed: boolean;
  disposers: number;
  actions: ReturnType<ActionBus["inspect"]>;
  routes: AppRouteInspection<TRoute>;
  commands: AppCommandInspection;
  keymap: AppKeymapInspection;
  focus: ReturnType<FocusManager["inspect"]>;
  plugins: AppPluginInspection[];
}

export class TuiApp<TAction extends Action = Action, TRoute extends Route = Route> {
  readonly tui: Tui;
  readonly actions = new ActionBus<TAction>();
  readonly commands = new CommandRegistry<TAction>();
  readonly focus = new FocusManager();
  readonly keymap = new KeymapRegistry();
  readonly routes: RouteManager<TRoute>;
  readonly #disposers = new Set<() => void>();
  readonly #plugins = new Map<string, AppPluginInspection & { dispose: () => void }>();
  #destroyed = false;

  constructor(options: TuiAppOptions<TRoute> = {}) {
    this.tui = options.tui ?? new Tui(options.tuiOptions ?? {});
    this.routes = new RouteManager(options.routes ?? [], options.initialRouteId);
  }

  start(): void {
    this.tui.dispatch();
    this.tui.run();
  }

  destroy(): void {
    if (this.#destroyed) return;
    this.#destroyed = true;
    this.dispose();
    this.tui.destroy();
  }

  executeCommand(id: string): Promise<boolean> {
    return this.commands.execute(id, (action) => this.actions.dispatch(action));
  }

  onAction(handler: ActionHandler<TAction>): () => void {
    return this.onDispose(this.actions.subscribe(handler));
  }

  onActionType<TType extends TAction["type"]>(
    type: TType,
    handler: ActionHandler<ActionOfType<TAction, TType>>,
  ): () => void {
    return this.onDispose(this.actions.subscribeType(type, handler));
  }

  useActionMiddleware(middleware: ActionMiddleware<TAction>): () => void {
    return this.onDispose(this.actions.use(middleware));
  }

  enableFocusNavigation(options: FocusNavigationOptions = {}): () => void {
    return this.onDispose(bindFocusNavigation(this.tui, this.focus, options));
  }

  enableCommandKeys(options: CommandKeyBindingOptions = {}): () => void {
    return this.onDispose(bindCommandKeys(this.tui, this.commands, (action) => this.actions.dispatch(action), options));
  }

  enableCommandKeymap(options: CommandKeymapBindingOptions = {}): () => void {
    return this.onDispose(bindCommandKeymap(this.commands, this.keymap, options));
  }

  use(plugin: AppPluginInstaller<TAction, TRoute>, options: AppPluginUseOptions = {}): () => void {
    return this.onDispose(this.installPlugin(plugin, options));
  }

  useAll(
    plugins: Iterable<AppPluginInstaller<TAction, TRoute>>,
    options: AppPluginUseOptions = {},
  ): () => void {
    const disposers: Array<() => void> = [];
    try {
      for (const plugin of plugins) {
        disposers.push(this.installPlugin(plugin, options));
      }
    } catch (error) {
      for (const disposer of [...disposers].reverse()) {
        disposer();
      }
      throw error;
    }
    return this.onDispose(() => {
      for (const disposer of [...disposers].reverse()) {
        disposer();
      }
    });
  }

  hasPlugin(id: string): boolean {
    return this.#plugins.has(id);
  }

  pluginIds(): string[] {
    return [...this.#plugins.keys()];
  }

  plugins(): AppPluginInspection[] {
    return [...this.#plugins.values()].map(({ id, label }) => ({ id, label }));
  }

  inspect(): TuiAppInspection<TRoute> {
    const routes = this.routes.routes.peek();
    const commands = this.commands.list();
    const keyBindings = this.keymap.list();
    return {
      destroyed: this.#destroyed,
      disposers: this.#disposers.size,
      actions: this.actions.inspect(),
      routes: {
        count: routes.length,
        activeRouteId: this.routes.activeRouteId.peek(),
        active: this.routes.active(),
        ids: routes.map((route) => route.id),
      },
      commands: {
        count: commands.length,
        enabled: commands.filter((command) => this.commands.enabled(command)).length,
        disabled: commands.filter((command) => !this.commands.enabled(command)).length,
        groups: uniqueSorted(commands.map((command) => command.group)),
      },
      keymap: {
        count: keyBindings.length,
        groups: uniqueSorted(keyBindings.map((binding) => binding.group)),
      },
      focus: this.focus.inspect(),
      plugins: this.plugins(),
    };
  }

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
      }
      pluginDisposer?.();
    };
    if (metadata?.id) {
      this.#plugins.set(metadata.id, {
        ...metadata,
        dispose,
      });
    }
    return dispose;
  }
}

function uniqueSorted(values: Array<string | undefined>): string[] {
  return [...new Set(values.filter((value): value is string => !!value))].sort();
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

export function createApp<TAction extends Action = Action, TRoute extends Route = Route>(
  options: TuiAppOptions<TRoute> = {},
): TuiApp<TAction, TRoute> {
  return new TuiApp<TAction, TRoute>(options);
}
