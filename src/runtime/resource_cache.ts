// Copyright 2023 Im-Beast. MIT license.

import { MAX_MONOTONIC_TIME } from "./clock.ts";
import {
  addResourceCacheMonotonicDuration as addMonotonicDuration,
  nextResourceCacheTimerGeneration as nextTimerGeneration,
  resolveResourceCachePolicy,
  type ResourceCacheEntryPolicyInspection,
  type ResourceCachePolicyInspection,
  type ResourceCacheRefreshTrigger,
  type ResourceCacheSchedulerCapabilities,
  type ResourceCacheTemporalPolicyOptions,
  type ResourceCacheTimerCancellation,
  snapshotResourceCacheTimerCancellation,
  validateResourceCacheRefreshTrigger as validateRefreshTrigger,
} from "./resource_cache_policy.ts";

export type {
  ResourceCacheEntryPolicyInspection,
  ResourceCachePolicyInspection,
  ResourceCacheRefreshTrigger,
  ResourceCacheTemporalPolicyOptions,
} from "./resource_cache_policy.ts";

/** Observable lifecycle state for one process-local resource entry. */
export type ResourceCacheEntryStatus = "idle" | "loading" | "ready" | "error";

/** Runtime value category exposed without retaining a value in inspection. */
export type ResourceCacheValueKind =
  | "undefined"
  | "null"
  | "boolean"
  | "number"
  | "bigint"
  | "string"
  | "symbol"
  | "function"
  | "array"
  | "object";

/** Failure categories for strict structural-key canonicalization. */
export type ResourceCacheKeyErrorCode =
  | "max-depth"
  | "max-nodes"
  | "max-container-entries"
  | "max-key-bytes"
  | "cycle"
  | "unsupported"
  | "accessor"
  | "invalid-shape"
  | "reflection";

/** Configurable limits for structural resource keys. */
export interface ResourceCacheKeyLimits {
  /** Maximum nested array/object depth. Defaults to 32. */
  readonly maxDepth?: number;
  /** Maximum visited primitive and container nodes. Defaults to 4096. */
  readonly maxNodes?: number;
  /** Maximum own entries in any one array/object. Defaults to 1024. */
  readonly maxContainerEntries?: number;
  /** Maximum UTF-8 bytes in the canonical key. Defaults to 65536. */
  readonly maxKeyBytes?: number;
}

/** Fully resolved key limits included in clone-safe inspection. */
export interface ResolvedResourceCacheKeyLimits {
  readonly maxDepth: number;
  readonly maxNodes: number;
  readonly maxContainerEntries: number;
  readonly maxKeyBytes: number;
}

/** Construction options for a process-local resource cache coordinator. */
export interface ResourceCacheCoordinatorOptions extends ResourceCacheTemporalPolicyOptions {
  /** Structural-key traversal and output limits. */
  readonly keyLimits?: ResourceCacheKeyLimits;
  /** Maximum simultaneously owned entries. Defaults to 1024. */
  readonly maxEntries?: number;
  /** Maximum entries returned by a default inspection. Defaults to 256. */
  readonly maxInspectionEntries?: number;
  /** Maximum retained listener/event diagnostics. Defaults to 64. */
  readonly maxDiagnostics?: number;
  /** Maximum entry listeners across one structural key. Defaults to 1024. */
  readonly maxListenersPerEntry?: number;
  /** Maximum coordinator-wide listeners. Defaults to 1024. */
  readonly maxCoordinatorListeners?: number;
  /** Maximum events dispatched by one synchronous reentrant drain. Defaults to 4096. */
  readonly maxEventsPerDrain?: number;
  /** Maximum characters in an entry diagnostic field. Defaults to 512. */
  readonly maxDiagnosticText?: number;
  /** Initial data revision for newly created entries. Defaults to zero. */
  readonly initialRevision?: number;
}

/** Per-call upper bounds for coordinator inspection. */
export interface ResourceCacheInspectionOptions {
  /** Entry limit, clamped to the configured inspection limit. */
  readonly maxEntries?: number;
  /** Diagnostic limit, clamped to the configured retention limit. */
  readonly maxDiagnostics?: number;
}

/** Clone-safe caller-supplied state diagnostic. */
export interface ResourceCacheEntryDiagnostic {
  readonly code: string;
  readonly message: string;
}

/** Bounded clone-safe listener or event-delivery diagnostic. */
export interface ResourceCacheCoordinatorDiagnostic {
  readonly sequence: number;
  readonly code: "listener-threw" | "event-drain-limit" | "clock-regression" | "timer-failure";
  readonly phase: "entry-listener" | "coordinator-listener" | "event-dispatch" | "clock" | "timer";
  readonly key?: string;
  readonly message: string;
}

/** Value-free, clone-safe state for one live cache entry. Keys are opaque identifiers. */
export interface ResourceCacheEntryInspection {
  readonly key: string;
  readonly status: ResourceCacheEntryStatus;
  readonly revision: number;
  readonly owners: number;
  readonly listeners: number;
  readonly hasValue: boolean;
  readonly valueKind: ResourceCacheValueKind;
  readonly diagnostic?: ResourceCacheEntryDiagnostic;
  /** Present only when a temporal resource policy was configured. */
  readonly policy?: ResourceCacheEntryPolicyInspection;
}

/** Bounded clone-safe state for a resource cache coordinator. */
export interface ResourceCacheInspection {
  readonly disposed: boolean;
  readonly size: number;
  readonly maxEntries: number;
  readonly maxInspectionEntries: number;
  readonly maxDiagnostics: number;
  readonly maxListenersPerEntry: number;
  readonly maxCoordinatorListeners: number;
  readonly maxEventsPerDrain: number;
  readonly keyLimits: ResolvedResourceCacheKeyLimits;
  readonly acquires: number;
  readonly releases: number;
  readonly updates: number;
  readonly evictions: number;
  readonly listenerFailures: number;
  readonly droppedEvents: number;
  readonly diagnosticsDropped: number;
  readonly entryLimit: number;
  readonly omittedEntries: number;
  readonly diagnosticLimit: number;
  readonly omittedDiagnostics: number;
  readonly entries: readonly ResourceCacheEntryInspection[];
  readonly diagnostics: readonly ResourceCacheCoordinatorDiagnostic[];
  /** Present only when a temporal resource policy was configured. */
  readonly policy?: ResourceCachePolicyInspection;
}

/** Mutation/event kinds delivered to entry and coordinator subscriptions. */
export type ResourceCacheEventType =
  | "snapshot"
  | "acquired"
  | "updated"
  | "released"
  | "retained"
  | "stale"
  | "refresh-requested"
  | "evicted"
  | "disposed";

/** Immutable event metadata. The optional value is the exact published reference. */
export interface ResourceCacheEntryEvent<Value = unknown> extends ResourceCacheEntryInspection {
  readonly type: ResourceCacheEventType;
  readonly value?: Value;
}

/** Observer for one cache event. Async rejection is isolated like a synchronous throw. */
export type ResourceCacheListener<Value = unknown> = (
  event: ResourceCacheEntryEvent<Value>,
) => unknown;

/** Entry subscription options. */
export interface ResourceCacheSubscriptionOptions {
  /** Queue one current-state event for this listener after subscription. */
  readonly emitCurrent?: boolean;
}

/** Raised when strict structural-key traversal cannot safely canonicalize a request. */
export class ResourceCacheKeyError extends TypeError {
  readonly code: ResourceCacheKeyErrorCode;
  readonly path: string;

  constructor(code: ResourceCacheKeyErrorCode, message: string, path = "$") {
    super(message);
    this.name = "ResourceCacheKeyError";
    this.code = code;
    this.path = path;
  }
}

/** Raised when a configured hard bound is invalid. */
export class ResourceCacheLimitError extends RangeError {
  readonly code = "RESOURCE_CACHE_INVALID_LIMIT";

  constructor(
    readonly limit: string,
    readonly value: unknown,
    readonly minimum: number,
    readonly maximum: number,
  ) {
    super(`${limit} must be a safe integer between ${minimum} and ${maximum}.`);
    this.name = "ResourceCacheLimitError";
  }
}

/** Raised when a new structural key would exceed the live-entry capacity. */
export class ResourceCacheCapacityError extends Error {
  readonly code = "RESOURCE_CACHE_CAPACITY";

  constructor(readonly capacity: number, readonly size: number) {
    super(`Resource cache capacity ${capacity} is exhausted.`);
    this.name = "ResourceCacheCapacityError";
  }
}

/** Raised after coordinator disposal. */
export class ResourceCacheDisposedError extends Error {
  readonly code = "RESOURCE_CACHE_DISPOSED";

  constructor() {
    super("Resource cache coordinator is disposed.");
    this.name = "ResourceCacheDisposedError";
  }
}

/** Raised when a released or coordinator-invalidated owner is used. */
export class ResourceCacheHandleReleasedError extends Error {
  readonly code = "RESOURCE_CACHE_HANDLE_RELEASED";

  constructor(readonly key: string) {
    super("Resource cache handle has been released.");
    this.name = "ResourceCacheHandleReleasedError";
  }
}

/** Raised when an entry can no longer allocate a safe integer revision. */
export class ResourceCacheRevisionExhaustedError extends Error {
  readonly code = "RESOURCE_CACHE_REVISION_EXHAUSTED";

  constructor(readonly key: string, readonly revision: number) {
    super("Resource cache entry revision is exhausted.");
    this.name = "ResourceCacheRevisionExhaustedError";
  }
}

/** Raised when a bounded listener collection cannot accept another listener. */
export class ResourceCacheListenerLimitError extends Error {
  readonly code = "RESOURCE_CACHE_LISTENER_LIMIT";

  constructor(
    readonly scope: "entry" | "coordinator",
    readonly limit: number,
    readonly count: number,
  ) {
    super(`Resource cache ${scope} listener limit ${limit} is exhausted.`);
    this.name = "ResourceCacheListenerLimitError";
  }
}

/** Raised when a mutation cannot enqueue lossless event delivery. */
export class ResourceCacheEventDrainLimitError extends Error {
  readonly code = "RESOURCE_CACHE_EVENT_DRAIN_LIMIT";

  constructor(readonly key: string, readonly limit: number) {
    super(`Resource cache event drain limit ${limit} is exhausted.`);
    this.name = "ResourceCacheEventDrainLimitError";
  }
}

/** Raised when entry diagnostic data is not a small plain data record. */
export class ResourceCacheDiagnosticError extends TypeError {
  readonly code = "RESOURCE_CACHE_INVALID_DIAGNOSTIC";

  constructor(message: string) {
    super(message);
    this.name = "ResourceCacheDiagnosticError";
  }
}

interface CacheEntry<Value> {
  /** Opaque, content-redacting identifier exposed through diagnostics and events. */
  readonly key: string;
  /** Collision-free canonical structural key retained only for internal lookup. */
  readonly structuralKey: string;
  readonly owners: Set<OwnerState<Value>>;
  readonly listeners: Map<number, ResourceCacheListener<Value>>;
  status: ResourceCacheEntryStatus;
  revision: number;
  hasValue: boolean;
  value: Value | undefined;
  diagnostic?: Readonly<ResourceCacheEntryDiagnostic>;
  stale: boolean;
  refreshing: boolean;
  retained: boolean;
  updatedAtMs?: number;
  staleAtMs?: number;
  retainedAtMs?: number;
  retainedUntilMs?: number;
  refreshTrigger?: ResourceCacheRefreshTrigger;
  staleTimer?: ResourceCacheTimerRegistration;
  retentionTimer?: ResourceCacheTimerRegistration;
  staleTimerGeneration: number;
  retentionTimerGeneration: number;
  policyEnabled: boolean;
  dead: boolean;
}

interface OwnerState<Value> {
  readonly entry: CacheEntry<Value>;
  readonly subscriptions: Set<number>;
  active: boolean;
}

interface DispatchJob<Value> {
  readonly event: ResourceCacheEntryEvent<Value>;
  readonly entryListeners: readonly ResourceCacheListener<Value>[];
  readonly coordinatorListeners: readonly ResourceCacheListener<Value>[];
}

interface DeferredTemporalCallback {
  readonly key: string;
  readonly callback: () => void;
}

interface PreparedEviction<Value> {
  readonly job: DispatchJob<Value>;
  readonly staleTimer?: ResourceCacheTimerRegistration;
  readonly retentionTimer?: ResourceCacheTimerRegistration;
}

interface CanonicalContext {
  readonly limits: ResolvedResourceCacheKeyLimits;
  readonly writer: CanonicalWriter;
  readonly ancestors: WeakSet<object>;
  nodes: number;
}

interface PreparedTimer {
  readonly generation: number;
  readonly deadlineMs: number;
  readonly handle: ResourceCacheTimerRegistration;
  activate(): void;
  flush(): void;
}

interface ResourceCacheTimerRegistration extends ResourceCacheTimerCancellation {
  deactivate(): void;
}

interface ResourceCacheTimerCallbackGate {
  readonly invoke: () => void;
  activate(): void;
  takePending(): (() => void) | undefined;
  deactivate(): void;
}

const DEFAULT_KEY_LIMITS: ResolvedResourceCacheKeyLimits = Object.freeze({
  maxDepth: 32,
  maxNodes: 4096,
  maxContainerEntries: 1024,
  maxKeyBytes: 65_536,
});

const HARD_LIMITS = Object.freeze({
  maxDepth: 256,
  maxNodes: 1_000_000,
  maxContainerEntries: 100_000,
  maxKeyBytes: 16_777_216,
  maxEntries: 1_000_000,
  maxInspectionEntries: 100_000,
  maxDiagnostics: 4096,
  maxListeners: 65_536,
  maxEventsPerDrain: 100_000,
  maxDiagnosticText: 16_384,
});

const TEXT_ENCODER = new TextEncoder();
const ARRAY_INDEX = /^(?:0|[1-9][0-9]*)$/;
const STATUSES: readonly ResourceCacheEntryStatus[] = ["idle", "loading", "ready", "error"];
const RESOURCE_CACHE_HANDLE_TOKEN = Symbol("ResourceCacheHandle");
const NOOP_RESOURCE_CACHE_TIMER_CALLBACK = () => undefined;

/**
 * Produces a collision-free structural key for supported JavaScript data.
 *
 * Supported leaves are `undefined`, null, booleans, strings, and every number.
 * `NaN`, infinities, and negative zero have explicit distinct encodings. Dense
 * plain arrays and plain/null-prototype records recurse structurally. Getters,
 * callbacks, coercion hooks, symbols, bigint, functions, exotics, and cycles
 * are rejected rather than executed or guessed.
 */
export function canonicalResourceCacheKey(
  request: unknown,
  limits?: ResourceCacheKeyLimits,
): string {
  const resolved = resolveKeyLimits(limits);
  const writer = new CanonicalWriter(resolved.maxKeyBytes);
  appendCanonical(request, "$", 0, {
    limits: resolved,
    writer,
    ancestors: new WeakSet<object>(),
    nodes: 0,
  });
  return writer.finish();
}

/**
 * One ownership claim on a structural cache entry. Releasing or disposing a
 * handle is idempotent and removes only subscriptions created by that handle.
 */
export class ResourceCacheHandle<Value = unknown> {
  readonly #coordinator: ResourceCacheCoordinator<Value>;
  readonly #owner: OwnerState<Value>;

  /** @internal Handles can only be created by their coordinating cache. */
  constructor(coordinator: ResourceCacheCoordinator<Value>, owner: unknown, token: symbol) {
    if (token !== RESOURCE_CACHE_HANDLE_TOKEN) {
      throw new TypeError("Resource cache handles cannot be constructed directly.");
    }
    this.#coordinator = coordinator;
    this.#owner = owner as OwnerState<Value>;
  }

  /** Opaque, content-redacting identifier shared by equivalent live requests. */
  get key(): string {
    return this.#owner.entry.key;
  }

  /** Whether this ownership claim can no longer read, update, or subscribe. */
  get released(): boolean {
    return !this.#owner.active;
  }

  /** Returns the current published reference without cloning or mutating it. */
  read(): Value | undefined {
    this.#coordinator.assertOwner(this.#owner);
    return this.#owner.entry.value;
  }

  /** Publishes one value reference, state, and monotonically increased revision. */
  set(value: Value, status: ResourceCacheEntryStatus = "ready"): ResourceCacheEntryInspection {
    return this.#coordinator.setOwnerValue(this.#owner, value, status);
  }

  /**
   * Publishes only when the entry still has `expectedRevision`.
   *
   * This compare-and-set boundary is useful for asynchronous producers: a
   * completion that observed an older revision returns `undefined` instead of
   * replacing newer data. The revision is checked after caller-owned clock and
   * scheduler hooks have run, so reentrant updates cannot slip between the
   * comparison and publication.
   */
  setIfRevision(
    expectedRevision: number,
    value: Value,
    status: ResourceCacheEntryStatus = "ready",
  ): ResourceCacheEntryInspection | undefined {
    return this.#coordinator.setOwnerValueIfRevision(
      this.#owner,
      expectedRevision,
      value,
      status,
    );
  }

  /** Changes state while retaining any current value reference. */
  transition(
    status: ResourceCacheEntryStatus,
    diagnostic?: ResourceCacheEntryDiagnostic,
  ): ResourceCacheEntryInspection {
    return this.#coordinator.transitionOwner(this.#owner, status, diagnostic);
  }

  /** Clears the current value while publishing a new state revision. */
  clear(
    status: ResourceCacheEntryStatus = "idle",
    diagnostic?: ResourceCacheEntryDiagnostic,
  ): ResourceCacheEntryInspection {
    return this.#coordinator.clearOwner(this.#owner, status, diagnostic);
  }

  /**
   * Requests a refresh while retaining the current usable value. Returns false
   * when no value exists or a refresh request is already active.
   */
  requestRefresh(trigger: ResourceCacheRefreshTrigger = "manual"): boolean {
    return this.#coordinator.requestOwnerRefresh(this.#owner, trigger);
  }

  /** Adds an insertion-ordered listener owned by this handle. */
  subscribe(
    listener: ResourceCacheListener<Value>,
    options: ResourceCacheSubscriptionOptions = {},
  ): () => void {
    return this.#coordinator.subscribeOwner(this.#owner, listener, options);
  }

  /** Returns a fresh, immutable, value-free entry snapshot. */
  inspect(): ResourceCacheEntryInspection {
    this.#coordinator.assertOwner(this.#owner);
    return this.#coordinator.inspectOwnedEntry(this.#owner);
  }

  /** Releases this ownership claim and evicts the entry only if it is last. */
  release(): boolean {
    return this.#coordinator.releaseOwner(this.#owner);
  }

  /** Alias for idempotent ownership release. */
  dispose(): boolean {
    return this.release();
  }
}

/**
 * Renderer-neutral, process-local structural resource cache coordinator.
 *
 * The coordinator performs no I/O. Optional temporal policies use handles from
 * a caller-owned scheduler. Entry listeners run before coordinator listeners
 * in insertion order; reentrant events are drained FIFO.
 */
export class ResourceCacheCoordinator<Value = unknown> {
  readonly maxEntries: number;
  readonly maxInspectionEntries: number;
  readonly maxDiagnostics: number;
  readonly maxListenersPerEntry: number;
  readonly maxCoordinatorListeners: number;
  readonly maxEventsPerDrain: number;
  readonly staleTimeMs: number;
  readonly retentionTimeMs: number;
  readonly refreshOnFocus: boolean;
  readonly refreshOnReconnect: boolean;
  readonly #maxDiagnosticText: number;
  readonly #initialRevision: number;
  readonly #keyLimits: ResolvedResourceCacheKeyLimits;
  readonly #policyEnabled: boolean;
  readonly #scheduler?: ResourceCacheSchedulerCapabilities;
  readonly #entries = new Map<string, CacheEntry<Value>>();
  readonly #publicKeys = new Set<string>();
  readonly #ownerStates = new WeakSet<object>();
  readonly #listeners = new Map<number, ResourceCacheListener<Value>>();
  readonly #diagnostics: ResourceCacheCoordinatorDiagnostic[] = [];
  readonly #eventQueue: DispatchJob<Value>[] = [];
  readonly #deferredTemporalCallbacks: DeferredTemporalCallback[] = [];
  #disposed = false;
  #dispatching = false;
  #drainingTemporalCallbacks = false;
  #dispatchedInDrain = 0;
  #nextListenerId: number | undefined = 1;
  #nextDiagnosticSequence: number | undefined = 1;
  #nextEntrySequence = 1;
  #acquires = 0;
  #releases = 0;
  #updates = 0;
  #evictions = 0;
  #listenerFailures = 0;
  #droppedEvents = 0;
  #diagnosticsDropped = 0;
  #staleTransitions = 0;
  #refreshRequests = 0;
  #clockRegressions = 0;
  #lastNowMs: number | undefined;

  constructor(options: ResourceCacheCoordinatorOptions = {}) {
    if (options === null || typeof options !== "object" || Array.isArray(options)) {
      throw new TypeError("Resource cache options must be an object.");
    }
    const policy = resolveResourceCachePolicy(options);
    this.#policyEnabled = policy.enabled;
    this.#scheduler = policy.scheduler;
    this.staleTimeMs = policy.staleTimeMs;
    this.retentionTimeMs = policy.retentionTimeMs;
    this.refreshOnFocus = policy.refreshOnFocus;
    this.refreshOnReconnect = policy.refreshOnReconnect;
    this.#keyLimits = resolveKeyLimits(options.keyLimits);
    this.maxEntries = boundedInteger(options.maxEntries ?? 1024, "maxEntries", 0, HARD_LIMITS.maxEntries);
    this.maxInspectionEntries = boundedInteger(
      options.maxInspectionEntries ?? 256,
      "maxInspectionEntries",
      0,
      HARD_LIMITS.maxInspectionEntries,
    );
    this.maxDiagnostics = boundedInteger(
      options.maxDiagnostics ?? 64,
      "maxDiagnostics",
      0,
      HARD_LIMITS.maxDiagnostics,
    );
    this.maxListenersPerEntry = boundedInteger(
      options.maxListenersPerEntry ?? 1024,
      "maxListenersPerEntry",
      0,
      HARD_LIMITS.maxListeners,
    );
    this.maxCoordinatorListeners = boundedInteger(
      options.maxCoordinatorListeners ?? 1024,
      "maxCoordinatorListeners",
      0,
      HARD_LIMITS.maxListeners,
    );
    this.maxEventsPerDrain = boundedInteger(
      options.maxEventsPerDrain ?? 4096,
      "maxEventsPerDrain",
      1,
      HARD_LIMITS.maxEventsPerDrain,
    );
    this.#maxDiagnosticText = boundedInteger(
      options.maxDiagnosticText ?? 512,
      "maxDiagnosticText",
      1,
      HARD_LIMITS.maxDiagnosticText,
    );
    this.#initialRevision = boundedInteger(
      options.initialRevision ?? 0,
      "initialRevision",
      0,
      Number.MAX_SAFE_INTEGER,
    );
  }

  /** Number of live structural entries, including entries awaiting retention expiry. */
  get size(): number {
    return this.#entries.size;
  }

  /** Whether coordinator disposal has invalidated every handle. */
  get disposed(): boolean {
    return this.#disposed;
  }

  /** Canonicalizes a request with this coordinator's configured hard limits. */
  keyOf(request: unknown): string {
    return canonicalResourceCacheKey(request, this.#keyLimits);
  }

  /** Acquires one ownership-counted handle, sharing structurally equivalent requests. */
  acquire(request: unknown): ResourceCacheHandle<Value> {
    this.assertActive();
    const structuralKey = this.keyOf(request);
    // Structural-key reflection can execute Proxy traps. Disposal during that
    // boundary must not be able to repopulate an already-disposed coordinator.
    this.assertActive();
    let entry = this.#entries.get(structuralKey);
    if (entry?.retained && entry.retainedUntilMs !== undefined && this.#scheduler !== undefined) {
      const now = this.readNow();
      // The injected clock can reenter. Apply the observation only to the
      // entry currently mapped after that boundary.
      this.assertActive();
      entry = this.#entries.get(structuralKey);
      if (
        entry?.retained && entry.retainedUntilMs !== undefined &&
        now >= entry.retainedUntilMs
      ) {
        return this.acquireReplacingExpiredEntry(entry);
      }
    }
    if (!entry) {
      if (this.#entries.size >= this.maxEntries) {
        throw new ResourceCacheCapacityError(this.maxEntries, this.#entries.size);
      }
      this.assertMutationCanNotify("resource:pending");
      entry = this.createEntry(structuralKey);
      this.#entries.set(structuralKey, entry);
    } else {
      this.assertMutationCanNotify(entry.key);
    }
    const retentionTimer = this.detachRetentionTimer(entry);
    entry.retained = false;
    entry.retainedAtMs = undefined;
    entry.retainedUntilMs = undefined;
    const owner: OwnerState<Value> = {
      entry,
      subscriptions: new Set<number>(),
      active: true,
    };
    entry.owners.add(owner);
    this.#ownerStates.add(owner);
    this.#acquires = incrementSaturated(this.#acquires);
    const handle = new ResourceCacheHandle(this, owner, RESOURCE_CACHE_HANDLE_TOKEN);
    this.enqueueEntryEvent(entry, "acquired");
    this.cancelTimer(retentionTimer);
    // Acquired listeners run synchronously and may dispose the coordinator.
    // Never return a handle that was invalidated before acquire completed.
    if (this.#disposed) throw new ResourceCacheDisposedError();
    this.assertOwner(owner);
    return handle;
  }

  /** Adds a coordinator-wide insertion-ordered observer. */
  subscribe(listener: ResourceCacheListener<Value>): () => void {
    this.assertActive();
    assertListener(listener);
    if (this.#listeners.size >= this.maxCoordinatorListeners) {
      throw new ResourceCacheListenerLimitError(
        "coordinator",
        this.maxCoordinatorListeners,
        this.#listeners.size,
      );
    }
    const id = this.allocateListenerId();
    this.#listeners.set(id, listener);
    let active = true;
    return () => {
      if (!active) return;
      active = false;
      this.#listeners.delete(id);
    };
  }

  /** Returns a value-free snapshot for one structural request if it is live. */
  inspectEntry(request: unknown): ResourceCacheEntryInspection | undefined {
    const entry = this.#entries.get(this.keyOf(request));
    return entry ? inspectEntry(entry) : undefined;
  }

  /** Requests refreshes for stale owned entries when the focus policy is enabled. */
  notifyFocus(): number {
    return this.requestPolicyRefreshes("focus", this.refreshOnFocus);
  }

  /** Requests refreshes for stale owned entries when the reconnect policy is enabled. */
  notifyReconnect(): number {
    return this.requestPolicyRefreshes("reconnect", this.refreshOnReconnect);
  }

  /** Returns a bounded, immutable, structured-clone-safe coordinator snapshot. */
  inspect(options: ResourceCacheInspectionOptions = {}): ResourceCacheInspection {
    const entryLimit = Math.min(
      this.maxInspectionEntries,
      boundedInteger(
        options.maxEntries ?? this.maxInspectionEntries,
        "inspection.maxEntries",
        0,
        HARD_LIMITS.maxInspectionEntries,
      ),
    );
    const diagnosticLimit = Math.min(
      this.maxDiagnostics,
      boundedInteger(
        options.maxDiagnostics ?? this.maxDiagnostics,
        "inspection.maxDiagnostics",
        0,
        HARD_LIMITS.maxDiagnostics,
      ),
    );
    const allEntries = [...this.#entries.values()].sort((left, right) => compareText(left.key, right.key));
    const entries = allEntries.slice(0, entryLimit).map(inspectEntry);
    const diagnosticStart = Math.max(0, this.#diagnostics.length - diagnosticLimit);
    const diagnostics = this.#diagnostics.slice(diagnosticStart).map(cloneCoordinatorDiagnostic);
    const inspection: ResourceCacheInspection = {
      disposed: this.#disposed,
      size: this.#entries.size,
      maxEntries: this.maxEntries,
      maxInspectionEntries: this.maxInspectionEntries,
      maxDiagnostics: this.maxDiagnostics,
      maxListenersPerEntry: this.maxListenersPerEntry,
      maxCoordinatorListeners: this.maxCoordinatorListeners,
      maxEventsPerDrain: this.maxEventsPerDrain,
      keyLimits: Object.freeze({ ...this.#keyLimits }),
      acquires: this.#acquires,
      releases: this.#releases,
      updates: this.#updates,
      evictions: this.#evictions,
      listenerFailures: this.#listenerFailures,
      droppedEvents: this.#droppedEvents,
      diagnosticsDropped: this.#diagnosticsDropped,
      entryLimit,
      omittedEntries: allEntries.length - entries.length,
      diagnosticLimit,
      omittedDiagnostics: this.#diagnostics.length - diagnostics.length,
      entries: Object.freeze(entries),
      diagnostics: Object.freeze(diagnostics),
      ...(this.#policyEnabled ? { policy: this.inspectPolicy() } : {}),
    };
    return Object.freeze(inspection);
  }

  /**
   * Invalidates all handles, synchronously emits disposal events, and releases
   * every retained value/listener reference. Safe to call more than once.
   */
  dispose(): boolean {
    if (this.#disposed) return false;
    const firstEntry = this.#entries.values().next().value as CacheEntry<Value> | undefined;
    if (firstEntry !== undefined) {
      // Disposal publishes one terminal event for every live entry. Reserve
      // the complete batch before invalidating any owner or clearing any
      // retained state so a reentrant exhausted drain cannot half-dispose the
      // coordinator while dropping its required lifecycle notifications.
      this.assertMutationCanNotify(firstEntry.key, this.#entries.size);
    }
    const disposalJobs: DispatchJob<Value>[] = [];
    const timersToCancel: ResourceCacheTimerRegistration[] = [];
    this.#disposed = true;
    for (const entry of this.#entries.values()) {
      for (const owner of entry.owners) {
        owner.active = false;
        owner.subscriptions.clear();
      }
      entry.owners.clear();
      entry.dead = true;
      const staleTimer = this.detachStaleTimer(entry);
      const retentionTimer = this.detachRetentionTimer(entry);
      if (staleTimer) timersToCancel.push(staleTimer);
      if (retentionTimer) timersToCancel.push(retentionTimer);
      entry.refreshing = false;
      entry.retained = false;
      entry.refreshTrigger = undefined;
      entry.retainedAtMs = undefined;
      entry.retainedUntilMs = undefined;
      this.#evictions = incrementSaturated(this.#evictions);
      disposalJobs.push({
        event: makeEvent(entry, "disposed"),
        entryListeners: [...entry.listeners.values()],
        coordinatorListeners: [...this.#listeners.values()],
      });
      entry.listeners.clear();
      entry.hasValue = false;
      entry.value = undefined;
      entry.diagnostic = undefined;
    }
    this.#entries.clear();
    this.#publicKeys.clear();
    this.#listeners.clear();
    this.#deferredTemporalCallbacks.length = 0;
    for (const timer of timersToCancel) this.cancelTimer(timer);
    // Outside an existing drain, each already-snapshotted terminal event gets
    // its own bounded drain. During reentrant disposal the atomic reservation
    // above guarantees that every job fits in the current drain.
    for (const job of disposalJobs) {
      this.enqueueJob(job.event, job.entryListeners, job.coordinatorListeners);
    }
    return true;
  }

  /** @internal Validates one handle ownership claim without reading its value. */
  assertOwner(owner: unknown): void {
    this.requireActiveOwner(owner);
  }

  private requireKnownOwner(owner: unknown): OwnerState<Value> {
    if (owner === null || typeof owner !== "object" || !this.#ownerStates.has(owner)) {
      throw new TypeError("Resource cache owner was not created by this coordinator.");
    }
    return owner as OwnerState<Value>;
  }

  private requireActiveOwner(owner: unknown): OwnerState<Value> {
    const state = this.requireKnownOwner(owner);
    if (
      !state.active || state.entry.dead || this.#disposed ||
      this.#entries.get(state.entry.structuralKey) !== state.entry
    ) {
      throw new ResourceCacheHandleReleasedError(state.entry.key);
    }
    return state;
  }

  /** @internal Publishes a value on behalf of a live owner. */
  setOwnerValue(
    owner: unknown,
    value: Value,
    status: ResourceCacheEntryStatus,
  ): ResourceCacheEntryInspection {
    const normalizedStatus = validateStatus(status);
    const initialState = this.requireActiveOwner(owner);
    const entry = initialState.entry;
    const now = this.#scheduler === undefined ? undefined : this.readNow();
    const prepared = now === undefined ? undefined : this.prepareStaleTimer(entry, now);
    let nextRevision: number;
    try {
      // Clock and scheduler implementations are injected. Revalidate after
      // crossing those caller-controlled boundaries before committing data.
      const state = this.requireActiveOwner(owner);
      if (state.entry !== entry) throw new ResourceCacheHandleReleasedError(entry.key);
      this.assertMutationCanNotify(entry.key);
      nextRevision = allocateRevision(entry);
    } catch (error) {
      this.cancelPreparedTimer(prepared);
      throw error;
    }
    const previousTimer = this.replaceStaleTimer(entry, prepared);
    entry.value = value;
    entry.hasValue = true;
    entry.status = normalizedStatus;
    entry.revision = nextRevision;
    entry.diagnostic = undefined;
    entry.updatedAtMs = now;
    entry.staleAtMs = prepared?.deadlineMs ?? (this.staleTimeMs === 0 ? now : undefined);
    entry.stale = this.staleTimeMs === 0;
    entry.refreshing = false;
    entry.refreshTrigger = undefined;
    if (entry.stale) this.#staleTransitions = incrementSaturated(this.#staleTransitions);
    this.#updates = incrementSaturated(this.#updates);
    const inspection = inspectEntry(entry);
    prepared?.activate();
    this.enqueueEntryEvent(entry, "updated");
    this.cancelTimer(previousTimer);
    prepared?.flush();
    return inspection;
  }

  /** @internal Revision-guarded publication for asynchronous producers. */
  setOwnerValueIfRevision(
    owner: unknown,
    expectedRevision: number,
    value: Value,
    status: ResourceCacheEntryStatus,
  ): ResourceCacheEntryInspection | undefined {
    const normalizedExpectedRevision = boundedInteger(
      expectedRevision,
      "expectedRevision",
      0,
      Number.MAX_SAFE_INTEGER,
    );
    const normalizedStatus = validateStatus(status);
    const initialState = this.requireActiveOwner(owner);
    const entry = initialState.entry;
    const now = this.#scheduler === undefined ? undefined : this.readNow();
    const prepared = now === undefined ? undefined : this.prepareStaleTimer(entry, now);
    let nextRevision: number;
    try {
      // The injected clock/scheduler may synchronously publish a newer value.
      // Compare only after returning from that caller-controlled boundary.
      const state = this.requireActiveOwner(owner);
      if (state.entry !== entry) throw new ResourceCacheHandleReleasedError(entry.key);
      if (entry.revision !== normalizedExpectedRevision) {
        this.cancelPreparedTimer(prepared);
        return undefined;
      }
      this.assertMutationCanNotify(entry.key);
      nextRevision = allocateRevision(entry);
    } catch (error) {
      this.cancelPreparedTimer(prepared);
      throw error;
    }
    const previousTimer = this.replaceStaleTimer(entry, prepared);
    entry.value = value;
    entry.hasValue = true;
    entry.status = normalizedStatus;
    entry.revision = nextRevision;
    entry.diagnostic = undefined;
    entry.updatedAtMs = now;
    entry.staleAtMs = prepared?.deadlineMs ?? (this.staleTimeMs === 0 ? now : undefined);
    entry.stale = this.staleTimeMs === 0;
    entry.refreshing = false;
    entry.refreshTrigger = undefined;
    if (entry.stale) this.#staleTransitions = incrementSaturated(this.#staleTransitions);
    this.#updates = incrementSaturated(this.#updates);
    const inspection = inspectEntry(entry);
    prepared?.activate();
    this.enqueueEntryEvent(entry, "updated");
    this.cancelTimer(previousTimer);
    prepared?.flush();
    return inspection;
  }

  /** @internal Transitions entry state while preserving its current value. */
  transitionOwner(
    owner: unknown,
    status: ResourceCacheEntryStatus,
    diagnostic?: ResourceCacheEntryDiagnostic,
  ): ResourceCacheEntryInspection {
    this.requireActiveOwner(owner);
    const normalizedStatus = validateStatus(status);
    const normalizedDiagnostic = diagnostic === undefined
      ? undefined
      : normalizeEntryDiagnostic(diagnostic, this.#maxDiagnosticText);
    // Descriptor reflection above can invoke Proxy traps and reenter release or
    // disposal. Revalidate ownership before touching entry state.
    const state = this.requireActiveOwner(owner);
    const entry = state.entry;
    this.assertMutationCanNotify(entry.key);
    const nextRevision = allocateRevision(entry);
    entry.status = normalizedStatus;
    entry.revision = nextRevision;
    entry.diagnostic = normalizedDiagnostic;
    entry.refreshing = normalizedStatus === "loading" && entry.hasValue;
    if (!entry.refreshing) entry.refreshTrigger = undefined;
    this.#updates = incrementSaturated(this.#updates);
    const inspection = inspectEntry(entry);
    this.enqueueEntryEvent(entry, "updated");
    return inspection;
  }

  /** @internal Clears an entry value while publishing state. */
  clearOwner(
    owner: unknown,
    status: ResourceCacheEntryStatus,
    diagnostic?: ResourceCacheEntryDiagnostic,
  ): ResourceCacheEntryInspection {
    this.requireActiveOwner(owner);
    const normalizedStatus = validateStatus(status);
    const normalizedDiagnostic = diagnostic === undefined
      ? undefined
      : normalizeEntryDiagnostic(diagnostic, this.#maxDiagnosticText);
    const state = this.requireActiveOwner(owner);
    const entry = state.entry;
    this.assertMutationCanNotify(entry.key);
    const nextRevision = allocateRevision(entry);
    const staleTimer = this.detachStaleTimer(entry);
    entry.value = undefined;
    entry.hasValue = false;
    entry.status = normalizedStatus;
    entry.revision = nextRevision;
    entry.diagnostic = normalizedDiagnostic;
    entry.updatedAtMs = undefined;
    entry.staleAtMs = undefined;
    entry.stale = false;
    entry.refreshing = false;
    entry.refreshTrigger = undefined;
    this.#updates = incrementSaturated(this.#updates);
    const inspection = inspectEntry(entry);
    this.enqueueEntryEvent(entry, "updated");
    this.cancelTimer(staleTimer);
    return inspection;
  }

  /** @internal Requests stale-while-revalidate on behalf of a live owner. */
  requestOwnerRefresh(owner: unknown, trigger: ResourceCacheRefreshTrigger): boolean {
    const normalizedTrigger = validateRefreshTrigger(trigger);
    const state = this.requireActiveOwner(owner);
    const entry = state.entry;
    if (!entry.hasValue || entry.refreshing) return false;
    this.assertMutationCanNotify(entry.key);
    const nextRevision = allocateRevision(entry);
    entry.status = "loading";
    entry.revision = nextRevision;
    entry.diagnostic = undefined;
    entry.refreshing = true;
    entry.refreshTrigger = normalizedTrigger;
    this.#refreshRequests = incrementSaturated(this.#refreshRequests);
    this.#updates = incrementSaturated(this.#updates);
    this.enqueueEntryEvent(entry, "refresh-requested");
    return true;
  }

  /** @internal Creates a handle-owned listener registration. */
  subscribeOwner(
    owner: unknown,
    listener: ResourceCacheListener<Value>,
    options: ResourceCacheSubscriptionOptions,
  ): () => void {
    this.requireActiveOwner(owner);
    assertListener(listener);
    const emitCurrent = normalizeSubscriptionOptions(options);
    // Subscription-option reflection is caller-controlled and may reenter.
    const state = this.requireActiveOwner(owner);
    const entry = state.entry;
    if (emitCurrent) this.assertMutationCanNotify(entry.key);
    if (entry.listeners.size >= this.maxListenersPerEntry) {
      throw new ResourceCacheListenerLimitError("entry", this.maxListenersPerEntry, entry.listeners.size);
    }
    const id = this.allocateListenerId();
    entry.listeners.set(id, listener);
    state.subscriptions.add(id);
    let active = true;
    const unsubscribe = () => {
      if (!active) return;
      active = false;
      entry.listeners.delete(id);
      state.subscriptions.delete(id);
    };
    if (emitCurrent) {
      this.enqueueJob(makeEvent(entry, "snapshot"), [listener], []);
    }
    return unsubscribe;
  }

  /** @internal Returns a live owned entry snapshot. */
  inspectOwnedEntry(owner: unknown): ResourceCacheEntryInspection {
    const state = this.requireActiveOwner(owner);
    return inspectEntry(state.entry);
  }

  /** @internal Releases one owner without touching other handles or value objects. */
  releaseOwner(owner: unknown): boolean {
    const state = this.requireKnownOwner(owner);
    if (!state.active) return false;
    const entry = state.entry;
    this.requireActiveOwner(state);
    const lastOwner = entry.owners.size === 1;
    const shouldRetain = lastOwner && this.retentionTimeMs !== 0;
    const now = shouldRetain && this.#scheduler !== undefined ? this.readNow() : undefined;
    const prepared = shouldRetain && Number.isFinite(this.retentionTimeMs)
      ? this.prepareRetentionTimer(entry, now!)
      : undefined;
    try {
      // Clock and scheduler calls above are injected and may reenter.
      this.requireActiveOwner(state);
      this.assertMutationCanNotify(entry.key);
      state.active = false;
      for (const id of state.subscriptions) entry.listeners.delete(id);
      state.subscriptions.clear();
      entry.owners.delete(state);
      this.#releases = incrementSaturated(this.#releases);
      if (entry.owners.size > 0) {
        this.enqueueEntryEvent(entry, "released");
        this.cancelPreparedTimer(prepared);
        return true;
      }
      if (shouldRetain) {
        const previousTimer = this.replaceRetentionTimer(entry, prepared);
        entry.retained = true;
        entry.retainedAtMs = now;
        entry.retainedUntilMs = prepared?.deadlineMs;
        prepared?.activate();
        this.enqueueEntryEvent(entry, "retained");
        this.cancelTimer(previousTimer);
        prepared?.flush();
        return true;
      }

      this.evictEntry(entry);
      return true;
    } catch (error) {
      this.cancelPreparedTimer(prepared);
      throw error;
    }
  }

  private requestPolicyRefreshes(
    trigger: "focus" | "reconnect",
    enabled: boolean,
  ): number {
    this.assertActive();
    if (!enabled) return 0;
    const now = this.#scheduler === undefined ? undefined : this.readNow();
    const candidates = [...this.#entries.values()].filter((entry) =>
      !entry.dead && entry.owners.size > 0 && entry.hasValue && !entry.refreshing &&
      (entry.stale || (now !== undefined && entry.staleAtMs !== undefined && now >= entry.staleAtMs))
    );
    if (candidates.length === 0) return 0;
    // Validate the whole synchronous batch before changing any entry.
    for (const entry of candidates) allocateRevision(entry);
    this.assertEventBatchCanNotify(candidates[0]!.key, candidates.length);
    const jobs: DispatchJob<Value>[] = [];
    for (const entry of candidates) {
      if (!entry.stale) {
        entry.stale = true;
        this.#staleTransitions = incrementSaturated(this.#staleTransitions);
      }
      entry.status = "loading";
      entry.revision += 1;
      entry.diagnostic = undefined;
      entry.refreshing = true;
      entry.refreshTrigger = trigger;
      this.#refreshRequests = incrementSaturated(this.#refreshRequests);
      this.#updates = incrementSaturated(this.#updates);
      jobs.push({
        event: makeEvent(entry, "refresh-requested"),
        entryListeners: [...entry.listeners.values()],
        coordinatorListeners: [...this.#listeners.values()],
      });
    }
    this.enqueueJobBatch(jobs);
    return candidates.length;
  }

  private inspectPolicy(): ResourceCachePolicyInspection {
    let staleEntries = 0;
    let refreshingEntries = 0;
    let retainedEntries = 0;
    for (const entry of this.#entries.values()) {
      if (entry.stale) staleEntries += 1;
      if (entry.refreshing) refreshingEntries += 1;
      if (entry.retained) retainedEntries += 1;
    }
    return Object.freeze({
      staleTimeMs: this.staleTimeMs,
      retentionTimeMs: this.retentionTimeMs,
      refreshOnFocus: this.refreshOnFocus,
      refreshOnReconnect: this.refreshOnReconnect,
      staleEntries,
      refreshingEntries,
      retainedEntries,
      staleTransitions: this.#staleTransitions,
      refreshRequests: this.#refreshRequests,
      clockRegressions: this.#clockRegressions,
    });
  }

  private readNow(): number {
    const scheduler = this.#scheduler;
    if (!scheduler) {
      throw new TypeError("A resource cache temporal policy requires a scheduler.");
    }
    const observed = scheduler.now();
    if (typeof observed !== "number" || !Number.isFinite(observed) || observed < 0 || observed > MAX_MONOTONIC_TIME) {
      throw new RangeError(`scheduler.now() must be finite and between 0 and ${MAX_MONOTONIC_TIME}.`);
    }
    const previous = this.#lastNowMs;
    if (previous !== undefined && observed < previous) {
      this.#clockRegressions = incrementSaturated(this.#clockRegressions);
      this.recordDiagnostic(
        "clock-regression",
        "clock",
        undefined,
        "The injected resource cache clock regressed and was clamped.",
      );
      return previous;
    }
    this.#lastNowMs = observed;
    return observed;
  }

  private prepareStaleTimer(entry: CacheEntry<Value>, now: number): PreparedTimer | undefined {
    if (!Number.isFinite(this.staleTimeMs) || this.staleTimeMs === 0) return undefined;
    const deadlineMs = addMonotonicDuration(now, this.staleTimeMs);
    const generation = nextTimerGeneration(entry.staleTimerGeneration);
    return this.prepareTimer(deadlineMs, generation, entry.key, () => this.onStaleTimer(entry, generation));
  }

  private prepareRetentionTimer(entry: CacheEntry<Value>, now: number): PreparedTimer {
    const deadlineMs = addMonotonicDuration(now, this.retentionTimeMs);
    const generation = nextTimerGeneration(entry.retentionTimerGeneration);
    return this.prepareTimer(deadlineMs, generation, entry.key, () => this.onRetentionTimer(entry, generation));
  }

  private prepareTimer(
    deadlineMs: number,
    generation: number,
    key: string,
    callback: () => void,
  ): PreparedTimer {
    const gate = createResourceCacheTimerCallbackGate(callback);
    // The standalone gate now exclusively retains callback state. Clear this
    // method-frame binding so an invalid scheduler handle cannot retain the
    // coordinator through its scheduled wrapper.
    callback = NOOP_RESOURCE_CACHE_TIMER_CALLBACK;
    let rawHandle: unknown;
    try {
      rawHandle = this.#scheduler!.scheduleAt(deadlineMs, gate.invoke);
    } catch (error) {
      gate.deactivate();
      throw error;
    }
    let cancellation: ResourceCacheTimerCancellation;
    try {
      cancellation = snapshotResourceCacheTimerCancellation(rawHandle);
    } catch (error) {
      gate.deactivate();
      throw error;
    }
    const handle: ResourceCacheTimerRegistration = Object.freeze({
      cancel: cancellation.cancel,
      deactivate: gate.deactivate,
    });
    return {
      generation,
      deadlineMs,
      handle,
      activate: gate.activate,
      flush: () => {
        const current = gate.takePending();
        if (!current) return;
        this.runPreparedTemporalCallback(key, current);
      },
    };
  }

  private runPreparedTemporalCallback(key: string, callback: () => void): void {
    if (!this.#dispatching) {
      callback();
      return;
    }
    if (this.#deferredTemporalCallbacks.length >= this.maxEventsPerDrain) {
      this.recordTimerFailure(key);
      return;
    }
    this.#deferredTemporalCallbacks.push({ key, callback });
  }

  private drainDeferredTemporalCallbacks(): void {
    if (this.#dispatching || this.#drainingTemporalCallbacks || this.#deferredTemporalCallbacks.length === 0) return;
    this.#drainingTemporalCallbacks = true;
    let processed = 0;
    try {
      while (this.#deferredTemporalCallbacks.length > 0 && processed < this.maxEventsPerDrain) {
        const deferred = this.#deferredTemporalCallbacks.shift()!;
        processed += 1;
        deferred.callback();
      }
      if (this.#deferredTemporalCallbacks.length > 0) {
        const first = this.#deferredTemporalCallbacks[0]!;
        this.#deferredTemporalCallbacks.length = 0;
        this.recordTimerFailure(first.key);
      }
    } finally {
      this.#drainingTemporalCallbacks = false;
    }
  }

  private replaceStaleTimer(
    entry: CacheEntry<Value>,
    prepared: PreparedTimer | undefined,
  ): ResourceCacheTimerRegistration | undefined {
    const previous = entry.staleTimer;
    entry.staleTimerGeneration = prepared?.generation ?? nextTimerGeneration(entry.staleTimerGeneration);
    entry.staleTimer = prepared?.handle;
    return previous;
  }

  private replaceRetentionTimer(
    entry: CacheEntry<Value>,
    prepared: PreparedTimer | undefined,
  ): ResourceCacheTimerRegistration | undefined {
    const previous = entry.retentionTimer;
    entry.retentionTimerGeneration = prepared?.generation ?? nextTimerGeneration(entry.retentionTimerGeneration);
    entry.retentionTimer = prepared?.handle;
    return previous;
  }

  private detachStaleTimer(entry: CacheEntry<Value>): ResourceCacheTimerRegistration | undefined {
    const timer = entry.staleTimer;
    entry.staleTimer = undefined;
    entry.staleTimerGeneration = nextTimerGeneration(entry.staleTimerGeneration);
    return timer;
  }

  private detachRetentionTimer(entry: CacheEntry<Value>): ResourceCacheTimerRegistration | undefined {
    const timer = entry.retentionTimer;
    entry.retentionTimer = undefined;
    entry.retentionTimerGeneration = nextTimerGeneration(entry.retentionTimerGeneration);
    return timer;
  }

  private cancelPreparedTimer(prepared: PreparedTimer | undefined): void {
    this.cancelTimer(prepared?.handle);
  }

  private cancelTimer(timer: ResourceCacheTimerRegistration | undefined): void {
    if (!timer) return;
    timer.deactivate();
    try {
      timer.cancel();
    } catch {
      this.recordDiagnostic(
        "timer-failure",
        "timer",
        undefined,
        "An injected resource cache timer could not be cancelled; its generation was invalidated.",
      );
    }
  }

  private onStaleTimer(entry: CacheEntry<Value>, generation: number): void {
    if (this.#disposed || entry.dead || entry.staleTimerGeneration !== generation) return;
    entry.staleTimer = undefined;
    if (!entry.hasValue || entry.stale) return;
    try {
      this.assertMutationCanNotify(entry.key);
      entry.stale = true;
      this.#staleTransitions = incrementSaturated(this.#staleTransitions);
      this.enqueueEntryEvent(entry, "stale");
    } catch (error) {
      if (error instanceof ResourceCacheEventDrainLimitError) {
        this.retryTemporalTimer(entry, "stale");
        return;
      }
      this.recordTimerFailure(entry.key);
    }
  }

  private onRetentionTimer(entry: CacheEntry<Value>, generation: number): void {
    if (
      this.#disposed || entry.dead || entry.retentionTimerGeneration !== generation ||
      entry.owners.size > 0
    ) return;
    entry.retentionTimer = undefined;
    try {
      this.assertMutationCanNotify(entry.key);
      this.evictEntry(entry);
    } catch (error) {
      if (error instanceof ResourceCacheEventDrainLimitError) {
        this.retryTemporalTimer(entry, "retention");
        return;
      }
      this.recordTimerFailure(entry.key);
    }
  }

  private retryTemporalTimer(entry: CacheEntry<Value>, kind: "stale" | "retention"): void {
    try {
      const now = this.readNow();
      if (now === MAX_MONOTONIC_TIME) {
        this.recordTimerFailure(entry.key);
        return;
      }
      const deadlineMs = now + 1;
      if (kind === "stale") {
        const generation = nextTimerGeneration(entry.staleTimerGeneration);
        const prepared = this.prepareTimer(
          deadlineMs,
          generation,
          entry.key,
          () => this.onStaleTimer(entry, generation),
        );
        this.cancelTimer(this.replaceStaleTimer(entry, prepared));
        prepared.activate();
        prepared.flush();
      } else {
        const generation = nextTimerGeneration(entry.retentionTimerGeneration);
        const prepared = this.prepareTimer(
          deadlineMs,
          generation,
          entry.key,
          () => this.onRetentionTimer(entry, generation),
        );
        this.cancelTimer(this.replaceRetentionTimer(entry, prepared));
        entry.retainedUntilMs = deadlineMs;
        prepared.activate();
        prepared.flush();
      }
    } catch {
      this.recordTimerFailure(entry.key);
    }
  }

  private recordTimerFailure(key: string): void {
    this.recordDiagnostic(
      "timer-failure",
      "timer",
      key,
      "An injected resource cache timer failed; the opaque failure was isolated.",
    );
  }

  private createEntry(structuralKey: string): CacheEntry<Value> {
    return {
      key: this.allocateEntryKey(),
      structuralKey,
      status: "idle",
      revision: this.#initialRevision,
      owners: new Set<OwnerState<Value>>(),
      listeners: new Map<number, ResourceCacheListener<Value>>(),
      hasValue: false,
      value: undefined,
      stale: false,
      refreshing: false,
      retained: false,
      staleTimerGeneration: 0,
      retentionTimerGeneration: 0,
      policyEnabled: this.#policyEnabled,
      dead: false,
    };
  }

  private acquireReplacingExpiredEntry(expired: CacheEntry<Value>): ResourceCacheHandle<Value> {
    // Expiry and replacement publish one inseparable lifecycle batch. Reject
    // before allocating a key or invalidating retained state if it cannot fit.
    this.assertEventBatchCanNotify(expired.key, 2);
    const replacement = this.createEntry(expired.structuralKey);
    const owner: OwnerState<Value> = {
      entry: replacement,
      subscriptions: new Set<number>(),
      active: true,
    };
    const eviction = this.prepareEviction(expired);
    this.#entries.set(replacement.structuralKey, replacement);
    replacement.owners.add(owner);
    this.#ownerStates.add(owner);
    this.#acquires = incrementSaturated(this.#acquires);
    const handle = new ResourceCacheHandle(this, owner, RESOURCE_CACHE_HANDLE_TOKEN);
    const acquired: DispatchJob<Value> = {
      event: makeEvent(replacement, "acquired"),
      entryListeners: [],
      coordinatorListeners: [...this.#listeners.values()],
    };
    this.enqueueJobBatch([eviction.job, acquired]);
    this.cancelTimer(eviction.staleTimer);
    this.cancelTimer(eviction.retentionTimer);
    if (this.#disposed) throw new ResourceCacheDisposedError();
    this.assertOwner(owner);
    return handle;
  }

  private prepareEviction(entry: CacheEntry<Value>): PreparedEviction<Value> {
    if (this.#entries.get(entry.structuralKey) === entry) {
      this.#entries.delete(entry.structuralKey);
    }
    this.#publicKeys.delete(entry.key);
    entry.dead = true;
    const staleTimer = this.detachStaleTimer(entry);
    const retentionTimer = this.detachRetentionTimer(entry);
    entry.refreshing = false;
    entry.retained = false;
    entry.refreshTrigger = undefined;
    entry.retainedAtMs = undefined;
    entry.retainedUntilMs = undefined;
    this.#evictions = incrementSaturated(this.#evictions);
    const job: DispatchJob<Value> = {
      event: makeEvent(entry, "evicted"),
      entryListeners: [...entry.listeners.values()],
      coordinatorListeners: [...this.#listeners.values()],
    };
    entry.listeners.clear();
    entry.hasValue = false;
    entry.value = undefined;
    entry.diagnostic = undefined;
    entry.updatedAtMs = undefined;
    entry.staleAtMs = undefined;
    entry.stale = false;
    return { job, staleTimer, retentionTimer };
  }

  private evictEntry(entry: CacheEntry<Value>): void {
    const eviction = this.prepareEviction(entry);
    this.enqueueJob(
      eviction.job.event,
      eviction.job.entryListeners,
      eviction.job.coordinatorListeners,
    );
    this.cancelTimer(eviction.staleTimer);
    this.cancelTimer(eviction.retentionTimer);
  }

  private assertActive(): void {
    if (this.#disposed) throw new ResourceCacheDisposedError();
  }

  private allocateListenerId(): number {
    const id = this.#nextListenerId;
    if (id === undefined) {
      throw new ResourceCacheListenerLimitError("coordinator", Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER);
    }
    this.#nextListenerId = id === Number.MAX_SAFE_INTEGER ? undefined : id + 1;
    return id;
  }

  private allocateEntryKey(): string {
    // At most `size` consecutive identifiers can already be live. Wrapping is
    // therefore bounded by the configured live-entry capacity.
    for (let attempts = 0; attempts <= this.#entries.size; attempts += 1) {
      const sequence = this.#nextEntrySequence;
      this.#nextEntrySequence = sequence === Number.MAX_SAFE_INTEGER ? 1 : sequence + 1;
      const key = `resource:${sequence.toString().padStart(16, "0")}`;
      if (this.#publicKeys.has(key)) continue;
      this.#publicKeys.add(key);
      return key;
    }
    throw new ResourceCacheCapacityError(this.maxEntries, this.#entries.size);
  }

  private enqueueEntryEvent(entry: CacheEntry<Value>, type: ResourceCacheEventType): void {
    this.enqueueJob(
      makeEvent(entry, type),
      [...entry.listeners.values()],
      [...this.#listeners.values()],
    );
  }

  private assertMutationCanNotify(key: string, eventCount = 1): void {
    if (!this.#dispatching) return;
    const available = this.maxEventsPerDrain - this.#dispatchedInDrain - this.#eventQueue.length;
    if (eventCount <= available) return;
    this.#droppedEvents = incrementSaturated(this.#droppedEvents);
    this.recordDiagnostic(
      "event-drain-limit",
      "event-dispatch",
      key,
      "A cache mutation was rejected at the configured drain limit.",
    );
    throw new ResourceCacheEventDrainLimitError(key, this.maxEventsPerDrain);
  }

  private assertEventBatchCanNotify(key: string, eventCount: number): void {
    const alreadyCommitted = this.#dispatching
      ? this.#dispatchedInDrain + this.#eventQueue.length
      : this.#eventQueue.length;
    if (eventCount <= this.maxEventsPerDrain - alreadyCommitted) return;
    this.#droppedEvents = incrementSaturated(this.#droppedEvents);
    this.recordDiagnostic(
      "event-drain-limit",
      "event-dispatch",
      key,
      "A cache event batch was rejected at the configured drain limit.",
    );
    throw new ResourceCacheEventDrainLimitError(key, this.maxEventsPerDrain);
  }

  private enqueueJobBatch(jobs: readonly DispatchJob<Value>[]): void {
    if (jobs.length === 0) return;
    this.#eventQueue.push(...jobs);
    this.drainEvents();
  }

  private enqueueJob(
    event: ResourceCacheEntryEvent<Value>,
    entryListeners: readonly ResourceCacheListener<Value>[],
    coordinatorListeners: readonly ResourceCacheListener<Value>[],
  ): void {
    if (this.#dispatching && this.#dispatchedInDrain + this.#eventQueue.length >= this.maxEventsPerDrain) {
      this.#droppedEvents = incrementSaturated(this.#droppedEvents);
      this.recordDiagnostic(
        "event-drain-limit",
        "event-dispatch",
        event.key,
        "A reentrant cache event was dropped at the configured drain limit.",
      );
      return;
    }
    this.#eventQueue.push({ event, entryListeners, coordinatorListeners });
    this.drainEvents();
  }

  private drainEvents(): void {
    if (this.#dispatching || this.#eventQueue.length === 0) return;
    this.#dispatching = true;
    this.#dispatchedInDrain = 0;
    try {
      while (this.#eventQueue.length > 0) {
        if (this.#dispatchedInDrain >= this.maxEventsPerDrain) {
          const dropped = this.#eventQueue.length;
          this.#eventQueue.length = 0;
          for (let index = 0; index < dropped; index += 1) {
            this.#droppedEvents = incrementSaturated(this.#droppedEvents);
          }
          this.recordDiagnostic(
            "event-drain-limit",
            "event-dispatch",
            undefined,
            "Queued cache events were dropped at the configured drain limit.",
          );
          break;
        }
        const job = this.#eventQueue.shift()!;
        this.#dispatchedInDrain += 1;
        for (const listener of job.entryListeners) {
          this.invokeListener(listener, job.event, "entry-listener");
        }
        for (const listener of job.coordinatorListeners) {
          this.invokeListener(listener, job.event, "coordinator-listener");
        }
      }
    } finally {
      this.#dispatching = false;
      this.#dispatchedInDrain = 0;
    }
    this.drainDeferredTemporalCallbacks();
  }

  private invokeListener(
    listener: ResourceCacheListener<Value>,
    event: ResourceCacheEntryEvent<Value>,
    phase: "entry-listener" | "coordinator-listener",
  ): void {
    let result: unknown;
    try {
      result = listener(event);
    } catch {
      this.recordListenerFailure(phase, event.key);
      return;
    }

    let promise: Promise<void> | undefined;
    try {
      promise = assimilateListenerResult(result);
    } catch {
      this.recordListenerFailure(phase, event.key);
      return;
    }
    if (promise !== undefined) {
      void promise.then(undefined, () => this.recordListenerFailure(phase, event.key));
    }
  }

  private recordListenerFailure(
    phase: "entry-listener" | "coordinator-listener",
    key: string,
  ): void {
    this.#listenerFailures = incrementSaturated(this.#listenerFailures);
    this.recordDiagnostic(
      "listener-threw",
      phase,
      key,
      "A resource cache listener threw; the opaque failure was isolated.",
    );
  }

  private recordDiagnostic(
    code: ResourceCacheCoordinatorDiagnostic["code"],
    phase: ResourceCacheCoordinatorDiagnostic["phase"],
    key: string | undefined,
    message: string,
  ): void {
    const sequence = this.#nextDiagnosticSequence;
    if (sequence === undefined || this.maxDiagnostics === 0) {
      this.#diagnosticsDropped = incrementSaturated(this.#diagnosticsDropped);
      return;
    }
    this.#nextDiagnosticSequence = sequence === Number.MAX_SAFE_INTEGER ? undefined : sequence + 1;
    if (this.#diagnostics.length >= this.maxDiagnostics) {
      this.#diagnostics.shift();
      this.#diagnosticsDropped = incrementSaturated(this.#diagnosticsDropped);
    }
    const diagnostic: ResourceCacheCoordinatorDiagnostic = {
      sequence,
      code,
      phase,
      message,
      ...(key === undefined ? {} : { key }),
    };
    this.#diagnostics.push(Object.freeze(diagnostic));
  }
}

/** Creates an isolated resource cache coordinator; no singleton is retained. */
export function createResourceCacheCoordinator<Value = unknown>(
  options: ResourceCacheCoordinatorOptions = {},
): ResourceCacheCoordinator<Value> {
  return new ResourceCacheCoordinator<Value>(options);
}

class CanonicalWriter {
  readonly #parts: string[] = [];
  #bytes = 0;

  constructor(readonly maxBytes: number) {}

  append(value: string, path: string): void {
    if (value.length > this.maxBytes - this.#bytes) {
      throw new ResourceCacheKeyError(
        "max-key-bytes",
        `Structural resource key exceeds ${this.maxBytes} UTF-8 bytes.`,
        path,
      );
    }
    const bytes = TEXT_ENCODER.encode(value).byteLength;
    if (bytes > this.maxBytes - this.#bytes) {
      throw new ResourceCacheKeyError(
        "max-key-bytes",
        `Structural resource key exceeds ${this.maxBytes} UTF-8 bytes.`,
        path,
      );
    }
    this.#bytes += bytes;
    this.#parts.push(value);
  }

  finish(): string {
    return this.#parts.join("");
  }
}

function appendCanonical(value: unknown, path: string, depth: number, context: CanonicalContext): void {
  if (depth > context.limits.maxDepth) {
    throw new ResourceCacheKeyError(
      "max-depth",
      `Structural resource key exceeds depth ${context.limits.maxDepth}.`,
      path,
    );
  }
  context.nodes += 1;
  if (context.nodes > context.limits.maxNodes) {
    throw new ResourceCacheKeyError(
      "max-nodes",
      `Structural resource key exceeds ${context.limits.maxNodes} nodes.`,
      path,
    );
  }

  if (value === undefined) {
    context.writer.append("u", path);
    return;
  }
  if (value === null) {
    context.writer.append("n", path);
    return;
  }
  if (typeof value === "boolean") {
    context.writer.append(value ? "b1" : "b0", path);
    return;
  }
  if (typeof value === "string") {
    appendString(value, "s", path, context.writer);
    return;
  }
  if (typeof value === "number") {
    appendNumber(value, path, context.writer);
    return;
  }
  if (typeof value !== "object") {
    throw new ResourceCacheKeyError(
      "unsupported",
      `Structural resource keys do not support ${typeof value} values.`,
      path,
    );
  }
  if (context.ancestors.has(value)) {
    throw new ResourceCacheKeyError("cycle", "Structural resource key contains a cycle.", path);
  }
  context.ancestors.add(value);
  try {
    if (safeIsArray(value, path)) {
      appendArray(value, path, depth, context);
      return;
    }
    appendRecord(value, path, depth, context);
  } finally {
    context.ancestors.delete(value);
  }
}

function appendNumber(value: number, path: string, writer: CanonicalWriter): void {
  if (Number.isNaN(value)) {
    writer.append("dNaN", path);
  } else if (value === Number.POSITIVE_INFINITY) {
    writer.append("d+Inf", path);
  } else if (value === Number.NEGATIVE_INFINITY) {
    writer.append("d-Inf", path);
  } else if (Object.is(value, -0)) {
    writer.append("d-0", path);
  } else {
    writer.append(`d${value}`, path);
  }
}

function appendString(value: string, prefix: string, path: string, writer: CanonicalWriter): void {
  if (value.length > writer.maxBytes) {
    throw new ResourceCacheKeyError(
      "max-key-bytes",
      `Structural resource key exceeds ${writer.maxBytes} UTF-8 bytes.`,
      path,
    );
  }
  writer.append(prefix, path);
  writer.append(JSON.stringify(value), path);
}

function appendArray(
  value: unknown[],
  path: string,
  depth: number,
  context: CanonicalContext,
): void {
  if (safePrototype(value, path) !== Array.prototype) {
    throw new ResourceCacheKeyError(
      "invalid-shape",
      "Structural resource arrays must use Array.prototype.",
      path,
    );
  }
  const keys = safeOwnKeys(value, path);
  const lengthDescriptor = safeDescriptor(value, "length", `${path}.length`);
  if (
    !lengthDescriptor || !("value" in lengthDescriptor) || lengthDescriptor.enumerable ||
    typeof lengthDescriptor.value !== "number" || !Number.isSafeInteger(lengthDescriptor.value) ||
    lengthDescriptor.value < 0
  ) {
    throw new ResourceCacheKeyError("invalid-shape", "Structural resource array length is invalid.", path);
  }
  const length = lengthDescriptor.value;
  if (length > context.limits.maxContainerEntries) {
    throw new ResourceCacheKeyError(
      "max-container-entries",
      `Structural resource array exceeds ${context.limits.maxContainerEntries} entries.`,
      path,
    );
  }
  if (keys.length !== length + 1) {
    throw new ResourceCacheKeyError("invalid-shape", "Structural resource arrays must be dense.", path);
  }
  const descriptors = new Map<number, PropertyDescriptor>();
  for (const key of keys) {
    if (typeof key !== "string") {
      throw new ResourceCacheKeyError("unsupported", "Structural resource arrays cannot have symbol keys.", path);
    }
    if (key === "length") continue;
    if (!ARRAY_INDEX.test(key)) {
      throw new ResourceCacheKeyError(
        "invalid-shape",
        "Structural resource arrays cannot have non-index properties.",
        childPath(path, key),
      );
    }
    const index = Number(key);
    if (!Number.isSafeInteger(index) || index < 0 || index >= length || String(index) !== key) {
      throw new ResourceCacheKeyError(
        "invalid-shape",
        "Structural resource array index is invalid.",
        childPath(path, key),
      );
    }
    const descriptor = safeDescriptor(value, key, `${path}[${index}]`);
    assertEnumerableDataDescriptor(descriptor, `${path}[${index}]`);
    descriptors.set(index, descriptor);
  }
  if (descriptors.size !== length) {
    throw new ResourceCacheKeyError("invalid-shape", "Structural resource arrays must be dense.", path);
  }
  context.writer.append("a[", path);
  for (let index = 0; index < length; index += 1) {
    if (index > 0) context.writer.append(",", path);
    const descriptor = descriptors.get(index);
    if (!descriptor || !("value" in descriptor)) {
      throw new ResourceCacheKeyError(
        "invalid-shape",
        "Structural resource arrays must be dense.",
        `${path}[${index}]`,
      );
    }
    appendCanonical(descriptor.value, `${path}[${index}]`, depth + 1, context);
  }
  context.writer.append("]", path);
}

function appendRecord(
  value: object,
  path: string,
  depth: number,
  context: CanonicalContext,
): void {
  const prototype = safePrototype(value, path);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new ResourceCacheKeyError(
      "unsupported",
      "Structural resource keys support only plain objects.",
      path,
    );
  }
  const ownKeys = safeOwnKeys(value, path);
  if (ownKeys.length > context.limits.maxContainerEntries) {
    throw new ResourceCacheKeyError(
      "max-container-entries",
      `Structural resource object exceeds ${context.limits.maxContainerEntries} entries.`,
      path,
    );
  }
  const descriptors = new Map<string, PropertyDescriptor>();
  for (const key of ownKeys) {
    if (typeof key !== "string") {
      throw new ResourceCacheKeyError("unsupported", "Structural resource objects cannot have symbol keys.", path);
    }
    const propertyPath = childPath(path, key);
    const descriptor = safeDescriptor(value, key, propertyPath);
    assertEnumerableDataDescriptor(descriptor, propertyPath);
    descriptors.set(key, descriptor);
  }
  const keys = [...descriptors.keys()].sort(compareText);
  context.writer.append("o{", path);
  for (let index = 0; index < keys.length; index += 1) {
    if (index > 0) context.writer.append(",", path);
    const key = keys[index]!;
    appendString(key, "k", childPath(path, key), context.writer);
    context.writer.append(":", path);
    appendCanonical(descriptors.get(key)!.value, childPath(path, key), depth + 1, context);
  }
  context.writer.append("}", path);
}

function safePrototype(value: object, path: string): object | null {
  try {
    return Object.getPrototypeOf(value);
  } catch {
    throw new ResourceCacheKeyError("reflection", "Structural resource prototype is not inspectable.", path);
  }
}

function safeIsArray(value: object, path: string): value is unknown[] {
  try {
    return Array.isArray(value);
  } catch {
    throw new ResourceCacheKeyError("reflection", "Structural resource shape is not inspectable.", path);
  }
}

function safeOwnKeys(value: object, path: string): (string | symbol)[] {
  try {
    return Reflect.ownKeys(value);
  } catch {
    throw new ResourceCacheKeyError("reflection", "Structural resource keys are not inspectable.", path);
  }
}

function safeDescriptor(value: object, key: string, path: string): PropertyDescriptor | undefined {
  try {
    return Object.getOwnPropertyDescriptor(value, key);
  } catch {
    throw new ResourceCacheKeyError("reflection", "Structural resource descriptor is not inspectable.", path);
  }
}

function assertEnumerableDataDescriptor(
  descriptor: PropertyDescriptor | undefined,
  path: string,
): asserts descriptor is PropertyDescriptor & { value: unknown } {
  if (!descriptor) {
    throw new ResourceCacheKeyError("invalid-shape", "Structural resource property disappeared.", path);
  }
  if (!("value" in descriptor)) {
    throw new ResourceCacheKeyError("accessor", "Structural resource keys reject accessors.", path);
  }
  if (!descriptor.enumerable) {
    throw new ResourceCacheKeyError("invalid-shape", "Structural resource properties must be enumerable.", path);
  }
}

function resolveKeyLimits(limits: ResourceCacheKeyLimits | undefined): ResolvedResourceCacheKeyLimits {
  if (limits !== undefined && (limits === null || typeof limits !== "object" || Array.isArray(limits))) {
    throw new TypeError("Resource cache key limits must be an object.");
  }
  return Object.freeze({
    maxDepth: boundedInteger(
      limits?.maxDepth ?? DEFAULT_KEY_LIMITS.maxDepth,
      "keyLimits.maxDepth",
      0,
      HARD_LIMITS.maxDepth,
    ),
    maxNodes: boundedInteger(
      limits?.maxNodes ?? DEFAULT_KEY_LIMITS.maxNodes,
      "keyLimits.maxNodes",
      1,
      HARD_LIMITS.maxNodes,
    ),
    maxContainerEntries: boundedInteger(
      limits?.maxContainerEntries ?? DEFAULT_KEY_LIMITS.maxContainerEntries,
      "keyLimits.maxContainerEntries",
      0,
      HARD_LIMITS.maxContainerEntries,
    ),
    maxKeyBytes: boundedInteger(
      limits?.maxKeyBytes ?? DEFAULT_KEY_LIMITS.maxKeyBytes,
      "keyLimits.maxKeyBytes",
      1,
      HARD_LIMITS.maxKeyBytes,
    ),
  });
}

function boundedInteger(value: unknown, name: string, minimum: number, maximum: number): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw new ResourceCacheLimitError(name, value, minimum, maximum);
  }
  return value;
}

function validateStatus(status: ResourceCacheEntryStatus): ResourceCacheEntryStatus {
  if (!STATUSES.includes(status)) {
    throw new TypeError("Unsupported resource cache entry status.");
  }
  return status;
}

function allocateRevision<Value>(entry: CacheEntry<Value>): number {
  if (entry.revision === Number.MAX_SAFE_INTEGER) {
    throw new ResourceCacheRevisionExhaustedError(entry.key, entry.revision);
  }
  return entry.revision + 1;
}

function normalizeEntryDiagnostic(
  diagnostic: ResourceCacheEntryDiagnostic,
  maxText: number,
): Readonly<ResourceCacheEntryDiagnostic> {
  if (diagnostic === null || typeof diagnostic !== "object" || Array.isArray(diagnostic)) {
    throw new ResourceCacheDiagnosticError("Resource cache diagnostic must be a plain object.");
  }
  let prototype: object | null;
  let descriptors: PropertyDescriptorMap;
  try {
    prototype = Object.getPrototypeOf(diagnostic);
    descriptors = Object.getOwnPropertyDescriptors(diagnostic);
  } catch {
    throw new ResourceCacheDiagnosticError("Resource cache diagnostic is not safely inspectable.");
  }
  if (prototype !== Object.prototype && prototype !== null) {
    throw new ResourceCacheDiagnosticError("Resource cache diagnostic must be a plain object.");
  }
  const keys = Reflect.ownKeys(descriptors);
  if (
    keys.length !== 2 || keys.some((key) => typeof key !== "string") ||
    !keys.includes("code") || !keys.includes("message")
  ) {
    throw new ResourceCacheDiagnosticError("Resource cache diagnostic requires only code and message.");
  }
  const code = diagnosticField(descriptors.code, maxText);
  const message = diagnosticField(descriptors.message, maxText);
  return Object.freeze({ code, message });
}

function diagnosticField(
  descriptor: PropertyDescriptor | undefined,
  maxText: number,
): string {
  if (!descriptor?.enumerable || !("value" in descriptor) || typeof descriptor.value !== "string") {
    throw new ResourceCacheDiagnosticError("Resource cache diagnostic fields must be enumerable data strings.");
  }
  if (descriptor.value.length === 0 || descriptor.value.length > maxText) {
    throw new ResourceCacheDiagnosticError(
      `Resource cache diagnostic fields must contain between 1 and ${maxText} characters.`,
    );
  }
  return descriptor.value;
}

function normalizeSubscriptionOptions(options: ResourceCacheSubscriptionOptions): boolean {
  if (options === null || typeof options !== "object" || Array.isArray(options)) {
    throw new TypeError("Resource cache subscription options must be a plain object.");
  }
  let prototype: object | null;
  let descriptors: PropertyDescriptorMap;
  try {
    prototype = Object.getPrototypeOf(options);
    descriptors = Object.getOwnPropertyDescriptors(options);
  } catch {
    throw new TypeError("Resource cache subscription options are not safely inspectable.");
  }
  if (prototype !== Object.prototype && prototype !== null) {
    throw new TypeError("Resource cache subscription options must be a plain object.");
  }
  const keys = Reflect.ownKeys(descriptors);
  if (keys.some((key) => key !== "emitCurrent")) {
    throw new TypeError("Resource cache subscription options support only emitCurrent.");
  }
  const descriptor = descriptors.emitCurrent;
  if (descriptor === undefined) return false;
  if (!descriptor.enumerable || !("value" in descriptor) || typeof descriptor.value !== "boolean") {
    throw new TypeError("Resource cache emitCurrent must be an enumerable boolean data property.");
  }
  return descriptor.value;
}

function assimilateListenerResult(result: unknown): Promise<void> | undefined {
  if ((typeof result !== "object" || result === null) && typeof result !== "function") return undefined;
  const then = (result as { then?: unknown }).then;
  if (typeof then !== "function") return undefined;
  return new Promise<void>((resolve, reject) => {
    Reflect.apply(then, result, [resolve, reject]);
  });
}

function createResourceCacheTimerCallbackGate(
  callback: () => void,
): ResourceCacheTimerCallbackGate {
  let active = false;
  let pending = false;
  let callbackReference: (() => void) | undefined = callback;
  callback = NOOP_RESOURCE_CACHE_TIMER_CALLBACK;
  return Object.freeze({
    invoke: () => {
      const current = callbackReference;
      if (!current) return;
      if (!active) {
        pending = true;
        return;
      }
      callbackReference = undefined;
      current();
    },
    activate: () => {
      active = true;
    },
    takePending: () => {
      const current = callbackReference;
      if (!active || !pending || !current) return undefined;
      pending = false;
      callbackReference = undefined;
      return current;
    },
    deactivate: () => {
      active = false;
      pending = false;
      callbackReference = undefined;
    },
  });
}

function inspectEntry<Value>(entry: CacheEntry<Value>): ResourceCacheEntryInspection {
  const diagnostic = entry.diagnostic === undefined
    ? undefined
    : Object.freeze({ code: entry.diagnostic.code, message: entry.diagnostic.message });
  const inspection: ResourceCacheEntryInspection = {
    key: entry.key,
    status: entry.status,
    revision: entry.revision,
    owners: entry.owners.size,
    listeners: entry.listeners.size,
    hasValue: entry.hasValue,
    valueKind: entry.hasValue ? valueKind(entry.value) : "undefined",
    ...(diagnostic === undefined ? {} : { diagnostic }),
    ...(entry.policyEnabled ? { policy: inspectEntryPolicy(entry) } : {}),
  };
  return Object.freeze(inspection);
}

function inspectEntryPolicy<Value>(entry: CacheEntry<Value>): ResourceCacheEntryPolicyInspection {
  return Object.freeze({
    stale: entry.stale,
    refreshing: entry.refreshing,
    retained: entry.retained,
    ...(entry.updatedAtMs === undefined ? {} : { updatedAtMs: entry.updatedAtMs }),
    ...(entry.staleAtMs === undefined ? {} : { staleAtMs: entry.staleAtMs }),
    ...(entry.retainedAtMs === undefined ? {} : { retainedAtMs: entry.retainedAtMs }),
    ...(entry.retainedUntilMs === undefined ? {} : { retainedUntilMs: entry.retainedUntilMs }),
    ...(entry.refreshTrigger === undefined ? {} : { refreshTrigger: entry.refreshTrigger }),
  });
}

function makeEvent<Value>(entry: CacheEntry<Value>, type: ResourceCacheEventType): ResourceCacheEntryEvent<Value> {
  const inspection = inspectEntry(entry);
  const event: ResourceCacheEntryEvent<Value> = {
    ...inspection,
    type,
    ...(entry.hasValue ? { value: entry.value as Value } : {}),
  };
  return Object.freeze(event);
}

function cloneCoordinatorDiagnostic(
  diagnostic: ResourceCacheCoordinatorDiagnostic,
): ResourceCacheCoordinatorDiagnostic {
  return Object.freeze({
    sequence: diagnostic.sequence,
    code: diagnostic.code,
    phase: diagnostic.phase,
    message: diagnostic.message,
    ...(diagnostic.key === undefined ? {} : { key: diagnostic.key }),
  });
}

function valueKind(value: unknown): ResourceCacheValueKind {
  if (value === null) return "null";
  try {
    if (Array.isArray(value)) return "array";
  } catch {
    // Revoked proxies remain safely classifiable without exposing raw failures.
  }
  return typeof value;
}

function assertListener<Value>(listener: ResourceCacheListener<Value>): void {
  if (typeof listener !== "function") {
    throw new TypeError("Resource cache listener must be a function.");
  }
}

function incrementSaturated(value: number): number {
  return value === Number.MAX_SAFE_INTEGER ? value : value + 1;
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function childPath(parent: string, key: string): string {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(key) ? `${parent}.${key}` : `${parent}[${JSON.stringify(key)}]`;
}
