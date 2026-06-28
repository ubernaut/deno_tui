// Copyright 2023 Im-Beast. MIT license.
export interface SchedulerOptions {
  concurrency?: number;
}

export type ScheduledTask<T> = () => T | Promise<T>;

export class AsyncScheduler {
  private readonly concurrency: number;
  private active = 0;
  private readonly queue: Array<() => void> = [];

  constructor(options: SchedulerOptions = {}) {
    this.concurrency = Math.max(1, Math.floor(options.concurrency ?? navigator.hardwareConcurrency ?? 2));
  }

  run<T>(task: ScheduledTask<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.queue.push(() => {
        this.active += 1;
        Promise.resolve()
          .then(task)
          .then(resolve, reject)
          .finally(() => {
            this.active -= 1;
            this.drain();
          });
      });
      this.drain();
    });
  }

  pending(): number {
    return this.queue.length;
  }

  running(): number {
    return this.active;
  }

  private drain(): void {
    while (this.active < this.concurrency) {
      const next = this.queue.shift();
      if (!next) return;
      next();
    }
  }
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
