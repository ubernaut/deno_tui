import { assertEquals } from "./deps.ts";
import { createApp } from "../src/app/app.ts";
import { ActionBus } from "../src/app/actions.ts";
import {
  bindCommandKeymap,
  bindCommandKeys,
  commandForKeyEvent,
  commandSurfaceItems,
  executeCommandSurfaceItem,
} from "../src/app/command_bindings.ts";
import { CommandRegistry } from "../src/app/commands.ts";
import { bindRouteHistory } from "../src/app/history_bindings.ts";
import { HistoryStack } from "../src/app/history.ts";
import { bindRouteIndex, bindRouteSignal } from "../src/app/route_bindings.ts";
import { RouteManager } from "../src/app/router.ts";
import { SettingsController } from "../src/app/settings.ts";
import {
  bindRouteSetting,
  bindSettingSignal,
  bindSplitPaneSetting,
  bindThemeLayerSetting,
  bindThemeSetting,
} from "../src/app/settings_bindings.ts";
import { KeymapRegistry } from "../src/keymap.ts";
import { SplitPaneController } from "../src/layout/mod.ts";
import { MemoryStore } from "../src/runtime/storage.ts";
import { Signal } from "../src/signals/mod.ts";
import { createTestKeyPress, TestKeyPressTarget } from "../src/testing/mod.ts";
import { createThemeLayerStack, createThemeProvider, createThemeRegistry } from "../src/theme.ts";
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

Deno.test("RouteManager navigates and cycles known routes only", () => {
  const routes = new RouteManager([
    { id: "home", title: "Home" },
    { id: "settings", title: "Settings" },
  ]);

  assertEquals(routes.active()?.id, "home");
  assertEquals(routes.navigate("missing"), false);
  assertEquals(routes.navigate("settings"), true);
  assertEquals(routes.active()?.title, "Settings");
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

Deno.test("SettingsController namespaces and caches persistent settings", async () => {
  const store = new MemoryStore<unknown>();
  const settings = new SettingsController({ store, namespace: "shell" });

  const route = settings.signal({ key: "route", initialValue: "overview" });
  const sameRoute = settings.signal({ key: "route", initialValue: "ignored" });

  assertEquals(route, sameRoute);
  assertEquals(settings.key("route"), "shell.route");
  assertEquals(settings.has("route"), true);
  assertEquals(settings.keys(), ["shell.route"]);
  assertEquals(settings.inspect(), { namespace: "shell", keys: ["shell.route"] });

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
