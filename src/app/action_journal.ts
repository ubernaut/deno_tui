// Copyright 2023 Im-Beast. MIT license.

/** Current schema emitted by deterministic action journals. */
export const ACTION_JOURNAL_SCHEMA_VERSION = 1 as const;

/** JSON value accepted by action-journal persistence and replay boundaries. */
export type ActionJournalJsonValue =
  | null
  | boolean
  | number
  | string
  | readonly ActionJournalJsonValue[]
  | { readonly [key: string]: ActionJournalJsonValue };

/** Stable validation failures emitted before a journal can be used. */
export type ActionJournalErrorCode =
  | "invalid-json"
  | "invalid-schema"
  | "invalid-journal-id"
  | "invalid-revision"
  | "invalid-entry"
  | "invalid-causality"
  | "invalid-value";

/** Typed validation error with a machine-readable code and value path. */
export class ActionJournalError extends Error {
  constructor(
    readonly code: ActionJournalErrorCode,
    message: string,
    readonly path = "$",
    options: ErrorOptions = {},
  ) {
    super(message, options);
    this.name = "ActionJournalError";
  }
}

/** Causal metadata retained without coupling the journal to one action bus. */
export interface ActionJournalCausality {
  /** Earlier revision that directly caused this action; defaults to the previous revision. */
  parentRevision: number;
  correlationId?: string;
  source?: string;
  metadata?: Readonly<Record<string, ActionJournalJsonValue>>;
}

/** One immutable, monotonically revised action journal entry. */
export interface ActionJournalEntry<TAction = ActionJournalJsonValue> {
  revision: number;
  timestamp: number;
  action: TAction;
  causality: ActionJournalCausality;
}

/** Clone-safe versioned journal payload intended for storage or transport. */
export interface ActionJournalSnapshot<TAction = ActionJournalJsonValue> {
  schemaVersion: typeof ACTION_JOURNAL_SCHEMA_VERSION;
  journalId: string;
  baseRevision: number;
  entries: readonly ActionJournalEntry<TAction>[];
}

/** Construction options for a new action journal. */
export interface ActionJournalOptions {
  journalId?: string;
  baseRevision?: number;
  now?: () => number;
}

/** Metadata supplied while appending one action. */
export interface ActionJournalAppendOptions {
  timestamp?: number;
  parentRevision?: number;
  correlationId?: string;
  source?: string;
  metadata?: Readonly<Record<string, ActionJournalJsonValue>>;
}

/** Serializable journal state for diagnostics and release gates. */
export interface ActionJournalInspection {
  schemaVersion: typeof ACTION_JOURNAL_SCHEMA_VERSION;
  journalId: string;
  baseRevision: number;
  nextRevision: number;
  entryCount: number;
  firstRevision?: number;
  lastRevision?: number;
  correlationIds: string[];
  sources: string[];
}

/** Pure reducer used to replay one action journal. */
export type ActionJournalReducer<TState, TAction> = (
  state: Readonly<TState>,
  action: Readonly<TAction>,
  entry: Readonly<ActionJournalEntry<TAction>>,
) => TState;

/** Deterministic result of replaying a validated journal snapshot. */
export interface ActionJournalReplayResult<TState> {
  state: TState;
  serializedState: string;
  appliedCount: number;
  revision: number;
}

/**
 * Append-only, renderer-neutral action journal.
 *
 * Actions cross a strict JSON boundary at append time, so later caller
 * mutation cannot alter history. Revisions are contiguous and causality may
 * refer only to the base revision or an already committed entry.
 */
export class ActionJournal<TAction = ActionJournalJsonValue> {
  readonly #journalId: string;
  readonly #baseRevision: number;
  readonly #now: () => number;
  readonly #entries: ActionJournalEntry<TAction>[] = [];

  constructor(options: ActionJournalOptions = {}) {
    this.#journalId = normalizeJournalId(options.journalId ?? "default", "$.journalId");
    this.#baseRevision = nonNegativeInteger(options.baseRevision ?? 0, "$.baseRevision");
    this.#now = options.now ?? Date.now;
  }

  get journalId(): string {
    return this.#journalId;
  }

  get baseRevision(): number {
    return this.#baseRevision;
  }

  get revision(): number {
    return this.#entries.at(-1)?.revision ?? this.#baseRevision;
  }

  get size(): number {
    return this.#entries.length;
  }

  /** Appends one defensively cloned JSON action and returns an immutable entry. */
  append(action: TAction, options: ActionJournalAppendOptions = {}): Readonly<ActionJournalEntry<TAction>> {
    const previousRevision = this.revision;
    const revision = nonNegativeInteger(previousRevision + 1, "$.revision");
    const parentRevision = options.parentRevision ?? previousRevision;
    if (!Number.isSafeInteger(parentRevision) || parentRevision < this.#baseRevision || parentRevision >= revision) {
      throw new ActionJournalError(
        "invalid-causality",
        `parent revision ${String(parentRevision)} must be between ${this.#baseRevision} and ${revision - 1}`,
        "$.causality.parentRevision",
      );
    }
    const timestamp = finiteNumber(options.timestamp ?? safeNow(this.#now), "$.timestamp");
    const correlationId = optionalText(options.correlationId, "$.causality.correlationId");
    const source = optionalText(options.source, "$.causality.source");
    const metadata = options.metadata === undefined
      ? undefined
      : cloneJson(options.metadata, "$.causality.metadata") as Record<string, ActionJournalJsonValue>;
    const entry = freezeJson({
      revision,
      timestamp,
      action: cloneJson(action, "$.action") as TAction,
      causality: actionJournalCausality(parentRevision, correlationId, source, metadata),
    }) as unknown as ActionJournalEntry<TAction>;
    this.#entries.push(entry);
    return entry;
  }

  /** Returns immutable entry clones that cannot mutate retained history. */
  entries(): readonly Readonly<ActionJournalEntry<TAction>>[] {
    return this.snapshot().entries;
  }

  /** Returns a deeply immutable, clone-safe persistence snapshot. */
  snapshot(): Readonly<ActionJournalSnapshot<TAction>> {
    return normalizeActionJournalSnapshot({
      schemaVersion: ACTION_JOURNAL_SCHEMA_VERSION,
      journalId: this.#journalId,
      baseRevision: this.#baseRevision,
      entries: this.#entries,
    });
  }

  /** Serializes the journal with recursively sorted object keys. */
  serialize(): string {
    return canonicalActionJournalJson(this.snapshot());
  }

  /** Replays this journal through a caller-owned pure reducer. */
  replay<TState>(
    initialState: TState,
    reducer: ActionJournalReducer<TState, TAction>,
  ): ActionJournalReplayResult<TState> {
    return replayActionJournal(this.snapshot(), initialState, reducer);
  }

  inspect(): ActionJournalInspection {
    const correlationIds = new Set<string>();
    const sources = new Set<string>();
    for (const entry of this.#entries) {
      if (entry.causality.correlationId) correlationIds.add(entry.causality.correlationId);
      if (entry.causality.source) sources.add(entry.causality.source);
    }
    return {
      schemaVersion: ACTION_JOURNAL_SCHEMA_VERSION,
      journalId: this.#journalId,
      baseRevision: this.#baseRevision,
      nextRevision: this.revision + 1,
      entryCount: this.#entries.length,
      firstRevision: this.#entries[0]?.revision,
      lastRevision: this.#entries.at(-1)?.revision,
      correlationIds: [...correlationIds].sort(),
      sources: [...sources].sort(),
    };
  }

  /** Rehydrates a validated snapshot and continues its monotonic revision sequence. */
  static fromSnapshot<TAction = ActionJournalJsonValue>(
    snapshot: ActionJournalSnapshot<TAction>,
    options: Pick<ActionJournalOptions, "now"> = {},
  ): ActionJournal<TAction> {
    const normalized = normalizeActionJournalSnapshot(snapshot);
    const journal = new ActionJournal<TAction>({
      journalId: normalized.journalId,
      baseRevision: normalized.baseRevision,
      now: options.now,
    });
    journal.#entries.push(...normalized.entries);
    return journal;
  }
}

/** Validates and deeply freezes a journal snapshot. */
export function normalizeActionJournalSnapshot<TAction = ActionJournalJsonValue>(
  snapshot: ActionJournalSnapshot<TAction>,
): Readonly<ActionJournalSnapshot<TAction>> {
  if (!isPlainRecord(snapshot)) {
    throw new ActionJournalError("invalid-schema", "action journal snapshot must be a plain object");
  }
  if (snapshot.schemaVersion !== ACTION_JOURNAL_SCHEMA_VERSION) {
    throw new ActionJournalError(
      "invalid-schema",
      `unsupported action journal schema: ${String(snapshot.schemaVersion)}`,
      "$.schemaVersion",
    );
  }
  const journalId = normalizeJournalId(snapshot.journalId, "$.journalId");
  const baseRevision = nonNegativeInteger(snapshot.baseRevision, "$.baseRevision");
  if (!Array.isArray(snapshot.entries)) {
    throw new ActionJournalError("invalid-entry", "journal entries must be an array", "$.entries");
  }

  const entries: ActionJournalEntry<TAction>[] = [];
  let expectedRevision = baseRevision + 1;
  for (let index = 0; index < snapshot.entries.length; index += 1) {
    const path = `$.entries[${index}]`;
    const source = snapshot.entries[index];
    if (!isPlainRecord(source) || !isPlainRecord(source.causality)) {
      throw new ActionJournalError("invalid-entry", "journal entry and causality must be plain objects", path);
    }
    const revision = nonNegativeInteger(source.revision, `${path}.revision`);
    if (revision !== expectedRevision) {
      throw new ActionJournalError(
        "invalid-revision",
        `expected contiguous revision ${expectedRevision}, received ${revision}`,
        `${path}.revision`,
      );
    }
    const parentRevision = nonNegativeInteger(source.causality.parentRevision, `${path}.causality.parentRevision`);
    if (parentRevision < baseRevision || parentRevision >= revision) {
      throw new ActionJournalError(
        "invalid-causality",
        `parent revision ${parentRevision} must precede revision ${revision}`,
        `${path}.causality.parentRevision`,
      );
    }
    const correlationId = optionalText(source.causality.correlationId, `${path}.causality.correlationId`);
    const causalSource = optionalText(source.causality.source, `${path}.causality.source`);
    const metadata = source.causality.metadata === undefined
      ? undefined
      : cloneJson(source.causality.metadata, `${path}.causality.metadata`) as Record<
        string,
        ActionJournalJsonValue
      >;
    const entry = freezeJson({
      revision,
      timestamp: finiteNumber(source.timestamp, `${path}.timestamp`),
      action: cloneJson(source.action, `${path}.action`) as TAction,
      causality: actionJournalCausality(parentRevision, correlationId, causalSource, metadata),
    }) as unknown as ActionJournalEntry<TAction>;
    entries.push(entry);
    expectedRevision += 1;
  }

  return freezeJson({
    schemaVersion: ACTION_JOURNAL_SCHEMA_VERSION,
    journalId,
    baseRevision,
    entries,
  }) as unknown as Readonly<ActionJournalSnapshot<TAction>>;
}

/** Parses and validates serialized action-journal JSON. */
export function parseActionJournal<TAction = ActionJournalJsonValue>(
  serialized: string,
): Readonly<ActionJournalSnapshot<TAction>> {
  let value: unknown;
  try {
    value = JSON.parse(serialized);
  } catch (cause) {
    throw new ActionJournalError("invalid-json", "action journal is not valid JSON", "$", { cause });
  }
  return normalizeActionJournalSnapshot(value as ActionJournalSnapshot<TAction>);
}

/** Produces canonical JSON with recursively sorted keys after strict validation. */
export function canonicalActionJournalJson(value: unknown): string {
  return JSON.stringify(cloneJson(value, "$"));
}

/** Replays a validated snapshot and emits canonical bytes for the resulting state. */
export function replayActionJournal<TState, TAction = ActionJournalJsonValue>(
  snapshot: ActionJournalSnapshot<TAction>,
  initialState: TState,
  reducer: ActionJournalReducer<TState, TAction>,
): ActionJournalReplayResult<TState> {
  if (typeof reducer !== "function") {
    throw new ActionJournalError("invalid-value", "action journal reducer must be a function", "$.reducer");
  }
  const normalized = normalizeActionJournalSnapshot(snapshot);
  let state = freezeJson(cloneJson(initialState, "$.initialState")) as unknown as TState;
  for (let index = 0; index < normalized.entries.length; index += 1) {
    const entry = normalized.entries[index]!;
    const reduced = reducer(state as Readonly<TState>, entry.action as Readonly<TAction>, entry);
    state = freezeJson(cloneJson(reduced, `$.states[${index}]`)) as unknown as TState;
  }
  return {
    state,
    serializedState: canonicalActionJournalJson(state),
    appliedCount: normalized.entries.length,
    revision: normalized.entries.at(-1)?.revision ?? normalized.baseRevision,
  };
}

function cloneJson(value: unknown, path: string, ancestors = new WeakSet<object>()): ActionJournalJsonValue {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") return finiteNumber(Object.is(value, -0) ? 0 : value, path);
  if (typeof value !== "object") {
    throw new ActionJournalError("invalid-value", `value at ${path} is not JSON-safe`, path);
  }
  if (ancestors.has(value)) {
    throw new ActionJournalError("invalid-value", `cyclic value at ${path} is not JSON-safe`, path);
  }
  ancestors.add(value);
  try {
    if (Array.isArray(value)) {
      const ownKeys = Reflect.ownKeys(value);
      const lengthDescriptor = Object.getOwnPropertyDescriptor(value, "length");
      if (
        !lengthDescriptor || !("value" in lengthDescriptor) || lengthDescriptor.enumerable ||
        !Number.isSafeInteger(lengthDescriptor.value) || lengthDescriptor.value < 0
      ) {
        throw new ActionJournalError(
          "invalid-value",
          `invalid array length at ${path} is not JSON-safe`,
          path,
        );
      }
      const length = lengthDescriptor.value as number;
      const indexKeys = new Set<number>();
      for (const key of ownKeys) {
        if (typeof key === "symbol") {
          throw new ActionJournalError("invalid-value", `symbol property at ${path} is not JSON-safe`, path);
        }
        if (key === "length") continue;
        if (!/^(0|[1-9][0-9]*)$/.test(key) || Number(key) >= length) {
          throw new ActionJournalError(
            "invalid-value",
            `non-index array property at ${path} is not JSON-safe`,
            path,
          );
        }
        indexKeys.add(Number(key));
      }
      if (indexKeys.size !== length) {
        let missingIndex = 0;
        while (indexKeys.has(missingIndex)) missingIndex += 1;
        throw new ActionJournalError(
          "invalid-value",
          `sparse array at ${path} is not JSON-safe`,
          `${path}[${missingIndex}]`,
        );
      }

      const descriptors: PropertyDescriptor[] = [];
      for (let index = 0; index < length; index += 1) {
        const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
        if (!descriptor?.enumerable || !("value" in descriptor)) {
          throw new ActionJournalError(
            "invalid-value",
            `non-enumerable or accessor array element at ${path}[${index}] is not JSON-safe`,
            `${path}[${index}]`,
          );
        }
        descriptors.push(descriptor);
      }

      const result: ActionJournalJsonValue[] = [];
      for (let index = 0; index < descriptors.length; index += 1) {
        result.push(cloneJson(descriptors[index]!.value, `${path}[${index}]`, ancestors));
      }
      return result;
    }
    if (!isPlainRecord(value)) {
      throw new ActionJournalError("invalid-value", `value at ${path} must be a plain object`, path);
    }
    const ownKeys = Reflect.ownKeys(value);
    const symbol = ownKeys.find((key) => typeof key === "symbol");
    if (symbol !== undefined) {
      throw new ActionJournalError("invalid-value", `symbol property at ${path} is not JSON-safe`, path);
    }
    const result = Object.create(null) as Record<string, ActionJournalJsonValue>;
    for (const key of (ownKeys as string[]).sort()) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor?.enumerable || !("value" in descriptor)) {
        throw new ActionJournalError(
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

function actionJournalCausality(
  parentRevision: number,
  correlationId: string | undefined,
  source: string | undefined,
  metadata: Record<string, ActionJournalJsonValue> | undefined,
): ActionJournalCausality {
  return {
    parentRevision,
    ...(correlationId === undefined ? {} : { correlationId }),
    ...(source === undefined ? {} : { source }),
    ...(metadata === undefined ? {} : { metadata }),
  };
}

function freezeJson<T>(value: T): T {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) freezeJson(child);
  return Object.freeze(value);
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function normalizeJournalId(value: unknown, path: string): string {
  if (typeof value !== "string" || !value.trim() || value !== value.trim()) {
    throw new ActionJournalError(
      "invalid-journal-id",
      "journal id must be non-empty without surrounding whitespace",
      path,
    );
  }
  return value;
}

function optionalText(value: unknown, path: string): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string" || !value.trim() || value !== value.trim()) {
    throw new ActionJournalError(
      "invalid-causality",
      "causal text must be non-empty without surrounding whitespace",
      path,
    );
  }
  return value;
}

function nonNegativeInteger(value: unknown, path: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw new ActionJournalError("invalid-revision", `expected a non-negative safe integer at ${path}`, path);
  }
  return value;
}

function finiteNumber(value: unknown, path: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new ActionJournalError("invalid-value", `expected a finite number at ${path}`, path);
  }
  return value;
}

function safeNow(now: () => number): number {
  try {
    return now();
  } catch (cause) {
    throw new ActionJournalError("invalid-value", "journal clock failed", "$.timestamp", { cause });
  }
}
