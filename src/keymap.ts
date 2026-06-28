// Copyright 2023 Im-Beast. MIT license.
export interface KeyBinding {
  key: string;
  description: string;
  group?: string;
  ctrl?: boolean;
  meta?: boolean;
  shift?: boolean;
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

  unregister(binding: Pick<KeyBinding, "key" | "ctrl" | "meta" | "shift">): void {
    this.bindings.delete(bindingId(binding));
  }

  list(group?: string): KeyBinding[] {
    return [...this.bindings.values()]
      .filter((binding) => group === undefined || binding.group === group)
      .sort((a, b) => (a.group ?? "").localeCompare(b.group ?? "") || a.key.localeCompare(b.key));
  }
}

export function bindingId(binding: Pick<KeyBinding, "key" | "ctrl" | "meta" | "shift">): string {
  return `${binding.ctrl ? "C-" : ""}${binding.meta ? "M-" : ""}${binding.shift ? "S-" : ""}${binding.key}`;
}

export function formatKeyBinding(binding: KeyBinding): string {
  return `${bindingId(binding)} ${binding.description}`;
}
