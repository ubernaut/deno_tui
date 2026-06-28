import {
  createRuntimePlan,
  detectRuntimeCapabilities,
  formatRuntimeCapabilities,
  formatRuntimePlan,
  summarizeRuntimeCapabilities,
} from "../mod.ts";

const capabilities = detectRuntimeCapabilities();
const plan = createRuntimePlan(capabilities);

if (Deno.args.includes("--json")) {
  console.log(JSON.stringify({ ...summarizeRuntimeCapabilities(capabilities), plan }, null, 2));
} else {
  console.log(formatRuntimeCapabilities(capabilities));
  console.log("");
  console.log(formatRuntimePlan(plan));
}
