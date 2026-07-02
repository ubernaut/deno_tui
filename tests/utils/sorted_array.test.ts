// Copyright 2023 Im-Beast. MIT license.

import { insertUniqueSortedString, SortedArray } from "../../src/utils/sorted_array.ts";
import { assertEquals } from "../deps.ts";

Deno.test("utils/sorted_array.ts", async (t) => {
  await t.step("SortedArray", () => {
    const array = new SortedArray<number>((a, b) => b - a);

    array.push(1, 10, -5, -2, 11, 100, -1000);
    assertEquals([...array], [100, 11, 10, 1, -2, -5, -1000]);
    array.remove(11);
    assertEquals([...array], [100, 10, 1, -2, -5, -1000]);
    array.remove(404);
    assertEquals([...array], [100, 10, 1, -2, -5, -1000]);
  });

  await t.step("insertUniqueSortedString", () => {
    const values = ["beta", "delta"];
    insertUniqueSortedString(values, "alpha");
    insertUniqueSortedString(values, "gamma");
    insertUniqueSortedString(values, "beta");
    assertEquals(values, ["alpha", "beta", "delta", "gamma"]);
  });
});
