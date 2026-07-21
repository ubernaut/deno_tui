import { assert, assertEquals } from "./deps.ts";
import type { KeyPressEvent } from "../src/input_reader/types.ts";
import {
  type KeymapLayerDefinition,
  type LayeredKeyBinding,
  type LayeredKeymapKeyEvent,
  LayeredKeymapRegistry,
} from "../src/keymap_layers.ts";

Deno.test("layered keymaps resolve exact focus, deepest focus-within, then global", async () => {
  const registry = new LayeredKeymapRegistry();
  const dispatched: string[] = [];
  const exact = registry.registerLayer(
    layer("editor", "exact-focus", binding("exact", () => dispatched.push("exact")), {
      focusId: "editor",
      order: -100,
    }),
  );
  const pane = registry.registerLayer(layer("pane", "focus-within", binding("pane", () => dispatched.push("pane")), {
    focusId: "pane",
    order: -100,
  }));
  registry.registerLayer(layer("app", "focus-within", binding("app", () => dispatched.push("app")), {
    focusId: "app",
    order: 100,
  }));
  registry.registerLayer(layer("global", "global", binding("global", () => dispatched.push("global")), {
    order: 1_000,
  }));

  registry.setFocusPath(["app", "pane", "editor"]);
  assertEquals((await registry.dispatch(key("x"))).binding?.id, "exact");
  exact();
  assertEquals((await registry.dispatch(key("x"))).binding?.id, "pane");
  pane();
  assertEquals((await registry.dispatch(key("x"))).binding?.id, "app");
  registry.setFocusPath([]);
  assertEquals((await registry.dispatch(key("x"))).binding?.id, "global");
  assertEquals(dispatched, ["exact", "pane", "app", "global"]);
});

Deno.test("focus-path replacement is defensive, atomic, and notifies once", () => {
  const registry = new LayeredKeymapRegistry();
  registry.registerLayer(layer("global", "global", binding("global", () => undefined)));
  const snapshots: string[][] = [];
  registry.subscribe(() => snapshots.push([...registry.inspect().focusPath]));
  const source = ["app", "pane", "editor"];

  assertEquals(registry.setFocusPath(source), true);
  source.splice(0, source.length, "mutated");
  assertEquals(registry.focusPath, ["app", "pane", "editor"]);
  assertEquals(snapshots, [["app", "pane", "editor"]]);
  assertEquals(registry.setFocusPath(["app", "pane", "editor"]), false);
  assertEquals(snapshots.length, 1);
});

Deno.test("active modal layers exclusively capture dispatch and expose blocked bindings", async () => {
  const registry = new LayeredKeymapRegistry();
  const dispatched: string[] = [];
  let modalOpen = false;
  registry.registerLayer(layer("global", "global", binding("global-x", () => dispatched.push("global"))));
  registry.registerLayer(layer("editor", "exact-focus", binding("editor-y", () => dispatched.push("editor"), "y"), {
    focusId: "editor",
  }));
  registry.registerLayer(layer("dialog", "modal", binding("dialog-x", () => dispatched.push("dialog")), {
    order: 2,
    enabled: () => modalOpen,
  }));
  registry.registerLayer(layer("older-dialog", "modal", binding("older-z", () => dispatched.push("older"), "z"), {
    order: 1,
    enabled: () => modalOpen,
  }));
  registry.setFocusPath(["app", "editor"]);

  assertEquals((await registry.dispatch(key("y"))).binding?.id, "editor-y");
  modalOpen = true;
  registry.refresh();
  const modalInspection = registry.inspect();
  assertEquals(modalInspection.layers.find((entry) => entry.id === "dialog")?.active, true);
  assertEquals(modalInspection.layers.find((entry) => entry.id === "older-dialog")?.inactiveReason, "modal-blocked");
  assertEquals(modalInspection.layers.find((entry) => entry.id === "global")?.inactiveReason, "modal-blocked");
  assertEquals(modalInspection.bindings.find((entry) => entry.id === "editor-y")?.inactiveReason, "modal-blocked");
  assertEquals((await registry.dispatch(key("y"))).status, "unmatched");
  assertEquals((await registry.dispatch(key("z"))).status, "unmatched");
  assertEquals((await registry.dispatch(key("x"))).binding?.id, "dialog-x");

  modalOpen = false;
  registry.refresh();
  assertEquals((await registry.dispatch(key("x"))).binding?.id, "global-x");
  assertEquals(dispatched, ["editor", "dialog", "global"]);
});

Deno.test("explicit order and stable ids deterministically resolve inspectable conflicts", async () => {
  const registry = new LayeredKeymapRegistry();
  const dispatched: string[] = [];
  registry.registerLayer(layer("beta", "global", binding("beta", () => dispatched.push("beta")), { order: 10 }));
  registry.registerLayer(layer("alpha", "global", binding("alpha", () => dispatched.push("alpha")), { order: 10 }));
  registry.registerLayer(
    layer(
      "priority",
      "global",
      binding("priority", () => dispatched.push("priority"), "x", { enabled: false }),
      { order: 20 },
    ),
  );

  const initial = registry.inspect();
  assertEquals(initial.conflictCount, 1);
  assertEquals(initial.activeConflictCount, 1);
  assertEquals(initial.conflicts[0], {
    chord: "x",
    bindingCount: 3,
    activeCount: 2,
    winner: { layerId: "alpha", bindingId: "alpha" },
    bindings: [
      { layerId: "alpha", bindingId: "alpha", active: true, winning: true },
      { layerId: "beta", bindingId: "beta", active: true, winning: false },
      { layerId: "priority", bindingId: "priority", active: false, winning: false },
    ],
  });
  assertEquals(initial.bindings.find((entry) => entry.id === "beta")?.shadowedBy, {
    layerId: "alpha",
    bindingId: "alpha",
  });
  assertEquals(initial.bindings.find((entry) => entry.id === "priority")?.inactiveReason, "binding-disabled");
  assertEquals((await registry.dispatch(key("x"))).binding?.id, "alpha");

  registry.setBindingEnabled("priority", "priority", true);
  assertEquals((await registry.dispatch(key("x"))).binding?.id, "priority");
  assertEquals(dispatched, ["alpha", "priority"]);
});

Deno.test("modifier chords remain distinct and binding order resolves same-layer ties", async () => {
  const registry = new LayeredKeymapRegistry();
  const dispatched: string[] = [];
  registry.registerLayer({
    id: "global",
    kind: "global",
    bindings: [
      binding("plain", () => dispatched.push("plain")),
      binding("ctrl-low", () => dispatched.push("ctrl-low"), "x", { ctrl: true, order: 1 }),
      binding("ctrl-high", () => dispatched.push("ctrl-high"), "x", { ctrl: true, order: 2 }),
    ],
  });

  assertEquals(registry.inspect().conflicts.map((entry) => entry.chord), ["C-x"]);
  assertEquals((await registry.dispatch(key("x"))).binding?.id, "plain");
  assertEquals((await registry.dispatch(key("x", { ctrl: true }))).binding?.id, "ctrl-high");
  assertEquals(dispatched, ["plain", "ctrl-high"]);
});

Deno.test("condition and handler failures are isolated without unsafe fallback", async () => {
  const errors: Array<{ phase: string; message: string }> = [];
  const registry = new LayeredKeymapRegistry({
    now: () => 42,
    onError: (error) => errors.push({ phase: error.phase, message: error.message }),
  });
  let fallbackCalls = 0;
  registry.registerLayer(layer("fallback", "global", binding("fallback", () => fallbackCalls++), { order: 0 }));
  registry.registerLayer(
    layer(
      "broken-handler",
      "global",
      binding("broken", () => {
        throw new Error("handler exploded");
      }),
      { order: 10 },
    ),
  );
  registry.registerLayer(layer("broken-layer", "global", binding("never", () => undefined, "z"), {
    enabled: () => {
      throw new Error("layer condition exploded");
    },
  }));
  registry.registerLayer(
    layer(
      "broken-binding",
      "global",
      binding("never-binding", () => undefined, "b", {
        enabled: () => {
          throw new Error("binding condition exploded");
        },
      }),
    ),
  );

  const failed = await registry.dispatch(key("x"));
  assertEquals(failed.status, "error");
  assertEquals(failed.binding?.id, "broken");
  assertEquals(fallbackCalls, 0);

  const inspection = registry.inspect();
  assertEquals(inspection.layers.find((entry) => entry.id === "broken-layer")?.inactiveReason, "layer-condition-error");
  assertEquals(
    inspection.bindings.find((entry) => entry.id === "never-binding")?.inactiveReason,
    "binding-condition-error",
  );
  assert(errors.some((error) => error.phase === "handler" && error.message === "handler exploded"));
  assert(errors.some((error) => error.phase === "layer-condition"));
  assert(errors.some((error) => error.phase === "binding-condition"));
  assert(inspection.errors.every((error) => error.timestamp === 42));
});

Deno.test("declined winners do not fall through to lower-precedence conflicts", async () => {
  const registry = new LayeredKeymapRegistry();
  let fallbackCalls = 0;
  registry.registerLayer(layer("fallback", "global", binding("fallback", () => fallbackCalls++)));
  registry.registerLayer(layer("decline", "global", binding("decline", () => false), { order: 1 }));

  const result = await registry.dispatch(key("x"));
  assertEquals(result.status, "declined");
  assertEquals(result.binding?.id, "decline");
  assertEquals(fallbackCalls, 0);
});

Deno.test("registration, input subscriptions, listeners, and disposal fail closed", async () => {
  const registry = new LayeredKeymapRegistry({ now: () => 7 });
  const target = new TestKeyTarget();
  let handled = 0;
  let healthyListenerCalls = 0;
  registry.subscribe(() => {
    throw new Error("listener exploded");
  });
  registry.subscribe(() => healthyListenerCalls++);

  registry.registerLayer({ id: "invalid-focus", kind: "exact-focus" });
  const disposeLayer = registry.registerLayer(layer("global", "global", binding("global", () => handled++)));
  registry.registerLayer(layer("global", "global", binding("duplicate", () => undefined)));
  registry.registerBinding("global", binding("global", () => undefined));
  assertEquals(registry.inspect().layerCount, 1);
  assertEquals(registry.inspect().errors.filter((error) => error.phase === "registration").length, 3);
  assert(healthyListenerCalls > 0);

  const unbind = registry.bind(target);
  assertEquals(target.listenerCount, 1);
  assertEquals(registry.inspect().targetCount, 1);
  await target.emit(event("x"));
  assertEquals(handled, 1);
  unbind();
  assertEquals(target.listenerCount, 0);
  assertEquals(registry.inspect().targetCount, 0);
  registry.bind(target);
  assertEquals(target.listenerCount, 1);

  const beforeDisposeRevision = registry.revision;
  registry.dispose();
  registry.dispose();
  assertEquals(registry.disposed, true);
  assertEquals(registry.revision, beforeDisposeRevision + 1);
  assertEquals(target.listenerCount, 0);
  assertEquals(registry.inspect().layerCount, 0);
  assertEquals(registry.inspect().subscriptionCount, 0);
  assertEquals(registry.inspect().targetCount, 0);
  assertEquals((await registry.dispatch(key("x"))).status, "disposed");
  disposeLayer();
});

function layer(
  id: string,
  kind: KeymapLayerDefinition["kind"],
  bindingDefinition: LayeredKeyBinding,
  options: Partial<Omit<KeymapLayerDefinition, "id" | "kind" | "bindings">> = {},
): KeymapLayerDefinition {
  return { id, kind, ...options, bindings: [bindingDefinition] };
}

function binding(
  id: string,
  handler: LayeredKeyBinding["handler"],
  keyValue = "x",
  options: Partial<Omit<LayeredKeyBinding, "id" | "key" | "description" | "handler">> = {},
): LayeredKeyBinding {
  return { id, key: keyValue, description: id, handler, ...options };
}

function key(
  keyValue: LayeredKeymapKeyEvent["key"],
  modifiers: Partial<Omit<LayeredKeymapKeyEvent, "key">> = {},
): LayeredKeymapKeyEvent {
  return {
    key: keyValue,
    ctrl: modifiers.ctrl ?? false,
    meta: modifiers.meta ?? false,
    shift: modifiers.shift ?? false,
  };
}

function event(keyValue: LayeredKeymapKeyEvent["key"]): KeyPressEvent {
  return { ...key(keyValue), buffer: new Uint8Array() };
}

class TestKeyTarget {
  readonly listeners = new Set<(event: KeyPressEvent) => void | Promise<void>>();

  on(type: "keyPress", listener: (event: KeyPressEvent) => void | Promise<void>): () => void {
    if (type !== "keyPress") return () => undefined;
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  get listenerCount(): number {
    return this.listeners.size;
  }

  async emit(keyEvent: KeyPressEvent): Promise<void> {
    for (const listener of [...this.listeners]) await listener(keyEvent);
    await Promise.resolve();
  }
}
