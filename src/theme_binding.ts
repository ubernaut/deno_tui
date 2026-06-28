// Copyright 2023 Im-Beast. MIT license.
import type { Component } from "./component.ts";
import { Computed, Signal } from "./signals/mod.ts";
import type { Theme, ThemeProvider } from "./theme.ts";

export interface ThemeBindable {
  setTheme(theme: Theme): void;
}

export interface ComponentThemeBindingOptions {
  variant?: string | Signal<string>;
  abortSignal?: AbortSignal;
}

/** Declarative target binding used by ComponentThemeBindingGroup and bindComponentThemes(). */
export interface ComponentThemeBindingEntry extends ComponentThemeBindingOptions {
  id?: string;
  target: Component | ThemeBindable;
  componentName: string;
}

/** Inspectable metadata for one live component theme binding. */
export interface ComponentThemeBindingInspection {
  id: string;
  componentName: string;
  variant: string;
}

/** Aggregate diagnostics for a group of component theme bindings. */
export interface ComponentThemeBindingGroupInspection {
  count: number;
  components: string[];
  variants: string[];
  bindings: ComponentThemeBindingInspection[];
}

/** Keeps one target synchronized with the active theme provider and optional variant signal. */
export function bindComponentTheme(
  target: Component | ThemeBindable,
  provider: ThemeProvider,
  componentName: string,
  options: ComponentThemeBindingOptions = {},
): () => void {
  const theme = new Computed(() =>
    provider.engine.value.component(
      componentName,
      options.variant instanceof Signal ? options.variant.value : options.variant ?? "default",
    )
  );

  const applyTheme = (value: Theme) => target.setTheme(value);
  applyTheme(theme.value);
  theme.subscribe(applyTheme, options.abortSignal);

  let disposed = false;
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    theme.unsubscribe(applyTheme);
    theme.dispose();
  };
  options.abortSignal?.addEventListener("abort", dispose, { once: true });
  if (options.abortSignal?.aborted) dispose();

  return dispose;
}

/** Lifecycle container for many component theme bindings that can be inspected and disposed together. */
export class ComponentThemeBindingGroup {
  readonly provider: ThemeProvider;
  readonly #bindings = new Map<string, RegisteredComponentThemeBinding>();
  #sequence = 0;
  #disposed = false;

  constructor(provider: ThemeProvider, entries: Iterable<ComponentThemeBindingEntry> = [], abortSignal?: AbortSignal) {
    this.provider = provider;
    if (abortSignal?.aborted) {
      this.#disposed = true;
      return;
    }
    abortSignal?.addEventListener("abort", () => this.dispose(), { once: true });
    for (const entry of entries) {
      this.register(entry);
    }
  }

  register(entry: ComponentThemeBindingEntry): () => void {
    if (this.#disposed) {
      throw new Error("ComponentThemeBindingGroup is disposed");
    }
    if (entry.abortSignal?.aborted) return () => undefined;

    const id = entry.id ?? `${entry.componentName}:${this.#sequence++}`;
    this.#bindings.get(id)?.dispose();
    const dispose = bindComponentTheme(entry.target, this.provider, entry.componentName, {
      variant: entry.variant,
      abortSignal: entry.abortSignal,
    });
    const registered: RegisteredComponentThemeBinding = {
      id,
      componentName: entry.componentName,
      variant: entry.variant,
      dispose,
    };
    this.#bindings.set(id, registered);
    entry.abortSignal?.addEventListener(
      "abort",
      () => {
        if (this.#bindings.get(id) !== registered) return;
        registered.dispose();
        this.#bindings.delete(id);
      },
      { once: true },
    );

    return () => {
      if (this.#bindings.get(id) !== registered) return;
      registered.dispose();
      this.#bindings.delete(id);
    };
  }

  unregister(id: string): boolean {
    const binding = this.#bindings.get(id);
    if (!binding) return false;
    binding.dispose();
    return this.#bindings.delete(id);
  }

  clear(): void {
    for (const binding of this.#bindings.values()) {
      binding.dispose();
    }
    this.#bindings.clear();
  }

  inspect(): ComponentThemeBindingGroupInspection {
    const bindings = [...this.#bindings.values()].map((binding) => ({
      id: binding.id,
      componentName: binding.componentName,
      variant: bindingVariant(binding.variant),
    }));
    return {
      count: bindings.length,
      components: [...new Set(bindings.map((binding) => binding.componentName))].sort(),
      variants: [...new Set(bindings.map((binding) => binding.variant))].sort(),
      bindings,
    };
  }

  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    this.clear();
  }
}

/** Creates an inspectable group of component theme bindings. */
export function bindComponentThemes(
  provider: ThemeProvider,
  entries: Iterable<ComponentThemeBindingEntry>,
  options: { abortSignal?: AbortSignal } = {},
): ComponentThemeBindingGroup {
  return new ComponentThemeBindingGroup(provider, entries, options.abortSignal);
}

interface RegisteredComponentThemeBinding {
  id: string;
  componentName: string;
  variant?: string | Signal<string>;
  dispose: () => void;
}

function bindingVariant(variant: string | Signal<string> | undefined): string {
  return variant instanceof Signal ? variant.peek() : variant ?? "default";
}
