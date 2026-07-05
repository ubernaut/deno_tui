// Copyright 2023 Im-Beast. MIT license.
import type { TerminalOutputController, TerminalOutputInspection } from "../components/terminal_output.ts";
import type { ProcessSessionController, ProcessSessionInspection } from "../runtime/process_session.ts";
import type {
  TerminalShellWorkspaceController,
  TerminalShellWorkspaceInspection,
} from "../runtime/terminal_shell_workspace.ts";
import { isSpawnTerminalTemplate, shellTerminalTemplate } from "../runtime/terminal_templates.ts";
import type {
  TerminalWorkspaceController,
  TerminalWorkspaceInspection,
  TerminalWorkspacePaneRect,
} from "../runtime/terminal_workspace.ts";
import type { Action } from "./actions.ts";
import type { Command, CommandRegistry } from "./commands.ts";

export * from "./terminal_scrollback_commands.ts";

/** Identifier union for terminal process command variants. */
export type TerminalCommandKind = "run" | "stop" | "restart" | "clear" | "toggleFollow" | "copyCommand";

/** Action union emitted by terminal command helpers. */
export type TerminalCommandAction =
  | Action<"terminal.run", TerminalCommandPayload>
  | Action<"terminal.stopped", TerminalCommandPayload>
  | Action<"terminal.restarted", TerminalCommandPayload>
  | Action<"terminal.cleared", TerminalCommandPayload>
  | Action<"terminal.followChanged", TerminalCommandPayload & { follow: boolean }>
  | Action<"terminal.commandCopied", TerminalCommandPayload & { commandLine: string }>;

/** Payload carried by terminal command actions. */
export interface TerminalCommandPayload {
  id: string;
  session: ProcessSessionInspection;
  output?: TerminalOutputInspection;
}

/** Options for configuring terminal commands. */
export interface TerminalCommandOptions {
  id?: string;
  idPrefix?: string;
  group?: string;
  output?: TerminalOutputController;
  includeRun?: boolean;
  includeStop?: boolean;
  includeRestart?: boolean;
  includeClear?: boolean;
  includeToggleFollow?: boolean;
  includeCopyCommand?: boolean;
  labels?: Partial<Record<TerminalCommandKind, string>>;
}

/** Identifier union for terminal workspace command variants. */
export type TerminalWorkspaceCommandKind =
  | "splitRow"
  | "splitColumn"
  | "zoom"
  | "closePane"
  | "nextPane"
  | "previousPane"
  | "focusLeft"
  | "focusRight"
  | "focusUp"
  | "focusDown"
  | "growActive"
  | "shrinkActive"
  | "closeSession"
  | "renameSession"
  | "duplicateSession"
  | "previousSession"
  | "nextSession"
  | "moveSessionPrevious"
  | "moveSessionNext"
  | "restartSession"
  | "detachSession"
  | "attachSession";

/** Action union emitted by terminal workspace command helpers. */
export type TerminalWorkspaceCommandAction =
  | Action<"terminalWorkspace.split", TerminalWorkspaceCommandPayload & { direction: "row" | "column" }>
  | Action<"terminalWorkspace.zoomChanged", TerminalWorkspaceCommandPayload>
  | Action<"terminalWorkspace.paneClosed", TerminalWorkspaceCommandPayload>
  | Action<"terminalWorkspace.paneActivated", TerminalWorkspaceCommandPayload>
  | Action<"terminalWorkspace.paneResized", TerminalWorkspaceCommandPayload & { delta: number }>
  | Action<"terminalWorkspace.sessionClosed", TerminalWorkspaceCommandPayload>
  | Action<"terminalWorkspace.sessionRenamed", TerminalWorkspaceCommandPayload & { title: string }>
  | Action<"terminalWorkspace.sessionDuplicated", TerminalWorkspaceCommandPayload>
  | Action<"terminalWorkspace.sessionActivated", TerminalWorkspaceCommandPayload>
  | Action<"terminalWorkspace.sessionMoved", TerminalWorkspaceCommandPayload & { delta: number }>
  | Action<"terminalWorkspace.sessionRestarted", TerminalWorkspaceCommandPayload>
  | Action<"terminalWorkspace.sessionDetached", TerminalWorkspaceCommandPayload>
  | Action<"terminalWorkspace.sessionAttached", TerminalWorkspaceCommandPayload>;

/** Payload carried by terminal workspace command actions. */
export interface TerminalWorkspaceCommandPayload {
  id: string;
  paneId?: string;
  sessionId?: string;
  workspace: TerminalWorkspaceInspection;
}

/** Options for configuring terminal workspace commands. */
export interface TerminalWorkspaceCommandOptions {
  id?: string;
  idPrefix?: string;
  group?: string;
  sessionId?: string | (() => string | undefined);
  renameTitle?: string | (() => string | undefined);
  resizeStep?: number;
  includeSplitCommands?: boolean;
  includeZoom?: boolean;
  includeClosePane?: boolean;
  includeFocusCommands?: boolean;
  paneRects?: readonly TerminalWorkspacePaneRect[] | (() => readonly TerminalWorkspacePaneRect[]);
  includeResizeCommands?: boolean;
  includeSessionCommands?: boolean;
  labels?: Partial<Record<TerminalWorkspaceCommandKind, string>>;
}

/** Identifier union for live shell workspace command variants. */
export type TerminalShellWorkspaceCommandKind =
  | "newShell"
  | "start"
  | "stop"
  | "restart"
  | "previousSession"
  | "nextSession"
  | "closeSession"
  | "sync";

/** Action union emitted by live shell workspace command helpers. */
export type TerminalShellWorkspaceCommandAction =
  | Action<"terminalShellWorkspace.sessionAdded", TerminalShellWorkspaceCommandPayload>
  | Action<"terminalShellWorkspace.sessionStarted", TerminalShellWorkspaceCommandPayload>
  | Action<"terminalShellWorkspace.sessionStopped", TerminalShellWorkspaceCommandPayload>
  | Action<"terminalShellWorkspace.sessionRestarted", TerminalShellWorkspaceCommandPayload>
  | Action<"terminalShellWorkspace.sessionActivated", TerminalShellWorkspaceCommandPayload>
  | Action<"terminalShellWorkspace.sessionClosed", TerminalShellWorkspaceCommandPayload>
  | Action<"terminalShellWorkspace.synced", TerminalShellWorkspaceCommandPayload>;

/** Payload carried by live shell workspace command actions. */
export interface TerminalShellWorkspaceCommandPayload {
  id: string;
  sessionId?: string;
  shellWorkspace: TerminalShellWorkspaceInspection;
}

/** Options for configuring live shell workspace commands. */
export interface TerminalShellWorkspaceCommandOptions {
  id?: string;
  idPrefix?: string;
  group?: string;
  shellTitle?: string | (() => string | undefined);
  includeSessionCommands?: boolean;
  includeLifecycleCommands?: boolean;
  labels?: Partial<Record<TerminalShellWorkspaceCommandKind, string>>;
}

/** Builds command definitions for process-backed terminal output windows. */
export function terminalCommands<TAction extends Action = TerminalCommandAction>(
  session: ProcessSessionController,
  options: TerminalCommandOptions = {},
): Command<TAction>[] {
  const id = options.id ?? "terminal";
  const idPrefix = options.idPrefix ?? "terminal";
  const group = options.group ?? "terminal";
  const label = (kind: TerminalCommandKind, fallback: string) => options.labels?.[kind] ?? fallback;
  const payload = (): TerminalCommandPayload => {
    const next: TerminalCommandPayload = {
      id,
      session: session.inspect(),
    };
    if (options.output) next.output = options.output.inspect();
    return next;
  };
  const commands: Command<TAction>[] = [];

  if (options.includeRun ?? true) {
    commands.push({
      id: `${idPrefix}.run`,
      label: label("run", "Run Terminal Command"),
      group,
      keywords: ["terminal", "process", "run", "start"],
      disabled: () => session.running,
      action: async () => {
        await session.start();
        return { type: "terminal.run", payload: payload() } as TAction;
      },
    });
  }

  if (options.includeStop ?? true) {
    commands.push({
      id: `${idPrefix}.stop`,
      label: label("stop", "Stop Terminal Command"),
      group,
      keywords: ["terminal", "process", "stop", "kill"],
      disabled: () => !session.running,
      action: async () => {
        await session.stop();
        return { type: "terminal.stopped", payload: payload() } as TAction;
      },
    });
  }

  if (options.includeRestart ?? true) {
    commands.push({
      id: `${idPrefix}.restart`,
      label: label("restart", "Restart Terminal Command"),
      group,
      keywords: ["terminal", "process", "restart", "rerun"],
      action: async () => {
        await session.restart();
        return { type: "terminal.restarted", payload: payload() } as TAction;
      },
    });
  }

  if (options.includeClear ?? true) {
    commands.push({
      id: `${idPrefix}.clear`,
      label: label("clear", "Clear Terminal Output"),
      group,
      keywords: ["terminal", "process", "clear", "scrollback"],
      disabled: () => session.output.lines.peek().length === 0,
      action: () => {
        session.clearOutput();
        return { type: "terminal.cleared", payload: payload() } as TAction;
      },
    });
  }

  if (options.includeToggleFollow ?? true) {
    commands.push({
      id: `${idPrefix}.toggleFollow`,
      label: label("toggleFollow", "Toggle Terminal Follow"),
      group,
      keywords: ["terminal", "process", "follow", "tail"],
      action: () => {
        const follow = (options.output ?? session.output).toggleFollow();
        return { type: "terminal.followChanged", payload: { ...payload(), follow } } as TAction;
      },
    });
  }

  if (options.includeCopyCommand ?? true) {
    commands.push({
      id: `${idPrefix}.copyCommand`,
      label: label("copyCommand", "Copy Terminal Command"),
      group,
      keywords: ["terminal", "process", "copy", "command"],
      action: () => {
        const commandLine = session.inspect().commandLine;
        return { type: "terminal.commandCopied", payload: { ...payload(), commandLine } } as TAction;
      },
    });
  }

  return commands;
}

/** Binds terminal Commands behavior and returns a disposer when applicable. */
export function bindTerminalCommands<TAction extends Action = TerminalCommandAction>(
  registry: CommandRegistry<TAction>,
  session: ProcessSessionController,
  options: TerminalCommandOptions = {},
): () => void {
  return registry.registerAll(terminalCommands<TAction>(session, options));
}

/** Builds command definitions for tmux-like terminal workspace panes. */
export function terminalWorkspaceCommands<TAction extends Action = TerminalWorkspaceCommandAction>(
  workspace: TerminalWorkspaceController,
  options: TerminalWorkspaceCommandOptions = {},
): Command<TAction>[] {
  const id = options.id ?? "terminal-workspace";
  const idPrefix = options.idPrefix ?? "terminalWorkspace";
  const group = options.group ?? "terminal";
  const resizeStep = Math.max(0.01, Math.min(0.25, options.resizeStep ?? 0.05));
  const label = (kind: TerminalWorkspaceCommandKind, fallback: string) => options.labels?.[kind] ?? fallback;
  const sessionId = () => typeof options.sessionId === "function" ? options.sessionId() : options.sessionId;
  const renameTitle = () => typeof options.renameTitle === "function" ? options.renameTitle() : options.renameTitle;
  const targetSessionId = () => sessionId() ?? workspace.inspect().activeId;
  const activePaneId = () => workspace.inspectLayout().activePaneId;
  const payload = (paneId = activePaneId()): TerminalWorkspaceCommandPayload => {
    const inspection = workspace.inspect();
    return {
      id,
      paneId,
      sessionId: paneId ? terminalWorkspacePaneSessionId(inspection, paneId) : inspection.activeId,
      workspace: inspection,
    };
  };
  const commands: Command<TAction>[] = [];

  if (options.includeSplitCommands ?? true) {
    commands.push(
      {
        id: `${idPrefix}.split.row`,
        label: label("splitRow", "Split Terminal Horizontally"),
        group,
        keywords: ["terminal", "workspace", "pane", "split", "horizontal"],
        disabled: () => !targetSessionId(),
        action: () => {
          const pane = workspace.splitActive("row", targetSessionId()!);
          return {
            type: "terminalWorkspace.split",
            payload: { ...payload(pane?.id), direction: "row" },
          } as TAction;
        },
      },
      {
        id: `${idPrefix}.split.column`,
        label: label("splitColumn", "Split Terminal Vertically"),
        group,
        keywords: ["terminal", "workspace", "pane", "split", "vertical"],
        disabled: () => !targetSessionId(),
        action: () => {
          const pane = workspace.splitActive("column", targetSessionId()!);
          return {
            type: "terminalWorkspace.split",
            payload: { ...payload(pane?.id), direction: "column" },
          } as TAction;
        },
      },
    );
  }

  if (options.includeZoom ?? true) {
    commands.push({
      id: `${idPrefix}.zoom`,
      label: label("zoom", "Toggle Terminal Pane Zoom"),
      group,
      keywords: ["terminal", "workspace", "pane", "zoom", "fullscreen"],
      disabled: () => !activePaneId(),
      action: () => {
        workspace.toggleZoomPane();
        return { type: "terminalWorkspace.zoomChanged", payload: payload() } as TAction;
      },
    });
  }

  if (options.includeClosePane ?? true) {
    commands.push({
      id: `${idPrefix}.closePane`,
      label: label("closePane", "Close Terminal Pane"),
      group,
      keywords: ["terminal", "workspace", "pane", "close"],
      disabled: () => !activePaneId(),
      action: () => {
        const paneId = activePaneId();
        if (paneId) workspace.closePane(paneId);
        return { type: "terminalWorkspace.paneClosed", payload: payload(paneId) } as TAction;
      },
    });
  }

  if (options.includeFocusCommands ?? true) {
    commands.push(
      terminalPaneFocusCommand(workspace, id, idPrefix, group, "nextPane", "Next Terminal Pane", 1, label),
      terminalPaneFocusCommand(workspace, id, idPrefix, group, "previousPane", "Previous Terminal Pane", -1, label),
      terminalPaneDirectionalFocusCommand(
        workspace,
        options.paneRects,
        id,
        idPrefix,
        group,
        "focusLeft",
        "Focus Terminal Pane Left",
        "left",
        label,
      ),
      terminalPaneDirectionalFocusCommand(
        workspace,
        options.paneRects,
        id,
        idPrefix,
        group,
        "focusRight",
        "Focus Terminal Pane Right",
        "right",
        label,
      ),
      terminalPaneDirectionalFocusCommand(
        workspace,
        options.paneRects,
        id,
        idPrefix,
        group,
        "focusUp",
        "Focus Terminal Pane Up",
        "up",
        label,
      ),
      terminalPaneDirectionalFocusCommand(
        workspace,
        options.paneRects,
        id,
        idPrefix,
        group,
        "focusDown",
        "Focus Terminal Pane Down",
        "down",
        label,
      ),
    );
  }

  if (options.includeResizeCommands ?? true) {
    commands.push(
      terminalPaneResizeCommand(
        workspace,
        id,
        idPrefix,
        group,
        "growActive",
        "Grow Active Terminal Pane",
        resizeStep,
        label,
      ),
      terminalPaneResizeCommand(
        workspace,
        id,
        idPrefix,
        group,
        "shrinkActive",
        "Shrink Active Terminal Pane",
        -resizeStep,
        label,
      ),
    );
  }

  if (options.includeSessionCommands ?? true) {
    commands.push(
      {
        id: `${idPrefix}.closeSession`,
        label: label("closeSession", "Close Terminal Session"),
        group,
        keywords: ["terminal", "workspace", "session", "tab", "close", "remove"],
        disabled: () => !workspace.inspect().activeId,
        action: () => {
          const sessionId = workspace.inspect().activeId;
          if (sessionId) workspace.remove(sessionId);
          return {
            type: "terminalWorkspace.sessionClosed",
            payload: terminalWorkspacePayload(workspace, id, undefined, sessionId),
          } as TAction;
        },
      },
      {
        id: `${idPrefix}.renameSession`,
        label: label("renameSession", "Rename Terminal Session"),
        group,
        keywords: ["terminal", "workspace", "session", "tab", "rename", "title"],
        disabled: () => !targetSessionId() || !renameTitle()?.trim(),
        action: () => {
          const target = targetSessionId();
          const title = renameTitle()?.trim() ?? "";
          if (target && title) workspace.rename(target, title);
          return {
            type: "terminalWorkspace.sessionRenamed",
            payload: { ...terminalWorkspacePayload(workspace, id, undefined, target), title },
          } as TAction;
        },
      },
      {
        id: `${idPrefix}.duplicateSession`,
        label: label("duplicateSession", "Duplicate Terminal Session"),
        group,
        keywords: ["terminal", "workspace", "session", "tab", "duplicate", "copy"],
        disabled: () => !workspace.inspect().activeId,
        action: () => {
          const duplicate = workspace.duplicate(workspace.inspect().activeId);
          return {
            type: "terminalWorkspace.sessionDuplicated",
            payload: terminalWorkspacePayload(workspace, id, undefined, duplicate?.id),
          } as TAction;
        },
      },
      terminalSessionActivateRelativeCommand(
        workspace,
        id,
        idPrefix,
        group,
        "previousSession",
        "Previous Terminal Session",
        -1,
        label,
      ),
      terminalSessionActivateRelativeCommand(
        workspace,
        id,
        idPrefix,
        group,
        "nextSession",
        "Next Terminal Session",
        1,
        label,
      ),
      terminalSessionMoveCommand(
        workspace,
        id,
        idPrefix,
        group,
        "moveSessionPrevious",
        "Move Terminal Session Left",
        -1,
        label,
      ),
      terminalSessionMoveCommand(
        workspace,
        id,
        idPrefix,
        group,
        "moveSessionNext",
        "Move Terminal Session Right",
        1,
        label,
      ),
      {
        id: `${idPrefix}.restartSession`,
        label: label("restartSession", "Restart Terminal Session"),
        group,
        keywords: ["terminal", "workspace", "session", "tab", "restart", "rerun"],
        disabled: () => {
          const active = workspace.inspect().active;
          return !active || !isSpawnTerminalTemplate(active.template);
        },
        action: () => {
          const sessionId = workspace.inspect().activeId;
          if (sessionId) workspace.restart(sessionId);
          return {
            type: "terminalWorkspace.sessionRestarted",
            payload: terminalWorkspacePayload(workspace, id, undefined, sessionId),
          } as TAction;
        },
      },
      {
        id: `${idPrefix}.detachSession`,
        label: label("detachSession", "Detach Terminal Session"),
        group,
        keywords: ["terminal", "workspace", "session", "tab", "detach"],
        disabled: () => {
          const active = workspace.inspect().active;
          return !active || active.detached === true || !active.reconnectable;
        },
        action: () => {
          const sessionId = workspace.inspect().activeId;
          if (sessionId) workspace.detach(sessionId);
          return {
            type: "terminalWorkspace.sessionDetached",
            payload: terminalWorkspacePayload(workspace, id, undefined, sessionId),
          } as TAction;
        },
      },
      {
        id: `${idPrefix}.attachSession`,
        label: label("attachSession", "Attach Terminal Session"),
        group,
        keywords: ["terminal", "workspace", "session", "tab", "attach", "reconnect"],
        disabled: () => !terminalWorkspaceDetachedSessionId(workspace.inspect()),
        action: () => {
          const inspection = workspace.inspect();
          const sessionId = terminalWorkspaceDetachedSessionId(inspection);
          if (sessionId) workspace.attach(sessionId);
          return {
            type: "terminalWorkspace.sessionAttached",
            payload: terminalWorkspacePayload(workspace, id, undefined, sessionId),
          } as TAction;
        },
      },
    );
  }

  return commands;
}

/** Binds terminal workspace Commands behavior and returns a disposer when applicable. */
export function bindTerminalWorkspaceCommands<TAction extends Action = TerminalWorkspaceCommandAction>(
  registry: CommandRegistry<TAction>,
  workspace: TerminalWorkspaceController,
  options: TerminalWorkspaceCommandOptions = {},
): () => void {
  return registry.registerAll(terminalWorkspaceCommands<TAction>(workspace, options));
}

/** Builds command definitions for live multi-session shell workspaces. */
export function terminalShellWorkspaceCommands<TAction extends Action = TerminalShellWorkspaceCommandAction>(
  shellWorkspace: TerminalShellWorkspaceController,
  options: TerminalShellWorkspaceCommandOptions = {},
): Command<TAction>[] {
  const id = options.id ?? "terminal-shell-workspace";
  const idPrefix = options.idPrefix ?? "terminalShellWorkspace";
  const group = options.group ?? "terminal";
  const label = (kind: TerminalShellWorkspaceCommandKind, fallback: string) => options.labels?.[kind] ?? fallback;
  const shellTitle = () => typeof options.shellTitle === "function" ? options.shellTitle() : options.shellTitle;
  const payload = (sessionId = shellWorkspace.workspace.activeId.peek()): TerminalShellWorkspaceCommandPayload => ({
    id,
    sessionId,
    shellWorkspace: shellWorkspace.inspect(),
  });
  const commands: Command<TAction>[] = [];

  if (options.includeSessionCommands ?? true) {
    commands.push(
      {
        id: `${idPrefix}.newShell`,
        label: label("newShell", "New Shell Session"),
        group,
        keywords: ["terminal", "shell", "workspace", "session", "tab", "new"],
        action: () => {
          const descriptor = shellWorkspace.add(
            shellTerminalTemplate({
              id: nextTerminalShellWorkspaceSessionId(shellWorkspace.inspect()),
              title: shellTitle()?.trim() || undefined,
            }),
            { activate: true },
          );
          return {
            type: "terminalShellWorkspace.sessionAdded",
            payload: payload(descriptor.id),
          } as TAction;
        },
      },
      terminalShellWorkspaceActivateCommand(
        shellWorkspace,
        id,
        idPrefix,
        group,
        "previousSession",
        "Previous Shell Session",
        -1,
        label,
      ),
      terminalShellWorkspaceActivateCommand(
        shellWorkspace,
        id,
        idPrefix,
        group,
        "nextSession",
        "Next Shell Session",
        1,
        label,
      ),
      {
        id: `${idPrefix}.closeSession`,
        label: label("closeSession", "Close Shell Session"),
        group,
        keywords: ["terminal", "shell", "workspace", "session", "tab", "close"],
        disabled: () => !shellWorkspace.workspace.activeId.peek(),
        action: async () => {
          const sessionId = shellWorkspace.workspace.activeId.peek();
          if (sessionId) await shellWorkspace.remove(sessionId);
          return {
            type: "terminalShellWorkspace.sessionClosed",
            payload: payload(sessionId),
          } as TAction;
        },
      },
      {
        id: `${idPrefix}.sync`,
        label: label("sync", "Sync Shell Workspace"),
        group,
        keywords: ["terminal", "shell", "workspace", "session", "sync", "status"],
        action: () => {
          shellWorkspace.sync();
          return {
            type: "terminalShellWorkspace.synced",
            payload: payload(),
          } as TAction;
        },
      },
    );
  }

  if (options.includeLifecycleCommands ?? true) {
    commands.push(
      terminalShellWorkspaceLifecycleCommand(
        shellWorkspace,
        id,
        idPrefix,
        group,
        "start",
        "Start Shell Session",
        label,
      ),
      terminalShellWorkspaceLifecycleCommand(
        shellWorkspace,
        id,
        idPrefix,
        group,
        "stop",
        "Stop Shell Session",
        label,
      ),
      terminalShellWorkspaceLifecycleCommand(
        shellWorkspace,
        id,
        idPrefix,
        group,
        "restart",
        "Restart Shell Session",
        label,
      ),
    );
  }

  return commands;
}

/** Binds live shell workspace Commands behavior and returns a disposer when applicable. */
export function bindTerminalShellWorkspaceCommands<TAction extends Action = TerminalShellWorkspaceCommandAction>(
  registry: CommandRegistry<TAction>,
  shellWorkspace: TerminalShellWorkspaceController,
  options: TerminalShellWorkspaceCommandOptions = {},
): () => void {
  return registry.registerAll(terminalShellWorkspaceCommands<TAction>(shellWorkspace, options));
}

function terminalShellWorkspaceActivateCommand<TAction extends Action>(
  shellWorkspace: TerminalShellWorkspaceController,
  id: string,
  idPrefix: string,
  group: string,
  kind: "previousSession" | "nextSession",
  fallback: string,
  delta: number,
  label: (kind: TerminalShellWorkspaceCommandKind, fallback: string) => string,
): Command<TAction> {
  return {
    id: `${idPrefix}.${kind}`,
    label: label(kind, fallback),
    group,
    keywords: ["terminal", "shell", "workspace", "session", "tab", delta < 0 ? "previous" : "next"],
    disabled: () => shellWorkspace.workspace.inspect().sessions.length < 2,
    action: () => {
      const descriptor = shellWorkspace.activateRelative(delta);
      return {
        type: "terminalShellWorkspace.sessionActivated",
        payload: {
          id,
          sessionId: descriptor?.id,
          shellWorkspace: shellWorkspace.inspect(),
        },
      } as TAction;
    },
  };
}

function terminalShellWorkspaceLifecycleCommand<TAction extends Action>(
  shellWorkspace: TerminalShellWorkspaceController,
  id: string,
  idPrefix: string,
  group: string,
  kind: "start" | "stop" | "restart",
  fallback: string,
  label: (kind: TerminalShellWorkspaceCommandKind, fallback: string) => string,
): Command<TAction> {
  return {
    id: `${idPrefix}.${kind}`,
    label: label(kind, fallback),
    group,
    keywords: ["terminal", "shell", "workspace", "session", kind],
    disabled: () => {
      const shell = shellWorkspace.activeShell;
      if (!shell) return true;
      if (kind === "start") return shell.running || shell.status.peek() === "starting";
      if (kind === "stop") return !shell.running;
      return shell.status.peek() === "starting";
    },
    action: async () => {
      const sessionId = shellWorkspace.workspace.activeId.peek();
      if (kind === "start") await shellWorkspace.start(sessionId);
      else if (kind === "stop") await shellWorkspace.stop(sessionId);
      else await shellWorkspace.restart(sessionId);
      const type = kind === "start"
        ? "terminalShellWorkspace.sessionStarted"
        : kind === "stop"
        ? "terminalShellWorkspace.sessionStopped"
        : "terminalShellWorkspace.sessionRestarted";
      return {
        type,
        payload: {
          id,
          sessionId,
          shellWorkspace: shellWorkspace.inspect(),
        },
      } as TAction;
    },
  };
}

function nextTerminalShellWorkspaceSessionId(inspection: TerminalShellWorkspaceInspection): string {
  let counter = inspection.workspace.sessions.length + 1;
  while (terminalShellWorkspaceHasSessionId(inspection, `shell-${counter}`)) counter += 1;
  return `shell-${counter}`;
}

function terminalShellWorkspaceHasSessionId(inspection: TerminalShellWorkspaceInspection, id: string): boolean {
  for (let index = 0; index < inspection.workspace.sessions.length; index += 1) {
    if (inspection.workspace.sessions[index]?.id === id) return true;
  }
  return false;
}

function terminalSessionActivateRelativeCommand<TAction extends Action>(
  workspace: TerminalWorkspaceController,
  id: string,
  idPrefix: string,
  group: string,
  kind: "previousSession" | "nextSession",
  fallback: string,
  delta: number,
  label: (kind: TerminalWorkspaceCommandKind, fallback: string) => string,
): Command<TAction> {
  return {
    id: `${idPrefix}.${kind}`,
    label: label(kind, fallback),
    group,
    keywords: ["terminal", "workspace", "session", "tab", "activate", delta < 0 ? "previous" : "next"],
    disabled: () => {
      const inspection = workspace.inspect();
      return inspection.sessions.length < 2 || !inspection.activeId;
    },
    action: () => {
      const session = workspace.activateRelative(delta);
      return {
        type: "terminalWorkspace.sessionActivated",
        payload: terminalWorkspacePayload(workspace, id, undefined, session?.id),
      } as TAction;
    },
  };
}

function terminalSessionMoveCommand<TAction extends Action>(
  workspace: TerminalWorkspaceController,
  id: string,
  idPrefix: string,
  group: string,
  kind: "moveSessionPrevious" | "moveSessionNext",
  fallback: string,
  delta: number,
  label: (kind: TerminalWorkspaceCommandKind, fallback: string) => string,
): Command<TAction> {
  return {
    id: `${idPrefix}.${kind}`,
    label: label(kind, fallback),
    group,
    keywords: ["terminal", "workspace", "session", "tab", "move", delta < 0 ? "previous" : "next"],
    disabled: () => {
      const inspection = workspace.inspect();
      return inspection.sessions.length < 2 || !inspection.activeId;
    },
    action: () => {
      const sessionId = workspace.inspect().activeId;
      if (sessionId) workspace.move(sessionId, delta);
      return {
        type: "terminalWorkspace.sessionMoved",
        payload: { ...terminalWorkspacePayload(workspace, id, undefined, sessionId), delta },
      } as TAction;
    },
  };
}

function terminalPaneFocusCommand<TAction extends Action>(
  workspace: TerminalWorkspaceController,
  id: string,
  idPrefix: string,
  group: string,
  kind: "nextPane" | "previousPane",
  fallback: string,
  delta: number,
  label: (kind: TerminalWorkspaceCommandKind, fallback: string) => string,
): Command<TAction> {
  return {
    id: `${idPrefix}.${kind}`,
    label: label(kind, fallback),
    group,
    keywords: ["terminal", "workspace", "pane", "focus", delta > 0 ? "next" : "previous"],
    disabled: () => workspace.inspectLayout().count < 2,
    action: () => {
      const layout = workspace.inspectLayout();
      const index = Math.max(0, layout.panes.findIndex((pane) => pane.id === layout.activePaneId));
      const next = layout.panes[(index + delta + layout.panes.length) % layout.panes.length];
      if (next) workspace.activatePane(next.id);
      return {
        type: "terminalWorkspace.paneActivated",
        payload: terminalWorkspacePayload(workspace, id, next?.id),
      } as TAction;
    },
  };
}

type TerminalPaneFocusDirection = "left" | "right" | "up" | "down";

function terminalPaneDirectionalFocusCommand<TAction extends Action>(
  workspace: TerminalWorkspaceController,
  paneRects: TerminalWorkspaceCommandOptions["paneRects"],
  id: string,
  idPrefix: string,
  group: string,
  kind: "focusLeft" | "focusRight" | "focusUp" | "focusDown",
  fallback: string,
  direction: TerminalPaneFocusDirection,
  label: (kind: TerminalWorkspaceCommandKind, fallback: string) => string,
): Command<TAction> {
  const rects = () => typeof paneRects === "function" ? paneRects() : paneRects;
  return {
    id: `${idPrefix}.${kind}`,
    label: label(kind, fallback),
    group,
    keywords: ["terminal", "workspace", "pane", "focus", direction],
    disabled: () => !nearestTerminalPaneInDirection(rects(), workspace.inspectLayout().activePaneId, direction),
    action: () => {
      const next = nearestTerminalPaneInDirection(rects(), workspace.inspectLayout().activePaneId, direction);
      if (next) workspace.activatePane(next.pane.id);
      return {
        type: "terminalWorkspace.paneActivated",
        payload: terminalWorkspacePayload(workspace, id, next?.pane.id),
      } as TAction;
    },
  };
}

function nearestTerminalPaneInDirection(
  rects: readonly TerminalWorkspacePaneRect[] | undefined,
  activePaneId: string | undefined,
  direction: TerminalPaneFocusDirection,
): TerminalWorkspacePaneRect | undefined {
  if (!rects || !activePaneId) return undefined;
  let active: TerminalWorkspacePaneRect | undefined;
  for (let index = 0; index < rects.length; index += 1) {
    const entry = rects[index]!;
    if (entry.pane.id === activePaneId) {
      active = entry;
      break;
    }
  }
  if (!active) return undefined;

  const activeCenterColumn = active.rect.column + active.rect.width / 2;
  const activeCenterRow = active.rect.row + active.rect.height / 2;
  let best: TerminalWorkspacePaneRect | undefined;
  let bestScore = Number.POSITIVE_INFINITY;

  for (let index = 0; index < rects.length; index += 1) {
    const candidate = rects[index]!;
    if (candidate.pane.id === activePaneId) continue;
    const candidateCenterColumn = candidate.rect.column + candidate.rect.width / 2;
    const candidateCenterRow = candidate.rect.row + candidate.rect.height / 2;
    const deltaColumn = candidateCenterColumn - activeCenterColumn;
    const deltaRow = candidateCenterRow - activeCenterRow;
    const primary = direction === "left"
      ? -deltaColumn
      : direction === "right"
      ? deltaColumn
      : direction === "up"
      ? -deltaRow
      : deltaRow;
    if (primary <= 0) continue;
    const secondary = direction === "left" || direction === "right" ? Math.abs(deltaRow) : Math.abs(deltaColumn);
    const overlap = direction === "left" || direction === "right"
      ? rectRangeOverlap(active.rect.row, active.rect.height, candidate.rect.row, candidate.rect.height)
      : rectRangeOverlap(active.rect.column, active.rect.width, candidate.rect.column, candidate.rect.width);
    const alignmentPenalty = overlap > 0 ? 0 : 1_000_000;
    const score = alignmentPenalty + primary * 1000 + secondary - overlap;
    if (score < bestScore) {
      best = candidate;
      bestScore = score;
    }
  }

  return best;
}

function rectRangeOverlap(start: number, size: number, candidateStart: number, candidateSize: number): number {
  return Math.max(0, Math.min(start + size, candidateStart + candidateSize) - Math.max(start, candidateStart));
}

function terminalPaneResizeCommand<TAction extends Action>(
  workspace: TerminalWorkspaceController,
  id: string,
  idPrefix: string,
  group: string,
  kind: "growActive" | "shrinkActive",
  fallback: string,
  delta: number,
  label: (kind: TerminalWorkspaceCommandKind, fallback: string) => string,
): Command<TAction> {
  return {
    id: `${idPrefix}.${kind}`,
    label: label(kind, fallback),
    group,
    keywords: ["terminal", "workspace", "pane", "resize", delta > 0 ? "grow" : "shrink"],
    disabled: () => workspace.inspectLayout().count < 2,
    action: () => {
      workspace.resizeActiveSplit(delta);
      return {
        type: "terminalWorkspace.paneResized",
        payload: { ...terminalWorkspacePayload(workspace, id), delta },
      } as TAction;
    },
  };
}

function terminalWorkspacePayload(
  workspace: TerminalWorkspaceController,
  id: string,
  paneId = workspace.inspectLayout().activePaneId,
  sessionIdOverride?: string,
): TerminalWorkspaceCommandPayload {
  const inspection = workspace.inspect();
  return {
    id,
    paneId,
    sessionId: sessionIdOverride ??
      (paneId ? terminalWorkspacePaneSessionId(inspection, paneId) : inspection.activeId),
    workspace: inspection,
  };
}

function terminalWorkspacePaneSessionId(
  inspection: TerminalWorkspaceInspection,
  paneId: string,
): string | undefined {
  for (const pane of inspection.layout.panes) {
    if (pane.id === paneId) return pane.sessionId;
  }
  return undefined;
}

function terminalWorkspaceDetachedSessionId(inspection: TerminalWorkspaceInspection): string | undefined {
  if (inspection.active?.detached) return inspection.active.id;
  for (const session of inspection.sessions) {
    if (session.detached) return session.id;
  }
  return undefined;
}
