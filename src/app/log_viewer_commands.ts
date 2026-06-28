// Copyright 2023 Im-Beast. MIT license.
import type { LogViewerController, LogViewerInspection } from "../components/log_viewer.ts";
import type { Action } from "./actions.ts";
import type { Command, CommandRegistry } from "./commands.ts";

export type LogViewerCommandKind = "clear" | "toggleFollow";

export type LogViewerCommandAction =
  | Action<"logViewer.cleared", LogViewerCommandPayload>
  | Action<"logViewer.followChanged", LogViewerCommandPayload & { follow: boolean }>;

export interface LogViewerCommandPayload {
  id: string;
  inspection: LogViewerInspection;
}

export interface LogViewerCommandOptions {
  id?: string;
  idPrefix?: string;
  group?: string;
  includeClear?: boolean;
  includeToggleFollow?: boolean;
  disabledWhenEmpty?: boolean;
  labels?: Partial<Record<LogViewerCommandKind, string>>;
}

export function logViewerCommands<TAction extends Action = LogViewerCommandAction>(
  controller: LogViewerController,
  options: LogViewerCommandOptions = {},
): Command<TAction>[] {
  const id = options.id ?? "log";
  const idPrefix = options.idPrefix ?? "log";
  const group = options.group ?? "logs";
  const disabledWhenEmpty = options.disabledWhenEmpty ?? true;
  const label = (kind: LogViewerCommandKind, fallback: string) => options.labels?.[kind] ?? fallback;
  const empty = () => disabledWhenEmpty && controller.lines.peek().length === 0;
  const payload = (): LogViewerCommandPayload => ({ id, inspection: controller.inspect() });
  const commands: Command<TAction>[] = [];

  if (options.includeClear ?? true) {
    commands.push({
      id: `${idPrefix}.clear`,
      label: label("clear", "Clear Logs"),
      group,
      keywords: ["log", "logs", "clear"],
      disabled: empty,
      action: () => {
        controller.clear();
        return { type: "logViewer.cleared", payload: payload() } as TAction;
      },
    });
  }

  if (options.includeToggleFollow ?? true) {
    commands.push({
      id: `${idPrefix}.toggleFollow`,
      label: label("toggleFollow", "Toggle Log Follow"),
      group,
      keywords: ["log", "logs", "follow", "tail"],
      action: () => {
        const follow = controller.toggleFollow();
        return {
          type: "logViewer.followChanged",
          payload: { ...payload(), follow },
        } as TAction;
      },
    });
  }

  return commands;
}

export function bindLogViewerCommands<TAction extends Action = LogViewerCommandAction>(
  registry: CommandRegistry<TAction>,
  controller: LogViewerController,
  options: LogViewerCommandOptions = {},
): () => void {
  return registry.registerAll(logViewerCommands<TAction>(controller, options));
}
