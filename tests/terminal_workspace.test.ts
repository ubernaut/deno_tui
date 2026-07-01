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
import { createTerminalWorkspaceController, terminalWorkspacePaneRects } from "../src/runtime/terminal_workspace.ts";
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

Deno.test("terminal workspace controller manages session tabs", () => {
  let now = 100;
  const workspace = createTerminalWorkspaceController({ now: () => now });
  const shell = workspace.add(shellTerminalTemplate({ id: "shell-main", shell: "bash", columns: 100, rows: 30 }));
  const logs = workspace.add(commandTerminalTemplate({ id: "logs", title: "Logs", command: "tail", args: ["-f"] }), {
    backendId: "process",
  });
  const attach = workspace.add(attachTerminalTemplate("pty-7", { title: "Detached" }), { activate: true });

  assertEquals(shell.commandLine, "bash");
  assertEquals(logs.backendId, "process");
  assertEquals(attach.reconnectable, true);
  assertEquals(workspace.inspect().activeId, "attach-pty-7");
  assertEquals(workspace.inspect().sessions.map((session) => session.id), ["shell-main", "logs", "attach-pty-7"]);

  now = 150;
  assertEquals(workspace.rename("logs", "Process Logs"), true);
  assertEquals(workspace.inspect().sessions[1]!.title, "Process Logs");
  assertEquals(workspace.inspect().sessions[1]!.updatedAt, 150);
  assertEquals(workspace.move("logs", -1), true);
  assertEquals(workspace.inspect().sessions.map((session) => session.id), ["logs", "shell-main", "attach-pty-7"]);
  assertEquals(workspace.activate("shell-main"), true);
  assertEquals(workspace.remove("shell-main"), true);
  assertEquals(workspace.inspect().activeId, "attach-pty-7");
  assertEquals(workspace.inspect().count, 2);

  workspace.dispose();
});

Deno.test("terminal workspace controller manages split pane layout", () => {
  const workspace = createTerminalWorkspaceController({ now: () => 1 });
  workspace.add(shellTerminalTemplate({ id: "shell-main", shell: "bash" }));
  workspace.add(commandTerminalTemplate({ id: "logs", title: "Logs", command: "tail", args: ["-f"] }));
  workspace.add(commandTerminalTemplate({ id: "tests", title: "Tests", command: "deno", args: ["test"] }));

  assertEquals(workspace.inspectLayout().panes.map((pane) => pane.sessionId), ["shell-main"]);
  const logsPane = workspace.splitActive("row", "logs", { ratio: 0.6 })!;
  assertEquals(logsPane.sessionId, "logs");
  assertEquals(workspace.inspect().activeId, "logs");
  assertEquals(workspace.inspectLayout().root?.kind, "split");
  assertEquals(workspace.inspectLayout().panes.map((pane) => [pane.sessionId, pane.active]), [
    ["shell-main", false],
    ["logs", true],
  ]);

  const testsPane = workspace.splitActive("column", "tests", { placement: "before", minRows: 8 })!;
  assertEquals(workspace.inspectLayout().panes.map((pane) => pane.sessionId), ["shell-main", "tests", "logs"]);
  assertEquals(workspace.activatePane(logsPane.id), true);
  assertEquals(workspace.inspect().activeId, "logs");
  assertEquals(workspace.toggleZoomPane(logsPane.id), true);
  assertEquals(workspace.inspectLayout().zoomedPaneId, logsPane.id);
  assertEquals(workspace.resizeActiveSplit(0.1), true);
  const root = workspace.inspectLayout().root;
  if (root?.kind !== "split") throw new Error("expected split root");
  assertEquals(root.ratio, 0.6);

  assertEquals(workspace.closePane(logsPane.id), true);
  assertEquals(workspace.inspectLayout().panes.map((pane) => pane.sessionId), ["shell-main", "tests"]);
  assertEquals(workspace.inspectLayout().zoomedPaneId, undefined);

  assertEquals(workspace.remove("tests"), true);
  assertEquals(workspace.inspectLayout().panes.map((pane) => pane.sessionId), ["shell-main"]);
  assertEquals(workspace.inspectLayout().root?.kind, "pane");

  workspace.dispose();
});

Deno.test("terminal workspace pane rects project split layouts", () => {
  const workspace = createTerminalWorkspaceController({ now: () => 1 });
  workspace.add(shellTerminalTemplate({ id: "shell-main", shell: "bash" }));
  const logsPane = workspace.splitActive("row", "shell-main", { ratio: 0.5, title: "logs mirror" })!;
  workspace.splitActive("column", "shell-main", { ratio: 0.25, placement: "before" });

  const layout = workspace.inspect().layout;
  assertEquals(
    terminalWorkspacePaneRects(layout, { column: 0, row: 0, width: 81, height: 21 }, { gap: 1 }).map((entry) => ({
      id: entry.pane.id,
      rect: entry.rect,
      active: entry.active,
    })),
    [
      { id: "pane-shell-main", rect: { column: 0, row: 0, width: 40, height: 21 }, active: false },
      { id: "pane-shell-main-3", rect: { column: 41, row: 0, width: 40, height: 5 }, active: true },
      { id: "pane-shell-main-2", rect: { column: 41, row: 6, width: 40, height: 15 }, active: false },
    ],
  );

  workspace.toggleZoomPane(logsPane.id);
  assertEquals(
    terminalWorkspacePaneRects(workspace.inspect().layout, { column: 2, row: 3, width: 20, height: 10 }).map((
      entry,
    ) => ({
      id: entry.pane.id,
      rect: entry.rect,
      zoomed: entry.zoomed,
    })),
    [{ id: logsPane.id, rect: { column: 2, row: 3, width: 20, height: 10 }, zoomed: true }],
  );

  workspace.dispose();
});

Deno.test("terminal workspace inspection returns cloned descriptors", () => {
  const workspace = createTerminalWorkspaceController({ now: () => 1 });
  workspace.add(commandTerminalTemplate({ id: "build", title: "Build", command: "deno", args: ["task", "health"] }));
  const first = workspace.inspect();
  first.sessions[0]!.title = "mutated";
  if ("args" in first.sessions[0]!.template) {
    (first.sessions[0]!.template.args as string[] | undefined)?.push("mutated");
  }

  const second = workspace.inspect();
  assertEquals(second.sessions[0]!.title, "Build");
  assertEquals("args" in second.sessions[0]!.template ? second.sessions[0]!.template.args : undefined, [
    "task",
    "health",
  ]);

  workspace.dispose();
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
