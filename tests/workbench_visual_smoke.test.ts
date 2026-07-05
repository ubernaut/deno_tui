import { assertEquals, assertStringIncludes } from "./deps.ts";
import {
  countTruecolorBackgroundRows,
  formatWorkbenchVisualSmokeResult,
  inspectWorkbenchFullscreenVisualSmokeOutput,
  inspectWorkbenchVisualSmokeOutput,
  replayWorkbenchScreen,
} from "../scripts/workbench_visual_smoke.ts";
import { parseWorkbenchFullscreenVisualSmokeArgs } from "../scripts/workbench_fullscreen_visual_smoke.ts";

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

Deno.test("workbench fullscreen visual smoke inspector verifies scale and truecolor body paint", () => {
  const output = [
    "\x1b[2J",
    "\x1b[1;1HAPI WORKBENCH",
    "\x1b[4;1HTHREE ASCII",
    "\x1b[6;1Hframe 7ms scene 5 read 13 asm 0 3720c cap 3840c @10fps live 10fps",
    "\x1b[8;1H\x1b[48;2;1;2;3m  \x1b[0m",
    "\x1b[9;1H\x1b[48;2;4;5;6m  \x1b[0m",
    "\x1b[10;1H\x1b[48;2;7;8;9m  \x1b[0m",
    "\x1b[12;1Hfocus Three ASCII | Unit-01  F10 menu",
  ].join("");
  const result = inspectWorkbenchFullscreenVisualSmokeOutput(output, {
    columns: 80,
    rows: 12,
    minCells: 1800,
    minTruecolorRows: 3,
  });

  assertEquals(result.passed, true);
  assertEquals(result.fullscreen, true);
  assertEquals(result.fullscreenCells, 3720);
  assertEquals(result.fullscreenCap, 3840);
  assertEquals(result.truecolorBackgroundRows, 3);
  assertEquals(countTruecolorBackgroundRows(output), 3);
});

Deno.test("workbench fullscreen visual smoke parser accepts resize flags", () => {
  assertEquals(
    parseWorkbenchFullscreenVisualSmokeArgs([
      "--columns",
      "112",
      "--rows=34",
      "--resize-columns",
      "154",
      "--resize-rows=48",
      "--min-cells",
      "1800",
      "--min-truecolor-rows=24",
    ]),
    {
      columns: 112,
      rows: 34,
      resizeColumns: 154,
      resizeRows: 48,
      minCells: 1800,
      minTruecolorRows: 24,
    },
  );
});
