// Copyright 2023 Im-Beast. MIT license.
import type { ScreenDefinition, ScreenStack, ScreenStackInspection } from "./screens.ts";

/** Stable schema identifier for persisted named screen-stack state. */
export const SCREEN_STACK_SNAPSHOT_SCHEMA = "deno-tui.screen-stack";

/** Current persisted screen-stack schema version. */
export const SCREEN_STACK_SNAPSHOT_VERSION = 1;

/** Per-screen persistence policy. Screens default to non-restorable. */
export interface ScreenRestorePolicy {
  readonly restorable?: boolean;
}

/** Registry identity saved with a snapshot to reject semantically stale state. */
export interface ScreenRegistrySnapshotMetadata {
  readonly version: string;
  readonly fingerprint: string;
}

/**
 * Clone-safe persisted state for one exact named mode.
 *
 * Runtime callbacks, modal promises, focus tokens, lifecycle resources,
 * screen definitions, stack revision, and disposed state are intentionally
 * absent. `screens` is ordered from the bottom of the stack to the active top.
 */
export interface ScreenStackSnapshot {
  readonly schema: typeof SCREEN_STACK_SNAPSHOT_SCHEMA;
  readonly version: typeof SCREEN_STACK_SNAPSHOT_VERSION;
  readonly mode: string;
  readonly registry: ScreenRegistrySnapshotMetadata;
  readonly screens: readonly string[];
}

/** Persistence phase associated with one structured diagnostic. */
export type ScreenPersistenceOperation = "snapshot" | "migration" | "validation" | "restore";

/** Stable structured persistence failure categories. */
export type ScreenPersistenceDiagnosticCode =
  | "invalid-options"
  | "disposed-stack"
  | "live-modal-state"
  | "modal-state-not-persistable"
  | "non-restorable-screen"
  | "unsafe-value"
  | "invalid-version"
  | "unsupported-version"
  | "missing-migration"
  | "ambiguous-migration"
  | "invalid-migration"
  | "migration-failed"
  | "invalid-schema"
  | "unknown-field"
  | "invalid-mode"
  | "mode-mismatch"
  | "invalid-registry"
  | "registry-version-mismatch"
  | "registry-fingerprint-mismatch"
  | "invalid-screen-id"
  | "duplicate-screen"
  | "unknown-screen"
  | "restore-transition-failed";

/** One immutable persistence diagnostic suitable for logs and devtools. */
export interface ScreenPersistenceDiagnostic {
  readonly code: ScreenPersistenceDiagnosticCode;
  readonly operation: ScreenPersistenceOperation;
  readonly message: string;
  readonly path?: string;
  readonly mode?: string;
  readonly screenId?: string;
  readonly sourceVersion?: number;
  readonly targetVersion?: number;
}

/** Result envelope shared by snapshot, dry-run, and restore operations. */
export interface ScreenPersistenceResult<T> {
  readonly ok: boolean;
  readonly value?: T;
  readonly diagnostics: readonly ScreenPersistenceDiagnostic[];
}

/** Context supplied to each explicit, synchronous migration hook. */
export interface ScreenStackMigrationContext {
  readonly targetVersion: typeof SCREEN_STACK_SNAPSHOT_VERSION;
  readonly mode: string;
  readonly registry: ScreenRegistrySnapshotMetadata;
}

/** One forward-only migration edge for a legacy JSON-safe snapshot. */
export interface ScreenStackSnapshotMigration {
  readonly fromVersion: number;
  readonly toVersion: number;
  migrate(value: unknown, context: ScreenStackMigrationContext): unknown;
}

/** Shared snapshot and restore policy. */
export interface ScreenPersistenceOptions {
  /** Exact mode identity. It is compared and persisted without trimming. */
  readonly mode: string;
  /** Host-owned semantic version for the registered screen definitions. */
  readonly registryVersion: string;
  /** Explicit opt-in policy; absent entries are never restored. */
  readonly screens?: Readonly<Record<string, ScreenRestorePolicy | undefined>>;
  readonly migrations?: readonly ScreenStackSnapshotMigration[];
  readonly onDiagnostic?: (diagnostic: ScreenPersistenceDiagnostic) => void;
}

/** Public transition used to deterministically apply a validated restore. */
export interface ScreenRestoreTransition {
  readonly operation: "switch" | "pop" | "push";
  readonly screenId: string;
}

/** Immutable dry-run output. No stack mutation occurs while producing it. */
export interface ScreenStackRestorePlan {
  readonly snapshot: ScreenStackSnapshot;
  readonly currentScreenIds: readonly string[];
  readonly targetScreenIds: readonly string[];
  readonly commonPrefixLength: number;
  readonly closeScreenIds: readonly string[];
  readonly mountScreenIds: readonly string[];
  readonly transitions: readonly ScreenRestoreTransition[];
  readonly noOp: boolean;
}

/** Successful restore output, including the exact preflight plan. */
export interface ScreenStackRestoreResult {
  readonly applied: boolean;
  readonly plan: ScreenStackRestorePlan;
  readonly inspection: ScreenStackInspection;
}

type JsonPrimitive = string | number | boolean | null;
type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

interface DiagnosticDraft extends Omit<ScreenPersistenceDiagnostic, "operation"> {
  operation?: ScreenPersistenceOperation;
}

/**
 * Returns deterministic metadata for the live screen registry and policy.
 * Registry order does not affect the fingerprint; ids and restorable flags do.
 */
export function screenRegistrySnapshotMetadata<
  TScreen extends ScreenDefinition,
  TFocusToken,
>(
  stack: ScreenStack<TScreen, TFocusToken>,
  options: Pick<ScreenPersistenceOptions, "registryVersion" | "screens">,
): ScreenRegistrySnapshotMetadata {
  const ids = [...stack.registeredIds()].sort(compareStrings);
  const descriptor = JSON.stringify([
    options.registryVersion,
    ids.map((id) => [id, isRestorable(id, options.screens)]),
  ]);
  return Object.freeze({
    version: options.registryVersion,
    fingerprint: `fnv1a32:${fnv1a32(descriptor)}`,
  });
}

/** Creates a frozen, JSON-safe snapshot for one named stack mode. */
export function snapshotScreenStack<
  TScreen extends ScreenDefinition,
  TFocusToken,
>(
  stack: ScreenStack<TScreen, TFocusToken>,
  options: ScreenPersistenceOptions,
): ScreenPersistenceResult<ScreenStackSnapshot> {
  const reporter = new PersistenceReporter(options, "snapshot");
  const registry = validatePersistenceOptions(stack, options, reporter);
  if (!registry) return reporter.failure();

  const inspection = stack.inspect();
  if (inspection.disposed) {
    reporter.add({ code: "disposed-stack", message: "disposed screen stacks cannot be snapshotted" });
  }
  for (let index = 0; index < inspection.entries.length; index += 1) {
    const entry = inspection.entries[index]!;
    if (entry.modal) {
      reporter.add({
        code: "modal-state-not-persistable",
        message: `modal screen ${entry.id} cannot be persisted`,
        path: `$.screens[${index}]`,
        mode: options.mode,
        screenId: entry.id,
      });
    }
    if (!isRestorable(entry.id, options.screens)) {
      reporter.add({
        code: "non-restorable-screen",
        message: `screen ${entry.id} is not explicitly restorable`,
        path: `$.screens[${index}]`,
        mode: options.mode,
        screenId: entry.id,
      });
    }
  }
  if (reporter.hasDiagnostics) return reporter.failure();

  return reporter.success(freezeSnapshot({
    schema: SCREEN_STACK_SNAPSHOT_SCHEMA,
    version: SCREEN_STACK_SNAPSHOT_VERSION,
    mode: options.mode,
    registry,
    screens: inspection.entries.map((entry) => entry.id),
  }));
}

/**
 * Migrates and validates a snapshot, returning the exact public transitions a
 * restore would execute. The target stack is never mutated by this function.
 */
export function dryRunScreenStackRestore<
  TScreen extends ScreenDefinition,
  TFocusToken,
>(
  stack: ScreenStack<TScreen, TFocusToken>,
  value: unknown,
  options: ScreenPersistenceOptions,
): ScreenPersistenceResult<ScreenStackRestorePlan> {
  const reporter = new PersistenceReporter(options, "validation");
  const plan = prepareRestore(stack, value, options, reporter);
  return plan ? reporter.success(plan) : reporter.failure();
}

/**
 * Restores a fully preflighted snapshot through `ScreenStack` public methods.
 *
 * Validation, migration, registry checks, policies, and live-modal checks all
 * finish before the first transition. Shared bottom entries remain mounted;
 * divergent entries close top-down before target entries mount bottom-up.
 */
export function restoreScreenStackSnapshot<
  TScreen extends ScreenDefinition,
  TFocusToken,
>(
  stack: ScreenStack<TScreen, TFocusToken>,
  value: unknown,
  options: ScreenPersistenceOptions,
): ScreenPersistenceResult<ScreenStackRestoreResult> {
  const reporter = new PersistenceReporter(options, "restore");
  const plan = prepareRestore(stack, value, options, reporter);
  if (!plan) return reporter.failure();

  let expected = [...plan.currentScreenIds];
  for (const transition of plan.transitions) {
    if (!equalStrings(stack.stackIds(), expected)) {
      reporter.add({
        code: "restore-transition-failed",
        message: "live stack changed after restore preflight",
        mode: options.mode,
        screenId: transition.screenId,
      });
      return reporter.failure();
    }

    let applied = false;
    switch (transition.operation) {
      case "switch": {
        applied = stack.switch(transition.screenId);
        const targetIndex = expected.indexOf(transition.screenId);
        expected = expected.slice(0, targetIndex + 1);
        break;
      }
      case "pop":
        applied = expected.at(-1) === transition.screenId && stack.pop();
        expected.pop();
        break;
      case "push":
        applied = stack.push(transition.screenId);
        expected.push(transition.screenId);
        break;
    }

    if (!applied || !equalStrings(stack.stackIds(), expected)) {
      reporter.add({
        code: "restore-transition-failed",
        message: `${transition.operation} transition failed while restoring screen ${transition.screenId}`,
        mode: options.mode,
        screenId: transition.screenId,
      });
      return reporter.failure();
    }
  }

  if (!equalStrings(stack.stackIds(), plan.targetScreenIds)) {
    reporter.add({
      code: "restore-transition-failed",
      message: "restored stack does not match the validated target",
      mode: options.mode,
    });
    return reporter.failure();
  }

  return reporter.success(Object.freeze({
    applied: !plan.noOp,
    plan,
    inspection: stack.inspect(),
  }));
}

function prepareRestore<TScreen extends ScreenDefinition, TFocusToken>(
  stack: ScreenStack<TScreen, TFocusToken>,
  value: unknown,
  options: ScreenPersistenceOptions,
  reporter: PersistenceReporter,
): ScreenStackRestorePlan | undefined {
  const registry = validatePersistenceOptions(stack, options, reporter);
  if (!registry) return undefined;

  const inspection = stack.inspect();
  if (inspection.disposed) {
    reporter.add({
      code: "disposed-stack",
      message: "disposed screen stacks cannot be restored",
      mode: options.mode,
    });
    return undefined;
  }
  for (let index = 0; index < inspection.entries.length; index += 1) {
    const entry = inspection.entries[index]!;
    if (entry.modal) {
      reporter.add({
        code: "live-modal-state",
        message: `restore would settle the live modal screen ${entry.id}; dismiss it explicitly first`,
        path: `$live[${index}]`,
        mode: options.mode,
        screenId: entry.id,
      });
    }
    if (!isRestorable(entry.id, options.screens)) {
      reporter.add({
        code: "non-restorable-screen",
        message: `live screen ${entry.id} is not explicitly restorable and cannot be replaced by restore`,
        path: `$live[${index}]`,
        mode: options.mode,
        screenId: entry.id,
      });
    }
  }
  if (reporter.hasDiagnostics) return undefined;

  const migrated = migrateSnapshotValue(value, options, registry, reporter);
  if (migrated === undefined) return undefined;
  const snapshot = parseCurrentSnapshot(migrated, reporter);
  if (!snapshot) return undefined;

  if (snapshot.mode !== options.mode) {
    reporter.add({
      code: "mode-mismatch",
      message: `snapshot mode ${JSON.stringify(snapshot.mode)} does not match ${JSON.stringify(options.mode)}`,
      path: "$.mode",
      mode: snapshot.mode,
    });
  }
  if (snapshot.registry.version !== registry.version) {
    reporter.add({
      code: "registry-version-mismatch",
      message: `registry version ${JSON.stringify(snapshot.registry.version)} does not match current version ${
        JSON.stringify(registry.version)
      }`,
      path: "$.registry.version",
      mode: snapshot.mode,
    });
  }
  if (snapshot.registry.fingerprint !== registry.fingerprint) {
    reporter.add({
      code: "registry-fingerprint-mismatch",
      message: "snapshot registry fingerprint does not match the current screen registry and restore policy",
      path: "$.registry.fingerprint",
      mode: snapshot.mode,
    });
  }

  for (let index = 0; index < snapshot.screens.length; index += 1) {
    const id = snapshot.screens[index]!;
    if (!stack.has(id)) {
      reporter.add({
        code: "unknown-screen",
        message: `snapshot references unknown screen ${id}`,
        path: `$.screens[${index}]`,
        mode: snapshot.mode,
        screenId: id,
      });
    } else if (!isRestorable(id, options.screens)) {
      reporter.add({
        code: "non-restorable-screen",
        message: `screen ${id} is not explicitly restorable`,
        path: `$.screens[${index}]`,
        mode: snapshot.mode,
        screenId: id,
      });
    }
  }
  if (reporter.hasDiagnostics) return undefined;

  return buildRestorePlan(snapshot, inspection.entries.map((entry) => entry.id));
}

function validatePersistenceOptions<TScreen extends ScreenDefinition, TFocusToken>(
  stack: ScreenStack<TScreen, TFocusToken>,
  options: ScreenPersistenceOptions,
  reporter: PersistenceReporter,
): ScreenRegistrySnapshotMetadata | undefined {
  if (typeof options.mode !== "string" || options.mode.length === 0) {
    reporter.add({
      code: "invalid-options",
      message: "persistence mode must be a non-empty string",
      path: "$options.mode",
    });
  }
  if (typeof options.registryVersion !== "string" || options.registryVersion.length === 0) {
    reporter.add({
      code: "invalid-options",
      message: "registryVersion must be a non-empty string",
      path: "$options.registryVersion",
    });
  }
  if (reporter.hasDiagnostics) return undefined;
  return screenRegistrySnapshotMetadata(stack, options);
}

function migrateSnapshotValue(
  value: unknown,
  options: ScreenPersistenceOptions,
  registry: ScreenRegistrySnapshotMetadata,
  reporter: PersistenceReporter,
): JsonValue | undefined {
  let current: JsonValue;
  try {
    current = cloneJsonValue(value);
  } catch (error) {
    reporter.add({
      code: "unsafe-value",
      operation: "validation",
      message: errorMessage(error),
      path: error instanceof JsonCloneError ? error.path : "$",
    });
    return undefined;
  }

  let version = snapshotVersion(current);
  if (version === undefined) {
    reporter.add({
      code: "invalid-version",
      operation: "validation",
      message: "snapshot version must be a non-negative integer",
      path: "$.version",
    });
    return undefined;
  }
  if (version > SCREEN_STACK_SNAPSHOT_VERSION) {
    reporter.add({
      code: "unsupported-version",
      operation: "validation",
      message: `snapshot version ${version} is newer than supported version ${SCREEN_STACK_SNAPSHOT_VERSION}`,
      path: "$.version",
      sourceVersion: version,
      targetVersion: SCREEN_STACK_SNAPSHOT_VERSION,
    });
    return undefined;
  }

  const context: ScreenStackMigrationContext = Object.freeze({
    targetVersion: SCREEN_STACK_SNAPSHOT_VERSION,
    mode: options.mode,
    registry,
  });
  let steps = 0;
  while (version < SCREEN_STACK_SNAPSHOT_VERSION) {
    if (steps++ >= 32) {
      reporter.add({
        code: "invalid-migration",
        operation: "migration",
        message: "migration chain exceeded 32 forward steps",
        sourceVersion: version,
        targetVersion: SCREEN_STACK_SNAPSHOT_VERSION,
      });
      return undefined;
    }
    const candidates = (options.migrations ?? []).filter((migration) => migration.fromVersion === version);
    if (candidates.length === 0) {
      reporter.add({
        code: "missing-migration",
        operation: "migration",
        message: `no migration registered from snapshot version ${version}`,
        sourceVersion: version,
        targetVersion: SCREEN_STACK_SNAPSHOT_VERSION,
      });
      return undefined;
    }
    if (candidates.length > 1) {
      reporter.add({
        code: "ambiguous-migration",
        operation: "migration",
        message: `multiple migrations are registered from snapshot version ${version}`,
        sourceVersion: version,
        targetVersion: SCREEN_STACK_SNAPSHOT_VERSION,
      });
      return undefined;
    }

    const migration = candidates[0]!;
    if (
      !Number.isInteger(migration.toVersion) || migration.toVersion <= version ||
      migration.toVersion > SCREEN_STACK_SNAPSHOT_VERSION
    ) {
      reporter.add({
        code: "invalid-migration",
        operation: "migration",
        message: `migration ${version} -> ${migration.toVersion} is not a valid forward edge`,
        sourceVersion: version,
        targetVersion: migration.toVersion,
      });
      return undefined;
    }

    try {
      const migrationInput = cloneJsonValue(current);
      current = cloneJsonValue(migration.migrate(migrationInput, context));
    } catch (error) {
      reporter.add({
        code: "migration-failed",
        operation: "migration",
        message: `migration ${version} -> ${migration.toVersion} failed: ${errorMessage(error)}`,
        sourceVersion: version,
        targetVersion: migration.toVersion,
      });
      return undefined;
    }

    const outputVersion = snapshotVersion(current);
    if (outputVersion !== migration.toVersion) {
      reporter.add({
        code: "invalid-migration",
        operation: "migration",
        message: `migration ${version} -> ${migration.toVersion} produced version ${String(outputVersion)}`,
        path: "$.version",
        sourceVersion: version,
        targetVersion: migration.toVersion,
      });
      return undefined;
    }
    version = outputVersion;
  }
  return current;
}

function parseCurrentSnapshot(
  value: JsonValue,
  reporter: PersistenceReporter,
): ScreenStackSnapshot | undefined {
  if (!isJsonObject(value)) {
    reporter.add({
      code: "invalid-schema",
      operation: "validation",
      message: "screen stack snapshot must be an object",
      path: "$",
    });
    return undefined;
  }

  reportUnknownFields(value, ["schema", "version", "mode", "registry", "screens"], "$", reporter);
  if (value.schema !== SCREEN_STACK_SNAPSHOT_SCHEMA) {
    reporter.add({
      code: "invalid-schema",
      operation: "validation",
      message: `snapshot schema must be ${SCREEN_STACK_SNAPSHOT_SCHEMA}`,
      path: "$.schema",
    });
  }
  if (value.version !== SCREEN_STACK_SNAPSHOT_VERSION) {
    reporter.add({
      code: "invalid-version",
      operation: "validation",
      message: `snapshot version must be ${SCREEN_STACK_SNAPSHOT_VERSION}`,
      path: "$.version",
    });
  }
  if (typeof value.mode !== "string" || value.mode.length === 0) {
    reporter.add({
      code: "invalid-mode",
      operation: "validation",
      message: "snapshot mode must be a non-empty string",
      path: "$.mode",
    });
  }

  let registry: ScreenRegistrySnapshotMetadata | undefined;
  if (!isJsonObject(value.registry)) {
    reporter.add({
      code: "invalid-registry",
      operation: "validation",
      message: "snapshot registry metadata must be an object",
      path: "$.registry",
    });
  } else {
    reportUnknownFields(value.registry, ["version", "fingerprint"], "$.registry", reporter);
    if (typeof value.registry.version !== "string" || value.registry.version.length === 0) {
      reporter.add({
        code: "invalid-registry",
        operation: "validation",
        message: "snapshot registry version must be a non-empty string",
        path: "$.registry.version",
      });
    }
    if (typeof value.registry.fingerprint !== "string" || value.registry.fingerprint.length === 0) {
      reporter.add({
        code: "invalid-registry",
        operation: "validation",
        message: "snapshot registry fingerprint must be a non-empty string",
        path: "$.registry.fingerprint",
      });
    }
    if (
      typeof value.registry.version === "string" && value.registry.version.length > 0 &&
      typeof value.registry.fingerprint === "string" && value.registry.fingerprint.length > 0
    ) {
      registry = Object.freeze({
        version: value.registry.version,
        fingerprint: value.registry.fingerprint,
      });
    }
  }

  const screens: string[] = [];
  if (!Array.isArray(value.screens)) {
    reporter.add({
      code: "invalid-schema",
      operation: "validation",
      message: "snapshot screens must be an array",
      path: "$.screens",
    });
  } else {
    const seen = new Set<string>();
    for (let index = 0; index < value.screens.length; index += 1) {
      const id = value.screens[index];
      if (typeof id !== "string" || id.length === 0 || id.trim() !== id) {
        reporter.add({
          code: "invalid-screen-id",
          operation: "validation",
          message: "snapshot screen ids must be non-empty strings without surrounding whitespace",
          path: `$.screens[${index}]`,
        });
        continue;
      }
      if (seen.has(id)) {
        reporter.add({
          code: "duplicate-screen",
          operation: "validation",
          message: `snapshot contains duplicate screen ${id}`,
          path: `$.screens[${index}]`,
          screenId: id,
        });
        continue;
      }
      seen.add(id);
      screens.push(id);
    }
  }

  if (
    typeof value.mode !== "string" || value.mode.length === 0 ||
    value.version !== SCREEN_STACK_SNAPSHOT_VERSION || value.schema !== SCREEN_STACK_SNAPSHOT_SCHEMA || !registry ||
    !Array.isArray(value.screens)
  ) {
    return undefined;
  }
  return freezeSnapshot({
    schema: SCREEN_STACK_SNAPSHOT_SCHEMA,
    version: SCREEN_STACK_SNAPSHOT_VERSION,
    mode: value.mode,
    registry,
    screens,
  });
}

function buildRestorePlan(snapshot: ScreenStackSnapshot, current: readonly string[]): ScreenStackRestorePlan {
  let commonPrefixLength = 0;
  while (
    commonPrefixLength < current.length && commonPrefixLength < snapshot.screens.length &&
    current[commonPrefixLength] === snapshot.screens[commonPrefixLength]
  ) {
    commonPrefixLength += 1;
  }

  const closeScreenIds = current.slice(commonPrefixLength).reverse();
  const mountScreenIds = snapshot.screens.slice(commonPrefixLength);
  const transitions: ScreenRestoreTransition[] = [];
  if (current.length > commonPrefixLength) {
    if (commonPrefixLength > 0) {
      transitions.push(Object.freeze({
        operation: "switch",
        screenId: snapshot.screens[commonPrefixLength - 1]!,
      }));
    } else {
      for (let index = current.length - 1; index >= 0; index -= 1) {
        transitions.push(Object.freeze({ operation: "pop", screenId: current[index]! }));
      }
    }
  }
  for (const screenId of mountScreenIds) {
    transitions.push(Object.freeze({ operation: "push", screenId }));
  }

  return Object.freeze({
    snapshot,
    currentScreenIds: Object.freeze(current.slice()),
    targetScreenIds: Object.freeze(snapshot.screens.slice()),
    commonPrefixLength,
    closeScreenIds: Object.freeze(closeScreenIds),
    mountScreenIds: Object.freeze(mountScreenIds),
    transitions: Object.freeze(transitions),
    noOp: transitions.length === 0,
  });
}

function freezeSnapshot(snapshot: ScreenStackSnapshot): ScreenStackSnapshot {
  return Object.freeze({
    schema: SCREEN_STACK_SNAPSHOT_SCHEMA,
    version: SCREEN_STACK_SNAPSHOT_VERSION,
    mode: snapshot.mode,
    registry: Object.freeze({ ...snapshot.registry }),
    screens: Object.freeze(snapshot.screens.slice()),
  });
}

function reportUnknownFields(
  value: { [key: string]: JsonValue },
  allowed: readonly string[],
  path: string,
  reporter: PersistenceReporter,
): void {
  const allowedSet = new Set(allowed);
  for (const key of Object.keys(value).sort(compareStrings)) {
    if (allowedSet.has(key)) continue;
    reporter.add({
      code: "unknown-field",
      operation: "validation",
      message: `unexpected persisted field ${key}`,
      path: `${path}.${key}`,
    });
  }
}

function snapshotVersion(value: JsonValue): number | undefined {
  if (!isJsonObject(value)) return undefined;
  return typeof value.version === "number" && Number.isInteger(value.version) && value.version >= 0
    ? value.version
    : undefined;
}

function isJsonObject(value: JsonValue | undefined): value is { [key: string]: JsonValue } {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isRestorable(
  screenId: string,
  policies: ScreenPersistenceOptions["screens"],
): boolean {
  if (!policies || !Object.prototype.hasOwnProperty.call(policies, screenId)) return false;
  return policies[screenId]?.restorable === true;
}

function equalStrings(left: readonly string[], right: readonly string[]): boolean {
  if (left.length !== right.length) return false;
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) return false;
  }
  return true;
}

function compareStrings(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function fnv1a32(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function cloneJsonValue(value: unknown, path = "$", ancestors = new WeakSet<object>(), depth = 0): JsonValue {
  if (depth > 64) throw new JsonCloneError(path, "persisted value exceeds the maximum nesting depth");
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new JsonCloneError(path, "persisted numbers must be finite");
    return value;
  }
  if (typeof value !== "object") {
    throw new JsonCloneError(path, `persisted values cannot contain ${typeof value}`);
  }
  if (ancestors.has(value)) throw new JsonCloneError(path, "persisted values cannot contain cycles");
  ancestors.add(value);
  try {
    if (Array.isArray(value)) {
      for (const key of Reflect.ownKeys(value)) {
        if (key === "length") continue;
        if (typeof key !== "string" || !isArrayIndex(key, value.length)) {
          throw new JsonCloneError(path, "persisted arrays cannot contain named or symbol properties");
        }
      }
      const output = new Array<JsonValue>(value.length);
      for (let index = 0; index < value.length; index += 1) {
        if (!Object.prototype.hasOwnProperty.call(value, index)) {
          throw new JsonCloneError(`${path}[${index}]`, "persisted arrays cannot be sparse");
        }
        output[index] = cloneJsonValue(value[index], `${path}[${index}]`, ancestors, depth + 1);
      }
      return output;
    }

    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      throw new JsonCloneError(path, "persisted objects must use a plain object prototype");
    }
    const output: { [key: string]: JsonValue } = Object.create(null);
    for (const key of Reflect.ownKeys(value)) {
      if (typeof key !== "string") {
        throw new JsonCloneError(path, "persisted objects cannot contain symbol properties");
      }
      const descriptor = Object.getOwnPropertyDescriptor(value, key)!;
      if (!descriptor.enumerable || !("value" in descriptor)) {
        throw new JsonCloneError(`${path}.${key}`, "persisted fields must be enumerable data properties");
      }
      output[key] = cloneJsonValue(descriptor.value, `${path}.${key}`, ancestors, depth + 1);
    }
    return output;
  } finally {
    ancestors.delete(value);
  }
}

function isArrayIndex(key: string, length: number): boolean {
  if (!/^(0|[1-9]\d*)$/.test(key)) return false;
  const index = Number(key);
  return Number.isSafeInteger(index) && index >= 0 && index < length && String(index) === key;
}

class JsonCloneError extends Error {
  constructor(readonly path: string, message: string) {
    super(message);
    this.name = "JsonCloneError";
  }
}

class PersistenceReporter {
  readonly #diagnostics: ScreenPersistenceDiagnostic[] = [];

  constructor(
    readonly options: Pick<ScreenPersistenceOptions, "onDiagnostic">,
    readonly defaultOperation: ScreenPersistenceOperation,
  ) {}

  get hasDiagnostics(): boolean {
    return this.#diagnostics.length > 0;
  }

  add(draft: DiagnosticDraft): void {
    const diagnostic: ScreenPersistenceDiagnostic = Object.freeze({
      ...draft,
      operation: draft.operation ?? this.defaultOperation,
    });
    this.#diagnostics.push(diagnostic);
    try {
      this.options.onDiagnostic?.(diagnostic);
    } catch {
      // Diagnostic observers are advisory and cannot break validation.
    }
  }

  success<T>(value: T): ScreenPersistenceResult<T> {
    return Object.freeze({
      ok: true,
      value,
      diagnostics: Object.freeze(this.#diagnostics.slice()),
    });
  }

  failure<T>(): ScreenPersistenceResult<T> {
    return Object.freeze({
      ok: false,
      diagnostics: Object.freeze(this.#diagnostics.slice()),
    });
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
