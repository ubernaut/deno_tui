// Copyright 2023 Im-Beast. MIT license.
import { batchSignalUpdates, Signal } from "../signals/mod.ts";
import type { SignalInspection, Subscription } from "../signals/mod.ts";
import { clampSelectionIndex } from "../selection.ts";
import type { Action } from "./actions.ts";
import type { LabeledCommandGroupOptions } from "./command_helpers.ts";
import type { Command, CommandRegistry } from "./commands.ts";

/** Version of the renderer-neutral route-location wire contract. */
export const ROUTE_LOCATION_VERSION = 1 as const;

/** Stable prefix used by {@link formatRouteLocation}. */
export const ROUTE_LOCATION_PREFIX = "tui-route:v1:" as const;

/** Bounded validation limits for route-location parsing and cloning. */
export const ROUTE_LOCATION_LIMITS: Readonly<{
  maxSerializedLength: number;
  maxRouteIdLength: number;
  maxEntries: number;
  maxKeyLength: number;
  maxValueLength: number;
  maxAggregateStringUnits: number;
  maxStateDepth: number;
  maxStateNodes: number;
}> = Object.freeze({
  maxSerializedLength: 65_536,
  maxRouteIdLength: 4_096,
  maxEntries: 256,
  maxKeyLength: 256,
  maxValueLength: 8_192,
  maxAggregateStringUnits: 65_536,
  maxStateDepth: 32,
  maxStateNodes: 4_096,
});

/** JSON-safe value accepted as serializable route state. */
export type RouteLocationState =
  | null
  | boolean
  | number
  | string
  | readonly RouteLocationState[]
  | { readonly [key: string]: RouteLocationState };

/** One query value or a stable list of repeated query values. */
export type RouteQueryValue = string | readonly string[];

/** Immutable, versioned route identity shared by terminal and browser hosts. */
export interface RouteLocation<TState = RouteLocationState> {
  readonly version: typeof ROUTE_LOCATION_VERSION;
  readonly routeId: string;
  readonly pathParams: Readonly<Record<string, string>>;
  readonly query: Readonly<Record<string, RouteQueryValue>>;
  readonly fragment?: string;
  readonly state?: TState;
}

/** Input accepted by {@link createRouteLocation}. */
export interface RouteLocationInput<TState = RouteLocationState> {
  readonly version?: typeof ROUTE_LOCATION_VERSION;
  readonly routeId: string;
  readonly pathParams?: Readonly<Record<string, string>>;
  readonly query?: Readonly<Record<string, RouteQueryValue>>;
  readonly fragment?: string;
  readonly state?: TState;
}

/** Read-only reactive view of the active route location. */
export interface RouteLocationObservable<TState = RouteLocationState> {
  /** Returns the active immutable location without dependency tracking. */
  peek(): RouteLocation<TState>;
  /** Subscribes to route-ID, parameter, query, fragment, or state changes. */
  subscribe(subscription: Subscription<RouteLocation<TState>>, abortSignal?: AbortSignal): void;
  /** Removes a previously registered location subscription. */
  unsubscribe(subscription: Subscription<RouteLocation<TState>>): void;
  /** Returns bounded listener and lifecycle diagnostics. */
  inspect(): SignalInspection;
}

/** Stable validation categories reported by {@link RouteLocationError}. */
export type RouteLocationErrorCode =
  | "invalid-type"
  | "invalid-version"
  | "invalid-string"
  | "invalid-record"
  | "invalid-state"
  | "invalid-encoding"
  | "invalid-wire-format"
  | "limit-exceeded";

/** Structured error thrown for malformed or unsafe route locations. */
export class RouteLocationError extends TypeError {
  /** Machine-readable validation category. */
  readonly code: RouteLocationErrorCode;
  /** Location within the route-location value that failed validation. */
  readonly path: string;

  constructor(code: RouteLocationErrorCode, path: string, message: string) {
    const boundedPath = boundedRouteLocationDiagnostic(path);
    const boundedMessage = boundedRouteLocationDiagnostic(message);
    super(`${boundedPath}: ${boundedMessage}`);
    this.name = "RouteLocationError";
    this.code = code;
    this.path = boundedPath;
  }
}

const ROUTE_LOCATION_DIAGNOSTIC_LIMIT = 256;

function boundedRouteLocationDiagnostic(value: string): string {
  if (value.length <= ROUTE_LOCATION_DIAGNOSTIC_LIMIT) return value;
  return `${value.slice(0, ROUTE_LOCATION_DIAGNOSTIC_LIMIT - 3)}...`;
}

/**
 * Validates, defensively clones, sorts, and freezes a route location.
 *
 * The returned value is safe to retain across host boundaries. Accessor
 * properties, sparse arrays, cycles, non-finite numbers, and non-JSON state
 * are rejected instead of being silently normalized.
 */
export function createRouteLocation<TState = RouteLocationState>(
  input: RouteLocationInput<TState>,
): RouteLocation<TState> {
  const budget = { nodes: 0, stringUnits: 0 };
  assertPlainDataObject(input, "location", "invalid-type");
  const version = readDataProperty(input, "version", "location.version", false);
  if (version !== undefined && version !== ROUTE_LOCATION_VERSION) {
    throw new RouteLocationError("invalid-version", "location.version", `expected ${ROUTE_LOCATION_VERSION}`);
  }

  const routeId = readDataProperty(input, "routeId", "location.routeId", true);
  assertBoundedString(routeId, "location.routeId", ROUTE_LOCATION_LIMITS.maxRouteIdLength);
  consumeRouteStringBudget(routeId, "location.routeId", budget);

  const pathParamsValue = readDataProperty(input, "pathParams", "location.pathParams", false);
  const queryValue = readDataProperty(input, "query", "location.query", false);
  const fragmentValue = readDataProperty(input, "fragment", "location.fragment", false);
  const stateValue = readDataProperty(input, "state", "location.state", false);

  const pathParams = cloneStringRecord(pathParamsValue, "location.pathParams", budget);
  const query = cloneQueryRecord(queryValue, "location.query", budget);
  if (fragmentValue !== undefined) {
    assertBoundedString(fragmentValue, "location.fragment", ROUTE_LOCATION_LIMITS.maxValueLength);
    consumeRouteStringBudget(fragmentValue, "location.fragment", budget);
  }

  const output: {
    version: typeof ROUTE_LOCATION_VERSION;
    routeId: string;
    pathParams: Readonly<Record<string, string>>;
    query: Readonly<Record<string, RouteQueryValue>>;
    fragment?: string;
    state?: TState;
  } = {
    version: ROUTE_LOCATION_VERSION,
    routeId,
    pathParams,
    query,
  };
  if (fragmentValue !== undefined) output.fragment = fragmentValue;
  if (stateValue !== undefined) {
    output.state = cloneRouteState(stateValue, "location.state", 0, budget, new Set()) as TState;
  }
  return Object.freeze(output);
}

/** Formats a route location into a deterministic, percent-encoded wire value. */
export function formatRouteLocation<TState = RouteLocationState>(
  input: RouteLocationInput<TState>,
): string {
  const location = createRouteLocation(input);
  let output = `${ROUTE_LOCATION_PREFIX}${encodeRouteComponent(location.routeId, "location.routeId")}`;
  const fields: string[] = [];
  if (Object.keys(location.pathParams).length > 0) {
    fields.push(`p=${encodeRouteComponent(JSON.stringify(location.pathParams), "location.pathParams")}`);
  }
  if (Object.keys(location.query).length > 0) {
    fields.push(`q=${encodeRouteComponent(JSON.stringify(location.query), "location.query")}`);
  }
  if (location.state !== undefined) {
    fields.push(`s=${encodeRouteComponent(JSON.stringify(location.state), "location.state")}`);
  }
  if (fields.length > 0) output += `?${fields.join("&")}`;
  if (location.fragment !== undefined) {
    output += `#${encodeRouteComponent(location.fragment, "location.fragment")}`;
  }
  if (output.length > ROUTE_LOCATION_LIMITS.maxSerializedLength) {
    throw new RouteLocationError("limit-exceeded", "location", "serialized location is too long");
  }
  return output;
}

/** Parses and validates a deterministic route-location wire value. */
export function parseRouteLocation<TState = RouteLocationState>(serialized: string): RouteLocation<TState> {
  assertBoundedString(serialized, "serialized", ROUTE_LOCATION_LIMITS.maxSerializedLength);
  if (!serialized.startsWith(ROUTE_LOCATION_PREFIX)) {
    throw new RouteLocationError("invalid-wire-format", "serialized", `expected prefix ${ROUTE_LOCATION_PREFIX}`);
  }

  let payload = serialized.slice(ROUTE_LOCATION_PREFIX.length);
  let fragment: string | undefined;
  const fragmentIndex = payload.indexOf("#");
  if (fragmentIndex >= 0) {
    if (payload.indexOf("#", fragmentIndex + 1) >= 0) {
      throw new RouteLocationError("invalid-wire-format", "serialized.fragment", "contains an unescaped #");
    }
    fragment = decodeRouteComponent(payload.slice(fragmentIndex + 1), "serialized.fragment");
    payload = payload.slice(0, fragmentIndex);
  }

  let queryFields = "";
  const queryIndex = payload.indexOf("?");
  if (queryIndex >= 0) {
    if (payload.indexOf("?", queryIndex + 1) >= 0) {
      throw new RouteLocationError("invalid-wire-format", "serialized.query", "contains an unescaped ?");
    }
    queryFields = payload.slice(queryIndex + 1);
    payload = payload.slice(0, queryIndex);
  }

  const routeId = decodeRouteComponent(payload, "serialized.routeId");
  let pathParams: unknown;
  let query: unknown;
  let state: unknown;
  const seenFields = new Set<string>();
  if (queryFields.length > 0) {
    const fields = queryFields.split("&");
    if (fields.length > 3) {
      throw new RouteLocationError("limit-exceeded", "serialized.query", "contains too many envelope fields");
    }
    for (const field of fields) {
      const equalsIndex = field.indexOf("=");
      if (equalsIndex <= 0 || field.indexOf("=", equalsIndex + 1) >= 0) {
        throw new RouteLocationError("invalid-wire-format", "serialized.query", "contains a malformed field");
      }
      const name = field.slice(0, equalsIndex);
      if (name !== "p" && name !== "q" && name !== "s") {
        throw new RouteLocationError("invalid-wire-format", "serialized.query", `unknown field ${name}`);
      }
      if (seenFields.has(name)) {
        throw new RouteLocationError("invalid-wire-format", "serialized.query", `duplicate field ${name}`);
      }
      seenFields.add(name);
      const decoded = decodeRouteComponent(field.slice(equalsIndex + 1), `serialized.${name}`);
      const value = parseRouteJson(decoded, `serialized.${name}`);
      if (name === "p") pathParams = value;
      else if (name === "q") query = value;
      else state = value;
    }
  }

  return createRouteLocation<TState>({
    routeId,
    pathParams: pathParams as Readonly<Record<string, string>> | undefined,
    query: query as Readonly<Record<string, RouteQueryValue>> | undefined,
    fragment,
    state: state as TState | undefined,
  });
}

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

/** Signal owned by RouteManager that validates every externally assigned route ID. */
class ManagedRouteIdSignal extends Signal<string> {
  readonly #onSilentChange: (routeId: string) => void;

  constructor(routeId: string, onSilentChange: (routeId: string) => void) {
    super(validateManagedRouteId(routeId, "activeRouteId"));
    this.#onSilentChange = onSilentChange;
  }

  override get value(): string {
    return super.value;
  }

  override set value(routeId: string) {
    super.value = validateManagedRouteId(routeId, "activeRouteId");
  }

  override jink(routeId: string): void {
    const validated = validateManagedRouteId(routeId, "activeRouteId");
    if (validated === this.peek()) return;
    super.jink(validated);
    this.#onSilentChange(validated);
  }

  override dispose(): void {
    throw new TypeError("RouteManager owns activeRouteId; dispose the manager integration instead.");
  }
}

const MANAGED_ROUTE_ARRAY_MUTATORS = new Set([
  "copyWithin",
  "fill",
  "pop",
  "push",
  "reverse",
  "shift",
  "sort",
  "splice",
  "unshift",
]);

/** Route collection signal with validated aliases and reactive structural edits. */
class ManagedRoutesSignal<TRoute extends Route> extends Signal<TRoute[]> {
  readonly #onSilentChange: () => void;
  readonly #managedRouteProxies = new WeakSet<object>();
  #revision = 0;

  constructor(routes: readonly TRoute[], onSilentChange: () => void) {
    super([] as TRoute[]);
    this.#onSilentChange = onSilentChange;
    super.jink(this.prepareRoutes(routes));
  }

  override get value(): TRoute[] {
    return super.value;
  }

  override set value(routes: TRoute[]) {
    const revision = this.#revision;
    const prepared = this.prepareRoutes(routes);
    this.assertRevision(revision);
    this.#revision += 1;
    super.value = prepared;
  }

  override jink(routes: TRoute[]): void {
    const revision = this.#revision;
    const prepared = this.prepareRoutes(routes);
    this.assertRevision(revision);
    this.#revision += 1;
    super.jink(prepared);
    this.#onSilentChange();
  }

  override dispose(): void {
    throw new TypeError("RouteManager owns routes; use register, unregister, or a validated replacement instead.");
  }

  private prepareRoutes(routes: readonly TRoute[]): TRoute[] {
    const copy = Array.from(routes);
    const managed = new Array<TRoute>(copy.length);
    for (let index = 0; index < copy.length; index += 1) {
      managed[index] = this.prepareRoute(copy[index], `routes[${index}].id`);
    }
    return this.createReactiveArray(managed);
  }

  private prepareRoute(route: TRoute | undefined, path: string): TRoute {
    if (route === undefined || route === null || typeof route !== "object") {
      throw new RouteLocationError("invalid-type", path, "route must be an object");
    }
    if (this.#managedRouteProxies.has(route)) return route;

    let routeId: unknown;
    try {
      routeId = Reflect.get(route, "id", route);
    } catch {
      throw new RouteLocationError("invalid-type", path, "route ID could not be read");
    }
    let managedId = validateManagedRouteId(routeId, path);
    const target = snapshotManagedRoute(route, managedId, path);
    const proxy: TRoute = new Proxy(target, {
      get: (target, property, receiver) => {
        if (property === "id") return managedId;
        return Reflect.get(target, property, receiver);
      },
      set: (target, property, value) => {
        if (property === "id") {
          const nextId = validateManagedRouteId(value, path);
          if (nextId === managedId) return true;
          let assigned: boolean;
          try {
            assigned = Reflect.set(target, property, nextId, target);
          } catch {
            throw new RouteLocationError("invalid-type", path, "route ID could not be assigned");
          }
          if (!assigned) throw new RouteLocationError("invalid-type", path, "route ID is not writable");
          managedId = nextId;
          this.notifyRouteMutation(proxy);
          return true;
        }
        const assigned = Reflect.set(target, property, value, target);
        if (assigned) this.notifyRouteMutation(proxy);
        return assigned;
      },
      defineProperty: (target, property, descriptor) => {
        if (property === "id") {
          if (!("value" in descriptor)) {
            throw new RouteLocationError("invalid-type", path, "route ID must be a data property");
          }
          const nextId = validateManagedRouteId(descriptor.value, path);
          const defined = Reflect.defineProperty(target, property, { ...descriptor, value: nextId });
          if (!defined) throw new RouteLocationError("invalid-type", path, "route ID could not be defined");
          managedId = nextId;
          this.notifyRouteMutation(proxy);
          return true;
        }
        const defined = Reflect.defineProperty(target, property, descriptor);
        if (defined) this.notifyRouteMutation(proxy);
        return defined;
      },
      deleteProperty: (target, property) => {
        if (property === "id") {
          throw new RouteLocationError("invalid-type", path, "route ID cannot be deleted");
        }
        const existed = Reflect.has(target, property);
        const deleted = Reflect.deleteProperty(target, property);
        if (deleted && existed) this.notifyRouteMutation(proxy);
        return deleted;
      },
      getOwnPropertyDescriptor: (target, property) => {
        const descriptor = Reflect.getOwnPropertyDescriptor(target, property);
        if (property !== "id" || !descriptor || !("value" in descriptor)) return descriptor;
        return { ...descriptor, value: managedId };
      },
    });
    this.#managedRouteProxies.add(proxy);
    return proxy;
  }

  private createReactiveArray(initial: TRoute[]): TRoute[] {
    const mutators = new Map<string, (...args: unknown[]) => unknown>();
    const proxy: TRoute[] = new Proxy(initial, {
      get: (target, property, receiver) => {
        if (typeof property === "string" && MANAGED_ROUTE_ARRAY_MUTATORS.has(property)) {
          let mutator = mutators.get(property);
          if (!mutator) {
            mutator = (...args: unknown[]): unknown => {
              const expected = target.slice();
              const next = target.slice();
              const method = Reflect.get(Array.prototype, property);
              if (typeof method !== "function") {
                throw new RouteLocationError("invalid-type", "routes", `unsupported route mutation ${property}`);
              }
              const result = Reflect.apply(method, next, args);
              this.commitArrayMutation(proxy, target, expected, next);
              return result === next ? proxy : result;
            };
            mutators.set(property, mutator);
          }
          return mutator;
        }
        return Reflect.get(target, property, receiver);
      },
      set: (target, property, value) => {
        if (property !== "length" && routeArrayIndex(property) === undefined) {
          throw new RouteLocationError("invalid-type", "routes", "route arrays accept only indices and length");
        }
        const expected = target.slice();
        const next = target.slice();
        if (!Reflect.set(next, property, value, next)) {
          throw new RouteLocationError("invalid-type", "routes", "route array property could not be assigned");
        }
        this.commitArrayMutation(proxy, target, expected, next);
        return true;
      },
      defineProperty: (target, property, descriptor) => {
        if (property === "length") {
          throw new RouteLocationError(
            "invalid-type",
            "routes.length",
            "route collection length descriptors are manager-owned",
          );
        }
        const index = routeArrayIndex(property);
        if (index === undefined) {
          throw new RouteLocationError("invalid-type", "routes", "route arrays accept only indices and length");
        }
        if (
          !("value" in descriptor) || descriptor.get !== undefined || descriptor.set !== undefined ||
          descriptor.writable !== true || descriptor.enumerable !== true || descriptor.configurable !== true
        ) {
          throw new RouteLocationError(
            "invalid-type",
            `routes[${index}]`,
            "route entries require writable, enumerable, configurable data descriptors",
          );
        }
        const expected = target.slice();
        const next = target.slice();
        if (!Reflect.defineProperty(next, property, descriptor)) {
          throw new RouteLocationError("invalid-type", "routes", "route array property could not be defined");
        }
        this.commitArrayMutation(proxy, target, expected, next);
        return true;
      },
      deleteProperty: (_target, property) => {
        throw new RouteLocationError("invalid-type", `routes[${String(property)}]`, "route entries cannot be sparse");
      },
      preventExtensions: () => {
        throw new RouteLocationError("invalid-type", "routes", "route collection extensibility is manager-owned");
      },
      setPrototypeOf: () => {
        throw new RouteLocationError("invalid-type", "routes", "route collection prototype is manager-owned");
      },
    });
    return proxy;
  }

  private commitArrayMutation(
    proxy: TRoute[],
    target: TRoute[],
    expected: readonly TRoute[],
    next: readonly TRoute[],
  ): void {
    if (this.peek() !== proxy || !sameRouteReferences(target, expected)) {
      throw new RouteLocationError("invalid-type", "routes", "stale route collection cannot be mutated");
    }
    const prepared = new Array<TRoute>(next.length);
    for (let index = 0; index < next.length; index += 1) {
      prepared[index] = this.prepareRoute(next[index], `routes[${index}].id`);
    }
    if (sameRouteReferences(target, prepared)) return;
    target.length = 0;
    for (let index = 0; index < prepared.length; index += 1) target[index] = prepared[index]!;
    this.#revision += 1;
    this.propagate();
  }

  private notifyRouteMutation(route: TRoute): void {
    if (!this.peek().includes(route)) return;
    validateManagedRoutes(this.peek());
    this.#revision += 1;
    this.propagate();
  }

  private assertRevision(revision: number): void {
    if (revision !== this.#revision) {
      throw new RouteLocationError("invalid-type", "routes", "route collection changed during validation");
    }
  }
}

function snapshotManagedRoute<TRoute extends Route>(route: TRoute, routeId: string, path: string): TRoute {
  let prototype: object | null;
  let keys: PropertyKey[];
  try {
    prototype = Reflect.getPrototypeOf(route);
    keys = Reflect.ownKeys(route);
  } catch {
    throw new RouteLocationError("invalid-type", path, "route could not be snapshotted");
  }

  const target = Object.create(prototype) as TRoute;
  try {
    for (const key of keys) {
      if (key === "id") continue;
      const descriptor = Reflect.getOwnPropertyDescriptor(route, key);
      if (descriptor && !Reflect.defineProperty(target, key, descriptor)) {
        throw new TypeError("route property could not be copied");
      }
    }
    if (
      !Reflect.defineProperty(target, "id", {
        value: routeId,
        writable: true,
        enumerable: true,
        configurable: true,
      })
    ) {
      throw new TypeError("route ID could not be copied");
    }
  } catch {
    throw new RouteLocationError("invalid-type", path, "route could not be snapshotted");
  }
  return target;
}

function createRouteLocationObservable<TState>(
  signal: Signal<RouteLocation<TState>>,
): RouteLocationObservable<TState> {
  return Object.freeze({
    peek: () => signal.peek(),
    subscribe: (subscription: Subscription<RouteLocation<TState>>, abortSignal?: AbortSignal) =>
      signal.subscribe(subscription, abortSignal),
    unsubscribe: (subscription: Subscription<RouteLocation<TState>>) => signal.unsubscribe(subscription),
    inspect: () => signal.inspect(),
  });
}

function validateManagedRouteId(routeId: unknown, path: string): string {
  assertBoundedString(routeId, path, ROUTE_LOCATION_LIMITS.maxRouteIdLength);
  return routeId;
}

function validateManagedRoutes(routes: readonly Route[]): void {
  for (let index = 0; index < routes.length; index += 1) {
    validateManagedRouteId(routes[index]?.id, `routes[${index}].id`);
  }
}

function routeArrayIndex(property: PropertyKey): number | undefined {
  if (typeof property !== "string") return undefined;
  if (property === "0") return 0;
  if (property.length === 0 || property[0] === "0") return undefined;
  for (let index = 0; index < property.length; index += 1) {
    const code = property.charCodeAt(index);
    if (code < 48 || code > 57) return undefined;
  }
  const index = Number(property);
  return Number.isSafeInteger(index) && index >= 0 && index < 4_294_967_295 ? index : undefined;
}

function sameRouteReferences(left: readonly Route[], right: readonly Route[]): boolean {
  if (left.length !== right.length) return false;
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) return false;
  }
  return true;
}

function routeLocationDataEquals<TState>(
  left: RouteLocation<TState>,
  right: RouteLocation<TState>,
): boolean {
  return routeLocationValueEquals(left, right);
}

function routeLocationValueEquals(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true;
  if (left === null || right === null || typeof left !== "object" || typeof right !== "object") return false;
  const leftArray = Array.isArray(left);
  if (leftArray !== Array.isArray(right)) return false;
  if (leftArray) {
    const leftValues = left as readonly unknown[];
    const rightValues = right as readonly unknown[];
    if (leftValues.length !== rightValues.length) return false;
    for (let index = 0; index < leftValues.length; index += 1) {
      if (!routeLocationValueEquals(leftValues[index], rightValues[index])) return false;
    }
    return true;
  }
  const leftRecord = left as Readonly<Record<string, unknown>>;
  const rightRecord = right as Readonly<Record<string, unknown>>;
  const leftKeys = Object.keys(leftRecord);
  const rightKeys = Object.keys(rightRecord);
  if (leftKeys.length !== rightKeys.length) return false;
  for (let index = 0; index < leftKeys.length; index += 1) {
    const key = leftKeys[index]!;
    if (key !== rightKeys[index] || !routeLocationValueEquals(leftRecord[key], rightRecord[key])) return false;
  }
  return true;
}

/** Public class implementing a route Manager. */
export class RouteManager<TRoute extends Route = Route, TState = RouteLocationState> {
  readonly routes: Signal<TRoute[]>;
  readonly activeRouteId: Signal<string>;
  readonly activeLocation: RouteLocationObservable<TState>;
  #pendingFallbackRouteId?: string;
  #routeIndex?: Map<string, number>;
  #ids?: string[];
  #activeLocationSignal: Signal<RouteLocation<TState>>;

  constructor(
    routes: readonly TRoute[],
    initialRoute: string | RouteLocationInput<TState> = routes[0]?.id ?? "",
  ) {
    validateManagedRoutes(routes);
    const initialLocation = typeof initialRoute === "string"
      ? createRouteLocation<TState>({ routeId: initialRoute })
      : createRouteLocation(initialRoute);
    this.routes = new ManagedRoutesSignal(routes, () => {
      this.invalidateRouteCache();
      this.normalizeActiveRoute(undefined, true);
    });
    this.#activeLocationSignal = new Signal(initialLocation);
    this.activeRouteId = new ManagedRouteIdSignal(initialLocation.routeId, (routeId) => {
      const location = createRouteLocation<TState>({ routeId });
      if (!routeLocationDataEquals(this.#activeLocationSignal.peek(), location)) {
        this.#activeLocationSignal.jink(location);
      }
    });
    this.activeLocation = createRouteLocationObservable(this.#activeLocationSignal);
    this.activeRouteId.subscribe((routeId) => {
      if (routeId === this.#activeLocationSignal.peek().routeId) return;
      this.#activeLocationSignal.value = createRouteLocation<TState>({ routeId });
    });
    this.routes.subscribe(() => {
      this.invalidateRouteCache();
      this.normalizeActiveRoute();
    });
    this.normalizeActiveRoute();
  }

  active(): TRoute | undefined {
    return this.get(this.activeRouteId.peek());
  }

  /** Returns the immutable location associated with the active route. */
  location(): RouteLocation<TState> {
    return this.#activeLocationSignal.peek();
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
    const routeId = validateManagedRouteId(route.id, "route.id");
    const routes = this.routes.peek();
    const index = this.routeIndex(routeId);
    if (index >= 0 && !options.replace) return false;

    this.routes.value = index >= 0 ? replaceRouteAt(routes, index, route) : appendRoute(routes, route);

    if (options.activate) {
      this.navigate(routeId);
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

  navigate(route: string | RouteLocationInput<TState>): boolean {
    const location = typeof route === "string"
      ? createRouteLocation<TState>({ routeId: route })
      : createRouteLocation(route);
    if (this.routeIndex(location.routeId) < 0) {
      return false;
    }
    batchSignalUpdates(() => {
      if (!routeLocationDataEquals(this.#activeLocationSignal.peek(), location)) {
        this.#activeLocationSignal.value = location;
      }
      if (this.activeRouteId.peek() !== location.routeId) {
        this.activeRouteId.value = location.routeId;
      }
    });
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

  private normalizeActiveRoute(fallbackRouteId = this.#pendingFallbackRouteId, silent = false): void {
    const routes = this.routes.peek();
    const active = this.activeRouteId.peek();
    if (this.routeIndex(active) >= 0) return;

    const fallback = fallbackRouteId && this.routeIndex(fallbackRouteId) >= 0 ? fallbackRouteId : routes[0]?.id ?? "";
    if (active !== fallback) {
      const location = createRouteLocation<TState>({ routeId: fallback });
      if (silent) {
        this.#activeLocationSignal.jink(location);
        this.activeRouteId.jink(fallback);
        return;
      }
      batchSignalUpdates(() => {
        this.#activeLocationSignal.value = location;
        this.activeRouteId.value = fallback;
      });
    }
  }

  private shift(delta: number): TRoute | undefined {
    const routes = this.routes.peek();
    if (routes.length === 0) return undefined;
    const currentIndex = Math.max(0, this.routeIndex(this.activeRouteId.peek()));
    const nextRoute = routes[(currentIndex + delta + routes.length) % routes.length]!;
    this.navigate(nextRoute.id);
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

function assertPlainDataObject(
  value: unknown,
  path: string,
  code: RouteLocationErrorCode,
): asserts value is Record<string, unknown> {
  if (value === null || typeof value !== "object") {
    throw new RouteLocationError(code, path, "must be a plain data object");
  }
  let isArray: boolean;
  let prototype: object | null;
  try {
    isArray = Array.isArray(value);
    prototype = Object.getPrototypeOf(value);
  } catch {
    throw new RouteLocationError(code, path, "container shape could not be inspected");
  }
  if (isArray) {
    throw new RouteLocationError(code, path, "must be a plain data object");
  }
  if (prototype !== Object.prototype && prototype !== null) {
    throw new RouteLocationError(code, path, "must not have a custom prototype");
  }
}

function safeArrayIsArray(
  value: unknown,
  path: string,
  code: RouteLocationErrorCode,
): value is readonly unknown[] {
  try {
    return Array.isArray(value);
  } catch {
    throw new RouteLocationError(code, path, "container shape could not be inspected");
  }
}

function readDataProperty(
  value: object,
  key: string,
  path: string,
  required: boolean,
): unknown {
  let descriptor: PropertyDescriptor | undefined;
  try {
    descriptor = Object.getOwnPropertyDescriptor(value, key);
  } catch {
    throw new RouteLocationError("invalid-type", path, "property could not be inspected");
  }
  if (!descriptor) {
    if (required) throw new RouteLocationError("invalid-type", path, "is required");
    return undefined;
  }
  if (!("value" in descriptor) || !descriptor.enumerable) {
    throw new RouteLocationError("invalid-type", path, "must be an enumerable data property");
  }
  return descriptor.value;
}

function ownStringKeys(value: object, path: string): string[] {
  let keys: PropertyKey[];
  try {
    keys = Reflect.ownKeys(value);
  } catch {
    throw new RouteLocationError("invalid-record", path, "keys could not be inspected");
  }
  const output: string[] = [];
  for (const key of keys) {
    if (typeof key !== "string") {
      throw new RouteLocationError("invalid-record", path, "symbol keys are not serializable");
    }
    output.push(key);
  }
  return output;
}

function cloneStringRecord(
  value: unknown,
  path: string,
  budget: { nodes: number; stringUnits: number },
): Readonly<Record<string, string>> {
  if (value === undefined) return Object.freeze({});
  assertPlainDataObject(value, path, "invalid-record");
  const keys = ownStringKeys(value, path);
  if (keys.length > ROUTE_LOCATION_LIMITS.maxEntries) {
    throw new RouteLocationError("limit-exceeded", path, "contains too many entries");
  }
  keys.sort();
  const output: Record<string, string> = {};
  for (const key of keys) {
    assertBoundedString(key, `${path}.<key>`, ROUTE_LOCATION_LIMITS.maxKeyLength);
    consumeRouteStringBudget(key, `${path}.<key>`, budget);
    const entry = readDataProperty(value, key, `${path}.${key}`, true);
    assertBoundedString(entry, `${path}.${key}`, ROUTE_LOCATION_LIMITS.maxValueLength);
    consumeRouteStringBudget(entry, `${path}.${key}`, budget);
    defineDataProperty(output, key, entry);
  }
  return Object.freeze(output);
}

function cloneQueryRecord(
  value: unknown,
  path: string,
  budget: { nodes: number; stringUnits: number },
): Readonly<Record<string, RouteQueryValue>> {
  if (value === undefined) return Object.freeze({});
  assertPlainDataObject(value, path, "invalid-record");
  const keys = ownStringKeys(value, path);
  if (keys.length > ROUTE_LOCATION_LIMITS.maxEntries) {
    throw new RouteLocationError("limit-exceeded", path, "contains too many entries");
  }
  keys.sort();
  const output: Record<string, RouteQueryValue> = {};
  for (const key of keys) {
    assertBoundedString(key, `${path}.<key>`, ROUTE_LOCATION_LIMITS.maxKeyLength);
    consumeRouteStringBudget(key, `${path}.<key>`, budget);
    const entry = readDataProperty(value, key, `${path}.${key}`, true);
    if (typeof entry === "string") {
      assertBoundedString(entry, `${path}.${key}`, ROUTE_LOCATION_LIMITS.maxValueLength);
      consumeRouteStringBudget(entry, `${path}.${key}`, budget);
      defineDataProperty(output, key, entry);
      continue;
    }
    if (!safeArrayIsArray(entry, `${path}.${key}`, "invalid-record")) {
      throw new RouteLocationError("invalid-record", `${path}.${key}`, "must be a string or string array");
    }
    const length = readArrayLength(entry, `${path}.${key}`);
    if (length > ROUTE_LOCATION_LIMITS.maxEntries) {
      throw new RouteLocationError("limit-exceeded", `${path}.${key}`, "contains too many values");
    }
    const values = new Array<string>(length);
    for (let index = 0; index < length; index += 1) {
      const item = readArrayDataItem(entry, index, `${path}.${key}[${index}]`);
      assertBoundedString(item, `${path}.${key}[${index}]`, ROUTE_LOCATION_LIMITS.maxValueLength);
      consumeRouteStringBudget(item, `${path}.${key}[${index}]`, budget);
      values[index] = item;
    }
    assertArrayHasOnlyIndices(entry, length, `${path}.${key}`, "invalid-record");
    defineDataProperty(output, key, Object.freeze(values));
  }
  return Object.freeze(output);
}

function cloneRouteState(
  value: unknown,
  path: string,
  depth: number,
  budget: { nodes: number; stringUnits: number },
  seen: Set<object>,
): RouteLocationState {
  budget.nodes += 1;
  if (budget.nodes > ROUTE_LOCATION_LIMITS.maxStateNodes) {
    throw new RouteLocationError("limit-exceeded", path, "state node budget exceeded");
  }
  if (depth > ROUTE_LOCATION_LIMITS.maxStateDepth) {
    throw new RouteLocationError("limit-exceeded", path, "state nesting is too deep");
  }
  if (value === null || typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new RouteLocationError("invalid-state", path, "numbers must be finite");
    }
    return Object.is(value, -0) ? 0 : value;
  }
  if (typeof value === "string") {
    assertBoundedString(value, path, ROUTE_LOCATION_LIMITS.maxValueLength);
    consumeRouteStringBudget(value, path, budget);
    return value;
  }
  if (typeof value !== "object") {
    throw new RouteLocationError("invalid-state", path, "must be JSON-safe data");
  }
  if (seen.has(value)) {
    throw new RouteLocationError("invalid-state", path, "contains a cycle");
  }
  seen.add(value);
  try {
    if (safeArrayIsArray(value, path, "invalid-state")) {
      const length = readArrayLength(value, path);
      if (length > ROUTE_LOCATION_LIMITS.maxStateNodes) {
        throw new RouteLocationError("limit-exceeded", path, "array is too large");
      }
      const output = new Array<RouteLocationState>(length);
      for (let index = 0; index < length; index += 1) {
        const item = readArrayDataItem(value, index, `${path}[${index}]`);
        output[index] = cloneRouteState(item, `${path}[${index}]`, depth + 1, budget, seen);
      }
      assertArrayHasOnlyIndices(value, length, path, "invalid-state");
      return Object.freeze(output);
    }

    assertPlainDataObject(value, path, "invalid-state");
    const keys = ownStringKeys(value, path);
    if (keys.length > ROUTE_LOCATION_LIMITS.maxEntries) {
      throw new RouteLocationError("limit-exceeded", path, "object contains too many entries");
    }
    keys.sort();
    const output: Record<string, RouteLocationState> = {};
    for (const key of keys) {
      assertBoundedString(key, `${path}.<key>`, ROUTE_LOCATION_LIMITS.maxKeyLength);
      consumeRouteStringBudget(key, `${path}.<key>`, budget);
      const entry = readDataProperty(value, key, `${path}.${key}`, true);
      defineDataProperty(output, key, cloneRouteState(entry, `${path}.${key}`, depth + 1, budget, seen));
    }
    return Object.freeze(output);
  } finally {
    seen.delete(value);
  }
}

function readArrayDataItem(value: readonly unknown[], index: number, path: string): unknown {
  const item = readDataProperty(value, String(index), path, true);
  return item;
}

function readArrayLength(value: readonly unknown[], path: string): number {
  let descriptor: PropertyDescriptor | undefined;
  try {
    descriptor = Object.getOwnPropertyDescriptor(value, "length");
  } catch {
    throw new RouteLocationError("invalid-record", path, "array length could not be inspected");
  }
  if (!descriptor || !("value" in descriptor)) {
    throw new RouteLocationError("invalid-record", path, "array length must be a data property");
  }
  const length = descriptor.value;
  if (!Number.isSafeInteger(length) || length < 0) {
    throw new RouteLocationError("invalid-record", path, "array length is invalid");
  }
  return length;
}

function assertArrayHasOnlyIndices(
  value: readonly unknown[],
  length: number,
  path: string,
  code: RouteLocationErrorCode,
): void {
  const keys = ownStringKeys(value, path);
  for (const key of keys) {
    if (key === "length") continue;
    const index = Number(key);
    if (!Number.isSafeInteger(index) || index < 0 || index >= length || String(index) !== key) {
      throw new RouteLocationError(code, path, `array property ${key} is not serializable`);
    }
  }
}

function defineDataProperty<T>(target: Record<string, T>, key: string, value: T): void {
  Object.defineProperty(target, key, {
    configurable: true,
    enumerable: true,
    writable: true,
    value,
  });
}

function assertBoundedString(value: unknown, path: string, maxLength: number): asserts value is string {
  if (typeof value !== "string") {
    throw new RouteLocationError("invalid-string", path, "must be a string");
  }
  if (value.length > maxLength) {
    throw new RouteLocationError("limit-exceeded", path, `exceeds ${maxLength} UTF-16 code units`);
  }
  for (let index = 0; index < value.length; index += 1) {
    const unit = value.charCodeAt(index);
    if (unit >= 0xd800 && unit <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (!(next >= 0xdc00 && next <= 0xdfff)) {
        throw new RouteLocationError("invalid-string", path, "contains an unpaired high surrogate");
      }
      index += 1;
    } else if (unit >= 0xdc00 && unit <= 0xdfff) {
      throw new RouteLocationError("invalid-string", path, "contains an unpaired low surrogate");
    }
  }
}

function consumeRouteStringBudget(
  value: string,
  path: string,
  budget: { stringUnits: number },
): void {
  if (value.length > ROUTE_LOCATION_LIMITS.maxAggregateStringUnits - budget.stringUnits) {
    throw new RouteLocationError("limit-exceeded", path, "aggregate route-location string budget exceeded");
  }
  budget.stringUnits += value.length;
}

function encodeRouteComponent(value: string, path: string): string {
  if (value.length > ROUTE_LOCATION_LIMITS.maxSerializedLength) {
    throw new RouteLocationError("limit-exceeded", path, "encoded component is too long");
  }
  try {
    return encodeURIComponent(value);
  } catch {
    throw new RouteLocationError("invalid-encoding", path, "could not be percent encoded");
  }
}

function decodeRouteComponent(value: string, path: string): string {
  try {
    const decoded = decodeURIComponent(value);
    assertBoundedString(decoded, path, ROUTE_LOCATION_LIMITS.maxSerializedLength);
    return decoded;
  } catch (error) {
    if (error instanceof RouteLocationError) throw error;
    throw new RouteLocationError("invalid-encoding", path, "contains invalid percent encoding");
  }
}

function parseRouteJson(value: string, path: string): unknown {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    throw new RouteLocationError("invalid-wire-format", path, "contains invalid JSON");
  }
}
