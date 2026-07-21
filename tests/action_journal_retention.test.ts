import { assertEquals, assertNotEquals, assertThrows } from "./deps.ts";
import { ActionJournal, canonicalActionJournalJson } from "../src/app/action_journal.ts";
import {
  ActionJournalCheckpointRegistry,
  canonicalActionJournalCheckpointJson,
} from "../src/app/action_journal_checkpoints.ts";
import {
  actionJournalRetentionCheckpointId,
  actionJournalRetentionCompatibilityFromInspection,
  ActionJournalRetentionError,
  canonicalActionJournalUtf8Bytes,
  executeActionJournalRetention,
  planActionJournalRetention,
  retainActionJournal,
} from "../src/app/action_journal_retention.ts";

type CounterAction = { amount: number; label?: string; type: "add" } | { type: "reset" };

interface CounterState {
  log: string[];
  total: number;
}

const INITIAL: CounterState = { log: [], total: 0 };

function reducer(state: Readonly<CounterState>, action: Readonly<CounterAction>): CounterState {
  return action.type === "reset" ? { log: [...state.log, "reset"], total: 0 } : {
    log: [...state.log, action.label ?? String(action.amount)],
    total: state.total + action.amount,
  };
}

function journalWithTimestamps(
  timestamps: readonly number[],
  journalId = "retention",
  label = "entry",
): ActionJournal<CounterAction> {
  const journal = new ActionJournal<CounterAction>({ journalId, now: () => 0 });
  for (let index = 0; index < timestamps.length; index += 1) {
    journal.append({ type: "add", amount: index + 1, label: `${label}-${index + 1}` }, {
      timestamp: timestamps[index],
    });
  }
  return journal;
}

function checkpointRegistry(
  schemaVersion = 1,
): ActionJournalCheckpointRegistry<CounterState, CounterAction> {
  const registry = new ActionJournalCheckpointRegistry<CounterState, CounterAction>();
  registry.register({
    componentId: "counter",
    schemaVersion,
    capture: (state) => state.total,
    restore: (state, total) => ({ ...state, total }),
  });
  registry.register({
    componentId: "log",
    schemaVersion,
    capture: (state) => state.log,
    restore: (state, log) => ({ ...state, log: [...log] }),
  });
  return registry;
}

function compatibility(registry: ActionJournalCheckpointRegistry<CounterState, CounterAction>) {
  return actionJournalRetentionCompatibilityFromInspection(registry.inspect().components);
}

Deno.test("entry-count retention selects a replay-safe checkpoint tail without mutating sources", () => {
  const journal = journalWithTimestamps([10, 20, 30, 40, 50, 60]);
  const registry = checkpointRegistry();
  const early = registry.captureFromReplay(journal.snapshot(), INITIAL, reducer, { revision: 2 });
  const middle = registry.captureFromReplay(journal.snapshot(), INITIAL, reducer, { revision: 4 });
  const selectedCheckpoint = registry.captureFromReplay(journal.snapshot(), INITIAL, reducer, { revision: 5 });
  const sourceBytes = canonicalActionJournalJson(journal.snapshot());

  const plan = planActionJournalRetention({
    journal: journal.snapshot(),
    checkpoints: [early, selectedCheckpoint, middle],
    compatibleComponents: compatibility(registry),
    policy: { maxEntryCount: 2 },
  });
  const result = executeActionJournalRetention(plan);
  const full = journal.replay(INITIAL, reducer);
  const checkpointReplay = registry.replay(
    result.bundle.journal,
    result.bundle.checkpoints,
    INITIAL,
    reducer,
  );

  assertEquals(plan.status, "ready");
  assertEquals(plan.before.entryCount, 6);
  assertEquals(plan.after.entryCount, 1);
  assertEquals(plan.after.baseRevision, 5);
  assertEquals(plan.after.firstRevision, 6);
  assertEquals(plan.after.lastRevision, 6);
  assertEquals(plan.appliedReasons, ["max-entry-count"]);
  assertEquals(plan.droppedEntryIds, [
    "retention@1",
    "retention@2",
    "retention@3",
    "retention@4",
    "retention@5",
  ]);
  assertEquals(plan.droppedCheckpointIds, [
    actionJournalRetentionCheckpointId(early),
    actionJournalRetentionCheckpointId(middle),
  ]);
  assertEquals(result.applied, true);
  assertEquals(result.bundle.journal.entries.map((entry) => entry.revision), [6]);
  assertEquals(result.bundle.checkpoints[0]?.baseRevision, 5);
  assertEquals(result.bundle.checkpoints[0]?.revision, 5);
  assertEquals(result.bundle.checkpoints[0]?.stateHash, selectedCheckpoint.stateHash);
  assertEquals(checkpointReplay.appliedCount, result.bundle.journal.entries.length);
  assertEquals(checkpointReplay.serializedState, full.serializedState);
  assertEquals(canonicalActionJournalJson(journal.snapshot()), sourceBytes);
  assertEquals(Object.isFrozen(plan), true);
  assertEquals(Object.isFrozen(result.bundle.journal), true);
  assertEquals(JSON.parse(JSON.stringify(result)), result);
});

Deno.test("canonical UTF-8 byte limits use TextEncoder and accept exact boundaries", () => {
  const journal = journalWithTimestamps(
    [1, 2, 3, 4],
    "unicode-retention",
    "界🙂".repeat(100),
  );
  const registry = new ActionJournalCheckpointRegistry<CounterState, CounterAction>();
  registry.register({
    componentId: "counter",
    schemaVersion: 1,
    capture: (state) => state.total,
    restore: (state, total) => ({ ...state, total }),
  });
  const second = registry.captureFromReplay(journal.snapshot(), INITIAL, reducer, { revision: 2 });
  const third = registry.captureFromReplay(journal.snapshot(), INITIAL, reducer, { revision: 3 });
  const components = compatibility(registry);
  const countPlan = planActionJournalRetention({
    journal: journal.snapshot(),
    checkpoints: [second, third],
    compatibleComponents: components,
    policy: { maxEntryCount: 1 },
  });
  const exactBytes = countPlan.after.totalBytes;
  const exact = planActionJournalRetention({
    journal: journal.snapshot(),
    checkpoints: [third, second],
    compatibleComponents: components,
    policy: { maxCanonicalBytes: exactBytes },
  });
  const tooSmall = planActionJournalRetention({
    journal: journal.snapshot(),
    checkpoints: [second, third],
    compatibleComponents: components,
    policy: { maxEntryCount: 1, maxCanonicalBytes: exactBytes - 1 },
  });

  const journalBytes = new TextEncoder().encode(canonicalActionJournalJson(exact.retained.journal)).byteLength;
  const checkpointBytes = new TextEncoder().encode(
    canonicalActionJournalCheckpointJson(exact.retained.checkpoints[0]),
  ).byteLength;
  assertEquals(exact.status, "ready");
  assertEquals(exact.after.totalBytes, exactBytes);
  assertEquals(exact.after.journalBytes, journalBytes);
  assertEquals(exact.after.checkpointBytes, checkpointBytes);
  assertEquals(exact.after.totalBytes, journalBytes + checkpointBytes);
  assertEquals(canonicalActionJournalUtf8Bytes({ text: "界🙂" }), new TextEncoder().encode('{"text":"界🙂"}').length);
  assertNotEquals(
    canonicalActionJournalUtf8Bytes({ text: "界🙂" }),
    canonicalActionJournalJson({ text: "界🙂" }).length,
  );
  assertEquals(tooSmall.status, "unsatisfied");
  assertEquals(tooSmall.after, tooSmall.before);
});

Deno.test("age retention is inclusive at the exact boundary and uses only caller time", () => {
  const journal = journalWithTimestamps([0, 10, 20, 30], "age-retention");
  const registry = checkpointRegistry();
  const first = registry.captureFromReplay(journal.snapshot(), INITIAL, reducer, { revision: 1 });
  const second = registry.captureFromReplay(journal.snapshot(), INITIAL, reducer, { revision: 2 });
  const plan = planActionJournalRetention({
    journal: journal.snapshot(),
    checkpoints: [first, second],
    compatibleComponents: compatibility(registry),
    policy: { maxAge: 20, referenceTimestamp: 40 },
  });

  assertEquals(plan.status, "ready");
  assertEquals(plan.after.baseRevision, 2);
  assertEquals(plan.retained.journal.entries.map((entry) => entry.timestamp), [20, 30]);
  assertEquals(plan.appliedReasons, ["max-age"]);
  assertEquals(
    assertThrows(
      () =>
        planActionJournalRetention({
          journal: journal.snapshot(),
          policy: { maxAge: 20 },
        }),
      ActionJournalRetentionError,
    ).code,
    "invalid-policy",
  );
});

Deno.test("all retention constraints compose and report every applied reason", () => {
  const journal = journalWithTimestamps([10, 20, 30, 40, 50, 60], "combined-retention", "界");
  const registry = checkpointRegistry();
  const fourth = registry.captureFromReplay(journal.snapshot(), INITIAL, reducer, { revision: 4 });
  const fifth = registry.captureFromReplay(journal.snapshot(), INITIAL, reducer, { revision: 5 });
  const countPlan = planActionJournalRetention({
    journal: journal.snapshot(),
    checkpoints: [fourth, fifth],
    compatibleComponents: compatibility(registry),
    policy: { maxEntryCount: 1 },
  });
  const exactBytes = countPlan.after.totalBytes;
  const combined = retainActionJournal({
    journal: journal.snapshot(),
    checkpoints: [fourth, fifth],
    compatibleComponents: compatibility(registry),
    policy: {
      maxEntryCount: 1,
      maxCanonicalBytes: exactBytes,
      maxAge: 40,
      referenceTimestamp: 100,
    },
  });

  assertEquals(combined.status, "ready");
  assertEquals(combined.bundle.journal.baseRevision, 5);
  assertEquals(combined.bundle.journal.entries.map((entry) => entry.revision), [6]);
  assertEquals(combined.after.totalBytes, exactBytes);
  assertEquals(combined.appliedReasons, ["max-entry-count", "max-canonical-bytes", "max-age"]);
});

Deno.test("missing or causally unsafe checkpoints fail closed instead of stranding replay", () => {
  const withoutCheckpoint = journalWithTimestamps([1, 2, 3], "no-checkpoint");
  const missing = planActionJournalRetention({
    journal: withoutCheckpoint.snapshot(),
    policy: { maxEntryCount: 1 },
  });
  assertEquals(missing.status, "unsatisfied");
  assertEquals(missing.after, missing.before);
  assertEquals(missing.retained, missing.source);
  assertEquals(missing.droppedEntryIds, []);
  assertEquals(missing.unsatisfiedConstraints.map((constraint) => constraint.constraint), [
    "max-entry-count",
    "replay-safety",
  ]);

  const causal = new ActionJournal<CounterAction>({ journalId: "causal", now: () => 1 });
  causal.append({ type: "add", amount: 1 });
  causal.append({ type: "add", amount: 2 });
  causal.append({ type: "add", amount: 3 }, { parentRevision: 0 });
  const registry = checkpointRegistry();
  const checkpoint = registry.captureFromReplay(causal.snapshot(), INITIAL, reducer, { revision: 2 });
  const unsafe = planActionJournalRetention({
    journal: causal.snapshot(),
    checkpoints: [checkpoint],
    compatibleComponents: compatibility(registry),
    policy: { maxEntryCount: 1 },
  });
  assertEquals(unsafe.status, "unsatisfied");
  assertEquals(unsafe.retained.journal.entries.length, 3);
  assertEquals(unsafe.unsatisfiedConstraints.at(-1)?.constraint, "replay-safety");
});

Deno.test("clock regression is explicit, deterministic, and preserves the source bundle", () => {
  const journal = journalWithTimestamps([10, 5], "regressed-clock");
  const registry = checkpointRegistry();
  const checkpoint = registry.captureFromReplay(journal.snapshot(), INITIAL, reducer, { revision: 1 });
  const plan = planActionJournalRetention({
    journal: journal.snapshot(),
    checkpoints: [checkpoint],
    compatibleComponents: compatibility(registry),
    policy: { maxAge: 4, referenceTimestamp: 20 },
  });
  const futureReference = planActionJournalRetention({
    journal: journalWithTimestamps([10], "future-clock").snapshot(),
    policy: { maxAge: 20, referenceTimestamp: 9 },
  });

  assertEquals(plan.status, "unsatisfied");
  assertEquals(plan.unsatisfiedConstraints, [{
    constraint: "clock-regression",
    message: "age retention requires nondecreasing entry timestamps not later than the reference timestamp",
    actual: 5,
    limit: 20,
  }]);
  assertEquals(plan.after, plan.before);
  assertEquals(futureReference.status, "unsatisfied");
  assertEquals(futureReference.unsatisfiedConstraints[0]?.constraint, "clock-regression");
});

Deno.test("empty journals are stable and single oversize entries or checkpoints fail closed", () => {
  const empty = new ActionJournal<CounterAction>({ journalId: "empty" });
  const emptyPlan = planActionJournalRetention({
    journal: empty.snapshot(),
    policy: { maxEntryCount: 0, maxAge: 0, referenceTimestamp: 0 },
  });
  assertEquals(emptyPlan.status, "unchanged");
  assertEquals(emptyPlan.before.entryCount, 0);
  assertEquals(emptyPlan.before.totalBytes, canonicalActionJournalUtf8Bytes(empty.snapshot()));

  const large = journalWithTimestamps([1], "oversize-entry", "🙂".repeat(500));
  const noCheckpoint = planActionJournalRetention({
    journal: large.snapshot(),
    policy: { maxCanonicalBytes: canonicalActionJournalUtf8Bytes(empty.snapshot()) },
  });
  assertEquals(noCheckpoint.status, "unsatisfied");
  assertEquals(noCheckpoint.retained.journal.entries.length, 1);

  const registry = checkpointRegistry();
  const oversizedCheckpoint = registry.capture(
    large.snapshot(),
    { total: 1, log: ["state".repeat(500)] },
    { revision: 1 },
  );
  const emptyTailBytes = canonicalActionJournalUtf8Bytes({
    schemaVersion: 1,
    journalId: "oversize-entry",
    baseRevision: 1,
    entries: [],
  });
  const checkpointBytes = new TextEncoder().encode(
    canonicalActionJournalCheckpointJson(oversizedCheckpoint),
  ).byteLength;
  const tooSmall = planActionJournalRetention({
    journal: large.snapshot(),
    checkpoints: [oversizedCheckpoint],
    compatibleComponents: compatibility(registry),
    policy: { maxEntryCount: 0, maxCanonicalBytes: emptyTailBytes + checkpointBytes - 1 },
  });
  assertEquals(tooSmall.status, "unsatisfied");
  assertEquals(tooSmall.retained.journal.entries.length, 1);
  assertEquals(tooSmall.droppedCheckpointIds, []);
});

Deno.test("competing checkpoints are selected deterministically by retained data then bytes", () => {
  const journal = journalWithTimestamps([1, 2, 3, 4], "competing");
  const registry = checkpointRegistry();
  const small = registry.captureFromReplay(journal.snapshot(), INITIAL, reducer, { revision: 3 });
  const large = registry.capture(
    journal.snapshot(),
    { total: 999, log: ["large".repeat(500)] },
    { revision: 3 },
  );
  const components = compatibility(registry);
  const left = planActionJournalRetention({
    journal: journal.snapshot(),
    checkpoints: [large, small],
    compatibleComponents: components,
    policy: { maxEntryCount: 1 },
  });
  const right = planActionJournalRetention({
    journal: journal.snapshot(),
    checkpoints: [small, large],
    compatibleComponents: components,
    policy: { maxEntryCount: 1 },
  });

  assertEquals(left.status, "ready");
  assertEquals(left.retained.checkpoints[0]?.stateHash, small.stateHash);
  assertEquals(
    actionJournalRetentionCheckpointId(left.retained.checkpoints[0]),
    actionJournalRetentionCheckpointId(right.retained.checkpoints[0]),
  );
  assertEquals(left.after, right.after);
});

Deno.test("checkpoint migration compatibility is explicit and retains byte-identical replay", () => {
  const journal = journalWithTimestamps([1, 2, 3], "migration-retention");
  const oldRegistry = checkpointRegistry(1);
  const oldCheckpoint = oldRegistry.captureFromReplay(journal.snapshot(), INITIAL, reducer, { revision: 2 });

  const current = new ActionJournalCheckpointRegistry<CounterState, CounterAction>();
  current.register({
    componentId: "counter",
    schemaVersion: 2,
    capture: (state) => ({ total: state.total }),
    restore: (state, data) => ({ ...state, total: data.total }),
    migrations: [{
      fromSchemaVersion: 1,
      migrate: (data) => {
        if (typeof data !== "number") throw new Error("invalid counter v1");
        return { total: data };
      },
    }],
  });
  current.register({
    componentId: "log",
    schemaVersion: 2,
    capture: (state) => ({ entries: state.log }),
    restore: (state, data) => ({ ...state, log: [...data.entries] }),
    migrations: [{
      fromSchemaVersion: 1,
      migrate: (data) => {
        if (!Array.isArray(data) || !data.every((entry) => typeof entry === "string")) {
          throw new Error("invalid log v1");
        }
        return { entries: data as string[] };
      },
    }],
  });

  const withoutMigration = planActionJournalRetention({
    journal: journal.snapshot(),
    checkpoints: [oldCheckpoint],
    compatibleComponents: current.inspect().components.map((component) => ({
      componentId: component.componentId,
      schemaVersions: [component.schemaVersion],
    })),
    policy: { maxEntryCount: 1 },
  });
  const withMigration = planActionJournalRetention({
    journal: journal.snapshot(),
    checkpoints: [oldCheckpoint],
    compatibleComponents: compatibility(current),
    policy: { maxEntryCount: 1 },
  });
  const replayed = current.replay(
    withMigration.retained.journal,
    withMigration.retained.checkpoints,
    INITIAL,
    reducer,
  );

  assertEquals(withoutMigration.status, "unsatisfied");
  assertEquals(withMigration.status, "ready");
  assertEquals(withMigration.retained.journal.entries.map((entry) => entry.revision), [3]);
  assertEquals(replayed.appliedCount, 1);
  assertEquals(replayed.serializedState, journal.replay(INITIAL, reducer).serializedState);
});
