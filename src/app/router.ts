// Copyright 2023 Im-Beast. MIT license.
import { Signal } from "../signals/mod.ts";
import { clampSelectionIndex } from "../selection.ts";
import type { Action } from "./actions.ts";
import type { LabeledCommandGroupOptions } from "./command_helpers.ts";
import type { Command, CommandRegistry } from "./commands.ts";

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

/** Identifier union for route Command variants. */
export type RouteCommandKind = "previous" | "next" | "select";

/** Options for configuring route Command. */
export interface RouteCommandOptions<TRoute extends Route = Route>
  extends LabeledCommandGroupOptions<RouteCommandKind> {
  routeIds?: RouteIdSource;
  includeCycleCommands?: boolean;
  includeRouteCommands?: boolean;
  disableActiveRoute?: boolean;
  label?: (route: TRoute) => string;
}

/** Options for configuring route Signal Binding. */
export interface RouteSignalBindingOptions {
  initialSync?: "route" | "signal";
  fallbackRouteId?: string;
  onInvalidRoute?: (routeId: string) => void;
}

/** Public type alias for a route Id Source. */
export type RouteIdSource = readonly string[] | Signal<readonly string[]>;

/** Options for configuring route Index Binding. */
export interface RouteIndexBindingOptions {
  routeIds?: RouteIdSource;
  initialSync?: "route" | "index";
  fallbackRouteId?: string;
  onInvalidIndex?: (index: number) => void;
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
  #routeIndex?: Map<string, number>;
  #ids?: string[];

  constructor(routes: readonly TRoute[], initialRouteId = routes[0]?.id ?? "") {
    this.routes = new Signal(Array.from(routes), { deepObserve: true });
    this.activeRouteId = new Signal(initialRouteId);
    this.routes.subscribe(() => {
      this.invalidateRouteCache();
      this.normalizeActiveRoute();
    });
    this.normalizeActiveRoute();
  }

  active(): TRoute | undefined {
    return this.get(this.activeRouteId.peek());
  }

  get(routeId: string): TRoute | undefined {
    const index = this.routeIndex(routeId);
    return index < 0 ? undefined : this.routes.peek()[index];
  }

  has(routeId: string): boolean {
    return this.get(routeId) !== undefined;
  }

  ids(): string[] {
    if (!this.#ids) {
      const routes = this.routes.peek();
      const ids = new Array<string>(routes.length);
      for (let index = 0; index < routes.length; index += 1) {
        ids[index] = routes[index]!.id;
      }
      this.#ids = ids;
    }
    return this.#ids.slice();
  }

  activeIndex(): number {
    return this.routeIndex(this.activeRouteId.peek());
  }

  register(route: TRoute, options: RouteRegisterOptions = {}): boolean {
    const routes = this.routes.peek();
    const index = this.routeIndex(route.id);
    if (index >= 0 && !options.replace) return false;

    this.routes.value = index >= 0 ? replaceRouteAt(routes, index, route) : appendRoute(routes, route);

    if (options.activate) {
      this.activeRouteId.value = route.id;
    }
    return true;
  }

  unregister(routeId: string, options: RouteUnregisterOptions = {}): boolean {
    const routes = this.routes.peek();
    if (this.routeIndex(routeId) < 0) return false;

    this.#pendingFallbackRouteId = options.fallbackRouteId;
    this.routes.value = removeRoute(routes, routeId);
    this.#pendingFallbackRouteId = undefined;
    this.normalizeActiveRoute(options.fallbackRouteId);
    return true;
  }

  navigate(routeId: string): boolean {
    if (this.routeIndex(routeId) < 0) {
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
      routes: Array.from(routes),
    };
  }

  private normalizeActiveRoute(fallbackRouteId = this.#pendingFallbackRouteId): void {
    const routes = this.routes.peek();
    const active = this.activeRouteId.peek();
    if (this.routeIndex(active) >= 0) return;

    const fallback = fallbackRouteId && this.routeIndex(fallbackRouteId) >= 0 ? fallbackRouteId : routes[0]?.id ?? "";
    if (active !== fallback) {
      this.activeRouteId.value = fallback;
    }
  }

  private shift(delta: number): TRoute | undefined {
    const routes = this.routes.peek();
    if (routes.length === 0) return undefined;
    const currentIndex = Math.max(0, this.routeIndex(this.activeRouteId.peek()));
    const nextRoute = routes[(currentIndex + delta + routes.length) % routes.length]!;
    this.activeRouteId.value = nextRoute.id;
    return nextRoute;
  }

  private routeIndex(routeId: string): number {
    if (!this.#routeIndex) {
      const routes = this.routes.peek();
      const lookup = new Map<string, number>();
      for (let index = 0; index < routes.length; index += 1) {
        lookup.set(routes[index]!.id, index);
      }
      this.#routeIndex = lookup;
    }
    return this.#routeIndex.get(routeId) ?? -1;
  }

  private invalidateRouteCache(): void {
    this.#routeIndex = undefined;
    this.#ids = undefined;
  }
}

/** Binds route Signal behavior and returns a disposer when applicable. */
export function bindRouteSignal<TRoute extends Route = Route>(
  routes: RouteManager<TRoute>,
  routeId: Signal<string>,
  options: RouteSignalBindingOptions = {},
): () => void {
  let syncing = false;

  const valid = (id: string) => hasRouteId(routes, id);
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

/** Binds route Index behavior and returns a disposer when applicable. */
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
    return routeIdsForSource(routes, ids);
  };
  const routeIdAt = (index: number) => {
    const ids = routeIds();
    return ids[clampSelectionIndex(ids.length, index)];
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

    const nextIndex = clampSelectionIndex(ids.length, index);
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

/** Builds command definitions for route. */
export function routeCommands<TAction extends Action = Action, TRoute extends Route = Route>(
  routes: RouteManager<TRoute>,
  options: RouteCommandOptions<TRoute> = {},
): Command<TAction>[] {
  const idPrefix = options.idPrefix ?? "route";
  const group = options.group ?? "routes";
  const label = (kind: RouteCommandKind, fallback: string) => options.labels?.[kind] ?? fallback;
  const visibleRoutes = () => routesForSource(routes, options.routeIds);
  const commands: Command<TAction>[] = [];

  if (options.includeCycleCommands ?? true) {
    commands.push(
      {
        id: `${idPrefix}.previous`,
        label: label("previous", "Previous Route"),
        group,
        binding: { key: "left", ctrl: true },
        disabled: () => visibleRoutes().length <= 1,
        action: () => {
          shiftVisibleRoute(routes, -1, visibleRoutes());
        },
      },
      {
        id: `${idPrefix}.next`,
        label: label("next", "Next Route"),
        group,
        binding: { key: "right", ctrl: true },
        disabled: () => visibleRoutes().length <= 1,
        action: () => {
          shiftVisibleRoute(routes, 1, visibleRoutes());
        },
      },
    );
  }

  if (options.includeRouteCommands ?? true) {
    for (const route of visibleRoutes()) {
      commands.push({
        id: `${idPrefix}.select.${route.id}`,
        label: `${label("select", "Route")}: ${options.label?.(route) ?? route.title ?? route.id}`,
        group,
        keywords: routeCommandKeywords(route),
        disabled: options.disableActiveRoute ?? true ? () => routes.activeRouteId.peek() === route.id : false,
        action: () => {
          routes.navigate(route.id);
        },
      });
    }
  }

  return commands;
}

/** Binds route Commands behavior and returns a disposer when applicable. */
export function bindRouteCommands<TAction extends Action = Action, TRoute extends Route = Route>(
  registry: CommandRegistry<TAction>,
  routes: RouteManager<TRoute>,
  options: RouteCommandOptions<TRoute> = {},
): () => void {
  return registry.registerAll(routeCommands<TAction, TRoute>(routes, options));
}

function replaceRouteAt<TRoute extends Route>(routes: readonly TRoute[], index: number, route: TRoute): TRoute[] {
  const output = Array.from(routes);
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

function routesForSource<TRoute extends Route>(
  routes: RouteManager<TRoute>,
  routeIds?: RouteIdSource,
): TRoute[] {
  const ids = routeIds instanceof Signal ? routeIds.peek() : routeIds;
  if (!ids) return routes.routes.peek();
  const output: TRoute[] = [];
  for (const id of ids) {
    const route = routes.get(id);
    if (route) output.push(route);
  }
  return output;
}

function shiftVisibleRoute<TRoute extends Route>(
  routes: RouteManager<TRoute>,
  delta: number,
  visibleRoutes: readonly TRoute[],
): boolean {
  if (visibleRoutes.length === 0) return false;
  const currentIndex = Math.max(0, routeIndexInList(visibleRoutes, routes.activeRouteId.peek()));
  const nextRoute = visibleRoutes[(currentIndex + delta + visibleRoutes.length) % visibleRoutes.length]!;
  return routes.navigate(nextRoute.id);
}

function hasRouteId<TRoute extends Route>(routes: RouteManager<TRoute>, routeId: string): boolean {
  return routes.get(routeId) !== undefined;
}

function routeIdsForSource<TRoute extends Route>(
  routes: RouteManager<TRoute>,
  ids: readonly string[] | undefined,
): string[] {
  if (ids) {
    const output: string[] = [];
    for (const id of ids) {
      if (hasRouteId(routes, id)) output.push(id);
    }
    return output;
  }
  const source = routes.routes.peek();
  const output = new Array<string>(source.length);
  for (let index = 0; index < source.length; index += 1) {
    output[index] = source[index]!.id;
  }
  return output;
}

function routeCommandKeywords(route: Route): string[] {
  if (!route.title) return [route.id];
  return [route.id, route.title];
}

function routeIndexInList<TRoute extends Route>(routes: readonly TRoute[], routeId: string): number {
  for (let index = 0; index < routes.length; index += 1) {
    if (routes[index]!.id === routeId) return index;
  }
  return -1;
}
