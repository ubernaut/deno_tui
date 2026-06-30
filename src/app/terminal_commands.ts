// Copyright 2023 Im-Beast. MIT license.
import type { TerminalOutputController, TerminalOutputInspection } from "../components/terminal_output.ts";
import type { ProcessSessionController, ProcessSessionInspection } from "../runtime/process_session.ts";
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
