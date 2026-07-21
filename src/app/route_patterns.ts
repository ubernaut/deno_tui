// Copyright 2023 Im-Beast. MIT license.

import { createRouteLocation, RouteLocationError } from "./router.ts";
import type { RouteLocation } from "./router.ts";

/** Stable resource and diagnostic bounds for compiled route patterns. */
export const ROUTE_PATTERN_LIMITS: Readonly<{
  maxPatternLength: number;
  maxPathLength: number;
  maxSegments: number;
  maxParameters: number;
  maxParameterNameLength: number;
  maxSegmentLength: number;
  maxDecodedLength: number;
  maxCodecs: number;
  maxCodecInvocations: number;
  maxMatchStates: number;
  maxCandidates: number;
  maxRouteIdLength: number;
  maxDiagnosticLength: number;
  maxAmbiguityCandidates: number;
}> = Object.freeze({
  maxPatternLength: 8_192,
  maxPathLength: 65_536,
  maxSegments: 64,
  maxParameters: 32,
  maxParameterNameLength: 64,
  maxSegmentLength: 8_192,
  maxDecodedLength: 65_536,
  maxCodecs: 32,
  maxCodecInvocations: 256,
  maxMatchStates: 4_096,
  maxCandidates: 256,
  maxRouteIdLength: 4_096,
  maxDiagnosticLength: 256,
  maxAmbiguityCandidates: 16,
});

/** Immutable primitive values accepted from route-parameter codecs. */
export type RouteParameterValue = string | number | boolean;

/** A bidirectional codec for one typed path parameter. */
export interface RouteParameterCodec<TValue extends RouteParameterValue = RouteParameterValue> {
  /** Decodes one already percent-decoded path value. */
  decode(value: string): TValue;
  /** Formats one typed value before deterministic percent encoding. */
  encode(value: TValue): string;
}

/** A parameter-name-to-codec mapping accepted by {@link compileRoutePattern}. */
export type RouteParameterCodecMap = Readonly<Record<string, RouteParameterCodec>>;

/** Extracts the decoded value carried by a route parameter codec. */
export type RouteParameterCodecValue<TCodec> = TCodec extends RouteParameterCodec<infer TValue> ? TValue : never;

type RouteSegmentParameter<
  TSegment extends string,
  TCodecs extends RouteParameterCodecMap,
> = TSegment extends `:${infer TName}?`
  ? TName extends keyof TCodecs ? { readonly [TKey in TName]?: RouteParameterCodecValue<TCodecs[TName]> }
  : { readonly [TKey in TName]?: string }
  : TSegment extends `:${infer TName}` | `*${infer TName}`
    ? TName extends keyof TCodecs ? { readonly [TKey in TName]: RouteParameterCodecValue<TCodecs[TName]> }
    : { readonly [TKey in TName]: string }
  : Record<never, never>;

type RoutePatternParameterIntersection<
  TPattern extends string,
  TCodecs extends RouteParameterCodecMap,
> = TPattern extends `/${infer TRest}` ? RoutePatternSegmentsParameterIntersection<TRest, TCodecs>
  : Record<never, never>;

type RoutePatternSegmentsParameterIntersection<
  TRest extends string,
  TCodecs extends RouteParameterCodecMap,
> = TRest extends `${infer THead}/${infer TTail}`
  ? RouteSegmentParameter<THead, TCodecs> & RoutePatternSegmentsParameterIntersection<TTail, TCodecs>
  : RouteSegmentParameter<TRest, TCodecs>;

type Simplify<TValue> = { readonly [TKey in keyof TValue]: TValue[TKey] };

/** Infers the typed build/match parameter object for a literal route pattern. */
export type RoutePatternParameters<
  TPattern extends string,
  TCodecs extends RouteParameterCodecMap = Record<never, never>,
> = string extends TPattern ? Readonly<Record<string, RouteParameterValue>>
  : Simplify<RoutePatternParameterIntersection<TPattern, TCodecs>>;

/** Options used to compile one immutable route pattern. */
export interface RoutePatternCompileOptions<
  TCodecs extends RouteParameterCodecMap = RouteParameterCodecMap,
> {
  readonly codecs?: TCodecs;
}

/** Stable validation categories emitted by {@link RoutePatternError}. */
export type RoutePatternErrorCode =
  | "invalid-pattern"
  | "invalid-path"
  | "invalid-parameter"
  | "invalid-codec"
  | "invalid-encoding"
  | "codec-failure"
  | "duplicate-route"
  | "unknown-route"
  | "ambiguous-match"
  | "stale-registry"
  | "limit-exceeded";

/** One bounded candidate attached to an ambiguity diagnostic. */
export interface RoutePatternAmbiguityCandidate {
  readonly routeId: string;
  readonly pattern: string;
}

const EMPTY_AMBIGUITY_CANDIDATES: readonly RoutePatternAmbiguityCandidate[] = Object.freeze([]);

/** Structured error thrown for unsafe patterns, paths, codecs, or resolution. */
export class RoutePatternError extends TypeError {
  /** Machine-readable failure category. */
  readonly code: RoutePatternErrorCode;
  /** Bounded location within the rejected value. */
  readonly path: string;
  /** Bounded immutable candidates for an ambiguous match. */
  readonly candidates: readonly RoutePatternAmbiguityCandidate[];

  constructor(
    code: RoutePatternErrorCode,
    path: string,
    message: string,
    candidates: readonly RoutePatternAmbiguityCandidate[] = EMPTY_AMBIGUITY_CANDIDATES,
  ) {
    const boundedPath = boundedDiagnostic(path);
    const boundedMessage = boundedDiagnostic(message);
    super(`${boundedPath}: ${boundedMessage}`);
    this.name = "RoutePatternError";
    this.code = code;
    this.path = boundedPath;
    this.candidates = cloneAmbiguityCandidates(candidates);
  }
}

/** Immutable metadata describing one compiled route pattern. */
export interface RoutePatternInspection {
  readonly source: string;
  readonly parameterNames: readonly string[];
  readonly segmentKinds: readonly RoutePatternSegmentKind[];
  readonly rank: readonly number[];
}

/** Public segment categories used for deterministic pattern ranking. */
export type RoutePatternSegmentKind = "static" | "parameter" | "optional" | "splat";

/** Immutable successful match from one compiled route pattern. */
export interface RoutePatternMatch<TParameters extends object = Readonly<Record<string, RouteParameterValue>>> {
  readonly pathname: string;
  readonly params: Readonly<TParameters>;
  readonly pathParams: Readonly<Record<string, string>>;
  readonly rank: readonly number[];
}

/** Browser-safe immutable compiled route-pattern contract. */
export interface CompiledRoutePattern<
  TParameters extends object = Readonly<Record<string, RouteParameterValue>>,
> {
  readonly source: string;
  readonly parameterNames: readonly string[];
  /** Matches one pathname or returns undefined when its structure does not match. */
  match(pathname: string): RoutePatternMatch<TParameters> | undefined;
  /** Builds one deterministic pathname, rejecting assignments that rematch with different parameter identity. */
  build(params: TParameters): string;
  /** Returns a frozen, structured-clone-safe inspection snapshot. */
  inspect(): RoutePatternInspection;
}

/** Immutable registry resolution ready to pass to application navigation. */
export interface RoutePatternResolution {
  readonly routeId: string;
  readonly pattern: string;
  readonly pathname: string;
  readonly params: Readonly<Record<string, RouteParameterValue>>;
  readonly pathParams: Readonly<Record<string, string>>;
  readonly rank: readonly number[];
  readonly location: RouteLocation;
}

/** One entry in a route-pattern registry inspection. */
export interface RoutePatternRegistryEntryInspection extends RoutePatternInspection {
  readonly routeId: string;
}

/** Immutable, structured-clone-safe registry inspection. */
export interface RoutePatternRegistryInspection {
  readonly size: number;
  readonly revision: number;
  readonly entries: readonly RoutePatternRegistryEntryInspection[];
}

type InternalRouteSegment =
  | Readonly<{ kind: "static"; value: string }>
  | Readonly<{
    kind: "parameter" | "optional" | "splat";
    name: string;
    codec: CodecRuntime;
  }>;

interface ParsedPathname {
  readonly pathname: string;
  readonly segments: readonly string[];
  readonly encodedSeparators: readonly boolean[];
}

interface CodecRuntime {
  readonly decode: (value: string) => RouteParameterValue;
  readonly encode: (value: RouteParameterValue) => string;
}

interface CodecBudget {
  invocations: number;
  stringUnits: number;
}

interface PartialPatternMatch {
  readonly params: ReadonlyMap<string, RouteParameterValue>;
  readonly pathParams: ReadonlyMap<string, string>;
  readonly rank: readonly number[];
  readonly absentOptionalCount: number;
}

interface CompiledPatternRuntime {
  readonly source: string;
  readonly segments: readonly InternalRouteSegment[];
  readonly parameterNames: readonly string[];
  readonly inspection: RoutePatternInspection;
  matchParsed(pathname: ParsedPathname): RoutePatternMatch<Record<string, RouteParameterValue>> | undefined;
  build(params: object): string;
}

interface RegistryEntry {
  readonly routeId: string;
  readonly pattern: CompiledRoutePattern;
  readonly runtime: CompiledPatternRuntime;
}

const CODEC_RUNTIMES = new WeakMap<object, CodecRuntime>();
const COMPILED_PATTERN_RUNTIMES = new WeakMap<object, CompiledPatternRuntime>();
const UNSAFE_PARAMETER_NAMES = new Set(["__proto__", "prototype", "constructor"]);
const PARAMETER_NAME_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;
const INTEGER_PARAMETER_PATTERN = /^-?(?:0|[1-9][0-9]*)$/;
const STATIC_RANK = 4;
const PARAMETER_RANK = 3;
const OPTIONAL_RANK = 2;
const SPLAT_RANK = 1;

/**
 * Snapshots a custom bidirectional codec into a frozen, trusted codec value.
 *
 * Accessor definitions and later replacement of the caller's methods are
 * rejected or ignored; codec callbacks are invoked only during match/build.
 */
export function defineRouteParameterCodec<TValue extends RouteParameterValue>(
  definition: RouteParameterCodec<TValue>,
): RouteParameterCodec<TValue> {
  const properties = ownDataProperties(definition, "codec", ["decode", "encode"], 2);
  const decode = properties.get("decode");
  const encode = properties.get("encode");
  if (typeof decode !== "function" || typeof encode !== "function") {
    throw new RoutePatternError("invalid-codec", "codec", "decode and encode must be own data functions");
  }

  const runtime: CodecRuntime = Object.freeze({
    decode: (value: string) => Reflect.apply(decode, undefined, [value]) as RouteParameterValue,
    encode: (value: RouteParameterValue) => Reflect.apply(encode, undefined, [value]) as string,
  });
  const codec: RouteParameterCodec<TValue> = Object.freeze({
    decode: (value: string) => runtime.decode(value) as TValue,
    encode: (value: TValue) => runtime.encode(value),
  });
  CODEC_RUNTIMES.set(codec, runtime);
  return codec;
}

/** Identity string codec used when a pattern parameter has no explicit codec. */
export const routeStringParameterCodec: RouteParameterCodec<string> = defineRouteParameterCodec<string>({
  decode(value: string): string {
    return value;
  },
  encode(value: string): string {
    if (typeof value !== "string") throw new TypeError("expected a string");
    return value;
  },
});

/** Canonical signed safe-integer route parameter codec. */
export const routeIntegerParameterCodec: RouteParameterCodec<number> = defineRouteParameterCodec<number>({
  decode(value: string): number {
    if (!INTEGER_PARAMETER_PATTERN.test(value)) throw new TypeError("expected a canonical integer");
    const decoded = Number(value);
    if (!Number.isSafeInteger(decoded) || Object.is(decoded, -0)) throw new TypeError("integer is out of range");
    return decoded;
  },
  encode(value: number): string {
    if (!Number.isSafeInteger(value) || Object.is(value, -0)) throw new TypeError("expected a safe integer");
    return `${value}`;
  },
});

/** Canonical `true`/`false` route parameter codec. */
export const routeBooleanParameterCodec: RouteParameterCodec<boolean> = defineRouteParameterCodec<boolean>({
  decode(value: string): boolean {
    if (value === "true") return true;
    if (value === "false") return false;
    throw new TypeError("expected true or false");
  },
  encode(value: boolean): string {
    if (typeof value !== "boolean") throw new TypeError("expected a boolean");
    return value ? "true" : "false";
  },
});

/** Compiles a decoded-literal route pattern with identity string parameters. */
export function compileRoutePattern<const TPattern extends string>(
  source: TPattern,
): CompiledRoutePattern<RoutePatternParameters<TPattern>>;
/** Compiles a decoded-literal route pattern with typed parameter codecs. */
export function compileRoutePattern<
  const TPattern extends string,
  const TCodecs extends RouteParameterCodecMap,
>(
  source: TPattern,
  options: RoutePatternCompileOptions<TCodecs>,
): CompiledRoutePattern<RoutePatternParameters<TPattern, TCodecs>>;
/** Compiles a bounded immutable route pattern, optionally using typed parameter codecs. */
export function compileRoutePattern(
  source: string,
  options: RoutePatternCompileOptions = {},
): CompiledRoutePattern {
  assertBoundedString(source, "pattern", ROUTE_PATTERN_LIMITS.maxPatternLength, "invalid-pattern");
  const codecMap = snapshotCompileOptions(options);
  const segments = parsePattern(source, codecMap);
  const parameterNames: string[] = [];
  const segmentKinds: RoutePatternSegmentKind[] = [];
  const rank: number[] = [];
  for (const segment of segments) {
    segmentKinds.push(segment.kind);
    rank.push(rankForKind(segment.kind));
    if (segment.kind !== "static") parameterNames.push(segment.name);
  }
  const frozenParameterNames = Object.freeze(parameterNames.slice());
  const inspection = freezeInspection({
    source,
    parameterNames: frozenParameterNames,
    segmentKinds: Object.freeze(segmentKinds.slice()),
    rank: Object.freeze(rank.slice()),
  });

  const runtime: CompiledPatternRuntime = Object.freeze({
    source,
    segments,
    parameterNames: frozenParameterNames,
    inspection,
    matchParsed(pathname: ParsedPathname) {
      return matchCompiledPattern(runtime, pathname);
    },
    build(params: object) {
      return buildCompiledPattern(runtime, params);
    },
  });
  const compiled: CompiledRoutePattern = Object.freeze({
    source,
    parameterNames: frozenParameterNames,
    match(pathname: string) {
      return runtime.matchParsed(parsePathname(pathname));
    },
    build(params: object) {
      return runtime.build(params);
    },
    inspect() {
      return cloneInspection(inspection);
    },
  });
  COMPILED_PATTERN_RUNTIMES.set(compiled, runtime);
  return compiled;
}

/**
 * Bounded registry that ranks every matching candidate before returning a
 * navigation-ready location. Equal-ranked winners are rejected explicitly.
 */
export class RoutePatternRegistry {
  readonly #entries = new Map<string, RegistryEntry>();
  #revision = 0;

  /** Number of registered route patterns. */
  get size(): number {
    return this.#entries.size;
  }

  /** Registers one trusted compiled pattern under an immutable route ID. */
  register<TParameters extends object>(
    routeId: string,
    pattern: CompiledRoutePattern<TParameters>,
  ): this {
    assertRouteId(routeId, "routeId");
    if (this.#entries.has(routeId)) {
      throw new RoutePatternError("duplicate-route", "routeId", "a route with this ID is already registered");
    }
    if (this.#entries.size >= ROUTE_PATTERN_LIMITS.maxCandidates) {
      throw new RoutePatternError("limit-exceeded", "registry", "candidate limit exceeded");
    }
    const runtime = compiledPatternRuntime(pattern, "pattern");
    this.#entries.set(routeId, Object.freeze({ routeId, pattern: pattern as CompiledRoutePattern, runtime }));
    this.#revision += 1;
    return this;
  }

  /** Removes one route pattern without exposing its retained entry. */
  unregister(routeId: string): boolean {
    assertRouteId(routeId, "routeId");
    const removed = this.#entries.delete(routeId);
    if (removed) this.#revision += 1;
    return removed;
  }

  /** Removes all route patterns. */
  clear(): void {
    if (this.#entries.size === 0) return;
    this.#entries.clear();
    this.#revision += 1;
  }

  /** Returns a trusted immutable compiled pattern without mutable registry state. */
  pattern(routeId: string): CompiledRoutePattern | undefined {
    assertRouteId(routeId, "routeId");
    return this.#entries.get(routeId)?.pattern;
  }

  /** Builds a pathname for one registered route, detecting reentrant mutation. */
  build(routeId: string, params: Readonly<Record<string, RouteParameterValue>>): string {
    assertRouteId(routeId, "routeId");
    const entry = this.#entries.get(routeId);
    if (!entry) throw new RoutePatternError("unknown-route", "routeId", "no route is registered with this ID");
    const revision = this.#revision;
    let pathname: string;
    try {
      pathname = entry.runtime.build(params);
    } catch (error) {
      this.#assertRevision(revision);
      throw error;
    }
    this.#assertRevision(revision);
    return pathname;
  }

  /**
   * Resolves and ranks every structural match before returning a route.
   * Codec failures cannot activate their candidate; if no other candidate
   * wins, the first bounded codec diagnostic is reported.
   */
  resolve(pathname: string): RoutePatternResolution | undefined {
    const parsed = parsePathname(pathname);
    const revision = this.#revision;
    const entries = Array.from(this.#entries.values());
    let best: { entry: RegistryEntry; match: RoutePatternMatch<Record<string, RouteParameterValue>> } | undefined;
    let ambiguous: Array<{ entry: RegistryEntry; match: RoutePatternMatch<Record<string, RouteParameterValue>> }> = [];
    let firstCodecError: RoutePatternError | undefined;

    for (const entry of entries) {
      let match: RoutePatternMatch<Record<string, RouteParameterValue>> | undefined;
      try {
        match = entry.runtime.matchParsed(parsed);
      } catch (error) {
        this.#assertRevision(revision);
        if (error instanceof RoutePatternError && error.code === "codec-failure") {
          firstCodecError ??= error;
          continue;
        }
        throw error;
      }
      this.#assertRevision(revision);
      if (!match) continue;
      if (!best) {
        best = { entry, match };
        ambiguous = [best];
        continue;
      }
      const comparison = compareRanks(match.rank, best.match.rank);
      if (comparison > 0) {
        best = { entry, match };
        ambiguous = [best];
      } else if (comparison === 0) {
        ambiguous.push({ entry, match });
      }
    }

    this.#assertRevision(revision);
    if (!best) {
      if (firstCodecError) throw firstCodecError;
      return undefined;
    }
    if (ambiguous.length > 1) {
      const candidates = ambiguous.map(({ entry }) => ({
        routeId: entry.routeId,
        pattern: entry.runtime.source,
      }));
      throw new RoutePatternError(
        "ambiguous-match",
        "pathname",
        `${ambiguous.length} equally ranked routes match before dispatch`,
        candidates,
      );
    }

    let location: RouteLocation;
    try {
      location = createRouteLocation({
        routeId: best.entry.routeId,
        pathParams: best.match.pathParams,
      });
    } catch (error) {
      if (error instanceof RouteLocationError) {
        throw new RoutePatternError(
          error.code === "limit-exceeded" ? "limit-exceeded" : "invalid-path",
          "pathname",
          error.code === "limit-exceeded"
            ? "matched route exceeds the route-location resource budget"
            : "matched route could not be represented as a route location",
        );
      }
      throw error;
    }
    return Object.freeze({
      routeId: best.entry.routeId,
      pattern: best.entry.runtime.source,
      pathname: best.match.pathname,
      params: best.match.params,
      pathParams: best.match.pathParams,
      rank: best.match.rank,
      location,
    });
  }

  /** Returns a frozen, structured-clone-safe registry snapshot. */
  inspect(): RoutePatternRegistryInspection {
    const entries: RoutePatternRegistryEntryInspection[] = [];
    for (const entry of this.#entries.values()) {
      const inspection = entry.runtime.inspection;
      entries.push(Object.freeze({
        routeId: entry.routeId,
        source: inspection.source,
        parameterNames: Object.freeze(inspection.parameterNames.slice()),
        segmentKinds: Object.freeze(inspection.segmentKinds.slice()),
        rank: Object.freeze(inspection.rank.slice()),
      }));
    }
    return Object.freeze({
      size: entries.length,
      revision: this.#revision,
      entries: Object.freeze(entries),
    });
  }

  #assertRevision(revision: number): void {
    if (revision !== this.#revision) {
      throw new RoutePatternError("stale-registry", "registry", "registry changed during route evaluation");
    }
  }
}

function snapshotCompileOptions(options: RoutePatternCompileOptions): ReadonlyMap<string, CodecRuntime> {
  const properties = ownDataProperties(options, "options", ["codecs"], 1);
  const codecs = properties.get("codecs");
  if (codecs === undefined) return new Map();
  const codecProperties = ownDataProperties(
    codecs,
    "options.codecs",
    undefined,
    ROUTE_PATTERN_LIMITS.maxCodecs,
  );
  if (codecProperties.size > ROUTE_PATTERN_LIMITS.maxCodecs) {
    throw new RoutePatternError("limit-exceeded", "options.codecs", "codec limit exceeded");
  }
  const output = new Map<string, CodecRuntime>();
  for (const [name, codec] of codecProperties) {
    assertParameterName(name, `options.codecs.${diagnosticKey(name)}`);
    const runtime = CODEC_RUNTIMES.get(codec as object);
    if (!runtime) {
      throw new RoutePatternError(
        "invalid-codec",
        `options.codecs.${diagnosticKey(name)}`,
        "codec must be created by defineRouteParameterCodec and cannot be proxy-wrapped",
      );
    }
    output.set(name, runtime);
  }
  return output;
}

function parsePattern(source: string, codecs: ReadonlyMap<string, CodecRuntime>): readonly InternalRouteSegment[] {
  if (!source.startsWith("/")) {
    throw new RoutePatternError("invalid-pattern", "pattern", "route patterns must begin with '/'");
  }
  if (source.includes("?") && !source.split("/").some((segment) => segment.startsWith(":") && segment.endsWith("?"))) {
    throw new RoutePatternError("invalid-pattern", "pattern", "query strings are not part of route patterns");
  }
  if (source.includes("#")) {
    throw new RoutePatternError("invalid-pattern", "pattern", "fragments are not part of route patterns");
  }
  if (source === "/") {
    if (codecs.size > 0) {
      throw new RoutePatternError("invalid-codec", "options.codecs", "root pattern does not declare parameters");
    }
    return Object.freeze([]);
  }
  const sourceSegments = source.slice(1).split("/");
  if (sourceSegments.length > ROUTE_PATTERN_LIMITS.maxSegments) {
    throw new RoutePatternError("limit-exceeded", "pattern", "segment limit exceeded");
  }
  const seenParameters = new Set<string>();
  const segments: InternalRouteSegment[] = [];
  for (let index = 0; index < sourceSegments.length; index += 1) {
    const token = sourceSegments[index]!;
    const path = `pattern.segment[${index}]`;
    if (token.length === 0) {
      throw new RoutePatternError("invalid-pattern", path, "empty and trailing segments are not allowed");
    }
    assertBoundedString(token, path, ROUTE_PATTERN_LIMITS.maxSegmentLength, "invalid-pattern");
    if (token.startsWith(":")) {
      const optional = token.endsWith("?");
      const name = token.slice(1, optional ? -1 : undefined);
      addPatternParameter(name, path, seenParameters);
      segments.push(Object.freeze({
        kind: optional ? "optional" : "parameter",
        name,
        codec: codecs.get(name) ?? codecRuntime(routeStringParameterCodec),
      }));
      continue;
    }
    if (token.startsWith("*")) {
      const name = token.slice(1);
      addPatternParameter(name, path, seenParameters);
      if (index !== sourceSegments.length - 1) {
        throw new RoutePatternError("invalid-pattern", path, "a splat parameter must be the final segment");
      }
      segments.push(Object.freeze({
        kind: "splat",
        name,
        codec: codecs.get(name) ?? codecRuntime(routeStringParameterCodec),
      }));
      continue;
    }
    if (token.includes("?") || token.includes(":") || token.includes("*")) {
      throw new RoutePatternError("invalid-pattern", path, "reserved pattern syntax must begin a parameter segment");
    }
    if (token === "." || token === "..") {
      throw new RoutePatternError("invalid-pattern", path, "dot path segments are not stable route literals");
    }
    segments.push(Object.freeze({ kind: "static", value: token }));
  }
  if (seenParameters.size > ROUTE_PATTERN_LIMITS.maxParameters) {
    throw new RoutePatternError("limit-exceeded", "pattern", "parameter limit exceeded");
  }
  for (const name of codecs.keys()) {
    if (!seenParameters.has(name)) {
      throw new RoutePatternError(
        "invalid-codec",
        `options.codecs.${diagnosticKey(name)}`,
        "codec does not correspond to a pattern parameter",
      );
    }
  }
  return Object.freeze(segments);
}

function addPatternParameter(name: string, path: string, seen: Set<string>): void {
  assertParameterName(name, path);
  if (seen.has(name)) {
    throw new RoutePatternError("invalid-pattern", path, "parameter names must be unique within a pattern");
  }
  seen.add(name);
}

function parsePathname(pathname: string): ParsedPathname {
  assertBoundedString(pathname, "pathname", ROUTE_PATTERN_LIMITS.maxPathLength, "invalid-path");
  if (!pathname.startsWith("/")) {
    throw new RoutePatternError("invalid-path", "pathname", "pathnames must begin with '/'");
  }
  if (pathname.includes("?") || pathname.includes("#")) {
    throw new RoutePatternError("invalid-path", "pathname", "query and fragment values must use RouteLocation fields");
  }
  if (pathname === "/") {
    return Object.freeze({
      pathname,
      segments: Object.freeze([]),
      encodedSeparators: Object.freeze([]),
    });
  }
  const encodedSegments = pathname.slice(1).split("/");
  if (encodedSegments.length > ROUTE_PATTERN_LIMITS.maxSegments) {
    throw new RoutePatternError("limit-exceeded", "pathname", "segment limit exceeded");
  }
  const decodedSegments = new Array<string>(encodedSegments.length);
  const encodedSeparators = new Array<boolean>(encodedSegments.length);
  let decodedLength = 0;
  for (let index = 0; index < encodedSegments.length; index += 1) {
    const encoded = encodedSegments[index]!;
    const path = `pathname.segment[${index}]`;
    if (encoded.length === 0) {
      throw new RoutePatternError("invalid-path", path, "empty and trailing path segments are not allowed");
    }
    let decoded: string;
    try {
      decoded = decodeURIComponent(encoded);
    } catch {
      throw new RoutePatternError("invalid-encoding", path, "malformed percent encoding");
    }
    assertBoundedString(decoded, path, ROUTE_PATTERN_LIMITS.maxSegmentLength, "invalid-path");
    if (decoded === "." || decoded === "..") {
      throw new RoutePatternError("invalid-path", path, "dot path segments are not stable route values");
    }
    decodedLength += decoded.length;
    if (decodedLength > ROUTE_PATTERN_LIMITS.maxDecodedLength) {
      throw new RoutePatternError("limit-exceeded", "pathname", "aggregate decoded length limit exceeded");
    }
    decodedSegments[index] = decoded;
    encodedSeparators[index] = decoded.includes("/");
  }
  return Object.freeze({
    pathname,
    segments: Object.freeze(decodedSegments),
    encodedSeparators: Object.freeze(encodedSeparators),
  });
}

function matchCompiledPattern(
  runtime: CompiledPatternRuntime,
  parsed: ParsedPathname,
  budget: CodecBudget = { invocations: 0, stringUnits: 0 },
): RoutePatternMatch<Record<string, RouteParameterValue>> | undefined {
  const structuralMemo = new Map<string, boolean>();
  const stateBudget = { states: 0 };
  if (!structurallyMatches(runtime.segments, parsed.segments, 0, 0, structuralMemo)) return undefined;
  const partial = matchPatternFrom(
    runtime.segments,
    parsed.segments,
    parsed.encodedSeparators,
    0,
    0,
    budget,
    stateBudget,
    structuralMemo,
  );
  if (!partial) return undefined;
  const rank = [...partial.rank, -partial.absentOptionalCount];
  return Object.freeze({
    pathname: parsed.pathname,
    params: frozenRecord(partial.params),
    pathParams: frozenStringRecord(partial.pathParams),
    rank: Object.freeze(rank),
  });
}

function buildCompiledPattern(runtime: CompiledPatternRuntime, paramsInput: object): string {
  const properties = ownDataProperties(
    paramsInput,
    "params",
    undefined,
    ROUTE_PATTERN_LIMITS.maxParameters,
  );
  const expected = new Set(runtime.parameterNames);
  for (const name of properties.keys()) {
    assertParameterName(name, `params.${diagnosticKey(name)}`);
    if (!expected.has(name)) {
      throw new RoutePatternError("invalid-parameter", `params.${diagnosticKey(name)}`, "unknown route parameter");
    }
  }

  const output: string[] = [];
  const budget: CodecBudget = { invocations: 0, stringUnits: 0 };
  for (let index = 0; index < runtime.segments.length; index += 1) {
    const segment = runtime.segments[index]!;
    if (segment.kind === "static") {
      output.push(encodePathSegment(segment.value, `pattern.segment[${index}]`));
      continue;
    }
    const hasValue = properties.has(segment.name);
    if (!hasValue) {
      if (segment.kind === "optional") continue;
      throw new RoutePatternError(
        "invalid-parameter",
        `params.${diagnosticKey(segment.name)}`,
        "required route parameter is missing",
      );
    }
    const canonical = encodeWithCodec(
      segment.codec,
      properties.get(segment.name),
      `params.${diagnosticKey(segment.name)}`,
      budget,
    );
    if (canonical.length === 0) {
      throw new RoutePatternError(
        "invalid-parameter",
        `params.${diagnosticKey(segment.name)}`,
        "present route parameters cannot encode to an empty segment",
      );
    }
    if (segment.kind === "splat") {
      const values = canonical.split("/");
      if (values.some((value) => value.length === 0)) {
        throw new RoutePatternError(
          "invalid-parameter",
          `params.${diagnosticKey(segment.name)}`,
          "splat parameters cannot contain empty path segments",
        );
      }
      if (values.some((value) => value === "." || value === "..")) {
        throw new RoutePatternError(
          "invalid-parameter",
          `params.${diagnosticKey(segment.name)}`,
          "splat parameters cannot contain dot path segments",
        );
      }
      for (const value of values) output.push(encodePathSegment(value, `params.${diagnosticKey(segment.name)}`));
    } else {
      if (canonical === "." || canonical === "..") {
        throw new RoutePatternError(
          "invalid-parameter",
          `params.${diagnosticKey(segment.name)}`,
          "route parameters cannot encode to dot path segments",
        );
      }
      output.push(encodePathSegment(canonical, `params.${diagnosticKey(segment.name)}`));
    }
  }
  const pathname = `/${output.join("/")}`;
  if (pathname.length > ROUTE_PATTERN_LIMITS.maxPathLength) {
    throw new RoutePatternError("limit-exceeded", "pathname", "built pathname exceeds its length limit");
  }
  const roundTrip = matchCompiledPattern(
    runtime,
    parsePathname(pathname),
    { invocations: budget.invocations, stringUnits: 0 },
  );
  if (!roundTrip || !routeParameterPropertiesEqual(properties, roundTrip.params)) {
    throw new RoutePatternError(
      "invalid-parameter",
      "params",
      "parameter combination does not round-trip through this pattern",
    );
  }
  return pathname;
}

function routeParameterPropertiesEqual(
  properties: ReadonlyMap<string, unknown>,
  matched: Readonly<Record<string, RouteParameterValue>>,
): boolean {
  const names = Object.keys(matched);
  if (names.length !== properties.size) return false;
  for (const [name, value] of properties) {
    if (!Object.hasOwn(matched, name) || !Object.is(matched[name], value)) return false;
  }
  return true;
}

function decodeWithCodec(
  codec: CodecRuntime,
  raw: string,
  path: string,
  budget: CodecBudget,
): { readonly value: RouteParameterValue; readonly canonical: string } {
  const value = invokeCodec(() => codec.decode(raw), path, budget);
  assertParameterValue(value, path);
  const canonical = invokeCodec(() => codec.encode(value), path, budget);
  assertCodecString(canonical, path);
  consumeCodecStringBudget(canonical, path, budget);
  const roundTrip = invokeCodec(() => codec.decode(canonical), path, budget);
  assertParameterValue(roundTrip, path);
  if (!Object.is(roundTrip, value)) {
    throw new RoutePatternError("codec-failure", path, "codec decode/encode round trip changed the typed value");
  }
  const stable = invokeCodec(() => codec.encode(roundTrip), path, budget);
  assertCodecString(stable, path);
  if (stable !== canonical) {
    throw new RoutePatternError("codec-failure", path, "codec output is not deterministic");
  }
  return Object.freeze({ value, canonical });
}

function encodeWithCodec(
  codec: CodecRuntime,
  value: unknown,
  path: string,
  budget: CodecBudget,
): string {
  assertParameterValue(value, path);
  const canonical = invokeCodec(() => codec.encode(value), path, budget);
  assertCodecString(canonical, path);
  consumeCodecStringBudget(canonical, path, budget);
  const roundTrip = invokeCodec(() => codec.decode(canonical), path, budget);
  assertParameterValue(roundTrip, path);
  if (!Object.is(roundTrip, value)) {
    throw new RoutePatternError("codec-failure", path, "codec encode/decode round trip changed the typed value");
  }
  const stable = invokeCodec(() => codec.encode(roundTrip), path, budget);
  assertCodecString(stable, path);
  if (stable !== canonical) {
    throw new RoutePatternError("codec-failure", path, "codec output is not deterministic");
  }
  return canonical;
}

function invokeCodec<TValue>(
  invoke: () => TValue,
  path: string,
  budget: CodecBudget,
): TValue {
  budget.invocations += 1;
  if (budget.invocations > ROUTE_PATTERN_LIMITS.maxCodecInvocations) {
    throw new RoutePatternError("limit-exceeded", path, "codec invocation limit exceeded");
  }
  try {
    return invoke();
  } catch {
    throw new RoutePatternError("codec-failure", path, "route parameter codec rejected the value");
  }
}

function consumeCodecStringBudget(value: string, path: string, budget: CodecBudget): void {
  budget.stringUnits += value.length;
  if (budget.stringUnits > ROUTE_PATTERN_LIMITS.maxDecodedLength) {
    throw new RoutePatternError("limit-exceeded", path, "aggregate codec string limit exceeded");
  }
}

function assertParameterValue(value: unknown, path: string): asserts value is RouteParameterValue {
  if (typeof value === "string") {
    assertBoundedString(value, path, ROUTE_PATTERN_LIMITS.maxSegmentLength, "codec-failure");
    return;
  }
  if (typeof value === "number" && Number.isFinite(value)) return;
  if (typeof value === "boolean") return;
  throw new RoutePatternError("codec-failure", path, "codec values must be finite primitive route values");
}

function assertCodecString(value: unknown, path: string): asserts value is string {
  if (typeof value !== "string") {
    throw new RoutePatternError("codec-failure", path, "codec encode must return a string");
  }
  assertBoundedString(value, path, ROUTE_PATTERN_LIMITS.maxSegmentLength, "codec-failure");
}

function encodePathSegment(value: string, path: string): string {
  try {
    return encodeURIComponent(value);
  } catch {
    throw new RoutePatternError("invalid-encoding", path, "value cannot be percent encoded");
  }
}

function structurallyMatches(
  pattern: readonly InternalRouteSegment[],
  pathname: readonly string[],
  patternIndex: number,
  pathIndex: number,
  memo: Map<string, boolean>,
): boolean {
  const key = `${patternIndex}:${pathIndex}`;
  const memoized = memo.get(key);
  if (memoized !== undefined) return memoized;
  let matches: boolean;
  if (patternIndex >= pattern.length) {
    matches = pathIndex === pathname.length;
  } else {
    const segment = pattern[patternIndex]!;
    if (segment.kind === "static") {
      matches = pathname[pathIndex] === segment.value &&
        structurallyMatches(pattern, pathname, patternIndex + 1, pathIndex + 1, memo);
    } else if (segment.kind === "splat") {
      matches = pathIndex < pathname.length;
    } else if (segment.kind === "parameter") {
      matches = pathIndex < pathname.length &&
        structurallyMatches(pattern, pathname, patternIndex + 1, pathIndex + 1, memo);
    } else {
      matches = (pathIndex < pathname.length &&
        structurallyMatches(pattern, pathname, patternIndex + 1, pathIndex + 1, memo)) ||
        structurallyMatches(pattern, pathname, patternIndex + 1, pathIndex, memo);
    }
  }
  memo.set(key, matches);
  return matches;
}

function matchPatternFrom(
  pattern: readonly InternalRouteSegment[],
  pathname: readonly string[],
  encodedSeparators: readonly boolean[],
  patternIndex: number,
  pathIndex: number,
  budget: CodecBudget,
  stateBudget: { states: number },
  structuralMemo: Map<string, boolean>,
): PartialPatternMatch | undefined {
  stateBudget.states += 1;
  if (stateBudget.states > ROUTE_PATTERN_LIMITS.maxMatchStates) {
    throw new RoutePatternError("limit-exceeded", "pathname", "optional match-state limit exceeded");
  }
  if (patternIndex >= pattern.length) {
    return pathIndex === pathname.length
      ? { params: new Map(), pathParams: new Map(), rank: [], absentOptionalCount: 0 }
      : undefined;
  }

  const segment = pattern[patternIndex]!;
  if (segment.kind === "static") {
    if (
      pathname[pathIndex] !== segment.value ||
      !structurallyMatches(pattern, pathname, patternIndex + 1, pathIndex + 1, structuralMemo)
    ) return undefined;
    const tail = matchPatternFrom(
      pattern,
      pathname,
      encodedSeparators,
      patternIndex + 1,
      pathIndex + 1,
      budget,
      stateBudget,
      structuralMemo,
    );
    return tail && prependRank(tail, STATIC_RANK);
  }
  if (segment.kind === "splat") {
    if (pathIndex >= pathname.length) return undefined;
    if (encodedSeparators.slice(pathIndex).some(Boolean)) return undefined;
    const decoded = decodeWithCodec(
      segment.codec,
      pathname.slice(pathIndex).join("/"),
      `pathname.${segment.name}`,
      budget,
    );
    return {
      params: new Map([[segment.name, decoded.value]]),
      pathParams: new Map([[segment.name, decoded.canonical]]),
      rank: new Array(pathname.length - pathIndex).fill(SPLAT_RANK),
      absentOptionalCount: 0,
    };
  }

  if (segment.kind === "optional") {
    let codecError: RoutePatternError | undefined;
    if (
      pathIndex < pathname.length &&
      structurallyMatches(pattern, pathname, patternIndex + 1, pathIndex + 1, structuralMemo)
    ) {
      try {
        const decoded = decodeWithCodec(segment.codec, pathname[pathIndex]!, `pathname.${segment.name}`, budget);
        const tail = matchPatternFrom(
          pattern,
          pathname,
          encodedSeparators,
          patternIndex + 1,
          pathIndex + 1,
          budget,
          stateBudget,
          structuralMemo,
        );
        if (tail) return prependParameter(tail, segment.name, decoded, OPTIONAL_RANK);
      } catch (error) {
        if (!(error instanceof RoutePatternError) || error.code !== "codec-failure") throw error;
        codecError = error;
      }
    }
    if (structurallyMatches(pattern, pathname, patternIndex + 1, pathIndex, structuralMemo)) {
      try {
        const tail = matchPatternFrom(
          pattern,
          pathname,
          encodedSeparators,
          patternIndex + 1,
          pathIndex,
          budget,
          stateBudget,
          structuralMemo,
        );
        if (tail) return { ...tail, absentOptionalCount: tail.absentOptionalCount + 1 };
      } catch (error) {
        if (!(error instanceof RoutePatternError) || error.code !== "codec-failure" || !codecError) throw error;
      }
    }
    if (codecError) throw codecError;
    return undefined;
  }

  if (
    pathIndex >= pathname.length ||
    !structurallyMatches(pattern, pathname, patternIndex + 1, pathIndex + 1, structuralMemo)
  ) return undefined;
  const decoded = decodeWithCodec(segment.codec, pathname[pathIndex]!, `pathname.${segment.name}`, budget);
  const tail = matchPatternFrom(
    pattern,
    pathname,
    encodedSeparators,
    patternIndex + 1,
    pathIndex + 1,
    budget,
    stateBudget,
    structuralMemo,
  );
  return tail && prependParameter(tail, segment.name, decoded, PARAMETER_RANK);
}

function prependRank(match: PartialPatternMatch, rank: number): PartialPatternMatch {
  return { ...match, rank: [rank, ...match.rank] };
}

function prependParameter(
  match: PartialPatternMatch,
  name: string,
  decoded: { readonly value: RouteParameterValue; readonly canonical: string },
  rank: number,
): PartialPatternMatch {
  return {
    ...match,
    params: new Map([[name, decoded.value], ...match.params]),
    pathParams: new Map([[name, decoded.canonical], ...match.pathParams]),
    rank: [rank, ...match.rank],
  };
}

function compareRanks(left: readonly number[], right: readonly number[]): number {
  const length = Math.max(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    const leftValue = left[index] ?? Number.NEGATIVE_INFINITY;
    const rightValue = right[index] ?? Number.NEGATIVE_INFINITY;
    if (leftValue !== rightValue) return leftValue > rightValue ? 1 : -1;
  }
  return 0;
}

function rankForKind(kind: RoutePatternSegmentKind): number {
  switch (kind) {
    case "static":
      return STATIC_RANK;
    case "parameter":
      return PARAMETER_RANK;
    case "optional":
      return OPTIONAL_RANK;
    case "splat":
      return SPLAT_RANK;
  }
}

function compiledPatternRuntime(pattern: unknown, path: string): CompiledPatternRuntime {
  if ((typeof pattern !== "object" && typeof pattern !== "function") || pattern === null) {
    throw new RoutePatternError("invalid-pattern", path, "expected a compiled route pattern");
  }
  const runtime = COMPILED_PATTERN_RUNTIMES.get(pattern);
  if (!runtime) {
    throw new RoutePatternError(
      "invalid-pattern",
      path,
      "pattern must come from compileRoutePattern and cannot be proxy-wrapped",
    );
  }
  return runtime;
}

function codecRuntime(codec: RouteParameterCodec): CodecRuntime {
  return CODEC_RUNTIMES.get(codec as object)!;
}

function ownDataProperties(
  value: unknown,
  path: string,
  allowedKeys?: readonly string[],
  maxKeys = ROUTE_PATTERN_LIMITS.maxParameters,
): Map<string, unknown> {
  if (typeof value !== "object" || value === null) {
    throw new RoutePatternError("invalid-parameter", path, "expected a plain data object");
  }
  let prototype: object | null;
  let keys: PropertyKey[];
  try {
    prototype = Reflect.getPrototypeOf(value);
    keys = Reflect.ownKeys(value);
  } catch {
    throw new RoutePatternError("invalid-parameter", path, "object could not be inspected safely");
  }
  if (prototype !== Object.prototype && prototype !== null) {
    throw new RoutePatternError("invalid-parameter", path, "expected an object with a plain or null prototype");
  }
  if (keys.length > maxKeys) {
    throw new RoutePatternError("limit-exceeded", path, "property count limit exceeded");
  }
  const allowed = allowedKeys ? new Set(allowedKeys) : undefined;
  const output = new Map<string, unknown>();
  for (const key of keys) {
    if (typeof key !== "string") {
      throw new RoutePatternError("invalid-parameter", path, "symbol properties are not supported");
    }
    if (allowed && !allowed.has(key)) {
      throw new RoutePatternError("invalid-parameter", `${path}.${diagnosticKey(key)}`, "unknown option property");
    }
    let descriptor: PropertyDescriptor | undefined;
    try {
      descriptor = Reflect.getOwnPropertyDescriptor(value, key);
    } catch {
      throw new RoutePatternError("invalid-parameter", `${path}.${diagnosticKey(key)}`, "property is not inspectable");
    }
    if (!descriptor || !("value" in descriptor)) {
      throw new RoutePatternError("invalid-parameter", `${path}.${diagnosticKey(key)}`, "accessors are not allowed");
    }
    output.set(key, descriptor.value);
  }
  return output;
}

function frozenRecord(values: ReadonlyMap<string, RouteParameterValue>): Readonly<Record<string, RouteParameterValue>> {
  const output: Record<string, RouteParameterValue> = {};
  for (const [key, value] of values) {
    Object.defineProperty(output, key, {
      value,
      enumerable: true,
      writable: false,
      configurable: false,
    });
  }
  return Object.freeze(output);
}

function frozenStringRecord(values: ReadonlyMap<string, string>): Readonly<Record<string, string>> {
  return frozenRecord(values) as Readonly<Record<string, string>>;
}

function assertRouteId(value: unknown, path: string): asserts value is string {
  assertBoundedString(value, path, ROUTE_PATTERN_LIMITS.maxRouteIdLength, "invalid-parameter");
}

function assertParameterName(name: string, path: string): void {
  if (
    name.length === 0 || name.length > ROUTE_PATTERN_LIMITS.maxParameterNameLength || !PARAMETER_NAME_PATTERN.test(name)
  ) {
    throw new RoutePatternError(
      "invalid-pattern",
      path,
      "parameter names must be bounded ASCII identifiers",
    );
  }
  if (UNSAFE_PARAMETER_NAMES.has(name)) {
    throw new RoutePatternError("invalid-pattern", path, "unsafe parameter names are not allowed");
  }
}

function assertBoundedString(
  value: unknown,
  path: string,
  maxLength: number,
  code: RoutePatternErrorCode,
): asserts value is string {
  if (typeof value !== "string") {
    throw new RoutePatternError(code, path, "expected a string");
  }
  if (value.length > maxLength) {
    throw new RoutePatternError("limit-exceeded", path, "string length limit exceeded");
  }
  for (let index = 0; index < value.length; index += 1) {
    const codeUnit = value.charCodeAt(index);
    if (codeUnit >= 0xd800 && codeUnit <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (index + 1 >= value.length || next < 0xdc00 || next > 0xdfff) {
        throw new RoutePatternError(code, path, "string contains an unpaired surrogate");
      }
      index += 1;
    } else if (codeUnit >= 0xdc00 && codeUnit <= 0xdfff) {
      throw new RoutePatternError(code, path, "string contains an unpaired surrogate");
    }
  }
}

function freezeInspection(inspection: RoutePatternInspection): RoutePatternInspection {
  return Object.freeze({
    source: inspection.source,
    parameterNames: Object.freeze(inspection.parameterNames.slice()),
    segmentKinds: Object.freeze(inspection.segmentKinds.slice()),
    rank: Object.freeze(inspection.rank.slice()),
  });
}

function cloneInspection(inspection: RoutePatternInspection): RoutePatternInspection {
  return freezeInspection(inspection);
}

function cloneAmbiguityCandidates(
  candidates: readonly RoutePatternAmbiguityCandidate[],
): readonly RoutePatternAmbiguityCandidate[] {
  const length = Math.min(candidates.length, ROUTE_PATTERN_LIMITS.maxAmbiguityCandidates);
  const output = new Array<RoutePatternAmbiguityCandidate>(length);
  for (let index = 0; index < length; index += 1) {
    const candidate = candidates[index]!;
    output[index] = Object.freeze({
      routeId: boundedDiagnostic(candidate.routeId),
      pattern: boundedDiagnostic(candidate.pattern),
    });
  }
  return Object.freeze(output);
}

function boundedDiagnostic(value: string): string {
  if (value.length <= ROUTE_PATTERN_LIMITS.maxDiagnosticLength) return value;
  return `${value.slice(0, ROUTE_PATTERN_LIMITS.maxDiagnosticLength - 3)}...`;
}

function diagnosticKey(value: string): string {
  const diagnosticValue = value.length > ROUTE_PATTERN_LIMITS.maxDiagnosticLength
    ? `${value.slice(0, ROUTE_PATTERN_LIMITS.maxDiagnosticLength - 3)}...`
    : value;
  return boundedDiagnostic(JSON.stringify(diagnosticValue));
}
