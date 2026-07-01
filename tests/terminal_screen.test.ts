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

Deno.test("TerminalScreenController tracks OSC title sequences", () => {
  const screen = new TerminalScreenController({ columns: 12, rows: 2 });

  screen.write("prompt\x1b]0;build shell\x07>");
  assertEquals(screen.textRows()[0], "prompt>");
  assertEquals(screen.inspect().title, "build shell");

  screen.write("\x1b]2;editor\x1b\\");
  assertEquals(screen.textRows()[0], "prompt>");
  assertEquals(screen.inspect().title, "editor");
});

Deno.test("TerminalScreenController tracks DEC private modes", () => {
  const screen = new TerminalScreenController({ columns: 8, rows: 2 });

  assertEquals(screen.inspect().cursorVisible, true);
  assertEquals(screen.inspect().cursorStyle, { shape: "block", blinking: true });
  assertEquals(screen.inspect().privateModes, []);

  screen.write("\x1b[?25l\x1b[?1000;1006h");
  assertEquals(screen.inspect().cursorVisible, false);
  assertEquals(screen.inspect().privateModes, [1000, 1006]);

  screen.write("\x1b[?25h\x1b[?1000l");
  assertEquals(screen.inspect().cursorVisible, true);
  assertEquals(screen.inspect().privateModes, [1006]);
});

Deno.test("TerminalScreenController tracks cursor style sequences", () => {
  const screen = new TerminalScreenController({ columns: 8, rows: 2 });

  screen.write("\x1b[6 q");
  assertEquals(screen.inspect().cursorStyle, { shape: "bar", blinking: false });

  screen.write("\x1b[3 q");
  assertEquals(screen.inspect().cursorStyle, { shape: "underline", blinking: true });

  screen.write("\x1b[2 q");
  assertEquals(screen.inspect().cursorStyle, { shape: "block", blinking: false });

  screen.write("\x1b[0 q");
  assertEquals(screen.inspect().cursorStyle, { shape: "block", blinking: true });
});

Deno.test("TerminalScreenController tracks OSC 8 hyperlinks per cell", () => {
  const screen = new TerminalScreenController({ columns: 12, rows: 2 });

  screen.write("a\x1b]8;id=docs;https://example.test/docs\x1b\\bc\x1b]8;;\x1b\\d");

  const [row] = screen.cellRows();
  assertEquals(row![0], { char: "a" });
  assertEquals(row![1], { char: "b", hyperlink: "https://example.test/docs" });
  assertEquals(row![2], { char: "c", hyperlink: "https://example.test/docs" });
  assertEquals(row![3], { char: "d" });
});

Deno.test("TerminalScreenController inserts and deletes characters", () => {
  const screen = new TerminalScreenController({ columns: 8, rows: 2 });

  screen.write("abcdef\x1b[1;3H\x1b[2@XY\x1b[1;5H\x1b[2P");

  assertEquals(screen.textRows()[0], "abXYef");
  assertEquals(screen.inspect().cursor, { column: 4, row: 0 });
});

Deno.test("TerminalScreenController inserts and deletes lines", () => {
  const screen = new TerminalScreenController({ columns: 8, rows: 4 });

  screen.write("row1\nrow2\nrow3\nrow4");
  screen.write("\x1b[2;1H\x1b[1Lnew");
  assertEquals(screen.textRows(), ["row1", "new", "row2", "row3"]);

  screen.write("\x1b[3;1H\x1b[1M");
  assertEquals(screen.textRows(), ["row1", "new", "row3", ""]);
});

Deno.test("TerminalScreenController scrolls inside configured scroll regions", () => {
  const screen = new TerminalScreenController({ columns: 8, rows: 4 });

  screen.write("aaaa\x1b[2;1Hbbbb\x1b[3;1Hcccc\x1b[4;1Hdddd");
  screen.write("\x1b[2;3r\x1b[3;1Hxx\nYY");

  assertEquals(screen.textRows(), ["aaaa", "xxcc", "YY", "dddd"]);
  assertEquals(screen.scrollbackTextRows(), []);
  assertEquals(screen.inspect().cursor, { column: 2, row: 2 });
});

Deno.test("TerminalScreenController resets scroll regions", () => {
  const screen = new TerminalScreenController({ columns: 8, rows: 3, scrollbackLimit: 4 });

  screen.write("one\x1b[2;1Htwo\x1b[3;1Hthree");
  screen.write("\x1b[2;3r\x1b[r\x1b[3;1Hbottom\nnext");

  assertEquals(screen.scrollbackTextRows(), ["one"]);
  assertEquals(screen.textRows(), ["two", "bottom", "next"]);
});

Deno.test("TerminalScreenController applies line edits inside scroll regions", () => {
  const screen = new TerminalScreenController({ columns: 8, rows: 4 });

  screen.write("row1\x1b[2;1Hrow2\x1b[3;1Hrow3\x1b[4;1Hrow4");
  screen.write("\x1b[2;4r\x1b[3;1H\x1b[1Lnew");
  assertEquals(screen.textRows(), ["row1", "row2", "new", "row3"]);

  screen.write("\x1b[2;1H\x1b[1M");
  assertEquals(screen.textRows(), ["row1", "new", "row3", ""]);
});

Deno.test("TerminalScreenController clamps insert and delete edits to screen bounds", () => {
  const screen = new TerminalScreenController({ columns: 6, rows: 3 });

  screen.write("abcdef\x1b[1;5H\x1b[9@Z");
  assertEquals(screen.textRows()[0], "abcdZ");

  screen.write("\x1b[1;5H\x1b[9P");
  assertEquals(screen.textRows()[0], "abcd");

  screen.write("\x1b[3;1H\x1b[5Lbot");
  assertEquals(screen.textRows(), ["abcd", "", "bot"]);
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
