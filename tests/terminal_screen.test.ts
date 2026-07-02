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

Deno.test("TerminalScreenController writes unicode graphics without splitting surrogate pairs", () => {
  const screen = new TerminalScreenController({ columns: 8, rows: 2 });

  screen.write("界🙂x");

  assertEquals(screen.textRows()[0], "界 🙂 x");
  const [row] = screen.cellRows();
  assertEquals(row![0], { char: "界" });
  assertEquals(row![2], { char: "🙂" });
  assertEquals(row![4], { char: "x" });
  assertEquals(screen.inspect().cursor, { column: 5, row: 0 });
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

Deno.test("TerminalScreenController supports common absolute and line cursor controls", () => {
  const screen = new TerminalScreenController({ columns: 10, rows: 4 });

  screen.write("aa\x1b[2Ebb\x1b[5GZ\x1b[1Fcc\x1b[3dD");

  assertEquals(screen.textRows(), ["aa", "cc", "bbD Z", ""]);
  assertEquals(screen.inspect().cursor, { column: 3, row: 2 });
});

Deno.test("TerminalScreenController supports common xterm cursor aliases", () => {
  const screen = new TerminalScreenController({ columns: 12, rows: 4 });

  screen.write("A\x1b[5`B\x1b[2aC\x1b[2eD");

  assertEquals(screen.textRows(), ["A   B  C", "", "        D", ""]);
  assertEquals(screen.inspect().cursor, { column: 9, row: 2 });
});

Deno.test("TerminalScreenController applies erase-before and erase-character controls", () => {
  const screen = new TerminalScreenController({ columns: 8, rows: 3 });

  screen.write("abcdef\x1b[2;1H123456\x1b[2;4H\x1b[1K");
  assertEquals(screen.textRows(), ["abcdef", "    56", ""]);

  screen.write("\x1b[1;4H\x1b[1J");
  assertEquals(screen.textRows(), ["    ef", "    56", ""]);

  screen.write("\x1b[1;5HXYZZY\x1b[1;5H\x1b[3X");
  assertEquals(screen.textRows()[0], "       Z");

  screen.write("\x1b[2;6H\x1b[2K");
  assertEquals(screen.textRows()[1], "");
});

Deno.test("TerminalScreenController supports set and clear tab stops", () => {
  const screen = new TerminalScreenController({ columns: 16, rows: 3 });

  screen.write("a\tb");
  assertEquals(screen.textRows()[0], "a       b");

  screen.write("\x1b[2;1H\x1b[4G\x1bH\x1b[1Gx\ty");
  assertEquals(screen.textRows()[1], "x  y");

  screen.write("\x1b[3;1H\x1b[4G\x1b[g\x1b[1Gx\ty");
  assertEquals(screen.textRows()[2], "x       y");
});

Deno.test("TerminalScreenController supports clearing all tab stops", () => {
  const screen = new TerminalScreenController({ columns: 12, rows: 2 });

  screen.write("\x1b[3gA\tB");
  assertEquals(screen.textRows()[0], "A          B");

  screen.write("\x1b[2;5H\x1bH\x1b[2;1HC\tD");
  assertEquals(screen.textRows()[1], "C   D");
});

Deno.test("TerminalScreenController supports forward and backward tab controls", () => {
  const screen = new TerminalScreenController({ columns: 20, rows: 2 });

  screen.write("\x1b[3g\x1b[6G\x1bH\x1b[11G\x1bH\x1b[1G\x1b[2IAB\x1b[1ZC");

  assertEquals(screen.textRows()[0], "          CB");
  assertEquals(screen.inspect().cursor, { column: 11, row: 0 });
});

Deno.test("TerminalScreenController preserves in-range tab stops after resize", () => {
  const screen = new TerminalScreenController({ columns: 16, rows: 2 });

  screen.write("\x1b[12G\x1bH");
  screen.resize(10, 2);
  screen.write("\x1b[1Gx\ty");

  assertEquals(screen.textRows()[0], "x       y");
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

Deno.test("TerminalScreenController supports DEC autowrap mode", () => {
  const screen = new TerminalScreenController({ columns: 4, rows: 2 });

  screen.write("\x1b[?7labcdE");
  assertEquals(screen.textRows(), ["abcE", ""]);
  assertEquals(screen.inspect().cursor, { column: 3, row: 0 });
  assertEquals(screen.inspect().privateModes, []);

  screen.write("\x1b[?7hF");
  assertEquals(screen.textRows(), ["abcF", ""]);
  assertEquals(screen.inspect().cursor, { column: 0, row: 1 });
  assertEquals(screen.inspect().privateModes, [7]);
});

Deno.test("TerminalScreenController supports insert and replace character modes", () => {
  const screen = new TerminalScreenController({ columns: 8, rows: 2 });

  screen.write("abcdef\x1b[1;3H\x1b[4hXY");
  assertEquals(screen.textRows()[0], "abXYcdef");

  screen.write("\x1b[4l\x1b[1;3HZZ");
  assertEquals(screen.textRows()[0], "abZZcdef");
});

Deno.test("TerminalScreenController supports repeat preceding graphic character", () => {
  const screen = new TerminalScreenController({ columns: 8, rows: 2 });

  screen.write("\x1b[31mX\x1b[3b\x1b[0mY");

  assertEquals(screen.textRows()[0], "XXXXY");
  const [row] = screen.cellRows();
  assertEquals(row![0], { char: "X", foreground: 31 });
  assertEquals(row![3], { char: "X", foreground: 31 });
  assertEquals(row![4], { char: "Y" });
});

Deno.test("TerminalScreenController supports ESC index and next-line controls", () => {
  const screen = new TerminalScreenController({ columns: 8, rows: 3, scrollbackLimit: 2 });

  screen.write("ab\x1bDcd\x1bEef");
  assertEquals(screen.textRows(), ["ab", "  cd", "ef"]);
  assertEquals(screen.inspect().cursor, { column: 2, row: 2 });

  screen.write("\x1b[3;1Hbottom\x1bD\rnext");
  assertEquals(screen.scrollbackTextRows(), ["ab"]);
  assertEquals(screen.textRows(), ["  cd", "bottom", "next"]);
});

Deno.test("TerminalScreenController supports ESC c reset", () => {
  const screen = new TerminalScreenController({ columns: 8, rows: 2, scrollbackLimit: 2 });

  screen.write("\x1b]0;session\x07\x1b[?25l\x1b[?1049h\x1b[1;31mred\nline");
  screen.write("\x1bcplain");

  assertEquals(screen.inspect(), {
    columns: 8,
    rows: 2,
    cursor: { column: 5, row: 0 },
    cursorVisible: true,
    cursorStyle: { shape: "block", blinking: true },
    privateModes: [],
    scrollbackRows: 0,
    alternate: false,
    title: undefined,
  });
  assertEquals(screen.cellRows()[0]![0], { char: "p" });
  assertEquals(screen.textRows(), ["plain", ""]);
});

Deno.test("TerminalScreenController clips insert mode at the row edge", () => {
  const screen = new TerminalScreenController({ columns: 6, rows: 2 });

  screen.write("abcdef\x1b[1;5H\x1b[4hXY");
  assertEquals(screen.textRows(), ["abcdXY", ""]);
  assertEquals(screen.inspect().cursor, { column: 0, row: 1 });
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

Deno.test("TerminalScreenController replays a realistic colored shell transcript", () => {
  const screen = new TerminalScreenController({ columns: 72, rows: 6, scrollbackLimit: 4 });

  screen.write("\x1b]0;cos@old-donkey:~/projects/deno_tui\x07");
  screen.write("\x1b[?25l");
  screen.write("cos@old-donkey:~/projects/deno_tui$ deno task test\r\n");
  screen.write("\x1b[38;5;34mTask\x1b[0m test deno test ./tests/terminal_screen.test.ts\r\n");
  screen.write("running 2 tests\r\n");
  screen.write("terminal parser fixture ... \x1b[32mok\x1b[0m (12ms)\r\n");
  screen.write("\x1b[38;2;120;200;255mok\x1b[0m | 2 passed | 0 failed\r\n");
  screen.write("\x1b[?25h");

  assertEquals(screen.inspect().title, "cos@old-donkey:~/projects/deno_tui");
  assertEquals(screen.inspect().cursorVisible, true);
  assertEquals(screen.textRows(), [
    "cos@old-donkey:~/projects/deno_tui$ deno task test",
    "Task test deno test ./tests/terminal_screen.test.ts",
    "running 2 tests",
    "terminal parser fixture ... ok (12ms)",
    "ok | 2 passed | 0 failed",
    "",
  ]);

  const rows = screen.cellRows();
  assertEquals(rows[1]![0], { char: "T", foreground: 34 });
  assertEquals(rows[3]![28], { char: "o", foreground: 32 });
  assertEquals(rows[4]![0], { char: "o", foreground: 0x78c8ff });
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

Deno.test("TerminalScreenController supports reverse index inside scroll regions", () => {
  const screen = new TerminalScreenController({ columns: 8, rows: 4 });

  screen.write("row1\x1b[2;1Hrow2\x1b[3;1Hrow3\x1b[4;1Hrow4");
  screen.write("\x1b[2;4r\x1b[2;1H\x1bMnew");

  assertEquals(screen.textRows(), ["row1", "new", "row2", "row3"]);
  assertEquals(screen.inspect().cursor, { column: 3, row: 1 });
});

Deno.test("TerminalScreenController supports explicit scroll up and down controls", () => {
  const screen = new TerminalScreenController({ columns: 8, rows: 4 });

  screen.write("row1\x1b[2;1Hrow2\x1b[3;1Hrow3\x1b[4;1Hrow4");
  screen.write("\x1b[2;4r\x1b[1S");
  assertEquals(screen.textRows(), ["row1", "row3", "row4", ""]);

  screen.write("\x1b[2T");
  assertEquals(screen.textRows(), ["row1", "", "", "row3"]);
});

Deno.test("TerminalScreenController applies DEC origin mode relative to scroll regions", () => {
  const screen = new TerminalScreenController({ columns: 8, rows: 5 });

  screen.write("\x1b[2;4r\x1b[?6h\x1b[1;1Htop\x1b[3;5Hbot");
  assertEquals(screen.textRows(), ["", "top", "", "    bot", ""]);
  assertEquals(screen.inspect().cursor, { column: 7, row: 3 });
  assertEquals(screen.inspect().privateModes, [6]);

  screen.write("\x1b[?6l\x1b[1;1Hroot");
  assertEquals(screen.textRows(), ["root", "top", "", "    bot", ""]);
  assertEquals(screen.inspect().cursor, { column: 4, row: 0 });
  assertEquals(screen.inspect().privateModes, []);
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

Deno.test("TerminalScreenController supports legacy alternate screen private modes", () => {
  const screen = new TerminalScreenController({ columns: 8, rows: 2 });

  screen.write("main\x1b[?47halt");
  assertEquals(screen.inspect().alternate, true);
  assertEquals(screen.textRows()[0], "alt");
  assertEquals(screen.inspect().privateModes, [47]);

  screen.write("\x1b[?47l");
  assertEquals(screen.inspect().alternate, false);
  assertEquals(screen.textRows()[0], "main");
  assertEquals(screen.inspect().privateModes, []);

  screen.write("\x1b[?1047hfull\x1b[?1047l");
  assertEquals(screen.inspect().alternate, false);
  assertEquals(screen.textRows()[0], "main");
});

Deno.test("TerminalScreenController supports DEC private cursor save restore mode", () => {
  const screen = new TerminalScreenController({ columns: 8, rows: 3 });

  screen.write("ab\x1b[?1048h\x1b[3;6Hxy\x1b[?1048lZ");
  assertEquals(screen.textRows(), ["abZ", "", "     xy"]);
  assertEquals(screen.inspect().cursor, { column: 3, row: 0 });

  screen.write("\x1b[3;7H\x1b[?1049hALT\x1b[?1049lR");
  assertEquals(screen.inspect().alternate, false);
  assertEquals(screen.textRows(), ["abZ", "", "     xR"]);
  assertEquals(screen.inspect().cursor, { column: 7, row: 2 });
});

Deno.test("TerminalScreenController replays a full-screen curses-style transcript", () => {
  const screen = new TerminalScreenController({ columns: 24, rows: 5, scrollbackLimit: 4 });

  screen.write("shell prompt");
  screen.write("\x1b[?1049h\x1b[?25l\x1b]2;process viewer\x07");
  screen.write("\x1b[1;1H\x1b[1;37;44m PID  CPU  COMMAND      \x1b[0m");
  screen.write("\x1b[2;5r");
  screen.write("\x1b[2;1H 100  12%  deno");
  screen.write("\x1b[3;1H 101   8%  bash");
  screen.write("\x1b[4;1H 102   4%  vim");
  screen.write("\x1b[5;1Hstatus: running");
  screen.write("\x1b[5;1H\x1b[32mstatus: ok\x1b[0m");

  assertEquals(screen.inspect().alternate, true);
  assertEquals(screen.inspect().cursorVisible, false);
  assertEquals(screen.inspect().title, "process viewer");
  assertEquals(screen.scrollbackTextRows(), []);
  assertEquals(screen.textRows(), [
    " PID  CPU  COMMAND",
    " 100  12%  deno",
    " 101   8%  bash",
    " 102   4%  vim",
    "status: oknning",
  ]);
  assertEquals(screen.cellRows()[0]![1], { char: "P", bold: true, foreground: 37, background: 44 });
  assertEquals(screen.cellRows()[4]![0], { char: "s", foreground: 32 });

  screen.write("\x1b[?25h\x1b[?1049l");
  assertEquals(screen.inspect().alternate, false);
  assertEquals(screen.inspect().cursorVisible, true);
  assertEquals(screen.textRows()[0], "shell prompt");
});
