// Copyright 2023 Im-Beast. MIT license.

/** Current schema for renderer-neutral runtime permission declarations. */
export const RUNTIME_PERMISSION_MANIFEST_SCHEMA_VERSION = 1 as const;

/** One stable runtime permission family. */
export type RuntimePermissionKind =
  | "read"
  | "write"
  | "network"
  | "environment"
  | "subprocess"
  | "ffi"
  | "clipboard"
  | "notifications"
  | "remote-session";

/** Permission families an adapter can declare before activation. */
export const RUNTIME_PERMISSION_KINDS: readonly RuntimePermissionKind[] = Object.freeze([
  "read",
  "write",
  "network",
  "environment",
  "subprocess",
  "ffi",
  "clipboard",
  "notifications",
  "remote-session",
]);

/** Operations available within each permission family. */
export interface RuntimePermissionOperations {
  readonly read: "content" | "metadata" | "watch";
  readonly write: "create" | "modify" | "remove" | "rename";
  readonly network: "connect" | "listen" | "resolve";
  readonly environment: "read" | "write";
  readonly subprocess: "spawn" | "signal";
  readonly ffi: "load" | "call";
  readonly clipboard: "read" | "write";
  readonly notifications: "show" | "update" | "close";
  readonly "remote-session": "connect" | "listen" | "view" | "control" | "share";
}

/** Valid operation for one permission family. */
export type RuntimePermissionOperation<Kind extends RuntimePermissionKind> = RuntimePermissionOperations[Kind];

/** One atomic permission request. Targets remain host-policy inputs, not authority. */
export type RuntimePermissionRequirement = {
  [Kind in RuntimePermissionKind]: Readonly<{
    kind: Kind;
    operation: RuntimePermissionOperation<Kind>;
    target: string;
  }>;
}[RuntimePermissionKind];

/** Input used to build a strict versioned adapter manifest. */
export interface RuntimePermissionManifestInput {
  adapterId: string;
  required?: readonly RuntimePermissionRequirement[];
  optional?: readonly RuntimePermissionRequirement[];
}

/** Immutable permission declaration exposed by an adapter before activation. */
export interface RuntimePermissionManifest {
  readonly schemaVersion: typeof RUNTIME_PERMISSION_MANIFEST_SCHEMA_VERSION;
  readonly adapterId: string;
  readonly required: readonly RuntimePermissionRequirement[];
  readonly optional: readonly RuntimePermissionRequirement[];
}

/** Structural contract implemented by permission-aware adapters. */
export interface RuntimePermissionReporter {
  readonly permissionManifest: RuntimePermissionManifest;
}

/** Aggregate provenance for one atomic requirement. */
export type RuntimePermissionReportEntry =
  & RuntimePermissionRequirement
  & Readonly<{
    level: "required" | "optional";
    requiredBy: readonly string[];
    optionalBy: readonly string[];
  }>;

/** Bounded clone-safe report a host can present before activating adapters. */
export interface RuntimePermissionActivationReport {
  readonly schemaVersion: typeof RUNTIME_PERMISSION_MANIFEST_SCHEMA_VERSION;
  readonly adapterCount: number;
  readonly requiredCount: number;
  readonly optionalCount: number;
  readonly adapters: readonly RuntimePermissionManifest[];
  readonly required: readonly RuntimePermissionReportEntry[];
  readonly optional: readonly RuntimePermissionReportEntry[];
}

/** Configurable limits for untrusted permission declaration input. */
export interface RuntimePermissionManifestLimits {
  maxAdapters?: number;
  maxRequirements?: number;
  maxAdapterIdBytes?: number;
  maxTargetBytes?: number;
  maxManifestBytes?: number;
  maxReportBytes?: number;
}

/** Immutable resolved limits used by every manifest operation. */
export interface ResolvedRuntimePermissionManifestLimits {
  readonly maxAdapters: number;
  readonly maxRequirements: number;
  readonly maxAdapterIdBytes: number;
  readonly maxTargetBytes: number;
  readonly maxManifestBytes: number;
  readonly maxReportBytes: number;
}

/** Stable validation failures for permission declarations and reports. */
export type RuntimePermissionManifestErrorCode =
  | "invalid-shape"
  | "unknown-field"
  | "invalid-value"
  | "unsupported-version"
  | "duplicate-requirement"
  | "duplicate-adapter"
  | "limit-exceeded";

/** Typed fail-closed permission manifest error. */
export class RuntimePermissionManifestError extends Error {
  constructor(
    readonly code: RuntimePermissionManifestErrorCode,
    message: string,
    readonly path = "$",
    override readonly cause?: unknown,
  ) {
    super(`${message} at ${path}`, { cause });
    this.name = "RuntimePermissionManifestError";
  }
}

const PERMISSION_OPERATIONS: Readonly<Record<RuntimePermissionKind, readonly string[]>> = Object.freeze({
  read: Object.freeze(["content", "metadata", "watch"]),
  write: Object.freeze(["create", "modify", "remove", "rename"]),
  network: Object.freeze(["connect", "listen", "resolve"]),
  environment: Object.freeze(["read", "write"]),
  subprocess: Object.freeze(["spawn", "signal"]),
  ffi: Object.freeze(["load", "call"]),
  clipboard: Object.freeze(["read", "write"]),
  notifications: Object.freeze(["show", "update", "close"]),
  "remote-session": Object.freeze(["connect", "listen", "view", "control", "share"]),
});
const KIND_ORDER = new Map<RuntimePermissionKind, number>(RUNTIME_PERMISSION_KINDS.map((kind, index) => [kind, index]));
const DEFAULT_LIMITS: ResolvedRuntimePermissionManifestLimits = Object.freeze({
  maxAdapters: 256,
  maxRequirements: 256,
  maxAdapterIdBytes: 256,
  maxTargetBytes: 4 * 1024,
  maxManifestBytes: 256 * 1024,
  maxReportBytes: 2 * 1024 * 1024,
});
const MANIFEST_FIELDS = ["schemaVersion", "adapterId", "required", "optional"] as const;
const INPUT_FIELDS = ["adapterId", "required", "optional"] as const;
const REQUIREMENT_FIELDS = ["kind", "operation", "target"] as const;
const ADAPTER_ID_PATTERN = /^[A-Za-z0-9](?:[A-Za-z0-9._:-]{0,255})$/;
const encoder = new TextEncoder();

/** Creates an immutable canonical manifest without consulting host permissions. */
export function createRuntimePermissionManifest(
  input: RuntimePermissionManifestInput,
  limits?: RuntimePermissionManifestLimits,
): RuntimePermissionManifest {
  const resolved = resolveRuntimePermissionManifestLimits(limits);
  const fields = strictRecord(input, INPUT_FIELDS, "$", "manifest input");
  const adapterId = normalizeAdapterId(requiredDataField(fields, "adapterId", "$.adapterId"), resolved);
  const required = normalizeRequirementArray(
    optionalDataField(fields, "required", "$.required"),
    "$.required",
    resolved,
  );
  const optional = normalizeRequirementArray(
    optionalDataField(fields, "optional", "$.optional"),
    "$.optional",
    resolved,
  );
  assertTotalRequirements(required, optional, resolved);
  assertDisjointRequirements(required, optional);
  return finalizeManifest(adapterId, required, optional, resolved);
}

/** Strictly validates and detaches a manifest received across an adapter boundary. */
export function normalizeRuntimePermissionManifest(
  value: unknown,
  limits?: RuntimePermissionManifestLimits,
): RuntimePermissionManifest {
  const resolved = resolveRuntimePermissionManifestLimits(limits);
  const fields = strictRecord(value, MANIFEST_FIELDS, "$", "permission manifest");
  const schemaVersion = requiredDataField(fields, "schemaVersion", "$.schemaVersion");
  if (schemaVersion !== RUNTIME_PERMISSION_MANIFEST_SCHEMA_VERSION) {
    throw new RuntimePermissionManifestError(
      "unsupported-version",
      `schemaVersion must be ${RUNTIME_PERMISSION_MANIFEST_SCHEMA_VERSION}`,
      "$.schemaVersion",
    );
  }
  const adapterId = normalizeAdapterId(requiredDataField(fields, "adapterId", "$.adapterId"), resolved);
  const required = normalizeRequirementArray(
    requiredDataField(fields, "required", "$.required"),
    "$.required",
    resolved,
  );
  const optional = normalizeRequirementArray(
    requiredDataField(fields, "optional", "$.optional"),
    "$.optional",
    resolved,
  );
  assertTotalRequirements(required, optional, resolved);
  assertDisjointRequirements(required, optional);
  return finalizeManifest(adapterId, required, optional, resolved);
}

/** Parses one JSON manifest through the same strict normalization boundary. */
export function parseRuntimePermissionManifest(
  text: string,
  limits?: RuntimePermissionManifestLimits,
): RuntimePermissionManifest {
  if (typeof text !== "string") {
    throw new RuntimePermissionManifestError("invalid-value", "manifest JSON must be a string", "$json");
  }
  const resolved = resolveRuntimePermissionManifestLimits(limits);
  // Bound untrusted text before JSON.parse. UTF-8 is never shorter than its
  // JavaScript code-unit count, so the cheap check also bounds exact encoding.
  if (text.length > resolved.maxManifestBytes || encodedBytes(text) > resolved.maxManifestBytes) {
    throw new RuntimePermissionManifestError(
      "limit-exceeded",
      "manifest JSON exceeds maxManifestBytes",
      "$json",
    );
  }
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch (cause) {
    throw new RuntimePermissionManifestError("invalid-shape", "manifest JSON is invalid", "$json", cause);
  }
  return normalizeRuntimePermissionManifest(value, resolved);
}

/** Serializes one canonical manifest in deterministic field and requirement order. */
export function serializeRuntimePermissionManifest(
  manifest: RuntimePermissionManifest,
  limits?: RuntimePermissionManifestLimits,
): string {
  return JSON.stringify(normalizeRuntimePermissionManifest(manifest, limits));
}

/** Returns a freshly detached immutable inspection snapshot. */
export function inspectRuntimePermissionManifest(
  manifest: RuntimePermissionManifest,
  limits?: RuntimePermissionManifestLimits,
): RuntimePermissionManifest {
  return normalizeRuntimePermissionManifest(manifest, limits);
}

/**
 * Aggregates adapter declarations before activation. An atomic requirement is
 * required when any adapter requires it; optional provenance remains visible.
 */
export function createRuntimePermissionActivationReport(
  manifests: readonly RuntimePermissionManifest[],
  limits?: RuntimePermissionManifestLimits,
): RuntimePermissionActivationReport {
  const resolved = resolveRuntimePermissionManifestLimits(limits);
  const values = strictArray(manifests, "$", resolved.maxAdapters, "adapter manifests");
  const adapters: RuntimePermissionManifest[] = [];
  const adapterIds = new Set<string>();
  const entries = new Map<string, MutableReportEntry>();

  for (let index = 0; index < values.length; index += 1) {
    const manifest = normalizeRuntimePermissionManifest(values[index], resolved);
    if (adapterIds.has(manifest.adapterId)) {
      throw new RuntimePermissionManifestError(
        "duplicate-adapter",
        "adapter IDs must be unique in an activation report",
        `$[${index}].adapterId`,
      );
    }
    adapterIds.add(manifest.adapterId);
    adapters.push(manifest);
    addReportRequirements(entries, manifest.required, manifest.adapterId, true);
    addReportRequirements(entries, manifest.optional, manifest.adapterId, false);
  }

  adapters.sort((left, right) => compareStrings(left.adapterId, right.adapterId));
  const required: RuntimePermissionReportEntry[] = [];
  const optional: RuntimePermissionReportEntry[] = [];
  const ordered = [...entries.values()].sort((left, right) => compareRequirements(left.requirement, right.requirement));
  for (const entry of ordered) {
    const requiredBy = Object.freeze([...entry.requiredBy].sort(compareStrings));
    const optionalBy = Object.freeze([...entry.optionalBy].sort(compareStrings));
    const level = requiredBy.length > 0 ? "required" : "optional";
    const reportEntry = Object.freeze({
      ...entry.requirement,
      level,
      requiredBy,
      optionalBy,
    }) as RuntimePermissionReportEntry;
    if (level === "required") required.push(reportEntry);
    else optional.push(reportEntry);
  }

  const report = Object.freeze({
    schemaVersion: RUNTIME_PERMISSION_MANIFEST_SCHEMA_VERSION,
    adapterCount: adapters.length,
    requiredCount: required.length,
    optionalCount: optional.length,
    adapters: Object.freeze(adapters),
    required: Object.freeze(required),
    optional: Object.freeze(optional),
  });
  if (encodedBytes(JSON.stringify(report)) > resolved.maxReportBytes) {
    throw new RuntimePermissionManifestError("limit-exceeded", "activation report exceeds maxReportBytes", "$");
  }
  return report;
}

/**
 * Collects manifests directly from adapter contracts before any adapter is
 * activated. Manifests must be own data properties so reporting never invokes
 * adapter getters or activation code.
 */
export function createRuntimePermissionActivationReportFromReporters(
  reporters: readonly RuntimePermissionReporter[],
  limits?: RuntimePermissionManifestLimits,
): RuntimePermissionActivationReport {
  const resolved = resolveRuntimePermissionManifestLimits(limits);
  const values = strictArray(reporters, "$reporters", resolved.maxAdapters, "permission reporters");
  const manifests = new Array<RuntimePermissionManifest>(values.length);
  for (let index = 0; index < values.length; index += 1) {
    const reporter = values[index];
    if (typeof reporter !== "object" || reporter === null) {
      throw new RuntimePermissionManifestError(
        "invalid-shape",
        "permission reporter must be an object",
        `$reporters[${index}]`,
      );
    }
    let descriptor: PropertyDescriptor | undefined;
    try {
      descriptor = Object.getOwnPropertyDescriptor(reporter, "permissionManifest");
    } catch (cause) {
      throw new RuntimePermissionManifestError(
        "invalid-shape",
        "permission reporter manifest descriptor is unreadable",
        `$reporters[${index}].permissionManifest`,
        cause,
      );
    }
    if (!descriptor || !("value" in descriptor) || descriptor.enumerable !== true) {
      throw new RuntimePermissionManifestError(
        "invalid-shape",
        "permission reporter manifest must be an enumerable own data property",
        `$reporters[${index}].permissionManifest`,
      );
    }
    manifests[index] = normalizeRuntimePermissionManifest(descriptor.value, resolved);
  }
  return createRuntimePermissionActivationReport(manifests, resolved);
}

/** Resolves and freezes validation limits, rejecting ambiguous numeric input. */
export function resolveRuntimePermissionManifestLimits(
  limits: RuntimePermissionManifestLimits = {},
): ResolvedRuntimePermissionManifestLimits {
  const fields = strictRecord(
    limits,
    [
      "maxAdapters",
      "maxRequirements",
      "maxAdapterIdBytes",
      "maxTargetBytes",
      "maxManifestBytes",
      "maxReportBytes",
    ] as const,
    "$limits",
    "permission manifest limits",
  );
  return Object.freeze({
    maxAdapters: normalizedLimit(
      optionalDataField(fields, "maxAdapters", "$limits.maxAdapters"),
      DEFAULT_LIMITS.maxAdapters,
      "$limits.maxAdapters",
    ),
    maxRequirements: normalizedLimit(
      optionalDataField(fields, "maxRequirements", "$limits.maxRequirements"),
      DEFAULT_LIMITS.maxRequirements,
      "$limits.maxRequirements",
    ),
    maxAdapterIdBytes: normalizedLimit(
      optionalDataField(fields, "maxAdapterIdBytes", "$limits.maxAdapterIdBytes"),
      DEFAULT_LIMITS.maxAdapterIdBytes,
      "$limits.maxAdapterIdBytes",
    ),
    maxTargetBytes: normalizedLimit(
      optionalDataField(fields, "maxTargetBytes", "$limits.maxTargetBytes"),
      DEFAULT_LIMITS.maxTargetBytes,
      "$limits.maxTargetBytes",
    ),
    maxManifestBytes: normalizedLimit(
      optionalDataField(fields, "maxManifestBytes", "$limits.maxManifestBytes"),
      DEFAULT_LIMITS.maxManifestBytes,
      "$limits.maxManifestBytes",
    ),
    maxReportBytes: normalizedLimit(
      optionalDataField(fields, "maxReportBytes", "$limits.maxReportBytes"),
      DEFAULT_LIMITS.maxReportBytes,
      "$limits.maxReportBytes",
    ),
  });
}

interface MutableReportEntry {
  requirement: RuntimePermissionRequirement;
  requiredBy: Set<string>;
  optionalBy: Set<string>;
}

type DataFields = Readonly<Record<string, PropertyDescriptor>>;

function finalizeManifest(
  adapterId: string,
  required: RuntimePermissionRequirement[],
  optional: RuntimePermissionRequirement[],
  limits: ResolvedRuntimePermissionManifestLimits,
): RuntimePermissionManifest {
  required.sort(compareRequirements);
  optional.sort(compareRequirements);
  const manifest = Object.freeze({
    schemaVersion: RUNTIME_PERMISSION_MANIFEST_SCHEMA_VERSION,
    adapterId,
    required: Object.freeze(required),
    optional: Object.freeze(optional),
  });
  if (encodedBytes(JSON.stringify(manifest)) > limits.maxManifestBytes) {
    throw new RuntimePermissionManifestError("limit-exceeded", "manifest exceeds maxManifestBytes", "$");
  }
  return manifest;
}

function normalizeRequirementArray(
  value: unknown,
  path: string,
  limits: ResolvedRuntimePermissionManifestLimits,
): RuntimePermissionRequirement[] {
  if (value === undefined) return [];
  const values = strictArray(value, path, limits.maxRequirements, "permission requirements");
  const requirements: RuntimePermissionRequirement[] = [];
  const keys = new Set<string>();
  for (let index = 0; index < values.length; index += 1) {
    const itemPath = `${path}[${index}]`;
    const requirement = normalizeRequirement(values[index], itemPath, limits);
    const key = requirementKey(requirement);
    if (keys.has(key)) {
      throw new RuntimePermissionManifestError(
        "duplicate-requirement",
        "permission requirements must be unique",
        itemPath,
      );
    }
    keys.add(key);
    requirements.push(requirement);
  }
  return requirements;
}

function normalizeRequirement(
  value: unknown,
  path: string,
  limits: ResolvedRuntimePermissionManifestLimits,
): RuntimePermissionRequirement {
  const fields = strictRecord(value, REQUIREMENT_FIELDS, path, "permission requirement");
  const kindValue = requiredDataField(fields, "kind", `${path}.kind`);
  if (typeof kindValue !== "string" || !isPermissionKind(kindValue)) {
    throw new RuntimePermissionManifestError("invalid-value", "permission kind is unsupported", `${path}.kind`);
  }
  const operation = requiredDataField(fields, "operation", `${path}.operation`);
  if (typeof operation !== "string" || !PERMISSION_OPERATIONS[kindValue].includes(operation)) {
    throw new RuntimePermissionManifestError(
      "invalid-value",
      "permission operation is unsupported for its kind",
      `${path}.operation`,
    );
  }
  const target = normalizeTarget(requiredDataField(fields, "target", `${path}.target`), `${path}.target`, limits);
  return Object.freeze({ kind: kindValue, operation, target }) as RuntimePermissionRequirement;
}

function normalizeAdapterId(value: unknown, limits: ResolvedRuntimePermissionManifestLimits): string {
  if (typeof value !== "string" || !ADAPTER_ID_PATTERN.test(value)) {
    throw new RuntimePermissionManifestError(
      "invalid-value",
      "adapterId must be a stable ASCII identifier",
      "$.adapterId",
    );
  }
  if (encodedBytes(value) > limits.maxAdapterIdBytes) {
    throw new RuntimePermissionManifestError("limit-exceeded", "adapterId exceeds maxAdapterIdBytes", "$.adapterId");
  }
  return value;
}

function normalizeTarget(
  value: unknown,
  path: string,
  limits: ResolvedRuntimePermissionManifestLimits,
): string {
  if (typeof value !== "string" || value.length === 0 || value.trim() !== value) {
    throw new RuntimePermissionManifestError(
      "invalid-value",
      "permission target must be a non-empty exact string",
      path,
    );
  }
  if (hasUnsafeDisplayControl(value)) {
    throw new RuntimePermissionManifestError("invalid-value", "permission target contains unsafe controls", path);
  }
  if (encodedBytes(value) > limits.maxTargetBytes) {
    throw new RuntimePermissionManifestError("limit-exceeded", "permission target exceeds maxTargetBytes", path);
  }
  return value;
}

function assertDisjointRequirements(
  required: readonly RuntimePermissionRequirement[],
  optional: readonly RuntimePermissionRequirement[],
): void {
  const requiredKeys = new Set(required.map(requirementKey));
  for (let index = 0; index < optional.length; index += 1) {
    if (requiredKeys.has(requirementKey(optional[index]!))) {
      throw new RuntimePermissionManifestError(
        "duplicate-requirement",
        "one adapter cannot declare the same requirement as required and optional",
        `$.optional[${index}]`,
      );
    }
  }
}

function assertTotalRequirements(
  required: readonly RuntimePermissionRequirement[],
  optional: readonly RuntimePermissionRequirement[],
  limits: ResolvedRuntimePermissionManifestLimits,
): void {
  if (required.length + optional.length > limits.maxRequirements) {
    throw new RuntimePermissionManifestError(
      "limit-exceeded",
      "combined permission requirements exceed maxRequirements",
      "$",
    );
  }
}

function addReportRequirements(
  entries: Map<string, MutableReportEntry>,
  requirements: readonly RuntimePermissionRequirement[],
  adapterId: string,
  required: boolean,
): void {
  for (const requirement of requirements) {
    const key = requirementKey(requirement);
    let entry = entries.get(key);
    if (!entry) {
      entry = { requirement, requiredBy: new Set<string>(), optionalBy: new Set<string>() };
      entries.set(key, entry);
    }
    (required ? entry.requiredBy : entry.optionalBy).add(adapterId);
  }
}

function requirementKey(requirement: RuntimePermissionRequirement): string {
  return `${requirement.kind}\u0000${requirement.operation}\u0000${requirement.target}`;
}

function compareRequirements(left: RuntimePermissionRequirement, right: RuntimePermissionRequirement): number {
  const kind = (KIND_ORDER.get(left.kind) ?? 0) - (KIND_ORDER.get(right.kind) ?? 0);
  if (kind !== 0) return kind;
  const operation = compareStrings(left.operation, right.operation);
  return operation !== 0 ? operation : compareStrings(left.target, right.target);
}

function compareStrings(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function strictRecord<const Fields extends readonly string[]>(
  value: unknown,
  allowed: Fields,
  path: string,
  label: string,
): DataFields {
  if (typeof value !== "object" || value === null) {
    throw new RuntimePermissionManifestError("invalid-shape", `${label} must be a plain object`, path);
  }
  let arrayLike: boolean;
  let prototype: object | null;
  let descriptors: PropertyDescriptorMap;
  try {
    arrayLike = Array.isArray(value);
    prototype = Object.getPrototypeOf(value);
    descriptors = Object.getOwnPropertyDescriptors(value);
  } catch (cause) {
    throw new RuntimePermissionManifestError(
      "invalid-shape",
      `${label} reflection failed`,
      path,
      cause,
    );
  }
  if (arrayLike) {
    throw new RuntimePermissionManifestError("invalid-shape", `${label} must be a plain object`, path);
  }
  if (prototype !== Object.prototype && prototype !== null) {
    throw new RuntimePermissionManifestError("invalid-shape", `${label} must have a plain prototype`, path);
  }
  const allowedSet = new Set<string>(allowed);
  for (const key of Reflect.ownKeys(descriptors)) {
    if (typeof key !== "string" || !allowedSet.has(key)) {
      throw new RuntimePermissionManifestError("unknown-field", `${label} contains an unknown field`, path);
    }
    const descriptor = descriptors[key];
    if (!descriptor || !("value" in descriptor) || descriptor.enumerable !== true) {
      throw new RuntimePermissionManifestError(
        "invalid-shape",
        `${label} fields must be enumerable data properties`,
        `${path}.${key}`,
      );
    }
  }
  return descriptors;
}

function strictArray(value: unknown, path: string, maximum: number, label: string): unknown[] {
  let arrayLike: boolean;
  let descriptors: Record<PropertyKey, PropertyDescriptor>;
  try {
    arrayLike = Array.isArray(value);
    if (!arrayLike) {
      throw new RuntimePermissionManifestError("invalid-shape", `${label} must be an array`, path);
    }
    descriptors = Object.getOwnPropertyDescriptors(value) as unknown as Record<PropertyKey, PropertyDescriptor>;
  } catch (cause) {
    if (cause instanceof RuntimePermissionManifestError) throw cause;
    throw new RuntimePermissionManifestError(
      "invalid-shape",
      `${label} reflection failed`,
      path,
      cause,
    );
  }
  if (!arrayLike) {
    throw new RuntimePermissionManifestError("invalid-shape", `${label} must be an array`, path);
  }
  const lengthDescriptor = descriptors["length"];
  if (
    !lengthDescriptor || !("value" in lengthDescriptor) ||
    !Number.isSafeInteger(lengthDescriptor.value) || lengthDescriptor.value < 0
  ) {
    throw new RuntimePermissionManifestError("invalid-shape", `${label} has an invalid length`, path);
  }
  const length = lengthDescriptor.value as number;
  if (length > maximum) {
    throw new RuntimePermissionManifestError("limit-exceeded", `${label} exceeds its configured limit`, path);
  }
  for (const key of Reflect.ownKeys(descriptors)) {
    if (key === "length") continue;
    if (typeof key !== "string" || !/^(?:0|[1-9][0-9]*)$/.test(key)) {
      throw new RuntimePermissionManifestError("invalid-shape", `${label} contains a non-index property`, path);
    }
    const numeric = Number(key);
    if (!Number.isSafeInteger(numeric) || numeric < 0 || numeric >= length) {
      throw new RuntimePermissionManifestError("invalid-shape", `${label} contains an invalid index`, path);
    }
  }
  const values = new Array<unknown>(length);
  for (let index = 0; index < length; index += 1) {
    const descriptor = descriptors[String(index)];
    if (!descriptor || !("value" in descriptor) || descriptor.enumerable !== true) {
      throw new RuntimePermissionManifestError(
        "invalid-shape",
        `${label} must be dense data properties`,
        `${path}[${index}]`,
      );
    }
    values[index] = descriptor.value;
  }
  return values;
}

function requiredDataField(fields: DataFields, key: string, path: string): unknown {
  const descriptor = fields[key];
  if (!descriptor || !("value" in descriptor)) {
    throw new RuntimePermissionManifestError("invalid-shape", "required field is missing", path);
  }
  return descriptor.value;
}

function optionalDataField(fields: DataFields, key: string, path: string): unknown {
  const descriptor = fields[key];
  if (!descriptor) return undefined;
  if (!("value" in descriptor)) {
    throw new RuntimePermissionManifestError("invalid-shape", "field must be a data property", path);
  }
  return descriptor.value;
}

function normalizedLimit(value: unknown, fallback: number, path: string): number {
  if (value === undefined) return fallback;
  if (!Number.isSafeInteger(value) || (value as number) < 0) {
    throw new RuntimePermissionManifestError("invalid-value", "limit must be a non-negative safe integer", path);
  }
  return value as number;
}

function isPermissionKind(value: string): value is RuntimePermissionKind {
  return (RUNTIME_PERMISSION_KINDS as readonly string[]).includes(value);
}

function encodedBytes(value: string): number {
  return encoder.encode(value).byteLength;
}

function hasUnsafeDisplayControl(value: string): boolean {
  for (const character of value) {
    const codePoint = character.codePointAt(0)!;
    if (
      codePoint <= 0x1f ||
      (codePoint >= 0x7f && codePoint <= 0x9f) ||
      codePoint === 0x2028 ||
      codePoint === 0x2029 ||
      (codePoint >= 0x202a && codePoint <= 0x202e) ||
      (codePoint >= 0x2066 && codePoint <= 0x2069)
    ) return true;
  }
  return false;
}
