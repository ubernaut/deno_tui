// Copyright 2023 Im-Beast. MIT license.
import { assertEquals } from "./deps.ts";
import { layoutWrappedControlOptions, wrappedControlOptionRowCount } from "../src/app/workbench_control_layout.ts";

Deno.test("layoutWrappedControlOptions keeps option tokens and hit offsets stable", () => {
  const rows = layoutWrappedControlOptions(["Unit-01", "Signal", "Arcane"], 1, 80);
  assertEquals(rows.map((row) => row.text), [" Unit-01  [Signal]  Arcane  "]);
  assertEquals(rows[0]?.tokens, [
    { index: 0, text: " Unit-01  ", columnOffset: 0, width: 10 },
    { index: 1, text: "[Signal] ", columnOffset: 10, width: 9 },
    { index: 2, text: " Arcane  ", columnOffset: 19, width: 9 },
  ]);
});

Deno.test("layoutWrappedControlOptions wraps tokens without splitting individual options", () => {
  const rows = layoutWrappedControlOptions(["alpha", "beta", "gamma", "delta"], undefined, 16);
  assertEquals(rows.map((row) => row.text), [
    " alpha   beta  ",
    " gamma   delta  ",
  ]);
  assertEquals(rows[1]?.tokens.map((token) => token.columnOffset), [0, 8]);
  assertEquals(wrappedControlOptionRowCount(["alpha", "beta", "gamma", "delta"], undefined, 16), 2);
});

Deno.test("layoutWrappedControlOptions returns one empty row for empty option lists", () => {
  assertEquals(layoutWrappedControlOptions([], undefined, 4), [{ text: "", tokens: [] }]);
  assertEquals(wrappedControlOptionRowCount([], undefined, 4), 1);
});
