// Copyright 2023 Im-Beast. MIT license.
export interface WorkerPoolOptions {
  workerUrl: string | URL;
  size?: number;
  type?: "classic" | "module";
  name?: string;
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
}

export class WorkerPool<TPayload = unknown, TResult = unknown> {
  private readonly workers: Worker[] = [];
  private readonly pending = new Map<number, PendingTask<TResult>>();
  private cursor = 0;
  private nextId = 1;

  constructor(options: WorkerPoolOptions) {
    const size = Math.max(1, Math.floor(options.size ?? navigator.hardwareConcurrency ?? 2));
    for (let index = 0; index < size; index += 1) {
      const worker = new Worker(options.workerUrl, {
        type: options.type ?? "module",
        name: options.name ? `${options.name}-${index}` : undefined,
      });
      worker.onmessage = (event) => this.handleMessage(event.data as WorkerResponse<TResult>);
      worker.onerror = (event) => this.rejectAll(new Error(event.message));
      this.workers.push(worker);
    }
  }

  run(payload: TPayload): Promise<TResult> {
    const id = this.nextId++;
    const worker = this.workers[this.cursor++ % this.workers.length]!;
    return new Promise<TResult>((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      worker.postMessage({ id, payload } satisfies WorkerRequest<TPayload>);
    });
  }

  terminate(): void {
    this.rejectAll(new Error("WorkerPool was terminated."));
    for (const worker of this.workers) {
      worker.terminate();
    }
    this.workers.length = 0;
  }

  private handleMessage(message: WorkerResponse<TResult>): void {
    const task = this.pending.get(message.id);
    if (!task) return;
    this.pending.delete(message.id);
    if (message.ok) {
      task.resolve(message.result as TResult);
    } else {
      task.reject(new Error(message.error ?? "Worker task failed."));
    }
  }

  private rejectAll(error: Error): void {
    for (const task of this.pending.values()) {
      task.reject(error);
    }
    this.pending.clear();
  }
}

export type WorkerHandler<TPayload = unknown, TResult = unknown> = (payload: TPayload) => TResult | Promise<TResult>;

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
