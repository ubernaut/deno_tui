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

  register(command: Command<TAction>): () => void {
    this.commands.set(command.id, command);
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

  groups(): string[] {
    return uniqueSorted(this.list().map((command) => command.group));
  }

  clear(group?: string): void {
    if (group === undefined) {
      if (this.commands.size === 0) return;
      this.commands.clear();
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
    if (changed) this.notify();
  }

  inspect(group?: string): CommandRegistryInspection {
    const commands = this.list(group).map((command) => ({
      id: command.id,
      label: command.label,
      description: command.description,
      group: command.group,
      keywords: command.keywords,
      disabled: !this.enabled(command),
      bindingId: command.binding ? bindingId(command.binding) : undefined,
      hasAction: command.action !== undefined,
    }));
    return {
      count: commands.length,
      enabled: commands.filter((command) => !command.disabled).length,
      disabled: commands.filter((command) => command.disabled).length,
      groups: uniqueSorted(commands.map((command) => command.group)),
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
}

function uniqueSorted(values: Array<string | undefined>): string[] {
  return [...new Set(values.filter((value): value is string => !!value))].sort();
}
