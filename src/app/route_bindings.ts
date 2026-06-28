// Copyright 2023 Im-Beast. MIT license.
import { Signal } from "../signals/mod.ts";
import type { Route, RouteManager } from "./router.ts";

export interface RouteSignalBindingOptions {
  initialSync?: "route" | "signal";
  fallbackRouteId?: string;
  onInvalidRoute?: (routeId: string) => void;
}

export type RouteIdSource = readonly string[] | Signal<readonly string[]>;

export interface RouteIndexBindingOptions {
  routeIds?: RouteIdSource;
  initialSync?: "route" | "index";
  fallbackRouteId?: string;
  onInvalidIndex?: (index: number) => void;
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

export function bindRouteIndex<TRoute extends Route = Route>(
  routes: RouteManager<TRoute>,
  activeIndex: Signal<number>,
  options: RouteIndexBindingOptions = {},
): () => void {
  const routeIdsSignal = options.routeIds instanceof Signal ? options.routeIds : undefined;
  let syncing = false;

  const routeIds = () => {
    const ids: readonly string[] | undefined = routeIdsSignal
      ? routeIdsSignal.peek()
      : options.routeIds as readonly string[] | undefined;
    if (ids) return ids.filter((id: string) => routes.routes.peek().some((route) => route.id === id));
    return routes.routes.peek().map((route) => route.id);
  };
  const routeIdAt = (index: number) => {
    const ids = routeIds();
    return ids[clampRouteIndex(index, ids.length)];
  };
  const routeIndex = (routeId: string) => routeIds().indexOf(routeId);
  const fallbackIndex = () => {
    const ids = routeIds();
    if (ids.length === 0) return 0;
    if (options.fallbackRouteId) {
      const fallback = ids.indexOf(options.fallbackRouteId);
      if (fallback >= 0) return fallback;
    }
    return 0;
  };

  const syncIndexFromRoute = () => {
    if (syncing) return;
    let next = routeIndex(routes.activeRouteId.peek());
    if (next < 0) {
      next = fallbackIndex();
      const routeId = routeIdAt(next);
      if (routeId && routes.activeRouteId.peek() !== routeId) {
        routes.navigate(routeId);
      }
    }
    if (activeIndex.peek() === next) return;

    syncing = true;
    activeIndex.value = next;
    syncing = false;
  };
  const syncRouteFromIndex = (index: number) => {
    if (syncing) return;
    const ids = routeIds();
    if (ids.length === 0) {
      if (activeIndex.peek() !== 0) {
        syncing = true;
        activeIndex.value = 0;
        syncing = false;
      }
      return;
    }

    const nextIndex = clampRouteIndex(index, ids.length);
    if (nextIndex !== index) {
      options.onInvalidIndex?.(index);
    }
    const routeId = ids[nextIndex];
    if (!routeId) return;
    if (activeIndex.peek() !== nextIndex) {
      syncing = true;
      activeIndex.value = nextIndex;
      syncing = false;
    }
    if (routes.activeRouteId.peek() !== routeId) {
      routes.navigate(routeId);
    }
  };

  if (options.initialSync === "index") {
    syncRouteFromIndex(activeIndex.peek());
  } else {
    syncIndexFromRoute();
  }

  routes.activeRouteId.subscribe(syncIndexFromRoute);
  routes.routes.subscribe(syncIndexFromRoute);
  activeIndex.subscribe(syncRouteFromIndex);
  routeIdsSignal?.subscribe(syncIndexFromRoute);

  return () => {
    routes.activeRouteId.unsubscribe(syncIndexFromRoute);
    routes.routes.unsubscribe(syncIndexFromRoute);
    activeIndex.unsubscribe(syncRouteFromIndex);
    routeIdsSignal?.unsubscribe(syncIndexFromRoute);
  };
}

function clampRouteIndex(index: number, length: number): number {
  if (length <= 0) return 0;
  return Math.max(0, Math.min(Math.floor(index), length - 1));
}
