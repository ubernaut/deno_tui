// Copyright 2023 Im-Beast. MIT license.

import {
  type ActionJournalJsonValue,
  type ActionJournalSnapshot,
  canonicalActionJournalJson,
  normalizeActionJournalSnapshot,
} from "./action_journal.ts";
import {
  type ActionJournalCheckpointComponentInspection,
  actionJournalCheckpointHash,
  type ActionJournalCheckpointRecord,
  canonicalActionJournalCheckpointJson,
  normalizeActionJournalCheckpoint,
} from "./action_journal_checkpoints.ts";

/** Current schema for deterministic retention plans and results. */
export const ACTION_JOURNAL_RETENTION_SCHEMA_VERSION = 1 as const;

/** Caller-owned retention limits. Timestamp units match journal timestamps. */
export interface ActionJournalRetentionPolicy {
  readonly maxEntryCount?: number;
  readonly maxCanonicalBytes?: number;
  readonly maxAge?: number;
  readonly referenceTimestamp?: number;
}

/** Component schemas that the caller can restore or explicitly migrate. */
export interface ActionJournalRetentionComponentCompatibility {
  readonly componentId: string;
  readonly schemaVersions: readonly number[];
}

/** Pure planner input; source objects are validated and never mutated. */
export interface ActionJournalRetentionInput<TAction = ActionJournalJsonValue> {
  readonly journal: ActionJournalSnapshot<TAction>;
  readonly checkpoints?: readonly ActionJournalCheckpointRecord[];
  readonly compatibleComponents?: readonly ActionJournalRetentionComponentCompatibility[];
  readonly policy: ActionJournalRetentionPolicy;
}

/** A normalized journal tail and its single replay anchor, when one is needed. */
export interface ActionJournalRetentionBundle<TAction = ActionJournalJsonValue> {
  readonly journal: Readonly<ActionJournalSnapshot<TAction>>;
  readonly checkpoints: readonly Readonly<ActionJournalCheckpointRecord>[];
}

/** Frozen, clone-safe size and revision accounting for one bundle. */
export interface ActionJournalRetentionStats {
  readonly baseRevision: number;
  readonly firstRevision?: number;
  readonly lastRevision?: number;
  readonly entryCount: number;
  readonly checkpointCount: number;
  readonly journalBytes: number;
  readonly checkpointBytes: number;
  readonly totalBytes: number;
}

/** Policy reasons that can cause a replay-safe prefix to be removed. */
export type ActionJournalRetentionReason =
  | "max-entry-count"
  | "max-canonical-bytes"
  | "max-age";

/** Fail-closed reasons retained as data instead of producing a stranded tail. */
export type ActionJournalRetentionUnsatisfiedKind =
  | ActionJournalRetentionReason
  | "clock-regression"
  | "replay-safety";

/** One clone-safe explanation of an unsatisfied retention requirement. */
export interface ActionJournalRetentionUnsatisfiedConstraint {
  readonly constraint: ActionJournalRetentionUnsatisfiedKind;
  readonly message: string;
  readonly limit?: number;
  readonly actual?: number;
}

/** Deterministic planner state. `ready` means execution can replace the source bundle. */
export type ActionJournalRetentionPlanStatus = "unchanged" | "ready" | "unsatisfied";

/** Complete immutable retention plan, including its source and proposed bundle. */
export interface ActionJournalRetentionPlan<TAction = ActionJournalJsonValue> {
  readonly schemaVersion: typeof ACTION_JOURNAL_RETENTION_SCHEMA_VERSION;
  readonly status: ActionJournalRetentionPlanStatus;
  readonly policy: Readonly<ActionJournalRetentionPolicy>;
  readonly before: Readonly<ActionJournalRetentionStats>;
  readonly after: Readonly<ActionJournalRetentionStats>;
  readonly appliedReasons: readonly ActionJournalRetentionReason[];
  readonly droppedEntryIds: readonly string[];
  readonly droppedCheckpointIds: readonly string[];
  readonly unsatisfiedConstraints: readonly ActionJournalRetentionUnsatisfiedConstraint[];
  readonly source: Readonly<ActionJournalRetentionBundle<TAction>>;
  readonly retained: Readonly<ActionJournalRetentionBundle<TAction>>;
}

/** Pure execution result. Unsatisfied plans preserve the source bundle exactly. */
export interface ActionJournalRetentionResult<TAction = ActionJournalJsonValue> {
  readonly schemaVersion: typeof ACTION_JOURNAL_RETENTION_SCHEMA_VERSION;
  readonly status: ActionJournalRetentionPlanStatus;
  readonly applied: boolean;
  readonly policy: Readonly<ActionJournalRetentionPolicy>;
  readonly before: Readonly<ActionJournalRetentionStats>;
  readonly after: Readonly<ActionJournalRetentionStats>;
  readonly appliedReasons: readonly ActionJournalRetentionReason[];
  readonly droppedEntryIds: readonly string[];
  readonly droppedCheckpointIds: readonly string[];
  readonly unsatisfiedConstraints: readonly ActionJournalRetentionUnsatisfiedConstraint[];
  readonly bundle: Readonly<ActionJournalRetentionBundle<TAction>>;
}

/** Stable retention validation failures. */
export type ActionJournalRetentionErrorCode =
  | "invalid-policy"
  | "invalid-compatibility"
  | "invalid-checkpoint";

/** Typed validation error for retention inputs. */
export class ActionJournalRetentionError extends Error {
  constructor(
    readonly code: ActionJournalRetentionErrorCode,
    message: string,
    readonly path = "$",
    options: ErrorOptions = {},
  ) {
    super(message, options);
    this.name = "ActionJournalRetentionError";
  }
}

interface Candidate<TAction> {
  readonly bundle: Readonly<ActionJournalRetentionBundle<TAction>>;
  readonly stats: Readonly<ActionJournalRetentionStats>;
  readonly checkpointCanonical: string;
  readonly sourceCheckpointId?: string;
}

/**
 * Builds a deterministic, fail-closed retention plan.
 *
 * Entry pruning is considered only at a compatible checkpoint revision. The
 * retained journal is rebased to that revision and must still pass the journal
 * validator, which proves a contiguous causal tail. The planner first computes
 * the earliest entry boundary required by all policies, then chooses the newest
 * compatible checkpoint at or before that boundary. Canonical byte size and
 * canonical checkpoint bytes provide deterministic tie-breakers.
 */
export function planActionJournalRetention<TAction = ActionJournalJsonValue>(
  input: ActionJournalRetentionInput<TAction>,
): Readonly<ActionJournalRetentionPlan<TAction>> {
  const journal = normalizeActionJournalSnapshot(input.journal);
  const checkpoints = normalizeCheckpoints(input.checkpoints ?? []);
  const source = retentionBundle(journal, checkpoints);
  const policy = normalizePolicy(input.policy);
  const compatibility = normalizeCompatibility(input.compatibleComponents ?? []);
  const before = retentionStats(source);
  const policyViolations = evaluateConstraints(source, before, policy);
  const clockProblem = evaluateClock(journal, policy);

  if (clockProblem) {
    return retentionPlan({
      status: "unsatisfied",
      policy,
      before,
      after: before,
      appliedReasons: [],
      droppedEntryIds: [],
      droppedCheckpointIds: [],
      unsatisfiedConstraints: [clockProblem],
      source,
      retained: source,
    });
  }

  if (policyViolations.length === 0) {
    return retentionPlan({
      status: "unchanged",
      policy,
      before,
      after: before,
      appliedReasons: [],
      droppedEntryIds: [],
      droppedCheckpointIds: [],
      unsatisfiedConstraints: [],
      source,
      retained: source,
    });
  }

  const firstKeptRevision = retentionBoundary(journal, policy);
  const candidates = buildCandidates(journal, checkpoints, compatibility, firstKeptRevision);
  const complete = candidates[0]!;
  const selected = evaluateConstraints(complete.bundle, complete.stats, policy).length === 0
    ? complete
    : candidates.slice(1).sort(compareCheckpointCandidates).find((candidate) =>
      evaluateConstraints(candidate.bundle, candidate.stats, policy).length === 0
    );

  if (!selected) {
    return retentionPlan({
      status: "unsatisfied",
      policy,
      before,
      after: before,
      appliedReasons: [],
      droppedEntryIds: [],
      droppedCheckpointIds: [],
      unsatisfiedConstraints: [
        ...policyViolations.map((violation) => ({
          ...violation,
          message: `${violation.message}; no replay-safe retained bundle satisfies all requested limits`,
        })),
        {
          constraint: "replay-safety" as const,
          message: "no compatible checkpoint produces a contiguous causal tail within all requested limits",
        },
      ],
      source,
      retained: source,
    });
  }

  const retainedEntryRevisions = new Set(selected.bundle.journal.entries.map((entry) => entry.revision));
  const retainedCheckpointIds = new Set(
    selected.sourceCheckpointId === undefined ? [] : [selected.sourceCheckpointId],
  );
  return retentionPlan({
    status: "ready",
    policy,
    before,
    after: selected.stats,
    appliedReasons: policyViolations.map((violation) => violation.constraint as ActionJournalRetentionReason),
    droppedEntryIds: journal.entries
      .filter((entry) => !retainedEntryRevisions.has(entry.revision))
      .map((entry) => actionJournalRetentionEntryId(journal.journalId, entry.revision)),
    droppedCheckpointIds: checkpoints
      .map(actionJournalRetentionCheckpointId)
      .filter((id) => !retainedCheckpointIds.has(id)),
    unsatisfiedConstraints: [],
    source,
    retained: selected.bundle,
  });
}

/** Executes a plan without mutating its source journal or checkpoint records. */
export function executeActionJournalRetention<TAction = ActionJournalJsonValue>(
  plan: ActionJournalRetentionPlan<TAction>,
): Readonly<ActionJournalRetentionResult<TAction>> {
  const bundle = plan.status === "ready" ? plan.retained : plan.source;
  return freezeValue({
    schemaVersion: ACTION_JOURNAL_RETENTION_SCHEMA_VERSION,
    status: plan.status,
    applied: plan.status === "ready",
    policy: plan.policy,
    before: plan.before,
    after: plan.status === "ready" ? plan.after : plan.before,
    appliedReasons: [...plan.appliedReasons],
    droppedEntryIds: plan.status === "ready" ? [...plan.droppedEntryIds] : [],
    droppedCheckpointIds: plan.status === "ready" ? [...plan.droppedCheckpointIds] : [],
    unsatisfiedConstraints: [...plan.unsatisfiedConstraints],
    bundle,
  });
}

/** Convenience composition of pure planning and execution. */
export function retainActionJournal<TAction = ActionJournalJsonValue>(
  input: ActionJournalRetentionInput<TAction>,
): Readonly<ActionJournalRetentionResult<TAction>> {
  return executeActionJournalRetention(planActionJournalRetention(input));
}

/** Stable checkpoint identity that contains no component state. */
export function actionJournalRetentionCheckpointId(checkpoint: ActionJournalCheckpointRecord): string {
  const normalized = normalizeActionJournalCheckpoint(checkpoint);
  return `${normalized.journalId}@${normalized.revision}:${normalized.journalHash}:${normalized.stateHash}`;
}

/** Stable entry identity derived from journal identity and monotonic revision. */
export function actionJournalRetentionEntryId(journalId: string, revision: number): string {
  if (typeof journalId !== "string" || !journalId.trim() || journalId !== journalId.trim()) {
    throw new ActionJournalRetentionError("invalid-policy", "journal id must be stable non-empty text", "$.journalId");
  }
  if (!Number.isSafeInteger(revision) || revision < 0) {
    throw new ActionJournalRetentionError(
      "invalid-policy",
      "entry revision must be a non-negative safe integer",
      "$.revision",
    );
  }
  return `${journalId}@${revision}`;
}

/** Canonical UTF-8 byte count; deliberately not JavaScript string length. */
export function canonicalActionJournalUtf8Bytes(value: unknown): number {
  return new TextEncoder().encode(canonicalActionJournalJson(value)).byteLength;
}

/** Converts checkpoint-registry inspection rows into pure compatibility data. */
export function actionJournalRetentionCompatibilityFromInspection(
  components: readonly ActionJournalCheckpointComponentInspection[],
): readonly ActionJournalRetentionComponentCompatibility[] {
  return freezeValue(
    components.map((component) => ({
      componentId: component.componentId,
      schemaVersions: [
        ...new Set([
          component.schemaVersion,
          ...component.migrationSourceVersions,
        ]),
      ].sort((left, right) => left - right),
    })).sort((left, right) => compareText(left.componentId, right.componentId)),
  );
}

function buildCandidates<TAction>(
  journal: Readonly<ActionJournalSnapshot<TAction>>,
  checkpoints: readonly Readonly<ActionJournalCheckpointRecord>[],
  compatibility: ReadonlyMap<string, ReadonlySet<number>>,
  firstKeptRevision: number,
): Candidate<TAction>[] {
  // The complete journal remains replayable from caller-owned initial state;
  // dropping checkpoints alone is therefore always a safe candidate.
  const complete = retentionBundle(journal, []);
  const candidates: Candidate<TAction>[] = [{
    bundle: complete,
    stats: retentionStats(complete),
    checkpointCanonical: "",
  }];

  for (const checkpoint of checkpoints) {
    if (checkpoint.revision > firstKeptRevision) continue;
    if (!isCompatibleCheckpoint(journal, checkpoint, compatibility)) continue;
    const offset = checkpoint.revision - journal.baseRevision;
    let tail: Readonly<ActionJournalSnapshot<TAction>>;
    try {
      tail = normalizeActionJournalSnapshot({
        schemaVersion: journal.schemaVersion,
        journalId: journal.journalId,
        baseRevision: checkpoint.revision,
        entries: journal.entries.slice(offset),
      });
    } catch {
      // Rebasing would strand a backward causal edge, so this checkpoint is
      // not a valid retention boundary.
      continue;
    }
    const retainedCheckpoint = rebaseCheckpoint(checkpoint, tail);
    const bundle = retentionBundle(tail, [retainedCheckpoint]);
    candidates.push({
      bundle,
      stats: retentionStats(bundle),
      checkpointCanonical: canonicalActionJournalCheckpointJson(retainedCheckpoint),
      sourceCheckpointId: actionJournalRetentionCheckpointId(checkpoint),
    });
  }
  return candidates;
}

function rebaseCheckpoint<TAction>(
  checkpoint: Readonly<ActionJournalCheckpointRecord>,
  tail: Readonly<ActionJournalSnapshot<TAction>>,
): Readonly<ActionJournalCheckpointRecord> {
  return normalizeActionJournalCheckpoint({
    schemaVersion: checkpoint.schemaVersion,
    hashAlgorithm: checkpoint.hashAlgorithm,
    journalId: checkpoint.journalId,
    baseRevision: checkpoint.revision,
    revision: checkpoint.revision,
    journalHash: actionJournalCheckpointHash(tail, checkpoint.revision),
    stateHash: checkpoint.stateHash,
    causalPosition: { revision: checkpoint.revision, parentRevision: null },
    components: checkpoint.components,
  });
}

function compareCheckpointCandidates<TAction>(left: Candidate<TAction>, right: Candidate<TAction>): number {
  const revisionOrder = right.stats.baseRevision - left.stats.baseRevision;
  if (revisionOrder !== 0) return revisionOrder;
  const byteOrder = left.stats.totalBytes - right.stats.totalBytes;
  if (byteOrder !== 0) return byteOrder;
  return compareText(left.checkpointCanonical, right.checkpointCanonical);
}

function retentionBoundary<TAction>(
  journal: Readonly<ActionJournalSnapshot<TAction>>,
  policy: Readonly<ActionJournalRetentionPolicy>,
): number {
  let firstKeptIndex = 0;
  if (policy.maxEntryCount !== undefined) {
    firstKeptIndex = Math.max(firstKeptIndex, journal.entries.length - policy.maxEntryCount);
  }
  if (policy.maxAge !== undefined) {
    const cutoff = policy.referenceTimestamp! - policy.maxAge;
    const ageIndex = journal.entries.findIndex((entry) => entry.timestamp >= cutoff);
    firstKeptIndex = Math.max(firstKeptIndex, ageIndex < 0 ? journal.entries.length : ageIndex);
  }
  if (policy.maxCanonicalBytes !== undefined) {
    let byteIndex = journal.entries.length + 1;
    for (let index = 0; index <= journal.entries.length; index += 1) {
      try {
        const tail = normalizeActionJournalSnapshot({
          schemaVersion: journal.schemaVersion,
          journalId: journal.journalId,
          baseRevision: journal.baseRevision + index,
          entries: journal.entries.slice(index),
        });
        if (canonicalActionJournalUtf8Bytes(tail) <= policy.maxCanonicalBytes) {
          byteIndex = index;
          break;
        }
      } catch {
        // This index is not a contiguous causal boundary.
      }
    }
    firstKeptIndex = Math.max(firstKeptIndex, byteIndex);
  }
  return journal.entries[firstKeptIndex]?.revision ??
    (journal.entries.at(-1)?.revision ?? journal.baseRevision) + 1;
}

function isCompatibleCheckpoint<TAction>(
  journal: Readonly<ActionJournalSnapshot<TAction>>,
  checkpoint: Readonly<ActionJournalCheckpointRecord>,
  compatibility: ReadonlyMap<string, ReadonlySet<number>>,
): boolean {
  const finalRevision = journal.entries.at(-1)?.revision ?? journal.baseRevision;
  if (
    checkpoint.journalId !== journal.journalId ||
    checkpoint.baseRevision !== journal.baseRevision ||
    checkpoint.revision < journal.baseRevision ||
    checkpoint.revision > finalRevision ||
    compatibility.size === 0 ||
    checkpoint.components.length !== compatibility.size
  ) {
    return false;
  }
  if (checkpoint.journalHash !== actionJournalCheckpointHash(journal, checkpoint.revision)) return false;
  if (
    canonicalActionJournalJson(checkpoint.causalPosition) !==
      canonicalActionJournalJson(causalPositionAt(journal, checkpoint.revision))
  ) {
    return false;
  }
  for (const component of checkpoint.components) {
    if (!compatibility.get(component.componentId)?.has(component.schemaVersion)) return false;
  }
  return true;
}

function causalPositionAt<TAction>(
  journal: Readonly<ActionJournalSnapshot<TAction>>,
  revision: number,
): Record<string, ActionJournalJsonValue> {
  if (revision === journal.baseRevision) return { revision, parentRevision: null };
  const entry = journal.entries[revision - journal.baseRevision - 1]!;
  return {
    revision,
    parentRevision: entry.causality.parentRevision,
    ...(entry.causality.correlationId === undefined ? {} : { correlationId: entry.causality.correlationId }),
    ...(entry.causality.source === undefined ? {} : { source: entry.causality.source }),
  };
}

function retentionStats<TAction>(
  bundle: Readonly<ActionJournalRetentionBundle<TAction>>,
): Readonly<ActionJournalRetentionStats> {
  const journalBytes = canonicalActionJournalUtf8Bytes(bundle.journal);
  const checkpointBytes = bundle.checkpoints.reduce(
    (total, checkpoint) =>
      total + new TextEncoder().encode(canonicalActionJournalCheckpointJson(checkpoint)).byteLength,
    0,
  );
  return freezeValue({
    baseRevision: bundle.journal.baseRevision,
    firstRevision: bundle.journal.entries[0]?.revision,
    lastRevision: bundle.journal.entries.at(-1)?.revision,
    entryCount: bundle.journal.entries.length,
    checkpointCount: bundle.checkpoints.length,
    journalBytes,
    checkpointBytes,
    totalBytes: journalBytes + checkpointBytes,
  });
}

function evaluateConstraints<TAction>(
  bundle: Readonly<ActionJournalRetentionBundle<TAction>>,
  stats: Readonly<ActionJournalRetentionStats>,
  policy: Readonly<ActionJournalRetentionPolicy>,
): ActionJournalRetentionUnsatisfiedConstraint[] {
  const failures: ActionJournalRetentionUnsatisfiedConstraint[] = [];
  if (policy.maxEntryCount !== undefined && stats.entryCount > policy.maxEntryCount) {
    failures.push({
      constraint: "max-entry-count",
      message: "retained entry count exceeds the configured maximum",
      limit: policy.maxEntryCount,
      actual: stats.entryCount,
    });
  }
  if (policy.maxCanonicalBytes !== undefined && stats.totalBytes > policy.maxCanonicalBytes) {
    failures.push({
      constraint: "max-canonical-bytes",
      message: "retained canonical UTF-8 bytes exceed the configured maximum",
      limit: policy.maxCanonicalBytes,
      actual: stats.totalBytes,
    });
  }
  if (policy.maxAge !== undefined) {
    const oldestAge = bundle.journal.entries.reduce(
      (maximum, entry) => Math.max(maximum, policy.referenceTimestamp! - entry.timestamp),
      0,
    );
    if (oldestAge > policy.maxAge) {
      failures.push({
        constraint: "max-age",
        message: "retained journal tail contains entries older than the configured maximum age",
        limit: policy.maxAge,
        actual: oldestAge,
      });
    }
  }
  return failures;
}

function evaluateClock<TAction>(
  journal: Readonly<ActionJournalSnapshot<TAction>>,
  policy: Readonly<ActionJournalRetentionPolicy>,
): ActionJournalRetentionUnsatisfiedConstraint | undefined {
  if (policy.maxAge === undefined) return undefined;
  let previous = Number.NEGATIVE_INFINITY;
  for (const entry of journal.entries) {
    if (entry.timestamp < previous || entry.timestamp > policy.referenceTimestamp!) {
      return {
        constraint: "clock-regression",
        message: "age retention requires nondecreasing entry timestamps not later than the reference timestamp",
        actual: entry.timestamp,
        limit: policy.referenceTimestamp,
      };
    }
    previous = entry.timestamp;
  }
  return undefined;
}

function normalizePolicy(policy: ActionJournalRetentionPolicy): Readonly<ActionJournalRetentionPolicy> {
  if (!isPlainRecord(policy)) {
    throw new ActionJournalRetentionError("invalid-policy", "retention policy must be a plain object", "$.policy");
  }
  const maxEntryCount = optionalNonNegativeInteger(policy.maxEntryCount, "$.policy.maxEntryCount");
  const maxCanonicalBytes = optionalNonNegativeInteger(
    policy.maxCanonicalBytes,
    "$.policy.maxCanonicalBytes",
  );
  const maxAge = optionalNonNegativeFinite(policy.maxAge, "$.policy.maxAge");
  const referenceTimestamp = optionalFinite(policy.referenceTimestamp, "$.policy.referenceTimestamp");
  if (maxAge !== undefined && referenceTimestamp === undefined) {
    throw new ActionJournalRetentionError(
      "invalid-policy",
      "maxAge requires an explicit referenceTimestamp",
      "$.policy.referenceTimestamp",
    );
  }
  return freezeValue({
    ...(maxEntryCount === undefined ? {} : { maxEntryCount }),
    ...(maxCanonicalBytes === undefined ? {} : { maxCanonicalBytes }),
    ...(maxAge === undefined ? {} : { maxAge }),
    ...(referenceTimestamp === undefined ? {} : { referenceTimestamp }),
  });
}

function normalizeCompatibility(
  rows: readonly ActionJournalRetentionComponentCompatibility[],
): ReadonlyMap<string, ReadonlySet<number>> {
  const result = new Map<string, ReadonlySet<number>>();
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index]!;
    const path = `$.compatibleComponents[${index}]`;
    if (!isPlainRecord(row)) {
      throw new ActionJournalRetentionError(
        "invalid-compatibility",
        "component compatibility must be a plain object",
        path,
      );
    }
    const componentId = stableComponentId(row.componentId, `${path}.componentId`);
    if (result.has(componentId)) {
      throw new ActionJournalRetentionError(
        "invalid-compatibility",
        `duplicate component compatibility for ${componentId}`,
        `${path}.componentId`,
      );
    }
    if (!Array.isArray(row.schemaVersions) || row.schemaVersions.length === 0) {
      throw new ActionJournalRetentionError(
        "invalid-compatibility",
        "component compatibility requires at least one schema version",
        `${path}.schemaVersions`,
      );
    }
    const versions = new Set<number>();
    for (let versionIndex = 0; versionIndex < row.schemaVersions.length; versionIndex += 1) {
      const version = row.schemaVersions[versionIndex];
      if (!Number.isSafeInteger(version) || version! < 1) {
        throw new ActionJournalRetentionError(
          "invalid-compatibility",
          "component schema versions must be positive safe integers",
          `${path}.schemaVersions[${versionIndex}]`,
        );
      }
      versions.add(version!);
    }
    result.set(componentId, versions);
  }
  return result;
}

function normalizeCheckpoints(
  checkpoints: readonly ActionJournalCheckpointRecord[],
): readonly Readonly<ActionJournalCheckpointRecord>[] {
  const unique = new Map<string, Readonly<ActionJournalCheckpointRecord>>();
  for (let index = 0; index < checkpoints.length; index += 1) {
    try {
      const checkpoint = normalizeActionJournalCheckpoint(checkpoints[index]);
      unique.set(canonicalActionJournalCheckpointJson(checkpoint), checkpoint);
    } catch (cause) {
      throw new ActionJournalRetentionError(
        "invalid-checkpoint",
        "retention input contains an invalid checkpoint record",
        `$.checkpoints[${index}]`,
        { cause },
      );
    }
  }
  return Object.freeze(
    [...unique.entries()]
      .sort((left, right) => left[1].revision - right[1].revision || compareText(left[0], right[0]))
      .map((entry) => entry[1]),
  );
}

function retentionBundle<TAction>(
  journal: Readonly<ActionJournalSnapshot<TAction>>,
  checkpoints: readonly Readonly<ActionJournalCheckpointRecord>[],
): Readonly<ActionJournalRetentionBundle<TAction>> {
  return freezeValue({ journal, checkpoints: [...checkpoints] });
}

function retentionPlan<TAction>(
  fields: Omit<ActionJournalRetentionPlan<TAction>, "schemaVersion">,
): Readonly<ActionJournalRetentionPlan<TAction>> {
  return freezeValue({
    schemaVersion: ACTION_JOURNAL_RETENTION_SCHEMA_VERSION,
    ...fields,
  });
}

function optionalNonNegativeInteger(value: unknown, path: string): number | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw new ActionJournalRetentionError(
      "invalid-policy",
      "retention count and byte limits must be non-negative safe integers",
      path,
    );
  }
  return value;
}

function optionalNonNegativeFinite(value: unknown, path: string): number | undefined {
  const normalized = optionalFinite(value, path);
  if (normalized !== undefined && normalized < 0) {
    throw new ActionJournalRetentionError("invalid-policy", "retention age must be non-negative", path);
  }
  return normalized;
}

function optionalFinite(value: unknown, path: string): number | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new ActionJournalRetentionError("invalid-policy", "retention timestamp must be finite", path);
  }
  return Object.is(value, -0) ? 0 : value;
}

function stableComponentId(value: unknown, path: string): string {
  if (typeof value !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$/.test(value)) {
    throw new ActionJournalRetentionError(
      "invalid-compatibility",
      "component id must be a stable 1-128 character identifier",
      path,
    );
  }
  return value;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function freezeValue<T>(value: T): T {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) freezeValue(child);
  return Object.freeze(value);
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
