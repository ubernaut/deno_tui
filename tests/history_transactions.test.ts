import { assert, assertEquals, assertRejects, assertThrows } from "./deps.ts";
import {
  HistoryBusyError,
  historyCommands,
  HistoryOperationError,
  HistoryPoisonedError,
  HistoryScopeError,
  HistoryStack,
  type HistoryTransaction,
  HistoryTransactionAbortedError,
  type SynchronousHistoryTransaction,
} from "../src/app/history.ts";

Deno.test("nested synchronous history scopes commit one ordered composite entry", async () => {
  const history = new HistoryStack();
  const values: string[] = [];
  const events: string[] = [];

  history.transactionSync({ id: "outer", label: "Outer edit", group: "test" }, (scope) => {
    assertEquals(scope.depth, 1);
    scope.apply(listTransaction("a", values, events));
    scope.transaction({ id: "inner", label: "Inner edit" }, (inner) => {
      assertEquals(inner.depth, 2);
      inner.apply(listTransaction("b", values, events));
      values.push("c");
      events.push("external-c");
      inner.push(listTransaction("c", values, events));
    });
    assertEquals(history.inspect().undoDepth, 0);
    assertEquals(history.inspect().transaction, {
      id: "outer",
      label: "Outer edit",
      group: "test",
      mode: "sync",
      depth: 1,
      entryCount: 2,
    });
  });

  assertEquals(values, ["a", "b", "c"]);
  assertEquals(history.undoDepth, 1);
  assertEquals(history.inspect().nextUndo, {
    id: "outer",
    label: "Outer edit",
    group: "test",
    composite: true,
    operationCount: 3,
  });

  events.length = 0;
  assertEquals(await history.undo(), true);
  assertEquals(values, []);
  assertEquals(events, ["undo-c", "undo-b", "undo-a"]);
  events.length = 0;
  assertEquals(await history.redo(), true);
  assertEquals(values, ["a", "b", "c"]);
  assertEquals(events, ["redo-a", "redo-b", "redo-c"]);
});

Deno.test("async history scopes auto-join unawaited nested scopes before atomic commit", async () => {
  const history = new HistoryStack();
  const values: string[] = [];
  const childGate = deferred<void>();
  let rootResolved = false;

  const root = history.transaction({ id: "async", label: "Async edit" }, async (scope) => {
    await scope.apply(asyncListTransaction("a", values));
    void scope.transaction({ label: "Joined child" }, async (child) => {
      await childGate.promise;
      await child.apply(asyncListTransaction("b", values));
    });
  }).then(() => {
    rootResolved = true;
  });

  await Promise.resolve();
  assertEquals(rootResolved, false);
  assertEquals(history.undoDepth, 0);
  childGate.resolve();
  await root;
  assertEquals(rootResolved, true);
  assertEquals(values, ["a", "b"]);
  assertEquals(history.undoDepth, 1);
  assertEquals(history.inspect().nextUndo?.operationCount, 2);
});

Deno.test("async history scopes drain operations added by tracked promise continuations", async () => {
  const history = new HistoryStack();
  const values: string[] = [];

  await history.transaction({ label: "Continuation edit" }, (scope) => {
    const first = scope.apply(asyncListTransaction("a", values));
    void first.then(() => {
      void scope.apply(asyncListTransaction("b", values));
    });
  });

  assertEquals(values, ["a", "b"]);
  assertEquals(history.undoDepth, 1);
  assertEquals(history.inspect().transaction, undefined);
  assertEquals(history.inspect().operation, undefined);
  assertEquals(history.inspect().nextUndo?.operationCount, 2);
  assertEquals(await history.undo(), true);
  assertEquals(values, []);
});

Deno.test("an unobserved failed nested scope deterministically aborts its parent", async () => {
  const history = new HistoryStack();
  const values: string[] = [];

  const error = await assertRejects(
    () =>
      history.transaction({ label: "Parent" }, async (scope) => {
        await scope.apply(asyncListTransaction("a", values));
        void scope.transaction({ label: "Detached child" }, () => {
          throw new Error("detached failure");
        });
        while (history.inspect().transaction?.label !== "Parent") await Promise.resolve();
        await Promise.resolve();
      }),
    HistoryTransactionAbortedError,
  );

  assert(error.cause instanceof HistoryTransactionAbortedError);
  assertEquals(values, []);
  assertEquals(history.undoDepth, 0);
  assertEquals(history.redoDepth, 0);
});

Deno.test("a dropped fulfillment-only chain does not hide nested rejection", async () => {
  const history = new HistoryStack();
  const values: string[] = [];
  let propagated: Promise<unknown> | undefined;

  await assertRejects(
    () =>
      history.transaction({ label: "Parent" }, async (scope) => {
        await scope.apply(asyncListTransaction("a", values));
        propagated = scope.transaction({ label: "Failing child" }, () => {
          throw new Error("child failed");
        }).then(() => "unreachable");
        void propagated.catch(() => undefined);
      }),
    HistoryTransactionAbortedError,
  );

  assertEquals(values, []);
  assertEquals(history.undoDepth, 0);
  assertEquals(history.inspect().transaction, undefined);
});

Deno.test("active async transactions reject ambiguous outside and concurrent scope mutation", async () => {
  const history = new HistoryStack();
  const values: string[] = [];
  const started = deferred<void>();
  const release = deferred<void>();
  let concurrentError: unknown;

  const running = history.transaction({ label: "Long edit" }, async (scope) => {
    const first = scope.apply({
      label: "Long step",
      async redo() {
        started.resolve();
        await release.promise;
        values.push("a");
      },
      undo() {
        values.pop();
      },
    });
    try {
      await scope.apply(asyncListTransaction("concurrent", values));
    } catch (error) {
      concurrentError = error;
    }
    await first;
  });

  await started.promise;
  assertThrows(
    () => history.push(listTransaction("outside", values)),
    HistoryBusyError,
  );
  await assertRejects(() => history.undo(), HistoryBusyError);
  assertThrows(
    () => history.transactionSync({ label: "outside" }, () => undefined),
    HistoryBusyError,
  );
  assert(concurrentError instanceof HistoryBusyError);
  assertEquals(history.inspect().operation, "transaction-apply");
  release.resolve();
  await running;
  assertEquals(values, ["a"]);
});

Deno.test("aborted transactions compensate in reverse and preserve both visible stacks", async () => {
  const history = new HistoryStack();
  const values: string[] = [];
  const events: string[] = [];
  await history.apply(listTransaction("existing", values, events));
  await history.undo();
  const before = history.inspect();
  events.length = 0;

  const error = assertThrows(
    () =>
      history.transactionSync({ id: "discard", label: "Discard me" }, (scope) => {
        scope.apply(listTransaction("a", values, events));
        values.push("b");
        events.push("external-b");
        scope.push(listTransaction("b", values, events));
        throw new Error("cancel");
      }),
    HistoryTransactionAbortedError,
  );
  assertEquals(error.entry, { id: "discard", label: "Discard me", group: undefined });
  assertEquals(error.cause instanceof Error && error.cause.message, "cancel");
  assertEquals(values, []);
  assertEquals(events, ["redo-a", "external-b", "undo-b", "undo-a"]);
  assertEquals(history.inspect(), before);
});

Deno.test("a nested abort can be caught without discarding the parent scope", async () => {
  const history = new HistoryStack();
  const values: string[] = [];

  await history.transaction({ label: "Parent" }, async (scope) => {
    await scope.apply(asyncListTransaction("a", values));
    await assertRejects(
      () =>
        scope.transaction({ label: "Child" }, async (child) => {
          await child.apply(asyncListTransaction("b", values));
          throw new Error("child cancelled");
        }),
      HistoryTransactionAbortedError,
    );
    assertEquals(values, ["a"]);
    await scope.apply(asyncListTransaction("c", values));
  });

  assertEquals(values, ["a", "c"]);
  assertEquals(history.undoDepth, 1);
  await history.undo();
  assertEquals(values, []);
});

Deno.test("explicit nested and root discard roll back without changing either stack", async () => {
  const history = new HistoryStack();
  const values: string[] = [];
  await history.apply(asyncListTransaction("existing", values));
  await history.undo();
  const before = history.inspect();

  const result = await history.transaction({ id: "outer-discard", label: "Discard outer" }, async (scope) => {
    await scope.apply(asyncListTransaction("a", values));
    const childResult = await scope.transaction({ label: "Discard child" }, async (child) => {
      await child.apply(asyncListTransaction("b", values));
      child.discard();
      child.discard();
      assertEquals(child.discarded, true);
      assertEquals(history.inspect().transaction?.discardRequested, true);
      return "child-result";
    });
    assertEquals(childResult, "child-result");
    assertEquals(values, ["a"]);
    scope.discard();
    assertEquals(scope.discarded, true);
    assertThrows(() => scope.push(listTransaction("late", values)), HistoryScopeError);
    return 42;
  });

  assertEquals(result, 42);
  assertEquals(values, []);
  assertEquals(history.inspect(), before);
});

Deno.test("failed apply undo and redo compensate state without advancing stacks", async () => {
  const history = new HistoryStack();
  let value = 0;
  let failApply = true;
  const applyFailure: HistoryTransaction = {
    label: "Apply failure",
    redo() {
      value = 1;
      if (failApply) throw new Error("redo failed");
    },
    undo() {
      value = 0;
    },
  };
  const applyError = await assertRejects(() => history.apply(applyFailure), HistoryOperationError);
  assertEquals(applyError.poisoned, false);
  assertEquals(value, 0);
  assertEquals(history.inspect().undoDepth, 0);
  failApply = false;
  await history.apply(applyFailure);

  let failUndo = true;
  const undoFailure: HistoryTransaction = {
    label: "Undo failure",
    redo() {
      value = 2;
    },
    undo() {
      value = 0;
      if (failUndo) throw new Error("undo failed");
    },
  };
  await history.apply(undoFailure);
  const beforeUndo = history.inspect();
  const undoError = await assertRejects(() => history.undo(), HistoryOperationError);
  assertEquals(undoError.poisoned, false);
  assertEquals(value, 2);
  assertEquals(history.inspect(), beforeUndo);
  failUndo = false;
  assertEquals(await history.undo(), true);
  assertEquals(value, 0);

  let failRedo = true;
  undoFailure.redo = () => {
    value = 2;
    if (failRedo) throw new Error("redo failed");
  };
  const beforeRedo = history.inspect();
  const redoError = await assertRejects(() => history.redo(), HistoryOperationError);
  assertEquals(redoError.poisoned, false);
  assertEquals(value, 0);
  assertEquals(history.inspect(), beforeRedo);
  failRedo = false;
  assertEquals(await history.redo(), true);
  assertEquals(value, 2);
});

Deno.test("composite undo failure compensates the failed and completed leaves in redo order", async () => {
  const history = new HistoryStack();
  const values: string[] = [];
  const events: string[] = [];
  let failB = true;

  history.transactionSync({ label: "ABC" }, (scope) => {
    scope.apply(listTransaction("a", values, events));
    scope.apply({
      label: "b",
      redo() {
        events.push("redo-b");
        values.push("b");
      },
      undo() {
        events.push("undo-b");
        values.pop();
        if (failB) throw new Error("b undo failed");
      },
    });
    scope.apply(listTransaction("c", values, events));
  });
  events.length = 0;
  const before = history.inspect();

  const error = await assertRejects(() => history.undo(), HistoryOperationError);
  assertEquals(error.poisoned, false);
  assertEquals(values, ["a", "b", "c"]);
  assertEquals(events, ["undo-c", "undo-b", "redo-b", "redo-c"]);
  assertEquals(history.inspect(), before);

  failB = false;
  events.length = 0;
  assertEquals(await history.undo(), true);
  assertEquals(events, ["undo-c", "undo-b", "undo-a"]);
  assertEquals(values, []);
});

Deno.test("failed compensation poisons the stack until explicit recovery", async () => {
  const history = new HistoryStack();
  let value = 0;
  const broken: HistoryTransaction = {
    id: "broken",
    label: "Broken apply",
    redo() {
      value = 1;
      throw new Error("redo failed");
    },
    undo() {
      throw new Error("undo compensation failed");
    },
  };

  const error = await assertRejects(() => history.apply(broken), HistoryOperationError);
  assertEquals(error.poisoned, true);
  assertEquals(history.isPoisoned(), true);
  assertEquals(value, 1);
  assertEquals(history.inspect().poisoned, {
    phase: "apply",
    direction: "redo",
    entry: { id: "broken", label: "Broken apply", group: undefined },
    failedEntry: { id: "broken", label: "Broken apply", group: undefined },
    error: { name: "Error", message: "redo failed" },
    compensationFailures: [{
      entry: { id: "broken", label: "Broken apply", group: undefined },
      error: { name: "Error", message: "undo compensation failed" },
    }],
    reason: "compensation-failed",
  });
  error.failure.compensationFailures[0]!.error.message = "caller mutation";
  assertEquals(
    history.inspect().poisoned?.compensationFailures[0]?.error.message,
    "undo compensation failed",
  );
  assertEquals(history.canUndo(), false);
  const clearCommand = historyCommands(history, { includeClear: true }).at(-1)!;
  assertEquals(typeof clearCommand.disabled === "function" ? clearCommand.disabled() : clearCommand.disabled, false);
  assertThrows(() => history.push(listTransaction("blocked", [])), HistoryPoisonedError);
  await assertRejects(() => history.undo(), HistoryPoisonedError);
  await assertRejects(() => history.transaction({ label: "blocked" }, () => undefined), HistoryPoisonedError);

  history.clear();
  assertEquals(history.isPoisoned(), false);
  assertEquals(history.inspect().poisoned, undefined);
  history.push(listTransaction("allowed", []));
  assertEquals(history.undoDepth, 1);
});

Deno.test("a rollback failure poisons even when compensation restores the applied state", () => {
  const history = new HistoryStack();
  let value = 0;
  const error = assertThrows(
    () =>
      history.transactionSync({ label: "Cannot discard" }, (scope) => {
        scope.apply({
          label: "fragile",
          redo() {
            value = 1;
          },
          undo() {
            value = 0;
            throw new Error("rollback failed");
          },
        });
        throw new Error("abort");
      }),
    HistoryPoisonedError,
  );
  assertEquals(error.poison.reason, "rollback-failed");
  assertEquals(value, 1);
  assertEquals(history.undoDepth, 0);
  assertEquals(history.isPoisoned(), true);
  assertEquals(history.recoverPoison("clear-history"), true);
  assertEquals(history.isPoisoned(), false);
});

Deno.test("retain-history recovery requires an explicit external state repair policy", async () => {
  const history = new HistoryStack();
  let value = 0;
  let failUndo = true;
  const transaction: HistoryTransaction = {
    label: "Retained entry",
    redo() {
      value = 1;
      if (value === 1 && failUndo) throw new Error("redo compensation failed");
    },
    undo() {
      value = 0;
      if (failUndo) throw new Error("undo failed");
    },
  };
  failUndo = false;
  await history.apply(transaction);
  failUndo = true;
  await assertRejects(() => history.undo(), HistoryOperationError);
  assertEquals(history.isPoisoned(), true);
  assertEquals(history.undoDepth, 1);

  failUndo = false;
  value = 1;
  assertEquals(history.recoverPoison("retain-history"), true);
  assertEquals(history.canUndo(), true);
  assertEquals(await history.undo(), true);
  assertEquals(value, 0);
});

Deno.test("transactionSync rejects asynchronous steps and closes stale scopes", async () => {
  const history = new HistoryStack();
  let staleScope: { push(transaction: SynchronousHistoryTransaction): void } | undefined;
  history.transactionSync({ label: "Capture scope" }, (scope) => {
    staleScope = scope;
  });
  assertThrows(() => staleScope!.push(listTransaction("late", [])), HistoryScopeError);

  const asyncStep = {
    label: "Async in sync",
    async redo() {
      await Promise.resolve();
    },
    undo() {},
  } as unknown as SynchronousHistoryTransaction;
  assertThrows(
    () => history.transactionSync({ label: "Bad sync" }, (scope) => scope.apply(asyncStep)),
    HistoryPoisonedError,
  );
  assertEquals(history.inspect().poisoned?.reason, "async-in-sync-scope");
  history.clear();
  await Promise.resolve();
});

Deno.test("transactionSync rejects callable thenables at callback and step boundaries", async () => {
  const callbackHistory = new HistoryStack();
  let callbackThenCalled = false;
  const callbackThenable = Object.assign(
    () => undefined,
    {
      then(resolve: (value: string) => void): void {
        callbackThenCalled = true;
        resolve("late");
      },
    },
  );
  assertThrows(
    () => callbackHistory.transactionSync({ label: "Callable callback" }, () => callbackThenable),
    HistoryTransactionAbortedError,
  );
  await Promise.resolve();
  assertEquals(callbackThenCalled, true);
  assertEquals(callbackHistory.inspect().transaction, undefined);
  assertEquals(callbackHistory.undoDepth, 0);

  const stepHistory = new HistoryStack();
  let stepThenCalled = false;
  const stepThenable = Object.assign(
    () => undefined,
    {
      then(resolve: () => void): void {
        stepThenCalled = true;
        resolve();
      },
    },
  );
  assertThrows(
    () =>
      stepHistory.transactionSync({ label: "Callable step" }, (scope) => {
        scope.apply({
          label: "Callable step",
          redo: () => stepThenable,
          undo: () => undefined,
        } as unknown as SynchronousHistoryTransaction);
      }),
    HistoryPoisonedError,
  );
  await Promise.resolve();
  assertEquals(stepThenCalled, true);
  assertEquals(stepHistory.inspect().transaction, undefined);
  assertEquals(stepHistory.inspect().poisoned?.reason, "async-in-sync-scope");
});

Deno.test("empty and discarded scopes leave an existing redo stack untouched", async () => {
  const history = new HistoryStack();
  const values: string[] = [];
  await history.apply(asyncListTransaction("existing", values));
  await history.undo();
  const before = history.inspect();

  history.transactionSync({ label: "Empty" }, () => undefined);
  assertEquals(history.inspect(), before);
  assertThrows(
    () =>
      history.transactionSync({ label: "Discard" }, () => {
        throw new Error("cancel");
      }),
    HistoryTransactionAbortedError,
  );
  assertEquals(history.inspect(), before);

  history.transactionSync({ label: "Commit" }, (scope) => {
    values.push("new");
    scope.push(listTransaction("new", values));
  });
  assertEquals(history.redoDepth, 0);
  assertEquals(history.undoDepth, 1);
});

function listTransaction(
  value: string,
  values: string[],
  events?: string[],
): SynchronousHistoryTransaction {
  return {
    id: value,
    label: value,
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

function asyncListTransaction(value: string, values: string[]): HistoryTransaction {
  return {
    id: value,
    label: value,
    async redo() {
      await Promise.resolve();
      values.push(value);
    },
    async undo() {
      await Promise.resolve();
      const index = values.lastIndexOf(value);
      if (index >= 0) values.splice(index, 1);
    },
  };
}

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve: resolve as T extends void ? () => void : typeof resolve, reject };
}
