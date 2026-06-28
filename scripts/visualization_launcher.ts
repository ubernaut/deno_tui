export interface VisualizationLaunchTarget {
  task: string;
  aliases: readonly string[];
  description: string;
}

export const visualizationLaunchTargets: readonly VisualizationLaunchTarget[] = [
  {
    task: "showcase",
    aliases: ["showcase", "demo"],
    description: "full widget showcase",
  },
  {
    task: "three-ascii",
    aliases: ["polygons", "polygon", "geometry", "three", "three-ascii", "ascii"],
    description: "standalone three.js ASCII geometry demo",
  },
  {
    task: "dashboard",
    aliases: ["dashboard", "dash"],
    description: "dashboard widgets and theme engine demo",
  },
  {
    task: "app-shell",
    aliases: ["app-shell", "shell", "app"],
    description: "app primitives, command palette, routes, and toasts demo",
  },
  {
    task: "layout-recipe",
    aliases: ["layout-recipe", "layout-report", "recipe"],
    description: "responsive layout recipe report",
  },
  {
    task: "viz",
    aliases: ["monitor", "system-monitor", "system", "viz"],
    description: "system monitor visualization dashboard",
  },
  {
    task: "worker-demo",
    aliases: ["worker", "workers", "worker-demo"],
    description: "abortable WorkerPool concurrency demo",
  },
  {
    task: "action-middleware",
    aliases: ["actions", "action-middleware", "middleware"],
    description: "action middleware and plugin pipeline demo",
  },
  {
    task: "cached-resource",
    aliases: ["resource", "cached-resource", "resources"],
    description: "cached async resource loader demo",
  },
  {
    task: "cached-pipeline",
    aliases: ["pipeline", "cached-pipeline", "cache"],
    description: "cached scheduler-backed data pipeline demo",
  },
  {
    task: "theme-manifest",
    aliases: ["theme-manifest", "theme-pack", "manifest"],
    description: "serializable theme manifest report",
  },
  {
    task: "theme-engines",
    aliases: ["theme-engines", "theme-factories", "themes"],
    description: "theme engine factory registry demo",
  },
  {
    task: "theme-pipeline",
    aliases: ["theme-pipeline", "theme-runtime", "theme-transforms"],
    description: "runtime theme transform pipeline demo",
  },
  {
    task: "theme-gallery",
    aliases: ["theme-gallery", "theme-picker", "theme-catalog"],
    description: "searchable theme gallery and preview report",
  },
  {
    task: "capabilities",
    aliases: ["capabilities", "caps", "runtime"],
    description: "runtime capability report",
  },
  {
    task: "benchmark",
    aliases: ["benchmark", "bench", "perf"],
    description: "layout and rendering benchmark report",
  },
  {
    task: "api-inventory",
    aliases: ["api-inventory", "api", "exports"],
    description: "public API export inventory",
  },
  {
    task: "component-catalog",
    aliases: ["components", "component-catalog", "widgets"],
    description: "component catalog report",
  },
  {
    task: "grwizard",
    aliases: ["grwizard", "wizard"],
    description: "responsive GPU/model wizard demo",
  },
  {
    task: "health",
    aliases: ["health", "check"],
    description: "contributor health gate",
  },
];

export function resolveVisualizationTask(target = "showcase"): string | undefined {
  const normalized = target.toLowerCase();
  return visualizationLaunchTargets.find((entry) => entry.aliases.includes(normalized))?.task;
}

export function formatVisualizationUsage(command = "./visualization"): string {
  const aliases = visualizationLaunchTargets
    .map((entry) => entry.aliases[0])
    .join("|");
  const lines = [
    `usage: ${command} [${aliases}] [args...]`,
    "",
  ];
  for (const entry of visualizationLaunchTargets) {
    lines.push(`  ${entry.aliases[0].padEnd(12, " ")} ${entry.description}`);
  }
  return lines.join("\n");
}
