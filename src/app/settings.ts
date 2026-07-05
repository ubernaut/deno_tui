// Copyright 2023 Im-Beast. MIT license.
import type { SignalOptions } from "../signals/mod.ts";
import { type AsyncStore, PersistentSignal } from "../runtime/storage.ts";
import type { Action } from "./actions.ts";
import type { Command, CommandRegistry } from "./commands.ts";

/** Public interface describing an app Setting Definition. */
export interface AppSettingDefinition<T, Stored = T> {
  key: string;
  initialValue: T;
  signalOptions?: SignalOptions<T>;
  serialize?: (value: T) => Stored;
  deserialize?: (value: Stored) => T;
}

/** Options for configuring settings Controller. */
export interface SettingsControllerOptions {
  store: AsyncStore<unknown>;
  namespace?: string;
  onError?: (error: unknown) => void;
}

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

/** Serializable inspection snapshot for settings Controller. */
export interface SettingsControllerInspection {
  namespace: string;
  keys: string[];
  localKeys: string[];
}

/** State controller for settings behavior. */
export class SettingsController {
  readonly namespace: string;
  readonly store: AsyncStore<unknown>;
  readonly #onError?: (error: unknown) => void;
  readonly #settings = new Map<string, PersistentSignal<unknown, unknown>>();
  #keys?: string[];
  #localKeys?: string[];

  constructor(options: SettingsControllerOptions) {
    this.store = options.store;
    this.namespace = options.namespace ?? "";
    this.#onError = options.onError;
  }

  signal<T, Stored = T>(definition: AppSettingDefinition<T, Stored>): PersistentSignal<T, Stored> {
    const key = this.key(definition.key);
    const existing = this.#settings.get(key);
    if (existing) {
      return existing as PersistentSignal<T, Stored>;
    }

    const setting = new PersistentSignal<T, Stored>({
      key,
      initialValue: definition.initialValue,
      store: this.store as AsyncStore<Stored>,
      signalOptions: definition.signalOptions,
      serialize: definition.serialize,
      deserialize: definition.deserialize,
      onError: this.#onError,
    });
    this.#settings.set(key, setting as PersistentSignal<unknown, unknown>);
    this.#keys = undefined;
    this.#localKeys = undefined;
    return setting;
  }

  get<T = unknown, Stored = T>(key: string): PersistentSignal<T, Stored> | undefined {
    return this.#settings.get(this.key(key)) as PersistentSignal<T, Stored> | undefined;
  }

  has(key: string): boolean {
    return this.#settings.has(this.key(key));
  }

  keys(): string[] {
    if (!this.#keys) {
      const keys: string[] = [];
      for (const key of this.#settings.keys()) {
        keys.push(key);
      }
      keys.sort();
      this.#keys = keys;
    }
    return cloneStringArray(this.#keys);
  }

  localKeys(): string[] {
    if (!this.#localKeys) {
      const keys = this.keys();
      const localKeys = new Array<string>(keys.length);
      for (let index = 0; index < keys.length; index += 1) {
        localKeys[index] = this.localKey(keys[index]!);
      }
      this.#localKeys = localKeys;
    }
    return cloneStringArray(this.#localKeys);
  }

  async ready(): Promise<void> {
    const pending: Promise<unknown>[] = [];
    for (const setting of this.#settings.values()) {
      pending.push(setting.ready);
    }
    await Promise.all(pending);
  }

  async flush(): Promise<void> {
    const pending: Promise<unknown>[] = [];
    for (const setting of this.#settings.values()) {
      pending.push(setting.flush());
    }
    await Promise.all(pending);
  }

  async reset(key: string): Promise<boolean> {
    const setting = this.#settings.get(this.key(key));
    if (!setting) return false;
    await setting.reset();
    return true;
  }

  async resetAll(): Promise<void> {
    const pending: Promise<unknown>[] = [];
    for (const setting of this.#settings.values()) {
      pending.push(setting.reset());
    }
    await Promise.all(pending);
  }

  inspect(): SettingsControllerInspection {
    return {
      namespace: this.namespace,
      keys: this.keys(),
      localKeys: this.localKeys(),
    };
  }

  dispose(): void {
    for (const setting of this.#settings.values()) {
      setting.value.dispose();
    }
    this.#settings.clear();
    this.#keys = undefined;
    this.#localKeys = undefined;
  }

  key(key: string): string {
    return this.namespace ? `${this.namespace}.${key}` : key;
  }

  private localKey(key: string): string {
    const prefix = this.namespace ? `${this.namespace}.` : "";
    return prefix && key.startsWith(prefix) ? key.slice(prefix.length) : key;
  }
}

/** Creates an settings Controller. */
export function createSettingsController(options: SettingsControllerOptions): SettingsController {
  return new SettingsController(options);
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

function cloneStringArray(values: readonly string[]): string[] {
  const cloned = new Array<string>(values.length);
  for (let index = 0; index < values.length; index += 1) cloned[index] = values[index]!;
  return cloned;
}
