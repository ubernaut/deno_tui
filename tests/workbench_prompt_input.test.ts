import { assertEquals } from "./deps.ts";
import { applyWorkbenchTextPromptInput } from "../src/app/workbench_prompt_input.ts";

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
