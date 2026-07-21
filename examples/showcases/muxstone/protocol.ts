// Copyright 2023 Im-Beast. MIT license.

/** Wire protocol version understood by the Muxstone demo host. */
export const MUXSTONE_PROTOCOL_VERSION = 1 as const;

/** WebSocket sub-path used by the local Muxstone host. */
export const MUXSTONE_WEBSOCKET_PATH = "/muxstone/v1";

/** Hard protocol quotas. Values are deliberately small enough for a local demo daemon. */
export const MUXSTONE_PROTOCOL_LIMITS = Object.freeze(
  {
    messageBytes: 128 * 1024,
    commandBytes: 1024,
    argumentCount: 128,
    argumentBytes: 4096,
    argumentsBytes: 64 * 1024,
    cwdBytes: 4096,
    environmentEntries: 128,
    environmentBytes: 64 * 1024,
    titleBytes: 256,
    inputBytes: 64 * 1024,
    outputBytes: 64 * 1024,
    sessionIdBytes: 128,
    errorBytes: 512,
    sessions: 64,
    columns: 512,
    rows: 256,
    cells: 65_536,
  } as const,
);

export type MuxstoneSessionStatus = "idle" | "running" | "exited" | "failed" | "cancelled";
export type MuxstoneRequestOperation =
  | "list"
  | "spawn"
  | "attach"
  | "detach"
  | "input"
  | "resize"
  | "kill"
  | "ping"
  | "shutdown";

export interface MuxstoneAuthRequest {
  version: typeof MUXSTONE_PROTOCOL_VERSION;
  type: "auth";
  /** Lower-case hexadecimal representation of 32 cryptographically random bytes. */
  token: string;
}

export interface MuxstoneListRequest {
  version: typeof MUXSTONE_PROTOCOL_VERSION;
  type: "list";
  requestId: number;
}

export interface MuxstoneSpawnRequest {
  version: typeof MUXSTONE_PROTOCOL_VERSION;
  type: "spawn";
  requestId: number;
  command: string;
  args?: readonly string[];
  cwd?: string;
  env?: Readonly<Record<string, string>>;
  columns?: number;
  rows?: number;
  title?: string;
}

export interface MuxstoneAttachRequest {
  version: typeof MUXSTONE_PROTOCOL_VERSION;
  type: "attach";
  requestId: number;
  sessionId: string;
  /** Last output sequence durably observed by the client. Zero requests all retained output. */
  afterSequence?: number;
}

export interface MuxstoneSessionRequest {
  version: typeof MUXSTONE_PROTOCOL_VERSION;
  type: "detach" | "kill";
  requestId: number;
  sessionId: string;
}

export interface MuxstoneInputRequest {
  version: typeof MUXSTONE_PROTOCOL_VERSION;
  type: "input";
  requestId: number;
  sessionId: string;
  /** Canonical base64 bytes, preserving terminal control sequences exactly. */
  data: string;
}

export interface MuxstoneResizeRequest {
  version: typeof MUXSTONE_PROTOCOL_VERSION;
  type: "resize";
  requestId: number;
  sessionId: string;
  columns: number;
  rows: number;
}

export interface MuxstonePingRequest {
  version: typeof MUXSTONE_PROTOCOL_VERSION;
  type: "ping";
  requestId: number;
}

export interface MuxstoneShutdownRequest {
  version: typeof MUXSTONE_PROTOCOL_VERSION;
  type: "shutdown";
  requestId: number;
}

export type MuxstoneClientRequest =
  | MuxstoneListRequest
  | MuxstoneSpawnRequest
  | MuxstoneAttachRequest
  | MuxstoneSessionRequest
  | MuxstoneInputRequest
  | MuxstoneResizeRequest
  | MuxstonePingRequest
  | MuxstoneShutdownRequest;

export type MuxstoneClientMessage = MuxstoneAuthRequest | MuxstoneClientRequest;

export interface MuxstoneSessionDescriptor {
  id: string;
  backendId: string;
  title: string;
  commandLine: string;
  status: MuxstoneSessionStatus;
  running: boolean;
  columns: number;
  rows: number;
  createdAt: number;
  updatedAt: number;
  latestSequence: number;
  attachedClients: number;
}

export interface MuxstoneReadyMessage {
  version: typeof MUXSTONE_PROTOCOL_VERSION;
  type: "ready";
  hostId: string;
}

export interface MuxstoneSessionsMessage {
  version: typeof MUXSTONE_PROTOCOL_VERSION;
  type: "sessions";
  requestId: number;
  sessions: readonly MuxstoneSessionDescriptor[];
}

export interface MuxstoneSpawnedMessage {
  version: typeof MUXSTONE_PROTOCOL_VERSION;
  type: "spawned";
  requestId: number;
  session: MuxstoneSessionDescriptor;
}

export interface MuxstoneAttachedMessage {
  version: typeof MUXSTONE_PROTOCOL_VERSION;
  type: "attached";
  requestId: number;
  session: MuxstoneSessionDescriptor;
  replayFromSequence: number;
  latestSequence: number;
  /** True when requested output predates the bounded replay ring. */
  truncated: boolean;
}

export interface MuxstoneAcknowledgedMessage {
  version: typeof MUXSTONE_PROTOCOL_VERSION;
  type: "ack";
  requestId: number;
  operation: "detach" | "input" | "resize" | "kill" | "shutdown";
  sessionId?: string;
}

export interface MuxstonePongMessage {
  version: typeof MUXSTONE_PROTOCOL_VERSION;
  type: "pong";
  requestId: number;
  timestamp: number;
}

export interface MuxstoneOutputMessage {
  version: typeof MUXSTONE_PROTOCOL_VERSION;
  type: "output";
  sessionId: string;
  sequence: number;
  data: string;
}

export interface MuxstoneSessionStateMessage {
  version: typeof MUXSTONE_PROTOCOL_VERSION;
  type: "session-state";
  session: MuxstoneSessionDescriptor;
}

export interface MuxstoneErrorMessage {
  version: typeof MUXSTONE_PROTOCOL_VERSION;
  type: "error";
  requestId?: number;
  code: string;
  message: string;
}

export type MuxstoneServerMessage =
  | MuxstoneReadyMessage
  | MuxstoneSessionsMessage
  | MuxstoneSpawnedMessage
  | MuxstoneAttachedMessage
  | MuxstoneAcknowledgedMessage
  | MuxstonePongMessage
  | MuxstoneOutputMessage
  | MuxstoneSessionStateMessage
  | MuxstoneErrorMessage;

export class MuxstoneProtocolError extends Error {
  constructor(readonly code: string, message: string) {
    super(message);
    this.name = "MuxstoneProtocolError";
  }
}

const ENCODER = new TextEncoder();
const SESSION_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]*$/;
const TOKEN_PATTERN = /^[0-9a-f]{64}$/;
const BASE64_PATTERN = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;
const STATUSES = new Set<MuxstoneSessionStatus>(["idle", "running", "exited", "failed", "cancelled"]);
const ACK_OPERATIONS = new Set<MuxstoneAcknowledgedMessage["operation"]>([
  "detach",
  "input",
  "resize",
  "kill",
  "shutdown",
]);

/** Generates a token with 256 bits of entropy. The returned string is 64 lower-case hexadecimal characters. */
export function createMuxstoneAuthToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  let token = "";
  for (const byte of bytes) token += byte.toString(16).padStart(2, "0");
  return token;
}

export function isMuxstoneAuthToken(value: unknown): value is string {
  return typeof value === "string" && TOKEN_PATTERN.test(value);
}

/** Encodes terminal bytes for the JSON protocol without interpreting them as text. */
export function encodeMuxstoneData(data: string | Uint8Array): string {
  const bytes = typeof data === "string" ? ENCODER.encode(data) : data;
  if (bytes.byteLength > MUXSTONE_PROTOCOL_LIMITS.outputBytes) {
    throw new MuxstoneProtocolError("data-too-large", "Terminal data exceeds the protocol quota.");
  }
  let binary = "";
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  }
  return btoa(binary);
}

/** Decodes canonical base64 terminal data and enforces the supplied decoded-byte quota. */
export function decodeMuxstoneData(
  data: string,
  maxBytes = MUXSTONE_PROTOCOL_LIMITS.inputBytes,
): Uint8Array {
  if (typeof data !== "string" || data.length > Math.ceil(maxBytes / 3) * 4 || !BASE64_PATTERN.test(data)) {
    throw new MuxstoneProtocolError("invalid-data", "Terminal data must be bounded canonical base64.");
  }
  let binary: string;
  try {
    binary = atob(data);
  } catch {
    throw new MuxstoneProtocolError("invalid-data", "Terminal data must be bounded canonical base64.");
  }
  if (binary.length > maxBytes || btoa(binary) !== data) {
    throw new MuxstoneProtocolError("invalid-data", "Terminal data must be bounded canonical base64.");
  }
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

/** Parses and strictly normalizes a client protocol message. */
export function decodeMuxstoneClientMessage(message: string): MuxstoneClientMessage {
  const parsed = parseBoundedMessage(message);
  return normalizeMuxstoneClientMessage(parsed);
}

/** Parses and strictly normalizes a server protocol message. */
export function decodeMuxstoneServerMessage(message: string): MuxstoneServerMessage {
  const parsed = parseBoundedMessage(message);
  return normalizeMuxstoneServerMessage(parsed);
}

export function encodeMuxstoneMessage(message: MuxstoneClientMessage | MuxstoneServerMessage): string {
  const encoded = JSON.stringify(message);
  if (byteLength(encoded) > MUXSTONE_PROTOCOL_LIMITS.messageBytes) {
    throw new MuxstoneProtocolError("message-too-large", "Muxstone message exceeds the protocol quota.");
  }
  return encoded;
}

export function normalizeMuxstoneClientMessage(value: unknown): MuxstoneClientMessage {
  const root = record(value, ["version", "type"], [
    "token",
    "requestId",
    "command",
    "args",
    "cwd",
    "env",
    "columns",
    "rows",
    "title",
    "sessionId",
    "afterSequence",
    "data",
  ]);
  protocolVersion(root.version);
  const type = stringValue(root.type, "type", 16);
  switch (type) {
    case "auth": {
      exact(root, ["version", "type", "token"]);
      const token = stringValue(root.token, "token", 64);
      if (!isMuxstoneAuthToken(token)) fail("invalid-auth", "Auth token must encode exactly 32 random bytes.");
      return { version: 1, type, token };
    }
    case "list":
    case "ping":
    case "shutdown": {
      exact(root, ["version", "type", "requestId"]);
      return { version: 1, type, requestId: requestId(root.requestId) };
    }
    case "spawn": {
      exact(root, ["version", "type", "requestId", "command"], [
        "args",
        "cwd",
        "env",
        "columns",
        "rows",
        "title",
      ]);
      const command = stringValue(root.command, "command", MUXSTONE_PROTOCOL_LIMITS.commandBytes, false);
      if (command.includes("\0")) fail("invalid-command", "Command contains a forbidden NUL byte.");
      const args = root.args === undefined ? undefined : stringArray(root.args);
      const cwd = root.cwd === undefined
        ? undefined
        : stringValue(root.cwd, "cwd", MUXSTONE_PROTOCOL_LIMITS.cwdBytes, false);
      if (cwd?.includes("\0")) fail("invalid-cwd", "Working directory contains a forbidden NUL byte.");
      const env = root.env === undefined ? undefined : environment(root.env);
      const columns = root.columns === undefined ? undefined : positiveInteger(root.columns, "columns");
      const rows = root.rows === undefined ? undefined : positiveInteger(root.rows, "rows");
      dimensions(columns ?? 80, rows ?? 24);
      const title = root.title === undefined
        ? undefined
        : stringValue(root.title, "title", MUXSTONE_PROTOCOL_LIMITS.titleBytes, false);
      return {
        version: 1,
        type,
        requestId: requestId(root.requestId),
        command,
        ...(args ? { args } : {}),
        ...(cwd !== undefined ? { cwd } : {}),
        ...(env ? { env } : {}),
        ...(columns !== undefined ? { columns } : {}),
        ...(rows !== undefined ? { rows } : {}),
        ...(title !== undefined ? { title } : {}),
      };
    }
    case "attach": {
      exact(root, ["version", "type", "requestId", "sessionId"], ["afterSequence"]);
      const afterSequence = root.afterSequence === undefined
        ? undefined
        : nonNegativeInteger(root.afterSequence, "afterSequence");
      return {
        version: 1,
        type,
        requestId: requestId(root.requestId),
        sessionId: sessionId(root.sessionId),
        ...(afterSequence !== undefined ? { afterSequence } : {}),
      };
    }
    case "detach":
    case "kill": {
      exact(root, ["version", "type", "requestId", "sessionId"]);
      return {
        version: 1,
        type,
        requestId: requestId(root.requestId),
        sessionId: sessionId(root.sessionId),
      };
    }
    case "input": {
      exact(root, ["version", "type", "requestId", "sessionId", "data"]);
      const data = stringValue(root.data, "data", Math.ceil(MUXSTONE_PROTOCOL_LIMITS.inputBytes / 3) * 4);
      decodeMuxstoneData(data);
      return {
        version: 1,
        type,
        requestId: requestId(root.requestId),
        sessionId: sessionId(root.sessionId),
        data,
      };
    }
    case "resize": {
      exact(root, ["version", "type", "requestId", "sessionId", "columns", "rows"]);
      const columns = positiveInteger(root.columns, "columns");
      const rows = positiveInteger(root.rows, "rows");
      dimensions(columns, rows);
      return {
        version: 1,
        type,
        requestId: requestId(root.requestId),
        sessionId: sessionId(root.sessionId),
        columns,
        rows,
      };
    }
    default:
      fail("unknown-message", "Unknown Muxstone client message type.");
  }
}

export function normalizeMuxstoneServerMessage(value: unknown): MuxstoneServerMessage {
  const root = record(value, ["version", "type"], [
    "hostId",
    "requestId",
    "sessions",
    "session",
    "replayFromSequence",
    "latestSequence",
    "truncated",
    "operation",
    "sessionId",
    "timestamp",
    "sequence",
    "data",
    "code",
    "message",
  ]);
  protocolVersion(root.version);
  const type = stringValue(root.type, "type", 32);
  switch (type) {
    case "ready":
      exact(root, ["version", "type", "hostId"]);
      return { version: 1, type, hostId: sessionId(root.hostId) };
    case "sessions": {
      exact(root, ["version", "type", "requestId", "sessions"]);
      if (!Array.isArray(root.sessions) || root.sessions.length > MUXSTONE_PROTOCOL_LIMITS.sessions) {
        fail("invalid-sessions", "Session list exceeds the protocol quota.");
      }
      return {
        version: 1,
        type,
        requestId: requestId(root.requestId),
        sessions: root.sessions.map(sessionDescriptor),
      };
    }
    case "spawned":
      exact(root, ["version", "type", "requestId", "session"]);
      return {
        version: 1,
        type,
        requestId: requestId(root.requestId),
        session: sessionDescriptor(root.session),
      };
    case "attached":
      exact(root, [
        "version",
        "type",
        "requestId",
        "session",
        "replayFromSequence",
        "latestSequence",
        "truncated",
      ]);
      return {
        version: 1,
        type,
        requestId: requestId(root.requestId),
        session: sessionDescriptor(root.session),
        replayFromSequence: nonNegativeInteger(root.replayFromSequence, "replayFromSequence"),
        latestSequence: nonNegativeInteger(root.latestSequence, "latestSequence"),
        truncated: booleanValue(root.truncated, "truncated"),
      };
    case "ack": {
      exact(root, ["version", "type", "requestId", "operation"], ["sessionId"]);
      const operation = stringValue(root.operation, "operation", 16) as MuxstoneAcknowledgedMessage["operation"];
      if (!ACK_OPERATIONS.has(operation)) fail("invalid-operation", "Unknown acknowledged operation.");
      const id = root.sessionId === undefined ? undefined : sessionId(root.sessionId);
      return {
        version: 1,
        type,
        requestId: requestId(root.requestId),
        operation,
        ...(id !== undefined ? { sessionId: id } : {}),
      };
    }
    case "pong":
      exact(root, ["version", "type", "requestId", "timestamp"]);
      return {
        version: 1,
        type,
        requestId: requestId(root.requestId),
        timestamp: nonNegativeFinite(root.timestamp, "timestamp"),
      };
    case "output": {
      exact(root, ["version", "type", "sessionId", "sequence", "data"]);
      const data = stringValue(root.data, "data", Math.ceil(MUXSTONE_PROTOCOL_LIMITS.outputBytes / 3) * 4);
      decodeMuxstoneData(data, MUXSTONE_PROTOCOL_LIMITS.outputBytes);
      return {
        version: 1,
        type,
        sessionId: sessionId(root.sessionId),
        sequence: positiveInteger(root.sequence, "sequence"),
        data,
      };
    }
    case "session-state":
      exact(root, ["version", "type", "session"]);
      return { version: 1, type, session: sessionDescriptor(root.session) };
    case "error": {
      exact(root, ["version", "type", "code", "message"], ["requestId"]);
      const id = root.requestId === undefined ? undefined : requestId(root.requestId);
      return {
        version: 1,
        type,
        ...(id !== undefined ? { requestId: id } : {}),
        code: stringValue(root.code, "code", 64, false),
        message: stringValue(root.message, "message", MUXSTONE_PROTOCOL_LIMITS.errorBytes, false),
      };
    }
    default:
      fail("unknown-message", "Unknown Muxstone server message type.");
  }
}

export function sessionDescriptor(value: unknown): MuxstoneSessionDescriptor {
  const item = record(value, [
    "id",
    "backendId",
    "title",
    "commandLine",
    "status",
    "running",
    "columns",
    "rows",
    "createdAt",
    "updatedAt",
    "latestSequence",
    "attachedClients",
  ]);
  const status = stringValue(item.status, "status", 16) as MuxstoneSessionStatus;
  if (!STATUSES.has(status)) fail("invalid-status", "Unknown session status.");
  const columns = positiveInteger(item.columns, "columns");
  const rows = positiveInteger(item.rows, "rows");
  dimensions(columns, rows);
  return {
    id: sessionId(item.id),
    backendId: stringValue(item.backendId, "backendId", 128, false),
    title: stringValue(item.title, "title", MUXSTONE_PROTOCOL_LIMITS.titleBytes),
    commandLine: stringValue(item.commandLine, "commandLine", MUXSTONE_PROTOCOL_LIMITS.argumentsBytes),
    status,
    running: booleanValue(item.running, "running"),
    columns,
    rows,
    createdAt: nonNegativeFinite(item.createdAt, "createdAt"),
    updatedAt: nonNegativeFinite(item.updatedAt, "updatedAt"),
    latestSequence: nonNegativeInteger(item.latestSequence, "latestSequence"),
    attachedClients: nonNegativeInteger(item.attachedClients, "attachedClients"),
  };
}

function parseBoundedMessage(message: string): unknown {
  if (typeof message !== "string" || message.length > MUXSTONE_PROTOCOL_LIMITS.messageBytes) {
    fail("message-too-large", "Muxstone messages must be bounded JSON text.");
  }
  if (byteLength(message) > MUXSTONE_PROTOCOL_LIMITS.messageBytes) {
    fail("message-too-large", "Muxstone messages must be bounded JSON text.");
  }
  try {
    return JSON.parse(message);
  } catch {
    fail("invalid-json", "Muxstone message is not valid JSON.");
  }
}

type SafeRecord = Record<string, unknown>;

function record(value: unknown, required: readonly string[], optional: readonly string[] = []): SafeRecord {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    fail("invalid-object", "Expected a plain object.");
  }
  let prototype: object | null;
  let descriptors: Record<string, PropertyDescriptor>;
  let symbols: symbol[];
  try {
    prototype = Object.getPrototypeOf(value);
    descriptors = Object.getOwnPropertyDescriptors(value);
    symbols = Object.getOwnPropertySymbols(value);
  } catch {
    fail("invalid-object", "Expected an inspectable plain object.");
  }
  if ((prototype !== Object.prototype && prototype !== null) || symbols.length !== 0) {
    fail("invalid-object", "Expected a plain string-keyed object.");
  }
  const allowed = new Set([...required, ...optional]);
  const result: SafeRecord = Object.create(null);
  for (const [key, descriptor] of Object.entries(descriptors)) {
    if (!allowed.has(key) || key === "__proto__" || key === "prototype" || key === "constructor") {
      fail("unexpected-field", "Muxstone message contains an unexpected field.");
    }
    if (!("value" in descriptor) || !descriptor.enumerable) {
      fail("invalid-field", "Muxstone fields must be enumerable values.");
    }
    result[key] = descriptor.value;
  }
  for (const key of required) {
    if (!Object.hasOwn(result, key)) fail("missing-field", "Muxstone message is missing a required field.");
  }
  return result;
}

function exact(value: SafeRecord, required: readonly string[], optional: readonly string[] = []): void {
  const allowed = new Set([...required, ...optional]);
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) fail("unexpected-field", "Muxstone message contains an unexpected field.");
  }
  for (const key of required) {
    if (!Object.hasOwn(value, key)) fail("missing-field", "Muxstone message is missing a required field.");
  }
}

function protocolVersion(value: unknown): asserts value is typeof MUXSTONE_PROTOCOL_VERSION {
  if (value !== MUXSTONE_PROTOCOL_VERSION) fail("unsupported-version", "Unsupported Muxstone protocol version.");
}

function requestId(value: unknown): number {
  const result = positiveInteger(value, "requestId");
  if (!Number.isSafeInteger(result)) fail("invalid-request-id", "Request id must be a positive safe integer.");
  return result;
}

function sessionId(value: unknown): string {
  const result = stringValue(value, "sessionId", MUXSTONE_PROTOCOL_LIMITS.sessionIdBytes, false);
  if (!SESSION_ID_PATTERN.test(result)) fail("invalid-session-id", "Session id contains unsupported characters.");
  return result;
}

function dimensions(columns: number, rows: number): void {
  if (
    columns > MUXSTONE_PROTOCOL_LIMITS.columns || rows > MUXSTONE_PROTOCOL_LIMITS.rows ||
    columns * rows > MUXSTONE_PROTOCOL_LIMITS.cells
  ) {
    fail("invalid-dimensions", "Terminal dimensions exceed the protocol quota.");
  }
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value) || value.length > MUXSTONE_PROTOCOL_LIMITS.argumentCount) {
    fail("invalid-args", "Command arguments exceed the protocol quota.");
  }
  const result: string[] = [];
  let total = 0;
  for (const item of value) {
    const argument = stringValue(item, "argument", MUXSTONE_PROTOCOL_LIMITS.argumentBytes);
    if (argument.includes("\0")) fail("invalid-args", "Command argument contains a forbidden NUL byte.");
    total += byteLength(argument);
    if (total > MUXSTONE_PROTOCOL_LIMITS.argumentsBytes) fail("invalid-args", "Command arguments exceed the quota.");
    result.push(argument);
  }
  return result;
}

function environment(value: unknown): Record<string, string> {
  if (!isRecordCandidate(value)) fail("invalid-env", "Environment must be a plain object.");
  let keys: string[];
  try {
    keys = Object.keys(value);
  } catch {
    fail("invalid-env", "Environment must be an inspectable plain object.");
  }
  const source = record(value, [], keys);
  const entries = Object.entries(source);
  if (entries.length > MUXSTONE_PROTOCOL_LIMITS.environmentEntries) {
    fail("invalid-env", "Environment entries exceed the protocol quota.");
  }
  const result: Record<string, string> = {};
  let total = 0;
  for (const [key, raw] of entries) {
    if (!key || key.includes("=") || key.includes("\0")) fail("invalid-env", "Environment key is invalid.");
    const item = stringValue(raw, "environment value", MUXSTONE_PROTOCOL_LIMITS.environmentBytes);
    if (item.includes("\0")) fail("invalid-env", "Environment value contains a forbidden NUL byte.");
    total += byteLength(key) + byteLength(item);
    if (total > MUXSTONE_PROTOCOL_LIMITS.environmentBytes) fail("invalid-env", "Environment exceeds the quota.");
    result[key] = item;
  }
  return result;
}

function isRecordCandidate(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringValue(value: unknown, name: string, maxBytes: number, allowEmpty = true): string {
  if (
    typeof value !== "string" || (!allowEmpty && value.length === 0) || value.length > maxBytes ||
    byteLength(value) > maxBytes
  ) {
    fail("invalid-string", `${name} must be a bounded string.`);
  }
  return value;
}

function booleanValue(value: unknown, name: string): boolean {
  if (typeof value !== "boolean") fail("invalid-boolean", `${name} must be boolean.`);
  return value;
}

function positiveInteger(value: unknown, name: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 1) {
    fail("invalid-integer", `${name} must be a positive safe integer.`);
  }
  return value;
}

function nonNegativeInteger(value: unknown, name: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    fail("invalid-integer", `${name} must be a non-negative safe integer.`);
  }
  return value;
}

function nonNegativeFinite(value: unknown, name: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    fail("invalid-number", `${name} must be a non-negative finite number.`);
  }
  return value;
}

function byteLength(value: string): number {
  return ENCODER.encode(value).byteLength;
}

function fail(code: string, message: string): never {
  throw new MuxstoneProtocolError(code, message);
}
