import { assertEquals, assertNotEquals } from "./deps.ts";
import {
  ASCII_DEMO_PRESETS,
  asciiDemoPresetIds,
  asciiDemoPresets,
  asciiDemoPresetSummaries,
  findAsciiDemoPreset,
} from "../src/three_ascii/demo_presets.ts";
import {
  asciiControlValues,
  clampAsciiControlValue,
  createDefaultAsciiOptions,
  normalizeAsciiOptions,
} from "../app/ascii_options.ts";

Deno.test("ascii demo preset helpers expose stable ids and style filters", () => {
  assertEquals(asciiDemoPresetIds().slice(0, 3), ["opentui-blocks", "glyph-atlas", "mixed-best"]);
  assertEquals(asciiDemoPresetIds("blocks"), ["opentui-blocks", "fill-only"]);
  assertEquals(asciiDemoPresetIds("glyphs"), ["glyph-atlas", "soft-fill", "wire"]);
  assertEquals(asciiDemoPresetIds("mixed"), ["mixed-best", "balanced", "contrast"]);
});

Deno.test("findAsciiDemoPreset supports fallback lookup and clone safety", () => {
  const preset = findAsciiDemoPreset("glyph-atlas");
  assertEquals(preset?.label, "Glyph Atlas");

  const fallback = findAsciiDemoPreset("missing", "mixed-best");
  assertEquals(fallback?.id, "mixed-best");

  if (!preset) throw new Error("expected preset");
  preset.effect.exposure = 99;
  assertNotEquals(findAsciiDemoPreset("glyph-atlas")?.effect.exposure, 99);
});

Deno.test("asciiDemoPresetSummaries provide UI-safe preset metadata", () => {
  const summaries = asciiDemoPresetSummaries("mixed");

  assertEquals(summaries.map((summary) => summary.id), ["mixed-best", "balanced", "contrast"]);
  assertEquals(summaries.every((summary) => summary.terminalGlyphStyle === "mixed"), true);
  assertEquals(summaries.every((summary) => typeof summary.edges === "boolean"), true);
  assertEquals(summaries.every((summary) => typeof summary.fill === "boolean"), true);
});

Deno.test("asciiDemoPresets returns clones instead of the shared preset table", () => {
  const [preset] = asciiDemoPresets();
  if (!preset) throw new Error("expected preset");
  preset.effect.edgeThreshold = 123;

  assertNotEquals(ASCII_DEMO_PRESETS[0]?.effect.edgeThreshold, 123);
});

Deno.test("workbench ascii defaults favor terminal-visible wire thickness", () => {
  const options = createDefaultAsciiOptions("sharp");
  assertEquals(options.preset, "opentui-blocks");
  assertEquals(options.terminalGlyphStyle, "blocks");
  assertEquals(options.wireframeThickness, 8);
  assertEquals(options.kittyGraphics, false);
  assertEquals(options.kittyDisableAscii, false);

  const values = asciiControlValues("wireframeThickness");
  assertEquals(values.includes(8), true);
  assertEquals(values.at(-1), 32);
});

Deno.test("ascii option normalization defaults to blocks but preserves saved glyph overrides", () => {
  assertEquals(normalizeAsciiOptions({}).terminalGlyphStyle, "blocks");
  assertEquals(normalizeAsciiOptions({ terminalGlyphStyle: "mixed" }).terminalGlyphStyle, "mixed");
  assertEquals(normalizeAsciiOptions({ terminalGlyphStyle: "glyphs" }).terminalGlyphStyle, "glyphs");
  assertEquals(normalizeAsciiOptions({ terminalGlyphStyle: "unknown" }).terminalGlyphStyle, "blocks");
});

Deno.test("ascii option normalization clamps numeric config to control ranges", () => {
  assertEquals(clampAsciiControlValue("wireframeThickness", 99), 32);
  assertEquals(clampAsciiControlValue("wireframeThickness", -1), 0.5);
  assertEquals(clampAsciiControlValue("exposure", 1.33), 1.33);

  const normalized = normalizeAsciiOptions({
    wireframeThickness: 99,
    exposure: -4,
    terminalEdgeBias: 99,
  });

  assertEquals(normalized.wireframeThickness, 32);
  assertEquals(normalized.exposure, 0.8);
  assertEquals(normalized.terminalEdgeBias, 1.8);
});
