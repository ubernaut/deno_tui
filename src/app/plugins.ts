// Copyright 2023 Im-Beast. MIT license.
import type { Focusable } from "../focus.ts";
import { bindingId, type KeyBinding } from "../keymap.ts";
import type { Action, ActionMiddleware } from "./actions.ts";
import type { AppPlugin, AppPluginDisposer, TuiApp } from "./app.ts";
import type { Command } from "./commands.ts";
import type { Route, RouteRegisterOptions, RouteUnregisterOptions } from "./router.ts";

export interface AppPluginRoute<TRoute extends Route = Route> {
  route: TRoute;
  options?: RouteRegisterOptions;
  unregisterOptions?: RouteUnregisterOptions;
}

export interface AppPluginDefinition<TAction extends Action = Action, TRoute extends Route = Route> {
  id?: string;
  label?: string;
  routes?: readonly (TRoute | AppPluginRoute<TRoute>)[];
  actionMiddleware?: readonly ActionMiddleware<TAction>[];
  commands?: readonly Command<TAction>[];
  keyBindings?: readonly KeyBinding[];
  focusItems?: readonly Focusable[];
  install?: (app: TuiApp<TAction, TRoute>) => AppPluginDisposer;
}

export interface AppPluginDefinitionInspection {
  id?: string;
  label?: string;
  routes: string[];
  actionMiddleware: number;
  commands: string[];
  keyBindings: string[];
  focusItems: number;
  hasInstaller: boolean;
}

export function createAppPlugin<TAction extends Action = Action, TRoute extends Route = Route>(
  definition: AppPluginDefinition<TAction, TRoute>,
): AppPlugin<TAction, TRoute> {
  return {
    id: definition.id,
    label: definition.label,
    install(app) {
      const disposers: Array<() => void> = [];
      try {
        for (const entry of definition.routes ?? []) {
          const routeEntry = normalizePluginRoute(entry);
          app.routes.register(routeEntry.route, routeEntry.options);
          disposers.push(() => app.routes.unregister(routeEntry.route.id, routeEntry.unregisterOptions));
        }

        if (definition.commands?.length) {
          disposers.push(app.commands.registerAll(definition.commands));
        }

        for (const middleware of definition.actionMiddleware ?? []) {
          disposers.push(app.useActionMiddleware(middleware));
        }

        if (definition.keyBindings?.length) {
          disposers.push(app.keymap.registerAll(definition.keyBindings));
        }

        if (definition.focusItems?.length) {
          disposers.push(app.focus.registerAll(definition.focusItems));
        }

        const customDisposer = definition.install?.(app);
        if (customDisposer) disposers.push(customDisposer);
      } catch (error) {
        disposeReverse(disposers);
        throw error;
      }

      return () => disposeReverse(disposers);
    },
  };
}

export function inspectAppPluginDefinition<TAction extends Action = Action, TRoute extends Route = Route>(
  definition: AppPluginDefinition<TAction, TRoute>,
): AppPluginDefinitionInspection {
  return {
    id: definition.id,
    label: definition.label,
    routes: (definition.routes ?? []).map((entry) => normalizePluginRoute(entry).route.id),
    actionMiddleware: definition.actionMiddleware?.length ?? 0,
    commands: (definition.commands ?? []).map((command) => command.id),
    keyBindings: (definition.keyBindings ?? []).map(bindingId),
    focusItems: definition.focusItems?.length ?? 0,
    hasInstaller: definition.install !== undefined,
  };
}

function normalizePluginRoute<TRoute extends Route>(
  entry: TRoute | AppPluginRoute<TRoute>,
): AppPluginRoute<TRoute> {
  return "route" in entry ? entry : { route: entry };
}

function disposeReverse(disposers: Array<() => void>): void {
  for (const dispose of [...disposers].reverse()) {
    dispose();
  }
}
