// Copyright 2023 Im-Beast. MIT license.
import type { RuntimeProfileController } from "../runtime/profiles.ts";
import type { Action } from "./actions.ts";
import type { Command, CommandRegistry } from "./commands.ts";

/** Action union emitted by runtime Profile Command command helpers. */
export type RuntimeProfileCommandAction = Action<"runtime.profile.changed", RuntimeProfileChangedPayload>;

/** Payload carried by runtime Profile Changed actions. */
export interface RuntimeProfileChangedPayload {
  id: string;
  previousId: string;
  direction?: number;
}

/** Options for configuring runtime Profile Command. */
export interface RuntimeProfileCommandOptions {
  group?: string;
  prefix?: string;
  includeCycleCommands?: boolean;
  includeProfileCommands?: boolean;
  disableActiveProfile?: boolean;
}

/** Builds command definitions for runtime Profile. */
export function runtimeProfileCommands(
  controller: RuntimeProfileController,
  options: RuntimeProfileCommandOptions = {},
): Command<RuntimeProfileCommandAction>[] {
  const group = options.group ?? "runtime";
  const prefix = options.prefix ?? "runtime.profile";
  const commands: Command<RuntimeProfileCommandAction>[] = [];

  if (options.includeCycleCommands ?? true) {
    commands.push(
      {
        id: `${prefix}.next`,
        label: "Next Runtime Profile",
        description: "Cycle to the next runtime strategy profile.",
        group,
        keywords: ["runtime", "profile", "next", "strategy"],
        disabled: () => controller.ids().length <= 1,
        action: () => {
          const previousId = controller.activeId.peek();
          const id = controller.nextProfile();
          return { type: "runtime.profile.changed", payload: { id, previousId, direction: 1 } };
        },
      },
      {
        id: `${prefix}.previous`,
        label: "Previous Runtime Profile",
        description: "Cycle to the previous runtime strategy profile.",
        group,
        keywords: ["runtime", "profile", "previous", "strategy"],
        disabled: () => controller.ids().length <= 1,
        action: () => {
          const previousId = controller.activeId.peek();
          const id = controller.previousProfile();
          return { type: "runtime.profile.changed", payload: { id, previousId, direction: -1 } };
        },
      },
    );
  }

  if (options.includeProfileCommands ?? true) {
    for (const profile of controller.registry.inspect()) {
      commands.push({
        id: `${prefix}.set.${profile.id}`,
        label: `Runtime Profile: ${profile.label}`,
        description: profile.description ?? `Switch to the ${profile.label} runtime strategy profile.`,
        group,
        keywords: ["runtime", "profile", "strategy", profile.id, profile.label, ...profile.tags],
        disabled: options.disableActiveProfile ?? true ? () => controller.activeId.peek() === profile.id : false,
        action: () => {
          const previousId = controller.activeId.peek();
          controller.setProfile(profile.id);
          return { type: "runtime.profile.changed", payload: { id: controller.activeId.peek(), previousId } };
        },
      });
    }
  }

  return commands;
}

/** Binds runtime Profile Commands behavior and returns a disposer when applicable. */
export function bindRuntimeProfileCommands<TAction extends Action = RuntimeProfileCommandAction>(
  registry: CommandRegistry<TAction>,
  controller: RuntimeProfileController,
  options: RuntimeProfileCommandOptions = {},
): () => void {
  return registry.registerAll(runtimeProfileCommands(controller, options) as unknown as Command<TAction>[]);
}
