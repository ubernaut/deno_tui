import { assertEquals } from "./deps.ts";
import { formatVisualSmokeReport, inspectVisualSmokeOutput } from "../scripts/visual_smoke.ts";

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
