import { assertEquals, assertInstanceOf, assertStrictEquals, assertThrows } from "./deps.ts";
import {
  type SupervisedTask,
  type SupervisedTaskSettlement,
  TaskGroup,
  TaskGroupAggregateError,
  TaskGroupCancellationError,
  TaskGroupClosedError,
  type TaskGroupContextValue,
  type TaskSupervisor,
  type TaskSupervisorInspection,
} from "../src/runtime/task_group.ts";
import { DeadlineBudget, DeadlineExceededError } from "../src/runtime/deadline.ts";
import { VirtualTimerScheduler } from "../src/runtime/clock.ts";

Deno.test("task groups provide immutable context and join every attached task", async () => {
  const sourceContext = {
    trace: { id: "trace-a" },
    roles: ["viewer"],
  };
  const group = new TaskGroup({ id: "root", context: sourceContext });
  sourceContext.trace.id = "mutated";
  sourceContext.roles.push("admin");

  const firstGate = deferred<number>();
  const secondGate = deferred<number>();
  const seenContexts: TaskGroupContextValue[] = [];
  const first = group.spawn(async ({ context }) => {
    seenContexts.push(context);
    return await firstGate.promise;
  }, { name: "first" });
  const second = group.spawn(async ({ context }) => {
    seenContexts.push(context);
    return await secondGate.promise;
  }, { name: "second" });

  const joining = group.join();
  assertEquals(group.status, "closing");
  assertThrows(() => group.spawn(() => 3), TaskGroupClosedError);
  assertThrows(() => group.createChild(), TaskGroupClosedError);

  secondGate.resolve(2);
  await flushMicrotasks();
  let joined = false;
  void joining.then(() => {
    joined = true;
  });
  await flushMicrotasks();
  assertEquals(joined, false);

  firstGate.resolve(1);
  const result = await joining;
  assertEquals(result.status, "completed");
  assertEquals(result.counts.fulfilled, 2);
  assertEquals(await first.result, { id: first.id, name: "first", status: "fulfilled", value: 1 });
  assertEquals(await second.result, { id: second.id, name: "second", status: "fulfilled", value: 2 });
  assertStrictEquals(seenContexts[0], group.context);
  assertStrictEquals(seenContexts[1], group.context);
  assertEquals(group.context, {
    trace: { id: "trace-a" },
    roles: ["viewer"],
  });
  assertEquals(Object.isFrozen(group.context), true);
  assertEquals(Object.isFrozen(group.context.trace), true);
  assertEquals(Object.isFrozen(group.context.roles), true);
});

Deno.test("parent cancellation propagates typed causal reasons through descendants", async () => {
  const root = new TaskGroup({ id: "root" });
  const child = root.createChild({ name: "child" });
  const grandchild = child.createChild({ name: "grandchild" });
  const observedSignals: AbortSignal[] = [];
  const spawnCancellationProbe = (group: TaskGroup) =>
    group.spawn(async ({ signal }) => {
      observedSignals.push(signal);
      await waitForAbort(signal);
      throw signal.reason;
    });

  const rootTask = spawnCancellationProbe(root);
  const childTask = spawnCancellationProbe(child);
  const grandchildTask = spawnCancellationProbe(grandchild);
  await flushMicrotasks();

  assertEquals(root.cancel("shutdown"), true);
  assertEquals(root.cancel("again"), false);
  const result = await root.join();

  assertEquals(result.status, "cancelled");
  assertInstanceOf(result.cancellation, TaskGroupCancellationError);
  assertEquals(result.cancellation?.source, "cancel");
  assertEquals(result.cancellation?.reason, "shutdown");
  assertEquals((await rootTask.result).status, "cancelled");
  assertEquals((await childTask.result).status, "cancelled");
  assertEquals((await grandchildTask.result).status, "cancelled");
  assertEquals(observedSignals.length, 3);
  assertStrictEquals(observedSignals[0]?.reason, result.cancellation);
  assertInstanceOf(observedSignals[1]?.reason, TaskGroupCancellationError);
  assertEquals((observedSignals[1]?.reason as TaskGroupCancellationError).source, "parent");
  assertStrictEquals(
    (observedSignals[1]?.reason as TaskGroupCancellationError).causalError,
    result.cancellation,
  );
  assertEquals((observedSignals[2]?.reason as TaskGroupCancellationError).source, "parent");
});

Deno.test("deadline budgets propagate through nested tasks and resources without extension", async () => {
  const scheduler = new VirtualTimerScheduler();
  const rootDeadline = new DeadlineBudget({ scheduler, timeoutMs: 50 });
  const root = new TaskGroup({ id: "deadline-root", deadline: rootDeadline });
  const child = root.createChild({ id: "deadline-child", deadline: { timeoutMs: 20 } });
  const grandchild = child.createChild({ id: "deadline-grandchild", deadline: { deadlineMs: 100 } });

  assertStrictEquals(root.deadline, rootDeadline);
  assertEquals(child.deadline?.deadlineMs, 20);
  assertEquals(grandchild.deadline?.deadlineMs, 20);
  assertEquals(grandchild.deadline?.limitedByParent, true);

  const rootTask = root.spawn(async ({ signal, deadline }) => {
    assertStrictEquals(deadline, rootDeadline);
    const resource = deadline!.createChild({ timeoutMs: 500 });
    assertEquals(resource.deadlineMs, 50);
    resource.dispose("resource complete");
    await waitForAbort(signal);
    throw signal.reason;
  });
  const childTask = child.spawn(async ({ signal, deadline }) => {
    assertStrictEquals(deadline, child.deadline);
    assertEquals(deadline?.remainingMs(), 20);
    await waitForAbort(signal);
    throw signal.reason;
  });
  await flushMicrotasks();

  scheduler.advanceTo(20);
  assertEquals(root.signal.aborted, false);
  assertEquals(child.signal.aborted, true);
  assertEquals(child.signal.reason.source, "deadline");
  assertInstanceOf(child.signal.reason.causalError, DeadlineExceededError);
  assertEquals((await childTask.result).status, "cancelled");

  scheduler.advanceTo(50);
  assertEquals(root.signal.reason.source, "deadline");
  assertInstanceOf(root.signal.reason.causalError, DeadlineExceededError);
  const result = await root.join();
  assertEquals(result.status, "cancelled");
  assertEquals(result.cancellation?.source, "deadline");
  assertEquals((await rootTask.result).status, "cancelled");
  assertEquals(rootDeadline.status, "expired");
});

Deno.test("task-local deadline tightening cancels only its task", async () => {
  const scheduler = new VirtualTimerScheduler();
  const deadline = new DeadlineBudget({ scheduler, timeoutMs: 100 });
  const group = new TaskGroup({ id: "task-deadline", deadline });
  const timed = group.spawn(async ({ signal, deadline: taskDeadline }) => {
    assertEquals(taskDeadline?.deadlineMs, 10);
    await waitForAbort(signal);
    throw signal.reason;
  }, { deadline: { timeoutMs: 10 } });
  const sibling = group.spawn(({ signal, deadline: inherited }) => {
    assertStrictEquals(inherited, deadline);
    assertEquals(signal.aborted, false);
    return "still-running";
  });
  await flushMicrotasks();

  scheduler.advanceTo(10);
  const timedResult = await timed.result;
  assertEquals(timedResult.status, "cancelled");
  if (timedResult.status === "cancelled") assertEquals(timedResult.error.source, "deadline");
  assertEquals(group.signal.aborted, false);
  assertEquals(await sibling.result, {
    id: sibling.id,
    name: undefined,
    status: "fulfilled",
    value: "still-running",
  });
  assertEquals((await group.join()).status, "completed");
  assertEquals(deadline.status, "active");
  deadline.dispose();
});

Deno.test("deadline constraints require an inherited group budget", () => {
  const group = new TaskGroup({ id: "no-deadline" });
  assertThrows(() => group.spawn(() => undefined, { deadline: { timeoutMs: 1 } }), TypeError);
  assertThrows(() => group.createChild({ deadline: { timeoutMs: 1 } }), TypeError);
});

Deno.test("fail-fast aborts siblings on the first failure but still joins cleanup", async () => {
  const group = new TaskGroup({ id: "fast", failurePolicy: "fail-fast" });
  const trigger = deferred<void>();
  const cleanup = deferred<void>();
  const marker = new Error("primary task rejected work");
  const primary = group.spawn(async () => {
    await trigger.promise;
    throw marker;
  }, { name: "primary" });
  const sibling = group.spawn(async ({ signal }) => {
    await waitForAbort(signal);
    await cleanup.promise;
    throw signal.reason;
  }, { name: "sibling" });
  const joining = group.join();
  let joined = false;
  void joining.then(() => {
    joined = true;
  });

  trigger.resolve();
  await flushMicrotasks();
  assertEquals(group.signal.aborted, true);
  assertInstanceOf(group.signal.reason, TaskGroupCancellationError);
  assertEquals(group.signal.reason.source, "fail-fast");
  assertStrictEquals(group.signal.reason.causalError, marker);
  assertEquals(joined, false);

  cleanup.resolve();
  const result = await joining;
  assertEquals(result.status, "failed");
  assertInstanceOf(result.error, TaskGroupAggregateError);
  assertEquals(result.error?.errors, [marker]);
  assertEquals(result.failures.map((failure) => failure.taskName), ["primary"]);
  assertEquals((await primary.result).status, "failed");
  const siblingResult = await sibling.result;
  assertEquals(siblingResult.status, "cancelled");
  if (siblingResult.status === "cancelled") {
    assertStrictEquals(siblingResult.error, group.signal.reason);
  }
});

Deno.test("fail-late preserves causal failure order and never aborts peers", async () => {
  const group = new TaskGroup({ id: "late", failurePolicy: "fail-late" });
  const gates = [deferred<void>(), deferred<void>(), deferred<void>()];
  const errors = [new Error("first"), new Error("second"), new Error("third")];
  const handles = gates.map((gate, index) =>
    group.spawn(async () => {
      await gate.promise;
      throw errors[index];
    }, { name: `task-${index + 1}` })
  );
  const joining = group.join();

  gates[1]!.resolve();
  await flushMicrotasks();
  gates[2]!.resolve();
  await flushMicrotasks();
  gates[0]!.resolve();
  const result = await joining;

  assertEquals(group.signal.aborted, false);
  assertEquals(result.status, "failed");
  assertInstanceOf(result.error, TaskGroupAggregateError);
  assertEquals(result.error?.errors, [errors[1], errors[2], errors[0]]);
  assertEquals(result.failures.map((failure) => failure.sequence), [1, 2, 3]);
  assertEquals(result.failures.map((failure) => failure.taskName), ["task-2", "task-3", "task-1"]);
  assertEquals((await Promise.all(handles.map((handle) => handle.result))).map((entry) => entry.status), [
    "failed",
    "failed",
    "failed",
  ]);
});

Deno.test("an unrelated failure racing cancellation remains a causal failure", async () => {
  const group = new TaskGroup({ id: "race", failurePolicy: "fail-late" });
  const failureGate = deferred<void>();
  const marker = new Error("late non-cancellation rejection");
  const failed = group.spawn(async () => {
    await failureGate.promise;
    throw marker;
  });
  const cancelled = group.spawn(async ({ signal }) => {
    await waitForAbort(signal);
    throw signal.reason;
  });
  await flushMicrotasks();

  group.cancel("operator stop");
  failureGate.resolve();
  const result = await group.join();

  assertEquals(result.status, "failed");
  assertEquals(result.error?.errors, [marker]);
  assertEquals((await failed.result).status, "failed");
  const cancelledResult = await cancelled.result;
  assertEquals(cancelledResult.status, "cancelled");
  if (cancelledResult.status === "cancelled") {
    assertStrictEquals(cancelledResult.error, group.signal.reason);
  }
});

Deno.test("self-thrown cancellation errors fail tasks whose signal was never aborted", async () => {
  const marker = new TaskGroupCancellationError("cancel", "not an abort");
  const group = new TaskGroup({ id: "self-cancellation", failurePolicy: "fail-late" });
  const task = group.spawn(({ signal }) => {
    assertEquals(signal.aborted, false);
    throw marker;
  });

  const result = await group.join();

  assertEquals(group.signal.aborted, false);
  assertEquals(result.status, "failed");
  assertEquals(result.error?.errors, [marker]);
  assertEquals(result.failures.map((failure) => failure.error), [marker]);
  assertEquals(await task.result, {
    id: task.id,
    name: undefined,
    status: "failed",
    error: marker,
  });
});

Deno.test("detached tasks outlive a group only under explicit supervisor ownership", async () => {
  const supervisor = new RecordingSupervisor();
  const group = new TaskGroup({ id: "detached-root", supervisor });
  const gate = deferred<number>();
  const task = group.spawn(async ({ signal }) => {
    const value = await gate.promise;
    assertEquals(signal.aborted, false);
    return value;
  }, { name: "background" });

  assertEquals(task.detach(), true);
  assertEquals(task.detach(), false);
  assertEquals(task.inspect().status, "detached");
  assertEquals(supervisor.inspect(), { owned: 1, pending: 1 });

  const disposed = await group.dispose();
  assertEquals(disposed.status, "cancelled");
  assertEquals(disposed.counts.detached, 1);
  assertEquals(task.signal.aborted, false);

  let supervisorJoined = false;
  const supervisedJoin = supervisor.join().then((results) => {
    supervisorJoined = true;
    return results;
  });
  await flushMicrotasks();
  assertEquals(supervisorJoined, false);
  gate.resolve(42);
  assertEquals(await task.result, {
    id: task.id,
    name: "background",
    status: "fulfilled",
    value: 42,
  });
  assertEquals(await supervisedJoin, [{
    id: "detached-root/task-1",
    kind: "task",
    status: "fulfilled",
    errors: [],
  }]);

  const unsupervised = new TaskGroup({ id: "unsupervised" });
  const probe = unsupervised.spawn(async ({ signal }) => {
    await waitForAbort(signal);
    throw signal.reason;
  });
  assertEquals(probe.detach(), false);
  assertEquals((await unsupervised.dispose()).status, "cancelled");
  assertEquals((await probe.result).status, "cancelled");
});

Deno.test("nested groups may detach only by transferring their join to the supervisor", async () => {
  const supervisor = new RecordingSupervisor();
  const root = new TaskGroup({ id: "root", supervisor });
  const child = root.createChild({ id: "worker-group" });
  const gate = deferred<string>();
  const childTask = child.spawn(async ({ signal }) => {
    const value = await gate.promise;
    assertEquals(signal.aborted, false);
    return value;
  });

  assertEquals(child.detach(), true);
  assertEquals(root.inspect().counts.detachedChildren, 1);
  assertEquals((await root.dispose()).status, "cancelled");
  assertEquals(child.signal.aborted, false);
  assertEquals(child.status, "closing");

  gate.resolve("done");
  assertEquals((await childTask.result).status, "fulfilled");
  assertEquals(await supervisor.join(), [{
    id: "worker-group",
    kind: "group",
    status: "fulfilled",
    errors: [],
  }]);
  assertEquals(child.status, "joined");
});

Deno.test("closing rejects reentrant spawn while diagnostic observers remain isolated", async () => {
  const gate = deferred<void>();
  const marker = new Error("task rejection remains observed");
  const diagnostics: string[] = [];
  const group = new TaskGroup({
    id: "closing",
    failurePolicy: "fail-late",
    onDiagnostic: (diagnostic) => {
      diagnostics.push(diagnostic.code);
      throw new Error("diagnostic observer rejected work");
    },
  });
  group.spawn(async () => {
    await gate.promise;
    assertThrows(() => group.spawn(() => undefined), TaskGroupClosedError);
    throw marker;
  });

  const joining = group.join();
  gate.resolve();
  const result = await joining;

  assertEquals(result.status, "failed");
  assertEquals(result.error?.errors, [marker]);
  assertEquals(diagnostics, ["spawn-rejected", "task-failed"]);
});

Deno.test("inspection is bounded defensive and excludes task values and closures", async () => {
  const group = new TaskGroup({
    id: "inspection",
    failurePolicy: "fail-late",
    maxInspectionEntries: 1,
  });
  group.spawn(() => "VALUE_MUST_NOT_APPEAR");
  group.spawn(() => {
    throw new Error("first inspected error");
  });
  group.spawn(() => {
    throw new Error("second inspected error");
  });
  group.createChild({ id: "child-a" });
  group.createChild({ id: "child-b" });
  await flushMicrotasks();

  const snapshot = group.inspect();
  assertEquals(snapshot.tasks.length, 1);
  assertEquals(snapshot.errors.length, 1);
  assertEquals(snapshot.children.length, 1);
  assertEquals(snapshot.truncatedTasks, 2);
  assertEquals(snapshot.truncatedErrors, 1);
  assertEquals(snapshot.truncatedChildren, 1);
  assertEquals(JSON.stringify(snapshot).includes("VALUE_MUST_NOT_APPEAR"), false);
  assertEquals(JSON.stringify(snapshot).includes("function"), false);

  snapshot.tasks.length = 0;
  snapshot.errors[0]!.message = "mutated";
  snapshot.children[0]!.groupId = "mutated";
  snapshot.counts.spawned = 999;
  const fresh = group.inspect();
  assertEquals(fresh.tasks.length, 1);
  assertEquals(fresh.errors[0]?.message, "first inspected error");
  assertEquals(fresh.children[0]?.groupId, "child-a");
  assertEquals(fresh.counts.spawned, 3);

  assertEquals((await group.dispose()).status, "failed");
});

Deno.test("dispose cancellation and settlement are idempotent", async () => {
  const cleanup = deferred<void>();
  const group = new TaskGroup({ id: "cleanup" });
  const task = group.spawn(async ({ signal }) => {
    await waitForAbort(signal);
    await cleanup.promise;
    throw signal.reason;
  });
  await flushMicrotasks();

  const firstDispose = group.dispose();
  const secondDispose = group.dispose();
  const joining = group.join();
  assertStrictEquals(firstDispose, secondDispose);
  assertEquals(group.status, "cancelling");
  assertThrows(() => group.spawn(() => undefined), TaskGroupClosedError);

  cleanup.resolve();
  const disposedResult = await firstDispose;
  const joinedResult = await joining;
  assertStrictEquals(disposedResult, joinedResult);
  assertEquals(disposedResult.status, "cancelled");
  assertEquals(disposedResult.cancellation?.source, "dispose");
  assertEquals((await task.result).status, "cancelled");
  assertEquals(group.status, "disposed");
  assertEquals(group.cancel(), false);
  assertEquals(group.close(), false);
});

class RecordingSupervisor implements TaskSupervisor {
  readonly tasks: SupervisedTask[] = [];
  readonly #pending = new Set<string>();

  adopt(task: SupervisedTask): void {
    this.tasks.push(task);
    this.#pending.add(task.id);
    void task.settlement.then(() => {
      this.#pending.delete(task.id);
    });
  }

  inspect(): TaskSupervisorInspection {
    return { owned: this.tasks.length, pending: this.#pending.size };
  }

  join(): Promise<readonly SupervisedTaskSettlement[]> {
    return Promise.all(this.tasks.map((task) => task.settlement));
  }
}

function deferred<Value>(): {
  promise: Promise<Value>;
  resolve: (value: Value | PromiseLike<Value>) => void;
  reject: (reason?: unknown) => void;
} {
  let resolve!: (value: Value | PromiseLike<Value>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<Value>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
}

function waitForAbort(signal: AbortSignal): Promise<void> {
  if (signal.aborted) return Promise.resolve();
  return new Promise((resolve) => {
    signal.addEventListener("abort", () => resolve(), { once: true });
  });
}

async function flushMicrotasks(turns = 6): Promise<void> {
  for (let turn = 0; turn < turns; turn += 1) await Promise.resolve();
}
