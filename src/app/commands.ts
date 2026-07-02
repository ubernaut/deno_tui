// Copyright 2023 Im-Beast. MIT license.
import { bindingId, type KeyBinding } from "../keymap.ts";
import type { Action } from "./actions.ts";
import { DisposableStack } from "./disposables.ts";

/** Public type alias for a command Action Factory. */
export type CommandActionFactory<TAction extends Action = Action> = (
  command: Command<TAction>,
) => TAction | void | Promise<TAction | void>;

/** Public interface describing a command. */
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

/** Public interface describing a command Projection. */
export interface CommandProjection {
  id: string;
  label: string;
  keywords?: readonly string[];
  disabled?: boolean;
}

/** Serializable inspection snapshot for command. */
export interface CommandInspection {
  id: string;
  label: string;
  description?: string;
  group?: string;
  keywords?: readonly string[];
  disabled: boolean;
  bindingId?: string;
  hasAction: boolean;
}

/** Serializable inspection snapshot for command Registry. */
export interface CommandRegistryInspection {
  count: number;
  enabled: number;
  disabled: number;
  groups: string[];
  commands: CommandInspection[];
}

/** Public type alias for a command Dispatch. */
export type CommandDispatch<TAction extends Action = Action> = (action: TAction) => void | Promise<void>;
/** Public type alias for a command Registry Listener. */
export type CommandRegistryListener = () => void;

/** Registry for storing and querying command definitions. */
export class CommandRegistry<TAction extends Action = Action> {
  private readonly commands = new Map<string, Command<TAction>>();
  private readonly listeners = new Set<CommandRegistryListener>();
  private orderedCommands?: Command<TAction>[];
  private orderedGroups?: string[];

  register(command: Command<TAction>): () => void {
    this.commands.set(command.id, command);
    this.invalidate();
    this.notify();
    return () => {
      if (this.commands.get(command.id) === command) {
        this.unregister(command.id);
      }
    };
  }

  registerAll(commands: Iterable<Command<TAction>>): () => void {
    const stack = new DisposableStack();
    try {
      for (const command of commands) {
        stack.defer(this.register(command));
      }
    } catch (error) {
      stack.dispose();
      throw error;
    }

    return stack.dispose;
  }

  unregister(id: string): void {
    if (this.commands.delete(id)) {
      this.invalidate();
      this.notify();
    }
  }

  get(id: string): Command<TAction> | undefined {
    return this.commands.get(id);
  }

  has(id: string): boolean {
    return this.commands.has(id);
  }

  list(group?: string): Command<TAction>[] {
    const commands = this.orderedCommandList();
    if (group === undefined) return cloneCommandArray(commands);
    const filtered: Command<TAction>[] = [];
    for (let index = 0; index < commands.length; index += 1) {
      const command = commands[index]!;
      if (command.group === group) filtered.push(command);
    }
    return filtered;
  }

  enabled(command: Command<TAction>): boolean {
    return typeof command.disabled === "function" ? !command.disabled() : !command.disabled;
  }

  projections(group?: string, includeDisabled = true): CommandProjection[] {
    const commands = this.list(group);
    const projections: CommandProjection[] = [];
    for (const command of commands) {
      const enabled = this.enabled(command);
      if (!includeDisabled && !enabled) continue;
      projections.push({
        id: command.id,
        label: command.label,
        keywords: command.keywords,
        disabled: !enabled,
      });
    }
    return projections;
  }

  keyBindings(group?: string, includeDisabled = false): KeyBinding[] {
    const commands = this.list(group);
    const bindings: KeyBinding[] = [];
    for (const command of commands) {
      if (!command.binding || (!includeDisabled && !this.enabled(command))) continue;
      bindings.push({
        ...command.binding,
        description: command.description ?? command.label,
        group: command.group,
      });
    }
    return bindings;
  }

  groups(): string[] {
    if (!this.orderedGroups) {
      const groups: Array<string | undefined> = [];
      for (const command of this.commands.values()) {
        groups.push(command.group);
      }
      this.orderedGroups = uniqueSorted(groups);
    }
    return cloneStringArray(this.orderedGroups);
  }

  clear(group?: string): void {
    if (group === undefined) {
      if (this.commands.size === 0) return;
      this.commands.clear();
      this.invalidate();
      this.notify();
      return;
    }

    let changed = false;
    for (const [id, command] of this.commands) {
      if (command.group === group) {
        this.commands.delete(id);
        changed = true;
      }
    }
    if (changed) {
      this.invalidate();
      this.notify();
    }
  }

  inspect(group?: string): CommandRegistryInspection {
    const source = this.list(group);
    const commands = new Array<CommandInspection>(source.length);
    let enabled = 0;
    let disabled = 0;
    const groups: Array<string | undefined> = [];
    for (let index = 0; index < source.length; index += 1) {
      const command = source[index]!;
      const commandDisabled = !this.enabled(command);
      if (commandDisabled) disabled += 1;
      else enabled += 1;
      groups.push(command.group);
      commands[index] = {
        id: command.id,
        label: command.label,
        description: command.description,
        group: command.group,
        keywords: command.keywords,
        disabled: commandDisabled,
        bindingId: command.binding ? bindingId(command.binding) : undefined,
        hasAction: command.action !== undefined,
      };
    }
    return {
      count: commands.length,
      enabled,
      disabled,
      groups: uniqueSorted(groups),
      commands,
    };
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

  subscribe(listener: CommandRegistryListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    for (const listener of this.listeners) {
      listener();
    }
  }

  private orderedCommandList(): readonly Command<TAction>[] {
    if (!this.orderedCommands) {
      const commands: Command<TAction>[] = [];
      for (const command of this.commands.values()) commands.push(command);
      commands.sort(compareCommands);
      this.orderedCommands = commands;
    }
    return this.orderedCommands;
  }

  private invalidate(): void {
    this.orderedCommands = undefined;
    this.orderedGroups = undefined;
  }
}

function compareCommands<TAction extends Action>(a: Command<TAction>, b: Command<TAction>): number {
  return (a.group ?? "").localeCompare(b.group ?? "") || a.label.localeCompare(b.label);
}

function uniqueSorted(values: Array<string | undefined>): string[] {
  const unique: string[] = [];
  for (const value of values) {
    if (!value || unique.includes(value)) continue;
    unique.push(value);
  }
  unique.sort();
  return unique;
}

function cloneCommandArray<TAction extends Action>(commands: readonly Command<TAction>[]): Command<TAction>[] {
  const output = new Array<Command<TAction>>(commands.length);
  for (let index = 0; index < commands.length; index += 1) output[index] = commands[index]!;
  return output;
}

function cloneStringArray(values: readonly string[]): string[] {
  const output = new Array<string>(values.length);
  for (let index = 0; index < values.length; index += 1) output[index] = values[index]!;
  return output;
}
