import { assertEquals } from "./deps.ts";
import { createApp } from "../src/app/app.ts";
import { ActionBus } from "../src/app/actions.ts";
import type { Action } from "../src/app/actions.ts";
import {
  bindCommandKeymap,
  bindCommandKeys,
  bindCommandSurface,
  commandForKeyEvent,
  commandSurfaceItems,
  createCommandSurface,
  executeCommandSurfaceItem,
  rankCommandSurfaceItems,
  searchCommandSurfaceItems,
} from "../src/app/command_bindings.ts";
import { CommandRegistry } from "../src/app/commands.ts";
import type { Command, CommandActionFactory } from "../src/app/commands.ts";
import { createDisposableStack, DisposableStack, disposeReverse } from "../src/app/disposables.ts";
import { bindHistoryCommands, bindRouteHistory, historyCommands } from "../src/app/history_bindings.ts";
import { HistoryStack } from "../src/app/history.ts";
import {
  createAppPlugin,
  createAppPluginCatalogReport,
  formatAppPluginCatalogMarkdown,
  inspectAppPluginDefinition,
  queryAppPluginDefinitions,
} from "../src/app/plugins.ts";
import { bindRouteCommands, bindRouteIndex, bindRouteSignal, routeCommands } from "../src/app/route_bindings.ts";
import { RouteManager } from "../src/app/router.ts";
import { SettingsController } from "../src/app/settings.ts";
import { bindSettingsCommands, settingsCommands } from "../src/app/settings_commands.ts";
import type { SettingsCommandAction } from "../src/app/settings_commands.ts";
import { bindSplitPaneCommands, splitPaneCommands } from "../src/app/split_pane_commands.ts";
import type { SplitPaneCommandAction } from "../src/app/split_pane_commands.ts";
import {
  bindDataTableSetting,
  bindRouteSetting,
  bindSettingSignal,
  bindSplitPaneSetting,
  bindThemeLayerSetting,
  bindThemePipelineSetting,
  bindThemeSetting,
} from "../src/app/settings_bindings.ts";
import { type DataColumn, DataTableController } from "../src/components/data_table.ts";
import {
  bindThemeCommands,
  themeCommands,
  themeLayerCommands,
  themePreviewCommands,
  themeSelectionCommands,
} from "../src/app/theme_commands.ts";
import type { ThemeCommandAction } from "../src/app/theme_commands.ts";
import { bindThemePipelineCommands, themePipelineCommands } from "../src/app/theme_pipeline_commands.ts";
import type { ThemePipelineCommandAction } from "../src/app/theme_pipeline_commands.ts";
import { createThemePlugin } from "../src/app/theme_plugin.ts";
import { KeymapRegistry } from "../src/keymap.ts";
import { SplitPaneController } from "../src/layout/mod.ts";
import { MemoryStore } from "../src/runtime/storage.ts";
import { Signal } from "../src/signals/mod.ts";
import { createTestKeyPress, TestKeyPressTarget } from "../src/testing/mod.ts";
import { createThemeLayerStack, createThemeProvider, createThemeRegistry } from "../src/theme.ts";
import { createThemeEnginePipeline } from "../src/theme_engine_pipeline.ts";
import type { Tui } from "../src/tui.ts";

Deno.test("ActionBus dispatches to subscribers in registration order", async () => {
  const bus = new ActionBus<{ type: "append"; payload: string }>();
  const seen: string[] = [];
  bus.subscribe((action) => {
    seen.push(`a:${action.payload}`);
  });
  bus.subscribe((action) => {
    seen.push(`b:${action.payload}`);
  });

  await bus.dispatch({ type: "append", payload: "x" });

  assertEquals(seen, ["a:x", "b:x"]);
});

Deno.test("ActionBus can subscribe to a single action type", async () => {
  type TestAction =
    | { type: "append"; payload: string }
    | { type: "clear" };
  const bus = new ActionBus<TestAction>();
  const seen: string[] = [];
  const unsubscribe = bus.subscribeType("append", (action) => {
    seen.push(action.payload);
  });

  await bus.dispatch({ type: "clear" });
  await bus.dispatch({ type: "append", payload: "a" });
  unsubscribe();
  await bus.dispatch({ type: "append", payload: "b" });

  assertEquals(seen, ["a"]);
});

Deno.test("DisposableStack defers idempotent reverse-order cleanup", () => {
  const events: string[] = [];
  const stack = new DisposableStack();

  const disposeSecond = stack.defer(() => events.push("second"));
  stack.defer(undefined);
  stack.defer(() => events.push("third"));
  stack.defer(() => events.push("fourth"));
  disposeSecond();

  assertEquals(stack.inspect(), { disposed: false, size: 2 });
  stack.dispose();
  stack.dispose();

  assertEquals(events, ["second", "fourth", "third"]);
  assertEquals(stack.inspect(), { disposed: true, size: 0 });
});

Deno.test("DisposableStack immediately runs deferred cleanup after disposal", () => {
  const events: string[] = [];
  const stack = createDisposableStack([() => events.push("first")]);

  stack.dispose();
  const disposeLate = stack.defer(() => events.push("late"));
  disposeLate();

  disposeReverse([
    () => events.push("a"),
    undefined,
    () => events.push("b"),
  ]);

  assertEquals(events, ["first", "late", "b", "a"]);
});

Deno.test("ActionBus middleware can transform and stop actions", async () => {
  type TestAction =
    | { type: "append"; payload: string }
    | { type: "drop"; payload: string };
  const bus = new ActionBus<TestAction>();
  const seen: string[] = [];

  bus.use(async (action, next) => {
    seen.push(`before:${action.type}`);
    if (action.type === "drop") return;
    await next({ ...action, payload: action.payload.toUpperCase() });
    seen.push(`after:${action.type}`);
  });
  bus.subscribe((action) => {
    seen.push(`handler:${action.type}:${action.payload}`);
  });

  assertEquals(bus.inspect(), { handlers: 1, middleware: 1, dispatching: false });
  const dispatch = bus.dispatch({ type: "append", payload: "a" });
  assertEquals(bus.inspect().dispatching, true);
  await dispatch;
  await bus.dispatch({ type: "drop", payload: "b" });

  assertEquals(seen, ["before:append", "handler:append:A", "after:append", "before:drop"]);
  assertEquals(bus.inspect(), { handlers: 1, middleware: 1, dispatching: false });
});

Deno.test("RouteManager navigates and cycles known routes only", () => {
  const routes = new RouteManager([
    { id: "home", title: "Home" },
    { id: "settings", title: "Settings" },
  ]);

  assertEquals(routes.active()?.id, "home");
  assertEquals(routes.navigate("missing"), false);
  assertEquals(routes.navigate("settings"), true);
  assertEquals(routes.active()?.title, "Settings");
  assertEquals(routes.get("home")?.title, "Home");
  assertEquals(routes.has("missing"), false);
  assertEquals(routes.ids(), ["home", "settings"]);
  assertEquals(routes.activeIndex(), 1);
  assertEquals(routes.inspect(), {
    count: 2,
    activeRouteId: "settings",
    activeIndex: 1,
    active: { id: "settings", title: "Settings" },
    ids: ["home", "settings"],
    routes: [
      { id: "home", title: "Home" },
      { id: "settings", title: "Settings" },
    ],
  });
  assertEquals(routes.next()?.id, "home");
});

Deno.test("RouteManager registers replaces and removes dynamic routes", () => {
  const routes = new RouteManager([{ id: "home", title: "Home" }]);

  assertEquals(routes.register({ id: "settings", title: "Settings" }, { activate: true }), true);
  assertEquals(routes.active()?.id, "settings");
  assertEquals(routes.routes.peek().map((route) => route.id), ["home", "settings"]);

  assertEquals(routes.register({ id: "settings", title: "Duplicate" }), false);
  assertEquals(routes.active()?.title, "Settings");

  assertEquals(routes.register({ id: "settings", title: "Preferences" }, { replace: true }), true);
  assertEquals(routes.active()?.title, "Preferences");

  assertEquals(routes.unregister("settings"), true);
  assertEquals(routes.active()?.id, "home");
  assertEquals(routes.unregister("missing"), false);

  routes.register({ id: "logs", title: "Logs" });
  routes.navigate("logs");
  routes.routes.value = [{ id: "metrics", title: "Metrics" }];
  assertEquals(routes.active()?.id, "metrics");
});

Deno.test("RouteManager can fallback to a preferred route when removing active routes", () => {
  const routes = new RouteManager([
    { id: "home", title: "Home" },
    { id: "settings", title: "Settings" },
    { id: "logs", title: "Logs" },
  ], "settings");

  assertEquals(routes.unregister("settings", { fallbackRouteId: "logs" }), true);
  assertEquals(routes.active()?.id, "logs");

  routes.unregister("logs");
  routes.unregister("home");
  assertEquals(routes.active(), undefined);
  assertEquals(routes.activeRouteId.peek(), "");
  assertEquals(routes.inspect(), {
    count: 0,
    activeRouteId: "",
    activeIndex: -1,
    active: undefined,
    ids: [],
    routes: [],
  });
});

Deno.test("RouteManager normalizes invalid initial routes", () => {
  const routes = new RouteManager([{ id: "home", title: "Home" }], "missing");

  assertEquals(routes.active()?.id, "home");
});

Deno.test("bindRouteSignal synchronizes route manager state with external signals", () => {
  const routes = new RouteManager([
    { id: "home", title: "Home" },
    { id: "settings", title: "Settings" },
  ]);
  const routeId = new Signal("settings");
  const invalid: string[] = [];
  const dispose = bindRouteSignal(routes, routeId, {
    initialSync: "signal",
    onInvalidRoute: (id) => invalid.push(id),
  });

  assertEquals(routes.active()?.id, "settings");

  routes.navigate("home");
  assertEquals(routeId.peek(), "home");

  routeId.value = "settings";
  assertEquals(routes.active()?.id, "settings");

  routeId.value = "missing";
  assertEquals(invalid, ["missing"]);
  assertEquals(routeId.peek(), "settings");
  assertEquals(routes.active()?.id, "settings");

  routes.routes.value = [{ id: "home", title: "Home" }];
  assertEquals(routeId.peek(), "home");
  assertEquals(routes.active()?.id, "home");

  dispose();
  routeId.value = "settings";
  assertEquals(routes.active()?.id, "home");
});

Deno.test("bindRouteIndex synchronizes route managers with index-backed widgets", () => {
  const routes = new RouteManager([
    { id: "home", title: "Home" },
    { id: "settings", title: "Settings" },
    { id: "logs", title: "Logs" },
  ]);
  const activeIndex = new Signal(1);
  const invalid: number[] = [];
  const dispose = bindRouteIndex(routes, activeIndex, {
    initialSync: "index",
    onInvalidIndex: (index) => invalid.push(index),
  });

  assertEquals(routes.active()?.id, "settings");

  routes.navigate("logs");
  assertEquals(activeIndex.peek(), 2);

  activeIndex.value = 0;
  assertEquals(routes.active()?.id, "home");

  activeIndex.value = 99;
  assertEquals(invalid, [99]);
  assertEquals(activeIndex.peek(), 2);
  assertEquals(routes.active()?.id, "logs");

  dispose();
  activeIndex.value = 0;
  assertEquals(routes.active()?.id, "logs");
});

Deno.test("bindRouteIndex supports filtered route id sources and route list changes", () => {
  const routes = new RouteManager([
    { id: "overview", title: "Overview" },
    { id: "widgets", title: "Widgets" },
    { id: "runtime", title: "Runtime" },
    { id: "logs", title: "Logs" },
  ], "runtime");
  const routeIds = new Signal<readonly string[]>(["overview", "runtime"]);
  const activeIndex = new Signal(0);

  bindRouteIndex(routes, activeIndex, { routeIds, fallbackRouteId: "overview" });

  assertEquals(activeIndex.peek(), 1);

  routeIds.value = ["overview", "widgets"];
  assertEquals(routes.active()?.id, "overview");
  assertEquals(activeIndex.peek(), 0);

  activeIndex.value = 1;
  assertEquals(routes.active()?.id, "widgets");

  routes.unregister("widgets");
  assertEquals(routes.active()?.id, "overview");
  assertEquals(activeIndex.peek(), 0);
});

Deno.test("routeCommands project route navigation into command registries", async () => {
  const routes = new RouteManager([
    { id: "overview", title: "Overview" },
    { id: "widgets", title: "Widgets" },
    { id: "runtime", title: "Runtime" },
  ], "overview");
  const registry = new CommandRegistry();

  const dispose = bindRouteCommands(registry, routes, {
    idPrefix: "nav",
    routeIds: ["overview", "runtime"],
    labels: { select: "Open" },
  });

  assertEquals(registry.list("routes").map((command) => command.id), [
    "nav.next",
    "nav.select.overview",
    "nav.select.runtime",
    "nav.previous",
  ]);
  assertEquals(registry.enabled(registry.get("nav.select.overview")!), false);
  assertEquals(registry.enabled(registry.get("nav.select.runtime")!), true);

  assertEquals(await registry.execute("nav.next"), true);
  assertEquals(routes.activeRouteId.peek(), "runtime");
  assertEquals(registry.enabled(registry.get("nav.select.runtime")!), false);

  assertEquals(await registry.execute("nav.previous"), true);
  assertEquals(routes.activeRouteId.peek(), "overview");

  assertEquals(await registry.execute("nav.select.runtime"), true);
  assertEquals(routes.activeRouteId.peek(), "runtime");

  dispose();
  assertEquals(registry.inspect("routes"), { count: 0, enabled: 0, disabled: 0, groups: [], commands: [] });
});

Deno.test("routeCommands support dynamic filtered routes and empty cycle disabling", async () => {
  const routes = new RouteManager([
    { id: "overview", title: "Overview" },
    { id: "widgets", title: "Widgets" },
    { id: "runtime", title: "Runtime" },
  ], "overview");
  const registry = new CommandRegistry();
  const visibleRoutes = new Signal<readonly string[]>(["widgets"]);
  const commands = routeCommands(routes, {
    routeIds: visibleRoutes,
    includeRouteCommands: false,
  });
  registry.registerAll(commands);

  assertEquals(commands.map((command) => command.id), ["route.previous", "route.next"]);
  assertEquals(registry.enabled(registry.get("route.previous")!), false);

  visibleRoutes.value = ["widgets", "runtime"];
  assertEquals(registry.enabled(registry.get("route.next")!), true);
  await registry.execute("route.next");
  assertEquals(routes.activeRouteId.peek(), "runtime");
});

Deno.test("CommandRegistry projects commands into menus palettes and key bindings", () => {
  const registry = new CommandRegistry<{ type: "route"; payload: string }>();
  registry.register({
    id: "route.home",
    label: "Go Home",
    group: "routes",
    keywords: ["home"],
    binding: { key: "1" },
    action: { type: "route", payload: "home" },
  });
  registry.register({
    id: "route.admin",
    label: "Admin",
    group: "routes",
    disabled: true,
    binding: { key: "a", ctrl: true },
    action: { type: "route", payload: "admin" },
  });

  assertEquals(registry.projections("routes"), [
    { id: "route.admin", label: "Admin", keywords: undefined, disabled: true },
    { id: "route.home", label: "Go Home", keywords: ["home"], disabled: false },
  ]);
  assertEquals(registry.projections("routes", false), [
    { id: "route.home", label: "Go Home", keywords: ["home"], disabled: false },
  ]);
  assertEquals(registry.keyBindings("routes"), [
    { key: "1", description: "Go Home", group: "routes" },
  ]);
  assertEquals(registry.inspect("routes"), {
    count: 2,
    enabled: 1,
    disabled: 1,
    groups: ["routes"],
    commands: [
      {
        id: "route.admin",
        label: "Admin",
        description: undefined,
        group: "routes",
        keywords: undefined,
        disabled: true,
        bindingId: "C-a",
        hasAction: true,
      },
      {
        id: "route.home",
        label: "Go Home",
        description: undefined,
        group: "routes",
        keywords: ["home"],
        disabled: false,
        bindingId: "1",
        hasAction: true,
      },
    ],
  });
});

Deno.test("CommandRegistry returns disposers for command registration", () => {
  const registry = new CommandRegistry<{ type: "route"; payload: string }>();
  const disposeHome = registry.register({
    id: "route.home",
    label: "Go Home",
    action: { type: "route", payload: "home" },
  });
  const disposeMore = registry.registerAll([
    {
      id: "route.settings",
      label: "Settings",
      action: { type: "route", payload: "settings" },
    },
    {
      id: "route.logs",
      label: "Logs",
      action: { type: "route", payload: "logs" },
    },
  ]);

  assertEquals(registry.list().map((command) => command.id), ["route.home", "route.logs", "route.settings"]);

  disposeMore();
  assertEquals(registry.list().map((command) => command.id), ["route.home"]);

  disposeHome();
  disposeHome();
  assertEquals(registry.list(), []);
});

Deno.test("CommandRegistry disposers do not remove replacement commands", () => {
  const registry = new CommandRegistry<{ type: "route"; payload: string }>();
  const disposeOriginal = registry.register({
    id: "route.home",
    label: "Home",
    action: { type: "route", payload: "home" },
  });
  const disposeReplacement = registry.register({
    id: "route.home",
    label: "Start",
    action: { type: "route", payload: "home" },
  });

  disposeOriginal();
  assertEquals(registry.get("route.home")?.label, "Start");

  disposeReplacement();
  assertEquals(registry.get("route.home"), undefined);
});

Deno.test("CommandRegistry supports groups has and clear", () => {
  const registry = new CommandRegistry<{ type: "route"; payload: string }>();
  let changes = 0;
  registry.subscribe(() => changes += 1);

  const disposeRoutes = registry.registerAll([
    { id: "route.home", label: "Home", group: "routes", action: { type: "route", payload: "home" } },
    { id: "route.logs", label: "Logs", group: "routes", action: { type: "route", payload: "logs" } },
  ]);
  registry.register({ id: "global.quit", label: "Quit", group: "global" });

  assertEquals(registry.has("route.home"), true);
  assertEquals(registry.groups(), ["global", "routes"]);
  assertEquals(registry.inspect().count, 3);

  registry.clear("routes");
  assertEquals(registry.list().map((command) => command.id), ["global.quit"]);
  assertEquals(registry.has("route.home"), false);

  disposeRoutes();
  assertEquals(registry.list().map((command) => command.id), ["global.quit"]);

  registry.clear("missing");
  assertEquals(changes, 4);
  registry.clear();
  assertEquals(registry.inspect(), { count: 0, enabled: 0, disabled: 0, groups: [], commands: [] });
  assertEquals(changes, 5);
});

Deno.test("CommandRegistry notifies subscribers when commands change", () => {
  const registry = new CommandRegistry<{ type: "route"; payload: string }>();
  let changes = 0;
  const unsubscribe = registry.subscribe(() => changes += 1);

  const dispose = registry.register({
    id: "route.home",
    label: "Home",
    action: { type: "route", payload: "home" },
  });
  registry.unregister("missing");
  dispose();
  unsubscribe();
  registry.register({
    id: "route.logs",
    label: "Logs",
    action: { type: "route", payload: "logs" },
  });

  assertEquals(changes, 2);
});

Deno.test("commandForKeyEvent matches enabled command bindings by modifiers and group", () => {
  const registry = new CommandRegistry<{ type: "route"; payload: string }>();
  registry.register({
    id: "route.home",
    label: "Go Home",
    group: "routes",
    binding: { key: "1" },
    action: { type: "route", payload: "home" },
  });
  registry.register({
    id: "route.admin",
    label: "Admin",
    group: "routes",
    disabled: true,
    binding: { key: "a", ctrl: true },
    action: { type: "route", payload: "admin" },
  });
  registry.register({
    id: "panel.next",
    label: "Next Panel",
    group: "panels",
    binding: { key: "1" },
    action: { type: "route", payload: "panel" },
  });

  assertEquals(commandForKeyEvent(registry, createTestKeyPress("1"))?.id, "panel.next");
  assertEquals(commandForKeyEvent(registry, createTestKeyPress("1"), { group: "routes" })?.id, "route.home");
  assertEquals(commandForKeyEvent(registry, createTestKeyPress("a", { ctrl: true })), undefined);
});

Deno.test("bindCommandKeys executes matching commands and unsubscribes", async () => {
  const registry = new CommandRegistry<{ type: "append"; payload: string }>();
  const target = new TestKeyPressTarget();
  const seen: string[] = [];
  registry.register({
    id: "append.a",
    label: "Append A",
    binding: { key: "a" },
    action: { type: "append", payload: "a" },
  });
  registry.register({
    id: "append.b",
    label: "Append B",
    binding: { key: "b", shift: true },
    action: () => ({ type: "append", payload: "b" }),
  });

  const dispose = bindCommandKeys(target, registry, (action) => {
    seen.push(action.payload);
  });
  target.key("a");
  target.key("b");
  target.key("b", { shift: true });
  await Promise.resolve();

  assertEquals(seen, ["a", "b"]);
  assertEquals(target.listenerCount(), 1);

  dispose();
  target.key("a");
  await Promise.resolve();
  assertEquals(seen, ["a", "b"]);
  assertEquals(target.listenerCount(), 0);
});

Deno.test("bindCommandKeymap mirrors command bindings into key help registries", () => {
  const registry = new CommandRegistry<{ type: "route"; payload: string }>();
  const keymap = new KeymapRegistry();
  keymap.register({ key: "q", description: "Quit", group: "app" });
  const dispose = bindCommandKeymap(registry, keymap, { group: "routes" });

  const disposeHome = registry.register({
    id: "route.home",
    label: "Home",
    group: "routes",
    binding: { key: "1" },
    action: { type: "route", payload: "home" },
  });
  registry.register({
    id: "panel.next",
    label: "Next Panel",
    group: "panels",
    binding: { key: "1" },
    action: { type: "route", payload: "panel" },
  });

  assertEquals(keymap.list().map((binding) => binding.description), ["Quit", "Home"]);

  registry.register({
    id: "route.logs",
    label: "Logs",
    description: "Open logs",
    group: "routes",
    binding: { key: "l" },
    action: { type: "route", payload: "logs" },
  });
  assertEquals(keymap.list("routes").map((binding) => binding.description), ["Home", "Open logs"]);

  disposeHome();
  assertEquals(keymap.list("routes").map((binding) => binding.description), ["Open logs"]);

  dispose();
  assertEquals(keymap.list().map((binding) => binding.description), ["Quit"]);
});

Deno.test("commandSurfaceItems adapts registry commands for palettes and menus", () => {
  const registry = new CommandRegistry<{ type: "route"; payload: string }>();
  registry.register({
    id: "route.home",
    label: "Go Home",
    description: "Open the home route",
    group: "routes",
    keywords: ["landing"],
    binding: { key: "1" },
    action: { type: "route", payload: "home" },
  });
  registry.register({
    id: "route.admin",
    label: "Admin",
    group: "routes",
    disabled: true,
    binding: { key: "a", ctrl: true },
    action: { type: "route", payload: "admin" },
  });

  assertEquals(commandSurfaceItems(registry, { group: "routes" }), [
    {
      id: "route.admin",
      label: "Admin",
      keywords: ["route.admin", "routes", "C-a"],
      disabled: true,
    },
    {
      id: "route.home",
      label: "Go Home",
      keywords: ["route.home", "routes", "Open the home route", "landing", "1"],
      disabled: false,
    },
  ]);
  assertEquals(commandSurfaceItems(registry, { group: "routes", includeDisabled: false }).map((item) => item.id), [
    "route.home",
  ]);
  assertEquals(
    commandSurfaceItems(registry, { group: "routes", includeBindingsInKeywords: false })[1].keywords,
    ["route.home", "routes", "Open the home route", "landing"],
  );
});

Deno.test("command surface search ranks labels ids keywords and key bindings", () => {
  const registry = new CommandRegistry<{ type: "route"; payload: string }>();
  registry.register({
    id: "route.home",
    label: "Go Home",
    description: "Open the home route",
    group: "routes",
    keywords: ["landing"],
    binding: { key: "1" },
    action: { type: "route", payload: "home" },
  });
  registry.register({
    id: "route.system-monitor",
    label: "System Monitor",
    description: "Open runtime dashboard",
    group: "routes",
    keywords: ["runtime", "metrics"],
    binding: { key: "m", ctrl: true },
    action: { type: "route", payload: "monitor" },
  });
  registry.register({
    id: "theme.next",
    label: "Next Theme",
    group: "theme",
    keywords: ["appearance"],
    disabled: true,
    binding: { key: "t" },
  });

  assertEquals(searchCommandSurfaceItems(registry, { query: "sys mon" }).map((item) => item.id), [
    "route.system-monitor",
  ]);
  assertEquals(searchCommandSurfaceItems(registry, { query: "C-m" }).map((item) => item.id), [
    "route.system-monitor",
  ]);
  assertEquals(searchCommandSurfaceItems(registry, { query: "theme", limit: 1 })[0], {
    id: "theme.next",
    label: "Next Theme",
    keywords: ["theme.next", "theme", "appearance", "t"],
    disabled: true,
  });
  assertEquals(
    searchCommandSurfaceItems(registry, {
      query: "theme",
      includeDisabled: false,
    }),
    [],
  );

  const ranked = rankCommandSurfaceItems(commandSurfaceItems(registry), "runtime");
  assertEquals(ranked.map((match) => [match.item.id, match.matched]), [
    ["route.system-monitor", ["runtime"]],
  ]);
  assertEquals(rankCommandSurfaceItems(commandSurfaceItems(registry), "", { limit: 2 }).map((match) => match.item.id), [
    "route.home",
    "route.system-monitor",
  ]);
});

Deno.test("executeCommandSurfaceItem dispatches selected command items", async () => {
  const registry = new CommandRegistry<{ type: "append"; payload: string }>();
  const seen: string[] = [];
  registry.register({
    id: "append.a",
    label: "Append A",
    action: { type: "append", payload: "a" },
  });

  assertEquals(
    await executeCommandSurfaceItem(registry, { id: "append.a" }, (action) => {
      seen.push(action.payload);
    }),
    true,
  );
  assertEquals(await executeCommandSurfaceItem(registry, { id: "missing" }), false);
  assertEquals(seen, ["a"]);
});

Deno.test("createCommandSurface keeps projected command items synchronized", async () => {
  const registry = new CommandRegistry<{ type: "append"; payload: string }>();
  const seen: string[] = [];
  const surface = createCommandSurface(registry, (action) => {
    seen.push(action.payload);
  }, { includeDisabled: false });

  assertEquals(surface.items.peek(), []);
  const disposeA = registry.register({
    id: "append.a",
    label: "Append A",
    action: { type: "append", payload: "a" },
  });
  registry.register({
    id: "append.b",
    label: "Append B",
    disabled: true,
    action: { type: "append", payload: "b" },
  });

  assertEquals(surface.items.peek().map((item) => item.id), ["append.a"]);
  assertEquals(await surface.execute({ id: "append.a" }), true);
  assertEquals(seen, ["a"]);

  disposeA();
  assertEquals(surface.items.peek(), []);

  surface.dispose();
  registry.register({ id: "append.c", label: "Append C" });
  assertEquals(surface.items.peek(), []);
});

Deno.test("bindCommandSurface mirrors registry changes into an existing signal", () => {
  const registry = new CommandRegistry();
  const items = new Signal(commandSurfaceItems(registry));
  const dispose = bindCommandSurface(registry, items, { group: "routes" });

  registry.register({ id: "global.quit", label: "Quit", group: "global" });
  assertEquals(items.peek(), []);

  registry.register({ id: "route.home", label: "Home", group: "routes" });
  assertEquals(items.peek().map((item) => item.id), ["route.home"]);

  dispose();
  registry.register({ id: "route.logs", label: "Logs", group: "routes" });
  assertEquals(items.peek().map((item) => item.id), ["route.home"]);
});

Deno.test("TuiApp dispatches command actions through the action bus", async () => {
  const tui = { destroy() {} } as unknown as Tui;
  const app = createApp<{ type: "toast"; payload: string }>({ tui });
  const seen: string[] = [];
  app.actions.subscribe((action) => {
    seen.push(action.payload);
  });
  app.commands.register({
    id: "toast.show",
    label: "Show Toast",
    action: () => ({ type: "toast", payload: "hello" }),
  });

  assertEquals(await app.executeCommand("toast.show"), true);
  assertEquals(await app.executeCommand("missing"), false);
  assertEquals(seen, ["hello"]);
  app.destroy();
});

Deno.test("TuiApp tracks action subscriptions through app disposal", async () => {
  type TestAction =
    | { type: "append"; payload: string }
    | { type: "clear" };
  const app = createApp<TestAction>({ tui: { destroy() {} } as unknown as Tui });
  const seen: string[] = [];

  app.onActionType("append", (action) => {
    seen.push(action.payload);
  });
  app.onAction((action) => {
    seen.push(`all:${action.type}`);
  });

  await app.actions.dispatch({ type: "append", payload: "a" });
  await app.actions.dispatch({ type: "clear" });
  app.destroy();
  await app.actions.dispatch({ type: "append", payload: "b" });

  assertEquals(seen, ["a", "all:append", "all:clear"]);
});

Deno.test("TuiApp tracks action middleware through app disposal", async () => {
  type TestAction = { type: "append"; payload: string };
  const app = createApp<TestAction>({ tui: { destroy() {} } as unknown as Tui });
  const seen: string[] = [];

  app.useActionMiddleware(async (action, next) => {
    seen.push(`middleware:${action.payload}`);
    await next({ ...action, payload: action.payload.toUpperCase() });
  });
  app.onAction((action) => {
    seen.push(`handler:${action.payload}`);
  });

  assertEquals(app.inspect().actions, { handlers: 1, middleware: 1, dispatching: false });
  await app.actions.dispatch({ type: "append", payload: "a" });
  app.destroy();
  await app.actions.dispatch({ type: "append", payload: "b" });

  assertEquals(seen, ["middleware:a", "handler:A"]);
  assertEquals(app.inspect().actions, { handlers: 0, middleware: 0, dispatching: false });
});

Deno.test("TuiApp can bind command keys to its action bus", async () => {
  const target = new TestKeyPressTarget();
  let destroyed = false;
  const tui = {
    on: target.on.bind(target),
    destroy() {
      destroyed = true;
    },
  } as unknown as Tui;
  const app = createApp<{ type: "toast"; payload: string }>({ tui });
  const seen: string[] = [];
  app.actions.subscribe((action) => {
    seen.push(action.payload);
  });
  app.commands.register({
    id: "toast.show",
    label: "Show Toast",
    binding: { key: "t", ctrl: true },
    action: { type: "toast", payload: "hello" },
  });

  const dispose = app.enableCommandKeys();
  target.key("t");
  target.key("t", { ctrl: true });
  await Promise.resolve();

  assertEquals(seen, ["hello"]);
  dispose();
  assertEquals(target.listenerCount(), 0);
  app.destroy();
  assertEquals(destroyed, true);
});

Deno.test("TuiApp can mirror command bindings into its keymap", () => {
  const app = createApp<{ type: "route"; payload: string }>({ tui: { destroy() {} } as unknown as Tui });
  app.commands.register({
    id: "route.home",
    label: "Home",
    group: "routes",
    binding: { key: "1" },
    action: { type: "route", payload: "home" },
  });

  const dispose = app.enableCommandKeymap();
  assertEquals(app.keymap.list().map((binding) => binding.description), ["Home"]);

  app.commands.register({
    id: "route.logs",
    label: "Logs",
    group: "routes",
    binding: { key: "l" },
    action: { type: "route", payload: "logs" },
  });
  assertEquals(app.keymap.list().map((binding) => binding.description), ["Home", "Logs"]);

  dispose();
  assertEquals(app.keymap.list(), []);
  app.destroy();
});

Deno.test("TuiApp tracks disposers and cleans them up on destroy", () => {
  let destroyed = 0;
  let disposed = 0;
  const app = createApp({ tui: { destroy: () => destroyed += 1 } as unknown as Tui });
  const first = app.onDispose(() => disposed += 1);
  app.onDispose(() => disposed += 10);

  first();
  first();
  assertEquals(disposed, 1);

  app.destroy();
  app.destroy();
  assertEquals(disposed, 11);
  assertEquals(destroyed, 1);

  app.onDispose(() => disposed += 100);
  assertEquals(disposed, 111);
});

Deno.test("TuiApp installs plugins and disposes them with the app", async () => {
  const app = createApp<{ type: "route"; payload: string }, { id: string; title: string }>({
    tui: { destroy() {} } as unknown as Tui,
    routes: [{ id: "home", title: "Home" }],
  });
  const events: string[] = [];

  const dispose = app.use({
    id: "settings",
    install(target) {
      target.routes.register({ id: "settings", title: "Settings" });
      const disposeCommands = target.commands.register({
        id: "route.settings",
        label: "Settings",
        action: { type: "route", payload: "settings" },
      });
      target.actions.subscribe((action) => {
        if (action.type === "route") target.routes.navigate(action.payload);
      });
      events.push("install");
      return () => {
        disposeCommands();
        target.routes.unregister("settings");
        events.push("dispose");
      };
    },
  });

  assertEquals(app.routes.routes.peek().map((route) => route.id), ["home", "settings"]);
  assertEquals(await app.executeCommand("route.settings"), true);
  assertEquals(app.routes.active()?.id, "settings");

  dispose();
  dispose();

  assertEquals(events, ["install", "dispose"]);
  assertEquals(app.commands.get("route.settings"), undefined);
  assertEquals(app.routes.routes.peek().map((route) => route.id), ["home"]);
  app.destroy();
});

Deno.test("TuiApp inspects plugins and skips duplicate identified installs", () => {
  const app = createApp({ tui: { destroy() {} } as unknown as Tui });
  const events: string[] = [];

  const disposeFirst = app.use({
    id: "settings",
    label: "Settings Pack",
    install() {
      events.push("install:first");
      return () => events.push("dispose:first");
    },
  });
  const disposeDuplicate = app.use({
    id: "settings",
    install() {
      events.push("install:duplicate");
      return () => events.push("dispose:duplicate");
    },
  });

  assertEquals(events, ["install:first"]);
  assertEquals(app.hasPlugin("settings"), true);
  assertEquals(app.pluginIds(), ["settings"]);
  assertEquals(app.plugins(), [{ id: "settings", label: "Settings Pack" }]);

  disposeDuplicate();
  assertEquals(app.hasPlugin("settings"), true);
  disposeFirst();
  assertEquals(app.hasPlugin("settings"), false);
  assertEquals(app.plugins(), []);
  assertEquals(events, ["install:first", "dispose:first"]);
  app.destroy();
});

Deno.test("TuiApp can replace identified plugins", () => {
  const app = createApp({ tui: { destroy() {} } as unknown as Tui });
  const events: string[] = [];

  app.use({
    id: "theme",
    install() {
      events.push("install:old");
      return () => events.push("dispose:old");
    },
  });
  const disposeReplacement = app.use({
    id: "theme",
    label: "Theme Pack",
    install() {
      events.push("install:new");
      return () => events.push("dispose:new");
    },
  }, { replace: true });

  assertEquals(events, ["install:old", "dispose:old", "install:new"]);
  assertEquals(app.plugins(), [{ id: "theme", label: "Theme Pack" }]);

  disposeReplacement();
  assertEquals(app.plugins(), []);
  assertEquals(events, ["install:old", "dispose:old", "install:new", "dispose:new"]);
  app.destroy();
});

Deno.test("TuiApp tracks function plugins with explicit metadata", () => {
  const app = createApp({ tui: { destroy() {} } as unknown as Tui });
  const events: string[] = [];
  const dispose = app.use(() => {
    events.push("install");
    return () => events.push("dispose");
  }, { id: "runtime", label: "Runtime Pack" });

  assertEquals(app.plugins(), [{ id: "runtime", label: "Runtime Pack" }]);
  dispose();
  assertEquals(app.plugins(), []);
  assertEquals(events, ["install", "dispose"]);
  app.destroy();
});

Deno.test("TuiApp inspects routes commands keymap focus plugins and lifecycle", () => {
  const app = createApp<{ type: "route"; payload: string }, { id: string; title: string }>({
    tui: { destroy() {} } as unknown as Tui,
    routes: [
      { id: "home", title: "Home" },
      { id: "settings", title: "Settings" },
    ],
    initialRouteId: "settings",
  });
  app.commands.register({
    id: "route.home",
    label: "Home",
    group: "routes",
    binding: { key: "1" },
    action: { type: "route", payload: "home" },
  });
  app.commands.register({
    id: "route.admin",
    label: "Admin",
    group: "routes",
    disabled: true,
    action: { type: "route", payload: "admin" },
  });
  app.keymap.register({ key: "1", description: "Home", group: "routes" });
  app.use({ id: "settings", label: "Settings Pack", install: () => undefined });
  app.useActionMiddleware((action, next) => next(action));
  app.onDispose(() => undefined);

  assertEquals(app.inspect(), {
    destroyed: false,
    disposers: 3,
    actions: {
      handlers: 0,
      middleware: 1,
      dispatching: false,
    },
    routes: {
      count: 2,
      activeRouteId: "settings",
      active: { id: "settings", title: "Settings" },
      ids: ["home", "settings"],
    },
    commands: {
      count: 2,
      enabled: 1,
      disabled: 1,
      groups: ["routes"],
    },
    keymap: {
      count: 1,
      groups: ["routes"],
    },
    focus: {
      count: 0,
      index: -1,
      hasFocus: false,
    },
    plugins: [{ id: "settings", label: "Settings Pack" }],
  });

  app.destroy();
  assertEquals(app.inspect().destroyed, true);
  assertEquals(app.inspect().disposers, 0);
  assertEquals(app.inspect().actions, { handlers: 0, middleware: 0, dispatching: false });
});

Deno.test("TuiApp installs plugin groups and cleans them up in reverse order", () => {
  const app = createApp({ tui: { destroy() {} } as unknown as Tui });
  const events: string[] = [];

  const dispose = app.useAll([
    () => {
      events.push("install:a");
      return () => events.push("dispose:a");
    },
    {
      install() {
        events.push("install:b");
        return () => events.push("dispose:b");
      },
    },
  ]);

  dispose();
  assertEquals(events, ["install:a", "install:b", "dispose:b", "dispose:a"]);

  app.use(() => {
    events.push("install:c");
    return () => events.push("dispose:c");
  });
  app.destroy();
  assertEquals(events, ["install:a", "install:b", "dispose:b", "dispose:a", "install:c", "dispose:c"]);
});

Deno.test("TuiApp rolls back plugin groups when a later install fails", () => {
  const app = createApp({ tui: { destroy() {} } as unknown as Tui });
  const events: string[] = [];

  try {
    app.useAll([
      () => {
        events.push("install:a");
        return () => events.push("dispose:a");
      },
      () => {
        events.push("install:b");
        return () => events.push("dispose:b");
      },
      () => {
        events.push("install:c");
        throw new Error("plugin boom");
      },
    ]);
    throw new Error("expected app.useAll to throw");
  } catch (error) {
    assertEquals(error instanceof Error && error.message, "plugin boom");
  }

  assertEquals(events, ["install:a", "install:b", "install:c", "dispose:b", "dispose:a"]);
  assertEquals(app.inspect().disposers, 0);
  app.destroy();
});

Deno.test("createAppPlugin installs declarative app surfaces with teardown", async () => {
  const app = createApp<{ type: "route"; payload: string }, { id: string; title: string }>({
    tui: { destroy() {} } as unknown as Tui,
    routes: [{ id: "home", title: "Home" }],
  });
  const events: string[] = [];
  const focusItem = { state: new Signal<"base" | "focused" | "active" | "disabled">("base") };
  const definition = {
    id: "settings",
    label: "Settings Pack",
    description: "Settings routes and commands.",
    tags: ["settings", "settings", "routes"],
    routes: [{ id: "settings", title: "Settings" }],
    commands: [{
      id: "route.settings",
      label: "Settings",
      group: "routes",
      action: { type: "route", payload: "settings-alias" },
    }],
    actionMiddleware: [
      (action, next) => next(action.payload === "settings-alias" ? { ...action, payload: "settings" } : action),
    ],
    keyBindings: [{ key: "s", description: "Settings", group: "routes" }],
    focusItems: [focusItem],
    install(target: typeof app) {
      events.push(`install:${target.routes.ids().join(",")}`);
      const stop = target.onActionType("route", (action) => {
        target.routes.navigate(action.payload);
      });
      return () => {
        events.push("dispose:custom");
        stop();
      };
    },
  } satisfies Parameters<typeof createAppPlugin<{ type: "route"; payload: string }, { id: string; title: string }>>[0];

  assertEquals(inspectAppPluginDefinition(definition), {
    id: "settings",
    label: "Settings Pack",
    description: "Settings routes and commands.",
    tags: ["routes", "settings"],
    routes: ["settings"],
    actionMiddleware: 1,
    commands: ["route.settings"],
    keyBindings: ["s"],
    focusItems: 1,
    hasInstaller: true,
  });

  const dispose = app.use(createAppPlugin(definition));
  assertEquals(app.plugins(), [{ id: "settings", label: "Settings Pack" }]);
  assertEquals(app.routes.ids(), ["home", "settings"]);
  assertEquals(app.commands.has("route.settings"), true);
  assertEquals(app.inspect().actions.middleware, 1);
  assertEquals(app.keymap.has({ key: "s" }), true);
  assertEquals(app.focus.inspect().count, 1);

  assertEquals(await app.executeCommand("route.settings"), true);
  assertEquals(app.routes.activeRouteId.peek(), "settings");

  dispose();
  assertEquals(app.routes.ids(), ["home"]);
  assertEquals(app.commands.has("route.settings"), false);
  assertEquals(app.inspect().actions.middleware, 0);
  assertEquals(app.keymap.has({ key: "s" }), false);
  assertEquals(app.focus.inspect().count, 0);
  assertEquals(events, ["install:home,settings", "dispose:custom"]);
  app.destroy();
});

Deno.test("app plugin catalog reports filter plugin definitions for docs and marketplaces", () => {
  const definitions = [
    {
      id: "settings",
      label: "Settings Pack",
      description: "Settings routes and commands.",
      tags: ["settings", "routes"],
      routes: [{ id: "settings", title: "Settings" }],
      commands: [{ id: "settings.open", label: "Settings" }],
      keyBindings: [{ key: ",", ctrl: true, description: "Settings" }],
    },
    {
      id: "runtime",
      label: "Runtime Pack",
      description: "Runtime metrics and async resources.",
      tags: ["runtime", "resources"],
      actionMiddleware: [(action: Action, next: (action: Action) => void) => next(action)],
      install: () => undefined,
    },
  ];

  assertEquals(queryAppPluginDefinitions(definitions, { tag: "runtime" }).map((plugin) => plugin.id), ["runtime"]);
  assertEquals(queryAppPluginDefinitions(definitions, { hasCommands: true }).map((plugin) => plugin.id), [
    "settings",
  ]);
  const report = createAppPluginCatalogReport({ plugins: definitions, query: { search: "settings" } });
  assertEquals(report.inspection, {
    count: 1,
    routeCount: 1,
    commandCount: 1,
    keyBindingCount: 1,
    focusItemCount: 0,
    actionMiddlewareCount: 0,
    installerCount: 0,
    tags: ["routes", "settings"],
  });
  assertEquals(report.plugins[0].commands, ["settings.open"]);
  assertEquals(
    formatAppPluginCatalogMarkdown({ plugins: definitions, title: "Plugins" }),
    [
      "# Plugins",
      "",
      "2 plugins, 1 routes, 1 commands, 1 key bindings.",
      "",
      "| Plugin | Tags | Routes | Commands | Key Bindings | Installer |",
      "| --- | --- | ---: | ---: | ---: | --- |",
      "| Runtime Pack | resources, runtime | 0 | 0 | 0 | yes |",
      "| Settings Pack | routes, settings | 1 | 1 | 1 | no |",
    ].join("\n"),
  );
});

Deno.test("createAppPlugin rolls back declarative registrations when install fails", () => {
  const app = createApp<{ type: "noop" }, { id: string; title: string }>({
    tui: { destroy() {} } as unknown as Tui,
    routes: [{ id: "home", title: "Home" }],
  });
  const plugin = createAppPlugin<{ type: "noop" }, { id: string; title: string }>({
    routes: [{ id: "admin", title: "Admin" }],
    commands: [{ id: "admin.open", label: "Admin", action: { type: "noop" } }],
    actionMiddleware: [(_action, next) => next(_action)],
    install() {
      throw new Error("boom");
    },
  });

  try {
    app.use(plugin);
    throw new Error("expected app.use to throw");
  } catch (error) {
    assertEquals(error instanceof Error && error.message, "boom");
  }

  assertEquals(app.routes.ids(), ["home"]);
  assertEquals(app.commands.has("admin.open"), false);
  assertEquals(app.inspect().actions.middleware, 0);
  app.destroy();
});

Deno.test("HistoryStack applies undo redo and clears stale redo entries", async () => {
  const history = new HistoryStack();
  const values: string[] = [];

  await history.apply({
    id: "add-a",
    label: "Add A",
    group: "letters",
    redo: () => {
      values.push("a");
    },
    undo: () => {
      values.pop();
    },
  });
  await history.apply({
    id: "add-b",
    label: "Add B",
    group: "letters",
    redo: () => {
      values.push("b");
    },
    undo: () => {
      values.pop();
    },
  });

  assertEquals(values, ["a", "b"]);
  assertEquals(history.inspect(), {
    canUndo: true,
    canRedo: false,
    undoDepth: 2,
    redoDepth: 0,
    nextUndo: { id: "add-b", label: "Add B", group: "letters" },
    nextRedo: undefined,
  });

  assertEquals(await history.undo(), true);
  assertEquals(values, ["a"]);
  assertEquals(history.inspect().nextRedo, { id: "add-b", label: "Add B", group: "letters" });
  assertEquals(await history.redo(), true);
  assertEquals(values, ["a", "b"]);
  assertEquals(await history.undo(), true);
  history.push({
    label: "Manual checkpoint",
    redo: () => undefined,
    undo: () => undefined,
  });
  assertEquals(history.canRedo(), false);
});

Deno.test("HistoryStack trims old entries by capacity", async () => {
  const history = new HistoryStack({ capacity: 2 });
  const values: number[] = [];

  for (const value of [1, 2, 3]) {
    await history.apply({
      label: `Add ${value}`,
      redo: () => {
        values.push(value);
      },
      undo: () => {
        values.pop();
      },
    });
  }

  assertEquals(history.undoDepth, 2);
  assertEquals(await history.undo(), true);
  assertEquals(await history.undo(), true);
  assertEquals(await history.undo(), false);
  assertEquals(values, [1]);
});

Deno.test("bindRouteHistory records undoable route changes without duplicating replays", async () => {
  const routes = new RouteManager([
    { id: "home", title: "Home" },
    { id: "settings", title: "Settings" },
    { id: "runtime", title: "Runtime" },
  ]);
  const history = new HistoryStack();
  const dispose = bindRouteHistory(routes, history, {
    id: (previous, next) => `${previous.id}->${next.id}`,
    label: (previous, next) => `${previous.title} to ${next.title}`,
  });

  routes.navigate("settings");
  routes.navigate("runtime");

  assertEquals(history.inspect(), {
    canUndo: true,
    canRedo: false,
    undoDepth: 2,
    redoDepth: 0,
    nextUndo: { id: "settings->runtime", label: "Settings to Runtime", group: "routes" },
    nextRedo: undefined,
  });

  assertEquals(await history.undo(), true);
  assertEquals(routes.active()?.id, "settings");
  assertEquals(history.inspect().undoDepth, 1);
  assertEquals(history.inspect().redoDepth, 1);

  assertEquals(await history.redo(), true);
  assertEquals(routes.active()?.id, "runtime");
  assertEquals(history.inspect().undoDepth, 2);
  assertEquals(history.inspect().redoDepth, 0);

  dispose();
  routes.navigate("home");
  assertEquals(history.inspect().undoDepth, 2);
});

Deno.test("historyCommands expose undo redo and clear command actions", async () => {
  const history = new HistoryStack();
  const values: string[] = [];

  const commands = historyCommands(history, {
    includeClear: true,
    labels: { undo: "Step Back", redo: "Step Forward" },
  });

  assertEquals(commands.map((command) => [command.id, command.label, commandDisabled(command)]), [
    ["history.undo", "Step Back", true],
    ["history.redo", "Step Forward", true],
    ["history.clear", "Clear History", true],
  ]);

  await history.apply({
    label: "Add A",
    redo: () => {
      values.push("a");
    },
    undo: () => {
      values.pop();
    },
  });

  assertEquals(commands.map((command) => [command.id, commandDisabled(command)]), [
    ["history.undo", false],
    ["history.redo", true],
    ["history.clear", false],
  ]);

  await runCommandFactory(commands[0]!);
  assertEquals(values, []);
  assertEquals(commandDisabled(commands[1]!), false);

  await runCommandFactory(commands[1]!);
  assertEquals(values, ["a"]);

  await runCommandFactory(commands[2]!);
  assertEquals(history.inspect().undoDepth, 0);
});

Deno.test("bindHistoryCommands registers history commands with disposers", async () => {
  const registry = new CommandRegistry();
  const history = new HistoryStack();
  const values: string[] = [];

  const dispose = bindHistoryCommands(registry, history, { idPrefix: "edit", group: "edit" });
  assertEquals(registry.keyBindings("edit").map((binding) => binding.key), []);
  assertEquals(await registry.execute("edit.undo"), false);

  await history.apply({
    label: "Add A",
    redo: () => {
      values.push("a");
    },
    undo: () => {
      values.pop();
    },
  });
  assertEquals(registry.keyBindings("edit").map((binding) => binding.key), ["z"]);
  assertEquals(await registry.execute("edit.undo"), true);
  assertEquals(values, []);
  assertEquals(registry.keyBindings("edit").map((binding) => binding.key), ["y"]);
  assertEquals(await registry.execute("edit.redo"), true);
  assertEquals(values, ["a"]);

  dispose();
  assertEquals(registry.list("edit"), []);
});

Deno.test("SettingsController namespaces and caches persistent settings", async () => {
  const store = new MemoryStore<unknown>();
  const settings = new SettingsController({ store, namespace: "shell" });

  const route = settings.signal({ key: "route", initialValue: "overview" });
  const sameRoute = settings.signal({ key: "route", initialValue: "ignored" });

  assertEquals(route, sameRoute);
  assertEquals(settings.key("route"), "shell.route");
  assertEquals(settings.has("route"), true);
  assertEquals(settings.keys(), ["shell.route"]);
  assertEquals(settings.localKeys(), ["route"]);
  assertEquals(settings.inspect(), { namespace: "shell", keys: ["shell.route"], localKeys: ["route"] });

  route.set("runtime");
  await settings.flush();
  assertEquals(await store.get("shell.route"), "runtime");
});

Deno.test("SettingsController supports serialization reset and ready aggregation", async () => {
  const store = new MemoryStore<unknown>();
  await store.set("prefs.layout", JSON.stringify({ split: 0.7 }));
  const settings = new SettingsController({ store, namespace: "prefs" });

  const layout = settings.signal({
    key: "layout",
    initialValue: { split: 0.5 },
    serialize: (value: { split: number }) => JSON.stringify(value),
    deserialize: (value: string) => JSON.parse(value) as { split: number },
  });

  await settings.ready();
  assertEquals(layout.value.value, { split: 0.7 });

  layout.set({ split: 0.25 });
  await settings.flush();
  assertEquals(await store.get("prefs.layout"), JSON.stringify({ split: 0.25 }));

  assertEquals(await settings.reset("layout"), true);
  assertEquals(layout.value.value, { split: 0.5 });
  assertEquals(await store.get("prefs.layout"), undefined);
  assertEquals(await settings.reset("missing"), false);
});

Deno.test("SettingsController resetAll and dispose apply to registered settings", async () => {
  const store = new MemoryStore<unknown>();
  const settings = new SettingsController({ store });
  const route = settings.signal({ key: "route", initialValue: "overview" });
  const theme = settings.signal({ key: "theme", initialValue: "plain" });
  let routeChanges = 0;

  route.value.subscribe(() => routeChanges++);
  route.set("runtime");
  theme.set("neon");
  await settings.flush();

  await settings.resetAll();
  assertEquals(route.value.value, "overview");
  assertEquals(theme.value.value, "plain");

  settings.dispose();
  assertEquals(routeChanges, 2);
  assertEquals(settings.keys(), []);
});

Deno.test("settingsCommands reset individual settings and all settings", async () => {
  const store = new MemoryStore<unknown>();
  const settings = new SettingsController({ store, namespace: "prefs" });
  const route = settings.signal({ key: "route", initialValue: "overview" });
  const theme = settings.signal({ key: "theme", initialValue: "plain" });
  route.set("runtime");
  theme.set("neon");
  await settings.flush();

  const registry = new CommandRegistry<SettingsCommandAction>();
  const dispose = bindSettingsCommands(registry, settings, {
    idPrefix: "prefs",
    group: "preferences",
    labels: { reset: "Restore" },
    keyLabel: (key) => key.toUpperCase(),
  });
  const actions: SettingsCommandAction[] = [];

  assertEquals(registry.list("preferences").map((command) => [command.id, command.label]), [
    ["prefs.resetAll", "Reset All Settings"],
    ["prefs.reset.route", "Restore: ROUTE"],
    ["prefs.reset.theme", "Restore: THEME"],
  ]);

  assertEquals(await registry.execute("prefs.reset.route", (action) => void actions.push(action)), true);
  assertEquals(route.value.peek(), "overview");
  assertEquals(theme.value.peek(), "neon");
  assertEquals(actions, [{ type: "settings.reset", payload: { key: "route" } }]);

  assertEquals(await registry.execute("prefs.resetAll", (action) => void actions.push(action)), true);
  assertEquals(route.value.peek(), "overview");
  assertEquals(theme.value.peek(), "plain");
  assertEquals(actions[1], { type: "settings.resetAll", payload: { keys: ["route", "theme"] } });

  dispose();
  assertEquals(registry.list("preferences"), []);
});

Deno.test("settingsCommands can omit reset all and disable empty settings", () => {
  const settings = new SettingsController({ store: new MemoryStore<unknown>() });
  const commands = settingsCommands(settings, { includeResetCommands: false });

  assertEquals(commands.map((command) => [command.id, command.label, commandDisabled(command)]), [
    ["settings.resetAll", "Reset All Settings", true],
  ]);
});

Deno.test("bindSettingSignal synchronizes persistent settings with app signals", async () => {
  const store = new MemoryStore<unknown>();
  await store.set("panel", "logs");
  const settings = new SettingsController({ store });
  const setting = settings.signal({ key: "panel", initialValue: "overview" });
  const activePanel = new Signal("overview");
  const dispose = bindSettingSignal(setting, activePanel);

  await settings.ready();
  assertEquals(activePanel.value, "logs");

  activePanel.value = "metrics";
  await settings.flush();
  assertEquals(setting.value.value, "metrics");
  assertEquals(await store.get("panel"), "metrics");

  setting.set("alerts");
  assertEquals(activePanel.value, "alerts");

  dispose();
  activePanel.value = "overview";
  assertEquals(setting.value.value, "alerts");
});

Deno.test("bindRouteSetting restores and persists active routes", async () => {
  const store = new MemoryStore<unknown>();
  await store.set("shell.route", "runtime");
  const settings = new SettingsController({ store, namespace: "shell" });
  const routes = new RouteManager([
    { id: "overview" },
    { id: "runtime" },
    { id: "logs" },
  ], "overview");
  const binding = bindRouteSetting(routes, settings);

  await settings.ready();
  assertEquals(routes.activeRouteId.value, "runtime");

  routes.navigate("logs");
  await settings.flush();
  assertEquals(binding.setting.value.value, "logs");
  assertEquals(await store.get("shell.route"), "logs");

  binding.dispose();
  routes.navigate("overview");
  assertEquals(binding.setting.value.value, "logs");
});

Deno.test("bindThemeSetting connects a provider to app settings", async () => {
  const store = new MemoryStore<unknown>();
  await store.set("prefs.theme", "terminal");
  const settings = new SettingsController({ store, namespace: "prefs" });
  const provider = createThemeProvider({
    registry: createThemeRegistry([
      { id: "plain", palette: "plain" },
      { id: "terminal", palette: "terminal" },
    ]),
    activeId: "plain",
  });
  const binding = bindThemeSetting(provider, settings);

  await settings.ready();
  assertEquals(provider.activeId.value, "terminal");

  provider.setTheme("plain");
  await settings.flush();
  assertEquals(binding.setting.value.value, "plain");
  assertEquals(await store.get("prefs.theme"), "plain");

  binding.setting.set("missing");
  assertEquals(provider.activeId.value, "plain");

  binding.dispose();
  provider.setTheme("terminal");
  assertEquals(binding.setting.value.value, "plain");
});

Deno.test("bindThemeLayerSetting restores and persists active theme layers", async () => {
  const store = new MemoryStore<unknown>();
  await store.set("prefs.theme-layers", JSON.stringify(["contrast"]));
  const settings = new SettingsController({ store, namespace: "prefs" });
  const layers = createThemeLayerStack([
    { id: "density", options: { components: { Button: { base: { base: "foreground" } } } } },
    { id: "contrast", enabled: false, options: { components: { Button: { base: { focused: "warning" } } } } },
  ]);
  const provider = createThemeProvider({ layers });
  const binding = bindThemeLayerSetting(provider, settings, {
    serialize: (value) => JSON.stringify(value),
    deserialize: (value: string) => JSON.parse(value),
  });

  await settings.ready();
  assertEquals(layers.activeIds(), ["contrast"]);

  layers.enable("density");
  await Promise.resolve();
  await settings.flush();
  assertEquals(binding.setting.value.value, ["density", "contrast"]);
  assertEquals(await store.get("prefs.theme-layers"), JSON.stringify(["density", "contrast"]));

  binding.setting.set([]);
  assertEquals(layers.activeIds(), []);

  binding.dispose();
  layers.enable("contrast");
  await Promise.resolve();
  assertEquals(binding.setting.value.value, []);
  layers.dispose();
});

Deno.test("bindThemePipelineSetting restores persists and sanitizes active steps", async () => {
  const store = new MemoryStore<unknown>();
  await store.set("prefs.theme-pipeline-runtime", JSON.stringify(["contrast", "missing"]));
  const settings = new SettingsController({ store, namespace: "prefs" });
  const pipeline = createThemeEnginePipeline({
    id: "runtime",
    steps: [
      { id: "density", label: "Density" },
      { id: "contrast", label: "Contrast", enabled: false },
    ],
  });
  const binding = bindThemePipelineSetting(pipeline, settings, {
    serialize: (value) => JSON.stringify(value),
    deserialize: (value: string) => JSON.parse(value),
  });

  await settings.ready();
  assertEquals(pipeline.activeIds(), ["contrast"]);
  assertEquals(binding.setting.value.peek(), ["contrast"]);

  pipeline.enable("density");
  await Promise.resolve();
  await settings.flush();
  assertEquals(binding.setting.value.peek(), ["density", "contrast"]);
  assertEquals(await store.get("prefs.theme-pipeline-runtime"), JSON.stringify(["density", "contrast"]));

  binding.setting.set(["missing", "density"]);
  assertEquals(pipeline.activeIds(), ["density"]);
  assertEquals(binding.setting.value.peek(), ["density"]);

  binding.dispose();
  pipeline.enable("contrast");
  await Promise.resolve();
  assertEquals(binding.setting.value.peek(), ["density"]);
});

Deno.test("bindDataTableSetting restores persists and sanitizes table state", async () => {
  interface Row extends Record<string, unknown> {
    id: string;
    name: string;
    cpu: number;
  }
  const columns: DataColumn<Row>[] = [
    { id: "id", sortable: false },
    { id: "name", sortable: true },
    { id: "cpu", sortable: true },
  ];
  const store = new MemoryStore<unknown>();
  await store.set(
    "prefs.process-table",
    JSON.stringify({
      query: "deno",
      sort: { columnId: "missing", direction: "desc" },
      page: -2,
      pageSize: 0,
      selectedIndex: -9,
      selectedKey: "p2",
    }),
  );
  const settings = new SettingsController({ store, namespace: "prefs" });
  const controller = new DataTableController<Row>({
    rows: [
      { id: "p1", name: "shell", cpu: 3 },
      { id: "p2", name: "deno", cpu: 42 },
    ],
    columns,
    rowKey: (row) => row.id,
    initialState: { pageSize: 10 },
  });
  const binding = bindDataTableSetting(controller, settings, {
    key: "process-table",
    serialize: (value) => JSON.stringify(value),
    deserialize: (value: string) => JSON.parse(value),
  });

  await settings.ready();
  assertEquals(controller.state.peek(), {
    query: "deno",
    page: 0,
    pageSize: 1,
    selectedIndex: 0,
    selectedKey: "p2",
  });

  controller.setQuery("shell");
  controller.setPageSize(5);
  controller.setSort({ columnId: "cpu", direction: "desc" });
  await Promise.resolve();
  await settings.flush();
  assertEquals(
    await store.get("prefs.process-table"),
    JSON.stringify({
      query: "shell",
      sort: { columnId: "cpu", direction: "desc" },
      page: 0,
      pageSize: 5,
      selectedIndex: 0,
      selectedKey: "p1",
    }),
  );

  binding.setting.set({ sort: { columnId: "id", direction: "asc" }, pageSize: 2 });
  assertEquals(controller.state.peek(), { pageSize: 2 });

  binding.dispose();
  controller.setQuery("deno");
  await Promise.resolve();
  assertEquals(binding.setting.value.peek(), { pageSize: 2 });
  controller.dispose();
});

Deno.test("theme command adapters switch packs and report theme actions", async () => {
  const provider = createThemeProvider({
    registry: createThemeRegistry([
      { id: "plain", label: "Plain", palette: "plain" },
      { id: "terminal", label: "Terminal", palette: "terminal" },
    ]),
    activeId: "plain",
  });
  const registry = new CommandRegistry<ThemeCommandAction>();
  registry.registerAll(themeSelectionCommands(provider));
  const actions: unknown[] = [];

  assertEquals(registry.get("theme.set.plain")?.disabled instanceof Function, true);
  assertEquals(registry.enabled(registry.get("theme.set.plain")!), false);
  assertEquals(registry.enabled(registry.get("theme.set.terminal")!), true);

  assertEquals(await registry.execute("theme.set.terminal", (action) => void actions.push(action)), true);
  assertEquals(provider.activeId.peek(), "terminal");
  assertEquals(actions, [
    { type: "theme.changed", payload: { id: "terminal", previousId: "plain" } },
  ]);
  assertEquals(registry.enabled(registry.get("theme.set.terminal")!), false);

  assertEquals(await registry.execute("theme.previous", (action) => void actions.push(action)), true);
  assertEquals(provider.activeId.peek(), "plain");
  assertEquals(actions[1], {
    type: "theme.changed",
    payload: { id: "plain", previousId: "terminal", direction: -1 },
  });
});

Deno.test("theme command adapters toggle runtime theme layers", async () => {
  const layers = createThemeLayerStack([
    { id: "density", label: "Compact Density", options: { components: { Button: { base: { base: "foreground" } } } } },
    {
      id: "contrast",
      label: "High Contrast",
      enabled: false,
      options: { components: { Button: { base: { focused: "warning" } } } },
    },
  ]);
  const provider = createThemeProvider({ layers });
  const registry = new CommandRegistry<ThemeCommandAction>();
  registry.registerAll(themeCommands(provider));
  const actions: unknown[] = [];

  assertEquals(themeLayerCommands(layers).map((command) => command.id), [
    "theme.layer.toggle.density",
    "theme.layer.enable.density",
    "theme.layer.disable.density",
    "theme.layer.toggle.contrast",
    "theme.layer.enable.contrast",
    "theme.layer.disable.contrast",
  ]);
  assertEquals(registry.enabled(registry.get("theme.layer.enable.density")!), false);
  assertEquals(registry.enabled(registry.get("theme.layer.disable.contrast")!), false);

  assertEquals(await registry.execute("theme.layer.toggle.contrast", (action) => void actions.push(action)), true);
  assertEquals(layers.activeIds(), ["density", "contrast"]);
  assertEquals(actions, [
    { type: "theme.layer.changed", payload: { id: "contrast", enabled: true } },
  ]);
  assertEquals(registry.enabled(registry.get("theme.layer.enable.contrast")!), false);
  assertEquals(registry.enabled(registry.get("theme.layer.disable.contrast")!), true);

  layers.dispose();
});

Deno.test("theme pipeline commands toggle runtime theme transforms", async () => {
  const pipeline = createThemeEnginePipeline({
    id: "runtime",
    steps: [
      { id: "density", label: "Density" },
      { id: "contrast", label: "Contrast", enabled: false },
    ],
  });
  const registry = new CommandRegistry<ThemePipelineCommandAction>();
  const dispose = bindThemePipelineCommands(registry, pipeline);
  const actions: unknown[] = [];

  assertEquals(themePipelineCommands(pipeline).map((command) => command.id), [
    "theme.pipeline.runtime.toggle.density",
    "theme.pipeline.runtime.enable.density",
    "theme.pipeline.runtime.disable.density",
    "theme.pipeline.runtime.toggle.contrast",
    "theme.pipeline.runtime.enable.contrast",
    "theme.pipeline.runtime.disable.contrast",
  ]);
  assertEquals(registry.enabled(registry.get("theme.pipeline.runtime.enable.density")!), false);
  assertEquals(registry.enabled(registry.get("theme.pipeline.runtime.disable.contrast")!), false);

  assertEquals(
    await registry.execute("theme.pipeline.runtime.toggle.contrast", (action) => void actions.push(action)),
    true,
  );
  assertEquals(pipeline.activeIds(), ["density", "contrast"]);
  assertEquals(actions, [
    { type: "theme.pipeline.step.changed", payload: { pipelineId: "runtime", id: "contrast", enabled: true } },
  ]);
  assertEquals(registry.enabled(registry.get("theme.pipeline.runtime.enable.contrast")!), false);
  assertEquals(registry.enabled(registry.get("theme.pipeline.runtime.disable.contrast")!), true);

  dispose();
  assertEquals(registry.list("theme"), []);
});

Deno.test("theme preview commands capture active provider snapshots", async () => {
  const provider = createThemeProvider({
    registry: createThemeRegistry([
      {
        id: "plain",
        label: "Plain",
        palette: "plain",
        options: {
          tokens: { foreground: (value) => `fg:${value}` },
          components: { Button: { base: { base: "foreground" } } },
        },
      },
    ]),
    activeId: "plain",
    layers: [
      {
        id: "density",
        label: "Density",
        options: { components: { Button: { variants: { compact: { active: "foreground" } } } } },
      },
    ],
  });
  const registry = new CommandRegistry<ThemeCommandAction>();
  const actions: unknown[] = [];
  const dispose = bindThemeCommands(registry, provider, {
    includeCycleCommands: false,
    includeThemeCommands: false,
    includeLayerCommands: false,
    preview: {
      sample: "Aa",
      tokens: ["foreground"],
      components: ["Button"],
      states: ["base"],
    },
  });

  assertEquals(themePreviewCommands(provider).map((command) => command.id), ["theme.preview.snapshot"]);
  assertEquals(registry.list("theme").map((command) => command.id), ["theme.preview.snapshot"]);
  assertEquals(await registry.execute("theme.preview.snapshot", (action) => void actions.push(action)), true);
  assertEquals(actions, [
    {
      type: "theme.previewed",
      payload: {
        preview: {
          sample: "Aa",
          activeId: "plain",
          activeLayers: ["density"],
          catalog: provider.catalog(),
          tokens: [{ token: "foreground", preview: { raw: "Aa", styled: "fg:Aa" } }],
          components: [
            { component: "Button", variant: "default", state: "base", preview: { raw: "Aa", styled: "fg:Aa" } },
            { component: "Button", variant: "compact", state: "base", preview: { raw: "Aa", styled: "fg:Aa" } },
          ],
        },
      },
    },
  ]);

  dispose();
  assertEquals(registry.list("theme"), []);
  provider.layers.dispose();
});

Deno.test("createThemePlugin installs provider commands settings and lifecycle cleanup", async () => {
  const store = new MemoryStore<unknown>();
  await store.set("prefs.theme", "terminal");
  await store.set("prefs.theme-layers", JSON.stringify(["contrast"]));
  const settings = new SettingsController({ store, namespace: "prefs" });
  const app = createApp<ThemeCommandAction>({
    tui: { destroy() {} } as unknown as Tui,
  });
  const actions: ThemeCommandAction[] = [];
  app.onAction((action) => void actions.push(action));

  const plugin = createThemePlugin<ThemeCommandAction>({
    settings,
    mirrorKeymap: true,
    providerOptions: {
      registry: createThemeRegistry([
        { id: "plain", label: "Plain", palette: "plain" },
        { id: "terminal", label: "Terminal", palette: "terminal" },
      ]),
      layers: [
        {
          id: "density",
          label: "Compact Density",
          options: { components: { Button: { base: { base: "foreground" } } } },
        },
        {
          id: "contrast",
          label: "High Contrast",
          enabled: false,
          options: { components: { Button: { base: { focused: "warning" } } } },
        },
      ],
    },
    persistLayers: {
      serialize: (value) => JSON.stringify(value),
      deserialize: (value) => JSON.parse(value as string),
    },
  });

  assertEquals(plugin.inspect().themePersistenceEnabled, true);
  assertEquals(plugin.inspect().layerPersistenceEnabled, true);
  const dispose = app.use(plugin);

  await settings.ready();
  assertEquals(plugin.provider.activeId.value, "terminal");
  assertEquals(plugin.provider.layers.activeIds(), ["contrast"]);
  assertEquals(app.commands.has("theme.set.plain"), true);
  assertEquals(app.commands.has("theme.layer.toggle.density"), true);
  assertEquals(app.plugins(), [{ id: "theme", label: "Theme Engine" }]);

  assertEquals(await app.executeCommand("theme.set.plain"), true);
  assertEquals(actions, [{ type: "theme.changed", payload: { id: "plain", previousId: "terminal" } }]);
  assertEquals(plugin.provider.activeId.peek(), "plain");

  assertEquals(await app.executeCommand("theme.layer.toggle.density"), true);
  assertEquals(plugin.provider.layers.activeIds(), ["density", "contrast"]);
  await settings.flush();
  assertEquals(await store.get("prefs.theme"), "plain");
  assertEquals(await store.get("prefs.theme-layers"), JSON.stringify(["density", "contrast"]));

  dispose();
  assertEquals(app.commands.has("theme.set.plain"), false);
  assertEquals(app.commands.has("theme.layer.toggle.density"), false);
  assertEquals(app.plugins(), []);
  app.destroy();
  plugin.provider.layers.dispose();
});

Deno.test("createThemePlugin rolls back installed surfaces when custom install fails", () => {
  const app = createApp<ThemeCommandAction>({ tui: { destroy() {} } as unknown as Tui });
  const plugin = createThemePlugin<ThemeCommandAction>({
    providerOptions: {
      registry: createThemeRegistry([{ id: "plain", palette: "plain" }]),
    },
    install() {
      throw new Error("theme boom");
    },
  });

  try {
    app.use(plugin);
    throw new Error("expected theme plugin install to throw");
  } catch (error) {
    assertEquals(error instanceof Error && error.message, "theme boom");
  }

  assertEquals(app.commands.has("theme.set.plain"), false);
  assertEquals(app.plugins(), []);
  app.destroy();
});

Deno.test("splitPaneCommands resize change direction set ratios and reset", async () => {
  const controller = new SplitPaneController({
    direction: "row",
    ratio: 0.5,
    minFirst: 2,
    minSecond: 2,
    resizeMode: "ratio",
  });
  const bounds = { column: 0, row: 0, width: 21, height: 8 };
  const registry = new CommandRegistry<SplitPaneCommandAction>();
  const dispose = bindSplitPaneCommands(registry, controller, {
    id: "main",
    idPrefix: "mainSplit",
    group: "layout",
    bounds,
    step: 4,
    includeRatioCommands: true,
    includeReset: true,
    ratios: [0.25, 0.75],
  });
  const actions: SplitPaneCommandAction[] = [];

  assertEquals(registry.list("layout").map((command) => command.id), [
    "mainSplit.growFirst",
    "mainSplit.direction.row",
    "mainSplit.reset",
    "mainSplit.ratio.0250",
    "mainSplit.ratio.0750",
    "mainSplit.shrinkFirst",
    "mainSplit.direction.column",
  ]);

  assertEquals(await registry.execute("mainSplit.growFirst", (action) => void actions.push(action)), true);
  assertEquals(Math.round((controller.snapshot().ratio ?? 0) * 100), 70);
  assertEquals(actions[0]!.type, "splitPane.resized");
  assertEquals(actions[0]!.payload!.id, "main");

  assertEquals(await registry.execute("mainSplit.direction.column", (action) => void actions.push(action)), true);
  assertEquals(controller.snapshot().direction, "column");
  assertEquals(actions[1]!.type, "splitPane.directionChanged");

  assertEquals(await registry.execute("mainSplit.ratio.0250", (action) => void actions.push(action)), true);
  assertEquals(controller.snapshot().ratio, 0.25);
  assertEquals(actions[2]!.type, "splitPane.ratioChanged");

  assertEquals(await registry.execute("mainSplit.reset", (action) => void actions.push(action)), true);
  assertEquals(controller.snapshot(), {
    direction: "row",
    ratio: 0.5,
    minFirst: 2,
    minSecond: 2,
    resizeMode: "ratio",
  });
  assertEquals(actions[3]!.type, "splitPane.reset");

  dispose();
  assertEquals(registry.list("layout"), []);
});

Deno.test("splitPaneCommands can omit resize bounds and command groups", () => {
  const controller = new SplitPaneController({ direction: "row", ratio: 0.5 });
  const commands = splitPaneCommands(controller, {
    includeDirectionCommands: false,
    includeRatioCommands: false,
    includeReset: false,
  });

  assertEquals(commands.map((command) => [command.id, commandDisabled(command)]), [
    ["splitPane.shrinkFirst", true],
    ["splitPane.growFirst", true],
  ]);
});

Deno.test("bindSplitPaneSetting restores and persists layout state", async () => {
  const store = new MemoryStore<unknown>();
  await store.set(
    "prefs.split",
    JSON.stringify({
      direction: "row",
      ratio: 0.75,
      minFirst: 10,
      minSecond: 8,
      gap: 1,
      resizeMode: "ratio",
    }),
  );
  const settings = new SettingsController({ store, namespace: "prefs" });
  const controller = new SplitPaneController({
    direction: "row",
    ratio: 0.5,
    minFirst: 10,
    minSecond: 8,
    gap: 1,
    resizeMode: "ratio",
  });
  const binding = bindSplitPaneSetting(controller, settings, {
    key: "split",
    serialize: (value) => JSON.stringify(value),
    deserialize: (value: string) => JSON.parse(value),
  });

  await settings.ready();
  assertEquals(controller.snapshot(), {
    direction: "row",
    ratio: 0.75,
    minFirst: 10,
    minSecond: 8,
    gap: 1,
    resizeMode: "ratio",
  });

  controller.setRatio(0.6);
  await settings.flush();
  assertEquals(binding.setting.value.value.ratio, 0.6);
  assertEquals(
    await store.get("prefs.split"),
    JSON.stringify({
      direction: "row",
      ratio: 0.6,
      minFirst: 10,
      minSecond: 8,
      gap: 1,
      resizeMode: "ratio",
    }),
  );

  binding.setting.set({
    direction: "column",
    firstSize: 4,
    minFirst: 2,
    minSecond: 2,
    resizeMode: "size",
  });
  assertEquals(controller.snapshot(), {
    direction: "column",
    ratio: 0.6,
    firstSize: 4,
    minFirst: 2,
    minSecond: 2,
    gap: 1,
    resizeMode: "size",
  });

  binding.dispose();
  controller.setRatio(0.25);
  assertEquals(binding.setting.value.value, {
    direction: "column",
    firstSize: 4,
    minFirst: 2,
    minSecond: 2,
    resizeMode: "size",
  });
});

function commandDisabled<TAction extends Action>(command: Command<TAction>): boolean | undefined {
  return typeof command.disabled === "function" ? command.disabled() : command.disabled;
}

async function runCommandFactory<TAction extends Action>(command: Command<TAction>): Promise<void> {
  if (typeof command.action === "function") {
    await (command.action as CommandActionFactory<TAction>)(command);
  }
}
