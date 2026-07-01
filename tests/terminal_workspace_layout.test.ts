import { assertEquals } from "./deps.ts";
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
  terminalWorkspacePaneRects,
  updateTerminalWorkspacePaneRuntimeTitles,
  updateTerminalWorkspaceSplitRatio,
} from "../src/runtime/terminal_workspace_layout.ts";

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
