// Copyright 2023 Im-Beast. MIT license.

import {
  type ActionJournalEntry,
  type ActionJournalJsonValue,
  type ActionJournalReducer,
  type ActionJournalSnapshot,
  canonicalActionJournalJson,
  normalizeActionJournalSnapshot,
} from "./action_journal.ts";

/** Current persistence schema for action-journal checkpoints. */
export const ACTION_JOURNAL_CHECKPOINT_SCHEMA_VERSION = 1 as const;

/** Stable, non-cryptographic hash used for canonical journal and state bytes. */
export const ACTION_JOURNAL_CHECKPOINT_HASH_ALGORITHM = "fnv1a64-v1" as const;

/** Exact causal position of the journal prefix represented by a checkpoint. */
export interface ActionJournalCheckpointCausalPosition {
  readonly revision: number;
  readonly parentRevision: number | null;
  readonly correlationId?: string;
  readonly source?: string;
}

/** Explicit JSON-safe state contributed by one component owner. */
export interface ActionJournalCheckpointComponentState {
  readonly componentId: string;
  readonly schemaVersion: number;
  readonly state: ActionJournalJsonValue;
}

/** Clone-safe checkpoint payload suitable for caller-owned persistence. */
export interface ActionJournalCheckpointRecord {
  readonly schemaVersion: typeof ACTION_JOURNAL_CHECKPOINT_SCHEMA_VERSION;
  readonly hashAlgorithm: typeof ACTION_JOURNAL_CHECKPOINT_HASH_ALGORITHM;
  readonly journalId: string;
  readonly baseRevision: number;
  readonly revision: number;
  readonly journalHash: string;
  readonly stateHash: string;
  readonly causalPosition: ActionJournalCheckpointCausalPosition;
  readonly components: readonly ActionJournalCheckpointComponentState[];
}

/** Explicit, one-hop migration into a component provider's current schema. */
export interface ActionJournalCheckpointMigration<TData extends ActionJournalJsonValue> {
  readonly fromSchemaVersion: number;
  readonly migrate: (state: Readonly<ActionJournalJsonValue>) => TData;
}

/**
 * Component-owned checkpoint boundary.
 *
 * Only the value returned by `capture` is persisted. Provider closures,
 * resources, and unreturned state never enter a checkpoint record.
 */
export interface ActionJournalCheckpointComponent<TState, TData extends ActionJournalJsonValue> {
  readonly componentId: string;
  readonly schemaVersion: number;
  readonly capture: (state: Readonly<TState>) => TData;
  readonly restore: (state: Readonly<TState>, data: Readonly<TData>) => TState;
  readonly migrations?: readonly ActionJournalCheckpointMigration<TData>[];
  readonly dispose?: () => void;
}

/** Idempotent controller for one component registration. */
export interface ActionJournalCheckpointComponentRegistration {
  readonly componentId: string;
  readonly schemaVersion: number;
  readonly disposed: boolean;
  dispose(): void;
}

/** Machine-readable checkpoint validation and lifecycle failures. */
export type ActionJournalCheckpointErrorCode =
  | "invalid-json"
  | "invalid-schema"
  | "invalid-value"
  | "invalid-provider"
  | "duplicate-provider"
  | "missing-provider"
  | "provider-failed"
  | "disposed";

/** Typed checkpoint error with a stable value path. */
export class ActionJournalCheckpointError extends Error {
  constructor(
    readonly code: ActionJournalCheckpointErrorCode,
    message: string,
    readonly path = "$",
    options: ErrorOptions = {},
  ) {
    super(message, options);
    this.name = "ActionJournalCheckpointError";
  }
}

/** Operation that emitted a checkpoint diagnostic. */
export type ActionJournalCheckpointOperation =
  | "register"
  | "capture"
  | "select"
  | "restore"
  | "migrate"
  | "dispose"
  | "replay";

/** Stable diagnostic categories; no thrown value or component data is retained. */
export type ActionJournalCheckpointDiagnosticCode =
  | "invalid-provider"
  | "duplicate-provider"
  | "missing-provider"
  | "provider-capture-failed"
  | "provider-restore-failed"
  | "provider-migration-failed"
  | "provider-dispose-failed"
  | "invalid-checkpoint"
  | "foreign-checkpoint"
  | "future-checkpoint"
  | "journal-hash-mismatch"
  | "causal-position-mismatch"
  | "unknown-component"
  | "missing-component"
  | "unsupported-component-schema"
  | "disposed";

/** Bounded, deterministic, clone-safe diagnostic. */
export interface ActionJournalCheckpointDiagnostic {
  readonly sequence: number;
  readonly code: ActionJournalCheckpointDiagnosticCode;
  readonly operation: ActionJournalCheckpointOperation;
  readonly message: string;
  readonly componentId?: string;
  readonly revision?: number;
  readonly path?: string;
}

/** Serializable projection of one registered component provider. */
export interface ActionJournalCheckpointComponentInspection {
  readonly componentId: string;
  readonly schemaVersion: number;
  readonly migrationSourceVersions: readonly number[];
}

/** Clone-safe registry state for devtools and lifecycle assertions. */
export interface ActionJournalCheckpointRegistryInspection {
  readonly disposed: boolean;
  readonly revision: number;
  readonly componentCount: number;
  readonly components: readonly ActionJournalCheckpointComponentInspection[];
  readonly diagnosticLimit: number;
  readonly diagnosticCount: number;
  readonly diagnostics: readonly ActionJournalCheckpointDiagnostic[];
}

/** Registry configuration. No clocks, storage, or schedulers are created. */
export interface ActionJournalCheckpointRegistryOptions {
  readonly maxDiagnostics?: number;
}

/** One deterministic compatible-checkpoint selection. */
export interface ActionJournalCheckpointSelection {
  readonly checkpoint: Readonly<ActionJournalCheckpointRecord>;
  readonly tailEntryCount: number;
  readonly migratedComponentIds: readonly string[];
}

/** Replay result that identifies whether a checkpoint was actually trusted. */
export interface ActionJournalCheckpointReplayResult<TState> {
  readonly state: TState;
  readonly serializedState: string;
  readonly appliedCount: number;
  readonly revision: number;
  readonly usedCheckpoint: boolean;
  readonly checkpointRevision?: number;
  readonly checkpointHash?: string;
}

/** Options for capturing an already-computed state. */
export interface CaptureActionJournalCheckpointOptions {
  readonly revision?: number;
}

interface RegisteredComponent<TState> {
  readonly componentId: string;
  readonly schemaVersion: number;
  readonly capture: (state: Readonly<TState>) => ActionJournalJsonValue;
  readonly restore: (state: Readonly<TState>, data: Readonly<ActionJournalJsonValue>) => TState;
  readonly migrations: ReadonlyMap<
    number,
    (state: Readonly<ActionJournalJsonValue>) => ActionJournalJsonValue
  >;
  readonly dispose?: () => void;
  readonly sequence: number;
  active: boolean;
}

interface CompatibleCheckpoint {
  readonly checkpoint: Readonly<ActionJournalCheckpointRecord>;
  readonly serialized: string;
  readonly migratedComponentIds: readonly string[];
}

interface RestoreResult<TState> {
  readonly ok: boolean;
  readonly state?: TState;
}

interface DiagnosticFields {
  readonly componentId?: string;
  readonly revision?: number;
  readonly path?: string;
}

/**
 * Host-owned component registry for opt-in action-journal checkpoints.
 *
 * A checkpoint is usable only when its journal identity, canonical prefix
 * hash, causal position, component set, and component schema versions can all
 * be proven. Anything unknown is diagnosed and skipped; replay then tries an
 * older compatible checkpoint or performs a full replay.
 */
export class ActionJournalCheckpointRegistry<TState, TAction = ActionJournalJsonValue> {
  readonly #components = new Map<string, RegisteredComponent<TState>>();
  readonly #diagnostics: ActionJournalCheckpointDiagnostic[] = [];
  readonly #maxDiagnostics: number;
  #registrationSequence = 0;
  #diagnosticSequence = 0;
  #revision = 0;
  #disposed = false;

  constructor(options: ActionJournalCheckpointRegistryOptions = {}) {
    this.#maxDiagnostics = boundedLimit(options.maxDiagnostics ?? 100);
  }

  get disposed(): boolean {
    return this.#disposed;
  }

  get revision(): number {
    return this.#revision;
  }

  /** Registers exactly one current provider for a stable component id. */
  register<TData extends ActionJournalJsonValue>(
    provider: ActionJournalCheckpointComponent<TState, TData>,
  ): ActionJournalCheckpointComponentRegistration {
    this.#ensureActive("register");
    let componentId: string;
    let schemaVersion: number;
    try {
      componentId = stableComponentId(provider?.componentId, "$.provider.componentId");
      schemaVersion = positiveInteger(provider?.schemaVersion, "$.provider.schemaVersion");
      if (typeof provider.capture !== "function" || typeof provider.restore !== "function") {
        throw new ActionJournalCheckpointError(
          "invalid-provider",
          "checkpoint provider requires capture and restore functions",
          "$.provider",
        );
      }
      if (provider.dispose !== undefined && typeof provider.dispose !== "function") {
        throw new ActionJournalCheckpointError(
          "invalid-provider",
          "checkpoint provider dispose must be a function",
          "$.provider.dispose",
        );
      }
    } catch (cause) {
      const error = checkpointError(cause, "invalid-provider", "invalid checkpoint component provider");
      this.#report("invalid-provider", "register", error.message, { path: error.path });
      throw error;
    }

    if (this.#components.has(componentId)) {
      this.#report(
        "duplicate-provider",
        "register",
        `component ${componentId} already has a checkpoint provider`,
        { componentId },
      );
      throw new ActionJournalCheckpointError(
        "duplicate-provider",
        `component ${componentId} already has a checkpoint provider`,
        "$.provider.componentId",
      );
    }

    const migrations = new Map<number, (state: Readonly<ActionJournalJsonValue>) => ActionJournalJsonValue>();
    try {
      for (let index = 0; index < (provider.migrations?.length ?? 0); index += 1) {
        const migration = provider.migrations![index]!;
        const path = `$.provider.migrations[${index}]`;
        const fromVersion = positiveInteger(migration?.fromSchemaVersion, `${path}.fromSchemaVersion`);
        if (fromVersion === schemaVersion) {
          throw new ActionJournalCheckpointError(
            "invalid-provider",
            "a migration source must differ from the provider schema version",
            `${path}.fromSchemaVersion`,
          );
        }
        if (typeof migration.migrate !== "function") {
          throw new ActionJournalCheckpointError(
            "invalid-provider",
            "checkpoint migration requires a migrate function",
            `${path}.migrate`,
          );
        }
        if (migrations.has(fromVersion)) {
          throw new ActionJournalCheckpointError(
            "invalid-provider",
            `duplicate migration source schema ${fromVersion}`,
            `${path}.fromSchemaVersion`,
          );
        }
        migrations.set(
          fromVersion,
          migration.migrate as (
            state: Readonly<ActionJournalJsonValue>,
          ) => ActionJournalJsonValue,
        );
      }
    } catch (cause) {
      const error = checkpointError(cause, "invalid-provider", "invalid checkpoint migration");
      this.#report("invalid-provider", "register", error.message, { componentId, path: error.path });
      throw error;
    }

    const registered: RegisteredComponent<TState> = {
      componentId,
      schemaVersion,
      capture: provider.capture as (state: Readonly<TState>) => ActionJournalJsonValue,
      restore: provider.restore as (
        state: Readonly<TState>,
        data: Readonly<ActionJournalJsonValue>,
      ) => TState,
      migrations,
      dispose: provider.dispose,
      sequence: this.#registrationSequence++,
      active: true,
    };
    this.#components.set(componentId, registered);
    this.#revision += 1;

    const dispose = () => this.#remove(registered);
    return Object.freeze({
      componentId,
      schemaVersion,
      get disposed(): boolean {
        return !registered.active;
      },
      dispose,
    });
  }

  /** Removes one provider and isolates its optional lifecycle disposer. */
  unregister(componentId: string): boolean {
    const registered = this.#components.get(componentId);
    if (!registered) return false;
    this.#remove(registered);
    return true;
  }

  /**
   * Captures caller-supplied state at an exact journal revision.
   *
   * Prefer `captureFromReplay` when the state/revision relationship has not
   * already been established by the caller.
   */
  capture(
    snapshot: ActionJournalSnapshot<TAction>,
    state: Readonly<TState>,
    options: CaptureActionJournalCheckpointOptions = {},
  ): Readonly<ActionJournalCheckpointRecord> {
    this.#ensureActive("capture");
    const normalized = normalizeActionJournalSnapshot(snapshot);
    const revision = checkpointRevision(normalized, options.revision);
    const providers = this.#orderedComponents();
    if (providers.length === 0) {
      this.#report("missing-provider", "capture", "cannot capture a checkpoint without component providers", {
        revision,
      });
      throw new ActionJournalCheckpointError(
        "missing-provider",
        "cannot capture a checkpoint without component providers",
        "$.components",
      );
    }

    const components: ActionJournalCheckpointComponentState[] = [];
    for (const provider of providers) {
      let captured: unknown;
      try {
        captured = provider.capture(state);
        captured = cloneFrozenJson(captured, `$.components.${provider.componentId}`);
      } catch (cause) {
        this.#report(
          "provider-capture-failed",
          "capture",
          `checkpoint capture failed for component ${provider.componentId}`,
          { componentId: provider.componentId, revision },
        );
        throw new ActionJournalCheckpointError(
          "provider-failed",
          `checkpoint capture failed for component ${provider.componentId}`,
          `$.components.${provider.componentId}`,
          { cause },
        );
      }
      components.push({
        componentId: provider.componentId,
        schemaVersion: provider.schemaVersion,
        state: captured as ActionJournalJsonValue,
      });
    }

    const record: ActionJournalCheckpointRecord = {
      schemaVersion: ACTION_JOURNAL_CHECKPOINT_SCHEMA_VERSION,
      hashAlgorithm: ACTION_JOURNAL_CHECKPOINT_HASH_ALGORITHM,
      journalId: normalized.journalId,
      baseRevision: normalized.baseRevision,
      revision,
      journalHash: actionJournalCheckpointHash(normalized, revision),
      stateHash: componentStateHash(components),
      causalPosition: causalPositionAt(normalized, revision),
      components,
    };
    return normalizeActionJournalCheckpoint(record);
  }

  /** Purely replays through one revision, then captures that exact state. */
  captureFromReplay(
    snapshot: ActionJournalSnapshot<TAction>,
    initialState: TState,
    reducer: ActionJournalReducer<TState, TAction>,
    options: CaptureActionJournalCheckpointOptions = {},
  ): Readonly<ActionJournalCheckpointRecord> {
    this.#ensureActive("capture");
    const normalized = normalizeActionJournalSnapshot(snapshot);
    const revision = checkpointRevision(normalized, options.revision);
    const entryCount = revision - normalized.baseRevision;
    const state = reduceEntries(initialState, normalized.entries.slice(0, entryCount), reducer).state;
    return this.capture(normalized, state, { revision });
  }

  /** Selects the latest structurally compatible checkpoint without restoring it. */
  selectLatestCompatibleCheckpoint(
    snapshot: ActionJournalSnapshot<TAction>,
    checkpoints: readonly unknown[],
  ): ActionJournalCheckpointSelection | undefined {
    this.#ensureActive("select");
    const normalized = normalizeActionJournalSnapshot(snapshot);
    const candidate = this.#compatibleCandidates(normalized, checkpoints)[0];
    if (!candidate) return undefined;
    return freezeInspection({
      checkpoint: candidate.checkpoint,
      tailEntryCount: normalized.entries.length -
        (candidate.checkpoint.revision - normalized.baseRevision),
      migratedComponentIds: [...candidate.migratedComponentIds],
    });
  }

  /**
   * Restores the latest usable checkpoint and purely replays its journal tail.
   *
   * Restore or migration failure rejects only that candidate. Older compatible
   * candidates are attempted in deterministic order before full replay.
   */
  replay(
    snapshot: ActionJournalSnapshot<TAction>,
    checkpoints: readonly unknown[],
    initialState: TState,
    reducer: ActionJournalReducer<TState, TAction>,
  ): ActionJournalCheckpointReplayResult<TState> {
    this.#ensureActive("replay");
    if (typeof reducer !== "function") {
      throw new ActionJournalCheckpointError(
        "invalid-value",
        "checkpoint replay reducer must be a function",
        "$.reducer",
      );
    }
    const normalized = normalizeActionJournalSnapshot(snapshot);
    const candidates = this.#compatibleCandidates(normalized, checkpoints);

    for (const candidate of candidates) {
      const restored = this.#restoreFromInitial(candidate, initialState);
      if (!restored.ok) continue;
      const offset = candidate.checkpoint.revision - normalized.baseRevision;
      const replayed = reduceEntries(restored.state as TState, normalized.entries.slice(offset), reducer);
      return {
        state: replayed.state,
        serializedState: replayed.serializedState,
        appliedCount: normalized.entries.length - offset,
        revision: normalized.entries.at(-1)?.revision ?? normalized.baseRevision,
        usedCheckpoint: true,
        checkpointRevision: candidate.checkpoint.revision,
        checkpointHash: candidate.checkpoint.journalHash,
      };
    }

    const replayed = reduceEntries(initialState, normalized.entries, reducer);
    return {
      state: replayed.state,
      serializedState: replayed.serializedState,
      appliedCount: normalized.entries.length,
      revision: normalized.entries.at(-1)?.revision ?? normalized.baseRevision,
      usedCheckpoint: false,
    };
  }

  diagnostics(): readonly ActionJournalCheckpointDiagnostic[] {
    return Object.freeze(this.#diagnostics.slice());
  }

  clearDiagnostics(): void {
    this.#diagnostics.length = 0;
  }

  inspect(): ActionJournalCheckpointRegistryInspection {
    const components = this.#orderedComponents().map((provider) => ({
      componentId: provider.componentId,
      schemaVersion: provider.schemaVersion,
      migrationSourceVersions: [...provider.migrations.keys()].sort((left, right) => left - right),
    }));
    return freezeInspection({
      disposed: this.#disposed,
      revision: this.#revision,
      componentCount: components.length,
      components,
      diagnosticLimit: this.#maxDiagnostics,
      diagnosticCount: this.#diagnostics.length,
      diagnostics: this.#diagnostics.slice(),
    });
  }

  /** Releases providers in reverse registration order; safe to call repeatedly. */
  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    const providers = [...this.#components.values()].sort((left, right) => right.sequence - left.sequence);
    this.#components.clear();
    for (const provider of providers) {
      provider.active = false;
      this.#disposeProvider(provider);
    }
    this.#revision += 1;
  }

  #compatibleCandidates(
    snapshot: Readonly<ActionJournalSnapshot<TAction>>,
    candidates: readonly unknown[],
  ): CompatibleCheckpoint[] {
    const unique = new Map<string, Readonly<ActionJournalCheckpointRecord>>();
    for (const source of candidates) {
      try {
        const checkpoint = normalizeActionJournalCheckpoint(source);
        const serialized = canonicalActionJournalCheckpointJson(checkpoint);
        unique.set(serialized, checkpoint);
      } catch (cause) {
        const error = checkpointError(cause, "invalid-value", "invalid checkpoint record");
        this.#report("invalid-checkpoint", "select", "checkpoint record failed strict validation", {
          path: error.path,
        });
      }
    }

    const ordered = [...unique.entries()].sort((left, right) => {
      const revisionOrder = right[1].revision - left[1].revision;
      return revisionOrder || compareText(left[0], right[0]);
    });
    const compatible: CompatibleCheckpoint[] = [];
    for (const [serialized, checkpoint] of ordered) {
      if (
        checkpoint.journalId !== snapshot.journalId ||
        checkpoint.baseRevision !== snapshot.baseRevision
      ) {
        this.#report("foreign-checkpoint", "select", "checkpoint belongs to a different journal", {
          revision: checkpoint.revision,
        });
        continue;
      }
      const finalRevision = snapshot.entries.at(-1)?.revision ?? snapshot.baseRevision;
      if (checkpoint.revision < snapshot.baseRevision || checkpoint.revision > finalRevision) {
        this.#report("future-checkpoint", "select", "checkpoint revision is outside this journal snapshot", {
          revision: checkpoint.revision,
        });
        continue;
      }
      if (checkpoint.journalHash !== actionJournalCheckpointHash(snapshot, checkpoint.revision)) {
        this.#report("journal-hash-mismatch", "select", "checkpoint journal prefix hash does not match", {
          revision: checkpoint.revision,
        });
        continue;
      }
      const expectedPosition = causalPositionAt(snapshot, checkpoint.revision);
      if (
        canonicalActionJournalJson(checkpoint.causalPosition) !==
          canonicalActionJournalJson(expectedPosition)
      ) {
        this.#report(
          "causal-position-mismatch",
          "select",
          "checkpoint causal position does not match the journal prefix",
          { revision: checkpoint.revision },
        );
        continue;
      }

      const stateById = new Map(checkpoint.components.map((component) => [component.componentId, component]));
      const migratedComponentIds: string[] = [];
      let isCompatible = true;
      for (const component of checkpoint.components) {
        if (!this.#components.has(component.componentId)) {
          isCompatible = false;
          this.#report(
            "unknown-component",
            "select",
            `checkpoint component ${component.componentId} has no registered provider`,
            { componentId: component.componentId, revision: checkpoint.revision },
          );
        }
      }
      for (const provider of this.#orderedComponents()) {
        const state = stateById.get(provider.componentId);
        if (!state) {
          isCompatible = false;
          this.#report(
            "missing-component",
            "select",
            `checkpoint is missing component ${provider.componentId}`,
            { componentId: provider.componentId, revision: checkpoint.revision },
          );
          continue;
        }
        if (state.schemaVersion === provider.schemaVersion) continue;
        if (provider.migrations.has(state.schemaVersion)) {
          migratedComponentIds.push(provider.componentId);
          continue;
        }
        isCompatible = false;
        this.#report(
          "unsupported-component-schema",
          "select",
          `checkpoint component ${provider.componentId} uses an unsupported schema`,
          { componentId: provider.componentId, revision: checkpoint.revision },
        );
      }
      if (isCompatible) {
        compatible.push({
          checkpoint,
          serialized,
          migratedComponentIds: Object.freeze(migratedComponentIds.sort()),
        });
      }
    }
    return compatible;
  }

  #restoreFromInitial(candidate: CompatibleCheckpoint, initialState: TState): RestoreResult<TState> {
    let state: TState;
    try {
      state = cloneFrozenJson(initialState, "$.initialState") as unknown as TState;
    } catch {
      this.#report("provider-restore-failed", "restore", "initial replay state is not JSON-safe", {
        revision: candidate.checkpoint.revision,
      });
      return { ok: false };
    }
    const stateById = new Map(candidate.checkpoint.components.map((component) => [component.componentId, component]));

    for (const provider of this.#orderedComponents()) {
      const component = stateById.get(provider.componentId)!;
      let componentState: Readonly<ActionJournalJsonValue> = component.state;
      if (component.schemaVersion !== provider.schemaVersion) {
        const migrate = provider.migrations.get(component.schemaVersion)!;
        try {
          componentState = cloneFrozenJson(
            migrate(component.state),
            `$.components.${provider.componentId}.migration`,
          );
        } catch {
          this.#report(
            "provider-migration-failed",
            "migrate",
            `checkpoint migration failed for component ${provider.componentId}`,
            { componentId: provider.componentId, revision: candidate.checkpoint.revision },
          );
          return { ok: false };
        }
      }

      try {
        const restored = provider.restore(state as Readonly<TState>, componentState);
        state = cloneFrozenJson(restored, `$.components.${provider.componentId}.restored`) as unknown as TState;
      } catch {
        this.#report(
          "provider-restore-failed",
          "restore",
          `checkpoint restore failed for component ${provider.componentId}`,
          { componentId: provider.componentId, revision: candidate.checkpoint.revision },
        );
        return { ok: false };
      }
    }
    return { ok: true, state };
  }

  #orderedComponents(): RegisteredComponent<TState>[] {
    return [...this.#components.values()].sort((left, right) => compareText(left.componentId, right.componentId));
  }

  #remove(provider: RegisteredComponent<TState>): void {
    if (!provider.active) return;
    provider.active = false;
    if (this.#components.get(provider.componentId) === provider) {
      this.#components.delete(provider.componentId);
      this.#revision += 1;
    }
    this.#disposeProvider(provider);
  }

  #disposeProvider(provider: RegisteredComponent<TState>): void {
    try {
      provider.dispose?.();
    } catch {
      this.#report(
        "provider-dispose-failed",
        "dispose",
        `checkpoint provider disposal failed for component ${provider.componentId}`,
        { componentId: provider.componentId },
      );
    }
  }

  #ensureActive(operation: ActionJournalCheckpointOperation): void {
    if (!this.#disposed) return;
    this.#report("disposed", operation, "checkpoint registry is disposed");
    throw new ActionJournalCheckpointError("disposed", "checkpoint registry is disposed");
  }

  #report(
    code: ActionJournalCheckpointDiagnosticCode,
    operation: ActionJournalCheckpointOperation,
    message: string,
    fields: DiagnosticFields = {},
  ): void {
    const diagnostic = Object.freeze({
      sequence: this.#diagnosticSequence++,
      code,
      operation,
      message,
      ...(fields.componentId === undefined ? {} : { componentId: fields.componentId }),
      ...(fields.revision === undefined ? {} : { revision: fields.revision }),
      ...(fields.path === undefined ? {} : { path: fields.path }),
    });
    if (this.#maxDiagnostics === 0) return;
    this.#diagnostics.push(diagnostic);
    if (this.#diagnostics.length > this.#maxDiagnostics) {
      this.#diagnostics.splice(0, this.#diagnostics.length - this.#maxDiagnostics);
    }
  }
}

/** Validates, canonicalizes, and deeply freezes one checkpoint record. */
export function normalizeActionJournalCheckpoint(
  source: unknown,
): Readonly<ActionJournalCheckpointRecord> {
  const cloned = cloneFrozenJson(source, "$checkpoint");
  if (!isPlainRecord(cloned)) {
    throw new ActionJournalCheckpointError("invalid-schema", "checkpoint must be a plain object", "$checkpoint");
  }
  exactKeys(cloned, [
    "baseRevision",
    "causalPosition",
    "components",
    "hashAlgorithm",
    "journalHash",
    "journalId",
    "revision",
    "schemaVersion",
    "stateHash",
  ], "$checkpoint");
  if (cloned.schemaVersion !== ACTION_JOURNAL_CHECKPOINT_SCHEMA_VERSION) {
    throw new ActionJournalCheckpointError(
      "invalid-schema",
      "unsupported action-journal checkpoint schema",
      "$checkpoint.schemaVersion",
    );
  }
  if (cloned.hashAlgorithm !== ACTION_JOURNAL_CHECKPOINT_HASH_ALGORITHM) {
    throw new ActionJournalCheckpointError(
      "invalid-schema",
      "unsupported action-journal checkpoint hash algorithm",
      "$checkpoint.hashAlgorithm",
    );
  }
  const journalId = stableJournalId(cloned.journalId, "$checkpoint.journalId");
  const baseRevision = nonNegativeInteger(cloned.baseRevision, "$checkpoint.baseRevision");
  const revision = nonNegativeInteger(cloned.revision, "$checkpoint.revision");
  if (revision < baseRevision) {
    throw new ActionJournalCheckpointError(
      "invalid-value",
      "checkpoint revision cannot precede its base revision",
      "$checkpoint.revision",
    );
  }
  const journalHash = checkpointHash(cloned.journalHash, "$checkpoint.journalHash");
  const stateHash = checkpointHash(cloned.stateHash, "$checkpoint.stateHash");
  const causalPosition = normalizeCausalPosition(cloned.causalPosition, revision);
  const components = normalizeComponentStates(cloned.components);
  if (stateHash !== componentStateHash(components)) {
    throw new ActionJournalCheckpointError(
      "invalid-value",
      "checkpoint component-state hash does not match",
      "$checkpoint.stateHash",
    );
  }

  return freezeInspection({
    schemaVersion: ACTION_JOURNAL_CHECKPOINT_SCHEMA_VERSION,
    hashAlgorithm: ACTION_JOURNAL_CHECKPOINT_HASH_ALGORITHM,
    journalId,
    baseRevision,
    revision,
    journalHash,
    stateHash,
    causalPosition,
    components,
  });
}

/** Parses and strictly validates a serialized checkpoint record. */
export function parseActionJournalCheckpoint(serialized: string): Readonly<ActionJournalCheckpointRecord> {
  let value: unknown;
  try {
    value = JSON.parse(serialized);
  } catch (cause) {
    throw new ActionJournalCheckpointError("invalid-json", "checkpoint is not valid JSON", "$", { cause });
  }
  return normalizeActionJournalCheckpoint(value);
}

/** Produces deterministic canonical checkpoint bytes. */
export function canonicalActionJournalCheckpointJson(source: unknown): string {
  return canonicalActionJournalJson(normalizeActionJournalCheckpoint(source));
}

/** Computes the canonical journal-prefix hash used by checkpoint records. */
export function actionJournalCheckpointHash<TAction = ActionJournalJsonValue>(
  snapshot: ActionJournalSnapshot<TAction>,
  revision?: number,
): string {
  const normalized = normalizeActionJournalSnapshot(snapshot);
  const targetRevision = checkpointRevision(normalized, revision);
  const prefixEntryCount = targetRevision - normalized.baseRevision;
  return fnv1a64(canonicalActionJournalJson({
    schemaVersion: normalized.schemaVersion,
    journalId: normalized.journalId,
    baseRevision: normalized.baseRevision,
    entries: normalized.entries.slice(0, prefixEntryCount),
  }));
}

function normalizeCausalPosition(
  source: unknown,
  revision: number,
): Readonly<ActionJournalCheckpointCausalPosition> {
  if (!isPlainRecord(source)) {
    throw new ActionJournalCheckpointError(
      "invalid-schema",
      "checkpoint causal position must be a plain object",
      "$checkpoint.causalPosition",
    );
  }
  exactKeys(
    source,
    ["correlationId", "parentRevision", "revision", "source"],
    "$checkpoint.causalPosition",
    true,
  );
  const positionRevision = nonNegativeInteger(source.revision, "$checkpoint.causalPosition.revision");
  if (positionRevision !== revision) {
    throw new ActionJournalCheckpointError(
      "invalid-value",
      "checkpoint causal revision must match checkpoint revision",
      "$checkpoint.causalPosition.revision",
    );
  }
  const parentRevision = source.parentRevision === null
    ? null
    : nonNegativeInteger(source.parentRevision, "$checkpoint.causalPosition.parentRevision");
  const correlationId = optionalStableText(source.correlationId, "$checkpoint.causalPosition.correlationId");
  const causalSource = optionalStableText(source.source, "$checkpoint.causalPosition.source");
  return freezeInspection({
    revision,
    parentRevision,
    ...(correlationId === undefined ? {} : { correlationId }),
    ...(causalSource === undefined ? {} : { source: causalSource }),
  });
}

function normalizeComponentStates(source: unknown): readonly ActionJournalCheckpointComponentState[] {
  if (!Array.isArray(source) || source.length === 0) {
    throw new ActionJournalCheckpointError(
      "invalid-schema",
      "checkpoint components must be a non-empty array",
      "$checkpoint.components",
    );
  }
  const seen = new Set<string>();
  const components = source.map((value, index) => {
    const path = `$checkpoint.components[${index}]`;
    if (!isPlainRecord(value)) {
      throw new ActionJournalCheckpointError("invalid-schema", "component state must be a plain object", path);
    }
    exactKeys(value, ["componentId", "schemaVersion", "state"], path);
    const componentId = stableComponentId(value.componentId, `${path}.componentId`);
    if (seen.has(componentId)) {
      throw new ActionJournalCheckpointError(
        "invalid-schema",
        `duplicate checkpoint component ${componentId}`,
        `${path}.componentId`,
      );
    }
    seen.add(componentId);
    return freezeInspection({
      componentId,
      schemaVersion: positiveInteger(value.schemaVersion, `${path}.schemaVersion`),
      state: value.state as ActionJournalJsonValue,
    });
  });
  components.sort((left, right) => compareText(left.componentId, right.componentId));
  return Object.freeze(components);
}

function causalPositionAt<TAction>(
  snapshot: Readonly<ActionJournalSnapshot<TAction>>,
  revision: number,
): Readonly<ActionJournalCheckpointCausalPosition> {
  if (revision === snapshot.baseRevision) {
    return Object.freeze({ revision, parentRevision: null });
  }
  const entry = snapshot.entries[revision - snapshot.baseRevision - 1]!;
  return Object.freeze({
    revision,
    parentRevision: entry.causality.parentRevision,
    ...(entry.causality.correlationId === undefined ? {} : { correlationId: entry.causality.correlationId }),
    ...(entry.causality.source === undefined ? {} : { source: entry.causality.source }),
  });
}

function checkpointRevision<TAction>(
  snapshot: Readonly<ActionJournalSnapshot<TAction>>,
  requested: number | undefined,
): number {
  const finalRevision = snapshot.entries.at(-1)?.revision ?? snapshot.baseRevision;
  const revision = requested ?? finalRevision;
  if (!Number.isSafeInteger(revision) || revision < snapshot.baseRevision || revision > finalRevision) {
    throw new ActionJournalCheckpointError(
      "invalid-value",
      `checkpoint revision must be between ${snapshot.baseRevision} and ${finalRevision}`,
      "$.revision",
    );
  }
  return revision;
}

function componentStateHash(components: readonly ActionJournalCheckpointComponentState[]): string {
  return fnv1a64(canonicalActionJournalJson(components));
}

function reduceEntries<TState, TAction>(
  initialState: TState,
  entries: readonly Readonly<ActionJournalEntry<TAction>>[],
  reducer: ActionJournalReducer<TState, TAction>,
): { state: TState; serializedState: string } {
  if (typeof reducer !== "function") {
    throw new ActionJournalCheckpointError("invalid-value", "checkpoint reducer must be a function", "$.reducer");
  }
  let state = cloneFrozenJson(initialState, "$.initialState") as unknown as TState;
  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index]!;
    state = cloneFrozenJson(
      reducer(state as Readonly<TState>, entry.action as Readonly<TAction>, entry),
      `$.states[${index}]`,
    ) as unknown as TState;
  }
  return { state, serializedState: canonicalActionJournalJson(state) };
}

function cloneFrozenJson(value: unknown, path: string): ActionJournalJsonValue {
  return freezeJson(cloneJson(value, path));
}

function cloneJson(value: unknown, path: string, ancestors = new WeakSet<object>()): ActionJournalJsonValue {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new ActionJournalCheckpointError("invalid-value", `expected a finite number at ${path}`, path);
    }
    return Object.is(value, -0) ? 0 : value;
  }
  if (typeof value !== "object") {
    throw new ActionJournalCheckpointError("invalid-value", `value at ${path} is not JSON-safe`, path);
  }
  if (ancestors.has(value)) {
    throw new ActionJournalCheckpointError("invalid-value", `cyclic value at ${path} is not JSON-safe`, path);
  }
  ancestors.add(value);
  try {
    if (Array.isArray(value)) {
      const ownKeys = Reflect.ownKeys(value);
      for (const key of ownKeys) {
        if (typeof key === "symbol") {
          throw new ActionJournalCheckpointError("invalid-value", `symbol property at ${path} is not JSON-safe`, path);
        }
        if (key === "length") continue;
        if (!/^(0|[1-9][0-9]*)$/.test(key) || Number(key) >= value.length) {
          throw new ActionJournalCheckpointError(
            "invalid-value",
            `non-index array property at ${path} is not JSON-safe`,
            path,
          );
        }
      }
      const result: ActionJournalJsonValue[] = [];
      for (let index = 0; index < value.length; index += 1) {
        if (!(index in value)) {
          throw new ActionJournalCheckpointError(
            "invalid-value",
            `sparse array at ${path} is not JSON-safe`,
            `${path}[${index}]`,
          );
        }
        const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
        if (!descriptor?.enumerable || !("value" in descriptor)) {
          throw new ActionJournalCheckpointError(
            "invalid-value",
            `array accessor at ${path}[${index}] is not JSON-safe`,
            `${path}[${index}]`,
          );
        }
        result.push(cloneJson(descriptor.value, `${path}[${index}]`, ancestors));
      }
      return result;
    }
    if (!isPlainRecord(value)) {
      throw new ActionJournalCheckpointError("invalid-value", `value at ${path} must be a plain object`, path);
    }
    const result = Object.create(null) as Record<string, ActionJournalJsonValue>;
    for (const key of Reflect.ownKeys(value).sort(comparePropertyKeys)) {
      if (typeof key === "symbol") {
        throw new ActionJournalCheckpointError("invalid-value", `symbol property at ${path} is not JSON-safe`, path);
      }
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor?.enumerable || !("value" in descriptor)) {
        throw new ActionJournalCheckpointError(
          "invalid-value",
          `non-enumerable or accessor property at ${path}.${key} is not JSON-safe`,
          `${path}.${key}`,
        );
      }
      result[key] = cloneJson(descriptor.value, `${path}.${key}`, ancestors);
    }
    return result;
  } finally {
    ancestors.delete(value);
  }
}

function freezeJson<T>(value: T): T {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) freezeJson(child);
  return Object.freeze(value);
}

function freezeInspection<T>(value: T): T {
  return freezeJson(value);
}

function exactKeys(
  value: Record<string, unknown>,
  allowed: readonly string[],
  path: string,
  optional = false,
): void {
  const actual = Object.keys(value).sort();
  const allowedSet = new Set(allowed);
  const unknown = actual.find((key) => !allowedSet.has(key));
  if (unknown !== undefined) {
    throw new ActionJournalCheckpointError(
      "invalid-schema",
      `unknown checkpoint field ${unknown}`,
      `${path}.${unknown}`,
    );
  }
  if (optional) return;
  const missing = allowed.find((key) => !Object.hasOwn(value, key));
  if (missing !== undefined) {
    throw new ActionJournalCheckpointError(
      "invalid-schema",
      `missing checkpoint field ${missing}`,
      `${path}.${missing}`,
    );
  }
}

function stableComponentId(value: unknown, path: string): string {
  if (
    typeof value !== "string" ||
    !/^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$/.test(value)
  ) {
    throw new ActionJournalCheckpointError(
      "invalid-provider",
      "component id must be a stable 1-128 character identifier",
      path,
    );
  }
  return value;
}

function stableJournalId(value: unknown, path: string): string {
  if (typeof value !== "string" || !value.trim() || value !== value.trim()) {
    throw new ActionJournalCheckpointError(
      "invalid-value",
      "checkpoint journal id must be non-empty without surrounding whitespace",
      path,
    );
  }
  return value;
}

function optionalStableText(value: unknown, path: string): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string" || !value.trim() || value !== value.trim()) {
    throw new ActionJournalCheckpointError(
      "invalid-value",
      "checkpoint causal text must be non-empty without surrounding whitespace",
      path,
    );
  }
  return value;
}

function positiveInteger(value: unknown, path: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 1) {
    throw new ActionJournalCheckpointError("invalid-value", `expected a positive safe integer at ${path}`, path);
  }
  return value;
}

function nonNegativeInteger(value: unknown, path: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw new ActionJournalCheckpointError(
      "invalid-value",
      `expected a non-negative safe integer at ${path}`,
      path,
    );
  }
  return value;
}

function checkpointHash(value: unknown, path: string): string {
  if (typeof value !== "string" || !/^[0-9a-f]{16}$/.test(value)) {
    throw new ActionJournalCheckpointError("invalid-value", "checkpoint hash must be 16 lowercase hex digits", path);
  }
  return value;
}

function boundedLimit(value: number): number {
  if (!Number.isFinite(value)) return 100;
  return Math.max(0, Math.min(10_000, Math.floor(value)));
}

function checkpointError(
  cause: unknown,
  fallbackCode: ActionJournalCheckpointErrorCode,
  fallbackMessage: string,
): ActionJournalCheckpointError {
  if (cause instanceof ActionJournalCheckpointError) return cause;
  return new ActionJournalCheckpointError(fallbackCode, fallbackMessage, "$", { cause });
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function comparePropertyKeys(left: PropertyKey, right: PropertyKey): number {
  return compareText(String(left), String(right));
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function fnv1a64(value: string): string {
  let hash = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  for (const byte of new TextEncoder().encode(value)) {
    hash ^= BigInt(byte);
    hash = BigInt.asUintN(64, hash * prime);
  }
  return hash.toString(16).padStart(16, "0");
}
