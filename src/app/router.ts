// Copyright 2023 Im-Beast. MIT license.
import { Signal } from "../signals/mod.ts";

/** Public interface describing a route. */
export interface Route {
  id: string;
  title?: string;
}

/** Options for configuring route Register. */
export interface RouteRegisterOptions {
  activate?: boolean;
  replace?: boolean;
}

/** Options for configuring route Unregister. */
export interface RouteUnregisterOptions {
  fallbackRouteId?: string;
}

/** Serializable inspection snapshot for route. */
export interface RouteInspection<TRoute extends Route = Route> {
  count: number;
  activeRouteId: string;
  activeIndex: number;
  active?: TRoute;
  ids: string[];
  routes: TRoute[];
}

/** Public class implementing a route Manager. */
export class RouteManager<TRoute extends Route = Route> {
  readonly routes: Signal<TRoute[]>;
  readonly activeRouteId: Signal<string>;
  #pendingFallbackRouteId?: string;

  constructor(routes: readonly TRoute[], initialRouteId = routes[0]?.id ?? "") {
    this.routes = new Signal(cloneRoutes(routes), { deepObserve: true });
    this.activeRouteId = new Signal(initialRouteId);
    this.routes.subscribe(() => this.normalizeActiveRoute());
    this.normalizeActiveRoute();
  }

  active(): TRoute | undefined {
    return findRoute(this.routes.peek(), this.activeRouteId.peek());
  }

  get(routeId: string): TRoute | undefined {
    return findRoute(this.routes.peek(), routeId);
  }

  has(routeId: string): boolean {
    return this.get(routeId) !== undefined;
  }

  ids(): string[] {
    const routes = this.routes.peek();
    const ids = new Array<string>(routes.length);
    for (let index = 0; index < routes.length; index += 1) {
      ids[index] = routes[index]!.id;
    }
    return ids;
  }

  activeIndex(): number {
    return routeIndex(this.routes.peek(), this.activeRouteId.peek());
  }

  register(route: TRoute, options: RouteRegisterOptions = {}): boolean {
    const routes = this.routes.peek();
    const index = routeIndex(routes, route.id);
    if (index >= 0 && !options.replace) return false;

    this.routes.value = index >= 0 ? replaceRouteAt(routes, index, route) : appendRoute(routes, route);

    if (options.activate) {
      this.activeRouteId.value = route.id;
    }
    return true;
  }

  unregister(routeId: string, options: RouteUnregisterOptions = {}): boolean {
    const routes = this.routes.peek();
    if (routeIndex(routes, routeId) < 0) return false;

    this.#pendingFallbackRouteId = options.fallbackRouteId;
    this.routes.value = removeRoute(routes, routeId);
    this.#pendingFallbackRouteId = undefined;
    this.normalizeActiveRoute(options.fallbackRouteId);
    return true;
  }

  navigate(routeId: string): boolean {
    if (routeIndex(this.routes.peek(), routeId) < 0) {
      return false;
    }
    this.activeRouteId.value = routeId;
    return true;
  }

  next(): TRoute | undefined {
    return this.shift(1);
  }

  previous(): TRoute | undefined {
    return this.shift(-1);
  }

  inspect(): RouteInspection<TRoute> {
    const routes = this.routes.peek();
    return {
      count: routes.length,
      activeRouteId: this.activeRouteId.peek(),
      activeIndex: this.activeIndex(),
      active: this.active(),
      ids: this.ids(),
      routes: cloneRoutes(routes),
    };
  }

  private normalizeActiveRoute(fallbackRouteId = this.#pendingFallbackRouteId): void {
    const routes = this.routes.peek();
    const active = this.activeRouteId.peek();
    if (routeIndex(routes, active) >= 0) return;

    const fallback = fallbackRouteId && routeIndex(routes, fallbackRouteId) >= 0
      ? fallbackRouteId
      : routes[0]?.id ?? "";
    if (active !== fallback) {
      this.activeRouteId.value = fallback;
    }
  }

  private shift(delta: number): TRoute | undefined {
    const routes = this.routes.peek();
    if (routes.length === 0) return undefined;
    const currentIndex = Math.max(0, routeIndex(routes, this.activeRouteId.peek()));
    const nextRoute = routes[(currentIndex + delta + routes.length) % routes.length]!;
    this.activeRouteId.value = nextRoute.id;
    return nextRoute;
  }
}

function findRoute<TRoute extends Route>(routes: readonly TRoute[], routeId: string): TRoute | undefined {
  const index = routeIndex(routes, routeId);
  return index < 0 ? undefined : routes[index];
}

function routeIndex<TRoute extends Route>(routes: readonly TRoute[], routeId: string): number {
  for (let index = 0; index < routes.length; index += 1) {
    if (routes[index]!.id === routeId) return index;
  }
  return -1;
}

function cloneRoutes<TRoute extends Route>(routes: readonly TRoute[]): TRoute[] {
  const output = new Array<TRoute>(routes.length);
  for (let index = 0; index < routes.length; index += 1) {
    output[index] = routes[index]!;
  }
  return output;
}

function replaceRouteAt<TRoute extends Route>(routes: readonly TRoute[], index: number, route: TRoute): TRoute[] {
  const output = cloneRoutes(routes);
  output[index] = route;
  return output;
}

function appendRoute<TRoute extends Route>(routes: readonly TRoute[], route: TRoute): TRoute[] {
  const output = new Array<TRoute>(routes.length + 1);
  for (let index = 0; index < routes.length; index += 1) {
    output[index] = routes[index]!;
  }
  output[routes.length] = route;
  return output;
}

function removeRoute<TRoute extends Route>(routes: readonly TRoute[], routeId: string): TRoute[] {
  const output: TRoute[] = [];
  for (const route of routes) {
    if (route.id !== routeId) output.push(route);
  }
  return output;
}
