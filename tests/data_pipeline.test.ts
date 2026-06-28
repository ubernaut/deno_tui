import { assertEquals } from "./deps.ts";
import {
  DataPipelineAbortError,
  filterRows,
  LatestDataPipeline,
  mapRows,
  runDataPipeline,
  sliceRows,
  sortRows,
  workerTransform,
} from "../src/runtime/data_pipeline.ts";
import { bindDataPipeline } from "../src/runtime/data_pipeline_bindings.ts";
import { AsyncScheduler } from "../src/runtime/scheduler.ts";
import { Signal } from "../src/signals/mod.ts";

Deno.test("runDataPipeline applies row transforms in order", async () => {
  const rows = await runDataPipeline<number[], string[]>([3, 1, 2, 4], [
    filterRows<number>((value) => value > 1),
    sortRows<number>((left, right) => left - right),
    mapRows<number, string>((value) => `#${value}`),
    sliceRows<string>(0, 2),
  ]);

  assertEquals(rows, ["#2", "#3"]);
});

Deno.test("runDataPipeline uses the provided scheduler", async () => {
  const scheduler = new AsyncScheduler({ concurrency: 1 });
  const order: string[] = [];

  const result = await runDataPipeline<number, number>(1, [
    (value: number) => {
      order.push(`a:${value}`);
      return value + 1;
    },
    async (value) => {
      order.push(`b:${value}`);
      await Promise.resolve();
      return Number(value) * 2;
    },
  ], { scheduler });

  assertEquals(result, 4);
  assertEquals(order, ["a:1", "b:2"]);
});

Deno.test("runDataPipeline passes priority to scheduled transforms", async () => {
  const scheduler = new AsyncScheduler({ concurrency: 1 });
  const releaseBlocker = deferred<void>();
  const order: string[] = [];
  const blocker = scheduler.run(() => releaseBlocker.promise);

  const low = runDataPipeline<number, number>(1, [
    (value) => {
      order.push("low");
      return value * 10;
    },
  ], { scheduler, priority: 0 });
  const high = runDataPipeline<number, number>(2, [
    (value) => {
      order.push("high");
      return value * 10;
    },
  ], { scheduler, priority: 10 });

  releaseBlocker.resolve();
  await blocker;

  assertEquals(await Promise.all([low, high]), [10, 20]);
  assertEquals(order, ["high", "low"]);
});

Deno.test("runDataPipeline rejects aborted work", async () => {
  const controller = new AbortController();
  controller.abort();

  try {
    await runDataPipeline([1], [mapRows((value: number) => value + 1)], { signal: controller.signal });
    throw new Error("expected abort");
  } catch (error) {
    assertEquals(error instanceof DataPipelineAbortError, true);
  }
});

Deno.test("runDataPipeline cancels pending scheduled transforms with DataPipelineAbortError", async () => {
  const scheduler = new AsyncScheduler({ concurrency: 1 });
  const releaseBlocker = deferred<void>();
  const controller = new AbortController();
  let ran = false;
  const blocker = scheduler.run(() => releaseBlocker.promise);
  const pending = runDataPipeline<number, number>(1, [
    (value) => {
      ran = true;
      return value + 1;
    },
  ], { scheduler, signal: controller.signal });

  assertEquals(scheduler.pending(), 1);
  controller.abort();

  try {
    await pending;
    throw new Error("expected abort");
  } catch (error) {
    assertEquals(error instanceof DataPipelineAbortError, true);
  }
  assertEquals(ran, false);

  releaseBlocker.resolve();
  await blocker;
});

Deno.test("workerTransform offloads a pipeline stage through a runner", async () => {
  const runner = new FakeRunner<{ values: number[]; revision: number }, number>((payload) => {
    return payload.values.reduce((sum, value) => sum + value, payload.revision);
  });

  const result = await runDataPipeline<number[], string>([1, 2, 3], [
    workerTransform(runner, (values, context) => ({ values, revision: context.revision })),
    (value) => `sum:${value}`,
  ], { revision: 4 });

  assertEquals(result, "sum:10");
  assertEquals(runner.payloads, [{ values: [1, 2, 3], revision: 4 }]);
});

Deno.test("workerTransform respects pipeline abort checks", async () => {
  const controller = new AbortController();
  const runner = new FakeRunner<number, number>((value) => value + 1);
  controller.abort();

  try {
    await runDataPipeline(1, [workerTransform(runner)], { signal: controller.signal });
    throw new Error("expected abort");
  } catch (error) {
    assertEquals(error instanceof DataPipelineAbortError, true);
  }
  assertEquals(runner.payloads, []);
});

Deno.test("LatestDataPipeline marks older results stale", async () => {
  let releaseFirst: (() => void) | undefined;
  const pipeline = new LatestDataPipeline<number, number>([
    async (value) => {
      if (value === 1) {
        await new Promise<void>((resolve) => {
          releaseFirst = resolve;
        });
      }
      return Number(value) + 1;
    },
  ]);

  const first = pipeline.run(1);
  const second = pipeline.run(10);

  assertEquals(await second, { status: "ok", value: 11, revision: 2 });
  releaseFirst?.();
  assertEquals(await first, { status: "stale", revision: 1 });
});

Deno.test("bindDataPipeline writes latest signal-driven pipeline results", async () => {
  const input = new Signal([3, 1, 2]);
  const output = new Signal<string[] | undefined>(undefined);
  const results: Array<{ value: string[]; revision: number }> = [];
  const dispose = bindDataPipeline<number[], string[]>(input, output, [
    sortRows<number>((left, right) => left - right),
    mapRows<number, string>((value) => `#${value}`),
  ], {
    onResult: (value, revision) => {
      results.push({ value, revision });
    },
  });

  await settle();

  assertEquals(output.peek(), ["#1", "#2", "#3"]);
  assertEquals(results, [{ value: ["#1", "#2", "#3"], revision: 1 }]);

  input.value = [5, 4];
  await settle();

  assertEquals(output.peek(), ["#4", "#5"]);
  assertEquals(results.at(-1), { value: ["#4", "#5"], revision: 2 });

  dispose();
  input.value = [9];
  await settle();
  assertEquals(output.peek(), ["#4", "#5"]);
});

Deno.test("bindDataPipeline debounces rapid input changes", async () => {
  const input = new Signal(0);
  const output = new Signal<number | undefined>(undefined);
  const seen: number[] = [];

  bindDataPipeline<number, number>(input, output, [
    (value) => {
      seen.push(value);
      return value * 10;
    },
  ], { initialRun: false, debounceMs: 5 });
  input.value = 1;
  input.value = 2;
  input.value = 3;

  await delay(15);
  await settle();

  assertEquals(seen, [3]);
  assertEquals(output.peek(), 30);
});

Deno.test("bindDataPipeline suppresses stale results and aborts on dispose", async () => {
  const input = new Signal(1);
  const output = new Signal<number | undefined>(undefined);
  const firstRelease = deferred<void>();
  const disposeRelease = deferred<void>();
  const aborted: number[] = [];
  const dispose = bindDataPipeline<number, number>(input, output, [
    async (value, context) => {
      context.signal?.addEventListener("abort", () => aborted.push(value));
      if (value === 1) {
        await firstRelease.promise;
      }
      if (value === 3) {
        await disposeRelease.promise;
      }
      return value * 10;
    },
  ]);

  await settle();
  input.value = 2;
  firstRelease.resolve();
  await settle();

  assertEquals(output.peek(), 20);
  assertEquals(aborted, [1]);

  input.value = 3;
  await settle();
  dispose();
  disposeRelease.resolve();
  await settle();

  assertEquals(aborted, [1, 3]);
  assertEquals(output.peek(), 20);
});

function deferred<T>(): {
  promise: Promise<T>;
  resolve: (value: T | PromiseLike<T>) => void;
} {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function settle(): Promise<void> {
  return delay(0);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

class FakeRunner<TPayload, TResult> {
  readonly payloads: TPayload[] = [];

  constructor(private readonly handler: (payload: TPayload) => TResult | Promise<TResult>) {}

  async run(payload: TPayload): Promise<TResult> {
    this.payloads.push(payload);
    return await this.handler(payload);
  }
}
