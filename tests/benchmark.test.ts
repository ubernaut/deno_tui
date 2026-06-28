import { assertEquals } from "./deps.ts";
import { BenchmarkRunner, formatBenchmarkResults } from "../src/perf/mod.ts";

Deno.test("BenchmarkRunner reports average timings", async () => {
  let count = 0;
  const runner = new BenchmarkRunner([
    {
      name: "counter",
      iterations: 3,
      run: () => {
        count += 1;
      },
    },
  ]);

  const [result] = await runner.run();
  assertEquals(count, 3);
  assertEquals(result.name, "counter");
  assertEquals(result.iterations, 3);
  assertEquals(formatBenchmarkResults([result]).includes("counter:"), true);
});
