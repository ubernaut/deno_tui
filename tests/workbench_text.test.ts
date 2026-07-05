// Copyright 2023 Im-Beast. MIT license.
import { assertEquals } from "./deps.ts";
import { applyWorkbenchTextPromptInput, dispatchWorkbenchTextPromptInput } from "../src/app/workbench_prompt_input.ts";
import {
  compactSpaces,
  maxTextWidth,
  maxTextWidthBy,
  maxTrimmedTextWidth,
  visibleMenuSlice,
  visibleMenuSliceInto,
  visibleProjectedMenuSliceInto,
  wrapPlainText,
  wrapPlainTextInto,
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

  const target = wrapPlainText("first pass", 5, fit);
  const sameTarget = wrapPlainTextInto(target, "\x1b[32mhello\x1b[0m compact world", 8, fit);
  assertEquals(sameTarget === target, true);
  assertEquals(target, [
    "hello",
    "compact",
    "world",
  ]);
  assertEquals(wrapPlainTextInto(target, "   ", 8, fit), [""]);
  assertEquals(target.length, 1);
});

Deno.test("workbench text helpers project visible menu slices around selection", () => {
  const items = ["a", "b", "c", "d", "e"];
  assertEquals(visibleMenuSlice(items, 0, 3), { items: ["a", "b", "c"], indexes: [0, 1, 2] });
  assertEquals(visibleMenuSlice(items, 2, 3), { items: ["b", "c", "d"], indexes: [1, 2, 3] });
  assertEquals(visibleMenuSlice(items, 4, 3), { items: ["c", "d", "e"], indexes: [2, 3, 4] });

  const full = visibleMenuSlice(items, 2, 10);
  full.items[0] = "mutated";
  assertEquals(items[0], "a");

  const target = { items: ["stale"], indexes: [99] };
  assertEquals(visibleMenuSliceInto(target, items, 4, 3), { items: ["c", "d", "e"], indexes: [2, 3, 4] });
  assertEquals(visibleMenuSliceInto(target, ["x"], 0, 3), { items: ["x"], indexes: [0] });
  assertEquals(target.items.length, 1);
  assertEquals(target.indexes.length, 1);

  assertEquals(
    visibleProjectedMenuSliceInto(
      target,
      [{ label: "alpha" }, { label: "beta" }],
      0,
      4,
      (entry, index) => `${index}:${entry.label}`,
    ),
    { items: ["0:alpha", "1:beta"], indexes: [0, 1] },
  );
});

Deno.test("workbench text prompt input edits printable cell-width keys", () => {
  assertEquals(
    applyWorkbenchTextPromptInput({ event: { key: "a" }, value: "dem", maxLength: 8 }),
    { action: "update", value: "dema" },
  );
  assertEquals(
    applyWorkbenchTextPromptInput({ event: { key: "b" }, value: "1234", maxLength: 4 }),
    { action: "update", value: "1234" },
  );
});

Deno.test("workbench text prompt input handles backspace submit and cancel", () => {
  assertEquals(
    applyWorkbenchTextPromptInput({ event: { key: "backspace" }, value: "demo" }),
    { action: "update", value: "dem" },
  );
  assertEquals(
    applyWorkbenchTextPromptInput({ event: { key: "return" }, value: "demo" }),
    { action: "submit", value: "demo" },
  );
  assertEquals(
    applyWorkbenchTextPromptInput({ event: { key: "escape" }, value: "demo" }),
    { action: "cancel", value: "demo" },
  );
});

Deno.test("workbench text prompt input ignores modified and non-cell keys", () => {
  assertEquals(
    applyWorkbenchTextPromptInput({ event: { key: "x", ctrl: true }, value: "demo" }),
    { action: "ignore", value: "demo" },
  );
  assertEquals(
    applyWorkbenchTextPromptInput({ event: { key: "left" }, value: "demo" }),
    { action: "ignore", value: "demo" },
  );
  assertEquals(
    applyWorkbenchTextPromptInput({
      event: { key: "字" },
      value: "demo",
      measureText: () => 2,
    }),
    { action: "ignore", value: "demo" },
  );
});

Deno.test("workbench text prompt dispatcher reports handled actions and callbacks", () => {
  const calls: string[] = [];

  assertEquals(
    dispatchWorkbenchTextPromptInput(
      { event: { key: "x", ctrl: true }, value: "demo" },
      { onUpdate: (value) => calls.push(`update:${value}`) },
    ),
    false,
  );
  assertEquals(calls, []);

  assertEquals(
    dispatchWorkbenchTextPromptInput(
      { event: { key: "a" }, value: "demo", maxLength: 8 },
      { onUpdate: (value) => calls.push(`update:${value}`) },
    ),
    true,
  );
  assertEquals(
    dispatchWorkbenchTextPromptInput(
      { event: { key: "return" }, value: "demoa" },
      { onSubmit: (value) => calls.push(`submit:${value}`) },
    ),
    true,
  );
  assertEquals(
    dispatchWorkbenchTextPromptInput(
      { event: { key: "escape" }, value: "demoa" },
      { onCancel: (value) => calls.push(`cancel:${value}`) },
    ),
    true,
  );

  assertEquals(calls, ["update:demoa", "submit:demoa", "cancel:demoa"]);
});
