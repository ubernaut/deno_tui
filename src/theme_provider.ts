// Copyright 2023 Im-Beast. MIT license.
import { Computed, Signal } from "./signals/mod.ts";
import type { AsyncStore } from "./runtime/storage.ts";
import type { Style, Theme, ThemeEngineOptions, ThemeLayer, ThemeProviderInspection, ThemeState } from "./theme.ts";

export interface ThemeProviderRegistryLike<Engine> {
  ids(): string[];
  has(id: string): boolean;
  engine(id: string, overrides?: ThemeEngineOptions): Engine;
  inspect(): ThemeProviderInspection["themes"];
}

export interface ThemeProviderLayerStackLike {
  readonly options: Signal<ThemeEngineOptions>;
  inspect(): ThemeProviderInspection["layers"];
}

export interface ThemeProviderImplementationOptions<
  Registry extends ThemeProviderRegistryLike<Engine>,
  LayerStack extends ThemeProviderLayerStackLike,
  Engine extends {
    component(componentName: string, variant?: string): Theme;
    resolve(componentName: string, state: ThemeState, variant?: string): Style;
    inspect(): ThemeProviderInspection["engine"];
  },
> {
  registry?: Registry;
  activeId?: string | Signal<string>;
  overrides?: ThemeEngineOptions;
  layers?: LayerStack | Iterable<ThemeLayer>;
  store?: AsyncStore<string>;
  storageKey?: string;
  onError?: (error: unknown) => void;
  createDefaultRegistry: () => Registry;
  createLayerStack: (layers: Iterable<ThemeLayer>) => LayerStack;
  isLayerStack: (value: LayerStack | Iterable<ThemeLayer>) => value is LayerStack;
  composeOptions: (...options: ThemeEngineOptions[]) => ThemeEngineOptions;
}

/** Renderer-neutral provider implementation behind the public ThemeProvider facade. */
export class ThemeProviderImplementation<
  Registry extends ThemeProviderRegistryLike<Engine>,
  LayerStack extends ThemeProviderLayerStackLike,
  Engine extends {
    component(componentName: string, variant?: string): Theme;
    resolve(componentName: string, state: ThemeState, variant?: string): Style;
    inspect(): ThemeProviderInspection["engine"];
  },
> {
  readonly registry: Registry;
  readonly activeId: Signal<string>;
  readonly engine: Computed<Engine>;
  readonly layers: LayerStack;
  readonly ready: Promise<string>;
  readonly #overrides: ThemeEngineOptions;
  readonly #store?: AsyncStore<string>;
  readonly #storageKey: string;
  readonly #onError?: (error: unknown) => void;
  readonly #composeOptions: (...options: ThemeEngineOptions[]) => ThemeEngineOptions;
  #loaded = false;
  #dirtyBeforeLoad = false;
  #suspendWrites = false;
  #pendingWrite: Promise<void> = Promise.resolve();

  constructor(options: ThemeProviderImplementationOptions<Registry, LayerStack, Engine>) {
    this.registry = options.registry ?? options.createDefaultRegistry();
    this.activeId = options.activeId instanceof Signal
      ? options.activeId
      : new Signal(options.activeId ?? this.registry.ids()[0] ?? "plain");
    this.#composeOptions = options.composeOptions;
    this.#overrides = this.#composeOptions(options.overrides ?? {});
    this.layers = options.layers && options.isLayerStack(options.layers)
      ? options.layers
      : options.createLayerStack(options.layers ?? []);
    this.#store = options.store;
    this.#storageKey = options.storageKey ?? "theme.active";
    this.#onError = options.onError;
    this.engine = new Computed(() => this.engineFor(this.activeId.value));
    this.activeId.subscribe((id) => this.#persistTheme(id));
    this.ready = this.#loadTheme();
  }

  setTheme(id: string): boolean {
    if (!this.registry.has(id)) return false;
    this.activeId.value = id;
    return true;
  }

  themeIds(): string[] {
    return this.registry.ids();
  }

  cycleTheme(direction = 1): string {
    const ids = this.themeIds();
    if (ids.length === 0) return this.activeId.peek();

    const currentIndex = Math.max(0, ids.indexOf(this.activeId.peek()));
    const nextIndex = positiveModulo(currentIndex + direction, ids.length);
    this.setTheme(ids[nextIndex]);
    return this.activeId.peek();
  }

  nextTheme(): string {
    return this.cycleTheme(1);
  }

  previousTheme(): string {
    return this.cycleTheme(-1);
  }

  engineFor(id: string): Engine {
    return this.registry.engine(
      id,
      this.#composeOptions(this.#overrides, this.layers.options.value),
    );
  }

  async flush(): Promise<void> {
    await this.ready;
    await this.#pendingWrite;
  }

  async resetTheme(id = this.themeIds()[0] ?? this.activeId.peek()): Promise<boolean> {
    if (!this.registry.has(id)) return false;
    await this.ready;
    this.#suspendWrites = true;
    this.activeId.value = id;
    this.#suspendWrites = false;
    this.#pendingWrite = this.#pendingWrite
      .catch(() => undefined)
      .then(() => this.#store?.delete(this.#storageKey))
      .catch((error) => this.#onError?.(error));
    await this.#pendingWrite;
    return true;
  }

  component(componentName: string, variant = "default"): Computed<Theme> {
    return new Computed(() => this.engine.value.component(componentName, variant));
  }

  resolve(componentName: string, state: ThemeState, variant = "default"): Computed<Style> {
    return new Computed(() => this.engine.value.resolve(componentName, state, variant));
  }

  inspect(): ThemeProviderInspection {
    return {
      activeId: this.activeId.peek(),
      themes: this.registry.inspect(),
      layers: this.layers.inspect(),
      engine: this.engine.peek().inspect(),
    };
  }

  async #loadTheme(): Promise<string> {
    if (!this.#store) {
      this.#loaded = true;
      return this.activeId.peek();
    }

    try {
      const storedId = await this.#store.get(this.#storageKey);
      this.#loaded = true;
      if (storedId && this.registry.has(storedId) && !this.#dirtyBeforeLoad) {
        this.#suspendWrites = true;
        this.activeId.value = storedId;
        this.#suspendWrites = false;
      } else if (this.#dirtyBeforeLoad) {
        this.#writeTheme(this.activeId.peek());
      }
      return this.activeId.peek();
    } catch (error) {
      this.#loaded = true;
      this.#onError?.(error);
      return this.activeId.peek();
    }
  }

  #persistTheme(id: string): void {
    if (this.#suspendWrites || !this.#store) return;
    if (!this.#loaded) {
      this.#dirtyBeforeLoad = true;
      return;
    }
    this.#writeTheme(id);
  }

  #writeTheme(id: string): void {
    this.#pendingWrite = this.#pendingWrite
      .catch(() => undefined)
      .then(() => this.#store?.set(this.#storageKey, id))
      .catch((error) => this.#onError?.(error));
  }
}

function positiveModulo(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor;
}
