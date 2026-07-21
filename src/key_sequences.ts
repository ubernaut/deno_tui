// Copyright 2023 Im-Beast. MIT license.
import type {
  KeymapLayerInspection,
  LayeredKeymapDispatchResult,
  LayeredKeymapKeyEvent,
  LayeredKeymapRegistry,
  LayeredKeymapTarget,
} from "./keymap_layers.ts";
import { bindingId } from "./keymap.ts";

/** Default configurable leader used when a map does not declare one. */
export const DEFAULT_KEY_SEQUENCE_LEADER = "C-space";

/** Canonical input accepted for one sequence stroke. */
export type KeySequenceStrokeInput =
  | string
  | LayeredKeymapKeyEvent
  | { leader: string };

/** Runtime condition context shared by commands and sequence bindings. */
export interface KeySequenceConditionContext {
  commandId: string;
  bindingId?: string;
  layerId?: string;
  focusPath: readonly string[];
  modes: readonly string[];
}

/** Static or runtime condition. Exceptions fail closed and are inspectable. */
export type KeySequenceCondition = boolean | ((context: KeySequenceConditionContext) => boolean);

/** Read-only context passed to a named command handler. */
export interface KeySequenceCommandContext {
  command: KeySequenceCommandInspection;
  binding: KeySequenceBindingInspection;
  events: readonly LayeredKeymapKeyEvent[];
  focusPath: readonly string[];
  modes: readonly string[];
  timestamp: number;
}

/** Named command metadata and behavior referenced by one or more bindings. */
export interface KeySequenceCommandDefinition {
  id: string;
  title: string;
  description?: string;
  category?: string;
  keywords?: readonly string[];
  enabled?: KeySequenceCondition;
  handler: (context: KeySequenceCommandContext) => unknown | Promise<unknown>;
}

/** One layer-scoped single- or multi-stroke command binding. */
export interface KeySequenceBindingDefinition {
  id: string;
  commandId: string;
  layerId: string;
  sequence: readonly KeySequenceStrokeInput[];
  /** Higher values win after the existing layer kind, focus depth, and layer order. */
  order?: number;
  /** A binding is eligible when any listed mode is active. Omit for every mode. */
  modes?: readonly string[];
  enabled?: KeySequenceCondition;
}

/** Entire atomic live-remapping unit. */
export interface KeySequenceMapDefinition {
  commands: readonly KeySequenceCommandDefinition[];
  bindings: readonly KeySequenceBindingDefinition[];
  /** Named leaders. `<leader>` addresses `leader`; `<leader:name>` addresses another entry. */
  leaders?: Readonly<Record<string, Exclude<KeySequenceStrokeInput, { leader: string }>>>;
}

/** Construction limits and deterministic clock injection. No timer is created. */
export interface KeySequenceCoordinatorOptions {
  registry: LayeredKeymapRegistry;
  map?: KeySequenceMapDefinition;
  modes?: readonly string[];
  timeoutMs?: number;
  maxBindings?: number;
  maxSequenceLength?: number;
  maxPendingCandidates?: number;
  maxErrors?: number;
  now?: () => number;
}

/** Stable validation issue codes returned by rejected atomic remaps. */
export type KeySequenceMapIssueCode =
  | "binding-limit-exceeded"
  | "command-handler-required"
  | "command-id-duplicate"
  | "command-id-required"
  | "command-title-required"
  | "binding-command-missing"
  | "binding-id-duplicate"
  | "binding-id-required"
  | "binding-layer-required"
  | "binding-mode-invalid"
  | "binding-sequence-empty"
  | "binding-sequence-too-long"
  | "leader-invalid"
  | "leader-missing"
  | "pending-candidate-limit-exceeded"
  | "stroke-invalid";

/** Clone-safe validation issue for a rejected map. */
export interface KeySequenceMapIssue {
  code: KeySequenceMapIssueCode;
  path: string;
  message: string;
}

/** Atomic remap outcome. Rejection never replaces the active map. */
export interface KeySequenceRemapResult {
  status: "applied" | "rejected" | "disposed";
  applied: boolean;
  previousMapRevision: number;
  mapRevision: number;
  issues: KeySequenceMapIssue[];
}

/** Runtime error phases isolated by the coordinator. */
export type KeySequenceErrorPhase = "condition" | "handler" | "target" | "listener" | "disposal";

/** Clone-safe bounded runtime error. */
export interface KeySequenceErrorInspection {
  phase: KeySequenceErrorPhase;
  name: string;
  message: string;
  timestamp: number;
  commandId?: string;
  bindingId?: string;
}

/** Clone-safe named command metadata. Handler references are intentionally omitted. */
export interface KeySequenceCommandInspection {
  id: string;
  title: string;
  description?: string;
  category?: string;
  keywords: string[];
  active: boolean;
  inactiveReason?: "command-disabled" | "command-condition-error" | "disposed";
  bindingCount: number;
}

/** Reasons a configured sequence binding is currently ineligible. */
export type KeySequenceBindingInactiveReason =
  | "disposed"
  | "layer-missing"
  | "layer-inactive"
  | "mode-inactive"
  | "command-disabled"
  | "command-condition-error"
  | "binding-disabled"
  | "binding-condition-error";

/** Clone-safe evaluated sequence binding. */
export interface KeySequenceBindingInspection {
  id: string;
  commandId: string;
  layerId: string;
  layerKind?: KeymapLayerInspection["kind"];
  layerOrder: number;
  scopeDepth: number;
  order: number;
  modes: string[];
  declaredSequence: string[];
  sequence: string[];
  displaySequence: string;
  active: boolean;
  winning: boolean;
  inactiveReason?: KeySequenceBindingInactiveReason;
  layerInactiveReason?: string;
  shadowedBy?: { layerId: string; bindingId: string };
}

/** Exact-sequence or prefix ambiguity report. */
export interface KeySequenceConflictInspection {
  kind: "exact" | "prefix";
  sequence: string[];
  displaySequence: string;
  bindingCount: number;
  activeCount: number;
  winner?: { layerId: string; bindingId: string };
  bindings: Array<{
    layerId: string;
    bindingId: string;
    active: boolean;
    winning: boolean;
  }>;
}

/** Bounded pending prefix state. Time advances only through explicit caller methods. */
export interface KeySequencePendingInspection {
  sequence: string[];
  candidateBindingIds: string[];
  deferredBindingId?: string;
  startedAt: number;
  lastStrokeAt: number;
  expiresAt: number;
  mapRevision: number;
  layerRevision: number;
}

/** Full clone-safe coordinator snapshot. */
export interface KeySequenceCoordinatorInspection {
  disposed: boolean;
  revision: number;
  mapRevision: number;
  layerRevision: number;
  timeoutMs: number;
  modes: string[];
  leaders: Array<{ name: string; chord: string }>;
  commandCount: number;
  bindingCount: number;
  activeBindingCount: number;
  conflictCount: number;
  shadowCount: number;
  pending?: KeySequencePendingInspection;
  commands: KeySequenceCommandInspection[];
  bindings: KeySequenceBindingInspection[];
  conflicts: KeySequenceConflictInspection[];
  lastRemap: KeySequenceRemapResult;
  targetCount: number;
  subscriptionCount: number;
  errorSubscriptionCount: number;
  errorCount: number;
  errors: KeySequenceErrorInspection[];
}

/** Sequence-aware dispatch outcome, including delegated layered single-stroke dispatch. */
export interface KeySequenceDispatchResult {
  status: "handled" | "declined" | "pending" | "unmatched" | "timed-out" | "idle" | "error" | "disposed";
  handled: boolean;
  consumed: boolean;
  source?: "sequence" | "layered";
  chord?: string;
  sequence: string[];
  binding?: KeySequenceBindingInspection;
  command?: KeySequenceCommandInspection;
  pending?: KeySequencePendingInspection;
  fallback?: LayeredKeymapDispatchResult;
  error?: KeySequenceErrorInspection;
  cancelledPending?: string[];
}

interface RegisteredCommand {
  definition: KeySequenceCommandDefinition;
}

interface RegisteredSequenceBinding {
  definition: KeySequenceBindingDefinition;
  order: number;
  modes: readonly string[];
  declaredSequence: readonly string[];
  events: readonly LayeredKeymapKeyEvent[];
  chords: readonly string[];
}

interface RegisteredSequenceMap {
  commands: Map<string, RegisteredCommand>;
  bindings: Map<string, RegisteredSequenceBinding>;
  leaders: Map<string, LayeredKeymapKeyEvent>;
}

interface SourceSequenceMap {
  commands: KeySequenceCommandDefinition[];
  bindings: KeySequenceBindingDefinition[];
  leaders: Record<string, Exclude<KeySequenceStrokeInput, { leader: string }>>;
}

interface EvaluatedCommand {
  command: RegisteredCommand;
  active: boolean;
  inactiveReason?: KeySequenceCommandInspection["inactiveReason"];
}

interface EvaluatedSequenceBinding {
  binding: RegisteredSequenceBinding;
  command: EvaluatedCommand;
  layer?: KeymapLayerInspection;
  active: boolean;
  inactiveReason?: KeySequenceBindingInactiveReason;
}

interface SequenceEvaluation {
  focusPath: readonly string[];
  commands: EvaluatedCommand[];
  bindings: EvaluatedSequenceBinding[];
}

interface PendingSequence {
  events: readonly LayeredKeymapKeyEvent[];
  chords: readonly string[];
  candidateBindingIds: readonly string[];
  deferredBindingId?: string;
  startedAt: number;
  lastStrokeAt: number;
  expiresAt: number;
  mapRevision: number;
  layerRevision: number;
}

interface CompiledMap {
  map: RegisteredSequenceMap;
  source: SourceSequenceMap;
}

const EMPTY_MAP: RegisteredSequenceMap = {
  commands: new Map(),
  bindings: new Map(),
  leaders: new Map(),
};

/**
 * Deterministic sequence coordinator layered over `LayeredKeymapRegistry`.
 *
 * The coordinator does not alter the layered registry. It reads the registry's live
 * focus/modal evaluation for sequence precedence and delegates unmatched strokes back to
 * the registry. It never creates a timer: hosts explicitly call `advanceTime`.
 */
export class KeySequenceCoordinator {
  readonly registry: LayeredKeymapRegistry;
  readonly #listeners = new Set<() => void>();
  readonly #errorListeners = new Set<(error: KeySequenceErrorInspection) => void>();
  readonly #targetDisposers = new Set<() => void>();
  readonly #errors: KeySequenceErrorInspection[] = [];
  readonly #now: () => number;
  readonly #timeoutMs: number;
  readonly #maxBindings: number;
  readonly #maxSequenceLength: number;
  readonly #maxPendingCandidates: number;
  readonly #maxErrors: number;
  readonly #unsubscribeRegistry: () => void;
  #registered: RegisteredSequenceMap = EMPTY_MAP;
  #source: SourceSequenceMap = { commands: [], bindings: [], leaders: {} };
  #modes: readonly string[] = Object.freeze([]);
  #pending?: PendingSequence;
  #lastRemap: KeySequenceRemapResult = {
    status: "applied",
    applied: true,
    previousMapRevision: 0,
    mapRevision: 0,
    issues: [],
  };
  #revision = 0;
  #mapRevision = 0;
  #observedAt = 0;
  #disposed = false;

  constructor(options: KeySequenceCoordinatorOptions) {
    this.registry = options.registry;
    this.#now = options.now ?? Date.now;
    this.#timeoutMs = nonNegativeFinite(options.timeoutMs, 1_000);
    this.#maxBindings = positiveInteger(options.maxBindings, 1_024);
    this.#maxSequenceLength = positiveInteger(options.maxSequenceLength, 8);
    this.#maxPendingCandidates = positiveInteger(options.maxPendingCandidates, 128);
    this.#maxErrors = nonNegativeInteger(options.maxErrors, 100);
    this.#modes = Object.freeze(normalizeModes(options.modes ?? []));
    this.#unsubscribeRegistry = this.registry.subscribe(() => {
      if (this.#disposed) return;
      this.#reconcilePending();
      this.#changed();
    });
    if (options.map) this.remap(options.map);
  }

  get disposed(): boolean {
    return this.#disposed;
  }

  get revision(): number {
    return this.#revision;
  }

  get mapRevision(): number {
    return this.#mapRevision;
  }

  /** Defensive sorted active-mode snapshot. */
  get modes(): readonly string[] {
    return this.#modes.slice();
  }

  /** Atomically replaces all active modes and reconciles any pending prefix. */
  setModes(modes: readonly string[]): boolean {
    if (this.#disposed) return false;
    const next = normalizeModes(modes);
    if (equalStrings(this.#modes, next)) return false;
    this.#modes = Object.freeze(next);
    this.#reconcilePending();
    this.#changed();
    return true;
  }

  /** Convenience for a single runtime mode, or no mode when omitted. */
  setMode(mode?: string): boolean {
    return this.setModes(mode ? [mode] : []);
  }

  /** Re-evaluates external conditions and pending eligibility without changing the map. */
  refresh(): boolean {
    if (this.#disposed) return false;
    this.#reconcilePending();
    this.#changed();
    return true;
  }

  /**
   * Validates and swaps commands, bindings, and leaders as one transaction.
   * Invalid maps leave the active map, map revision, and pending sequence untouched.
   */
  remap(definition: KeySequenceMapDefinition): KeySequenceRemapResult {
    const previousMapRevision = this.#mapRevision;
    if (this.#disposed) {
      return {
        status: "disposed",
        applied: false,
        previousMapRevision,
        mapRevision: this.#mapRevision,
        issues: [],
      };
    }
    const compiled = compileSequenceMap(definition, {
      maxBindings: this.#maxBindings,
      maxSequenceLength: this.#maxSequenceLength,
      maxPendingCandidates: this.#maxPendingCandidates,
    });
    if (!compiled.ok) {
      this.#lastRemap = {
        status: "rejected",
        applied: false,
        previousMapRevision,
        mapRevision: this.#mapRevision,
        issues: compiled.issues.map(cloneMapIssue),
      };
      this.#changed();
      return cloneRemapResult(this.#lastRemap);
    }
    this.#registered = compiled.compiled.map;
    this.#source = compiled.compiled.source;
    this.#pending = undefined;
    this.#mapRevision += 1;
    this.#lastRemap = {
      status: "applied",
      applied: true,
      previousMapRevision,
      mapRevision: this.#mapRevision,
      issues: [],
    };
    this.#changed();
    return cloneRemapResult(this.#lastRemap);
  }

  /** Atomically re-resolves every leader reference against a replacement leader table. */
  setLeaders(
    leaders: Readonly<Record<string, Exclude<KeySequenceStrokeInput, { leader: string }>>>,
  ): KeySequenceRemapResult {
    return this.remap({
      commands: this.#source.commands,
      bindings: this.#source.bindings,
      leaders,
    });
  }

  /** Atomically changes one named leader while retaining every other map entry. */
  setLeader(
    name: string,
    stroke: Exclude<KeySequenceStrokeInput, { leader: string }>,
  ): KeySequenceRemapResult {
    const leaders = cloneLeaderRecord(this.#source.leaders);
    leaders[normalizeLeaderName(name)] = cloneNonLeaderStroke(stroke);
    return this.setLeaders(leaders);
  }

  /** Dispatches one stroke, buffering prefixes and delegating unmatched strokes to the layered registry. */
  async dispatch(event: LayeredKeymapKeyEvent, timestamp?: number): Promise<KeySequenceDispatchResult> {
    const normalizedEvent = normalizeEvent(event);
    const chord = normalizedEvent ? bindingId(normalizedEvent) : bindingId(event);
    if (this.#disposed) {
      return { status: "disposed", handled: false, consumed: false, chord, sequence: [] };
    }
    if (!normalizedEvent) return await this.#delegate(event, chord, [], undefined);
    const at = this.#observeTime(timestamp);
    const previous = this.#pending;
    const events = previous ? [...previous.events, normalizedEvent] : [normalizedEvent];
    const chords = previous ? [...previous.chords, chord] : [chord];
    const evaluation = this.#evaluate();
    const candidates = activePrefixCandidates(evaluation.bindings, chords);
    if (candidates.length === 0 && previous) {
      const cancelledPending = [...previous.chords];
      this.#pending = undefined;
      this.#changed();
      return await this.#dispatchFresh(normalizedEvent, chord, at, cancelledPending);
    }
    if (candidates.length === 0) return await this.#delegate(normalizedEvent, chord, [chord], undefined);
    return await this.#resolveCandidates(evaluation, candidates, events, chords, at);
  }

  /**
   * Advances pending timeout state to a caller-supplied timestamp.
   * No background task, `setTimeout`, or scheduler is used.
   */
  async advanceTime(timestamp: number): Promise<KeySequenceDispatchResult> {
    if (this.#disposed) return { status: "disposed", handled: false, consumed: false, sequence: [] };
    const at = this.#observeTime(timestamp);
    const pending = this.#pending;
    if (!pending) return { status: "idle", handled: false, consumed: false, sequence: [] };
    if (at < pending.expiresAt) {
      return {
        status: "pending",
        handled: false,
        consumed: true,
        source: "sequence",
        sequence: [...pending.chords],
        pending: pendingInspection(pending),
      };
    }

    const evaluation = this.#evaluate();
    const deferred = pending.deferredBindingId
      ? evaluation.bindings.find((entry) =>
        entry.active && entry.binding.definition.id === pending.deferredBindingId &&
        equalStrings(entry.binding.chords, pending.chords)
      )
      : undefined;
    this.#pending = undefined;
    this.#changed();
    if (deferred) return await this.#execute(evaluation, deferred, pending.events, at);
    return {
      status: "timed-out",
      handled: false,
      consumed: true,
      source: "sequence",
      sequence: [...pending.chords],
    };
  }

  /** Cancels a pending prefix without dispatching a command. */
  cancelPending(): boolean {
    if (!this.#pending) return false;
    this.#pending = undefined;
    if (!this.#disposed) this.#changed();
    return true;
  }

  /** Binds sequence-aware dispatch to an input source. */
  bind(target: LayeredKeymapTarget): () => void {
    if (this.#disposed) return noop;
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

  /** Subscribes to atomic map, mode, layer, and pending-state changes. */
  subscribe(listener: () => void): () => void {
    if (this.#disposed) return noop;
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  /** Subscribes to isolated condition, handler, target, and lifecycle failures. */
  onError(listener: (error: KeySequenceErrorInspection) => void): () => void {
    if (this.#disposed) return noop;
    this.#errorListeners.add(listener);
    return () => this.#errorListeners.delete(listener);
  }

  /** Returns command metadata, effective sequences, conflicts, shadows, and bounded pending state. */
  inspect(): KeySequenceCoordinatorInspection {
    const evaluation = this.#evaluate();
    const winners = exactSequenceWinners(evaluation.bindings);
    const bindings = evaluation.bindings.map((entry) =>
      bindingInspection(entry, winners.get(sequenceKey(entry.binding.chords)))
    )
      .sort(compareBindingInspections);
    const commandBindingCounts = new Map<string, number>();
    for (const binding of this.#registered.bindings.values()) {
      commandBindingCounts.set(
        binding.definition.commandId,
        (commandBindingCounts.get(binding.definition.commandId) ?? 0) + 1,
      );
    }
    const commands = evaluation.commands.map((entry) =>
      commandInspection(entry, commandBindingCounts.get(entry.command.definition.id) ?? 0)
    ).sort((left, right) => left.id.localeCompare(right.id));
    const conflicts = conflictInspections(bindings);
    const activeBindingCount = bindings.filter((entry) => entry.active).length;
    const shadowCount = bindings.filter((entry) => entry.shadowedBy !== undefined).length;
    return {
      disposed: this.#disposed,
      revision: this.#revision,
      mapRevision: this.#mapRevision,
      layerRevision: this.registry.revision,
      timeoutMs: this.#timeoutMs,
      modes: [...this.#modes],
      leaders: [...this.#registered.leaders].map(([name, event]) => ({ name, chord: bindingId(event) }))
        .sort((left, right) => left.name.localeCompare(right.name)),
      commandCount: commands.length,
      bindingCount: bindings.length,
      activeBindingCount,
      conflictCount: conflicts.length,
      shadowCount,
      pending: this.#pending ? pendingInspection(this.#pending) : undefined,
      commands,
      bindings,
      conflicts,
      lastRemap: cloneRemapResult(this.#lastRemap),
      targetCount: this.#targetDisposers.size,
      subscriptionCount: this.#listeners.size,
      errorSubscriptionCount: this.#errorListeners.size,
      errorCount: this.#errors.length,
      errors: this.#errors.map(cloneError),
    };
  }

  /** Clears bounded runtime errors without changing mappings. */
  clearErrors(): void {
    if (this.#errors.length === 0) return;
    this.#errors.length = 0;
    if (!this.#disposed) this.#changed();
  }

  /** Releases handlers, input subscriptions, listeners, and the layered-registry subscription. */
  dispose(): void {
    if (this.#disposed) return;
    const targets = [...this.#targetDisposers].reverse();
    this.#targetDisposers.clear();
    for (const dispose of targets) dispose();
    try {
      this.#unsubscribeRegistry();
    } catch (error) {
      this.#recordError({ phase: "disposal", error });
    }
    this.#registered = EMPTY_MAP;
    this.#source = { commands: [], bindings: [], leaders: {} };
    this.#pending = undefined;
    this.#disposed = true;
    this.#revision += 1;
    this.#notify();
    this.#listeners.clear();
    this.#errorListeners.clear();
  }

  async #dispatchFresh(
    event: LayeredKeymapKeyEvent,
    chord: string,
    at: number,
    cancelledPending: string[],
  ): Promise<KeySequenceDispatchResult> {
    const evaluation = this.#evaluate();
    const candidates = activePrefixCandidates(evaluation.bindings, [chord]);
    if (candidates.length === 0) return await this.#delegate(event, chord, [chord], cancelledPending);
    const result = await this.#resolveCandidates(evaluation, candidates, [event], [chord], at);
    result.cancelledPending = cancelledPending;
    return result;
  }

  async #resolveCandidates(
    evaluation: SequenceEvaluation,
    candidates: EvaluatedSequenceBinding[],
    events: readonly LayeredKeymapKeyEvent[],
    chords: readonly string[],
    at: number,
  ): Promise<KeySequenceDispatchResult> {
    const exact = candidates.filter((entry) => entry.binding.chords.length === chords.length)
      .sort(compareEvaluatedPrecedence);
    const longer = candidates.some((entry) => entry.binding.chords.length > chords.length);
    if (exact[0] && !longer) {
      if (this.#pending) {
        this.#pending = undefined;
        this.#changed();
      }
      return await this.#execute(evaluation, exact[0], events, at);
    }
    const candidateBindingIds = candidates.map((entry) => entry.binding.definition.id).sort();
    const previous = this.#pending;
    this.#pending = {
      events: events.map(cloneEvent),
      chords: [...chords],
      candidateBindingIds,
      deferredBindingId: exact[0]?.binding.definition.id,
      startedAt: previous?.startedAt ?? at,
      lastStrokeAt: at,
      expiresAt: at + this.#timeoutMs,
      mapRevision: this.#mapRevision,
      layerRevision: this.registry.revision,
    };
    this.#changed();
    return {
      status: "pending",
      handled: false,
      consumed: true,
      source: "sequence",
      chord: chords[chords.length - 1],
      sequence: [...chords],
      pending: pendingInspection(this.#pending),
    };
  }

  async #execute(
    evaluation: SequenceEvaluation,
    evaluated: EvaluatedSequenceBinding,
    events: readonly LayeredKeymapKeyEvent[],
    at: number,
  ): Promise<KeySequenceDispatchResult> {
    const winners = exactSequenceWinners(evaluation.bindings);
    const inspectedBinding = bindingInspection(
      evaluated,
      winners.get(sequenceKey(evaluated.binding.chords)),
    );
    const inspectedCommand = commandInspection(
      evaluated.command,
      [...this.#registered.bindings.values()].filter((entry) =>
        entry.definition.commandId === evaluated.command.command.definition.id
      ).length,
    );
    try {
      const handled = await evaluated.command.command.definition.handler({
        command: cloneCommandInspection(inspectedCommand),
        binding: cloneBindingInspection(inspectedBinding),
        events: events.map(cloneEvent),
        focusPath: [...evaluation.focusPath],
        modes: [...this.#modes],
        timestamp: at,
      });
      return {
        status: handled === false ? "declined" : "handled",
        handled: handled !== false,
        consumed: true,
        source: "sequence",
        chord: evaluated.binding.chords[evaluated.binding.chords.length - 1],
        sequence: [...evaluated.binding.chords],
        binding: inspectedBinding,
        command: inspectedCommand,
      };
    } catch (error) {
      const inspected = this.#recordError({
        phase: "handler",
        error,
        commandId: evaluated.command.command.definition.id,
        bindingId: evaluated.binding.definition.id,
        timestamp: at,
      });
      return {
        status: "error",
        handled: false,
        consumed: true,
        source: "sequence",
        chord: evaluated.binding.chords[evaluated.binding.chords.length - 1],
        sequence: [...evaluated.binding.chords],
        binding: inspectedBinding,
        command: inspectedCommand,
        error: inspected,
      };
    }
  }

  async #delegate(
    event: LayeredKeymapKeyEvent,
    chord: string,
    sequence: string[],
    cancelledPending: string[] | undefined,
  ): Promise<KeySequenceDispatchResult> {
    const fallback = await this.registry.dispatch(event);
    return {
      status: fallback.status,
      handled: fallback.handled,
      consumed: fallback.status !== "unmatched" && fallback.status !== "disposed",
      source: "layered",
      chord,
      sequence,
      fallback,
      cancelledPending,
    };
  }

  #evaluate(): SequenceEvaluation {
    const layerInspection = this.registry.inspect();
    const layers = new Map(layerInspection.layers.map((layer) => [layer.id, layer]));
    const focusPath = Object.freeze(layerInspection.focusPath.slice());
    const modes = Object.freeze([...this.#modes]);
    const commands: EvaluatedCommand[] = [];
    const commandById = new Map<string, EvaluatedCommand>();
    for (const command of this.#registered.commands.values()) {
      let active = !this.#disposed;
      let inactiveReason: EvaluatedCommand["inactiveReason"] = this.#disposed ? "disposed" : undefined;
      if (active) {
        const condition = this.#evaluateCondition(command.definition.enabled, {
          commandId: command.definition.id,
          focusPath,
          modes,
        }, command.definition.id);
        active = condition.enabled;
        inactiveReason = condition.enabled
          ? undefined
          : condition.error
          ? "command-condition-error"
          : "command-disabled";
      }
      const evaluated = { command, active, inactiveReason };
      commands.push(evaluated);
      commandById.set(command.definition.id, evaluated);
    }

    const bindings: EvaluatedSequenceBinding[] = [];
    for (const binding of this.#registered.bindings.values()) {
      const command = commandById.get(binding.definition.commandId)!;
      const layer = layers.get(binding.definition.layerId);
      let active = !this.#disposed;
      let inactiveReason: KeySequenceBindingInactiveReason | undefined = this.#disposed ? "disposed" : undefined;
      if (active && !layer) {
        active = false;
        inactiveReason = "layer-missing";
      } else if (active && !layer!.active) {
        active = false;
        inactiveReason = "layer-inactive";
      }
      if (active && binding.modes.length > 0 && !binding.modes.some((mode) => modes.includes(mode))) {
        active = false;
        inactiveReason = "mode-inactive";
      }
      if (active && !command.active) {
        active = false;
        inactiveReason = command.inactiveReason === "command-condition-error"
          ? "command-condition-error"
          : "command-disabled";
      }
      if (active) {
        const condition = this.#evaluateCondition(
          binding.definition.enabled,
          {
            commandId: command.command.definition.id,
            bindingId: binding.definition.id,
            layerId: binding.definition.layerId,
            focusPath,
            modes,
          },
          command.command.definition.id,
          binding.definition.id,
        );
        if (!condition.enabled) {
          active = false;
          inactiveReason = condition.error ? "binding-condition-error" : "binding-disabled";
        }
      }
      bindings.push({ binding, command, layer, active, inactiveReason });
    }
    return { focusPath, commands, bindings };
  }

  #evaluateCondition(
    condition: KeySequenceCondition | undefined,
    context: KeySequenceConditionContext,
    commandId: string,
    bindingId?: string,
  ): { enabled: boolean; error: boolean } {
    if (condition === undefined) return { enabled: true, error: false };
    if (typeof condition === "boolean") return { enabled: condition, error: false };
    try {
      return { enabled: Boolean(condition(Object.freeze({ ...context }))), error: false };
    } catch (error) {
      this.#recordError({ phase: "condition", error, commandId, bindingId });
      return { enabled: false, error: true };
    }
  }

  #reconcilePending(): void {
    if (!this.#pending) return;
    const evaluation = this.#evaluate();
    const candidates = activePrefixCandidates(evaluation.bindings, this.#pending.chords);
    if (candidates.length === 0) {
      this.#pending = undefined;
      return;
    }
    const exact = candidates.filter((entry) => entry.binding.chords.length === this.#pending!.chords.length)
      .sort(compareEvaluatedPrecedence);
    this.#pending = {
      ...this.#pending,
      candidateBindingIds: candidates.map((entry) => entry.binding.definition.id).sort(),
      deferredBindingId: exact[0]?.binding.definition.id,
      mapRevision: this.#mapRevision,
      layerRevision: this.registry.revision,
    };
  }

  #observeTime(value?: number): number {
    const candidate = value === undefined ? safeNow(this.#now) : finiteTimestamp(value, this.#observedAt);
    this.#observedAt = Math.max(this.#observedAt, candidate);
    return this.#observedAt;
  }

  #recordError(report: {
    phase: KeySequenceErrorPhase;
    error: unknown;
    commandId?: string;
    bindingId?: string;
    timestamp?: number;
  }): KeySequenceErrorInspection {
    const normalized = normalizeError(report.error);
    const inspected: KeySequenceErrorInspection = {
      phase: report.phase,
      name: normalized.name,
      message: normalized.message,
      timestamp: report.timestamp ?? safeNow(this.#now),
      commandId: report.commandId,
      bindingId: report.bindingId,
    };
    if (this.#maxErrors > 0) {
      this.#errors.push(inspected);
      if (this.#errors.length > this.#maxErrors) this.#errors.splice(0, this.#errors.length - this.#maxErrors);
    }
    for (const listener of [...this.#errorListeners]) {
      try {
        listener(cloneError(inspected));
      } catch {
        // Diagnostic listeners cannot break input dispatch.
      }
    }
    return cloneError(inspected);
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

/** Creates a deterministic sequence coordinator over an existing layered registry. */
export function createKeySequenceCoordinator(options: KeySequenceCoordinatorOptions): KeySequenceCoordinator {
  return new KeySequenceCoordinator(options);
}

/** Canonicalizes one key event using the same modifier order as the layered registry. */
export function keySequenceChord(event: LayeredKeymapKeyEvent): string {
  const normalized = normalizeEvent(event);
  return normalized ? bindingId(normalized) : "";
}

function compileSequenceMap(
  definition: KeySequenceMapDefinition,
  limits: { maxBindings: number; maxSequenceLength: number; maxPendingCandidates: number },
): { ok: true; compiled: CompiledMap } | { ok: false; issues: KeySequenceMapIssue[] } {
  const issues: KeySequenceMapIssue[] = [];
  const commands = new Map<string, RegisteredCommand>();
  const sourceCommands: KeySequenceCommandDefinition[] = [];
  for (let index = 0; index < definition.commands.length; index += 1) {
    const source = definition.commands[index]!;
    const path = `commands[${index}]`;
    const id = source.id?.trim();
    const title = source.title?.trim();
    if (!id) {
      issues.push(issue("command-id-required", `${path}.id`, "Command id must not be empty."));
      continue;
    }
    if (commands.has(id)) {
      issues.push(issue("command-id-duplicate", `${path}.id`, `Command id "${id}" is duplicated.`));
      continue;
    }
    if (!title) issues.push(issue("command-title-required", `${path}.title`, `Command "${id}" requires a title.`));
    if (typeof source.handler !== "function") {
      issues.push(issue("command-handler-required", `${path}.handler`, `Command "${id}" requires a handler.`));
    }
    if (!title || typeof source.handler !== "function") continue;
    const normalized: KeySequenceCommandDefinition = {
      ...source,
      id,
      title,
      description: optionalText(source.description),
      category: optionalText(source.category),
      keywords: normalizeStringList(source.keywords ?? []),
    };
    commands.set(id, { definition: normalized });
    sourceCommands.push(cloneCommandDefinition(normalized));
  }

  const leaderSource = definition.leaders ?? { leader: DEFAULT_KEY_SEQUENCE_LEADER };
  const leaders = new Map<string, LayeredKeymapKeyEvent>();
  const sourceLeaders: SourceSequenceMap["leaders"] = {};
  for (
    const [rawName, rawStroke] of Object.entries(leaderSource).sort(([left], [right]) => left.localeCompare(right))
  ) {
    const name = normalizeLeaderName(rawName);
    const event = normalizeNonLeaderStroke(rawStroke);
    if (!name || !event || leaders.has(name)) {
      issues.push(issue("leader-invalid", `leaders.${rawName}`, `Leader "${rawName}" is invalid or duplicated.`));
      continue;
    }
    leaders.set(name, event);
    sourceLeaders[name] = cloneNonLeaderStroke(rawStroke);
  }

  if (definition.bindings.length > limits.maxBindings) {
    issues.push(issue(
      "binding-limit-exceeded",
      "bindings",
      `Binding count ${definition.bindings.length} exceeds limit ${limits.maxBindings}.`,
    ));
  }
  const bindings = new Map<string, RegisteredSequenceBinding>();
  const sourceBindings: KeySequenceBindingDefinition[] = [];
  for (let index = 0; index < definition.bindings.length; index += 1) {
    const source = definition.bindings[index]!;
    const path = `bindings[${index}]`;
    const id = source.id?.trim();
    const commandId = source.commandId?.trim();
    const layerId = source.layerId?.trim();
    if (!id) {
      issues.push(issue("binding-id-required", `${path}.id`, "Binding id must not be empty."));
      continue;
    }
    if (bindings.has(id)) {
      issues.push(issue("binding-id-duplicate", `${path}.id`, `Binding id "${id}" is duplicated.`));
      continue;
    }
    if (!commandId || !commands.has(commandId)) {
      issues.push(issue(
        "binding-command-missing",
        `${path}.commandId`,
        `Binding "${id}" references missing command "${commandId ?? ""}".`,
      ));
    }
    if (!layerId) issues.push(issue("binding-layer-required", `${path}.layerId`, `Binding "${id}" requires layerId.`));
    if (!Array.isArray(source.sequence) || source.sequence.length === 0) {
      issues.push(issue("binding-sequence-empty", `${path}.sequence`, `Binding "${id}" requires a sequence.`));
    } else if (source.sequence.length > limits.maxSequenceLength) {
      issues.push(issue(
        "binding-sequence-too-long",
        `${path}.sequence`,
        `Binding "${id}" length ${source.sequence.length} exceeds limit ${limits.maxSequenceLength}.`,
      ));
    }
    const modes = normalizeModes(source.modes ?? []);
    if (source.modes && modes.length !== source.modes.length) {
      issues.push(issue("binding-mode-invalid", `${path}.modes`, `Binding "${id}" contains empty or duplicate modes.`));
    }
    const strokes = resolveSequence(source.sequence ?? [], leaders, `${path}.sequence`, issues);
    if (!commandId || !commands.has(commandId) || !layerId || strokes.length !== source.sequence.length) continue;
    if (source.sequence.length === 0 || source.sequence.length > limits.maxSequenceLength) continue;
    const normalized: KeySequenceBindingDefinition = {
      ...source,
      id,
      commandId,
      layerId,
      sequence: source.sequence.map(cloneStrokeInput),
      order: finiteOrder(source.order),
      modes,
    };
    const registered: RegisteredSequenceBinding = {
      definition: normalized,
      order: finiteOrder(source.order),
      modes: Object.freeze(modes),
      declaredSequence: Object.freeze(strokes.map((stroke) => stroke.declared)),
      events: Object.freeze(strokes.map((stroke) => Object.freeze(cloneEvent(stroke.event)))),
      chords: Object.freeze(strokes.map((stroke) => stroke.chord)),
    };
    bindings.set(id, registered);
    sourceBindings.push(cloneBindingDefinition(normalized));
  }

  const prefixCounts = new Map<string, number>();
  for (const binding of bindings.values()) {
    for (let length = 1; length <= binding.chords.length; length += 1) {
      const key = sequenceKey(binding.chords.slice(0, length));
      prefixCounts.set(key, (prefixCounts.get(key) ?? 0) + 1);
    }
  }
  for (const [prefix, count] of prefixCounts) {
    if (count <= limits.maxPendingCandidates) continue;
    issues.push(issue(
      "pending-candidate-limit-exceeded",
      "bindings",
      `Resolved prefix "${
        displaySequenceKey(prefix)
      }" has ${count} candidates; limit is ${limits.maxPendingCandidates}.`,
    ));
  }
  if (issues.length > 0) return { ok: false, issues };
  return {
    ok: true,
    compiled: {
      map: { commands, bindings, leaders },
      source: { commands: sourceCommands, bindings: sourceBindings, leaders: sourceLeaders },
    },
  };
}

function resolveSequence(
  sequence: readonly KeySequenceStrokeInput[],
  leaders: ReadonlyMap<string, LayeredKeymapKeyEvent>,
  path: string,
  issues: KeySequenceMapIssue[],
): Array<{ declared: string; event: LayeredKeymapKeyEvent; chord: string }> {
  const resolved: Array<{ declared: string; event: LayeredKeymapKeyEvent; chord: string }> = [];
  for (let index = 0; index < sequence.length; index += 1) {
    const source = sequence[index]!;
    const leaderName = leaderNameFromStroke(source);
    if (leaderName !== undefined) {
      const leader = leaders.get(leaderName);
      if (!leader) {
        issues.push(issue(
          "leader-missing",
          `${path}[${index}]`,
          `Sequence references missing leader "${leaderName}".`,
        ));
        continue;
      }
      resolved.push({ declared: leaderDisplay(leaderName), event: cloneEvent(leader), chord: bindingId(leader) });
      continue;
    }
    const event = normalizeNonLeaderStroke(source as Exclude<KeySequenceStrokeInput, { leader: string }>);
    if (!event) {
      issues.push(issue("stroke-invalid", `${path}[${index}]`, "Sequence stroke is invalid."));
      continue;
    }
    const chord = bindingId(event);
    resolved.push({ declared: chord, event, chord });
  }
  return resolved;
}

function activePrefixCandidates(
  bindings: readonly EvaluatedSequenceBinding[],
  prefix: readonly string[],
): EvaluatedSequenceBinding[] {
  return bindings.filter((entry) => entry.active && sequenceStartsWith(entry.binding.chords, prefix))
    .sort(compareEvaluatedPrecedence);
}

function exactSequenceWinners(
  bindings: readonly EvaluatedSequenceBinding[],
): Map<string, EvaluatedSequenceBinding> {
  const winners = new Map<string, EvaluatedSequenceBinding>();
  for (const binding of bindings.filter((entry) => entry.active).sort(compareEvaluatedPrecedence)) {
    const key = sequenceKey(binding.binding.chords);
    if (!winners.has(key)) winners.set(key, binding);
  }
  return winners;
}

function compareEvaluatedPrecedence(left: EvaluatedSequenceBinding, right: EvaluatedSequenceBinding): number {
  return layerKindRank(right.layer?.kind) - layerKindRank(left.layer?.kind) ||
    (right.layer?.scopeDepth ?? -1) - (left.layer?.scopeDepth ?? -1) ||
    (right.layer?.order ?? 0) - (left.layer?.order ?? 0) ||
    right.binding.order - left.binding.order ||
    left.binding.definition.layerId.localeCompare(right.binding.definition.layerId) ||
    left.binding.definition.id.localeCompare(right.binding.definition.id);
}

function commandInspection(command: EvaluatedCommand, bindingCount: number): KeySequenceCommandInspection {
  const definition = command.command.definition;
  return {
    id: definition.id,
    title: definition.title,
    description: definition.description,
    category: definition.category,
    keywords: [...(definition.keywords ?? [])],
    active: command.active,
    inactiveReason: command.inactiveReason,
    bindingCount,
  };
}

function bindingInspection(
  evaluated: EvaluatedSequenceBinding,
  winner: EvaluatedSequenceBinding | undefined,
): KeySequenceBindingInspection {
  const binding = evaluated.binding;
  const winning = winner === evaluated;
  return {
    id: binding.definition.id,
    commandId: binding.definition.commandId,
    layerId: binding.definition.layerId,
    layerKind: evaluated.layer?.kind,
    layerOrder: evaluated.layer?.order ?? 0,
    scopeDepth: evaluated.layer?.scopeDepth ?? -1,
    order: binding.order,
    modes: [...binding.modes],
    declaredSequence: [...binding.declaredSequence],
    sequence: [...binding.chords],
    displaySequence: binding.chords.join(" "),
    active: evaluated.active,
    winning,
    inactiveReason: evaluated.inactiveReason,
    layerInactiveReason: evaluated.inactiveReason === "layer-inactive" ? evaluated.layer?.inactiveReason : undefined,
    shadowedBy: evaluated.active && winner && !winning
      ? { layerId: winner.binding.definition.layerId, bindingId: winner.binding.definition.id }
      : undefined,
  };
}

function conflictInspections(bindings: readonly KeySequenceBindingInspection[]): KeySequenceConflictInspection[] {
  const conflicts: KeySequenceConflictInspection[] = [];
  const exact = new Map<string, KeySequenceBindingInspection[]>();
  for (const binding of bindings) {
    const key = sequenceKey(binding.sequence);
    const group = exact.get(key);
    if (group) group.push(binding);
    else exact.set(key, [binding]);
  }
  for (const [key, group] of exact) {
    if (group.length < 2) continue;
    conflicts.push(conflictInspection("exact", key, group));
  }
  const sequenceGroups = [...exact.entries()].sort(([left], [right]) => left.localeCompare(right));
  for (let index = 0; index < sequenceGroups.length; index += 1) {
    const [shortKey, shortGroup] = sequenceGroups[index]!;
    const short = sequenceFromKey(shortKey);
    const related = shortGroup.slice();
    for (let longerIndex = 0; longerIndex < sequenceGroups.length; longerIndex += 1) {
      if (longerIndex === index) continue;
      const [longerKey, longerGroup] = sequenceGroups[longerIndex]!;
      const longer = sequenceFromKey(longerKey);
      if (longer.length > short.length && sequenceStartsWith(longer, short)) related.push(...longerGroup);
    }
    if (related.length > shortGroup.length) conflicts.push(conflictInspection("prefix", shortKey, related));
  }
  return conflicts.sort((left, right) =>
    left.displaySequence.localeCompare(right.displaySequence) || left.kind.localeCompare(right.kind)
  );
}

function conflictInspection(
  kind: "exact" | "prefix",
  key: string,
  group: readonly KeySequenceBindingInspection[],
): KeySequenceConflictInspection {
  const sorted = group.slice().sort(compareBindingInspections);
  const exactWinner = kind === "exact" ? sorted.find((entry) => entry.winning) : undefined;
  return {
    kind,
    sequence: sequenceFromKey(key),
    displaySequence: displaySequenceKey(key),
    bindingCount: sorted.length,
    activeCount: sorted.filter((entry) => entry.active).length,
    winner: exactWinner ? { layerId: exactWinner.layerId, bindingId: exactWinner.id } : undefined,
    bindings: sorted.map((entry) => ({
      layerId: entry.layerId,
      bindingId: entry.id,
      active: entry.active,
      winning: entry.winning,
    })),
  };
}

function compareBindingInspections(
  left: KeySequenceBindingInspection,
  right: KeySequenceBindingInspection,
): number {
  return left.displaySequence.localeCompare(right.displaySequence) || Number(right.active) - Number(left.active) ||
    Number(right.winning) - Number(left.winning) || layerKindRank(right.layerKind) - layerKindRank(left.layerKind) ||
    right.scopeDepth - left.scopeDepth || right.layerOrder - left.layerOrder || right.order - left.order ||
    left.layerId.localeCompare(right.layerId) || left.id.localeCompare(right.id);
}

function pendingInspection(pending: PendingSequence): KeySequencePendingInspection {
  return {
    sequence: [...pending.chords],
    candidateBindingIds: [...pending.candidateBindingIds],
    deferredBindingId: pending.deferredBindingId,
    startedAt: pending.startedAt,
    lastStrokeAt: pending.lastStrokeAt,
    expiresAt: pending.expiresAt,
    mapRevision: pending.mapRevision,
    layerRevision: pending.layerRevision,
  };
}

function normalizeNonLeaderStroke(
  input: Exclude<KeySequenceStrokeInput, { leader: string }>,
): LayeredKeymapKeyEvent | undefined {
  if (typeof input === "string") return parseChord(input);
  return normalizeEvent(input);
}

function normalizeEvent(event: LayeredKeymapKeyEvent): LayeredKeymapKeyEvent | undefined {
  const key = event.key?.trim();
  if (!key) return undefined;
  return {
    key: key as LayeredKeymapKeyEvent["key"],
    ctrl: Boolean(event.ctrl),
    meta: Boolean(event.meta),
    shift: Boolean(event.shift),
  };
}

function parseChord(value: string): LayeredKeymapKeyEvent | undefined {
  let key = value.trim();
  if (!key || leaderNameFromString(key) !== undefined) return undefined;
  let ctrl = false;
  let meta = false;
  let shift = false;
  const seen = new Set<string>();
  while (/^[CMS]-/.test(key)) {
    const modifier = key[0]!;
    if (seen.has(modifier)) return undefined;
    seen.add(modifier);
    key = key.slice(2);
    if (modifier === "C") ctrl = true;
    else if (modifier === "M") meta = true;
    else shift = true;
  }
  if (!key) return undefined;
  return { key: key as LayeredKeymapKeyEvent["key"], ctrl, meta, shift };
}

function leaderNameFromStroke(input: KeySequenceStrokeInput): string | undefined {
  if (typeof input === "object" && input !== null && "leader" in input) {
    return normalizeLeaderName(input.leader);
  }
  return typeof input === "string" ? leaderNameFromString(input) : undefined;
}

function leaderNameFromString(value: string): string | undefined {
  const normalized = value.trim();
  if (normalized === "<leader>") return "leader";
  const match = normalized.match(/^<leader:([^>]+)>$/);
  return match ? normalizeLeaderName(match[1]!) : undefined;
}

function normalizeLeaderName(value: string): string {
  return value.trim().toLowerCase();
}

function leaderDisplay(name: string): string {
  return name === "leader" ? "<leader>" : `<leader:${name}>`;
}

function normalizeModes(values: readonly string[]): string[] {
  return normalizeStringList(values.map((value) => value.trim().toLowerCase()));
}

function normalizeStringList(values: readonly string[]): string[] {
  const unique = new Set<string>();
  for (const value of values) {
    const normalized = value.trim();
    if (normalized) unique.add(normalized);
  }
  return [...unique].sort();
}

function sequenceStartsWith(sequence: readonly string[], prefix: readonly string[]): boolean {
  if (prefix.length > sequence.length) return false;
  for (let index = 0; index < prefix.length; index += 1) {
    if (sequence[index] !== prefix[index]) return false;
  }
  return true;
}

function sequenceKey(sequence: readonly string[]): string {
  return JSON.stringify(sequence);
}

function sequenceFromKey(key: string): string[] {
  return JSON.parse(key) as string[];
}

function displaySequenceKey(key: string): string {
  return sequenceFromKey(key).join(" ");
}

function layerKindRank(kind: KeymapLayerInspection["kind"] | undefined): number {
  if (kind === "modal") return 3;
  if (kind === "exact-focus") return 2;
  if (kind === "focus-within") return 1;
  return 0;
}

function issue(code: KeySequenceMapIssueCode, path: string, message: string): KeySequenceMapIssue {
  return { code, path, message };
}

function cloneMapIssue(value: KeySequenceMapIssue): KeySequenceMapIssue {
  return { ...value };
}

function cloneRemapResult(value: KeySequenceRemapResult): KeySequenceRemapResult {
  return { ...value, issues: value.issues.map(cloneMapIssue) };
}

function cloneError(value: KeySequenceErrorInspection): KeySequenceErrorInspection {
  return { ...value };
}

function cloneEvent(value: LayeredKeymapKeyEvent): LayeredKeymapKeyEvent {
  return { key: value.key, ctrl: Boolean(value.ctrl), meta: Boolean(value.meta), shift: Boolean(value.shift) };
}

function cloneCommandInspection(value: KeySequenceCommandInspection): KeySequenceCommandInspection {
  return { ...value, keywords: [...value.keywords] };
}

function cloneBindingInspection(value: KeySequenceBindingInspection): KeySequenceBindingInspection {
  return {
    ...value,
    modes: [...value.modes],
    declaredSequence: [...value.declaredSequence],
    sequence: [...value.sequence],
    shadowedBy: value.shadowedBy ? { ...value.shadowedBy } : undefined,
  };
}

function cloneCommandDefinition(value: KeySequenceCommandDefinition): KeySequenceCommandDefinition {
  return { ...value, keywords: [...(value.keywords ?? [])] };
}

function cloneBindingDefinition(value: KeySequenceBindingDefinition): KeySequenceBindingDefinition {
  return {
    ...value,
    sequence: value.sequence.map(cloneStrokeInput),
    modes: value.modes ? [...value.modes] : undefined,
  };
}

function cloneStrokeInput(value: KeySequenceStrokeInput): KeySequenceStrokeInput {
  if (typeof value === "string") return value;
  if ("leader" in value) return { leader: value.leader };
  return cloneEvent(value);
}

function cloneNonLeaderStroke(
  value: Exclude<KeySequenceStrokeInput, { leader: string }>,
): Exclude<KeySequenceStrokeInput, { leader: string }> {
  return typeof value === "string" ? value : cloneEvent(value);
}

function cloneLeaderRecord(
  value: Readonly<Record<string, Exclude<KeySequenceStrokeInput, { leader: string }>>>,
): Record<string, Exclude<KeySequenceStrokeInput, { leader: string }>> {
  const clone: Record<string, Exclude<KeySequenceStrokeInput, { leader: string }>> = {};
  for (const [name, stroke] of Object.entries(value)) clone[name] = cloneNonLeaderStroke(stroke);
  return clone;
}

function optionalText(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function finiteOrder(value: number | undefined): number {
  return Number.isFinite(value) ? Math.trunc(value ?? 0) : 0;
}

function positiveInteger(value: number | undefined, fallback: number): number {
  return Number.isFinite(value) ? Math.max(1, Math.floor(value!)) : fallback;
}

function nonNegativeInteger(value: number | undefined, fallback: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.floor(value!)) : fallback;
}

function nonNegativeFinite(value: number | undefined, fallback: number): number {
  return Number.isFinite(value) ? Math.max(0, value!) : fallback;
}

function finiteTimestamp(value: number, fallback: number): number {
  return Number.isFinite(value) ? value : fallback;
}

function safeNow(now: () => number): number {
  try {
    return finiteTimestamp(now(), Date.now());
  } catch {
    return Date.now();
  }
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

function equalStrings(left: readonly string[], right: readonly string[]): boolean {
  if (left.length !== right.length) return false;
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) return false;
  }
  return true;
}

function noop(): void {}
