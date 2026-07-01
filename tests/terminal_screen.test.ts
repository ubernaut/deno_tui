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

Deno.test("TerminalScreenController tracks 256-color truecolor and bright SGR styles", () => {
  const screen = new TerminalScreenController({ columns: 8, rows: 2 });

  screen.write("\x1b[38;5;196mA\x1b[48;5;17mB\x1b[38;2;12;34;56mC\x1b[48;2;200;210;220mD");
  screen.write("\x1b[93;104mE\x1b[39;49mF");

  const [row] = screen.cellRows();
  assertEquals(row![0], { char: "A", foreground: 196 });
  assertEquals(row![1], { char: "B", foreground: 196, background: 17 });
  assertEquals(row![2], { char: "C", foreground: 0x0c2238, background: 17 });
  assertEquals(row![3], { char: "D", foreground: 0x0c2238, background: 0xc8d2dc });
  assertEquals(row![4], { char: "E", foreground: 93, background: 104 });
  assertEquals(row![5], { char: "F" });
});

Deno.test("TerminalScreenController applies cursor movement and erase sequences", () => {
  const screen = new TerminalScreenController({ columns: 8, rows: 2 });

  screen.write("abcdef\x1b[1;3HZZ\x1b[K");

  assertEquals(screen.textRows()[0], "abZZ");
  assertEquals(screen.inspect().cursor, { column: 4, row: 0 });
});

Deno.test("TerminalScreenController supports save and restore cursor sequences", () => {
  const screen = new TerminalScreenController({ columns: 8, rows: 3 });

  screen.write("ab\x1b[s\ncd\x1b[uZ");
  assertEquals(screen.textRows()[0], "abZ");
  assertEquals(screen.inspect().cursor, { column: 3, row: 0 });

  screen.write("\x1b[3;7H\x1b7x\x1b[1;1Hy\x1b8Z");
  assertEquals(screen.textRows(), ["ybZ", "cd", "      Z"]);
  assertEquals(screen.inspect().cursor, { column: 7, row: 2 });
});

Deno.test("TerminalScreenController clamps restored cursor after resize", () => {
  const screen = new TerminalScreenController({ columns: 8, rows: 3 });

  screen.write("\x1b[3;3H\x1b[s");
  screen.resize(4, 2);
  screen.write("\x1b[uX");

  assertEquals(screen.textRows(), ["", "  X"]);
  assertEquals(screen.inspect().cursor, { column: 3, row: 1 });
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
