import { assertEquals } from "./deps.ts";
import { defaultHealthSteps, formatHealthResult, type HealthResult, healthSucceeded } from "../scripts/health.ts";

Deno.test("health script exposes the expected contributor gates", () => {
  assertEquals(defaultHealthSteps.map((step) => step.name), [
    "format",
    "public-api",
    "api-inventory",
    "api-reference",
    "screenshots",
    "app-shell",
    "command-search",
    "layout-recipe",
    "action-middleware",
    "cached-resource",
    "cached-pipeline",
    "data-query",
    "runtime-workloads",
    "theme-engines",
    "theme-engine-commands",
    "theme-pipeline",
    "theme-workspace",
    "theme-resolver",
    "theme-bindings",
    "component-catalog",
    "app-plugin-catalog",
    "adopter-workbench",
    "demo-gallery",
    "visualization-app",
    "neon-exodus",
    "showcase",
    "grwizard",
    "tests",
    "worker-tests",
  ]);
  assertEquals(defaultHealthSteps[2].command, [
    "deno",
    "task",
    "api-inventory",
    "--",
    "--check",
    "--quiet",
    "--fail-duplicates",
    "--min-doc-coverage=0.25",
  ]);
});

Deno.test("health results format optional failures without failing the gate", () => {
  const results: HealthResult[] = [
    { name: "tests", command: ["deno", "test"], code: 0, success: true, durationMs: 12.4 },
    {
      name: "worker-tests",
      command: ["deno", "task", "test:workers"],
      code: 1,
      success: true,
      optional: true,
      durationMs: 4.4,
    },
  ];

  assertEquals(formatHealthResult(results[0]), "ok tests 12ms");
  assertEquals(formatHealthResult(results[1]), "ok worker-tests optional 4ms");
  assertEquals(healthSucceeded(results), true);
});

Deno.test("health results fail when a required step fails", () => {
  assertEquals(
    healthSucceeded([
      { name: "tests", command: ["deno", "test"], code: 1, success: false, durationMs: 1 },
    ]),
    false,
  );
});
