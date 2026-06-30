import { assertEquals } from "./deps.ts";
import { TerminalScreenController } from "../src/runtime/terminal_screen.ts";

Deno.test("TerminalScreenController writes text and keeps scrollback", () => {
  const screen = new TerminalScreenController({ columns: 8, rows: 2, scrollbackLimit: 2 });

  screen.write("hello\nworld\nagain");

  assertEquals(screen.scrollbackTextRows(), ["hello"]);
  assertEquals(screen.textRows(), ["world", "again"]);
  assertEquals(screen.inspect().cursor, { column: 5, row: 1 });
});

Deno.test("TerminalScreenController tracks SGR styles per cell", () => {
  const screen = new TerminalScreenController({ columns: 8, rows: 2 });

  screen.write("\x1b[1;31mR\x1b[0mN");

  const [row] = screen.cellRows();
  assertEquals(row![0], { char: "R", bold: true, foreground: 31 });
  assertEquals(row![1], { char: "N" });
});

Deno.test("TerminalScreenController applies cursor movement and erase sequences", () => {
  const screen = new TerminalScreenController({ columns: 8, rows: 2 });

  screen.write("abcdef\x1b[1;3HZZ\x1b[K");

  assertEquals(screen.textRows()[0], "abZZ");
  assertEquals(screen.inspect().cursor, { column: 4, row: 0 });
});

Deno.test("TerminalScreenController resizes and clamps cursor", () => {
  const screen = new TerminalScreenController({ columns: 8, rows: 3 });

  screen.write("abcdef\n123456\nxyz");
  screen.resize(4, 2);

  assertEquals(screen.textRows(), ["abcd", "1234"]);
  assertEquals(screen.inspect().columns, 4);
  assertEquals(screen.inspect().rows, 2);
  assertEquals(screen.inspect().cursor, { column: 3, row: 1 });
});

Deno.test("TerminalScreenController supports alternate screen switching", () => {
  const screen = new TerminalScreenController({ columns: 8, rows: 2 });

  screen.write("main");
  screen.write("\x1b[?1049h");
  screen.write("alt");
  assertEquals(screen.inspect().alternate, true);
  assertEquals(screen.textRows()[0], "alt");

  screen.write("\x1b[?1049l");
  assertEquals(screen.inspect().alternate, false);
  assertEquals(screen.textRows()[0], "main");
});
