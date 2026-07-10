// Copyright 2023 Im-Beast. MIT license.
import type { Action } from "./actions.ts";
import type { Command } from "./commands.ts";

export class CommandGroupBuilder<TAction extends Action> {
  readonly commands: Command<TAction>[] = [];

  constructor(private readonly idPrefix: string, private readonly group: string) {}

  add(
    id: string,
    label: string,
    action: NonNullable<Command<TAction>["action"]>,
    keywords?: readonly string[],
    disabled?: Command<TAction>["disabled"],
    binding?: Command<TAction>["binding"],
  ): void {
    const command: Command<TAction> = { id: `${this.idPrefix}.${id}`, label, group: this.group, action };
    if (keywords !== undefined) command.keywords = keywords;
    if (disabled !== undefined) command.disabled = disabled;
    if (binding !== undefined) command.binding = binding;
    this.commands.push(command);
  }
}

export function actionCommand<TAction extends Action, TResult, TPayload>(
  id: string,
  label: string,
  group: string,
  keywords: readonly string[],
  type: TAction["type"] & string,
  update: () => TResult,
  payload: (result: TResult) => TPayload,
  disabled?: () => boolean,
): Command<TAction> {
  return {
    id,
    label,
    group,
    keywords,
    disabled,
    action: () => ({ type, payload: payload(update()) } as TAction),
  };
}

export type ActionCommandGroupEntry<TKind extends string, TResult> = readonly [
  kind: TKind,
  fallback: string,
  update: () => TResult,
  keywords?: readonly string[],
  disabled?: () => boolean,
];

export interface ActionCommandGroupOptions<TAction extends Action, TPayload, TKind extends string, TResult> {
  idPrefix: string;
  group: string;
  type: TAction["type"] & string;
  keywords: readonly string[];
  label: (kind: TKind, fallback: string) => string;
  payload: (result: TResult, kind: TKind) => TPayload;
  entries: readonly ActionCommandGroupEntry<TKind, TResult>[];
  disabled?: () => boolean;
}

export function actionCommandGroup<TAction extends Action, TPayload, TKind extends string, TResult>(
  options: ActionCommandGroupOptions<TAction, TPayload, TKind, TResult>,
): Command<TAction>[] {
  const commands: Command<TAction>[] = [];
  for (const [kind, fallback, update, keywords, disabled] of options.entries) {
    const commandLabel = options.label(kind, fallback);
    commands.push(actionCommand(
      `${options.idPrefix}.${kind}`,
      commandLabel,
      options.group,
      keywords ?? [...options.keywords, commandLabel],
      options.type,
      update,
      (result) => options.payload(result, kind),
      disabled ?? options.disabled,
    ));
  }
  return commands;
}
