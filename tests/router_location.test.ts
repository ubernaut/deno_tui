import { assert, assertEquals, assertThrows } from "./deps.ts";
import {
  createRouteLocation,
  formatRouteLocation,
  parseRouteLocation,
  type Route,
  RouteLocationError,
  RouteManager,
} from "../src/app/router.ts";

Deno.test("route locations round-trip reserved characters deterministically", () => {
  const location = createRouteLocation({
    routeId: "workspace/files?name=#100%/雪 😀",
    pathParams: {
      "file/name": "a?b#c&d=e%f",
      "space key": " leading and trailing ",
    },
    query: {
      "filter&sort": ["a=b", "c#d", "100%", "雪 😀"],
      single: "+/?#&=%",
    },
    fragment: "section/?#&=% 雪",
    state: {
      selection: ["a/b", "c?d"],
      flags: { preview: true, ratio: 1.5 },
    },
  });

  const formatted = formatRouteLocation(location);
  assert(formatted.startsWith("tui-route:v1:"));
  assertEquals(parseRouteLocation(formatted), location);
  assertEquals(structuredClone(location), location);

  const reordered = formatRouteLocation({
    routeId: location.routeId,
    pathParams: {
      "space key": " leading and trailing ",
      "file/name": "a?b#c&d=e%f",
    },
    query: {
      single: "+/?#&=%",
      "filter&sort": ["a=b", "c#d", "100%", "雪 😀"],
    },
    fragment: location.fragment,
    state: {
      flags: { ratio: 1.5, preview: true },
      selection: ["a/b", "c?d"],
    },
  });
  assertEquals(reordered, formatted);
});

Deno.test("route locations clone and freeze every retained collection", () => {
  const pathParams = { id: "before" };
  const repeated = ["one", "two"];
  const state = { nested: { values: [1, 2] } };
  const location = createRouteLocation({
    routeId: "details",
    pathParams,
    query: { repeated },
    state,
  });

  pathParams.id = "after";
  repeated.push("three");
  state.nested.values.push(3);

  assertEquals(location.pathParams, { id: "before" });
  assertEquals(location.query, { repeated: ["one", "two"] });
  assertEquals(location.state, { nested: { values: [1, 2] } });
  assert(Object.isFrozen(location));
  assert(Object.isFrozen(location.pathParams));
  assert(Object.isFrozen(location.query));
  assert(Object.isFrozen(location.query.repeated));
  assert(Object.isFrozen(location.state));
  assert(Object.isFrozen(location.state!.nested));
  assert(Object.isFrozen(location.state!.nested.values));

  const reservedKeys = JSON.parse('{"__proto__":"safe","constructor":"also-safe"}') as Record<string, string>;
  const reservedLocation = createRouteLocation({ routeId: "reserved", pathParams: reservedKeys });
  assertEquals(reservedLocation.pathParams, reservedKeys);
  assertEquals(Object.prototype.hasOwnProperty.call(reservedLocation.pathParams, "__proto__"), true);
  assertEquals(Object.getPrototypeOf(reservedLocation.pathParams), Object.prototype);
});

Deno.test("RouteManager retains typed locations while preserving string navigation", () => {
  interface NavigationState {
    selectedId: string;
    revision: number;
  }

  const routes: Route[] = [
    { id: "home", title: "Home" },
    { id: "details", title: "Details" },
  ];
  const manager = new RouteManager<Route, NavigationState>(routes, {
    routeId: "details",
    pathParams: { id: "42" },
    query: { tab: "events" },
    fragment: "latest",
    state: { selectedId: "event-7", revision: 3 },
  });
  const observed: string[] = [];
  manager.activeLocation.subscribe((location) => {
    observed.push(`${location.routeId}:${String(location.query.tab ?? "")}`);
  });

  assertEquals(manager.activeRouteId.peek(), "details");
  assertEquals(manager.location(), {
    version: 1,
    routeId: "details",
    pathParams: { id: "42" },
    query: { tab: "events" },
    fragment: "latest",
    state: { revision: 3, selectedId: "event-7" },
  });

  assertEquals(
    manager.navigate({
      routeId: "details",
      query: { tab: "metrics" },
      state: { selectedId: "metric-1", revision: 4 },
    }),
    true,
  );
  assertEquals(manager.location().query, { tab: "metrics" });
  assertEquals(observed, ["details:metrics"]);
  assertEquals(
    manager.navigate({
      routeId: "missing",
      state: { selectedId: "missing", revision: 5 },
    }),
    false,
  );
  assertEquals(manager.location().state, { revision: 4, selectedId: "metric-1" });

  assertEquals(manager.navigate("home"), true);
  assertEquals(manager.location(), {
    version: 1,
    routeId: "home",
    pathParams: {},
    query: {},
  });
  assertEquals(observed, ["details:metrics", "home:"]);

  manager.activeRouteId.value = "details";
  assertEquals(manager.location(), {
    version: 1,
    routeId: "details",
    pathParams: {},
    query: {},
  });
  manager.unregister("details", { fallbackRouteId: "home" });
  assertEquals(manager.location().routeId, "home");
});

Deno.test("RouteManager seals location mutation and rejects invalid route IDs atomically", () => {
  const manager = new RouteManager<Route>([
    { id: "home", title: "Home" },
    { id: "details", title: "Details" },
  ]);
  const activeLocation = manager.activeLocation as unknown as Record<string, unknown>;
  assert(Object.isFrozen(activeLocation));
  assertEquals("value" in activeLocation, false);
  assertEquals("jink" in activeLocation, false);
  assertEquals("dispose" in activeLocation, false);
  assertThrows(
    () => {
      activeLocation.value = { routeId: "injected" };
    },
    TypeError,
  );
  assertEquals(manager.activeRouteId.peek(), "home");
  assertEquals(manager.location().routeId, "home");
  assert(Object.isFrozen(manager.location()));

  const oversized = "x".repeat(4_097);
  assertRouteError(() => manager.register({ id: oversized }), "limit-exceeded");
  assertRouteError(() => new RouteManager([{ id: oversized }]), "limit-exceeded");
  assertRouteError(() => manager.activeRouteId.value = oversized, "limit-exceeded");
  assertRouteError(() => manager.routes.value = [{ id: oversized }], "limit-exceeded");
  assertRouteError(() => manager.routes.jink([{ id: oversized }]), "limit-exceeded");
  assertRouteError(() => manager.routes.value.push({ id: oversized }), "limit-exceeded");
  assertEquals(manager.ids(), ["home", "details"]);
  assertEquals(manager.activeRouteId.peek(), "home");
  assertEquals(manager.location().routeId, "home");

  const callerOwned = { id: "caller-owned", title: "Caller Owned" };
  assertEquals(manager.routes.value.push(callerOwned), 3);
  assertEquals(manager.ids(), ["home", "details", "caller-owned"]);
  callerOwned.id = oversized;
  Object.freeze(callerOwned);
  assertEquals(manager.routes.peek()[2]!.id, "caller-owned");
  assertEquals(manager.ids(), ["home", "details", "caller-owned"]);
  assertEquals(manager.has("caller-owned"), true);
  assertEquals(manager.has(oversized), false);
  assertEquals(manager.routes.value.push({ id: "after-freeze", title: "After Freeze" }), 4);
  assertEquals(manager.ids(), ["home", "details", "caller-owned", "after-freeze"]);
  assertRouteError(() => manager.routes.peek()[2]!.id = oversized, "limit-exceeded");
  manager.routes.peek()[2]!.id = "renamed";
  assertEquals(manager.ids(), ["home", "details", "renamed", "after-freeze"]);
  assertEquals(manager.has("caller-owned"), false);
  assertEquals(manager.has("renamed"), true);

  manager.routes.value[2] = { id: "replacement", title: "Replacement" };
  assertEquals(manager.ids(), ["home", "details", "replacement", "after-freeze"]);

  let routeEvents = 0;
  manager.routes.subscribe(() => routeEvents += 1);
  const beforeDescriptorMutation = manager.routes.peek().slice();
  assertRouteError(
    () => Object.defineProperty(manager.routes.value, "length", { value: 1, writable: false }),
    "invalid-type",
  );
  assertRouteError(
    () => Object.defineProperty(manager.routes.value, "1", { value: { id: "hidden" } }),
    "invalid-type",
  );
  assertEquals(manager.routes.peek(), beforeDescriptorMutation);
  assertEquals(manager.ids(), ["home", "details", "replacement", "after-freeze"]);
  assertEquals(routeEvents, 0);
  assertEquals(Object.getOwnPropertyDescriptor(manager.routes.value, "length")?.writable, true);

  Object.defineProperty(manager.routes.value, "2", {
    value: { id: "defined", title: "Defined" },
    writable: true,
    enumerable: true,
    configurable: true,
  });
  assertEquals(manager.ids(), ["home", "details", "defined", "after-freeze"]);
  assertEquals(routeEvents, 1);

  assertEquals(manager.navigate({ routeId: "home", query: { tab: "kept" } }), true);
  manager.activeRouteId.jink("home");
  assertEquals(manager.location().query, { tab: "kept" });
  manager.activeRouteId.jink("details");
  assertEquals(manager.activeRouteId.peek(), "details");
  assertEquals(manager.location().routeId, "details");
  assertThrows(() => manager.activeRouteId.dispose(), TypeError);
  assertThrows(() => manager.routes.dispose(), TypeError);
});

Deno.test("RouteManager suppresses no-op location changes and activates an inserted fallback once", () => {
  const manager = new RouteManager<Route>([{ id: "home", title: "Home" }]);
  let routeIdEvents = 0;
  let locationEvents = 0;
  manager.activeRouteId.subscribe(() => routeIdEvents += 1);
  manager.activeLocation.subscribe(() => locationEvents += 1);

  assertEquals(manager.navigate("home"), true);
  assertEquals(manager.next()?.id, "home");
  assertEquals(manager.previous()?.id, "home");
  assertEquals(routeIdEvents, 0);
  assertEquals(locationEvents, 0);

  const empty = new RouteManager<Route>([]);
  let emptyRouteIdEvents = 0;
  let emptyLocationEvents = 0;
  empty.activeRouteId.subscribe(() => emptyRouteIdEvents += 1);
  empty.activeLocation.subscribe(() => emptyLocationEvents += 1);
  assertEquals(empty.register({ id: "home" }, { activate: true }), true);
  assertEquals(emptyRouteIdEvents, 1);
  assertEquals(emptyLocationEvents, 1);
});

Deno.test("route locations reject accessors cycles sparse arrays and lossy values", () => {
  let getterCalls = 0;
  const accessorState = Object.defineProperty({}, "secret", {
    enumerable: true,
    get() {
      getterCalls += 1;
      return "leak";
    },
  });
  const accessorInput = Object.defineProperty({}, "routeId", {
    enumerable: true,
    get() {
      getterCalls += 1;
      return "home";
    },
  });

  assertRouteError(
    () => createRouteLocation(accessorInput as { routeId: string }),
    "invalid-type",
  );
  assertRouteError(
    () => createRouteLocation({ routeId: "home", state: accessorState }),
    "invalid-type",
  );
  assertEquals(getterCalls, 0);

  let lengthReads = 0;
  const hostileArray = new Proxy(["safe"], {
    get(target, property, receiver) {
      if (property === "length") {
        lengthReads += 1;
        throw new Error("array length getter must not run");
      }
      return Reflect.get(target, property, receiver);
    },
  });
  assertEquals(createRouteLocation({ routeId: "home", query: { values: hostileArray } }).query, {
    values: ["safe"],
  });
  assertEquals(lengthReads, 0);

  const cycle: Record<string, unknown> = {};
  cycle.self = cycle;
  assertRouteError(() => createRouteLocation({ routeId: "home", state: cycle }), "invalid-state");

  const sparse = new Array<string>(2);
  sparse[1] = "present";
  assertRouteError(() => createRouteLocation({ routeId: "home", query: { sparse } }), "invalid-type");
  assertRouteError(() => createRouteLocation({ routeId: "home", state: Number.NaN }), "invalid-state");
  assertRouteError(() => createRouteLocation({ routeId: "home", state: 1n }), "invalid-state");
  assertRouteError(() => createRouteLocation({ routeId: "bad\ud800" }), "invalid-string");
  assertRouteError(() => createRouteLocation({ version: 2 as 1, routeId: "home" }), "invalid-version");

  const revokedInput = Proxy.revocable({ routeId: "home" }, {});
  revokedInput.revoke();
  assertRouteError(
    () => createRouteLocation(revokedInput.proxy as unknown as { routeId: string }),
    "invalid-type",
  );
  const revokedQueryValues = Proxy.revocable<string[]>(["one"], {});
  revokedQueryValues.revoke();
  assertRouteError(
    () => createRouteLocation({ routeId: "home", query: { values: revokedQueryValues.proxy } }),
    "invalid-record",
  );
  const revokedState = Proxy.revocable<unknown[]>([], {});
  revokedState.revoke();
  assertRouteError(() => createRouteLocation({ routeId: "home", state: revokedState.proxy }), "invalid-state");

  let deepState: unknown = null;
  for (let depth = 0; depth < 34; depth += 1) deepState = { next: deepState };
  assertRouteError(() => createRouteLocation({ routeId: "home", state: deepState }), "limit-exceeded");
});

Deno.test("route-location wire parsing fails closed on malformed envelopes", () => {
  assertRouteError(() => parseRouteLocation("/home"), "invalid-wire-format");
  assertRouteError(() => parseRouteLocation("tui-route:v2:home"), "invalid-wire-format");
  assertRouteError(() => parseRouteLocation("tui-route:v1:%"), "invalid-encoding");
  assertRouteError(() => parseRouteLocation("tui-route:v1:home?x=%7B%7D"), "invalid-wire-format");
  assertRouteError(
    () => parseRouteLocation("tui-route:v1:home?p=%7B%7D&p=%7B%7D"),
    "invalid-wire-format",
  );
  assertRouteError(() => parseRouteLocation("tui-route:v1:home?s=not-json"), "invalid-wire-format");
  assertRouteError(
    () => formatRouteLocation({ routeId: "home", query: { huge: "x".repeat(65_536) } }),
    "limit-exceeded",
  );
  assertRouteError(
    () =>
      formatRouteLocation({
        routeId: "home",
        query: { individuallyBounded: Array.from({ length: 9 }, () => "x".repeat(8_192)) },
      }),
    "limit-exceeded",
  );

  const oversizedDiagnosticKey = "x".repeat(60_000);
  const wireError = assertRouteError(
    () => parseRouteLocation(`tui-route:v1:home?${oversizedDiagnosticKey}=a`),
    "invalid-wire-format",
  );
  assert(wireError.message.length < 600);
  assert(wireError.path.length <= 256);

  const stateWithOversizedProperty: unknown[] = [];
  Object.defineProperty(stateWithOversizedProperty, oversizedDiagnosticKey, {
    configurable: true,
    enumerable: true,
    value: "unsafe",
    writable: true,
  });
  const stateError = assertRouteError(
    () => createRouteLocation({ routeId: "home", state: stateWithOversizedProperty }),
    "invalid-state",
  );
  assert(stateError.message.length < 600);
  assert(stateError.path.length <= 256);
});

function assertRouteError(fn: () => unknown, code: RouteLocationError["code"]): RouteLocationError {
  const error = assertThrows(fn, RouteLocationError);
  assertEquals(error.code, code);
  return error;
}
