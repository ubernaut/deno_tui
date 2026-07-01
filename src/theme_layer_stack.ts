// Copyright 2023 Im-Beast. MIT license.
import { Computed, Signal } from "./signals/mod.ts";
import type { ThemeEngineOptions, ThemeLayer, ThemeLayerInspection } from "./theme.ts";
import { composeThemeOptionsCore } from "./theme_core.ts";
import { ThemeEngine } from "./theme_engine.ts";

/** Shared implementation for ordered theme layer composition. */
export class ThemeLayerStackImplementation {
  readonly options: Computed<ThemeEngineOptions>;
  readonly #layers = new Map<string, ThemeLayer>();
  readonly #enabled = new Set<string>();
  readonly #revision = new Signal(0);

  constructor(layers: Iterable<ThemeLayer> = []) {
    for (const layer of layers) {
      this.register(layer);
    }
    this.options = new Computed(() => {
      this.#revision.value;
      return composeThemeOptionsCore(...this.activeLayers().map((layer) => layer.options));
    });
  }

  register(layer: ThemeLayer): this {
    const enabled = layer.enabled ?? (this.#enabled.has(layer.id) || !this.#layers.has(layer.id));
    this.#layers.set(layer.id, {
      ...layer,
      enabled,
      options: composeThemeOptionsCore(layer.options),
    });
    if (enabled) {
      this.#enabled.add(layer.id);
    } else {
      this.#enabled.delete(layer.id);
    }
    this.#touch();
    return this;
  }

  unregister(id: string): boolean {
    const removed = this.#layers.delete(id);
    const disabled = this.#enabled.delete(id);
    if (removed || disabled) this.#touch();
    return removed;
  }

  has(id: string): boolean {
    return this.#layers.has(id);
  }

  get(id: string): ThemeLayer | undefined {
    const layer = this.#layers.get(id);
    return layer
      ? {
        ...layer,
        enabled: this.#enabled.has(id),
        options: composeThemeOptionsCore(layer.options),
      }
      : undefined;
  }

  ids(): string[] {
    return [...this.#layers.keys()];
  }

  activeIds(): string[] {
    return this.ids().filter((id) => this.#enabled.has(id));
  }

  activeLayers(): ThemeLayer[] {
    return this.activeIds().map((id) => this.get(id)!);
  }

  setActiveIds(ids: Iterable<string>): string[] {
    const next = new Set(ids);
    let changed = false;

    for (const id of this.ids()) {
      const enabled = next.has(id);
      if (enabled && !this.#enabled.has(id)) {
        this.#enabled.add(id);
        changed = true;
      } else if (!enabled && this.#enabled.has(id)) {
        this.#enabled.delete(id);
        changed = true;
      }
    }

    if (changed) this.#touch();
    return this.activeIds();
  }

  setEnabled(id: string, enabled: boolean): boolean {
    if (!this.#layers.has(id)) return false;
    const changed = enabled ? !this.#enabled.has(id) : this.#enabled.has(id);
    if (!changed) return true;
    if (enabled) {
      this.#enabled.add(id);
    } else {
      this.#enabled.delete(id);
    }
    this.#touch();
    return true;
  }

  enable(id: string): boolean {
    return this.setEnabled(id, true);
  }

  disable(id: string): boolean {
    return this.setEnabled(id, false);
  }

  toggle(id: string): boolean {
    if (!this.#layers.has(id)) return false;
    return this.setEnabled(id, !this.#enabled.has(id));
  }

  compose(overrides: ThemeEngineOptions = {}): ThemeEngineOptions {
    return composeThemeOptionsCore(overrides, ...this.activeLayers().map((layer) => layer.options));
  }

  inspect(): ThemeLayerInspection[] {
    return this.ids().map((id) => {
      const layer = this.#layers.get(id)!;
      return {
        id,
        label: layer.label ?? id,
        enabled: this.#enabled.has(id),
        components: new ThemeEngine(layer.options).inspect().components,
      };
    });
  }

  dispose(): void {
    this.options.dispose();
    this.#revision.dispose();
  }

  #touch(): void {
    this.#revision.value++;
  }
}
