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
  nextWorkbenchTerminalSessionId,
  resolveWorkbenchShellBackend,
  resolveWorkbenchTerminalOutputKeyAction,
  resolveWorkbenchTerminalProcessInputModeToggle,
  resolveWorkbenchTerminalShellInputModeToggle,
  resolveWorkbenchTerminalShellKeyAction,
  workbenchTerminalCopyRowsInto,
  type WorkbenchTerminalOutputToolbarAction,
  workbenchTerminalOutputToolbarItemsInto,
  workbenchTerminalPaneProjectionsInto,
  workbenchTerminalProtocolHeaderRowsInto,
  workbenchTerminalSearchModalBody,
  workbenchTerminalSessionTabRenderCommandsInto,
  workbenchTerminalSessionTabsInto,
  workbenchTerminalSessionTabSourcesInto,
  workbenchTerminalSessionTitleFromId,
  type WorkbenchTerminalToolbarAction,
  workbenchTerminalToolbarItemsInto,
  workbenchTerminalToolbarStateFromSnapshot,
} from "../src/app/workbench/mod.ts";

Deno.test("resolveWorkbenchTerminalProcessInputModeToggle leaves workbench mode when process is stopped", () => {
  assertEquals(resolveWorkbenchTerminalProcessInputModeToggle({ mode: "workbench", running: false }), {
    mode: "workbench",
    changed: false,
    message: "terminal raw input requires running process",
  });
});

Deno.test("resolveWorkbenchTerminalProcessInputModeToggle enters and exits raw mode", () => {
  assertEquals(resolveWorkbenchTerminalProcessInputModeToggle({ mode: "workbench", running: true }), {
    mode: "raw",
    changed: true,
    message: "terminal input raw mode",
  });
  assertEquals(resolveWorkbenchTerminalProcessInputModeToggle({ mode: "raw", running: false }), {
    mode: "workbench",
    changed: true,
    message: "terminal input workbench mode",
  });
});

Deno.test("resolveWorkbenchTerminalShellInputModeToggle leaves workbench mode when shell is stopped", () => {
  assertEquals(resolveWorkbenchTerminalShellInputModeToggle({ mode: "workbench", running: false }), {
    mode: "workbench",
    changed: false,
    message: "shell raw input requires a running shell",
  });
});

Deno.test("resolveWorkbenchTerminalShellInputModeToggle enters and exits raw mode", () => {
  assertEquals(resolveWorkbenchTerminalShellInputModeToggle({ mode: "workbench", running: true }), {
    mode: "raw",
    changed: true,
    message: "shell input raw mode",
  });
  assertEquals(resolveWorkbenchTerminalShellInputModeToggle({ mode: "raw", running: false }), {
    mode: "workbench",
    changed: true,
    message: "shell input workbench mode",
  });
});

Deno.test("workbenchTerminalSearchModalBody projects an empty search prompt", () => {
  assertEquals(workbenchTerminalSearchModalBody({ query: "gpu" }), [
    "Query  gpu▌",
    "Matches none yet",
    "Enter searches, Escape cancels, N/Shift+N move between matches in copy mode.",
  ]);
});

Deno.test("workbenchTerminalSearchModalBody projects active match state", () => {
  assertEquals(
    workbenchTerminalSearchModalBody({
      query: "ready",
      scrollback: { matches: [2, 5, 9], activeMatch: 1 },
      cursor: "_",
    }),
    [
      "Query  ready_",
      "Matches 3 hit 2/3",
      "Enter searches, Escape cancels, N/Shift+N move between matches in copy mode.",
    ],
  );
});

Deno.test("workbenchTerminalProtocolHeaderRowsInto projects reusable browser terminal headers", () => {
  const target = ["stale"];
  const rows = workbenchTerminalProtocolHeaderRowsInto(target, {
    activeTitle: "Pages Shell",
    columns: 80,
    rows: 24,
    cursorColumn: 7,
    cursorRow: 3,
    sessionCount: 2,
    paneCount: 4,
  });

  assertEquals(rows, target);
  assertEquals(rows, [
    "REMOTE TERMINAL / BROWSER SHELL MODEL",
    "active Pages Shell  screen 80x24  cursor 7,3  sessions 2  panes 4",
  ]);

  workbenchTerminalProtocolHeaderRowsInto(rows, {
    columns: 100,
    rows: 30,
    cursorColumn: 0,
    cursorRow: 0,
    sessionCount: 0,
    paneCount: 1,
    title: "Terminal",
  });
  assertEquals(rows, [
    "Terminal",
    "active none  screen 100x30  cursor 0,0  sessions 0  panes 1",
  ]);
});

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

Deno.test("workbench terminal session id helpers avoid collisions and format titles", () => {
  assertEquals(nextWorkbenchTerminalSessionId([{ id: "shell-1" }, { id: "shell-3" }]), "shell-2");
  assertEquals(
    nextWorkbenchTerminalSessionId([{ id: "pages-shell-1" }], { prefix: "pages-shell" }),
    "pages-shell-2",
  );
  assertEquals(
    nextWorkbenchTerminalSessionId([{ id: "shell-1" }, { id: "shell-2" }], {
      maxIndex: 2,
      fallbackNow: () => 42,
    }),
    "shell-42",
  );
  assertEquals(workbenchTerminalSessionTitleFromId("shell-7"), "Shell 7");
  assertEquals(
    workbenchTerminalSessionTitleFromId("pages-shell-8", { prefix: "pages-shell", label: "Pages Shell" }),
    "Pages Shell 8",
  );
  assertEquals(workbenchTerminalSessionTitleFromId("custom", { label: "Session" }), "Session");
});

Deno.test("workbenchTerminalSessionTabSourcesInto projects direct and shell-backed session state", () => {
  const target = [{ id: "old", title: "Old", running: false, status: "stale" }];
  const rows = workbenchTerminalSessionTabSourcesInto(target, [
    { id: "shell-1", title: "Shell One", shell: { running: true, status: "running" } },
    { id: "web-1", title: "Web One", running: false, status: "idle" },
  ]);

  assertEquals(rows, [
    { id: "shell-1", title: "Shell One", running: true, status: "running" },
    { id: "web-1", title: "Web One", running: false, status: "idle" },
  ]);
  assertEquals(rows[0] === target[0], true);

  workbenchTerminalSessionTabSourcesInto(target, [
    { id: "shell-2", title: "Shell Two", shell: { running: false, status: "stopped" } },
  ]);
  assertEquals(target, [
    { id: "shell-2", title: "Shell Two", running: false, status: "stopped" },
  ]);
});

Deno.test("workbenchTerminalToolbarStateFromSnapshot normalizes scrollback search state", () => {
  assertEquals(
    workbenchTerminalToolbarStateFromSnapshot({
      activeId: "shell-1",
      sessionCount: 2,
      paneCount: 3,
      zoomedPaneId: "pane-1",
      shellRunning: true,
      shellStarting: false,
      inputMode: "workbench",
      copyMode: true,
      scrollback: {
        totalRows: 120,
        viewportRows: 24,
        query: "deno",
        matches: [{ row: 1 }, { row: 4 }],
      },
    }),
    {
      activeId: "shell-1",
      sessionCount: 2,
      paneCount: 3,
      zoomedPaneId: "pane-1",
      shellRunning: true,
      shellStarting: false,
      inputMode: "workbench",
      copyMode: true,
      scrollbackTotalRows: 120,
      scrollbackViewportRows: 24,
      searchQuery: "deno",
      searchMatchCount: 2,
    },
  );

  assertEquals(
    workbenchTerminalToolbarStateFromSnapshot({
      sessionCount: 1,
      scrollback: { matchCount: 7, matches: [] },
    }).searchMatchCount,
    7,
  );
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

Deno.test("workbenchTerminalSessionTabRenderCommandsInto projects tabs and row gaps", () => {
  const placements = workbenchTerminalSessionTabsInto(
    [],
    [
      { id: "shell-1", title: "One", running: true },
      { id: "shell-2", title: "Two", status: "idle" },
    ],
    "shell-2",
    { column: 2, row: 5, width: 24, height: 1 },
    { maxWidth: 9 },
  );
  const commands = workbenchTerminalSessionTabRenderCommandsInto(
    [],
    placements,
    { column: 0, row: 5, width: 28, height: 1 },
  );

  assertEquals(
    commands.map((command) => ({
      kind: command.kind,
      id: command.id,
      text: command.text,
      rect: command.rect,
      active: command.active,
    })),
    [
      { kind: "gap", id: undefined, text: "  ", rect: { column: 0, row: 5, width: 2, height: 1 }, active: false },
      {
        kind: "tab",
        id: "shell-1",
        text: "[ * One ]",
        rect: { column: 2, row: 5, width: 9, height: 1 },
        active: false,
      },
      { kind: "gap", id: undefined, text: " ", rect: { column: 11, row: 5, width: 1, height: 1 }, active: false },
      {
        kind: "tab",
        id: "shell-2",
        text: "[ I Two ]",
        rect: { column: 12, row: 5, width: 9, height: 1 },
        active: true,
      },
      { kind: "gap", id: undefined, text: "       ", rect: { column: 21, row: 5, width: 7, height: 1 }, active: false },
    ],
  );
});

Deno.test("workbenchTerminalSessionTabRenderCommandsInto reuses caller-owned commands", () => {
  const placements = workbenchTerminalSessionTabsInto(
    [],
    [{ id: "shell-1", title: "Reusable", running: true }],
    "shell-1",
    { column: 0, row: 0, width: 14, height: 1 },
  );
  const commands = workbenchTerminalSessionTabRenderCommandsInto(
    [],
    placements,
    { column: 0, row: 0, width: 14, height: 1 },
  );
  const first = commands[0];

  const nextPlacements = workbenchTerminalSessionTabsInto(
    placements,
    [{ id: "shell-2", title: "Next", status: "idle" }],
    undefined,
    { column: 1, row: 2, width: 12, height: 1 },
  );
  workbenchTerminalSessionTabRenderCommandsInto(commands, nextPlacements, { column: 1, row: 2, width: 12, height: 1 });

  assertEquals(commands[0] === first, true);
  assertEquals(commands[0]?.kind, "tab");
  assertEquals(commands[0]?.id, "shell-2");
  assertEquals(commands[0]?.rect, { column: 1, row: 2, width: 10, height: 1 });
  assertEquals(commands[0]?.text, "[ I Next ]");
  assertEquals(commands[1]?.kind, "gap");
  assertEquals(commands[1]?.rect, { column: 11, row: 2, width: 2, height: 1 });
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

Deno.test("workbenchTerminalCopyRowsInto projects line numbers selection and reuse", () => {
  const target = [{ screenRow: 99, rowIndex: 99, lineNumber: 100, prefix: "stale", text: "old", selected: false }];
  const rows = workbenchTerminalCopyRowsInto(target, {
    visibleRows: ["alpha", "beta"],
    offset: 8,
    height: 3,
    selection: { anchor: 9, focus: 10 },
    prefixWidth: 5,
  });

  assertEquals(rows === target, true);
  assertEquals(rows[0], {
    screenRow: 0,
    rowIndex: 8,
    lineNumber: 9,
    prefix: "   9 ",
    text: "alpha",
    selected: false,
  });
  assertEquals(rows[1], {
    screenRow: 1,
    rowIndex: 9,
    lineNumber: 10,
    prefix: "  10 ",
    text: "beta",
    selected: true,
  });
  assertEquals(rows[2], {
    screenRow: 2,
    rowIndex: 10,
    lineNumber: 11,
    prefix: "  11 ",
    text: "",
    selected: true,
  });

  const first = rows[0];
  workbenchTerminalCopyRowsInto(rows, { visibleRows: ["next"], offset: 0, height: 1 });
  assertEquals(rows.length, 1);
  assertEquals(rows[0] === first, true);
  assertEquals(rows[0]?.text, "next");
  assertEquals(rows[0]?.selected, false);
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

Deno.test("workbenchTerminalOutputToolbarItemsInto projects process-output button state", () => {
  const items = workbenchTerminalOutputToolbarItemsInto([], {
    running: true,
    outputLineCount: 4,
    follow: true,
    inputMode: "raw",
  });

  assertEquals(items.map((item) => item.action), ["run", "stop", "restart", "clear", "follow", "raw", "copy"]);
  assertEquals(items.find((item) => item.action === "run")?.disabled, true);
  assertEquals(items.find((item) => item.action === "stop")?.disabled, false);
  assertEquals(items.find((item) => item.action === "clear")?.disabled, false);
  assertEquals(items.find((item) => item.action === "follow")?.active, true);
  assertEquals(items.find((item) => item.action === "raw")?.active, true);
  assertEquals(items.find((item) => item.action === "raw")?.disabled, false);
  assertEquals(items.find((item) => item.action === "copy")?.tone, "muted");
});

Deno.test("workbenchTerminalOutputToolbarItemsInto supports subsets and reuse", () => {
  const actions: WorkbenchTerminalOutputToolbarAction[] = ["run", "clear", "raw"];
  const first = workbenchTerminalOutputToolbarItemsInto([], {
    running: false,
    outputLineCount: 0,
    follow: false,
    inputMode: "workbench",
  }, { actions });
  const run = first[0];
  const raw = first[2];

  assertEquals(first.map((item) => item.action), actions);
  assertEquals(first.map((item) => item.disabled), [false, true, true]);

  const second = workbenchTerminalOutputToolbarItemsInto(first, {
    running: true,
    outputLineCount: 1,
    follow: false,
    inputMode: "raw",
  }, { actions });

  assertEquals(second[0] === run, true);
  assertEquals(second[2] === raw, true);
  assertEquals(second.map((item) => item.disabled), [true, false, false]);
  assertEquals(second[2]?.active, true);
});

Deno.test("resolveWorkbenchTerminalOutputKeyAction maps process terminal shortcuts", () => {
  assertEquals(resolveWorkbenchTerminalOutputKeyAction({ key: "p" }), "run");
  assertEquals(resolveWorkbenchTerminalOutputKeyAction({ key: "S" }), "stop");
  assertEquals(resolveWorkbenchTerminalOutputKeyAction({ key: "u" }), "restart");
  assertEquals(resolveWorkbenchTerminalOutputKeyAction({ key: "k" }), "clear");
  assertEquals(resolveWorkbenchTerminalOutputKeyAction({ key: "v" }), "follow");
  assertEquals(resolveWorkbenchTerminalOutputKeyAction({ key: "y" }), "copy");
  assertEquals(resolveWorkbenchTerminalOutputKeyAction({ key: "i" }), "raw");
  assertEquals(resolveWorkbenchTerminalOutputKeyAction({ key: "p", ctrl: true }), undefined);
  assertEquals(resolveWorkbenchTerminalOutputKeyAction({ key: "p", meta: true }), undefined);
  assertEquals(resolveWorkbenchTerminalOutputKeyAction({ key: "x" }), undefined);
});

Deno.test("resolveWorkbenchTerminalShellKeyAction maps shell workbench shortcuts", () => {
  assertEquals(resolveWorkbenchTerminalShellKeyAction({ key: "pageup" }), "copyPageUp");
  assertEquals(resolveWorkbenchTerminalShellKeyAction({ key: "pagedown" }), "copyPageDown");
  assertEquals(resolveWorkbenchTerminalShellKeyAction({ key: "p" }), "start");
  assertEquals(resolveWorkbenchTerminalShellKeyAction({ key: "S" }), "stop");
  assertEquals(resolveWorkbenchTerminalShellKeyAction({ key: "u" }), "restart");
  assertEquals(resolveWorkbenchTerminalShellKeyAction({ key: "k" }), "clear");
  assertEquals(resolveWorkbenchTerminalShellKeyAction({ key: "n" }), "new");
  assertEquals(resolveWorkbenchTerminalShellKeyAction({ key: "N", shift: true }), "new");
  assertEquals(resolveWorkbenchTerminalShellKeyAction({ key: "-" }), "splitRow");
  assertEquals(resolveWorkbenchTerminalShellKeyAction({ key: "\\" }), "splitColumn");
  assertEquals(resolveWorkbenchTerminalShellKeyAction({ key: "z" }), "zoomPane");
  assertEquals(resolveWorkbenchTerminalShellKeyAction({ key: "," }), "previous");
  assertEquals(resolveWorkbenchTerminalShellKeyAction({ key: "." }), "next");
  assertEquals(resolveWorkbenchTerminalShellKeyAction({ key: "i" }), "raw");
  assertEquals(resolveWorkbenchTerminalShellKeyAction({ key: "/" }), "search");
  assertEquals(resolveWorkbenchTerminalShellKeyAction({ key: "home" }), "top");
  assertEquals(resolveWorkbenchTerminalShellKeyAction({ key: "end" }), "bottom");
  assertEquals(resolveWorkbenchTerminalShellKeyAction({ key: "p", ctrl: true }), undefined);
  assertEquals(resolveWorkbenchTerminalShellKeyAction({ key: "x" }), undefined);
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
