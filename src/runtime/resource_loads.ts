// Copyright 2023 Im-Beast. MIT license.

import {
  ResourceCacheCoordinator,
  type ResourceCacheEntryDiagnostic,
  type ResourceCacheEntryStatus,
  type ResourceCacheHandle,
  ResourceCacheRevisionExhaustedError,
} from "./resource_cache.ts";

/** How a load request interacts with an equivalent in-flight generation. */
export type ResourceLoadPolicy = "join" | "supersede" | "force-new";

/** Terminal and live states exposed by an individual load handle. */
export type ResourceLoadHandleStatus =
  | "pending"
  | "fulfilled"
  | "rejected"
  | "cancelled"
  | "superseded"
  | "coordinator-disposed";

/** Fixed request-snapshot limits used before a loader receives caller data. */
export interface ResourceLoadSnapshotLimits {
  /** Maximum plain-array/object nesting depth. Defaults to 32. */
  readonly maxDepth?: number;
  /** Maximum primitive and container nodes. Defaults to 4096. */
  readonly maxNodes?: number;
  /** Maximum own entries in any one array/object. Defaults to 1024. */
  readonly maxContainerEntries?: number;
}

/** Construction bounds for concurrent resource loading. */
export interface ResourceLoadCoordinatorOptions extends ResourceLoadSnapshotLimits {
  /** Maximum concurrently executing generations. Defaults to 1024. */
  readonly maxInFlightGenerations?: number;
  /** Maximum active handles across all generations. Defaults to 4096. */
  readonly maxActiveHandles?: number;
  /** Maximum joined handles on one generation. Defaults to 1024. */
  readonly maxHandlesPerGeneration?: number;
  /** Maximum generations returned by one inspection. Defaults to 256. */
  readonly maxInspectionGenerations?: number;
  /** Maximum retained diagnostics. Defaults to 64. */
  readonly maxDiagnostics?: number;
}

/** Per-call behavior. The object is descriptor-snapshotted before any mutation. */
export interface ResourceLoadOptions {
  /** Defaults to `join`. */
  readonly policy?: ResourceLoadPolicy;
  /** Cancels only the returned handle unless it is the last generation owner. */
  readonly signal?: AbortSignal;
}

/** Immutable context supplied exactly once to the selected loader. */
export interface ResourceLoaderContext<Request = unknown> {
  /** Opaque cache identifier that never contains request contents. */
  readonly key: string;
  /** Monotonic coordinator-local generation. */
  readonly generation: number;
  /** Deep-frozen plain-data snapshot of the first equivalent request. */
  readonly request: Request;
  /** Generation-owned cancellation signal. */
  readonly signal: AbortSignal;
}

/** One async producer for a resource generation. */
export type ResourceLoader<Request, Value> = (
  context: ResourceLoaderContext<Request>,
) => Value | PromiseLike<Value>;

/** Clone-safe state for an in-flight generation. */
export interface ResourceLoadGenerationInspection {
  readonly key: string;
  readonly generation: number;
  readonly policy: ResourceLoadPolicy;
  readonly handles: number;
  readonly loaderStarted: boolean;
  readonly publishable: boolean;
  readonly cacheRevision: number;
}

/** Bounded diagnostic categories; raw loader failures are never retained here. */
export type ResourceLoadDiagnosticCode =
  | "loader-rejected"
  | "publication-failed"
  | "stale-completion"
  | "cache-release-failed";

/** Immutable clone-safe diagnostic for one generation. */
export interface ResourceLoadDiagnostic {
  readonly sequence: number;
  readonly code: ResourceLoadDiagnosticCode;
  readonly key: string;
  readonly generation: number;
  readonly message: string;
}

/** Bounded, immutable, structured-clone-safe coordinator inspection. */
export interface ResourceLoadCoordinatorInspection {
  readonly disposed: boolean;
  readonly inFlightGenerations: number;
  readonly startingGenerations: number;
  readonly activeHandles: number;
  readonly maxInFlightGenerations: number;
  readonly maxActiveHandles: number;
  readonly maxHandlesPerGeneration: number;
  readonly maxInspectionGenerations: number;
  readonly maxDiagnostics: number;
  readonly snapshotLimits: Readonly<Required<ResourceLoadSnapshotLimits>>;
  readonly requests: number;
  readonly generationsStarted: number;
  readonly loadersInvoked: number;
  readonly joined: number;
  readonly supersededGenerations: number;
  readonly forceNewGenerations: number;
  readonly fulfilledHandles: number;
  readonly rejectedHandles: number;
  readonly cancelledHandles: number;
  readonly supersededHandles: number;
  readonly abortedGenerations: number;
  readonly staleCompletions: number;
  readonly diagnosticsDropped: number;
  readonly generationLimit: number;
  readonly omittedGenerations: number;
  readonly diagnosticLimit: number;
  readonly omittedDiagnostics: number;
  readonly generations: readonly ResourceLoadGenerationInspection[];
  readonly diagnostics: readonly ResourceLoadDiagnostic[];
}

/** Fixed-size state for one caller-owned load handle. */
export interface ResourceLoadHandleInspection {
  readonly key: string;
  readonly generation: number;
  readonly policy: ResourceLoadPolicy;
  readonly status: ResourceLoadHandleStatus;
}

/** Invalid coordinator or per-load configuration. */
export class ResourceLoadConfigurationError extends TypeError {
  readonly code = "RESOURCE_LOAD_CONFIGURATION";

  constructor(message: string) {
    super(message);
    this.name = "ResourceLoadConfigurationError";
  }
}

/** Strict request-snapshot failure. */
export class ResourceLoadRequestError extends TypeError {
  readonly code = "RESOURCE_LOAD_REQUEST";

  constructor(
    readonly reason:
      | "max-depth"
      | "max-nodes"
      | "max-container-entries"
      | "cycle"
      | "unsupported"
      | "accessor"
      | "invalid-shape"
      | "reflection",
    message: string,
    readonly path = "$",
  ) {
    super(message);
    this.name = "ResourceLoadRequestError";
  }
}

/** A configured concurrent-generation bound is exhausted. */
export class ResourceLoadCapacityError extends Error {
  readonly code = "RESOURCE_LOAD_CAPACITY";

  constructor(readonly limit: number, readonly count: number) {
    super(`Resource loads allow at most ${limit} in-flight generation(s).`);
    this.name = "ResourceLoadCapacityError";
  }
}

/** A per-generation or coordinator-wide handle bound is exhausted. */
export class ResourceLoadHandleLimitError extends Error {
  readonly code = "RESOURCE_LOAD_HANDLE_LIMIT";

  constructor(
    readonly scope: "generation" | "coordinator",
    readonly limit: number,
    readonly count: number,
  ) {
    super(`Resource load ${scope} handle limit ${limit} is exhausted.`);
    this.name = "ResourceLoadHandleLimitError";
  }
}

/** No further safe integer generation can be allocated. */
export class ResourceLoadGenerationExhaustedError extends Error {
  readonly code = "RESOURCE_LOAD_GENERATION_EXHAUSTED";

  constructor() {
    super("Resource load generation sequence is exhausted.");
    this.name = "ResourceLoadGenerationExhaustedError";
  }
}

/** A caller cancelled only its own joined handle. */
export class ResourceLoadCancelledError extends Error {
  readonly code = "RESOURCE_LOAD_CANCELLED";

  constructor(override readonly cause?: unknown) {
    super("Resource load handle was cancelled.", { cause });
    this.name = "ResourceLoadCancelledError";
  }
}

/** A newer `supersede` generation replaced an older one. */
export class ResourceLoadSupersededError extends Error {
  readonly code = "RESOURCE_LOAD_SUPERSEDED";

  constructor(readonly generation: number, readonly replacementGeneration: number) {
    super(`Resource load generation ${generation} was superseded by ${replacementGeneration}.`);
    this.name = "ResourceLoadSupersededError";
  }
}

/** The load coordinator no longer accepts work. */
export class ResourceLoadCoordinatorDisposedError extends Error {
  readonly code = "RESOURCE_LOAD_COORDINATOR_DISPOSED";

  constructor() {
    super("Resource load coordinator is disposed.");
    this.name = "ResourceLoadCoordinatorDisposedError";
  }
}

/** A successful loader value could not be atomically published to the cache. */
export class ResourceLoadPublicationError extends Error {
  readonly code = "RESOURCE_LOAD_PUBLICATION";

  constructor(override readonly cause?: unknown) {
    super("Resource loader completed, but its value could not be published.", { cause });
    this.name = "ResourceLoadPublicationError";
  }
}

interface ResolvedOptions {
  readonly maxInFlightGenerations: number;
  readonly maxActiveHandles: number;
  readonly maxHandlesPerGeneration: number;
  readonly maxInspectionGenerations: number;
  readonly maxDiagnostics: number;
  readonly snapshotLimits: Readonly<Required<ResourceLoadSnapshotLimits>>;
}

interface SnapshotContext {
  readonly limits: Readonly<Required<ResourceLoadSnapshotLimits>>;
  readonly ancestors: WeakSet<object>;
  nodes: number;
}

interface LoadOptionSnapshot {
  readonly policy: ResourceLoadPolicy;
  readonly signal?: AbortSignal;
}

interface AbortObservation {
  assertNotAborted(): void;
  activate(callback: (reason: unknown) => void): void;
  dispose(): void;
}

interface Generation<Value> {
  readonly structuralKey: string;
  readonly key: string;
  readonly generation: number;
  readonly policy: ResourceLoadPolicy;
  readonly publisher: ResourceCacheHandle<Value>;
  readonly controller: AbortController;
  readonly participants: Set<Participant<Value>>;
  readonly publicationEpoch: PublicationEpoch<Value>;
  cacheRevision: number;
  loaderStarted: boolean;
  publishable: boolean;
  active: boolean;
}

interface PublicationEpoch<Value> {
  readonly structuralKey: string;
  readonly baselineStatus: ResourceCacheEntryStatus;
  readonly baselineDiagnostic?: Readonly<ResourceCacheEntryDiagnostic>;
  readonly generations: Set<Generation<Value>>;
  revision: number;
  starters: number;
  transitionDepth: number;
  mutated: boolean;
  committed: boolean;
}

interface Participant<Value> {
  readonly key: string;
  readonly generation: number;
  readonly policy: ResourceLoadPolicy;
  readonly promise: Promise<Value>;
  readonly resolve: (value: Value | PromiseLike<Value>) => void;
  readonly reject: (reason?: unknown) => void;
  generationState?: Generation<Value>;
  abortObservation?: AbortObservation;
  status: ResourceLoadHandleStatus;
}

const RESOURCE_LOAD_HANDLE_TOKEN = Symbol("ResourceLoadHandle");
const POLICIES: readonly ResourceLoadPolicy[] = ["join", "supersede", "force-new"];
const ARRAY_INDEX = /^(?:0|[1-9][0-9]*)$/;
const ABORTED_GETTER = Object.getOwnPropertyDescriptor(AbortSignal.prototype, "aborted")?.get;
const ABORT_REASON_GETTER = Object.getOwnPropertyDescriptor(AbortSignal.prototype, "reason")?.get;
const ADD_ABORT_LISTENER = AbortSignal.prototype.addEventListener;
const REMOVE_ABORT_LISTENER = AbortSignal.prototype.removeEventListener;
const ABORT_CONTROLLER_ABORT = AbortController.prototype.abort;
const LOADER_NOT_STARTED = Symbol("ResourceLoaderNotStarted");
const MAX_PUBLICATION_ATTEMPTS = 4;
const DEFAULT_OPTIONS: ResolvedOptions = Object.freeze({
  maxInFlightGenerations: 1024,
  maxActiveHandles: 4096,
  maxHandlesPerGeneration: 1024,
  maxInspectionGenerations: 256,
  maxDiagnostics: 64,
  snapshotLimits: Object.freeze({
    maxDepth: 32,
    maxNodes: 4096,
    maxContainerEntries: 1024,
  }),
});
const HARD_LIMITS = Object.freeze({
  maxInFlightGenerations: 65_536,
  maxActiveHandles: 1_000_000,
  maxHandlesPerGeneration: 65_536,
  maxInspectionGenerations: 65_536,
  maxDiagnostics: 4096,
  maxDepth: 256,
  maxNodes: 1_000_000,
  maxContainerEntries: 100_000,
});

/** One independently cancellable ownership claim on an in-flight load. */
export class ResourceLoadHandle<Value = unknown> {
  readonly #coordinator: ResourceLoadCoordinator<Value>;
  readonly #participant: Participant<Value>;

  /** @internal Load handles can only be created by their coordinator. */
  constructor(
    coordinator: ResourceLoadCoordinator<Value>,
    participant: unknown,
    token: symbol,
  ) {
    if (token !== RESOURCE_LOAD_HANDLE_TOKEN) {
      throw new TypeError("Resource load handles cannot be constructed directly.");
    }
    this.#coordinator = coordinator;
    this.#participant = participant as Participant<Value>;
  }

  get key(): string {
    return this.#participant.key;
  }

  get generation(): number {
    return this.#participant.generation;
  }

  get policy(): ResourceLoadPolicy {
    return this.#participant.policy;
  }

  get status(): ResourceLoadHandleStatus {
    return this.#participant.status;
  }

  get settled(): boolean {
    return this.#participant.status !== "pending";
  }

  /** The loader result; joined non-cancelled handles receive the same settlement. */
  get promise(): Promise<Value> {
    return this.#participant.promise;
  }

  /** Cancels only this handle, aborting the loader only when no handles remain. */
  cancel(reason?: unknown): boolean {
    return this.#coordinator.cancelParticipant(this.#participant, reason);
  }

  /** Alias for idempotent cancellation. */
  dispose(reason?: unknown): boolean {
    return this.cancel(reason);
  }

  /** Returns a fresh immutable, fixed-size handle snapshot. */
  inspect(): ResourceLoadHandleInspection {
    return Object.freeze({
      key: this.#participant.key,
      generation: this.#participant.generation,
      policy: this.#participant.policy,
      status: this.#participant.status,
    });
  }
}

/**
 * Bounded concurrent-load coordinator layered over a caller-owned resource cache.
 *
 * `join` shares the newest equivalent generation, `supersede` aborts older
 * generations, and `force-new` runs concurrently while preventing every older
 * completion from publishing. The cache itself is never disposed here.
 */
export class ResourceLoadCoordinator<Value = unknown> {
  readonly cache: ResourceCacheCoordinator<Value>;
  readonly maxInFlightGenerations: number;
  readonly maxActiveHandles: number;
  readonly maxHandlesPerGeneration: number;
  readonly maxInspectionGenerations: number;
  readonly maxDiagnostics: number;
  readonly snapshotLimits: Readonly<Required<ResourceLoadSnapshotLimits>>;

  readonly #generations = new Map<number, Generation<Value>>();
  readonly #generationsByKey = new Map<string, Set<Generation<Value>>>();
  readonly #latestByKey = new Map<string, Generation<Value>>();
  readonly #publicationEpochs = new Map<string, PublicationEpoch<Value>>();
  readonly #participants = new WeakSet<object>();
  readonly #diagnostics: ResourceLoadDiagnostic[] = [];
  #disposed = false;
  #startingGenerations = 0;
  #activeHandles = 0;
  #nextGeneration = 1;
  #nextDiagnosticSequence = 1;
  #requests = 0;
  #generationsStarted = 0;
  #loadersInvoked = 0;
  #joined = 0;
  #supersededGenerations = 0;
  #forceNewGenerations = 0;
  #fulfilledHandles = 0;
  #rejectedHandles = 0;
  #cancelledHandles = 0;
  #supersededHandles = 0;
  #abortedGenerations = 0;
  #staleCompletions = 0;
  #diagnosticsDropped = 0;

  constructor(
    cache: ResourceCacheCoordinator<Value>,
    options: ResourceLoadCoordinatorOptions = {},
  ) {
    if (!(cache instanceof ResourceCacheCoordinator)) {
      throw new ResourceLoadConfigurationError("Resource loads require a ResourceCacheCoordinator.");
    }
    if (cache.disposed) {
      throw new ResourceLoadConfigurationError("Resource loads require an active resource cache.");
    }
    const resolved = resolveCoordinatorOptions(options);
    this.cache = cache;
    this.maxInFlightGenerations = resolved.maxInFlightGenerations;
    this.maxActiveHandles = resolved.maxActiveHandles;
    this.maxHandlesPerGeneration = resolved.maxHandlesPerGeneration;
    this.maxInspectionGenerations = resolved.maxInspectionGenerations;
    this.maxDiagnostics = resolved.maxDiagnostics;
    this.snapshotLimits = resolved.snapshotLimits;
  }

  get disposed(): boolean {
    return this.#disposed;
  }

  get inFlightGenerations(): number {
    return this.#generations.size;
  }

  /** Starts or joins one structural resource load. */
  load<Request>(
    request: Request,
    loader: ResourceLoader<Request, Value>,
    options: ResourceLoadOptions = {},
  ): ResourceLoadHandle<Value> {
    this.assertActive();
    if (typeof loader !== "function") {
      throw new ResourceLoadConfigurationError("Resource loader must be a function.");
    }
    const loadOptions = snapshotLoadOptions(options);
    const abortObservation = observeAbort(loadOptions.signal);
    try {
      const requestSnapshot = snapshotRequest(request, this.snapshotLimits) as Request;
      abortObservation.assertNotAborted();
      this.assertActive();
      const structuralKey = this.cache.keyOf(requestSnapshot);
      abortObservation.assertNotAborted();
      this.assertActive();
      this.#requests = incrementSaturated(this.#requests);

      if (loadOptions.policy === "join") {
        const current = this.#latestByKey.get(structuralKey);
        if (current?.active) {
          const handle = this.attachParticipant(current, loadOptions.policy, abortObservation);
          this.#joined = incrementSaturated(this.#joined);
          return handle;
        }
      }

      return this.startGeneration(
        structuralKey,
        requestSnapshot,
        loader,
        loadOptions.policy,
        abortObservation,
      );
    } catch (error) {
      abortObservation.dispose();
      throw error;
    }
  }

  /** Returns a bounded immutable view without values, loaders, signals, or errors. */
  inspect(): ResourceLoadCoordinatorInspection {
    const allGenerations = [...this.#generations.values()].sort((left, right) => left.generation - right.generation);
    const generations = allGenerations.slice(0, this.maxInspectionGenerations).map((generation) =>
      Object.freeze({
        key: generation.key,
        generation: generation.generation,
        policy: generation.policy,
        handles: generation.participants.size,
        loaderStarted: generation.loaderStarted,
        publishable: generation.publishable,
        cacheRevision: generation.cacheRevision,
      })
    );
    const diagnosticStart = Math.max(0, this.#diagnostics.length - this.maxDiagnostics);
    const diagnostics = this.#diagnostics.slice(diagnosticStart).map((diagnostic) => Object.freeze({ ...diagnostic }));
    return Object.freeze({
      disposed: this.#disposed,
      inFlightGenerations: this.#generations.size,
      startingGenerations: this.#startingGenerations,
      activeHandles: this.#activeHandles,
      maxInFlightGenerations: this.maxInFlightGenerations,
      maxActiveHandles: this.maxActiveHandles,
      maxHandlesPerGeneration: this.maxHandlesPerGeneration,
      maxInspectionGenerations: this.maxInspectionGenerations,
      maxDiagnostics: this.maxDiagnostics,
      snapshotLimits: Object.freeze({ ...this.snapshotLimits }),
      requests: this.#requests,
      generationsStarted: this.#generationsStarted,
      loadersInvoked: this.#loadersInvoked,
      joined: this.#joined,
      supersededGenerations: this.#supersededGenerations,
      forceNewGenerations: this.#forceNewGenerations,
      fulfilledHandles: this.#fulfilledHandles,
      rejectedHandles: this.#rejectedHandles,
      cancelledHandles: this.#cancelledHandles,
      supersededHandles: this.#supersededHandles,
      abortedGenerations: this.#abortedGenerations,
      staleCompletions: this.#staleCompletions,
      diagnosticsDropped: this.#diagnosticsDropped,
      generationLimit: this.maxInspectionGenerations,
      omittedGenerations: allGenerations.length - generations.length,
      diagnosticLimit: this.maxDiagnostics,
      omittedDiagnostics: this.#diagnostics.length - diagnostics.length,
      generations: Object.freeze(generations),
      diagnostics: Object.freeze(diagnostics),
    });
  }

  /** Cancels every live handle/generation without disposing the caller-owned cache. */
  dispose(): boolean {
    if (this.#disposed) return false;
    this.#disposed = true;
    const error = new ResourceLoadCoordinatorDisposedError();
    const generations = [...this.#generations.values()].sort((left, right) => right.generation - left.generation);
    for (const generation of generations) {
      this.terminateGeneration(generation, "coordinator-disposed", error, true, true);
    }
    this.#latestByKey.clear();
    this.#generationsByKey.clear();
    this.#generations.clear();
    return true;
  }

  /** @internal Cancels one coordinator-created participant. */
  cancelParticipant(participant: unknown, reason?: unknown): boolean {
    if (participant === null || typeof participant !== "object" || !this.#participants.has(participant)) {
      throw new TypeError("Resource load participant was not created by this coordinator.");
    }
    const state = participant as Participant<Value>;
    if (state.status !== "pending") return false;
    const generation = state.generationState;
    const error = new ResourceLoadCancelledError(reason);
    this.settleParticipant(state, "cancelled", error);
    this.#cancelledHandles = incrementSaturated(this.#cancelledHandles);
    if (generation?.active && generation.participants.size === 0) {
      this.terminateGeneration(generation, "cancelled", error, true, true);
    }
    return true;
  }

  private startGeneration<Request>(
    structuralKey: string,
    request: Request,
    loader: ResourceLoader<Request, Value>,
    policy: ResourceLoadPolicy,
    abortObservation: AbortObservation,
  ): ResourceLoadHandle<Value> {
    this.assertGenerationCapacity();
    this.assertCoordinatorHandleCapacity();
    const generationNumber = this.allocateGeneration();
    this.#startingGenerations += 1;
    let publisher: ResourceCacheHandle<Value> | undefined;
    let publicationEpoch: PublicationEpoch<Value> | undefined;
    let starterClaimed = false;
    try {
      publisher = this.cache.acquire(request);
      abortObservation.assertNotAborted();
      this.assertActive();

      // An `acquired` listener may have reentered and installed the generation
      // this join should share. Detect it before transitioning the cache: that
      // transition would otherwise invalidate the inner generation's revision.
      const acquiredLatest = this.#latestByKey.get(structuralKey);
      if (policy === "join" && acquiredLatest?.active) {
        this.safeReleasePublisher(publisher, generationNumber);
        publisher = undefined;
        const handle = this.attachParticipant(acquiredLatest, policy, abortObservation);
        this.#joined = incrementSaturated(this.#joined);
        return handle;
      }

      // Cache acquisition dispatches caller-owned listeners synchronously, so
      // revalidate capacity after returning from that boundary as well.
      this.assertCoordinatorHandleCapacity();
      publicationEpoch = this.claimPublicationEpoch(structuralKey, publisher);
      starterClaimed = true;
      const acquiredNewerGeneration = acquiredLatest?.active &&
        acquiredLatest.generation > generationNumber;
      if (!acquiredNewerGeneration) {
        this.transitionPublicationEpoch(publicationEpoch, publisher);
      }
      abortObservation.assertNotAborted();
      this.assertActive();

      // A cache listener may have reentered and started a newer generation.
      // A `join` caller attaches to that generation rather than invoking a
      // duplicate loader after returning from the cache boundary.
      const reentrantLatest = this.#latestByKey.get(structuralKey);
      if (policy === "join" && reentrantLatest?.active) {
        this.finishPublicationStarter(publicationEpoch, publisher, true);
        starterClaimed = false;
        this.safeReleasePublisher(publisher, generationNumber);
        publisher = undefined;
        const handle = this.attachParticipant(reentrantLatest, policy, abortObservation);
        this.#joined = incrementSaturated(this.#joined);
        return handle;
      }

      const generation: Generation<Value> = {
        structuralKey,
        key: publisher.key,
        generation: generationNumber,
        policy,
        publisher,
        controller: new AbortController(),
        participants: new Set(),
        publicationEpoch,
        cacheRevision: publicationEpoch.revision,
        loaderStarted: false,
        publishable: false,
        active: true,
      };
      this.registerGeneration(generation);
      starterClaimed = false;
      publisher = undefined;
      let handle: ResourceLoadHandle<Value>;
      try {
        handle = this.attachParticipant(generation, policy, abortObservation);
      } catch (error) {
        this.terminateGeneration(generation, "rejected", error, true, true);
        throw error;
      }
      this.#generationsStarted = incrementSaturated(this.#generationsStarted);
      if (policy === "force-new") {
        this.#forceNewGenerations = incrementSaturated(this.#forceNewGenerations);
      }
      const superseding = this.#latestByKey.get(structuralKey);
      if (
        superseding?.active && superseding !== generation &&
        superseding.generation > generation.generation && superseding.policy === "supersede"
      ) {
        const error = new ResourceLoadSupersededError(generation.generation, superseding.generation);
        this.#supersededGenerations = incrementSaturated(this.#supersededGenerations);
        this.terminateGeneration(generation, "superseded", error, true, false);
        return handle;
      }
      if (policy === "supersede") this.supersedeOlderGenerations(generation);
      this.scheduleLoader(generation, request, loader);
      return handle;
    } catch (error) {
      if (starterClaimed && publicationEpoch && publisher) {
        this.finishPublicationStarter(publicationEpoch, publisher, true);
      }
      if (publisher) this.safeReleasePublisher(publisher, generationNumber);
      throw error;
    } finally {
      this.#startingGenerations -= 1;
    }
  }

  private registerGeneration(generation: Generation<Value>): void {
    const publicationEpoch = generation.publicationEpoch;
    if (publicationEpoch.starters <= 0) {
      throw new ResourceLoadConfigurationError("Resource load publication epoch lost its starter claim.");
    }
    publicationEpoch.starters -= 1;
    publicationEpoch.generations.add(generation);
    const siblings = this.#generationsByKey.get(generation.structuralKey) ?? new Set<Generation<Value>>();
    if (!this.#generationsByKey.has(generation.structuralKey)) {
      this.#generationsByKey.set(generation.structuralKey, siblings);
    }
    siblings.add(generation);
    this.#generations.set(generation.generation, generation);
    const latest = this.#latestByKey.get(generation.structuralKey);
    if (!latest || latest.generation < generation.generation) {
      if (latest) latest.publishable = false;
      generation.publishable = !publicationEpoch.committed;
      this.#latestByKey.set(generation.structuralKey, generation);
    }
  }

  private claimPublicationEpoch(
    structuralKey: string,
    publisher: ResourceCacheHandle<Value>,
  ): PublicationEpoch<Value> {
    const observed = publisher.inspect();
    let publicationEpoch = this.#publicationEpochs.get(structuralKey);
    if (
      publicationEpoch &&
      (publicationEpoch.committed || observed.revision !== publicationEpoch.revision)
    ) {
      this.commitPublicationEpoch(publicationEpoch);
      publicationEpoch = undefined;
    }
    if (!publicationEpoch) {
      publicationEpoch = {
        structuralKey,
        baselineStatus: observed.status,
        ...(observed.diagnostic === undefined ? {} : { baselineDiagnostic: Object.freeze({ ...observed.diagnostic }) }),
        generations: new Set(),
        revision: observed.revision,
        starters: 0,
        transitionDepth: 0,
        mutated: false,
        committed: false,
      };
      this.#publicationEpochs.set(structuralKey, publicationEpoch);
    }
    publicationEpoch.starters += 1;
    return publicationEpoch;
  }

  private transitionPublicationEpoch(
    publicationEpoch: PublicationEpoch<Value>,
    publisher: ResourceCacheHandle<Value>,
  ): void {
    const previousRevision = publicationEpoch.revision;
    // A successful generation needs one revision for `loading` and another
    // for its terminal publication. Reject before mutating when that pair can
    // no longer be allocated, so recovery never strands an entry in loading.
    if (previousRevision > Number.MAX_SAFE_INTEGER - 2) {
      throw new ResourceCacheRevisionExhaustedError(publisher.key, previousRevision);
    }
    const reservedRevision = previousRevision + 1;
    const previouslyMutated = publicationEpoch.mutated;
    publicationEpoch.revision = reservedRevision;
    publicationEpoch.mutated = true;
    publicationEpoch.transitionDepth += 1;
    let loadingRevision: number;
    try {
      loadingRevision = publisher.transition("loading").revision;
    } catch (error) {
      if (publicationEpoch.revision === reservedRevision) {
        publicationEpoch.revision = previousRevision;
        publicationEpoch.mutated = previouslyMutated;
      }
      throw error;
    } finally {
      publicationEpoch.transitionDepth -= 1;
    }
    publicationEpoch.revision = Math.max(publicationEpoch.revision, loadingRevision);
    let observedRevision: number;
    try {
      observedRevision = publisher.inspect().revision;
    } catch {
      this.commitPublicationEpoch(publicationEpoch);
      return;
    }
    if (observedRevision !== publicationEpoch.revision) {
      this.commitPublicationEpoch(publicationEpoch);
      for (const generation of publicationEpoch.generations) generation.publishable = false;
      return;
    }
    const latest = this.#latestByKey.get(publicationEpoch.structuralKey);
    if (latest?.active && latest.publicationEpoch === publicationEpoch && latest.publishable) {
      latest.cacheRevision = publicationEpoch.revision;
    }
  }

  private finishPublicationStarter(
    publicationEpoch: PublicationEpoch<Value>,
    publisher: ResourceCacheHandle<Value>,
    recover: boolean,
  ): void {
    if (publicationEpoch.starters <= 0) {
      throw new ResourceLoadConfigurationError("Resource load publication epoch starter underflow.");
    }
    publicationEpoch.starters -= 1;
    if (recover) this.recoverPublicationEpoch(publicationEpoch, publisher);
    else this.finishPublicationEpoch(publicationEpoch);
  }

  private recoverPublicationEpoch(
    publicationEpoch: PublicationEpoch<Value>,
    publisher: ResourceCacheHandle<Value>,
  ): void {
    if (publicationEpoch.committed) {
      this.finishPublicationEpoch(publicationEpoch);
      return;
    }
    // A synchronous loading listener can cancel a generation before the
    // outer transition returns its newly committed revision. That starter owns
    // the unseen revision; defer promotion/rollback until its frame registers
    // a generation or performs setup cleanup with transitionDepth back at zero.
    if (publicationEpoch.transitionDepth > 0) return;
    const active = [...publicationEpoch.generations]
      .filter((generation) => generation.active)
      .sort((left, right) => right.generation - left.generation);
    if (active.length > 0) {
      let observedRevision: number;
      try {
        observedRevision = publisher.inspect().revision;
      } catch {
        this.commitPublicationEpoch(publicationEpoch);
        for (const generation of active) generation.publishable = false;
        return;
      }
      if (observedRevision !== publicationEpoch.revision) {
        this.commitPublicationEpoch(publicationEpoch);
        for (const generation of active) generation.publishable = false;
        return;
      }
      const promoted = active[0]!;
      for (const generation of active) generation.publishable = generation === promoted;
      promoted.cacheRevision = publicationEpoch.revision;
      this.#latestByKey.set(publicationEpoch.structuralKey, promoted);
      return;
    }
    if (publicationEpoch.starters > 0) return;

    this.commitPublicationEpoch(publicationEpoch);
    if (!publicationEpoch.mutated) return;
    try {
      const current = publisher.inspect();
      if (current.revision === publicationEpoch.revision) {
        publisher.transition(
          publicationEpoch.baselineStatus,
          publicationEpoch.baselineDiagnostic,
        );
      }
    } catch {
      // Cache disposal or a hostile listener cannot make the abandoned loading
      // state coordinator-owned again; cleanup remains terminal.
    }
  }

  private finishPublicationEpoch(publicationEpoch: PublicationEpoch<Value>): void {
    if (publicationEpoch.generations.size > 0 || publicationEpoch.starters > 0) return;
    this.commitPublicationEpoch(publicationEpoch);
  }

  private commitPublicationEpoch(publicationEpoch: PublicationEpoch<Value>): void {
    publicationEpoch.committed = true;
    if (this.#publicationEpochs.get(publicationEpoch.structuralKey) === publicationEpoch) {
      this.#publicationEpochs.delete(publicationEpoch.structuralKey);
    }
  }

  private attachParticipant(
    generation: Generation<Value>,
    policy: ResourceLoadPolicy,
    abortObservation: AbortObservation,
  ): ResourceLoadHandle<Value> {
    if (!generation.active) throw new ResourceLoadCoordinatorDisposedError();
    if (generation.participants.size >= this.maxHandlesPerGeneration) {
      throw new ResourceLoadHandleLimitError(
        "generation",
        this.maxHandlesPerGeneration,
        generation.participants.size,
      );
    }
    this.assertCoordinatorHandleCapacity();
    const deferred = createDeferred<Value>();
    const participant: Participant<Value> = {
      key: generation.key,
      generation: generation.generation,
      policy,
      promise: deferred.promise,
      resolve: deferred.resolve,
      reject: deferred.reject,
      generationState: generation,
      abortObservation,
      status: "pending",
    };
    generation.participants.add(participant);
    this.#participants.add(participant);
    this.#activeHandles += 1;
    const handle = new ResourceLoadHandle(this, participant, RESOURCE_LOAD_HANDLE_TOKEN);
    abortObservation.activate((reason) => {
      try {
        this.cancelParticipant(participant, reason);
      } catch {
        // Abort dispatch must never leak a cache/listener cleanup failure.
      }
    });
    return handle;
  }

  private supersedeOlderGenerations(replacement: Generation<Value>): void {
    const siblings = this.#generationsByKey.get(replacement.structuralKey);
    if (!siblings) return;
    const older = [...siblings]
      .filter((generation) => generation !== replacement && generation.generation < replacement.generation)
      .sort((left, right) => left.generation - right.generation);
    for (const generation of older) {
      const error = new ResourceLoadSupersededError(generation.generation, replacement.generation);
      this.#supersededGenerations = incrementSaturated(this.#supersededGenerations);
      this.terminateGeneration(generation, "superseded", error, true, false);
    }
  }

  private scheduleLoader<Request>(
    generation: Generation<Value>,
    request: Request,
    loader: ResourceLoader<Request, Value>,
  ): void {
    const context = Object.freeze({
      key: generation.key,
      generation: generation.generation,
      request,
      signal: generation.controller.signal,
    });
    void Promise.resolve()
      .then(() => {
        if (!generation.active) return LOADER_NOT_STARTED;
        generation.loaderStarted = true;
        this.#loadersInvoked = incrementSaturated(this.#loadersInvoked);
        return loader(context);
      })
      .then(
        (value) => {
          if (value !== LOADER_NOT_STARTED) this.fulfillGeneration(generation, value);
        },
        (error) => this.rejectGeneration(generation, error),
      );
  }

  private fulfillGeneration(generation: Generation<Value>, value: Value): void {
    if (!generation.active) {
      this.recordStaleCompletion(generation);
      return;
    }
    let recoverCache = false;
    if (generation.publishable) {
      try {
        for (let attempt = 0; attempt < MAX_PUBLICATION_ATTEMPTS; attempt += 1) {
          const expectedRevision = generation.cacheRevision;
          const published = generation.publisher.setIfRevision(
            expectedRevision,
            value,
            "ready",
          );
          if (published !== undefined) {
            generation.cacheRevision = published.revision;
            this.commitPublicationEpoch(generation.publicationEpoch);
            break;
          }
          const repromoted = generation.active && generation.publishable &&
            !generation.publicationEpoch.committed &&
            generation.cacheRevision !== expectedRevision;
          if (repromoted && attempt + 1 < MAX_PUBLICATION_ATTEMPTS) continue;
          this.recordStaleCompletion(generation);
          if (repromoted) recoverCache = true;
          else if (generation.publishable) this.commitPublicationEpoch(generation.publicationEpoch);
          break;
        }
      } catch (error) {
        if (!generation.active) {
          this.recordStaleCompletion(generation);
          return;
        }
        this.recordDiagnostic(
          generation,
          "publication-failed",
          "A completed loader value could not be published to the cache.",
        );
        this.terminateGeneration(
          generation,
          "rejected",
          new ResourceLoadPublicationError(error),
          false,
          true,
        );
        return;
      }
    } else {
      this.recordStaleCompletion(generation);
    }
    this.terminateGeneration(generation, "fulfilled", value, false, recoverCache);
  }

  private rejectGeneration(generation: Generation<Value>, error: unknown): void {
    if (!generation.active) {
      this.recordStaleCompletion(generation);
      return;
    }
    let recoverCache = false;
    if (generation.publishable) {
      try {
        const current = generation.publisher.inspect();
        if (current.revision === generation.cacheRevision) {
          const updated = generation.publisher.transition("error", {
            code: "loader-rejected",
            message: "Resource loader rejected.",
          });
          generation.cacheRevision = updated.revision;
          this.commitPublicationEpoch(generation.publicationEpoch);
        } else {
          this.recordStaleCompletion(generation);
          if (generation.publishable) this.commitPublicationEpoch(generation.publicationEpoch);
        }
      } catch {
        // Loader rejection remains authoritative for caller settlement even if
        // diagnostic publication is unavailable during cache teardown.
        recoverCache = generation.publishable && !generation.publicationEpoch.committed;
      }
    } else {
      this.recordStaleCompletion(generation);
    }
    this.recordDiagnostic(
      generation,
      "loader-rejected",
      "A resource loader rejected; the opaque failure was delivered to its handles.",
    );
    this.terminateGeneration(generation, "rejected", error, false, recoverCache);
  }

  private terminateGeneration(
    generation: Generation<Value>,
    status: Exclude<ResourceLoadHandleStatus, "pending">,
    settlement: unknown,
    abort: boolean,
    recoverCache: boolean,
  ): void {
    if (!generation.active) return;
    generation.active = false;
    generation.publishable = false;
    this.#generations.delete(generation.generation);
    generation.publicationEpoch.generations.delete(generation);
    const siblings = this.#generationsByKey.get(generation.structuralKey);
    siblings?.delete(generation);
    if (siblings?.size === 0) this.#generationsByKey.delete(generation.structuralKey);
    if (this.#latestByKey.get(generation.structuralKey) === generation) {
      this.#latestByKey.delete(generation.structuralKey);
    }
    const participants = [...generation.participants];
    for (const participant of participants) {
      this.settleParticipant(participant, status, settlement);
      if (status === "fulfilled") this.#fulfilledHandles = incrementSaturated(this.#fulfilledHandles);
      else if (status === "rejected") this.#rejectedHandles = incrementSaturated(this.#rejectedHandles);
      else if (status === "superseded") {
        this.#supersededHandles = incrementSaturated(this.#supersededHandles);
      }
    }
    if (abort) {
      this.#abortedGenerations = incrementSaturated(this.#abortedGenerations);
      try {
        Reflect.apply(ABORT_CONTROLLER_ABORT, generation.controller, [settlement]);
      } catch {
        // The controller is coordinator-owned; a host failure cannot undo the
        // already-committed terminal state.
      }
    }
    // Caller-owned cache and abort listeners are synchronous. Publish every
    // terminal handle state before either callback boundary so reentrant
    // cancellation cannot steal the coordinator's chosen terminal reason.
    if (recoverCache) {
      this.recoverPublicationEpoch(generation.publicationEpoch, generation.publisher);
    } else {
      this.finishPublicationEpoch(generation.publicationEpoch);
    }
    this.safeReleasePublisher(generation.publisher, generation.generation);
  }

  private settleParticipant(
    participant: Participant<Value>,
    status: Exclude<ResourceLoadHandleStatus, "pending">,
    settlement: unknown,
  ): void {
    if (participant.status !== "pending") return;
    participant.status = status;
    participant.generationState?.participants.delete(participant);
    participant.generationState = undefined;
    participant.abortObservation?.dispose();
    participant.abortObservation = undefined;
    this.#activeHandles -= 1;
    if (status === "fulfilled") participant.resolve(settlement as Value);
    else participant.reject(settlement);
  }

  private safeReleasePublisher(publisher: ResourceCacheHandle<Value>, generation: number): void {
    try {
      publisher.release();
    } catch {
      this.recordDiagnosticByFields(
        publisher.key,
        generation,
        "cache-release-failed",
        "A cache publisher could not be released during load cleanup.",
      );
    }
  }

  private recordStaleCompletion(generation: Generation<Value>): void {
    this.#staleCompletions = incrementSaturated(this.#staleCompletions);
    this.recordDiagnostic(
      generation,
      "stale-completion",
      "A stale resource completion was settled without publishing.",
    );
  }

  private recordDiagnostic(
    generation: Generation<Value>,
    code: ResourceLoadDiagnosticCode,
    message: string,
  ): void {
    this.recordDiagnosticByFields(generation.key, generation.generation, code, message);
  }

  private recordDiagnosticByFields(
    key: string,
    generation: number,
    code: ResourceLoadDiagnosticCode,
    message: string,
  ): void {
    if (this.maxDiagnostics === 0) {
      this.#diagnosticsDropped = incrementSaturated(this.#diagnosticsDropped);
      return;
    }
    if (this.#diagnostics.length === this.maxDiagnostics) {
      this.#diagnostics.shift();
      this.#diagnosticsDropped = incrementSaturated(this.#diagnosticsDropped);
    }
    this.#diagnostics.push(Object.freeze({
      sequence: this.#nextDiagnosticSequence,
      code,
      key,
      generation,
      message,
    }));
    this.#nextDiagnosticSequence = incrementSaturated(this.#nextDiagnosticSequence);
  }

  private assertActive(): void {
    if (this.#disposed) throw new ResourceLoadCoordinatorDisposedError();
    if (this.cache.disposed) throw new ResourceLoadCoordinatorDisposedError();
  }

  private assertGenerationCapacity(): void {
    const count = this.#generations.size + this.#startingGenerations;
    if (count >= this.maxInFlightGenerations) {
      throw new ResourceLoadCapacityError(this.maxInFlightGenerations, count);
    }
  }

  private assertCoordinatorHandleCapacity(): void {
    if (this.#activeHandles >= this.maxActiveHandles) {
      throw new ResourceLoadHandleLimitError("coordinator", this.maxActiveHandles, this.#activeHandles);
    }
  }

  private allocateGeneration(): number {
    const generation = this.#nextGeneration;
    if (!Number.isSafeInteger(generation)) throw new ResourceLoadGenerationExhaustedError();
    this.#nextGeneration = generation === Number.MAX_SAFE_INTEGER ? Number.NaN : generation + 1;
    return generation;
  }
}

/** Creates a load coordinator over a caller-owned structural cache. */
export function createResourceLoadCoordinator<Value = unknown>(
  cache: ResourceCacheCoordinator<Value>,
  options: ResourceLoadCoordinatorOptions = {},
): ResourceLoadCoordinator<Value> {
  return new ResourceLoadCoordinator(cache, options);
}

function resolveCoordinatorOptions(options: ResourceLoadCoordinatorOptions): ResolvedOptions {
  const values = snapshotOptionsRecord(options, [
    "maxInFlightGenerations",
    "maxActiveHandles",
    "maxHandlesPerGeneration",
    "maxInspectionGenerations",
    "maxDiagnostics",
    "maxDepth",
    "maxNodes",
    "maxContainerEntries",
  ], "Resource load coordinator options");
  return Object.freeze({
    maxInFlightGenerations: boundedInteger(
      values.maxInFlightGenerations ?? DEFAULT_OPTIONS.maxInFlightGenerations,
      "maxInFlightGenerations",
      1,
      HARD_LIMITS.maxInFlightGenerations,
    ),
    maxActiveHandles: boundedInteger(
      values.maxActiveHandles ?? DEFAULT_OPTIONS.maxActiveHandles,
      "maxActiveHandles",
      1,
      HARD_LIMITS.maxActiveHandles,
    ),
    maxHandlesPerGeneration: boundedInteger(
      values.maxHandlesPerGeneration ?? DEFAULT_OPTIONS.maxHandlesPerGeneration,
      "maxHandlesPerGeneration",
      1,
      HARD_LIMITS.maxHandlesPerGeneration,
    ),
    maxInspectionGenerations: boundedInteger(
      values.maxInspectionGenerations ?? DEFAULT_OPTIONS.maxInspectionGenerations,
      "maxInspectionGenerations",
      0,
      HARD_LIMITS.maxInspectionGenerations,
    ),
    maxDiagnostics: boundedInteger(
      values.maxDiagnostics ?? DEFAULT_OPTIONS.maxDiagnostics,
      "maxDiagnostics",
      0,
      HARD_LIMITS.maxDiagnostics,
    ),
    snapshotLimits: Object.freeze({
      maxDepth: boundedInteger(
        values.maxDepth ?? DEFAULT_OPTIONS.snapshotLimits.maxDepth,
        "maxDepth",
        0,
        HARD_LIMITS.maxDepth,
      ),
      maxNodes: boundedInteger(
        values.maxNodes ?? DEFAULT_OPTIONS.snapshotLimits.maxNodes,
        "maxNodes",
        1,
        HARD_LIMITS.maxNodes,
      ),
      maxContainerEntries: boundedInteger(
        values.maxContainerEntries ?? DEFAULT_OPTIONS.snapshotLimits.maxContainerEntries,
        "maxContainerEntries",
        0,
        HARD_LIMITS.maxContainerEntries,
      ),
    }),
  });
}

function snapshotLoadOptions(options: ResourceLoadOptions): LoadOptionSnapshot {
  const values = snapshotOptionsRecord(options, ["policy", "signal"], "Resource load options");
  const policy = values.policy ?? "join";
  if (!POLICIES.includes(policy as ResourceLoadPolicy)) {
    throw new ResourceLoadConfigurationError("Resource load policy must be join, supersede, or force-new.");
  }
  const signal = values.signal;
  if (signal !== undefined && (typeof signal !== "object" || signal === null)) {
    throw new ResourceLoadConfigurationError("Resource load signal must be an AbortSignal.");
  }
  return Object.freeze({
    policy: policy as ResourceLoadPolicy,
    ...(signal === undefined ? {} : { signal: signal as AbortSignal }),
  });
}

function snapshotOptionsRecord(
  options: object,
  allowed: readonly string[],
  label: string,
): Record<string, unknown> {
  let prototype: object | null;
  let keys: PropertyKey[];
  try {
    if (Array.isArray(options)) throw new Error("array");
    prototype = Object.getPrototypeOf(options);
    keys = Reflect.ownKeys(options);
  } catch {
    throw new ResourceLoadConfigurationError(`${label} must be a safely inspectable plain object.`);
  }
  if (prototype !== Object.prototype && prototype !== null) {
    throw new ResourceLoadConfigurationError(`${label} must be a plain object.`);
  }
  if (keys.length > allowed.length) {
    throw new ResourceLoadConfigurationError(`${label} contain too many properties.`);
  }
  for (const key of keys) {
    if (typeof key !== "string" || !allowed.includes(key)) {
      throw new ResourceLoadConfigurationError(`${label} contain an unsupported property.`);
    }
  }
  const result: Record<string, unknown> = Object.create(null);
  for (const key of keys as string[]) {
    let descriptor: PropertyDescriptor | undefined;
    try {
      descriptor = Object.getOwnPropertyDescriptor(options, key);
    } catch {
      throw new ResourceLoadConfigurationError(`${label} must be safely inspectable.`);
    }
    if (!descriptor || !descriptor.enumerable || !("value" in descriptor)) {
      throw new ResourceLoadConfigurationError(`${label} require enumerable data properties.`);
    }
    result[key] = descriptor.value;
  }
  return result;
}

function observeAbort(signal?: AbortSignal): AbortObservation {
  if (signal === undefined) {
    return Object.freeze({
      assertNotAborted: () => undefined,
      activate: () => undefined,
      dispose: () => undefined,
    });
  }
  let state = inspectAbortSignal(signal);
  if (state.kind === "invalid") {
    throw new ResourceLoadConfigurationError("Resource load signal is not a valid AbortSignal.");
  }
  if (state.kind === "aborted") throw new ResourceLoadCancelledError(state.reason);
  let callback: ((reason: unknown) => void) | undefined;
  let pending = false;
  let pendingReason: unknown;
  let disposed = false;
  const onAbort = () => {
    const current = inspectAbortSignal(signal);
    const reason = current.kind === "aborted" ? current.reason : undefined;
    if (callback) {
      try {
        callback(reason);
      } catch {
        // Abort dispatch is isolated from resource/cache cleanup failures.
      }
    } else {
      pending = true;
      pendingReason = reason;
    }
  };
  try {
    Reflect.apply(ADD_ABORT_LISTENER, signal, ["abort", onAbort, { once: true }]);
    state = inspectAbortSignal(signal);
  } catch {
    throw new ResourceLoadConfigurationError("Resource load signal is not safely observable.");
  }
  if (state.kind !== "active") {
    try {
      Reflect.apply(REMOVE_ABORT_LISTENER, signal, ["abort", onAbort]);
    } catch {
      // Invalid signals are rejected below; no coordinator state exists yet.
    }
    if (state.kind === "aborted") throw new ResourceLoadCancelledError(state.reason);
    throw new ResourceLoadConfigurationError("Resource load signal is not a valid AbortSignal.");
  }
  return Object.freeze({
    assertNotAborted: () => {
      if (pending) throw new ResourceLoadCancelledError(pendingReason);
      const current = inspectAbortSignal(signal);
      if (current.kind === "aborted") throw new ResourceLoadCancelledError(current.reason);
      if (current.kind === "invalid") {
        throw new ResourceLoadConfigurationError("Resource load signal became invalid.");
      }
    },
    activate: (next: (reason: unknown) => void) => {
      callback = next;
      if (pending) next(pendingReason);
    },
    dispose: () => {
      if (disposed) return;
      disposed = true;
      callback = undefined;
      try {
        Reflect.apply(REMOVE_ABORT_LISTENER, signal, ["abort", onAbort]);
      } catch {
        // A previously branded signal can only fail here through hostile host
        // behavior; cleanup remains logically terminal.
      }
    },
  });
}

function inspectAbortSignal(signal: AbortSignal):
  | { readonly kind: "active" }
  | { readonly kind: "aborted"; readonly reason: unknown }
  | { readonly kind: "invalid" } {
  try {
    if (!ABORTED_GETTER || !ABORT_REASON_GETTER) return { kind: "invalid" };
    const aborted = Boolean(Reflect.apply(ABORTED_GETTER, signal, []));
    if (!aborted) return { kind: "active" };
    return { kind: "aborted", reason: Reflect.apply(ABORT_REASON_GETTER, signal, []) };
  } catch {
    return { kind: "invalid" };
  }
}

function snapshotRequest(
  request: unknown,
  limits: Readonly<Required<ResourceLoadSnapshotLimits>>,
): unknown {
  return cloneRequest(request, "$", 0, {
    limits,
    ancestors: new WeakSet<object>(),
    nodes: 0,
  });
}

function cloneRequest(value: unknown, path: string, depth: number, context: SnapshotContext): unknown {
  if (depth > context.limits.maxDepth) {
    throw new ResourceLoadRequestError("max-depth", "Resource load request is too deeply nested.", path);
  }
  context.nodes += 1;
  if (context.nodes > context.limits.maxNodes) {
    throw new ResourceLoadRequestError("max-nodes", "Resource load request contains too many nodes.", path);
  }
  if (
    value === undefined || value === null || typeof value === "boolean" ||
    typeof value === "string" || typeof value === "number"
  ) return value;
  if (typeof value !== "object") {
    throw new ResourceLoadRequestError(
      "unsupported",
      `Resource load requests do not support ${typeof value} values.`,
      path,
    );
  }
  if (context.ancestors.has(value)) {
    throw new ResourceLoadRequestError("cycle", "Resource load request contains a cycle.", path);
  }
  context.ancestors.add(value);
  try {
    return safelyIsArray(value, path)
      ? cloneRequestArray(value, path, depth, context)
      : cloneRequestRecord(value, path, depth, context);
  } finally {
    context.ancestors.delete(value);
  }
}

function cloneRequestArray(
  value: unknown[],
  path: string,
  depth: number,
  context: SnapshotContext,
): readonly unknown[] {
  if (safePrototype(value, path) !== Array.prototype) {
    throw new ResourceLoadRequestError("invalid-shape", "Resource load arrays must use Array.prototype.", path);
  }
  const keys = safeOwnKeys(value, path);
  if (keys.length > context.limits.maxContainerEntries + 1) {
    throw new ResourceLoadRequestError(
      "max-container-entries",
      "Resource load array contains too many entries.",
      path,
    );
  }
  const lengthDescriptor = safeOwnDescriptor(value, "length", path);
  if (
    !lengthDescriptor || !("value" in lengthDescriptor) || lengthDescriptor.enumerable ||
    typeof lengthDescriptor.value !== "number" || !Number.isSafeInteger(lengthDescriptor.value) ||
    lengthDescriptor.value < 0
  ) {
    throw new ResourceLoadRequestError("invalid-shape", "Resource load array length is invalid.", path);
  }
  const length = lengthDescriptor.value;
  if (length > context.limits.maxContainerEntries) {
    throw new ResourceLoadRequestError(
      "max-container-entries",
      "Resource load array contains too many entries.",
      path,
    );
  }
  if (keys.length !== length + 1) {
    throw new ResourceLoadRequestError("invalid-shape", "Resource load arrays must be dense.", path);
  }
  const result: unknown[] = [];
  for (const key of keys) {
    if (key === "length") continue;
    if (typeof key !== "string" || !ARRAY_INDEX.test(key)) {
      throw new ResourceLoadRequestError("invalid-shape", "Resource load arrays reject extra properties.", path);
    }
    const index = Number(key);
    if (!Number.isSafeInteger(index) || index < 0 || index >= length || String(index) !== key) {
      throw new ResourceLoadRequestError("invalid-shape", "Resource load array index is invalid.", path);
    }
    const descriptor = safeOwnDescriptor(value, key, boundedChildPath(path, key));
    assertSnapshotDataDescriptor(descriptor, boundedChildPath(path, key));
    result[index] = cloneRequest(descriptor.value, `${path}[${index}]`, depth + 1, context);
  }
  if (result.length !== length || result.some((_entry, index) => !Object.hasOwn(result, index))) {
    throw new ResourceLoadRequestError("invalid-shape", "Resource load arrays must be dense.", path);
  }
  return Object.freeze(result);
}

function cloneRequestRecord(
  value: object,
  path: string,
  depth: number,
  context: SnapshotContext,
): Readonly<Record<string, unknown>> {
  const prototype = safePrototype(value, path);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new ResourceLoadRequestError("unsupported", "Resource load requests support only plain objects.", path);
  }
  const keys = safeOwnKeys(value, path);
  if (keys.length > context.limits.maxContainerEntries) {
    throw new ResourceLoadRequestError(
      "max-container-entries",
      "Resource load object contains too many entries.",
      path,
    );
  }
  const result: Record<string, unknown> = Object.create(prototype);
  for (const key of keys) {
    if (typeof key !== "string") {
      throw new ResourceLoadRequestError("unsupported", "Resource load requests reject symbol keys.", path);
    }
    const propertyPath = boundedChildPath(path, key);
    const descriptor = safeOwnDescriptor(value, key, propertyPath);
    assertSnapshotDataDescriptor(descriptor, propertyPath);
    Object.defineProperty(result, key, {
      value: cloneRequest(descriptor.value, propertyPath, depth + 1, context),
      enumerable: true,
      writable: false,
      configurable: false,
    });
  }
  return Object.freeze(result);
}

function safePrototype(value: object, path: string): object | null {
  try {
    return Object.getPrototypeOf(value);
  } catch {
    throw new ResourceLoadRequestError("reflection", "Resource load request is not inspectable.", path);
  }
}

function safeOwnKeys(value: object, path: string): PropertyKey[] {
  try {
    return Reflect.ownKeys(value);
  } catch {
    throw new ResourceLoadRequestError("reflection", "Resource load request is not inspectable.", path);
  }
}

function safeOwnDescriptor(
  value: object,
  key: PropertyKey,
  path: string,
): PropertyDescriptor | undefined {
  try {
    return Object.getOwnPropertyDescriptor(value, key);
  } catch {
    throw new ResourceLoadRequestError("reflection", "Resource load request is not inspectable.", path);
  }
}

function safelyIsArray(value: object, path: string): value is unknown[] {
  try {
    return Array.isArray(value);
  } catch {
    throw new ResourceLoadRequestError("reflection", "Resource load request shape is not inspectable.", path);
  }
}

function assertSnapshotDataDescriptor(
  descriptor: PropertyDescriptor | undefined,
  path: string,
): asserts descriptor is PropertyDescriptor & { value: unknown } {
  if (!descriptor) {
    throw new ResourceLoadRequestError("invalid-shape", "Resource load request property disappeared.", path);
  }
  if (!("value" in descriptor)) {
    throw new ResourceLoadRequestError("accessor", "Resource load requests reject accessors.", path);
  }
  if (!descriptor.enumerable) {
    throw new ResourceLoadRequestError(
      "invalid-shape",
      "Resource load request properties must be enumerable.",
      path,
    );
  }
}

function boundedChildPath(parent: string, key: string): string {
  const keyExcerpt = key.length <= 128 ? key : `${key.slice(0, 125)}...`;
  const next = /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(keyExcerpt)
    ? `${parent}.${keyExcerpt}`
    : `${parent}[${JSON.stringify(keyExcerpt)}]`;
  return next.length <= 512 ? next : `${next.slice(0, 509)}...`;
}

function boundedInteger(
  value: unknown,
  name: string,
  minimum: number,
  maximum: number,
): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw new ResourceLoadConfigurationError(
      `${name} must be a safe integer between ${minimum} and ${maximum}.`,
    );
  }
  return value;
}

function createDeferred<Value>(): {
  readonly promise: Promise<Value>;
  readonly resolve: (value: Value | PromiseLike<Value>) => void;
  readonly reject: (reason?: unknown) => void;
} {
  let resolve!: (value: Value | PromiseLike<Value>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<Value>((onResolve, onReject) => {
    resolve = onResolve;
    reject = onReject;
  });
  return { promise, resolve, reject };
}

function incrementSaturated(value: number): number {
  return value === Number.MAX_SAFE_INTEGER ? value : value + 1;
}
