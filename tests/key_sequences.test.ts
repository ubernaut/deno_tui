import { assert, assertEquals } from "./deps.ts";
import type { KeyPressEvent } from "../src/input_reader/types.ts";
import {
  type KeymapLayerDefinition,
  type LayeredKeyBinding,
  type LayeredKeymapKeyEvent,
  LayeredKeymapRegistry,
} from "../src/keymap_layers.ts";
import { KeySequenceCoordinator, type KeySequenceMapDefinition } from "../src/key_sequences.ts";

Deno.test("named command metadata and configurable leaders drive deterministic sequences", async () => {
  const registry = registryWithLayers({ id: "global", kind: "global" });
  const contexts: Array<{
    id: string;
    title: string;
    category?: string;
    keywords: string[];
    sequence: string[];
    focusPath: readonly string[];
    modes: readonly string[];
    timestamp: number;
  }> = [];
  const coordinator = new KeySequenceCoordinator({
    registry,
    modes: ["COMMAND"],
    timeoutMs: 100,
    map: {
      leaders: { leader: "C-space" },
      commands: [{
        id: "file.open",
        title: "Open File",
        description: "Open a file by name",
        category: "Files",
        keywords: [" picker ", "open", "open"],
        handler: (context) => {
          contexts.push({
            id: context.command.id,
            title: context.command.title,
            category: context.command.category,
            keywords: context.command.keywords,
            sequence: context.binding.sequence,
            focusPath: context.focusPath,
            modes: context.modes,
            timestamp: context.timestamp,
          });
        },
      }],
      bindings: [{
        id: "file.open.leader",
        commandId: "file.open",
        layerId: "global",
        sequence: [{ leader: "leader" }, "o"],
      }],
    },
  });

  const initial = coordinator.inspect();
  assertEquals(initial.mapRevision, 1);
  assertEquals(initial.leaders, [{ name: "leader", chord: "C-space" }]);
  assertEquals(initial.commands[0], {
    id: "file.open",
    title: "Open File",
    description: "Open a file by name",
    category: "Files",
    keywords: ["open", "picker"],
    active: true,
    inactiveReason: undefined,
    bindingCount: 1,
  });
  assertEquals(initial.bindings[0]?.declaredSequence, ["<leader>", "o"]);
  assertEquals(initial.bindings[0]?.sequence, ["C-space", "o"]);

  const prefix = await coordinator.dispatch(key("space", { ctrl: true }), 10);
  assertEquals(prefix.status, "pending");
  assertEquals(prefix.pending, {
    sequence: ["C-space"],
    candidateBindingIds: ["file.open.leader"],
    deferredBindingId: undefined,
    startedAt: 10,
    lastStrokeAt: 10,
    expiresAt: 110,
    mapRevision: 1,
    layerRevision: registry.revision,
  });
  assertEquals((await coordinator.dispatch(key("o"), 12)).status, "handled");
  assertEquals(contexts, [{
    id: "file.open",
    title: "Open File",
    category: "Files",
    keywords: ["open", "picker"],
    sequence: ["C-space", "o"],
    focusPath: [],
    modes: ["command"],
    timestamp: 12,
  }]);

  const remap = coordinator.setLeader("LEADER", "C-g");
  assertEquals(remap.status, "applied");
  assertEquals(remap.previousMapRevision, 1);
  assertEquals(remap.mapRevision, 2);
  assertEquals(coordinator.inspect().bindings[0]?.declaredSequence, ["<leader>", "o"]);
  assertEquals(coordinator.inspect().bindings[0]?.sequence, ["C-g", "o"]);
  assertEquals((await coordinator.dispatch(key("space", { ctrl: true }), 20)).status, "unmatched");
  assertEquals((await coordinator.dispatch(key("g", { ctrl: true }), 21)).status, "pending");
  assertEquals((await coordinator.dispatch(key("o"), 22)).status, "handled");
});

Deno.test("ambiguous prefixes advance only through the caller clock", async () => {
  const registry = registryWithLayers({ id: "global", kind: "global" });
  const calls: string[] = [];
  let implicitNow = 10_000;
  const coordinator = new KeySequenceCoordinator({
    registry,
    timeoutMs: 50,
    now: () => implicitNow,
    map: map(
      [
        command("short", () => calls.push("short")),
        command("long", () => calls.push("long")),
      ],
      [
        sequenceBinding("short.g", "short", "global", ["g"]),
        sequenceBinding("long.gg", "long", "global", ["g", "g"]),
      ],
    ),
  });

  const ambiguous = await coordinator.dispatch(key("g"), 10);
  assertEquals(ambiguous.status, "pending");
  assertEquals(ambiguous.pending?.deferredBindingId, "short.g");
  assertEquals(ambiguous.pending?.expiresAt, 60);
  implicitNow = 1_000_000;
  await Promise.resolve();
  assertEquals(calls, []);
  assertEquals(coordinator.inspect().pending?.expiresAt, 60);
  assertEquals((await coordinator.advanceTime(59)).status, "pending");
  assertEquals(calls, []);
  const elapsed = await coordinator.advanceTime(60);
  assertEquals(elapsed.status, "handled");
  assertEquals(elapsed.binding?.id, "short.g");
  assertEquals(calls, ["short"]);

  assertEquals((await coordinator.dispatch(key("g"), 100)).status, "pending");
  const completed = await coordinator.dispatch(key("g"), 101);
  assertEquals(completed.status, "handled");
  assertEquals(completed.binding?.id, "long.gg");
  assertEquals(calls, ["short", "long"]);
  assertEquals((await coordinator.advanceTime(1_000)).status, "idle");
});

Deno.test("focus layers, modes, runtime conditions, and modals share layered precedence", async () => {
  let modalOpen = false;
  let editorEnabled = true;
  const registry = new LayeredKeymapRegistry();
  registry.registerLayer({ id: "global", kind: "global", order: 100 });
  registry.registerLayer({ id: "editor", kind: "exact-focus", focusId: "editor", order: -100 });
  registry.registerLayer({ id: "dialog", kind: "modal", enabled: () => modalOpen });
  registry.setFocusPath(["app", "editor"]);
  const calls: string[] = [];
  const coordinator = new KeySequenceCoordinator({
    registry,
    map: map(
      [
        command("global.save", () => calls.push("global")),
        command("editor.save", () => calls.push("editor")),
        command("dialog.save", () => calls.push("dialog")),
      ],
      [
        sequenceBinding("global.save", "global.save", "global", ["x", "s"]),
        {
          ...sequenceBinding("editor.save", "editor.save", "editor", ["x", "s"]),
          modes: ["insert"],
          enabled: () => editorEnabled,
        },
        sequenceBinding("dialog.save", "dialog.save", "dialog", ["x", "s"]),
      ],
    ),
  });

  await coordinator.dispatch(key("x"));
  assertEquals((await coordinator.dispatch(key("s"))).binding?.id, "global.save");
  coordinator.setMode("INSERT");
  await coordinator.dispatch(key("x"));
  assertEquals((await coordinator.dispatch(key("s"))).binding?.id, "editor.save");
  const focused = coordinator.inspect();
  assertEquals(focused.conflicts.find((entry) => entry.kind === "exact")?.winner, {
    layerId: "editor",
    bindingId: "editor.save",
  });
  assertEquals(focused.bindings.find((entry) => entry.id === "global.save")?.shadowedBy, {
    layerId: "editor",
    bindingId: "editor.save",
  });

  editorEnabled = false;
  coordinator.refresh();
  assertEquals(
    coordinator.inspect().bindings.find((entry) => entry.id === "editor.save")?.inactiveReason,
    "binding-disabled",
  );
  await coordinator.dispatch(key("x"));
  assertEquals((await coordinator.dispatch(key("s"))).binding?.id, "global.save");

  modalOpen = true;
  registry.refresh();
  const modal = coordinator.inspect();
  assertEquals(modal.bindings.find((entry) => entry.id === "global.save")?.inactiveReason, "layer-inactive");
  assertEquals(modal.bindings.find((entry) => entry.id === "global.save")?.layerInactiveReason, "modal-blocked");
  await coordinator.dispatch(key("x"));
  assertEquals((await coordinator.dispatch(key("s"))).binding?.id, "dialog.save");
  assertEquals(calls, ["global", "editor", "global", "dialog"]);
});

Deno.test("mismatches cancel bounded pending state and reprocess through layered dispatch", async () => {
  const registry = new LayeredKeymapRegistry();
  const layeredCalls: string[] = [];
  registry.registerLayer({
    id: "global",
    kind: "global",
    bindings: [
      layeredBinding("layered.x", "x", () => layeredCalls.push("x")),
      layeredBinding("layered.y", "y", () => layeredCalls.push("y")),
    ],
  });
  const sequenceCalls: string[] = [];
  const coordinator = new KeySequenceCoordinator({
    registry,
    map: map(
      [
        command("go", () => sequenceCalls.push("go")),
        command("decline", () => {
          sequenceCalls.push("decline");
          return false;
        }),
      ],
      [
        sequenceBinding("go.gg", "go", "global", ["g", "g"]),
        sequenceBinding("decline.y", "decline", "global", ["y"]),
      ],
    ),
  });

  const delegated = await coordinator.dispatch(key("x"));
  assertEquals(delegated.source, "layered");
  assertEquals(delegated.fallback?.binding?.id, "layered.x");
  assertEquals(await coordinator.dispatch(key("g")), {
    status: "pending",
    handled: false,
    consumed: true,
    source: "sequence",
    chord: "g",
    sequence: ["g"],
    pending: coordinator.inspect().pending,
  });
  const mismatch = await coordinator.dispatch(key("x"));
  assertEquals(mismatch.status, "handled");
  assertEquals(mismatch.source, "layered");
  assertEquals(mismatch.cancelledPending, ["g"]);
  assertEquals(mismatch.fallback?.binding?.id, "layered.x");
  assertEquals(coordinator.inspect().pending, undefined);

  const declined = await coordinator.dispatch(key("y"));
  assertEquals(declined.status, "declined");
  assertEquals(declined.source, "sequence");
  assertEquals(layeredCalls, ["x", "x"]);
  assertEquals(sequenceCalls, ["decline"]);
});

Deno.test("invalid live remaps roll back map revision, handlers, and pending prefixes", async () => {
  const registry = registryWithLayers({ id: "global", kind: "global" });
  const calls: string[] = [];
  const original = map(
    [command("old", () => calls.push("old"))],
    [sequenceBinding("old.gg", "old", "global", ["g", "g"])],
  );
  const coordinator = new KeySequenceCoordinator({ registry, map: original });
  assertEquals((await coordinator.dispatch(key("g"), 10)).status, "pending");
  const before = coordinator.inspect();

  const invalid = coordinator.remap({
    commands: [command("replacement", () => calls.push("replacement"))],
    bindings: [sequenceBinding("broken", "missing", "global", ["x"])],
  });
  assertEquals(invalid.status, "rejected");
  assertEquals(invalid.mapRevision, before.mapRevision);
  assert(invalid.issues.some((entry) => entry.code === "binding-command-missing"));
  assertEquals(coordinator.inspect().pending, before.pending);
  assertEquals((await coordinator.dispatch(key("g"), 11)).binding?.id, "old.gg");
  assertEquals(calls, ["old"]);

  await coordinator.dispatch(key("g"), 20);
  const invalidLeader = coordinator.setLeader("", "C-a");
  assertEquals(invalidLeader.status, "rejected");
  assertEquals(invalidLeader.mapRevision, before.mapRevision);
  assertEquals(coordinator.inspect().pending?.sequence, ["g"]);

  const applied = coordinator.remap(map(
    [command("replacement", () => calls.push("replacement"))],
    [sequenceBinding("replacement.x", "replacement", "global", ["x"])],
  ));
  assertEquals(applied.status, "applied");
  assertEquals(applied.previousMapRevision, before.mapRevision);
  assertEquals(applied.mapRevision, before.mapRevision + 1);
  assertEquals(coordinator.inspect().pending, undefined);
  assertEquals((await coordinator.dispatch(key("g"))).status, "unmatched");
  assertEquals((await coordinator.dispatch(key("x"))).binding?.id, "replacement.x");
  assertEquals(calls, ["old", "replacement"]);
});

Deno.test("map validation enforces sequence, binding, and pending-candidate bounds", () => {
  const registry = registryWithLayers({ id: "global", kind: "global" });
  const coordinator = new KeySequenceCoordinator({
    registry,
    maxBindings: 3,
    maxSequenceLength: 2,
    maxPendingCandidates: 2,
  });
  const commands = [
    command("one", () => undefined),
    command("two", () => undefined),
    command("three", () => undefined),
  ];
  const tooManyCandidates = coordinator.remap(map(commands, [
    sequenceBinding("one", "one", "global", ["g"]),
    sequenceBinding("two", "two", "global", ["g", "x"]),
    sequenceBinding("three", "three", "global", ["g", "y"]),
  ]));
  assertEquals(tooManyCandidates.status, "rejected");
  assert(tooManyCandidates.issues.some((entry) => entry.code === "pending-candidate-limit-exceeded"));
  assertEquals(coordinator.mapRevision, 0);

  const tooLong = coordinator.remap(map(
    [command("long", () => undefined)],
    [sequenceBinding("long", "long", "global", ["g", "g", "g"])],
  ));
  assert(tooLong.issues.some((entry) => entry.code === "binding-sequence-too-long"));

  const tooManyBindings = coordinator.remap(map(commands, [
    sequenceBinding("one", "one", "global", ["a"]),
    sequenceBinding("two", "two", "global", ["b"]),
    sequenceBinding("three", "three", "global", ["c"]),
    sequenceBinding("four", "one", "global", ["d"]),
  ]));
  assert(tooManyBindings.issues.some((entry) => entry.code === "binding-limit-exceeded"));
  assertEquals(coordinator.mapRevision, 0);
});

Deno.test("runtime condition and handler failures fail closed with bounded diagnostics", async () => {
  const registry = registryWithLayers({ id: "global", kind: "global" });
  const conditionCoordinator = new KeySequenceCoordinator({
    registry,
    now: () => 42,
    map: map(
      [command("broken.command", () => undefined, {
        enabled: () => {
          throw new Error("command condition exploded");
        },
      })],
      [sequenceBinding("broken.command", "broken.command", "global", ["c"])],
    ),
  });
  const conditionInspection = conditionCoordinator.inspect();
  assertEquals(conditionInspection.commands[0]?.inactiveReason, "command-condition-error");
  assertEquals(conditionInspection.bindings[0]?.inactiveReason, "command-condition-error");
  assert(
    conditionInspection.errors.some((entry) =>
      entry.phase === "condition" && entry.message === "command condition exploded" && entry.timestamp === 42
    ),
  );
  assertEquals((await conditionCoordinator.dispatch(key("c"))).status, "unmatched");

  const errors: string[] = [];
  const handlerCoordinator = new KeySequenceCoordinator({
    registry,
    now: () => 7,
    maxErrors: 2,
    map: map(
      [
        command("one", () => {
          throw new Error("one");
        }),
        command("two", () => {
          throw new Error("two");
        }),
        command("three", () => {
          throw new Error("three");
        }),
      ],
      [
        sequenceBinding("one", "one", "global", ["a"]),
        sequenceBinding("two", "two", "global", ["b"]),
        sequenceBinding("three", "three", "global", ["c"]),
      ],
    ),
  });
  handlerCoordinator.onError((error) => errors.push(error.message));
  assertEquals((await handlerCoordinator.dispatch(key("a"))).status, "error");
  assertEquals((await handlerCoordinator.dispatch(key("b"))).status, "error");
  assertEquals((await handlerCoordinator.dispatch(key("c"))).status, "error");
  const bounded = handlerCoordinator.inspect();
  assertEquals(errors, ["one", "two", "three"]);
  assertEquals(bounded.errors.map((entry) => entry.message), ["two", "three"]);
  assert(bounded.errors.every((entry) => entry.phase === "handler" && entry.timestamp === 7));
});

Deno.test("focus changes reconcile pending candidates without hidden stale dispatch", async () => {
  const registry = new LayeredKeymapRegistry();
  registry.registerLayer({ id: "editor", kind: "exact-focus", focusId: "editor" });
  registry.setFocusPath(["app", "editor"]);
  let calls = 0;
  const coordinator = new KeySequenceCoordinator({
    registry,
    map: map(
      [command("editor.go", () => calls++)],
      [sequenceBinding("editor.go", "editor.go", "editor", ["g", "g"])],
    ),
  });

  assertEquals((await coordinator.dispatch(key("g"))).status, "pending");
  assertEquals(coordinator.inspect().pending?.candidateBindingIds, ["editor.go"]);
  registry.setFocusPath(["app", "other"]);
  assertEquals(coordinator.inspect().pending, undefined);
  assertEquals((await coordinator.dispatch(key("g"))).status, "unmatched");
  assertEquals(calls, 0);
});

Deno.test("KeySequenceCoordinator.bind uses real targets and disposal preserves the shared registry", async () => {
  const registry = registryWithLayers({ id: "global", kind: "global" });
  let calls = 0;
  const coordinator = new KeySequenceCoordinator({
    registry,
    modes: ["normal"],
    map: map(
      [command("run", () => calls++, { keywords: ["execute"] })],
      [sequenceBinding("run", "run", "global", ["r"])],
    ),
  });
  const target = new TestKeyTarget();
  const unbind = coordinator.bind(target);
  assertEquals(target.listenerCount, 1);
  assertEquals(coordinator.inspect().targetCount, 1);
  await target.emit(event("r"));
  assertEquals(calls, 1);

  const snapshot = coordinator.inspect();
  snapshot.modes.push("mutated");
  snapshot.commands[0]?.keywords.push("mutated");
  snapshot.bindings[0]?.sequence.push("mutated");
  snapshot.lastRemap.issues.push({ code: "stroke-invalid", path: "mutated", message: "mutated" });
  assertEquals(coordinator.inspect().modes, ["normal"]);
  assertEquals(coordinator.inspect().commands[0]?.keywords, ["execute"]);
  assertEquals(coordinator.inspect().bindings[0]?.sequence, ["r"]);
  assertEquals(coordinator.inspect().lastRemap.issues, []);

  unbind();
  assertEquals(target.listenerCount, 0);
  coordinator.bind(target);
  assertEquals(target.listenerCount, 1);
  const revision = coordinator.revision;
  coordinator.dispose();
  coordinator.dispose();
  assertEquals(coordinator.revision, revision + 1);
  assertEquals(target.listenerCount, 0);
  assertEquals(coordinator.inspect().targetCount, 0);
  assertEquals(coordinator.inspect().bindingCount, 0);
  assertEquals((await coordinator.dispatch(key("r"))).status, "disposed");
  assertEquals(registry.disposed, false);
  assertEquals(registry.inspect().layerCount, 1);
});

function registryWithLayers(...layers: KeymapLayerDefinition[]): LayeredKeymapRegistry {
  const registry = new LayeredKeymapRegistry();
  for (const layer of layers) registry.registerLayer(layer);
  return registry;
}

function map(
  commands: KeySequenceMapDefinition["commands"],
  bindings: KeySequenceMapDefinition["bindings"],
): KeySequenceMapDefinition {
  return { commands, bindings };
}

function command(
  id: string,
  handler: KeySequenceMapDefinition["commands"][number]["handler"],
  options: Partial<Omit<KeySequenceMapDefinition["commands"][number], "id" | "title" | "handler">> = {},
): KeySequenceMapDefinition["commands"][number] {
  return { id, title: id, handler, ...options };
}

function sequenceBinding(
  id: string,
  commandId: string,
  layerId: string,
  sequence: KeySequenceMapDefinition["bindings"][number]["sequence"],
): KeySequenceMapDefinition["bindings"][number] {
  return { id, commandId, layerId, sequence };
}

function layeredBinding(
  id: string,
  keyValue: string,
  handler: LayeredKeyBinding["handler"],
): LayeredKeyBinding {
  return { id, key: keyValue, description: id, handler };
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
