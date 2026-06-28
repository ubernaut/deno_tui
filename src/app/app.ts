// Copyright 2023 Im-Beast. MIT license.
import { bindFocusNavigation, FocusManager, type FocusNavigationOptions } from "../focus.ts";
import { KeymapRegistry } from "../keymap.ts";
import { Tui, type TuiOptions } from "../tui.ts";
import { type Action, ActionBus } from "./actions.ts";
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
  install(app: TuiApp<TAction, TRoute>): AppPluginDisposer;
}

export type AppPluginFactory<TAction extends Action = Action, TRoute extends Route = Route> = (
  app: TuiApp<TAction, TRoute>,
) => AppPluginDisposer;

export type AppPluginInstaller<TAction extends Action = Action, TRoute extends Route = Route> =
  | AppPlugin<TAction, TRoute>
  | AppPluginFactory<TAction, TRoute>;

export class TuiApp<TAction extends Action = Action, TRoute extends Route = Route> {
  readonly tui: Tui;
  readonly actions = new ActionBus<TAction>();
  readonly commands = new CommandRegistry<TAction>();
  readonly focus = new FocusManager();
  readonly keymap = new KeymapRegistry();
  readonly routes: RouteManager<TRoute>;
  readonly #disposers = new Set<() => void>();
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

  enableFocusNavigation(options: FocusNavigationOptions = {}): () => void {
    return this.onDispose(bindFocusNavigation(this.tui, this.focus, options));
  }

  enableCommandKeys(options: CommandKeyBindingOptions = {}): () => void {
    return this.onDispose(bindCommandKeys(this.tui, this.commands, (action) => this.actions.dispatch(action), options));
  }

  enableCommandKeymap(options: CommandKeymapBindingOptions = {}): () => void {
    return this.onDispose(bindCommandKeymap(this.commands, this.keymap, options));
  }

  use(plugin: AppPluginInstaller<TAction, TRoute>): () => void {
    const disposer = typeof plugin === "function" ? plugin(this) : plugin.install(this);
    return this.onDispose(disposer ?? (() => undefined));
  }

  useAll(plugins: Iterable<AppPluginInstaller<TAction, TRoute>>): () => void {
    const disposers: Array<() => void> = [];
    try {
      for (const plugin of plugins) {
        const disposer = typeof plugin === "function" ? plugin(this) : plugin.install(this);
        if (disposer) {
          disposers.push(disposer);
        }
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
}

export function createApp<TAction extends Action = Action, TRoute extends Route = Route>(
  options: TuiAppOptions<TRoute> = {},
): TuiApp<TAction, TRoute> {
  return new TuiApp<TAction, TRoute>(options);
}
