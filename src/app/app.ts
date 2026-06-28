// Copyright 2023 Im-Beast. MIT license.
import { FocusManager } from "../focus.ts";
import { KeymapRegistry } from "../keymap.ts";
import { Tui, type TuiOptions } from "../tui.ts";
import { type Action, ActionBus } from "./actions.ts";
import { CommandRegistry } from "./commands.ts";
import { type Route, RouteManager } from "./router.ts";

export interface TuiAppOptions<TRoute extends Route = Route> {
  tui?: Tui;
  tuiOptions?: TuiOptions;
  routes?: readonly TRoute[];
  initialRouteId?: string;
}

export class TuiApp<TAction extends Action = Action, TRoute extends Route = Route> {
  readonly tui: Tui;
  readonly actions = new ActionBus<TAction>();
  readonly commands = new CommandRegistry<TAction>();
  readonly focus = new FocusManager();
  readonly keymap = new KeymapRegistry();
  readonly routes: RouteManager<TRoute>;

  constructor(options: TuiAppOptions<TRoute> = {}) {
    this.tui = options.tui ?? new Tui(options.tuiOptions ?? {});
    this.routes = new RouteManager(options.routes ?? [], options.initialRouteId);
  }

  start(): void {
    this.tui.dispatch();
    this.tui.run();
  }

  destroy(): void {
    this.tui.destroy();
  }

  executeCommand(id: string): Promise<boolean> {
    return this.commands.execute(id, (action) => this.actions.dispatch(action));
  }
}

export function createApp<TAction extends Action = Action, TRoute extends Route = Route>(
  options: TuiAppOptions<TRoute> = {},
): TuiApp<TAction, TRoute> {
  return new TuiApp<TAction, TRoute>(options);
}
