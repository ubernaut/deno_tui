import { createAppPluginDefinitionRegistry } from "../mod.ts";

const registry = createAppPluginDefinitionRegistry([
  {
    id: "settings",
    label: "Settings Pack",
    description: "Routes and commands for application preferences.",
    tags: ["settings", "routes"],
    routes: [{ id: "settings", title: "Settings" }],
    commands: [{ id: "settings.open", label: "Open Settings" }],
    keyBindings: [{ key: ",", ctrl: true, description: "Open Settings", group: "global" }],
  },
  {
    id: "runtime",
    label: "Runtime Pack",
    description: "Runtime profile, workload, and renderer controls.",
    tags: ["runtime", "performance"],
    commands: [{ id: "runtime.report", label: "Runtime Report" }],
    workloadSources: [{
      id: "runtime-workloads",
      inspect: () => ({
        concurrency: 2,
        running: 0,
        pending: 0,
        idle: true,
        scheduled: 0,
        completed: 0,
        failed: 0,
        cancelled: 0,
        maxRunning: 0,
        maxPending: 0,
      }),
    }],
  },
  {
    id: "data-query",
    label: "Data Query Pack",
    description: "Async query controls for tables, catalogs, and dashboards.",
    tags: ["data", "query"],
    commands: [
      { id: "data-query.reload", label: "Reload Query" },
      { id: "data-query.clear-cache", label: "Clear Query Cache" },
    ],
  },
]);

console.log(registry.markdown({ title: "App Plugin Registry" }));
console.log("");
console.log(`Runtime plugins: ${registry.query({ tag: "runtime" }).map((plugin) => plugin.id).join(", ")}`);
console.log(`Registry ids: ${registry.inspect().ids.join(", ")}`);
