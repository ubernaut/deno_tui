// Copyright 2023 Im-Beast. MIT license.
import type { KeyBinding } from "../keymap.ts";
import type { Action } from "./actions.ts";

export type CommandActionFactory<TAction extends Action = Action> = (
  command: Command<TAction>,
) => TAction | void | Promise<TAction | void>;

export interface Command<TAction extends Action = Action> {
  id: string;
  label: string;
  description?: string;
  keywords?: readonly string[];
  group?: string;
  disabled?: boolean | (() => boolean);
  binding?: Omit<KeyBinding, "description" | "group">;
  action?: TAction | CommandActionFactory<TAction>;
}

export interface CommandProjection {
  id: string;
  label: string;
  keywords?: readonly string[];
  disabled?: boolean;
}

export type CommandDispatch<TAction extends Action = Action> = (action: TAction) => void | Promise<void>;

export class CommandRegistry<TAction extends Action = Action> {
  private readonly commands = new Map<string, Command<TAction>>();

  register(command: Command<TAction>): () => void {
    this.commands.set(command.id, command);
    return () => {
      if (this.commands.get(command.id) === command) {
        this.unregister(command.id);
      }
    };
  }

  registerAll(commands: Iterable<Command<TAction>>): () => void {
    const disposers: Array<() => void> = [];
    try {
      for (const command of commands) {
        disposers.push(this.register(command));
      }
    } catch (error) {
      for (const dispose of [...disposers].reverse()) {
        dispose();
      }
      throw error;
    }

    return () => {
      for (const dispose of [...disposers].reverse()) {
        dispose();
      }
    };
  }

  unregister(id: string): void {
    this.commands.delete(id);
  }

  get(id: string): Command<TAction> | undefined {
    return this.commands.get(id);
  }

  list(group?: string): Command<TAction>[] {
    return [...this.commands.values()]
      .filter((command) => group === undefined || command.group === group)
      .sort((a, b) => (a.group ?? "").localeCompare(b.group ?? "") || a.label.localeCompare(b.label));
  }

  enabled(command: Command<TAction>): boolean {
    return typeof command.disabled === "function" ? !command.disabled() : !command.disabled;
  }

  projections(group?: string, includeDisabled = true): CommandProjection[] {
    return this.list(group)
      .filter((command) => includeDisabled || this.enabled(command))
      .map((command) => ({
        id: command.id,
        label: command.label,
        keywords: command.keywords,
        disabled: !this.enabled(command),
      }));
  }

  keyBindings(group?: string, includeDisabled = false): KeyBinding[] {
    return this.list(group)
      .filter((command) => command.binding && (includeDisabled || this.enabled(command)))
      .map((command) => ({
        ...command.binding!,
        description: command.description ?? command.label,
        group: command.group,
      }));
  }

  async execute(id: string, dispatch?: CommandDispatch<TAction>): Promise<boolean> {
    const command = this.get(id);
    if (!command || !this.enabled(command) || !command.action) return false;

    const action = typeof command.action === "function" ? await command.action(command) : command.action;
    if (action && dispatch) {
      await dispatch(action);
    }
    return true;
  }
}
