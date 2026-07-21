// Copyright 2023 Im-Beast. MIT license.

import type { FieldName, FormValues } from "./forms.ts";

/** Recursive partial value tree accepted by nested form reset and bulk-set operations. */
export type FormValuesPatch<TValue> = TValue extends (...args: never[]) => unknown ? TValue
  : TValue extends readonly (infer TItem)[] ? Array<FormValuesPatch<TItem>>
  : TValue extends object ? { [TKey in keyof TValue]?: FormValuesPatch<TValue[TKey]> }
  : TValue;

/** A property or array-index segment in a structured form field path. */
export type FormPathSegment = string | number;

type FormPathTuple<
  TValue,
  TDepth extends readonly unknown[] = [],
> = TDepth["length"] extends 8 ? never
  : NonNullable<TValue> extends readonly (infer TItem)[] ?
      | readonly [number]
      | (FormPathTuple<TItem, readonly [...TDepth, unknown]> extends infer TChild
        ? TChild extends readonly FormPathSegment[] ? readonly [number, ...TChild] : never
        : never)
  : NonNullable<TValue> extends (...args: never[]) => unknown ? never
  : NonNullable<TValue> extends object ? {
      [TKey in Extract<keyof NonNullable<TValue>, string>]:
        | readonly [TKey]
        | (FormPathTuple<NonNullable<TValue>[TKey], readonly [...TDepth, unknown]> extends infer TChild
          ? TChild extends readonly FormPathSegment[] ? readonly [TKey, ...TChild] : never
          : never);
    }[Extract<keyof NonNullable<TValue>, string>]
  : never;

/** Typed object/array segment tuples accepted by {@link formPath}. */
export type FormPathSegments<TValues extends FormValues> = FormPathTuple<TValues>;

/** Resolves the value addressed by a typed form path segment tuple. */
export type FormPathValue<TValue, TSegments extends readonly FormPathSegment[]> = TSegments extends
  readonly [infer THead, ...infer TTail]
  ? THead extends number
    ? NonNullable<TValue> extends readonly (infer TItem)[]
      ? TTail extends readonly FormPathSegment[] ? FormPathValue<TItem, TTail> : never
    : never
  : THead extends keyof NonNullable<TValue>
    ? TTail extends readonly FormPathSegment[] ? FormPathValue<NonNullable<TValue>[THead], TTail> : never
  : never
  : TValue;

declare const FORM_PATH_NAME_TYPE: unique symbol;
declare const FORM_PATH_TYPE: unique symbol;

/** Canonical serialized name of a structured form field path. */
export type FormPathName<TValues extends FormValues = FormValues, TValue = unknown> = string & {
  readonly [FORM_PATH_NAME_TYPE]: { readonly values: TValues; readonly value: TValue };
};

/** Immutable typed identity for a structured form field. */
export interface FormPath<
  TValues extends FormValues = FormValues,
  TValue = unknown,
  TSegments extends readonly FormPathSegment[] = readonly FormPathSegment[],
> {
  readonly canonical: FormPathName<TValues, TValue>;
  readonly segments: TSegments;
  readonly [FORM_PATH_TYPE]: { readonly values: TValues; readonly value: TValue };
}

/** A flat field name or immutable structured field path accepted by form APIs. */
export type FormFieldReference<TValues extends FormValues, TValue = unknown> =
  | Extract<keyof TValues, string>
  | FormPathName<TValues, TValue>
  | FormPath<TValues, TValue>;

/** Resolves the value type carried by a serialized field name. */
export type FormFieldValue<TValues extends FormValues, TName extends FieldName<TValues>> = TName extends
  FormPathName<TValues, infer TValue> ? TValue
  : TName extends keyof TValues ? TValues[TName]
  : unknown;

/** Stable safety bounds applied by all form path helpers. */
export const FORM_PATH_LIMITS: Readonly<{
  maxDepth: 32;
  maxSegmentLength: 256;
  maxPathLength: 8192;
  maxArrayIndex: 100_000;
  maxContainerEntries: 10_000;
  maxCloneNodes: 10_000;
  maxCloneEntries: 50_000;
}> = Object.freeze({
  maxDepth: 32,
  maxSegmentLength: 256,
  maxPathLength: 8192,
  maxArrayIndex: 100_000,
  maxContainerEntries: 10_000,
  maxCloneNodes: 10_000,
  maxCloneEntries: 50_000,
});

/** Stable diagnostic codes emitted by safe form path operations. */
export type FormPathErrorCode =
  | "INVALID_PATH"
  | "PATH_TOO_LONG"
  | "TOO_DEEP"
  | "INVALID_SEGMENT"
  | "DANGEROUS_SEGMENT"
  | "INDEX_OUT_OF_RANGE"
  | "MISSING_SEGMENT"
  | "NON_CONTAINER"
  | "UNSUPPORTED_CONTAINER"
  | "ACCESSOR_PROPERTY"
  | "ACCESS_FAILED"
  | "IDENTITY_COLLISION"
  | "CYCLE"
  | "NODE_LIMIT"
  | "WIDTH_LIMIT"
  | "ENTRY_LIMIT";

/** Error thrown when a field path is malformed or cannot be traversed safely. */
export class FormPathError extends Error {
  readonly code: FormPathErrorCode;
  readonly path: string;
  readonly segmentIndex?: number;
  readonly segment?: FormPathSegment;

  constructor(
    code: FormPathErrorCode,
    message: string,
    path = "$",
    segmentIndex?: number,
    segment?: FormPathSegment,
  ) {
    super(`${message} (path ${diagnosticPath(path)})`);
    this.name = "FormPathError";
    this.code = code;
    this.path = boundedStoredPath(path);
    this.segmentIndex = segmentIndex;
    this.segment = segment;
  }
}

/** Builds a frozen, typed object/array field path. */
export function formPath<
  TValues extends FormValues,
  const TSegments extends FormPathSegments<TValues> = FormPathSegments<TValues>,
>(
  ...segments: TSegments
): FormPath<TValues, FormPathValue<TValues, TSegments>, TSegments> {
  return createFormPath(segments) as FormPath<TValues, FormPathValue<TValues, TSegments>, TSegments>;
}

/** Type-preserving path constructor returned by {@link formPathFor}. */
export interface FormPathBuilder<TValues extends FormValues> {
  <const TSegments extends FormPathSegments<TValues>>(
    ...segments: TSegments
  ): FormPath<TValues, FormPathValue<TValues, TSegments>, TSegments>;
}

/** Creates a reusable path constructor that infers nested value types for one form shape. */
export function formPathFor<TValues extends FormValues>(): FormPathBuilder<TValues> {
  return ((...segments: readonly FormPathSegment[]) => createFormPath(segments)) as FormPathBuilder<TValues>;
}

/** Parses a canonical form path string into a frozen path identity. */
export function parseFormPath<TValues extends FormValues = FormValues, TValue = unknown>(
  canonical: string,
): FormPath<TValues, TValue> {
  if (typeof canonical !== "string") {
    throw new FormPathError("INVALID_PATH", "A canonical form path must be a string", "$invalid");
  }
  if (canonical.length === 0 || canonical[0] !== "$") {
    throw new FormPathError("INVALID_PATH", "A canonical form path must begin with '$'", canonical);
  }
  if (canonical.length > FORM_PATH_LIMITS.maxPathLength) {
    throw new FormPathError("PATH_TOO_LONG", "The canonical form path exceeds the configured length bound", canonical);
  }

  const segments: FormPathSegment[] = [];
  let offset = 1;
  while (offset < canonical.length) {
    if (segments.length >= FORM_PATH_LIMITS.maxDepth) {
      throw new FormPathError("TOO_DEEP", "The form path exceeds the configured depth bound", canonical);
    }
    if (canonical[offset] !== "[") {
      throw new FormPathError("INVALID_PATH", "Expected '[' before the next path segment", canonical, segments.length);
    }
    offset += 1;
    if (canonical[offset] === '"') {
      const start = offset;
      offset += 1;
      let escaped = false;
      while (offset < canonical.length) {
        const character = canonical[offset]!;
        if (!escaped && character === '"') break;
        if (!escaped && character === "\\") escaped = true;
        else escaped = false;
        offset += 1;
      }
      if (offset >= canonical.length || canonical[offset] !== '"') {
        throw new FormPathError("INVALID_PATH", "Unterminated string path segment", canonical, segments.length);
      }
      const token = canonical.slice(start, offset + 1);
      let segment: unknown;
      try {
        segment = JSON.parse(token);
      } catch {
        throw new FormPathError("INVALID_PATH", "Invalid JSON string path segment", canonical, segments.length);
      }
      offset += 1;
      if (canonical[offset] !== "]") {
        throw new FormPathError("INVALID_PATH", "Expected ']' after a string path segment", canonical, segments.length);
      }
      segments.push(segment as string);
      offset += 1;
      continue;
    }

    const start = offset;
    while (offset < canonical.length && canonical.charCodeAt(offset) >= 48 && canonical.charCodeAt(offset) <= 57) {
      offset += 1;
    }
    if (start === offset || canonical[offset] !== "]") {
      throw new FormPathError(
        "INVALID_PATH",
        "Array indexes must be canonical non-negative integers",
        canonical,
        segments.length,
      );
    }
    const token = canonical.slice(start, offset);
    if (token.length > 1 && token[0] === "0") {
      throw new FormPathError(
        "INVALID_PATH",
        "Array indexes cannot contain leading zeroes",
        canonical,
        segments.length,
      );
    }
    segments.push(Number(token));
    offset += 1;
  }
  if (segments.length === 0) {
    throw new FormPathError("INVALID_PATH", "A form path must contain at least one segment", canonical);
  }
  const parsed = createFormPath(segments) as FormPath<TValues, TValue>;
  if (parsed.canonical !== canonical) {
    throw new FormPathError("INVALID_PATH", "The form path is not in canonical form", canonical);
  }
  return parsed;
}

/** Returns the canonical serialized name for a form path or segment tuple. */
export function formatFormPath(path: FormPath | readonly FormPathSegment[]): string {
  return isFormPath(path) ? path.canonical : createFormPath(path).canonical;
}

/** Returns a frozen copy of a path's validated segments. */
export function formPathSegments(path: FormPath): readonly FormPathSegment[] {
  assertFormPath(path);
  return Object.freeze(path.segments.slice());
}

/** Returns whether a value is a form path created by this module. */
export function isFormPath(value: unknown): value is FormPath {
  return typeof value === "object" && value !== null && FORM_PATH_INSTANCES.has(value);
}

/** Safely reads an own data property at a structured form path. */
export function getFormPath<TValues extends FormValues, TValue>(
  values: TValues,
  path: FormPath<TValues, TValue>,
): TValue | undefined {
  const result = readFormPath(values, path);
  return result.found ? result.value as TValue : undefined;
}

/** Returns whether an own data property exists at a structured form path. */
export function hasFormPath<TValues extends FormValues>(values: TValues, path: FormPath<TValues>): boolean {
  return readFormPath(values, path).found;
}

/** Immutably assigns a value at a structured form path, creating missing containers. */
export function setFormPath<TValues extends FormValues, TValue>(
  values: TValues,
  path: FormPath<TValues, TValue>,
  value: TValue,
): TValues {
  assertFormPath(path);
  return immutableSetPath(values, path.segments, 0, value, path.canonical) as TValues;
}

/** Options for immutable form path deletion. */
export interface DeleteFormPathOptions {
  pruneEmpty?: boolean;
}

/** Immutably deletes a value at a structured form path. Missing paths preserve identity. */
export function deleteFormPath<TValues extends FormValues>(
  values: TValues,
  path: FormPath<TValues>,
  options: DeleteFormPathOptions = {},
): TValues {
  assertFormPath(path);
  const result = immutableDeletePath(values, path.segments, 0, options.pruneEmpty ?? false, path.canonical);
  return (result.changed ? result.value : values) as TValues;
}

const FORM_PATH_INSTANCES = new WeakSet<object>();
const DANGEROUS_FORM_PATH_SEGMENTS = new Set(["__proto__", "prototype", "constructor"]);

export interface FormPathReadResult {
  readonly found: boolean;
  readonly value?: unknown;
}

interface FormPathDeleteResult {
  readonly changed: boolean;
  readonly value: unknown;
}

export interface NormalizedFieldReference<TValues extends FormValues> {
  readonly name: FieldName<TValues>;
  readonly identity: string;
  readonly path: FormPath<TValues>;
}

interface FormCloneContext {
  readonly active: WeakSet<object>;
  readonly clones: WeakMap<object, object>;
  nodes: number;
  entries: number;
}

function createFormPath(segments: readonly FormPathSegment[]): FormPath {
  const copied = copyAndValidateSegments(segments);
  let canonical = "$";
  for (let index = 0; index < copied.length; index += 1) {
    const segment = copied[index]!;
    canonical += typeof segment === "number" ? `[${segment}]` : `[${JSON.stringify(segment)}]`;
    if (canonical.length > FORM_PATH_LIMITS.maxPathLength) {
      throw new FormPathError(
        "PATH_TOO_LONG",
        "The canonical form path exceeds the configured length bound",
        canonical,
      );
    }
  }
  const frozenSegments = Object.freeze(copied) as readonly FormPathSegment[];
  const path = Object.freeze({
    canonical: canonical as FormPathName,
    segments: frozenSegments,
  }) as unknown as FormPath;
  FORM_PATH_INSTANCES.add(path);
  return path;
}

function copyAndValidateSegments(segments: readonly FormPathSegment[]): FormPathSegment[] {
  let array = false;
  try {
    array = Array.isArray(segments);
  } catch {
    throw new FormPathError("ACCESS_FAILED", "The path segment collection could not be inspected");
  }
  if (!array) throw new FormPathError("INVALID_PATH", "Form path segments must be an array");

  const lengthDescriptor = safeOwnDescriptor(segments, "length", "$segments", 0);
  const length = lengthDescriptor?.value;
  if (typeof length !== "number" || !Number.isSafeInteger(length) || length <= 0) {
    throw new FormPathError("INVALID_PATH", "A form path must contain at least one segment");
  }
  if (length > FORM_PATH_LIMITS.maxDepth) {
    throw new FormPathError("TOO_DEEP", "The form path exceeds the configured depth bound");
  }

  const copied = new Array<FormPathSegment>(length);
  for (let index = 0; index < length; index += 1) {
    const descriptor = safeOwnDescriptor(segments, String(index), "$segments", index);
    if (!descriptor) {
      throw new FormPathError("INVALID_SEGMENT", "Sparse path segment arrays are not supported", "$segments", index);
    }
    const segment = descriptor.value;
    validatePathSegment(segment, index);
    copied[index] = segment;
  }
  return copied;
}

function validatePathSegment(segment: unknown, index: number): asserts segment is FormPathSegment {
  if (typeof segment === "string") {
    if (segment.length === 0) {
      throw new FormPathError("INVALID_SEGMENT", "String path segments cannot be empty", "$segments", index, segment);
    }
    if (segment.length > FORM_PATH_LIMITS.maxSegmentLength) {
      throw new FormPathError(
        "INVALID_SEGMENT",
        "A string path segment exceeds the configured length bound",
        "$segments",
        index,
      );
    }
    if (DANGEROUS_FORM_PATH_SEGMENTS.has(segment)) {
      throw new FormPathError(
        "DANGEROUS_SEGMENT",
        `Prototype-sensitive segment '${segment}' is not allowed`,
        "$segments",
        index,
        segment,
      );
    }
    return;
  }
  if (typeof segment !== "number" || !Number.isSafeInteger(segment) || segment < 0 || Object.is(segment, -0)) {
    throw new FormPathError(
      "INVALID_SEGMENT",
      "Array path segments must be non-negative safe integers",
      "$segments",
      index,
    );
  }
  if (segment > FORM_PATH_LIMITS.maxArrayIndex) {
    throw new FormPathError(
      "INDEX_OUT_OF_RANGE",
      "An array path segment exceeds the configured index bound",
      "$segments",
      index,
      segment,
    );
  }
}

function assertFormPath(path: unknown): asserts path is FormPath {
  if (!isFormPath(path)) {
    throw new FormPathError("INVALID_PATH", "Expected a path created by formPath() or parseFormPath()");
  }
}

export function readFormPath(values: unknown, path: FormPath): FormPathReadResult {
  assertFormPath(path);
  let current = values;
  for (let index = 0; index < path.segments.length; index += 1) {
    if (current === undefined || current === null) return { found: false };
    const segment = path.segments[index]!;
    const descriptor = readPathDescriptor(current, segment, path.canonical, index);
    if (!descriptor) return { found: false };
    current = descriptor.value;
  }
  return { found: true, value: current };
}

function immutableSetPath(
  current: unknown,
  segments: readonly FormPathSegment[],
  index: number,
  value: unknown,
  canonical: string,
): unknown {
  const segment = segments[index]!;
  const source = current === undefined || current === null ? containerForSegment(segment) : current;
  const clone = clonePathContainer(source, segment, canonical, index);
  if (index === segments.length - 1) {
    definePathValue(clone, segment, value, canonical, index);
    return clone;
  }

  const descriptor = readPathDescriptor(source, segment, canonical, index);
  const nextSegment = segments[index + 1]!;
  const child = descriptor && descriptor.value !== undefined && descriptor.value !== null
    ? descriptor.value
    : containerForSegment(nextSegment);
  const next = immutableSetPath(child, segments, index + 1, value, canonical);
  definePathValue(clone, segment, next, canonical, index);
  return clone;
}

function immutableDeletePath(
  current: unknown,
  segments: readonly FormPathSegment[],
  index: number,
  pruneEmpty: boolean,
  canonical: string,
): FormPathDeleteResult {
  if (current === undefined || current === null) return { changed: false, value: current };
  const segment = segments[index]!;
  const descriptor = readPathDescriptor(current, segment, canonical, index);
  if (!descriptor) return { changed: false, value: current };

  const clone = clonePathContainer(current, segment, canonical, index);
  if (index === segments.length - 1) {
    deletePathValue(clone, segment, canonical, index);
    return { changed: true, value: clone };
  }

  const child = immutableDeletePath(descriptor.value, segments, index + 1, pruneEmpty, canonical);
  if (!child.changed) return { changed: false, value: current };
  if (pruneEmpty && isEmptyPathContainer(child.value, canonical, index + 1)) {
    deletePathValue(clone, segment, canonical, index);
  } else {
    definePathValue(clone, segment, child.value, canonical, index);
  }
  return { changed: true, value: clone };
}

function containerForSegment(segment: FormPathSegment): Record<string, unknown> | unknown[] {
  return typeof segment === "number" ? [] : {};
}

function readPathDescriptor(
  current: unknown,
  segment: FormPathSegment,
  canonical: string,
  index: number,
): PropertyDescriptor | undefined {
  assertCompatibleContainer(current, segment, canonical, index);
  return safeOwnDescriptor(current as object, pathPropertyKey(segment), canonical, index, segment);
}

function clonePathContainer(
  current: unknown,
  segment: FormPathSegment,
  canonical: string,
  index: number,
): Record<string, unknown> | unknown[] {
  assertCompatibleContainer(current, segment, canonical, index);
  const source = current as Record<string, unknown> | unknown[];
  return Array.isArray(source)
    ? boundedArrayClone(source, canonical, index)
    : plainObjectClone(source, canonical, index);
}

function assertCompatibleContainer(
  current: unknown,
  segment: FormPathSegment,
  canonical: string,
  index: number,
): asserts current is Record<string, unknown> | unknown[] {
  if (typeof current !== "object" || current === null) {
    throw new FormPathError("NON_CONTAINER", "Cannot traverse a non-container value", canonical, index, segment);
  }
  let isArray: boolean;
  let prototype: object | null;
  try {
    isArray = Array.isArray(current);
    prototype = Object.getPrototypeOf(current);
  } catch {
    throw new FormPathError("ACCESS_FAILED", "The path container could not be inspected", canonical, index, segment);
  }
  if ((typeof segment === "number") !== isArray) {
    throw new FormPathError(
      "NON_CONTAINER",
      typeof segment === "number" ? "A numeric segment requires an array" : "A string segment requires an object",
      canonical,
      index,
      segment,
    );
  }
  if (!isArray && prototype !== Object.prototype && prototype !== null) {
    throw new FormPathError(
      "UNSUPPORTED_CONTAINER",
      "Only plain objects and arrays can be traversed",
      canonical,
      index,
      segment,
    );
  }
}

function boundedArrayClone(source: unknown[], canonical: string, index: number): unknown[] {
  const length = safeArrayLength(source, canonical, index);
  if (length > FORM_PATH_LIMITS.maxArrayIndex + 1) {
    throw new FormPathError(
      "INDEX_OUT_OF_RANGE",
      "The source array exceeds the configured index bound",
      canonical,
      index,
    );
  }
  const clone = new Array<unknown>(length);
  for (const key of safeCloneKeys(source, canonical, index, true)) {
    if (!isCanonicalArrayProperty(key) || Number(key) >= length) {
      throw new FormPathError(
        "UNSUPPORTED_CONTAINER",
        `Unsupported enumerable array property '${key}'`,
        canonical,
        index,
      );
    }
    const descriptor = safeOwnDescriptor(source, key, canonical, index, Number(key));
    if (descriptor) defineDataProperty(clone, key, descriptor.value, canonical, index);
  }
  return clone;
}

function plainObjectClone(
  source: Record<string, unknown>,
  canonical: string,
  index: number,
): Record<string, unknown> {
  let prototype: object | null;
  try {
    prototype = Object.getPrototypeOf(source);
  } catch {
    throw new FormPathError("ACCESS_FAILED", "The object prototype could not be inspected", canonical, index);
  }
  const clone = Object.create(prototype === null ? null : Object.prototype) as Record<string, unknown>;
  for (const key of safeCloneKeys(source, canonical, index, false)) {
    rejectDangerousOwnKey(key, canonical, index);
    const descriptor = safeOwnDescriptor(source, key, canonical, index, key);
    if (descriptor) defineDataProperty(clone, key, descriptor.value, canonical, index);
  }
  return clone;
}

function definePathValue(
  container: Record<string, unknown> | unknown[],
  segment: FormPathSegment,
  value: unknown,
  canonical: string,
  index: number,
): void {
  defineDataProperty(container, pathPropertyKey(segment), value, canonical, index);
}

function deletePathValue(
  container: Record<string, unknown> | unknown[],
  segment: FormPathSegment,
  canonical: string,
  index: number,
): void {
  try {
    if (!Reflect.deleteProperty(container, pathPropertyKey(segment))) {
      throw new FormPathError("ACCESS_FAILED", "The path property could not be deleted", canonical, index, segment);
    }
  } catch (error) {
    if (error instanceof FormPathError) throw error;
    throw new FormPathError("ACCESS_FAILED", "The path property could not be deleted", canonical, index, segment);
  }
}

function defineDataProperty(
  container: object,
  key: string,
  value: unknown,
  canonical: string,
  index: number,
): void {
  try {
    Object.defineProperty(container, key, {
      configurable: true,
      enumerable: true,
      writable: true,
      value,
    });
  } catch {
    throw new FormPathError("ACCESS_FAILED", "The path property could not be defined", canonical, index, key);
  }
}

function safeOwnDescriptor(
  container: object,
  key: string,
  canonical: string,
  index: number,
  segment: FormPathSegment = key,
): PropertyDescriptor | undefined {
  let descriptor: PropertyDescriptor | undefined;
  try {
    descriptor = Object.getOwnPropertyDescriptor(container, key);
  } catch {
    throw new FormPathError(
      "ACCESS_FAILED",
      "A path property descriptor could not be inspected",
      canonical,
      index,
      segment,
    );
  }
  if (descriptor && !("value" in descriptor)) {
    throw new FormPathError("ACCESSOR_PROPERTY", "Accessor properties cannot be traversed", canonical, index, segment);
  }
  return descriptor;
}

function safeObjectKeys(container: object, canonical: string, index: number): string[] {
  try {
    return Object.keys(container);
  } catch {
    throw new FormPathError("ACCESS_FAILED", "The path container keys could not be inspected", canonical, index);
  }
}

function safeCloneKeys(container: object, canonical: string, index: number, array: boolean): string[] {
  let ownKeys: PropertyKey[];
  try {
    ownKeys = Reflect.ownKeys(container);
  } catch {
    throw new FormPathError("ACCESS_FAILED", "The path container keys could not be inspected", canonical, index);
  }
  const keys: string[] = [];
  for (const ownKey of ownKeys) {
    if (typeof ownKey !== "string") {
      throw new FormPathError("UNSUPPORTED_CONTAINER", "Symbol-keyed form data cannot be cloned", canonical, index);
    }
    if (array && ownKey === "length") continue;
    const descriptor = safeOwnDescriptor(container, ownKey, canonical, index, ownKey);
    if (!descriptor?.enumerable) {
      throw new FormPathError(
        "UNSUPPORTED_CONTAINER",
        `Non-enumerable form property '${ownKey}' cannot be cloned`,
        canonical,
        index,
        ownKey,
      );
    }
    keys.push(ownKey);
  }
  if (keys.length > FORM_PATH_LIMITS.maxContainerEntries) {
    throw new FormPathError("WIDTH_LIMIT", "A form container exceeds the configured width bound", canonical, index);
  }
  return keys;
}

function safeArrayLength(array: unknown[], canonical: string, index: number): number {
  const descriptor = safeOwnDescriptor(array, "length", canonical, index);
  const length = descriptor?.value;
  if (typeof length !== "number" || !Number.isSafeInteger(length) || length < 0) {
    throw new FormPathError("ACCESS_FAILED", "The array length is invalid", canonical, index);
  }
  return length;
}

function pathPropertyKey(segment: FormPathSegment): string {
  return typeof segment === "number" ? String(segment) : segment;
}

function isCanonicalArrayProperty(key: string): boolean {
  if (key === "0") return true;
  if (key.length === 0 || key[0] === "0") return false;
  for (let index = 0; index < key.length; index += 1) {
    const code = key.charCodeAt(index);
    if (code < 48 || code > 57) return false;
  }
  const value = Number(key);
  return Number.isSafeInteger(value) && value >= 0 && value <= FORM_PATH_LIMITS.maxArrayIndex;
}

function rejectDangerousOwnKey(key: string, canonical: string, index: number): void {
  if (DANGEROUS_FORM_PATH_SEGMENTS.has(key)) {
    throw new FormPathError(
      "DANGEROUS_SEGMENT",
      `Prototype-sensitive property '${key}' is not allowed`,
      canonical,
      index,
      key,
    );
  }
}

function isEmptyPathContainer(value: unknown, canonical: string, index: number): boolean {
  if (typeof value !== "object" || value === null) return false;
  return safeObjectKeys(value, canonical, index).length === 0;
}

export function normalizeFieldReference<TValues extends FormValues, TValue>(
  reference: FormFieldReference<TValues, TValue>,
): NormalizedFieldReference<TValues> {
  if (isFormPath(reference)) {
    return {
      name: reference.canonical as FieldName<TValues>,
      identity: `path:${reference.canonical}`,
      path: reference as FormPath<TValues>,
    };
  }
  if (typeof reference !== "string") {
    throw new FormPathError("INVALID_PATH", "A form field name must be a string or a form path");
  }
  const path = createFormPath([reference]) as FormPath<TValues>;
  return {
    name: reference as FieldName<TValues>,
    identity: `flat:${JSON.stringify(reference)}`,
    path,
  };
}

export function pathsOverlap(left: readonly FormPathSegment[], right: readonly FormPathSegment[]): boolean {
  const length = Math.min(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    if (!Object.is(left[index], right[index])) return false;
  }
  return true;
}

export function ownDataEntries<TValue>(record: Record<string, TValue>, canonical: string): Array<[string, TValue]> {
  const entries: Array<[string, TValue]> = [];
  for (const key of safeObjectKeys(record, canonical, 0)) {
    rejectDangerousOwnKey(key, canonical, 0);
    const descriptor = safeOwnDescriptor(record, key, canonical, 0, key);
    if (descriptor) entries.push([key, descriptor.value as TValue]);
  }
  return entries;
}

export function cloneFormData(value: unknown, canonical: string): unknown {
  return cloneFormDataValue(value, canonical, 0, {
    active: new WeakSet<object>(),
    clones: new WeakMap<object, object>(),
    nodes: 0,
    entries: 0,
  });
}

function cloneFormDataValue(value: unknown, canonical: string, depth: number, context: FormCloneContext): unknown {
  if (typeof value === "function") {
    throw new FormPathError("UNSUPPORTED_CONTAINER", "Functions cannot be cloned as form data", canonical);
  }
  if (typeof value !== "object" || value === null) return value;
  if (depth > FORM_PATH_LIMITS.maxDepth) {
    throw new FormPathError("TOO_DEEP", "The form snapshot exceeds the configured depth bound", canonical);
  }
  if (context.active.has(value)) {
    throw new FormPathError("CYCLE", "Cyclic form values cannot be serialized", canonical);
  }
  const existing = context.clones.get(value);
  if (existing) return existing;
  context.nodes += 1;
  if (context.nodes > FORM_PATH_LIMITS.maxCloneNodes) {
    throw new FormPathError("NODE_LIMIT", "The form snapshot exceeds the configured node bound", canonical);
  }

  let isArray: boolean;
  let prototype: object | null;
  try {
    isArray = Array.isArray(value);
    prototype = Object.getPrototypeOf(value);
  } catch {
    throw new FormPathError("ACCESS_FAILED", "A form snapshot value could not be inspected", canonical);
  }
  if (!isArray && prototype !== Object.prototype && prototype !== null) {
    throw new FormPathError("UNSUPPORTED_CONTAINER", "Only plain objects and arrays can be serialized", canonical);
  }
  const source = value as Record<string, unknown> | unknown[];
  const arrayLength = isArray ? safeArrayLength(source as unknown[], canonical, depth) : 0;
  if (isArray && arrayLength > FORM_PATH_LIMITS.maxArrayIndex + 1) {
    throw new FormPathError("INDEX_OUT_OF_RANGE", "A snapshot array exceeds the configured index bound", canonical);
  }
  const clone: Record<string, unknown> | unknown[] = isArray
    ? new Array<unknown>(arrayLength)
    : Object.create(prototype === null ? null : Object.prototype) as Record<string, unknown>;
  context.clones.set(value, clone);
  context.active.add(value);
  try {
    const keys = safeCloneKeys(source, canonical, depth, isArray);
    context.entries += keys.length;
    if (context.entries > FORM_PATH_LIMITS.maxCloneEntries) {
      throw new FormPathError("ENTRY_LIMIT", "The form snapshot exceeds the configured entry bound", canonical);
    }
    for (const key of keys) {
      if (isArray) {
        if (!isCanonicalArrayProperty(key)) {
          throw new FormPathError("UNSUPPORTED_CONTAINER", `Unsupported enumerable array property '${key}'`, canonical);
        }
      } else {
        rejectDangerousOwnKey(key, canonical, depth);
      }
      const descriptor = safeOwnDescriptor(source, key, canonical, depth, isArray ? Number(key) : key);
      if (!descriptor) continue;
      const childPath = appendDiagnosticSegment(canonical, isArray ? Number(key) : key);
      const child = cloneFormDataValue(descriptor.value, childPath, depth + 1, context);
      defineDataProperty(clone, key, child, canonical, depth);
    }
  } finally {
    context.active.delete(value);
  }
  return clone;
}

function appendDiagnosticSegment(canonical: string, segment: FormPathSegment): string {
  const suffix = typeof segment === "number" ? `[${segment}]` : `[${JSON.stringify(segment)}]`;
  return canonical.length + suffix.length <= FORM_PATH_LIMITS.maxPathLength
    ? canonical + suffix
    : `${canonical.slice(0, 120)}...`;
}

function diagnosticPath(path: string): string {
  if (path.length <= 180) return path;
  return `${path.slice(0, 177)}...`;
}

function boundedStoredPath(path: string): string {
  if (path.length <= FORM_PATH_LIMITS.maxPathLength) return path;
  return `${path.slice(0, FORM_PATH_LIMITS.maxPathLength - 3)}...`;
}
