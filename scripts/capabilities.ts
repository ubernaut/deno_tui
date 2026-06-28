import {
  createRuntimePlan,
  createRuntimeProfileCatalogReport,
  createRuntimeRendererBackendCatalogReport,
  detectRuntimeCapabilities,
  formatRuntimeCapabilities,
  formatRuntimePlan,
  formatRuntimeProfileCatalogMarkdown,
  formatRuntimeRendererBackendCatalogMarkdown,
  summarizeRuntimeCapabilities,
} from "../mod.ts";

const capabilities = detectRuntimeCapabilities();
const plan = createRuntimePlan(capabilities);
const profiles = createRuntimeProfileCatalogReport({ capabilities });
const renderers = createRuntimeRendererBackendCatalogReport({ capabilities });

if (Deno.args.includes("--json")) {
  console.log(JSON.stringify({ ...summarizeRuntimeCapabilities(capabilities), plan, profiles, renderers }, null, 2));
} else {
  console.log(formatRuntimeCapabilities(capabilities));
  console.log("");
  console.log(formatRuntimePlan(plan));
  console.log("");
  console.log(formatRuntimeProfileCatalogMarkdown({ capabilities, includeSummary: false }));
  console.log("");
  console.log(formatRuntimeRendererBackendCatalogMarkdown({ capabilities, includeSummary: false }));
}
