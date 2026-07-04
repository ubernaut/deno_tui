import { assertEquals } from "./deps.ts";
import { asciiEffectOptions, createDefaultAsciiOptions } from "../app/ascii_options.ts";
import { threePanelAsciiEffectOptionsEqual } from "../app/three_panel_effect.ts";

Deno.test("threePanelAsciiEffectOptionsEqual rejects missing previous state", () => {
  const next = asciiEffectOptions(createDefaultAsciiOptions("sharp"));
  assertEquals(threePanelAsciiEffectOptionsEqual(undefined, next), false);
});

Deno.test("threePanelAsciiEffectOptionsEqual accepts matching effect state", () => {
  const options = createDefaultAsciiOptions("sharp");
  assertEquals(threePanelAsciiEffectOptionsEqual(asciiEffectOptions(options), asciiEffectOptions(options)), true);
});

Deno.test("threePanelAsciiEffectOptionsEqual detects changed renderer effect fields", () => {
  const base = createDefaultAsciiOptions("sharp");
  const changed = { ...base, edgeThreshold: base.edgeThreshold + 1 };
  assertEquals(threePanelAsciiEffectOptionsEqual(asciiEffectOptions(base), asciiEffectOptions(changed)), false);
});
