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
    this.routes = new Signal([...routes], { deepObserve: true });
    this.activeRouteId = new Signal(initialRouteId);
    this.routes.subscribe(() => this.normalizeActiveRoute());
    this.normalizeActiveRoute();
  }

  active(): TRoute | undefined {
    return this.routes.peek().find((route) => route.id === this.activeRouteId.peek());
  }

  get(routeId: string): TRoute | undefined {
    return this.routes.peek().find((route) => route.id === routeId);
  }

  has(routeId: string): boolean {
    return this.get(routeId) !== undefined;
  }

  ids(): string[] {
    return this.routes.peek().map((route) => route.id);
  }

  activeIndex(): number {
    return this.routes.peek().findIndex((route) => route.id === this.activeRouteId.peek());
  }

  register(route: TRoute, options: RouteRegisterOptions = {}): boolean {
    const routes = this.routes.peek();
    const index = routes.findIndex((candidate) => candidate.id === route.id);
    if (index >= 0 && !options.replace) return false;

    this.routes.value = index >= 0
      ? routes.map((candidate, candidateIndex) => candidateIndex === index ? route : candidate)
      : [...routes, route];

    if (options.activate) {
      this.activeRouteId.value = route.id;
    }
    return true;
  }

  unregister(routeId: string, options: RouteUnregisterOptions = {}): boolean {
    const routes = this.routes.peek();
    if (!routes.some((route) => route.id === routeId)) return false;

    this.#pendingFallbackRouteId = options.fallbackRouteId;
    this.routes.value = routes.filter((route) => route.id !== routeId);
    this.#pendingFallbackRouteId = undefined;
    this.normalizeActiveRoute(options.fallbackRouteId);
    return true;
  }

  navigate(routeId: string): boolean {
    if (!this.routes.peek().some((route) => route.id === routeId)) {
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
      routes: [...routes],
    };
  }

  private normalizeActiveRoute(fallbackRouteId = this.#pendingFallbackRouteId): void {
    const routes = this.routes.peek();
    const active = this.activeRouteId.peek();
    if (routes.some((route) => route.id === active)) return;

    const fallback = fallbackRouteId && routes.some((route) => route.id === fallbackRouteId)
      ? fallbackRouteId
      : routes[0]?.id ?? "";
    if (active !== fallback) {
      this.activeRouteId.value = fallback;
    }
  }

  private shift(delta: number): TRoute | undefined {
    const routes = this.routes.peek();
    if (routes.length === 0) return undefined;
    const currentIndex = Math.max(0, routes.findIndex((route) => route.id === this.activeRouteId.peek()));
    const nextRoute = routes[(currentIndex + delta + routes.length) % routes.length]!;
    this.activeRouteId.value = nextRoute.id;
    return nextRoute;
  }
}
