// Copyright 2023 Im-Beast. MIT license.
import { bindingId } from "../keymap.ts";
import type { KeyPressEvent } from "../input_reader/types.ts";
import type { Action } from "./actions.ts";
import type { Command, CommandDispatch, CommandRegistry } from "./commands.ts";

export interface CommandKeyTarget {
  on(type: "keyPress", listener: (event: KeyPressEvent) => void | Promise<void>): () => void;
}

export interface CommandKeyBindingOptions {
  group?: string;
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
