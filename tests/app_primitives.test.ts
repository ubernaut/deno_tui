import { assertEquals } from "./deps.ts";
import { createApp } from "../src/app/app.ts";
import { ActionBus } from "../src/app/actions.ts";
import { CommandRegistry } from "../src/app/commands.ts";
import { HistoryStack } from "../src/app/history.ts";
import { RouteManager } from "../src/app/router.ts";
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
