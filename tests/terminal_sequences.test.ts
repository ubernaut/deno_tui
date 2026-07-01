import { assertEquals } from "./deps.ts";
import { parseTerminalControlSequence, parseTerminalParams } from "../src/runtime/terminal_sequences.ts";

Deno.test("terminal sequence parser parses private CSI sequences", () => {
  assertEquals(parseTerminalControlSequence("\x1b[?1000;1006hrest"), {
    kind: "csi",
    private: true,
    params: "1000;1006",
    intermediates: "",
    command: "h",
    length: 13,
  });
});

Deno.test("terminal sequence parser preserves CSI intermediates", () => {
  assertEquals(parseTerminalControlSequence("\x1b[6 q"), {
    kind: "csi",
    private: false,
    params: "6",
    intermediates: " ",
    command: "q",
    length: 5,
  });
});

Deno.test("terminal sequence parser supports OSC BEL and ST terminators", () => {
  assertEquals(parseTerminalControlSequence("\x1b]0;title\x07after"), {
    kind: "osc",
    private: false,
    params: "0;title",
    intermediates: "",
    command: "]",
    length: 10,
  });
  assertEquals(parseTerminalControlSequence("\x1b]2;editor\x1b\\after"), {
    kind: "osc",
    private: false,
    params: "2;editor",
    intermediates: "",
    command: "]",
    length: 12,
  });
});

Deno.test("terminal sequence parser supports single-character ESC controls", () => {
  for (const command of ["7", "8", "M", "H", "D", "E", "c"]) {
    assertEquals(parseTerminalControlSequence(`\x1b${command}rest`), {
      kind: "esc",
      private: false,
      params: "",
      intermediates: "",
      command,
      length: 2,
    });
  }
});

Deno.test("terminal sequence parser parses controls at an offset without slicing", () => {
  assertEquals(parseTerminalControlSequence("xx\x1b[?25l", 2), {
    kind: "csi",
    private: true,
    params: "25",
    intermediates: "",
    command: "l",
    length: 6,
  });
  assertEquals(parseTerminalControlSequence("xx\x1b]0;title\x07after", 2), {
    kind: "osc",
    private: false,
    params: "0;title",
    intermediates: "",
    command: "]",
    length: 10,
  });
  assertEquals(parseTerminalControlSequence("xx\x1bMrest", 2), {
    kind: "esc",
    private: false,
    params: "",
    intermediates: "",
    command: "M",
    length: 2,
  });
  assertEquals(parseTerminalControlSequence("\x1b[31mxx", 5), undefined);
});

Deno.test("terminal parameter parser handles semicolon colon and empty slots", () => {
  assertEquals(parseTerminalParams("1;2:3;;5"), [1, 2, 3, 0, 5]);
  assertEquals(parseTerminalParams(""), []);
});
