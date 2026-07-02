// Copyright 2023 Im-Beast. MIT license.
/** Options for configuring worker Pool. */
export interface WorkerPoolOptions {
  workerUrl: string | URL;
  size?: number;
  type?: "classic" | "module";
  name?: string;
  workerFactory?: WorkerFactory;
}

/** Options for configuring worker Pool Run. */
export interface WorkerPoolRunOptions {
  signal?: AbortSignal;
}

/** Serializable inspection snapshot for worker Pool. */
export interface WorkerPoolInspection {
  size: number;
  pending: number;
  idle: boolean;
  terminated: boolean;
  nextWorkerIndex: number;
}

/** Options for configuring worker Batch. */
export interface WorkerBatchOptions {
  signal?: AbortSignal;
}

/** Public interface describing a worker Batch Result. */
export interface WorkerBatchResult<TPayload, TResult> {
  input: TPayload;
  index: number;
  value: TResult;
}

/** Public interface describing a worker Like. */
export interface WorkerLike {
  onmessage: ((event: MessageEvent<unknown>) => void) | null;
  onerror: ((event: ErrorEvent) => void) | null;
  postMessage(message: unknown): void;
  terminate(): void;
}

/** Public type alias for a worker Factory. */
export type WorkerFactory = (
  workerUrl: string | URL,
  options: WorkerOptions,
) => WorkerLike;

/** Error thrown for invalid worker Pool Terminated operations. */
export class WorkerPoolTerminatedError extends Error {
  constructor() {
    super("WorkerPool was terminated.");
    this.name = "WorkerPoolTerminatedError";
  }
}

interface WorkerRequest<TPayload> {
  id: number;
  payload: TPayload;
}

interface WorkerResponse<TResult> {
  id: number;
  ok: boolean;
  result?: TResult;
  error?: string;
}

interface PendingTask<TResult> {
  resolve: (value: TResult) => void;
  reject: (error: Error) => void;
  cleanup?: () => void;
}

/** Public class implementing a worker Pool. */
export class WorkerPool<TPayload = unknown, TResult = unknown> {
  private readonly workers: WorkerLike[] = [];
  private readonly pending = new Map<number, PendingTask<TResult>>();
  private readonly idleWaiters = new Set<() => void>();
  private cursor = 0;
  private nextId = 1;
  private terminated = false;

  constructor(options: WorkerPoolOptions) {
    const size = Math.max(1, Math.floor(options.size ?? navigator.hardwareConcurrency ?? 2));
    const createWorker = options.workerFactory ?? ((workerUrl, workerOptions) => new Worker(workerUrl, workerOptions));
    for (let index = 0; index < size; index += 1) {
      const worker = createWorker(options.workerUrl, {
        type: options.type ?? "module",
        name: options.name ? `${options.name}-${index}` : undefined,
      });
      worker.onmessage = (event: MessageEvent<unknown>) => this.handleMessage(event.data as WorkerResponse<TResult>);
      worker.onerror = (event) => this.rejectAll(new Error(event.message));
      this.workers.push(worker);
    }
  }

  get size(): number {
    return this.workers.length;
  }

  pendingCount(): number {
    return this.pending.size;
  }

  idle(): boolean {
    return this.pending.size === 0;
  }

  inspect(): WorkerPoolInspection {
    const size = this.workers.length;
    return {
      size,
      pending: this.pending.size,
      idle: this.idle(),
      terminated: this.terminated,
      nextWorkerIndex: size === 0 ? 0 : this.cursor % size,
    };
  }

  waitForIdle(): Promise<void> {
    if (this.idle()) return Promise.resolve();
    return new Promise((resolve) => {
      this.idleWaiters.add(resolve);
    });
  }

  run(payload: TPayload, options: WorkerPoolRunOptions = {}): Promise<TResult> {
    if (this.terminated) {
      return Promise.reject(new WorkerPoolTerminatedError());
    }
    if (options.signal?.aborted) {
      return Promise.reject(createAbortError());
    }

    const id = this.nextId++;
    const worker = this.workers[this.cursor++ % this.workers.length]!;
    return new Promise<TResult>((resolve, reject) => {
      const task: PendingTask<TResult> = { resolve, reject };
      if (options.signal) {
        const abort = () => {
          if (!this.pending.delete(id)) return;
          task.cleanup?.();
          reject(createAbortError());
        };
        options.signal.addEventListener("abort", abort, { once: true });
        task.cleanup = () => options.signal?.removeEventListener("abort", abort);
      }
      this.pending.set(id, task);
      try {
        worker.postMessage({ id, payload } satisfies WorkerRequest<TPayload>);
      } catch (error) {
        this.pending.delete(id);
        task.cleanup?.();
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    });
  }

  terminate(): void {
    this.terminated = true;
    this.rejectAll(new WorkerPoolTerminatedError());
    for (const worker of this.workers) {
      worker.terminate();
    }
    this.workers.length = 0;
    this.resolveIdleWaiters();
  }

  private handleMessage(message: WorkerResponse<TResult>): void {
    const task = this.pending.get(message.id);
    if (!task) return;
    this.pending.delete(message.id);
    task.cleanup?.();
    if (message.ok) {
      task.resolve(message.result as TResult);
    } else {
      task.reject(new Error(message.error ?? "Worker task failed."));
    }
    this.resolveIdleWaiters();
  }

  private rejectAll(error: Error): void {
    for (const task of this.pending.values()) {
      task.cleanup?.();
      task.reject(error);
    }
    this.pending.clear();
    this.resolveIdleWaiters();
  }

  private resolveIdleWaiters(): void {
    if (!this.idle()) return;
    for (const resolve of this.idleWaiters) {
      resolve();
    }
    this.idleWaiters.clear();
  }
}

/** Public helper for run Worker Batch. */
export async function runWorkerBatch<TPayload, TResult>(
  pool: WorkerPool<TPayload, TResult>,
  inputs: readonly TPayload[],
  options: WorkerBatchOptions = {},
): Promise<Array<WorkerBatchResult<TPayload, TResult>>> {
  const jobs = new Array<Promise<WorkerBatchResult<TPayload, TResult>>>(inputs.length);
  for (let index = 0; index < inputs.length; index += 1) {
    const input = inputs[index]!;
    jobs[index] = pool.run(input, { signal: options.signal }).then((value) => ({ input, index, value }));
  }
  return await Promise.all(jobs);
}

function createAbortError(): Error {
  return new DOMException("Worker task was aborted.", "AbortError");
}

/** Callback signature for handling worker events. */
export type WorkerHandler<TPayload = unknown, TResult = unknown> = (payload: TPayload) => TResult | Promise<TResult>;

/** Public helper for install Worker Handler. */
export function installWorkerHandler<TPayload = unknown, TResult = unknown>(
  handler: WorkerHandler<TPayload, TResult>,
): void {
  const workerScope = self as unknown as {
    onmessage: ((event: MessageEvent<WorkerRequest<TPayload>>) => void) | null;
    postMessage: (message: WorkerResponse<TResult>) => void;
  };

  workerScope.onmessage = async (event: MessageEvent<WorkerRequest<TPayload>>) => {
    try {
      const result = await handler(event.data.payload);
      workerScope.postMessage({ id: event.data.id, ok: true, result } satisfies WorkerResponse<TResult>);
    } catch (error) {
      workerScope.postMessage(
        {
          id: event.data.id,
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        } satisfies WorkerResponse<TResult>,
      );
    }
  };
}
