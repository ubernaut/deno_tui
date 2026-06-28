import {
  createRuntimePlan,
  createRuntimeProfileCatalogReport,
  createRuntimeRendererBackendCatalogReport,
  createTerminalPlan,
  detectRuntimeCapabilities,
  detectTerminalCapabilities,
  formatRuntimeCapabilities,
  formatRuntimePlan,
  formatRuntimeProfileCatalogMarkdown,
  formatRuntimeRendererBackendCatalogMarkdown,
  formatTerminalCapabilities,
  formatTerminalPlan,
  summarizeRuntimeCapabilities,
  summarizeTerminalCapabilities,
} from "../mod.ts";

const capabilities = detectRuntimeCapabilities();
const plan = createRuntimePlan(capabilities);
const profiles = createRuntimeProfileCatalogReport({ capabilities });
const renderers = createRuntimeRendererBackendCatalogReport({ capabilities });
const terminal = detectTerminalCapabilities();
const terminalPlan = createTerminalPlan(terminal);

if (Deno.args.includes("--json")) {
  console.log(JSON.stringify(
    {
      ...summarizeRuntimeCapabilities(capabilities),
      plan,
      terminal: summarizeTerminalCapabilities(terminal),
      terminalPlan,
      profiles,
      renderers,
    },
    null,
    2,
  ));
} else {
  console.log(formatRuntimeCapabilities(capabilities));
  console.log("");
  console.log(formatRuntimePlan(plan));
  console.log("");
  console.log(formatTerminalCapabilities(terminal));
  console.log("");
  console.log(formatTerminalPlan(terminalPlan));
  console.log("");
  console.log(formatRuntimeProfileCatalogMarkdown({ capabilities, includeSummary: false }));
  console.log("");
  console.log(formatRuntimeRendererBackendCatalogMarkdown({ capabilities, includeSummary: false }));
}
