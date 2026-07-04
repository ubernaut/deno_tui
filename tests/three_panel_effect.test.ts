import { assertEquals } from "./deps.ts";
import { asciiEffectOptions, createDefaultAsciiOptions } from "../app/ascii_options.ts";
import {
  emptyThreePanelRendererState,
  resolveThreePanelRendererStateUpdate,
  threePanelAsciiEffectOptionsEqual,
  threePanelRendererStateMatches,
} from "../src/app/three_panel_effect.ts";

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

Deno.test("threePanelRendererStateMatches ignores scene signal churn and detects renderer changes", () => {
  const base = createDefaultAsciiOptions("sharp");
  const effectOptions = asciiEffectOptions(base);
  const current = {
    columns: 40,
    rows: 12,
    effectOptions,
    terminalEdgeBias: base.terminalEdgeBias,
    terminalGlyphStyle: base.terminalGlyphStyle,
  };

  assertEquals(threePanelRendererStateMatches(current, { ...current, effectOptions }), true);
  assertEquals(threePanelRendererStateMatches(current, { ...current, columns: 41, effectOptions }), false);
  assertEquals(
    threePanelRendererStateMatches(current, {
      ...current,
      effectOptions: asciiEffectOptions({ ...base, edgeThreshold: base.edgeThreshold + 1 }),
    }),
    false,
  );
  assertEquals(
    threePanelRendererStateMatches(current, {
      ...current,
      terminalGlyphStyle: "glyphs",
      effectOptions,
    }),
    false,
  );
});

Deno.test("resolveThreePanelRendererStateUpdate reports setter-specific changes", () => {
  const base = createDefaultAsciiOptions("sharp");
  const effectOptions = asciiEffectOptions(base);
  const current = {
    columns: 40,
    rows: 12,
    effectOptions,
    terminalEdgeBias: base.terminalEdgeBias,
    terminalGlyphStyle: base.terminalGlyphStyle,
  };

  assertEquals(resolveThreePanelRendererStateUpdate(current, { ...current, effectOptions }).changed, false);

  assertEquals(resolveThreePanelRendererStateUpdate(current, { ...current, columns: 41, effectOptions }), {
    next: { ...current, columns: 41, effectOptions },
    resize: true,
    effect: false,
    terminalEdgeBias: false,
    terminalGlyphStyle: false,
    changed: true,
  });

  assertEquals(
    resolveThreePanelRendererStateUpdate(current, {
      ...current,
      effectOptions: asciiEffectOptions({ ...base, exposure: base.exposure + 0.1 }),
    }).effect,
    true,
  );
  assertEquals(
    resolveThreePanelRendererStateUpdate(current, { ...current, terminalEdgeBias: base.terminalEdgeBias + 0.1 })
      .terminalEdgeBias,
    true,
  );
  assertEquals(
    resolveThreePanelRendererStateUpdate(current, { ...current, terminalGlyphStyle: "glyphs" }).terminalGlyphStyle,
    true,
  );
});

Deno.test("emptyThreePanelRendererState forces initial renderer configuration", () => {
  const base = createDefaultAsciiOptions("sharp");
  const next = {
    columns: 80,
    rows: 24,
    effectOptions: asciiEffectOptions(base),
    terminalEdgeBias: base.terminalEdgeBias,
    terminalGlyphStyle: base.terminalGlyphStyle,
  };

  assertEquals(resolveThreePanelRendererStateUpdate(emptyThreePanelRendererState(), next), {
    next,
    resize: true,
    effect: true,
    terminalEdgeBias: true,
    terminalGlyphStyle: true,
    changed: true,
  });
});
