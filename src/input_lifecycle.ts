// Copyright 2023 Im-Beast. MIT license.
import {
  type InputDeviceKind,
  type InputEnvelope,
  type InputEnvelopeAdapterOptions,
  type InputEnvelopeFactory,
  type InputEnvelopeJsonObject,
  type InputEnvelopeJsonValue,
  type InputModifierFlags,
  type InputSemanticEventInput,
  type InputSourceKind,
  type InputTrustLevel,
  normalizeInputEnvelope,
} from "./input_envelope.ts";
import {
  adaptPointerEnvelope,
  normalizePointerInputEvent,
  type PointerAdapterInput,
  type PointerInputEvent,
} from "./pointer_input.ts";

/** Lifecycle boundaries that may invalidate transient input state. */
export type InputLifecycleReason =
  | "focus-lost"
  | "transport-disconnected"
  | "capture-disposed"
  | "reconciler-disposed";

/** Explicit key phases. Legacy press-only events should not be observed here. */
export type InputLifecycleKeyPhase = "down" | "repeat" | "up";

/** Explicit gesture/drag phases used by semantic controllers. */
export type InputLifecycleInteractionPhase = "start" | "update" | "finish" | "cancel";

/** Canonical key state accepted by {@link InputLifecycleReconciler.observeKey}. */
export interface InputLifecycleKeyInput {
  readonly envelope: InputEnvelope;
  /** Stable physical/logical identity supplied by the adapter (for example `KeyA`). */
  readonly keyId: string;
  /** Display/semantic key value retained for the synthetic key-up. */
  readonly key: string;
  readonly phase: InputLifecycleKeyPhase;
}

/** Pointer-derived semantic interaction state accepted by gesture/drag observers. */
export interface InputLifecycleInteractionInput {
  readonly id: string;
  readonly phase: InputLifecycleInteractionPhase;
  readonly pointer: PointerInputEvent;
}

/** Minimal structural boundary implemented by {@link InputEnvelopeFactory}. */
export interface InputLifecycleEnvelopeFactory {
  create(
    source: InputSourceKind,
    event: InputSemanticEventInput,
    options?: InputEnvelopeAdapterOptions,
  ): InputEnvelope;
}

/** Synthetic events produced during lifecycle reconciliation. */
export type InputLifecycleSyntheticEvent =
  | InputLifecycleKeyUpEvent
  | InputLifecyclePointerReleaseEvent
  | InputLifecyclePointerCancelEvent
  | InputLifecycleGestureCancelEvent
  | InputLifecycleDragCancelEvent;

/** Synthetic canonical key-up. */
export interface InputLifecycleKeyUpEvent {
  readonly kind: "key-up";
  readonly scopeId: string;
  readonly reason: InputLifecycleReason;
  readonly keyId: string;
  readonly key: string;
  readonly envelope: InputEnvelope;
}

/** Synthetic pointer button release. */
export interface InputLifecyclePointerReleaseEvent {
  readonly kind: "pointer-release";
  readonly scopeId: string;
  readonly reason: InputLifecycleReason;
  readonly pointerId: number;
  readonly button: number;
  readonly pointer: PointerInputEvent;
}

/** Synthetic pointer cancellation for contact, capture, gesture, or drag state. */
export interface InputLifecyclePointerCancelEvent {
  readonly kind: "pointer-cancel";
  readonly scopeId: string;
  readonly reason: InputLifecycleReason;
  readonly pointerId: number;
  readonly pointer: PointerInputEvent;
}

/** Synthetic semantic gesture cancellation. */
export interface InputLifecycleGestureCancelEvent {
  readonly kind: "gesture-cancel";
  readonly scopeId: string;
  readonly reason: InputLifecycleReason;
  readonly interactionId: string;
  readonly pointerId: number;
  readonly envelope: InputEnvelope;
}

/** Synthetic semantic drag cancellation. */
export interface InputLifecycleDragCancelEvent {
  readonly kind: "drag-cancel";
  readonly scopeId: string;
  readonly reason: InputLifecycleReason;
  readonly interactionId: string;
  readonly pointerId: number;
  readonly envelope: InputEnvelope;
}

/** Reconciliation observer. Exceptions are isolated and retained as diagnostics. */
export type InputLifecycleListener = (event: InputLifecycleSyntheticEvent) => void;

/** Bounded reconciler construction options. */
export interface InputLifecycleReconcilerOptions {
  /** Caller-owned canonical sequence and clock boundary. */
  readonly factory: InputLifecycleEnvelopeFactory | InputEnvelopeFactory;
  readonly maxScopes?: number;
  readonly maxKeysPerScope?: number;
  readonly maxPointersPerScope?: number;
  readonly maxInteractionsPerScope?: number;
  readonly maxListeners?: number;
  readonly maxDiagnostics?: number;
  /** Primarily useful for deterministic exhaustion tests and restored state. */
  readonly initialRevision?: number;
}

/** Stable failure categories for strict lifecycle operations. */
export type InputLifecycleErrorCode =
  | "invalid-shape"
  | "invalid-value"
  | "unknown-field"
  | "limit-exceeded"
  | "conflict"
  | "not-found"
  | "sequence-overflow"
  | "disposed";

/** Typed lifecycle validation/state failure. */
export class InputLifecycleError extends Error {
  constructor(
    readonly code: InputLifecycleErrorCode,
    message: string,
    readonly path = "$",
    override readonly cause?: unknown,
  ) {
    super(`${message} at ${path}`, { cause });
    this.name = "InputLifecycleError";
  }
}

/** Clone-safe callback/allocation failure retained by inspection. */
export interface InputLifecycleDiagnostic {
  readonly sequence: number;
  readonly phase: "factory" | "listener";
  readonly scopeId: string;
  readonly eventKind: InputLifecycleSyntheticEvent["kind"];
  readonly error: { readonly name: string; readonly message: string };
}

/** Clone-safe active key inspection. */
export interface InputLifecycleKeyInspection {
  readonly keyId: string;
  readonly key: string;
  readonly source: InputSourceKind;
  readonly trust: InputTrustLevel;
}

/** Clone-safe active pointer inspection. */
export interface InputLifecyclePointerInspection {
  readonly pointerId: number;
  readonly device: PointerInputEvent["device"];
  readonly source: InputSourceKind;
  readonly trust: InputTrustLevel;
  readonly buttons: readonly number[];
  readonly contact: boolean;
  readonly captureOwnerId?: string;
}

/** Clone-safe gesture/drag inspection. */
export interface InputLifecycleInteractionInspection {
  readonly id: string;
  readonly pointerId: number;
  readonly source: InputSourceKind;
  readonly trust: InputTrustLevel;
}

/** Clone-safe inspection for one independent input stream/scope. */
export interface InputLifecycleScopeInspection {
  readonly id: string;
  readonly keys: readonly InputLifecycleKeyInspection[];
  readonly pointers: readonly InputLifecyclePointerInspection[];
  readonly gestures: readonly InputLifecycleInteractionInspection[];
  readonly drags: readonly InputLifecycleInteractionInspection[];
}

/** Bounded immutable reconciler inspection. */
export interface InputLifecycleInspection {
  readonly disposed: boolean;
  readonly revision: number;
  readonly listenerCount: number;
  readonly diagnosticsExhausted: boolean;
  readonly scopes: readonly InputLifecycleScopeInspection[];
  readonly diagnostics: readonly InputLifecycleDiagnostic[];
}

/** Immutable result of one focused/all-state reconciliation pass. */
export interface InputLifecycleReconcileResult {
  readonly scopeId: string;
  readonly reason: InputLifecycleReason;
  readonly revision: number;
  readonly matched: number;
  readonly failed: number;
  readonly events: readonly InputLifecycleSyntheticEvent[];
}

interface KeyState {
  readonly keyId: string;
  readonly key: string;
  readonly envelope: InputEnvelope;
}

interface PointerState {
  readonly pointerId: number;
  readonly device: PointerInputEvent["device"];
  last: PointerInputEvent;
  readonly buttons: Set<number>;
  contact: boolean;
  captureOwnerId?: string;
}

interface InteractionState {
  readonly id: string;
  readonly pointerId: number;
  readonly pointer: PointerInputEvent;
}

interface ScopeState {
  readonly id: string;
  readonly keys: Map<string, KeyState>;
  readonly pointers: Map<number, PointerState>;
  readonly gestures: Map<string, InteractionState>;
  readonly drags: Map<string, InteractionState>;
}

interface ResolvedOptions {
  readonly maxScopes: number;
  readonly maxKeysPerScope: number;
  readonly maxPointersPerScope: number;
  readonly maxInteractionsPerScope: number;
  readonly maxListeners: number;
  readonly maxDiagnostics: number;
  readonly initialRevision: number;
}

const DEFAULT_OPTIONS: ResolvedOptions = Object.freeze({
  maxScopes: 64,
  maxKeysPerScope: 256,
  maxPointersPerScope: 256,
  maxInteractionsPerScope: 256,
  maxListeners: 64,
  maxDiagnostics: 64,
  initialRevision: 0,
});
const MAX_ID_LENGTH = 128;
const MAX_KEY_LENGTH = 256;
const MAX_ERROR_NAME_LENGTH = 80;
const MAX_ERROR_MESSAGE_LENGTH = 512;
const BUTTON_MASKS = [1, 4, 2, 8, 16, 32] as const;
/**
 * Tracks only transient held-input state. Hosts explicitly feed canonical
 * events and invoke lifecycle boundaries; the reconciler owns no DOM,
 * terminal, transport, capture, clock, timer, or I/O resource.
 */
export class InputLifecycleReconciler {
  readonly #factory: InputLifecycleEnvelopeFactory;
  readonly #options: ResolvedOptions;
  readonly #scopes = new Map<string, ScopeState>();
  readonly #listeners = new Set<InputLifecycleListener>();
  readonly #diagnostics: InputLifecycleDiagnostic[] = [];
  #revision: number;
  #diagnosticSequence = 0;
  #diagnosticsExhausted = false;
  #disposed = false;
  #disposing = false;

  constructor(optionsValue: InputLifecycleReconcilerOptions) {
    const options = strictRecord(optionsValue, "$.options", "input lifecycle options");
    exactFields(
      options,
      ["factory"],
      [
        "maxScopes",
        "maxKeysPerScope",
        "maxPointersPerScope",
        "maxInteractionsPerScope",
        "maxListeners",
        "maxDiagnostics",
        "initialRevision",
      ],
      "$.options",
      "input lifecycle options",
    );
    const factory = options.factory as InputLifecycleEnvelopeFactory | undefined;
    if (!factory || (typeof factory !== "object" && typeof factory !== "function")) {
      throw new InputLifecycleError("invalid-value", "factory must be an object", "$.options.factory");
    }
    let create: unknown;
    try {
      create = factory.create;
    } catch (cause) {
      throw new InputLifecycleError(
        "invalid-value",
        "factory create is not inspectable",
        "$.options.factory.create",
        cause,
      );
    }
    if (typeof create !== "function") {
      throw new InputLifecycleError("invalid-value", "factory must provide create", "$.options.factory.create");
    }
    this.#factory = Object.freeze({
      create: (
        source: InputSourceKind,
        event: InputSemanticEventInput,
        adapterOptions?: InputEnvelopeAdapterOptions,
      ): InputEnvelope => Reflect.apply(create, factory, [source, event, adapterOptions]) as InputEnvelope,
    });
    this.#options = resolveOptions(options);
    this.#revision = this.#options.initialRevision;
  }

  /** Returns whether this reconciler has completed disposal. */
  get disposed(): boolean {
    return this.#disposed;
  }

  /**
   * Observes explicit key down/repeat/up state. Repeat and duplicate down are
   * idempotent; an up for an inactive key never creates state.
   */
  observeKey(scopeIdValue: string, inputValue: InputLifecycleKeyInput): boolean {
    this.#ensureActive("observeKey");
    const scopeId = normalizeId(scopeIdValue, "$.scopeId", "scope id");
    const input = strictRecord(inputValue, "$.input", "key lifecycle input");
    exactFields(input, ["envelope", "keyId", "key", "phase"], [], "$.input", "key lifecycle input");
    const envelope = normalizeInputEnvelope(input.envelope);
    if (envelope.kind !== "key" || envelope.device !== "keyboard") {
      throw new InputLifecycleError(
        "invalid-value",
        "key lifecycle envelope must be a keyboard key",
        "$.input.envelope",
      );
    }
    const keyId = normalizeId(input.keyId, "$.input.keyId", "key id");
    const key = normalizeText(input.key, MAX_KEY_LENGTH, "$.input.key", "key");
    const phase = enumValue(input.phase, ["down", "repeat", "up"] as const, "key phase", "$.input.phase");
    const current = this.#scopes.get(scopeId)?.keys.get(keyId);
    if (current) assertKeyProvenance(current, envelope);
    if (phase === "up") {
      if (!current) return false;
      this.#bumpRevision();
      const scope = this.#scopes.get(scopeId)!;
      scope.keys.delete(keyId);
      this.#pruneScope(scope);
      return true;
    }
    if (current || phase === "repeat") return false;
    const existingScope = this.#scopes.get(scopeId);
    if (!existingScope && this.#scopes.size >= this.#options.maxScopes) {
      throw new InputLifecycleError("limit-exceeded", `scopes exceed ${this.#options.maxScopes}`, "$.scopeId");
    }
    if ((existingScope?.keys.size ?? 0) >= this.#options.maxKeysPerScope) {
      throw new InputLifecycleError(
        "limit-exceeded",
        `active keys exceed ${this.#options.maxKeysPerScope}`,
        "$.input.keyId",
      );
    }
    this.#bumpRevision();
    const scope = this.#scopeForInsert(scopeId);
    scope.keys.set(keyId, { keyId, key, envelope });
    return true;
  }

  /** Observes normalized pointer state without routing or taking capture ownership. */
  observePointer(scopeIdValue: string, eventValue: unknown): boolean {
    this.#ensureActive("observePointer");
    const scopeId = normalizeId(scopeIdValue, "$.scopeId", "scope id");
    const event = normalizePointerInputEvent(eventValue);
    const existing = this.#scopes.get(scopeId)?.pointers.get(event.pointerId);
    if (event.kind === "up" || event.kind === "cancel") {
      if (!existing) return false;
      assertPointerProvenance(existing, event);
      if (event.kind === "up") assertReleasedButtonsWereHeld(existing, event.buttons);
      this.#bumpRevision();
      const scope = this.#scopes.get(scopeId)!;
      if (event.kind === "cancel" || event.buttons === 0) {
        this.#removePointerState(scope, event.pointerId);
      } else {
        existing.last = event;
        replaceButtons(existing.buttons, event.buttons);
        existing.contact = event.device !== "mouse" && event.buttons !== 0;
      }
      this.#pruneScope(scope);
      return true;
    }
    if (event.kind !== "down" && event.kind !== "move") return false;
    if (existing) {
      assertPointerProvenance(existing, event);
      if (event.kind === "down") {
        const incoming = buttonsFromMask(event.buttons);
        const changed = incoming.some((button) => !existing.buttons.has(button));
        if (!changed) return false;
        this.#bumpRevision();
        for (const button of incoming) existing.buttons.add(button);
        existing.contact ||= event.device !== "mouse";
        existing.last = event;
        return true;
      }
      // Movement updates the cancellation geometry but never treats a missing
      // button bit as proof of release; only up/cancel/lifecycle may release it.
      this.#bumpRevision();
      existing.last = event;
      return true;
    }
    if (event.kind !== "down") return false;
    if (event.device === "mouse" && event.buttons === 0) return false;
    const existingScope = this.#scopes.get(scopeId);
    if (!existingScope && this.#scopes.size >= this.#options.maxScopes) {
      throw new InputLifecycleError("limit-exceeded", `scopes exceed ${this.#options.maxScopes}`, "$.scopeId");
    }
    if ((existingScope?.pointers.size ?? 0) >= this.#options.maxPointersPerScope) {
      throw new InputLifecycleError(
        "limit-exceeded",
        `active pointers exceed ${this.#options.maxPointersPerScope}`,
        "$.event.pointerId",
      );
    }
    this.#bumpRevision();
    const scope = this.#scopeForInsert(scopeId);
    scope.pointers.set(event.pointerId, {
      pointerId: event.pointerId,
      device: event.device,
      last: event,
      buttons: new Set(buttonsFromMask(event.buttons)),
      contact: event.device !== "mouse",
    });
    return true;
  }

  /** Associates an active pointer with a caller-owned capture owner. */
  capture(scopeIdValue: string, pointerIdValue: number, ownerIdValue: string): boolean {
    this.#ensureActive("capture");
    const scopeId = normalizeId(scopeIdValue, "$.scopeId", "scope id");
    const pointerId = normalizePointerId(pointerIdValue, "$.pointerId");
    const ownerId = normalizeId(ownerIdValue, "$.ownerId", "capture owner id");
    const pointer = this.#scopes.get(scopeId)?.pointers.get(pointerId);
    if (!pointer) {
      throw new InputLifecycleError("not-found", `pointer ${pointerId} is not active`, "$.pointerId");
    }
    if (pointer.captureOwnerId === ownerId) return false;
    if (pointer.captureOwnerId !== undefined) {
      throw new InputLifecycleError(
        "conflict",
        `pointer ${pointerId} is captured by ${pointer.captureOwnerId}`,
        "$.ownerId",
      );
    }
    this.#bumpRevision();
    pointer.captureOwnerId = ownerId;
    return true;
  }

  /** Releases a capture association only for its expected caller-owned owner. */
  releaseCapture(scopeIdValue: string, pointerIdValue: number, ownerIdValue: string): boolean {
    this.#ensureActive("releaseCapture");
    const scopeId = normalizeId(scopeIdValue, "$.scopeId", "scope id");
    const pointerId = normalizePointerId(pointerIdValue, "$.pointerId");
    const ownerId = normalizeId(ownerIdValue, "$.ownerId", "capture owner id");
    const pointer = this.#scopes.get(scopeId)?.pointers.get(pointerId);
    if (!pointer?.captureOwnerId) return false;
    if (pointer.captureOwnerId !== ownerId) {
      throw new InputLifecycleError(
        "conflict",
        `pointer ${pointerId} is captured by ${pointer.captureOwnerId}`,
        "$.ownerId",
      );
    }
    this.#bumpRevision();
    delete pointer.captureOwnerId;
    return true;
  }

  /** Observes one pointer-derived semantic gesture. */
  observeGesture(scopeId: string, input: InputLifecycleInteractionInput): boolean {
    return this.#observeInteraction("gesture", scopeId, input);
  }

  /** Observes one pointer-derived semantic drag. */
  observeDrag(scopeId: string, input: InputLifecycleInteractionInput): boolean {
    return this.#observeInteraction("drag", scopeId, input);
  }

  /** Reconciles every active transient state in one logical input scope. */
  reconcile(
    scopeIdValue: string,
    reasonValue: Exclude<InputLifecycleReason, "capture-disposed">,
  ): InputLifecycleReconcileResult {
    this.#ensureActive("reconcile");
    const scopeId = normalizeId(scopeIdValue, "$.scopeId", "scope id");
    const reason = enumValue(
      reasonValue,
      ["focus-lost", "transport-disconnected", "reconciler-disposed"] as const,
      "lifecycle reason",
      "$.reason",
    );
    return this.#reconcile(scopeId, reason);
  }

  /** Reconciles only pointers/interactions captured by one disposed owner. */
  reconcileCapture(scopeIdValue: string, ownerIdValue: string): InputLifecycleReconcileResult {
    this.#ensureActive("reconcileCapture");
    const scopeId = normalizeId(scopeIdValue, "$.scopeId", "scope id");
    const ownerId = normalizeId(ownerIdValue, "$.ownerId", "capture owner id");
    return this.#reconcile(scopeId, "capture-disposed", ownerId);
  }

  /** Adds a unique bounded observer and returns an idempotent disposer. */
  subscribe(listener: InputLifecycleListener): () => void {
    this.#ensureActive("subscribe");
    if (typeof listener !== "function") {
      throw new InputLifecycleError("invalid-value", "listener must be a function", "$.listener");
    }
    if (this.#listeners.has(listener)) {
      throw new InputLifecycleError("conflict", "listener is already registered", "$.listener");
    }
    if (this.#listeners.size >= this.#options.maxListeners) {
      throw new InputLifecycleError(
        "limit-exceeded",
        `listeners exceed ${this.#options.maxListeners}`,
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

  /** Clears retained callback/allocation diagnostics without changing input state. */
  clearDiagnostics(): void {
    this.#ensureActive("clearDiagnostics");
    this.#diagnostics.length = 0;
  }

  /** Returns a bounded deep-frozen snapshot containing no callbacks or raw data. */
  inspect(): InputLifecycleInspection {
    const scopes = Object.freeze(
      [...this.#scopes.values()]
        .sort((left, right) => compareText(left.id, right.id))
        .map((scope) => inspectScope(scope)),
    );
    const diagnostics = Object.freeze(this.#diagnostics.map(cloneDiagnostic));
    return Object.freeze({
      disposed: this.#disposed,
      revision: this.#revision,
      listenerCount: this.#listeners.size,
      diagnosticsExhausted: this.#diagnosticsExhausted,
      scopes,
      diagnostics,
    });
  }

  /** Idempotently reconciles all scopes, detaches listeners, and rejects reuse. */
  dispose(): void {
    if (this.#disposed || this.#disposing) return;
    this.#disposing = true;
    try {
      for (const scopeId of [...this.#scopes.keys()].sort(compareText)) {
        this.#reconcile(scopeId, "reconciler-disposed", undefined, true);
      }
    } finally {
      this.#scopes.clear();
      this.#listeners.clear();
      this.#disposed = true;
      this.#disposing = false;
    }
  }

  #observeInteraction(
    kind: "gesture" | "drag",
    scopeIdValue: string,
    inputValue: InputLifecycleInteractionInput,
  ): boolean {
    this.#ensureActive(`observe${kind === "gesture" ? "Gesture" : "Drag"}`);
    const scopeId = normalizeId(scopeIdValue, "$.scopeId", "scope id");
    const input = strictRecord(inputValue, "$.input", `${kind} lifecycle input`);
    exactFields(input, ["id", "phase", "pointer"], [], "$.input", `${kind} lifecycle input`);
    const id = normalizeId(input.id, "$.input.id", `${kind} id`);
    const phase = enumValue(
      input.phase,
      ["start", "update", "finish", "cancel"] as const,
      `${kind} phase`,
      "$.input.phase",
    );
    const pointer = normalizePointerInputEvent(input.pointer);
    const scope = this.#scopes.get(scopeId);
    const collection = kind === "gesture" ? scope?.gestures : scope?.drags;
    const existing = collection?.get(id);
    if (existing) assertInteractionProvenance(kind, existing, pointer);
    if (phase === "finish" || phase === "cancel") {
      if (!existing) return false;
      this.#bumpRevision();
      collection!.delete(id);
      this.#pruneScope(scope!);
      return true;
    }
    if (phase === "update") {
      if (!existing) return false;
      const activePointer = scope!.pointers.get(pointer.pointerId);
      if (!activePointer) {
        throw new InputLifecycleError(
          "not-found",
          `${kind} pointer ${pointer.pointerId} is not active`,
          "$.input.pointer.pointerId",
        );
      }
      assertPointerProvenance(activePointer, pointer, "$.input.pointer");
      this.#bumpRevision();
      collection!.set(id, { id, pointerId: pointer.pointerId, pointer });
      return true;
    }
    if (existing) return false;
    const activePointer = scope?.pointers.get(pointer.pointerId);
    if (!activePointer) {
      throw new InputLifecycleError(
        "not-found",
        `${kind} pointer ${pointer.pointerId} is not active`,
        "$.input.pointer.pointerId",
      );
    }
    if (activePointer.device !== pointer.device) {
      throw new InputLifecycleError("conflict", `${kind} pointer device does not match`, "$.input.pointer.device");
    }
    if (activePointer.last.source !== pointer.source || activePointer.last.trust !== pointer.trust) {
      throw new InputLifecycleError(
        "conflict",
        `${kind} pointer provenance does not match`,
        "$.input.pointer",
      );
    }
    const target = kind === "gesture" ? scope!.gestures : scope!.drags;
    if (target.size >= this.#options.maxInteractionsPerScope) {
      throw new InputLifecycleError(
        "limit-exceeded",
        `active ${kind}s exceed ${this.#options.maxInteractionsPerScope}`,
        "$.input.id",
      );
    }
    this.#bumpRevision();
    target.set(id, { id, pointerId: pointer.pointerId, pointer });
    return true;
  }

  #reconcile(
    scopeId: string,
    reason: InputLifecycleReason,
    captureOwnerId?: string,
    allowDisposing = false,
  ): InputLifecycleReconcileResult {
    if (!allowDisposing) this.#ensureActive("reconcile");
    const scope = this.#scopes.get(scopeId);
    if (!scope) return emptyResult(scopeId, reason, this.#revision);

    const pointerIds = captureOwnerId === undefined ? new Set(scope.pointers.keys()) : new Set(
      [...scope.pointers.values()]
        .filter((pointer) => pointer.captureOwnerId === captureOwnerId)
        .map((pointer) => pointer.pointerId),
    );
    const keys = captureOwnerId === undefined ? [...scope.keys.values()].sort(compareKeyState) : [];
    const pointers = [...scope.pointers.values()]
      .filter((pointer) => pointerIds.has(pointer.pointerId))
      .sort((left, right) => left.pointerId - right.pointerId);
    const gestures = [...scope.gestures.values()]
      .filter((interaction) => captureOwnerId === undefined || pointerIds.has(interaction.pointerId))
      .sort(compareInteractionState);
    const drags = [...scope.drags.values()]
      .filter((interaction) => captureOwnerId === undefined || pointerIds.has(interaction.pointerId))
      .sort(compareInteractionState);
    const matched = keys.length + pointers.length + gestures.length + drags.length;
    if (matched === 0) return emptyResult(scopeId, reason, this.#revision);

    // State is removed before any factory/listener callback. Reentrant passes
    // cannot release it twice, while genuinely new reentrant state survives.
    if (!allowDisposing) this.#bumpRevision();
    else if (this.#revision < Number.MAX_SAFE_INTEGER) this.#revision += 1;
    if (captureOwnerId === undefined) scope.keys.clear();
    for (const pointer of pointers) scope.pointers.delete(pointer.pointerId);
    for (const gesture of gestures) scope.gestures.delete(gesture.id);
    for (const drag of drags) scope.drags.delete(drag.id);
    this.#pruneScope(scope);

    const events: InputLifecycleSyntheticEvent[] = [];
    let failed = 0;
    for (const key of keys) {
      const event = this.#createKeyUp(scopeId, reason, key);
      if (event) events.push(event);
      else failed += 1;
    }
    for (const pointer of pointers) {
      let remainingMask = maskFromButtons(pointer.buttons);
      if (pointer.device !== "touch") {
        for (const button of [...pointer.buttons].sort((left, right) => left - right)) {
          remainingMask &= ~maskForButton(button);
          const event = this.#createPointerRelease(scopeId, reason, pointer, button, remainingMask);
          if (event) events.push(event);
          else failed += 1;
        }
      }
      const needsCancel = pointer.contact || pointer.captureOwnerId !== undefined ||
        gestures.some((entry) => entry.pointerId === pointer.pointerId) ||
        drags.some((entry) => entry.pointerId === pointer.pointerId);
      if (needsCancel) {
        const event = this.#createPointerCancel(scopeId, reason, pointer);
        if (event) events.push(event);
        else failed += 1;
      }
    }
    for (const interaction of gestures) {
      const event = this.#createInteractionCancel("gesture", scopeId, reason, interaction);
      if (event) events.push(event);
      else failed += 1;
    }
    for (const interaction of drags) {
      const event = this.#createInteractionCancel("drag", scopeId, reason, interaction);
      if (event) events.push(event);
      else failed += 1;
    }

    const frozenEvents = Object.freeze(events);
    const listeners = [...this.#listeners];
    for (const event of frozenEvents) this.#notify(event, listeners);
    return Object.freeze({
      scopeId,
      reason,
      revision: this.#revision,
      matched,
      failed,
      events: frozenEvents,
    });
  }

  #createKeyUp(
    scopeId: string,
    reason: InputLifecycleReason,
    state: KeyState,
  ): InputLifecycleKeyUpEvent | undefined {
    const envelope = this.#allocate(
      scopeId,
      "key-up",
      state.envelope.source,
      state.envelope.device,
      state.envelope.trust,
      state.envelope.modifiers,
      "key",
      { key: state.key, keyId: state.keyId, phase: "up", lifecycleReason: reason },
    );
    return envelope && Object.freeze({
      kind: "key-up",
      scopeId,
      reason,
      keyId: state.keyId,
      key: state.key,
      envelope,
    });
  }

  #createPointerRelease(
    scopeId: string,
    reason: InputLifecycleReason,
    state: PointerState,
    button: number,
    buttons: number,
  ): InputLifecyclePointerReleaseEvent | undefined {
    const envelope = this.#allocate(
      scopeId,
      "pointer-release",
      state.last.source,
      state.device,
      state.last.trust,
      state.last.modifiers,
      "pointer",
      { pointerId: state.pointerId, button, phase: "up", lifecycleReason: reason },
    );
    if (!envelope) return undefined;
    try {
      const pointer = adaptPointerEnvelope(envelope, state.device, pointerAdapterInput(state, "up", button, buttons));
      return Object.freeze({
        kind: "pointer-release",
        scopeId,
        reason,
        pointerId: state.pointerId,
        button,
        pointer,
      });
    } catch (cause) {
      this.#recordDiagnostic("factory", scopeId, "pointer-release", cause);
      return undefined;
    }
  }

  #createPointerCancel(
    scopeId: string,
    reason: InputLifecycleReason,
    state: PointerState,
  ): InputLifecyclePointerCancelEvent | undefined {
    const envelope = this.#allocate(
      scopeId,
      "pointer-cancel",
      state.last.source,
      state.device,
      state.last.trust,
      state.last.modifiers,
      "pointer",
      { pointerId: state.pointerId, phase: "cancel", lifecycleReason: reason },
    );
    if (!envelope) return undefined;
    try {
      const pointer = adaptPointerEnvelope(envelope, state.device, pointerAdapterInput(state, "cancel", null, 0));
      return Object.freeze({ kind: "pointer-cancel", scopeId, reason, pointerId: state.pointerId, pointer });
    } catch (cause) {
      this.#recordDiagnostic("factory", scopeId, "pointer-cancel", cause);
      return undefined;
    }
  }

  #createInteractionCancel(
    kind: "gesture" | "drag",
    scopeId: string,
    reason: InputLifecycleReason,
    state: InteractionState,
  ): InputLifecycleGestureCancelEvent | InputLifecycleDragCancelEvent | undefined {
    const eventKind = `${kind}-cancel` as "gesture-cancel" | "drag-cancel";
    const envelope = this.#allocate(
      scopeId,
      eventKind,
      state.pointer.source,
      state.pointer.device,
      state.pointer.trust,
      state.pointer.modifiers,
      "pointer",
      { interactionId: state.id, pointerId: state.pointerId, phase: "cancel", lifecycleReason: reason },
    );
    if (!envelope) return undefined;
    return Object.freeze({
      kind: eventKind,
      scopeId,
      reason,
      interactionId: state.id,
      pointerId: state.pointerId,
      envelope,
    }) as InputLifecycleGestureCancelEvent | InputLifecycleDragCancelEvent;
  }

  #allocate(
    scopeId: string,
    eventKind: InputLifecycleSyntheticEvent["kind"],
    source: InputSourceKind,
    device: InputDeviceKind,
    trust: InputTrustLevel,
    modifiers: InputModifierFlags,
    kind: InputSemanticEventInput["kind"],
    data: InputSemanticEventInput["data"],
  ): InputEnvelope | undefined {
    try {
      const expectedModifiers = cloneModifiers(modifiers);
      const expectedData = cloneLifecycleData(data);
      const factoryEvent: InputSemanticEventInput = Object.freeze({
        kind,
        device,
        modifiers: expectedModifiers,
        ...(expectedData === undefined ? {} : { data: expectedData }),
      });
      const envelope = normalizeInputEnvelope(
        this.#factory.create(source, factoryEvent, Object.freeze({ trust })),
      );
      if (
        envelope.source !== source || envelope.device !== device || envelope.trust !== trust ||
        envelope.kind !== kind ||
        !sameModifiers(envelope.modifiers, expectedModifiers) ||
        !sameLifecycleData(envelope.data, expectedData) || envelope.raw !== undefined
      ) {
        throw new InputLifecycleError(
          "invalid-value",
          "factory did not preserve lifecycle provenance and semantics",
          "$.factory.create",
        );
      }
      return envelope;
    } catch (cause) {
      this.#recordDiagnostic("factory", scopeId, eventKind, cause);
      return undefined;
    }
  }

  #notify(event: InputLifecycleSyntheticEvent, listeners: readonly InputLifecycleListener[]): void {
    for (const listener of listeners) {
      try {
        listener(event);
      } catch (cause) {
        this.#recordDiagnostic("listener", event.scopeId, event.kind, cause);
      }
    }
  }

  #recordDiagnostic(
    phase: InputLifecycleDiagnostic["phase"],
    scopeId: string,
    eventKind: InputLifecycleSyntheticEvent["kind"],
    cause: unknown,
  ): void {
    if (this.#options.maxDiagnostics === 0) return;
    if (this.#diagnosticSequence === Number.MAX_SAFE_INTEGER) {
      this.#diagnosticsExhausted = true;
      return;
    }
    this.#diagnosticSequence += 1;
    const diagnostic: InputLifecycleDiagnostic = Object.freeze({
      sequence: this.#diagnosticSequence,
      phase,
      scopeId,
      eventKind,
      error: errorSnapshot(cause),
    });
    if (this.#diagnostics.length === this.#options.maxDiagnostics) this.#diagnostics.shift();
    this.#diagnostics.push(diagnostic);
  }

  #scopeForInsert(scopeId: string): ScopeState {
    const current = this.#scopes.get(scopeId);
    if (current) return current;
    if (this.#scopes.size >= this.#options.maxScopes) {
      throw new InputLifecycleError("limit-exceeded", `scopes exceed ${this.#options.maxScopes}`, "$.scopeId");
    }
    const scope: ScopeState = {
      id: scopeId,
      keys: new Map(),
      pointers: new Map(),
      gestures: new Map(),
      drags: new Map(),
    };
    this.#scopes.set(scopeId, scope);
    return scope;
  }

  #removePointerState(scope: ScopeState, pointerId: number): void {
    scope.pointers.delete(pointerId);
    for (const [id, interaction] of scope.gestures) {
      if (interaction.pointerId === pointerId) scope.gestures.delete(id);
    }
    for (const [id, interaction] of scope.drags) {
      if (interaction.pointerId === pointerId) scope.drags.delete(id);
    }
  }

  #pruneScope(scope: ScopeState): void {
    if (scope.keys.size || scope.pointers.size || scope.gestures.size || scope.drags.size) return;
    if (this.#scopes.get(scope.id) === scope) this.#scopes.delete(scope.id);
  }

  #bumpRevision(): void {
    if (this.#revision === Number.MAX_SAFE_INTEGER) {
      throw new InputLifecycleError(
        "sequence-overflow",
        "input lifecycle revision exhausted at Number.MAX_SAFE_INTEGER",
        "$.revision",
      );
    }
    this.#revision += 1;
  }

  #ensureActive(operation: string): void {
    if (this.#disposed || this.#disposing) {
      throw new InputLifecycleError("disposed", `cannot ${operation} a disposed reconciler`, "$.reconciler");
    }
  }
}

function pointerAdapterInput(
  state: PointerState,
  kind: "up" | "cancel",
  button: number | null,
  buttons: number,
): PointerAdapterInput {
  const last = state.last;
  return {
    pointerId: state.pointerId,
    kind,
    coordinates: last.coordinates,
    primary: last.primary,
    button,
    buttons,
    ...(last.pressure === undefined ? {} : { pressure: 0 }),
    ...(last.tangentialPressure === undefined ? {} : { tangentialPressure: 0 }),
    ...(last.tiltX === undefined ? {} : { tiltX: last.tiltX }),
    ...(last.tiltY === undefined ? {} : { tiltY: last.tiltY }),
    ...(last.twist === undefined ? {} : { twist: last.twist }),
    ...(last.contact === undefined ? {} : { contact: last.contact }),
  };
}

function inspectScope(scope: ScopeState): InputLifecycleScopeInspection {
  const keys = Object.freeze(
    [...scope.keys.values()].sort(compareKeyState).map((state) =>
      Object.freeze({
        keyId: state.keyId,
        key: state.key,
        source: state.envelope.source,
        trust: state.envelope.trust,
      })
    ),
  );
  const pointers = Object.freeze(
    [...scope.pointers.values()]
      .sort((left, right) => left.pointerId - right.pointerId)
      .map((state) =>
        Object.freeze({
          pointerId: state.pointerId,
          device: state.device,
          source: state.last.source,
          trust: state.last.trust,
          buttons: Object.freeze([...state.buttons].sort((left, right) => left - right)),
          contact: state.contact,
          ...(state.captureOwnerId === undefined ? {} : { captureOwnerId: state.captureOwnerId }),
        })
      ),
  );
  const gestures = Object.freeze([...scope.gestures.values()].sort(compareInteractionState).map(inspectInteraction));
  const drags = Object.freeze([...scope.drags.values()].sort(compareInteractionState).map(inspectInteraction));
  return Object.freeze({ id: scope.id, keys, pointers, gestures, drags });
}

function inspectInteraction(state: InteractionState): InputLifecycleInteractionInspection {
  return Object.freeze({
    id: state.id,
    pointerId: state.pointerId,
    source: state.pointer.source,
    trust: state.pointer.trust,
  });
}

function emptyResult(
  scopeId: string,
  reason: InputLifecycleReason,
  revision: number,
): InputLifecycleReconcileResult {
  return Object.freeze({ scopeId, reason, revision, matched: 0, failed: 0, events: Object.freeze([]) });
}

function compareKeyState(left: KeyState, right: KeyState): number {
  return compareText(left.keyId, right.keyId);
}

function compareInteractionState(left: InteractionState, right: InteractionState): number {
  return compareText(left.id, right.id) || left.pointerId - right.pointerId;
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function assertKeyProvenance(state: KeyState, envelope: InputEnvelope): void {
  if (state.envelope.source === envelope.source && state.envelope.trust === envelope.trust) return;
  throw new InputLifecycleError(
    "conflict",
    `active key ${state.keyId} changed provenance`,
    "$.input.envelope",
  );
}

function assertPointerProvenance(
  state: PointerState,
  event: PointerInputEvent,
  path = "$.event",
): void {
  if (state.device !== event.device) {
    throw new InputLifecycleError(
      "conflict",
      `active pointer ${event.pointerId} changed device`,
      `${path}.device`,
    );
  }
  if (state.last.source !== event.source || state.last.trust !== event.trust) {
    throw new InputLifecycleError(
      "conflict",
      `active pointer ${event.pointerId} changed provenance`,
      path,
    );
  }
}

function assertReleasedButtonsWereHeld(state: PointerState, buttons: number): void {
  const heldMask = maskFromButtons(state.buttons);
  if ((buttons & ~heldMask) === 0) return;
  throw new InputLifecycleError(
    "conflict",
    `pointer ${state.pointerId} release introduced buttons that were not held`,
    "$.event.buttons",
  );
}

function assertInteractionProvenance(
  kind: "gesture" | "drag",
  state: InteractionState,
  pointer: PointerInputEvent,
): void {
  if (state.pointerId !== pointer.pointerId) {
    throw new InputLifecycleError(
      "conflict",
      `active ${kind} ${state.id} changed pointer`,
      "$.input.pointer.pointerId",
    );
  }
  if (state.pointer.device !== pointer.device) {
    throw new InputLifecycleError(
      "conflict",
      `active ${kind} ${state.id} changed pointer device`,
      "$.input.pointer.device",
    );
  }
  if (state.pointer.source !== pointer.source || state.pointer.trust !== pointer.trust) {
    throw new InputLifecycleError(
      "conflict",
      `active ${kind} ${state.id} changed pointer provenance`,
      "$.input.pointer",
    );
  }
}

function cloneModifiers(modifiers: InputModifierFlags): InputModifierFlags {
  return Object.freeze({
    alt: modifiers.alt,
    ctrl: modifiers.ctrl,
    meta: modifiers.meta,
    shift: modifiers.shift,
  });
}

function cloneLifecycleData(
  data: InputSemanticEventInput["data"],
): InputEnvelopeJsonObject | undefined {
  return data === undefined ? undefined : cloneLifecycleJson(data) as InputEnvelopeJsonObject;
}

function cloneLifecycleJson(value: InputEnvelopeJsonValue): InputEnvelopeJsonValue {
  if (value === null || typeof value === "boolean" || typeof value === "string") return value;
  if (typeof value === "number") return Object.is(value, -0) ? 0 : value;
  if (Array.isArray(value)) return Object.freeze(value.map(cloneLifecycleJson));
  const record = value as InputEnvelopeJsonObject;
  const clone = Object.create(null) as Record<string, InputEnvelopeJsonValue>;
  for (const key of Object.keys(record).sort(compareText)) clone[key] = cloneLifecycleJson(record[key]!);
  return Object.freeze(clone);
}

function sameModifiers(left: InputModifierFlags, right: InputModifierFlags): boolean {
  return left.alt === right.alt && left.ctrl === right.ctrl && left.meta === right.meta && left.shift === right.shift;
}

function sameLifecycleData(
  left: InputEnvelopeJsonObject | undefined,
  right: InputEnvelopeJsonObject | undefined,
): boolean {
  if (left === undefined || right === undefined) return left === right;
  return sameLifecycleJson(left, right);
}

function sameLifecycleJson(left: InputEnvelopeJsonValue, right: InputEnvelopeJsonValue): boolean {
  if (Object.is(left, right)) return true;
  if (typeof left !== "object" || left === null || typeof right !== "object" || right === null) return false;
  if (Array.isArray(left) || Array.isArray(right)) {
    if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) return false;
    return left.every((entry, index) => sameLifecycleJson(entry, right[index]!));
  }
  const leftRecord = left as InputEnvelopeJsonObject;
  const rightRecord = right as InputEnvelopeJsonObject;
  const leftKeys = Object.keys(leftRecord).sort(compareText);
  const rightKeys = Object.keys(rightRecord).sort(compareText);
  if (leftKeys.length !== rightKeys.length) return false;
  for (let index = 0; index < leftKeys.length; index += 1) {
    const key = leftKeys[index]!;
    if (key !== rightKeys[index] || !sameLifecycleJson(leftRecord[key]!, rightRecord[key]!)) return false;
  }
  return true;
}

function replaceButtons(target: Set<number>, mask: number): void {
  target.clear();
  for (const button of buttonsFromMask(mask)) target.add(button);
}

function buttonsFromMask(mask: number): number[] {
  const buttons: number[] = [];
  for (let button = 0; button < BUTTON_MASKS.length; button += 1) {
    if ((mask & BUTTON_MASKS[button]!) !== 0) buttons.push(button);
  }
  return buttons;
}

function maskFromButtons(buttons: ReadonlySet<number>): number {
  let mask = 0;
  for (const button of buttons) mask |= maskForButton(button);
  return mask;
}

function maskForButton(button: number): number {
  return BUTTON_MASKS[button] ?? 0;
}

function normalizePointerId(value: unknown, path: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0 || Object.is(value, -0)) {
    throw new InputLifecycleError("invalid-value", "pointer id must be a non-negative safe integer", path);
  }
  return value;
}

function normalizeId(value: unknown, path: string, label: string): string {
  return normalizeText(value, MAX_ID_LENGTH, path, label);
}

function normalizeText(value: unknown, maxLength: number, path: string, label: string): string {
  if (
    typeof value !== "string" || value.length === 0 || value.length > maxLength || containsControlCharacter(value)
  ) {
    throw new InputLifecycleError(
      "invalid-value",
      `${label} must be 1-${maxLength} printable characters`,
      path,
    );
  }
  return value;
}

function containsControlCharacter(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code <= 0x1f || code === 0x7f) return true;
  }
  return false;
}

function enumValue<const T extends string>(
  value: unknown,
  allowed: readonly T[],
  label: string,
  path: string,
): T {
  if (typeof value !== "string" || !allowed.includes(value as T)) {
    throw new InputLifecycleError("invalid-value", `${label} is not supported`, path);
  }
  return value as T;
}

function resolveOptions(options: Record<string, unknown>): ResolvedOptions {
  return Object.freeze({
    maxScopes: limit(options.maxScopes, DEFAULT_OPTIONS.maxScopes, 1, "$.options.maxScopes"),
    maxKeysPerScope: limit(options.maxKeysPerScope, DEFAULT_OPTIONS.maxKeysPerScope, 1, "$.options.maxKeysPerScope"),
    maxPointersPerScope: limit(
      options.maxPointersPerScope,
      DEFAULT_OPTIONS.maxPointersPerScope,
      1,
      "$.options.maxPointersPerScope",
    ),
    maxInteractionsPerScope: limit(
      options.maxInteractionsPerScope,
      DEFAULT_OPTIONS.maxInteractionsPerScope,
      1,
      "$.options.maxInteractionsPerScope",
    ),
    maxListeners: limit(options.maxListeners, DEFAULT_OPTIONS.maxListeners, 0, "$.options.maxListeners"),
    maxDiagnostics: limit(options.maxDiagnostics, DEFAULT_OPTIONS.maxDiagnostics, 0, "$.options.maxDiagnostics"),
    initialRevision: limit(options.initialRevision, DEFAULT_OPTIONS.initialRevision, 0, "$.options.initialRevision"),
  });
}

function limit(value: unknown, fallback: number, minimum: number, path: string): number {
  if (value === undefined) return fallback;
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < minimum) {
    throw new InputLifecycleError("invalid-value", `limit must be a safe integer >= ${minimum}`, path);
  }
  return value;
}

function strictRecord(value: unknown, path: string, label: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new InputLifecycleError("invalid-shape", `${label} must be a plain object`, path);
  }
  let prototype: object | null;
  try {
    prototype = Object.getPrototypeOf(value);
  } catch (cause) {
    throw new InputLifecycleError("invalid-shape", `${label} prototype is not inspectable`, path, cause);
  }
  if (prototype !== Object.prototype && prototype !== null) {
    throw new InputLifecycleError("invalid-shape", `${label} cannot be an exotic or class instance`, path);
  }
  let keys: (string | symbol)[];
  try {
    keys = Reflect.ownKeys(value);
  } catch (cause) {
    throw new InputLifecycleError("invalid-shape", `${label} keys are not inspectable`, path, cause);
  }
  const snapshot = Object.create(null) as Record<string, unknown>;
  for (const key of keys) {
    if (typeof key !== "string") {
      throw new InputLifecycleError("invalid-shape", `${label} cannot contain symbol properties`, path);
    }
    let descriptor: PropertyDescriptor | undefined;
    try {
      descriptor = Object.getOwnPropertyDescriptor(value, key);
    } catch (cause) {
      throw new InputLifecycleError("invalid-shape", `${label} property is not inspectable`, `${path}.${key}`, cause);
    }
    if (!descriptor || !("value" in descriptor) || !descriptor.enumerable) {
      throw new InputLifecycleError(
        "invalid-shape",
        `${label} properties must be enumerable data properties`,
        `${path}.${key}`,
      );
    }
    Object.defineProperty(snapshot, key, {
      value: descriptor.value,
      enumerable: true,
      configurable: false,
      writable: false,
    });
  }
  return Object.freeze(snapshot);
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
      throw new InputLifecycleError("unknown-field", `${label} contains unknown field ${key}`, `${path}.${key}`);
    }
  }
  for (const key of required) {
    if (!Object.hasOwn(record, key)) {
      throw new InputLifecycleError("invalid-shape", `${label} is missing ${key}`, `${path}.${key}`);
    }
  }
}

function errorSnapshot(cause: unknown): { readonly name: string; readonly message: string } {
  let name = "Error";
  let message = "callback failed";
  try {
    if (cause instanceof Error) {
      name = cause.name || name;
      message = cause.message || message;
    } else if (typeof cause === "string") {
      message = cause;
    }
  } catch { /* hostile error object */ }
  return Object.freeze({
    name: name.slice(0, MAX_ERROR_NAME_LENGTH),
    message: message.slice(0, MAX_ERROR_MESSAGE_LENGTH),
  });
}

function cloneDiagnostic(diagnostic: InputLifecycleDiagnostic): InputLifecycleDiagnostic {
  return Object.freeze({
    sequence: diagnostic.sequence,
    phase: diagnostic.phase,
    scopeId: diagnostic.scopeId,
    eventKind: diagnostic.eventKind,
    error: Object.freeze({ ...diagnostic.error }),
  });
}
