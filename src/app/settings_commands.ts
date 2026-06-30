// Copyright 2023 Im-Beast. MIT license.
import type { Action } from "./actions.ts";
import type { Command, CommandRegistry } from "./commands.ts";
import type { SettingsController } from "./settings.ts";

/** Identifier union for settings Command variants. */
export type SettingsCommandKind = "reset" | "resetAll";

/** Action union emitted by settings Command command helpers. */
export type SettingsCommandAction =
  | Action<"settings.reset", { key: string }>
  | Action<"settings.resetAll", { keys: string[] }>;

/** Options for configuring settings Command. */
export interface SettingsCommandOptions {
  idPrefix?: string;
  group?: string;
  includeResetCommands?: boolean;
  includeResetAll?: boolean;
  disabledWhenEmpty?: boolean;
  labels?: Partial<Record<SettingsCommandKind, string>>;
  keyLabel?: (key: string) => string;
  keyId?: (key: string) => string;
}

/** Builds command definitions for settings. */
export function settingsCommands<TAction extends Action = SettingsCommandAction>(
  settings: SettingsController,
  options: SettingsCommandOptions = {},
): Command<TAction>[] {
  const idPrefix = options.idPrefix ?? "settings";
  const group = options.group ?? "settings";
  const disabledWhenEmpty = options.disabledWhenEmpty ?? true;
  const label = (kind: SettingsCommandKind, fallback: string) => options.labels?.[kind] ?? fallback;
  const keyLabel = options.keyLabel ?? ((key: string) => key);
  const keyId = options.keyId ?? encodeURIComponent;
  const empty = () => disabledWhenEmpty && settings.localKeys().length === 0;
  const commands: Command<TAction>[] = [];

  if (options.includeResetCommands ?? true) {
    for (const key of settings.localKeys()) {
      commands.push({
        id: `${idPrefix}.reset.${keyId(key)}`,
        label: `${label("reset", "Reset Setting")}: ${keyLabel(key)}`,
        description: `Reset the ${keyLabel(key)} setting to its initial value.`,
        group,
        keywords: ["settings", "reset", key, keyLabel(key)],
        disabled: () => !settings.has(key),
        action: async () => {
          await settings.reset(key);
          return { type: "settings.reset", payload: { key } } as TAction;
        },
      });
    }
  }

  if (options.includeResetAll ?? true) {
    commands.push({
      id: `${idPrefix}.resetAll`,
      label: label("resetAll", "Reset All Settings"),
      description: "Reset every registered setting to its initial value.",
      group,
      keywords: ["settings", "reset", "all"],
      disabled: empty,
      action: async () => {
        const keys = settings.localKeys();
        await settings.resetAll();
        return { type: "settings.resetAll", payload: { keys } } as TAction;
      },
    });
  }

  return commands;
}

/** Binds settings Commands behavior and returns a disposer when applicable. */
export function bindSettingsCommands<TAction extends Action = SettingsCommandAction>(
  registry: CommandRegistry<TAction>,
  settings: SettingsController,
  options: SettingsCommandOptions = {},
): () => void {
  return registry.registerAll(settingsCommands<TAction>(settings, options));
}
