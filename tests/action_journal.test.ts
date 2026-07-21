import { assertEquals, assertNotStrictEquals, assertThrows } from "./deps.ts";
import {
  ActionJournal,
  ActionJournalError,
  canonicalActionJournalJson,
  normalizeActionJournalSnapshot,
  parseActionJournal,
  replayActionJournal,
} from "../src/app/action_journal.ts";

type CounterAction = { amount: number; type: "add" } | { type: "reset" };

Deno.test("action journal assigns contiguous revisions and explicit causal metadata", () => {
  let now = 40;
  const journal = new ActionJournal<CounterAction>({ journalId: "counter", baseRevision: 9, now: () => now++ });
  const mutable: CounterAction = { type: "add", amount: 2 };
  const first = journal.append(mutable, { correlationId: "request-1", source: "keyboard" });
  mutable.amount = 99;
  const second = journal.append({ type: "reset" }, { parentRevision: 9, metadata: { reason: "test" } });

  assertEquals(first, {
    revision: 10,
    timestamp: 40,
    action: { amount: 2, type: "add" },
    causality: { parentRevision: 9, correlationId: "request-1", source: "keyboard" },
  });
  assertEquals(second.revision, 11);
  assertEquals(second.causality.parentRevision, 9);
  assertEquals(journal.inspect(), {
    schemaVersion: 1,
    journalId: "counter",
    baseRevision: 9,
    nextRevision: 12,
    entryCount: 2,
    firstRevision: 10,
    lastRevision: 11,
    correlationIds: ["request-1"],
    sources: ["keyboard"],
  });
  assertEquals(Object.isFrozen(first), true);
  assertThrows(() => journal.append({ type: "reset" }, { parentRevision: 12 }), ActionJournalError);
});

Deno.test("action journal rejects revision exhaustion without mutating usable state", () => {
  let clockCalls = 0;
  const journal = new ActionJournal({
    journalId: "exhausted",
    baseRevision: Number.MAX_SAFE_INTEGER,
    now: () => {
      clockCalls += 1;
      return 1;
    },
  });
  const beforeSnapshot = journal.snapshot();
  const beforeInspection = journal.inspect();
  const beforeSerialized = journal.serialize();

  const error = assertThrows(() => journal.append({ type: "never" }), ActionJournalError);

  assertEquals(error.code, "invalid-revision");
  assertEquals(error.path, "$.revision");
  assertEquals(clockCalls, 0);
  assertEquals(journal.size, 0);
  assertEquals(journal.snapshot(), beforeSnapshot);
  assertEquals(journal.inspect(), beforeInspection);
  assertEquals(journal.serialize(), beforeSerialized);
});

Deno.test("action journal canonical serialization ignores object insertion order", () => {
  const left = new ActionJournal({ journalId: "stable", now: () => 1 });
  const right = new ActionJournal({ journalId: "stable", now: () => 1 });
  left.append({ z: 1, nested: { b: 2, a: 1 }, a: 0 });
  right.append({ a: 0, nested: { a: 1, b: 2 }, z: 1 });

  assertEquals(left.serialize(), right.serialize());
  assertEquals(canonicalActionJournalJson({ z: 1, a: [3, { y: 2, x: 1 }] }), '{"a":[3,{"x":1,"y":2}],"z":1}');
  assertEquals(
    canonicalActionJournalJson(JSON.parse('{"__proto__":{"safe":true},"a":1}')),
    '{"__proto__":{"safe":true},"a":1}',
  );
});

Deno.test("action journal snapshots and parsed entries are immutable clones", () => {
  const journal = new ActionJournal<{ nested: { value: number } }>({ journalId: "clone", now: () => 2 });
  journal.append({ nested: { value: 1 } });
  const first = journal.snapshot();
  const second = parseActionJournal<typeof first.entries[number]["action"]>(journal.serialize());

  assertNotStrictEquals(first, second);
  assertNotStrictEquals(first.entries[0], second.entries[0]);
  assertEquals(Object.isFrozen(first.entries[0]!.action), true);
  assertThrows(() => {
    (first.entries[0]!.action.nested as { value: number }).value = 8;
  }, TypeError);
  assertEquals(journal.snapshot().entries[0]!.action.nested.value, 1);
});

Deno.test("action journal rejects gaps, invalid causality, non-finite values, and cycles", () => {
  const valid = new ActionJournal<unknown>({ journalId: "validate", now: () => 0 });
  valid.append({ type: "ok" });
  const gap = JSON.parse(valid.serialize());
  gap.entries[0].revision = 2;
  assertEquals(
    assertThrows(() => normalizeActionJournalSnapshot(gap), ActionJournalError).code,
    "invalid-revision",
  );

  const causal = JSON.parse(valid.serialize());
  causal.entries[0].causality.parentRevision = 1;
  assertEquals(
    assertThrows(() => normalizeActionJournalSnapshot(causal), ActionJournalError).code,
    "invalid-causality",
  );
  assertEquals(
    assertThrows(() => valid.append({ value: Number.NaN }), ActionJournalError).code,
    "invalid-value",
  );
  const cycle: Record<string, unknown> = {};
  cycle.self = cycle;
  assertEquals(assertThrows(() => valid.append(cycle), ActionJournalError).code, "invalid-value");
  assertEquals(assertThrows(() => parseActionJournal("{"), ActionJournalError).code, "invalid-json");
});

Deno.test("action journal rejects hostile arrays without invoking accessors", () => {
  let getterRuns = 0;
  const ownAccessor = ["placeholder"];
  Object.defineProperty(ownAccessor, "0", {
    enumerable: true,
    get() {
      getterRuns += 1;
      return "leak";
    },
  });

  const inheritedAccessor: unknown[] = [];
  inheritedAccessor.length = 1;
  const inheritedPrototype = Object.create(Array.prototype);
  Object.defineProperty(inheritedPrototype, "0", {
    enumerable: true,
    get() {
      getterRuns += 1;
      return "leak";
    },
  });
  Object.setPrototypeOf(inheritedAccessor, inheritedPrototype);

  const extraProperty = [1];
  Object.defineProperty(extraProperty, "extra", { enumerable: true, value: true });
  const symbolProperty = [1];
  Object.defineProperty(symbolProperty, Symbol("hidden"), { enumerable: true, value: true });
  const nonIndexProperty = [1];
  Object.defineProperty(nonIndexProperty, "01", { enumerable: true, value: true });
  const nonEnumerableElement = [1];
  Object.defineProperty(nonEnumerableElement, "0", { enumerable: false });

  const journal = new ActionJournal<unknown>({ journalId: "hostile-arrays", now: () => 0 });
  for (
    const value of [
      ownAccessor,
      inheritedAccessor,
      extraProperty,
      symbolProperty,
      nonIndexProperty,
      nonEnumerableElement,
    ]
  ) {
    assertEquals(assertThrows(() => journal.append(value), ActionJournalError).code, "invalid-value");
    assertEquals(journal.size, 0);
  }
  assertEquals(getterRuns, 0);
});

Deno.test("action journal replay produces byte-identical state for one snapshot", () => {
  const journal = new ActionJournal<CounterAction>({ journalId: "replay", now: () => 4 });
  journal.append({ type: "add", amount: 3 });
  journal.append({ type: "add", amount: 4 });
  journal.append({ type: "reset" });
  journal.append({ type: "add", amount: 7 });
  const reducer = (state: { count: number; log: number[] }, action: Readonly<CounterAction>) =>
    action.type === "reset"
      ? { count: 0, log: [...state.log, 0] }
      : { count: state.count + action.amount, log: [...state.log, action.amount] };

  const first = journal.replay({ log: [], count: 0 }, reducer);
  const second = replayActionJournal(parseActionJournal<CounterAction>(journal.serialize()), {
    count: 0,
    log: [],
  }, reducer);
  assertEquals(first, second);
  assertEquals(first, {
    state: { count: 7, log: [3, 4, 0, 7] },
    serializedState: '{"count":7,"log":[3,4,0,7]}',
    appliedCount: 4,
    revision: 4,
  });
});

Deno.test("rehydrated action journals continue the monotonic sequence", () => {
  const original = new ActionJournal({ journalId: "resume", baseRevision: 20, now: () => 1 });
  original.append({ type: "first" });
  const restored = ActionJournal.fromSnapshot(original.snapshot(), { now: () => 2 });
  const next = restored.append({ type: "second" });

  assertEquals(next.revision, 22);
  assertEquals(next.causality.parentRevision, 21);
  assertEquals(restored.snapshot().entries.map((entry) => entry.revision), [21, 22]);
});
