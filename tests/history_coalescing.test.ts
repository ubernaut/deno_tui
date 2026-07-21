import { assertEquals, assertRejects, assertThrows } from "./deps.ts";
import {
  HistoryOperationError,
  HistoryReplaySafetyError,
  type HistoryReplaySafetyMetadata,
  HistoryStack,
  type HistoryTransaction,
  type SynchronousHistoryTransaction,
} from "../src/app/history.ts";

Deno.test("coalescing uses the caller clock and preserves forward redo and reverse undo", async () => {
  let now = 0;
  let clockCalls = 0;
  const values: string[] = [];
  const events: string[] = [];
  const history = new HistoryStack({
    coalescing: {
      idleIntervalMs: 50,
      now: () => {
        clockCalls += 1;
        return now;
      },
    },
  });

  assertEquals(clockCalls, 0);
  await history.apply(streamTransaction("a", "typing", "editor", values, events));
  now = 25;
  await history.apply(streamTransaction("b", "typing", "editor", values, events));

  assertEquals(clockCalls, 2);
  assertEquals(values, ["a", "b"]);
  assertEquals(history.undoDepth, 1);
  assertEquals(history.inspect().nextUndo, {
    id: "b",
    label: "b",
    group: "typing",
    composite: true,
    operationCount: 2,
    coalesced: true,
    coalesceKey: "editor",
  });

  events.length = 0;
  assertEquals(await history.undo(), true);
  assertEquals(values, []);
  assertEquals(events, ["undo-b", "undo-a"]);

  events.length = 0;
  assertEquals(await history.redo(), true);
  assertEquals(values, ["a", "b"]);
  assertEquals(events, ["redo-a", "redo-b"]);
});

Deno.test("typing resize and command streams split by key group idle timeout and semantic boundary", async () => {
  let now = 0;
  const history = new HistoryStack({ coalescing: { idleIntervalMs: 100, now: () => now } });
  const values: string[] = [];

  await history.apply(streamTransaction("type-a", "edit", "typing", values));
  now = 10;
  await history.apply(streamTransaction("type-b", "edit", "typing", values));
  assertEquals(history.undoDepth, 1);

  now = 20;
  await history.apply(streamTransaction("resize-a", "layout", "resize", values));
  now = 30;
  await history.apply(streamTransaction("resize-b", "layout", "resize", values));
  assertEquals(history.undoDepth, 2);

  now = 40;
  await history.apply(streamTransaction("increment-a", "commands", "increment", values));
  now = 50;
  await history.apply(streamTransaction("increment-b", "other-commands", "increment", values));
  assertEquals(history.undoDepth, 4);

  now = 200;
  await history.apply(streamTransaction("increment-c", "other-commands", "increment", values));
  assertEquals(history.undoDepth, 5);

  now = 210;
  await history.apply(streamTransaction("increment-d", "other-commands", "increment", values, undefined, "step-2"));
  now = 220;
  await history.apply(streamTransaction("increment-e", "other-commands", "increment", values, undefined, "step-2"));
  assertEquals(history.undoDepth, 6);
  assertEquals(history.inspect().nextUndo?.coalesceBoundary, "step-2");
  assertEquals(history.inspect().nextUndo?.operationCount, 2);

  history.markCoalescingBoundary();
  now = 230;
  await history.apply(streamTransaction("increment-f", "other-commands", "increment", values, undefined, "step-2"));
  assertEquals(history.undoDepth, 7);
});

Deno.test("coalescing is opt-in and never crosses redo divergence", async () => {
  const values: string[] = [];
  const disabled = new HistoryStack();
  await disabled.apply(streamTransaction("a", "edit", "typing", values));
  await disabled.apply(streamTransaction("b", "edit", "typing", values));
  assertEquals(disabled.undoDepth, 2);

  let now = 0;
  const history = new HistoryStack({ coalescing: { idleIntervalMs: 100, now: () => now } });
  await history.apply(streamTransaction("c", "edit", "typing", values));
  now += 1;
  await history.apply(streamTransaction("d", "edit", "typing", values));
  now += 1;
  await history.apply(streamTransaction("checkpoint", "other", "other", values));
  assertEquals(history.undoDepth, 2);

  await history.undo();
  assertEquals(history.redoDepth, 1);
  now += 1;
  await history.apply(streamTransaction("divergent", "edit", "typing", values));
  assertEquals(history.undoDepth, 2);
  assertEquals(history.redoDepth, 0);
  assertEquals(history.inspect().nextUndo?.coalesced, undefined);
});

Deno.test("coalesced nested composites remain one failure-atomic ordered entry", async () => {
  let now = 0;
  const history = new HistoryStack({ coalescing: { idleIntervalMs: 100, now: () => now } });
  const values: string[] = [];
  const events: string[] = [];

  history.transactionSync(
    { label: "Batch one", group: "edit", coalesce: { key: "typing" } },
    (scope) => {
      scope.apply(streamTransaction("a", "leaf", "ignored", values, events));
      scope.apply(streamTransaction("b", "leaf", "ignored", values, events));
    },
  );
  now = 10;
  history.transactionSync(
    { label: "Batch two", group: "edit", coalesce: { key: "typing" } },
    (scope) => {
      scope.apply(streamTransaction("c", "leaf", "ignored", values, events));
      scope.transaction({ label: "Nested" }, (nested) => {
        nested.apply(streamTransaction("d", "leaf", "ignored", values, events));
      });
    },
  );

  assertEquals(history.undoDepth, 1);
  assertEquals(history.inspect().nextUndo?.operationCount, 4);
  events.length = 0;
  await history.undo();
  assertEquals(events, ["undo-d", "undo-c", "undo-b", "undo-a"]);
  assertEquals(values, []);
  events.length = 0;
  await history.redo();
  assertEquals(events, ["redo-a", "redo-b", "redo-c", "redo-d"]);
  assertEquals(values, ["a", "b", "c", "d"]);
});

Deno.test("a coalesced undo failure compensates leaves and leaves both stacks stable", async () => {
  let now = 0;
  let failUndo = true;
  const values: string[] = [];
  const events: string[] = [];
  const history = new HistoryStack({ coalescing: { idleIntervalMs: 100, now: () => now } });

  await history.apply(streamTransaction("a", "edit", "typing", values, events));
  now = 1;
  await history.apply({
    id: "b",
    label: "b",
    group: "edit",
    coalesce: { key: "typing" },
    redo() {
      events.push("redo-b");
      values.push("b");
    },
    undo() {
      events.push("undo-b");
      values.pop();
      if (failUndo) throw new Error("undo failed");
    },
  });
  const before = history.inspect();
  events.length = 0;

  const error = await assertRejects(() => history.undo(), HistoryOperationError);
  assertEquals(error.poisoned, false);
  assertEquals(events, ["undo-b", "redo-b"]);
  assertEquals(values, ["a", "b"]);
  assertEquals(history.inspect(), before);

  failUndo = false;
  assertEquals(await history.undo(), true);
  assertEquals(values, []);
});

Deno.test("unsafe side-effect declarations fail before callbacks or scopes run", async () => {
  const history = new HistoryStack();
  let callbackRuns = 0;
  const missingStrategy = {
    label: "Unsafe request",
    replaySafety: { sideEffectful: true } as unknown as HistoryReplaySafetyMetadata,
    redo() {
      callbackRuns += 1;
    },
    undo() {
      callbackRuns += 1;
    },
  };

  const applyError = await assertRejects(
    () => history.apply(missingStrategy),
    HistoryReplaySafetyError,
  );
  assertEquals(applyError.code, "unsafe-replay");
  assertEquals(callbackRuns, 0);
  assertEquals(history.inspect().undoDepth, 0);

  assertThrows(
    () =>
      history.push({
        ...missingStrategy,
        replaySafety: {
          sideEffectful: true,
          strategy: "unsafe",
        } as unknown as HistoryReplaySafetyMetadata,
      }),
    HistoryReplaySafetyError,
  );
  assertEquals(callbackRuns, 0);

  let scopeRan = false;
  await assertRejects(
    () =>
      history.transaction(
        {
          label: "Unsafe scope",
          replaySafety: { sideEffectful: true } as unknown as HistoryReplaySafetyMetadata,
        },
        () => {
          scopeRan = true;
        },
      ),
    HistoryReplaySafetyError,
  );
  assertEquals(scopeRan, false);
});

Deno.test("idempotent and compensatable side effects remain explicitly replayable", async () => {
  const history = new HistoryStack();
  const values: string[] = [];

  await history.apply(replayTransaction("idempotent", "idempotent", values));
  await history.apply(replayTransaction("compensatable", "compensatable", values));
  assertEquals(values, ["idempotent", "compensatable"]);
  assertEquals(history.undoDepth, 2);
  assertEquals(history.inspect().nextUndo?.replaySafety, "compensatable");
  await history.undo();
  await history.undo();
  assertEquals(values, []);
  await history.redo();
  await history.redo();
  assertEquals(values, ["idempotent", "compensatable"]);
});

Deno.test("non-replayable entries establish clone-safe checkpoints and cannot be replayed", async () => {
  const history = new HistoryStack();
  const values: string[] = [];
  await history.apply(plainTransaction("before", values));
  await history.undo();
  assertEquals(history.redoDepth, 1);

  let sideEffectRuns = 0;
  await history.apply({
    id: "publish",
    label: "Publish once",
    group: "network",
    replaySafety: { sideEffectful: true, strategy: "non-replayable" },
    redo() {
      sideEffectRuns += 1;
      values.push("published");
    },
    undo() {
      values.pop();
    },
  });

  assertEquals(sideEffectRuns, 1);
  assertEquals(history.undoDepth, 0);
  assertEquals(history.redoDepth, 0);
  assertEquals(history.inspect().replayBarrier, {
    sequence: 1,
    entry: {
      id: "publish",
      label: "Publish once",
      group: "network",
      replaySafety: "non-replayable",
    },
  });
  assertEquals(await history.undo(), false);
  assertEquals(await history.redo(), false);
  assertEquals(sideEffectRuns, 1);

  await history.apply(plainTransaction("after", values));
  assertEquals(await history.undo(), true);
  assertEquals(values, ["published"]);
  assertEquals(await history.undo(), false);

  const snapshot = history.inspect();
  snapshot.replayBarrier!.entry.label = "caller mutation";
  assertEquals(history.inspect().replayBarrier?.entry.label, "Publish once");
  history.clear();
  assertEquals(history.inspect().replayBarrier, undefined);
});

Deno.test("a nested non-replayable leaf checkpoints the entire successful composite", async () => {
  const history = new HistoryStack();
  const values: string[] = [];
  await history.apply(plainTransaction("old", values));

  history.transactionSync({ id: "deploy", label: "Deploy" }, (scope) => {
    scope.apply(plainTransaction("local", values));
    scope.transaction({ label: "External phase" }, (nested) => {
      nested.apply({
        label: "Notify service",
        replaySafety: { sideEffectful: true, strategy: "non-replayable" },
        redo() {
          values.push("notified");
        },
        undo() {
          values.pop();
        },
      });
    });
  });

  assertEquals(values, ["old", "local", "notified"]);
  assertEquals(history.undoDepth, 0);
  assertEquals(history.redoDepth, 0);
  assertEquals(history.inspect().replayBarrier?.entry, {
    id: "deploy",
    label: "Deploy",
    group: undefined,
    composite: true,
    operationCount: 2,
    replaySafety: "non-replayable",
  });
  assertEquals(await history.undo(), false);
});

Deno.test("failed non-replayable apply compensates without replacing replayable history", async () => {
  const history = new HistoryStack();
  const values: string[] = [];
  await history.apply(plainTransaction("existing", values));
  const before = history.inspect();

  const error = await assertRejects(
    () =>
      history.apply({
        label: "Failed publish",
        replaySafety: { sideEffectful: true, strategy: "non-replayable" },
        redo() {
          values.push("partial");
          throw new Error("publish failed");
        },
        undo() {
          values.pop();
        },
      }),
    HistoryOperationError,
  );

  assertEquals(error.poisoned, false);
  assertEquals(values, ["existing"]);
  assertEquals(history.inspect(), before);
});

function streamTransaction(
  value: string,
  group: string,
  key: string,
  values: string[],
  events?: string[],
  boundary?: string,
): SynchronousHistoryTransaction {
  return {
    id: value,
    label: value,
    group,
    coalesce: boundary === undefined ? { key } : { key, boundary },
    redo() {
      events?.push(`redo-${value}`);
      values.push(value);
    },
    undo() {
      events?.push(`undo-${value}`);
      const index = values.lastIndexOf(value);
      if (index >= 0) values.splice(index, 1);
    },
  };
}

function plainTransaction(value: string, values: string[]): SynchronousHistoryTransaction {
  return {
    id: value,
    label: value,
    redo() {
      values.push(value);
    },
    undo() {
      const index = values.lastIndexOf(value);
      if (index >= 0) values.splice(index, 1);
    },
  };
}

function replayTransaction(
  value: string,
  strategy: "idempotent" | "compensatable",
  values: string[],
): HistoryTransaction {
  return {
    id: value,
    label: value,
    replaySafety: { sideEffectful: true, strategy },
    redo() {
      values.push(value);
    },
    undo() {
      const index = values.lastIndexOf(value);
      if (index >= 0) values.splice(index, 1);
    },
  };
}
