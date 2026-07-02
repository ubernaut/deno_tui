// Copyright 2023 Im-Beast. MIT license.
import { assertEquals } from "./deps.ts";
import {
  layoutWorkbenchButtonRow,
  layoutWorkbenchButtonRowInto,
  layoutWorkbenchControlButtonLine,
  layoutWrappedControlOptions,
  type WorkbenchButtonRowPlacement,
  wrappedControlOptionRowCount,
} from "../src/app/workbench_control_layout.ts";

Deno.test("layoutWorkbenchControlButtonLine keeps button background scoped to the button token", () => {
  assertEquals(layoutWorkbenchControlButtonLine("> ", "[ Run ] presses=2", 24), [
    { kind: "prefix", text: "> ", columnOffset: 0, width: 2 },
    { kind: "button", text: "[ Run ]", columnOffset: 2, width: 7 },
    { kind: "detail", text: " presses=2", columnOffset: 9, width: 10 },
  ]);
});

Deno.test("layoutWorkbenchControlButtonLine clips by segment without padding the button across the row", () => {
  assertEquals(layoutWorkbenchControlButtonLine("> ", "[ Long Button ] trailing detail", 12), [
    { kind: "prefix", text: "> ", columnOffset: 0, width: 2 },
    { kind: "button", text: "[ Long Bu…", columnOffset: 2, width: 10 },
  ]);
});

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

Deno.test("layoutWorkbenchButtonRow wraps buttons and reports paint state", () => {
  const result = layoutWorkbenchButtonRow(
    [
      { label: "Run", action: "run", tone: "success" },
      { label: "Stop", action: "stop", disabled: true, tone: "danger" },
      { label: "Raw", action: "raw", active: true },
    ],
    { column: 2, row: 4, width: 16, height: 3 },
    4,
  );

  assertEquals(result, {
    placements: [
      {
        item: { label: "Run", action: "run", tone: "success" },
        rect: { column: 2, row: 4, width: 7, height: 1 },
        state: "base",
        tone: "success",
      },
      {
        item: { label: "Stop", action: "stop", disabled: true, tone: "danger" },
        rect: { column: 10, row: 4, width: 8, height: 1 },
        state: "disabled",
        tone: "danger",
      },
      {
        item: { label: "Raw", action: "raw", active: true },
        rect: { column: 2, row: 5, width: 7, height: 1 },
        state: "active",
        tone: undefined,
      },
    ],
    nextRow: 6,
  });
});

Deno.test("layoutWorkbenchButtonRow clips overwide buttons and stops at bottom", () => {
  const result = layoutWorkbenchButtonRow(
    [
      { label: "Very Wide Button", action: "wide" },
      { label: "Hidden", action: "hidden" },
    ],
    { column: 0, row: 0, width: 8, height: 1 },
    0,
  );

  assertEquals(result, {
    placements: [
      {
        item: { label: "Very Wide Button", action: "wide" },
        rect: { column: 0, row: 0, width: 8, height: 1 },
        state: "base",
        tone: undefined,
      },
    ],
    nextRow: 1,
  });
});

Deno.test("layoutWorkbenchButtonRowInto reuses caller-owned placement storage", () => {
  const placements: WorkbenchButtonRowPlacement<string>[] = [{
    item: { label: "stale", action: "stale" },
    rect: { column: 99, row: 99, width: 1, height: 1 },
    state: "base",
    tone: undefined,
  }];
  const nextRow = layoutWorkbenchButtonRowInto(
    placements,
    [{ label: "OK", action: "ok", active: true }],
    { column: 3, row: 2, width: 12, height: 2 },
    2,
  );

  assertEquals(nextRow, 3);
  assertEquals(placements, [{
    item: { label: "OK", action: "ok", active: true },
    rect: { column: 3, row: 2, width: 6, height: 1 },
    state: "active",
    tone: undefined,
  }]);
});
