// Copyright 2023 Im-Beast. MIT license.

export interface RenderLoopFrame {
  frame: number;
  startedAt: number;
  deltaMs: number;
}

export interface RenderLoopInspection {
  running: boolean;
  frame: number;
  intervalMs: number;
  lastStartedAt?: number;
  lastDurationMs?: number;
  lastError?: unknown;
}

export interface RenderLoopTimer {
  setTimeout(callback: () => void, delay: number): unknown;
  clearTimeout(handle: unknown): void;
  now(): number;
}

export interface RenderLoopOptions {
  intervalMs?: number;
  immediate?: boolean;
  timer?: RenderLoopTimer;
  onError?: (error: unknown) => void;
  tick: (frame: RenderLoopFrame) => void;
}

/** Small start/stop render loop with injectable timers for terminal apps and tests. */
export class RenderLoop {
  readonly #tick: (frame: RenderLoopFrame) => void;
  readonly #timer: RenderLoopTimer;
  readonly #immediate: boolean;
  readonly #onError?: (error: unknown) => void;
  #intervalMs: number;
  #handle: unknown;
  #running = false;
  #frame = 0;
  #lastStartedAt: number | undefined;
  #lastDurationMs: number | undefined;
  #lastError: unknown;

  constructor(options: RenderLoopOptions) {
    this.#tick = options.tick;
    this.#timer = options.timer ?? defaultRenderLoopTimer;
    this.#intervalMs = Math.max(0, options.intervalMs ?? 1000 / 60);
    this.#immediate = options.immediate ?? true;
    this.#onError = options.onError;
  }

  get running(): boolean {
    return this.#running;
  }

  get frame(): number {
    return this.#frame;
  }

  get intervalMs(): number {
    return this.#intervalMs;
  }

  set intervalMs(value: number) {
    this.#intervalMs = Math.max(0, value);
  }

  start(): void {
    if (this.#running) return;
    this.#running = true;
    if (this.#immediate) {
      this.#run();
    } else {
      this.#schedule();
    }
  }

  stop(): void {
    if (this.#handle !== undefined) {
      this.#timer.clearTimeout(this.#handle);
      this.#handle = undefined;
    }
    this.#running = false;
  }

  step(): void {
    this.#invokeTick();
  }

  inspect(): RenderLoopInspection {
    return {
      running: this.#running,
      frame: this.#frame,
      intervalMs: this.#intervalMs,
      lastStartedAt: this.#lastStartedAt,
      lastDurationMs: this.#lastDurationMs,
      lastError: this.#lastError,
    };
  }

  #run(): void {
    if (!this.#running) return;
    this.#handle = undefined;
    try {
      this.#invokeTick();
      this.#schedule();
    } catch (error) {
      this.#lastError = error;
      this.#onError?.(error);
      this.stop();
    }
  }

  #invokeTick(): void {
    const startedAt = this.#timer.now();
    const deltaMs = this.#lastStartedAt === undefined ? 0 : startedAt - this.#lastStartedAt;
    this.#lastStartedAt = startedAt;
    this.#frame += 1;
    this.#tick({ frame: this.#frame, startedAt, deltaMs });
    this.#lastDurationMs = Math.max(0, this.#timer.now() - startedAt);
  }

  #schedule(): void {
    if (!this.#running) return;
    this.#handle = this.#timer.setTimeout(() => this.#run(), this.#intervalMs);
  }
}

export function createRenderLoop(options: RenderLoopOptions): RenderLoop {
  return new RenderLoop(options);
}

export const defaultRenderLoopTimer: RenderLoopTimer = {
  setTimeout: (callback, delay) => setTimeout(callback, delay),
  clearTimeout: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
  now: () => performance.now(),
};
