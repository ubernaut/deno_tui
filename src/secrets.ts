// Copyright 2023 Im-Beast. MIT license.

/** Stable marker emitted by every implicit secret projection. */
export const SECRET_REDACTED_MARKER = "[REDACTED]" as const;

const DENO_CUSTOM_INSPECT = Symbol.for("Deno.customInspect");
const NODE_CUSTOM_INSPECT = Symbol.for("nodejs.util.inspect.custom");

interface SecretState {
  disposed: boolean;
  byteValue?: Uint8Array;
  value?: unknown;
}

const SECRET_STATES = new WeakMap<object, SecretState>();

/** Stable secret and redaction failure categories. */
export type SecretErrorCode =
  | "disposed"
  | "invalid-callback"
  | "reveal-callback-failed"
  | "invalid-options"
  | "invalid-schema"
  | "invalid-limit"
  | "cycle"
  | "accessor"
  | "exotic"
  | "unsafe-key"
  | "invalid-value"
  | "max-depth"
  | "max-nodes"
  | "max-bytes";

/** Error whose message and path never retain input values or callback errors. */
export class SecretError extends Error {
  constructor(
    readonly code: SecretErrorCode,
    message: string,
    readonly path = "$",
  ) {
    super(message);
    this.name = "SecretError";
  }
}

/** Clone-safe inspection that reveals neither the value type nor its size. */
export interface SecretInspection {
  readonly redacted: typeof SECRET_REDACTED_MARKER;
  readonly disposed: boolean;
}

/**
 * Opaque secret wrapper with no own value fields.
 *
 * Implicit formatting is always redacted. `reveal` is the sole plaintext
 * boundary: callers are responsible for any value or derivative they return,
 * store, log, or throw from the callback. Callback failures are replaced by a
 * stable error without retaining the thrown value or its message.
 *
 * `Uint8Array` inputs are cloned on input and reveal. Disposal overwrites the
 * private clone before releasing it as a best-effort erasure measure; this is
 * not a cryptographic destruction guarantee.
 */
export class Secret<T> {
  private constructor(state: SecretState) {
    SECRET_STATES.set(this, state);
    Object.freeze(this);
  }

  static create<TValue>(value: TValue): Secret<TValue> {
    if (isDirectUint8Array(value)) {
      return new Secret<TValue>({
        disposed: false,
        byteValue: new Uint8Array(value),
      });
    }
    return new Secret<TValue>({ disposed: false, value });
  }

  get disposed(): boolean {
    return secretState(this).disposed;
  }

  /** Executes one explicit reveal without attaching or caching plaintext. */
  reveal<TResult>(callback: (value: T) => PromiseLike<TResult>): Promise<TResult>;
  reveal<TResult>(callback: (value: T) => TResult): TResult;
  reveal<TResult>(callback: (value: T) => TResult | PromiseLike<TResult>): TResult | PromiseLike<TResult> {
    const state = secretState(this);
    if (state.disposed) {
      throw new SecretError("disposed", "secret has been disposed");
    }
    if (typeof callback !== "function") {
      throw new SecretError("invalid-callback", "secret reveal requires a callback");
    }
    const value = state.byteValue === undefined ? state.value as T : new Uint8Array(state.byteValue) as T;
    try {
      const result = callback(value);
      const then = thenMethod<TResult>(result);
      if (then) return sanitizeThenable(result, then);
      return result;
    } catch {
      throw revealCallbackFailure();
    }
  }

  /** Best-effort erasure for private mutable bytes; safe to call repeatedly. */
  dispose(): void {
    const state = secretState(this);
    if (state.disposed) return;
    if (state.byteValue !== undefined) {
      for (let index = 0; index < state.byteValue.length; index += 1) state.byteValue[index] = 0;
      state.byteValue = undefined;
    }
    state.value = undefined;
    state.disposed = true;
  }

  inspect(): Readonly<SecretInspection> {
    return inspectSecret(this);
  }

  toString(): typeof SECRET_REDACTED_MARKER {
    return SECRET_REDACTED_MARKER;
  }

  valueOf(): typeof SECRET_REDACTED_MARKER {
    return SECRET_REDACTED_MARKER;
  }

  toJSON(): typeof SECRET_REDACTED_MARKER {
    return SECRET_REDACTED_MARKER;
  }

  [Symbol.toPrimitive](): typeof SECRET_REDACTED_MARKER {
    return SECRET_REDACTED_MARKER;
  }

  [DENO_CUSTOM_INSPECT](): typeof SECRET_REDACTED_MARKER {
    return SECRET_REDACTED_MARKER;
  }

  [NODE_CUSTOM_INSPECT](): typeof SECRET_REDACTED_MARKER {
    return SECRET_REDACTED_MARKER;
  }
}

/** Creates an opaque secret. */
export function secret<T>(value: T): Secret<T> {
  return Secret.create(value);
}

/** Brand check that does not read properties, getters, or coercion hooks. */
export function isSecret(value: unknown): value is Secret<unknown> {
  return (typeof value === "object" && value !== null || typeof value === "function") &&
    SECRET_STATES.has(value as object);
}

/** Returns redaction/disposal state without revealing value type, size, or data. */
export function inspectSecret(value: Secret<unknown>): Readonly<SecretInspection> {
  const state = secretState(value);
  return Object.freeze({ redacted: SECRET_REDACTED_MARKER, disposed: state.disposed });
}

/** Safe error text that never reads the supplied error or secret. */
export function formatRedactedError(_error: unknown): string {
  return `Error: ${SECRET_REDACTED_MARKER}`;
}

/** Safe structured error projection for diagnostics and history surfaces. */
export function inspectRedactedError(_error: unknown): Readonly<{ message: typeof SECRET_REDACTED_MARKER }> {
  return Object.freeze({ message: SECRET_REDACTED_MARKER });
}

/** Plain JSON value produced by defensive redaction. */
export type RedactedJsonValue =
  | null
  | boolean
  | number
  | string
  | readonly RedactedJsonValue[]
  | { readonly [key: string]: RedactedJsonValue };

/** Redaction action for one exact or wildcard path. */
export type RedactionAction = "allow" | "redact" | "secret";

/** Object keys, array indexes, or a deterministic single-segment wildcard. */
export type RedactionPathSegment = string | number;

/** One declarative path rule. Unknown runtime actions normalize to `redact`. */
export interface RedactionRule {
  readonly path: readonly RedactionPathSegment[];
  readonly action: RedactionAction;
}

/** Path-based schema. Unmatched paths redact unless `defaultAction` is allow. */
export interface RedactionSchema {
  readonly rules: readonly RedactionRule[];
  readonly defaultAction?: RedactionAction;
}

/** Hard limits for defensive traversal and canonical output. */
export interface RedactionLimits {
  readonly maxDepth?: number;
  readonly maxNodes?: number;
  readonly maxBytes?: number;
}

/** Structured redaction options. */
export interface RedactStructuredOptions {
  readonly schema?: RedactionSchema;
  readonly limits?: RedactionLimits;
}

interface NormalizedLimits {
  readonly maxDepth: number;
  readonly maxNodes: number;
  readonly maxBytes: number;
}

interface NormalizedRule {
  readonly path: readonly RedactionPathSegment[];
  readonly action: RedactionAction;
  readonly specificity: number;
  readonly key: string;
}

interface NormalizedSchema {
  readonly rules: readonly NormalizedRule[];
  readonly defaultAction: RedactionAction;
}

interface CloneContext {
  readonly limits: NormalizedLimits;
  readonly ancestors: WeakSet<object>;
  nodes: number;
}

const DEFAULT_LIMITS: NormalizedLimits = Object.freeze({
  maxDepth: 32,
  maxNodes: 10_000,
  maxBytes: 1_000_000,
});

/**
 * Produces a detached plain JSON-safe value without invoking getters or
 * coercion. Validation happens before schema projection, so cycles, accessors,
 * exotics, dangerous keys, and traversal overruns fail even under redacted
 * branches. The input is never mutated.
 */
export function redactStructured(
  value: unknown,
  options: RedactStructuredOptions = {},
): Readonly<RedactedJsonValue> {
  try {
    const normalizedOptions = normalizeOptions(options);
    const limits = normalizeLimits(normalizedOptions.limits);
    const cloned = strictClone(value, {
      limits,
      ancestors: new WeakSet<object>(),
      nodes: 0,
    }, 0);
    const schema = normalizedOptions.schema === undefined
      ? undefined
      : normalizeSchema(normalizedOptions.schema, limits);
    const projected = schema === undefined ? cloned : projectSchema(cloned, [], undefined, schema);
    const serialized = JSON.stringify(projected);
    const bytes = new TextEncoder().encode(serialized).byteLength;
    if (bytes > limits.maxBytes) {
      throw new SecretError("max-bytes", "redacted output exceeds the configured byte limit");
    }
    return freezeJson(projected);
  } catch (error) {
    if (error instanceof SecretError) throw error;
    throw new SecretError("invalid-value", "redaction input could not be inspected safely");
  }
}

/** Canonical-enough stable JSON for logs and persistence after redaction. */
export function stringifyRedacted(value: unknown, options: RedactStructuredOptions = {}): string {
  return JSON.stringify(redactStructured(value, options));
}

/** Default persistence projection: strict JSON clone with every Secret redacted. */
export function redactForPersistence(
  value: unknown,
  options: RedactStructuredOptions = {},
): Readonly<RedactedJsonValue> {
  return redactStructured(value, options);
}

/** Default history projection: strict JSON clone with every Secret redacted. */
export function redactForHistory(
  value: unknown,
  options: RedactStructuredOptions = {},
): Readonly<RedactedJsonValue> {
  return redactStructured(value, options);
}

/** Default logging projection: strict JSON clone with every Secret redacted. */
export function redactForLog(
  value: unknown,
  options: RedactStructuredOptions = {},
): Readonly<RedactedJsonValue> {
  return redactStructured(value, options);
}

function secretState(value: object): SecretState {
  const state = SECRET_STATES.get(value);
  if (!state) throw new SecretError("invalid-value", "value is not an opaque secret");
  return state;
}

function revealCallbackFailure(): SecretError {
  return new SecretError(
    "reveal-callback-failed",
    "secret reveal callback failed; callback details were redacted",
  );
}

type SecretThenMethod<T> = (
  resolve: (value: T | PromiseLike<T>) => void,
  reject: (reason?: unknown) => void,
) => unknown;

function thenMethod<T>(value: T | PromiseLike<T>): SecretThenMethod<T> | undefined {
  if (!((typeof value === "object" && value !== null) || typeof value === "function")) return undefined;
  const then = (value as { then?: unknown }).then;
  return typeof then === "function" ? then as SecretThenMethod<T> : undefined;
}

function sanitizeThenable<T>(value: T | PromiseLike<T>, then: SecretThenMethod<T>): Promise<T> {
  const assimilated = new Promise<T>((resolve, reject) => {
    try {
      Reflect.apply(then, value, [resolve, () => reject(revealCallbackFailure())]);
    } catch {
      reject(revealCallbackFailure());
    }
  });
  // Native resolution recursively assimilates values supplied to `resolve`.
  // Sanitize again after that process so a nested rejecting thenable cannot
  // bypass the outer thenable's rejection callback.
  return assimilated.catch(() => {
    throw revealCallbackFailure();
  });
}

function isDirectUint8Array(value: unknown): value is Uint8Array {
  return ArrayBuffer.isView(value) && Object.getPrototypeOf(value) === Uint8Array.prototype;
}

function normalizeOptions(source: RedactStructuredOptions): RedactStructuredOptions {
  if (!isPlainRecord(source)) {
    throw new SecretError("invalid-options", "redaction options must be a plain object");
  }
  validateKnownKeys(source, new Set(["limits", "schema"]), "invalid-options");
  const limits = ownDataValue(source, "limits", "invalid-options");
  const schema = ownDataValue(source, "schema", "invalid-options");
  return { limits: limits as RedactionLimits | undefined, schema: schema as RedactionSchema | undefined };
}

function normalizeLimits(source: RedactionLimits | undefined): NormalizedLimits {
  if (source === undefined) return DEFAULT_LIMITS;
  if (!isPlainRecord(source)) {
    throw new SecretError("invalid-limit", "redaction limits must be a plain object");
  }
  validateKnownKeys(source, new Set(["maxBytes", "maxDepth", "maxNodes"]), "invalid-limit");
  const maxDepth = limitInteger(
    ownDataValue(source, "maxDepth", "invalid-limit"),
    DEFAULT_LIMITS.maxDepth,
    0,
    "maxDepth",
  );
  const maxNodes = limitInteger(
    ownDataValue(source, "maxNodes", "invalid-limit"),
    DEFAULT_LIMITS.maxNodes,
    1,
    "maxNodes",
  );
  const maxBytes = limitInteger(
    ownDataValue(source, "maxBytes", "invalid-limit"),
    DEFAULT_LIMITS.maxBytes,
    0,
    "maxBytes",
  );
  return Object.freeze({ maxDepth, maxNodes, maxBytes });
}

function limitInteger(value: unknown, fallback: number, minimum: number, name: string): number {
  if (value === undefined) return fallback;
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < minimum) {
    throw new SecretError("invalid-limit", `${name} must be a bounded non-negative safe integer`);
  }
  return value;
}

function strictClone(
  value: unknown,
  context: CloneContext,
  depth: number,
): RedactedJsonValue {
  if (depth > context.limits.maxDepth) {
    throw new SecretError("max-depth", "redaction input exceeds the configured depth limit");
  }
  context.nodes += 1;
  if (context.nodes > context.limits.maxNodes) {
    throw new SecretError("max-nodes", "redaction input exceeds the configured node limit");
  }
  if (isSecret(value)) return SECRET_REDACTED_MARKER;
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new SecretError("invalid-value", "redaction accepts only finite JSON numbers");
    }
    return Object.is(value, -0) ? 0 : value;
  }
  if (typeof value !== "object") {
    throw new SecretError("invalid-value", "redaction input contains a non-JSON value");
  }
  if (context.ancestors.has(value)) {
    throw new SecretError("cycle", "redaction input contains a cycle");
  }
  context.ancestors.add(value);
  try {
    if (Array.isArray(value)) {
      if (Object.getPrototypeOf(value) !== Array.prototype) {
        throw new SecretError("exotic", "redaction input contains a non-plain array");
      }
      return cloneArray(value, context, depth);
    }
    if (!isPlainRecord(value)) {
      throw new SecretError("exotic", "redaction input contains a non-plain object");
    }
    return cloneRecord(value, context, depth);
  } finally {
    context.ancestors.delete(value);
  }
}

function cloneArray(value: unknown[], context: CloneContext, depth: number): RedactedJsonValue[] {
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key === "symbol") {
      throw new SecretError("invalid-value", "redaction arrays cannot contain symbol properties");
    }
    if (key === "length") continue;
    if (!/^(0|[1-9][0-9]*)$/.test(key) || Number(key) >= value.length) {
      throw new SecretError("exotic", "redaction arrays cannot contain non-index properties");
    }
  }
  const result: RedactedJsonValue[] = [];
  for (let index = 0; index < value.length; index += 1) {
    if (!(index in value)) throw new SecretError("invalid-value", "redaction rejects sparse arrays");
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    if (!descriptor?.enumerable || !("value" in descriptor)) {
      throw new SecretError("accessor", "redaction rejects array accessors and hidden elements");
    }
    result.push(strictClone(descriptor.value, context, depth + 1));
  }
  return result;
}

function cloneRecord(
  value: Record<string, unknown>,
  context: CloneContext,
  depth: number,
): Record<string, RedactedJsonValue> {
  const result: Record<string, RedactedJsonValue> = {};
  const keys = Reflect.ownKeys(value);
  if (keys.some((key) => typeof key === "symbol")) {
    throw new SecretError("invalid-value", "redaction objects cannot contain symbol properties");
  }
  for (const key of (keys as string[]).sort(compareText)) {
    if (isUnsafeKey(key)) {
      throw new SecretError("unsafe-key", "redaction rejects prototype-sensitive property names");
    }
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor?.enumerable || !("value" in descriptor)) {
      throw new SecretError("accessor", "redaction rejects accessors and non-enumerable properties");
    }
    result[key] = strictClone(descriptor.value, context, depth + 1);
  }
  return result;
}

function normalizeSchema(source: RedactionSchema, limits: NormalizedLimits): NormalizedSchema {
  const cloned = strictClone(source, {
    limits,
    ancestors: new WeakSet<object>(),
    nodes: 0,
  }, 0);
  if (!isPlainRecord(cloned) || !Array.isArray(cloned.rules)) {
    throw new SecretError("invalid-schema", "redaction schema requires a rules array");
  }
  const byPath = new Map<string, NormalizedRule>();
  for (let index = 0; index < cloned.rules.length; index += 1) {
    const rule = cloned.rules[index];
    if (!isPlainRecord(rule) || !Array.isArray(rule.path)) {
      throw new SecretError("invalid-schema", "redaction rules require path arrays");
    }
    if (rule.path.length > limits.maxDepth) {
      throw new SecretError("invalid-schema", "redaction rule path exceeds the configured depth limit");
    }
    const path = rule.path.map(normalizePathSegment);
    const action = normalizeAction(rule.action);
    const key = JSON.stringify(path);
    const normalized: NormalizedRule = Object.freeze({
      path: Object.freeze(path),
      action,
      specificity: path.reduce<number>(
        (count, segment) => count + (segment === "*" ? 0 : 1),
        0,
      ),
      key,
    });
    const previous = byPath.get(key);
    byPath.set(key, previous === undefined ? normalized : moreRestrictiveRule(previous, normalized));
  }
  return Object.freeze({
    rules: Object.freeze([...byPath.values()].sort((left, right) => compareText(left.key, right.key))),
    defaultAction: normalizeAction(cloned.defaultAction),
  });
}

function normalizePathSegment(value: RedactedJsonValue): RedactionPathSegment {
  if (typeof value === "number" && Number.isSafeInteger(value) && value >= 0) return value;
  if (typeof value === "string" && value.length > 0 && !isUnsafeKey(value)) return value;
  throw new SecretError("invalid-schema", "redaction paths require safe text, indexes, or '*' wildcards");
}

function normalizeAction(value: unknown): RedactionAction {
  return value === "allow" || value === "secret" || value === "redact" ? value : "redact";
}

function moreRestrictiveRule(left: NormalizedRule, right: NormalizedRule): NormalizedRule {
  return actionRank(left.action) >= actionRank(right.action) ? left : right;
}

function actionRank(action: RedactionAction): number {
  return action === "allow" ? 0 : action === "redact" ? 1 : 2;
}

function projectSchema(
  value: RedactedJsonValue,
  path: readonly RedactionPathSegment[],
  inheritedAction: RedactionAction | undefined,
  schema: NormalizedSchema,
): RedactedJsonValue {
  const rule = ruleAt(schema.rules, path);
  const action = rule?.action ?? inheritedAction;
  if (action === "redact" || action === "secret") return SECRET_REDACTED_MARKER;
  if (value === null || typeof value !== "object") {
    return action === "allow" || schema.defaultAction === "allow" ? value : SECRET_REDACTED_MARKER;
  }
  const hasDescendant = schema.rules.some((candidate) =>
    candidate.path.length > path.length && pathPrefixMatches(candidate.path, path)
  );
  if (action !== "allow" && !hasDescendant) {
    return schema.defaultAction === "allow" ? copyJson(value) : SECRET_REDACTED_MARKER;
  }
  if (Array.isArray(value)) {
    return value.map((child, index) =>
      projectSchema(child, [...path, index], action === "allow" ? "allow" : undefined, schema)
    );
  }
  const record = value as { readonly [key: string]: RedactedJsonValue };
  const result: Record<string, RedactedJsonValue> = {};
  for (const key of Object.keys(record).sort(compareText)) {
    result[key] = projectSchema(
      record[key]!,
      [...path, key],
      action === "allow" ? "allow" : undefined,
      schema,
    );
  }
  return result;
}

function ruleAt(
  rules: readonly NormalizedRule[],
  path: readonly RedactionPathSegment[],
): NormalizedRule | undefined {
  let selected: NormalizedRule | undefined;
  for (const rule of rules) {
    if (rule.path.length !== path.length || !pathMatches(rule.path, path)) continue;
    if (
      selected === undefined ||
      rule.specificity > selected.specificity ||
      rule.specificity === selected.specificity && actionRank(rule.action) > actionRank(selected.action) ||
      rule.specificity === selected.specificity && rule.action === selected.action &&
        compareText(rule.key, selected.key) < 0
    ) {
      selected = rule;
    }
  }
  return selected;
}

function pathMatches(
  rulePath: readonly RedactionPathSegment[],
  path: readonly RedactionPathSegment[],
): boolean {
  return rulePath.every((segment, index) => segment === "*" || segment === path[index]);
}

function pathPrefixMatches(
  rulePath: readonly RedactionPathSegment[],
  path: readonly RedactionPathSegment[],
): boolean {
  for (let index = 0; index < path.length; index += 1) {
    const segment = rulePath[index];
    if (segment !== "*" && segment !== path[index]) return false;
  }
  return true;
}

function copyJson(value: RedactedJsonValue): RedactedJsonValue {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(copyJson);
  const record = value as { readonly [key: string]: RedactedJsonValue };
  const result: Record<string, RedactedJsonValue> = {};
  for (const key of Object.keys(record).sort(compareText)) result[key] = copyJson(record[key]!);
  return result;
}

function freezeJson<T>(value: T): T {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) freezeJson(child);
  return Object.freeze(value);
}

function isUnsafeKey(key: string): boolean {
  return key === "__proto__" || key === "prototype" || key === "constructor";
}

function validateKnownKeys(
  value: Record<string, unknown>,
  allowed: ReadonlySet<string>,
  code: "invalid-limit" | "invalid-options",
): void {
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key !== "string" || !allowed.has(key)) {
      throw new SecretError(code, "redaction configuration contains an unsupported property");
    }
  }
}

function ownDataValue(
  value: Record<string, unknown>,
  key: string,
  code: "invalid-limit" | "invalid-options",
): unknown {
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  if (descriptor === undefined) return undefined;
  if (!descriptor.enumerable || !("value" in descriptor)) {
    throw new SecretError(code, "redaction configuration requires enumerable data properties");
  }
  return descriptor.value;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
