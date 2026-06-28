import { assertEquals } from "./deps.ts";
import {
  assertTerminalSnapshot,
  canvasRowText,
  canvasSnapshot,
  compareTerminalSnapshot,
  createTestCanvas,
  createTestFocusable,
  createTestKeyPress,
  createTestMousePress,
  createTestMouseScroll,
  createTestStdout,
  formatTerminalSnapshotDiff,
  frameBufferToSnapshot,
  normalizeTerminalSnapshot,
  stripAnsi,
  TestKeyPressTarget,
  TestMouseTarget,
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

Deno.test("test stdout captures writes for render assertions", () => {
  const stdout = createTestStdout();
  const data = new TextEncoder().encode("abc");

  assertEquals(stdout.writeSync(data), 3);
  assertEquals(stdout.chunks.length, 1);
  assertEquals(stdout.text, "abc");

  stdout.clear();
  assertEquals(stdout.chunks.length, 0);
  assertEquals(stdout.text, "");
});

Deno.test("test canvas helpers expose row and full snapshots", () => {
  const canvas = createTestCanvas({ size: { columns: 4, rows: 2 } });
  canvas.frameBuffer[0] = ["a", "b"];
  canvas.frameBuffer[1] = ["c"];
  canvas.frameBuffer[1][2] = "d";

  assertEquals(canvasRowText(canvas, 0), "ab  ");
  assertEquals(canvasRowText(canvas, 1, 3), "c d");
  assertEquals(canvasSnapshot(canvas), "ab\nc d");
});

Deno.test("compareTerminalSnapshot normalizes and locates differences", () => {
  const comparison = compareTerminalSnapshot("\x1b[32mabc\x1b[0m\nxyz", "abc\nxYz");

  assertEquals(comparison.pass, false);
  assertEquals(comparison.actual, "abc\nxyz");
  assertEquals(comparison.expected, "abc\nxYz");
  assertEquals(comparison.mismatches, [
    { line: 2, column: 2, expected: "xYz", actual: "xyz" },
  ]);
});

Deno.test("formatTerminalSnapshotDiff reports bounded line diagnostics", () => {
  const comparison = compareTerminalSnapshot("a\nb\nc", "x\ny\nz", { maxMismatches: 2 });

  assertEquals(comparison.mismatches.length, 2);
  assertEquals(
    formatTerminalSnapshotDiff(comparison),
    [
      "Terminal snapshot mismatch:",
      "line 1, column 1",
      '  expected: "x"',
      '  actual:   "a"',
      "line 2, column 1",
      '  expected: "y"',
      '  actual:   "b"',
    ].join("\n"),
  );
});

Deno.test("assertTerminalSnapshot throws helpful mismatch errors", () => {
  assertTerminalSnapshot("ready  \n", "ready");

  try {
    assertTerminalSnapshot("ready", "done");
    throw new Error("expected snapshot mismatch");
  } catch (error) {
    assertEquals(error instanceof Error, true);
    assertEquals((error as Error).message.includes("line 1, column 1"), true);
  }
});

Deno.test("testing input helpers create deterministic events and focusables", () => {
  assertEquals(createTestKeyPress("tab", { shift: true }), {
    key: "tab",
    shift: true,
    ctrl: false,
    meta: false,
    buffer: new Uint8Array(),
  });
  assertEquals(createTestMousePress({ x: 2, y: 3, button: 1 }).button, 1);
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

Deno.test("TestMouseTarget emits and unsubscribes mouse listeners", () => {
  const target = new TestMouseTarget();
  const seen: string[] = [];
  const stopPress = target.on("mousePress", (event) => {
    seen.push(`press:${event.x}`);
  });
  const stopScroll = target.on("mouseScroll", (event) => {
    seen.push(`scroll:${event.scroll}`);
  });

  target.press({ x: 4 });
  target.scroll(-1);
  stopPress();
  stopScroll();
  target.press({ x: 9 });
  target.scroll(1);

  assertEquals(seen, ["press:4", "scroll:-1"]);
  assertEquals(target.listenerCount(), 0);
});
