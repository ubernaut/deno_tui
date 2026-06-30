import { assertEquals } from "./deps.ts";
import { TerminalOutputController } from "../src/components/terminal_output.ts";
import type { ProcessSessionInspection } from "../src/runtime/process_session.ts";
import type { TerminalSessionHandleInspection } from "../src/runtime/terminal_backend.ts";
import { summarizeTerminalStatus, terminalStatusFields } from "../src/runtime/terminal_status.ts";
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
    commandLine: "deno task health",
    cwd: "/repo",
    columns: undefined,
    rows: undefined,
    exitCode: 1,
    exitSignal: undefined,
    detached: false,
    reconnectable: false,
    fields: ["FAILED", "backend:process", "exit:1", "cwd:/repo", "cmd:deno task health"],
    text: "FAILED  backend:process  exit:1  cwd:/repo  cmd:deno task health",
  });
  output.dispose();
});

Deno.test("summarizeTerminalStatus formats backend dimensions and exit signals", () => {
  const source: TerminalSessionHandleInspection = {
    id: "session-1",
    backendId: "pty",
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
    "backend:pty",
    "120x32",
    "exit:143/SIGTERM",
    "detached",
    "reconnectable",
    "cmd:bash -l",
  ]);
  assertEquals(summary.text, "Shell  CANCELLED  backend:pty  120x...");
});

Deno.test("summarizeTerminalStatus reads workspace descriptor metadata", () => {
  const descriptor: TerminalSessionDescriptor = {
    id: "health",
    title: "Health Task",
    template: denoTaskTerminalTemplate({ task: "health", cwd: "/repo", reconnectable: true }),
    backendId: "process",
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
    "backend:process",
    "100x24",
    "cwd:/repo",
    "reconnectable",
  ]);
  assertEquals(terminalStatusFields({ status: "idle", running: false, includeCommand: false }), ["IDLE"]);
});
