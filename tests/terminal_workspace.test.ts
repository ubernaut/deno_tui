import { assertEquals } from "./deps.ts";
import { TerminalOutputController } from "../src/components/terminal_output.ts";
import { WindowManagerController } from "../src/layout/window_manager.ts";
import { syncTerminalWindowLayout, terminalWindowContentSize } from "../src/app/terminal_window_bindings.ts";
import type {
  TerminalBackend,
  TerminalBackendSpawnOptions,
  TerminalSessionHandle,
} from "../src/runtime/terminal_backend.ts";
import {
  attachTerminalTemplate,
  commandTerminalTemplate,
  createTerminalTemplateSession,
  denoTaskTerminalTemplate,
  describeAttachTerminalTemplate,
  projectTaskTerminalTemplate,
  shellTerminalTemplate,
  terminalTemplateToSpawnOptions,
} from "../src/runtime/terminal_templates.ts";
import type { ProcessSessionCommand, ProcessSessionInspection, ProcessSessionStatus } from "../src/runtime/mod.ts";

Deno.test("terminal templates normalize shell command deno task and project task metadata", () => {
  const shell = shellTerminalTemplate({
    shell: "bash",
    args: ["-l"],
    cwd: "/tmp/project",
    columns: 120.8,
    rows: 32.2,
    scrollbackLimit: 500.9,
  });
  assertEquals(shell, {
    id: "shell",
    title: "Shell",
    kind: "shell",
    command: "bash",
    args: ["-l"],
    cwd: "/tmp/project",
    env: undefined,
    columns: 120,
    rows: 32,
    scrollbackLimit: 500,
    reconnectable: undefined,
    restartPolicy: "never",
    metadata: undefined,
  });
  assertEquals(terminalTemplateToSpawnOptions(shell, { rows: 40 }), {
    command: "bash",
    args: ["-l"],
    cwd: "/tmp/project",
    env: undefined,
    columns: 120,
    rows: 40,
  });

  const denoTask = denoTaskTerminalTemplate({ task: "health", taskArgs: ["--quiet"], denoExecutable: "deno-dev" });
  assertEquals(denoTask.id, "deno-task-health");
  assertEquals(denoTask.title, "deno task health");
  assertEquals(denoTask.args, ["task", "health", "--quiet"]);
  assertEquals(denoTask.metadata, { task: "health" });

  const project = projectTaskTerminalTemplate({
    command: "npm",
    args: ["run", "dev"],
    title: "Web Dev",
    metadata: { package: "web" },
  });
  assertEquals(project.kind, "project-task");
  assertEquals(project.metadata, { projectTask: "Web Dev", package: "web" });
});

Deno.test("terminal template sessions describe backend handle state", () => {
  const backend = new FakeTerminalBackend();
  const template = commandTerminalTemplate({
    id: "logs",
    title: "Logs",
    command: "deno",
    args: ["task", "health"],
    columns: 100,
    rows: 30,
    reconnectable: true,
    restartPolicy: "on-failure",
  });
  const session = createTerminalTemplateSession(backend, template, { rows: 24, title: "Health" });
  const descriptor = session.inspect(123);

  assertEquals(backend.spawned[0], {
    command: "deno",
    args: ["task", "health"],
    cwd: undefined,
    env: undefined,
    columns: 100,
    rows: 24,
  });
  assertEquals(descriptor.title, "Health");
  assertEquals(descriptor.backendId, "fake");
  assertEquals(descriptor.commandLine, "deno task health");
  assertEquals(descriptor.status, "running");
  assertEquals(descriptor.running, true);
  assertEquals(descriptor.columns, 100);
  assertEquals(descriptor.rows, 24);
  assertEquals(descriptor.reconnectable, true);
  assertEquals(descriptor.restartPolicy, "on-failure");
  assertEquals(descriptor.updatedAt, 123);
});

Deno.test("attach terminal templates produce reconnectable descriptors", () => {
  const template = attachTerminalTemplate("session-7", { title: "Server Attach", metadata: { host: "local" } });
  assertEquals(template, {
    id: "attach-session-7",
    title: "Server Attach",
    kind: "attach",
    sessionId: "session-7",
    reconnectable: true,
    metadata: { host: "local" },
  });
  assertEquals(describeAttachTerminalTemplate(template, 50), {
    id: "attach-session-7",
    title: "Server Attach",
    template,
    reconnectable: true,
    restartPolicy: "never",
    createdAt: 50,
    updatedAt: 50,
  });
});

Deno.test("syncTerminalWindowLayout resizes visible terminal handles only when geometry changes", async () => {
  const manager = new WindowManagerController({
    activeId: "terminal",
    windows: [
      { id: "terminal", title: "Terminal", minWidth: 20, minHeight: 8 },
      { id: "logs", title: "Logs", minWidth: 20, minHeight: 8, state: "minimized" },
    ],
  });
  const terminal = new FakeTerminalHandle({ columns: 80, rows: 24, resizeSupported: true });
  const logs = new FakeTerminalHandle({ columns: 60, rows: 12, resizeSupported: false });
  const layout = manager.layout({ bounds: { column: 0, row: 0, width: 100, height: 30 } });
  const terminalWindow = layout.visible.find((entry) => entry.id === "terminal")!;

  assertEquals(terminalWindowContentSize(terminalWindow), { columns: 98, rows: 28 });
  assertEquals(
    await syncTerminalWindowLayout(layout, [
      { windowId: "terminal", session: terminal },
      { windowId: "logs", session: logs },
    ]),
    [
      {
        windowId: "terminal",
        visible: true,
        changed: true,
        resized: true,
        resizeSupported: true,
        columns: 98,
        rows: 28,
      },
      {
        windowId: "logs",
        visible: false,
        changed: false,
        resized: false,
        resizeSupported: false,
        columns: 60,
        rows: 12,
      },
    ],
  );
  assertEquals(await syncTerminalWindowLayout(layout, [{ windowId: "terminal", session: terminal }]), [
    {
      windowId: "terminal",
      visible: true,
      changed: false,
      resized: false,
      resizeSupported: true,
      columns: 98,
      rows: 28,
    },
  ]);
});

class FakeTerminalBackend implements TerminalBackend {
  readonly id = "fake";
  readonly label = "Fake";
  readonly pty = true;
  readonly spawned: TerminalBackendSpawnOptions[] = [];

  spawn(options: TerminalBackendSpawnOptions): TerminalSessionHandle {
    this.spawned.push({
      command: options.command,
      args: options.args ? [...options.args] : undefined,
      cwd: options.cwd,
      env: options.env ? { ...options.env } : undefined,
      columns: options.columns,
      rows: options.rows,
    });
    return new FakeTerminalHandle({
      command: options.command,
      args: options.args,
      columns: options.columns ?? 80,
      rows: options.rows ?? 24,
      resizeSupported: true,
    });
  }
}

class FakeTerminalHandle implements TerminalSessionHandle {
  readonly id = "fake-handle";
  readonly backendId = "fake";
  readonly command: ProcessSessionCommand;
  readonly output = new TerminalOutputController();
  readonly closed = Promise.resolve({ status: "exited" } as ProcessSessionInspection);
  readonly #resizeSupported: boolean;
  #columns: number;
  #rows: number;

  constructor(options: {
    command?: string;
    args?: readonly string[];
    columns: number;
    rows: number;
    resizeSupported: boolean;
  }) {
    this.command = {
      command: options.command ?? "demo",
      args: options.args ? [...options.args] : undefined,
    };
    this.#columns = options.columns;
    this.#rows = options.rows;
    this.#resizeSupported = options.resizeSupported;
  }

  write(): Promise<boolean> {
    return Promise.resolve(true);
  }

  resize(columns: number, rows: number): Promise<boolean> {
    this.#columns = columns;
    this.#rows = rows;
    return Promise.resolve(this.#resizeSupported);
  }

  kill(): Promise<boolean> {
    return Promise.resolve(true);
  }

  inspect() {
    const status: ProcessSessionStatus = "running";
    return {
      id: this.id,
      backendId: this.backendId,
      commandLine: [this.command.command, ...(this.command.args ?? [])].join(" "),
      status,
      running: true,
      columns: this.#columns,
      rows: this.#rows,
      resizeSupported: this.#resizeSupported,
    };
  }

  dispose(): Promise<void> {
    this.output.dispose();
    return Promise.resolve();
  }
}
