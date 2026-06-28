// Copyright 2023 Im-Beast. MIT license.
import type { Route, RouteManager } from "./router.ts";
import type { HistoryStack } from "./history.ts";

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
