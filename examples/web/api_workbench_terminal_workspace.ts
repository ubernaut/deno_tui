import {
  normalizeTerminalWorkspaceSnapshot,
  type TerminalWorkspaceSnapshot,
} from "../../src/runtime/terminal_workspace.ts";

export type WebTerminalWorkspaceSnapshot = Pick<TerminalWorkspaceSnapshot, "activeId" | "sessions" | "layout">;

export interface NormalizeWebTerminalWorkspaceSnapshotOptions {
  onError?: (error: unknown) => void;
}

export function defaultWebTerminalWorkspaceSnapshot(): WebTerminalWorkspaceSnapshot {
  return {
    activeId: "pages-shell",
    sessions: [
      {
        id: "pages-shell",
        title: "Pages Shell",
        template: { id: "pages-shell", title: "Pages Shell", kind: "command", command: "web-shell" },
        backendId: "browser-mock",
        commandLine: "web-shell",
        status: "running",
        running: true,
        columns: 80,
        rows: 12,
        reconnectable: false,
        restartPolicy: "never",
        createdAt: 0,
        updatedAt: 0,
      },
      {
        id: "remote-attach",
        title: "Remote Attach",
        template: {
          id: "remote-attach",
          title: "Remote Attach",
          kind: "attach",
          sessionId: "ws://localhost:8787/terminal",
          reconnectable: true,
        },
        backendId: "remote",
        status: "idle",
        running: false,
        reconnectable: true,
        restartPolicy: "never",
        createdAt: 0,
        updatedAt: 0,
      },
      {
        id: "ci-task",
        title: "CI Task",
        template: { id: "ci-task", title: "CI Task", kind: "deno-task", command: "deno", args: ["task", "health"] },
        backendId: "process-template",
        commandLine: "deno task health",
        status: "idle",
        running: false,
        columns: 100,
        rows: 30,
        reconnectable: false,
        restartPolicy: "on-failure",
        createdAt: 0,
        updatedAt: 0,
      },
    ],
    layout: {},
  };
}

export function normalizeWebTerminalWorkspaceSnapshot(
  value: unknown,
  options: NormalizeWebTerminalWorkspaceSnapshotOptions = {},
): TerminalWorkspaceSnapshot | undefined {
  if (!value || typeof value !== "object") return undefined;
  const candidate = value as Partial<TerminalWorkspaceSnapshot>;
  if (!Array.isArray(candidate.sessions) || candidate.sessions.length === 0) return undefined;
  try {
    return normalizeTerminalWorkspaceSnapshot(candidate as TerminalWorkspaceSnapshot);
  } catch (error) {
    options.onError?.(error);
    return undefined;
  }
}
