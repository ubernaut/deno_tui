// Copyright 2023 Im-Beast. MIT license.
import { DisposableStack } from "./app/disposables.ts";

/** Public interface describing a key Binding. */
export interface KeyBinding {
  key: string;
  description: string;
  group?: string;
  ctrl?: boolean;
  meta?: boolean;
  shift?: boolean;
}

/** Serializable inspection snapshot for key Binding. */
export interface KeyBindingInspection extends KeyBinding {
  id: string;
}

/** Serializable inspection snapshot for keymap. */
export interface KeymapInspection {
  count: number;
  groups: string[];
  bindings: KeyBindingInspection[];
}

/** Registry for storing and querying keymap definitions. */
export class KeymapRegistry {
  readonly bindings = new Map<string, KeyBinding>();

  register(binding: KeyBinding): () => void {
    this.bindings.set(bindingId(binding), binding);
    return () => {
      if (this.bindings.get(bindingId(binding)) === binding) {
        this.unregister(binding);
      }
    };
  }

  registerAll(bindings: Iterable<KeyBinding>): () => void {
    const stack = new DisposableStack();
    try {
      for (const binding of bindings) {
        stack.defer(this.register(binding));
      }
    } catch (error) {
      stack.dispose();
      throw error;
    }

    return stack.dispose;
  }

  unregister(binding: Pick<KeyBinding, "key" | "ctrl" | "meta" | "shift">): void {
    this.bindings.delete(bindingId(binding));
  }

  get(binding: Pick<KeyBinding, "key" | "ctrl" | "meta" | "shift">): KeyBinding | undefined {
    return this.bindings.get(bindingId(binding));
  }

  has(binding: Pick<KeyBinding, "key" | "ctrl" | "meta" | "shift">): boolean {
    return this.bindings.has(bindingId(binding));
  }

  list(group?: string): KeyBinding[] {
    const bindings: KeyBinding[] = [];
    for (const binding of this.bindings.values()) {
      if (group === undefined || binding.group === group) bindings.push(binding);
    }
    return bindings.sort(compareKeyBindings);
  }

  groups(): string[] {
    const groups = new Set<string>();
    for (const binding of this.bindings.values()) {
      if (binding.group) groups.add(binding.group);
    }
    return sortedSetValues(groups);
  }

  clear(group?: string): void {
    if (group === undefined) {
      this.bindings.clear();
      return;
    }

    for (const [id, binding] of this.bindings) {
      if (binding.group === group) {
        this.bindings.delete(id);
      }
    }
  }

  inspect(group?: string): KeymapInspection {
    const list = this.list(group);
    const bindings = new Array<KeyBindingInspection>(list.length);
    const groups = new Set<string>();
    for (let index = 0; index < list.length; index += 1) {
      const binding = list[index]!;
      if (binding.group) groups.add(binding.group);
      bindings[index] = { ...binding, id: bindingId(binding) };
    }
    return {
      count: bindings.length,
      groups: sortedSetValues(groups),
      bindings,
    };
  }
}

/** Binds ing Id behavior and returns a disposer when applicable. */
export function bindingId(binding: Pick<KeyBinding, "key" | "ctrl" | "meta" | "shift">): string {
  return `${binding.ctrl ? "C-" : ""}${binding.meta ? "M-" : ""}${binding.shift ? "S-" : ""}${binding.key}`;
}

/** Formats key Binding for display or diagnostics. */
export function formatKeyBinding(binding: KeyBinding): string {
  return `${bindingId(binding)} ${binding.description}`;
}

function compareKeyBindings(left: KeyBinding, right: KeyBinding): number {
  return (left.group ?? "").localeCompare(right.group ?? "") || left.key.localeCompare(right.key);
}

function sortedSetValues(values: Set<string>): string[] {
  return [...values].sort();
}
