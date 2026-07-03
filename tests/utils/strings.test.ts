// Copyright 2023 Im-Beast. MIT license.

import {
  characterWidth,
  cropToWidth,
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

    assertEquals(characterWidth("👀"), 2);
    assertEquals(characterWidth("👨‍👩‍👧‍👦"), 2);
    assertEquals(characterWidth("🇺🇸"), 2);
    assertEquals(characterWidth("⚠️"), 2);
    assertEquals(characterWidth("\x1b[35m🇺🇸\x1b[0m"), 2);
    assertEquals(characterWidth("a\u0301"), 1);
    assertEquals(characterWidth("\u0301"), 0);
  });

  await t.step("stripStyles()", () => {
    assertEquals(stripStyles("\x1b[32mHello\x1b[0m"), "Hello");
    assertEquals(stripStyles("\x1b[2J\x1b[32mHello\x1b[0m"), "Hello");
  });

  await t.step("textWidth()", () => {
    assertEquals(textWidth(fullWidths.join("")), fullWidths.length * 2);
    assertEquals(textWidth("Hello"), 5);
    assertEquals(textWidth("a\u0301👀👨‍👩‍👧‍👦"), 5);
    assertEquals(textWidth("xx\x1b[38;2;0;255;79mHello\x1b[0m", 2), 5);
  });

  await t.step("cropToWidth() preserves graphemes and ANSI cells", () => {
    assertEquals(cropToWidth("a\u0301👀b", 3), "a\u0301👀");
    assertEquals(cropToWidth("a\u0301👀b", 2), "a\u0301 ");
    assertEquals(cropToWidth("\x1b[32m👀\x1b[0mB", 2), "\x1b[32m👀\x1b[0m");
    assertEquals(cropToWidth("\x1b]0;title\x07\x1b[32mHi\x1b[0m!", 2), "\x1b]0;title\x07\x1b[32mHi\x1b[0m");
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

  await t.step("getMultiCodePointCharacters() splits styled ASCII rows", () => {
    const cells = getMultiCodePointCharacters("\x1b[38;2;1;2;3;48;2;4;5;6mABC   \x1b[0m\x1b[0m");

    assertEquals(cells.length, 6);
    assertEquals(stripStyles(cells.join("")), "ABC   ");
    assertEquals(cells[0], "\x1b[38;2;1;2;3;48;2;4;5;6mA\x1b[0m");
    assertEquals(cells[5], "\x1b[38;2;1;2;3;48;2;4;5;6m \x1b[0m");
  });
});
