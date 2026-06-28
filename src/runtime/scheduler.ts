// Copyright 2023 Im-Beast. MIT license.
export interface SchedulerOptions {
  concurrency?: number;
}

export type ScheduledTask<T> = () => T | Promise<T>;

export interface ScheduledTaskOptions {
  priority?: number;
  signal?: AbortSignal;
}

interface QueuedTask {
  run: () => void;
  reject: (error: unknown) => void;
  signal?: AbortSignal;
  abort?: () => void;
  priority: number;
  sequence: number;
}

export interface AsyncSchedulerInspection {
  concurrency: number;
  running: number;
  pending: number;
  idle: boolean;
}

export interface TaskBatchItem<TInput, TOutput> extends ScheduledTaskOptions {
  input: TInput;
  task?: (input: TInput, index: number) => TOutput | Promise<TOutput>;
}

export interface TaskBatchOptions<TInput, TOutput> extends ScheduledTaskOptions {
  scheduler?: AsyncScheduler;
  task?: (input: TInput, index: number) => TOutput | Promise<TOutput>;
}

export interface TaskBatchResult<TInput, TOutput> {
  input: TInput;
  index: number;
  value: TOutput;
}

export class AsyncScheduler {
  private readonly concurrency: number;
  private active = 0;
  private sequence = 0;
  private readonly queue: QueuedTask[] = [];
  private readonly idleResolvers = new Set<() => void>();

  constructor(options: SchedulerOptions = {}) {
    this.concurrency = Math.max(1, Math.floor(options.concurrency ?? navigator.hardwareConcurrency ?? 2));
  }

  run<T>(task: ScheduledTask<T>, options: ScheduledTaskOptions = {}): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      if (options.signal?.aborted) {
        reject(createAbortError());
        return;
      }

      let abort: (() => void) | undefined;
      const queued: QueuedTask = {
        priority: options.priority ?? 0,
        sequence: this.sequence++,
        reject,
        signal: options.signal,
        run: () => {
          options.signal?.removeEventListener("abort", abort!);
          if (options.signal?.aborted) {
            reject(createAbortError());
            return;
          }

          this.active += 1;
          Promise.resolve()
            .then(task)
            .then(resolve, reject)
            .finally(() => {
              this.active -= 1;
              this.drain();
            });
        },
      };

      abort = () => {
        const index = this.queue.indexOf(queued);
        if (index >= 0) {
          this.queue.splice(index, 1);
          reject(createAbortError());
          this.resolveIdleIfNeeded();
        }
      };
      queued.abort = abort;
      options.signal?.addEventListener("abort", abort, { once: true });
      this.enqueue(queued);
      this.drain();
    });
  }

  pending(): number {
    return this.queue.length;
  }

  running(): number {
    return this.active;
  }

  capacity(): number {
    return this.concurrency;
  }

  idle(): boolean {
    return this.active === 0 && this.queue.length === 0;
  }

  waitForIdle(): Promise<void> {
    if (this.idle()) return Promise.resolve();
    return new Promise((resolve) => {
      this.idleResolvers.add(resolve);
    });
  }

  clearPending(reason: unknown = createAbortError()): number {
    const queued = this.queue.splice(0);
    for (const task of queued) {
      if (task.signal && task.abort) {
        task.signal.removeEventListener("abort", task.abort);
      }
      task.reject(reason);
    }
    this.resolveIdleIfNeeded();
    return queued.length;
  }

  inspect(): AsyncSchedulerInspection {
    return {
      concurrency: this.concurrency,
      running: this.running(),
      pending: this.pending(),
      idle: this.idle(),
    };
  }

  private enqueue(task: QueuedTask): void {
    const index = this.queue.findIndex((queued) =>
      queued.priority < task.priority ||
      (queued.priority === task.priority && queued.sequence > task.sequence)
    );
    if (index === -1) {
      this.queue.push(task);
    } else {
      this.queue.splice(index, 0, task);
    }
  }

  private drain(): void {
    while (this.active < this.concurrency) {
      const next = this.queue.shift();
      if (!next) {
        this.resolveIdleIfNeeded();
        return;
      }
      next.run();
    }
    this.resolveIdleIfNeeded();
  }

  private resolveIdleIfNeeded(): void {
    if (!this.idle()) return;
    for (const resolve of this.idleResolvers) {
      resolve();
    }
    this.idleResolvers.clear();
  }
}

function createAbortError(): Error {
  if ("DOMException" in globalThis) {
    return new DOMException("Scheduled task was aborted", "AbortError");
  }
  const error = new Error("Scheduled task was aborted");
  error.name = "AbortError";
  return error;
}

export function nextFrame(): Promise<number> {
  const raf = (globalThis as typeof globalThis & {
    requestAnimationFrame?: (callback: (time: number) => void) => number;
  }).requestAnimationFrame;
  if (raf) {
    return new Promise((resolve) => raf(resolve));
  }
  return new Promise((resolve) => setTimeout(() => resolve(performance.now()), 16));
}

export async function runTaskBatch<TInput, TOutput>(
  items: readonly (TInput | TaskBatchItem<TInput, TOutput>)[],
  options: TaskBatchOptions<TInput, TOutput> = {},
): Promise<TaskBatchResult<TInput, TOutput>[]> {
  const scheduler = options.scheduler ?? new AsyncScheduler();
  const sharedTask = options.task;
  const jobs = items.map((item, index) => {
    const batchItem = normalizeBatchItem(item);
    const task = batchItem.task ?? sharedTask;
    if (!task) {
      return Promise.reject(new TypeError("runTaskBatch requires a task option or per-item task."));
    }

    const priority = batchItem.priority ?? options.priority;
    const signal = batchItem.signal ?? options.signal;
    return scheduler.run(async () => ({
      input: batchItem.input,
      index,
      value: await task(batchItem.input, index),
    }), { priority, signal });
  });

  return await Promise.all(jobs);
}

function normalizeBatchItem<TInput, TOutput>(
  item: TInput | TaskBatchItem<TInput, TOutput>,
): TaskBatchItem<TInput, TOutput> {
  if (isTaskBatchItem<TInput, TOutput>(item)) return item;
  return { input: item };
}

function isTaskBatchItem<TInput, TOutput>(
  item: TInput | TaskBatchItem<TInput, TOutput>,
): item is TaskBatchItem<TInput, TOutput> {
  return typeof item === "object" && item !== null && "input" in item &&
    ("task" in item || "priority" in item || "signal" in item);
}
