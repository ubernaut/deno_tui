// Copyright 2023 Im-Beast. MIT license.
import { assert, assertEquals } from "./deps.ts";
import { bindRouteHistory, HistoryStack } from "../src/app/history.ts";
import { type Route, RouteManager } from "../src/app/router.ts";
import { ScreenRouterModeBinding } from "../src/app/screen_router.ts";
import { type ScreenDefinition, type ScreenLifecycleEvent, ScreenStack } from "../src/app/screens.ts";

Deno.test("Router transitions project as push, replace, back, and current without owning history", () => {
  const router = routes("a", "b", "c");
  const stack = new ScreenStack(definitions("a", "b", "c"));
  const binding = new ScreenRouterModeBinding({
    router,
    modes: [{ id: "main", stack }],
    mappings: [
      mapping("a", "main", "a"),
      mapping("b", "main", "b"),
      mapping("c", "main", "c", { enter: "replace" }),
    ],
  });

  assertEquals(stack.stackIds(), ["a"]);
  assertEquals(binding.inspect().lastSync?.transition, "push");
  assertEquals(binding.inspect().routeHistoryOwnership, "external");
  assertEquals(binding.inspect().stackNavigationPolicy, "router-authoritative");

  assertEquals(router.navigate("b"), true);
  assertEquals(stack.stackIds(), ["a", "b"]);
  assertEquals(binding.inspect().lastSync?.transition, "push");
  assertEquals(binding.inspect().lastSync?.stackOperation, "push");

  assertEquals(router.navigate("a"), true);
  assertEquals(stack.stackIds(), ["a"]);
  assertEquals(binding.inspect().lastSync?.transition, "back");
  assertEquals(binding.inspect().lastSync?.stackOperation, "switch");

  assertEquals(binding.sync().transition, "current");
  assertEquals(stack.stackIds(), ["a"]);
  assertEquals(router.navigate("c"), true);
  assertEquals(stack.stackIds(), ["c"]);
  assertEquals(binding.inspect().lastSync?.transition, "replace");

  // RouteManager previous/next cycle its registered route list. They are not
  // browser-like history traversal and the adapter does not reinterpret them.
  assertEquals(router.previous()?.id, "b");
  assertEquals(router.active()?.id, "b");
  assertEquals(stack.stackIds(), ["c", "b"]);
  assertEquals(router.next()?.id, "c");
  assertEquals(stack.stackIds(), ["c"]);
  assertEquals(binding.inspect().lastSync?.transition, "back");
});

Deno.test("independent named modes retain their own stacks across route changes", () => {
  const router = routes("home", "settings", "editor", "preview");
  const main = new ScreenStack(definitions("home", "settings"));
  const edit = new ScreenStack(definitions("editor", "preview"));
  const binding = new ScreenRouterModeBinding({
    router,
    modes: [
      { id: "main", stack: main },
      { id: "edit", stack: edit },
    ],
    mappings: [
      mapping("home", "main", "home"),
      mapping("settings", "main", "settings"),
      mapping("editor", "edit", "editor"),
      mapping("preview", "edit", "preview"),
    ],
  });

  assertEquals(main.stackIds(), ["home"]);
  assertEquals(edit.stackIds(), []);
  router.navigate("editor");
  router.navigate("preview");
  assertEquals(main.stackIds(), ["home"]);
  assertEquals(edit.stackIds(), ["editor", "preview"]);
  assertEquals(binding.inspect().activeMode, "edit");

  router.navigate("settings");
  assertEquals(main.stackIds(), ["home", "settings"]);
  assertEquals(edit.stackIds(), ["editor", "preview"]);
  assertEquals(binding.inspect().modes, [
    {
      id: "edit",
      active: false,
      stackDisposed: false,
      stackRevision: edit.revision,
      depth: 2,
      activeScreenId: "preview",
      mappingCount: 2,
    },
    {
      id: "main",
      active: true,
      stackDisposed: false,
      stackRevision: main.revision,
      depth: 2,
      activeScreenId: "settings",
      mappingCount: 2,
    },
  ]);

  // Inactive modes remain independently mutable. Activating their matching
  // route later observes the already-current screen without rewriting it.
  assertEquals(edit.switch("editor"), true);
  assertEquals(router.active()?.id, "settings");
  assertEquals(edit.stackIds(), ["editor"]);
  router.navigate("editor");
  assertEquals(binding.inspect().lastSync?.transition, "current");
  assertEquals(edit.stackIds(), ["editor"]);
});

Deno.test("external route history drives projection while active-stack drift never drives Router", async () => {
  const router = routes("home", "details");
  const history = new HistoryStack();
  const disposeHistory = bindRouteHistory(router, history);
  const events: string[] = [];
  const stack = new ScreenStack<ScreenDefinition, string>(definitions("home", "details", "rogue"), {
    captureFocus: (event) => `${event.screenId}-focus`,
    restoreFocus: (token, event) => events.push(`restore:${event.screenId}:${token}`),
    onLifecycle: (event) => events.push(lifecycle(event)),
  });
  const binding = new ScreenRouterModeBinding({
    router,
    modes: [{ id: "main", stack }],
    mappings: [mapping("home", "main", "home"), mapping("details", "main", "details")],
  });

  router.navigate("details");
  assertEquals(history.undoDepth, 1);
  assertEquals(stack.stackIds(), ["home", "details"]);
  assertEquals(await history.undo(), true);
  assertEquals(router.active()?.id, "home");
  assertEquals(stack.stackIds(), ["home"]);
  assertEquals(binding.inspect().lastSync?.transition, "back");
  assertEquals(await history.redo(), true);
  assertEquals(router.active()?.id, "details");
  assertEquals(stack.stackIds(), ["home", "details"]);
  assertEquals(history.undoDepth, 1);

  events.length = 0;
  assertEquals(stack.push("rogue"), true);
  assertEquals(router.active()?.id, "details");
  assertEquals(stack.stackIds(), ["home", "details"]);
  assertEquals(binding.inspect().lastStackChange?.operation, "push");
  assertEquals(binding.inspect().lastSync?.source, "stack");
  assertEquals(binding.inspect().lastSync?.transition, "back");
  assertEquals(history.undoDepth, 1);
  assertEquals(events, [
    "details:suspend:push",
    "rogue:mount:push",
    "rogue:focus:push",
    "rogue:close:switch",
    "details:resume:switch",
    "restore:details:details-focus",
    "details:focus:switch",
  ]);

  events.length = 0;
  assertEquals(stack.pop(), true);
  assertEquals(router.active()?.id, "details");
  assertEquals(stack.stackIds(), ["home", "details"]);
  assertEquals(history.undoDepth, 1);
  assertEquals(events, [
    "details:close:pop",
    "home:resume:pop",
    "restore:home:home-focus",
    "home:focus:pop",
    "home:suspend:push",
    "details:mount:push",
    "details:focus:push",
  ]);

  disposeHistory();
});

Deno.test("projection preserves ScreenStack lifecycle and focus restoration ordering", () => {
  const router = routes("a", "b", "c");
  const events: string[] = [];
  const stack = new ScreenStack<ScreenDefinition, string>(definitions("a", "b", "c"), {
    captureFocus: (event) => {
      events.push(`capture:${event.screenId}:${event.phase}`);
      return `${event.screenId}-token`;
    },
    restoreFocus: (token, event) => events.push(`restore:${event.screenId}:${token}`),
    onLifecycle: (event) => events.push(lifecycle(event)),
  });
  const binding = new ScreenRouterModeBinding({
    router,
    modes: [{ id: "main", stack }],
    mappings: [
      mapping("a", "main", "a"),
      mapping("b", "main", "b"),
      mapping("c", "main", "c", { enter: "replace" }),
    ],
  });
  assertEquals(events, ["a:mount:push", "a:focus:push"]);

  events.length = 0;
  router.navigate("b");
  assertEquals(events, [
    "capture:a:suspend",
    "a:suspend:push",
    "b:mount:push",
    "b:focus:push",
  ]);

  events.length = 0;
  router.navigate("a");
  assertEquals(events, [
    "b:close:switch",
    "a:resume:switch",
    "restore:a:a-token",
    "a:focus:switch",
  ]);

  events.length = 0;
  assertEquals(binding.sync().transition, "current");
  assertEquals(events, []);
  router.navigate("c");
  assertEquals(events, ["a:close:replace", "c:mount:replace", "c:focus:replace"]);
});

Deno.test("malformed, unknown, and non-restorable mappings fail closed and remain inspectable", () => {
  let now = 100;
  const router = routes("home", "missing-screen", "transient");
  const stack = new ScreenStack(definitions("home", "transient"));
  const diagnostics: string[] = [];
  const binding = new ScreenRouterModeBinding({
    router,
    modes: [
      { id: "main", stack },
      { id: "main", stack },
    ],
    mappings: [
      mapping("home", "main", "home"),
      mapping("home", "main", "transient"),
      mapping("missing-screen", "main", "late"),
      mapping("transient", "main", "transient", { restorable: false }),
      mapping("future", "main", "home"),
      mapping("bad-mode", "absent", "home"),
      { routeId: " spaced ", mode: "main", screenId: "home", enter: "push" },
    ],
    now: () => now++,
    onDiagnostic: (diagnostic) => diagnostics.push(diagnostic.code),
  });

  assertEquals(stack.stackIds(), ["home"]);
  const initial = binding.inspect();
  assertEquals(initial.configuredModeCount, 2);
  assertEquals(initial.modeCount, 1);
  assertEquals(initial.configuredMappingCount, 7);
  assertEquals(initial.mappingCount, 4);
  assert(diagnostics.includes("duplicate-mode"));
  assert(diagnostics.includes("duplicate-route-mapping"));
  assert(diagnostics.includes("unknown-mode"));
  assert(diagnostics.includes("invalid-mapping"));
  assertEquals(initial.mappings.find((entry) => entry.routeId === "future")?.inactiveReason, "route-unregistered");

  router.navigate("missing-screen");
  assertEquals(binding.inspect().lastSync?.status, "unresolved");
  assertEquals(binding.inspect().lastSync?.diagnostic?.code, "unknown-screen");
  assertEquals(stack.stackIds(), ["home"]);

  // Registering the missing screen is observed and safely completes the still
  // Router-owned active projection.
  assertEquals(stack.register({ id: "late" }), true);
  assertEquals(stack.stackIds(), ["home", "late"]);
  assertEquals(binding.inspect().lastSync?.status, "applied");

  router.navigate("transient");
  assertEquals(binding.inspect().lastSync?.diagnostic?.code, "non-restorable-screen");
  assertEquals(stack.stackIds(), ["home", "late"]);
  assertEquals(stack.push("transient"), true);
  assertEquals(binding.inspect().lastSync?.status, "current");
  assertEquals(stack.stackIds(), ["home", "late", "transient"]);

  assertEquals(stack.pop(), true);
  assertEquals(router.active()?.id, "transient");
  assertEquals(stack.stackIds(), ["home", "late"]);
  assertEquals(binding.inspect().lastSync?.diagnostic?.code, "non-restorable-screen");
  assert(binding.inspect().diagnostics.every((entry) => Number.isFinite(entry.timestamp)));
});

Deno.test("lifecycle-triggered route changes queue deterministically and cycles are bounded", () => {
  const router = routes("a", "b");
  const events: string[] = [];
  const stack = new ScreenStack<ScreenDefinition>([
    {
      id: "a",
      onMount: () => {
        events.push("a:mount:navigate-b");
        router.navigate("b");
      },
    },
    { id: "b" },
  ], {
    onLifecycle: (event) => events.push(lifecycle(event)),
  });
  const binding = new ScreenRouterModeBinding({
    router,
    modes: [{ id: "main", stack }],
    mappings: [mapping("a", "main", "a"), mapping("b", "main", "b")],
  });
  assertEquals(router.active()?.id, "b");
  assertEquals(stack.stackIds(), ["a", "b"]);
  assertEquals(binding.inspect().activeScreenId, "b");
  assertEquals(binding.inspect().queuedSyncCount, 1);
  assertEquals(events, [
    "a:mount:navigate-b",
    "a:mount:push",
    "a:focus:push",
    "a:suspend:push",
    "b:mount:push",
    "b:focus:push",
  ]);

  const cyclingRouter = routes("x", "y");
  const cyclingStack = new ScreenStack<ScreenDefinition>([
    { id: "x", onMount: () => cyclingRouter.navigate("y") },
    { id: "y", onMount: () => cyclingRouter.navigate("x") },
  ]);
  const cyclingBinding = new ScreenRouterModeBinding({
    router: cyclingRouter,
    modes: [{ id: "cycle", stack: cyclingStack }],
    mappings: [
      mapping("x", "cycle", "x", { enter: "replace" }),
      mapping("y", "cycle", "y", { enter: "replace" }),
    ],
    maxSyncPasses: 3,
  });
  assertEquals(cyclingBinding.inspect().lastSync?.status, "unresolved");
  assertEquals(cyclingBinding.inspect().lastSync?.diagnostic?.code, "reentrant-sync-limit");
  assertEquals(cyclingBinding.inspect().syncCount, 3);
});

Deno.test("ScreenRouterModeBinding snapshots are defensive and disposal is non-owning", () => {
  const router = routes("home", "details");
  const stack = new ScreenStack(definitions("home", "details", "external"));
  const routeSubscriptions = router.activeRouteId.inspect().subscriptions;
  const routeListSubscriptions = router.routes.inspect().subscriptions;
  let notifications = 0;
  const binding = new ScreenRouterModeBinding({
    router,
    modes: [{ id: "main", stack }],
    mappings: [mapping("home", "main", "home"), mapping("details", "main", "details")],
  });
  binding.subscribe(() => notifications++);
  binding.subscribe(() => {
    throw new Error("listener exploded");
  });
  assertEquals(router.activeRouteId.inspect().subscriptions, routeSubscriptions + 1);
  assertEquals(router.routes.inspect().subscriptions, routeListSubscriptions + 1);

  router.navigate("details");
  assertEquals(stack.stackIds(), ["home", "details"]);
  assertEquals(notifications, 1);
  assertEquals(binding.inspect().diagnostics.at(-1)?.code, "listener-error");

  const snapshot = binding.inspect();
  (snapshot.diagnostics as unknown as unknown[]).push({});
  (snapshot.modes as unknown as Array<{ id: string }>)[0]!.id = "mutated";
  (snapshot.mappings as unknown as Array<{ screenId: string }>)[0]!.screenId = "mutated";
  if (snapshot.lastStackChange) {
    (snapshot.lastStackChange.screenIds as unknown as string[]).push("mutated");
  }
  assertEquals(binding.inspect().modes[0]?.id, "main");
  assertEquals(binding.inspect().mappings[0]?.screenId, "home");

  const revision = binding.revision;
  binding.dispose();
  binding.dispose();
  assertEquals(binding.revision, revision + 1);
  assertEquals(router.activeRouteId.inspect().subscriptions, routeSubscriptions);
  assertEquals(router.routes.inspect().subscriptions, routeListSubscriptions);
  assertEquals(router.active()?.id, "details");
  assertEquals(router.navigate("home"), true);
  assertEquals(stack.stackIds(), ["home", "details"]);
  assertEquals(stack.push("external"), true);
  assertEquals(stack.stackIds(), ["home", "details", "external"]);
  assertEquals(router.active()?.id, "home");
  assertEquals(router.activeRouteId.disposed, false);
  assertEquals(stack.disposed, false);
  assertEquals(binding.sync().status, "disposed");
});

function routes(...ids: string[]): RouteManager<Route> {
  return new RouteManager<Route>(ids.map((id) => ({ id, title: id.toUpperCase() })));
}

function definitions(...ids: string[]): ScreenDefinition[] {
  return ids.map((id) => ({ id, title: id.toUpperCase() }));
}

function mapping(
  routeId: string,
  mode: string,
  screenId: string,
  options: Partial<Pick<ReturnType<typeof mappingShape>, "enter" | "restorable">> = {},
): ReturnType<typeof mappingShape> {
  return mappingShape(routeId, mode, screenId, options);
}

function mappingShape(
  routeId: string,
  mode: string,
  screenId: string,
  options: { enter?: "push" | "replace"; restorable?: boolean } = {},
) {
  return { routeId, mode, screenId, ...options };
}

function lifecycle(event: ScreenLifecycleEvent): string {
  return `${event.screenId}:${event.phase}:${event.operation}`;
}
