// Copyright 2023 Im-Beast. MIT license.
import { bindingId, type KeyBinding, type KeymapRegistry } from "../keymap.ts";
import type { KeyPressEvent } from "../input_reader/types.ts";
import { Signal } from "../signals/mod.ts";
import type { Action } from "./actions.ts";
import type { Command, CommandDispatch, CommandRegistry } from "./commands.ts";

export interface CommandSurfaceItem {
  id: string;
  label: string;
  keywords?: readonly string[];
  disabled?: boolean;
}

export interface CommandKeyTarget {
  on(type: "keyPress", listener: (event: KeyPressEvent) => void | Promise<void>): () => void;
}

export interface CommandKeyBindingOptions {
  group?: string;
}

export interface CommandSurfaceOptions extends CommandKeyBindingOptions {
  includeDisabled?: boolean;
  includeBindingsInKeywords?: boolean;
}

export interface CommandKeymapBindingOptions extends CommandKeyBindingOptions {
  includeDisabled?: boolean;
}

export interface CommandSurfaceController<TAction extends Action = Action> {
  readonly items: Signal<CommandSurfaceItem[]>;
  refresh(): CommandSurfaceItem[];
  execute(item: Pick<CommandSurfaceItem, "id">): Promise<boolean>;
  dispose(): void;
}

export function commandForKeyEvent<TAction extends Action = Action>(
  registry: CommandRegistry<TAction>,
  event: KeyPressEvent,
  options: CommandKeyBindingOptions = {},
): Command<TAction> | undefined {
  const eventId = bindingId(event);
  return registry.list(options.group).find((command) => {
    return command.binding && registry.enabled(command) && bindingId(command.binding) === eventId;
  });
}

export function bindCommandKeys<TAction extends Action = Action>(
  target: CommandKeyTarget,
  registry: CommandRegistry<TAction>,
  dispatch?: CommandDispatch<TAction>,
  options: CommandKeyBindingOptions = {},
): () => void {
  return target.on("keyPress", async (event) => {
    const command = commandForKeyEvent(registry, event, options);
    if (command) {
      await registry.execute(command.id, dispatch);
    }
  });
}

export function bindCommandKeymap<TAction extends Action = Action>(
  registry: CommandRegistry<TAction>,
  keymap: KeymapRegistry,
  options: CommandKeymapBindingOptions = {},
): () => void {
  let disposers: Array<() => void> = [];
  const clear = () => {
    for (const dispose of disposers) {
      dispose();
    }
    disposers = [];
  };
  const sync = () => {
    clear();
    disposers = registry
      .keyBindings(options.group, options.includeDisabled ?? false)
      .map((binding: KeyBinding) => keymap.register(binding));
  };

  sync();
  const unsubscribe = registry.subscribe(sync);

  return () => {
    unsubscribe();
    clear();
  };
}

export function commandSurfaceItems<TAction extends Action = Action>(
  registry: CommandRegistry<TAction>,
  options: CommandSurfaceOptions = {},
): CommandSurfaceItem[] {
  const includeDisabled = options.includeDisabled ?? true;
  const includeBindingsInKeywords = options.includeBindingsInKeywords ?? true;
  return registry.list(options.group)
    .filter((command) => includeDisabled || registry.enabled(command))
    .map((command) => ({
      id: command.id,
      label: command.label,
      keywords: commandKeywords(command, includeBindingsInKeywords),
      disabled: !registry.enabled(command),
    }));
}

export function executeCommandSurfaceItem<TAction extends Action = Action>(
  registry: CommandRegistry<TAction>,
  item: Pick<CommandSurfaceItem, "id">,
  dispatch?: CommandDispatch<TAction>,
): Promise<boolean> {
  return registry.execute(item.id, dispatch);
}

export function createCommandSurface<TAction extends Action = Action>(
  registry: CommandRegistry<TAction>,
  dispatch?: CommandDispatch<TAction>,
  options: CommandSurfaceOptions = {},
): CommandSurfaceController<TAction> {
  let disposed = false;
  const items = new Signal(commandSurfaceItems(registry, options));
  const refresh = () => {
    const next = commandSurfaceItems(registry, options);
    if (!disposed) {
      items.value = next;
    }
    return next;
  };
  const unsubscribe = registry.subscribe(refresh);

  return {
    items,
    refresh,
    execute: (item) => executeCommandSurfaceItem(registry, item, dispatch),
    dispose: () => {
      if (disposed) return;
      disposed = true;
      unsubscribe();
      items.dispose();
    },
  };
}

export function bindCommandSurface<TAction extends Action = Action>(
  registry: CommandRegistry<TAction>,
  items: Signal<CommandSurfaceItem[]>,
  options: CommandSurfaceOptions = {},
): () => void {
  const sync = () => {
    items.value = commandSurfaceItems(registry, options);
  };
  sync();
  const unsubscribe = registry.subscribe(sync);
  return unsubscribe;
}

function commandKeywords<TAction extends Action = Action>(
  command: Command<TAction>,
  includeBinding: boolean,
): string[] {
  return [
    command.id,
    command.group,
    command.description,
    ...(command.keywords ?? []),
    includeBinding && command.binding ? bindingId(command.binding) : undefined,
  ].filter((keyword): keyword is string => !!keyword);
}
