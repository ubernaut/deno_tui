import {
  createRuntimePlan,
  createRuntimeProfileCatalogReport,
  detectRuntimeCapabilities,
  formatRuntimeCapabilities,
  formatRuntimePlan,
  formatRuntimeProfileCatalogMarkdown,
  summarizeRuntimeCapabilities,
} from "../mod.ts";

const capabilities = detectRuntimeCapabilities();
const plan = createRuntimePlan(capabilities);
const profiles = createRuntimeProfileCatalogReport({ capabilities });

if (Deno.args.includes("--json")) {
  console.log(JSON.stringify({ ...summarizeRuntimeCapabilities(capabilities), plan, profiles }, null, 2));
} else {
  console.log(formatRuntimeCapabilities(capabilities));
  console.log("");
  console.log(formatRuntimePlan(plan));
  console.log("");
  console.log(formatRuntimeProfileCatalogMarkdown({ capabilities, includeSummary: false }));
}
