// Copyright 2023 Im-Beast. MIT license.

/** Current remote capability-handshake wire schema. */
export const REMOTE_HANDSHAKE_SCHEMA_VERSION = 1 as const;

/** Protocol version implemented by this release. */
export const REMOTE_PROTOCOL_VERSION: RemoteProtocolVersion = Object.freeze({ major: 1, minor: 0 });

/** A compatibility-breaking major and additive minor protocol version. */
export interface RemoteProtocolVersion {
  readonly major: number;
  readonly minor: number;
}

/** Local requirements and supported optional capabilities. */
export interface RemoteCapabilityManifest {
  readonly protocol: RemoteProtocolVersion;
  readonly mandatory: readonly string[];
  readonly optional: readonly string[];
}

/** Limits applied before and during handshake parsing. */
export interface RemoteHandshakeLimits {
  readonly maxMessageBytes?: number;
  readonly maxCapabilities?: number;
  readonly maxCapabilityLength?: number;
  readonly maxRejectionMessageLength?: number;
}

/** Fully resolved immutable handshake limits. */
export interface ResolvedRemoteHandshakeLimits {
  readonly maxMessageBytes: number;
  readonly maxCapabilities: number;
  readonly maxCapabilityLength: number;
  readonly maxRejectionMessageLength: number;
}

/** Initiating peer hello. */
export interface RemoteHandshakeHello {
  readonly type: "remote.handshake.hello";
  readonly schemaVersion: typeof REMOTE_HANDSHAKE_SCHEMA_VERSION;
  readonly protocol: RemoteProtocolVersion;
  readonly capabilities: {
    readonly mandatory: readonly string[];
    readonly optional: readonly string[];
  };
}

/** Accepting peer acknowledgement with the deterministic intersection. */
export interface RemoteHandshakeAck {
  readonly type: "remote.handshake.ack";
  readonly schemaVersion: typeof REMOTE_HANDSHAKE_SCHEMA_VERSION;
  readonly protocol: RemoteProtocolVersion;
  readonly capabilities: readonly string[];
}

/** Stable machine-readable handshake rejection codes. */
export type RemoteHandshakeRejectionCode =
  | "incompatible-major"
  | "missing-mandatory-capability"
  | "invalid-negotiation"
  | "malformed-handshake"
  | "unexpected-handshake"
  | "duplicate-handshake"
  | "traffic-before-ready"
  | "unsupported-capability"
  | "peer-rejected"
  | "send-failed"
  | "transport-error";

/** Clone-safe rejection payload safe to inspect or serialize. */
export interface RemoteHandshakeRejection {
  readonly code: RemoteHandshakeRejectionCode;
  readonly message: string;
  readonly capabilities?: readonly string[];
  readonly localProtocol?: RemoteProtocolVersion;
  readonly peerProtocol?: RemoteProtocolVersion;
}

/** Wire rejection sent before transport closure when possible. */
export interface RemoteHandshakeReject {
  readonly type: "remote.handshake.reject";
  readonly schemaVersion: typeof REMOTE_HANDSHAKE_SCHEMA_VERSION;
  readonly rejection: RemoteHandshakeRejection;
}

/** Any strict handshake wire message. */
export type RemoteHandshakeMessage = RemoteHandshakeHello | RemoteHandshakeAck | RemoteHandshakeReject;

/** Handshake endpoint role. */
export type RemoteHandshakeRole = "initiator" | "acceptor";

/** Observable handshake lifecycle. */
export type RemoteHandshakeState = "idle" | "awaiting-hello" | "hello-sent" | "ready" | "rejected" | "disposed";

/** Successful deterministic negotiated protocol and capabilities. */
export interface RemoteHandshakeNegotiated {
  readonly protocol: RemoteProtocolVersion;
  readonly capabilities: readonly string[];
}

/** Result from consuming one handshake message. */
export interface RemoteHandshakeTransition {
  readonly state: RemoteHandshakeState;
  readonly response?: RemoteHandshakeAck | RemoteHandshakeReject;
  readonly negotiated?: RemoteHandshakeNegotiated;
  readonly rejection?: RemoteHandshakeRejection;
}

/** Immutable callback-free state snapshot. */
export interface RemoteCapabilityHandshakeInspection {
  readonly role: RemoteHandshakeRole;
  readonly state: RemoteHandshakeState;
  readonly manifest: RemoteCapabilityManifest;
  readonly negotiated?: RemoteHandshakeNegotiated;
  readonly rejection?: RemoteHandshakeRejection;
  readonly limits: ResolvedRemoteHandshakeLimits;
}

/** Strict handshake controller options. */
export interface RemoteCapabilityHandshakeOptions {
  readonly role: RemoteHandshakeRole;
  readonly manifest: RemoteCapabilityManifest;
  readonly limits?: RemoteHandshakeLimits;
}

/** Stable strict-validation failure codes. */
export type RemoteHandshakeErrorCode =
  | "invalid-shape"
  | "invalid-value"
  | "unknown-field"
  | "unsupported-version"
  | "limit-exceeded"
  | "duplicate-capability"
  | "conflicting-capability"
  | "invalid-state"
  | "disposed";

/** Typed strict handshake failure. */
export class RemoteHandshakeError extends Error {
  constructor(
    readonly code: RemoteHandshakeErrorCode,
    message: string,
    readonly path = "$",
    override readonly cause?: unknown,
  ) {
    super(`${message} at ${path}`, { cause });
    this.name = "RemoteHandshakeError";
  }
}

const DEFAULT_LIMITS: ResolvedRemoteHandshakeLimits = Object.freeze({
  maxMessageBytes: 16 * 1024,
  maxCapabilities: 64,
  maxCapabilityLength: 64,
  maxRejectionMessageLength: 256,
});
const MAX_LIMITS: ResolvedRemoteHandshakeLimits = Object.freeze({
  maxMessageBytes: 1024 * 1024,
  maxCapabilities: 1024,
  maxCapabilityLength: 256,
  maxRejectionMessageLength: 1024,
});
const TYPED_ARRAY_PROTOTYPE: object = Object.getPrototypeOf(Uint8Array.prototype);
const TYPED_ARRAY_TAG_GETTER: ((this: ArrayBufferView) => string | undefined) | undefined = Object
  .getOwnPropertyDescriptor(TYPED_ARRAY_PROTOTYPE, Symbol.toStringTag)?.get as
    | ((this: ArrayBufferView) => string | undefined)
    | undefined;
const TYPED_ARRAY_BYTE_LENGTH_GETTER: ((this: ArrayBufferView) => number) | undefined = Object.getOwnPropertyDescriptor(
  TYPED_ARRAY_PROTOTYPE,
  "byteLength",
)?.get as
  | ((this: ArrayBufferView) => number)
  | undefined;
const MESSAGE_TYPES = [
  "remote.handshake.hello",
  "remote.handshake.ack",
  "remote.handshake.reject",
] as const;
const REJECTION_CODES: readonly RemoteHandshakeRejectionCode[] = [
  "incompatible-major",
  "missing-mandatory-capability",
  "invalid-negotiation",
  "malformed-handshake",
  "unexpected-handshake",
  "duplicate-handshake",
  "traffic-before-ready",
  "unsupported-capability",
  "peer-rejected",
  "send-failed",
  "transport-error",
];
const CAPABILITY_PATTERN = /^[a-z0-9](?:[a-z0-9._:-]*[a-z0-9])?$/;

/**
 * Renderer-neutral asymmetric hello/ack controller. It performs no transport,
 * clock, authentication, timer, or I/O work.
 */
export class RemoteCapabilityHandshake {
  readonly #role: RemoteHandshakeRole;
  readonly #manifest: RemoteCapabilityManifest;
  readonly #limits: ResolvedRemoteHandshakeLimits;
  #state: RemoteHandshakeState;
  #negotiated?: RemoteHandshakeNegotiated;
  #rejection?: RemoteHandshakeRejection;

  constructor(optionsValue: RemoteCapabilityHandshakeOptions) {
    const options = dataRecord(optionsValue, "$.options", "handshake options");
    exactFields(options, ["role", "manifest"], ["limits"], "$.options", "handshake options");
    this.#role = enumValue(options.role, ["initiator", "acceptor"] as const, "role", "$.options.role");
    this.#limits = resolveRemoteHandshakeLimits(options.limits as RemoteHandshakeLimits | undefined);
    this.#manifest = normalizeRemoteCapabilityManifest(options.manifest, this.#limits);
    this.#state = this.#role === "initiator" ? "idle" : "awaiting-hello";
  }

  /** Creates the single initiator hello and enters `hello-sent`. */
  start(): RemoteHandshakeHello {
    this.#ensureActive("start");
    if (this.#role !== "initiator" || this.#state !== "idle") {
      throw new RemoteHandshakeError("invalid-state", "handshake hello can only be started once by an initiator");
    }
    this.#state = "hello-sent";
    return Object.freeze({
      type: "remote.handshake.hello",
      schemaVersion: REMOTE_HANDSHAKE_SCHEMA_VERSION,
      protocol: cloneProtocol(this.#manifest.protocol),
      capabilities: Object.freeze({
        mandatory: Object.freeze([...this.#manifest.mandatory]),
        optional: Object.freeze([...this.#manifest.optional]),
      }),
    });
  }

  /** Consumes exactly one expected peer message, rejecting duplicates fail-closed. */
  receive(messageValue: unknown): RemoteHandshakeTransition {
    this.#ensureActive("receive");
    const message = normalizeRemoteHandshakeMessage(messageValue, this.#limits);
    if (this.#state === "ready" || this.#state === "rejected") {
      return this.#rejectLocal(
        "duplicate-handshake",
        `received ${message.type} after handshake ${this.#state}`,
      );
    }
    if (message.type === "remote.handshake.reject") {
      this.#state = "rejected";
      this.#rejection = cloneRejection(message.rejection);
      return transition(this.#state, undefined, undefined, this.#rejection);
    }
    if (this.#role === "acceptor") {
      if (this.#state !== "awaiting-hello" || message.type !== "remote.handshake.hello") {
        return this.#rejectLocal("unexpected-handshake", `acceptor expected hello, received ${message.type}`);
      }
      return this.#acceptHello(message);
    }
    if (this.#state !== "hello-sent" || message.type !== "remote.handshake.ack") {
      return this.#rejectLocal("unexpected-handshake", `initiator expected ack, received ${message.type}`);
    }
    return this.#acceptAck(message);
  }

  /** Explicitly transitions to a local machine-readable rejection. */
  reject(rejectionValue: RemoteHandshakeRejection): RemoteHandshakeReject {
    this.#ensureActive("reject");
    const rejection = normalizeRejection(rejectionValue, this.#limits, "$.rejection");
    this.#state = "rejected";
    this.#rejection = rejection;
    return rejectionMessage(rejection);
  }

  /** Returns whether application traffic may flow. */
  get ready(): boolean {
    return this.#state === "ready";
  }

  /** Returns a bounded deeply immutable state snapshot. */
  inspect(): RemoteCapabilityHandshakeInspection {
    return Object.freeze({
      role: this.#role,
      state: this.#state,
      manifest: cloneManifest(this.#manifest),
      ...(this.#negotiated === undefined ? {} : { negotiated: cloneNegotiated(this.#negotiated) }),
      ...(this.#rejection === undefined ? {} : { rejection: cloneRejection(this.#rejection) }),
      limits: Object.freeze({ ...this.#limits }),
    });
  }

  /** Idempotently makes the controller terminal without owning peer resources. */
  dispose(): void {
    if (this.#state === "disposed") return;
    this.#state = "disposed";
  }

  #acceptHello(hello: RemoteHandshakeHello): RemoteHandshakeTransition {
    if (hello.protocol.major !== this.#manifest.protocol.major) {
      return this.#rejectLocal(
        "incompatible-major",
        `protocol major ${hello.protocol.major} is incompatible with ${this.#manifest.protocol.major}`,
        undefined,
        hello.protocol,
      );
    }
    const localSupported = new Set([...this.#manifest.mandatory, ...this.#manifest.optional]);
    const peerSupported = new Set([...hello.capabilities.mandatory, ...hello.capabilities.optional]);
    const missing = [
      ...this.#manifest.mandatory.filter((capability) => !peerSupported.has(capability)),
      ...hello.capabilities.mandatory.filter((capability) => !localSupported.has(capability)),
    ].sort(compareText);
    const uniqueMissing = missing.filter((value, index) => index === 0 || missing[index - 1] !== value);
    if (uniqueMissing.length > 0) {
      return this.#rejectLocal(
        "missing-mandatory-capability",
        "one or more mandatory capabilities are unavailable",
        uniqueMissing.slice(0, this.#limits.maxCapabilities),
        hello.protocol,
      );
    }
    const capabilities = [...localSupported].filter((capability) => peerSupported.has(capability)).sort(compareText);
    const protocol = Object.freeze({
      major: this.#manifest.protocol.major,
      minor: Math.min(this.#manifest.protocol.minor, hello.protocol.minor),
    });
    this.#negotiated = Object.freeze({ protocol, capabilities: Object.freeze(capabilities) });
    this.#state = "ready";
    const response: RemoteHandshakeAck = Object.freeze({
      type: "remote.handshake.ack",
      schemaVersion: REMOTE_HANDSHAKE_SCHEMA_VERSION,
      protocol: cloneProtocol(protocol),
      capabilities: Object.freeze([...capabilities]),
    });
    return transition(this.#state, response, this.#negotiated);
  }

  #acceptAck(ack: RemoteHandshakeAck): RemoteHandshakeTransition {
    if (ack.protocol.major !== this.#manifest.protocol.major) {
      return this.#rejectLocal(
        "incompatible-major",
        `protocol major ${ack.protocol.major} is incompatible with ${this.#manifest.protocol.major}`,
        undefined,
        ack.protocol,
      );
    }
    if (ack.protocol.minor > this.#manifest.protocol.minor) {
      return this.#rejectLocal("invalid-negotiation", "negotiated minor exceeds the initiator minor");
    }
    const supported = new Set([...this.#manifest.mandatory, ...this.#manifest.optional]);
    const selected = new Set(ack.capabilities);
    const missing = this.#manifest.mandatory.filter((capability) => !selected.has(capability));
    const unsupported = ack.capabilities.filter((capability) => !supported.has(capability));
    if (missing.length > 0) {
      return this.#rejectLocal(
        "missing-mandatory-capability",
        "ack omitted mandatory initiator capabilities",
        missing,
        ack.protocol,
      );
    }
    if (unsupported.length > 0) {
      return this.#rejectLocal(
        "invalid-negotiation",
        "ack selected unsupported capabilities",
        unsupported,
        ack.protocol,
      );
    }
    this.#negotiated = Object.freeze({
      protocol: cloneProtocol(ack.protocol),
      capabilities: Object.freeze([...ack.capabilities]),
    });
    this.#state = "ready";
    return transition(this.#state, undefined, this.#negotiated);
  }

  #rejectLocal(
    code: RemoteHandshakeRejectionCode,
    message: string,
    capabilities?: readonly string[],
    peerProtocol?: RemoteProtocolVersion,
  ): RemoteHandshakeTransition {
    const rejection = normalizeRejection(
      {
        code,
        message,
        ...(capabilities === undefined ? {} : { capabilities }),
        localProtocol: this.#manifest.protocol,
        ...(peerProtocol === undefined ? {} : { peerProtocol }),
      },
      this.#limits,
      "$.rejection",
    );
    this.#state = "rejected";
    this.#rejection = rejection;
    return transition(this.#state, rejectionMessage(rejection), undefined, rejection);
  }

  #ensureActive(operation: string): void {
    if (this.#state === "disposed") {
      throw new RemoteHandshakeError("disposed", `cannot ${operation} a disposed handshake`);
    }
  }
}

/** Strictly normalizes a local capability manifest. */
export function normalizeRemoteCapabilityManifest(
  value: unknown,
  limitsValue?: RemoteHandshakeLimits | ResolvedRemoteHandshakeLimits,
): RemoteCapabilityManifest {
  const limits = resolveRemoteHandshakeLimits(limitsValue);
  const record = dataRecord(value, "$.manifest", "capability manifest");
  exactFields(record, ["protocol", "mandatory", "optional"], [], "$.manifest", "capability manifest");
  const mandatory = normalizeCapabilityList(record.mandatory, limits, "$.manifest.mandatory");
  const optional = normalizeCapabilityList(record.optional, limits, "$.manifest.optional");
  const mandatorySet = new Set(mandatory);
  const conflict = optional.find((capability) => mandatorySet.has(capability));
  if (conflict !== undefined) {
    throw new RemoteHandshakeError(
      "conflicting-capability",
      `capability ${conflict} cannot be both mandatory and optional`,
      "$.manifest.optional",
    );
  }
  if (mandatory.length + optional.length > limits.maxCapabilities) {
    throw new RemoteHandshakeError(
      "limit-exceeded",
      `capabilities exceed ${limits.maxCapabilities}`,
      "$.manifest",
    );
  }
  return Object.freeze({
    protocol: normalizeProtocol(record.protocol, "$.manifest.protocol"),
    mandatory,
    optional,
  });
}

/** Strictly normalizes an unknown handshake message without executing accessors. */
export function normalizeRemoteHandshakeMessage(
  value: unknown,
  limitsValue?: RemoteHandshakeLimits | ResolvedRemoteHandshakeLimits,
): RemoteHandshakeMessage {
  const limits = resolveRemoteHandshakeLimits(limitsValue);
  const record = dataRecord(value, "$", "handshake message");
  const type = enumValue(record.type, MESSAGE_TYPES, "handshake message type", "$.type");
  if (record.schemaVersion !== REMOTE_HANDSHAKE_SCHEMA_VERSION) {
    throw new RemoteHandshakeError(
      "unsupported-version",
      "unsupported handshake schema",
      "$.schemaVersion",
    );
  }
  if (type === "remote.handshake.hello") {
    exactFields(record, ["type", "schemaVersion", "protocol", "capabilities"], [], "$", "handshake hello");
    const capabilities = dataRecord(record.capabilities, "$.capabilities", "hello capabilities");
    exactFields(capabilities, ["mandatory", "optional"], [], "$.capabilities", "hello capabilities");
    const manifest = normalizeRemoteCapabilityManifest({
      protocol: record.protocol,
      mandatory: capabilities.mandatory,
      optional: capabilities.optional,
    }, limits);
    return Object.freeze({
      type,
      schemaVersion: REMOTE_HANDSHAKE_SCHEMA_VERSION,
      protocol: manifest.protocol,
      capabilities: Object.freeze({ mandatory: manifest.mandatory, optional: manifest.optional }),
    });
  }
  if (type === "remote.handshake.ack") {
    exactFields(record, ["type", "schemaVersion", "protocol", "capabilities"], [], "$", "handshake ack");
    return Object.freeze({
      type,
      schemaVersion: REMOTE_HANDSHAKE_SCHEMA_VERSION,
      protocol: normalizeProtocol(record.protocol, "$.protocol"),
      capabilities: normalizeCapabilityList(record.capabilities, limits, "$.capabilities"),
    });
  }
  exactFields(record, ["type", "schemaVersion", "rejection"], [], "$", "handshake rejection");
  return rejectionMessage(normalizeRejection(record.rejection, limits, "$.rejection"));
}

/** Encodes one normalized bounded handshake message. */
export function encodeRemoteHandshakeMessage(
  message: unknown,
  limitsValue?: RemoteHandshakeLimits | ResolvedRemoteHandshakeLimits,
): string {
  const limits = resolveRemoteHandshakeLimits(limitsValue);
  const normalized = normalizeRemoteHandshakeMessage(message, limits);
  const encoded = JSON.stringify(normalized);
  enforceByteLimit(encoded, limits.maxMessageBytes);
  return encoded;
}

/** Decodes one UTF-8/JSON handshake message after enforcing the byte bound. */
export function decodeRemoteHandshakeMessage(
  wire: string | Uint8Array,
  limitsValue?: RemoteHandshakeLimits | ResolvedRemoteHandshakeLimits,
): RemoteHandshakeMessage {
  const limits = resolveRemoteHandshakeLimits(limitsValue);
  let text: string;
  if (typeof wire === "string") {
    enforceByteLimit(wire, limits.maxMessageBytes);
    text = wire;
  } else if (isNativeUint8Array(wire)) {
    const byteLength = nativeUint8ArrayByteLength(wire);
    if (byteLength > limits.maxMessageBytes) {
      throw new RemoteHandshakeError("limit-exceeded", `handshake exceeds ${limits.maxMessageBytes} bytes`);
    }
    try {
      text = new TextDecoder("utf-8", { fatal: true }).decode(wire);
    } catch (cause) {
      throw new RemoteHandshakeError("invalid-value", "handshake is not valid UTF-8", "$", cause);
    }
  } else {
    throw new RemoteHandshakeError("invalid-shape", "handshake wire value must be string or Uint8Array");
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (cause) {
    throw new RemoteHandshakeError("invalid-value", "handshake is not valid JSON", "$", cause);
  }
  return normalizeRemoteHandshakeMessage(parsed, limits);
}

/** Returns true only for one of the three reserved handshake discriminants. */
export function isRemoteHandshakeMessageType(value: unknown): value is RemoteHandshakeMessage["type"] {
  return typeof value === "string" && MESSAGE_TYPES.includes(value as RemoteHandshakeMessage["type"]);
}

/** Resolves and freezes strict handshake limits. */
export function resolveRemoteHandshakeLimits(
  limitsValue?: RemoteHandshakeLimits | ResolvedRemoteHandshakeLimits,
): ResolvedRemoteHandshakeLimits {
  if (limitsValue === undefined) return Object.freeze({ ...DEFAULT_LIMITS });
  const limits = dataRecord(limitsValue, "$.limits", "handshake limits");
  exactFields(
    limits,
    [],
    ["maxMessageBytes", "maxCapabilities", "maxCapabilityLength", "maxRejectionMessageLength"],
    "$.limits",
    "handshake limits",
  );
  return Object.freeze({
    maxMessageBytes: integer(
      limits.maxMessageBytes,
      DEFAULT_LIMITS.maxMessageBytes,
      64,
      MAX_LIMITS.maxMessageBytes,
      "$.limits.maxMessageBytes",
    ),
    maxCapabilities: integer(
      limits.maxCapabilities,
      DEFAULT_LIMITS.maxCapabilities,
      1,
      MAX_LIMITS.maxCapabilities,
      "$.limits.maxCapabilities",
    ),
    maxCapabilityLength: integer(
      limits.maxCapabilityLength,
      DEFAULT_LIMITS.maxCapabilityLength,
      1,
      MAX_LIMITS.maxCapabilityLength,
      "$.limits.maxCapabilityLength",
    ),
    maxRejectionMessageLength: integer(
      limits.maxRejectionMessageLength,
      DEFAULT_LIMITS.maxRejectionMessageLength,
      1,
      MAX_LIMITS.maxRejectionMessageLength,
      "$.limits.maxRejectionMessageLength",
    ),
  });
}

/** Creates a strict machine-readable rejection wire message. */
export function createRemoteHandshakeRejection(
  rejection: RemoteHandshakeRejection,
  limitsValue?: RemoteHandshakeLimits | ResolvedRemoteHandshakeLimits,
): RemoteHandshakeReject {
  return rejectionMessage(normalizeRejection(rejection, resolveRemoteHandshakeLimits(limitsValue), "$.rejection"));
}

function normalizeRejection(
  value: unknown,
  limits: ResolvedRemoteHandshakeLimits,
  path: string,
): RemoteHandshakeRejection {
  const record = dataRecord(value, path, "handshake rejection");
  exactFields(
    record,
    ["code", "message"],
    ["capabilities", "localProtocol", "peerProtocol"],
    path,
    "handshake rejection",
  );
  const code = enumValue(record.code, REJECTION_CODES, "rejection code", `${path}.code`);
  const message = boundedText(record.message, limits.maxRejectionMessageLength, `${path}.message`, "rejection message");
  const capabilities = record.capabilities === undefined
    ? undefined
    : normalizeCapabilityList(record.capabilities, limits, `${path}.capabilities`);
  return Object.freeze({
    code,
    message,
    ...(capabilities === undefined ? {} : { capabilities }),
    ...(record.localProtocol === undefined
      ? {}
      : { localProtocol: normalizeProtocol(record.localProtocol, `${path}.localProtocol`) }),
    ...(record.peerProtocol === undefined
      ? {}
      : { peerProtocol: normalizeProtocol(record.peerProtocol, `${path}.peerProtocol`) }),
  });
}

function rejectionMessage(rejection: RemoteHandshakeRejection): RemoteHandshakeReject {
  return Object.freeze({
    type: "remote.handshake.reject",
    schemaVersion: REMOTE_HANDSHAKE_SCHEMA_VERSION,
    rejection: cloneRejection(rejection),
  });
}

function transition(
  state: RemoteHandshakeState,
  response?: RemoteHandshakeAck | RemoteHandshakeReject,
  negotiated?: RemoteHandshakeNegotiated,
  rejection?: RemoteHandshakeRejection,
): RemoteHandshakeTransition {
  return Object.freeze({
    state,
    ...(response === undefined ? {} : { response }),
    ...(negotiated === undefined ? {} : { negotiated: cloneNegotiated(negotiated) }),
    ...(rejection === undefined ? {} : { rejection: cloneRejection(rejection) }),
  });
}

function normalizeProtocol(value: unknown, path: string): RemoteProtocolVersion {
  const record = dataRecord(value, path, "protocol version");
  exactFields(record, ["major", "minor"], [], path, "protocol version");
  return Object.freeze({
    major: nonNegativeInteger(record.major, `${path}.major`),
    minor: nonNegativeInteger(record.minor, `${path}.minor`),
  });
}

function normalizeCapabilityList(
  value: unknown,
  limits: ResolvedRemoteHandshakeLimits,
  path: string,
): readonly string[] {
  let isArray: boolean;
  let prototype: object | null | undefined;
  try {
    isArray = Array.isArray(value);
    prototype = isArray ? Object.getPrototypeOf(value) : undefined;
  } catch (cause) {
    throw new RemoteHandshakeError("invalid-shape", "capability array shape is not inspectable", path, cause);
  }
  if (!isArray || prototype !== Array.prototype) {
    throw new RemoteHandshakeError("invalid-shape", "capabilities must be a plain array", path);
  }
  const arrayValue = value as unknown[];
  const lengthDescriptor = safeDescriptor(arrayValue, "length", `${path}.length`);
  if (!lengthDescriptor || !("value" in lengthDescriptor) || !Number.isSafeInteger(lengthDescriptor.value)) {
    throw new RemoteHandshakeError("invalid-shape", "capability array length is not inspectable", `${path}.length`);
  }
  const length = lengthDescriptor.value as number;
  if (length > limits.maxCapabilities) {
    throw new RemoteHandshakeError(
      "limit-exceeded",
      `capabilities exceed ${limits.maxCapabilities}`,
      path,
    );
  }
  const keys = safeOwnKeys(arrayValue, path);
  for (const key of keys) {
    if (typeof key !== "string" || (key !== "length" && !arrayIndex(key, length))) {
      throw new RemoteHandshakeError("invalid-shape", "capability arrays cannot contain extra properties", path);
    }
  }
  const normalized: string[] = [];
  const seen = new Set<string>();
  for (let index = 0; index < length; index += 1) {
    const descriptor = safeDescriptor(arrayValue, String(index), `${path}[${index}]`);
    if (!descriptor || !("value" in descriptor) || !descriptor.enumerable) {
      throw new RemoteHandshakeError(
        "invalid-shape",
        "capability arrays must be dense enumerable data properties",
        `${path}[${index}]`,
      );
    }
    const capability = boundedText(
      descriptor.value,
      limits.maxCapabilityLength,
      `${path}[${index}]`,
      "capability",
    );
    if (!CAPABILITY_PATTERN.test(capability)) {
      throw new RemoteHandshakeError("invalid-value", "capability identifier is malformed", `${path}[${index}]`);
    }
    if (seen.has(capability)) {
      throw new RemoteHandshakeError(
        "duplicate-capability",
        `duplicate capability ${capability}`,
        `${path}[${index}]`,
      );
    }
    seen.add(capability);
    normalized.push(capability);
  }
  normalized.sort(compareText);
  return Object.freeze(normalized);
}

function cloneManifest(manifest: RemoteCapabilityManifest): RemoteCapabilityManifest {
  return Object.freeze({
    protocol: cloneProtocol(manifest.protocol),
    mandatory: Object.freeze([...manifest.mandatory]),
    optional: Object.freeze([...manifest.optional]),
  });
}

function cloneNegotiated(negotiated: RemoteHandshakeNegotiated): RemoteHandshakeNegotiated {
  return Object.freeze({
    protocol: cloneProtocol(negotiated.protocol),
    capabilities: Object.freeze([...negotiated.capabilities]),
  });
}

function cloneRejection(rejection: RemoteHandshakeRejection): RemoteHandshakeRejection {
  return Object.freeze({
    code: rejection.code,
    message: rejection.message,
    ...(rejection.capabilities === undefined ? {} : { capabilities: Object.freeze([...rejection.capabilities]) }),
    ...(rejection.localProtocol === undefined ? {} : { localProtocol: cloneProtocol(rejection.localProtocol) }),
    ...(rejection.peerProtocol === undefined ? {} : { peerProtocol: cloneProtocol(rejection.peerProtocol) }),
  });
}

function cloneProtocol(protocol: RemoteProtocolVersion): RemoteProtocolVersion {
  return Object.freeze({ major: protocol.major, minor: protocol.minor });
}

function dataRecord(value: unknown, path: string, label: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null) {
    throw new RemoteHandshakeError("invalid-shape", `${label} must be a plain object`, path);
  }
  let isArray: boolean;
  try {
    isArray = Array.isArray(value);
  } catch (cause) {
    throw new RemoteHandshakeError("invalid-shape", `${label} shape is not inspectable`, path, cause);
  }
  if (isArray) throw new RemoteHandshakeError("invalid-shape", `${label} must be a plain object`, path);
  let prototype: object | null;
  try {
    prototype = Object.getPrototypeOf(value);
  } catch (cause) {
    throw new RemoteHandshakeError("invalid-shape", `${label} prototype is not inspectable`, path, cause);
  }
  if (prototype !== Object.prototype && prototype !== null) {
    throw new RemoteHandshakeError("invalid-shape", `${label} cannot be an exotic object`, path);
  }
  const normalized: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
  for (const key of safeOwnKeys(value, path)) {
    if (typeof key !== "string") {
      throw new RemoteHandshakeError("invalid-shape", `${label} cannot contain symbols`, path);
    }
    const descriptor = safeDescriptor(value, key, childPath(path, key));
    if (!descriptor || !("value" in descriptor) || !descriptor.enumerable) {
      throw new RemoteHandshakeError(
        "invalid-shape",
        `${label} properties must be enumerable data properties`,
        childPath(path, key),
      );
    }
    normalized[key] = descriptor.value;
  }
  return normalized;
}

function exactFields(
  record: Record<string, unknown>,
  required: readonly string[],
  optional: readonly string[],
  path: string,
  label: string,
): void {
  const allowed = new Set([...required, ...optional]);
  for (const key of Object.keys(record)) {
    if (!allowed.has(key)) {
      throw new RemoteHandshakeError("unknown-field", `${label} contains unknown field ${key}`, childPath(path, key));
    }
  }
  for (const key of required) {
    if (!Object.hasOwn(record, key)) {
      throw new RemoteHandshakeError("invalid-shape", `${label} is missing ${key}`, childPath(path, key));
    }
  }
}

function safeOwnKeys(value: object, path: string): (string | symbol)[] {
  try {
    return Reflect.ownKeys(value);
  } catch (cause) {
    throw new RemoteHandshakeError("invalid-shape", "object keys are not inspectable", path, cause);
  }
}

function safeDescriptor(value: object, key: string, path: string): PropertyDescriptor | undefined {
  try {
    return Object.getOwnPropertyDescriptor(value, key);
  } catch (cause) {
    throw new RemoteHandshakeError("invalid-shape", "property descriptor is not inspectable", path, cause);
  }
}

function boundedText(value: unknown, maxLength: number, path: string, label: string): string {
  if (typeof value !== "string" || value.length === 0 || value.length > maxLength || hasControl(value)) {
    throw new RemoteHandshakeError(
      "invalid-value",
      `${label} must be 1-${maxLength} printable characters`,
      path,
    );
  }
  return value;
}

function hasControl(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code <= 0x1f || code === 0x7f) return true;
  }
  return false;
}

function enumValue<const T extends string>(value: unknown, allowed: readonly T[], label: string, path: string): T {
  if (typeof value !== "string" || !allowed.includes(value as T)) {
    throw new RemoteHandshakeError("invalid-value", `${label} is not supported`, path);
  }
  return value as T;
}

function nonNegativeInteger(value: unknown, path: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0 || Object.is(value, -0)) {
    throw new RemoteHandshakeError("invalid-value", "version must be a non-negative safe integer", path);
  }
  return value;
}

function integer(value: unknown, fallback: number, minimum: number, maximum: number, path: string): number {
  if (value === undefined) return fallback;
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw new RemoteHandshakeError(
      "invalid-value",
      `limit must be a safe integer between ${minimum} and ${maximum}`,
      path,
    );
  }
  return value;
}

function enforceByteLimit(value: string, limit: number): void {
  if (value.length > limit) {
    throw new RemoteHandshakeError("limit-exceeded", `handshake exceeds ${limit} bytes`);
  }
  if (new TextEncoder().encode(value).byteLength > limit) {
    throw new RemoteHandshakeError("limit-exceeded", `handshake exceeds ${limit} bytes`);
  }
}

function isNativeUint8Array(value: unknown): value is Uint8Array {
  if (typeof value !== "object" || value === null || TYPED_ARRAY_TAG_GETTER === undefined) return false;
  try {
    return ArrayBuffer.isView(value) && Reflect.apply(TYPED_ARRAY_TAG_GETTER, value, []) === "Uint8Array";
  } catch {
    return false;
  }
}

function nativeUint8ArrayByteLength(value: Uint8Array): number {
  if (TYPED_ARRAY_BYTE_LENGTH_GETTER === undefined) {
    throw new RemoteHandshakeError("invalid-shape", "Uint8Array byte length is not inspectable");
  }
  try {
    return Reflect.apply(TYPED_ARRAY_BYTE_LENGTH_GETTER, value, []);
  } catch (cause) {
    throw new RemoteHandshakeError("invalid-shape", "Uint8Array byte length is not inspectable", "$", cause);
  }
}

function arrayIndex(key: string, length: number): boolean {
  if (!/^(?:0|[1-9][0-9]*)$/.test(key)) return false;
  const index = Number(key);
  return Number.isSafeInteger(index) && index >= 0 && index < length && String(index) === key;
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function childPath(parent: string, key: string): string {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(key) ? `${parent}.${key}` : `${parent}[${JSON.stringify(key)}]`;
}
