import { assertEquals } from "./deps.ts";
import {
  DiagnosticsCollector,
  type ProcessSessionCommand,
  type ProcessSessionInspection,
  type ProcessSessionStatus,
  routeTerminalKeyPress,
  type TerminalBackend,
  type TerminalBackendAttachOptions,
  type TerminalBackendSpawnOptions,
  type TerminalDetachedSession,
  TerminalOutputController,
  type TerminalSessionHandle,
  TerminalShellController,
} from "../mod.ts";
import type { KeyPressEvent } from "../src/input_reader/types.ts";

Deno.test("TerminalShellController streams raw backend data into a screen", async () => {
  const backend = new FakeShellBackend();
  const shell = new TerminalShellController({
    backend,
    shell: "bash",
    args: ["-l"],
    columns: 20,
    rows: 4,
  });

  assertEquals(await shell.start(), true);
  backend.emit("demo$ ");

  assertEquals(shell.screen.textRows()[0], "demo$");
  assertEquals(shell.inspect().scrollback.visibleRows, ["demo$", "", "", ""]);
  assertEquals(shell.inspect().pty, true);
  assertEquals(shell.inspect().backendId, "fake-pty");
  assertEquals(backend.spawned[0]?.command, "bash");
  assertEquals(backend.spawned[0]?.args, ["-l"]);

  await shell.dispose();
});

Deno.test("TerminalShellController awaits async-capable backend spawning", async () => {
  const backend = new AsyncSpawnShellBackend();
  const shell = new TerminalShellController({ backend, shell: "bash" });

  assertEquals(await shell.start(), true);
  assertEquals(backend.asyncSpawnCalls, 1);
  assertEquals(backend.spawned[0]?.command, "bash");
  assertEquals(shell.inspect().status, "running");

  await shell.dispose();
});

Deno.test("TerminalShellController attaches raw output and disposes by detaching without killing", async () => {
  const backend = new FakeRetainingShellBackend();
  const shell = new TerminalShellController({
    backend,
    attachSessionId: "retained-7",
    columns: 24,
    rows: 5,
  });

  assertEquals(shell.inspect().detached, true);
  assertEquals(await shell.start(), true);
  assertEquals(backend.attached.map((entry) => entry.sessionId), ["retained-7"]);
  assertEquals(backend.attached[0]?.options.columns, 24);
  assertEquals(backend.attached[0]?.options.rows, 5);
  assertEquals(Object.keys(backend.attached[0]!.options).sort(), ["columns", "onData", "output", "rows"]);

  backend.emitAttached("\x1b]0;retained shell\x07ready$ ");
  assertEquals(shell.screen.textRows()[0], "ready$");
  assertEquals(shell.inspect().title, "retained shell");
  assertEquals(shell.inspect().sessionId, "retained-7");
  assertEquals(shell.inspect().detached, undefined);
  assertEquals(shell.inspect().reconnectable, true);

  const handle = backend.handle!;
  await shell.dispose();
  assertEquals(backend.detached.map((entry) => entry.id), ["retained-7"]);
  assertEquals(handle.killCalls, 0);
  assertEquals(handle.disposeCalls, 0);
});

Deno.test("TerminalShellController detaches, reattaches, and terminates through distinct operations", async () => {
  const backend = new FakeRetainingShellBackend();
  const shell = new TerminalShellController({ backend, attachSessionId: "retained-9" });

  assertEquals(await shell.start(), true);
  const first = backend.handle!;
  assertEquals(await shell.detach(), true);
  assertEquals(shell.inspect().status, "idle");
  assertEquals(shell.inspect().detached, true);
  assertEquals(first.killCalls, 0);
  assertEquals(first.disposeCalls, 0);

  assertEquals(await shell.attach(), true);
  assertEquals(backend.attached.length, 2);
  const second = backend.handle!;
  assertEquals(await shell.terminate("SIGTERM"), true);
  assertEquals(second.killCalls, 1);
  assertEquals(backend.detached.length, 1);

  await shell.dispose();
  assertEquals(backend.detached.length, 1);
});

Deno.test("TerminalShellController exposes copy-mode scrollback inspection", async () => {
  const backend = new FakeShellBackend();
  const shell = new TerminalShellController({
    backend,
    columns: 12,
    rows: 3,
    scrollbackLimit: 5,
  });

  await shell.start();
  backend.emit("one\ntwo\nthree\nfour\nfive");

  assertEquals(shell.inspect().scrollback.visibleRows, ["three", "four", "five"]);
  shell.scrollback.scrollLines(-1);
  assertEquals(shell.inspect().scrollback.mode, "copy");
  assertEquals(shell.inspect().scrollback.visibleRows, ["two", "three", "four"]);

  shell.resize(12, 2);
  assertEquals(shell.inspect().scrollback.viewportRows, 2);
  assertEquals(shell.inspect().scrollback.visibleRows, ["two", "three"]);

  await shell.dispose();
});

Deno.test("TerminalShellController exposes OSC terminal titles", async () => {
  const backend = new FakeShellBackend();
  const shell = new TerminalShellController({ backend, columns: 20, rows: 4 });

  await shell.start();
  backend.emit("\x1b]0;project shell\x07$ ");

  assertEquals(shell.inspect().title, "project shell");
  assertEquals(shell.inspect().screen.title, "project shell");

  await shell.dispose();
});

Deno.test("TerminalShellController routes writes and resize to the active backend handle", async () => {
  const backend = new FakeShellBackend();
  const shell = new TerminalShellController({ backend, columns: 10, rows: 3 });

  await shell.start();
  assertEquals(await shell.write("pwd\r"), true);
  assertEquals(backend.handle?.writes, ["pwd\r"]);

  shell.resize(30.9, 8.2);
  assertEquals(shell.inspect().columns, 30);
  assertEquals(shell.inspect().rows, 8);
  assertEquals(backend.handle?.resizes.at(-1), { columns: 30, rows: 8 });

  backend.finish(0);
  await backend.handle?.closed;
  assertEquals(shell.inspect().status, "exited");
  await shell.dispose();
});

Deno.test("TerminalShellController reports startup diagnostics", async () => {
  const diagnostics = new DiagnosticsCollector();
  const shell = new TerminalShellController({
    diagnostics,
    backendFactory: () => {
      throw new Error("pty unavailable");
    },
    shell: "bash",
  });

  assertEquals(await shell.start(), false);
  assertEquals(shell.inspect().status, "failed");
  assertEquals(shell.inspect().error, "pty unavailable");
  assertEquals(diagnostics.entries().map((entry) => [entry.source, entry.code, entry.severity, entry.detail]), [
    ["terminal-shell", "shell-start-failed", "error", "pty unavailable"],
  ]);

  await shell.dispose();
});

Deno.test("terminal input routing can target shell-style write handles and pass Ctrl+C", async () => {
  const backend = new FakeShellBackend();
  const shell = new TerminalShellController({ backend });

  await shell.start();
  assertEquals(
    (await routeTerminalKeyPress(shell, keyPress("c", { ctrl: true }), {
      mode: "raw",
      reservedCtrlKeys: [],
    })).reason,
    "encoded",
  );
  assertEquals(backend.handle?.writes.map((value) => [...new TextEncoder().encode(value)]), [[3]]);
  await shell.dispose();
});

Deno.test("TerminalShellController smoke runs commands and a full-screen PTY transcript", async () => {
  const backend = new FakeShellBackend();
  const shell = new TerminalShellController({
    backend,
    shell: "bash",
    args: ["--noprofile", "--norc"],
    columns: 24,
    rows: 5,
    scrollbackLimit: 4,
  });

  try {
    assertEquals(await shell.start(), true);
    assertEquals(shell.inspect().pty, true);

    assertEquals(await shell.write("printf ready\\n\r"), true);
    backend.emit("$ printf ready\\n\r\nready\r\n$ ");
    assertEquals(backend.handle?.writes, ["printf ready\\n\r"]);
    assertEquals(shell.screen.textRows()[1], "ready");

    assertEquals(await shell.write("top\r"), true);
    backend.emit("\x1b[?1049h\x1b[?25l\x1b]2;process viewer\x07");
    backend.emit("\x1b[1;1H\x1b[1;37;44m PID  CPU  COMMAND      \x1b[0m");
    backend.emit("\x1b[2;5r");
    backend.emit("\x1b[2;1H 100  12%  deno");
    backend.emit("\x1b[3;1H 101   8%  bash");
    backend.emit("\x1b[4;1H 102   4%  vim");
    backend.emit("\x1b[5;1Hstatus: ok");

    assertEquals(shell.inspect().screen.alternate, true);
    assertEquals(shell.inspect().title, "process viewer");
    assertEquals(shell.screen.textRows(), [
      " PID  CPU  COMMAND",
      " 100  12%  deno",
      " 101   8%  bash",
      " 102   4%  vim",
      "status: ok",
    ]);

    backend.emit("\x1b[?25h\x1b[?1049l$ ");
    assertEquals(shell.inspect().screen.alternate, false);
    assertEquals(shell.screen.textRows()[1], "ready");
  } finally {
    await shell.dispose();
  }
});

class FakeShellBackend implements TerminalBackend {
  readonly id = "fake-pty";
  readonly label = "Fake PTY";
  readonly pty = true;
  readonly spawned: TerminalBackendSpawnOptions[] = [];
  handle?: FakeShellHandle;

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
    this.handle = new FakeShellHandle(this.id, options);
    return this.handle;
  }

  emit(data: string): void {
    this.spawned.at(-1)?.onData?.(data, "stdout");
  }

  finish(code: number): void {
    this.handle?.finish(code);
  }
}

class AsyncSpawnShellBackend extends FakeShellBackend {
  asyncSpawnCalls = 0;

  spawnAsync(options: TerminalBackendSpawnOptions): Promise<TerminalSessionHandle> {
    this.asyncSpawnCalls += 1;
    return Promise.resolve(super.spawn(options));
  }

  override spawn(_options: TerminalBackendSpawnOptions): TerminalSessionHandle {
    throw new Error("legacy spawn must not be used when spawnAsync is available");
  }
}

class FakeRetainingShellBackend implements TerminalBackend {
  readonly id = "fake-retaining-pty";
  readonly label = "Fake Retaining PTY";
  readonly pty = true;
  readonly detachable = true;
  readonly reconnectable = true;
  readonly attached: Array<{ sessionId: string; options: TerminalBackendAttachOptions }> = [];
  readonly detached: TerminalDetachedSession[] = [];
  handle?: FakeShellHandle;

  spawn(options: TerminalBackendSpawnOptions): TerminalSessionHandle {
    this.handle = new FakeShellHandle(this.id, options);
    return this.handle;
  }

  attach(sessionId: string, options: TerminalBackendAttachOptions = {}): Promise<TerminalSessionHandle> {
    this.attached.push({ sessionId, options: { ...options } });
    this.handle = new FakeShellHandle(this.id, {
      command: "bash",
      columns: options.columns,
      rows: options.rows,
      output: options.output,
      onData: options.onData,
    }, sessionId);
    return Promise.resolve(this.handle);
  }

  detach(session: TerminalSessionHandle): Promise<TerminalDetachedSession | undefined> {
    const inspection = session.inspect();
    const detached: TerminalDetachedSession = {
      id: session.id,
      backendId: this.id,
      commandLine: inspection.commandLine,
      columns: inspection.columns,
      rows: inspection.rows,
    };
    this.detached.push(detached);
    return Promise.resolve(detached);
  }

  emitAttached(data: string): void {
    this.attached.at(-1)?.options.onData?.(data, "stdout");
  }
}

class FakeShellHandle implements TerminalSessionHandle {
  readonly id: string;
  readonly command: ProcessSessionCommand;
  readonly output: TerminalOutputController;
  readonly writes: string[] = [];
  readonly resizes: Array<{ columns: number; rows: number }> = [];
  killCalls = 0;
  disposeCalls = 0;
  readonly closed: Promise<ProcessSessionInspection>;
  readonly #resolveClosed: (inspection: ProcessSessionInspection) => void;
  readonly #backendId: string;
  #status: ProcessSessionStatus = "running";
  #columns: number;
  #rows: number;

  constructor(backendId: string, options: TerminalBackendSpawnOptions, id = "fake-shell") {
    this.id = id;
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
    this.killCalls += 1;
    this.#status = "cancelled";
    this.finish(130);
    return Promise.resolve(true);
  }

  inspect() {
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
    this.disposeCalls += 1;
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

function keyPress(key: string, options: Partial<KeyPressEvent> = {}): KeyPressEvent {
  return {
    key,
    ctrl: false,
    meta: false,
    shift: false,
    buffer: new Uint8Array(),
    ...options,
  } as KeyPressEvent;
}
