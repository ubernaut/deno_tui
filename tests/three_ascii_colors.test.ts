// Copyright 2023 Im-Beast. MIT license.
import { Color } from "npm:three@0.183.2";

import { assertEquals, assertStrictEquals } from "./deps.ts";
import {
  colorToBytes,
  colorValue,
  createLinearByteCache,
  linearUnitToByte,
  rgbToAnsiBackground,
  rgbToAnsiForeground,
} from "../src/three_ascii/colors.ts";

Deno.test("three ascii color helpers preserve Color inputs and resolve fallbacks", () => {
  const color = new Color("#112233");

  assertStrictEquals(colorValue(color, 0), color);
  assertEquals(colorValue(undefined, 0xff0000).getHex(), 0xff0000);
  assertEquals(colorValue("#00ff00", 0).getHex(), 0x00ff00);
});

Deno.test("three ascii color helpers convert linear channels to srgb bytes", () => {
  assertEquals(linearUnitToByte(-1), 0);
  assertEquals(linearUnitToByte(0), 0);
  assertEquals(linearUnitToByte(1), 255);
  assertEquals(colorToBytes(new Color(0.25, 0.5, 1)), [137, 188, 255]);
});

Deno.test("three ascii color helpers format terminal truecolor sequences", () => {
  assertEquals(rgbToAnsiForeground(1, 2, 3), "\x1b[38;2;1;2;3m");
  assertEquals(rgbToAnsiBackground(4, 5, 6), "\x1b[48;2;4;5;6m");
});

Deno.test("three ascii linear byte cache preserves conversion through clear and prune", () => {
  const cache = createLinearByteCache();
  const expected = linearUnitToByte(0.5);

  assertEquals(cache(0.5), expected);
  assertEquals(cache(0.5), expected);
  cache.clear();
  assertEquals(cache(0.5), expected);
  cache.prune();
  assertEquals(cache(0.5), expected);
});
