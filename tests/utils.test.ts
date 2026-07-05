// Copyright 2023 Im-Beast. MIT license.

import { sleep } from "../src/utils/async.ts";
import { clamp, fits, fitsInRectangle, normalize } from "../src/utils/numbers.ts";
import { SortedArray } from "../src/utils/sorted_array.ts";
import {
  characterWidth,
  cropToWidth,
  getMultiCodePointCharacters,
  insertAt,
  stripStyles,
  textWidth,
  UNICODE_CHAR_REGEXP,
} from "../src/utils/strings.ts";
import { assert, assertEquals } from "./deps.ts";

const unicodeString = "♥☭👀f🌏g⚠5✌💢✅💛🌻";
const fullWidths = ["０", "１", "２", "３", "４", "ｈ", "ｉ", "ｊ", "ｋ", "ｌ", "テ", "ク", "ワ"];
const halfWidths = ["a", "b", "1", "ą", "ł", "､", "ﾝ", "ｼ"];

Deno.test("utils async helpers sleep for at least the requested interval", async () => {
  const intervals = [0, 1, 33, 50, 100, 150];

  for (const interval of intervals) {
    const start = performance.now();
    await sleep(interval);
    const elapsed = performance.now() - start;
    assert(elapsed >= Math.max(0, interval - 2), `sleep(${interval}) resolved too early after ${elapsed}ms`);
    assert(elapsed <= interval + 100, `sleep(${interval}) resolved too late after ${elapsed}ms`);
  }
});

Deno.test("utils number helpers clamp normalize and test bounds", () => {
  assertEquals(clamp(-5, 0, 10), 0);
  assertEquals(clamp(0, 0, 10), 0);
  assertEquals(clamp(-1, 0, 10), 0);
  assertEquals(clamp(5, 0, 10), 5);
  assertEquals(clamp(10, 0, 10), 10);
  assertEquals(clamp(10, 0, 11), 10);

  assertEquals(fits(-1, 0, 1), false);
  assertEquals(fits(0.1, 0, 1), true);
  assertEquals(fits(0.9, 0, 1), true);
  assertEquals(fits(0, 0, 1), true);
  assertEquals(fits(1, 0, 1), true);

  const rectangle = {
    column: 5,
    row: 5,
    width: 10,
    height: 10,
  };

  assertEquals(fitsInRectangle(0, 0, rectangle), false);
  assertEquals(fitsInRectangle(5, 0, rectangle), false);
  assertEquals(fitsInRectangle(0, 5, rectangle), false);
  assertEquals(fitsInRectangle(13, 0, rectangle), false);
  assertEquals(fitsInRectangle(13, 6, rectangle), true);
  assertEquals(fitsInRectangle(5, 5, rectangle), true);
  assertEquals(fitsInRectangle(14, 14, rectangle), true);
  assertEquals(fitsInRectangle(15, 15, rectangle), false);

  assertEquals(normalize(50, 0, 100), 0.5);
  assertEquals(normalize(0, -100, 100), 0.5);
});

Deno.test("utils SortedArray keeps ordered values and supports removal", () => {
  const array = new SortedArray<number>((a, b) => b - a);

  array.push(1, 10, -5, -2, 11, 100, -1000);
  assertEquals([...array], [100, 11, 10, 1, -2, -5, -1000]);
  array.remove(11);
  assertEquals([...array], [100, 10, 1, -2, -5, -1000]);
  array.remove(404);
  assertEquals([...array], [100, 10, 1, -2, -5, -1000]);
});

Deno.test("utils string helpers measure unicode and ANSI-styled cells", async (t) => {
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
    assertEquals(textWidth("\x1b[38;2;1;2;3mprocess\x1b[0m \x1b[48;2;3;2;1m ███ \x1b[0m"), 13);
  });

  await t.step("cropToWidth() preserves graphemes and ANSI cells", () => {
    assertEquals(cropToWidth("a\u0301👀b", 3), "a\u0301👀");
    assertEquals(cropToWidth("a\u0301👀b", 2), "a\u0301 ");
    assertEquals(cropToWidth("\x1b[32m👀\x1b[0mB", 2), "\x1b[32m👀\x1b[0m");
    assertEquals(cropToWidth("\x1b]0;title\x07\x1b[32mHi\x1b[0m!", 2), "\x1b]0;title\x07\x1b[32mHi\x1b[0m");
    assertEquals(
      cropToWidth("\x1b[38;2;1;2;3mprocess\x1b[0m \x1b[48;2;3;2;1m ███ \x1b[0m tail", 12),
      "\x1b[38;2;1;2;3mprocess\x1b[0m \x1b[48;2;3;2;1m ███",
    );
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

  await t.step("getMultiCodePointCharacters() splits plain ASCII rows", () => {
    const cells = getMultiCodePointCharacters("ASCII text 123");

    assertEquals(cells, ["A", "S", "C", "I", "I", " ", "t", "e", "x", "t", " ", "1", "2", "3"]);
  });

  await t.step("getMultiCodePointCharacters() splits styled ASCII rows", () => {
    const cells = getMultiCodePointCharacters("\x1b[38;2;1;2;3;48;2;4;5;6mABC   \x1b[0m\x1b[0m");

    assertEquals(cells.length, 6);
    assertEquals(stripStyles(cells.join("")), "ABC   ");
    assertEquals(cells[0], "\x1b[38;2;1;2;3;48;2;4;5;6mA\x1b[0m");
    assertEquals(cells[5], "\x1b[38;2;1;2;3;48;2;4;5;6m \x1b[0m");
  });

  await t.step("getMultiCodePointCharacters() keeps repeated SGR background cells compact", () => {
    const cells = getMultiCodePointCharacters(
      "\x1b[38;2;9;8;7mX\x1b[48;2;1;2;3m \x1b[48;2;4;5;6m \x1b[48;2;7;8;9m ",
    );

    assertEquals(cells.length, 4);
    assertEquals(stripStyles(cells.join("")), "X   ");
    assertEquals(cells[1], "\x1b[38;2;9;8;7;48;2;1;2;3m \x1b[0m");
    assertEquals(cells[2], "\x1b[38;2;9;8;7;48;2;4;5;6m \x1b[0m");
    assertEquals(cells[3], "\x1b[38;2;9;8;7;48;2;7;8;9m \x1b[0m");
  });
});
