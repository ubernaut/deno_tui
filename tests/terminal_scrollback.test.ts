import { assertEquals } from "./deps.ts";
import { CommandRegistry } from "../src/app/commands.ts";
import {
  bindTerminalScrollbackCommands,
  type TerminalScrollbackCommandAction,
  terminalScrollbackCommands,
} from "../src/app/terminal_commands.ts";
import { TerminalScreenController } from "../src/runtime/terminal_screen.ts";
import { TerminalScrollbackController } from "../src/runtime/terminal_scrollback.ts";

Deno.test("TerminalScrollbackController follows live output and enters copy mode on scroll", () => {
  const screen = new TerminalScreenController({ columns: 12, rows: 3, scrollbackLimit: 5 });
  screen.write("one\ntwo\nthree\nfour\nfive");
  const scrollback = new TerminalScrollbackController({ screen, viewportRows: 3 });

  assertEquals(scrollback.inspect(), {
    mode: "live",
    offset: 2,
    maxOffset: 2,
    viewportRows: 3,
    totalRows: 5,
    scrollbackRows: 2,
    liveRows: 3,
    visibleRows: ["three", "four", "five"],
    matches: [],
  });

  assertEquals(scrollback.scrollLines(-1), 1);
  assertEquals(scrollback.inspect().mode, "copy");
  assertEquals(scrollback.inspect().visibleRows, ["two", "three", "four"]);

  screen.write("\nsix");
  assertEquals(scrollback.inspect().mode, "copy");
  assertEquals(scrollback.inspect().visibleRows, ["two", "three", "four"]);

  scrollback.exitCopyMode();
  assertEquals(scrollback.inspect().visibleRows, ["four", "five", "six"]);
});

Deno.test("TerminalScrollbackController pages clamps and searches", () => {
  const screen = new TerminalScreenController({ columns: 16, rows: 2, scrollbackLimit: 10 });
  screen.write("alpha\nbeta\ngamma\nalphabet\nomega");
  const scrollback = new TerminalScrollbackController({ screen, viewportRows: 2 });

  assertEquals(scrollback.toTop(), 0);
  assertEquals(scrollback.page(1), 2);
  assertEquals(scrollback.inspect().visibleRows, ["gamma", "alphabet"]);
  assertEquals(scrollback.page(10), 3);

  assertEquals(scrollback.search("alpha"), [0, 3]);
  assertEquals(scrollback.inspect().offset, 0);
  assertEquals(scrollback.inspect().activeMatch, 0);
  assertEquals(scrollback.nextMatch(), 3);
  assertEquals(scrollback.inspect().visibleRows, ["alphabet", "omega"]);
  assertEquals(scrollback.nextMatch(), 0);
});

Deno.test("TerminalScrollbackController selects and copies line ranges", () => {
  const screen = new TerminalScreenController({ columns: 10, rows: 2, scrollbackLimit: 10 });
  screen.write("first\nsecond\nthird\nfourth");
  const scrollback = new TerminalScrollbackController({ screen, viewportRows: 2 });

  assertEquals(scrollback.setSelection(1, 3), { anchor: 1, focus: 3 });
  assertEquals(scrollback.copySelection(), "second\nthird\nfourth");
  assertEquals(scrollback.inspect().selectedText, "second\nthird\nfourth");
  assertEquals(scrollback.inspect().visibleRows, ["second", "third"]);

  assertEquals(scrollback.setSelection(99, -10), { anchor: 3, focus: 0 });
  assertEquals(scrollback.copySelection(), "first\nsecond\nthird\nfourth");
  scrollback.clearSelection();
  assertEquals(scrollback.inspect().selection, undefined);
});

Deno.test("terminal scrollback commands drive copy mode search and selection", async () => {
  const screen = new TerminalScreenController({ columns: 10, rows: 2, scrollbackLimit: 10 });
  screen.write("alpha\nbeta\ngamma\nalphabet");
  const scrollback = new TerminalScrollbackController({ screen, viewportRows: 2 });
  let query = "alpha";
  const registry = new CommandRegistry<TerminalScrollbackCommandAction>();
  const actions: TerminalScrollbackCommandAction[] = [];
  const dispose = bindTerminalScrollbackCommands(registry, scrollback, {
    id: "shell",
    idPrefix: "shell.scrollback",
    searchQuery: () => query,
  });

  assertEquals(
    terminalScrollbackCommands(scrollback, { searchQuery: () => query }).map((command) => [
      command.id,
      commandDisabled(command),
    ]),
    [
      ["terminalScrollback.toggleCopyMode", false],
      ["terminalScrollback.exitCopyMode", true],
      ["terminalScrollback.lineUp", false],
      ["terminalScrollback.lineDown", false],
      ["terminalScrollback.pageUp", false],
      ["terminalScrollback.pageDown", false],
      ["terminalScrollback.top", false],
      ["terminalScrollback.bottom", false],
      ["terminalScrollback.search", false],
      ["terminalScrollback.nextMatch", true],
      ["terminalScrollback.previousMatch", true],
      ["terminalScrollback.clearSelection", true],
      ["terminalScrollback.copySelection", true],
    ],
  );

  assertEquals(await registry.execute("shell.scrollback.search", (action) => void actions.push(action)), true);
  assertEquals(actions[0]?.type, "terminalScrollback.searched");
  assertEquals(actions[0]!.payload!.scrollback.matches, [0, 3]);

  assertEquals(await registry.execute("shell.scrollback.nextMatch", (action) => void actions.push(action)), true);
  assertEquals(actions[1]?.type, "terminalScrollback.matchChanged");
  assertEquals(actions[1]!.payload!.scrollback.offset, 2);

  assertEquals(await registry.execute("shell.scrollback.lineUp", (action) => void actions.push(action)), true);
  assertEquals(actions[2]?.type, "terminalScrollback.scrolled");
  assertEquals(actions[2]!.payload!.scrollback.offset, 1);

  scrollback.setSelection(1, 2);
  assertEquals(await registry.execute("shell.scrollback.copySelection", (action) => void actions.push(action)), true);
  assertEquals(actions[3]?.type, "terminalScrollback.selectionCopied");
  const copied = actions[3];
  if (copied?.type !== "terminalScrollback.selectionCopied") throw new Error("expected selection copied action");
  assertEquals(copied.payload!.text, "beta\ngamma");

  query = "";
  const searchCommand = registry.get("shell.scrollback.search")!;
  assertEquals(commandDisabled(searchCommand), true);
  dispose();
  assertEquals(registry.list("terminal"), []);
});

function commandDisabled(command: { disabled?: boolean | (() => boolean) }): boolean {
  return typeof command.disabled === "function" ? command.disabled() : !!command.disabled;
}
