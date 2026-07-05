// Copyright 2023 Im-Beast. MIT license.
import type { TerminalScrollbackController, TerminalScrollbackInspection } from "../runtime/terminal_scrollback.ts";
import type { Action } from "./actions.ts";
import type { Command, CommandRegistry } from "./commands.ts";

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
