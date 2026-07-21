// Copyright 2023 Im-Beast. MIT license.
import { assertEquals, assertNotStrictEquals } from "./deps.ts";
import { createPluginSlotRegistry } from "../src/app/plugin_slots.ts";

interface TestSlots {
  status: { user: string };
  panel: { count: number };
}

Deno.test("plugin slot registry resolves typed contributions in stable order", () => {
  const registry = createPluginSlotRegistry<string, TestSlots, { app: string }>({ app: "test" });
  const changes: number[] = [];
  registry.subscribe(() => changes.push(registry.revision));

  registry.register({
    id: "later",
    order: 10,
    slots: { status: (context, props) => `${context.app}:${props.user}:later` },
  });
  registry.register({
    id: "first-tie",
    order: -1,
    slots: { status: (_context, props) => `${props.user}:first` },
  });
  registry.register({
    id: "second-tie",
    order: -1,
    slots: { status: (_context, props) => `${props.user}:second`, panel: (_context, props) => String(props.count) },
  });

  assertEquals(registry.pluginIds(), ["first-tie", "second-tie", "later"]);
  assertEquals(registry.render("status", { user: "sam" }).nodes, ["sam:first", "sam:second", "test:sam:later"]);
  assertEquals(registry.resolveEntries("panel").map((entry) => entry.pluginId), ["second-tie"]);
  assertEquals(changes, [1, 2, 3]);

  registry.updateOrder("later", -2);
  assertEquals(registry.pluginIds(), ["later", "first-tie", "second-tie"]);
});

Deno.test("plugin slot modes keep host fallback under host control", () => {
  const registry = createPluginSlotRegistry<string, TestSlots>({});
  registry.register({ id: "empty", slots: { status: () => undefined } });
  registry.register({ id: "one", slots: { status: (_context, props) => `${props.user}:one` } });
  registry.register({ id: "two", slots: { status: (_context, props) => `${props.user}:two` } });

  const append = registry.render("status", { user: "sam" }, { fallback: () => "host" });
  assertEquals(append.nodes, ["host", "sam:one", "sam:two"]);
  assertEquals(append.usedFallback, true);

  const replace = registry.render("status", { user: "sam" }, { mode: "replace", fallback: () => "host" });
  assertEquals(replace.nodes, ["sam:one", "sam:two"]);
  assertEquals(replace.usedFallback, false);

  const winner = registry.render("status", { user: "sam" }, { mode: "single-winner", fallback: () => "host" });
  assertEquals(winner.nodes, ["sam:one"]);
  assertEquals(winner.winnerPluginId, "one");

  const empty = registry.render("panel", { count: 3 }, { mode: "replace", fallback: () => "host-panel" });
  assertEquals(empty.nodes, ["host-panel"]);
  assertEquals(empty.usedFallback, true);
});

Deno.test("plugin renderer failures fall through to healthy plugins or host fallback", () => {
  let now = 10;
  const observed: string[] = [];
  const registry = createPluginSlotRegistry<string, TestSlots>({}, {
    now: () => now++,
    onError: (event) => observed.push(`${event.pluginId}:${event.phase}:${event.error.message}`),
  });
  registry.register({
    id: "bad",
    order: -1,
    slots: {
      status: () => {
        throw new Error("render exploded");
      },
    },
  });
  registry.register({ id: "good", slots: { status: () => "healthy" } });

  const winner = registry.render("status", { user: "sam" }, { mode: "single-winner", fallback: () => "host" });
  assertEquals(winner.nodes, ["healthy"]);
  assertEquals(winner.winnerPluginId, "good");

  registry.unregister("good");
  const fallback = registry.render("status", { user: "sam" }, { mode: "replace", fallback: () => "host" });
  assertEquals(fallback.nodes, ["host"]);
  assertEquals(observed, ["bad:render:render exploded", "bad:render:render exploded"]);
  assertEquals(registry.inspect().errors.map((event) => event.timestamp), [10, 11]);
});

Deno.test("failed setup and duplicate ids never evict existing host contributions", () => {
  const registry = createPluginSlotRegistry<string, TestSlots>({});
  const original = { id: "stable", slots: { status: () => "original" } };
  registry.register(original);
  registry.register({ id: "stable", slots: { status: () => "replacement" } });
  registry.register({
    id: "setup-failure",
    setup: () => {
      throw new Error("setup exploded");
    },
    slots: { status: () => "unreachable" },
  });

  assertEquals(registry.pluginIds(), ["stable"]);
  assertEquals(registry.render("status", { user: "sam" }).nodes, ["original"]);
  assertEquals(registry.inspect().errors.map((event) => event.phase), ["registration", "setup"]);
});

Deno.test("plugin slot disposal is idempotent, reverse ordered, and failure isolated", () => {
  const disposed: string[] = [];
  const registry = createPluginSlotRegistry<string, TestSlots>({});
  const disposeFirst = registry.register({
    id: "first",
    setup: () => () => disposed.push("first:setup"),
    dispose: () => disposed.push("first:plugin"),
    slots: {},
  });
  registry.register({
    id: "second",
    setup: () => () => {
      disposed.push("second:setup");
      throw new Error("cleanup exploded");
    },
    dispose: () => disposed.push("second:plugin"),
    slots: {},
  });

  registry.clear();
  registry.clear();
  disposeFirst();
  assertEquals(disposed, ["second:setup", "second:plugin", "first:setup", "first:plugin"]);
  assertEquals(registry.inspect().pluginCount, 0);
  assertEquals(registry.inspect().errors.map((event) => event.message), ["cleanup exploded"]);

  registry.dispose();
  registry.dispose();
  assertEquals(registry.disposed, true);
  const rejected = registry.register({ id: "late", slots: {} });
  rejected();
  assertEquals(registry.pluginIds(), []);
  assertEquals(registry.inspect().errors.at(-1)?.phase, "registration");
});

Deno.test("plugin slot error snapshots are cloned from mutable registry history", () => {
  const registry = createPluginSlotRegistry<string, TestSlots>({}, { maxErrors: 1 });
  registry.reportError({ pluginId: "one", phase: "render", error: "first" });
  registry.reportError({ pluginId: "two", phase: "render", error: "second" });
  const first = registry.errors();
  const second = registry.errors();

  assertNotStrictEquals(first, second);
  assertEquals(first.map((event) => event.pluginId), ["two"]);
  assertEquals(registry.inspect().errors, [{
    pluginId: "two",
    slot: undefined,
    phase: "render",
    message: "second",
    timestamp: first[0]!.timestamp,
  }]);
  registry.clearErrors();
  assertEquals(registry.inspect().errorCount, 0);
});
