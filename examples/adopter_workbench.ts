import {
  createAppPluginDefinitionRegistry,
  createComponentCatalogReport,
  createTerminalPlan,
  createThemeGallery,
  createThemeProvider,
  detectTerminalCapabilities,
  formatTerminalPlan,
  queryLocalData,
  terminalSessionSequences,
} from "../mod.ts";

const terminalPlan = createTerminalPlan(detectTerminalCapabilities());
const terminalSession = terminalSessionSequences({ plan: terminalPlan });
const components = createComponentCatalogReport({
  query: { capabilities: ["controller", "keyboard"] },
});
const plugins = createAppPluginDefinitionRegistry([
  {
    id: "routes",
    label: "Route Pack",
    tags: ["routes", "navigation"],
    routes: [{ id: "home", title: "Home" }, { id: "settings", title: "Settings" }],
    commands: [{ id: "route.home", label: "Go Home" }],
  },
  {
    id: "runtime",
    label: "Runtime Pack",
    tags: ["runtime", "terminal"],
    commands: [{ id: "runtime.capabilities", label: "Show Capabilities" }],
  },
  {
    id: "data",
    label: "Data Pack",
    tags: ["data", "query"],
    commands: [{ id: "data.reload", label: "Reload Data" }],
  },
]);
const themeGallery = createThemeGallery(createThemeProvider(), {
  query: "terminal",
  tokens: ["foreground", "accent", "success"],
  components: ["panel", "button"],
  states: ["base", "focused"],
});
const dataset = queryLocalData([
  { id: "terminal", area: "runtime", status: "ready", priority: 90 },
  { id: "plugins", area: "app", status: "ready", priority: 80 },
  { id: "themes", area: "design", status: "ready", priority: 75 },
  { id: "queries", area: "data", status: "ready", priority: 70 },
], {
  query: "ready",
  sort: { field: "priority", direction: "desc" },
  pageSize: 3,
}, {
  searchable: ["id", "area", "status"],
});

console.log("# Adopter Workbench");
console.log("");
console.log(formatTerminalPlan(terminalPlan));
console.log("");
console.log(`Terminal session enter bytes: ${terminalSession.enter.length}`);
console.log(`Terminal session exit bytes: ${terminalSession.exit.length}`);
console.log("");
console.log(
  `Keyboard/controller components: ${components.inspection.count} across ${components.categories.join(", ")}`,
);
console.log(`Plugin packs: ${plugins.inspect().count} (${plugins.inspect().ids.join(", ")})`);
console.log(`Theme matches: ${themeGallery.matches.map((match) => match.item.label).join(", ")}`);
console.log(`Dataset page: ${dataset.rows.map((row) => row.id).join(", ")} (${dataset.totalRows} total)`);
