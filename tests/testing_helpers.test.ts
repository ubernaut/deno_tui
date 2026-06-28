import { assertEquals } from "./deps.ts";
import {
  createTestFocusable,
  createTestKeyPress,
  createTestMouseScroll,
  frameBufferToSnapshot,
  normalizeTerminalSnapshot,
  stripAnsi,
  TestKeyPressTarget,
} from "../src/testing/mod.ts";

Deno.test("stripAnsi removes terminal control sequences", () => {
  assertEquals(stripAnsi("\x1b[31mred\x1b[0m"), "red");
});

Deno.test("normalizeTerminalSnapshot trims trailing cells but keeps rows", () => {
  assertEquals(normalizeTerminalSnapshot("a   \n b  "), "a\n b");
});

Deno.test("frameBufferToSnapshot decodes mixed string and byte cells", () => {
  assertEquals(frameBufferToSnapshot([["a", new TextEncoder().encode("b"), undefined]]), "ab");
});

Deno.test("testing input helpers create deterministic events and focusables", () => {
  assertEquals(createTestKeyPress("tab", { shift: true }), {
    key: "tab",
    shift: true,
    ctrl: false,
    meta: false,
    buffer: new Uint8Array(),
  });
  assertEquals(createTestMouseScroll(1).scroll, 1);
  assertEquals(createTestFocusable("focused").state.peek(), "focused");
});

Deno.test("TestKeyPressTarget emits and unsubscribes key listeners", () => {
  const target = new TestKeyPressTarget();
  const seen: string[] = [];
  const unsubscribe = target.on("keyPress", (event) => {
    seen.push(event.key);
  });

  target.key("tab");
  unsubscribe();
  target.key("return");

  assertEquals(seen, ["tab"]);
  assertEquals(target.listenerCount(), 0);
});
