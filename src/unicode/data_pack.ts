// Copyright 2023 Im-Beast. MIT license.

/** Stable renderer-neutral schema identifier for generated Unicode data packs. */
export const UNICODE_DATA_PACK_SCHEMA = "deno-tui.unicode-data-pack" as const;

/** Current data-pack schema version. This is independent of the Unicode version. */
export const UNICODE_DATA_PACK_SCHEMA_VERSION = 1 as const;

/** Defensive limits applied before caller data is retained or inspected. */
export const UNICODE_DATA_PACK_LIMITS: {
  readonly maxPacks: 32;
  readonly maxSources: 16;
  readonly maxEmojiProperties: 64;
  readonly maxRangesPerTable: 100_000;
  readonly maxTotalRanges: 250_000;
  readonly maxDepth: 8;
  readonly maxStringLength: 256;
  readonly maxUrlLength: 2_048;
} = Object.freeze(
  {
    maxPacks: 32,
    maxSources: 16,
    maxEmojiProperties: 64,
    maxRangesPerTable: 100_000,
    maxTotalRanges: 250_000,
    maxDepth: 8,
    maxStringLength: 256,
    maxUrlLength: 2_048,
  } as const,
);

/** Inclusive Unicode scalar/code-point range. Surrogates are data-addressable. */
export interface UnicodeCodePointRange {
  readonly start: number;
  readonly end: number;
}

/** Inclusive range associated with a Unicode property value. */
export interface UnicodeValuedRange extends UnicodeCodePointRange {
  readonly value: string;
}

/** One binary Unicode property represented by sorted, disjoint ranges. */
export interface UnicodeBinaryPropertyRanges {
  readonly property: string;
  readonly ranges: readonly UnicodeCodePointRange[];
}

/** Reproducible upstream input pinned by URL and SHA-256. */
export interface UnicodeDataPackSource {
  readonly name: string;
  readonly url: string;
  readonly sha256: string;
}

/** Tables required by the first data-pack schema. */
export interface UnicodeDataPackTables {
  readonly graphemeBreak: readonly UnicodeValuedRange[];
  readonly eastAsianWidth: readonly UnicodeValuedRange[];
  readonly emoji: readonly UnicodeBinaryPropertyRanges[];
}

/** Fingerprint-free pack content used to derive the pack identity. */
export interface UnicodeDataPackContent {
  readonly schema: typeof UNICODE_DATA_PACK_SCHEMA;
  readonly schemaVersion: typeof UNICODE_DATA_PACK_SCHEMA_VERSION;
  readonly unicodeVersion: string;
  readonly sources: readonly UnicodeDataPackSource[];
  readonly tables: UnicodeDataPackTables;
}

/** Fully validated, immutable Unicode data pack. */
export interface UnicodeDataPack extends UnicodeDataPackContent {
  readonly fingerprint: string;
}

/** Bounded clone-safe summary of one data pack. */
export interface UnicodeDataPackInspection {
  readonly schema: typeof UNICODE_DATA_PACK_SCHEMA;
  readonly schemaVersion: typeof UNICODE_DATA_PACK_SCHEMA_VERSION;
  readonly unicodeVersion: string;
  readonly fingerprint: string;
  readonly sources: readonly UnicodeDataPackSource[];
  readonly graphemeBreakRanges: number;
  readonly eastAsianWidthRanges: number;
  readonly emojiProperties: readonly string[];
  readonly emojiRanges: number;
}

/** Deterministic selector accepted by a pack registry. */
export interface UnicodeDataPackSelector {
  readonly unicodeVersion?: string;
  readonly fingerprint?: string;
}

/** Construction options for an immutable data-pack registry. */
export interface UnicodeDataPackRegistryOptions {
  readonly defaultUnicodeVersion?: string;
}

/** Clone-safe registry metadata. */
export interface UnicodeDataPackRegistryInspection {
  readonly defaultUnicodeVersion: string;
  readonly versions: readonly string[];
  readonly packs: readonly UnicodeDataPackInspection[];
}

/** Raised when untrusted input does not satisfy the bounded pack schema. */
export class UnicodeDataPackValidationError extends TypeError {
  readonly code = "UNICODE_DATA_PACK_INVALID";

  constructor(readonly path: string, detail: string) {
    super(`Invalid Unicode data pack at ${path}: ${detail}`);
    this.name = "UnicodeDataPackValidationError";
  }
}

/** Raised when a deterministic registry cannot resolve a requested pack. */
export class UnicodeDataPackNotFoundError extends Error {
  readonly code = "UNICODE_DATA_PACK_NOT_FOUND";

  constructor() {
    super("No Unicode data pack matches the requested selector.");
    this.name = "UnicodeDataPackNotFoundError";
  }
}

const MAX_CODE_POINT = 0x10ffff;
const TOKEN_PATTERN = /^[A-Za-z][A-Za-z0-9_-]{0,63}$/;
const VERSION_PATTERN = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const SHA256_PATTERN = /^[0-9a-f]{64}$/;
const EAST_ASIAN_WIDTH_VALUES = new Set(["A", "F", "H", "N", "Na", "W"]);

type Snapshot = Readonly<Record<string, unknown>>;

function invalid(path: string, detail: string): never {
  throw new UnicodeDataPackValidationError(path, detail);
}

function snapshotObject(
  value: unknown,
  path: string,
  expectedKeys: readonly string[],
  depth: number,
  requiredKeys: readonly string[] = expectedKeys,
): Snapshot {
  if (depth > UNICODE_DATA_PACK_LIMITS.maxDepth) invalid(path, "maximum nesting depth exceeded");
  if (value === null || typeof value !== "object") invalid(path, "expected an object");

  let prototype: object | null;
  let descriptors: PropertyDescriptorMap;
  try {
    prototype = Object.getPrototypeOf(value);
    descriptors = Object.getOwnPropertyDescriptors(value);
  } catch {
    return invalid(path, "object descriptors could not be inspected safely");
  }
  if (prototype !== Object.prototype && prototype !== null) {
    invalid(path, "expected a plain object");
  }

  const expected = new Set(expectedKeys);
  const snapshot: Record<string, unknown> = Object.create(null);
  for (const key of Reflect.ownKeys(descriptors)) {
    if (typeof key !== "string") invalid(path, "symbol keys are not allowed");
    if (!expected.has(key)) invalid(`${path}.${key}`, "unknown property");
    const descriptor = descriptors[key];
    if (
      descriptor === undefined || !("value" in descriptor) || descriptor.get !== undefined ||
      descriptor.set !== undefined
    ) {
      invalid(`${path}.${key}`, "accessors are not allowed");
    }
    if (descriptor.enumerable !== true) invalid(`${path}.${key}`, "properties must be enumerable");
    snapshot[key] = descriptor.value;
  }
  for (const key of requiredKeys) {
    if (!Object.hasOwn(snapshot, key)) invalid(`${path}.${key}`, "required property is missing");
  }
  return snapshot;
}

function snapshotArray(value: unknown, path: string, maximum: number, depth: number): readonly unknown[] {
  if (depth > UNICODE_DATA_PACK_LIMITS.maxDepth) invalid(path, "maximum nesting depth exceeded");
  let isArray = false;
  try {
    isArray = Array.isArray(value);
  } catch {
    return invalid(path, "array identity could not be inspected safely");
  }
  if (!isArray) invalid(path, "expected an array");

  let prototype: object | null;
  let descriptors: PropertyDescriptorMap;
  try {
    prototype = Object.getPrototypeOf(value);
    descriptors = Object.getOwnPropertyDescriptors(value!);
  } catch {
    return invalid(path, "array descriptors could not be inspected safely");
  }
  if (prototype !== Array.prototype && prototype !== null) invalid(path, "expected a plain array");

  const lengthDescriptor = descriptors.length;
  if (lengthDescriptor === undefined || !("value" in lengthDescriptor)) invalid(`${path}.length`, "missing length");
  const length = lengthDescriptor.value;
  if (!Number.isSafeInteger(length) || length < 0 || length > maximum) {
    invalid(`${path}.length`, `must be an integer from 0 through ${maximum}`);
  }

  const result = new Array<unknown>(length);
  for (const key of Reflect.ownKeys(descriptors)) {
    if (typeof key !== "string") invalid(path, "symbol keys are not allowed");
    if (key === "length") continue;
    if (!/^(0|[1-9]\d*)$/.test(key)) invalid(`${path}.${key}`, "custom array properties are not allowed");
    const index = Number(key);
    if (!Number.isSafeInteger(index) || index < 0 || index >= length || String(index) !== key) {
      invalid(`${path}.${key}`, "invalid array index");
    }
    const descriptor = descriptors[key];
    if (
      descriptor === undefined || !("value" in descriptor) || descriptor.get !== undefined ||
      descriptor.set !== undefined
    ) {
      invalid(`${path}[${index}]`, "accessors are not allowed");
    }
    if (descriptor.enumerable !== true) invalid(`${path}[${index}]`, "items must be enumerable");
    result[index] = descriptor.value;
  }
  for (let index = 0; index < length; index++) {
    if (!Object.hasOwn(result, index)) invalid(`${path}[${index}]`, "sparse arrays are not allowed");
  }
  return result;
}

function boundedString(
  value: unknown,
  path: string,
  maximum: number = UNICODE_DATA_PACK_LIMITS.maxStringLength,
): string {
  if (typeof value !== "string") invalid(path, "expected a string");
  if (value.length === 0 || value.length > maximum) invalid(path, `length must be from 1 through ${maximum}`);
  return value;
}

function exactInteger(value: unknown, path: string, minimum: number, maximum: number): number {
  if (!Number.isSafeInteger(value) || (value as number) < minimum || (value as number) > maximum) {
    invalid(path, `must be an integer from ${minimum} through ${maximum}`);
  }
  return value as number;
}

function freezeRange(start: number, end: number): UnicodeCodePointRange {
  return Object.freeze({ start, end });
}

function normalizeCodePointRange(value: unknown, path: string, depth: number): UnicodeCodePointRange {
  const object = snapshotObject(value, path, ["start", "end"], depth);
  const start = exactInteger(object.start, `${path}.start`, 0, MAX_CODE_POINT);
  const end = exactInteger(object.end, `${path}.end`, 0, MAX_CODE_POINT);
  if (end < start) invalid(path, "range end precedes its start");
  return freezeRange(start, end);
}

function normalizeValuedRanges(
  value: unknown,
  path: string,
  depth: number,
  allowedValues?: ReadonlySet<string>,
): readonly UnicodeValuedRange[] {
  const entries = snapshotArray(value, path, UNICODE_DATA_PACK_LIMITS.maxRangesPerTable, depth);
  const result: UnicodeValuedRange[] = [];
  let previousEnd = -1;
  for (let index = 0; index < entries.length; index++) {
    const entryPath = `${path}[${index}]`;
    const object = snapshotObject(entries[index], entryPath, ["start", "end", "value"], depth + 1);
    const start = exactInteger(object.start, `${entryPath}.start`, 0, MAX_CODE_POINT);
    const end = exactInteger(object.end, `${entryPath}.end`, 0, MAX_CODE_POINT);
    if (end < start) invalid(entryPath, "range end precedes its start");
    if (start <= previousEnd) invalid(entryPath, "ranges must be sorted and non-overlapping");
    const rangeValue = boundedString(object.value, `${entryPath}.value`, 64);
    if (!TOKEN_PATTERN.test(rangeValue)) invalid(`${entryPath}.value`, "expected a Unicode property token");
    if (allowedValues !== undefined && !allowedValues.has(rangeValue)) {
      invalid(`${entryPath}.value`, "unsupported property value");
    }
    result.push(Object.freeze({ start, end, value: rangeValue }));
    previousEnd = end;
  }
  return Object.freeze(result);
}

function normalizeBinaryRanges(value: unknown, path: string, depth: number): readonly UnicodeCodePointRange[] {
  const entries = snapshotArray(value, path, UNICODE_DATA_PACK_LIMITS.maxRangesPerTable, depth);
  const result: UnicodeCodePointRange[] = [];
  let previousEnd = -1;
  for (let index = 0; index < entries.length; index++) {
    const range = normalizeCodePointRange(entries[index], `${path}[${index}]`, depth + 1);
    if (range.start <= previousEnd) invalid(`${path}[${index}]`, "ranges must be sorted and non-overlapping");
    result.push(range);
    previousEnd = range.end;
  }
  return Object.freeze(result);
}

function normalizeSources(value: unknown, path: string, depth: number): readonly UnicodeDataPackSource[] {
  const entries = snapshotArray(value, path, UNICODE_DATA_PACK_LIMITS.maxSources, depth);
  if (entries.length === 0) invalid(path, "at least one source is required");
  const result: UnicodeDataPackSource[] = [];
  let previousName = "";
  const urls = new Set<string>();
  for (let index = 0; index < entries.length; index++) {
    const entryPath = `${path}[${index}]`;
    const object = snapshotObject(entries[index], entryPath, ["name", "url", "sha256"], depth + 1);
    const name = boundedString(object.name, `${entryPath}.name`, 64);
    if (!TOKEN_PATTERN.test(name)) invalid(`${entryPath}.name`, "expected a source token");
    if (name <= previousName) invalid(`${entryPath}.name`, "sources must be uniquely sorted by name");
    const url = boundedString(object.url, `${entryPath}.url`, UNICODE_DATA_PACK_LIMITS.maxUrlLength);
    if (!/^https:\/\/[^\s]+$/.test(url)) invalid(`${entryPath}.url`, "expected an HTTPS URL");
    if (urls.has(url)) invalid(`${entryPath}.url`, "source URLs must be unique");
    const sha256 = boundedString(object.sha256, `${entryPath}.sha256`, 64);
    if (!SHA256_PATTERN.test(sha256)) invalid(`${entryPath}.sha256`, "expected a lowercase SHA-256 digest");
    result.push(Object.freeze({ name, url, sha256 }));
    previousName = name;
    urls.add(url);
  }
  return Object.freeze(result);
}

function normalizeEmoji(value: unknown, path: string, depth: number): readonly UnicodeBinaryPropertyRanges[] {
  const entries = snapshotArray(value, path, UNICODE_DATA_PACK_LIMITS.maxEmojiProperties, depth);
  if (entries.length === 0) invalid(path, "at least one emoji property is required");
  const result: UnicodeBinaryPropertyRanges[] = [];
  let previousProperty = "";
  let totalRanges = 0;
  for (let index = 0; index < entries.length; index++) {
    const entryPath = `${path}[${index}]`;
    const object = snapshotObject(entries[index], entryPath, ["property", "ranges"], depth + 1);
    const property = boundedString(object.property, `${entryPath}.property`, 64);
    if (!TOKEN_PATTERN.test(property)) invalid(`${entryPath}.property`, "expected a Unicode property token");
    if (property <= previousProperty) invalid(`${entryPath}.property`, "properties must be uniquely sorted by name");
    const ranges = normalizeBinaryRanges(object.ranges, `${entryPath}.ranges`, depth + 1);
    totalRanges += ranges.length;
    if (totalRanges > UNICODE_DATA_PACK_LIMITS.maxTotalRanges) invalid(path, "total range limit exceeded");
    result.push(Object.freeze({ property, ranges }));
    previousProperty = property;
  }
  return Object.freeze(result);
}

function normalizeContent(value: unknown, path = "$", depth = 0): UnicodeDataPackContent {
  const object = snapshotObject(
    value,
    path,
    ["schema", "schemaVersion", "unicodeVersion", "sources", "tables"],
    depth,
  );
  if (object.schema !== UNICODE_DATA_PACK_SCHEMA) invalid(`${path}.schema`, "unsupported schema identifier");
  if (object.schemaVersion !== UNICODE_DATA_PACK_SCHEMA_VERSION) {
    invalid(`${path}.schemaVersion`, "unsupported schema version");
  }
  const unicodeVersion = boundedString(object.unicodeVersion, `${path}.unicodeVersion`, 32);
  const versionMatch = VERSION_PATTERN.exec(unicodeVersion);
  if (versionMatch === null || versionMatch.slice(1).some((part) => Number(part) > 999)) {
    invalid(`${path}.unicodeVersion`, "expected a bounded major.minor.patch version");
  }
  const sources = normalizeSources(object.sources, `${path}.sources`, depth + 1);
  const tableObject = snapshotObject(
    object.tables,
    `${path}.tables`,
    ["graphemeBreak", "eastAsianWidth", "emoji"],
    depth + 1,
  );
  const graphemeBreak = normalizeValuedRanges(
    tableObject.graphemeBreak,
    `${path}.tables.graphemeBreak`,
    depth + 2,
  );
  const eastAsianWidth = normalizeValuedRanges(
    tableObject.eastAsianWidth,
    `${path}.tables.eastAsianWidth`,
    depth + 2,
    EAST_ASIAN_WIDTH_VALUES,
  );
  const emoji = normalizeEmoji(tableObject.emoji, `${path}.tables.emoji`, depth + 2);
  const totalRanges = graphemeBreak.length + eastAsianWidth.length +
    emoji.reduce((sum, property) => sum + property.ranges.length, 0);
  if (totalRanges > UNICODE_DATA_PACK_LIMITS.maxTotalRanges) invalid(`${path}.tables`, "total range limit exceeded");

  const tables: UnicodeDataPackTables = Object.freeze({ graphemeBreak, eastAsianWidth, emoji });
  return Object.freeze({
    schema: UNICODE_DATA_PACK_SCHEMA,
    schemaVersion: UNICODE_DATA_PACK_SCHEMA_VERSION,
    unicodeVersion,
    sources,
    tables,
  });
}

const SHA256_CONSTANTS = new Uint32Array([
  0x428a2f98,
  0x71374491,
  0xb5c0fbcf,
  0xe9b5dba5,
  0x3956c25b,
  0x59f111f1,
  0x923f82a4,
  0xab1c5ed5,
  0xd807aa98,
  0x12835b01,
  0x243185be,
  0x550c7dc3,
  0x72be5d74,
  0x80deb1fe,
  0x9bdc06a7,
  0xc19bf174,
  0xe49b69c1,
  0xefbe4786,
  0x0fc19dc6,
  0x240ca1cc,
  0x2de92c6f,
  0x4a7484aa,
  0x5cb0a9dc,
  0x76f988da,
  0x983e5152,
  0xa831c66d,
  0xb00327c8,
  0xbf597fc7,
  0xc6e00bf3,
  0xd5a79147,
  0x06ca6351,
  0x14292967,
  0x27b70a85,
  0x2e1b2138,
  0x4d2c6dfc,
  0x53380d13,
  0x650a7354,
  0x766a0abb,
  0x81c2c92e,
  0x92722c85,
  0xa2bfe8a1,
  0xa81a664b,
  0xc24b8b70,
  0xc76c51a3,
  0xd192e819,
  0xd6990624,
  0xf40e3585,
  0x106aa070,
  0x19a4c116,
  0x1e376c08,
  0x2748774c,
  0x34b0bcb5,
  0x391c0cb3,
  0x4ed8aa4a,
  0x5b9cca4f,
  0x682e6ff3,
  0x748f82ee,
  0x78a5636f,
  0x84c87814,
  0x8cc70208,
  0x90befffa,
  0xa4506ceb,
  0xbef9a3f7,
  0xc67178f2,
]);

function rotateRight(value: number, count: number): number {
  return (value >>> count) | (value << (32 - count));
}

/** Deterministic synchronous SHA-256 used for pack identity and offline checks. */
export function unicodeDataSha256(input: string | Uint8Array): string {
  const bytes = typeof input === "string" ? new TextEncoder().encode(input) : input;
  const paddedLength = Math.ceil((bytes.length + 9) / 64) * 64;
  const padded = new Uint8Array(paddedLength);
  padded.set(bytes);
  padded[bytes.length] = 0x80;
  const bitLength = bytes.length * 8;
  const view = new DataView(padded.buffer);
  view.setUint32(paddedLength - 8, Math.floor(bitLength / 0x100000000), false);
  view.setUint32(paddedLength - 4, bitLength >>> 0, false);

  const hash = new Uint32Array([
    0x6a09e667,
    0xbb67ae85,
    0x3c6ef372,
    0xa54ff53a,
    0x510e527f,
    0x9b05688c,
    0x1f83d9ab,
    0x5be0cd19,
  ]);
  const words = new Uint32Array(64);
  for (let offset = 0; offset < paddedLength; offset += 64) {
    for (let index = 0; index < 16; index++) words[index] = view.getUint32(offset + index * 4, false);
    for (let index = 16; index < 64; index++) {
      const left = words[index - 15];
      const right = words[index - 2];
      const sigma0 = rotateRight(left, 7) ^ rotateRight(left, 18) ^ (left >>> 3);
      const sigma1 = rotateRight(right, 17) ^ rotateRight(right, 19) ^ (right >>> 10);
      words[index] = (words[index - 16] + sigma0 + words[index - 7] + sigma1) >>> 0;
    }

    let [a, b, c, d, e, f, g, h] = hash;
    for (let index = 0; index < 64; index++) {
      const sum1 = rotateRight(e, 6) ^ rotateRight(e, 11) ^ rotateRight(e, 25);
      const choose = (e & f) ^ (~e & g);
      const temp1 = (h + sum1 + choose + SHA256_CONSTANTS[index] + words[index]) >>> 0;
      const sum0 = rotateRight(a, 2) ^ rotateRight(a, 13) ^ rotateRight(a, 22);
      const majority = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (sum0 + majority) >>> 0;
      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }
    hash[0] = (hash[0] + a) >>> 0;
    hash[1] = (hash[1] + b) >>> 0;
    hash[2] = (hash[2] + c) >>> 0;
    hash[3] = (hash[3] + d) >>> 0;
    hash[4] = (hash[4] + e) >>> 0;
    hash[5] = (hash[5] + f) >>> 0;
    hash[6] = (hash[6] + g) >>> 0;
    hash[7] = (hash[7] + h) >>> 0;
  }
  return Array.from(hash, (word) => word.toString(16).padStart(8, "0")).join("");
}

/** Compute the identity of strictly normalized fingerprint-free pack content. */
export function fingerprintUnicodeDataPackContent(input: unknown): string {
  return unicodeDataSha256(JSON.stringify(normalizeContent(input)));
}

/** Strictly validate, clone, fingerprint-check, and deeply freeze an untrusted pack. */
export function validateUnicodeDataPack(input: unknown): UnicodeDataPack {
  const object = snapshotObject(
    input,
    "$",
    ["schema", "schemaVersion", "unicodeVersion", "fingerprint", "sources", "tables"],
    0,
  );
  const content = normalizeContent({
    schema: object.schema,
    schemaVersion: object.schemaVersion,
    unicodeVersion: object.unicodeVersion,
    sources: object.sources,
    tables: object.tables,
  });
  const fingerprint = boundedString(object.fingerprint, "$.fingerprint", 64);
  if (!SHA256_PATTERN.test(fingerprint)) invalid("$.fingerprint", "expected a lowercase SHA-256 digest");
  const actualFingerprint = unicodeDataSha256(JSON.stringify(content));
  if (fingerprint !== actualFingerprint) invalid("$.fingerprint", "does not match normalized pack content");
  return Object.freeze({
    schema: content.schema,
    schemaVersion: content.schemaVersion,
    unicodeVersion: content.unicodeVersion,
    fingerprint,
    sources: content.sources,
    tables: content.tables,
  });
}

/** Serialize a validated pack with canonical field order and stable whitespace. */
export function serializeUnicodeDataPack(input: unknown): string {
  return `${JSON.stringify(validateUnicodeDataPack(input), null, 2)}\n`;
}

/** Return bounded metadata with no references to internal registry arrays. */
export function inspectUnicodeDataPack(input: unknown): UnicodeDataPackInspection {
  const pack = validateUnicodeDataPack(input);
  const sources = Object.freeze(pack.sources.map((source) => Object.freeze({ ...source })));
  const emojiProperties = Object.freeze(pack.tables.emoji.map((entry) => entry.property));
  return Object.freeze({
    schema: pack.schema,
    schemaVersion: pack.schemaVersion,
    unicodeVersion: pack.unicodeVersion,
    fingerprint: pack.fingerprint,
    sources,
    graphemeBreakRanges: pack.tables.graphemeBreak.length,
    eastAsianWidthRanges: pack.tables.eastAsianWidth.length,
    emojiProperties,
    emojiRanges: pack.tables.emoji.reduce((sum, entry) => sum + entry.ranges.length, 0),
  });
}

function assertCodePoint(codePoint: number): void {
  if (!Number.isInteger(codePoint) || codePoint < 0 || codePoint > MAX_CODE_POINT) {
    throw new RangeError(`Unicode code point must be an integer from 0 through ${MAX_CODE_POINT}.`);
  }
}

function findRange<T extends UnicodeCodePointRange>(ranges: readonly T[], codePoint: number): T | undefined {
  let low = 0;
  let high = ranges.length - 1;
  while (low <= high) {
    const middle = low + ((high - low) >>> 1);
    const range = ranges[middle];
    if (codePoint < range.start) high = middle - 1;
    else if (codePoint > range.end) low = middle + 1;
    else return range;
  }
  return undefined;
}

/** Look up Grapheme_Cluster_Break, returning the UAX #29 default `Other`. */
export function lookupGraphemeBreakProperty(pack: UnicodeDataPack, codePoint: number): string {
  assertCodePoint(codePoint);
  return findRange(pack.tables.graphemeBreak, codePoint)?.value ?? "Other";
}

/** Look up East_Asian_Width, returning the UAX #11 file default `N`. */
export function lookupEastAsianWidthProperty(pack: UnicodeDataPack, codePoint: number): string {
  assertCodePoint(codePoint);
  return findRange(pack.tables.eastAsianWidth, codePoint)?.value ?? "N";
}

/** Test one binary property from the UTS #51 emoji property table. */
export function hasEmojiProperty(pack: UnicodeDataPack, property: string, codePoint: number): boolean {
  assertCodePoint(codePoint);
  if (typeof property !== "string" || !TOKEN_PATTERN.test(property)) return false;
  let low = 0;
  let high = pack.tables.emoji.length - 1;
  while (low <= high) {
    const middle = low + ((high - low) >>> 1);
    const entry = pack.tables.emoji[middle];
    if (property < entry.property) high = middle - 1;
    else if (property > entry.property) low = middle + 1;
    else return findRange(entry.ranges, codePoint) !== undefined;
  }
  return false;
}

/** Return every emoji property for a code point in deterministic name order. */
export function lookupEmojiProperties(pack: UnicodeDataPack, codePoint: number): readonly string[] {
  assertCodePoint(codePoint);
  return Object.freeze(
    pack.tables.emoji
      .filter((entry) => findRange(entry.ranges, codePoint) !== undefined)
      .map((entry) => entry.property),
  );
}

function compareVersions(left: string, right: string): number {
  const leftParts = left.split(".").map(Number);
  const rightParts = right.split(".").map(Number);
  for (let index = 0; index < 3; index++) {
    if (leftParts[index] !== rightParts[index]) return leftParts[index] - rightParts[index];
  }
  return 0;
}

function normalizeSelector(value: string | UnicodeDataPackSelector | undefined): UnicodeDataPackSelector {
  if (value === undefined) return Object.freeze({});
  if (typeof value === "string") {
    if (!VERSION_PATTERN.test(value)) invalid("$.selector", "expected a major.minor.patch version");
    return Object.freeze({ unicodeVersion: value });
  }
  const object = snapshotObject(value, "$.selector", ["unicodeVersion", "fingerprint"], 0, []);
  if (!Object.hasOwn(object, "unicodeVersion") && !Object.hasOwn(object, "fingerprint")) {
    invalid("$.selector", "at least one selector field is required");
  }
  let unicodeVersion: string | undefined;
  let fingerprint: string | undefined;
  if (Object.hasOwn(object, "unicodeVersion")) {
    unicodeVersion = boundedString(object.unicodeVersion, "$.selector.unicodeVersion", 32);
    if (!VERSION_PATTERN.test(unicodeVersion)) invalid("$.selector.unicodeVersion", "invalid version");
  }
  if (Object.hasOwn(object, "fingerprint")) {
    fingerprint = boundedString(object.fingerprint, "$.selector.fingerprint", 64);
    if (!SHA256_PATTERN.test(fingerprint)) invalid("$.selector.fingerprint", "invalid fingerprint");
  }
  return Object.freeze({ unicodeVersion, fingerprint });
}

/**
 * Immutable, process-local pack registry. Construct separate registries for
 * fixtures or compatibility runs; no module-global selection is mutated.
 */
export class UnicodeDataPackRegistry {
  readonly #packs: readonly UnicodeDataPack[];
  readonly #defaultUnicodeVersion: string;

  constructor(packsInput: readonly unknown[], options: UnicodeDataPackRegistryOptions = {}) {
    const entries = snapshotArray(packsInput, "$.packs", UNICODE_DATA_PACK_LIMITS.maxPacks, 0);
    if (entries.length === 0) invalid("$.packs", "at least one pack is required");
    const packs = entries.map((entry) => validateUnicodeDataPack(entry));
    packs.sort((left, right) => compareVersions(left.unicodeVersion, right.unicodeVersion));
    for (let index = 1; index < packs.length; index++) {
      if (packs[index - 1].unicodeVersion === packs[index].unicodeVersion) {
        invalid("$.packs", "Unicode versions must be unique");
      }
      if (packs[index - 1].fingerprint === packs[index].fingerprint) {
        invalid("$.packs", "pack fingerprints must be unique");
      }
    }
    const optionValues = snapshotObject(options, "$.options", ["defaultUnicodeVersion"], 0, []);
    const defaultUnicodeVersion = optionValues.defaultUnicodeVersion ?? packs.at(-1)!.unicodeVersion;
    if (typeof defaultUnicodeVersion !== "string" || !VERSION_PATTERN.test(defaultUnicodeVersion)) {
      invalid("$.options.defaultUnicodeVersion", "expected a registered major.minor.patch version");
    }
    if (!packs.some((pack) => pack.unicodeVersion === defaultUnicodeVersion)) {
      invalid("$.options.defaultUnicodeVersion", "version is not registered");
    }
    this.#packs = Object.freeze(packs);
    this.#defaultUnicodeVersion = defaultUnicodeVersion;
    Object.freeze(this);
  }

  get defaultUnicodeVersion(): string {
    return this.#defaultUnicodeVersion;
  }

  get versions(): readonly string[] {
    return Object.freeze(this.#packs.map((pack) => pack.unicodeVersion));
  }

  select(selectorInput?: string | UnicodeDataPackSelector): UnicodeDataPack {
    const selector = normalizeSelector(selectorInput);
    const unicodeVersion = selector.unicodeVersion ??
      (selector.fingerprint === undefined ? this.#defaultUnicodeVersion : undefined);
    const match = this.#packs.find((pack) =>
      (unicodeVersion === undefined || pack.unicodeVersion === unicodeVersion) &&
      (selector.fingerprint === undefined || pack.fingerprint === selector.fingerprint)
    );
    if (match === undefined) throw new UnicodeDataPackNotFoundError();
    return match;
  }

  withPack(pack: unknown, options: UnicodeDataPackRegistryOptions = {}): UnicodeDataPackRegistry {
    return new UnicodeDataPackRegistry([...this.#packs, pack], {
      defaultUnicodeVersion: options.defaultUnicodeVersion ?? this.#defaultUnicodeVersion,
    });
  }

  inspect(): UnicodeDataPackRegistryInspection {
    const packs = Object.freeze(this.#packs.map((pack) => inspectUnicodeDataPack(pack)));
    return Object.freeze({
      defaultUnicodeVersion: this.#defaultUnicodeVersion,
      versions: Object.freeze(this.#packs.map((pack) => pack.unicodeVersion)),
      packs,
    });
  }
}
