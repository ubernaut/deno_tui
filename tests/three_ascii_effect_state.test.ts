import { Color } from "npm:three@0.183.2";
import { assertEquals } from "./deps.ts";
import {
  defaultThreeAsciiEffectState,
  shouldIncludeThreeAsciiTerminalEdges,
  threeAsciiEffectStateFromSource,
  type ThreeAsciiEffectStateSource,
} from "../src/three_ascii/effect_state.ts";

Deno.test("defaultThreeAsciiEffectState applies Acerola-compatible defaults and fallback colors", () => {
  const state = defaultThreeAsciiEffectState({
    asciiColor: 0x123456,
    backgroundColor: "#010203",
  });

  assertEquals(state.edges, true);
  assertEquals(state.fill, true);
  assertEquals(state.invertLuminance, false);
  assertEquals(state.exposure, 1);
  assertEquals(state.attenuation, 1);
  assertEquals(state.blendWithBase, 0);
  assertEquals(state.depthFalloff, 0);
  assertEquals(state.depthOffset, 0);
  assertEquals(state.edgeThreshold, 8);
  assertEquals(state.asciiColor.getHex(), 0x123456);
  assertEquals(state.backgroundColor.getHex(), 0x010203);
});

Deno.test("defaultThreeAsciiEffectState honors configured fallback effect options", () => {
  const state = defaultThreeAsciiEffectState({
    edges: false,
    fill: false,
    invertLuminance: true,
    exposure: 1.4,
    attenuation: 0.8,
    blendWithBase: 0.5,
    depthFalloff: 0.18,
    depthOffset: 110,
    edgeThreshold: 12,
  });

  assertEquals(state.edges, false);
  assertEquals(state.fill, false);
  assertEquals(state.invertLuminance, true);
  assertEquals(state.exposure, 1.4);
  assertEquals(state.attenuation, 0.8);
  assertEquals(state.blendWithBase, 0.5);
  assertEquals(state.depthFalloff, 0.18);
  assertEquals(state.depthOffset, 110);
  assertEquals(state.edgeThreshold, 12);
});

Deno.test("threeAsciiEffectStateFromSource projects uniform-like Acerola node state", () => {
  const asciiColor = new Color(0xff3300);
  const backgroundColor = new Color(0x001122);
  const source: ThreeAsciiEffectStateSource = {
    edges: { value: 0 },
    fill: { value: 1 },
    invertLuminance: { value: "yes" },
    exposure: { value: "1.5" },
    attenuation: { value: 0.75 },
    blendWithBase: { value: "0.25" },
    depthFalloff: { value: "2" },
    depthOffset: { value: 3 },
    edgeThreshold: { value: "9" },
    asciiColor: { value: asciiColor },
    backgroundColor: { value: backgroundColor },
  };

  const state = threeAsciiEffectStateFromSource(source);

  assertEquals(state.edges, false);
  assertEquals(state.fill, true);
  assertEquals(state.invertLuminance, true);
  assertEquals(state.exposure, 1.5);
  assertEquals(state.attenuation, 0.75);
  assertEquals(state.blendWithBase, 0.25);
  assertEquals(state.depthFalloff, 2);
  assertEquals(state.depthOffset, 3);
  assertEquals(state.edgeThreshold, 9);
  assertEquals(state.asciiColor, asciiColor);
  assertEquals(state.backgroundColor, backgroundColor);
});

Deno.test("shouldIncludeThreeAsciiTerminalEdges disables terminal edge overlay in block mode", () => {
  assertEquals(shouldIncludeThreeAsciiTerminalEdges({ edges: true }, "glyphs"), true);
  assertEquals(shouldIncludeThreeAsciiTerminalEdges({ edges: true }, "mixed"), true);
  assertEquals(shouldIncludeThreeAsciiTerminalEdges({ edges: true }, "blocks"), false);
  assertEquals(shouldIncludeThreeAsciiTerminalEdges({ edges: false }, "glyphs"), false);
});
