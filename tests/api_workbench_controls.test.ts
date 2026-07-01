import { assertEquals } from "./deps.ts";
import { apiWorkbenchControlIds, nextApiWorkbenchControlId } from "../app/api_workbench_controls.ts";

Deno.test("api workbench control ids preserve keyboard traversal order", () => {
  assertEquals(apiWorkbenchControlIds[0], "button");
  assertEquals(apiWorkbenchControlIds.at(-1), "textbox");
  assertEquals(nextApiWorkbenchControlId("button", 1), "genericButton");
  assertEquals(nextApiWorkbenchControlId("textbox", -1), "stepper");
});

Deno.test("api workbench control traversal supports wrap and edge-aware tabbing", () => {
  assertEquals(nextApiWorkbenchControlId("textbox", 1), undefined);
  assertEquals(nextApiWorkbenchControlId("button", -1), undefined);
  assertEquals(nextApiWorkbenchControlId("textbox", 1, { wrap: true }), "button");
  assertEquals(nextApiWorkbenchControlId("button", -1, { wrap: true }), "textbox");
  assertEquals(nextApiWorkbenchControlId("radio", 3), "input");
});
