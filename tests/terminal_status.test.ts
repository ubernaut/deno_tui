import { assertEquals } from "./deps.ts";
import { TerminalOutputController } from "../src/components/terminal_output.ts";
import type { ProcessSessionInspection } from "../src/runtime/process_session.ts";
import type { TerminalSessionHandleInspection } from "../src/runtime/terminal_backend.ts";
import {
  formatTerminalOutputHint,
  formatTerminalOutputWindowTitle,
  formatTerminalShellHint,
  formatTerminalShellStatusLine,
  formatTerminalShellWindowTitle,
  summarizeTerminalStatus,
  terminalInputModeDisplayLabel,
  terminalStatusFields,
  terminalStatusTone,
} from "../src/runtime/terminal_status.ts";
import { denoTaskTerminalTemplate, type TerminalSessionDescriptor } from "../src/runtime/terminal_templates.ts";

Deno.test("summarizeTerminalStatus formats process session state", () => {
  const output = new TerminalOutputController();
  const source: ProcessSessionInspection = {
    command: { command: "deno", args: ["task", "health"], cwd: "/repo" },
    commandLine: "deno task health",
    status: "failed",
    running: false,
    exit: { code: 1, success: false, durationMs: 42 },
    output: output.inspect(),
  };

  assertEquals(summarizeTerminalStatus(source, { backendId: "process" }), {
    title: undefined,
    status: "failed",
    running: false,
    backendId: "process",
    pty: false,
    backendKind: "process",
    commandLine: "deno task health",
    cwd: "/repo",
    columns: undefined,
    rows: undefined,
    exitCode: 1,
    exitSignal: undefined,
    detached: false,
    reconnectable: false,
    fields: ["FAILED", "PROCESS FALLBACK", "backend:process", "exit:1", "cwd:/repo", "cmd:deno task health"],
    text: "FAILED  PROCESS FALLBACK  backend:process  exit:1  cwd:/repo  cmd:deno task health",
  });
  output.dispose();
});

Deno.test("summarizeTerminalStatus formats backend dimensions and exit signals", () => {
  const source: TerminalSessionHandleInspection = {
    id: "session-1",
    backendId: "pty",
    pty: true,
    commandLine: "bash -l",
    status: "cancelled",
    running: false,
    columns: 120,
    rows: 32,
    resizeSupported: true,
    exit: { code: 143, signal: "SIGTERM", success: false, durationMs: 100 },
  };

  const summary = summarizeTerminalStatus(source, {
    title: "Shell",
    detached: true,
    reconnectable: true,
    width: 38,
  });
  assertEquals(summary.fields, [
    "Shell",
    "CANCELLED",
    "PTY",
    "backend:pty",
    "120x32",
    "exit:143/SIGTERM",
    "detached",
    "reconnectable",
    "cmd:bash -l",
  ]);
  assertEquals(summary.text, "Shell  CANCELLED  PTY  backend:pty ...");
});

Deno.test("summarizeTerminalStatus reads workspace descriptor metadata", () => {
  const descriptor: TerminalSessionDescriptor = {
    id: "health",
    title: "Health Task",
    template: denoTaskTerminalTemplate({ task: "health", cwd: "/repo", reconnectable: true }),
    backendId: "process",
    pty: false,
    commandLine: "deno task health",
    status: "running",
    running: true,
    columns: 100,
    rows: 24,
    reconnectable: true,
    restartPolicy: "on-failure",
    createdAt: 1,
    updatedAt: 2,
  };

  assertEquals(summarizeTerminalStatus(descriptor, { includeCommand: false }).fields, [
    "Health Task",
    "RUNNING",
    "PROCESS FALLBACK",
    "backend:process",
    "100x24",
    "cwd:/repo",
    "reconnectable",
  ]);
  assertEquals(terminalStatusFields({ status: "idle", running: false, includeCommand: false }), ["IDLE"]);
});

Deno.test("formatTerminalOutputWindowTitle includes input mode and status", () => {
  assertEquals(
    formatTerminalOutputWindowTitle({ status: "running" }, { mode: "raw" }),
    "Terminal Output RAW RUNNING",
  );
  assertEquals(
    formatTerminalOutputWindowTitle({ status: "starting" }, { mode: "wb", prefix: "Process" }),
    "Process WB STARTING",
  );
});

Deno.test("formatTerminalShellWindowTitle includes OSC runtime titles", () => {
  assertEquals(
    formatTerminalShellWindowTitle({ status: "running", title: "vim main.ts" }, { mode: "raw" }),
    "Shell RAW RUNNING · vim main.ts",
  );
  assertEquals(
    formatTerminalShellWindowTitle({ status: "idle", title: "   " }, { mode: "wb" }),
    "Shell WB IDLE",
  );
});

Deno.test("terminal status presenters expose stable tone and mode labels", () => {
  assertEquals(terminalStatusTone("running"), "good");
  assertEquals(terminalStatusTone("failed"), "danger");
  assertEquals(terminalStatusTone("cancelled"), "warning");
  assertEquals(terminalStatusTone("starting"), "accent");
  assertEquals(terminalStatusTone("idle"), "muted");
  assertEquals(terminalInputModeDisplayLabel("raw"), "RAW INPUT");
  assertEquals(terminalInputModeDisplayLabel("raw", { rawLabel: "RAW SHELL" }), "RAW SHELL");
  assertEquals(terminalInputModeDisplayLabel("workbench"), "WORKBENCH");
});

Deno.test("formatTerminalShellStatusLine composes backend command and scrollback state", () => {
  assertEquals(
    formatTerminalShellStatusLine({
      mode: "RAW SHELL",
      status: "running",
      pty: true,
      backendLabel: "sigma-pty",
      commandLine: "bash -l",
      scrollbackOffset: 24,
      scrollbackViewportRows: 10,
      scrollbackTotalRows: 100,
    }),
    "RAW SHELL RUNNING PTY sigma-pty · bash -l · rows 25-34/100",
  );
  assertEquals(
    formatTerminalShellStatusLine({
      mode: "COPY MODE",
      status: "starting",
      pty: false,
      commandLine: "bash",
      scrollbackOffset: 0,
      scrollbackViewportRows: 20,
      scrollbackTotalRows: 0,
    }),
    "COPY MODE STARTING PROCESS FALLBACK pending · bash · rows 0-0/0",
  );
});

Deno.test("terminal hint formatters cover process output shell and copy modes", () => {
  assertEquals(
    formatTerminalOutputHint("raw"),
    "raw input: printable keys go to child process  Esc workbench mode  Ctrl+C reserved",
  );
  assertEquals(
    formatTerminalOutputHint("workbench"),
    "keys: P run  S stop  U restart  K clear  V follow  Y copy  I raw input",
  );
  assertEquals(
    formatTerminalShellHint({ inputMode: "raw" }),
    "raw shell input: keys go to shell  Ctrl+C interrupts shell  Esc returns to Workbench",
  );
  assertEquals(
    formatTerminalShellHint({ inputMode: "workbench" }),
    "keys: P start  S stop  U restart  K clear  I raw input  PageUp copy scroll",
  );
  assertEquals(
    formatTerminalShellHint({ inputMode: "raw", copyMode: true }),
    "copy mode: PageUp/PageDown scroll  Space select  Shift+Up/Down extend  C copy  Esc live input",
  );
});
