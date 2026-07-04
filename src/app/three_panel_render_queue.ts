export interface ThreePanelRenderQueueInspection {
  running: number;
  pending: number;
  scheduled: number;
  completed: number;
  failed: number;
}

/** Serializes expensive Three panel frame work so WebGPU readbacks do not compete across panes. */
export class ThreePanelRenderQueue {
  #tail: Promise<void> = Promise.resolve();
  #running = 0;
  #pending = 0;
  #scheduled = 0;
  #completed = 0;
  #failed = 0;

  run<T>(task: () => T | Promise<T>): Promise<T> {
    this.#pending += 1;
    this.#scheduled += 1;

    const previous = this.#tail;
    let release!: () => void;
    this.#tail = new Promise<void>((resolve) => {
      release = resolve;
    });

    return previous
      .catch(() => undefined)
      .then(async () => {
        this.#pending -= 1;
        this.#running += 1;
        try {
          const value = await task();
          this.#completed += 1;
          return value;
        } catch (error) {
          this.#failed += 1;
          throw error;
        } finally {
          this.#running -= 1;
          release();
        }
      });
  }

  inspect(): ThreePanelRenderQueueInspection {
    return {
      running: this.#running,
      pending: this.#pending,
      scheduled: this.#scheduled,
      completed: this.#completed,
      failed: this.#failed,
    };
  }
}

export const defaultThreePanelRenderQueue = new ThreePanelRenderQueue();
