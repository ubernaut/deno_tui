import { assertEquals } from "./deps.ts";
import {
  DataPipelineAbortError,
  filterRows,
  LatestDataPipeline,
  mapRows,
  runDataPipeline,
  sliceRows,
  sortRows,
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
