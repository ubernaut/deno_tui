// Copyright 2023 Im-Beast. MIT license.
import type { MousePressEvent, MouseScrollEvent } from "../input_reader/types.ts";
import type { Rectangle } from "../types.ts";

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
  zIndex?: number;
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

/** Public class implementing a mouse Interaction Router. */
export class MouseInteractionRouter {
  readonly #targets = new Map<string, RegisteredMouseInteractionTarget>();
  #orderedTargets?: RegisteredMouseInteractionTarget[];
  #sequence = 0;
  #captureId?: string;

  register<TPayload>(target: MouseInteractionTarget<TPayload>): () => void {
    const registered: RegisteredMouseInteractionTarget<TPayload> = {
      ...target,
      sequence: this.#sequence++,
    };
    this.#targets.set(target.id, registered as RegisteredMouseInteractionTarget);
    this.#orderedTargets = undefined;
    return () => {
      if (this.#targets.get(target.id) === registered) {
        this.unregister(target.id);
      }
    };
  }

  unregister(id: string): boolean {
    if (this.#captureId === id) {
      this.#captureId = undefined;
    }
    const removed = this.#targets.delete(id);
    if (removed) this.#orderedTargets = undefined;
    return removed;
  }

  clear(): void {
    this.#captureId = undefined;
    this.#targets.clear();
    this.#orderedTargets = undefined;
  }

  has(id: string): boolean {
    return this.#targets.has(id);
  }

  captured(): string | undefined {
    return this.#captureId;
  }

  inspect(): MouseInteractionInspection[] {
    const targets = this.#ordered();
    const inspected = new Array<MouseInteractionInspection>(targets.length);
    for (let index = 0; index < targets.length; index += 1) {
      const target = targets[index]!;
      inspected[index] = {
        id: target.id,
        bounds: boundsOf(target),
        zIndex: target.zIndex ?? 0,
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
    const capturedTarget = this.#captureId && (kind === "drag" || kind === "release")
      ? this.#targets.get(this.#captureId)
      : undefined;
    const target = capturedTarget && !disabled(capturedTarget) ? capturedTarget : this.hitTest(event.x, event.y, kind);
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

    const bounds = boundsOf(target);
    const handled = await handler(event, {
      id: target.id,
      bounds,
      localX: event.x - bounds.column,
      localY: event.y - bounds.row,
      kind,
      captured,
      payload: target.payload,
    }) !== false;

    if (handled && kind === "press" && (target.captureDrag ?? true)) {
      this.#captureId = target.id;
    }
    if (kind === "release" && captured) {
      this.#captureId = undefined;
    }

    return { handled, targetId: target.id, kind, captured };
  }

  hitTest(x: number, y: number, kind: MouseInteractionKind = "press"): RegisteredMouseInteractionTarget | undefined {
    const targets = this.#ordered();
    for (let index = 0; index < targets.length; index += 1) {
      const target = targets[index]!;
      if (!disabled(target) && contains(boundsOf(target), x, y) && handlerFor(target, kind) !== undefined) {
        return target;
      }
    }
    return undefined;
  }

  targets(): RegisteredMouseInteractionTarget[] {
    const source = this.#ordered();
    const targets = new Array<RegisteredMouseInteractionTarget>(source.length);
    for (let index = 0; index < source.length; index += 1) targets[index] = source[index]!;
    return targets;
  }

  #ordered(): RegisteredMouseInteractionTarget[] {
    if (!this.#orderedTargets) {
      const targets: RegisteredMouseInteractionTarget[] = [];
      for (const target of this.#targets.values()) targets.push(target);
      targets.sort((left, right) => (right.zIndex ?? 0) - (left.zIndex ?? 0) || right.sequence - left.sequence);
      this.#orderedTargets = targets;
    }
    return this.#orderedTargets;
  }
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
  const stopPress = target.on("mousePress", (event) => void router.dispatch(event));
  const stopScroll = target.on("mouseScroll", (event) => void router.dispatch(event));
  return () => {
    stopScroll();
    stopPress();
  };
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

function disabled(target: MouseInteractionTarget): boolean {
  return typeof target.disabled === "function" ? target.disabled() : target.disabled ?? false;
}

function contains(bounds: Rectangle, x: number, y: number): boolean {
  return x >= bounds.column &&
    y >= bounds.row &&
    x < bounds.column + Math.max(0, bounds.width) &&
    y < bounds.row + Math.max(0, bounds.height);
}
