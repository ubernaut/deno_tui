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
import { AsyncScheduler } from "../src/runtime/scheduler.ts";

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

class FakeRunner<TPayload, TResult> {
  readonly payloads: TPayload[] = [];

  constructor(private readonly handler: (payload: TPayload) => TResult | Promise<TResult>) {}

  async run(payload: TPayload): Promise<TResult> {
    this.payloads.push(payload);
    return await this.handler(payload);
  }
}
