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
  priority: number;
  sequence: number;
}

export class AsyncScheduler {
  private readonly concurrency: number;
  private active = 0;
  private sequence = 0;
  private readonly queue: QueuedTask[] = [];

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
        }
      };
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
      if (!next) return;
      next.run();
    }
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
