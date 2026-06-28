import { assertEquals } from "./deps.ts";
import {
  formatVisualizationUsage,
  resolveVisualizationTask,
  visualizationLaunchTargets,
} from "../scripts/visualization_launcher.ts";

Deno.test("visualization launcher resolves public aliases to deno tasks", () => {
  assertEquals(resolveVisualizationTask(), "showcase");
  assertEquals(resolveVisualizationTask("polygons"), "three-ascii");
  assertEquals(resolveVisualizationTask("monitor"), "viz");
  assertEquals(resolveVisualizationTask("worker"), "worker-demo");
  assertEquals(resolveVisualizationTask("runtime"), "capabilities");
  assertEquals(resolveVisualizationTask("perf"), "benchmark");
  assertEquals(resolveVisualizationTask("wizard"), "grwizard");
  assertEquals(resolveVisualizationTask("check"), "health");
  assertEquals(resolveVisualizationTask("missing"), undefined);
});

Deno.test("visualization launcher exposes unique primary aliases", () => {
  const aliases = visualizationLaunchTargets.map((entry) => entry.aliases[0]);
  assertEquals([...new Set(aliases)], aliases);
});

Deno.test("visualization launcher help includes all primary aliases", () => {
  const usage = formatVisualizationUsage();
  for (const target of visualizationLaunchTargets) {
    assertEquals(usage.includes(target.aliases[0]), true);
  }
});
