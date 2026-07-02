import { assertEquals } from "./deps.ts";
import {
  commandTerminalTemplate,
  type ProcessSessionCommand,
  type ProcessSessionInspection,
  type ProcessSessionStatus,
  shellTerminalTemplate,
  type TerminalBackend,
  type TerminalBackendSpawnOptions,
  TerminalOutputController,
  type TerminalSessionHandle,
  type TerminalSessionHandleInspection,
  TerminalShellWorkspaceController,
} from "../mod.ts";

Deno.test("TerminalShellWorkspaceController routes active shell sessions", async () => {
  const backend = new FakeWorkspaceShellBackend();
  const workspace = new TerminalShellWorkspaceController({ backend, columns: 20, rows: 4 });

  workspace.add(shellTerminalTemplate({ id: "main", shell: "bash" }));
  workspace.add(commandTerminalTemplate({ id: "logs", command: "tail", args: ["-f", "app.log"] }), {
    activate: true,
  });

  assertEquals(workspace.inspect().activeId, "logs");
  assertEquals(await workspace.start(), true);
  let sessionUpdates = 0;
  const countSessionUpdate = () => sessionUpdates += 1;
  workspace.workspace.sessions.subscribe(countSessionUpdate);
  backend.emit(0, "log line");
  assertEquals(workspace.activeShell?.screen.textRows()[0], "log line");
  assertEquals(sessionUpdates, 0);
  workspace.workspace.sessions.unsubscribe(countSessionUpdate);
  assertEquals(await workspace.write("q"), true);
  assertEquals(backend.handles[0]?.writes, ["q"]);

  assertEquals(workspace.activateRelative(1)?.id, "main");
  assertEquals(await workspace.start(), true);
  assertEquals(backend.spawned[1]?.command, "bash");
  assertEquals(workspace.resize(40, 10), true);
  assertEquals(backend.handles[1]?.resizes.at(-1), { columns: 40, rows: 10 });

  const inspection = workspace.inspect();
  assertEquals(inspection.activeId, "main");
  assertEquals(inspection.activeShell?.running, true);
  assertEquals(inspection.workspace.active?.columns, 40);
  assertEquals(inspection.workspace.active?.rows, 10);
  assertEquals(inspection.sessions.map((session) => session.id), ["main", "logs"]);

  assertEquals(await workspace.remove("logs"), true);
  assertEquals(workspace.inspect().sessions.map((session) => session.id), ["main"]);
  await workspace.dispose();
});

Deno.test("TerminalShellWorkspaceController synchronizes stop and OSC titles", async () => {
  const backend = new FakeWorkspaceShellBackend();
  const workspace = new TerminalShellWorkspaceController({ backend });
  workspace.add(shellTerminalTemplate({ id: "main", shell: "bash" }));

  assertEquals(await workspace.start("main"), true);
  backend.emit(0, "\x1b]0;repo shell\x07$ ");
  assertEquals(workspace.inspect().workspace.active?.title, "repo shell");
  assertEquals(workspace.inspect().activeShell?.title, "repo shell");

  assertEquals(await workspace.stop("main"), true);
  assertEquals(workspace.inspect().workspace.active?.status, "cancelled");
  assertEquals(workspace.inspect().workspace.active?.running, false);
  await workspace.dispose();
});

class FakeWorkspaceShellBackend implements TerminalBackend {
  readonly id = "fake-workspace-pty";
  readonly label = "Fake Workspace PTY";
  readonly pty = true;
  readonly spawned: TerminalBackendSpawnOptions[] = [];
  readonly handles: FakeWorkspaceShellHandle[] = [];

  spawn(options: TerminalBackendSpawnOptions): TerminalSessionHandle {
    this.spawned.push({
      command: options.command,
      args: options.args ? [...options.args] : undefined,
      cwd: options.cwd,
      env: options.env ? { ...options.env } : undefined,
      columns: options.columns,
      rows: options.rows,
      output: options.output,
      onData: options.onData,
    });
    const handle = new FakeWorkspaceShellHandle(`${this.id}-${this.handles.length}`, this.id, options);
    this.handles.push(handle);
    return handle;
  }

  emit(index: number, data: string): void {
    this.spawned[index]?.onData?.(data, "stdout");
  }
}

class FakeWorkspaceShellHandle implements TerminalSessionHandle {
  readonly command: ProcessSessionCommand;
  readonly output: TerminalOutputController;
  readonly writes: string[] = [];
  readonly resizes: Array<{ columns: number; rows: number }> = [];
  readonly closed: Promise<ProcessSessionInspection>;
  readonly #resolveClosed: (inspection: ProcessSessionInspection) => void;
  readonly #backendId: string;
  readonly #id: string;
  #status: ProcessSessionStatus = "running";
  #columns: number;
  #rows: number;

  constructor(id: string, backendId: string, options: TerminalBackendSpawnOptions) {
    this.#id = id;
    this.#backendId = backendId;
    this.command = {
      command: options.command,
      args: options.args ? [...options.args] : undefined,
      cwd: options.cwd,
      env: options.env ? { ...options.env } : undefined,
    };
    this.output = options.output ?? new TerminalOutputController();
    this.#columns = options.columns ?? 80;
    this.#rows = options.rows ?? 24;
    let resolveClosed!: (inspection: ProcessSessionInspection) => void;
    this.closed = new Promise((resolve) => {
      resolveClosed = resolve;
    });
    this.#resolveClosed = resolveClosed;
  }

  get id(): string {
    return this.#id;
  }

  get backendId(): string {
    return this.#backendId;
  }

  write(data: string | Uint8Array): Promise<boolean> {
    this.writes.push(typeof data === "string" ? data : new TextDecoder().decode(data));
    return Promise.resolve(true);
  }

  resize(columns: number, rows: number): Promise<boolean> {
    this.#columns = columns;
    this.#rows = rows;
    this.resizes.push({ columns, rows });
    return Promise.resolve(true);
  }

  kill(): Promise<boolean> {
    this.#status = "cancelled";
    this.finish(130);
    return Promise.resolve(true);
  }

  inspect(): TerminalSessionHandleInspection {
    return {
      id: this.id,
      backendId: this.backendId,
      pty: true,
      commandLine: this.command.command,
      status: this.#status,
      running: this.#status === "running",
      columns: this.#columns,
      rows: this.#rows,
      resizeSupported: true,
    };
  }

  dispose(): Promise<void> {
    if (this.#status === "running") this.finish(0);
    return Promise.resolve();
  }

  finish(code: number): void {
    if (this.#status === "running") this.#status = code === 0 ? "exited" : "failed";
    this.#resolveClosed({
      command: this.command,
      commandLine: this.command.command,
      status: this.#status,
      running: false,
      exit: { code, success: code === 0, durationMs: 0 },
      output: this.output.inspect(),
    });
  }
}
