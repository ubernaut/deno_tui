// Copyright 2023 Im-Beast. MIT license.
export interface KeyBinding {
  key: string;
  description: string;
  group?: string;
  ctrl?: boolean;
  meta?: boolean;
  shift?: boolean;
}

export interface KeyBindingInspection extends KeyBinding {
  id: string;
}

export interface KeymapInspection {
  count: number;
  groups: string[];
  bindings: KeyBindingInspection[];
}

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
    const disposers: Array<() => void> = [];
    try {
      for (const binding of bindings) {
        disposers.push(this.register(binding));
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
    return [...this.bindings.values()]
      .filter((binding) => group === undefined || binding.group === group)
      .sort((a, b) => (a.group ?? "").localeCompare(b.group ?? "") || a.key.localeCompare(b.key));
  }

  groups(): string[] {
    return uniqueSorted(this.list().map((binding) => binding.group));
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
    const bindings = this.list(group).map((binding) => ({
      ...binding,
      id: bindingId(binding),
    }));
    return {
      count: bindings.length,
      groups: uniqueSorted(bindings.map((binding) => binding.group)),
      bindings,
    };
  }
}

export function bindingId(binding: Pick<KeyBinding, "key" | "ctrl" | "meta" | "shift">): string {
  return `${binding.ctrl ? "C-" : ""}${binding.meta ? "M-" : ""}${binding.shift ? "S-" : ""}${binding.key}`;
}

export function formatKeyBinding(binding: KeyBinding): string {
  return `${bindingId(binding)} ${binding.description}`;
}

function uniqueSorted(values: Array<string | undefined>): string[] {
  return [...new Set(values.filter((value): value is string => !!value))].sort();
}
