import { detectRuntimeCapabilities, formatRuntimeCapabilities, summarizeRuntimeCapabilities } from "../mod.ts";

const capabilities = detectRuntimeCapabilities();

if (Deno.args.includes("--json")) {
  console.log(JSON.stringify(summarizeRuntimeCapabilities(capabilities), null, 2));
} else {
  console.log(formatRuntimeCapabilities(capabilities));
}
