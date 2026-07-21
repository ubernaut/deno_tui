// Copyright 2023 Im-Beast. MIT license.

/** Host-owned policy for combining fallback content with plugin slot output. */
export type PluginSlotMode = "append" | "replace" | "single-winner";

/** Lifecycle phase that produced an isolated plugin-slot failure. */
export type PluginSlotErrorPhase = "registration" | "setup" | "render" | "dispose";

/** Renderer callback contributed to one typed host slot. */
export type PluginSlotRenderer<TNode, TContext, TProps> = (
  context: TContext,
  props: TProps,
) => TNode | null | undefined;

/** Typed renderer map contributed by a plugin. */
export type PluginSlotRenderers<TNode, TSlots extends object, TContext> = {
  [TName in keyof TSlots]?: PluginSlotRenderer<TNode, TContext, TSlots[TName]>;
};

/** One plugin contributing renderers to host-owned slots. */
export interface PluginSlotPlugin<TNode, TSlots extends object, TContext> {
  id: string;
  order?: number;
  slots: PluginSlotRenderers<TNode, TSlots, TContext>;
  setup?: (context: TContext) => void | (() => void);
  dispose?: () => void;
}

/** Structured plugin-slot error retained for diagnostics. */
export interface PluginSlotErrorEvent<TName extends PropertyKey = string> {
  pluginId: string;
  slot?: TName;
  phase: PluginSlotErrorPhase;
  error: Error;
  timestamp: number;
}

/** Input accepted by `PluginSlotRegistry.reportError`. */
export interface PluginSlotErrorReport<TName extends PropertyKey = string> {
  pluginId: string;
  slot?: TName;
  phase: PluginSlotErrorPhase;
  error: unknown;
}

/** Registry configuration, including bounded error diagnostics. */
export interface PluginSlotRegistryOptions<TName extends PropertyKey = string> {
  maxErrors?: number;
  now?: () => number;
  onError?: (event: PluginSlotErrorEvent<TName>) => void;
}

/** Ordered renderer entry returned without granting a plugin layout ownership. */
export interface PluginSlotEntry<TNode, TContext, TProps> {
  pluginId: string;
  order: number;
  renderer: PluginSlotRenderer<TNode, TContext, TProps>;
}

/** Successful plugin output produced while resolving a slot. */
export interface PluginSlotRenderedContribution<TNode> {
  pluginId: string;
  node: TNode;
}

/** Options for rendering one host-owned slot. */
export interface RenderPluginSlotOptions<TNode> {
  mode?: PluginSlotMode;
  fallback?: () => TNode | null | undefined;
}

/** Renderer-neutral result of combining fallback and plugin slot output. */
export interface PluginSlotRenderResult<TNode> {
  mode: PluginSlotMode;
  nodes: TNode[];
  contributions: PluginSlotRenderedContribution<TNode>[];
  usedFallback: boolean;
  winnerPluginId?: string;
  revision: number;
}

/** Serializable plugin metadata exposed by registry inspection. */
export interface PluginSlotPluginInspection {
  id: string;
  order: number;
  slots: string[];
}

/** Serializable plugin failure metadata exposed by registry inspection. */
export interface PluginSlotErrorInspection {
  pluginId: string;
  slot?: string;
  phase: PluginSlotErrorPhase;
  message: string;
  timestamp: number;
}

/** Serializable state for devtools and lifecycle assertions. */
export interface PluginSlotRegistryInspection {
  disposed: boolean;
  revision: number;
  pluginCount: number;
  plugins: PluginSlotPluginInspection[];
  errorCount: number;
  errors: PluginSlotErrorInspection[];
}

interface RegisteredPlugin<TNode, TSlots extends object, TContext> {
  definition: PluginSlotPlugin<TNode, TSlots, TContext>;
  order: number;
  sequence: number;
  setupDisposer?: () => void;
}

/**
 * Typed, framework-neutral registry for plugin UI contributions.
 *
 * The host chooses where and how resolved nodes are laid out. Plugins can only
 * return values through declared slot prop contracts, and every plugin
 * lifecycle/render failure is isolated from host fallback content.
 */
export class PluginSlotRegistry<TNode, TSlots extends object, TContext extends object = Record<string, never>> {
  readonly #plugins = new Map<string, RegisteredPlugin<TNode, TSlots, TContext>>();
  readonly #listeners = new Set<() => void>();
  readonly #errorListeners = new Set<(event: PluginSlotErrorEvent<Extract<keyof TSlots, string>>) => void>();
  readonly #errors: PluginSlotErrorEvent<Extract<keyof TSlots, string>>[] = [];
  readonly #now: () => number;
  readonly #maxErrors: number;
  readonly #onError?: (event: PluginSlotErrorEvent<Extract<keyof TSlots, string>>) => void;
  #sequence = 0;
  #revision = 0;
  #disposed = false;

  constructor(
    readonly context: TContext,
    options: PluginSlotRegistryOptions<Extract<keyof TSlots, string>> = {},
  ) {
    this.#now = options.now ?? Date.now;
    this.#maxErrors = Math.max(0, Math.floor(options.maxErrors ?? 100));
    this.#onError = options.onError;
  }

  get disposed(): boolean {
    return this.#disposed;
  }

  get revision(): number {
    return this.#revision;
  }

  /** Registers one plugin, or safely rejects it when setup/identity fails. */
  register(plugin: PluginSlotPlugin<TNode, TSlots, TContext>): () => void {
    const id = plugin.id.trim();
    if (this.#disposed) {
      this.reportError({ pluginId: id || "<anonymous>", phase: "registration", error: "registry is disposed" });
      return noop;
    }
    if (!id) {
      this.reportError({ pluginId: "<anonymous>", phase: "registration", error: "plugin id must not be empty" });
      return noop;
    }
    if (this.#plugins.has(id)) {
      this.reportError({ pluginId: id, phase: "registration", error: `plugin ${id} is already registered` });
      return noop;
    }

    let setupDisposer: void | (() => void);
    try {
      setupDisposer = plugin.setup?.(this.context);
    } catch (error) {
      this.reportError({ pluginId: id, phase: "setup", error });
      return noop;
    }

    const registered: RegisteredPlugin<TNode, TSlots, TContext> = {
      definition: plugin.id === id ? plugin : { ...plugin, id },
      order: finiteOrder(plugin.order),
      sequence: this.#sequence++,
      setupDisposer: setupDisposer || undefined,
    };
    this.#plugins.set(id, registered);
    this.#changed();

    let active = true;
    return () => {
      if (!active) return;
      active = false;
      if (this.#plugins.get(id) === registered) this.#remove(id, registered);
    };
  }

  /** Removes a plugin by id and disposes its resources once. */
  unregister(id: string): boolean {
    const registered = this.#plugins.get(id);
    if (!registered) return false;
    this.#remove(id, registered);
    return true;
  }

  /** Updates deterministic plugin priority without changing registration order. */
  updateOrder(id: string, order: number): boolean {
    const registered = this.#plugins.get(id);
    if (!registered) return false;
    const normalized = finiteOrder(order);
    if (registered.order === normalized) return true;
    registered.order = normalized;
    this.#changed();
    return true;
  }

  has(id: string): boolean {
    return this.#plugins.has(id);
  }

  /** Returns plugin ids in their current resolved order. */
  pluginIds(): string[] {
    return this.#orderedPlugins().map((plugin) => plugin.definition.id);
  }

  /** Returns ordered plugin identities and callbacks for a typed slot. */
  resolveEntries<TName extends Extract<keyof TSlots, string>>(
    slot: TName,
  ): PluginSlotEntry<TNode, TContext, TSlots[TName]>[] {
    const entries: PluginSlotEntry<TNode, TContext, TSlots[TName]>[] = [];
    for (const plugin of this.#orderedPlugins()) {
      const renderer = plugin.definition.slots[slot] as
        | PluginSlotRenderer<TNode, TContext, TSlots[TName]>
        | undefined;
      if (renderer) entries.push({ pluginId: plugin.definition.id, order: plugin.order, renderer });
    }
    return entries;
  }

  /** Returns only ordered callbacks for a typed slot. */
  resolve<TName extends Extract<keyof TSlots, string>>(
    slot: TName,
  ): PluginSlotRenderer<TNode, TContext, TSlots[TName]>[] {
    return this.resolveEntries(slot).map((entry) => entry.renderer);
  }

  /** Renders a slot while isolating failed or empty plugin contributions. */
  render<TName extends Extract<keyof TSlots, string>>(
    slot: TName,
    props: TSlots[TName],
    options: RenderPluginSlotOptions<TNode> = {},
  ): PluginSlotRenderResult<TNode> {
    const mode = options.mode ?? "append";
    const contributions: PluginSlotRenderedContribution<TNode>[] = [];
    for (const entry of this.resolveEntries(slot)) {
      try {
        const node = entry.renderer(this.context, props);
        if (node === null || node === undefined) continue;
        contributions.push({ pluginId: entry.pluginId, node });
        if (mode === "single-winner") break;
      } catch (error) {
        this.reportError({ pluginId: entry.pluginId, slot, phase: "render", error });
      }
    }

    const pluginNodes = contributions.map((contribution) => contribution.node);
    const needsFallback = mode === "append" || pluginNodes.length === 0;
    const fallback = needsFallback ? options.fallback?.() : undefined;
    const hasFallback = fallback !== null && fallback !== undefined;
    const nodes = mode === "append"
      ? [...(hasFallback ? [fallback] : []), ...pluginNodes] as TNode[]
      : pluginNodes.length > 0
      ? pluginNodes
      : hasFallback
      ? [fallback] as TNode[]
      : [];

    return {
      mode,
      nodes,
      contributions,
      usedFallback: hasFallback,
      winnerPluginId: mode === "single-winner" ? contributions[0]?.pluginId : undefined,
      revision: this.#revision,
    };
  }

  /** Subscribes to registry mutations used by renderer/framework adapters. */
  subscribe(listener: () => void): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  /** Subscribes to isolated plugin failures. */
  onError(listener: (event: PluginSlotErrorEvent<Extract<keyof TSlots, string>>) => void): () => void {
    this.#errorListeners.add(listener);
    return () => this.#errorListeners.delete(listener);
  }

  /** Adds a normalized diagnostic event without throwing into host rendering. */
  reportError(
    report: PluginSlotErrorReport<Extract<keyof TSlots, string>>,
  ): PluginSlotErrorEvent<Extract<keyof TSlots, string>> {
    const event: PluginSlotErrorEvent<Extract<keyof TSlots, string>> = {
      pluginId: report.pluginId,
      slot: report.slot,
      phase: report.phase,
      error: normalizeError(report.error),
      timestamp: this.#now(),
    };
    if (this.#maxErrors > 0) {
      this.#errors.push(event);
      if (this.#errors.length > this.#maxErrors) this.#errors.splice(0, this.#errors.length - this.#maxErrors);
    }
    safelyNotifyError(this.#onError, event);
    for (const listener of [...this.#errorListeners]) safelyNotifyError(listener, event);
    return event;
  }

  errors(): PluginSlotErrorEvent<Extract<keyof TSlots, string>>[] {
    return this.#errors.slice();
  }

  clearErrors(): void {
    this.#errors.length = 0;
  }

  /** Removes every contribution and disposes plugins in reverse registration order. */
  clear(): void {
    if (this.#plugins.size === 0) return;
    const plugins = [...this.#plugins.values()].sort((left, right) => right.sequence - left.sequence);
    this.#plugins.clear();
    this.#changed();
    for (const plugin of plugins) this.#disposePlugin(plugin);
  }

  /** Permanently closes the registry and all registered plugin resources. */
  dispose(): void {
    if (this.#disposed) return;
    this.clear();
    this.#disposed = true;
    this.#changed();
    this.#listeners.clear();
    this.#errorListeners.clear();
  }

  inspect(): PluginSlotRegistryInspection {
    const plugins = this.#orderedPlugins().map((plugin) => ({
      id: plugin.definition.id,
      order: plugin.order,
      slots: Object.keys(plugin.definition.slots).sort(),
    }));
    return {
      disposed: this.#disposed,
      revision: this.#revision,
      pluginCount: plugins.length,
      plugins,
      errorCount: this.#errors.length,
      errors: this.#errors.map((event) => ({
        pluginId: event.pluginId,
        slot: event.slot === undefined ? undefined : String(event.slot),
        phase: event.phase,
        message: event.error.message,
        timestamp: event.timestamp,
      })),
    };
  }

  #orderedPlugins(): RegisteredPlugin<TNode, TSlots, TContext>[] {
    return [...this.#plugins.values()].sort(compareRegisteredPlugins);
  }

  #remove(id: string, registered: RegisteredPlugin<TNode, TSlots, TContext>): void {
    this.#plugins.delete(id);
    this.#changed();
    this.#disposePlugin(registered);
  }

  #disposePlugin(registered: RegisteredPlugin<TNode, TSlots, TContext>): void {
    const id = registered.definition.id;
    for (const dispose of [registered.setupDisposer, registered.definition.dispose]) {
      if (!dispose) continue;
      try {
        dispose();
      } catch (error) {
        this.reportError({ pluginId: id, phase: "dispose", error });
      }
    }
  }

  #changed(): void {
    this.#revision += 1;
    for (const listener of [...this.#listeners]) {
      try {
        listener();
      } catch {
        // Observers are advisory and cannot break registry state transitions.
      }
    }
  }
}

/** Creates a typed, framework-neutral plugin slot registry. */
export function createPluginSlotRegistry<
  TNode,
  TSlots extends object,
  TContext extends object = Record<string, never>,
>(
  context: TContext,
  options: PluginSlotRegistryOptions<Extract<keyof TSlots, string>> = {},
): PluginSlotRegistry<TNode, TSlots, TContext> {
  return new PluginSlotRegistry<TNode, TSlots, TContext>(context, options);
}

function compareRegisteredPlugins<TNode, TSlots extends object, TContext>(
  left: RegisteredPlugin<TNode, TSlots, TContext>,
  right: RegisteredPlugin<TNode, TSlots, TContext>,
): number {
  return left.order - right.order || left.sequence - right.sequence ||
    left.definition.id.localeCompare(right.definition.id);
}

function finiteOrder(order: number | undefined): number {
  return order !== undefined && Number.isFinite(order) ? order : 0;
}

function normalizeError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

function safelyNotifyError<TName extends PropertyKey>(
  listener: ((event: PluginSlotErrorEvent<TName>) => void) | undefined,
  event: PluginSlotErrorEvent<TName>,
): void {
  try {
    listener?.(event);
  } catch {
    // Error observers are diagnostics only and never own host UI lifecycle.
  }
}

function noop(): void {}
