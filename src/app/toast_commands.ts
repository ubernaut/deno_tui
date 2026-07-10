// Copyright 2023 Im-Beast. MIT license.
import type { ToastStackController, ToastStackInspection } from "../components/toast.ts";
import type { Action } from "./actions.ts";
import type { LabeledCommandGroupOptions } from "./command_helpers.ts";
import type { Command, CommandRegistry } from "./commands.ts";

/** Identifier union for toast Command variants. */
export type ToastCommandKind = "clear" | "dismissLatest";

/** Action union emitted by toast Command command helpers. */
export type ToastCommandAction =
  | Action<"toast.cleared", ToastCommandPayload>
  | Action<"toast.dismissed", ToastCommandPayload & { dismissedId?: string }>;

/** Payload carried by toast Command actions. */
export interface ToastCommandPayload {
  inspection: ToastStackInspection;
}

/** Options for configuring toast Command. */
export interface ToastCommandOptions extends LabeledCommandGroupOptions<ToastCommandKind> {
  includeClear?: boolean;
  includeDismissLatest?: boolean;
  disabledWhenEmpty?: boolean;
}

/** Builds command definitions for toast. */
export function toastCommands<TAction extends Action = ToastCommandAction>(
  controller: ToastStackController,
  options: ToastCommandOptions = {},
): Command<TAction>[] {
  const idPrefix = options.idPrefix ?? "toast";
  const group = options.group ?? "toast";
  const disabledWhenEmpty = options.disabledWhenEmpty ?? true;
  const label = (kind: ToastCommandKind, fallback: string) => options.labels?.[kind] ?? fallback;
  const empty = () => disabledWhenEmpty && controller.messages.peek().length === 0;
  const payload = (): ToastCommandPayload => ({ inspection: controller.inspect() });
  const commands: Command<TAction>[] = [];

  if (options.includeDismissLatest ?? true) {
    commands.push({
      id: `${idPrefix}.dismissLatest`,
      label: label("dismissLatest", "Dismiss Latest Toast"),
      group,
      keywords: ["toast", "notification", "dismiss", "latest"],
      disabled: empty,
      action: () => {
        const dismissed = controller.dismissLatest();
        return {
          type: "toast.dismissed",
          payload: { ...payload(), dismissedId: dismissed?.id },
        } as TAction;
      },
    });
  }

  if (options.includeClear ?? true) {
    commands.push({
      id: `${idPrefix}.clear`,
      label: label("clear", "Clear Toasts"),
      group,
      keywords: ["toast", "notification", "clear"],
      disabled: empty,
      action: () => {
        controller.clear();
        return { type: "toast.cleared", payload: payload() } as TAction;
      },
    });
  }

  return commands;
}

/** Binds toast Commands behavior and returns a disposer when applicable. */
export function bindToastCommands<TAction extends Action = ToastCommandAction>(
  registry: CommandRegistry<TAction>,
  controller: ToastStackController,
  options: ToastCommandOptions = {},
): () => void {
  return registry.registerAll(toastCommands<TAction>(controller, options));
}
