import { assert, assertEquals, assertNotStrictEquals, assertThrows } from "./deps.ts";
import { type InputEnvelope, InputEnvelopeFactory, type InputSourceKind } from "../src/input_envelope.ts";
import type { MousePressEvent, MouseScrollEvent } from "../src/input_reader/types.ts";
import {
  adaptMousePointer,
  adaptPenPointer,
  adaptTerminalMousePointer,
  adaptTouchPointer,
  createPointerAdapterFrame,
  dispatchPointerAdapterFrame,
  normalizePointerInputEvent,
  POINTER_INPUT_SCHEMA_VERSION,
  type PointerAdapterInput,
  PointerCaptureController,
  PointerInputError,
  type PointerInputEvent,
  type PointerInputKind,
  pointerSemanticTransition,
  TERMINAL_MOUSE_POINTER_ID,
} from "../src/pointer_input.ts";

Deno.test("mouse touch and pen adapters inherit canonical metadata and preserve real capabilities", () => {
  let timestamp = 40;
  const factory = new InputEnvelopeFactory({ now: () => timestamp++ });
  const mouseEnvelope = pointerEnvelope(factory, "mouse", "down", {
    source: "browser",
    raw: new Uint8Array([1, 2, 3]),
  });
  const mouse = adaptMousePointer(
    mouseEnvelope,
    pointerInput("down", 4, {
      coordinates: {
        screen: { space: "screen", x: 110.5, y: 82.25 },
        cell: { space: "cell", x: 11, y: 8 },
        local: { space: "local", x: 3, y: 2 },
      },
      pressure: 0.5,
    }),
  );
  const touch = adaptTouchPointer(
    pointerEnvelope(factory, "touch", "move", { source: "browser" }),
    pointerInput("move", 19, {
      coordinates: { screen: { space: "screen", x: 18, y: 29 } },
      pressure: 0.72,
      contact: { width: 14, height: 9 },
      button: null,
      buttons: 1,
    }),
  );
  const pen = adaptPenPointer(
    pointerEnvelope(factory, "pen", "move", { source: "remote" }),
    pointerInput("move", 27, {
      coordinates: {
        cell: { space: "cell", x: 6, y: 7 },
        local: { space: "local", x: 1.25, y: -0.5 },
      },
      pressure: 0.84,
      tangentialPressure: -0.25,
      tiltX: -30,
      tiltY: 45,
      twist: 270,
      contact: { width: 2.5, height: 3.5 },
      button: null,
      buttons: 1,
    }),
  );

  assertEquals(mouse.schemaVersion, POINTER_INPUT_SCHEMA_VERSION);
  assertEquals(mouse.sequence, mouseEnvelope.sequence);
  assertEquals(mouse.timestamp, 40);
  assertEquals(mouse.source, "browser");
  assertEquals(mouse.trust, "trusted");
  assertEquals(mouse.modifiers, { alt: true, ctrl: true, meta: false, shift: true });
  assertEquals(mouse.raw, { encoding: "base64", data: "AQID" });
  assertEquals(mouse.pointerId, 4);
  assertEquals(mouse.device, "mouse");
  assertEquals(mouse.button, 0);
  assertEquals(mouse.buttons, 1);
  assertEquals(mouse.pressure, 0.5);
  assertEquals(mouse.coordinates, {
    screen: { space: "screen", x: 110.5, y: 82.25 },
    cell: { space: "cell", x: 11, y: 8 },
    local: { space: "local", x: 3, y: 2 },
  });
  assertEquals(touch.device, "touch");
  assertEquals(touch.pointerId, 19);
  assertEquals(touch.contact, { width: 14, height: 9 });
  assertEquals(touch.pressure, 0.72);
  assertEquals(pen.device, "pen");
  assertEquals(pen.source, "remote");
  assertEquals(pen.trust, "untrusted");
  assertEquals(
    [pen.pressure, pen.tangentialPressure, pen.tiltX, pen.tiltY, pen.twist],
    [0.84, -0.25, -30, 45, 270],
  );
  assertEquals(pen.contact, { width: 2.5, height: 3.5 });
  assert(Object.isFrozen(mouse));
  assert(Object.isFrozen(mouse.modifiers));
  assert(Object.isFrozen(mouse.coordinates));
  assert(Object.isFrozen(mouse.coordinates.screen!));
  assert(Object.isFrozen(pen.contact!));
});

Deno.test("terminal mouse adapter uses cell coordinates and leaves unavailable analog fields absent", () => {
  let now = 1;
  const factory = new InputEnvelopeFactory({ now: () => now++ });
  const downSource = mousePress({ x: 8, y: 5, button: 2, ctrl: true });
  const down = adaptTerminalMousePointer(
    factory.terminal(downSource, { includeRaw: true }),
    downSource,
    {
      screen: { space: "screen", x: 80, y: 100 },
      local: { space: "local", x: 2, y: 1 },
    },
  );
  const dragSource = mousePress({ x: 12, y: 7, movementX: 4, movementY: 2, drag: true, button: 0 });
  const drag = adaptTerminalMousePointer(factory.terminal(dragSource), dragSource);
  const upSource = mousePress({ x: 12, y: 7, release: true, button: undefined });
  const up = adaptTerminalMousePointer(factory.terminal(upSource), upSource);
  const wheelSource = mouseScroll(-1, { x: 4, y: 3 });
  const wheel = adaptTerminalMousePointer(factory.terminal(wheelSource), wheelSource, { pointerId: 9 });

  assertEquals(down.pointerId, TERMINAL_MOUSE_POINTER_ID);
  assertEquals(down.kind, "down");
  assertEquals(down.coordinates, {
    screen: { space: "screen", x: 80, y: 100 },
    cell: { space: "cell", x: 8, y: 5 },
    local: { space: "local", x: 2, y: 1 },
  });
  assertEquals(down.button, 2);
  assertEquals(down.buttons, 2);
  assertEquals(down.modifiers.ctrl, true);
  assertEquals(Object.hasOwn(down, "pressure"), false);
  assertEquals(Object.hasOwn(down, "contact"), false);
  assertEquals(Object.hasOwn(down, "tiltX"), false);
  assertEquals(down.raw, { encoding: "base64", data: "G1sz" });
  assertEquals([drag.kind, drag.button, drag.buttons], ["move", null, 1]);
  assertEquals([up.kind, up.button, up.buttons], ["up", null, 0]);
  assertEquals(wheel.pointerId, 9);
  assertEquals(wheel.kind, "wheel");
  assertEquals(wheel.wheel, { deltaX: 0, deltaY: -1, unit: "line" });
  assertEquals(wheel.buttons, 0);
});

Deno.test("normalization defensively clones coordinates and rejects hostile malformed values", () => {
  const factory = new InputEnvelopeFactory({ now: () => 10 });
  const mutableCoordinates = {
    screen: { space: "screen" as const, x: 10, y: 20 },
    local: { space: "local" as const, x: 1, y: 2 },
  };
  const mutableContact = { width: 7, height: 8 };
  const valid = adaptTouchPointer(
    pointerEnvelope(factory, "touch", "move"),
    pointerInput("move", 2, {
      coordinates: mutableCoordinates,
      contact: mutableContact,
      pressure: 0.4,
      button: null,
      buttons: 1,
    }),
  );
  mutableCoordinates.screen.x = 999;
  mutableContact.width = 999;
  assertEquals(valid.coordinates.screen!.x, 10);
  assertEquals(valid.contact!.width, 7);
  assertNotStrictEquals(valid.coordinates, mutableCoordinates);
  assertNotStrictEquals(valid.contact, mutableContact);

  const normalizedAgain = normalizePointerInputEvent(valid);
  assertNotStrictEquals(normalizedAgain, valid);
  assertNotStrictEquals(normalizedAgain.coordinates, valid.coordinates);
  assertEquals(normalizedAgain, valid);

  assertPointerError(
    () => normalizePointerInputEvent({ ...valid, coordinates: { cell: { space: "cell", x: NaN, y: 0 } } }),
    "invalid-value",
  );
  assertPointerError(() => normalizePointerInputEvent({ ...valid, pointerId: -0 }), "invalid-value");
  assertPointerError(() => normalizePointerInputEvent({ ...valid, buttons: 64 }), "invalid-value");
  assertPointerError(() => normalizePointerInputEvent({ ...valid, pressure: 1.01 }), "invalid-value");
  assertPointerError(() => normalizePointerInputEvent({ ...valid, device: "mouse", tiltX: 2 }), "invalid-value");
  assertPointerError(() => normalizePointerInputEvent({ ...valid, kind: "wheel" }), "invalid-shape");
  assertPointerError(
    () =>
      normalizePointerInputEvent({
        ...valid,
        wheel: { deltaX: 0, deltaY: 1, unit: "line" },
      }),
    "invalid-value",
  );
  assertPointerError(() => normalizePointerInputEvent({ ...valid, surprise: true }), "unknown-field");

  const inherited = Object.assign(Object.create({ polluted: true }), valid);
  assertPointerError(() => normalizePointerInputEvent(inherited), "invalid-shape");
  const accessorCoordinate: Record<string, unknown> = { space: "cell", y: 1 };
  Object.defineProperty(accessorCoordinate, "x", {
    enumerable: true,
    get() {
      throw new Error("must not run");
    },
  });
  assertPointerError(
    () => normalizePointerInputEvent({ ...valid, coordinates: { cell: accessorCoordinate } }),
    "invalid-shape",
  );
  const symbolEvent = { ...valid } as Record<PropertyKey, unknown>;
  symbolEvent[Symbol("hostile")] = true;
  assertPointerError(() => normalizePointerInputEvent(symbolEvent), "invalid-shape");
});

Deno.test("adapters enforce matching envelope device kind and unoverrideable provenance", () => {
  const factory = new InputEnvelopeFactory({ now: () => 1 });
  const touchEnvelope = pointerEnvelope(factory, "touch", "down");
  assertPointerError(
    () => adaptMousePointer(touchEnvelope, pointerInput("down", 1)),
    "invalid-value",
  );
  assertPointerError(
    () =>
      adaptTouchPointer(
        pointerEnvelope(factory, "touch", "wheel"),
        pointerInput("down", 1),
      ),
    "invalid-value",
  );
  assertPointerError(
    () =>
      adaptTouchPointer(
        touchEnvelope,
        { ...pointerInput("down", 1), source: "remote" } as PointerAdapterInput,
      ),
    "unknown-field",
  );
  assertPointerError(
    () =>
      adaptTerminalMousePointer(
        factory.terminal(mousePress()),
        Object.assign(Object.create({ hostile: true }), mousePress()),
      ),
    "invalid-shape",
  );
});

Deno.test("mouse and single-touch frames drive identical semantic transitions while retaining raw events", () => {
  let now = 1;
  const factory = new InputEnvelopeFactory({ now: () => now++ });
  const mouseRaw = [{ type: "mousedown" }, { type: "mousemove" }, { type: "mouseup" }];
  const touchRaw = [{ type: "touchstart" }, { type: "touchmove" }, { type: "touchend" }];
  const kinds: PointerInputKind[] = ["down", "move", "up"];
  const mouseFrames = kinds.map((kind, index) =>
    createPointerAdapterFrame(
      adaptMousePointer(pointerEnvelope(factory, "mouse", kind), pointerInput(kind, 1)),
      mouseRaw[index]!,
    )
  );
  const touchFrames = kinds.map((kind, index) =>
    createPointerAdapterFrame(
      adaptTouchPointer(pointerEnvelope(factory, "touch", kind), pointerInput(kind, 88)),
      touchRaw[index]!,
    )
  );
  const transitions: string[][] = [[], []];
  const seenRaw: unknown[] = [];
  const mouseController = {
    handlePointer(event: PointerInputEvent, rawEvent: unknown) {
      transitions[0]!.push(pointerSemanticTransition(event));
      seenRaw.push(rawEvent);
    },
  };
  const touchController = {
    handlePointer(event: PointerInputEvent, rawEvent: unknown) {
      transitions[1]!.push(pointerSemanticTransition(event));
      seenRaw.push(rawEvent);
    },
  };
  for (const frame of mouseFrames) dispatchPointerAdapterFrame(frame, mouseController);
  for (const frame of touchFrames) dispatchPointerAdapterFrame(frame, touchController);

  assertEquals(transitions, [
    ["start", "update", "finish"],
    ["start", "update", "finish"],
  ]);
  assertEquals(seenRaw[0] === mouseRaw[0], true);
  assertEquals(seenRaw[3] === touchRaw[0], true);
  assertEquals(mouseFrames[0]!.rawEvent === mouseRaw[0], true);
  assert(Object.isFrozen(mouseFrames[0]!));
  assertNotStrictEquals(mouseFrames[0]!.event, normalizePointerInputEvent(mouseFrames[0]!.event));
});

Deno.test("capture routes to the exclusive owner across hits transfer release and terminal events", () => {
  const pointer = pointerFixture("touch");
  const controller = new PointerCaptureController();
  const seen: string[] = [];
  const changes: string[] = [];
  controller.registerOwner({
    id: "alpha",
    onPointer: (event, context) => seen.push(`alpha:${event.kind}:${context.captured}:${context.hitOwnerId}`),
  });
  controller.registerOwner({
    id: "beta",
    onPointer: (event, context) => seen.push(`beta:${event.kind}:${context.captured}:${context.hitOwnerId}`),
  });
  controller.subscribe((change) => changes.push(change.kind));

  assertEquals(controller.route(pointer("down", 7), "alpha"), {
    pointerId: 7,
    kind: "down",
    delivered: true,
    captured: false,
    hitOwnerId: "alpha",
    ownerId: "alpha",
  });
  controller.capture(7, "alpha");
  assertEquals(controller.captureOwner(7), "alpha");
  assertEquals(controller.route(pointer("move", 7), "beta").ownerId, "alpha");
  controller.transfer(7, "alpha", "beta");
  assertEquals(controller.route(pointer("move", 7), "alpha").ownerId, "beta");
  assertEquals(controller.release(7, "beta"), true);
  assertEquals(controller.release(7, "beta"), false);
  assertEquals(controller.route(pointer("move", 7), "alpha").ownerId, "alpha");

  controller.capture(7, "alpha");
  const up = controller.route(pointer("up", 7), "beta");
  assertEquals([up.ownerId, up.captured, controller.captureOwner(7)], ["alpha", true, undefined]);
  controller.capture(7, "beta");
  controller.route(pointer("cancel", 7), "alpha");
  assertEquals(controller.captureOwner(7), undefined);
  assertEquals(changes, [
    "captured",
    "transferred",
    "released",
    "captured",
    "auto-released",
    "captured",
    "auto-released",
  ]);
  assertEquals(seen, [
    "alpha:down:false:alpha",
    "alpha:move:true:beta",
    "beta:move:true:alpha",
    "alpha:move:false:alpha",
    "alpha:up:true:beta",
    "beta:cancel:true:alpha",
  ]);
});

Deno.test("multi-touch capture is isolated by pointer id", () => {
  const pointer = pointerFixture("touch");
  const controller = new PointerCaptureController();
  const seen: string[] = [];
  controller.registerOwner({ id: "left", onPointer: (event) => seen.push(`left:${event.pointerId}:${event.kind}`) });
  controller.registerOwner({ id: "right", onPointer: (event) => seen.push(`right:${event.pointerId}:${event.kind}`) });
  controller.capture(10, "left");
  controller.capture(11, "right");

  controller.route(pointer("move", 10), "right");
  controller.route(pointer("move", 11), "left");
  controller.route(pointer("up", 10), "right");
  assertEquals(controller.captureOwner(10), undefined);
  assertEquals(controller.captureOwner(11), "right");
  controller.route(pointer("cancel", 11), "left");
  assertEquals(controller.captureOwner(11), undefined);
  assertEquals(seen, [
    "left:10:move",
    "right:11:move",
    "left:10:up",
    "right:11:cancel",
  ]);
});

Deno.test("owner disposal and cancel-all release captures with clone-safe bounded inspection", () => {
  const controller = new PointerCaptureController({ maxDiagnostics: 2 });
  const changes: string[] = [];
  const alpha = controller.registerOwner({ id: "alpha", onPointer: () => undefined });
  const beta = controller.registerOwner({ id: "beta", onPointer: () => undefined });
  controller.subscribe((change) => changes.push(`${change.kind}:${change.pointerId}`));
  controller.capture(3, "alpha");
  controller.capture(1, "alpha");
  controller.capture(2, "beta");

  alpha.dispose();
  alpha.dispose();
  assertEquals(alpha.isDisposed(), true);
  assertEquals(controller.captureOwner(1), undefined);
  assertEquals(controller.captureOwner(3), undefined);
  assertEquals(controller.captureOwner(2), "beta");
  assertEquals(controller.cancelAll(), 1);
  assertEquals(controller.cancelAll(), 0);
  const inspection = controller.inspect();
  assertEquals(inspection.captures, []);
  assertEquals(inspection.owners, [{ id: "beta", capturedPointerIds: [] }]);
  assertEquals(changes, [
    "captured:3",
    "captured:1",
    "captured:2",
    "owner-disposed:1",
    "owner-disposed:3",
    "cancelled:2",
  ]);
  assert(Object.isFrozen(inspection));
  assert(Object.isFrozen(inspection.owners));
  assert(Object.isFrozen(inspection.owners[0]!.capturedPointerIds));
  assertThrows(() => (inspection.owners as unknown as unknown[]).push({}));

  controller.dispose();
  controller.dispose();
  assertEquals(beta.isDisposed(), true);
  assertEquals(controller.inspect().disposed, true);
  assertPointerError(() => controller.capture(1, "beta"), "disposed");
  assertPointerError(() => controller.route(pointerFixture("touch")("move", 1), "beta"), "disposed");
});

Deno.test("disposing from cancel listeners completes cleanup without live registrations", () => {
  const controller = new PointerCaptureController();
  const alpha = controller.registerOwner({ id: "alpha", onPointer: () => undefined });
  const beta = controller.registerOwner({ id: "beta", onPointer: () => undefined });
  controller.capture(1, "alpha");
  controller.capture(2, "beta");
  controller.subscribe((change) => {
    if (change.kind === "cancelled" && change.pointerId === 1) controller.dispose();
  });

  assertEquals(controller.cancelAll(), 2);
  assertEquals(controller.disposed, true);
  assertEquals(alpha.isDisposed(), true);
  assertEquals(beta.isDisposed(), true);
  const inspection = controller.inspect();
  assertEquals(inspection.owners, []);
  assertEquals(inspection.captures, []);
  assertEquals(inspection.listenerCount, 0);
  assertPointerError(
    () => controller.registerOwner({ id: "late", onPointer: () => undefined }),
    "disposed",
  );
});

Deno.test("terminal owner disposal cannot remove the enclosing recapture block", () => {
  const pointer = pointerFixture("touch");
  const controller = new PointerCaptureController();
  const denied: string[] = [];
  const alpha = controller.registerOwner({
    id: "alpha",
    onPointer: (event) => {
      if (event.kind !== "up") return;
      alpha.dispose();
      try {
        controller.capture(event.pointerId, "beta");
      } catch (error) {
        denied.push((error as PointerInputError).code);
      }
    },
  });
  controller.registerOwner({ id: "beta", onPointer: () => undefined });
  controller.subscribe((change) => {
    if (change.kind !== "owner-disposed") return;
    try {
      controller.capture(change.pointerId, "beta");
    } catch (error) {
      denied.push((error as PointerInputError).code);
    }
  });
  controller.capture(7, "alpha");

  controller.route(pointer("up", 7), "beta");

  assertEquals(denied, ["invalid-state", "invalid-state"]);
  assertEquals(controller.captureOwner(7), undefined);
  assertEquals(controller.inspect().captures, []);
});

Deno.test("owner and listener errors are isolated and reentrant delivery is deterministic", () => {
  const pointer = pointerFixture("pen");
  const controller = new PointerCaptureController({ maxDiagnostics: 3 });
  const seen: string[] = [];
  controller.registerOwner({
    id: "nested",
    onPointer: (event) => {
      seen.push(`nested:${event.pointerId}`);
      if (event.pointerId === 1) controller.route(pointer("move", 2), "other");
      throw new Error(`owner-${event.pointerId}`);
    },
  });
  controller.registerOwner({ id: "other", onPointer: (event) => seen.push(`other:${event.pointerId}`) });
  const throwingListener = () => {
    throw new Error("listener-boom");
  };
  const listenerSeen: string[] = [];
  controller.subscribe(throwingListener);
  controller.subscribe((change) => listenerSeen.push(change.kind));
  assertPointerError(() => controller.subscribe(throwingListener), "duplicate");

  controller.capture(1, "nested");
  const result = controller.route(pointer("move", 1), "other");
  assertEquals(result.delivered, true);
  assertEquals(result.ownerId, "nested");
  assertEquals(result.error, { name: "Error", message: "owner-1" });
  assertEquals(seen, ["nested:1", "other:2"]);
  assertEquals(listenerSeen, ["captured"]);
  const diagnostics = controller.inspect().diagnostics;
  assertEquals(diagnostics.map((entry) => entry.phase), ["capture-listener", "owner-handler"]);
  assertEquals(diagnostics[1]!.error.message, "owner-1");

  controller.route(pointer("up", 1), "other");
  const bounded = controller.inspect().diagnostics;
  assertEquals(bounded.length, 3);
  assertEquals(bounded.map((entry) => entry.phase), ["owner-handler", "owner-handler", "capture-listener"]);
  assertEquals(controller.captureOwner(1), undefined);
});

Deno.test("capture duplicate conflicts limits listener lifecycle and terminal cleanup are strict", () => {
  const pointer = pointerFixture("mouse");
  const controller = new PointerCaptureController({ maxOwners: 2, maxCaptures: 1, maxListeners: 1 });
  const alpha = controller.registerOwner({ id: "alpha", onPointer: () => undefined });
  controller.registerOwner({ id: "beta", onPointer: () => undefined });
  assertPointerError(
    () => controller.registerOwner({ id: "alpha", onPointer: () => undefined }),
    "duplicate",
  );
  assertPointerError(
    () => controller.registerOwner({ id: "gamma", onPointer: () => undefined }),
    "limit-exceeded",
  );
  const listener = () => undefined;
  const stop = controller.subscribe(listener);
  assertPointerError(() => controller.subscribe(() => undefined), "limit-exceeded");
  stop();
  stop();
  controller.subscribe(() => undefined);

  controller.capture(1, "alpha");
  assertPointerError(() => controller.capture(1, "alpha"), "duplicate");
  assertPointerError(() => controller.capture(1, "beta"), "capture-conflict");
  assertPointerError(() => controller.capture(2, "beta"), "limit-exceeded");
  assertPointerError(() => controller.transfer(1, "beta", "alpha"), "capture-conflict");
  assertPointerError(() => controller.transfer(1, "alpha", "alpha"), "duplicate");
  assertPointerError(() => controller.release(1, "beta"), "capture-conflict");
  assertPointerError(() => controller.capture(-0, "alpha"), "invalid-value");
  assertPointerError(() => new PointerCaptureController(Object.create({ maxOwners: 2 })), "invalid-shape");

  alpha.dispose();
  assertEquals(controller.captureOwner(1), undefined);
  assertEquals(controller.route(pointer("move", 1), "beta").ownerId, "beta");
});

function pointerEnvelope(
  factory: InputEnvelopeFactory,
  device: "mouse" | "touch" | "pen",
  kind: PointerInputKind,
  options: {
    source?: InputSourceKind;
    raw?: Uint8Array;
  } = {},
): InputEnvelope {
  const event = {
    kind: kind === "wheel" ? "scroll" as const : "pointer" as const,
    device,
    modifiers: { alt: true, ctrl: true, meta: false, shift: true },
    data: { adapter: device },
    raw: options.raw,
  };
  return factory.create(options.source ?? "test", event, { includeRaw: options.raw !== undefined });
}

function pointerInput(
  kind: PointerInputKind,
  pointerId: number,
  overrides: Partial<PointerAdapterInput> = {},
): PointerAdapterInput {
  const terminal = kind === "up" || kind === "cancel";
  const input: PointerAdapterInput = {
    pointerId,
    kind,
    coordinates: { cell: { space: "cell", x: pointerId, y: 2 } },
    primary: true,
    button: kind === "down" || kind === "up" ? 0 : null,
    buttons: terminal ? 0 : kind === "wheel" ? 0 : 1,
    ...(kind === "wheel" ? { wheel: { deltaX: 0, deltaY: 1, unit: "line" as const } } : {}),
    ...overrides,
  };
  return input;
}

function pointerFixture(device: "mouse" | "touch" | "pen") {
  let now = 1;
  const factory = new InputEnvelopeFactory({ now: () => now++ });
  return (kind: PointerInputKind, pointerId: number): PointerInputEvent => {
    const envelope = pointerEnvelope(factory, device, kind);
    const input = pointerInput(
      kind,
      pointerId,
      device === "pen" ? { pressure: kind === "up" || kind === "cancel" ? 0 : 0.5, tiltX: 0, tiltY: 0, twist: 0 } : {},
    );
    if (device === "mouse") return adaptMousePointer(envelope, input);
    if (device === "touch") return adaptTouchPointer(envelope, input);
    return adaptPenPointer(envelope, input);
  };
}

function mousePress(
  overrides: Partial<Omit<MousePressEvent, "key" | "buffer">> & { buffer?: Uint8Array } = {},
): MousePressEvent {
  return {
    key: "mouse",
    buffer: overrides.buffer ?? new TextEncoder().encode("\u001b[3"),
    x: 1,
    y: 1,
    movementX: 0,
    movementY: 0,
    meta: false,
    ctrl: false,
    shift: false,
    drag: false,
    release: false,
    button: 0,
    ...overrides,
  };
}

function mouseScroll(
  scroll: MouseScrollEvent["scroll"],
  overrides: Partial<Omit<MouseScrollEvent, "key" | "buffer" | "scroll">> & { buffer?: Uint8Array } = {},
): MouseScrollEvent {
  return {
    key: "mouse",
    buffer: overrides.buffer ?? new Uint8Array(),
    x: 1,
    y: 1,
    movementX: 0,
    movementY: 0,
    meta: false,
    ctrl: false,
    shift: false,
    drag: false,
    scroll,
    ...overrides,
  };
}

function assertPointerError(action: () => unknown, code: PointerInputError["code"]): void {
  const error = assertThrows(action, PointerInputError);
  assertEquals(error.code, code);
}
