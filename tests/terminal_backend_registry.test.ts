import { assertEquals } from "./deps.ts";
import { TerminalOutputController } from "../src/components/terminal_output.ts";
import {
  createDefaultTerminalBackendRegistry,
  createProcessTerminalBackendProvider,
  createSigmaPtyTerminalBackendFromConstructor,
  createSigmaPtyTerminalBackendProvider,
  type SigmaPtyCommandOptions,
  type SigmaPtyLike,
  type SigmaPtySize,
  type TerminalBackend,
  TerminalBackendRegistry,
  type TerminalBackendSpawnOptions,
  type TerminalSessionHandle,
} from "../src/runtime/mod.ts";
import type { ProcessSessionCommand, ProcessSessionInspection, ProcessSessionStatus } from "../src/runtime/mod.ts";

Deno.test("terminal backend registry resolves the process backend by default", async () => {
  const registry = createDefaultTerminalBackendRegistry({ process: { id: "proc", label: "Proc" } });

  assertEquals(registry.ids(), ["proc"]);
  assertEquals(await registry.inspect(), [
    {
      id: "proc",
      label: "Proc",
      pty: false,
      priority: 0,
      detachable: false,
      reconnectable: false,
      available: true,
      backendId: "proc",
    },
  ]);

  const backend = await registry.resolve();
  assertEquals(backend?.id, "proc");
  assertEquals(backend?.pty, false);
});

Deno.test("terminal backend registry prefers available pty providers when requested", async () => {
  const registry = new TerminalBackendRegistry([
    createProcessTerminalBackendProvider({ id: "process" }),
    {
      id: "pty",
      label: "PTY",
      pty: true,
      priority: 10,
      probe: () => ({ available: true }),
      create: () => new FakeTerminalBackend("pty", true),
    },
  ]);

  assertEquals((await registry.resolve())?.id, "pty");
  assertEquals((await registry.resolve({ preferPty: true }))?.id, "pty");
  assertEquals((await registry.resolve({ id: "process" }))?.id, "process");
});

Deno.test("terminal backend registry skips unavailable providers and can require pty", async () => {
  const registry = new TerminalBackendRegistry([
    {
      id: "broken-pty",
      label: "Broken PTY",
      pty: true,
      priority: 20,
      probe: () => ({ available: false, reason: "missing native library" }),
      create: () => new FakeTerminalBackend("broken-pty", true),
    },
    createProcessTerminalBackendProvider({ id: "process" }),
  ]);

  assertEquals((await registry.resolve({ preferPty: true }))?.id, "process");
  assertEquals(await registry.resolve({ requirePty: true }), undefined);
  assertEquals((await registry.inspect()).map((entry) => [entry.id, entry.available]), [
    ["broken-pty", false],
    ["process", true],
  ]);
});

Deno.test("sigma pty backend provider stays lazy and supports injected modules", async () => {
  FakePty.instances = [];
  let instantiated = 0;
  const provider = createSigmaPtyTerminalBackendProvider({
    id: "ffi",
    label: "FFI",
    loader: () => ({
      Pty: FakePty,
      instantiate: () => {
        instantiated += 1;
        return Promise.resolve();
      },
    }),
  });
  const registry = new TerminalBackendRegistry([provider]);

  assertEquals(instantiated, 0);
  assertEquals(await registry.inspect(), [
    {
      id: "ffi",
      label: "FFI",
      pty: true,
      priority: 100,
      detachable: false,
      reconnectable: false,
      available: true,
      backendId: "ffi",
    },
  ]);
  assertEquals(instantiated, 1);

  const backend = await registry.resolve({ requirePty: true });
  assertEquals(backend?.id, "ffi");
  assertEquals(instantiated, 1);
});

Deno.test("sigma pty terminal backend wraps output write resize and close lifecycle", async () => {
  FakePty.instances = [];
  const backend = createSigmaPtyTerminalBackendFromConstructor(FakePty, {
    id: "pty",
    label: "PTY",
    pollingIntervalMs: 5,
    now: fakeClock([10, 11, 12, 20]),
  });
  const rawChunks: string[] = [];
  const handle = backend.spawn({
    command: "bash",
    args: ["-lc", "echo hi"],
    columns: 100.8,
    rows: 30.2,
    onData: (data) => rawChunks.push(String(data)),
  });
  const pty = FakePty.instances[0]!;

  assertEquals(handle.inspect(), {
    id: handle.id,
    backendId: "pty",
    commandLine: 'bash -lc "echo hi"',
    status: "running",
    running: true,
    columns: 100,
    rows: 30,
    resizeSupported: true,
  });
  assertEquals(pty.pollingIntervalMs, 5);
  assertEquals(pty.resizes, [{ cols: 100, rows: 30 }]);

  assertEquals(await handle.write("pwd\n"), true);
  assertEquals(await handle.write(new TextEncoder().encode("ls\n")), true);
  assertEquals(pty.writes, ["pwd\n", "ls\n"]);

  assertEquals(await handle.resize(120.9, 40.1), true);
  assertEquals(pty.resizes.at(-1), { cols: 120, rows: 40 });
  pty.emit("hello\r\nworld\n");
  pty.finish(0);

  const closed = await handle.closed;
  assertEquals(closed.status, "exited");
  assertEquals(closed.exit?.code, 0);
  assertEquals(handle.output.inspect().lines.map((line) => [line.source, line.text]), [
    ["system", '$ bash -lc "echo hi"'],
    ["stdout", "hello"],
    ["stdout", "world"],
    ["system", "process exited code=0 duration=10ms"],
  ]);
  assertEquals(rawChunks, ["hello\r\nworld\n"]);

  await handle.dispose();
  assertEquals(pty.closed, true);
});

class FakeTerminalBackend implements TerminalBackend {
  readonly label: string;
  readonly detachable = false;
  readonly reconnectable = false;

  constructor(readonly id: string, readonly pty: boolean) {
    this.label = id;
  }

  spawn(options: TerminalBackendSpawnOptions): TerminalSessionHandle {
    return new FakeTerminalHandle(this.id, this.pty, options);
  }
}

class FakeTerminalHandle implements TerminalSessionHandle {
  readonly id = "fake";
  readonly command: ProcessSessionCommand;
  readonly output = new TerminalOutputController();
  readonly closed = Promise.resolve({ status: "exited" } as ProcessSessionInspection);

  constructor(readonly backendId: string, readonly pty: boolean, command: ProcessSessionCommand) {
    this.command = command;
  }

  write(): Promise<boolean> {
    return Promise.resolve(true);
  }

  resize(): Promise<boolean> {
    return Promise.resolve(this.pty);
  }

  kill(): Promise<boolean> {
    return Promise.resolve(true);
  }

  inspect() {
    const status: ProcessSessionStatus = "running";
    return {
      id: this.id,
      backendId: this.backendId,
      commandLine: this.command.command,
      status,
      running: true,
      columns: 80,
      rows: 24,
      resizeSupported: this.pty,
    };
  }

  dispose(): Promise<void> {
    this.output.dispose();
    return Promise.resolve();
  }
}

class FakePty implements SigmaPtyLike {
  static instances: FakePty[] = [];
  readonly writes: string[] = [];
  readonly resizes: SigmaPtySize[] = [];
  readonly readable: ReadableStream<string>;
  exitCode?: number;
  pollingIntervalMs?: number;
  closed = false;
  #controller!: ReadableStreamDefaultController<string>;

  constructor(readonly command: string, readonly options: SigmaPtyCommandOptions = {}) {
    FakePty.instances.push(this);
    this.readable = new ReadableStream<string>({
      start: (controller) => {
        this.#controller = controller;
      },
    });
  }

  write(data: string): void {
    this.writes.push(data);
  }

  resize(size: SigmaPtySize): void {
    this.resizes.push({ ...size });
  }

  close(): void {
    this.closed = true;
  }

  setPollingInterval(ms: number): void {
    this.pollingIntervalMs = ms;
  }

  emit(text: string): void {
    this.#controller.enqueue(text);
  }

  finish(code: number): void {
    this.exitCode = code;
    this.#controller.close();
  }
}

function fakeClock(values: number[]): () => number {
  let index = 0;
  return () => values[Math.min(index++, values.length - 1)]!;
}
