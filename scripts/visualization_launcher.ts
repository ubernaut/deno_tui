export interface VisualizationLaunchTarget {
  task: string;
  aliases: readonly string[];
  description: string;
  category?: VisualizationLaunchCategory;
  tags?: readonly string[];
}

export type VisualizationLaunchCategory = "app" | "demo" | "report" | "tool" | "check";

export interface VisualizationLaunchQuery {
  search?: string;
  category?: VisualizationLaunchCategory;
  tag?: string;
  task?: string;
}

export interface VisualizationLaunchInspection {
  count: number;
  categories: VisualizationLaunchCategory[];
  tags: string[];
  tasks: string[];
}

export interface VisualizationLaunchReport {
  targets: VisualizationLaunchTarget[];
  inspection: VisualizationLaunchInspection;
}

export interface VisualizationLaunchReportOptions {
  targets?: readonly VisualizationLaunchTarget[];
  query?: VisualizationLaunchQuery;
}

export interface VisualizationLaunchMarkdownOptions extends VisualizationLaunchReportOptions {
  title?: string;
  includeSummary?: boolean;
}

export const visualizationLaunchTargets: readonly VisualizationLaunchTarget[] = [
  {
    task: "showcase",
    aliases: ["showcase", "demo"],
    description: "full widget showcase",
    category: "app",
    tags: ["widgets", "visualization"],
  },
  {
    task: "api-workbench",
    aliases: ["api-workbench", "workbench-ui", "interactive-api", "portfolio"],
    description: "interactive API portfolio with resizable windows controls scroll areas tables and theme selector",
    category: "app",
    tags: ["api", "widgets", "layout", "theme", "interactive"],
  },
  {
    task: "neon-exodus",
    aliases: ["neon-exodus", "neon", "exodus", "opentui-neon"],
    description: "OpenTUI and web Neon Exodus demo suite",
    category: "app",
    tags: ["widgets", "visualization", "three", "neon"],
  },
  {
    task: "three-ascii",
    aliases: ["polygons", "polygon", "geometry", "three", "three-ascii", "ascii"],
    description: "standalone three.js ASCII geometry demo",
    category: "demo",
    tags: ["three", "ascii", "visualization"],
  },
  {
    task: "dashboard",
    aliases: ["dashboard", "dash"],
    description: "dashboard widgets and theme engine demo",
    category: "demo",
    tags: ["dashboard", "theme"],
  },
  {
    task: "app-shell",
    aliases: ["app-shell", "shell", "app"],
    description: "app primitives, command palette, routes, and toasts demo",
    category: "demo",
    tags: ["app", "commands", "routes"],
  },
  {
    task: "command-search",
    aliases: ["command-search", "command-index", "indexed-commands"],
    description: "scheduler-backed indexed command search demo",
    category: "demo",
    tags: ["app", "commands", "runtime"],
  },
  {
    task: "layout-recipe",
    aliases: ["layout-recipe", "layout-report", "recipe"],
    description: "responsive layout recipe report",
    category: "report",
    tags: ["layout", "responsive"],
  },
  {
    task: "viz",
    aliases: ["monitor", "system-monitor", "system", "viz"],
    description: "system monitor visualization dashboard",
    category: "app",
    tags: ["monitor", "visualization", "three"],
  },
  {
    task: "worker-demo",
    aliases: ["worker", "workers", "worker-demo"],
    description: "abortable WorkerPool concurrency demo",
    category: "demo",
    tags: ["runtime", "workers"],
  },
  {
    task: "action-middleware",
    aliases: ["actions", "action-middleware", "middleware"],
    description: "action middleware and plugin pipeline demo",
    category: "demo",
    tags: ["app", "plugins", "actions"],
  },
  {
    task: "cached-resource",
    aliases: ["resource", "cached-resource", "resources"],
    description: "cached async resource loader demo",
    category: "demo",
    tags: ["runtime", "resource", "cache"],
  },
  {
    task: "cached-pipeline",
    aliases: ["pipeline", "cached-pipeline", "cache"],
    description: "cached scheduler-backed data pipeline demo",
    category: "demo",
    tags: ["runtime", "pipeline", "cache"],
  },
  {
    task: "data-query",
    aliases: ["data-query", "query", "dataset"],
    description: "cached async data query controller demo",
    category: "demo",
    tags: ["runtime", "query", "cache"],
  },
  {
    task: "form-workflow",
    aliases: ["form", "forms", "form-workflow"],
    description: "form controller binding and command workflow demo",
    category: "demo",
    tags: ["app", "forms", "commands"],
  },
  {
    task: "table-selection",
    aliases: ["table-selection", "table", "selection"],
    description: "data table, keyed rows, and multi-selection workflow demo",
    category: "demo",
    tags: ["data", "table", "selection", "commands"],
  },
  {
    task: "terminal-command",
    aliases: ["terminal-command", "terminal-session", "session"],
    description: "terminal session planning and command surface demo",
    category: "demo",
    tags: ["terminal", "commands", "runtime"],
  },
  {
    task: "theme-manifest",
    aliases: ["theme-manifest", "theme-pack", "manifest"],
    description: "serializable theme manifest report",
    category: "report",
    tags: ["theme", "manifest"],
  },
  {
    task: "theme-engines",
    aliases: ["theme-engines", "theme-factories", "themes"],
    description: "theme engine factory registry demo",
    category: "demo",
    tags: ["theme", "factory"],
  },
  {
    task: "theme-engine-commands",
    aliases: ["theme-engine-commands", "theme-command-surface", "theme-engine-palette"],
    description: "theme engine command surface demo",
    category: "demo",
    tags: ["theme", "factory", "commands"],
  },
  {
    task: "theme-pipeline",
    aliases: ["theme-pipeline", "theme-runtime", "theme-transforms"],
    description: "runtime theme transform pipeline demo",
    category: "demo",
    tags: ["theme", "pipeline"],
  },
  {
    task: "theme-workspace",
    aliases: ["theme-workspace", "theme-orchestrator", "theme-suite"],
    description: "combined provider factory pipeline theme workspace demo",
    category: "demo",
    tags: ["theme", "workspace", "factory", "pipeline"],
  },
  {
    task: "theme-gallery",
    aliases: ["theme-gallery", "theme-picker", "theme-catalog"],
    description: "searchable theme gallery and preview report",
    category: "report",
    tags: ["theme", "catalog"],
  },
  {
    task: "theme-resolver",
    aliases: ["theme-resolver", "theme-resolution", "theme-cache"],
    description: "cached theme resolver and renderer lookup demo",
    category: "demo",
    tags: ["theme", "cache", "renderer"],
  },
  {
    task: "theme-bindings",
    aliases: ["theme-bindings", "theme-binding", "theme-wiring"],
    description: "grouped component theme binding demo",
    category: "demo",
    tags: ["theme", "bindings", "lifecycle"],
  },
  {
    task: "capabilities",
    aliases: ["capabilities", "caps", "runtime"],
    description: "runtime capability report",
    category: "report",
    tags: ["runtime", "capabilities"],
  },
  {
    task: "runtime-workloads",
    aliases: ["runtime-workloads", "workloads", "runtime-pressure", "pressure"],
    description: "scheduler and worker-pool pressure demo",
    category: "demo",
    tags: ["runtime", "telemetry", "workers"],
  },
  {
    task: "benchmark",
    aliases: ["benchmark", "bench", "perf"],
    description: "layout and rendering benchmark report",
    category: "tool",
    tags: ["performance", "benchmark"],
  },
  {
    task: "api-inventory",
    aliases: ["api-inventory", "api", "exports"],
    description: "public API export inventory",
    category: "tool",
    tags: ["api", "exports"],
  },
  {
    task: "component-catalog",
    aliases: ["components", "component-catalog", "widgets"],
    description: "component catalog report",
    category: "report",
    tags: ["components", "catalog"],
  },
  {
    task: "app-plugin-catalog",
    aliases: ["plugins", "plugin-catalog", "app-plugin-catalog"],
    description: "app plugin definition catalog report",
    category: "report",
    tags: ["app", "plugins", "catalog"],
  },
  {
    task: "adopter-workbench",
    aliases: ["adopter", "workbench", "adopter-workbench"],
    description: "integrated adopter workbench report",
    category: "report",
    tags: ["app", "runtime", "plugins", "catalog"],
  },
  {
    task: "demo-gallery",
    aliases: ["gallery", "demo-gallery", "tour"],
    description: "capability tour and demo gallery report",
    category: "report",
    tags: ["demos", "catalog", "app"],
  },
  {
    task: "grwizard",
    aliases: ["grwizard", "wizard"],
    description: "responsive GPU/model wizard demo",
    category: "app",
    tags: ["gpu", "wizard", "responsive"],
  },
  {
    task: "health",
    aliases: ["health", "check"],
    description: "contributor health gate",
    category: "check",
    tags: ["ci", "health"],
  },
];

export function resolveVisualizationTask(target = "showcase"): string | undefined {
  return findVisualizationLaunchTarget(target)?.task;
}

export function findVisualizationLaunchTarget(target = "showcase"): VisualizationLaunchTarget | undefined {
  const normalized = normalizeLaunchLookup(target);
  return visualizationLaunchTargets.find((entry) =>
    normalizeLaunchLookup(entry.task) === normalized ||
    entry.aliases.some((alias) => normalizeLaunchLookup(alias) === normalized)
  );
}

export function queryVisualizationLaunchTargets(
  query: VisualizationLaunchQuery = {},
  targets: readonly VisualizationLaunchTarget[] = visualizationLaunchTargets,
): VisualizationLaunchTarget[] {
  return targets
    .filter((target) => matchesLaunchTarget(target, query))
    .sort((left, right) => launchSortKey(left).localeCompare(launchSortKey(right)));
}

export function inspectVisualizationLaunchTargets(
  targets: readonly VisualizationLaunchTarget[] = visualizationLaunchTargets,
): VisualizationLaunchInspection {
  return {
    count: targets.length,
    categories: uniqueSorted(targets.map((target) => target.category).filter(isLaunchCategory)),
    tags: uniqueSorted(targets.flatMap((target) => target.tags ?? [])),
    tasks: uniqueSorted(targets.map((target) => target.task)),
  };
}

export function createVisualizationLaunchReport(
  options: VisualizationLaunchReportOptions = {},
): VisualizationLaunchReport {
  const targets = queryVisualizationLaunchTargets(options.query, options.targets ?? visualizationLaunchTargets);
  return {
    targets,
    inspection: inspectVisualizationLaunchTargets(targets),
  };
}

export function formatVisualizationLaunchMarkdown(options: VisualizationLaunchMarkdownOptions = {}): string {
  const report = createVisualizationLaunchReport(options);
  const lines = [`# ${options.title ?? "Visualization Launcher"}`, ""];
  if (options.includeSummary ?? true) {
    lines.push(
      `${report.inspection.count} targets across ${report.inspection.categories.length} categories.`,
      "",
    );
  }
  lines.push("| Target | Task | Category | Tags | Description |");
  lines.push("| --- | --- | --- | --- | --- |");
  for (const target of report.targets) {
    lines.push(
      `| ${target.aliases[0] ?? target.task} | ${target.task} | ${target.category ?? "-"} | ${
        (target.tags ?? []).join(", ") || "-"
      } | ${target.description} |`,
    );
  }
  return lines.join("\n");
}

export function formatVisualizationUsage(command = "./visualization"): string {
  const aliases = queryVisualizationLaunchTargets()
    .map((entry) => entry.aliases[0] ?? entry.task)
    .join("|");
  const lines = [
    `usage: ${command} [${aliases}] [args...]`,
    "",
  ];
  for (const entry of queryVisualizationLaunchTargets()) {
    lines.push(`  ${(entry.aliases[0] ?? entry.task).padEnd(14, " ")} ${entry.description}`);
  }
  return lines.join("\n");
}

function matchesLaunchTarget(target: VisualizationLaunchTarget, query: VisualizationLaunchQuery): boolean {
  if (query.task && target.task !== query.task) return false;
  if (query.category && target.category !== query.category) return false;
  if (query.tag && !(target.tags ?? []).includes(query.tag)) return false;
  if (!query.search) return true;
  const parts = query.search.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return true;
  const haystack = [
    target.task,
    target.description,
    target.category,
    ...(target.tags ?? []),
    ...target.aliases,
  ].join(" ").toLowerCase();
  return parts.every((part) => haystack.includes(part));
}

function launchSortKey(target: VisualizationLaunchTarget): string {
  return `${target.category ?? "zz"}:${target.aliases[0] ?? target.task}`;
}

function normalizeLaunchLookup(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function uniqueSorted<T extends string>(values: Iterable<T>): T[] {
  return [...new Set(values)].sort();
}

function isLaunchCategory(value: string | undefined): value is VisualizationLaunchCategory {
  return value === "app" || value === "demo" || value === "report" || value === "tool" || value === "check";
}
