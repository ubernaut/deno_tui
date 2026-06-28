import { assertEquals } from "./deps.ts";
import { createApp } from "../src/app/app.ts";
import { ActionBus } from "../src/app/actions.ts";
import {
  bindCommandKeys,
  commandForKeyEvent,
  commandSurfaceItems,
  executeCommandSurfaceItem,
} from "../src/app/command_bindings.ts";
import { CommandRegistry } from "../src/app/commands.ts";
import { HistoryStack } from "../src/app/history.ts";
import { bindRouteSignal } from "../src/app/route_bindings.ts";
import { RouteManager } from "../src/app/router.ts";
import { Signal } from "../src/signals/mod.ts";
import { createTestKeyPress, TestKeyPressTarget } from "../src/testing/mod.ts";
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
