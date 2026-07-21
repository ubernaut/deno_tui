// Copyright 2023 Im-Beast. MIT license.
import {
  INPUT_ENVELOPE_SCHEMA_VERSION,
  type InputEnvelope,
  type InputEnvelopeLimits,
  type InputEnvelopeRawPayload,
  type InputModifierFlags,
  type InputSourceKind,
  type InputTrustLevel,
  normalizeInputEnvelope,
} from "./input_envelope.ts";
import type { MouseEvent, MousePressEvent, MouseScrollEvent } from "./input_reader/types.ts";

/** Current normalized pointer-event schema version. */
export const POINTER_INPUT_SCHEMA_VERSION = 1 as const;

/** Stable pointer identifier used for the single terminal mouse stream. */
export const TERMINAL_MOUSE_POINTER_ID = 1 as const;

/** Devices represented by the normalized pointer contract. */
export type PointerInputDevice = "mouse" | "touch" | "pen";

/** Device-independent pointer event kinds. */
export type PointerInputKind = "down" | "move" | "up" | "cancel" | "enter" | "leave" | "wheel";

/** Explicit coordinate systems understood by pointer consumers. */
export type PointerCoordinateSpace = "screen" | "cell" | "local";

/** One finite point whose units are identified by `space`. */
export interface PointerCoordinate {
  readonly space: PointerCoordinateSpace;
  readonly x: number;
  readonly y: number;
}

/** Available positions for one pointer event. At least one space is required. */
export interface PointerCoordinates {
  readonly screen?: PointerCoordinate;
  readonly cell?: PointerCoordinate;
  readonly local?: PointerCoordinate;
}

/** Contact geometry reported by touch and pointer-capable hosts. */
export interface PointerContactGeometry {
  readonly width: number;
  readonly height: number;
}

/** Normalized wheel delta. */
export interface PointerWheelDelta {
  readonly deltaX: number;
  readonly deltaY: number;
  readonly unit: "pixel" | "line" | "page" | "cell";
}

/**
 * Immutable normalized pointer input. Source, trust, modifiers, sequencing,
 * timestamp, and optional protocol bytes are inherited from an InputEnvelope.
 */
export interface PointerInputEvent {
  readonly schemaVersion: typeof POINTER_INPUT_SCHEMA_VERSION;
  readonly sequence: number;
  readonly timestamp: number;
  readonly source: InputSourceKind;
  readonly trust: InputTrustLevel;
  readonly modifiers: InputModifierFlags;
  readonly raw?: InputEnvelopeRawPayload;
  readonly pointerId: number;
  readonly device: PointerInputDevice;
  readonly kind: PointerInputKind;
  readonly coordinates: PointerCoordinates;
  readonly primary: boolean;
  /** Changed button, or null when this event has no changed button. */
  readonly button: number | null;
  /** Standard button-state bitmask (primary=1, secondary=2, auxiliary=4). */
  readonly buttons: number;
  readonly pressure?: number;
  readonly tangentialPressure?: number;
  readonly tiltX?: number;
  readonly tiltY?: number;
  readonly twist?: number;
  readonly contact?: PointerContactGeometry;
  readonly wheel?: PointerWheelDelta;
}

/** Device-specific data accepted by the pure envelope adapters. */
export interface PointerAdapterInput {
  readonly pointerId: number;
  readonly kind: PointerInputKind;
  readonly coordinates: PointerCoordinates;
  readonly primary: boolean;
  readonly button: number | null;
  readonly buttons: number;
  readonly pressure?: number;
  readonly tangentialPressure?: number;
  readonly tiltX?: number;
  readonly tiltY?: number;
  readonly twist?: number;
  readonly contact?: PointerContactGeometry;
  readonly wheel?: PointerWheelDelta;
}

/** Optional coordinate enrichment for the legacy terminal mouse adapter. */
export interface TerminalMousePointerAdapterOptions {
  readonly pointerId?: number;
  readonly screen?: PointerCoordinate;
  readonly local?: PointerCoordinate;
}

/** Opaque source event kept beside, never inside, the clone-safe pointer event. */
export interface PointerAdapterFrame<TRawEvent> {
  readonly event: PointerInputEvent;
  readonly rawEvent: TRawEvent;
}

/** Small device-independent controller seam for adapted events. */
export interface PointerSemanticController<TRawEvent, TResult = void> {
  handlePointer(event: PointerInputEvent, rawEvent: TRawEvent): TResult;
}

/** Coarse interaction transition shared by mouse, touch, and pen controllers. */
export type PointerSemanticTransition =
  | "start"
  | "update"
  | "finish"
  | "cancel"
  | "enter"
  | "leave"
  | "wheel";

/** Stable error categories raised by strict pointer and capture operations. */
export type PointerInputErrorCode =
  | "invalid-shape"
  | "invalid-value"
  | "unknown-field"
  | "limit-exceeded"
  | "duplicate"
  | "not-found"
  | "capture-conflict"
  | "invalid-state"
  | "disposed";

/** Typed pointer contract or capture-controller failure. */
export class PointerInputError extends Error {
  constructor(
    readonly code: PointerInputErrorCode,
    message: string,
    readonly path: string = "$",
    override readonly cause?: unknown,
  ) {
    super(`${message} at ${path}`, { cause });
    this.name = "PointerInputError";
  }
}

const POINTER_DEVICES: readonly PointerInputDevice[] = ["mouse", "touch", "pen"];
const POINTER_KINDS: readonly PointerInputKind[] = ["down", "move", "up", "cancel", "enter", "leave", "wheel"];
const COORDINATE_SPACES: readonly PointerCoordinateSpace[] = ["screen", "cell", "local"];
const WHEEL_UNITS: readonly PointerWheelDelta["unit"][] = ["pixel", "line", "page", "cell"];
const POINTER_REQUIRED_FIELDS = [
  "schemaVersion",
  "sequence",
  "timestamp",
  "source",
  "trust",
  "modifiers",
  "pointerId",
  "device",
  "kind",
  "coordinates",
  "primary",
  "button",
  "buttons",
] as const;
const POINTER_OPTIONAL_FIELDS = [
  "raw",
  "pressure",
  "tangentialPressure",
  "tiltX",
  "tiltY",
  "twist",
  "contact",
  "wheel",
] as const;
const ADAPTER_REQUIRED_FIELDS = [
  "pointerId",
  "kind",
  "coordinates",
  "primary",
  "button",
  "buttons",
] as const;
const ADAPTER_OPTIONAL_FIELDS = [
  "pressure",
  "tangentialPressure",
  "tiltX",
  "tiltY",
  "twist",
  "contact",
  "wheel",
] as const;
const TERMINAL_COMMON_FIELDS = [
  "key",
  "buffer",
  "x",
  "y",
  "movementX",
  "movementY",
  "meta",
  "ctrl",
  "shift",
] as const;
const MAX_OWNER_ID_LENGTH = 128;
const MAX_ERROR_NAME_LENGTH = 80;
const MAX_ERROR_MESSAGE_LENGTH = 512;

/** Strictly clones and freezes an unknown normalized pointer event. */
export function normalizePointerInputEvent(
  value: unknown,
  inputLimits?: InputEnvelopeLimits,
): PointerInputEvent {
  const record = plainDataRecord(value, "$", "pointer event");
  assertExactFields(record, POINTER_REQUIRED_FIELDS, POINTER_OPTIONAL_FIELDS, "$", "pointer event");
  if (record.schemaVersion !== POINTER_INPUT_SCHEMA_VERSION) {
    throw new PointerInputError(
      "invalid-value",
      `unsupported pointer schema version ${String(record.schemaVersion)}`,
      "$.schemaVersion",
    );
  }

  const device = assertEnum(record.device, POINTER_DEVICES, "pointer device", "$.device");
  const kind = assertEnum(record.kind, POINTER_KINDS, "pointer kind", "$.kind");
  const canonicalDraft: Record<string, unknown> = {
    schemaVersion: INPUT_ENVELOPE_SCHEMA_VERSION,
    sequence: record.sequence,
    timestamp: record.timestamp,
    source: record.source,
    device,
    trust: record.trust,
    modifiers: record.modifiers,
    kind: semanticKindForPointer(kind),
  };
  if (record.raw !== undefined) canonicalDraft.raw = record.raw;
  const canonical = normalizeInputEnvelope(canonicalDraft, inputLimits);

  const pointerId = normalizePointerId(record.pointerId, "$.pointerId");
  const coordinates = normalizeCoordinates(record.coordinates, "$.coordinates");
  if (typeof record.primary !== "boolean") {
    throw new PointerInputError("invalid-value", "primary must be boolean", "$.primary");
  }
  const button = normalizeButton(record.button, "$.button");
  const buttons = normalizeInteger(record.buttons, 0, 63, "buttons", "$.buttons");
  const pressure = optionalFiniteRange(record.pressure, 0, 1, "pressure", "$.pressure");
  const tangentialPressure = optionalFiniteRange(
    record.tangentialPressure,
    -1,
    1,
    "tangentialPressure",
    "$.tangentialPressure",
  );
  const tiltX = optionalFiniteRange(record.tiltX, -90, 90, "tiltX", "$.tiltX");
  const tiltY = optionalFiniteRange(record.tiltY, -90, 90, "tiltY", "$.tiltY");
  const twist = record.twist === undefined ? undefined : normalizeInteger(record.twist, 0, 359, "twist", "$.twist");
  if (
    device !== "pen" &&
    (tangentialPressure !== undefined || tiltX !== undefined || tiltY !== undefined || twist !== undefined)
  ) {
    throw new PointerInputError(
      "invalid-value",
      "tangential pressure, tilt, and twist are only valid for pen input",
      "$.device",
    );
  }
  const contact = record.contact === undefined ? undefined : normalizeContact(record.contact, "$.contact");
  const wheel = record.wheel === undefined ? undefined : normalizeWheel(record.wheel, "$.wheel");
  if (kind === "wheel" && wheel === undefined) {
    throw new PointerInputError("invalid-shape", "wheel events require a wheel delta", "$.wheel");
  }
  if (kind !== "wheel" && wheel !== undefined) {
    throw new PointerInputError("invalid-value", "wheel delta is only valid for wheel events", "$.wheel");
  }

  const normalized: {
    schemaVersion: typeof POINTER_INPUT_SCHEMA_VERSION;
    sequence: number;
    timestamp: number;
    source: InputSourceKind;
    trust: InputTrustLevel;
    modifiers: InputModifierFlags;
    raw?: InputEnvelopeRawPayload;
    pointerId: number;
    device: PointerInputDevice;
    kind: PointerInputKind;
    coordinates: PointerCoordinates;
    primary: boolean;
    button: number | null;
    buttons: number;
    pressure?: number;
    tangentialPressure?: number;
    tiltX?: number;
    tiltY?: number;
    twist?: number;
    contact?: PointerContactGeometry;
    wheel?: PointerWheelDelta;
  } = {
    schemaVersion: POINTER_INPUT_SCHEMA_VERSION,
    sequence: canonical.sequence,
    timestamp: canonical.timestamp,
    source: canonical.source,
    trust: canonical.trust,
    modifiers: canonical.modifiers,
    pointerId,
    device,
    kind,
    coordinates,
    primary: record.primary,
    button,
    buttons,
  };
  if (canonical.raw !== undefined) normalized.raw = canonical.raw;
  if (pressure !== undefined) normalized.pressure = pressure;
  if (tangentialPressure !== undefined) normalized.tangentialPressure = tangentialPressure;
  if (tiltX !== undefined) normalized.tiltX = tiltX;
  if (tiltY !== undefined) normalized.tiltY = tiltY;
  if (twist !== undefined) normalized.twist = twist;
  if (contact !== undefined) normalized.contact = contact;
  if (wheel !== undefined) normalized.wheel = wheel;
  return Object.freeze(normalized);
}

/** Pure adapter for a mouse event and its canonical envelope. */
export function adaptMousePointer(envelope: unknown, input: PointerAdapterInput): PointerInputEvent {
  return adaptPointerEnvelope(envelope, "mouse", input);
}

/** Pure adapter for a touch event and its canonical envelope. */
export function adaptTouchPointer(envelope: unknown, input: PointerAdapterInput): PointerInputEvent {
  return adaptPointerEnvelope(envelope, "touch", input);
}

/** Pure adapter for a pen event and its canonical envelope. */
export function adaptPenPointer(envelope: unknown, input: PointerAdapterInput): PointerInputEvent {
  return adaptPointerEnvelope(envelope, "pen", input);
}

/** Pure generic device adapter used by the three named adapters. */
export function adaptPointerEnvelope(
  envelopeValue: unknown,
  device: PointerInputDevice,
  inputValue: PointerAdapterInput,
): PointerInputEvent {
  const normalizedDevice = assertEnum(device, POINTER_DEVICES, "pointer device", "$.device");
  const input = plainDataRecord(inputValue, "$.input", "pointer adapter input");
  assertExactFields(input, ADAPTER_REQUIRED_FIELDS, ADAPTER_OPTIONAL_FIELDS, "$.input", "pointer adapter input");
  const envelope = normalizeInputEnvelope(envelopeValue);
  if (envelope.device !== normalizedDevice) {
    throw new PointerInputError(
      "invalid-value",
      `envelope device ${envelope.device} does not match ${normalizedDevice} adapter`,
      "$.envelope.device",
    );
  }
  const draft: Record<string, unknown> = {
    schemaVersion: POINTER_INPUT_SCHEMA_VERSION,
    sequence: envelope.sequence,
    timestamp: envelope.timestamp,
    source: envelope.source,
    trust: envelope.trust,
    modifiers: envelope.modifiers,
    pointerId: input.pointerId,
    device: normalizedDevice,
    kind: input.kind,
    coordinates: input.coordinates,
    primary: input.primary,
    button: input.button,
    buttons: input.buttons,
  };
  if (envelope.raw !== undefined) draft.raw = envelope.raw;
  for (const field of ADAPTER_OPTIONAL_FIELDS) {
    if (input[field] !== undefined) draft[field] = input[field];
  }
  const event = normalizePointerInputEvent(draft);
  const expectedKind = semanticKindForPointer(event.kind);
  if (envelope.kind !== expectedKind) {
    throw new PointerInputError(
      "invalid-value",
      `envelope kind ${envelope.kind} does not match pointer kind ${event.kind}`,
      "$.envelope.kind",
    );
  }
  return event;
}

/**
 * Adapts the legacy terminal mouse union. Terminal input has cell coordinates
 * and discrete buttons, so unsupported analog fields remain absent.
 */
export function adaptTerminalMousePointer(
  envelope: unknown,
  eventValue: MouseEvent | MousePressEvent | MouseScrollEvent,
  optionsValue: TerminalMousePointerAdapterOptions = {},
): PointerInputEvent {
  const event = normalizeTerminalMouseEvent(eventValue);
  const options = plainDataRecord(optionsValue, "$.options", "terminal mouse pointer options");
  assertExactFields(options, [], ["pointerId", "screen", "local"], "$.options", "terminal mouse pointer options");
  const coordinates: { screen?: unknown; cell: PointerCoordinate; local?: unknown } = {
    cell: Object.freeze({ space: "cell", x: event.x, y: event.y }),
  };
  if (options.screen !== undefined) coordinates.screen = options.screen;
  if (options.local !== undefined) coordinates.local = options.local;

  let kind: PointerInputKind;
  let button: number | null = null;
  let buttons = 0;
  let wheel: PointerWheelDelta | undefined;
  if ("scroll" in event) {
    kind = "wheel";
    wheel = Object.freeze({ deltaX: 0, deltaY: event.scroll, unit: "line" });
  } else if ("release" in event) {
    kind = event.release ? "up" : event.drag ? "move" : "down";
    if (kind === "down" || kind === "up") button = event.button ?? null;
    if (kind === "down" || kind === "move") buttons = buttonMask(event.button);
  } else {
    kind = "move";
  }

  const input: PointerAdapterInput = {
    pointerId: options.pointerId === undefined
      ? TERMINAL_MOUSE_POINTER_ID
      : normalizePointerId(options.pointerId, "$.options.pointerId"),
    kind,
    coordinates: coordinates as PointerCoordinates,
    primary: true,
    button,
    buttons,
    ...(wheel === undefined ? {} : { wheel }),
  };
  return adaptMousePointer(envelope, input);
}

/** Creates a frozen normalized frame while intentionally retaining the opaque raw event. */
export function createPointerAdapterFrame<TRawEvent>(
  event: unknown,
  rawEvent: TRawEvent,
): PointerAdapterFrame<TRawEvent> {
  return Object.freeze({ event: normalizePointerInputEvent(event), rawEvent });
}

/** Delivers one adapter frame without erasing access to its original source event. */
export function dispatchPointerAdapterFrame<TRawEvent, TResult>(
  frame: PointerAdapterFrame<TRawEvent>,
  controller: PointerSemanticController<TRawEvent, TResult>,
): TResult {
  if (!frame || typeof frame !== "object") {
    throw new PointerInputError("invalid-shape", "pointer adapter frame must be an object", "$.frame");
  }
  if (!controller || typeof controller !== "object" || typeof controller.handlePointer !== "function") {
    throw new PointerInputError(
      "invalid-value",
      "semantic controller must provide handlePointer",
      "$.controller.handlePointer",
    );
  }
  return controller.handlePointer(normalizePointerInputEvent(frame.event), frame.rawEvent);
}

/** Maps device-specific pointer events onto a shared interaction transition. */
export function pointerSemanticTransition(eventValue: unknown): PointerSemanticTransition {
  const event = normalizePointerInputEvent(eventValue);
  switch (event.kind) {
    case "down":
      return "start";
    case "move":
      return "update";
    case "up":
      return "finish";
    case "cancel":
      return "cancel";
    case "enter":
      return "enter";
    case "leave":
      return "leave";
    case "wheel":
      return "wheel";
  }
}

/** Context supplied to one registered pointer capture owner. */
export interface PointerRouteContext {
  readonly ownerId: string;
  readonly hitOwnerId?: string;
  readonly captured: boolean;
}

/** Synchronous capture owner. The controller never owns or disposes user resources. */
export interface PointerCaptureOwner {
  readonly id: string;
  readonly onPointer: (event: PointerInputEvent, context: PointerRouteContext) => void;
}

/** Registration handle whose disposal releases every pointer captured by that owner. */
export interface PointerCaptureOwnerHandle {
  readonly id: string;
  dispose(): void;
  isDisposed(): boolean;
}

/** Observable capture-state changes. */
export type PointerCaptureChangeKind =
  | "captured"
  | "transferred"
  | "released"
  | "auto-released"
  | "cancelled"
  | "owner-disposed";

/** Immutable capture lifecycle event. */
export interface PointerCaptureChange {
  readonly revision: number;
  readonly kind: PointerCaptureChangeKind;
  readonly pointerId: number;
  readonly previousOwnerId?: string;
  readonly nextOwnerId?: string;
}

/** Non-owning observer of capture lifecycle changes. */
export type PointerCaptureListener = (change: PointerCaptureChange) => void;

/** Clone-safe error snapshot used by routing and inspection. */
export interface PointerCaptureErrorSnapshot {
  readonly name: string;
  readonly message: string;
}

/** Bounded isolated callback failure. */
export interface PointerCaptureDiagnostic {
  readonly sequence: number;
  readonly phase: "owner-handler" | "capture-listener";
  readonly pointerId?: number;
  readonly ownerId?: string;
  readonly error: PointerCaptureErrorSnapshot;
}

/** Result of deterministic captured-or-hit-target delivery. */
export interface PointerRouteResult {
  readonly pointerId: number;
  readonly kind: PointerInputKind;
  readonly delivered: boolean;
  readonly captured: boolean;
  readonly hitOwnerId?: string;
  readonly ownerId?: string;
  readonly error?: PointerCaptureErrorSnapshot;
}

/** Bounded capture-controller construction options. */
export interface PointerCaptureControllerOptions {
  readonly maxOwners?: number;
  readonly maxCaptures?: number;
  readonly maxListeners?: number;
  readonly maxDiagnostics?: number;
}

/** Clone-safe owner inspection. */
export interface PointerCaptureOwnerInspection {
  readonly id: string;
  readonly capturedPointerIds: readonly number[];
}

/** Clone-safe capture inspection. */
export interface PointerCaptureInspectionEntry {
  readonly pointerId: number;
  readonly ownerId: string;
}

/** Bounded immutable controller inspection snapshot. */
export interface PointerCaptureInspection {
  readonly disposed: boolean;
  readonly revision: number;
  readonly listenerCount: number;
  readonly owners: readonly PointerCaptureOwnerInspection[];
  readonly captures: readonly PointerCaptureInspectionEntry[];
  readonly diagnostics: readonly PointerCaptureDiagnostic[];
}

interface ResolvedPointerCaptureControllerOptions {
  readonly maxOwners: number;
  readonly maxCaptures: number;
  readonly maxListeners: number;
  readonly maxDiagnostics: number;
}

interface RegisteredPointerOwner {
  readonly id: string;
  readonly onPointer: PointerCaptureOwner["onPointer"];
  active: boolean;
}

const DEFAULT_CAPTURE_OPTIONS: ResolvedPointerCaptureControllerOptions = Object.freeze({
  maxOwners: 256,
  maxCaptures: 256,
  maxListeners: 256,
  maxDiagnostics: 64,
});

/**
 * Exclusive pointerId-to-owner capture map. Delivery snapshots the selected
 * owner before invoking user code, isolates callback errors, and applies all
 * reentrant mutations only to subsequent deliveries.
 */
export class PointerCaptureController {
  readonly #options: ResolvedPointerCaptureControllerOptions;
  readonly #owners = new Map<string, RegisteredPointerOwner>();
  readonly #captures = new Map<number, RegisteredPointerOwner>();
  readonly #listeners = new Set<PointerCaptureListener>();
  readonly #diagnostics: PointerCaptureDiagnostic[] = [];
  readonly #blockedCapturePointers = new Set<number>();
  #revision = 0;
  #diagnosticSequence = 0;
  #disposed = false;
  #disposing = false;
  #cancellingAll = false;

  constructor(options: PointerCaptureControllerOptions = {}) {
    this.#options = normalizeCaptureOptions(options);
  }

  get disposed(): boolean {
    return this.#disposed;
  }

  /** Registers a unique owner and returns an idempotent non-owning handle. */
  registerOwner(ownerValue: PointerCaptureOwner): PointerCaptureOwnerHandle {
    this.#ensureActive("registerOwner");
    const owner = plainDataRecord(ownerValue, "$.owner", "pointer capture owner");
    assertExactFields(owner, ["id", "onPointer"], [], "$.owner", "pointer capture owner");
    const id = normalizeOwnerId(owner.id, "$.owner.id");
    if (typeof owner.onPointer !== "function") {
      throw new PointerInputError("invalid-value", "owner onPointer must be a function", "$.owner.onPointer");
    }
    if (this.#owners.has(id)) {
      throw new PointerInputError("duplicate", `pointer owner ${id} is already registered`, "$.owner.id");
    }
    if (this.#owners.size >= this.#options.maxOwners) {
      throw new PointerInputError(
        "limit-exceeded",
        `pointer owners exceed ${this.#options.maxOwners}`,
        "$.owner",
      );
    }
    const registered: RegisteredPointerOwner = {
      id,
      onPointer: owner.onPointer as PointerCaptureOwner["onPointer"],
      active: true,
    };
    this.#owners.set(id, registered);
    const handle: PointerCaptureOwnerHandle = {
      id,
      dispose: () => {
        if (registered.active) this.#disposeOwnerEntry(registered);
      },
      isDisposed: () => !registered.active,
    };
    return Object.freeze(handle);
  }

  /** Disposes an owner by id and releases all of its captures. */
  disposeOwner(ownerIdValue: string): boolean {
    this.#ensureActive("disposeOwner");
    const ownerId = normalizeOwnerId(ownerIdValue, "$.ownerId");
    const owner = this.#owners.get(ownerId);
    if (!owner) return false;
    this.#disposeOwnerEntry(owner);
    return true;
  }

  /** Adds a unique non-owning lifecycle listener and returns an idempotent disposer. */
  subscribe(listener: PointerCaptureListener): () => void {
    this.#ensureActive("subscribe");
    if (typeof listener !== "function") {
      throw new PointerInputError("invalid-value", "capture listener must be a function", "$.listener");
    }
    if (this.#listeners.has(listener)) {
      throw new PointerInputError("duplicate", "capture listener is already registered", "$.listener");
    }
    if (this.#listeners.size >= this.#options.maxListeners) {
      throw new PointerInputError(
        "limit-exceeded",
        `capture listeners exceed ${this.#options.maxListeners}`,
        "$.listener",
      );
    }
    this.#listeners.add(listener);
    let active = true;
    return () => {
      if (!active) return;
      active = false;
      this.#listeners.delete(listener);
    };
  }

  /** Exclusively captures one currently uncaptured pointer for an owner. */
  capture(pointerIdValue: number, ownerIdValue: string): void {
    this.#ensureActive("capture");
    const pointerId = normalizePointerId(pointerIdValue, "$.pointerId");
    const ownerId = normalizeOwnerId(ownerIdValue, "$.ownerId");
    this.#ensureCaptureMutationAllowed(pointerId, "capture");
    const owner = this.#requiredOwner(ownerId);
    const current = this.#captures.get(pointerId);
    if (current) {
      const code = current === owner ? "duplicate" : "capture-conflict";
      throw new PointerInputError(
        code,
        `pointer ${pointerId} is already captured by ${current.id}`,
        "$.pointerId",
      );
    }
    if (this.#captures.size >= this.#options.maxCaptures) {
      throw new PointerInputError(
        "limit-exceeded",
        `pointer captures exceed ${this.#options.maxCaptures}`,
        "$.pointerId",
      );
    }
    this.#captures.set(pointerId, owner);
    this.#emitChange("captured", pointerId, undefined, owner.id);
  }

  /** Atomically transfers an existing capture from the expected owner to another owner. */
  transfer(pointerIdValue: number, fromOwnerIdValue: string, toOwnerIdValue: string): void {
    this.#ensureActive("transfer");
    const pointerId = normalizePointerId(pointerIdValue, "$.pointerId");
    const fromOwnerId = normalizeOwnerId(fromOwnerIdValue, "$.fromOwnerId");
    const toOwnerId = normalizeOwnerId(toOwnerIdValue, "$.toOwnerId");
    this.#ensureCaptureMutationAllowed(pointerId, "transfer");
    if (fromOwnerId === toOwnerId) {
      throw new PointerInputError("duplicate", "capture transfer owners must differ", "$.toOwnerId");
    }
    const fromOwner = this.#requiredOwner(fromOwnerId);
    const toOwner = this.#requiredOwner(toOwnerId);
    const current = this.#captures.get(pointerId);
    if (!current) {
      throw new PointerInputError("not-found", `pointer ${pointerId} is not captured`, "$.pointerId");
    }
    if (current !== fromOwner) {
      throw new PointerInputError(
        "capture-conflict",
        `pointer ${pointerId} is captured by ${current.id}, not ${fromOwnerId}`,
        "$.fromOwnerId",
      );
    }
    this.#captures.set(pointerId, toOwner);
    this.#emitChange("transferred", pointerId, fromOwner.id, toOwner.id);
  }

  /** Releases a capture only when it belongs to the expected owner. */
  release(pointerIdValue: number, ownerIdValue: string): boolean {
    this.#ensureActive("release");
    const pointerId = normalizePointerId(pointerIdValue, "$.pointerId");
    const ownerId = normalizeOwnerId(ownerIdValue, "$.ownerId");
    const current = this.#captures.get(pointerId);
    if (!current) return false;
    if (current.id !== ownerId) {
      throw new PointerInputError(
        "capture-conflict",
        `pointer ${pointerId} is captured by ${current.id}, not ${ownerId}`,
        "$.ownerId",
      );
    }
    this.#captures.delete(pointerId);
    this.#emitChange("released", pointerId, current.id, undefined);
    return true;
  }

  /** Cancels every current capture without manufacturing pointer capability data. */
  cancelAll(): number {
    this.#ensureActive("cancelAll");
    return this.#cancelAllInternal();
  }

  /** Returns the exclusive owner id for one pointer, if captured. */
  captureOwner(pointerIdValue: number): string | undefined {
    const pointerId = normalizePointerId(pointerIdValue, "$.pointerId");
    return this.#captures.get(pointerId)?.id;
  }

  /**
   * Delivers to the captured owner even when `hitOwnerId` changes. `up` and
   * `cancel` always release any capture after the selected owner returns.
   */
  route(eventValue: unknown, hitOwnerIdValue?: string): PointerRouteResult {
    this.#ensureActive("route");
    const event = normalizePointerInputEvent(eventValue);
    const hitOwnerId = hitOwnerIdValue === undefined ? undefined : normalizeOwnerId(hitOwnerIdValue, "$.hitOwnerId");
    const capturedOwner = this.#captures.get(event.pointerId);
    const captured = capturedOwner !== undefined && capturedOwner.active;
    const owner = captured ? capturedOwner : hitOwnerId === undefined ? undefined : this.#owners.get(hitOwnerId);
    const terminating = event.kind === "up" || event.kind === "cancel";
    const addedBlock = terminating && !this.#blockedCapturePointers.has(event.pointerId);
    if (addedBlock) this.#blockedCapturePointers.add(event.pointerId);

    let error: PointerCaptureErrorSnapshot | undefined;
    let delivered = false;
    try {
      if (owner?.active) {
        delivered = true;
        const context: PointerRouteContext = Object.freeze({
          ownerId: owner.id,
          ...(hitOwnerId === undefined ? {} : { hitOwnerId }),
          captured,
        });
        try {
          owner.onPointer(event, context);
        } catch (cause) {
          error = errorSnapshot(cause);
          this.#recordDiagnostic("owner-handler", cause, event.pointerId, owner.id);
        }
      }
    } finally {
      if (terminating) this.#releaseAny(event.pointerId, "auto-released");
      if (addedBlock) this.#blockedCapturePointers.delete(event.pointerId);
    }

    const result: {
      pointerId: number;
      kind: PointerInputKind;
      delivered: boolean;
      captured: boolean;
      hitOwnerId?: string;
      ownerId?: string;
      error?: PointerCaptureErrorSnapshot;
    } = {
      pointerId: event.pointerId,
      kind: event.kind,
      delivered,
      captured,
    };
    if (hitOwnerId !== undefined) result.hitOwnerId = hitOwnerId;
    if (owner !== undefined) result.ownerId = owner.id;
    if (error !== undefined) result.error = error;
    return Object.freeze(result);
  }

  /** Returns a bounded deep-frozen snapshot containing no callbacks. */
  inspect(): PointerCaptureInspection {
    const captureEntries = [...this.#captures.entries()].sort(([left], [right]) => left - right);
    const captures = Object.freeze(
      captureEntries.map(([pointerId, owner]) => Object.freeze({ pointerId, ownerId: owner.id })),
    );
    const owners = Object.freeze(
      [...this.#owners.values()]
        .sort((left, right) => left.id.localeCompare(right.id))
        .map((owner) => {
          const capturedPointerIds = Object.freeze(
            captureEntries
              .filter(([, capturedOwner]) => capturedOwner === owner)
              .map(([pointerId]) => pointerId),
          );
          return Object.freeze({ id: owner.id, capturedPointerIds });
        }),
    );
    const diagnostics = Object.freeze(this.#diagnostics.map(cloneDiagnostic));
    return Object.freeze({
      disposed: this.#disposed,
      revision: this.#revision,
      listenerCount: this.#listeners.size,
      owners,
      captures,
      diagnostics,
    });
  }

  clearDiagnostics(): void {
    this.#ensureActive("clearDiagnostics");
    this.#diagnostics.length = 0;
  }

  /** Idempotently cancels captures and detaches registrations without owning their resources. */
  dispose(): void {
    if (this.#disposed || this.#disposing) return;
    this.#disposing = true;
    try {
      // A cancel listener may dispose the controller reentrantly. Captures were
      // already cleared before those listeners ran, so starting a second
      // cancellation pass would only abort cleanup and leave live handles on a
      // controller reported as disposed.
      if (!this.#cancellingAll) this.#cancelAllInternal();
    } finally {
      for (const owner of this.#owners.values()) owner.active = false;
      this.#owners.clear();
      this.#captures.clear();
      this.#listeners.clear();
      this.#blockedCapturePointers.clear();
      this.#disposed = true;
      this.#disposing = false;
    }
  }

  #requiredOwner(ownerId: string): RegisteredPointerOwner {
    const owner = this.#owners.get(ownerId);
    if (!owner?.active) {
      throw new PointerInputError("not-found", `pointer owner ${ownerId} is not registered`, "$.ownerId");
    }
    return owner;
  }

  #disposeOwnerEntry(owner: RegisteredPointerOwner): void {
    if (!owner.active) return;
    owner.active = false;
    if (this.#owners.get(owner.id) === owner) this.#owners.delete(owner.id);
    const captures = [...this.#captures.entries()]
      .filter(([, capturedOwner]) => capturedOwner === owner)
      .sort(([left], [right]) => left - right);
    const ownedBlocks: number[] = [];
    for (const [pointerId] of captures) {
      this.#captures.delete(pointerId);
      if (!this.#blockedCapturePointers.has(pointerId)) {
        this.#blockedCapturePointers.add(pointerId);
        ownedBlocks.push(pointerId);
      }
    }
    try {
      for (const [pointerId] of captures) {
        this.#emitChange("owner-disposed", pointerId, owner.id, undefined);
      }
    } finally {
      // Never remove a route/cancel scope's pre-existing terminal-event block.
      for (const pointerId of ownedBlocks) this.#blockedCapturePointers.delete(pointerId);
    }
  }

  #releaseAny(pointerId: number, kind: "auto-released"): void {
    const current = this.#captures.get(pointerId);
    if (!current) return;
    this.#captures.delete(pointerId);
    this.#emitChange(kind, pointerId, current.id, undefined);
  }

  #cancelAllInternal(): number {
    if (this.#cancellingAll) {
      throw new PointerInputError("invalid-state", "capture cancellation is already in progress", "$.controller");
    }
    const captures = [...this.#captures.entries()].sort(([left], [right]) => left - right);
    this.#cancellingAll = true;
    this.#captures.clear();
    try {
      for (const [pointerId, owner] of captures) {
        this.#emitChange("cancelled", pointerId, owner.id, undefined);
      }
    } finally {
      this.#cancellingAll = false;
    }
    return captures.length;
  }

  #ensureCaptureMutationAllowed(pointerId: number, operation: string): void {
    if (this.#cancellingAll || this.#blockedCapturePointers.has(pointerId)) {
      throw new PointerInputError(
        "invalid-state",
        `cannot ${operation} pointer ${pointerId} during terminal capture cleanup`,
        "$.pointerId",
      );
    }
  }

  #emitChange(
    kind: PointerCaptureChangeKind,
    pointerId: number,
    previousOwnerId: string | undefined,
    nextOwnerId: string | undefined,
  ): void {
    this.#revision = incrementCounter(this.#revision, "capture revision");
    const change: PointerCaptureChange = Object.freeze({
      revision: this.#revision,
      kind,
      pointerId,
      ...(previousOwnerId === undefined ? {} : { previousOwnerId }),
      ...(nextOwnerId === undefined ? {} : { nextOwnerId }),
    });
    const listeners = [...this.#listeners];
    for (const listener of listeners) {
      try {
        listener(change);
      } catch (cause) {
        this.#recordDiagnostic(
          "capture-listener",
          cause,
          pointerId,
          nextOwnerId ?? previousOwnerId,
        );
      }
    }
  }

  #recordDiagnostic(
    phase: PointerCaptureDiagnostic["phase"],
    cause: unknown,
    pointerId?: number,
    ownerId?: string,
  ): void {
    if (this.#options.maxDiagnostics === 0) return;
    this.#diagnosticSequence = incrementCounter(this.#diagnosticSequence, "diagnostic sequence");
    const diagnostic: PointerCaptureDiagnostic = Object.freeze({
      sequence: this.#diagnosticSequence,
      phase,
      ...(pointerId === undefined ? {} : { pointerId }),
      ...(ownerId === undefined ? {} : { ownerId }),
      error: errorSnapshot(cause),
    });
    if (this.#diagnostics.length === this.#options.maxDiagnostics) this.#diagnostics.shift();
    this.#diagnostics.push(diagnostic);
  }

  #ensureActive(operation: string): void {
    if (this.#disposed || this.#disposing) {
      throw new PointerInputError("disposed", `cannot ${operation} a disposed capture controller`, "$.controller");
    }
  }
}

function normalizeCoordinates(value: unknown, path: string): PointerCoordinates {
  const record = plainDataRecord(value, path, "pointer coordinates");
  assertExactFields(record, [], ["screen", "cell", "local"], path, "pointer coordinates");
  const normalized: { screen?: PointerCoordinate; cell?: PointerCoordinate; local?: PointerCoordinate } = {};
  for (const space of COORDINATE_SPACES) {
    if (record[space] !== undefined) {
      normalized[space] = normalizeCoordinate(record[space], space, `${path}.${space}`);
    }
  }
  if (normalized.screen === undefined && normalized.cell === undefined && normalized.local === undefined) {
    throw new PointerInputError("invalid-shape", "at least one coordinate space is required", path);
  }
  return Object.freeze(normalized);
}

function normalizeCoordinate(
  value: unknown,
  expectedSpace: PointerCoordinateSpace,
  path: string,
): PointerCoordinate {
  const record = plainDataRecord(value, path, `${expectedSpace} coordinate`);
  assertExactFields(record, ["space", "x", "y"], [], path, `${expectedSpace} coordinate`);
  if (record.space !== expectedSpace) {
    throw new PointerInputError(
      "invalid-value",
      `${expectedSpace} coordinate must declare space ${expectedSpace}`,
      `${path}.space`,
    );
  }
  return Object.freeze({
    space: expectedSpace,
    x: finiteNumber(record.x, "x", `${path}.x`),
    y: finiteNumber(record.y, "y", `${path}.y`),
  });
}

function normalizeContact(value: unknown, path: string): PointerContactGeometry {
  const record = plainDataRecord(value, path, "pointer contact");
  assertExactFields(record, ["width", "height"], [], path, "pointer contact");
  return Object.freeze({
    width: finiteRange(record.width, 0, Number.MAX_VALUE, "contact width", `${path}.width`),
    height: finiteRange(record.height, 0, Number.MAX_VALUE, "contact height", `${path}.height`),
  });
}

function normalizeWheel(value: unknown, path: string): PointerWheelDelta {
  const record = plainDataRecord(value, path, "pointer wheel delta");
  assertExactFields(record, ["deltaX", "deltaY", "unit"], [], path, "pointer wheel delta");
  return Object.freeze({
    deltaX: finiteNumber(record.deltaX, "wheel deltaX", `${path}.deltaX`),
    deltaY: finiteNumber(record.deltaY, "wheel deltaY", `${path}.deltaY`),
    unit: assertEnum(record.unit, WHEEL_UNITS, "wheel unit", `${path}.unit`),
  });
}

function normalizeTerminalMouseEvent(
  value: MouseEvent | MousePressEvent | MouseScrollEvent,
): MouseEvent | MousePressEvent | MouseScrollEvent {
  const record = plainDataRecord(value, "$.event", "terminal mouse event");
  if (Object.hasOwn(record, "scroll")) {
    assertExactFields(record, [...TERMINAL_COMMON_FIELDS, "drag", "scroll"], [], "$.event", "mouse scroll event");
  } else if (Object.hasOwn(record, "release") || Object.hasOwn(record, "button")) {
    assertExactFields(
      record,
      [...TERMINAL_COMMON_FIELDS, "drag", "release", "button"],
      [],
      "$.event",
      "mouse press event",
    );
  } else {
    assertExactFields(record, TERMINAL_COMMON_FIELDS, [], "$.event", "mouse move event");
  }
  if (record.key !== "mouse") {
    throw new PointerInputError("invalid-value", "terminal mouse key must be mouse", "$.event.key");
  }
  if (!(record.buffer instanceof Uint8Array)) {
    throw new PointerInputError("invalid-value", "terminal mouse buffer must be Uint8Array", "$.event.buffer");
  }
  for (const field of ["x", "y", "movementX", "movementY"] as const) {
    finiteNumber(record[field], field, `$.event.${field}`);
  }
  for (const field of ["meta", "ctrl", "shift"] as const) {
    if (typeof record[field] !== "boolean") {
      throw new PointerInputError("invalid-value", `${field} must be boolean`, `$.event.${field}`);
    }
  }
  if (Object.hasOwn(record, "scroll")) {
    if (typeof record.drag !== "boolean") {
      throw new PointerInputError("invalid-value", "drag must be boolean", "$.event.drag");
    }
    if (record.scroll !== -1 && record.scroll !== 0 && record.scroll !== 1) {
      throw new PointerInputError("invalid-value", "scroll must be -1, 0, or 1", "$.event.scroll");
    }
  } else if (Object.hasOwn(record, "release")) {
    if (typeof record.drag !== "boolean" || typeof record.release !== "boolean") {
      throw new PointerInputError("invalid-value", "drag and release must be boolean", "$.event");
    }
    if (record.button !== undefined && record.button !== 0 && record.button !== 1 && record.button !== 2) {
      throw new PointerInputError(
        "invalid-value",
        "terminal mouse button must be 0, 1, 2, or undefined",
        "$.event.button",
      );
    }
    if (!record.release && record.button === undefined) {
      throw new PointerInputError("invalid-value", "non-release mouse events require a button", "$.event.button");
    }
  }
  return record as unknown as MouseEvent | MousePressEvent | MouseScrollEvent;
}

function semanticKindForPointer(kind: PointerInputKind): InputEnvelope["kind"] {
  return kind === "wheel" ? "scroll" : "pointer";
}

function buttonMask(button: MousePressEvent["button"]): number {
  if (button === 0) return 1;
  if (button === 1) return 4;
  if (button === 2) return 2;
  return 0;
}

function normalizePointerId(value: unknown, path: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0 || Object.is(value, -0)) {
    throw new PointerInputError("invalid-value", "pointerId must be a non-negative safe integer", path);
  }
  return value;
}

function normalizeButton(value: unknown, path: string): number | null {
  if (value === null) return null;
  return normalizeInteger(value, 0, 5, "button", path);
}

function normalizeInteger(value: unknown, minimum: number, maximum: number, label: string, path: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw new PointerInputError(
      "invalid-value",
      `${label} must be an integer from ${minimum} through ${maximum}`,
      path,
    );
  }
  return value;
}

function finiteNumber(value: unknown, label: string, path: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new PointerInputError("invalid-value", `${label} must be finite`, path);
  }
  return Object.is(value, -0) ? 0 : value;
}

function finiteRange(
  value: unknown,
  minimum: number,
  maximum: number,
  label: string,
  path: string,
): number {
  const normalized = finiteNumber(value, label, path);
  if (normalized < minimum || normalized > maximum) {
    throw new PointerInputError(
      "invalid-value",
      `${label} must be from ${minimum} through ${maximum}`,
      path,
    );
  }
  return normalized;
}

function optionalFiniteRange(
  value: unknown,
  minimum: number,
  maximum: number,
  label: string,
  path: string,
): number | undefined {
  return value === undefined ? undefined : finiteRange(value, minimum, maximum, label, path);
}

function normalizeOwnerId(value: unknown, path: string): string {
  if (
    typeof value !== "string" || value.length === 0 || value.length > MAX_OWNER_ID_LENGTH ||
    containsControlCharacter(value)
  ) {
    throw new PointerInputError(
      "invalid-value",
      `owner id must be 1-${MAX_OWNER_ID_LENGTH} printable characters`,
      path,
    );
  }
  return value;
}

function containsControlCharacter(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    if (value.charCodeAt(index) <= 0x1f) return true;
  }
  return false;
}

function normalizeCaptureOptions(value: PointerCaptureControllerOptions): ResolvedPointerCaptureControllerOptions {
  const record = plainDataRecord(value, "$.options", "pointer capture options");
  assertExactFields(
    record,
    [],
    ["maxOwners", "maxCaptures", "maxListeners", "maxDiagnostics"],
    "$.options",
    "pointer capture options",
  );
  return Object.freeze({
    maxOwners: controllerLimit(record.maxOwners, DEFAULT_CAPTURE_OPTIONS.maxOwners, 1, "$.options.maxOwners"),
    maxCaptures: controllerLimit(
      record.maxCaptures,
      DEFAULT_CAPTURE_OPTIONS.maxCaptures,
      1,
      "$.options.maxCaptures",
    ),
    maxListeners: controllerLimit(
      record.maxListeners,
      DEFAULT_CAPTURE_OPTIONS.maxListeners,
      1,
      "$.options.maxListeners",
    ),
    maxDiagnostics: controllerLimit(
      record.maxDiagnostics,
      DEFAULT_CAPTURE_OPTIONS.maxDiagnostics,
      0,
      "$.options.maxDiagnostics",
    ),
  });
}

function controllerLimit(value: unknown, fallback: number, minimum: number, path: string): number {
  if (value === undefined) return fallback;
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < minimum || value > 100_000) {
    throw new PointerInputError(
      "invalid-value",
      `controller limit must be an integer from ${minimum} through 100000`,
      path,
    );
  }
  return value;
}

function incrementCounter(value: number, label: string): number {
  if (value === Number.MAX_SAFE_INTEGER) {
    throw new PointerInputError("limit-exceeded", `${label} exhausted`, "$.controller");
  }
  return value + 1;
}

function errorSnapshot(cause: unknown): PointerCaptureErrorSnapshot {
  let name = "Error";
  let message = "pointer callback failed";
  try {
    if (cause instanceof Error) {
      name = typeof cause.name === "string" && cause.name.length > 0 ? cause.name : name;
      message = typeof cause.message === "string" ? cause.message : message;
    } else {
      message = String(cause);
    }
  } catch {
    // Hostile thrown values stay opaque and clone-safe.
  }
  return Object.freeze({
    name: name.slice(0, MAX_ERROR_NAME_LENGTH),
    message: message.slice(0, MAX_ERROR_MESSAGE_LENGTH),
  });
}

function cloneDiagnostic(diagnostic: PointerCaptureDiagnostic): PointerCaptureDiagnostic {
  return Object.freeze({
    sequence: diagnostic.sequence,
    phase: diagnostic.phase,
    ...(diagnostic.pointerId === undefined ? {} : { pointerId: diagnostic.pointerId }),
    ...(diagnostic.ownerId === undefined ? {} : { ownerId: diagnostic.ownerId }),
    error: Object.freeze({ ...diagnostic.error }),
  });
}

function plainDataRecord(value: unknown, path: string, label: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new PointerInputError("invalid-shape", `${label} must be a plain object`, path);
  }
  let prototype: object | null;
  try {
    prototype = Object.getPrototypeOf(value);
  } catch (cause) {
    throw new PointerInputError("invalid-shape", `${label} prototype is not inspectable`, path, cause);
  }
  if (prototype !== Object.prototype && prototype !== null) {
    throw new PointerInputError("invalid-shape", `${label} cannot be an exotic or class instance`, path);
  }
  let keys: (string | symbol)[];
  try {
    keys = Reflect.ownKeys(value);
  } catch (cause) {
    throw new PointerInputError("invalid-shape", `${label} keys are not inspectable`, path, cause);
  }
  const snapshot: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
  for (const key of keys) {
    if (typeof key !== "string") {
      throw new PointerInputError("invalid-shape", `${label} cannot contain symbol properties`, path);
    }
    let descriptor: PropertyDescriptor | undefined;
    try {
      descriptor = Object.getOwnPropertyDescriptor(value, key);
    } catch (cause) {
      throw new PointerInputError("invalid-shape", `${label} property is not inspectable`, childPath(path, key), cause);
    }
    if (!descriptor || !("value" in descriptor) || !descriptor.enumerable) {
      throw new PointerInputError(
        "invalid-shape",
        `${label} properties must be enumerable data properties without accessors`,
        childPath(path, key),
      );
    }
    snapshot[key] = descriptor.value;
  }
  return snapshot;
}

function assertExactFields(
  record: Record<string, unknown>,
  required: readonly string[],
  optional: readonly string[],
  path: string,
  label: string,
): void {
  const allowed = [...required, ...optional];
  for (const key of Object.keys(record)) {
    if (!allowed.includes(key)) {
      throw new PointerInputError("unknown-field", `${label} contains unknown field ${key}`, childPath(path, key));
    }
  }
  for (const key of required) {
    if (!Object.hasOwn(record, key)) {
      throw new PointerInputError("invalid-shape", `${label} is missing ${key}`, childPath(path, key));
    }
  }
}

function assertEnum<T extends string>(value: unknown, allowed: readonly T[], label: string, path: string): T {
  if (typeof value !== "string" || !allowed.includes(value as T)) {
    throw new PointerInputError("invalid-value", `${label} is not supported`, path);
  }
  return value as T;
}

function childPath(parent: string, key: string): string {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(key) ? `${parent}.${key}` : `${parent}[${JSON.stringify(key)}]`;
}
