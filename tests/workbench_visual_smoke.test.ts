import { assertEquals, assertStringIncludes } from "./deps.ts";
import {
  formatWorkbenchVisualSmokeResult,
  inspectWorkbenchVisualSmokeOutput,
  replayWorkbenchScreen,
} from "../scripts/workbench_visual_smoke.ts";

Deno.test("workbench visual smoke replay applies cursor movement and row clearing", () => {
  const screen = replayWorkbenchScreen(
    "\x1b[2J\x1b[2;4HAPI\x1b[3;1Hstale\x1b[3;1H\x1b[2Kfresh",
    { columns: 12, rows: 4 },
  );

  assertEquals(screen.map((row) => row.join("").trimEnd()), [
    "",
    "   API",
    "fresh",
    "",
  ]);
});

Deno.test("workbench visual smoke inspector finds workbench telemetry and collisions", () => {
  const output = [
    "\x1b[2J",
    "\x1b[1;1HAPI WORKBENCH",
    "\x1b[4;1HTHREE ASCII",
    "\x1b[48;2;1;2;3m \x1b[0m",
    "\x1b[5;1H6ms 333c live 20fps",
    "\x1b[8;1Hfocus Three ASCII | Unit-01  F10 menu",
  ].join("");
  const result = inspectWorkbenchVisualSmokeOutput(output, { columns: 80, rows: 8 });

  assertEquals(result.passed, true);
  assertEquals(result.missing, []);
  assertEquals(result.forbidden, []);
  assertEquals(result.truecolorBackgroundWrites, 1);
  assertStringIncludes(result.threeLine, "20fps");
});

Deno.test("workbench visual smoke inspector rejects known crash and paint collision text", () => {
  const result = inspectWorkbenchVisualSmokeOutput(
    "\x1b[2J\x1b[1;1HAPI WORKBENCH\nTHREE ASCII\n6ms 333c live 20fps\nwarning)F10 RangeError",
    { columns: 80, rows: 8 },
  );

  assertEquals(result.passed, false);
  assertEquals(result.forbidden, ["RangeError", ")F10"]);
  assertStringIncludes(formatWorkbenchVisualSmokeResult(result), "Status: fail");
});
