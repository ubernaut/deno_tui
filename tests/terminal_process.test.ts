import { assertEquals } from "./deps.ts";
import {
  formatTerminalOutputLine,
  TerminalOutputController,
  visibleTerminalOutputLines,
} from "../src/components/terminal_output.ts";
import { bindTerminalCommands, type TerminalCommandAction, terminalCommands } from "../src/app/terminal_commands.ts";
import { type Command, CommandRegistry } from "../src/app/commands.ts";
import {
  formatProcessCommandLine,
  type ProcessSessionChild,
  ProcessSessionController,
} from "../src/runtime/process_session.ts";

Deno.test("TerminalOutputController bounds stream-tagged scrollback and follow mode", () => {
  const output = new TerminalOutputController({ limit: 3 });

  output.appendText("system", "boot", 1);
  output.appendMany([
    { source: "stdout", text: "ready", timestamp: 2 },
    { source: "stderr", text: "warn", timestamp: 3 },
    { source: "stdout", text: "done", timestamp: 4 },
  ]);

  assertEquals(output.inspect(2), {
    lines: [
      { source: "stdout", text: "ready", timestamp: 2 },
      { source: "stderr", text: "warn", timestamp: 3 },
      { source: "stdout", text: "done", timestamp: 4 },
    ],
    lineCount: 3,
    visible: [
      { source: "stderr", text: "warn", timestamp: 3 },
      { source: "stdout", text: "done", timestamp: 4 },
    ],
    limit: 3,
    follow: true,
    empty: false,
  });

  output.setFollow(false);
  assertEquals(visibleTerminalOutputLines(output.lines.peek(), 2, false), [
    { source: "stdout", text: "ready", timestamp: 2 },
    { source: "stderr", text: "warn", timestamp: 3 },
  ]);
  assertEquals(formatTerminalOutputLine({ source: "stderr", text: "warn" }, { sourcePrefix: true }), "[err] warn");
  output.dispose();
});

Deno.test("ProcessSessionController streams stdout stderr and exit metadata", async () => {
  const session = new ProcessSessionController({
    command: "demo",
    args: ["--stdout", "--stderr"],
    now: () => 10,
    spawn: () => completedChild("alpha\n", "beta\n", { code: 0, success: true }),
  });

  assertEquals(await session.start(), true);

  const inspection = session.inspect();
  assertEquals(inspection.status, "exited");
  assertEquals(inspection.running, false);
  assertEquals(inspection.exit, { code: 0, success: true, durationMs: 0 });
  assertEquals(
    inspection.output.lines.map((line) => [line.source, line.text]),
    [
      ["system", `$ ${formatProcessCommandLine(session.command.peek())}`],
      ["stdout", "alpha"],
      ["stderr", "beta"],
      ["system", "process exited code=0 duration=0ms"],
    ],
  );

  await session.dispose();
});

Deno.test("ProcessSessionController can stop a running process", async () => {
  let resolveStatus!: (status: { code: number; signal?: string | null; success: boolean }) => void;
  const status = new Promise<{ code: number; signal?: string | null; success: boolean }>((resolve) => {
    resolveStatus = resolve;
  });
  const session = new ProcessSessionController({
    command: "demo",
    args: ["--long"],
    appendCommandLine: false,
    spawn: () => ({
      stdout: streamFromText("started\n"),
      stderr: streamFromText(""),
      status,
      kill: (signal) => resolveStatus({ code: 143, signal, success: false }),
    }),
  });

  const run = session.start();
  assertEquals(session.running, true);
  assertEquals(await session.stop(), true);
  await run;

  assertEquals(session.inspect().status, "cancelled");
  assertEquals(session.inspect().output.lines.some((line) => line.text.startsWith("sent ")), true);
  await session.dispose();
});

Deno.test("terminalCommands run clear follow and copy process sessions", async () => {
  const session = new ProcessSessionController({
    command: "demo",
    args: ["--ok"],
    appendCommandLine: false,
    spawn: () => completedChild("ok\n", "", { code: 0, success: true }),
  });
  const registry = new CommandRegistry<TerminalCommandAction>();
  const actions: TerminalCommandAction[] = [];
  const dispose = bindTerminalCommands(registry, session, {
    id: "build",
    idPrefix: "terminal.build",
    group: "terminal",
  });

  assertEquals(terminalCommands(session).map((command) => [command.id, commandDisabled(command)]), [
    ["terminal.run", false],
    ["terminal.stop", true],
    ["terminal.restart", false],
    ["terminal.clear", true],
    ["terminal.toggleFollow", false],
    ["terminal.copyCommand", false],
  ]);
  assertEquals(registry.list("terminal").map((command) => command.id), [
    "terminal.build.clear",
    "terminal.build.copyCommand",
    "terminal.build.restart",
    "terminal.build.run",
    "terminal.build.stop",
    "terminal.build.toggleFollow",
  ]);

  assertEquals(await registry.execute("terminal.build.run", (action) => void actions.push(action)), true);
  assertEquals(actions[0]!.type, "terminal.run");
  assertEquals(session.inspect().output.lines.some((line) => line.text === "ok"), true);

  assertEquals(await registry.execute("terminal.build.toggleFollow", (action) => void actions.push(action)), true);
  assertEquals(actions[1], {
    type: "terminal.followChanged",
    payload: {
      id: "build",
      follow: false,
      session: session.inspect(),
    },
  });

  assertEquals(await registry.execute("terminal.build.copyCommand", (action) => void actions.push(action)), true);
  const copyAction = actions[2];
  assertEquals(copyAction?.type, "terminal.commandCopied");
  assertEquals(
    copyAction?.type === "terminal.commandCopied" ? copyAction.payload?.commandLine : undefined,
    formatProcessCommandLine(session.command.peek()),
  );

  assertEquals(await registry.execute("terminal.build.clear", (action) => void actions.push(action)), true);
  assertEquals(session.inspect().output.empty, true);

  dispose();
  assertEquals(registry.list("terminal"), []);
  await session.dispose();
});

function commandDisabled(command: Command<TerminalCommandAction>): boolean {
  return typeof command.disabled === "function" ? command.disabled() : Boolean(command.disabled);
}

function completedChild(
  stdout: string,
  stderr: string,
  status: { code: number; signal?: string | null; success: boolean },
): ProcessSessionChild {
  return {
    stdout: streamFromText(stdout),
    stderr: streamFromText(stderr),
    status: Promise.resolve(status),
    kill: () => {},
  };
}

function streamFromText(text: string): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      if (text) controller.enqueue(new TextEncoder().encode(text));
      controller.close();
    },
  });
}
