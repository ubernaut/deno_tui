// Copyright 2023 Im-Beast. MIT license.
import type { Action } from "./actions.ts";
import type { Command } from "./commands.ts";

export interface LabeledCommandGroupOptions<TKind extends string> {
  idPrefix?: string;
  group?: string;
  labels?: Partial<Record<TKind, string>>;
}

export interface IdentifiedLabeledCommandGroupOptions<TKind extends string> extends LabeledCommandGroupOptions<TKind> {
  id?: string;
}

export type CycleActionCommandKind = "next" | "previous";
export type CycleActionDirection = -1 | 1;

export interface CycleActionCommandProfile<TAction extends Action> {
  type: TAction["type"] & string;
  label: string;
  description: string;
  keywords: (kind: CycleActionCommandKind) => readonly string[];
  activeId: () => string;
  cycle: (direction: CycleActionDirection) => string;
  disabled?: () => boolean;
}

export function cycleActionCommands<TAction extends Action>(
  idPrefix: string,
  group: string,
  profile: CycleActionCommandProfile<TAction>,
): Command<TAction>[] {
  const command = (kind: CycleActionCommandKind, direction: CycleActionDirection): Command<TAction> => ({
    id: `${idPrefix}.${kind}`,
    label: `${kind === "next" ? "Next" : "Previous"} ${profile.label}`,
    description: `Cycle to the ${kind} ${profile.description}.`,
    group,
    keywords: profile.keywords(kind),
    ...(profile.disabled ? { disabled: profile.disabled } : {}),
    action: () => {
      const previousId = profile.activeId();
      const id = profile.cycle(direction);
      return { type: profile.type, payload: { id, previousId, direction } } as TAction;
    },
  });
  return [command("next", 1), command("previous", -1)];
}

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

  addOptionalAction<TResult, TPayload>(
    id: string,
    label: string,
    type: TAction["type"] & string,
    update: () => TResult | undefined,
    payload: (result: TResult) => TPayload,
    keywords?: readonly string[],
    disabled?: Command<TAction>["disabled"],
    binding?: Command<TAction>["binding"],
  ): void {
    this.add(
      id,
      label,
      () => {
        const result = update();
        if (result === undefined) return undefined;
        return { type, payload: payload(result) } as TAction;
      },
      keywords,
      disabled,
      binding,
    );
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

export type SelectionNavigationCommandKind = "first" | "previous" | "next" | "last";

export interface SelectionNavigationCommandController<TResult> {
  first(): TResult;
  move(delta: number): TResult;
  last(): TResult;
}

export function selectionNavigationCommandEntries<TResult>(
  controller: SelectionNavigationCommandController<TResult>,
  itemLabel: string,
  keywordPrefix?: readonly string[],
): ActionCommandGroupEntry<SelectionNavigationCommandKind, TResult>[] {
  return [
    ["first", `First ${itemLabel}`, () => controller.first(), keywordPrefix && [...keywordPrefix, "first"]],
    ["previous", `Previous ${itemLabel}`, () => controller.move(-1), keywordPrefix && [...keywordPrefix, "previous"]],
    ["next", `Next ${itemLabel}`, () => controller.move(1), keywordPrefix && [...keywordPrefix, "next"]],
    ["last", `Last ${itemLabel}`, () => controller.last(), keywordPrefix && [...keywordPrefix, "last"]],
  ];
}

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
