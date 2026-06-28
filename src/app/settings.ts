// Copyright 2023 Im-Beast. MIT license.
import type { SignalOptions } from "../signals/mod.ts";
import { type AsyncStore, PersistentSignal } from "../runtime/storage.ts";

export interface AppSettingDefinition<T, Stored = T> {
  key: string;
  initialValue: T;
  signalOptions?: SignalOptions<T>;
  serialize?: (value: T) => Stored;
  deserialize?: (value: Stored) => T;
}

export interface SettingsControllerOptions {
  store: AsyncStore<unknown>;
  namespace?: string;
  onError?: (error: unknown) => void;
}

export interface SettingsControllerInspection {
  namespace: string;
  keys: string[];
  localKeys: string[];
}

export class SettingsController {
  readonly namespace: string;
  readonly store: AsyncStore<unknown>;
  readonly #onError?: (error: unknown) => void;
  readonly #settings = new Map<string, PersistentSignal<unknown, unknown>>();

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
    return setting;
  }

  get<T = unknown, Stored = T>(key: string): PersistentSignal<T, Stored> | undefined {
    return this.#settings.get(this.key(key)) as PersistentSignal<T, Stored> | undefined;
  }

  has(key: string): boolean {
    return this.#settings.has(this.key(key));
  }

  keys(): string[] {
    return [...this.#settings.keys()].sort();
  }

  localKeys(): string[] {
    return this.keys().map((key) => this.localKey(key));
  }

  async ready(): Promise<void> {
    await Promise.all([...this.#settings.values()].map((setting) => setting.ready));
  }

  async flush(): Promise<void> {
    await Promise.all([...this.#settings.values()].map((setting) => setting.flush()));
  }

  async reset(key: string): Promise<boolean> {
    const setting = this.#settings.get(this.key(key));
    if (!setting) return false;
    await setting.reset();
    return true;
  }

  async resetAll(): Promise<void> {
    await Promise.all([...this.#settings.values()].map((setting) => setting.reset()));
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
  }

  key(key: string): string {
    return this.namespace ? `${this.namespace}.${key}` : key;
  }

  private localKey(key: string): string {
    const prefix = this.namespace ? `${this.namespace}.` : "";
    return prefix && key.startsWith(prefix) ? key.slice(prefix.length) : key;
  }
}

export function createSettingsController(options: SettingsControllerOptions): SettingsController {
  return new SettingsController(options);
}
