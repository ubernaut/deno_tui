import { assertEquals } from "./deps.ts";
import {
  type ProcessSessionCommand,
  type ProcessSessionInspection,
  type ProcessSessionStatus,
  TerminalOutputController,
} from "../mod.ts";
import type {
  TerminalBackend,
  TerminalBackendSpawnOptions,
  TerminalSessionHandle,
  TerminalSessionHandleInspection,
} from "../src/runtime/terminal_backend.ts";
import {
  createWorkbenchShellSession,
  resolveWorkbenchShellBackend,
  workbenchTerminalPaneProjectionsInto,
  workbenchTerminalSessionTabsInto,
  type WorkbenchTerminalToolbarAction,
  workbenchTerminalToolbarItemsInto,
} from "../src/app/workbench/mod.ts";

Deno.test("resolveWorkbenchShellBackend prefers an available PTY backend", async () => {
  const ptyBackend = fakeBackend("fake-pty", true);
  const resolution = await resolveWorkbenchShellBackend({
    ptyFactory: () => ptyBackend,
    processFactory: () => fakeBackend("process", false),
  });

  assertEquals(resolution.backend, ptyBackend);
  assertEquals(resolution.fallback, false);
  assertEquals(resolution.reason, undefined);
});

Deno.test("resolveWorkbenchShellBackend falls back to process backend with a reason", async () => {
  const fallbackMessages: string[] = [];
  const processBackend = fakeBackend("process", false);
  const resolution = await resolveWorkbenchShellBackend({
    ptyFactory: () => {
      throw new Error("pty library unavailable");
    },
    processFactory: () => processBackend,
    onFallback: (message) => fallbackMessages.push(message),
  });

  assertEquals(resolution.backend, processBackend);
  assertEquals(resolution.fallback, true);
  assertEquals(resolution.reason, "pty library unavailable");
  assertEquals(fallbackMessages, ["pty library unavailable"]);
});

Deno.test("createWorkbenchShellSession runs command and fullscreen PTY smoke through workbench boundary", async () => {
  const ptyBackend = new FakeWorkbenchShellBackend();
  const session = await createWorkbenchShellSession({
    resolver: {
      ptyFactory: () => ptyBackend,
      processFactory: () => fakeBackend("process", false),
    },
    shell: "bash",
    args: ["--noprofile", "--norc"],
    columns: 24,
    rows: 5,
    scrollbackLimit: 4,
  });

  try {
    assertEquals(session.resolution.fallback, false);
    assertEquals(await session.shell.start(), true);
    assertEquals(session.shell.inspect().backendId, "fake-workbench-pty");

    assertEquals(await session.shell.write("printf ready\\n\r"), true);
    ptyBackend.emit("$ printf ready\\n\r\nready\r\n$ ");
    assertEquals(ptyBackend.handle?.writes, ["printf ready\\n\r"]);
    assertEquals(session.shell.screen.textRows()[1], "ready");

    ptyBackend.emit("\x1b[?1049h\x1b[?25l\x1b]2;workbench fullscreen\x07");
    ptyBackend.emit("\x1b[1;1H\x1b[1;37;44m PID  CPU  COMMAND      \x1b[0m");
    ptyBackend.emit("\x1b[2;5r\x1b[2;1H 100  12%  deno\x1b[3;1H 101   8%  bash\x1b[4;1Hstatus: ok");

    assertEquals(session.shell.inspect().screen.alternate, true);
    assertEquals(session.shell.inspect().title, "workbench fullscreen");
    assertEquals(session.shell.screen.textRows().slice(0, 4), [
      " PID  CPU  COMMAND",
      " 100  12%  deno",
      " 101   8%  bash",
      "status: ok",
    ]);
  } finally {
    await session.shell.dispose();
  }
});

Deno.test("workbenchTerminalSessionTabsInto projects clipped selectable tabs", () => {
  const tabs = workbenchTerminalSessionTabsInto(
    [],
    [
      { id: "shell-1", title: "Shell One", running: true },
      { id: "shell-2", title: "Very Long Session Name", status: "idle" },
      { id: "shell-3", title: "Hidden", status: "failed" },
    ],
    "shell-2",
    { column: 4, row: 2, width: 28, height: 1 },
    { maxWidth: 16 },
  );

  assertEquals(tabs.map((tab) => [tab.id, tab.column, tab.row, tab.active]), [
    ["shell-1", 4, 2, false],
    ["shell-2", 20, 2, true],
  ]);
  assertEquals(tabs[0]?.label, "[ * Shell One ]");
  assertEquals(tabs[1]?.label.startsWith("[ I Very"), true);
  assertEquals(tabs.every((tab) => tab.column + tab.width <= 32), true);
});

Deno.test("workbenchTerminalPaneProjectionsInto projects title rows and content rectangles", () => {
  const panes = workbenchTerminalPaneProjectionsInto(
    [],
    {
      root: {
        kind: "pane",
        id: "pane-1",
        sessionId: "shell-1",
        title: "One",
        minColumns: 10,
        minRows: 4,
      },
      activePaneId: "pane-1",
    },
    { column: 2, row: 3, width: 40, height: 8 },
  );

  assertEquals(panes.length, 1);
  assertEquals(panes[0]?.paneId, "pane-1");
  assertEquals(panes[0]?.sessionId, "shell-1");
  assertEquals(panes[0]?.active, true);
  assertEquals(panes[0]?.titleVisible, true);
  assertEquals(panes[0]?.title, "> One");
  assertEquals(panes[0]?.rect, { column: 2, row: 3, width: 40, height: 8 });
  assertEquals(panes[0]?.contentRect, { column: 2, row: 4, width: 40, height: 7 });
});

Deno.test("workbenchTerminalPaneProjectionsInto supports fallback panes and caller-owned reuse", () => {
  const target = workbenchTerminalPaneProjectionsInto(
    [],
    {},
    { column: 0, row: 1, width: 20, height: 3 },
    { fallbackSessionId: "shell-a" },
  );
  const first = target[0];

  assertEquals(target.length, 1);
  assertEquals(first?.paneId, undefined);
  assertEquals(first?.sessionId, "shell-a");
  assertEquals(first?.titleVisible, false);
  assertEquals(first?.contentRect, { column: 0, row: 1, width: 20, height: 3 });

  workbenchTerminalPaneProjectionsInto(
    target,
    {},
    { column: 1, row: 2, width: 10, height: 2 },
    { fallbackSessionId: "shell-b" },
  );

  assertEquals(target.length, 1);
  assertEquals(target[0] === first, true);
  assertEquals(target[0]?.sessionId, "shell-b");
  assertEquals(target[0]?.contentRect, { column: 1, row: 2, width: 10, height: 2 });
});

Deno.test("workbenchTerminalToolbarItemsInto projects console shell button state", () => {
  const items = workbenchTerminalToolbarItemsInto([], {
    activeId: "shell-1",
    sessionCount: 2,
    paneCount: 2,
    zoomedPaneId: "pane-1",
    shellRunning: true,
    inputMode: "raw",
    copyMode: true,
    scrollbackTotalRows: 100,
    scrollbackViewportRows: 20,
    searchQuery: "deno",
    searchMatchCount: 3,
  });

  assertEquals(items.find((item) => item.action === "previous")?.disabled, false);
  assertEquals(items.find((item) => item.action === "close")?.disabled, false);
  assertEquals(items.find((item) => item.action === "zoomPane")?.active, true);
  assertEquals(items.find((item) => item.action === "closePane")?.disabled, false);
  assertEquals(items.find((item) => item.action === "start")?.disabled, true);
  assertEquals(items.find((item) => item.action === "stop")?.disabled, false);
  assertEquals(items.find((item) => item.action === "raw")?.active, true);
  assertEquals(items.find((item) => item.action === "copy")?.active, true);
  assertEquals(items.find((item) => item.action === "search")?.active, true);
  assertEquals(items.find((item) => item.action === "previousMatch")?.disabled, false);
  assertEquals(items.find((item) => item.action === "top")?.disabled, false);
});

Deno.test("workbenchTerminalToolbarItemsInto supports browser-safe action subsets", () => {
  const webActions: WorkbenchTerminalToolbarAction[] = [
    "new",
    "previous",
    "next",
    "close",
    "splitRow",
    "splitColumn",
    "zoomPane",
    "closePane",
    "restart",
    "search",
    "previousMatch",
    "nextMatch",
  ];
  const items = workbenchTerminalToolbarItemsInto([], {
    sessionCount: 1,
    paneCount: 1,
    scrollbackTotalRows: 0,
    searchMatchCount: 0,
  }, { actions: webActions });

  assertEquals(items.map((item) => item.action), webActions);
  assertEquals(items.find((item) => item.action === "previous")?.disabled, true);
  assertEquals(items.find((item) => item.action === "close")?.disabled, true);
  assertEquals(items.find((item) => item.action === "restart")?.disabled, true);
  assertEquals(items.find((item) => item.action === "search")?.disabled, true);
  assertEquals(items.find((item) => item.action === "nextMatch")?.disabled, true);
  assertEquals(items.some((item) => item.action === "start"), false);
});

Deno.test("workbenchTerminalToolbarItemsInto reuses caller-owned button items", () => {
  const target = workbenchTerminalToolbarItemsInto([], { activeId: "shell-1", sessionCount: 1 });
  const first = target[0];
  const second = target[1];

  workbenchTerminalToolbarItemsInto(target, { activeId: "shell-1", sessionCount: 2, shellRunning: true });

  assertEquals(target[0] === first, true);
  assertEquals(target[1] === second, true);
  assertEquals(target[1]?.disabled, false);
});

function fakeBackend(id: string, pty: boolean): TerminalBackend {
  return {
    id,
    label: id,
    pty,
    spawn(_options: TerminalBackendSpawnOptions): TerminalSessionHandle {
      throw new Error("not used");
    },
  };
}

class FakeWorkbenchShellBackend implements TerminalBackend {
  readonly id = "fake-workbench-pty";
  readonly label = "Fake Workbench PTY";
  readonly pty = true;
  handle?: FakeWorkbenchShellHandle;

  spawn(options: TerminalBackendSpawnOptions): TerminalSessionHandle {
    this.handle = new FakeWorkbenchShellHandle(this.id, options);
    return this.handle;
  }

  emit(data: string): void {
    this.handle?.emit(data);
  }
}

class FakeWorkbenchShellHandle implements TerminalSessionHandle {
  readonly id = "fake-workbench-shell";
  readonly command: ProcessSessionCommand;
  readonly output: TerminalOutputController;
  readonly writes: string[] = [];
  readonly closed: Promise<ProcessSessionInspection>;
  readonly #resolveClosed: (inspection: ProcessSessionInspection) => void;
  readonly #backendId: string;
  readonly #onData?: (data: string, stream: "stdout" | "stderr") => void;
  #status: ProcessSessionStatus = "running";
  #columns: number;
  #rows: number;

  constructor(backendId: string, options: TerminalBackendSpawnOptions) {
    this.#backendId = backendId;
    this.command = {
      command: options.command,
      args: options.args ? [...options.args] : undefined,
      cwd: options.cwd,
      env: options.env ? { ...options.env } : undefined,
    };
    this.output = options.output ?? new TerminalOutputController();
    this.#onData = options.onData;
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

  get pty(): boolean {
    return true;
  }

  get resizeSupported(): boolean {
    return true;
  }

  get status(): ProcessSessionStatus {
    return this.#status;
  }

  get columns(): number {
    return this.#columns;
  }

  get rows(): number {
    return this.#rows;
  }

  write(input: string | Uint8Array): Promise<boolean> {
    this.writes.push(typeof input === "string" ? input : new TextDecoder().decode(input));
    return Promise.resolve(true);
  }

  resize(columns: number, rows: number): Promise<boolean> {
    this.#columns = Math.floor(columns);
    this.#rows = Math.floor(rows);
    return Promise.resolve(true);
  }

  kill(_signal?: Deno.Signal): Promise<boolean> {
    this.#status = "cancelled";
    this.#resolveClosed(this.processInspection());
    return Promise.resolve(true);
  }

  inspect(): TerminalSessionHandleInspection {
    return {
      id: this.id,
      backendId: this.#backendId,
      pty: true,
      commandLine: this.commandLine(),
      status: this.#status,
      running: this.#status === "running",
      columns: this.#columns,
      rows: this.#rows,
      resizeSupported: true,
    };
  }

  dispose(): Promise<void> {
    if (this.#status === "running") {
      this.#status = "cancelled";
      this.#resolveClosed(this.processInspection());
    }
    return Promise.resolve();
  }

  processInspection(): ProcessSessionInspection {
    return {
      command: this.command,
      commandLine: this.commandLine(),
      status: this.#status,
      running: this.#status === "running",
      output: this.output.inspect(),
    };
  }

  emit(data: string): void {
    this.output.appendText("stdout", data, 0);
    this.#onData?.(data, "stdout");
  }

  commandLine(): string {
    return [this.command.command, ...(this.command.args ?? [])].join(" ");
  }
}
