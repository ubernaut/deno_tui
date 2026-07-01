// Copyright 2023 Im-Beast. MIT license.
import type { TerminalOutputController, TerminalOutputInspection } from "../components/terminal_output.ts";
import type { ProcessSessionController, ProcessSessionInspection } from "../runtime/process_session.ts";
import type { TerminalScrollbackController, TerminalScrollbackInspection } from "../runtime/terminal_scrollback.ts";
import type { TerminalWorkspaceController, TerminalWorkspaceInspection } from "../runtime/terminal_workspace.ts";
import type { Action } from "./actions.ts";
import type { Command, CommandRegistry } from "./commands.ts";

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

/** Identifier union for terminal scrollback/copy-mode command variants. */
export type TerminalScrollbackCommandKind =
  | "toggleCopyMode"
  | "exitCopyMode"
  | "lineUp"
  | "lineDown"
  | "pageUp"
  | "pageDown"
  | "top"
  | "bottom"
  | "search"
  | "nextMatch"
  | "previousMatch"
  | "clearSelection"
  | "copySelection";

/** Action union emitted by terminal scrollback command helpers. */
export type TerminalScrollbackCommandAction =
  | Action<"terminalScrollback.modeChanged", TerminalScrollbackCommandPayload>
  | Action<"terminalScrollback.scrolled", TerminalScrollbackCommandPayload>
  | Action<"terminalScrollback.searched", TerminalScrollbackCommandPayload>
  | Action<"terminalScrollback.matchChanged", TerminalScrollbackCommandPayload>
  | Action<"terminalScrollback.selectionCleared", TerminalScrollbackCommandPayload>
  | Action<"terminalScrollback.selectionCopied", TerminalScrollbackCommandPayload & { text: string }>;

/** Payload carried by terminal scrollback command actions. */
export interface TerminalScrollbackCommandPayload {
  id: string;
  scrollback: TerminalScrollbackInspection;
}

/** Options for configuring terminal scrollback/copy-mode commands. */
export interface TerminalScrollbackCommandOptions {
  id?: string;
  idPrefix?: string;
  group?: string;
  searchQuery?: string | (() => string | undefined);
  includeModeCommands?: boolean;
  includeScrollCommands?: boolean;
  includeSearchCommands?: boolean;
  includeSelectionCommands?: boolean;
  labels?: Partial<Record<TerminalScrollbackCommandKind, string>>;
}

/** Identifier union for terminal workspace command variants. */
export type TerminalWorkspaceCommandKind =
  | "splitRow"
  | "splitColumn"
  | "zoom"
  | "closePane"
  | "nextPane"
  | "previousPane"
  | "growActive"
  | "shrinkActive"
  | "duplicateSession"
  | "detachSession"
  | "attachSession";

/** Action union emitted by terminal workspace command helpers. */
export type TerminalWorkspaceCommandAction =
  | Action<"terminalWorkspace.split", TerminalWorkspaceCommandPayload & { direction: "row" | "column" }>
  | Action<"terminalWorkspace.zoomChanged", TerminalWorkspaceCommandPayload>
  | Action<"terminalWorkspace.paneClosed", TerminalWorkspaceCommandPayload>
  | Action<"terminalWorkspace.paneActivated", TerminalWorkspaceCommandPayload>
  | Action<"terminalWorkspace.paneResized", TerminalWorkspaceCommandPayload & { delta: number }>
  | Action<"terminalWorkspace.sessionDuplicated", TerminalWorkspaceCommandPayload>
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
  resizeStep?: number;
  includeSplitCommands?: boolean;
  includeZoom?: boolean;
  includeClosePane?: boolean;
  includeFocusCommands?: boolean;
  includeResizeCommands?: boolean;
  includeSessionCommands?: boolean;
  labels?: Partial<Record<TerminalWorkspaceCommandKind, string>>;
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

/** Builds command definitions for terminal scrollback and copy-mode navigation. */
export function terminalScrollbackCommands<TAction extends Action = TerminalScrollbackCommandAction>(
  scrollback: TerminalScrollbackController,
  options: TerminalScrollbackCommandOptions = {},
): Command<TAction>[] {
  const id = options.id ?? "terminal-scrollback";
  const idPrefix = options.idPrefix ?? "terminalScrollback";
  const group = options.group ?? "terminal";
  const label = (kind: TerminalScrollbackCommandKind, fallback: string) => options.labels?.[kind] ?? fallback;
  const query = () => typeof options.searchQuery === "function" ? options.searchQuery() : options.searchQuery;
  const payload = (): TerminalScrollbackCommandPayload => ({ id, scrollback: scrollback.inspect() });
  const commands: Command<TAction>[] = [];

  if (options.includeModeCommands ?? true) {
    commands.push(
      {
        id: `${idPrefix}.toggleCopyMode`,
        label: label("toggleCopyMode", "Toggle Terminal Copy Mode"),
        group,
        keywords: ["terminal", "scrollback", "copy", "mode"],
        action: () => {
          scrollback.toggleCopyMode();
          return { type: "terminalScrollback.modeChanged", payload: payload() } as TAction;
        },
      },
      {
        id: `${idPrefix}.exitCopyMode`,
        label: label("exitCopyMode", "Exit Terminal Copy Mode"),
        group,
        keywords: ["terminal", "scrollback", "copy", "live"],
        disabled: () => scrollback.inspect().mode === "live",
        action: () => {
          scrollback.exitCopyMode();
          return { type: "terminalScrollback.modeChanged", payload: payload() } as TAction;
        },
      },
    );
  }

  if (options.includeScrollCommands ?? true) {
    commands.push(
      terminalScrollbackScrollCommand(scrollback, id, idPrefix, group, "lineUp", "Scroll Terminal Line Up", -1, label),
      terminalScrollbackScrollCommand(
        scrollback,
        id,
        idPrefix,
        group,
        "lineDown",
        "Scroll Terminal Line Down",
        1,
        label,
      ),
      terminalScrollbackScrollCommand(scrollback, id, idPrefix, group, "pageUp", "Page Terminal Up", -1, label, true),
      terminalScrollbackScrollCommand(
        scrollback,
        id,
        idPrefix,
        group,
        "pageDown",
        "Page Terminal Down",
        1,
        label,
        true,
      ),
      {
        id: `${idPrefix}.top`,
        label: label("top", "Jump Terminal Scrollback Top"),
        group,
        keywords: ["terminal", "scrollback", "top", "home"],
        action: () => {
          scrollback.toTop();
          return { type: "terminalScrollback.scrolled", payload: payload() } as TAction;
        },
      },
      {
        id: `${idPrefix}.bottom`,
        label: label("bottom", "Jump Terminal Scrollback Bottom"),
        group,
        keywords: ["terminal", "scrollback", "bottom", "end", "live"],
        action: () => {
          scrollback.toBottom();
          return { type: "terminalScrollback.scrolled", payload: payload() } as TAction;
        },
      },
    );
  }

  if (options.includeSearchCommands ?? true) {
    commands.push(
      {
        id: `${idPrefix}.search`,
        label: label("search", "Search Terminal Scrollback"),
        group,
        keywords: ["terminal", "scrollback", "search", "find"],
        disabled: () => !query()?.trim(),
        action: () => {
          scrollback.search(query());
          return { type: "terminalScrollback.searched", payload: payload() } as TAction;
        },
      },
      terminalScrollbackMatchCommand(
        scrollback,
        id,
        idPrefix,
        group,
        "nextMatch",
        "Next Terminal Search Match",
        1,
        label,
      ),
      terminalScrollbackMatchCommand(
        scrollback,
        id,
        idPrefix,
        group,
        "previousMatch",
        "Previous Terminal Search Match",
        -1,
        label,
      ),
    );
  }

  if (options.includeSelectionCommands ?? true) {
    commands.push(
      {
        id: `${idPrefix}.clearSelection`,
        label: label("clearSelection", "Clear Terminal Selection"),
        group,
        keywords: ["terminal", "scrollback", "selection", "clear"],
        disabled: () => !scrollback.inspect().selection,
        action: () => {
          scrollback.clearSelection();
          return { type: "terminalScrollback.selectionCleared", payload: payload() } as TAction;
        },
      },
      {
        id: `${idPrefix}.copySelection`,
        label: label("copySelection", "Copy Terminal Selection"),
        group,
        keywords: ["terminal", "scrollback", "selection", "copy"],
        disabled: () => !scrollback.inspect().selectedText,
        action: () => {
          const text = scrollback.copySelection();
          return { type: "terminalScrollback.selectionCopied", payload: { ...payload(), text } } as TAction;
        },
      },
    );
  }

  return commands;
}

/** Binds terminal scrollback Commands behavior and returns a disposer when applicable. */
export function bindTerminalScrollbackCommands<TAction extends Action = TerminalScrollbackCommandAction>(
  registry: CommandRegistry<TAction>,
  scrollback: TerminalScrollbackController,
  options: TerminalScrollbackCommandOptions = {},
): () => void {
  return registry.registerAll(terminalScrollbackCommands<TAction>(scrollback, options));
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
  const targetSessionId = () => sessionId() ?? workspace.inspect().activeId;
  const activePaneId = () => workspace.inspectLayout().activePaneId;
  const payload = (paneId = activePaneId()): TerminalWorkspaceCommandPayload => {
    const inspection = workspace.inspect();
    return {
      id,
      paneId,
      sessionId: paneId ? inspection.layout.panes.find((pane) => pane.id === paneId)?.sessionId : inspection.activeId,
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
        disabled: () => workspace.inspect().sessions.every((session) => !session.detached),
        action: () => {
          const inspection = workspace.inspect();
          const sessionId = inspection.active?.detached
            ? inspection.active.id
            : inspection.sessions.find((session) => session.detached)?.id;
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

function terminalScrollbackScrollCommand<TAction extends Action>(
  scrollback: TerminalScrollbackController,
  id: string,
  idPrefix: string,
  group: string,
  kind: "lineUp" | "lineDown" | "pageUp" | "pageDown",
  fallback: string,
  delta: number,
  label: (kind: TerminalScrollbackCommandKind, fallback: string) => string,
  page = false,
): Command<TAction> {
  return {
    id: `${idPrefix}.${kind}`,
    label: label(kind, fallback),
    group,
    keywords: ["terminal", "scrollback", page ? "page" : "line", delta < 0 ? "up" : "down"],
    action: () => {
      if (page) scrollback.page(delta);
      else scrollback.scrollLines(delta);
      return {
        type: "terminalScrollback.scrolled",
        payload: { id, scrollback: scrollback.inspect() },
      } as TAction;
    },
  };
}

function terminalScrollbackMatchCommand<TAction extends Action>(
  scrollback: TerminalScrollbackController,
  id: string,
  idPrefix: string,
  group: string,
  kind: "nextMatch" | "previousMatch",
  fallback: string,
  delta: number,
  label: (kind: TerminalScrollbackCommandKind, fallback: string) => string,
): Command<TAction> {
  return {
    id: `${idPrefix}.${kind}`,
    label: label(kind, fallback),
    group,
    keywords: ["terminal", "scrollback", "search", "match", delta < 0 ? "previous" : "next"],
    disabled: () => scrollback.inspect().matches.length === 0,
    action: () => {
      scrollback.nextMatch(delta);
      return {
        type: "terminalScrollback.matchChanged",
        payload: { id, scrollback: scrollback.inspect() },
      } as TAction;
    },
  };
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
      (paneId ? inspection.layout.panes.find((pane) => pane.id === paneId)?.sessionId : inspection.activeId),
    workspace: inspection,
  };
}
