// Copyright 2023 Im-Beast. MIT license.

import { DeadlineBudget, type DeadlineBudgetChildOptions, type DeadlineBudgetInspection } from "./deadline.ts";

/** JSON-shaped immutable context accepted by structured task groups. */
export type TaskGroupContextValue =
  | null
  | boolean
  | number
  | string
  | readonly TaskGroupContextValue[]
  | Readonly<{ [key: string]: TaskGroupContextValue }>;

/** Deep readonly projection used by task execution contexts. */
export type ImmutableTaskGroupContext<Value extends TaskGroupContextValue> = Value extends
  null | boolean | number | string ? Value
  : Value extends readonly (infer Item extends TaskGroupContextValue)[] ? readonly ImmutableTaskGroupContext<Item>[]
  : Value extends Readonly<Record<string, TaskGroupContextValue>> ? {
      readonly [Key in keyof Value]: Value[Key] extends TaskGroupContextValue ? ImmutableTaskGroupContext<Value[Key]>
        : never;
    }
  : never;

/** Failure behavior for attached tasks and child groups. */
export type TaskGroupFailurePolicy = "fail-fast" | "fail-late";

/** Observable lifecycle of a task group. */
export type TaskGroupStatus = "open" | "closing" | "cancelling" | "joined" | "disposed";

/** Observable lifecycle of a spawned task. */
export type TaskStatus = "scheduled" | "running" | "fulfilled" | "failed" | "cancelled" | "detached";

/** Origin of a structured cancellation. */
export type TaskGroupCancellationSource =
  | "cancel"
  | "dispose"
  | "parent"
  | "fail-fast"
  | "supervisor"
  | "deadline";

/** Immutable execution input supplied to every spawned task. */
export interface TaskExecutionContext<Context extends TaskGroupContextValue> {
  readonly signal: AbortSignal;
  readonly context: ImmutableTaskGroupContext<Context>;
  /** Effective inherited or task-tightened timeout budget, when configured. */
  readonly deadline?: DeadlineBudget;
}

/** Work accepted by a task group. */
export type TaskGroupTask<Context extends TaskGroupContextValue, Value> = (
  execution: TaskExecutionContext<Context>,
) => Value | PromiseLike<Value>;

/** Optional task metadata. */
export interface TaskSpawnOptions {
  name?: string;
  /** Optional task-local tightening of the group's inherited deadline. */
  deadline?: DeadlineBudgetChildOptions;
}

/** Successful task result. Task result promises never reject. */
export interface TaskFulfilledResult<Value> {
  readonly id: number;
  readonly name?: string;
  readonly status: "fulfilled";
  readonly value: Value;
}

/** Failed task result. Task result promises never reject. */
export interface TaskFailedResult {
  readonly id: number;
  readonly name?: string;
  readonly status: "failed";
  readonly error: unknown;
}

/** Cooperatively cancelled task result. Task result promises never reject. */
export interface TaskCancelledResult {
  readonly id: number;
  readonly name?: string;
  readonly status: "cancelled";
  readonly error: TaskGroupCancellationError;
}

/** Always-settling result for one task. */
export type TaskResult<Value> = TaskFulfilledResult<Value> | TaskFailedResult | TaskCancelledResult;

/** Clone-safe task state. Values and callbacks are never included. */
export interface TaskHandleInspection {
  id: number;
  sequence: number;
  name?: string;
  status: TaskStatus;
  signalAborted: boolean;
  deadline?: DeadlineBudgetInspection;
  error?: TaskGroupErrorInspection;
}

/** Handle returned for attached work. Detachment requires the group's injected supervisor. */
export interface TaskHandle<Value> {
  readonly id: number;
  readonly name?: string;
  readonly signal: AbortSignal;
  readonly result: Promise<TaskResult<Value>>;
  detach(): boolean;
  inspect(): TaskHandleInspection;
}

/** Raw failure record ordered by causal observation. */
export interface TaskGroupFailure {
  readonly sequence: number;
  readonly taskId: string;
  readonly taskName?: string;
  readonly source: "task" | "child";
  readonly error: unknown;
}

/** Clone-safe failure or cancellation summary. */
export interface TaskGroupErrorInspection {
  name: string;
  message: string;
}

/** Clone-safe failure record. */
export interface TaskGroupFailureInspection extends TaskGroupErrorInspection {
  sequence: number;
  taskId: string;
  taskName?: string;
  source: "task" | "child";
}

/** Aggregate counts for a task group. */
export interface TaskGroupCounts {
  spawned: number;
  scheduled: number;
  running: number;
  fulfilled: number;
  failed: number;
  cancelled: number;
  detached: number;
  childGroups: number;
  attachedChildren: number;
  settledChildren: number;
  detachedChildren: number;
}

/** Bounded clone-safe summary for a direct child group. */
export interface TaskGroupChildInspection {
  id: number;
  sequence: number;
  groupId: string;
  name?: string;
  status: TaskGroupStatus;
  signalAborted: boolean;
  pending: number;
  failures: number;
  detached: boolean;
  settled: boolean;
}

/** Bounded clone-safe task-group state. */
export interface TaskGroupInspection {
  id: string;
  name?: string;
  status: TaskGroupStatus;
  failurePolicy: TaskGroupFailurePolicy;
  signalAborted: boolean;
  deadline?: DeadlineBudgetInspection;
  counts: TaskGroupCounts;
  inspectionLimit: number;
  truncatedTasks: number;
  truncatedErrors: number;
  truncatedChildren: number;
  tasks: TaskHandleInspection[];
  errors: TaskGroupFailureInspection[];
  children: TaskGroupChildInspection[];
}

/** Clone-safe diagnostic emitted by task-group lifecycle edges. */
export interface TaskGroupDiagnostic {
  sequence: number;
  groupId: string;
  code:
    | "task-failed"
    | "child-failed"
    | "group-cancelled"
    | "spawn-rejected"
    | "detach-rejected"
    | "supervisor-rejected";
  message: string;
  taskId?: string;
}

/** Task-group construction options. */
export interface TaskGroupOptions<Context extends TaskGroupContextValue = Readonly<Record<string, never>>> {
  id?: string;
  name?: string;
  context?: Context;
  failurePolicy?: TaskGroupFailurePolicy;
  supervisor?: TaskSupervisor;
  maxInspectionEntries?: number;
  onDiagnostic?: (diagnostic: TaskGroupDiagnostic) => void;
  /** Caller-owned root budget propagated to tasks, resources, and children. */
  deadline?: DeadlineBudget;
}

/** Child groups inherit the parent's supervisor and use an independently immutable context. */
export interface TaskGroupChildOptions<Context extends TaskGroupContextValue> {
  id?: string;
  name?: string;
  context?: Context;
  failurePolicy?: TaskGroupFailurePolicy;
  maxInspectionEntries?: number;
  onDiagnostic?: (diagnostic: TaskGroupDiagnostic) => void;
  /** Optional child-group tightening of the parent's deadline budget. */
  deadline?: DeadlineBudgetChildOptions;
}

/** Always-settling group join result. */
export interface TaskGroupResult {
  readonly id: string;
  readonly status: "completed" | "failed" | "cancelled";
  readonly failurePolicy: TaskGroupFailurePolicy;
  readonly counts: TaskGroupCounts;
  readonly failures: readonly TaskGroupFailure[];
  readonly error?: TaskGroupAggregateError;
  readonly cancellation?: TaskGroupCancellationError;
}

/** Clone-safe supervisor status. */
export interface TaskSupervisorInspection {
  owned: number;
  pending: number;
}

/** Value-free settlement used at the supervisor ownership boundary. */
export interface SupervisedTaskSettlement {
  readonly id: string;
  readonly kind: "task" | "group";
  readonly status: "fulfilled" | "failed" | "cancelled";
  readonly errors: readonly unknown[];
}

/** Explicit ownership unit transferred by detach. */
export interface SupervisedTask {
  readonly id: string;
  readonly kind: "task" | "group";
  readonly signal: AbortSignal;
  readonly settlement: Promise<SupervisedTaskSettlement>;
  cancel(reason?: unknown): boolean;
  inspect(): TaskHandleInspection | TaskGroupInspection;
}

/**
 * Required owner for detached work. An implementation must retain adopted
 * tasks and include them in its inspection and join operations.
 */
export interface TaskSupervisor {
  adopt(task: SupervisedTask): void;
  inspect(): TaskSupervisorInspection;
  join(): Promise<readonly SupervisedTaskSettlement[]>;
}

/** Structured abort reason propagated through group-owned AbortSignals. */
export class TaskGroupCancellationError extends Error {
  readonly code = "TASK_GROUP_CANCELLED";

  constructor(
    readonly source: TaskGroupCancellationSource,
    readonly reason?: unknown,
    readonly causalError?: unknown,
  ) {
    super(cancellationMessage(source));
    this.name = "TaskGroupCancellationError";
  }
}

/** Raised when work is added after closing or disposal starts. */
export class TaskGroupClosedError extends Error {
  constructor(readonly groupId: string, readonly status: TaskGroupStatus) {
    super(`Task group "${groupId}" does not accept work while ${status}.`);
    this.name = "TaskGroupClosedError";
  }
}

/** Typed causally ordered aggregate for a failed group result. */
export class TaskGroupAggregateError extends AggregateError {
  readonly failures: readonly TaskGroupFailure[];

  constructor(readonly groupId: string, failures: readonly TaskGroupFailure[]) {
    const ordered = Object.freeze(failures.slice());
    super(
      ordered.map((failure) => failure.error),
      `Task group "${groupId}" observed ${ordered.length} failure(s).`,
    );
    this.name = "TaskGroupAggregateError";
    this.failures = ordered;
    Object.freeze(this.errors);
  }
}

interface InternalTaskRecord {
  id: number;
  sequence: number;
  name?: string;
  executionStatus: "scheduled" | "running" | "fulfilled" | "failed" | "cancelled";
  detached: boolean;
  controller: AbortController;
  unlinkGroupAbort?: () => void;
  deadline?: DeadlineBudget;
  ownsDeadline: boolean;
  unlinkDeadlineAbort?: () => void;
  result: Promise<TaskResult<unknown>>;
  resolveResult?: (result: TaskResult<unknown>) => void;
  error?: unknown;
}

interface InternalChildRecord<Context extends TaskGroupContextValue> {
  id: number;
  sequence: number;
  group: TaskGroup<Context>;
  detached: boolean;
  joining: boolean;
  settled: boolean;
  result?: TaskGroupResult;
  unlinkParentAbort?: () => void;
}

interface InternalParentLink<Context extends TaskGroupContextValue> {
  parent: TaskGroup<Context>;
  record: InternalChildRecord<Context>;
}

const DEFAULT_INSPECTION_LIMIT = 100;

/** Renderer-neutral structured-concurrency task group. */
export class TaskGroup<Context extends TaskGroupContextValue = Readonly<Record<string, never>>> {
  readonly id: string;
  readonly name?: string;
  readonly signal: AbortSignal;
  readonly context: ImmutableTaskGroupContext<Context>;

  readonly #failurePolicy: TaskGroupFailurePolicy;
  readonly #supervisor?: TaskSupervisor;
  readonly #maxInspectionEntries: number;
  readonly #onDiagnostic?: (diagnostic: TaskGroupDiagnostic) => void;
  readonly #controller = new AbortController();
  readonly #tasks = new Map<number, InternalTaskRecord>();
  readonly #children = new Map<number, InternalChildRecord<Context>>();
  readonly #failures: TaskGroupFailure[] = [];
  #deadline?: DeadlineBudget;
  #ownsDeadline = false;
  #unlinkDeadlineAbort?: () => void;
  #parentLink?: InternalParentLink<Context>;
  #status: TaskGroupStatus = "open";
  #nextTaskId = 1;
  #nextTaskSequence = 0;
  #nextChildId = 1;
  #nextChildSequence = 0;
  #nextFailureSequence = 1;
  #nextDiagnosticSequence = 1;
  #joinRequested = false;
  #joinPromise?: Promise<TaskGroupResult>;
  #resolveJoin?: (result: TaskGroupResult) => void;
  #joinResult?: TaskGroupResult;
  #disposeRequested = false;
  #disposePromise?: Promise<TaskGroupResult>;
  #descendantCancelled = false;

  constructor(options: TaskGroupOptions<Context> = {}) {
    this.id = validateIdentifier(options.id ?? "task-group", "id");
    this.name = validateOptionalName(options.name);
    this.context = cloneImmutableContext(
      (options.context ?? {}) as Context,
    );
    this.#failurePolicy = options.failurePolicy ?? "fail-fast";
    this.#supervisor = options.supervisor;
    this.#maxInspectionEntries = validateNonNegativeInteger(
      options.maxInspectionEntries ?? DEFAULT_INSPECTION_LIMIT,
      "maxInspectionEntries",
    );
    this.#onDiagnostic = options.onDiagnostic;
    this.signal = this.#controller.signal;
    if (options.deadline !== undefined) {
      this.attachDeadline(options.deadline, false);
    }
  }

  get status(): TaskGroupStatus {
    return this.#status;
  }

  get failurePolicy(): TaskGroupFailurePolicy {
    return this.#failurePolicy;
  }

  /** Effective budget inherited by this group's tasks and resources. */
  get deadline(): DeadlineBudget | undefined {
    return this.#deadline;
  }

  /** Starts one attached task. Its result promise always fulfills. */
  spawn<Value>(
    task: TaskGroupTask<Context, Value>,
    options: TaskSpawnOptions = {},
  ): TaskHandle<Value> {
    this.assertOpen("spawn");
    if (typeof task !== "function") throw new TypeError("Task must be a function.");
    const id = this.#nextTaskId++;
    const sequence = this.#nextTaskSequence++;
    const name = validateOptionalName(options.name);
    if (options.deadline !== undefined && !this.#deadline) {
      throw new TypeError("A task-local deadline requires a task-group deadline.");
    }
    const taskDeadline = options.deadline === undefined
      ? this.#deadline
      : this.#deadline!.createChild(options.deadline);
    const ownsDeadline = options.deadline !== undefined;
    const controller = new AbortController();
    const deferred = createDeferred<TaskResult<Value>>();
    const record: InternalTaskRecord = {
      id,
      sequence,
      name,
      executionStatus: "scheduled",
      detached: false,
      controller,
      deadline: taskDeadline,
      ownsDeadline,
      result: deferred.promise as Promise<TaskResult<unknown>>,
      resolveResult: deferred.resolve as (result: TaskResult<unknown>) => void,
    };
    record.unlinkGroupAbort = linkAbort(this.signal, controller, (reason) => reason);
    if (ownsDeadline && taskDeadline) {
      record.unlinkDeadlineAbort = observeAbort(taskDeadline.signal, (reason) => {
        if (!controller.signal.aborted) {
          controller.abort(new TaskGroupCancellationError("deadline", reason, reason));
        }
      });
    }
    this.#tasks.set(id, record);

    const execution = Object.freeze({
      signal: controller.signal,
      context: this.context,
      deadline: taskDeadline,
    }) as TaskExecutionContext<Context>;

    const invocation = Promise.resolve().then(() => {
      record.executionStatus = "running";
      return task(execution);
    });
    void invocation.then(
      (value) => this.settleTask(record, value),
      (error) => this.rejectTask(record, error),
    ).catch((error) => this.rejectTask(record, error));

    return Object.freeze({
      id,
      name,
      signal: controller.signal,
      result: deferred.promise,
      detach: (): boolean => this.detachTask(record),
      inspect: (): TaskHandleInspection => inspectTask(record),
    });
  }

  /** Creates an attached child group inheriting supervisor ownership. */
  createChild(options: TaskGroupChildOptions<Context> = {}): TaskGroup<Context> {
    this.assertOpen("spawn");
    if (options.deadline !== undefined && !this.#deadline) {
      throw new TypeError("A child deadline requires a parent task-group deadline.");
    }
    const id = this.#nextChildId++;
    const sequence = this.#nextChildSequence++;
    const childDeadline = this.#deadline?.createChild(options.deadline);
    let child: TaskGroup<Context>;
    try {
      child = new TaskGroup<Context>({
        id: options.id ?? `${this.id}/child-${id}`,
        name: options.name,
        context: (options.context ?? this.context) as Context,
        failurePolicy: options.failurePolicy ?? this.#failurePolicy,
        supervisor: this.#supervisor,
        maxInspectionEntries: options.maxInspectionEntries ?? this.#maxInspectionEntries,
        onDiagnostic: options.onDiagnostic ?? this.#onDiagnostic,
      });
    } catch (error) {
      childDeadline?.dispose(error);
      throw error;
    }
    if (childDeadline) child.attachDeadline(childDeadline, true);
    const record: InternalChildRecord<Context> = {
      id,
      sequence,
      group: child,
      detached: false,
      joining: false,
      settled: false,
    };
    record.unlinkParentAbort = observeAbort(this.signal, (reason) => {
      child.abortGroup(new TaskGroupCancellationError("parent", reason, reason));
    });
    child.#parentLink = { parent: this, record };
    this.#children.set(id, record);
    return child;
  }

  /** Stops accepting work without cancelling already attached work. */
  close(): boolean {
    if (this.#status !== "open") return false;
    this.#status = "closing";
    for (const child of this.#children.values()) {
      if (!child.detached) child.group.close();
    }
    return true;
  }

  /** Propagates one typed cancellation reason to attached descendants. */
  cancel(reason?: unknown): boolean {
    return this.abortGroup(
      reason instanceof TaskGroupCancellationError ? reason : new TaskGroupCancellationError("cancel", reason),
    );
  }

  /** Closes and deterministically waits for every non-detached descendant. */
  join(): Promise<TaskGroupResult> {
    if (this.#joinPromise) return this.#joinPromise;
    const deferred = createDeferred<TaskGroupResult>();
    this.#joinPromise = deferred.promise;
    this.#resolveJoin = deferred.resolve;
    this.#joinRequested = true;
    this.close();
    this.beginChildJoins();
    this.maybeFinalize();
    return this.#joinPromise;
  }

  /** Cancels, joins, and settles once. Repeated calls return the same promise. */
  dispose(): Promise<TaskGroupResult> {
    if (this.#disposePromise) return this.#disposePromise;
    this.#disposeRequested = true;
    if (!this.#joinResult) {
      this.abortGroup(new TaskGroupCancellationError("dispose"));
    }
    const joined = this.join();
    this.#disposePromise = joined.then((result) => {
      this.#status = "disposed";
      return result;
    });
    return this.#disposePromise;
  }

  /**
   * Transfers a child group to the injected supervisor. Root groups and groups
   * that have begun closing, cancellation, or failure cannot detach.
   */
  detach(): boolean {
    const link = this.#parentLink;
    if (!link) {
      this.emitDiagnostic("detach-rejected", "Root task groups cannot detach.");
      return false;
    }
    return link.parent.detachChild(link.record);
  }

  inspect(): TaskGroupInspection {
    // A caller-owned deadline clock may reenter and transition the group while
    // it is inspected. Observe it before capturing any group lifecycle fields.
    const deadline = this.#deadline?.inspect();
    const counts = this.snapshotCounts();
    const tasks = [...this.#tasks.values()].sort(compareTaskRecords);
    const failures = this.#failures.slice();
    const children = [...this.#children.values()].sort(compareChildRecords);
    return {
      id: this.id,
      name: this.name,
      status: this.#status,
      failurePolicy: this.#failurePolicy,
      signalAborted: this.signal.aborted,
      deadline,
      counts,
      inspectionLimit: this.#maxInspectionEntries,
      truncatedTasks: Math.max(0, tasks.length - this.#maxInspectionEntries),
      truncatedErrors: Math.max(0, failures.length - this.#maxInspectionEntries),
      truncatedChildren: Math.max(0, children.length - this.#maxInspectionEntries),
      tasks: tasks.slice(0, this.#maxInspectionEntries).map(inspectTask),
      errors: failures.slice(0, this.#maxInspectionEntries).map(inspectFailure),
      children: children.slice(0, this.#maxInspectionEntries).map((child) => this.inspectChild(child)),
    };
  }

  private assertOpen(operation: "spawn"): void {
    if (this.#status === "open") return;
    const error = new TaskGroupClosedError(this.id, this.#status);
    this.emitDiagnostic(
      "spawn-rejected",
      `Task ${operation} was rejected after group closing began.`,
    );
    throw error;
  }

  private settleTask(record: InternalTaskRecord, value: unknown): void {
    if (isTaskTerminal(record.executionStatus)) return;
    record.executionStatus = "fulfilled";
    record.unlinkGroupAbort?.();
    record.unlinkGroupAbort = undefined;
    releaseTaskDeadline(record);
    record.resolveResult?.(Object.freeze({
      id: record.id,
      name: record.name,
      status: "fulfilled",
      value,
    }));
    record.resolveResult = undefined;
    this.maybeFinalize();
  }

  private rejectTask(record: InternalTaskRecord, error: unknown): void {
    if (isTaskTerminal(record.executionStatus)) return;
    record.unlinkGroupAbort?.();
    record.unlinkGroupAbort = undefined;
    releaseTaskDeadline(record);
    record.error = error;
    const cancellation = cancellationFor(record.controller.signal, error);
    if (cancellation) {
      record.executionStatus = "cancelled";
      record.resolveResult?.(Object.freeze({
        id: record.id,
        name: record.name,
        status: "cancelled",
        error: cancellation,
      }));
    } else {
      record.executionStatus = "failed";
      record.resolveResult?.(Object.freeze({
        id: record.id,
        name: record.name,
        status: "failed",
        error,
      }));
      if (!record.detached) {
        this.recordFailure({
          taskId: String(record.id),
          taskName: record.name,
          source: "task",
          error,
        });
      }
    }
    record.resolveResult = undefined;
    this.maybeFinalize();
  }

  private recordFailure(input: Omit<TaskGroupFailure, "sequence">): void {
    const failure = Object.freeze({
      ...input,
      sequence: this.#nextFailureSequence++,
    });
    this.#failures.push(failure);
    this.emitDiagnostic(
      input.source === "task" ? "task-failed" : "child-failed",
      `Attached ${input.source} reported an error.`,
      input.taskId,
    );
    if (this.#failurePolicy === "fail-fast" && !this.signal.aborted) {
      this.abortGroup(new TaskGroupCancellationError("fail-fast", input.error, input.error));
    }
    const parentLink = this.#parentLink;
    if (parentLink && !parentLink.record.detached) {
      parentLink.parent.recordFailure({
        taskId: `${parentLink.record.id}/${failure.taskId}`,
        taskName: failure.taskName ?? this.name,
        source: "child",
        error: failure.error,
      });
    }
  }

  private abortGroup(error: TaskGroupCancellationError): boolean {
    if (this.#joinResult || this.signal.aborted) return false;
    if (this.#status === "open") this.close();
    this.#status = "cancelling";
    this.#controller.abort(error);
    this.emitDiagnostic("group-cancelled", error.message);
    this.beginChildJoins();
    this.maybeFinalize();
    return true;
  }

  private beginChildJoins(): void {
    if (!this.#joinRequested) return;
    for (const record of this.#children.values()) {
      if (record.detached || record.joining) continue;
      record.joining = true;
      void record.group.join().then((result) => {
        record.result = result;
        record.settled = true;
        if (result.status === "cancelled" && !this.signal.aborted) {
          this.#descendantCancelled = true;
        }
        this.maybeFinalize();
      });
    }
  }

  private maybeFinalize(): void {
    if (!this.#joinRequested || this.#joinResult) return;
    if (this.hasPendingAttachedTasks()) return;
    for (const child of this.#children.values()) {
      if (!child.detached && !child.settled) return;
    }

    const failures = Object.freeze(this.#failures.slice());
    const error = failures.length > 0 ? new TaskGroupAggregateError(this.id, failures) : undefined;
    const cancellation = this.signal.aborted && this.signal.reason instanceof TaskGroupCancellationError
      ? this.signal.reason
      : undefined;
    const status = error ? "failed" : cancellation || this.#descendantCancelled ? "cancelled" : "completed";
    const result: TaskGroupResult = Object.freeze({
      id: this.id,
      status,
      failurePolicy: this.#failurePolicy,
      counts: Object.freeze(this.snapshotCounts()),
      failures,
      error,
      cancellation,
    });
    this.#joinResult = result;
    this.#status = this.#disposeRequested ? "disposed" : "joined";
    this.releaseDeadlineAfterJoin(result.counts);
    this.#resolveJoin?.(result);
    this.#resolveJoin = undefined;
  }

  private hasPendingAttachedTasks(): boolean {
    for (const task of this.#tasks.values()) {
      if (!task.detached && (task.executionStatus === "scheduled" || task.executionStatus === "running")) {
        return true;
      }
    }
    return false;
  }

  private detachTask(record: InternalTaskRecord): boolean {
    if (
      this.#status !== "open" || record.detached ||
      (record.executionStatus !== "scheduled" && record.executionStatus !== "running")
    ) {
      this.emitDiagnostic("detach-rejected", "Only live tasks in an open group can detach.", String(record.id));
      return false;
    }
    if (!this.#supervisor) {
      this.emitDiagnostic("detach-rejected", "Task detachment requires an injected supervisor.", String(record.id));
      return false;
    }
    const supervised = createSupervisedTask(this.id, record);
    try {
      this.#supervisor.adopt(supervised);
    } catch {
      this.emitDiagnostic("supervisor-rejected", "Supervisor adoption rejected the task.", String(record.id));
      return false;
    }
    record.detached = true;
    record.unlinkGroupAbort?.();
    record.unlinkGroupAbort = undefined;
    this.maybeFinalize();
    return true;
  }

  private detachChild(record: InternalChildRecord<Context>): boolean {
    if (
      this.#status !== "open" || record.detached || record.settled ||
      record.group.status !== "open" || record.group.signal.aborted || record.group.#failures.length > 0
    ) {
      this.emitDiagnostic(
        "detach-rejected",
        "Only a healthy live child of an open group can detach.",
        String(record.id),
      );
      return false;
    }
    if (!this.#supervisor) {
      this.emitDiagnostic("detach-rejected", "Child detachment requires an injected supervisor.", String(record.id));
      return false;
    }

    const deferred = createDeferred<SupervisedTaskSettlement>();
    const supervised: SupervisedTask = Object.freeze({
      id: record.group.id,
      kind: "group" as const,
      signal: record.group.signal,
      settlement: deferred.promise,
      cancel: (reason?: unknown): boolean =>
        record.group.abortGroup(new TaskGroupCancellationError("supervisor", reason)),
      inspect: (): TaskGroupInspection => record.group.inspect(),
    });
    try {
      this.#supervisor.adopt(supervised);
    } catch {
      this.emitDiagnostic("supervisor-rejected", "Supervisor adoption rejected the child group.", String(record.id));
      return false;
    }

    record.detached = true;
    record.unlinkParentAbort?.();
    record.unlinkParentAbort = undefined;
    record.group.#parentLink = undefined;
    void record.group.join().then((result) => deferred.resolve(supervisedGroupSettlement(result)));
    this.maybeFinalize();
    return true;
  }

  private snapshotCounts(): TaskGroupCounts {
    let scheduled = 0;
    let running = 0;
    let fulfilled = 0;
    let failed = 0;
    let cancelled = 0;
    let detached = 0;
    for (const task of this.#tasks.values()) {
      if (task.detached) {
        detached += 1;
        continue;
      }
      switch (task.executionStatus) {
        case "scheduled":
          scheduled += 1;
          break;
        case "running":
          running += 1;
          break;
        case "fulfilled":
          fulfilled += 1;
          break;
        case "failed":
          failed += 1;
          break;
        case "cancelled":
          cancelled += 1;
          break;
      }
    }
    let attachedChildren = 0;
    let settledChildren = 0;
    let detachedChildren = 0;
    for (const child of this.#children.values()) {
      if (child.detached) detachedChildren += 1;
      else {
        attachedChildren += 1;
        if (child.settled) settledChildren += 1;
      }
    }
    return {
      spawned: this.#tasks.size,
      scheduled,
      running,
      fulfilled,
      failed,
      cancelled,
      detached,
      childGroups: this.#children.size,
      attachedChildren,
      settledChildren,
      detachedChildren,
    };
  }

  private inspectChild(record: InternalChildRecord<Context>): TaskGroupChildInspection {
    const counts = record.group.snapshotCounts();
    return {
      id: record.id,
      sequence: record.sequence,
      groupId: record.group.id,
      name: record.group.name,
      status: record.group.status,
      signalAborted: record.group.signal.aborted,
      pending: counts.scheduled + counts.running + (counts.attachedChildren - counts.settledChildren),
      failures: record.group.#failures.length,
      detached: record.detached,
      settled: record.settled,
    };
  }

  private emitDiagnostic(
    code: TaskGroupDiagnostic["code"],
    message: string,
    taskId?: string,
  ): void {
    if (!this.#onDiagnostic) return;
    const diagnostic: TaskGroupDiagnostic = {
      sequence: this.#nextDiagnosticSequence++,
      groupId: this.id,
      code,
      message,
      taskId,
    };
    try {
      this.#onDiagnostic({ ...diagnostic });
    } catch {
      // Diagnostic observers cannot affect task ownership or settlement.
    }
  }

  private attachDeadline(deadline: DeadlineBudget, owned: boolean): void {
    if (!(deadline instanceof DeadlineBudget)) {
      throw new TypeError("deadline must be a DeadlineBudget.");
    }
    if (this.#deadline) throw new TypeError("A task group can have only one deadline budget.");
    this.#deadline = deadline;
    this.#ownsDeadline = owned;
    this.#unlinkDeadlineAbort = observeAbort(deadline.signal, (reason) => {
      this.abortGroup(new TaskGroupCancellationError("deadline", reason, reason));
    });
  }

  private releaseDeadlineAfterJoin(counts: TaskGroupCounts): void {
    this.#unlinkDeadlineAbort?.();
    this.#unlinkDeadlineAbort = undefined;
    if (this.#ownsDeadline && counts.detached === 0 && counts.detachedChildren === 0) {
      this.#deadline?.dispose("task group settled");
      this.#ownsDeadline = false;
    }
  }
}

/** Creates a structured task group. */
export function createTaskGroup<Context extends TaskGroupContextValue = Readonly<Record<string, never>>>(
  options: TaskGroupOptions<Context> = {},
): TaskGroup<Context> {
  return new TaskGroup(options);
}

/** Returns whether an unknown value is the exact structured cancellation type. */
export function isTaskGroupCancellationError(error: unknown): error is TaskGroupCancellationError {
  return error instanceof TaskGroupCancellationError;
}

function createSupervisedTask(groupId: string, record: InternalTaskRecord): SupervisedTask {
  const settlement = record.result.then((result): SupervisedTaskSettlement => {
    switch (result.status) {
      case "fulfilled":
        return Object.freeze({
          id: `${groupId}/task-${record.id}`,
          kind: "task",
          status: "fulfilled",
          errors: Object.freeze([]),
        });
      case "failed":
        return Object.freeze({
          id: `${groupId}/task-${record.id}`,
          kind: "task",
          status: "failed",
          errors: Object.freeze([result.error]),
        });
      case "cancelled":
        return Object.freeze({
          id: `${groupId}/task-${record.id}`,
          kind: "task",
          status: "cancelled",
          errors: Object.freeze([result.error]),
        });
    }
  });
  return Object.freeze({
    id: `${groupId}/task-${record.id}`,
    kind: "task" as const,
    signal: record.controller.signal,
    settlement,
    cancel: (reason?: unknown): boolean => {
      if (record.controller.signal.aborted || isTaskTerminal(record.executionStatus)) return false;
      record.controller.abort(new TaskGroupCancellationError("supervisor", reason));
      return true;
    },
    inspect: (): TaskHandleInspection => inspectTask(record),
  });
}

function supervisedGroupSettlement(result: TaskGroupResult): SupervisedTaskSettlement {
  return Object.freeze({
    id: result.id,
    kind: "group",
    status: result.status === "completed" ? "fulfilled" : result.status,
    errors: Object.freeze(
      result.error ? [...result.error.errors] : result.cancellation ? [result.cancellation] : [],
    ),
  });
}

function inspectTask(record: InternalTaskRecord): TaskHandleInspection {
  const deadline = record.deadline?.inspect();
  return {
    id: record.id,
    sequence: record.sequence,
    name: record.name,
    status: record.detached ? "detached" : record.executionStatus,
    signalAborted: record.controller.signal.aborted,
    deadline,
    error: record.error === undefined ? undefined : inspectError(record.error),
  };
}

function inspectFailure(failure: TaskGroupFailure): TaskGroupFailureInspection {
  return {
    sequence: failure.sequence,
    taskId: failure.taskId,
    taskName: failure.taskName,
    source: failure.source,
    ...inspectError(failure.error),
  };
}

function inspectError(error: unknown): TaskGroupErrorInspection {
  if (error instanceof Error) {
    return { name: error.name, message: error.message };
  }
  try {
    return { name: typeof error, message: String(error) };
  } catch {
    return { name: typeof error, message: "Unprintable task error" };
  }
}

function cancellationFor(signal: AbortSignal, error: unknown): TaskGroupCancellationError | undefined {
  if (signal.aborted && error === signal.reason && signal.reason instanceof TaskGroupCancellationError) {
    return signal.reason;
  }
  return undefined;
}

function linkAbort(
  parent: AbortSignal,
  child: AbortController,
  mapReason: (reason: unknown) => unknown,
): () => void {
  return observeAbort(parent, (reason) => {
    if (!child.signal.aborted) child.abort(mapReason(reason));
  });
}

function observeAbort(parent: AbortSignal, callback: (reason: unknown) => void): () => void {
  const abort = () => callback(parent.reason);
  if (parent.aborted) abort();
  else parent.addEventListener("abort", abort, { once: true });
  return () => parent.removeEventListener("abort", abort);
}

function isTaskTerminal(status: InternalTaskRecord["executionStatus"]): boolean {
  return status === "fulfilled" || status === "failed" || status === "cancelled";
}

function compareTaskRecords(left: InternalTaskRecord, right: InternalTaskRecord): number {
  return left.sequence - right.sequence;
}

function compareChildRecords<Context extends TaskGroupContextValue>(
  left: InternalChildRecord<Context>,
  right: InternalChildRecord<Context>,
): number {
  return left.sequence - right.sequence;
}

function createDeferred<Value>(): {
  promise: Promise<Value>;
  resolve: (value: Value | PromiseLike<Value>) => void;
} {
  let resolve!: (value: Value | PromiseLike<Value>) => void;
  const promise = new Promise<Value>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function cancellationMessage(source: TaskGroupCancellationSource): string {
  switch (source) {
    case "cancel":
      return "Task group was cancelled.";
    case "dispose":
      return "Task group was disposed.";
    case "parent":
      return "Parent task group was cancelled.";
    case "fail-fast":
      return "Task group cancelled siblings after an attached failure.";
    case "supervisor":
      return "Supervisor cancelled detached work.";
    case "deadline":
      return "Task group deadline was reached or cancelled.";
  }
}

function releaseTaskDeadline(record: InternalTaskRecord): void {
  record.unlinkDeadlineAbort?.();
  record.unlinkDeadlineAbort = undefined;
  if (record.ownsDeadline) {
    record.deadline?.dispose("task settled");
    record.ownsDeadline = false;
  }
}

function validateIdentifier(value: string, name: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new TypeError(`${name} must be a non-empty string.`);
  }
  return value;
}

function validateOptionalName(value: string | undefined): string | undefined {
  return value === undefined ? undefined : validateIdentifier(value, "name");
}

function validateNonNegativeInteger(value: number, name: string): number {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${name} must be a non-negative safe integer.`);
  }
  return value;
}

function cloneImmutableContext<Context extends TaskGroupContextValue>(
  value: Context,
): ImmutableTaskGroupContext<Context> {
  return cloneContextValue(value, new WeakSet<object>()) as ImmutableTaskGroupContext<Context>;
}

function cloneContextValue(value: TaskGroupContextValue, seen: WeakSet<object>): TaskGroupContextValue {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new TypeError("Task group context numbers must be finite.");
    return value;
  }
  if (seen.has(value)) throw new TypeError("Task group context cannot contain cycles.");
  seen.add(value);
  if (Array.isArray(value)) {
    const output = value.map((entry) => cloneContextValue(entry, seen));
    seen.delete(value);
    return Object.freeze(output);
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new TypeError("Task group context objects must be plain records.");
  }
  const record = value as Readonly<Record<string, TaskGroupContextValue>>;
  const output: Record<string, TaskGroupContextValue> = {};
  for (const key of Object.keys(record)) {
    output[key] = cloneContextValue(record[key]!, seen);
  }
  seen.delete(value);
  return Object.freeze(output);
}
