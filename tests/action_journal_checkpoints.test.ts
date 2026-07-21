import { assertEquals, assertNotStrictEquals, assertThrows } from "./deps.ts";
import { ActionJournal, type ActionJournalJsonValue, replayActionJournal } from "../src/app/action_journal.ts";
import {
  ACTION_JOURNAL_CHECKPOINT_HASH_ALGORITHM,
  ACTION_JOURNAL_CHECKPOINT_SCHEMA_VERSION,
  ActionJournalCheckpointError,
  ActionJournalCheckpointRegistry,
  canonicalActionJournalCheckpointJson,
  normalizeActionJournalCheckpoint,
  parseActionJournalCheckpoint,
} from "../src/app/action_journal_checkpoints.ts";

type ModelAction =
  | { amount: number; type: "add" }
  | { type: "reset" }
  | { theme: string; type: "theme" };

interface ModelState {
  count: number;
  log: number[];
  privateToken: string;
  theme: string;
}

const INITIAL_STATE: ModelState = {
  count: 0,
  log: [],
  privateToken: "private-token-never-checkpointed",
  theme: "dark",
};

function modelReducer(state: Readonly<ModelState>, action: Readonly<ModelAction>): ModelState {
  switch (action.type) {
    case "add":
      return {
        ...state,
        count: state.count + action.amount,
        log: [...state.log, action.amount],
      };
    case "reset":
      return { ...state, count: 0, log: [...state.log, 0] };
    case "theme":
      return { ...state, theme: action.theme };
  }
}

function modelJournal(journalId = "checkpoint-model"): ActionJournal<ModelAction> {
  const journal = new ActionJournal<ModelAction>({ journalId, baseRevision: 10, now: () => 42 });
  journal.append({ type: "add", amount: 2 }, { source: "keyboard" });
  journal.append({ type: "add", amount: 3 });
  journal.append({ type: "theme", theme: "light" }, {
    correlationId: "theme-change",
    parentRevision: 11,
    source: "command",
  });
  journal.append({ type: "reset" });
  journal.append({ type: "add", amount: 7 });
  return journal;
}

function registerModelComponents(
  registry: ActionJournalCheckpointRegistry<ModelState, ModelAction>,
  order: readonly ("counter" | "log" | "theme")[] = ["counter", "log", "theme"],
): void {
  for (const component of order) {
    if (component === "counter") {
      registry.register({
        componentId: "counter",
        schemaVersion: 1,
        capture: (state) => state.count,
        restore: (state, count) => ({ ...state, count }),
      });
    } else if (component === "log") {
      registry.register({
        componentId: "log",
        schemaVersion: 1,
        capture: (state) => state.log,
        restore: (state, log) => ({ ...state, log: [...log] }),
      });
    } else {
      registry.register({
        componentId: "theme",
        schemaVersion: 2,
        capture: (state) => state.theme,
        restore: (state, theme) => ({ ...state, theme }),
      });
    }
  }
}

function mutableCheckpoint(checkpoint: unknown): Record<string, unknown> {
  return JSON.parse(canonicalActionJournalCheckpointJson(checkpoint)) as Record<string, unknown>;
}

Deno.test("checkpoint plus pure tail replay is byte-identical to full ActionJournal replay", () => {
  const journal = modelJournal();
  const registry = new ActionJournalCheckpointRegistry<ModelState, ModelAction>();
  registerModelComponents(registry);
  const checkpoint = registry.captureFromReplay(journal.snapshot(), INITIAL_STATE, modelReducer, {
    revision: 13,
  });
  const serialized = canonicalActionJournalCheckpointJson(checkpoint);
  const parsed = parseActionJournalCheckpoint(serialized);
  const full = replayActionJournal(journal.snapshot(), INITIAL_STATE, modelReducer);
  const tail = registry.replay(journal.snapshot(), [parsed], INITIAL_STATE, modelReducer);

  assertEquals(checkpoint.schemaVersion, ACTION_JOURNAL_CHECKPOINT_SCHEMA_VERSION);
  assertEquals(checkpoint.hashAlgorithm, ACTION_JOURNAL_CHECKPOINT_HASH_ALGORITHM);
  assertEquals(checkpoint.causalPosition, {
    revision: 13,
    parentRevision: 11,
    correlationId: "theme-change",
    source: "command",
  });
  assertEquals(checkpoint.components.map((component) => component.componentId), ["counter", "log", "theme"]);
  assertEquals(serialized.includes(INITIAL_STATE.privateToken), false);
  assertEquals(tail.serializedState, full.serializedState);
  assertEquals(tail.state, full.state);
  assertEquals(tail.usedCheckpoint, true);
  assertEquals(tail.checkpointRevision, 13);
  assertEquals(tail.appliedCount, 2);
  assertEquals(tail.revision, 15);
  assertEquals(Object.isFrozen(tail.state), true);
  assertNotStrictEquals(parsed, checkpoint);
  assertThrows(() => {
    (parsed.components[0] as { state: ActionJournalJsonValue }).state = 99;
  }, TypeError);
});

Deno.test("checkpoint bytes and latest selection are deterministic across provider and candidate order", () => {
  const journal = modelJournal();
  const left = new ActionJournalCheckpointRegistry<ModelState, ModelAction>();
  const right = new ActionJournalCheckpointRegistry<ModelState, ModelAction>();
  registerModelComponents(left, ["counter", "log", "theme"]);
  registerModelComponents(right, ["theme", "log", "counter"]);

  const leftEarly = left.captureFromReplay(journal.snapshot(), INITIAL_STATE, modelReducer, { revision: 12 });
  const leftLate = left.captureFromReplay(journal.snapshot(), INITIAL_STATE, modelReducer, { revision: 14 });
  const rightLate = right.captureFromReplay(journal.snapshot(), INITIAL_STATE, modelReducer, { revision: 14 });

  assertEquals(
    canonicalActionJournalCheckpointJson(leftLate),
    canonicalActionJournalCheckpointJson(rightLate),
  );
  assertEquals(
    left.selectLatestCompatibleCheckpoint(journal.snapshot(), [leftEarly, leftLate, leftEarly])?.checkpoint.revision,
    14,
  );
  assertEquals(
    left.selectLatestCompatibleCheckpoint(journal.snapshot(), [leftLate, leftEarly])?.checkpoint.revision,
    14,
  );
});

Deno.test("foreign, corrupt, future, and causally mismatched checkpoints are diagnosed and skipped", () => {
  const journal = modelJournal();
  const registry = new ActionJournalCheckpointRegistry<ModelState, ModelAction>({ maxDiagnostics: 20 });
  registerModelComponents(registry);
  const valid = registry.captureFromReplay(journal.snapshot(), INITIAL_STATE, modelReducer, { revision: 12 });

  const foreignJournal = modelJournal("foreign-journal");
  const foreign = registry.captureFromReplay(foreignJournal.snapshot(), INITIAL_STATE, modelReducer, {
    revision: 13,
  });

  const corruptHash = mutableCheckpoint(valid);
  corruptHash.journalHash = "0000000000000000";
  const corruptState = mutableCheckpoint(valid);
  const corruptComponents = corruptState.components as Array<Record<string, unknown>>;
  corruptComponents[0]!.state = 8;
  const badCausality = mutableCheckpoint(valid);
  (badCausality.causalPosition as Record<string, unknown>).parentRevision = 10;

  const longer = modelJournal();
  longer.append({ type: "add", amount: 9 });
  const future = registry.captureFromReplay(longer.snapshot(), INITIAL_STATE, modelReducer, { revision: 16 });

  const selected = registry.selectLatestCompatibleCheckpoint(journal.snapshot(), [
    foreign,
    corruptHash,
    corruptState,
    badCausality,
    future,
    valid,
  ]);
  assertEquals(selected?.checkpoint.revision, 12);
  assertEquals(
    registry.diagnostics().map((diagnostic) => diagnostic.code).sort(),
    [
      "causal-position-mismatch",
      "foreign-checkpoint",
      "future-checkpoint",
      "invalid-checkpoint",
      "journal-hash-mismatch",
    ].sort(),
  );
  assertEquals(JSON.parse(JSON.stringify(registry.inspect())), registry.inspect());
});

Deno.test("unknown, missing, and unsupported component state is never guessed", () => {
  const journal = modelJournal();
  const target = new ActionJournalCheckpointRegistry<ModelState, ModelAction>({ maxDiagnostics: 20 });
  registerModelComponents(target);

  const withUnknown = new ActionJournalCheckpointRegistry<ModelState, ModelAction>();
  registerModelComponents(withUnknown);
  withUnknown.register({
    componentId: "ghost",
    schemaVersion: 1,
    capture: () => null,
    restore: (state) => ({ ...state }),
  });
  const unknown = withUnknown.captureFromReplay(journal.snapshot(), INITIAL_STATE, modelReducer, {
    revision: 14,
  });

  const missing = new ActionJournalCheckpointRegistry<ModelState, ModelAction>();
  registerModelComponents(missing, ["counter", "log"]);
  const missingState = missing.captureFromReplay(journal.snapshot(), INITIAL_STATE, modelReducer, {
    revision: 13,
  });

  const unsupported = new ActionJournalCheckpointRegistry<ModelState, ModelAction>();
  unsupported.register({
    componentId: "counter",
    schemaVersion: 9,
    capture: (state) => state.count,
    restore: (state, count) => ({ ...state, count }),
  });
  unsupported.register({
    componentId: "log",
    schemaVersion: 1,
    capture: (state) => state.log,
    restore: (state, log) => ({ ...state, log: [...log] }),
  });
  unsupported.register({
    componentId: "theme",
    schemaVersion: 2,
    capture: (state) => state.theme,
    restore: (state, theme) => ({ ...state, theme }),
  });
  const unsupportedState = unsupported.captureFromReplay(journal.snapshot(), INITIAL_STATE, modelReducer, {
    revision: 12,
  });

  assertEquals(
    target.selectLatestCompatibleCheckpoint(journal.snapshot(), [unknown, missingState, unsupportedState]),
    undefined,
  );
  assertEquals(
    target.diagnostics().map((diagnostic) => diagnostic.code).sort(),
    ["missing-component", "unknown-component", "unsupported-component-schema"].sort(),
  );
  const replayed = target.replay(
    journal.snapshot(),
    [unknown, missingState, unsupportedState],
    INITIAL_STATE,
    modelReducer,
  );
  assertEquals(replayed.usedCheckpoint, false);
  assertEquals(replayed.serializedState, journal.replay(INITIAL_STATE, modelReducer).serializedState);
});

Deno.test("explicit one-hop migrations are validated and produce compatible replay", () => {
  interface CountState {
    count: number;
  }
  type CountAction = { amount: number; type: "add" };
  type CountV2 = { readonly count: number } & Readonly<Record<string, ActionJournalJsonValue>>;
  const journal = new ActionJournal<CountAction>({ journalId: "migrate", now: () => 1 });
  journal.append({ type: "add", amount: 2 });
  journal.append({ type: "add", amount: 4 });
  journal.append({ type: "add", amount: 8 });
  const reducer = (state: Readonly<CountState>, action: Readonly<CountAction>): CountState => ({
    count: state.count + action.amount,
  });

  const oldRegistry = new ActionJournalCheckpointRegistry<CountState, CountAction>();
  oldRegistry.register({
    componentId: "counter",
    schemaVersion: 1,
    capture: (state) => state.count,
    restore: (state, count) => ({ ...state, count }),
  });
  const oldCheckpoint = oldRegistry.captureFromReplay(journal.snapshot(), { count: 0 }, reducer, {
    revision: 2,
  });

  const current = new ActionJournalCheckpointRegistry<CountState, CountAction>();
  current.register<CountV2>({
    componentId: "counter",
    schemaVersion: 2,
    capture: (state) => ({ count: state.count }),
    restore: (_state, data) => ({ count: data.count }),
    migrations: [{
      fromSchemaVersion: 1,
      migrate: (data) => {
        if (typeof data !== "number") throw new Error("invalid old counter state");
        return { count: data };
      },
    }],
  });

  const selection = current.selectLatestCompatibleCheckpoint(journal.snapshot(), [oldCheckpoint]);
  const replayed = current.replay(journal.snapshot(), [oldCheckpoint], { count: 0 }, reducer);
  assertEquals(selection?.migratedComponentIds, ["counter"]);
  assertEquals(replayed.usedCheckpoint, true);
  assertEquals(replayed.appliedCount, 1);
  assertEquals(replayed.serializedState, journal.replay({ count: 0 }, reducer).serializedState);
});

Deno.test("throwing migration and restore providers fall back to older checkpoints or full replay", () => {
  interface CountState {
    count: number;
  }
  type CountAction = { amount: number; type: "add" };
  const journal = new ActionJournal<CountAction>({ journalId: "fallback", now: () => 1 });
  journal.append({ type: "add", amount: 1 });
  journal.append({ type: "add", amount: 2 });
  journal.append({ type: "add", amount: 4 });
  const reducer = (state: Readonly<CountState>, action: Readonly<CountAction>): CountState => ({
    count: state.count + action.amount,
  });

  const capture = new ActionJournalCheckpointRegistry<CountState, CountAction>();
  capture.register({
    componentId: "counter",
    schemaVersion: 1,
    capture: (state) => state.count,
    restore: (state, count) => ({ ...state, count }),
  });
  const early = capture.captureFromReplay(journal.snapshot(), { count: 0 }, reducer, { revision: 1 });
  const badLate = capture.capture(journal.snapshot(), { count: 999 }, { revision: 2 });

  const restoreFallback = new ActionJournalCheckpointRegistry<CountState, CountAction>();
  restoreFallback.register({
    componentId: "counter",
    schemaVersion: 1,
    capture: (state) => state.count,
    restore: (_state, count) => {
      if (count === 999) throw new Error("component rejected corrupt state");
      return { count };
    },
  });
  const restored = restoreFallback.replay(journal.snapshot(), [early, badLate], { count: 0 }, reducer);
  assertEquals(restored.usedCheckpoint, true);
  assertEquals(restored.checkpointRevision, 1);
  assertEquals(restored.serializedState, journal.replay({ count: 0 }, reducer).serializedState);
  assertEquals(restoreFallback.diagnostics().at(-1)?.code, "provider-restore-failed");

  const migrationFallback = new ActionJournalCheckpointRegistry<CountState, CountAction>();
  migrationFallback.register({
    componentId: "counter",
    schemaVersion: 2,
    capture: (state) => state.count,
    restore: (_state, count) => ({ count }),
    migrations: [{
      fromSchemaVersion: 1,
      migrate: () => {
        throw new Error("migration failed");
      },
    }],
  });
  const migrated = migrationFallback.replay(journal.snapshot(), [early], { count: 0 }, reducer);
  assertEquals(migrated.usedCheckpoint, false);
  assertEquals(migrated.serializedState, journal.replay({ count: 0 }, reducer).serializedState);
  assertEquals(migrationFallback.diagnostics().at(-1)?.code, "provider-migration-failed");
});

Deno.test("duplicate, missing, and throwing capture providers fail explicitly with bounded diagnostics", () => {
  const journal = modelJournal();
  const empty = new ActionJournalCheckpointRegistry<ModelState, ModelAction>({ maxDiagnostics: 2 });
  assertEquals(
    assertThrows(
      () => empty.capture(journal.snapshot(), INITIAL_STATE),
      ActionJournalCheckpointError,
    ).code,
    "missing-provider",
  );

  const registry = new ActionJournalCheckpointRegistry<ModelState, ModelAction>({ maxDiagnostics: 2 });
  registry.register<ActionJournalJsonValue>({
    componentId: "broken",
    schemaVersion: 1,
    capture: () => (() => undefined) as unknown as ActionJournalJsonValue,
    restore: (state) => ({ ...state }),
  });
  assertEquals(
    assertThrows(
      () => registry.capture(journal.snapshot(), INITIAL_STATE),
      ActionJournalCheckpointError,
    ).code,
    "provider-failed",
  );
  assertEquals(
    assertThrows(
      () =>
        registry.register({
          componentId: "broken",
          schemaVersion: 2,
          capture: () => null,
          restore: (state) => ({ ...state }),
        }),
      ActionJournalCheckpointError,
    ).code,
    "duplicate-provider",
  );
  registry.selectLatestCompatibleCheckpoint(journal.snapshot(), [null]);
  assertEquals(registry.diagnostics().length, 2);
  assertEquals(registry.diagnostics().map((diagnostic) => diagnostic.sequence), [1, 2]);
  assertEquals(registry.diagnostics().map((diagnostic) => diagnostic.code), [
    "duplicate-provider",
    "invalid-checkpoint",
  ]);
});

Deno.test("strict checkpoint validation rejects accessors, closures, extra fields, and state corruption", () => {
  const journal = modelJournal();
  const registry = new ActionJournalCheckpointRegistry<ModelState, ModelAction>();
  registerModelComponents(registry);
  const checkpoint = registry.captureFromReplay(journal.snapshot(), INITIAL_STATE, modelReducer, { revision: 12 });

  const extra = mutableCheckpoint(checkpoint);
  extra.privateData = "must-not-pass";
  assertEquals(
    assertThrows(() => normalizeActionJournalCheckpoint(extra), ActionJournalCheckpointError).code,
    "invalid-schema",
  );

  const corrupted = mutableCheckpoint(checkpoint);
  (corrupted.components as Array<Record<string, unknown>>)[0]!.state = 999;
  assertEquals(
    assertThrows(() => normalizeActionJournalCheckpoint(corrupted), ActionJournalCheckpointError).code,
    "invalid-value",
  );

  let getterCalled = false;
  const accessor = mutableCheckpoint(checkpoint);
  Object.defineProperty(accessor, "journalId", {
    enumerable: true,
    get() {
      getterCalled = true;
      return "checkpoint-model";
    },
  });
  assertEquals(
    assertThrows(() => normalizeActionJournalCheckpoint(accessor), ActionJournalCheckpointError).code,
    "invalid-value",
  );
  assertEquals(getterCalled, false);
  assertEquals(
    assertThrows(() => parseActionJournalCheckpoint("{"), ActionJournalCheckpointError).code,
    "invalid-json",
  );
});

Deno.test("inspection is clone-safe and disposal is reverse-order, isolated, and idempotent", () => {
  const disposed: string[] = [];
  const registry = new ActionJournalCheckpointRegistry<ModelState, ModelAction>({ maxDiagnostics: 5 });
  const first = registry.register({
    componentId: "zeta",
    schemaVersion: 1,
    capture: () => null,
    restore: (state) => ({ ...state }),
    dispose: () => disposed.push("zeta"),
  });
  const second = registry.register({
    componentId: "alpha",
    schemaVersion: 3,
    capture: () => null,
    restore: (state) => ({ ...state }),
    migrations: [{ fromSchemaVersion: 1, migrate: () => null }],
    dispose: () => {
      disposed.push("alpha");
      throw new Error("isolated dispose failure");
    },
  });
  const inspection = registry.inspect();
  assertEquals(inspection.components, [
    { componentId: "alpha", schemaVersion: 3, migrationSourceVersions: [1] },
    { componentId: "zeta", schemaVersion: 1, migrationSourceVersions: [] },
  ]);
  assertEquals(JSON.parse(JSON.stringify(inspection)), inspection);
  assertEquals(Object.isFrozen(inspection.components), true);

  registry.dispose();
  registry.dispose();
  assertEquals(disposed, ["alpha", "zeta"]);
  assertEquals(first.disposed, true);
  assertEquals(second.disposed, true);
  assertEquals(registry.inspect().disposed, true);
  assertEquals(registry.inspect().componentCount, 0);
  assertEquals(registry.diagnostics().map((diagnostic) => diagnostic.code), ["provider-dispose-failed"]);
  assertEquals(
    assertThrows(
      () =>
        registry.register({ componentId: "late", schemaVersion: 1, capture: () => null, restore: (state) => state }),
      ActionJournalCheckpointError,
    ).code,
    "disposed",
  );
});
