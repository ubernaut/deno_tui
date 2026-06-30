import { assertEquals } from "./deps.ts";
import {
  e2eArtifactTargets,
  e2eCommandTargets,
  formatE2EReport,
  inspectE2EArtifactData,
  inspectE2ECommandOutput,
} from "../scripts/e2e.ts";

Deno.test("e2e command inspection validates anchors and forbidden runtime errors", () => {
  const result = inspectE2ECommandOutput({
    id: "demo",
    label: "Demo",
    command: ["deno", "task", "demo"],
    required: ["Ready", "Theme"],
  }, {
    code: 0,
    stdout: "\x1b[32mReady\x1b[0m\nTheme Unit-01\n",
    durationMs: 8,
  });

  assertEquals(result.passed, true);
  assertEquals(result.missing, []);
  assertEquals(result.forbiddenMatches, []);
  assertEquals(result.outputPreview, "Ready\nTheme Unit-01");

  const failed = inspectE2ECommandOutput({
    id: "broken",
    label: "Broken",
    command: ["deno", "task", "broken"],
    required: ["Mounted"],
  }, {
    code: 1,
    stdout: "Booting\nReferenceError: bad state\n",
  });

  assertEquals(failed.passed, false);
  assertEquals(failed.missing, ["Mounted"]);
  assertEquals(failed.forbiddenMatches, ["ReferenceError"]);
});

Deno.test("e2e artifact inspection validates generated browser assets", () => {
  const result = inspectE2EArtifactData(
    {
      id: "bundle",
      label: "Bundle",
      path: "docs/assets/app.js",
      required: ["Generated", "mount"],
      minBytes: 8,
    },
    20,
    "// Generated\nmount();",
  );

  assertEquals(result.passed, true);
  assertEquals(result.missing, []);

  const failed = inspectE2EArtifactData(
    {
      id: "bundle",
      label: "Bundle",
      path: "docs/assets/app.js",
      required: ["Generated"],
      minBytes: 32,
    },
    20,
    "console.log('missing banner')",
  );

  assertEquals(failed.passed, false);
  assertEquals(failed.missing, ["minBytes:32", "Generated"]);
});

Deno.test("e2e report prints command and artifact failure diagnostics", () => {
  const command = inspectE2ECommandOutput({
    id: "broken-command",
    label: "Broken Command",
    command: ["deno", "task", "broken"],
    required: ["Ready"],
  }, {
    code: 1,
    stdout: "ReferenceError: bad state",
  });
  const artifact = inspectE2EArtifactData(
    {
      id: "small-artifact",
      label: "Small Artifact",
      path: "docs/assets/app.js",
      minBytes: 10,
    },
    4,
    "tiny",
  );
  const report = formatE2EReport({ passed: false, durationMs: 12, commands: [command], artifacts: [artifact] });

  assertEquals(report.includes("| fail | broken-command | 0 | 1 | Ready | ReferenceError |"), true);
  assertEquals(report.includes("| fail | small-artifact | 4 | minBytes:10 | - |"), true);
  assertEquals(report.includes("## Failed Output Previews"), true);
});

Deno.test("default e2e catalog covers web console package and generated pages", () => {
  assertEquals(e2eCommandTargets.map((target) => target.id), [
    "pages-build",
    "web-demo-check",
    "web-runtime-tests",
    "demo-gallery",
    "component-catalog",
    "app-plugin-catalog",
    "capabilities",
    "benchmark-catalog",
    "api-inventory-gate",
    "package-check",
  ]);
  assertEquals(e2eArtifactTargets.map((target) => target.id), [
    "pages-html",
    "web-workbench-bundle",
  ]);
});
