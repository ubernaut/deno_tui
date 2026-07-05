import { assertEquals } from "./deps.ts";
import {
  appendDemoLauncherInput,
  filterDemoTargets,
  formatDemoLauncherScreen,
  moveDemoSelection,
} from "../scripts/demo_launcher.ts";
import {
  createVisualizationLaunchReport,
  findVisualizationLaunchTarget,
  formatVisualizationLaunchMarkdown,
  formatVisualizationUsage,
  inspectVisualizationLaunchTargets,
  queryVisualizationLaunchTargets,
  resolveVisualizationTask,
  visualizationLaunchTargets,
} from "../scripts/visualization_launcher.ts";
import { defaultVisualizationForSlot, orderVisualizationsForSlot } from "../app/panel_defaults.ts";
import { visualizations } from "../app/visualizations.ts";

Deno.test("visualization launcher resolves public aliases to deno tasks", () => {
  assertEquals(resolveVisualizationTask(), "showcase");
  assertEquals(resolveVisualizationTask("neon"), "neon-exodus");
  assertEquals(resolveVisualizationTask("portfolio"), "api-workbench");
  assertEquals(resolveVisualizationTask("polygons"), "three-ascii");
  assertEquals(resolveVisualizationTask("recipe"), "layout-recipe");
  assertEquals(resolveVisualizationTask("monitor"), "viz");
  assertEquals(resolveVisualizationTask("worker"), "worker-demo");
  assertEquals(resolveVisualizationTask("command-index"), "command-search");
  assertEquals(resolveVisualizationTask("actions"), "action-middleware");
  assertEquals(resolveVisualizationTask("resources"), "cached-resource");
  assertEquals(resolveVisualizationTask("pipeline"), "cached-pipeline");
  assertEquals(resolveVisualizationTask("forms"), "form-workflow");
  assertEquals(resolveVisualizationTask("selection"), "table-selection");
  assertEquals(resolveVisualizationTask("windowing"), "window-manager");
  assertEquals(resolveVisualizationTask("file-explorer"), "window-manager");
  assertEquals(resolveVisualizationTask("desktop"), "workspace-launcher");
  assertEquals(resolveVisualizationTask("demo-workspace"), "workspace-launcher");
  assertEquals(resolveVisualizationTask("session"), "terminal-command");
  assertEquals(resolveVisualizationTask("theme-pack"), "theme-manifest");
  assertEquals(resolveVisualizationTask("themes"), "theme-engines");
  assertEquals(resolveVisualizationTask("theme-command-surface"), "theme-engine-commands");
  assertEquals(resolveVisualizationTask("theme-runtime"), "theme-pipeline");
  assertEquals(resolveVisualizationTask("theme-orchestrator"), "theme-workspace");
  assertEquals(resolveVisualizationTask("theme-picker"), "theme-gallery");
  assertEquals(resolveVisualizationTask("theme-resolution"), "theme-resolver");
  assertEquals(resolveVisualizationTask("theme-wiring"), "theme-bindings");
  assertEquals(resolveVisualizationTask("runtime"), "capabilities");
  assertEquals(resolveVisualizationTask("runtime-pressure"), "runtime-workloads");
  assertEquals(resolveVisualizationTask("perf"), "benchmark");
  assertEquals(resolveVisualizationTask("exports"), "api-inventory");
  assertEquals(resolveVisualizationTask("widgets"), "component-catalog");
  assertEquals(resolveVisualizationTask("plugin-catalog"), "app-plugin-catalog");
  assertEquals(resolveVisualizationTask("adopter"), "adopter-workbench");
  assertEquals(resolveVisualizationTask("gallery"), "demo-gallery");
  assertEquals(resolveVisualizationTask("phase-status"), "batteries");
  assertEquals(resolveVisualizationTask("check"), "health");
  assertEquals(findVisualizationLaunchTarget("system-monitor")?.task, "viz");
  assertEquals(resolveVisualizationTask("missing"), undefined);
});

Deno.test("interactive demo launcher filters renders and moves selections", () => {
  const targets = filterDemoTargets(visualizationLaunchTargets, "portfolio");
  assertEquals(targets.map((target) => target.task), ["api-workbench"]);
  assertEquals(
    moveDemoSelection({ index: 0, query: "" }, visualizationLaunchTargets, -1).index,
    visualizationLaunchTargets.length - 1,
  );
  const screen = formatDemoLauncherScreen(targets, { index: 0, query: "portfolio" }, { width: 80, height: 10 });
  assertEquals(screen.includes("DEMO LAUNCHER"), true);
  assertEquals(screen.includes("api-workbench"), true);
});

Deno.test("interactive demo launcher accepts buffered printable input", () => {
  assertEquals(appendDemoLauncherInput({ index: 4, query: "" }, "batteries"), {
    index: 0,
    query: "batteries",
  });
  assertEquals(appendDemoLauncherInput({ index: 1, query: "api" }, "\x1b[A"), {
    index: 1,
    query: "api",
  });
});

Deno.test("visualization launcher exposes unique primary aliases", () => {
  const aliases = visualizationLaunchTargets.map((entry) => entry.aliases[0]);
  assertEquals([...new Set(aliases)], aliases);
});

Deno.test("visualization panel defaults pick the curated monitor wall demos", () => {
  assertEquals(defaultVisualizationForSlot("cpu"), "three-lattice");
  assertEquals(defaultVisualizationForSlot("gpu"), "gpu-combined-monitor");
  assertEquals(defaultVisualizationForSlot("gpuChip"), "gpu-chip-monitor");
  assertEquals(defaultVisualizationForSlot("gpuMemory"), "gpu-memory-monitor");
  assertEquals(defaultVisualizationForSlot("memory"), "three-hexshell");
  assertEquals(defaultVisualizationForSlot("temperature"), "three-capture");
  assertEquals(defaultVisualizationForSlot("disk"), "three-mapslab");
  assertEquals(defaultVisualizationForSlot("network"), "three-solenoid");
  assertEquals(defaultVisualizationForSlot("processes"), "process-monitor");
});

Deno.test("visualization panel defaults sort slot-specific recommendations first", () => {
  assertEquals(orderVisualizationsForSlot("processes", visualizations).slice(0, 5).map((entry) => entry.id), [
    "process-monitor",
    "event-log",
    "channel-matrix",
    "telemetry-rack",
    "warning-stack",
  ]);
  assertEquals(orderVisualizationsForSlot("cpu", visualizations).slice(0, 4).map((entry) => entry.id), [
    "three-lattice",
    "harmonic-graph",
    "biosignal-strip",
    "telemetry-rack",
  ]);
  assertEquals(orderVisualizationsForSlot("memory", visualizations).slice(0, 5).map((entry) => entry.id), [
    "three-hexshell",
    "hex-heatmap",
    "field-ring",
    "telemetry-rack",
    "memory-monitor",
  ]);
});

Deno.test("visualization launcher help includes all primary aliases", () => {
  const usage = formatVisualizationUsage();
  for (const target of visualizationLaunchTargets) {
    assertEquals(usage.includes(target.aliases[0]), true);
  }
});

Deno.test("visualization launch catalog filters targets by category tag and search", () => {
  assertEquals(queryVisualizationLaunchTargets({ category: "app" }).map((entry) => entry.task), [
    "api-workbench",
    "viz",
    "neon-exodus",
    "showcase",
    "workspace-launcher",
  ]);
  assertEquals(queryVisualizationLaunchTargets({ tag: "catalog" }).map((entry) => entry.task), [
    "adopter-workbench",
    "component-catalog",
    "demo-gallery",
    "app-plugin-catalog",
    "theme-gallery",
  ]);
  assertEquals(queryVisualizationLaunchTargets({ tag: "theme" }).map((entry) => entry.task), [
    "api-workbench",
    "dashboard",
    "theme-bindings",
    "theme-engine-commands",
    "theme-engines",
    "theme-pipeline",
    "theme-resolver",
    "theme-workspace",
    "theme-gallery",
    "theme-manifest",
  ]);
  assertEquals(queryVisualizationLaunchTargets({ search: "worker concurrency" }).map((entry) => entry.task), [
    "worker-demo",
  ]);
  assertEquals(queryVisualizationLaunchTargets({ tag: "usability" }).map((entry) => entry.task), [
    "window-manager",
  ]);
  assertEquals(queryVisualizationLaunchTargets({ tag: "runtime" }).map((entry) => entry.task), [
    "command-search",
    "data-query",
    "cached-pipeline",
    "cached-resource",
    "runtime-workloads",
    "terminal-command",
    "worker-demo",
    "adopter-workbench",
    "batteries",
    "capabilities",
  ]);
});

Deno.test("visualization launch catalog reports inspection and markdown", () => {
  const report = createVisualizationLaunchReport({ query: { category: "check" } });
  const markdown = formatVisualizationLaunchMarkdown({
    query: { tag: "capabilities" },
    title: "Runtime Launchers",
  });

  assertEquals(report, {
    targets: [
      {
        task: "health",
        aliases: ["health", "check"],
        description: "contributor health gate",
        category: "check",
        tags: ["ci", "health"],
      },
    ],
    inspection: {
      count: 1,
      categories: ["check"],
      tags: ["ci", "health"],
      tasks: ["health"],
    },
  });
  assertEquals(inspectVisualizationLaunchTargets(report.targets).count, 1);
  assertEquals(
    markdown,
    [
      "# Runtime Launchers",
      "",
      "1 targets across 1 categories.",
      "",
      "| Target | Task | Category | Tags | Description |",
      "| --- | --- | --- | --- | --- |",
      "| capabilities | capabilities | report | runtime, capabilities | runtime capability report |",
    ].join("\n"),
  );
});
