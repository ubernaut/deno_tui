// Copyright 2023 Im-Beast. MIT license.

import {
  characterWidth,
  getMultiCodePointCharacters,
  insertAt,
  stripStyles,
  textWidth,
  UNICODE_CHAR_REGEXP,
} from "../../src/utils/strings.ts";
import { assertEquals } from "../deps.ts";

const unicodeString = "♥☭👀f🌏g⚠5✌💢✅💛🌻";
const fullWidths = ["０", "１", "２", "３", "４", "ｈ", "ｉ", "ｊ", "ｋ", "ｌ", "テ", "ク", "ワ"];
const halfWidths = ["a", "b", "1", "ą", "ł", "､", "ﾝ", "ｼ"];

Deno.test("utils/strings.ts", async (t) => {
  await t.step("UNICODE_CHAR_REGEXP", () => {
    const unicodeCharacters = unicodeString.match(UNICODE_CHAR_REGEXP)!;

    assertEquals(unicodeString.length, 18);
    assertEquals(unicodeCharacters.length, 13);
  });

  await t.step("insertAt()", () => {
    assertEquals(insertAt("est", 0, "T"), "Test");
    assertEquals(insertAt("test", 4, "!"), "test!");
  });

  await t.step("characterWidth()", () => {
    for (const character of fullWidths) {
      assertEquals(characterWidth(character), 2);
    }

    for (const character of halfWidths) {
      assertEquals(characterWidth(character), 1);
    }
  });

  await t.step("stripStyles()", () => {
    assertEquals(stripStyles("\x1b[32mHello\x1b[0m"), "Hello");
  });

  await t.step("textWidth()", () => {
    assertEquals(textWidth(fullWidths.join("")), fullWidths.length * 2);
    assertEquals(textWidth("Hello"), 5);
  });

  await t.step("getMultiCodePointCharacters() preserves 24-bit SGR cells", () => {
    const cells = getMultiCodePointCharacters(
      "\x1b[38;2;0;255;79;48;2;0;0;0m█\x1b[0m\x1b[38;2;156;255;79m▇\x1b[0m",
    );

    assertEquals(cells.length, 2);
    assertEquals(stripStyles(cells.join("")), "█▇");
    assertEquals(cells[0], "\x1b[38;2;0;255;79;48;2;0;0;0m█\x1b[0m");
    assertEquals(cells[1], "\x1b[38;2;156;255;79m▇\x1b[0m");
  });
});
