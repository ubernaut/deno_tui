// Copyright 2023 Im-Beast. MIT license.

import { sleep } from "../../src/utils/async.ts";
import { assert } from "../deps.ts";

Deno.test("utils/async.ts", async (t) => {
  await t.step("sleep()", async () => {
    const intervals = [0, 1, 33, 50, 100, 150];

    for (const interval of intervals) {
      const start = performance.now();
      await sleep(interval);
      const elapsed = performance.now() - start;
      assert(elapsed >= Math.max(0, interval - 2), `sleep(${interval}) resolved too early after ${elapsed}ms`);
      assert(elapsed <= interval + 100, `sleep(${interval}) resolved too late after ${elapsed}ms`);
    }
  });
});
