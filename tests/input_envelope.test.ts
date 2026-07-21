import { assertEquals, assertNotStrictEquals, assertThrows } from "./deps.ts";
import {
  adaptRemoteInput,
  adaptTerminalInput,
  INPUT_ENVELOPE_SCHEMA_VERSION,
  type InputEnvelope,
  InputEnvelopeError,
  InputEnvelopeFactory,
  normalizeInputEnvelope,
  parseInputEnvelope,
  serializeInputEnvelope,
} from "../src/input_envelope.ts";
import type { InputEvent, KeyPressEvent } from "../src/input_reader/types.ts";

Deno.test("terminal browser remote and test adapters emit one canonical structural shape", () => {
  let now = 100;
  const factory = new InputEnvelopeFactory({ now: () => now++ });
  const key = keyEvent("a", { ctrl: true, shift: true });
  const envelopes = [
    factory.terminal(key),
    factory.browser(key),
    factory.remote({ kind: "keyPress", event: key }),
    factory.test(key),
  ];

  const structuralKeys = [
    "schemaVersion",
    "sequence",
    "timestamp",
    "source",
    "device",
    "trust",
    "modifiers",
    "kind",
    "data",
  ];
  assertEquals(envelopes.map((envelope) => Object.keys(envelope)), [
    structuralKeys,
    structuralKeys,
    structuralKeys,
    structuralKeys,
  ]);
  assertEquals(envelopes.map((envelope) => envelope.schemaVersion), [1, 1, 1, 1]);
  assertEquals(envelopes.map((envelope) => envelope.sequence), [1, 2, 3, 4]);
  assertEquals(envelopes.map((envelope) => envelope.timestamp), [100, 101, 102, 103]);
  assertEquals(envelopes.map((envelope) => envelope.source), ["terminal", "browser", "remote", "test"]);
  assertEquals(envelopes.map((envelope) => envelope.device), ["keyboard", "keyboard", "keyboard", "keyboard"]);
  assertEquals(envelopes.map((envelope) => envelope.trust), ["trusted", "trusted", "untrusted", "synthetic"]);
  assertEquals(envelopes.map((envelope) => envelope.kind), ["key", "key", "key", "key"]);
  assertEquals(envelopes[0]!.modifiers, { alt: false, ctrl: true, meta: false, shift: true });
  assertEquals(envelopes[0]!.data, { key: "a" });
  assertEquals(envelopes.every((envelope) => envelope.raw === undefined), true);
  assertEquals(envelopes.every(Object.isFrozen), true);
  assertEquals(envelopes.every((envelope) => Object.isFrozen(envelope.modifiers)), true);
});

Deno.test("source adapters preserve semantic fields while raw protocol bytes remain opt-in", () => {
  const buffer = new Uint8Array([0, 255, 1]);
  const event = keyEvent("return", { meta: true, buffer });
  const factory = new InputEnvelopeFactory({ now: () => 1 });

  const privateByDefault = factory.terminal(event);
  assertEquals(privateByDefault.data, { key: "return" });
  assertEquals(privateByDefault.raw, undefined);
  assertEquals(serializeInputEnvelope(privateByDefault).includes("buffer"), false);
  assertEquals(serializeInputEnvelope(privateByDefault).includes("AP8B"), false);

  const withRaw = factory.terminal(event, { includeRaw: true });
  assertEquals(withRaw.data, { key: "return" });
  assertEquals(withRaw.raw, { encoding: "base64", data: "AP8B" });
  buffer.fill(7);
  assertEquals(withRaw.raw, { encoding: "base64", data: "AP8B" });
  assertEquals(Object.isFrozen(withRaw.raw), true);

  const adaptedWithoutRaw = adaptTerminalInput(event);
  const adaptedWithRaw = adaptTerminalInput(event, { includeRaw: true });
  assertEquals(adaptedWithoutRaw.raw, undefined);
  assertNotStrictEquals(adaptedWithRaw.raw, event.buffer);
});

Deno.test("remote trust is conservative by default and requires an explicit upgrade", () => {
  const event = keyEvent("a");
  const factory = new InputEnvelopeFactory({ now: () => 1 });
  const remote = factory.remote({ kind: "keyPress", event });
  const authenticated = factory.remote({ kind: "keyPress", event }, { trust: "trusted" });
  const local = factory.terminal(event);

  assertEquals(remote.trust, "untrusted");
  assertEquals(authenticated.trust, "trusted");
  assertEquals(local.trust, "trusted");
  assertEquals(
    assertThrows(
      () =>
        adaptRemoteInput(
          {
            kind: "paste",
            event,
          } as unknown as Parameters<typeof adaptRemoteInput>[0],
        ),
      InputEnvelopeError,
    ).code,
    "invalid-value",
  );
});

Deno.test("semantic adapters normalize key pointer scroll paste and focus events", () => {
  let now = 0;
  const factory = new InputEnvelopeFactory({ now: () => now++ });
  const events: InputEvent[] = [
    keyEvent("x", { ctrl: true }),
    {
      key: "mouse",
      buffer: new Uint8Array(),
      x: 4,
      y: 5,
      movementX: 1,
      movementY: -1,
      meta: false,
      ctrl: false,
      shift: true,
      drag: false,
      release: false,
      button: 0,
    },
    {
      key: "mouse",
      buffer: new Uint8Array(),
      x: 4,
      y: 5,
      movementX: 0,
      movementY: -3,
      meta: false,
      ctrl: false,
      shift: false,
      drag: false,
      scroll: -1,
    },
    { key: "paste", text: "hello", buffer: new Uint8Array() },
    { key: "focus", focused: false, buffer: new Uint8Array() },
  ];
  const envelopes = events.map((event) => factory.terminal(event));

  assertEquals(envelopes.map((envelope) => envelope.kind), ["key", "pointer", "scroll", "paste", "focus"]);
  assertEquals(envelopes.map((envelope) => envelope.device), [
    "keyboard",
    "mouse",
    "mouse",
    "clipboard",
    "window",
  ]);
  assertEquals(envelopes[1]!.data, {
    button: 0,
    drag: false,
    movementX: 1,
    movementY: -1,
    phase: "down",
    x: 4,
    y: 5,
  });
  assertEquals(envelopes[2]!.data, {
    direction: -1,
    drag: false,
    movementX: 0,
    movementY: -3,
    x: 4,
    y: 5,
  });
  assertEquals(envelopes[3]!.data, { text: "hello" });
  assertEquals(envelopes[4]!.data, { focused: false });
});

Deno.test("factory sequences strictly increase and regressing clocks clamp nondecreasing", () => {
  const times = [10, 4, 4, 12];
  const factory = new InputEnvelopeFactory({
    initialSequence: 40,
    now: () => times.shift()!,
  });
  const emitted = ["a", "b", "c", "d"].map((key) => factory.test(keyEvent(key as KeyPressEvent["key"])));

  assertEquals(emitted.map((envelope) => envelope.sequence), [40, 41, 42, 43]);
  assertEquals(emitted.map((envelope) => envelope.timestamp), [10, 10, 10, 12]);
  assertEquals(factory.inspect(), {
    schemaVersion: 1,
    emitted: 4,
    exhausted: false,
    nextSequence: 44,
    lastSequence: 43,
    lastTimestamp: 12,
    sequenceOverflowPolicy: "throw",
    limits: {
      maxBytes: 65_536,
      maxDepth: 16,
      maxNodes: 4_096,
      maxRawBytes: 4_096,
    },
  });
});

Deno.test("clock failures and rejected payloads do not consume factory state", () => {
  let now = Number.NaN;
  const factory = new InputEnvelopeFactory({ now: () => now });
  const clockError = assertThrows(() => factory.test(keyEvent("a")), InputEnvelopeError);
  assertEquals(clockError.code, "clock-failed");
  assertEquals(factory.inspect().nextSequence, 1);
  assertEquals(factory.inspect().emitted, 0);

  now = 5;
  const payloadError = assertThrows(
    () =>
      factory.create("test", {
        kind: "text",
        device: "keyboard",
        data: { value: Number.POSITIVE_INFINITY },
      }),
    InputEnvelopeError,
  );
  assertEquals(payloadError.code, "invalid-value");
  assertEquals(factory.inspect().nextSequence, 1);
  assertEquals(factory.inspect().emitted, 0);
  assertEquals(factory.test(keyEvent("a")).sequence, 1);
});

Deno.test("sequence exhaustion throws before a duplicate or unsafe integer can be emitted", () => {
  let clockCalls = 0;
  const factory = new InputEnvelopeFactory({
    initialSequence: Number.MAX_SAFE_INTEGER,
    sequenceOverflowPolicy: "throw",
    now: () => ++clockCalls,
  });
  const last = factory.test(keyEvent("a"));
  assertEquals(last.sequence, Number.MAX_SAFE_INTEGER);
  assertEquals(factory.inspect().exhausted, true);

  const overflow = assertThrows(() => factory.test(keyEvent("b")), InputEnvelopeError);
  assertEquals(overflow.code, "sequence-overflow");
  assertEquals(clockCalls, 1);
  assertEquals(factory.inspect().emitted, 1);
  assertEquals(
    assertThrows(
      () => new InputEnvelopeFactory({ initialSequence: Number.MAX_SAFE_INTEGER + 1, now: () => 0 }),
      InputEnvelopeError,
    ).code,
    "invalid-value",
  );
});

Deno.test("normalization clones deeply and freezes modifiers semantic data and arrays", () => {
  const nested = { z: [{ value: 1 }], a: "first" };
  const normalized = normalizeInputEnvelope({
    ...validEnvelope(),
    data: nested,
  });
  nested.a = "mutated";
  nested.z[0]!.value = 99;

  assertEquals(normalized.data, { a: "first", z: [{ value: 1 }] });
  assertEquals(Object.isFrozen(normalized), true);
  assertEquals(Object.isFrozen(normalized.modifiers), true);
  assertEquals(Object.isFrozen(normalized.data), true);
  assertEquals(Object.isFrozen(normalized.data!.z), true);
  assertEquals(Object.isFrozen((normalized.data!.z as readonly unknown[])[0]), true);
  assertThrows(() => {
    (normalized.modifiers as unknown as { ctrl: boolean }).ctrl = true;
  });
  assertThrows(() => {
    (normalized.data!.z as unknown as unknown[]).push(2);
  });
});

Deno.test("canonical serialization is deterministic and round trips without shape drift", () => {
  const normalized = normalizeInputEnvelope({
    ...validEnvelope(),
    data: {
      z: 1,
      a: { y: 2, b: [true, null, "x"] },
    },
    raw: { data: "AP8B", encoding: "base64" },
  });
  const serialized = serializeInputEnvelope(normalized);

  assertEquals(
    serialized,
    '{"schemaVersion":1,"sequence":7,"timestamp":12.5,"source":"terminal","device":"keyboard","trust":"trusted","modifiers":{"alt":false,"ctrl":false,"meta":false,"shift":false},"kind":"key","data":{"a":{"b":[true,null,"x"],"y":2},"z":1},"raw":{"encoding":"base64","data":"AP8B"}}',
  );
  const parsed = parseInputEnvelope(serialized);
  assertEquals(parsed, normalized);
  assertNotStrictEquals(parsed, normalized);
  assertEquals(serializeInputEnvelope(parsed), serialized);
  assertEquals(JSON.parse(serialized), parsed);
});

Deno.test("strict schema rejects versions unknown fields and malformed raw payloads", () => {
  const extra = { ...validEnvelope(), privateToken: "nope" };
  assertEquals(errorCode(() => normalizeInputEnvelope(extra)), "unknown-field");
  assertEquals(
    errorCode(() => normalizeInputEnvelope({ ...validEnvelope(), schemaVersion: 2 })),
    "unsupported-version",
  );
  assertEquals(
    errorCode(() =>
      normalizeInputEnvelope({
        ...validEnvelope(),
        modifiers: { alt: false, ctrl: false, meta: false, shift: false, super: true },
      })
    ),
    "unknown-field",
  );
  assertEquals(
    errorCode(() =>
      normalizeInputEnvelope({
        ...validEnvelope(),
        raw: { encoding: "base64", data: "not base64" },
      })
    ),
    "invalid-value",
  );
  assertEquals(
    errorCode(() =>
      normalizeInputEnvelope({
        ...validEnvelope(),
        raw: { encoding: "base64", data: "AA==", mime: "secret" },
      })
    ),
    "unknown-field",
  );
  assertEquals(errorCode(() => parseInputEnvelope("{")), "invalid-shape");
});

Deno.test("hostile JSON values reject cycles accessors exotics sparse arrays symbols and nonfinite numbers", () => {
  const cycle: Record<string, unknown> = {};
  cycle.self = cycle;
  assertEquals(errorCode(() => normalizeInputEnvelope({ ...validEnvelope(), data: cycle })), "invalid-value");

  let getterRuns = 0;
  const accessor: Record<string, unknown> = {};
  Object.defineProperty(accessor, "secret", {
    enumerable: true,
    get() {
      getterRuns += 1;
      return "leak";
    },
  });
  assertEquals(errorCode(() => normalizeInputEnvelope({ ...validEnvelope(), data: accessor })), "invalid-shape");
  assertEquals(getterRuns, 0);

  const sparse: unknown[] = [];
  sparse.length = 2;
  sparse[1] = "present";
  const symbolData = { ok: true } as Record<PropertyKey, unknown>;
  symbolData[Symbol("hidden")] = true;
  const hostile = [
    { date: new Date(0) },
    { sparse },
    symbolData,
    { nan: Number.NaN },
    { bigint: 1n },
  ];
  for (const data of hostile) {
    assertThrows(
      () => normalizeInputEnvelope({ ...validEnvelope(), data }),
      InputEnvelopeError,
    );
  }
});

Deno.test("prototype-pollution keys fail closed without mutating object prototypes", () => {
  const serialized = JSON.stringify(validEnvelope()).replace(
    '"kind":"key"',
    '"kind":"key","data":{"__proto__":{"polluted":true}}',
  );
  assertEquals(errorCode(() => parseInputEnvelope(serialized)), "invalid-value");
  assertEquals(({} as { polluted?: boolean }).polluted, undefined);

  const nullPrototype = Object.create(null) as Record<string, unknown>;
  nullPrototype.safe = true;
  assertEquals(normalizeInputEnvelope({ ...validEnvelope(), data: nullPrototype }).data, { safe: true });
  const exotic = Object.create({ inherited: true }) as Record<string, unknown>;
  exotic.safe = true;
  assertEquals(
    errorCode(() => normalizeInputEnvelope({ ...validEnvelope(), data: exotic })),
    "invalid-shape",
  );
});

Deno.test("byte depth node and raw limits fail before factory sequence commit", () => {
  const rawFactory = new InputEnvelopeFactory({
    now: () => 1,
    limits: { maxRawBytes: 2 },
  });
  assertEquals(
    errorCode(() =>
      rawFactory.terminal(keyEvent("a", { buffer: new Uint8Array([1, 2, 3]) }), {
        includeRaw: true,
      })
    ),
    "limit-exceeded",
  );
  assertEquals(rawFactory.inspect().nextSequence, 1);

  assertEquals(
    errorCode(() => normalizeInputEnvelope({ ...validEnvelope(), data: { a: { b: 1 } } }, { maxDepth: 1 })),
    "limit-exceeded",
  );
  assertEquals(
    errorCode(() => normalizeInputEnvelope({ ...validEnvelope(), data: { a: 1, b: 2 } }, { maxNodes: 2 })),
    "limit-exceeded",
  );
  assertEquals(
    errorCode(() =>
      normalizeInputEnvelope({ ...validEnvelope(), data: { text: "x".repeat(1_000) } }, { maxBytes: 200 })
    ),
    "limit-exceeded",
  );
});

Deno.test("factory inspection is frozen defensive state without global sequence sharing", () => {
  const left = new InputEnvelopeFactory({ now: () => 1 });
  const right = new InputEnvelopeFactory({ now: () => 2 });
  assertEquals(left.test(keyEvent("a")).sequence, 1);
  assertEquals(right.test(keyEvent("b")).sequence, 1);

  const inspection = left.inspect();
  assertEquals(Object.isFrozen(inspection), true);
  assertEquals(Object.isFrozen(inspection.limits), true);
  assertThrows(() => {
    (inspection.limits as unknown as { maxBytes: number }).maxBytes = 1;
  });
  assertNotStrictEquals(left.inspect(), inspection);
  assertEquals(left.inspect().limits.maxBytes, 65_536);
  assertEquals(INPUT_ENVELOPE_SCHEMA_VERSION, 1);
});

function validEnvelope(): InputEnvelope {
  return {
    schemaVersion: 1,
    sequence: 7,
    timestamp: 12.5,
    source: "terminal",
    device: "keyboard",
    trust: "trusted",
    modifiers: { alt: false, ctrl: false, meta: false, shift: false },
    kind: "key",
  };
}

function keyEvent(
  key: KeyPressEvent["key"],
  options: Partial<Omit<KeyPressEvent, "key">> = {},
): KeyPressEvent {
  return {
    key,
    ctrl: options.ctrl ?? false,
    meta: options.meta ?? false,
    shift: options.shift ?? false,
    buffer: options.buffer ?? new Uint8Array(),
  } as KeyPressEvent;
}

function errorCode(callback: () => unknown): InputEnvelopeError["code"] {
  return assertThrows(callback, InputEnvelopeError).code;
}
