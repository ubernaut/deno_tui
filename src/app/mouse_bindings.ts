// Copyright 2023 Im-Beast. MIT license.
import type { MousePressEvent, MouseScrollEvent } from "../input_reader/types.ts";
import type { Rectangle } from "../types.ts";

export type MouseInteractionEvent = MousePressEvent | MouseScrollEvent;
export type MouseInteractionKind = "press" | "drag" | "release" | "scroll";

export interface MouseInteractionContext<TPayload = unknown> {
  id: string;
  bounds: Rectangle;
  localX: number;
  localY: number;
  kind: MouseInteractionKind;
  captured: boolean;
  payload?: TPayload;
}

export type MouseInteractionHandler<TEvent extends MouseInteractionEvent, TPayload = unknown> = (
  event: TEvent,
  context: MouseInteractionContext<TPayload>,
) => void | boolean | Promise<void | boolean>;

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

export interface MouseInteractionDispatchResult {
  handled: boolean;
  targetId?: string;
  kind: MouseInteractionKind;
  captured: boolean;
}

interface RegisteredMouseInteractionTarget<TPayload = unknown> extends MouseInteractionTarget<TPayload> {
  sequence: number;
}

export class MouseInteractionRouter {
  readonly #targets = new Map<string, RegisteredMouseInteractionTarget>();
  #sequence = 0;
  #captureId?: string;

  register<TPayload>(target: MouseInteractionTarget<TPayload>): () => void {
    const registered: RegisteredMouseInteractionTarget<TPayload> = {
      ...target,
      sequence: this.#sequence++,
    };
    this.#targets.set(target.id, registered as RegisteredMouseInteractionTarget);
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
    return this.#targets.delete(id);
  }

  clear(): void {
    this.#captureId = undefined;
    this.#targets.clear();
  }

  has(id: string): boolean {
    return this.#targets.has(id);
  }

  captured(): string | undefined {
    return this.#captureId;
  }

  inspect(): MouseInteractionInspection[] {
    return this.targets().map((target) => ({
      id: target.id,
      bounds: boundsOf(target),
      zIndex: target.zIndex ?? 0,
      disabled: disabled(target),
      captureDrag: target.captureDrag ?? true,
      hasPressHandler: target.onPress !== undefined,
      hasDragHandler: target.onDrag !== undefined,
      hasReleaseHandler: target.onRelease !== undefined,
      hasScrollHandler: target.onScroll !== undefined,
    }));
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
    return this.targets().find((target) =>
      !disabled(target) &&
      contains(boundsOf(target), x, y) &&
      handlerFor(target, kind) !== undefined
    );
  }

  targets(): RegisteredMouseInteractionTarget[] {
    return [...this.#targets.values()].sort((left, right) =>
      (right.zIndex ?? 0) - (left.zIndex ?? 0) || right.sequence - left.sequence
    );
  }
}

export function createMouseInteractionRouter(): MouseInteractionRouter {
  return new MouseInteractionRouter();
}

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
