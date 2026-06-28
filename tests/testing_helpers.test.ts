import { assertEquals } from "./deps.ts";
import { frameBufferToSnapshot, normalizeTerminalSnapshot, stripAnsi } from "../src/testing/mod.ts";

Deno.test("stripAnsi removes terminal control sequences", () => {
  assertEquals(stripAnsi("\x1b[31mred\x1b[0m"), "red");
});

Deno.test("normalizeTerminalSnapshot trims trailing cells but keeps rows", () => {
  assertEquals(normalizeTerminalSnapshot("a   \n b  "), "a\n b");
});

Deno.test("frameBufferToSnapshot decodes mixed string and byte cells", () => {
  assertEquals(frameBufferToSnapshot([["a", new TextEncoder().encode("b"), undefined]]), "ab");
});
