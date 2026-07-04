import { Color } from "npm:three@0.183.2";
import { assertEquals } from "./deps.ts";
import {
  patchThreeAsciiEffectOptions,
  threeAsciiEffectOptionsAffectComputeUniforms,
} from "../src/three_ascii/effect_options.ts";
import type { AcerolaAsciiNodeOptions } from "../src/three_ascii/AcerolaAsciiNode.ts";

Deno.test("patchThreeAsciiEffectOptions returns changed scalar patches only", () => {
  const target: AcerolaAsciiNodeOptions = { normalThreshold: 0.1, edgeThreshold: 8 };

  const noOp = patchThreeAsciiEffectOptions(target, { normalThreshold: 0.1 });
  assertEquals(noOp.changed, false);
  assertEquals(noOp.patch, {});
  assertEquals(noOp.uniformDirty, false);
  assertEquals(target.normalThreshold, 0.1);

  const changed = patchThreeAsciiEffectOptions(target, { normalThreshold: 0.2, edgeThreshold: 6 });
  assertEquals(changed.changed, true);
  assertEquals(changed.patch, { normalThreshold: 0.2, edgeThreshold: 6 });
  assertEquals(changed.uniformDirty, true);
  assertEquals(target.normalThreshold, 0.2);
  assertEquals(target.edgeThreshold, 6);
});

Deno.test("patchThreeAsciiEffectOptions normalizes colors and suppresses equivalent values", () => {
  const target: AcerolaAsciiNodeOptions = {
    asciiColor: new Color(0xffffff),
    backgroundColor: 0x000000,
  };

  const noOp = patchThreeAsciiEffectOptions(target, {
    asciiColor: "#ffffff",
    backgroundColor: new Color(0x000000),
  });
  assertEquals(noOp.changed, false);
  assertEquals(noOp.uniformDirty, false);

  const changed = patchThreeAsciiEffectOptions(target, { backgroundColor: "#010203" });
  assertEquals(changed.changed, true);
  assertEquals(changed.uniformDirty, true);
  assertEquals((changed.patch.backgroundColor as Color).getHex(), 0x010203);
  assertEquals((target.backgroundColor as Color).getHex(), 0x010203);
});

Deno.test("patchThreeAsciiEffectOptions compares offset-like values by coordinates", () => {
  const target: AcerolaAsciiNodeOptions = { offset: { x: 1, y: 2 } };

  const noOp = patchThreeAsciiEffectOptions(target, { offset: { x: 1, y: 2 } });
  assertEquals(noOp.changed, false);

  const changed = patchThreeAsciiEffectOptions(target, { offset: { x: 2, y: 2 } });
  assertEquals(changed.changed, true);
  assertEquals(changed.patch.offset, { x: 2, y: 2 });
  assertEquals(changed.uniformDirty, false);
});

Deno.test("threeAsciiEffectOptionsAffectComputeUniforms reports only compute uniform fields", () => {
  assertEquals(threeAsciiEffectOptionsAffectComputeUniforms({ edgeThreshold: 4 }), true);
  assertEquals(threeAsciiEffectOptionsAffectComputeUniforms({ exposure: 1.2 }), true);
  assertEquals(threeAsciiEffectOptionsAffectComputeUniforms({ normalThreshold: 0.2 }), false);
  assertEquals(threeAsciiEffectOptionsAffectComputeUniforms({ offset: { x: 1, y: 1 } }), false);
});
