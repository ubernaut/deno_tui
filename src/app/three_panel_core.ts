export interface ThreePanelValueSignal<T> {
  peek(): T;
}

export type ThreePanelResolvableValue<T> = T | ThreePanelValueSignal<T>;
export type ThreePanelResolvableLiveValue = boolean | ThreePanelValueSignal<boolean> | (() => boolean);

export type ThreePanelLifecycleState =
  | "idle"
  | "initializing"
  | "rendering"
  | "resizing"
  | "reconfiguring"
  | "stopping"
  | "failed"
  | "disposed";

export interface ThreePanelLifecycleStateInput {
  disposed: boolean;
  failed: boolean;
  destroyPending: boolean;
  rebuildPending: boolean;
  syncPending: boolean;
  rendering: boolean;
  hasRenderer: boolean;
  visible: boolean;
  gridRows: number;
}

export interface ThreePanelFrameOwnershipInput<TRenderer, TBundle> {
  disposed: boolean;
  currentGeneration: number;
  frameGeneration: number;
  currentRenderer: TRenderer | undefined;
  frameRenderer: TRenderer;
  currentBundle: TBundle | undefined;
  frameBundle: TBundle;
}

export interface ThreePanelCurrentFrameInput<TRenderer, TBundle>
  extends ThreePanelFrameOwnershipInput<TRenderer, TBundle> {
  running: boolean;
}

export interface ThreePanelFrameUpdate {
  rendererBacked: boolean;
  rows: number;
  columns: number;
}

export interface ThreePanelRenderQueueInspection {
  running: number;
  pending: number;
  scheduled: number;
  completed: number;
  failed: number;
}

/** Serializes expensive Three panel frame work so WebGPU readbacks do not compete across panes. */
export class ThreePanelRenderQueue {
  #tail: Promise<void> = Promise.resolve();
  #running = 0;
  #pending = 0;
  #scheduled = 0;
  #completed = 0;
  #failed = 0;

  run<T>(task: () => T | Promise<T>): Promise<T> {
    this.#pending += 1;
    this.#scheduled += 1;

    const previous = this.#tail;
    let release!: () => void;
    this.#tail = new Promise<void>((resolve) => {
      release = resolve;
    });

    return previous
      .catch(() => undefined)
      .then(async () => {
        this.#pending -= 1;
        this.#running += 1;
        try {
          const value = await task();
          this.#completed += 1;
          return value;
        } catch (error) {
          this.#failed += 1;
          throw error;
        } finally {
          this.#running -= 1;
          release();
        }
      });
  }

  inspect(): ThreePanelRenderQueueInspection {
    return {
      running: this.#running,
      pending: this.#pending,
      scheduled: this.#scheduled,
      completed: this.#completed,
      failed: this.#failed,
    };
  }
}

export const defaultThreePanelRenderQueue = new ThreePanelRenderQueue();

export function resolveThreePanelValue<T>(value: ThreePanelResolvableValue<T>): T {
  return isThreePanelValueSignal(value) ? value.peek() : value;
}

export function resolveOptionalThreePanelValue<T>(
  value: ThreePanelResolvableValue<T> | undefined,
): T | undefined {
  return value === undefined ? undefined : resolveThreePanelValue(value);
}

export function resolveThreePanelLiveValue(value: ThreePanelResolvableLiveValue | undefined): boolean {
  if (value === undefined) return true;
  if (isThreePanelValueSignal(value)) return value.peek();
  if (typeof value === "function") return value();
  return value;
}

export function resolveThreePanelLifecycleState(input: ThreePanelLifecycleStateInput): ThreePanelLifecycleState {
  if (input.disposed) return "disposed";
  if (input.failed) return "failed";
  if (input.rebuildPending) return "reconfiguring";
  if (input.syncPending) return "resizing";
  if (input.destroyPending) return "stopping";
  if (input.rendering) return "rendering";
  if (input.hasRenderer && input.visible && input.gridRows === 0) return "initializing";
  return "idle";
}

export function ownsThreePanelFrame<TRenderer, TBundle>(
  input: ThreePanelFrameOwnershipInput<TRenderer, TBundle>,
): boolean {
  return !input.disposed && input.currentGeneration === input.frameGeneration &&
    input.currentRenderer === input.frameRenderer && input.currentBundle === input.frameBundle;
}

export function isCurrentThreePanelFrame<TRenderer, TBundle>(
  input: ThreePanelCurrentFrameInput<TRenderer, TBundle>,
): boolean {
  return input.running && ownsThreePanelFrame(input);
}

/** Builds the lightweight event payload emitted when a Three panel renders or publishes a grid. */
export function threePanelFrameUpdate(
  grid: readonly (readonly string[] | undefined)[] | undefined,
  rendererBacked: boolean,
): ThreePanelFrameUpdate {
  return {
    rendererBacked,
    rows: grid?.length ?? 0,
    columns: grid?.[0]?.length ?? 0,
  };
}

function isThreePanelValueSignal<T>(value: unknown): value is ThreePanelValueSignal<T> {
  return typeof value === "object" && value !== null && typeof (value as { peek?: unknown }).peek === "function";
}
