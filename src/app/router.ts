// Copyright 2023 Im-Beast. MIT license.
import { Signal } from "../signals/mod.ts";

export interface Route {
  id: string;
  title?: string;
}

export class RouteManager<TRoute extends Route = Route> {
  readonly routes: Signal<TRoute[]>;
  readonly activeRouteId: Signal<string>;

  constructor(routes: readonly TRoute[], initialRouteId = routes[0]?.id ?? "") {
    this.routes = new Signal([...routes], { deepObserve: true });
    this.activeRouteId = new Signal(initialRouteId);
  }

  active(): TRoute | undefined {
    return this.routes.peek().find((route) => route.id === this.activeRouteId.peek());
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

  private shift(delta: number): TRoute | undefined {
    const routes = this.routes.peek();
    if (routes.length === 0) return undefined;
    const currentIndex = Math.max(0, routes.findIndex((route) => route.id === this.activeRouteId.peek()));
    const nextRoute = routes[(currentIndex + delta + routes.length) % routes.length]!;
    this.activeRouteId.value = nextRoute.id;
    return nextRoute;
  }
}
