import { assertEquals, assertNotEquals } from "./deps.ts";
import {
  defaultWebTerminalWorkspaceSnapshot,
  normalizeWebTerminalWorkspaceSnapshot,
} from "../examples/web/api_workbench_terminal_workspace.ts";

Deno.test("web api workbench terminal workspace default exposes browser demo sessions", () => {
  const snapshot = defaultWebTerminalWorkspaceSnapshot();

  assertEquals(snapshot.activeId, "pages-shell");
  assertEquals(snapshot.sessions.map((session) => session.id), ["pages-shell", "remote-attach", "ci-task"]);
  assertEquals(snapshot.sessions.map((session) => session.template.kind), ["command", "attach", "deno-task"]);
  assertEquals(snapshot.sessions[0]?.status, "running");
  assertEquals(snapshot.sessions[1]?.reconnectable, true);
  assertEquals(snapshot.sessions[2]?.restartPolicy, "on-failure");
});

Deno.test("web api workbench terminal workspace normalizer rejects non-workspace values", () => {
  assertEquals(normalizeWebTerminalWorkspaceSnapshot(undefined), undefined);
  assertEquals(normalizeWebTerminalWorkspaceSnapshot({}), undefined);
  assertEquals(normalizeWebTerminalWorkspaceSnapshot({ sessions: [], layout: {} }), undefined);
});

Deno.test("web api workbench terminal workspace normalizer clones and repairs active session", () => {
  const source = defaultWebTerminalWorkspaceSnapshot();
  const normalized = normalizeWebTerminalWorkspaceSnapshot({ ...source, activeId: "missing-session" });

  assertEquals(normalized?.version, 1);
  assertEquals(normalized?.activeId, "pages-shell");
  assertEquals(normalized?.sessions.map((session) => session.id), ["pages-shell", "remote-attach", "ci-task"]);
  assertNotEquals(normalized?.sessions, source.sessions);
  assertNotEquals(normalized?.sessions[0], source.sessions[0]);
});
