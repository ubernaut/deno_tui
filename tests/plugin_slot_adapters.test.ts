import { assertEquals, assertNotStrictEquals } from "./deps.ts";
import {
  type CorePluginSlotSource,
  type MarkupPluginSlotSource,
  type PluginSlotDataValue,
  PluginSlotSourceAdapter,
  type ViewPluginSlotSource,
} from "../src/app/plugin_slot_adapters.ts";
import { createPluginSlotRegistry } from "../src/app/plugin_slots.ts";

interface TestSlots {
  status: { user: string };
  panel: { count: number };
}

interface TestNode {
  kind: "fallback" | "core" | "markup" | "view";
  text: string;
}

interface TestMarkup {
  tag: string;
  text: string;
}

interface TestView {
  component: string;
  text: string;
}

interface HostContext {
  host: string;
  layoutController: { takeOwnership(): void };
}

type TestValues =
  & Readonly<{
    theme: string;
    flags: Readonly<{ compact: boolean }>;
  }>
  & Readonly<Record<string, PluginSlotDataValue>>;

type TestAdapter = PluginSlotSourceAdapter<
  TestNode,
  TestMarkup,
  TestView,
  TestSlots,
  HostContext,
  TestValues
>;

Deno.test("slot sources adapt core markup and view values without receiving host capabilities", () => {
  const { registry, adapter } = createFixture();
  const contexts: string[][] = [];
  const core: CorePluginSlotSource<TestNode, TestSlots, TestValues> = {
    id: "core",
    kind: "core",
    order: 20,
    registrations: [{
      id: "main",
      slots: {
        status: (context, props) => {
          contexts.push(Object.keys(context).sort());
          assertEquals("layoutController" in (context as unknown as Record<string, unknown>), false);
          assertEquals(Object.isFrozen(context.values), true);
          assertEquals(Object.isFrozen(context.values.flags), true);
          return { kind: "core", text: `${context.values.theme}:${props.user}` };
        },
      },
    }],
  };
  const markup: MarkupPluginSlotSource<TestMarkup, TestSlots, TestValues> = {
    id: "markup",
    kind: "markup",
    order: 0,
    registrations: [{
      id: "main",
      slots: {
        status: (context, props) => ({ tag: "badge", text: `${context.sourceId}:${props.user}` }),
      },
    }],
  };
  const view: ViewPluginSlotSource<TestView, TestSlots, TestValues> = {
    id: "view",
    kind: "view",
    order: 10,
    registrations: [{
      id: "main",
      slots: {
        status: (_context, props) => ({ component: "Status", text: props.user }),
      },
    }],
  };

  adapter.install(core);
  adapter.install(markup);
  adapter.install(view);
  assertEquals(registry.pluginIds(), [
    "slot-source.markup.main",
    "slot-source.view.main",
    "slot-source.core.main",
  ]);

  const fallback = (): TestNode => ({ kind: "fallback", text: "host" });
  const append = registry.render("status", { user: "sam" }, { fallback });
  assertEquals(append.nodes, [
    { kind: "fallback", text: "host" },
    { kind: "markup", text: "badge:markup:sam:dark" },
    { kind: "view", text: "Status:sam:dark" },
    { kind: "core", text: "dark:sam" },
  ]);
  assertEquals(append.contributions.map((entry) => entry.pluginId), registry.pluginIds());
  assertEquals(registry.render("status", { user: "sam" }, { mode: "replace", fallback }).usedFallback, false);
  assertEquals(
    registry.render("status", { user: "sam" }, { mode: "single-winner", fallback }).winnerPluginId,
    "slot-source.markup.main",
  );
  assertEquals(contexts, [
    ["registrationId", "sourceId", "sourceKind", "values"],
    ["registrationId", "sourceId", "sourceKind", "values"],
  ]);

  const inspection = adapter.inspect();
  assertEquals(inspection.sources.map((source) => [source.id, source.kind, source.order]), [
    ["markup", "markup", 0],
    ["view", "view", 10],
    ["core", "core", 20],
  ]);
  assertEquals(inspection.sources[0]!.registrations[0], {
    id: "main",
    pluginId: "slot-source.markup.main",
    order: 0,
    slots: ["status"],
  });
  inspection.sources[0]!.registrations[0]!.slots.push("mutated");
  assertEquals(adapter.inspect().sources[0]!.registrations[0]!.slots, ["status"]);
});

Deno.test("missing optional view adapters preserve fallback and reject before source setup", () => {
  const registry = createPluginSlotRegistry<TestNode, TestSlots, HostContext>(hostContext(), { now: () => 5 });
  const adapter = new PluginSlotSourceAdapter<
    TestNode,
    TestMarkup,
    TestView,
    TestSlots,
    HostContext,
    TestValues
  >({
    registry,
    values: testValues(),
    markup: (value) => ({ kind: "markup", text: value.text }),
  });
  let setupCalled = false;
  const dispose = adapter.install({
    id: "jsx",
    kind: "view",
    setup: () => {
      setupCalled = true;
    },
    registrations: [{
      id: "main",
      slots: { status: () => ({ component: "Status", text: "unreachable" }) },
    }],
  });
  dispose();
  assertEquals(setupCalled, false);
  assertEquals(registry.pluginIds(), []);
  assertEquals(
    registry.render("status", { user: "sam" }, { mode: "replace", fallback: () => fallbackNode() }).nodes,
    [fallbackNode()],
  );
  assertEquals(adapter.inspect().diagnostics, [{
    sequence: 0,
    sourceId: "jsx",
    registrationId: undefined,
    pluginId: "slot-source.jsx",
    phase: "registration",
    message: "view source adapter is not configured",
  }]);
  const diagnostics = adapter.diagnostics();
  diagnostics[0]!.message = "mutated";
  assertEquals(adapter.diagnostics()[0]!.message, "view source adapter is not configured");
});

Deno.test("multi-registration setup failure rolls back all resources before registry mutation", () => {
  const { registry, adapter } = createFixture();
  const events: string[] = [];
  const dispose = adapter.install({
    id: "atomic",
    kind: "core",
    setup: () => {
      events.push("source:setup");
      return () => events.push("source:setup-dispose");
    },
    dispose: () => events.push("source:dispose"),
    registrations: [
      {
        id: "one",
        slots: { status: () => ({ kind: "core", text: "one" }) },
        setup: () => {
          events.push("one:setup");
          return () => events.push("one:setup-dispose");
        },
        dispose: () => events.push("one:dispose"),
      },
      {
        id: "two",
        slots: { panel: () => ({ kind: "core", text: "two" }) },
        setup: () => {
          events.push("two:setup");
          throw new Error("two exploded");
        },
        dispose: () => events.push("two:dispose"),
      },
      {
        id: "three",
        slots: {},
        setup: () => {
          events.push("three:unreachable");
        },
      },
    ],
  });
  dispose();
  dispose();

  assertEquals(registry.pluginIds(), []);
  assertEquals(registry.revision, 0);
  assertEquals(adapter.inspect().sourceCount, 0);
  assertEquals(events, [
    "source:setup",
    "one:setup",
    "two:setup",
    "two:dispose",
    "one:setup-dispose",
    "one:dispose",
    "source:setup-dispose",
    "source:dispose",
  ]);
  assertEquals(adapter.inspect().diagnostics[0], {
    sequence: 0,
    sourceId: "atomic",
    registrationId: "two",
    pluginId: "slot-source.atomic.two",
    phase: "setup",
    message: "two exploded",
  });
  assertEquals(registry.inspect().errors[0]?.phase, "setup");
});

Deno.test("known registration collisions fail atomically before source lifecycle", () => {
  const { registry, adapter } = createFixture();
  registry.register({
    id: "slot-source.collision.two",
    slots: { status: () => ({ kind: "core", text: "host-owned" }) },
  });
  const events: string[] = [];
  adapter.install({
    id: "collision",
    kind: "core",
    setup: () => {
      events.push("source:unreachable");
    },
    registrations: [
      { id: "one", slots: { status: () => ({ kind: "core", text: "one" }) } },
      { id: "two", slots: { status: () => ({ kind: "core", text: "two" }) } },
    ],
  });

  assertEquals(events, []);
  assertEquals(registry.pluginIds(), ["slot-source.collision.two"]);
  assertEquals(adapter.inspect().sourceCount, 0);
  assertEquals(adapter.inspect().diagnostics[0]?.registrationId, "two");
});

Deno.test("late registration collision rolls prior contributions back without claiming the foreign id", () => {
  const { registry, adapter } = createFixture();
  const events: string[] = [];
  let injected = false;
  registry.subscribe(() => {
    if (injected || !registry.has("slot-source.dynamic.one")) return;
    injected = true;
    registry.register({
      id: "slot-source.dynamic.two",
      slots: { status: () => ({ kind: "core", text: "foreign" }) },
    });
  });

  adapter.install({
    id: "dynamic",
    kind: "core",
    setup: () => {
      events.push("source:setup");
      return () => events.push("source:setup-dispose");
    },
    dispose: () => events.push("source:dispose"),
    registrations: ["one", "two"].map((id) => ({
      id,
      slots: { status: () => ({ kind: "core" as const, text: id }) },
      setup: () => {
        events.push(`${id}:setup`);
        return () => events.push(`${id}:setup-dispose`);
      },
      dispose: () => events.push(`${id}:dispose`),
    })),
  });

  assertEquals(adapter.inspect().sourceCount, 0);
  assertEquals(registry.pluginIds(), ["slot-source.dynamic.two"]);
  assertEquals(registry.render("status", { user: "sam" }).nodes, [{ kind: "core", text: "foreign" }]);
  assertEquals(events, [
    "source:setup",
    "one:setup",
    "two:setup",
    "two:setup-dispose",
    "two:dispose",
    "one:setup-dispose",
    "one:dispose",
    "source:setup-dispose",
    "source:dispose",
  ]);
  assertEquals(adapter.inspect().diagnostics.at(-1)?.registrationId, "two");
});

Deno.test("render and payload-adapter failures fall through by host slot policy", () => {
  const { registry, adapter } = createFixture();
  adapter.install({
    id: "bad",
    kind: "core",
    order: -2,
    registrations: [{
      id: "main",
      slots: {
        status: () => {
          throw new Error("source render failed");
        },
      },
    }],
  });
  const disposeGood = adapter.install({
    id: "good",
    kind: "core",
    order: -1,
    registrations: [{
      id: "main",
      slots: { status: () => ({ kind: "core", text: "healthy" }) },
    }],
  });

  assertEquals(
    registry.render("status", { user: "sam" }, { mode: "single-winner", fallback: () => fallbackNode() }).nodes,
    [{ kind: "core", text: "healthy" }],
  );
  disposeGood();
  assertEquals(
    registry.render("status", { user: "sam" }, { mode: "replace", fallback: () => fallbackNode() }).nodes,
    [fallbackNode()],
  );
  const first = adapter.inspect();
  const second = adapter.inspect();
  assertNotStrictEquals(first.registry.errors, second.registry.errors);
  assertEquals(first.registry.errors.map((error) => error.message), [
    "source render failed",
    "source render failed",
  ]);
});

Deno.test("markup adapter failures are isolated from later core values and fallback", () => {
  const registry = createTestRegistry();
  const adapter = new PluginSlotSourceAdapter<
    TestNode,
    TestMarkup,
    TestView,
    TestSlots,
    HostContext,
    TestValues
  >({
    registry,
    values: testValues(),
    markup: () => {
      throw new Error("markup conversion failed");
    },
  });
  adapter.install({
    id: "markup",
    kind: "markup",
    order: -2,
    registrations: [{
      id: "main",
      slots: { status: () => ({ tag: "badge", text: "bad" }) },
    }],
  });
  const disposeCore = adapter.install({
    id: "core",
    kind: "core",
    order: -1,
    registrations: [{
      id: "main",
      slots: { status: () => ({ kind: "core", text: "healthy" }) },
    }],
  });

  assertEquals(
    registry.render("status", { user: "sam" }, { mode: "single-winner", fallback: () => fallbackNode() }).nodes,
    [{ kind: "core", text: "healthy" }],
  );
  disposeCore();
  assertEquals(
    registry.render("status", { user: "sam" }, { mode: "replace", fallback: () => fallbackNode() }).nodes,
    [fallbackNode()],
  );
  assertEquals(registry.inspect().errors.map((error) => error.message), [
    "markup conversion failed",
    "markup conversion failed",
  ]);
});

Deno.test("adapter disposal unwinds sources and registrations in reverse lifecycle order", () => {
  const { registry, adapter } = createFixture();
  const events: string[] = [];
  const source = (id: string, registrations: Array<{ id: string; order?: number; throwOnSetupDispose?: boolean }>) => ({
    id,
    kind: "core" as const,
    setup: () => {
      events.push(`${id}:setup`);
      return () => {
        events.push(`${id}:setup-dispose`);
        if (id === "second") throw new Error("source cleanup failed");
      };
    },
    dispose: () => events.push(`${id}:dispose`),
    registrations: registrations.map((registration) => ({
      id: registration.id,
      order: registration.order,
      slots: { status: () => ({ kind: "core" as const, text: `${id}:${registration.id}` }) },
      setup: () => {
        events.push(`${id}:${registration.id}:setup`);
        return () => {
          events.push(`${id}:${registration.id}:setup-dispose`);
          if (registration.throwOnSetupDispose) throw new Error(`${registration.id} cleanup failed`);
        };
      },
      dispose: () => events.push(`${id}:${registration.id}:dispose`),
    })),
  });

  const disposeFirst = adapter.install(source("first", [
    { id: "later", order: 10, throwOnSetupDispose: true },
    { id: "earlier", order: -10 },
  ]));
  adapter.install(source("second", [{ id: "only" }]));
  events.length = 0;
  adapter.dispose();
  adapter.dispose();
  disposeFirst();

  assertEquals(events, [
    "second:only:setup-dispose",
    "second:only:dispose",
    "second:setup-dispose",
    "second:dispose",
    "first:later:setup-dispose",
    "first:later:dispose",
    "first:earlier:setup-dispose",
    "first:earlier:dispose",
    "first:setup-dispose",
    "first:dispose",
  ]);
  assertEquals(adapter.disposed, true);
  assertEquals(registry.disposed, false);
  assertEquals(registry.pluginIds(), []);
  assertEquals(registry.inspect().errors.map((error) => error.message), [
    "source cleanup failed",
    "later cleanup failed",
  ]);
  assertEquals(adapter.inspect().diagnostics.map((error) => error.message), ["source cleanup failed"]);
});

Deno.test("adapter disposal preserves unrelated host registrations and rejects late sources idempotently", () => {
  const { registry, adapter } = createFixture();
  registry.register({ id: "host", slots: { status: () => fallbackNode() } });
  const sourceDispose = adapter.install({
    id: "managed",
    kind: "core",
    registrations: [{ id: "main", slots: { status: () => ({ kind: "core", text: "managed" }) } }],
  });
  adapter.dispose();
  sourceDispose();
  const lateDispose = adapter.install({
    id: "late",
    kind: "core",
    registrations: [{ id: "main", slots: {} }],
  });
  lateDispose();

  assertEquals(registry.pluginIds(), ["host"]);
  assertEquals(registry.render("status", { user: "sam" }).nodes, [fallbackNode()]);
  assertEquals(adapter.inspect().diagnostics.at(-1)?.message, "slot source adapter is disposed");
});

function createFixture(): {
  registry: ReturnType<typeof createTestRegistry>;
  adapter: TestAdapter;
} {
  const registry = createTestRegistry();
  const adapter = new PluginSlotSourceAdapter<
    TestNode,
    TestMarkup,
    TestView,
    TestSlots,
    HostContext,
    TestValues
  >({
    registry,
    values: testValues,
    markup: (value, context) => ({
      kind: "markup",
      text: `${value.tag}:${value.text}:${context.values.theme}`,
    }),
    view: (value, context) => ({
      kind: "view",
      text: `${value.component}:${value.text}:${context.values.theme}`,
    }),
  });
  return { registry, adapter };
}

function createTestRegistry() {
  let now = 1;
  return createPluginSlotRegistry<TestNode, TestSlots, HostContext>(hostContext(), { now: () => now++ });
}

function hostContext(): HostContext {
  return {
    host: "test",
    layoutController: { takeOwnership() {} },
  };
}

function testValues(): TestValues {
  return {
    theme: "dark",
    flags: { compact: false },
  };
}

function fallbackNode(): TestNode {
  return { kind: "fallback", text: "host" };
}
