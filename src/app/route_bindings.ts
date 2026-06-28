// Copyright 2023 Im-Beast. MIT license.
import type { Signal } from "../signals/mod.ts";
import type { Route, RouteManager } from "./router.ts";

export interface RouteSignalBindingOptions {
  initialSync?: "route" | "signal";
  fallbackRouteId?: string;
  onInvalidRoute?: (routeId: string) => void;
}

export function bindRouteSignal<TRoute extends Route = Route>(
  routes: RouteManager<TRoute>,
  routeId: Signal<string>,
  options: RouteSignalBindingOptions = {},
): () => void {
  let syncing = false;

  const valid = (id: string) => routes.routes.peek().some((route) => route.id === id);
  const activeOrFallback = () => {
    const active = routes.activeRouteId.peek();
    if (valid(active)) return active;
    if (options.fallbackRouteId && valid(options.fallbackRouteId)) return options.fallbackRouteId;
    return routes.routes.peek()[0]?.id ?? "";
  };
  const syncSignalFromRoute = () => {
    const next = activeOrFallback();
    if (!next) return;
    if (routes.activeRouteId.peek() !== next) {
      routes.navigate(next);
    }
    if (routeId.peek() === next) return;
    syncing = true;
    routeId.value = next;
    syncing = false;
  };
  const syncRouteFromSignal = (next: string) => {
    if (syncing || routes.activeRouteId.peek() === next) return;
    if (valid(next)) {
      routes.navigate(next);
      return;
    }

    options.onInvalidRoute?.(next);
    syncSignalFromRoute();
  };

  if (options.initialSync === "signal") {
    syncRouteFromSignal(routeId.peek());
  } else {
    syncSignalFromRoute();
  }

  routes.activeRouteId.subscribe(syncSignalFromRoute);
  routes.routes.subscribe(syncSignalFromRoute);
  routeId.subscribe(syncRouteFromSignal);

  return () => {
    routes.activeRouteId.unsubscribe(syncSignalFromRoute);
    routes.routes.unsubscribe(syncSignalFromRoute);
    routeId.unsubscribe(syncRouteFromSignal);
  };
}
