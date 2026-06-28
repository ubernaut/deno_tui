// Copyright 2023 Im-Beast. MIT license.
import type { Route, RouteManager } from "./router.ts";
import type { HistoryStack } from "./history.ts";
import type { Action } from "./actions.ts";
import type { Command, CommandRegistry } from "./commands.ts";

export type HistoryCommandKind = "undo" | "redo" | "clear";

export interface HistoryCommandOptions {
  idPrefix?: string;
  group?: string;
  includeClear?: boolean;
  labels?: Partial<Record<HistoryCommandKind, string>>;
}

export interface RouteHistoryBindingOptions<TRoute extends Route = Route> {
  group?: string;
  label?: (previousRoute: TRoute, nextRoute: TRoute) => string;
  id?: (previousRoute: TRoute, nextRoute: TRoute) => string;
  navigate?: (routeId: string) => void | Promise<void>;
}

export function bindRouteHistory<TRoute extends Route = Route>(
  routes: RouteManager<TRoute>,
  history: HistoryStack,
  options: RouteHistoryBindingOptions<TRoute> = {},
): () => void {
  let previousId = routes.activeRouteId.peek();
  let replaying = false;

  const routeById = (id: string) => routes.routes.peek().find((route) => route.id === id);
  const navigate = options.navigate ?? ((routeId: string) => routes.navigate(routeId));
  const listener = (nextId: string) => {
    if (replaying || nextId === previousId) return;
    const previousRoute = routeById(previousId);
    const nextRoute = routeById(nextId);
    previousId = nextId;
    if (!previousRoute || !nextRoute) return;

    history.push({
      id: options.id?.(previousRoute, nextRoute) ?? `route.${previousRoute.id}.${nextRoute.id}`,
      label: options.label?.(previousRoute, nextRoute) ??
        `Route ${previousRoute.title ?? previousRoute.id} -> ${nextRoute.title ?? nextRoute.id}`,
      group: options.group ?? "routes",
      undo: () => replay(previousRoute.id),
      redo: () => replay(nextRoute.id),
    });
  };

  const replay = async (routeId: string) => {
    replaying = true;
    try {
      await navigate(routeId);
      previousId = routeId;
    } finally {
      replaying = false;
    }
  };

  routes.activeRouteId.subscribe(listener);

  return () => {
    routes.activeRouteId.unsubscribe(listener);
  };
}

export function historyCommands<TAction extends Action = Action>(
  history: HistoryStack,
  options: HistoryCommandOptions = {},
): Command<TAction>[] {
  const idPrefix = options.idPrefix ?? "history";
  const group = options.group ?? "history";
  const label = (kind: HistoryCommandKind, fallback: string) => options.labels?.[kind] ?? fallback;
  const commands: Command<TAction>[] = [
    {
      id: `${idPrefix}.undo`,
      label: label("undo", "Undo"),
      group,
      binding: { key: "z", ctrl: true },
      disabled: () => !history.canUndo(),
      action: async () => {
        await history.undo();
      },
    },
    {
      id: `${idPrefix}.redo`,
      label: label("redo", "Redo"),
      group,
      binding: { key: "y", ctrl: true },
      disabled: () => !history.canRedo(),
      action: async () => {
        await history.redo();
      },
    },
  ];

  if (options.includeClear ?? false) {
    commands.push({
      id: `${idPrefix}.clear`,
      label: label("clear", "Clear History"),
      group,
      disabled: () => !history.canUndo() && !history.canRedo(),
      action: () => history.clear(),
    });
  }

  return commands;
}

export function bindHistoryCommands<TAction extends Action = Action>(
  registry: CommandRegistry<TAction>,
  history: HistoryStack,
  options: HistoryCommandOptions = {},
): () => void {
  return registry.registerAll(historyCommands<TAction>(history, options));
}
