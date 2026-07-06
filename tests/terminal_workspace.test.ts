import { assertEquals, assertNotStrictEquals } from "./deps.ts";
import { commandDisabledBoolean as commandDisabled } from "./test_commands.ts";
import { CommandRegistry } from "../src/app/commands.ts";
import {
  bindTerminalShellWorkspaceCommands,
  bindTerminalWorkspaceCommands,
  syncTerminalWindowLayout,
  type TerminalShellWorkspaceCommandAction,
  terminalShellWorkspaceCommands,
  terminalWindowContentSize,
  type TerminalWorkspaceCommandAction,
  terminalWorkspaceCommands,
} from "../src/app/terminal_commands.ts";
import { TerminalOutputController } from "../src/components/terminal_output.ts";
import { WindowManagerController } from "../src/layout/window_manager.ts";
import {
  cloneTerminalWorkspaceLayoutState,
  collectTerminalWorkspacePanes,
  createTerminalWorkspacePaneNode,
  findNearestTerminalWorkspaceSplit,
  pruneTerminalWorkspaceLayoutSessions,
  removeTerminalWorkspacePane,
  replaceTerminalWorkspacePane,
  type TerminalWorkspaceLayoutNode,
  terminalWorkspaceLayoutWithActive,
  updateTerminalWorkspacePaneRuntimeTitles,
  updateTerminalWorkspaceSplitRatio,
} from "../src/runtime/terminal_workspace_layout.ts";
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
import {
  createTerminalWorkspaceController,
  createTerminalWorkspaceControllerFromSnapshot,
  normalizeTerminalWorkspaceSnapshot,
  snapshotTerminalWorkspace,
  TERMINAL_WORKSPACE_SNAPSHOT_VERSION,
  terminalWorkspacePaneRects,
} from "../src/runtime/terminal_workspace.ts";
import { TerminalShellWorkspaceController } from "../src/runtime/terminal_shell_workspace.ts";
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
  assertEquals(descriptor.pty, true);
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

Deno.test("terminal workspace session descriptors materialize spawn templates", () => {
  const workspace = createTerminalWorkspaceController({ now: () => 123 });
  const template = commandTerminalTemplate({
    id: "tail-logs",
    title: "Tail Logs",
    command: "tail",
    args: ["-f", "server.log"],
    cwd: "/repo",
    env: { FORCE_COLOR: "1" },
    columns: 100.8,
    rows: 24.2,
    reconnectable: true,
    restartPolicy: "on-failure",
    metadata: { role: "logs" },
  });

  const descriptor = workspace.add(template, {
    title: "Runtime Logs",
    backendId: "pty",
    rows: 40.9,
    status: "running",
    running: true,
  });

  assertEquals(descriptor.id, "tail-logs");
  assertEquals(descriptor.title, "Runtime Logs");
  assertEquals(descriptor.backendId, "pty");
  assertEquals(descriptor.commandLine, "tail -f server.log");
  assertEquals(descriptor.status, "running");
  assertEquals(descriptor.running, true);
  assertEquals(descriptor.columns, 100);
  assertEquals(descriptor.rows, 40);
  assertEquals(descriptor.reconnectable, true);
  assertEquals(descriptor.restartPolicy, "on-failure");
  assertEquals(descriptor.createdAt, 123);
  assertEquals(descriptor.updatedAt, 123);
  assertEquals(descriptor.template, template);
  assertNotStrictEquals(descriptor.template, template);
});

Deno.test("terminal workspace session descriptors materialize attach templates", () => {
  const workspace = createTerminalWorkspaceController({ now: () => 99 });
  const template = attachTerminalTemplate("pty/server", {
    title: "Server Attach",
    metadata: { host: "local" },
  });

  const descriptor = workspace.add(template, {
    backendId: "remote",
    columns: 0,
    rows: Number.NaN,
    status: "running",
    running: true,
  });

  assertEquals(descriptor.id, "attach-pty-server");
  assertEquals(descriptor.title, "Server Attach");
  assertEquals(descriptor.backendId, "remote");
  assertEquals(descriptor.columns, 1);
  assertEquals(descriptor.rows, undefined);
  assertEquals(descriptor.status, "running");
  assertEquals(descriptor.running, true);
  assertEquals(descriptor.detached, false);
  assertEquals(descriptor.reconnectable, true);
  assertEquals(descriptor.restartPolicy, "never");
});

Deno.test("terminal workspace session descriptors clone nested template state", () => {
  const workspace = createTerminalWorkspaceController({ now: () => 10 });
  const template = commandTerminalTemplate({
    id: "shell",
    title: "Shell",
    command: "bash",
    args: ["-l"],
    env: { TERM: "xterm-256color" },
    metadata: { lane: "dev" },
  });
  const descriptor = workspace.add(template);
  const clone = workspace.inspect().sessions[0]!;
  assertEquals(clone, descriptor);
  assertNotStrictEquals(clone, descriptor);
  assertNotStrictEquals(clone.template, descriptor.template);

  const originalTemplate = descriptor.template;
  if (originalTemplate.kind === "attach") throw new Error("expected spawn template");
  const clonedTemplate = clone.template;
  if (clonedTemplate.kind === "attach") throw new Error("expected spawn template");
  (clonedTemplate.args as string[] | undefined)?.push("--noprofile");
  clonedTemplate.env!.TERM = "screen-256color";
  clonedTemplate.metadata!.lane = "ops";

  assertEquals(originalTemplate.args, ["-l"]);
  assertEquals(originalTemplate.env, { TERM: "xterm-256color" });
  assertEquals(originalTemplate.metadata, { lane: "dev" });
  assertEquals(template.args, ["-l"]);
  assertEquals(template.env, { TERM: "xterm-256color" });
  assertEquals(template.metadata, { lane: "dev" });
  assertEquals((workspace.inspect().sessions[0]!.template as typeof template).args, ["-l"]);
});

Deno.test("terminal workspace session descriptors duplicate with unique sanitized ids", () => {
  let now = 10;
  const workspace = createTerminalWorkspaceController({ now: () => now });
  const source = workspace.add(
    commandTerminalTemplate({
      id: "dev server",
      title: "Dev Server",
      command: "deno",
      args: ["task", "dev"],
      reconnectable: true,
    }),
    {
      backendId: "pty",
      status: "running",
      running: true,
    },
  );
  workspace.upsert({
    ...source,
    id: "dev-server-copy",
    title: "Collision",
    template: { ...source.template, id: "dev-server-copy", title: "Collision" },
  }, { activate: false });

  now = 20;
  const duplicate = workspace.duplicate(source.id, { activate: false })!;

  assertEquals(duplicate.id, "dev-server-copy-2");
  assertEquals(duplicate.title, "Dev Server Copy");
  assertEquals(duplicate.template.id, "dev-server-copy-2");
  assertEquals(duplicate.template.title, "Dev Server Copy");
  assertEquals(duplicate.backendId, "pty");
  assertEquals(duplicate.status, "idle");
  assertEquals(duplicate.running, false);
  assertEquals(duplicate.detached, false);
  assertEquals(duplicate.commandLine, "deno task dev");
  assertEquals(duplicate.createdAt, 20);
  assertEquals(duplicate.updatedAt, 20);
});

Deno.test("terminal workspace session descriptors preserve attached duplicate runtime state", () => {
  let now = 10;
  const workspace = createTerminalWorkspaceController({ now: () => now });
  const source = workspace.add(attachTerminalTemplate("server-1"), {
    status: "running",
    running: true,
  });

  now = 20;
  const duplicate = workspace.duplicate(source.id, {
    id: "server clone",
    title: "Server Clone",
  })!;

  assertEquals(duplicate.id, "server-clone");
  assertEquals(duplicate.title, "Server Clone");
  assertEquals(duplicate.template.id, "server-clone");
  assertEquals(duplicate.template.title, "Server Clone");
  assertEquals(duplicate.status, "running");
  assertEquals(duplicate.running, true);
  assertEquals(duplicate.detached, false);
  assertEquals(duplicate.createdAt, 20);
  assertEquals(duplicate.updatedAt, 20);
});

Deno.test("terminal workspace session descriptors gate runtime title adoption", () => {
  const workspace = createTerminalWorkspaceController({ now: () => 10 });
  workspace.add(commandTerminalTemplate({
    id: "shell",
    title: "Shell",
    command: "bash",
  }));

  assertEquals(workspace.updateRuntimeTitle("shell", "vim"), true);
  assertEquals(workspace.inspect().sessions[0]?.title, "vim");
  assertEquals(workspace.updateRuntimeTitle("shell", "repo"), true);
  assertEquals(workspace.inspect().sessions[0]?.title, "repo");

  assertEquals(workspace.rename("shell", "Manual"), true);
  assertEquals(workspace.updateRuntimeTitle("shell", "htop"), true);
  assertEquals(workspace.inspect().sessions[0]?.title, "Manual");
  assertEquals(workspace.inspect().sessions[0]?.runtimeTitle, "htop");
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
  assertEquals(workspace.activateRelative(1)?.id, "shell-main");
  assertEquals(workspace.inspect().activeId, "shell-main");
  assertEquals(workspace.activateRelative(-1)?.id, "attach-pty-7");
  assertEquals(workspace.inspect().activeId, "attach-pty-7");

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

Deno.test("terminal workspace controller syncs runtime titles without replacing manual titles", () => {
  let now = 10;
  const workspace = createTerminalWorkspaceController({ now: () => now });
  workspace.add(shellTerminalTemplate({ id: "shell-main", shell: "bash" }));

  now = 20;
  assertEquals(workspace.updateRuntimeTitle("shell-main", "repo shell"), true);
  let inspection = workspace.inspect();
  assertEquals(inspection.sessions[0]?.title, "repo shell");
  assertEquals(inspection.sessions[0]?.runtimeTitle, "repo shell");
  assertEquals(inspection.sessions[0]?.updatedAt, 20);
  assertEquals(inspection.layout.panes[0]?.title, "repo shell");

  now = 30;
  assertEquals(workspace.rename("shell-main", "Manual Shell"), true);
  assertEquals(workspace.updateRuntimeTitle("shell-main", "vim main.ts"), true);
  inspection = workspace.inspect();
  assertEquals(inspection.sessions[0]?.title, "Manual Shell");
  assertEquals(inspection.sessions[0]?.runtimeTitle, "vim main.ts");
  assertEquals(inspection.sessions[0]?.updatedAt, 30);
  assertEquals(inspection.layout.panes[0]?.title, "repo shell");

  workspace.dispose();
});

Deno.test("terminal workspace controller duplicates and detaches sessions", () => {
  let now = 10;
  const workspace = createTerminalWorkspaceController({ now: () => now });
  workspace.add(
    commandTerminalTemplate({
      id: "server",
      title: "Dev Server",
      command: "deno",
      args: ["task", "dev"],
      cwd: "/repo",
      reconnectable: true,
      restartPolicy: "on-failure",
    }),
    { status: "running", running: true, backendId: "pty" },
  );

  now = 20;
  const duplicate = workspace.duplicate("server", { title: "Second Server" });
  assertEquals(duplicate?.id, "server-copy");
  assertEquals(duplicate?.title, "Second Server");
  assertEquals(duplicate?.template.id, "server-copy");
  assertEquals(duplicate?.template.title, "Second Server");
  assertEquals(duplicate?.commandLine, "deno task dev");
  assertEquals(duplicate?.status, "idle");
  assertEquals(duplicate?.running, false);
  assertEquals(duplicate?.createdAt, 20);
  assertEquals(workspace.inspect().activeId, "server-copy");

  now = 30;
  assertEquals(workspace.detach("server"), true);
  let source = workspace.inspect().sessions.find((session) => session.id === "server");
  assertEquals(source?.detached, true);
  assertEquals(source?.reconnectable, true);
  assertEquals(source?.running, false);
  assertEquals(source?.updatedAt, 30);

  now = 40;
  assertEquals(workspace.attach("server"), true);
  source = workspace.inspect().sessions.find((session) => session.id === "server");
  assertEquals(source?.detached, false);
  assertEquals(source?.updatedAt, 40);
  assertEquals(workspace.inspect().activeId, "server");

  now = 50;
  assertEquals(workspace.restart("server"), true);
  source = workspace.inspect().sessions.find((session) => session.id === "server");
  assertEquals(source?.status, "idle");
  assertEquals(source?.running, false);
  assertEquals(source?.detached, false);
  assertEquals(source?.runtimeTitle, undefined);
  assertEquals(source?.updatedAt, 50);

  workspace.dispose();
});

Deno.test("terminal workspace controller manages split pane layout", () => {
  const workspace = createTerminalWorkspaceController({ now: () => 1 });
  workspace.add(shellTerminalTemplate({ id: "shell-main", shell: "bash" }));
  workspace.add(commandTerminalTemplate({ id: "logs", title: "Logs", command: "tail", args: ["-f"] }));
  workspace.add(commandTerminalTemplate({ id: "tests", title: "Tests", command: "deno", args: ["test"] }));

  assertEquals(workspace.inspectLayout().panes.map((pane) => pane.sessionId), ["shell-main"]);
  const logsPane = workspace.splitActive("row", "logs", { ratio: 0.6, title: "Logs" })!;
  assertEquals(logsPane.sessionId, "logs");
  assertEquals(workspace.inspect().activeId, "logs");
  assertEquals(workspace.inspectLayout().root?.kind, "split");
  assertEquals(workspace.inspectLayout().panes.map((pane) => [pane.sessionId, pane.active]), [
    ["shell-main", false],
    ["logs", true],
  ]);

  assertEquals(workspace.splitActive("column", "tests", { placement: "before", minRows: 8 })?.sessionId, "tests");
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

Deno.test("terminal workspace layout helpers create stable unique pane ids", () => {
  const first = createTerminalWorkspacePaneNode("Shell Main");
  const second = createTerminalWorkspacePaneNode("Shell Main", first, { title: "mirror", minColumns: 12.9 });

  assertEquals(first, {
    kind: "pane",
    id: "pane-shell-main",
    sessionId: "Shell Main",
    title: undefined,
    minColumns: undefined,
    minRows: undefined,
  });
  assertEquals(second, {
    kind: "pane",
    id: "pane-shell-main-2",
    sessionId: "Shell Main",
    title: "mirror",
    minColumns: 12,
    minRows: undefined,
  });
});

Deno.test("terminal workspace layout helpers clone prune and preserve active panes", () => {
  const shell = createTerminalWorkspacePaneNode("shell");
  const logs = createTerminalWorkspacePaneNode("logs", shell);
  const tests = createTerminalWorkspacePaneNode("tests", {
    kind: "split",
    id: "split",
    direction: "row",
    ratio: 0.5,
    first: shell,
    second: logs,
  });
  const root: TerminalWorkspaceLayoutNode = {
    kind: "split",
    id: "root",
    direction: "row",
    ratio: 0.65,
    first: shell,
    second: {
      kind: "split",
      id: "nested",
      direction: "column",
      ratio: 0.35,
      first: logs,
      second: tests,
    },
  };

  const cloned = cloneTerminalWorkspaceLayoutState({ root, activePaneId: tests.id, zoomedPaneId: logs.id });
  if (cloned.root?.kind !== "split") throw new Error("expected split root");
  cloned.root.ratio = 0.2;
  assertEquals(root.ratio, 0.65);

  assertEquals(collectTerminalWorkspacePanes(root).map((pane) => pane.sessionId), ["shell", "logs", "tests"]);
  assertEquals(
    pruneTerminalWorkspaceLayoutSessions(
      { root, activePaneId: tests.id, zoomedPaneId: logs.id },
      new Set(["shell", "tests"]),
    ),
    {
      root: {
        kind: "split",
        id: "root",
        direction: "row",
        ratio: 0.65,
        first: shell,
        second: tests,
      },
      activePaneId: tests.id,
      zoomedPaneId: undefined,
    },
  );
  assertEquals(terminalWorkspaceLayoutWithActive({ root }, "logs").activePaneId, logs.id);
});

Deno.test("terminal workspace layout helpers replace remove resize and find nearest split", () => {
  const shell = createTerminalWorkspacePaneNode("shell");
  const logs = createTerminalWorkspacePaneNode("logs", shell);
  const next = createTerminalWorkspacePaneNode("next", {
    kind: "split",
    id: "root",
    direction: "row",
    ratio: 0.5,
    first: shell,
    second: logs,
  });
  const root: TerminalWorkspaceLayoutNode = {
    kind: "split",
    id: "root",
    direction: "row",
    ratio: 0.5,
    first: shell,
    second: logs,
  };

  const replaced = replaceTerminalWorkspacePane(root, logs.id, next);
  assertEquals(collectTerminalWorkspacePanes(replaced).map((pane) => pane.sessionId), ["shell", "next"]);
  assertEquals(removeTerminalWorkspacePane(replaced, shell.id), next);
  assertEquals(updateTerminalWorkspaceSplitRatio(root, "root", 0.9), {
    node: { ...root, ratio: 0.9 },
    changed: true,
  });
  assertEquals(updateTerminalWorkspaceSplitRatio(root, "missing", 0.9), {
    node: root,
    changed: false,
  });
  assertEquals(findNearestTerminalWorkspaceSplit(root, logs.id)?.activeSide, "second");
});

Deno.test("terminal workspace layout helpers update runtime titles and project rectangles", () => {
  const shell = createTerminalWorkspacePaneNode("shell", undefined, { title: "Shell" });
  const logs = createTerminalWorkspacePaneNode("logs", shell, { title: "Logs" });
  const root: TerminalWorkspaceLayoutNode = {
    kind: "split",
    id: "root",
    direction: "row",
    ratio: 0.5,
    first: shell,
    second: logs,
  };
  const layout = updateTerminalWorkspacePaneRuntimeTitles(
    { root, activePaneId: logs.id },
    "logs",
    "tail -f api.log",
    "Logs",
    undefined,
    "Logs",
  );

  assertEquals(collectTerminalWorkspacePanes(layout.root).map((pane) => pane.title), ["Shell", "tail -f api.log"]);
  assertEquals(
    terminalWorkspacePaneRects(layout, { column: 0, row: 0, width: 21, height: 8 }, { gap: 1 }).map((entry) => ({
      id: entry.pane.id,
      rect: entry.rect,
      active: entry.active,
    })),
    [
      { id: shell.id, rect: { column: 0, row: 0, width: 10, height: 8 }, active: false },
      { id: logs.id, rect: { column: 11, row: 0, width: 10, height: 8 }, active: true },
    ],
  );
});

Deno.test("terminal workspace snapshots round trip sessions active pane and layout", () => {
  const workspace = createTerminalWorkspaceController({ now: () => 1 });
  workspace.add(shellTerminalTemplate({ id: "shell-main", shell: "bash" }));
  workspace.add(commandTerminalTemplate({ id: "logs", title: "Logs", command: "tail", args: ["-f"] }));
  const logsPane = workspace.splitActive("row", "logs", { ratio: 0.6 })!;
  workspace.toggleZoomPane(logsPane.id);

  const snapshot = workspace.snapshot();
  assertEquals(snapshot.version, TERMINAL_WORKSPACE_SNAPSHOT_VERSION);
  assertEquals(snapshot.activeId, "logs");
  assertEquals(snapshot.sessions.map((session) => session.id), ["shell-main", "logs"]);
  assertEquals(snapshot.layout.activePaneId, logsPane.id);
  assertEquals(snapshot.layout.zoomedPaneId, logsPane.id);

  const restored = createTerminalWorkspaceControllerFromSnapshot(snapshot, { now: () => 50 });
  assertEquals(restored.inspect().activeId, "logs");
  assertEquals(restored.inspectLayout().panes.map((pane) => [pane.sessionId, pane.active, pane.zoomed]), [
    ["shell-main", false, false],
    ["logs", true, true],
  ]);

  snapshot.sessions[1]!.title = "mutated";
  if (snapshot.layout.root?.kind === "split" && snapshot.layout.root.second.kind === "pane") {
    snapshot.layout.root.second.title = "mutated";
  }
  assertEquals(restored.inspect().sessions[1]!.title, "Logs");

  workspace.dispose();
  restored.dispose();
});

Deno.test("terminal workspace snapshot helpers clone and normalize missing saved panes", () => {
  const source = createTerminalWorkspaceController({ now: () => 1 });
  source.add(shellTerminalTemplate({ id: "shell-main", shell: "bash" }));
  const inspection = source.inspect();
  const snapshot = snapshotTerminalWorkspace(inspection);

  assertNotStrictEquals(snapshot.sessions[0], inspection.sessions[0]);
  assertNotStrictEquals(snapshot.layout.root, inspection.layout.root);

  const normalized = normalizeTerminalWorkspaceSnapshot({
    ...snapshot,
    activeId: "missing",
    layout: {
      root: { kind: "pane", id: "pane-missing", sessionId: "missing" },
      activePaneId: "pane-missing",
      zoomedPaneId: "pane-missing",
    },
  });

  assertEquals(normalized.activeId, "shell-main");
  assertEquals(normalized.layout.root, {
    kind: "pane",
    id: "pane-shell-main",
    sessionId: "shell-main",
    title: "Shell",
    minColumns: undefined,
    minRows: undefined,
  });
  assertEquals(normalized.layout.activePaneId, "pane-shell-main");
  assertEquals(normalized.layout.zoomedPaneId, undefined);

  source.dispose();
});

Deno.test("terminal workspace commands drive pane operations", async () => {
  const workspace = createTerminalWorkspaceController({ now: () => 1 });
  workspace.add(shellTerminalTemplate({ id: "shell-main", shell: "bash" }));
  workspace.add(commandTerminalTemplate({ id: "logs", title: "Logs", command: "tail", args: ["-f"] }));
  const registry = new CommandRegistry<TerminalWorkspaceCommandAction>();
  const actions: TerminalWorkspaceCommandAction[] = [];
  let renameTitle = "Renamed Logs";
  const dispose = bindTerminalWorkspaceCommands(registry, workspace, {
    id: "term",
    idPrefix: "terminal.main",
    sessionId: "logs",
    renameTitle: () => renameTitle,
    resizeStep: 0.1,
  });

  assertEquals(terminalWorkspaceCommands(workspace).map((command) => [command.id, commandDisabled(command)]), [
    ["terminalWorkspace.split.row", false],
    ["terminalWorkspace.split.column", false],
    ["terminalWorkspace.zoom", false],
    ["terminalWorkspace.closePane", false],
    ["terminalWorkspace.nextPane", true],
    ["terminalWorkspace.previousPane", true],
    ["terminalWorkspace.focusLeft", true],
    ["terminalWorkspace.focusRight", true],
    ["terminalWorkspace.focusUp", true],
    ["terminalWorkspace.focusDown", true],
    ["terminalWorkspace.growActive", true],
    ["terminalWorkspace.shrinkActive", true],
    ["terminalWorkspace.closeSession", false],
    ["terminalWorkspace.renameSession", true],
    ["terminalWorkspace.duplicateSession", false],
    ["terminalWorkspace.previousSession", false],
    ["terminalWorkspace.nextSession", false],
    ["terminalWorkspace.moveSessionPrevious", false],
    ["terminalWorkspace.moveSessionNext", false],
    ["terminalWorkspace.restartSession", false],
    ["terminalWorkspace.detachSession", true],
    ["terminalWorkspace.attachSession", true],
  ]);

  assertEquals(await registry.execute("terminal.main.split.row", (action) => void actions.push(action)), true);
  const splitAction = actions[0];
  assertEquals(splitAction?.type, "terminalWorkspace.split");
  assertEquals(
    splitAction?.type === "terminalWorkspace.split"
      ? (splitAction.payload as { direction?: string } | undefined)?.direction
      : undefined,
    "row",
  );
  assertEquals(workspace.inspectLayout().count, 2);
  assertEquals(workspace.inspect().activeId, "logs");

  assertEquals(await registry.execute("terminal.main.nextPane", (action) => void actions.push(action)), true);
  assertEquals(actions[1]?.type, "terminalWorkspace.paneActivated");
  assertEquals(workspace.inspect().activeId, "shell-main");
  assertEquals(await registry.execute("terminal.main.zoom", (action) => void actions.push(action)), true);
  assertEquals(actions[2]?.type, "terminalWorkspace.zoomChanged");
  assertEquals(workspace.inspectLayout().zoomedPaneId, workspace.inspectLayout().activePaneId);
  assertEquals(await registry.execute("terminal.main.growActive", (action) => void actions.push(action)), true);
  assertEquals(actions[3]?.type, "terminalWorkspace.paneResized");
  assertEquals(await registry.execute("terminal.main.closePane", (action) => void actions.push(action)), true);
  assertEquals(actions[4]?.type, "terminalWorkspace.paneClosed");
  assertEquals(workspace.inspectLayout().count, 1);
  assertEquals(await registry.execute("terminal.main.renameSession", (action) => void actions.push(action)), true);
  assertEquals(actions[5]?.type, "terminalWorkspace.sessionRenamed");
  assertEquals(workspace.inspect().sessions.find((session) => session.id === "logs")?.title, "Renamed Logs");
  renameTitle = " ";
  assertEquals(
    commandDisabled(registry.list("terminal").find((command) => command.id === "terminal.main.renameSession")!),
    true,
  );
  assertEquals(await registry.execute("terminal.main.duplicateSession", (action) => void actions.push(action)), true);
  assertEquals(actions[6]?.type, "terminalWorkspace.sessionDuplicated");
  assertEquals(workspace.inspect().sessions.map((session) => session.id), ["shell-main", "logs", "logs-copy"]);
  assertEquals(await registry.execute("terminal.main.nextSession", (action) => void actions.push(action)), true);
  assertEquals(actions[7]?.type, "terminalWorkspace.sessionActivated");
  assertEquals(workspace.inspect().activeId, "shell-main");
  assertEquals(await registry.execute("terminal.main.previousSession", (action) => void actions.push(action)), true);
  assertEquals(actions[8]?.type, "terminalWorkspace.sessionActivated");
  assertEquals(workspace.inspect().activeId, "logs-copy");
  assertEquals(
    await registry.execute("terminal.main.moveSessionPrevious", (action) => void actions.push(action)),
    true,
  );
  assertEquals(actions[9]?.type, "terminalWorkspace.sessionMoved");
  assertEquals(workspace.inspect().sessions.map((session) => session.id), ["shell-main", "logs-copy", "logs"]);
  assertEquals(await registry.execute("terminal.main.moveSessionNext", (action) => void actions.push(action)), true);
  assertEquals(actions[10]?.type, "terminalWorkspace.sessionMoved");
  assertEquals(workspace.inspect().sessions.map((session) => session.id), ["shell-main", "logs", "logs-copy"]);
  assertEquals(await registry.execute("terminal.main.restartSession", (action) => void actions.push(action)), true);
  assertEquals(actions[11]?.type, "terminalWorkspace.sessionRestarted");
  assertEquals(workspace.inspect().active?.status, "idle");
  assertEquals(await registry.execute("terminal.main.closeSession", (action) => void actions.push(action)), true);
  assertEquals(actions[12]?.type, "terminalWorkspace.sessionClosed");
  assertEquals(workspace.inspect().sessions.map((session) => session.id), ["shell-main", "logs"]);

  dispose();
  assertEquals(registry.list("terminal"), []);
  workspace.dispose();
});

Deno.test("terminal workspace commands use supplied pane geometry for directional focus", async () => {
  const workspace = createTerminalWorkspaceController({ now: () => 1 });
  workspace.add(shellTerminalTemplate({ id: "left", shell: "bash" }));
  workspace.add(shellTerminalTemplate({ id: "right", shell: "bash" }));
  workspace.add(shellTerminalTemplate({ id: "bottom", shell: "bash" }));
  workspace.splitActive("row", "right");
  workspace.activate("left");
  workspace.splitActive("column", "bottom");

  const registry = new CommandRegistry<TerminalWorkspaceCommandAction>();
  const actions: TerminalWorkspaceCommandAction[] = [];
  const paneRects = () =>
    terminalWorkspacePaneRects(workspace.inspect().layout, {
      column: 0,
      row: 0,
      width: 41,
      height: 21,
    });
  const dispose = bindTerminalWorkspaceCommands(registry, workspace, {
    id: "term",
    idPrefix: "terminal.main",
    paneRects,
    includeSplitCommands: false,
    includeZoom: false,
    includeClosePane: false,
    includeResizeCommands: false,
    includeSessionCommands: false,
  });

  assertEquals(
    commandDisabled(registry.list("terminal").find((command) => command.id === "terminal.main.focusRight")!),
    false,
  );
  workspace.activate("bottom");
  assertEquals(await registry.execute("terminal.main.focusRight", (action) => void actions.push(action)), true);
  assertEquals(actions.at(-1)?.type, "terminalWorkspace.paneActivated");
  assertEquals(workspace.inspect().activeId, "right");

  workspace.activate("right");
  assertEquals(await registry.execute("terminal.main.focusLeft", (action) => void actions.push(action)), true);
  assertEquals(workspace.inspect().activeId, "left");

  workspace.activate("left");
  assertEquals(await registry.execute("terminal.main.focusDown", (action) => void actions.push(action)), true);
  assertEquals(workspace.inspect().activeId, "bottom");

  workspace.activate("bottom");
  assertEquals(await registry.execute("terminal.main.focusUp", (action) => void actions.push(action)), true);
  assertEquals(workspace.inspect().activeId, "left");

  dispose();
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

Deno.test("terminal shell workspace commands drive live shell sessions", async () => {
  const backend = new FakeWorkspaceShellBackend();
  const workspace = new TerminalShellWorkspaceController({ backend });
  workspace.add(shellTerminalTemplate({ id: "main", shell: "bash" }));
  const registry = new CommandRegistry<TerminalShellWorkspaceCommandAction>();
  const actions: TerminalShellWorkspaceCommandAction[] = [];
  const dispose = bindTerminalShellWorkspaceCommands(registry, workspace, {
    id: "shells",
    idPrefix: "shells",
    shellTitle: "Aux Shell",
  });

  assertEquals(terminalShellWorkspaceCommands(workspace).map((command) => [command.id, commandDisabled(command)]), [
    ["terminalShellWorkspace.newShell", false],
    ["terminalShellWorkspace.previousSession", true],
    ["terminalShellWorkspace.nextSession", true],
    ["terminalShellWorkspace.closeSession", false],
    ["terminalShellWorkspace.sync", false],
    ["terminalShellWorkspace.start", false],
    ["terminalShellWorkspace.stop", true],
    ["terminalShellWorkspace.restart", false],
  ]);

  assertEquals(await registry.execute("shells.start", (action) => void actions.push(action)), true);
  assertEquals(actions[0]?.type, "terminalShellWorkspace.sessionStarted");
  assertEquals(backend.spawned[0]?.command, "bash");
  assertEquals(commandDisabled(registry.list("terminal").find((command) => command.id === "shells.start")!), true);

  assertEquals(await registry.execute("shells.newShell", (action) => void actions.push(action)), true);
  assertEquals(actions[1]?.type, "terminalShellWorkspace.sessionAdded");
  assertEquals(workspace.inspect().activeId, "shell-2");
  assertEquals(workspace.inspect().workspace.active?.title, "Aux Shell");

  assertEquals(await registry.execute("shells.previousSession", (action) => void actions.push(action)), true);
  assertEquals(actions[2]?.type, "terminalShellWorkspace.sessionActivated");
  assertEquals(workspace.inspect().activeId, "main");

  assertEquals(await registry.execute("shells.stop", (action) => void actions.push(action)), true);
  assertEquals(actions[3]?.type, "terminalShellWorkspace.sessionStopped");
  assertEquals(workspace.inspect().activeShell?.running, false);

  assertEquals(await registry.execute("shells.restart", (action) => void actions.push(action)), true);
  assertEquals(actions[4]?.type, "terminalShellWorkspace.sessionRestarted");
  assertEquals(backend.spawned.length, 2);

  assertEquals(await registry.execute("shells.closeSession", (action) => void actions.push(action)), true);
  assertEquals(actions[5]?.type, "terminalShellWorkspace.sessionClosed");
  assertEquals(workspace.inspect().sessions.map((session) => session.id), ["shell-2"]);

  dispose();
  assertEquals(registry.list("terminal"), []);
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
      pty: true,
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
