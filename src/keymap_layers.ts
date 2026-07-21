// Copyright 2023 Im-Beast. MIT license.
import type { KeyPressEvent } from "./input_reader/types.ts";
import { bindingId, type KeyBinding } from "./keymap.ts";

/** Stable layer scopes understood by the layered keymap registry. */
export type KeymapLayerKind = "global" | "focus-within" | "exact-focus" | "modal";

/** Reasons a registered layer or binding is currently ineligible for dispatch. */
export type LayeredKeymapInactiveReason =
  | "disposed"
  | "layer-disabled"
  | "layer-condition-error"
  | "focus-outside"
  | "focus-mismatch"
  | "modal-blocked"
  | "binding-disabled"
  | "binding-condition-error";

/** Serializable failure phases isolated by the layered keymap registry. */
export type LayeredKeymapErrorPhase =
  | "registration"
  | "layer-condition"
  | "binding-condition"
  | "dispatch"
  | "handler"
  | "target"
  | "listener"
  | "disposal";

/** Read-only context passed to runtime layer and binding conditions. */
export interface LayeredKeymapConditionContext {
  layerId: string;
  layerKind: KeymapLayerKind;
  bindingId?: string;
  focusPath: readonly string[];
}

/** A static or runtime-enabled condition evaluated at inspection and dispatch time. */
export type LayeredKeymapCondition =
  | boolean
  | ((context: LayeredKeymapConditionContext) => boolean);

/** Minimal normalized key event accepted by layered dispatch. */
export type LayeredKeymapKeyEvent = Pick<KeyPressEvent, "key" | "ctrl" | "meta" | "shift">;

/** Read-only context supplied to a winning key binding handler. */
export interface LayeredKeymapDispatchContext {
  event: LayeredKeymapKeyEvent;
  layerId: string;
  bindingId: string;
  focusPath: readonly string[];
}

/** Handler for one non-sequence key binding. Returning false declines handling without falling through. */
export type LayeredKeymapHandler = (
  context: LayeredKeymapDispatchContext,
) => unknown | Promise<unknown>;

/** One uniquely identified binding contributed to a keymap layer. */
export interface LayeredKeyBinding extends KeyBinding {
  id: string;
  order?: number;
  enabled?: LayeredKeymapCondition;
  handler: LayeredKeymapHandler;
}

/** Declarative definition of one ordered keymap layer. */
export interface KeymapLayerDefinition {
  id: string;
  kind: KeymapLayerKind;
  /** Required for focus-within and exact-focus layers; invalid for global and modal layers. */
  focusId?: string;
  /** Higher values win within the same layer kind and focus specificity. */
  order?: number;
  enabled?: LayeredKeymapCondition;
  bindings?: Iterable<LayeredKeyBinding>;
}

/** Target capable of forwarding normalized key-press events. */
export interface LayeredKeymapTarget {
  on(type: "keyPress", listener: (event: KeyPressEvent) => void | Promise<void>): () => void;
}

/** Serializable normalized error captured instead of escaping host input dispatch. */
export interface LayeredKeymapErrorInspection {
  layerId?: string;
  bindingId?: string;
  phase: LayeredKeymapErrorPhase;
  name: string;
  message: string;
  timestamp: number;
}

/** Options for bounded diagnostics and deterministic tests. */
export interface LayeredKeymapRegistryOptions {
  maxErrors?: number;
  now?: () => number;
  onError?: (error: LayeredKeymapErrorInspection) => void;
}

/** Serializable state for one registered layer. */
export interface KeymapLayerInspection {
  id: string;
  kind: KeymapLayerKind;
  focusId?: string;
  order: number;
  active: boolean;
  inactiveReason?: LayeredKeymapInactiveReason;
  scopeDepth: number;
  bindingCount: number;
}

/** Serializable state for one registered binding. */
export interface LayeredKeyBindingInspection extends KeyBinding {
  id: string;
  chord: string;
  layerId: string;
  layerKind: KeymapLayerKind;
  layerOrder: number;
  order: number;
  scopeDepth: number;
  active: boolean;
  winning: boolean;
  inactiveReason?: LayeredKeymapInactiveReason;
  shadowedBy?: { layerId: string; bindingId: string };
}

/** Compact binding reference stored in conflict reports. */
export interface LayeredKeymapConflictBindingInspection {
  layerId: string;
  bindingId: string;
  active: boolean;
  winning: boolean;
}

/** Serializable same-chord conflict across active and inactive layers. */
export interface LayeredKeymapConflictInspection {
  chord: string;
  bindingCount: number;
  activeCount: number;
  winner?: { layerId: string; bindingId: string };
  bindings: LayeredKeymapConflictBindingInspection[];
}

/** Complete serializable registry snapshot for devtools and tests. */
export interface LayeredKeymapInspection {
  disposed: boolean;
  revision: number;
  focusPath: string[];
  subscriptionCount: number;
  errorSubscriptionCount: number;
  targetCount: number;
  layerCount: number;
  bindingCount: number;
  activeBindingCount: number;
  inactiveBindingCount: number;
  conflictCount: number;
  activeConflictCount: number;
  layers: KeymapLayerInspection[];
  bindings: LayeredKeyBindingInspection[];
  conflicts: LayeredKeymapConflictInspection[];
  errorCount: number;
  errors: LayeredKeymapErrorInspection[];
}

/** Outcome of a safe key dispatch. */
export interface LayeredKeymapDispatchResult {
  status: "handled" | "declined" | "unmatched" | "disposed" | "error";
  handled: boolean;
  chord: string;
  binding?: LayeredKeyBindingInspection;
  error?: LayeredKeymapErrorInspection;
}

interface RegisteredLayer {
  id: string;
  kind: KeymapLayerKind;
  focusId?: string;
  order: number;
  enabled?: LayeredKeymapCondition;
  bindings: Map<string, RegisteredBinding>;
}

interface RegisteredBinding {
  definition: LayeredKeyBinding;
  order: number;
}

interface EvaluatedLayer {
  layer: RegisteredLayer;
  active: boolean;
  inactiveReason?: LayeredKeymapInactiveReason;
  scopeDepth: number;
}

interface EvaluatedBinding {
  layer: EvaluatedLayer;
  binding: RegisteredBinding;
  chord: string;
  active: boolean;
  inactiveReason?: LayeredKeymapInactiveReason;
}

interface KeymapEvaluation {
  focusPath: readonly string[];
  layers: EvaluatedLayer[];
  bindings: EvaluatedBinding[];
}

/**
 * Deterministic single-stroke keymap layering with focus and modal isolation.
 *
 * The highest ordered active modal layer exclusively captures dispatch.
 * Without a modal, exact focus wins over the deepest matching focus-within
 * scope, which wins over global bindings. Higher explicit order wins ties;
 * stable ids are the final tie-breaker, so registration timing never changes
 * precedence.
 */
export class LayeredKeymapRegistry {
  readonly #layers = new Map<string, RegisteredLayer>();
  readonly #listeners = new Set<() => void>();
  readonly #errorListeners = new Set<(error: LayeredKeymapErrorInspection) => void>();
  readonly #targetDisposers = new Set<() => void>();
  readonly #errors: LayeredKeymapErrorInspection[] = [];
  readonly #maxErrors: number;
  readonly #now: () => number;
  readonly #onError?: (error: LayeredKeymapErrorInspection) => void;
  #focusPath: readonly string[] = Object.freeze([]);
  #revision = 0;
  #disposed = false;

  constructor(options: LayeredKeymapRegistryOptions = {}) {
    this.#maxErrors = Math.max(0, Math.floor(options.maxErrors ?? 100));
    this.#now = options.now ?? Date.now;
    this.#onError = options.onError;
  }

  get disposed(): boolean {
    return this.#disposed;
  }

  get revision(): number {
    return this.#revision;
  }

  /** Returns a defensive snapshot of the root-to-leaf focus path. */
  get focusPath(): readonly string[] {
    return this.#focusPath.slice();
  }

  /** Registers one complete layer atomically, including its initial bindings. */
  registerLayer(definition: KeymapLayerDefinition): () => void {
    const id = definition.id.trim();
    if (this.#disposed) return this.#registrationFailure(id, "registry is disposed");
    if (!id) return this.#registrationFailure(undefined, "layer id must not be empty");
    if (!validLayerKind(definition.kind)) {
      return this.#registrationFailure(id, `unknown layer kind: ${String(definition.kind)}`);
    }
    if (this.#layers.has(id)) return this.#registrationFailure(id, `layer ${id} is already registered`);

    const focusId = definition.focusId?.trim();
    if ((definition.kind === "focus-within" || definition.kind === "exact-focus") && !focusId) {
      return this.#registrationFailure(id, `${definition.kind} layer ${id} requires focusId`);
    }
    if ((definition.kind === "global" || definition.kind === "modal") && focusId) {
      return this.#registrationFailure(id, `${definition.kind} layer ${id} must not declare focusId`);
    }

    const initialBindings = [...(definition.bindings ?? [])];
    const bindings = new Map<string, RegisteredBinding>();
    for (const candidate of initialBindings) {
      const normalized = normalizeBinding(candidate);
      if (!normalized) return this.#registrationFailure(id, "binding id, key, description, and handler are required");
      if (bindings.has(normalized.definition.id)) {
        return this.#registrationFailure(
          id,
          `binding ${normalized.definition.id} is duplicated in layer ${id}`,
          normalized.definition.id,
        );
      }
      bindings.set(normalized.definition.id, normalized);
    }

    const layer: RegisteredLayer = {
      id,
      kind: definition.kind,
      focusId,
      order: finiteOrder(definition.order),
      enabled: definition.enabled,
      bindings,
    };
    this.#layers.set(id, layer);
    this.#changed();

    return once(() => {
      if (this.#layers.get(id) !== layer) return;
      this.#layers.delete(id);
      this.#changed();
    });
  }

  /** Adds one binding to an existing layer without replacing a same-id binding. */
  registerBinding(layerId: string, binding: LayeredKeyBinding): () => void {
    const normalizedLayerId = layerId.trim();
    if (this.#disposed) return this.#registrationFailure(normalizedLayerId, "registry is disposed", binding.id);
    const layer = this.#layers.get(normalizedLayerId);
    if (!layer) return this.#registrationFailure(normalizedLayerId, `layer ${normalizedLayerId} is not registered`);
    const registered = normalizeBinding(binding);
    if (!registered) {
      return this.#registrationFailure(
        normalizedLayerId,
        "binding id, key, description, and handler are required",
        binding.id,
      );
    }
    const id = registered.definition.id;
    if (layer.bindings.has(id)) {
      return this.#registrationFailure(normalizedLayerId, `binding ${id} is already registered`, id);
    }
    layer.bindings.set(id, registered);
    this.#changed();

    return once(() => {
      if (layer.bindings.get(id) !== registered) return;
      layer.bindings.delete(id);
      this.#changed();
    });
  }

  /** Removes a layer and every binding it owns. */
  unregisterLayer(layerId: string): boolean {
    if (!this.#layers.delete(layerId.trim())) return false;
    this.#changed();
    return true;
  }

  /** Removes one binding by its layer-local stable id. */
  unregisterBinding(layerId: string, bindingIdValue: string): boolean {
    const layer = this.#layers.get(layerId.trim());
    if (!layer || !layer.bindings.delete(bindingIdValue.trim())) return false;
    this.#changed();
    return true;
  }

  /** Replaces a layer's static or runtime enabled condition. */
  setLayerEnabled(layerId: string, enabled: LayeredKeymapCondition | undefined): boolean {
    const layer = this.#layers.get(layerId.trim());
    if (!layer || layer.enabled === enabled) return false;
    layer.enabled = enabled;
    this.#changed();
    return true;
  }

  /** Replaces a binding's static or runtime enabled condition. */
  setBindingEnabled(
    layerId: string,
    bindingIdValue: string,
    enabled: LayeredKeymapCondition | undefined,
  ): boolean {
    const binding = this.#layers.get(layerId.trim())?.bindings.get(bindingIdValue.trim());
    if (!binding || binding.definition.enabled === enabled) return false;
    binding.definition = { ...binding.definition, enabled };
    this.#changed();
    return true;
  }

  /**
   * Atomically swaps the entire root-to-leaf focus path and emits at most one
   * change notification. The caller's array is never retained.
   */
  setFocusPath(focusPath: readonly string[]): boolean {
    if (this.#disposed) return false;
    const next = focusPath.slice();
    if (equalStrings(this.#focusPath, next)) return false;
    this.#focusPath = Object.freeze(next);
    this.#changed();
    return true;
  }

  /** Re-evaluates external runtime conditions and notifies inspection consumers once. */
  refresh(): boolean {
    if (this.#disposed) return false;
    this.#changed();
    return true;
  }

  /** Returns the current winning active binding for an event without dispatching it. */
  resolve(event: LayeredKeymapKeyEvent): LayeredKeyBindingInspection | undefined {
    if (this.#disposed) return undefined;
    const chord = bindingId(event);
    const evaluation = this.#evaluate();
    const winner = winningBinding(evaluation.bindings, chord);
    return winner ? bindingInspection(winner, winner) : undefined;
  }

  /** Dispatches one single-stroke key safely; handler and condition failures never escape. */
  async dispatch(event: LayeredKeymapKeyEvent): Promise<LayeredKeymapDispatchResult> {
    const chord = bindingId(event);
    if (this.#disposed) return { status: "disposed", handled: false, chord };

    let evaluation: KeymapEvaluation;
    let winner: EvaluatedBinding | undefined;
    try {
      evaluation = this.#evaluate();
      winner = winningBinding(evaluation.bindings, chord);
    } catch (error) {
      const inspected = this.#recordError({ phase: "dispatch", error });
      return { status: "error", handled: false, chord, error: inspected };
    }
    if (!winner) return { status: "unmatched", handled: false, chord };

    const inspectedBinding = bindingInspection(winner, winner);
    try {
      const handled = await winner.binding.definition.handler({
        event: { ...event },
        layerId: winner.layer.layer.id,
        bindingId: winner.binding.definition.id,
        focusPath: evaluation.focusPath.slice(),
      });
      if (handled === false) {
        return { status: "declined", handled: false, chord, binding: inspectedBinding };
      }
      return { status: "handled", handled: true, chord, binding: inspectedBinding };
    } catch (error) {
      const inspected = this.#recordError({
        layerId: winner.layer.layer.id,
        bindingId: winner.binding.definition.id,
        phase: "handler",
        error,
      });
      return {
        status: "error",
        handled: false,
        chord,
        binding: inspectedBinding,
        error: inspected,
      };
    }
  }

  /** Binds safe dispatch to a key-press source and tracks the subscription for disposal. */
  bind(target: LayeredKeymapTarget): () => void {
    if (this.#disposed) return this.#registrationFailure(undefined, "registry is disposed");
    let unbind: (() => void) | undefined;
    try {
      unbind = target.on("keyPress", (event) => {
        void this.dispatch(event);
      });
    } catch (error) {
      this.#recordError({ phase: "target", error });
      return noop;
    }

    let active = true;
    const dispose = () => {
      if (!active) return;
      active = false;
      this.#targetDisposers.delete(dispose);
      try {
        unbind?.();
      } catch (error) {
        this.#recordError({ phase: "disposal", error });
      }
    };
    this.#targetDisposers.add(dispose);
    return dispose;
  }

  /** Subscribes to atomic registry and focus-path state changes. */
  subscribe(listener: () => void): () => void {
    if (this.#disposed) return noop;
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  /** Subscribes to normalized condition, handler, target, and lifecycle failures. */
  onError(listener: (error: LayeredKeymapErrorInspection) => void): () => void {
    if (this.#disposed) return noop;
    this.#errorListeners.add(listener);
    return () => this.#errorListeners.delete(listener);
  }

  /** Returns a complete active/inactive binding and conflict snapshot. */
  inspect(): LayeredKeymapInspection {
    const evaluation = this.#evaluate();
    const winners = winningBindings(evaluation.bindings);
    const bindings = evaluation.bindings.map((binding) => bindingInspection(binding, winners.get(binding.chord))).sort(
      compareBindingInspections,
    );
    const layers = evaluation.layers.map(layerInspection).sort(compareLayerInspections);
    const conflicts = conflictInspections(bindings);
    let activeBindingCount = 0;
    for (const binding of bindings) {
      if (binding.active) activeBindingCount += 1;
    }
    let activeConflictCount = 0;
    for (const conflict of conflicts) {
      if (conflict.activeCount > 1) activeConflictCount += 1;
    }
    return {
      disposed: this.#disposed,
      revision: this.#revision,
      focusPath: [...evaluation.focusPath],
      subscriptionCount: this.#listeners.size,
      errorSubscriptionCount: this.#errorListeners.size,
      targetCount: this.#targetDisposers.size,
      layerCount: layers.length,
      bindingCount: bindings.length,
      activeBindingCount,
      inactiveBindingCount: bindings.length - activeBindingCount,
      conflictCount: conflicts.length,
      activeConflictCount,
      layers,
      bindings,
      conflicts,
      errorCount: this.#errors.length,
      errors: this.#errors.map((error) => ({ ...error })),
    };
  }

  /** Removes retained diagnostics and notifies inspection consumers. */
  clearErrors(): void {
    if (this.#errors.length === 0) return;
    this.#errors.length = 0;
    if (!this.#disposed) this.#changed();
  }

  /** Removes all layers while preserving subscriptions and focus state. */
  clear(): void {
    if (this.#layers.size === 0) return;
    this.#layers.clear();
    this.#changed();
  }

  /** Permanently removes layers, input subscriptions, and listeners. */
  dispose(): void {
    if (this.#disposed) return;
    const targets = [...this.#targetDisposers].reverse();
    this.#targetDisposers.clear();
    for (const dispose of targets) dispose();
    this.#layers.clear();
    this.#disposed = true;
    this.#revision += 1;
    this.#notify();
    this.#listeners.clear();
    this.#errorListeners.clear();
  }

  #evaluate(): KeymapEvaluation {
    const focusPath = Object.freeze(this.#focusPath.slice());
    const layers: EvaluatedLayer[] = [];
    for (const layer of this.#layers.values()) {
      const context: LayeredKeymapConditionContext = {
        layerId: layer.id,
        layerKind: layer.kind,
        focusPath,
      };
      const condition = this.#evaluateCondition(layer.enabled, context, "layer-condition");
      let active = !this.#disposed && condition.enabled;
      let inactiveReason: LayeredKeymapInactiveReason | undefined = this.#disposed
        ? "disposed"
        : condition.error
        ? "layer-condition-error"
        : condition.enabled
        ? undefined
        : "layer-disabled";
      const focusIndex = layer.focusId === undefined ? -1 : focusPath.lastIndexOf(layer.focusId);
      if (active && layer.kind === "focus-within" && focusIndex < 0) {
        active = false;
        inactiveReason = "focus-outside";
      } else if (
        active && layer.kind === "exact-focus" &&
        (focusPath.length === 0 || focusPath[focusPath.length - 1] !== layer.focusId)
      ) {
        active = false;
        inactiveReason = "focus-mismatch";
      }
      layers.push({ layer, active, inactiveReason, scopeDepth: focusIndex });
    }

    const activeModals = layers.filter((entry) => entry.active && entry.layer.kind === "modal");
    activeModals.sort(compareModalLayerPrecedence);
    const activeModal = activeModals[0];
    if (activeModal) {
      for (const entry of layers) {
        if (entry.active && entry !== activeModal) {
          entry.active = false;
          entry.inactiveReason = "modal-blocked";
        }
      }
    }

    const bindings: EvaluatedBinding[] = [];
    for (const evaluatedLayer of layers) {
      for (const binding of evaluatedLayer.layer.bindings.values()) {
        let active = evaluatedLayer.active;
        let inactiveReason = evaluatedLayer.inactiveReason;
        if (active) {
          const context: LayeredKeymapConditionContext = {
            layerId: evaluatedLayer.layer.id,
            layerKind: evaluatedLayer.layer.kind,
            bindingId: binding.definition.id,
            focusPath,
          };
          const condition = this.#evaluateCondition(binding.definition.enabled, context, "binding-condition");
          if (!condition.enabled) {
            active = false;
            inactiveReason = condition.error ? "binding-condition-error" : "binding-disabled";
          }
        }
        bindings.push({
          layer: evaluatedLayer,
          binding,
          chord: bindingId(binding.definition),
          active,
          inactiveReason,
        });
      }
    }
    return { focusPath, layers, bindings };
  }

  #evaluateCondition(
    condition: LayeredKeymapCondition | undefined,
    context: LayeredKeymapConditionContext,
    phase: "layer-condition" | "binding-condition",
  ): { enabled: boolean; error: boolean } {
    if (condition === undefined) return { enabled: true, error: false };
    if (typeof condition === "boolean") return { enabled: condition, error: false };
    try {
      return { enabled: Boolean(condition(context)), error: false };
    } catch (error) {
      this.#recordError({
        layerId: context.layerId,
        bindingId: context.bindingId,
        phase,
        error,
      });
      return { enabled: false, error: true };
    }
  }

  #registrationFailure(layerId: string | undefined, message: string, bindingIdValue?: string): () => void {
    this.#recordError({
      layerId: layerId || undefined,
      bindingId: bindingIdValue?.trim() || undefined,
      phase: "registration",
      error: message,
    });
    return noop;
  }

  #recordError(report: {
    layerId?: string;
    bindingId?: string;
    phase: LayeredKeymapErrorPhase;
    error: unknown;
  }): LayeredKeymapErrorInspection {
    const normalized = normalizeError(report.error);
    const inspected: LayeredKeymapErrorInspection = {
      layerId: report.layerId,
      bindingId: report.bindingId,
      phase: report.phase,
      name: normalized.name,
      message: normalized.message,
      timestamp: safeTimestamp(this.#now),
    };
    if (this.#maxErrors > 0) {
      this.#errors.push(inspected);
      if (this.#errors.length > this.#maxErrors) this.#errors.splice(0, this.#errors.length - this.#maxErrors);
    }
    safelyNotifyError(this.#onError, inspected);
    for (const listener of [...this.#errorListeners]) safelyNotifyError(listener, inspected);
    return { ...inspected };
  }

  #changed(): void {
    this.#revision += 1;
    this.#notify();
  }

  #notify(): void {
    for (const listener of [...this.#listeners]) {
      try {
        listener();
      } catch (error) {
        this.#recordError({ phase: "listener", error });
      }
    }
  }
}

function normalizeBinding(binding: LayeredKeyBinding): RegisteredBinding | undefined {
  const id = binding.id?.trim();
  const key = binding.key?.trim();
  const description = binding.description?.trim();
  if (!id || !key || !description || typeof binding.handler !== "function") return undefined;
  return {
    definition: {
      ...binding,
      id,
      key,
      description,
      group: binding.group?.trim() || undefined,
      ctrl: binding.ctrl || undefined,
      meta: binding.meta || undefined,
      shift: binding.shift || undefined,
      order: finiteOrder(binding.order),
    },
    order: finiteOrder(binding.order),
  };
}

function validLayerKind(kind: KeymapLayerKind): boolean {
  return kind === "global" || kind === "focus-within" || kind === "exact-focus" || kind === "modal";
}

function finiteOrder(value: number | undefined): number {
  return Number.isFinite(value) ? Math.trunc(value ?? 0) : 0;
}

function kindRank(kind: KeymapLayerKind): number {
  if (kind === "modal") return 3;
  if (kind === "exact-focus") return 2;
  if (kind === "focus-within") return 1;
  return 0;
}

function compareBindingPrecedence(left: EvaluatedBinding, right: EvaluatedBinding): number {
  return kindRank(right.layer.layer.kind) - kindRank(left.layer.layer.kind) ||
    right.layer.scopeDepth - left.layer.scopeDepth ||
    right.layer.layer.order - left.layer.layer.order ||
    right.binding.order - left.binding.order ||
    left.layer.layer.id.localeCompare(right.layer.layer.id) ||
    left.binding.definition.id.localeCompare(right.binding.definition.id);
}

function compareModalLayerPrecedence(left: EvaluatedLayer, right: EvaluatedLayer): number {
  return right.layer.order - left.layer.order || left.layer.id.localeCompare(right.layer.id);
}

function winningBinding(bindings: readonly EvaluatedBinding[], chord: string): EvaluatedBinding | undefined {
  const candidates = bindings.filter((binding) => binding.active && binding.chord === chord);
  candidates.sort(compareBindingPrecedence);
  return candidates[0];
}

function winningBindings(bindings: readonly EvaluatedBinding[]): Map<string, EvaluatedBinding> {
  const winners = new Map<string, EvaluatedBinding>();
  const active = bindings.filter((binding) => binding.active).sort(compareBindingPrecedence);
  for (const binding of active) {
    if (!winners.has(binding.chord)) winners.set(binding.chord, binding);
  }
  return winners;
}

function layerInspection(evaluated: EvaluatedLayer): KeymapLayerInspection {
  return {
    id: evaluated.layer.id,
    kind: evaluated.layer.kind,
    focusId: evaluated.layer.focusId,
    order: evaluated.layer.order,
    active: evaluated.active,
    inactiveReason: evaluated.inactiveReason,
    scopeDepth: evaluated.scopeDepth,
    bindingCount: evaluated.layer.bindings.size,
  };
}

function bindingInspection(
  evaluated: EvaluatedBinding,
  winner: EvaluatedBinding | undefined,
): LayeredKeyBindingInspection {
  const definition = evaluated.binding.definition;
  const winning = winner === evaluated;
  return {
    id: definition.id,
    chord: evaluated.chord,
    layerId: evaluated.layer.layer.id,
    layerKind: evaluated.layer.layer.kind,
    layerOrder: evaluated.layer.layer.order,
    order: evaluated.binding.order,
    scopeDepth: evaluated.layer.scopeDepth,
    key: definition.key,
    description: definition.description,
    group: definition.group,
    ctrl: definition.ctrl,
    meta: definition.meta,
    shift: definition.shift,
    active: evaluated.active,
    winning,
    inactiveReason: evaluated.inactiveReason,
    shadowedBy: evaluated.active && winner && !winning
      ? { layerId: winner.layer.layer.id, bindingId: winner.binding.definition.id }
      : undefined,
  };
}

function conflictInspections(bindings: readonly LayeredKeyBindingInspection[]): LayeredKeymapConflictInspection[] {
  const byChord = new Map<string, LayeredKeyBindingInspection[]>();
  for (const binding of bindings) {
    const group = byChord.get(binding.chord);
    if (group) group.push(binding);
    else byChord.set(binding.chord, [binding]);
  }
  const conflicts: LayeredKeymapConflictInspection[] = [];
  for (const [chord, group] of byChord) {
    if (group.length < 2) continue;
    const winner = group.find((binding) => binding.winning);
    const activeCount = group.filter((binding) => binding.active).length;
    conflicts.push({
      chord,
      bindingCount: group.length,
      activeCount,
      winner: winner ? { layerId: winner.layerId, bindingId: winner.id } : undefined,
      bindings: group.map((binding) => ({
        layerId: binding.layerId,
        bindingId: binding.id,
        active: binding.active,
        winning: binding.winning,
      })),
    });
  }
  return conflicts.sort((left, right) => left.chord.localeCompare(right.chord));
}

function compareLayerInspections(left: KeymapLayerInspection, right: KeymapLayerInspection): number {
  return Number(right.active) - Number(left.active) || kindRank(right.kind) - kindRank(left.kind) ||
    right.scopeDepth - left.scopeDepth || right.order - left.order || left.id.localeCompare(right.id);
}

function compareBindingInspections(
  left: LayeredKeyBindingInspection,
  right: LayeredKeyBindingInspection,
): number {
  return left.chord.localeCompare(right.chord) || Number(right.active) - Number(left.active) ||
    Number(right.winning) - Number(left.winning) || kindRank(right.layerKind) - kindRank(left.layerKind) ||
    right.scopeDepth - left.scopeDepth || right.layerOrder - left.layerOrder || right.order - left.order ||
    left.layerId.localeCompare(right.layerId) || left.id.localeCompare(right.id);
}

function normalizeError(error: unknown): { name: string; message: string } {
  if (error instanceof Error) return { name: error.name || "Error", message: error.message };
  if (typeof error === "string") return { name: "Error", message: error };
  try {
    return { name: "Error", message: JSON.stringify(error) ?? String(error) };
  } catch {
    return { name: "Error", message: String(error) };
  }
}

function safeTimestamp(now: () => number): number {
  try {
    const value = now();
    return Number.isFinite(value) ? value : Date.now();
  } catch {
    return Date.now();
  }
}

function safelyNotifyError(
  listener: ((error: LayeredKeymapErrorInspection) => void) | undefined,
  error: LayeredKeymapErrorInspection,
): void {
  try {
    listener?.({ ...error });
  } catch {
    // Error-reporting hooks are diagnostic sinks and must not break input dispatch.
  }
}

function equalStrings(left: readonly string[], right: readonly string[]): boolean {
  if (left.length !== right.length) return false;
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) return false;
  }
  return true;
}

function once(callback: () => void): () => void {
  let active = true;
  return () => {
    if (!active) return;
    active = false;
    callback();
  };
}

function noop(): void {}
