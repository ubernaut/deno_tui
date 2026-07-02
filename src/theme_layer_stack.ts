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
      return composeThemeOptionsCore(...this.#activeLayerOptions());
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
    return layer ? this.#cloneLayer(layer, this.#enabled.has(id)) : undefined;
  }

  ids(): string[] {
    return [...this.#layers.keys()];
  }

  activeIds(): string[] {
    const ids: string[] = [];
    for (const id of this.#layers.keys()) {
      if (this.#enabled.has(id)) ids.push(id);
    }
    return ids;
  }

  activeLayers(): ThemeLayer[] {
    const layers: ThemeLayer[] = [];
    for (const [id, layer] of this.#layers) {
      if (!this.#enabled.has(id)) continue;
      layers.push(this.#cloneLayer(layer, true));
    }
    return layers;
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
    return composeThemeOptionsCore(overrides, ...this.#activeLayerOptions());
  }

  inspect(): ThemeLayerInspection[] {
    const inspections: ThemeLayerInspection[] = [];
    for (const [id, layer] of this.#layers) {
      inspections.push({
        id,
        label: layer.label ?? id,
        enabled: this.#enabled.has(id),
        components: new ThemeEngine(layer.options).inspect().components,
      });
    }
    return inspections;
  }

  dispose(): void {
    this.options.dispose();
    this.#revision.dispose();
  }

  #touch(): void {
    this.#revision.value++;
  }

  #activeLayerOptions(): ThemeEngineOptions[] {
    const options: ThemeEngineOptions[] = [];
    for (const [id, layer] of this.#layers) {
      if (this.#enabled.has(id)) options.push(layer.options);
    }
    return options;
  }

  #cloneLayer(layer: ThemeLayer, enabled: boolean): ThemeLayer {
    return {
      ...layer,
      enabled,
      options: composeThemeOptionsCore(layer.options),
    };
  }
}
