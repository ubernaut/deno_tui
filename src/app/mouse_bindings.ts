// Copyright 2023 Im-Beast. MIT license.
import type { MousePressEvent, MouseScrollEvent } from "../input_reader/types.ts";
import type { Rectangle } from "../types.ts";
import { OrderedIdCollection } from "../utils/collections.ts";

/** Public type alias for a mouse Interaction Event. */
export type MouseInteractionEvent = MousePressEvent | MouseScrollEvent;
/** Identifier union for mouse Interaction variants. */
export type MouseInteractionKind = "press" | "drag" | "release" | "scroll";

/** Context object passed to mouse Interaction callbacks. */
export interface MouseInteractionContext<TPayload = unknown> {
  id: string;
  bounds: Rectangle;
  localX: number;
  localY: number;
  kind: MouseInteractionKind;
  captured: boolean;
  payload?: TPayload;
}

/** Callback signature for handling mouse Interaction events. */
export type MouseInteractionHandler<TEvent extends MouseInteractionEvent, TPayload = unknown> = (
  event: TEvent,
  context: MouseInteractionContext<TPayload>,
) => void | boolean | Promise<void | boolean>;

/** Public interface describing a mouse Interaction Target. */
export interface MouseInteractionTarget<TPayload = unknown> {
  id: string;
  bounds: Rectangle | (() => Rectangle);
  /** Static or lazily resolved paint order used for every hit test. */
  zIndex?: number | (() => number);
  disabled?: boolean | (() => boolean);
  captureDrag?: boolean;
  payload?: TPayload;
  onPress?: MouseInteractionHandler<MousePressEvent, TPayload>;
  onDrag?: MouseInteractionHandler<MousePressEvent, TPayload>;
  onRelease?: MouseInteractionHandler<MousePressEvent, TPayload>;
  onScroll?: MouseInteractionHandler<MouseScrollEvent, TPayload>;
}

/** Serializable inspection snapshot for mouse Interaction. */
export interface MouseInteractionInspection {
  id: string;
  bounds: Rectangle;
  zIndex: number;
  disabled: boolean;
  captureDrag: boolean;
  hasPressHandler: boolean;
  hasDragHandler: boolean;
  hasReleaseHandler: boolean;
  hasScrollHandler: boolean;
}

/** Public interface describing a mouse Interaction Dispatch Result. */
export interface MouseInteractionDispatchResult {
  handled: boolean;
  targetId?: string;
  kind: MouseInteractionKind;
  captured: boolean;
}

interface RegisteredMouseInteractionTarget<TPayload = unknown> extends MouseInteractionTarget<TPayload> {
  sequence: number;
}

interface ResolvedMouseInteractionTarget {
  target: RegisteredMouseInteractionTarget;
  bounds: Rectangle;
}

/** Public class implementing a mouse Interaction Router. */
export class MouseInteractionRouter {
  readonly #targets = new OrderedIdCollection<RegisteredMouseInteractionTarget>(compareRegisteredMouseTargets);
  #sequence = 0;
  #captureId?: string;
  #suppressCapturedGesture = false;

  register<TPayload>(target: MouseInteractionTarget<TPayload>): () => void {
    const registered: RegisteredMouseInteractionTarget<TPayload> = {
      ...target,
      sequence: this.#sequence++,
    };
    this.#targets.set(registered as RegisteredMouseInteractionTarget);
    return () => {
      if (this.#targets.get(target.id) === registered) {
        this.unregister(target.id);
      }
    };
  }

  unregister(id: string): boolean {
    if (this.#captureId === id) {
      this.#captureId = undefined;
      this.#suppressCapturedGesture = true;
    }
    return this.#targets.delete(id);
  }

  clear(): void {
    this.#captureId = undefined;
    this.#suppressCapturedGesture = false;
    this.#targets.clear();
  }

  has(id: string): boolean {
    return this.#targets.has(id);
  }

  captured(): string | undefined {
    return this.#captureId;
  }

  inspect(): MouseInteractionInspection[] {
    const targets = this.#orderedTargets();
    const inspected = new Array<MouseInteractionInspection>(targets.length);
    for (let index = 0; index < targets.length; index += 1) {
      const target = targets[index]!;
      inspected[index] = {
        id: target.id,
        bounds: boundsOf(target),
        zIndex: zIndexOf(target),
        disabled: disabled(target),
        captureDrag: target.captureDrag ?? true,
        hasPressHandler: target.onPress !== undefined,
        hasDragHandler: target.onDrag !== undefined,
        hasReleaseHandler: target.onRelease !== undefined,
        hasScrollHandler: target.onScroll !== undefined,
      };
    }
    return inspected;
  }

  async dispatch(event: MouseInteractionEvent): Promise<MouseInteractionDispatchResult> {
    const kind = interactionKind(event);
    if (kind === "press") this.#suppressCapturedGesture = false;
    if ((kind === "drag" || kind === "release") && this.#suppressCapturedGesture) {
      if (kind === "release") this.#suppressCapturedGesture = false;
      return { handled: false, kind, captured: false };
    }
    const captureId = kind === "drag" || kind === "release" ? this.#captureId : undefined;
    const capturedTarget = captureId ? this.#targets.get(captureId) : undefined;
    if (captureId && (!capturedTarget || disabled(capturedTarget))) {
      this.#captureId = undefined;
      this.#suppressCapturedGesture = kind !== "release";
      return { handled: false, targetId: capturedTarget?.id, kind, captured: false };
    }
    const resolved = capturedTarget && !disabled(capturedTarget)
      ? { target: capturedTarget, bounds: boundsOf(capturedTarget) }
      : this.#resolveHit(event.x, event.y, kind);
    const target = resolved?.target;
    const captured = target !== undefined && target.id === this.#captureId;

    if (!target) {
      if (kind === "release") this.#captureId = undefined;
      return { handled: false, kind, captured: false };
    }

    const handler = handlerFor(target, kind);
    if (!handler) {
      if (kind === "release" && captured) this.#captureId = undefined;
      return { handled: false, targetId: target.id, kind, captured };
    }

    const bounds = resolved.bounds;
    const handled = await handler(event, {
      id: target.id,
      bounds,
      localX: event.x - bounds.column,
      localY: event.y - bounds.row,
      kind,
      captured,
      payload: target.payload,
    }) !== false;

    if (kind === "press" && (target.captureDrag ?? true)) {
      if (handled && this.#targets.get(target.id) === target && !disabled(target)) {
        this.#captureId = target.id;
      } else if (this.#targets.get(target.id) !== target || disabled(target)) {
        this.#suppressCapturedGesture = true;
      }
    }
    if (kind === "release" && captured) {
      this.#captureId = undefined;
      this.#suppressCapturedGesture = false;
    }

    return { handled, targetId: target.id, kind, captured };
  }

  hitTest(x: number, y: number, kind: MouseInteractionKind = "press"): RegisteredMouseInteractionTarget | undefined {
    return this.#resolveHit(x, y, kind)?.target;
  }

  #resolveHit(x: number, y: number, kind: MouseInteractionKind): ResolvedMouseInteractionTarget | undefined {
    const targets = this.#orderedTargets();
    for (let index = 0; index < targets.length; index += 1) {
      const target = targets[index]!;
      if (disabled(target) || handlerFor(target, kind) === undefined) {
        continue;
      }
      const bounds = boundsOf(target);
      if (contains(bounds, x, y)) {
        return { target, bounds };
      }
    }
    return undefined;
  }

  targets(): RegisteredMouseInteractionTarget[] {
    return this.#orderedTargets();
  }

  #orderedTargets(): RegisteredMouseInteractionTarget[] {
    // OrderedIdCollection caches static order. Re-sort a detached view because
    // signals/functions can change z-order without re-registering the target.
    return Array.from(this.#targets.ordered()).sort(compareRegisteredMouseTargets);
  }
}

function compareRegisteredMouseTargets(
  left: RegisteredMouseInteractionTarget,
  right: RegisteredMouseInteractionTarget,
): number {
  return zIndexOf(right) - zIndexOf(left) || right.sequence - left.sequence;
}

/** Creates an mouse Interaction Router. */
export function createMouseInteractionRouter(): MouseInteractionRouter {
  return new MouseInteractionRouter();
}

/** Binds mouse Interactions behavior and returns a disposer when applicable. */
export function bindMouseInteractions<
  TTarget extends {
    on(type: "mousePress", listener: (event: MousePressEvent) => void | Promise<void>): () => void;
    on(type: "mouseScroll", listener: (event: MouseScrollEvent) => void | Promise<void>): () => void;
  },
>(
  target: TTarget,
  router: MouseInteractionRouter,
): () => void {
  // EventEmitter deliberately does not await listeners. Preserve source order
  // here so an asynchronous press handler can establish capture before a drag
  // or release emitted in the same turn is routed.
  let pending: Promise<void> | undefined;
  const enqueue = (event: MouseInteractionEvent): Promise<void> => {
    // InputReader reuses one mutable mouse event and aliases its read buffer.
    // Preserve the decoded event at synchronous ingress before an async press
    // can let later drag/release decoding rewrite the queued values.
    const snapshot = snapshotMouseInteractionEvent(event);
    const dispatch = () => router.dispatch(snapshot);
    const started = pending ? pending.then(dispatch) : dispatch();
    const settled = started.then(() => undefined).catch(() => {
      // Bindings are fire-and-forget by contract. Isolate a failed handler so
      // later input is still routed and no rejected queue is left unobserved.
    });
    pending = settled;
    void settled.then(() => {
      if (pending === settled) pending = undefined;
    });
    return settled;
  };
  const stopPress = target.on("mousePress", enqueue);
  const stopScroll = target.on("mouseScroll", enqueue);
  return () => {
    stopScroll();
    stopPress();
  };
}

function snapshotMouseInteractionEvent(event: MouseInteractionEvent): MouseInteractionEvent {
  return { ...event, buffer: new Uint8Array(event.buffer) };
}

function interactionKind(event: MouseInteractionEvent): MouseInteractionKind {
  if ("scroll" in event) return "scroll";
  if (event.release) return "release";
  return event.drag ? "drag" : "press";
}

function handlerFor(
  target: MouseInteractionTarget,
  kind: MouseInteractionKind,
): MouseInteractionHandler<MouseInteractionEvent> | undefined {
  switch (kind) {
    case "press":
      return target.onPress as MouseInteractionHandler<MouseInteractionEvent> | undefined;
    case "drag":
      return target.onDrag as MouseInteractionHandler<MouseInteractionEvent> | undefined;
    case "release":
      return target.onRelease as MouseInteractionHandler<MouseInteractionEvent> | undefined;
    case "scroll":
      return target.onScroll as MouseInteractionHandler<MouseInteractionEvent> | undefined;
  }
}

function boundsOf(target: MouseInteractionTarget): Rectangle {
  return typeof target.bounds === "function" ? target.bounds() : target.bounds;
}

function zIndexOf(target: MouseInteractionTarget): number {
  try {
    const value = typeof target.zIndex === "function" ? target.zIndex() : target.zIndex ?? 0;
    return Number.isFinite(value) ? value : 0;
  } catch {
    return 0;
  }
}

function disabled(target: MouseInteractionTarget): boolean {
  return typeof target.disabled === "function" ? target.disabled() : target.disabled ?? false;
}

function contains(bounds: Rectangle, x: number, y: number): boolean {
  return x >= bounds.column &&
    y >= bounds.row &&
    x < bounds.column + Math.max(0, bounds.width) &&
    y < bounds.row + Math.max(0, bounds.height);
}
