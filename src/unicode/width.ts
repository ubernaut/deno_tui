// Copyright 2023 Im-Beast. MIT license.

import { unicodeDataSha256 } from "./data_pack.ts";
import { GENERATED_UNICODE_17_0_0_WIDTH_DATA } from "./generated/unicode_17_0_0_width.ts";

/** Defensive bounds for terminal-width profiles and text measurement. */
export const TERMINAL_WIDTH_PROFILE_LIMITS: {
  readonly maxProfiles: 32;
  readonly maxNameLength: 64;
  readonly maxDescriptionLength: 256;
  readonly maxTextUtf16Length: 1_048_576;
  readonly maxEncodedValues: 100_000;
  readonly maxDiagnosticLength: 256;
} = /* @__PURE__ */ Object.freeze({
  maxProfiles: 32,
  maxNameLength: 64,
  maxDescriptionLength: 256,
  maxTextUtf16Length: 1_048_576,
  maxEncodedValues: 100_000,
  maxDiagnosticLength: 256,
});

/** Width of one terminal cell span. */
export type TerminalCellWidth = 0 | 1 | 2;

/** Values defined by Unicode Standard Annex #11. */
export type EastAsianWidthProperty = "A" | "F" | "H" | "N" | "Na" | "W";

/** Policy categories that terminal hosts are expected to tailor. */
export interface TerminalWidthPolicy {
  readonly ambiguous: 1 | 2;
  readonly combining: 0 | 1;
  readonly privateUse: 1 | 2;
  readonly unassigned: 0 | 1 | 2;
}

/** Immutable input used to construct a named width profile. */
export interface TerminalWidthProfileDefinition {
  readonly name: string;
  readonly description?: string;
  readonly policy: TerminalWidthPolicy;
}

/** Reason that a code point received its measured cell width. */
export type TerminalWidthCategory =
  | "zero-width-control"
  | "combining"
  | "private-use"
  | "unassigned"
  | "ambiguous"
  | "fullwidth"
  | "wide"
  | "halfwidth"
  | "narrow"
  | "neutral";

/** Immutable result for one Unicode scalar value. */
export interface TerminalCodePointWidthInspection {
  readonly codePoint: number;
  readonly width: TerminalCellWidth;
  readonly category: TerminalWidthCategory;
  readonly eastAsianWidth: EastAsianWidthProperty;
  readonly assigned: boolean;
}

/** Bounded immutable summary of one text measurement. */
export interface TerminalTextWidthInspection {
  readonly utf16Length: number;
  readonly codePointCount: number;
  readonly cells: number;
  readonly categoryCounts: Readonly<Record<TerminalWidthCategory, number>>;
}

/** Clone-safe metadata for a named profile and its pinned Unicode inputs. */
export interface TerminalWidthProfileInspection {
  readonly name: string;
  readonly description: string;
  readonly unicodeVersion: string;
  readonly dataPackFingerprint: string;
  readonly widthDataFingerprint: string;
  readonly assignedSource: Readonly<{ name: string; url: string; sha256: string }>;
  readonly policy: TerminalWidthPolicy;
}

/** Clone-safe registry metadata with no mutable references to registry state. */
export interface TerminalWidthProfileRegistryInspection {
  readonly defaultProfile: string;
  readonly names: readonly string[];
  readonly profiles: readonly TerminalWidthProfileInspection[];
}

/** Construction options for an immutable profile registry. */
export interface TerminalWidthProfileRegistryOptions {
  readonly defaultProfile?: string;
}

/** Stable validation categories for malformed width data and profile inputs. */
export type TerminalWidthErrorCode =
  | "invalid-data"
  | "invalid-profile"
  | "invalid-code-point"
  | "limit-exceeded"
  | "duplicate-profile"
  | "profile-not-found";

/** Bounded structured failure raised by terminal-width APIs. */
export class TerminalWidthError extends TypeError {
  constructor(
    readonly code: TerminalWidthErrorCode,
    readonly path: string,
    detail: string,
  ) {
    const safePath = boundDiagnostic(path);
    const safeDetail = boundDiagnostic(detail);
    super(`${safePath}: ${safeDetail}`);
    this.name = "TerminalWidthError";
    this.path = safePath;
  }
}

interface CodePointRange {
  readonly start: number;
  readonly end: number;
}

interface EastAsianWidthRange extends CodePointRange {
  readonly value: EastAsianWidthProperty;
}

interface WidthData {
  readonly unicodeVersion: string;
  readonly dataPackFingerprint: string;
  readonly fingerprint: string;
  readonly source: Readonly<{ name: string; url: string; sha256: string }>;
  readonly eastAsianWidth: readonly EastAsianWidthRange[];
  readonly assigned: readonly CodePointRange[];
  readonly combining: readonly CodePointRange[];
  readonly zeroWidth: readonly CodePointRange[];
}

type Snapshot = Readonly<Record<string, unknown>>;

const PROFILE_NAME = /^[a-z][a-z0-9._-]{0,63}$/;
const SHA256 = /^[0-9a-f]{64}$/;
const MAX_CODE_POINT = 0x10ffff;
const EXPECTED_UNICODE_VERSION = "17.0.0";
const EXPECTED_DATA_PACK_FINGERPRINT = "4c885bc9201552e99c0797a4b8ea72db55fc2c315af3347ad53a9743c65bbfc2";
const WIDTH_DATA_VALUES: readonly EastAsianWidthProperty[] = /* @__PURE__ */ Object.freeze([
  "A",
  "F",
  "H",
  "N",
  "Na",
  "W",
]);
const WIDTH_PROFILE_BRAND = /* @__PURE__ */ new WeakSet<object>();

let decodedBuiltinWidthData: WidthData | undefined;

function boundDiagnostic(value: string): string {
  if (value.length <= TERMINAL_WIDTH_PROFILE_LIMITS.maxDiagnosticLength) return value;
  return `${value.slice(0, TERMINAL_WIDTH_PROFILE_LIMITS.maxDiagnosticLength - 3)}...`;
}

function invalid(code: TerminalWidthErrorCode, path: string, detail: string): never {
  throw new TerminalWidthError(code, path, detail);
}

function snapshotRecord(
  value: unknown,
  path: string,
  expectedKeys: readonly string[],
  requiredKeys: readonly string[] = expectedKeys,
  code: TerminalWidthErrorCode = "invalid-data",
): Snapshot {
  let array = false;
  try {
    array = Array.isArray(value);
  } catch {
    return invalid(code, path, "object identity could not be inspected safely");
  }
  if (value === null || typeof value !== "object" || array) {
    invalid(code, path, "expected a plain object");
  }
  let prototype: object | null;
  let keys: PropertyKey[];
  try {
    prototype = Object.getPrototypeOf(value);
    keys = Reflect.ownKeys(value);
  } catch {
    return invalid(code, path, "object could not be inspected safely");
  }
  if (prototype !== Object.prototype && prototype !== null) {
    invalid(code, path, "expected a plain object");
  }
  if (keys.length > expectedKeys.length) invalid(code, path, "property count exceeds the expected shape");
  const expected = new Set(expectedKeys);
  const result: Record<string, unknown> = Object.create(null);
  for (const key of keys) {
    if (typeof key !== "string" || !expected.has(key)) invalid(code, path, "unknown property");
    let descriptor: PropertyDescriptor | undefined;
    try {
      descriptor = Reflect.getOwnPropertyDescriptor(value, key);
    } catch {
      return invalid(code, `${path}.${key}`, "property could not be inspected safely");
    }
    if (
      descriptor === undefined || !("value" in descriptor) || descriptor.get !== undefined ||
      descriptor.set !== undefined || descriptor.enumerable !== true
    ) {
      invalid(code, `${path}.${key}`, "expected an enumerable data property");
    }
    result[key] = descriptor.value;
  }
  for (const key of requiredKeys) {
    if (!Object.hasOwn(result, key)) invalid(code, `${path}.${key}`, "required property is missing");
  }
  return result;
}

function snapshotArray(
  value: unknown,
  path: string,
  maximum: number,
  code: TerminalWidthErrorCode = "invalid-data",
): readonly unknown[] {
  let array = false;
  try {
    array = Array.isArray(value);
  } catch {
    return invalid(code, path, "array identity could not be inspected safely");
  }
  if (!array) invalid(code, path, "expected an array");
  let prototype: object | null;
  let lengthDescriptor: PropertyDescriptor | undefined;
  try {
    prototype = Object.getPrototypeOf(value);
    lengthDescriptor = Reflect.getOwnPropertyDescriptor(value!, "length");
  } catch {
    return invalid(code, path, "array could not be inspected safely");
  }
  if (prototype !== Array.prototype && prototype !== null) invalid(code, path, "expected a plain array");
  if (lengthDescriptor === undefined || !("value" in lengthDescriptor)) {
    invalid(code, `${path}.length`, "expected an own data property");
  }
  const length = lengthDescriptor.value;
  if (!Number.isSafeInteger(length) || length < 0 || length > maximum) {
    invalid("limit-exceeded", `${path}.length`, `must be from 0 through ${maximum}`);
  }
  let keys: PropertyKey[];
  try {
    keys = Reflect.ownKeys(value!);
  } catch {
    return invalid(code, path, "array keys could not be inspected safely");
  }
  if (keys.length !== length + 1) invalid(code, path, "sparse arrays and custom properties are not allowed");
  const output = new Array<unknown>(length);
  for (const key of keys) {
    if (key === "length") continue;
    if (typeof key !== "string" || !/^(0|[1-9]\d*)$/.test(key)) {
      invalid(code, path, "custom array properties are not allowed");
    }
    const index = Number(key);
    let descriptor: PropertyDescriptor | undefined;
    try {
      descriptor = Reflect.getOwnPropertyDescriptor(value!, key);
    } catch {
      return invalid(code, `${path}[${key}]`, "property could not be inspected safely");
    }
    if (
      !Number.isSafeInteger(index) || index < 0 || index >= length || descriptor === undefined ||
      !("value" in descriptor) || descriptor.get !== undefined || descriptor.set !== undefined ||
      descriptor.enumerable !== true
    ) {
      invalid(code, `${path}[${key}]`, "expected a dense enumerable data property");
    }
    output[index] = descriptor.value;
  }
  for (let index = 0; index < length; index += 1) {
    if (!Object.hasOwn(output, index)) invalid(code, `${path}[${index}]`, "sparse arrays are not allowed");
  }
  return output;
}

function requiredString(
  value: unknown,
  path: string,
  maximum: number,
  code: TerminalWidthErrorCode = "invalid-data",
): string {
  if (typeof value !== "string" || value.length === 0 || value.length > maximum) {
    invalid(code, path, `expected a string from 1 through ${maximum} UTF-16 units`);
  }
  return value;
}

function exactInteger(value: unknown, path: string, minimum: number, maximum: number): number {
  if (!Number.isSafeInteger(value) || (value as number) < minimum || (value as number) > maximum) {
    invalid("invalid-data", path, `expected an integer from ${minimum} through ${maximum}`);
  }
  return value as number;
}

function decodeRanges(value: unknown, path: string, stride: 2): readonly CodePointRange[];
function decodeRanges(value: unknown, path: string, stride: 3): readonly EastAsianWidthRange[];
function decodeRanges(
  value: unknown,
  path: string,
  stride: 2 | 3,
): readonly (CodePointRange | EastAsianWidthRange)[] {
  const encoded = snapshotArray(value, path, TERMINAL_WIDTH_PROFILE_LIMITS.maxEncodedValues);
  if (encoded.length % stride !== 0) invalid("invalid-data", path, `length must be divisible by ${stride}`);
  const output: (CodePointRange | EastAsianWidthRange)[] = [];
  let previousEnd = -1;
  for (let offset = 0; offset < encoded.length; offset += stride) {
    const gap = exactInteger(encoded[offset], `${path}[${offset}]`, 0, MAX_CODE_POINT + 1);
    const span = exactInteger(encoded[offset + 1], `${path}[${offset + 1}]`, 0, MAX_CODE_POINT);
    const start = previousEnd + 1 + gap;
    const end = start + span;
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || end > MAX_CODE_POINT) {
      invalid("invalid-data", `${path}[${offset / stride}]`, "decoded range is outside Unicode");
    }
    if (stride === 3) {
      const valueIndex = exactInteger(
        encoded[offset + 2],
        `${path}[${offset + 2}]`,
        0,
        WIDTH_DATA_VALUES.length - 1,
      );
      output.push(Object.freeze({ start, end, value: WIDTH_DATA_VALUES[valueIndex] }));
    } else {
      output.push(Object.freeze({ start, end }));
    }
    previousEnd = end;
  }
  return Object.freeze(output);
}

function builtinWidthData(): WidthData {
  if (decodedBuiltinWidthData !== undefined) return decodedBuiltinWidthData;
  const root = snapshotRecord(
    GENERATED_UNICODE_17_0_0_WIDTH_DATA,
    "$.widthData",
    [
      "schema",
      "schemaVersion",
      "unicodeVersion",
      "dataPackFingerprint",
      "source",
      "eastAsianWidthValues",
      "eastAsianWidthRanges",
      "assignedRanges",
      "combiningRanges",
      "zeroWidthRanges",
      "fingerprint",
    ],
  );
  if (root.schema !== "deno-tui.unicode-width-data" || root.schemaVersion !== 1) {
    invalid("invalid-data", "$.widthData", "unsupported width-data schema");
  }
  if (root.unicodeVersion !== EXPECTED_UNICODE_VERSION) {
    invalid("invalid-data", "$.widthData.unicodeVersion", "does not match the supported Unicode version");
  }
  if (root.dataPackFingerprint !== EXPECTED_DATA_PACK_FINGERPRINT) {
    invalid("invalid-data", "$.widthData.dataPackFingerprint", "does not match the built-in data pack");
  }
  const sourceInput = snapshotRecord(root.source, "$.widthData.source", ["name", "url", "sha256"]);
  const source = Object.freeze({
    name: requiredString(sourceInput.name, "$.widthData.source.name", 64),
    url: requiredString(sourceInput.url, "$.widthData.source.url", 2_048),
    sha256: requiredString(sourceInput.sha256, "$.widthData.source.sha256", 64),
  });
  if (!/^https:\/\/[^\s]+$/.test(source.url) || !SHA256.test(source.sha256)) {
    invalid("invalid-data", "$.widthData.source", "source URL or SHA-256 is malformed");
  }
  const values = snapshotArray(root.eastAsianWidthValues, "$.widthData.eastAsianWidthValues", 16);
  if (values.length !== WIDTH_DATA_VALUES.length) {
    invalid("invalid-data", "$.widthData.eastAsianWidthValues", "property codec has the wrong length");
  }
  for (let index = 0; index < WIDTH_DATA_VALUES.length; index += 1) {
    if (values[index] !== WIDTH_DATA_VALUES[index]) {
      invalid("invalid-data", "$.widthData.eastAsianWidthValues", "property codec does not match UAX #11");
    }
  }

  const content = {
    schema: root.schema,
    schemaVersion: root.schemaVersion,
    unicodeVersion: root.unicodeVersion,
    dataPackFingerprint: root.dataPackFingerprint,
    source: root.source,
    eastAsianWidthValues: root.eastAsianWidthValues,
    eastAsianWidthRanges: root.eastAsianWidthRanges,
    assignedRanges: root.assignedRanges,
    combiningRanges: root.combiningRanges,
    zeroWidthRanges: root.zeroWidthRanges,
  };
  const fingerprint = requiredString(root.fingerprint, "$.widthData.fingerprint", 64);
  if (!SHA256.test(fingerprint) || unicodeDataSha256(JSON.stringify(content)) !== fingerprint) {
    invalid("invalid-data", "$.widthData.fingerprint", "does not match the encoded width data");
  }

  decodedBuiltinWidthData = Object.freeze({
    unicodeVersion: EXPECTED_UNICODE_VERSION,
    dataPackFingerprint: EXPECTED_DATA_PACK_FINGERPRINT,
    fingerprint,
    source,
    eastAsianWidth: decodeRanges(root.eastAsianWidthRanges, "$.widthData.eastAsianWidthRanges", 3),
    assigned: decodeRanges(root.assignedRanges, "$.widthData.assignedRanges", 2),
    combining: decodeRanges(root.combiningRanges, "$.widthData.combiningRanges", 2),
    zeroWidth: decodeRanges(root.zeroWidthRanges, "$.widthData.zeroWidthRanges", 2),
  });
  return decodedBuiltinWidthData;
}

function findRange<T extends CodePointRange>(ranges: readonly T[], codePoint: number): T | undefined {
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

function assertScalar(codePoint: number): void {
  if (
    !Number.isInteger(codePoint) || codePoint < 0 || codePoint > MAX_CODE_POINT ||
    (codePoint >= 0xd800 && codePoint <= 0xdfff)
  ) {
    invalid("invalid-code-point", "$.codePoint", "expected a Unicode scalar value");
  }
}

function isPrivateUse(codePoint: number): boolean {
  return (codePoint >= 0xe000 && codePoint <= 0xf8ff) ||
    (codePoint >= 0xf0000 && codePoint <= 0xffffd) ||
    (codePoint >= 0x100000 && codePoint <= 0x10fffd);
}

function copyPolicy(policy: TerminalWidthPolicy): TerminalWidthPolicy {
  return Object.freeze({
    ambiguous: policy.ambiguous,
    combining: policy.combining,
    privateUse: policy.privateUse,
    unassigned: policy.unassigned,
  });
}

function normalizePolicy(value: unknown, path: string): TerminalWidthPolicy {
  const policy = snapshotRecord(
    value,
    path,
    ["ambiguous", "combining", "privateUse", "unassigned"],
    undefined,
    "invalid-profile",
  );
  if (policy.ambiguous !== 1 && policy.ambiguous !== 2) {
    invalid("invalid-profile", `${path}.ambiguous`, "expected 1 or 2 cells");
  }
  if (policy.combining !== 0 && policy.combining !== 1) {
    invalid("invalid-profile", `${path}.combining`, "expected 0 or 1 cells");
  }
  if (policy.privateUse !== 1 && policy.privateUse !== 2) {
    invalid("invalid-profile", `${path}.privateUse`, "expected 1 or 2 cells");
  }
  if (policy.unassigned !== 0 && policy.unassigned !== 1 && policy.unassigned !== 2) {
    invalid("invalid-profile", `${path}.unassigned`, "expected 0, 1, or 2 cells");
  }
  return Object.freeze({
    ambiguous: policy.ambiguous,
    combining: policy.combining,
    privateUse: policy.privateUse,
    unassigned: policy.unassigned,
  });
}

function normalizeDefinition(input: unknown): Readonly<Required<TerminalWidthProfileDefinition>> {
  const definition = snapshotRecord(
    input,
    "$.profile",
    ["name", "description", "policy"],
    ["name", "policy"],
    "invalid-profile",
  );
  const name = requiredString(
    definition.name,
    "$.profile.name",
    TERMINAL_WIDTH_PROFILE_LIMITS.maxNameLength,
    "invalid-profile",
  );
  if (!PROFILE_NAME.test(name)) invalid("invalid-profile", "$.profile.name", "expected a lowercase profile token");
  let description = "";
  if (Object.hasOwn(definition, "description")) {
    if (
      typeof definition.description !== "string" ||
      definition.description.length > TERMINAL_WIDTH_PROFILE_LIMITS.maxDescriptionLength
    ) {
      invalid("invalid-profile", "$.profile.description", "description is too long or is not a string");
    }
    description = definition.description;
  }
  return Object.freeze({ name, description, policy: normalizePolicy(definition.policy, "$.profile.policy") });
}

function categoryCounts(): Record<TerminalWidthCategory, number> {
  return {
    "zero-width-control": 0,
    combining: 0,
    "private-use": 0,
    unassigned: 0,
    ambiguous: 0,
    fullwidth: 0,
    wide: 0,
    halfwidth: 0,
    narrow: 0,
    neutral: 0,
  };
}

interface MutableCodePointWidth {
  width: TerminalCellWidth;
  category: TerminalWidthCategory;
  eastAsianWidth: EastAsianWidthProperty;
  assigned: boolean;
}

function measureCodePointInto(
  target: MutableCodePointWidth,
  codePoint: number,
  policy: TerminalWidthPolicy,
  data: WidthData,
): MutableCodePointWidth {
  const eastAsianWidth = findRange(data.eastAsianWidth, codePoint)?.value ?? "N";
  const assigned = findRange(data.assigned, codePoint) !== undefined;
  target.eastAsianWidth = eastAsianWidth;
  target.assigned = assigned;
  if (isPrivateUse(codePoint)) {
    target.width = policy.privateUse;
    target.category = "private-use";
  } else if (!assigned) {
    target.width = policy.unassigned;
    target.category = "unassigned";
  } else if (findRange(data.zeroWidth, codePoint) !== undefined) {
    target.width = 0;
    target.category = "zero-width-control";
  } else if (findRange(data.combining, codePoint) !== undefined) {
    target.width = policy.combining;
    target.category = "combining";
  } else if (eastAsianWidth === "A") {
    target.width = policy.ambiguous;
    target.category = "ambiguous";
  } else if (eastAsianWidth === "F") {
    target.width = 2;
    target.category = "fullwidth";
  } else if (eastAsianWidth === "W") {
    target.width = 2;
    target.category = "wide";
  } else if (eastAsianWidth === "H") {
    target.width = 1;
    target.category = "halfwidth";
  } else if (eastAsianWidth === "Na") {
    target.width = 1;
    target.category = "narrow";
  } else {
    target.width = 1;
    target.category = "neutral";
  }
  return target;
}

/**
 * Immutable UAX #11 width policy. Instances retain no host-global selection;
 * terminal and browser adapters can select independent profiles safely.
 */
export class UnicodeTerminalWidthProfile {
  readonly #name: string;
  readonly #description: string;
  readonly #policy: TerminalWidthPolicy;

  constructor(definitionInput: TerminalWidthProfileDefinition) {
    if (new.target !== UnicodeTerminalWidthProfile) {
      invalid("invalid-profile", "$.profile", "width profiles cannot be subclassed");
    }
    const definition = normalizeDefinition(definitionInput);
    this.#name = definition.name;
    this.#description = definition.description;
    this.#policy = definition.policy;
    WIDTH_PROFILE_BRAND.add(this);
    Object.freeze(this);
  }

  get name(): string {
    return this.#name;
  }

  get policy(): TerminalWidthPolicy {
    return copyPolicy(this.#policy);
  }

  /** Classify and measure one Unicode scalar value. */
  measureCodePoint(codePoint: number): TerminalCodePointWidthInspection {
    assertScalar(codePoint);
    const data = builtinWidthData();
    const measured = measureCodePointInto(
      { width: 0, category: "neutral", eastAsianWidth: "N", assigned: false },
      codePoint,
      this.#policy,
      data,
    );
    return Object.freeze({ codePoint, ...measured });
  }

  /** Return only the measured width of one Unicode scalar value. */
  codePointWidth(codePoint: number): TerminalCellWidth {
    return this.measureCodePoint(codePoint).width;
  }

  /** Measure a bounded string without relying on host `Intl` or mutable globals. */
  measureText(text: string): TerminalTextWidthInspection {
    if (typeof text !== "string") invalid("invalid-data", "$.text", "expected a primitive string");
    if (text.length > TERMINAL_WIDTH_PROFILE_LIMITS.maxTextUtf16Length) {
      invalid("limit-exceeded", "$.text", "text exceeds the UTF-16 measurement limit");
    }
    let codePointCount = 0;
    let cells = 0;
    const counts = categoryCounts();
    const data = builtinWidthData();
    const measured: MutableCodePointWidth = {
      width: 0,
      category: "neutral",
      eastAsianWidth: "N",
      assigned: false,
    };
    for (const scalar of text) {
      const codePoint = scalar.codePointAt(0)!;
      assertScalar(codePoint);
      measureCodePointInto(measured, codePoint, this.#policy, data);
      codePointCount += 1;
      cells += measured.width;
      counts[measured.category] += 1;
    }
    return Object.freeze({
      utf16Length: text.length,
      codePointCount,
      cells,
      categoryCounts: Object.freeze(counts),
    });
  }

  /** Return only the total cell width of a bounded string. */
  textWidth(text: string): number {
    return this.measureText(text).cells;
  }

  /** Report the complete immutable policy and pinned data identity. */
  inspect(): TerminalWidthProfileInspection {
    const data = builtinWidthData();
    return Object.freeze({
      name: this.#name,
      description: this.#description,
      unicodeVersion: data.unicodeVersion,
      dataPackFingerprint: data.dataPackFingerprint,
      widthDataFingerprint: data.fingerprint,
      assignedSource: Object.freeze({ ...data.source }),
      policy: copyPolicy(this.#policy),
    });
  }
}

function normalizeProfile(value: unknown, path: string): UnicodeTerminalWidthProfile {
  if (value !== null && typeof value === "object" && WIDTH_PROFILE_BRAND.has(value)) {
    return value as UnicodeTerminalWidthProfile;
  }
  try {
    return new UnicodeTerminalWidthProfile(value as TerminalWidthProfileDefinition);
  } catch (error) {
    if (error instanceof TerminalWidthError) throw error;
    return invalid("invalid-profile", path, "profile could not be constructed safely");
  }
}

/** Immutable named-profile collection with deterministic selection. */
export class TerminalWidthProfileRegistry {
  readonly #profiles: readonly UnicodeTerminalWidthProfile[];
  readonly #defaultProfile: string;

  constructor(
    profilesInput: readonly (UnicodeTerminalWidthProfile | TerminalWidthProfileDefinition)[],
    optionsInput: TerminalWidthProfileRegistryOptions = {},
  ) {
    const entries = snapshotArray(
      profilesInput,
      "$.profiles",
      TERMINAL_WIDTH_PROFILE_LIMITS.maxProfiles,
      "invalid-profile",
    );
    if (entries.length === 0) invalid("invalid-profile", "$.profiles", "at least one profile is required");
    const profiles = entries.map((entry, index) => normalizeProfile(entry, `$.profiles[${index}]`));
    profiles.sort((left, right) => left.name < right.name ? -1 : left.name > right.name ? 1 : 0);
    for (let index = 1; index < profiles.length; index += 1) {
      if (profiles[index - 1].name === profiles[index].name) {
        invalid("duplicate-profile", `$.profiles[${index}].name`, "profile names must be unique");
      }
    }
    const options = snapshotRecord(optionsInput, "$.options", ["defaultProfile"], [], "invalid-profile");
    const defaultProfile = options.defaultProfile ?? profiles[0].name;
    if (typeof defaultProfile !== "string" || !PROFILE_NAME.test(defaultProfile)) {
      invalid("invalid-profile", "$.options.defaultProfile", "expected a registered profile token");
    }
    if (!profiles.some((profile) => profile.name === defaultProfile)) {
      invalid("profile-not-found", "$.options.defaultProfile", "default profile is not registered");
    }
    this.#profiles = Object.freeze(profiles);
    this.#defaultProfile = defaultProfile;
    Object.freeze(this);
  }

  get defaultProfile(): string {
    return this.#defaultProfile;
  }

  get names(): readonly string[] {
    return Object.freeze(this.#profiles.map((profile) => profile.name));
  }

  select(name: string = this.#defaultProfile): UnicodeTerminalWidthProfile {
    if (typeof name !== "string" || !PROFILE_NAME.test(name)) {
      invalid("invalid-profile", "$.profileName", "expected a profile token");
    }
    const profile = this.#profiles.find((candidate) => candidate.name === name);
    if (profile === undefined) invalid("profile-not-found", "$.profileName", "profile is not registered");
    return profile;
  }

  withProfile(
    profileInput: UnicodeTerminalWidthProfile | TerminalWidthProfileDefinition,
    options: { readonly replace?: boolean; readonly makeDefault?: boolean } = {},
  ): TerminalWidthProfileRegistry {
    const profile = normalizeProfile(profileInput, "$.profile");
    const optionValues = snapshotRecord(
      options,
      "$.options",
      ["replace", "makeDefault"],
      [],
      "invalid-profile",
    );
    if (optionValues.replace !== undefined && typeof optionValues.replace !== "boolean") {
      invalid("invalid-profile", "$.options.replace", "expected a boolean");
    }
    if (optionValues.makeDefault !== undefined && typeof optionValues.makeDefault !== "boolean") {
      invalid("invalid-profile", "$.options.makeDefault", "expected a boolean");
    }
    const existing = this.#profiles.findIndex((candidate) => candidate.name === profile.name);
    if (existing >= 0 && optionValues.replace !== true) {
      invalid("duplicate-profile", "$.profile.name", "profile is already registered");
    }
    const profiles = [...this.#profiles];
    if (existing >= 0) profiles[existing] = profile;
    else profiles.push(profile);
    return new TerminalWidthProfileRegistry(profiles, {
      defaultProfile: optionValues.makeDefault === true ? profile.name : this.#defaultProfile,
    });
  }

  inspect(): TerminalWidthProfileRegistryInspection {
    return Object.freeze({
      defaultProfile: this.#defaultProfile,
      names: Object.freeze(this.#profiles.map((profile) => profile.name)),
      profiles: Object.freeze(this.#profiles.map((profile) => profile.inspect())),
    });
  }
}

/** Unicode-recommended narrow ambiguous-width profile for most terminals. */
export const UNICODE_NARROW_WIDTH_PROFILE: UnicodeTerminalWidthProfile = /* @__PURE__ */
  new UnicodeTerminalWidthProfile({
    name: "unicode-narrow",
    description: "Unicode 17 defaults with ambiguous, private-use, and unassigned scalars measured narrowly.",
    policy: { ambiguous: 1, combining: 0, privateUse: 1, unassigned: 1 },
  });

/** CJK-oriented profile for terminals that render ambiguous and private ranges wide. */
export const CJK_WIDE_WIDTH_PROFILE: UnicodeTerminalWidthProfile = /* @__PURE__ */
  new UnicodeTerminalWidthProfile({
    name: "cjk-wide",
    description: "CJK terminal policy with ambiguous, private-use, and unassigned scalars measured as two cells.",
    policy: { ambiguous: 2, combining: 0, privateUse: 2, unassigned: 2 },
  });

/** Diagnostic profile that makes otherwise zero-width combining scalars visible. */
export const VISIBLE_COMBINING_WIDTH_PROFILE: UnicodeTerminalWidthProfile = /* @__PURE__ */
  new UnicodeTerminalWidthProfile({
    name: "visible-combining",
    description: "Diagnostic policy that assigns one visible cell to combining scalars.",
    policy: { ambiguous: 1, combining: 1, privateUse: 1, unassigned: 1 },
  });

/** Immutable built-in registry; selecting from it never changes another host. */
export const DEFAULT_TERMINAL_WIDTH_PROFILE_REGISTRY: TerminalWidthProfileRegistry = /* @__PURE__ */
  new TerminalWidthProfileRegistry(
    [UNICODE_NARROW_WIDTH_PROFILE, CJK_WIDE_WIDTH_PROFILE, VISIBLE_COMBINING_WIDTH_PROFILE],
    { defaultProfile: UNICODE_NARROW_WIDTH_PROFILE.name },
  );

/** Convenience helper using an explicit profile, defaulting to Unicode narrow. */
export function terminalCodePointWidth(
  codePoint: number,
  profile: UnicodeTerminalWidthProfile = UNICODE_NARROW_WIDTH_PROFILE,
): TerminalCellWidth {
  if (profile === null || typeof profile !== "object" || !WIDTH_PROFILE_BRAND.has(profile)) {
    invalid("invalid-profile", "$.profile", "expected a UnicodeTerminalWidthProfile");
  }
  return profile.codePointWidth(codePoint);
}

/** Convenience helper using an explicit profile, defaulting to Unicode narrow. */
export function terminalTextWidth(
  text: string,
  profile: UnicodeTerminalWidthProfile = UNICODE_NARROW_WIDTH_PROFILE,
): number {
  if (profile === null || typeof profile !== "object" || !WIDTH_PROFILE_BRAND.has(profile)) {
    invalid("invalid-profile", "$.profile", "expected a UnicodeTerminalWidthProfile");
  }
  return profile.textWidth(text);
}
