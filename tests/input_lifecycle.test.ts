import { assert, assertEquals, assertThrows } from "./deps.ts";
import {
  type InputEnvelope,
  InputEnvelopeFactory,
  type InputSourceKind,
  type InputTrustLevel,
} from "../src/input_envelope.ts";
import {
  InputLifecycleError,
  InputLifecycleReconciler,
  type InputLifecycleSyntheticEvent,
} from "../src/input_lifecycle.ts";
import {
  adaptMousePointer,
  adaptPenPointer,
  adaptTouchPointer,
  type PointerAdapterInput,
  type PointerInputDevice,
  type PointerInputEvent,
  type PointerInputKind,
} from "../src/pointer_input.ts";

Deno.test("focus loss deterministically releases keys/buttons and cancels contact gesture drag and capture", () => {
  const factory = tickingFactory();
  const reconciler = new InputLifecycleReconciler({ factory });
  const observed: string[] = [];
  reconciler.subscribe((event) => observed.push(event.kind));

  assertEquals(reconciler.observeKey("workspace", keyInput(factory, "KeyB", "b", "down")), true);
  assertEquals(reconciler.observeKey("workspace", keyInput(factory, "KeyA", "a", "down")), true);
  const touch = pointer(factory, "touch", "down", 1, { source: "remote", buttons: 1 });
  const mouse = pointer(factory, "mouse", "down", 2, { buttons: 5 });
  reconciler.observePointer("workspace", touch);
  reconciler.observePointer("workspace", mouse);
  reconciler.capture("workspace", 2, "splitter");
  reconciler.observeGesture("workspace", { id: "pinch", phase: "start", pointer: touch });
  reconciler.observeDrag("workspace", { id: "resize", phase: "start", pointer: mouse });

  const result = reconciler.reconcile("workspace", "focus-lost");
  assertEquals(result.matched, 6);
  assertEquals(result.failed, 0);
  assertEquals(result.events.map((event) => event.kind), [
    "key-up",
    "key-up",
    "pointer-cancel",
    "pointer-release",
    "pointer-release",
    "pointer-cancel",
    "gesture-cancel",
    "drag-cancel",
  ]);
  assertEquals(observed, result.events.map((event) => event.kind));
  assertEquals(
    result.events.filter((event) => event.kind === "key-up").map((event) => event.keyId),
    ["KeyA", "KeyB"],
  );
  const releases = result.events.filter((event) => event.kind === "pointer-release");
  assertEquals(releases.map((event) => [event.pointerId, event.button, event.pointer.buttons]), [
    [2, 0, 4],
    [2, 1, 0],
  ]);
  const touchCancel = result.events.find((event) => event.kind === "pointer-cancel" && event.pointerId === 1);
  assert(touchCancel?.kind === "pointer-cancel");
  assertEquals(
    [touchCancel.pointer.source, touchCancel.pointer.device, touchCancel.pointer.trust, touchCancel.pointer.buttons],
    ["remote", "touch", "untrusted", 0],
  );
  assertEquals(reconciler.inspect().scopes, []);
  assert(Object.isFrozen(result));
  assert(Object.isFrozen(result.events));

  const repeated = reconciler.reconcile("workspace", "focus-lost");
  assertEquals(repeated.events, []);
  assertEquals(repeated.revision, result.revision);
});

Deno.test("duplicate key downs repeats and inactive ups never manufacture releases", () => {
  const factory = tickingFactory();
  const reconciler = new InputLifecycleReconciler({ factory });
  assertEquals(reconciler.observeKey("keys", keyInput(factory, "KeyA", "a", "up")), false);
  assertEquals(reconciler.observeKey("keys", keyInput(factory, "KeyA", "a", "repeat")), false);
  assertEquals(reconciler.observeKey("keys", keyInput(factory, "KeyA", "a", "down")), true);
  const revision = reconciler.inspect().revision;
  assertEquals(reconciler.observeKey("keys", keyInput(factory, "KeyA", "A", "down")), false);
  assertEquals(reconciler.observeKey("keys", keyInput(factory, "KeyA", "a", "repeat")), false);
  assertEquals(reconciler.inspect().revision, revision);
  assertEquals(reconciler.reconcile("keys", "focus-lost").events.map((event) => event.kind), ["key-up"]);
  assertEquals(reconciler.reconcile("keys", "focus-lost").events, []);

  reconciler.observeKey("keys", keyInput(factory, "KeyA", "a", "down"));
  assertEquals(reconciler.observeKey("keys", keyInput(factory, "KeyA", "a", "up")), true);
  assertEquals(reconciler.reconcile("keys", "focus-lost").events, []);
});

Deno.test("a terminal key event with different provenance cannot erase held state", () => {
  const factory = tickingFactory();
  const reconciler = new InputLifecycleReconciler({ factory });
  reconciler.observeKey("shared", keyInput(factory, "KeyA", "a", "down", "browser"));
  const revision = reconciler.inspect().revision;

  assertLifecycleError(
    () => reconciler.observeKey("shared", keyInput(factory, "KeyA", "a", "up", "remote")),
    "conflict",
  );
  assertEquals(reconciler.inspect().revision, revision);
  assertEquals(reconciler.inspect().scopes[0]!.keys.map((entry) => entry.keyId), ["KeyA"]);

  const result = reconciler.reconcile("shared", "focus-lost");
  assertEquals(result.events.map((event) => event.kind), ["key-up"]);
  assertEquals(result.events[0]!.kind === "key-up" && result.events[0].envelope.source, "browser");
});

Deno.test("real pointer termination clears state and multi-touch remains isolated", () => {
  const factory = tickingFactory();
  const reconciler = new InputLifecycleReconciler({ factory });
  const first = pointer(factory, "touch", "down", 10);
  const second = pointer(factory, "touch", "down", 11);
  reconciler.observePointer("touches", first);
  reconciler.observePointer("touches", second);
  reconciler.observeGesture("touches", { id: "first-gesture", phase: "start", pointer: first });
  assertEquals(reconciler.observePointer("touches", pointer(factory, "touch", "up", 10)), true);

  const result = reconciler.reconcile("touches", "transport-disconnected");
  assertEquals(result.events.map((event) => [event.kind, "pointerId" in event ? event.pointerId : undefined]), [
    ["pointer-cancel", 11],
  ]);
  assertEquals(result.events.some((event) => "pointerId" in event && event.pointerId === 10), false);
});

Deno.test("transport reconciliation is scoped and leaves independent local state active", () => {
  const factory = tickingFactory();
  const reconciler = new InputLifecycleReconciler({ factory });
  reconciler.observeKey("remote:a", keyInput(factory, "KeyR", "r", "down", "remote"));
  reconciler.observeKey("local", keyInput(factory, "KeyL", "l", "down", "browser"));

  const remote = reconciler.reconcile("remote:a", "transport-disconnected");
  assertEquals(remote.events.map((event) => event.kind), ["key-up"]);
  assertEquals(remote.events[0]!.kind === "key-up" && remote.events[0].envelope.source, "remote");
  assertEquals(reconciler.inspect().scopes.map((scope) => scope.id), ["local"]);
  assertEquals(reconciler.reconcile("remote:a", "transport-disconnected").events, []);
  assertEquals(reconciler.reconcile("local", "focus-lost").events.length, 1);
});

Deno.test("capture disposal cancels only the expected owner and preserves keys and other captures", () => {
  const factory = tickingFactory();
  const reconciler = new InputLifecycleReconciler({ factory });
  reconciler.observeKey("canvas", keyInput(factory, "ShiftLeft", "shift", "down"));
  const left = pointer(factory, "mouse", "down", 1);
  const right = pointer(factory, "mouse", "down", 2);
  reconciler.observePointer("canvas", left);
  reconciler.observePointer("canvas", right);
  reconciler.capture("canvas", 1, "left-owner");
  reconciler.capture("canvas", 2, "right-owner");
  reconciler.observeDrag("canvas", { id: "left-drag", phase: "start", pointer: left });
  reconciler.observeGesture("canvas", { id: "right-gesture", phase: "start", pointer: right });

  const result = reconciler.reconcileCapture("canvas", "left-owner");
  assertEquals(result.events.map((event) => event.kind), ["pointer-release", "pointer-cancel", "drag-cancel"]);
  assertEquals(result.events.every((event) => !("pointerId" in event) || event.pointerId === 1), true);
  const inspection = reconciler.inspect().scopes[0]!;
  assertEquals(inspection.keys.map((key) => key.keyId), ["ShiftLeft"]);
  assertEquals(inspection.pointers.map((entry) => [entry.pointerId, entry.captureOwnerId]), [[2, "right-owner"]]);
  assertEquals(inspection.gestures.map((entry) => entry.id), ["right-gesture"]);
  assertEquals(reconciler.reconcileCapture("canvas", "left-owner").events, []);

  const remaining = reconciler.reconcileCapture("canvas", "right-owner");
  assertEquals(remaining.events.map((event) => event.kind), [
    "pointer-release",
    "pointer-cancel",
    "gesture-cancel",
  ]);
  assertEquals(reconciler.inspect().scopes[0]!.keys.length, 1);
});

Deno.test("capture ownership is explicit conflict-safe and a normal release does not cancel", () => {
  const factory = tickingFactory();
  const reconciler = new InputLifecycleReconciler({ factory });
  assertLifecycleError(() => reconciler.capture("scope", 1, "owner"), "not-found");
  const down = pointer(factory, "mouse", "down", 1);
  assertEquals(reconciler.observePointer("scope", down), true);
  const downRevision = reconciler.inspect().revision;
  assertEquals(reconciler.observePointer("scope", down), false);
  assertEquals(reconciler.inspect().revision, downRevision);
  assertLifecycleError(
    () =>
      reconciler.observePointer(
        "scope",
        pointer(factory, "mouse", "move", 1, { source: "remote", buttons: 1, button: null }),
      ),
    "conflict",
  );
  // A move reporting zero buttons is not treated as proof that a required up
  // arrived; focus reconciliation still releases the original down.
  assertEquals(
    reconciler.observePointer("scope", pointer(factory, "mouse", "move", 1, { buttons: 0, button: null })),
    true,
  );
  assertEquals(reconciler.capture("scope", 1, "owner"), true);
  assertEquals(reconciler.capture("scope", 1, "owner"), false);
  assertLifecycleError(() => reconciler.capture("scope", 1, "other"), "conflict");
  assertLifecycleError(() => reconciler.releaseCapture("scope", 1, "other"), "conflict");
  assertEquals(reconciler.releaseCapture("scope", 1, "owner"), true);
  assertEquals(reconciler.releaseCapture("scope", 1, "owner"), false);
  assertEquals(reconciler.reconcileCapture("scope", "owner").events, []);
  assertEquals(reconciler.reconcile("scope", "focus-lost").events.map((event) => event.kind), [
    "pointer-release",
  ]);
});

Deno.test("pointer termination must match active device and provenance before clearing capture", () => {
  const factory = tickingFactory();
  const reconciler = new InputLifecycleReconciler({ factory });
  reconciler.observePointer("shared", pointer(factory, "mouse", "down", 7));
  reconciler.capture("shared", 7, "owner");
  const revision = reconciler.inspect().revision;

  assertLifecycleError(
    () =>
      reconciler.observePointer(
        "shared",
        pointer(factory, "mouse", "cancel", 7, { source: "remote" }),
      ),
    "conflict",
  );
  assertLifecycleError(
    () => reconciler.observePointer("shared", pointer(factory, "touch", "cancel", 7)),
    "conflict",
  );
  assertEquals(reconciler.inspect().revision, revision);
  assertEquals(reconciler.inspect().scopes[0]!.pointers[0]!.captureOwnerId, "owner");

  assertEquals(reconciler.reconcile("shared", "focus-lost").events.map((event) => event.kind), [
    "pointer-release",
    "pointer-cancel",
  ]);
});

Deno.test("pointer up cannot introduce buttons that were never held", () => {
  const factory = tickingFactory();
  const reconciler = new InputLifecycleReconciler({ factory });
  reconciler.observePointer("buttons", pointer(factory, "mouse", "down", 3, { buttons: 1 }));
  const revision = reconciler.inspect().revision;

  assertLifecycleError(
    () => reconciler.observePointer("buttons", pointer(factory, "mouse", "up", 3, { buttons: 3 })),
    "conflict",
  );
  assertEquals(reconciler.inspect().revision, revision);
  assertEquals(reconciler.inspect().scopes[0]!.pointers[0]!.buttons, [0]);
  const releases = reconciler.reconcile("buttons", "focus-lost").events;
  assertEquals(releases.map((event) => event.kind), ["pointer-release"]);
  assertEquals(releases[0]!.kind === "pointer-release" && releases[0].button, 0);
});

Deno.test("gesture and drag updates preserve identity and refresh cancellation metadata", () => {
  const factory = tickingFactory();
  const reconciler = new InputLifecycleReconciler({ factory });
  const first = pointer(factory, "mouse", "down", 1);
  const second = pointer(factory, "mouse", "down", 2);
  reconciler.observePointer("interactions", first);
  reconciler.observePointer("interactions", second);
  reconciler.observeGesture("interactions", { id: "gesture", phase: "start", pointer: first });
  reconciler.observeDrag("interactions", { id: "drag", phase: "start", pointer: first });
  const revision = reconciler.inspect().revision;

  assertLifecycleError(
    () => reconciler.observeGesture("interactions", { id: "gesture", phase: "update", pointer: second }),
    "conflict",
  );
  assertLifecycleError(
    () => reconciler.observeDrag("interactions", { id: "drag", phase: "finish", pointer: second }),
    "conflict",
  );
  assertEquals(reconciler.inspect().revision, revision);
  assertEquals(reconciler.inspect().scopes[0]!.gestures.map((entry) => entry.pointerId), [1]);
  assertEquals(reconciler.inspect().scopes[0]!.drags.map((entry) => entry.pointerId), [1]);

  const update = pointer(factory, "mouse", "move", 1, { buttons: 1, shift: true });
  assertEquals(
    reconciler.observeGesture("interactions", { id: "gesture", phase: "update", pointer: update }),
    true,
  );
  assertEquals(reconciler.observeDrag("interactions", { id: "drag", phase: "update", pointer: update }), true);
  const cancels = reconciler.reconcile("interactions", "focus-lost").events.filter((event) =>
    event.kind === "gesture-cancel" || event.kind === "drag-cancel"
  );
  assertEquals(cancels.map((event) => [event.kind, event.envelope.modifiers.shift]), [
    ["gesture-cancel", true],
    ["drag-cancel", true],
  ]);
});

Deno.test("reconciliation clears before callbacks and isolates reentrancy and listener failures", () => {
  const factory = tickingFactory();
  const reconciler = new InputLifecycleReconciler({ factory, maxDiagnostics: 4 });
  const seen: string[] = [];
  let nestedCount = -1;
  let inserted = false;
  reconciler.subscribe((event) => {
    if (!inserted) {
      inserted = true;
      nestedCount = reconciler.reconcile("scope", "focus-lost").events.length;
      reconciler.observeKey("scope", keyInput(factory, "KeyN", "n", "down"));
    }
    seen.push(`first:${event.kind}`);
  });
  reconciler.subscribe(() => {
    throw new Error("listener boom");
  });
  reconciler.subscribe((event) => seen.push(`last:${event.kind}`));
  reconciler.observeKey("scope", keyInput(factory, "KeyA", "a", "down"));
  reconciler.observeKey("scope", keyInput(factory, "KeyB", "b", "down"));

  const result = reconciler.reconcile("scope", "focus-lost");
  assertEquals(nestedCount, 0);
  assertEquals(result.events.length, 2);
  assertEquals(seen, ["first:key-up", "last:key-up", "first:key-up", "last:key-up"]);
  assertEquals(reconciler.inspect().scopes[0]!.keys.map((key) => key.keyId), ["KeyN"]);
  assertEquals(reconciler.inspect().diagnostics.map((entry) => entry.phase), ["listener", "listener"]);
  assertEquals(reconciler.inspect().diagnostics[0]!.error.message, "listener boom");
});

Deno.test("factory exhaustion is explicit bounded and cannot strand reconciler state", () => {
  const incoming = tickingFactory();
  const synthetic = new InputEnvelopeFactory({ now: () => 99, initialSequence: Number.MAX_SAFE_INTEGER });
  const reconciler = new InputLifecycleReconciler({ factory: synthetic, maxDiagnostics: 2 });
  reconciler.observeKey("scope", keyInput(incoming, "KeyA", "a", "down"));
  reconciler.observeKey("scope", keyInput(incoming, "KeyB", "b", "down"));

  const result = reconciler.reconcile("scope", "focus-lost");
  assertEquals(result.events.length, 1);
  assertEquals(result.failed, 1);
  assertEquals(result.events[0]!.kind === "key-up" && result.events[0].envelope.sequence, Number.MAX_SAFE_INTEGER);
  assertEquals(reconciler.inspect().diagnostics.map((entry) => entry.phase), ["factory"]);
  assertEquals(reconciler.inspect().scopes, []);
  assertEquals(reconciler.reconcile("scope", "focus-lost").failed, 0);
});

Deno.test("revision exhaustion rejects before state mutation while disposal remains terminal", () => {
  const factory = tickingFactory();
  const reconciler = new InputLifecycleReconciler({ factory, initialRevision: Number.MAX_SAFE_INTEGER });
  assertLifecycleError(
    () => reconciler.observeKey("scope", keyInput(factory, "KeyA", "a", "down")),
    "sequence-overflow",
  );
  assertEquals(reconciler.inspect().scopes, []);
  assertEquals(reconciler.inspect().revision, Number.MAX_SAFE_INTEGER);
  reconciler.dispose();
  reconciler.dispose();
  assertEquals(reconciler.inspect().disposed, true);
});

Deno.test("limits strict shapes and inspection are bounded clone-safe and callback-free", () => {
  const factory = tickingFactory();
  const reconciler = new InputLifecycleReconciler({
    factory,
    maxScopes: 1,
    maxKeysPerScope: 1,
    maxPointersPerScope: 1,
    maxInteractionsPerScope: 1,
    maxListeners: 1,
  });
  reconciler.observeKey("scope", keyInput(factory, "KeyA", "a", "down"));
  assertLifecycleError(
    () => reconciler.observeKey("scope", keyInput(factory, "KeyB", "b", "down")),
    "limit-exceeded",
  );
  assertLifecycleError(
    () => reconciler.observeKey("other", keyInput(factory, "KeyC", "c", "down")),
    "limit-exceeded",
  );
  const listener = () => undefined;
  const stop = reconciler.subscribe(listener);
  assertLifecycleError(() => reconciler.subscribe(() => undefined), "limit-exceeded");
  stop();
  stop();

  const inspection = reconciler.inspect();
  assert(Object.isFrozen(inspection));
  assert(Object.isFrozen(inspection.scopes));
  assert(Object.isFrozen(inspection.scopes[0]!.keys));
  assertEquals(JSON.stringify(inspection).includes("factory"), false);
  assertThrows(() => (inspection.scopes as unknown as unknown[]).push({}));

  const accessor: Record<string, unknown> = { keyId: "KeyX", key: "x", phase: "down" };
  Object.defineProperty(accessor, "envelope", {
    enumerable: true,
    get() {
      throw new Error("must not run");
    },
  });
  assertLifecycleError(() => reconciler.observeKey("scope", accessor as never), "invalid-shape");
});

Deno.test("strict lifecycle records snapshot data descriptors without invoking proxy getters", () => {
  const factory = tickingFactory();
  const reconciler = new InputLifecycleReconciler({ factory });
  let propertyGets = 0;
  const input = new Proxy(keyInput(factory, "KeyA", "a", "down"), {
    get() {
      propertyGets += 1;
      throw new Error("proxy getter must not run");
    },
  });

  assertEquals(reconciler.observeKey("proxy", input), true);
  assertEquals(propertyGets, 0);
  assertEquals(reconciler.reconcile("proxy", "focus-lost").events.map((event) => event.kind), ["key-up"]);
});

Deno.test("dispose reconciles all scopes once and rejects later observations", () => {
  const factory = tickingFactory();
  const reconciler = new InputLifecycleReconciler({ factory });
  const events: InputLifecycleSyntheticEvent[] = [];
  reconciler.subscribe((event) => events.push(event));
  // UTF-16 code-unit order is deliberate (`z` before `ä`) and must not vary
  // with the host's locale collation settings.
  reconciler.observeKey("ä", keyInput(factory, "KeyB", "b", "down"));
  reconciler.observeKey("z", keyInput(factory, "KeyA", "a", "down"));
  reconciler.dispose();
  reconciler.dispose();

  assertEquals(events.map((event) => [event.scopeId, event.reason, event.kind]), [
    ["z", "reconciler-disposed", "key-up"],
    ["ä", "reconciler-disposed", "key-up"],
  ]);
  assertEquals(reconciler.inspect().disposed, true);
  assertEquals(reconciler.inspect().scopes, []);
  assertEquals(reconciler.inspect().listenerCount, 0);
  assertLifecycleError(
    () => reconciler.observeKey("scope", keyInput(factory, "KeyX", "x", "down")),
    "disposed",
  );
});

Deno.test("a hostile or provenance-changing factory is isolated as a failed synthesis", () => {
  const incoming = tickingFactory();
  const hostile = {
    create(_source: InputSourceKind, event: Parameters<InputEnvelopeFactory["create"]>[1]): InputEnvelope {
      return incoming.create("test", event, { trust: "synthetic" });
    },
  };
  const reconciler = new InputLifecycleReconciler({ factory: hostile });
  reconciler.observeKey("remote", keyInput(incoming, "KeyA", "a", "down", "remote"));
  const result = reconciler.reconcile("remote", "transport-disconnected");
  assertEquals([result.events.length, result.failed], [0, 1]);
  assertEquals(reconciler.inspect().diagnostics[0]!.phase, "factory");
  assertEquals(reconciler.inspect().scopes, []);
});

Deno.test("a semantically dishonest factory cannot forge a canonical release envelope", () => {
  const incoming = tickingFactory();
  const emitted = tickingFactory();
  const dishonest = {
    create(
      source: InputSourceKind,
      event: Parameters<InputEnvelopeFactory["create"]>[1],
      options: Parameters<InputEnvelopeFactory["create"]>[2],
    ): InputEnvelope {
      return emitted.create(
        source,
        {
          kind: event.kind,
          device: event.device,
          modifiers: { ...event.modifiers, alt: true },
          data: { key: "evil", keyId: "Bogus", phase: "down" },
          raw: new Uint8Array([0xde, 0xad]),
        },
        { ...options, includeRaw: true },
      );
    },
  };
  const reconciler = new InputLifecycleReconciler({ factory: dishonest });
  reconciler.observeKey("scope", keyInput(incoming, "KeyA", "a", "down"));

  const result = reconciler.reconcile("scope", "focus-lost");
  assertEquals([result.events.length, result.failed], [0, 1]);
  assertEquals(reconciler.inspect().diagnostics.map((entry) => [entry.phase, entry.eventKind]), [
    ["factory", "key-up"],
  ]);
  assertEquals(reconciler.inspect().scopes, []);
});

function tickingFactory(): InputEnvelopeFactory {
  let now = 1;
  return new InputEnvelopeFactory({ now: () => now++ });
}

function keyInput(
  factory: InputEnvelopeFactory,
  keyId: string,
  key: string,
  phase: "down" | "repeat" | "up",
  source: InputSourceKind = "browser",
): { envelope: InputEnvelope; keyId: string; key: string; phase: "down" | "repeat" | "up" } {
  return {
    envelope: factory.create(source, {
      kind: "key",
      device: "keyboard",
      data: { key, keyId, phase },
    }),
    keyId,
    key,
    phase,
  };
}

function pointer(
  factory: InputEnvelopeFactory,
  device: PointerInputDevice,
  kind: PointerInputKind,
  pointerId: number,
  options: {
    source?: InputSourceKind;
    trust?: InputTrustLevel;
    buttons?: number;
    button?: number | null;
    shift?: boolean;
  } = {},
): PointerInputEvent {
  const source = options.source ?? "browser";
  const terminal = kind === "up" || kind === "cancel";
  const envelope = factory.create(
    source,
    {
      kind: kind === "wheel" ? "scroll" : "pointer",
      device,
      modifiers: options.shift === undefined ? undefined : { shift: options.shift },
      data: { pointerId, phase: kind },
    },
    options.trust === undefined ? {} : { trust: options.trust },
  );
  const input: PointerAdapterInput = {
    pointerId,
    kind,
    coordinates: { cell: { space: "cell", x: pointerId, y: pointerId + 1 } },
    primary: true,
    button: options.button ?? (kind === "down" || kind === "up" ? 0 : null),
    buttons: options.buttons ?? (terminal ? 0 : 1),
    ...(device === "pen" ? { pressure: terminal ? 0 : 0.5, tiltX: 0, tiltY: 0, twist: 0 } : {}),
    ...(kind === "wheel" ? { wheel: { deltaX: 0, deltaY: 1, unit: "line" as const } } : {}),
  };
  if (device === "mouse") return adaptMousePointer(envelope, input);
  if (device === "touch") return adaptTouchPointer(envelope, input);
  return adaptPenPointer(envelope, input);
}

function assertLifecycleError(action: () => unknown, code: InputLifecycleError["code"]): void {
  assertEquals(assertThrows(action, InputLifecycleError).code, code);
}
