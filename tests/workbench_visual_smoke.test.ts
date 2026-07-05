import { assertEquals, assertStringIncludes } from "./deps.ts";
import { formatVisualSmokeReport, inspectVisualSmokeOutput } from "../scripts/visual_smoke.ts";
import {
  countTruecolorBackgroundRows,
  formatWorkbenchVisualSmokeResult,
  inspectWorkbenchFullscreenVisualSmokeOutput,
  inspectWorkbenchThreePaneCoverage,
  inspectWorkbenchVisualSmokeOutput,
  parseWorkbenchVisualSmokeArgs,
  replayWorkbenchScreen,
  replayWorkbenchStyledScreen,
} from "../scripts/workbench_visual_smoke.ts";
import { parseWorkbenchFullscreenVisualSmokeArgs } from "../scripts/workbench_fullscreen_visual_smoke.ts";

Deno.test("visual smoke inspector validates required anchors and strips ANSI", () => {
  const result = inspectVisualSmokeOutput({
    id: "demo",
    label: "Demo",
    command: ["deno", "task", "demo"],
    required: ["Ready", "Theme"],
    forbidden: ["panic"],
  }, {
    code: 0,
    stdout: "\x1b[32mReady\x1b[0m\nTheme Unit-01\n",
    durationMs: 12,
  });

  assertEquals(result.passed, true);
  assertEquals(result.missing, []);
  assertEquals(result.forbidden, []);
  assertEquals(result.nonBlankLines, 2);
  assertEquals(result.outputPreview, "Ready\nTheme Unit-01");
});

Deno.test("visual smoke report includes missing anchors and failed previews", () => {
  const result = inspectVisualSmokeOutput({
    id: "broken",
    label: "Broken Demo",
    command: ["deno", "task", "broken"],
    required: ["Overlay Stack"],
    forbidden: ["ReferenceError"],
  }, {
    code: 1,
    stdout: "Booting\nReferenceError: bad state\n",
    durationMs: 7,
  });
  const report = formatVisualSmokeReport({ passed: false, durationMs: 7, results: [result] });

  assertEquals(result.passed, false);
  assertEquals(result.missing, ["Overlay Stack"]);
  assertEquals(result.forbidden, ["ReferenceError"]);
  assertEquals(report.includes("| fail | broken | 7 | Overlay Stack | ReferenceError |"), true);
  assertEquals(report.includes("```text\nBooting\nReferenceError: bad state\n```"), true);
});

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

Deno.test("workbench visual smoke replay tracks final truecolor background cells", () => {
  const replay = replayWorkbenchStyledScreen(
    [
      "\x1b[2J",
      "\x1b[1;1Hplain",
      "\x1b[2;1H\x1b[48;2;1;2;3m  \x1b[0m",
      "\x1b[3;1H\x1b[48;2;4;5;6mxx\x1b[49m.",
      "\x1b[2;1H\x1b[2K",
    ].join(""),
    { columns: 8, rows: 4 },
  );

  assertEquals(replay.screen.map((row) => row.join("").trimEnd()), ["plain", "", "xx.", ""]);
  assertEquals(replay.truecolorBackgroundRows, 1);
  assertEquals(replay.truecolorBackgroundMaxColumns, 2);
  assertEquals(replay.truecolorBackground[2]?.slice(0, 3), [true, true, false]);
});

Deno.test("workbench visual smoke inspector reports final truecolor rows", () => {
  const output = [
    "\x1b[2J",
    "\x1b[1;1HAPI WORKBENCH",
    "\x1b[2;1H\x1b[48;2;1;2;3m  \x1b[0m",
    "\x1b[2;1H\x1b[2K",
    "\x1b[4;1HTHREE ASCII",
    "\x1b[5;1H6ms 333c live 20fps",
    "\x1b[8;1Hfocus Three ASCII | Unit-01  F10 menu",
  ].join("");
  const result = inspectWorkbenchVisualSmokeOutput(output, { columns: 80, rows: 8 });

  assertEquals(result.truecolorBackgroundWrites, 1);
  assertEquals(result.finalTruecolorBackgroundRows, 0);
  assertEquals(result.finalTruecolorBackgroundMaxColumns, 0);
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
  assertEquals(result.finalTruecolorBackgroundRows, 1);
  assertEquals(result.finalTruecolorBackgroundMaxColumns, 1);
  assertStringIncludes(result.threeLine, "20fps");
});

Deno.test("workbench visual smoke inspector measures Three pane truecolor coverage", () => {
  const output = [
    "\x1b[2J",
    "\x1b[1;1HAPI WORKBENCH",
    "\x1b[3;1H┌─ LOGS ─┐ ┌─ THREE ASCII ─────────[ config ]─[-]─[M]─[R]─[x]┐",
    "\x1b[4;1H│logs    │ │ THREE ASCII · BLOCKS                            │",
    "\x1b[5;1H│colored │ │6ms 784c live 18fps                              │",
    "\x1b[6;12H│\x1b[38;2;1;2;3m█████████████████████████████████████████████████\x1b[0m│",
    "\x1b[7;12H│\x1b[38;2;4;5;6m█████████████████████████\x1b[0m                        │",
    "\x1b[8;12H└─────────────────────────────────────────────────┘",
    "\x1b[9;1Hfocus Three ASCII | Unit-01  F10 menu",
  ].join("");
  const result = inspectWorkbenchVisualSmokeOutput(output, { columns: 70, rows: 9 });

  assertEquals(result.passed, true);
  assertEquals(result.threePane?.found, true);
  assertEquals(result.threePane?.bodyRows, 2);
  assertEquals(result.threePane?.truecolorRows, 2);
  assertEquals(result.threePane?.truecolorMaxColumns, 49);
  assertEquals(result.threePane?.visibleRows, 2);
  assertEquals(result.threePane?.visibleMaxColumns, 49);
  assertStringIncludes(formatWorkbenchVisualSmokeResult(result), "Three pane truecolor: 2 rows, 49/49 columns");
});

Deno.test("workbench visual smoke inspector rejects under-scaled Three pane telemetry", () => {
  const output = [
    "\x1b[2J",
    "\x1b[1;1HAPI WORKBENCH",
    "\x1b[3;1H┌─ LOGS ─┐ ┌─ THREE ASCII ─────────[ config ]─[-]─[M]─[R]─[x]┐",
    "\x1b[4;1H│logs    │ │ THREE ASCII · BLOCKS                            │",
    "\x1b[5;1H│colored │ │6ms 40c live 18fps                               │",
    "\x1b[6;12H│\x1b[48;2;1;2;3m\x1b[38;2;1;2;3m█████████████████████████████████████████████████\x1b[0m│",
    "\x1b[7;12H│\x1b[48;2;4;5;6m\x1b[38;2;4;5;6m█████████████████████████████████████████████████\x1b[0m│",
    "\x1b[8;12H└─────────────────────────────────────────────────┘",
    "\x1b[9;1Hfocus Three ASCII | Unit-01  F10 menu",
  ].join("");
  const result = inspectWorkbenchVisualSmokeOutput(output, { columns: 70, rows: 9 });

  assertEquals(result.passed, false);
  assertEquals(result.threeRenderedCells, 40);
  assertEquals(result.missing, ["three rendered cells >= 86"]);
});

Deno.test("workbench visual smoke inspector rejects colored resize frames when Three pane stays blank", () => {
  const output = [
    "\x1b[2J",
    "\x1b[1;1HAPI WORKBENCH",
    "\x1b[2;1H\x1b[48;2;9;9;9m                                                            \x1b[0m",
    "\x1b[3;1H┌─ LOGS ─┐ ┌─ THREE ASCII ─────────[ config ]─[-]─[M]─[R]─[x]┐",
    "\x1b[4;1H│logs    │ │ THREE ASCII · BLOCKS                            │",
    "\x1b[5;1H│colored │ │6ms 784c live 18fps                              │",
    "\x1b[6;12H│                                                 │",
    "\x1b[7;12H│                                                 │",
    "\x1b[8;12H└─────────────────────────────────────────────────┘",
    "\x1b[9;1Hfocus Three ASCII | Unit-01  F10 menu",
  ].join("");
  const result = inspectWorkbenchVisualSmokeOutput(output, { columns: 70, rows: 9 });

  assertEquals(result.passed, false);
  assertEquals(result.missing, [
    "three pane truecolor rows >= 2",
    "three pane truecolor columns >= 17",
    "three pane visible rows >= 2",
    "three pane visible columns >= 3",
  ]);
  assertEquals(result.threePane?.truecolorRows, 0);
  assertEquals(result.threePane?.truecolorMaxColumns, 0);
});

Deno.test("workbench Three pane coverage locates the last visible Three window", () => {
  const lines = [
    "┌─ THREE ASCII ─┐",
    "│old            │",
    "└───────────────┘",
    "┌─ THREE ASCII ─────────[ config ]─[-]─[M]─[R]─[x]┐",
    "│ THREE ASCII · BLOCKS                            │",
    "│6ms 784c live 18fps                              │",
    "│                                                 │",
    "└─────────────────────────────────────────────────┘",
  ];
  const mask = lines.map((line, row) => Array.from({ length: line.length }, (_, column) => row === 6 && column > 0));
  const coverage = inspectWorkbenchThreePaneCoverage(lines, mask);

  assertEquals(coverage?.top, 3);
  assertEquals(coverage?.bodyRows, 1);
  assertEquals(coverage?.truecolorRows, 1);
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
    "\x1b[8;1H\x1b[48;2;1;2;3m\x1b[38;2;1;2;3m██\x1b[0m",
    "\x1b[9;1H\x1b[48;2;4;5;6m\x1b[38;2;4;5;6m██\x1b[0m",
    "\x1b[10;1H\x1b[48;2;7;8;9m\x1b[38;2;7;8;9m██\x1b[0m",
    "\x1b[12;1Hfocus Three ASCII | Unit-01  F10 menu",
  ].join("");
  const result = inspectWorkbenchFullscreenVisualSmokeOutput(output, {
    columns: 80,
    rows: 12,
    minCells: 1800,
    minTruecolorRows: 3,
    minTruecolorColumns: 2,
  });

  assertEquals(result.passed, true);
  assertEquals(result.fullscreen, true);
  assertEquals(result.fullscreenCells, 3720);
  assertEquals(result.fullscreenCap, 3840);
  assertEquals(result.truecolorBackgroundRows, 3);
  assertEquals(result.finalTruecolorBackgroundRows, 3);
  assertEquals(result.truecolorBackgroundMaxColumns, 2);
  assertEquals(result.finalTruecolorBackgroundMaxColumns, 2);
  assertEquals(result.bodyTruecolorBackgroundRows, 3);
  assertEquals(result.bodyTruecolorBackgroundMaxColumns, 2);
  assertEquals(result.bodyVisibleRows, 3);
  assertEquals(result.bodyVisibleMaxColumns, 2);
  assertEquals(countTruecolorBackgroundRows(output), 3);
});

Deno.test("workbench fullscreen visual smoke accepts compact telemetry after shrink resize", () => {
  const output = [
    "\x1b[2J",
    "\x1b[1;1HAPI WORKBENCH",
    "\x1b[4;1H┌─ THREE ASCII ─┐",
    "\x1b[5;1H│ ACEROLA THREE │",
    "\x1b[6;1H│5ms 1602c live 20fps q1/2 rows 33/38 tier 3840c│",
    "\x1b[7;2H\x1b[48;2;1;2;3m\x1b[38;2;1;2;3m████████████████████████████████████████████████████████████\x1b[0m",
    "\x1b[8;2H\x1b[48;2;4;5;6m\x1b[38;2;4;5;6m████████████████████████████████████████████████████████████\x1b[0m",
    "\x1b[9;2H\x1b[48;2;7;8;9m\x1b[38;2;7;8;9m████████████████████████████████████████████████████████████\x1b[0m",
    "\x1b[10;1H└────────────────┘",
    "\x1b[12;1Hfocus Three ASCII | Unit-01  F10 menu",
  ].join("");
  const result = inspectWorkbenchFullscreenVisualSmokeOutput(output, {
    columns: 80,
    rows: 12,
    minCells: 900,
    minTruecolorRows: 3,
    minTruecolorColumns: 60,
  });

  assertEquals(result.passed, true);
  assertEquals(result.fullscreenCells, 1602);
  assertEquals(result.fullscreenCap, 1602);
  assertEquals(result.bodyTruecolorBackgroundRows, 3);
  assertEquals(result.bodyTruecolorBackgroundMaxColumns, 60);
  assertEquals(result.bodyVisibleRows, 3);
  assertEquals(result.bodyVisibleMaxColumns, 60);
});

Deno.test("workbench fullscreen visual smoke rejects narrow truecolor surfaces after resize", () => {
  const output = [
    "\x1b[2J",
    "\x1b[1;1HAPI WORKBENCH",
    "\x1b[4;1HTHREE ASCII",
    "\x1b[6;1Hframe 7ms scene 5 read 13 asm 0 3720c cap 3840c @10fps live 10fps",
    "\x1b[8;1H\x1b[48;2;1;2;3m          \x1b[0m",
    "\x1b[9;1H\x1b[48;2;4;5;6m          \x1b[0m",
    "\x1b[12;1Hfocus Three ASCII | Unit-01  F10 menu",
  ].join("");
  const result = inspectWorkbenchFullscreenVisualSmokeOutput(output, {
    columns: 80,
    rows: 12,
    minCells: 1800,
    minTruecolorRows: 2,
    minTruecolorColumns: 60,
  });

  assertEquals(result.passed, false);
  assertEquals(result.missing, [
    "truecolor columns >= 60",
    "three body truecolor columns >= 60",
    "three body visible rows >= 2",
    "three body visible columns >= 4",
  ]);
  assertEquals(result.truecolorBackgroundMaxColumns, 10);
  assertEquals(result.bodyTruecolorBackgroundMaxColumns, 10);
});

Deno.test("workbench fullscreen visual smoke accepts full-pane offline renderer fallback", () => {
  const output = [
    "\x1b[2J",
    "\x1b[1;1HAPI WORKBENCH",
    "\x1b[4;1H┌─ THREE ASCII ───────────────────────────────────────────────────────────┐",
    "\x1b[5;1H│ ACEROLA THREE.JS ASCII · BLOCKS                                          │",
    "\x1b[6;1H│                                                                          │",
    "\x1b[7;2H\x1b[48;2;1;2;3m                                                                        \x1b[0m│",
    "\x1b[8;2H\x1b[48;2;4;5;6m                                                                        \x1b[0m│",
    "\x1b[9;2H\x1b[48;2;7;8;9m                                                                        \x1b[0m│",
    "\x1b[10;1H│                         ASCII RENDERER OFFLINE                           │",
    "\x1b[11;1H│                     THREE ASCII GPU READBACK UNAVAILABLE.                 │",
    "\x1b[12;1H└──────────────────────────────────────────────────────────────────────────┘",
    "\x1b[14;1Hfocus Three ASCII | Unit-01  F10 menu",
  ].join("");
  const result = inspectWorkbenchFullscreenVisualSmokeOutput(output, {
    columns: 80,
    rows: 14,
    minCells: 1800,
    minTruecolorRows: 3,
    minTruecolorColumns: 60,
  });

  assertEquals(result.passed, true);
  assertEquals(result.fullscreenCells, 0);
  assertEquals(result.bodyTruecolorBackgroundRows, 3);
  assertEquals(result.bodyTruecolorBackgroundMaxColumns, 72);
});

Deno.test("workbench fullscreen visual smoke parser accepts resize flags", () => {
  assertEquals(
    parseWorkbenchFullscreenVisualSmokeArgs([
      "--",
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

Deno.test("workbench visual smoke parser accepts viewport flags", () => {
  assertEquals(
    parseWorkbenchVisualSmokeArgs([
      "--",
      "--columns",
      "100",
      "--rows=30",
      "--resize-columns",
      "160",
      "--resize-rows=48",
      "--settle-ms",
      "3000",
      "--timeout-ms",
      "9000",
      "--dump-screen",
    ]),
    {
      columns: 100,
      rows: 30,
      resizeColumns: 160,
      resizeRows: 48,
      settleMs: 3000,
      timeoutMs: 9000,
      dumpScreen: true,
    },
  );
});
