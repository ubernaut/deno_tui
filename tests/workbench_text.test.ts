// Copyright 2023 Im-Beast. MIT license.
import { assertEquals } from "./deps.ts";
import {
  compactSpaces,
  maxTextWidth,
  maxTextWidthBy,
  maxTrimmedTextWidth,
  visibleMenuSlice,
  wrapPlainText,
} from "../src/app/workbench_text.ts";

const fit = (value: string, width: number) => value.slice(0, Math.max(0, width));

Deno.test("workbench text helpers normalize whitespace and measure rows", () => {
  assertEquals(compactSpaces("  a   b\n c  "), "a b c");
  assertEquals(maxTextWidth(["abc", "abcdef", "x"]), 6);
  assertEquals(maxTextWidthBy([{ label: "abc" }, { label: "abcdef" }], (entry) => entry.label), 6);
  assertEquals(maxTrimmedTextWidth(["abc   ", "abcdef", "x"]), 6);
});

Deno.test("workbench text helpers wrap plain text after stripping styles", () => {
  assertEquals(wrapPlainText("\x1b[31mhello\x1b[0m wide world", 8, fit), [
    "hello",
    "wide",
    "world",
  ]);
  assertEquals(wrapPlainText("supercalifragilistic", 5, fit), ["super"]);
  assertEquals(wrapPlainText("   ", 5, fit), [""]);
});

Deno.test("workbench text helpers project visible menu slices around selection", () => {
  const items = ["a", "b", "c", "d", "e"];
  assertEquals(visibleMenuSlice(items, 0, 3), { items: ["a", "b", "c"], indexes: [0, 1, 2] });
  assertEquals(visibleMenuSlice(items, 2, 3), { items: ["b", "c", "d"], indexes: [1, 2, 3] });
  assertEquals(visibleMenuSlice(items, 4, 3), { items: ["c", "d", "e"], indexes: [2, 3, 4] });

  const full = visibleMenuSlice(items, 2, 10);
  full.items[0] = "mutated";
  assertEquals(items[0], "a");
});
