import { Color } from "three";

import { destroyThreeAsciiGpuBufferSlot, type ThreeAsciiGpuBufferSlot } from "./compute_resources.ts";
import type { ThreeAsciiReadbackLayout } from "./readback.ts";
import type { TerminalGlyphStyle } from "./glyphs.ts";
import type { ThreeAsciiReadbackStrategy } from "./renderer_options.ts";

export interface ThreeAsciiDeferredReadbackBuffer {
  destroy(): void;
  mapAsync(mode: number): Promise<void>;
  getMappedRange(): ArrayBuffer;
  unmap(): void;
}

export interface ThreeAsciiDeferredReadbackFrame<TBuffer extends ThreeAsciiDeferredReadbackBuffer> {
  slot: ThreeAsciiGpuBufferSlot<TBuffer>;
  layout: ThreeAsciiReadbackLayout;
  columns: number;
  rows: number;
  terminalGlyphStyle: TerminalGlyphStyle;
  terminalEdgeBias: number;
  backgroundColor: Color;
  generation: number;
  resolved: boolean;
  error?: unknown;
  readbackStart: number;
  readbackMs: number;
  mapPromise: Promise<void>;
}

export interface ThreeAsciiDeferredReadbackQueueOptions {
  slotCount?: number;
  mapModeRead: number;
  now?: () => number;
}

export interface ThreeAsciiDeferredReadbackConsumeResult {
  grid?: string[][];
  readbackMs?: number;
  readbackUnavailable?: boolean;
}

export interface ThreeAsciiDeferredReadbackStalenessInput {
  staleFrames: number;
  maxStaleFrames: number;
  completedGrid: boolean;
  hasCachedGrid: boolean;
}

export interface ThreeAsciiDeferredReadbackStalenessResult {
  staleFrames: number;
  forceBlockingReadback: boolean;
}

export interface ThreeAsciiDeferredPreSceneFrameInput {
  renderAnsi: boolean;
  renderImage: boolean;
  readbackStrategy: ThreeAsciiReadbackStrategy;
  completed: ThreeAsciiDeferredReadbackConsumeResult;
  staleFrames: number;
  maxStaleFrames: number;
  hasCachedGrid: boolean;
  pendingReadbacks?: number;
  saturated: boolean;
}

export type ThreeAsciiDeferredPreSceneFrameResult =
  | { kind: "inactive"; staleFrames: number; forceBlockingReadback: false }
  | { kind: "readbackUnavailable"; staleFrames: number; forceBlockingReadback: false }
  | { kind: "saturated"; staleFrames: number; forceBlockingReadback: boolean }
  | { kind: "continue"; staleFrames: number; forceBlockingReadback: boolean };

/** Current deferred-readback queue pressure for live renderer telemetry. */
export interface ThreeAsciiDeferredReadbackInspection {
  slotCount: number;
  pending: number;
  unresolved: number;
  resolved: number;
  saturated: boolean;
  generation: number;
}

/** Resolves whether deferred readback has returned a cached grid for too many frames. */
export function resolveThreeAsciiDeferredReadbackStaleness(
  input: ThreeAsciiDeferredReadbackStalenessInput,
): ThreeAsciiDeferredReadbackStalenessResult {
  if (input.completedGrid) {
    return { staleFrames: 0, forceBlockingReadback: false };
  }
  if (input.maxStaleFrames <= 0) {
    return { staleFrames: input.staleFrames, forceBlockingReadback: false };
  }
  const staleFrames = input.staleFrames + 1;
  return {
    staleFrames,
    forceBlockingReadback: staleFrames >= input.maxStaleFrames,
  };
}

/** Resolves the deferred-readback pre-scene decision for one renderer frame. */
export function resolveThreeAsciiDeferredPreSceneFrame(
  input: ThreeAsciiDeferredPreSceneFrameInput,
): ThreeAsciiDeferredPreSceneFrameResult {
  if (!input.renderAnsi || input.renderImage || input.readbackStrategy !== "deferred") {
    return { kind: "inactive", staleFrames: input.staleFrames, forceBlockingReadback: false };
  }
  if (input.completed.readbackUnavailable) {
    return { kind: "readbackUnavailable", staleFrames: input.staleFrames, forceBlockingReadback: false };
  }

  const staleness = resolveThreeAsciiDeferredReadbackStaleness({
    staleFrames: input.staleFrames,
    maxStaleFrames: input.maxStaleFrames,
    completedGrid: Boolean(input.completed.grid),
    hasCachedGrid: input.hasCachedGrid,
  });
  if (!input.completed.grid && input.saturated) {
    return {
      kind: "saturated",
      staleFrames: staleness.staleFrames,
      forceBlockingReadback: staleness.forceBlockingReadback,
    };
  }
  return {
    kind: "continue",
    staleFrames: staleness.staleFrames,
    forceBlockingReadback: staleness.forceBlockingReadback && (input.pendingReadbacks ?? 0) <= 0,
  };
}

/** Owns deferred WebGPU readback slots and stale-frame invalidation for terminal Three ASCII frames. */
export class ThreeAsciiDeferredReadbackQueue<TBuffer extends ThreeAsciiDeferredReadbackBuffer> {
  readonly pending: Array<ThreeAsciiDeferredReadbackFrame<TBuffer>> = [];

  private readonly slots: Array<ThreeAsciiGpuBufferSlot<TBuffer> | undefined> = [];
  private readonly slotBackgroundColors: Array<Color | undefined> = [];
  private readonly slotCount: number;
  private readonly mapModeRead: number;
  private readonly now: () => number;
  private nextSlotIndex = 0;
  private generation = 0;
  private lastGrid: string[][] = [];

  constructor(options: ThreeAsciiDeferredReadbackQueueOptions) {
    this.slotCount = Math.max(1, Math.floor(options.slotCount ?? 2));
    this.mapModeRead = options.mapModeRead;
    this.now = options.now ?? (() => performance.now());
  }

  currentGeneration(): number {
    return this.generation;
  }

  lastCompletedGrid(): string[][] {
    return this.lastGrid;
  }

  replaceLastCompletedGrid(grid: string[][]): void {
    this.generation += 1;
    this.lastGrid = grid;
  }

  inspect(): ThreeAsciiDeferredReadbackInspection {
    let unresolved = 0;
    let resolved = 0;
    for (const pending of this.pending) {
      if (pending.resolved) resolved += 1;
      else unresolved += 1;
    }
    return {
      slotCount: this.slotCount,
      pending: this.pending.length,
      unresolved,
      resolved,
      saturated: unresolved >= this.slotCount,
      generation: this.generation,
    };
  }

  isSaturated(): boolean {
    return this.inspect().saturated;
  }

  invalidate(): void {
    this.generation += 1;
    this.lastGrid = [];
  }

  nextBuffer(
    byteLength: number,
    ensure: (
      current: ThreeAsciiGpuBufferSlot<TBuffer> | undefined,
      byteLength: number,
    ) => ThreeAsciiGpuBufferSlot<TBuffer>,
  ): ThreeAsciiGpuBufferSlot<TBuffer> | undefined {
    for (let attempt = 0; attempt < this.slotCount; attempt += 1) {
      const index = (this.nextSlotIndex + attempt) % this.slotCount;
      const current = this.slots[index];
      if (current && this.pending.some((pending) => pending.slot === current)) continue;
      const next = ensure(current, byteLength);
      this.slots[index] = next;
      this.nextSlotIndex = (index + 1) % this.slotCount;
      return next;
    }
    return undefined;
  }

  queue(
    slot: ThreeAsciiGpuBufferSlot<TBuffer>,
    options: Omit<
      ThreeAsciiDeferredReadbackFrame<TBuffer>,
      "slot" | "generation" | "resolved" | "error" | "readbackStart" | "readbackMs" | "mapPromise"
    >,
  ): ThreeAsciiDeferredReadbackFrame<TBuffer> {
    const slotIndex = this.slots.indexOf(slot);
    const backgroundColor = this.backgroundColorForSlot(slotIndex);
    backgroundColor.copy(options.backgroundColor);
    const pending: ThreeAsciiDeferredReadbackFrame<TBuffer> = {
      ...options,
      slot,
      backgroundColor,
      generation: this.generation,
      resolved: false,
      readbackStart: this.now(),
      readbackMs: 0,
      mapPromise: Promise.resolve(),
    };
    this.pending.push(pending);
    pending.mapPromise = slot.gpu.mapAsync(this.mapModeRead).then(
      () => {
        pending.readbackMs = this.now() - pending.readbackStart;
        pending.resolved = true;
      },
      (error) => {
        pending.error = error;
        pending.resolved = true;
      },
    );
    return pending;
  }

  consumeCompleted(
    assemble: (pending: ThreeAsciiDeferredReadbackFrame<TBuffer>) => string[][],
    mapError: (error: unknown) => Error,
  ): ThreeAsciiDeferredReadbackConsumeResult {
    let grid: string[][] | undefined;
    let readbackMs: number | undefined;
    for (let index = 0; index < this.pending.length;) {
      const pending = this.pending[index]!;
      if (!pending.resolved) {
        index += 1;
        continue;
      }

      this.pending.splice(index, 1);
      if (pending.error !== undefined) {
        throw mapError(pending.error);
      }

      try {
        if (pending.generation === this.generation) {
          grid = assemble(pending);
          this.lastGrid = grid;
          readbackMs = pending.readbackMs;
        }
      } finally {
        pending.slot.gpu.unmap();
      }
    }
    return { grid, readbackMs };
  }

  destroy(): void {
    this.pending.length = 0;
    for (let index = 0; index < this.slots.length; index += 1) {
      this.slots[index] = destroyThreeAsciiGpuBufferSlot(this.slots[index]);
    }
    this.slots.length = 0;
    this.slotBackgroundColors.length = 0;
    this.nextSlotIndex = 0;
    this.lastGrid = [];
    this.generation += 1;
  }

  private backgroundColorForSlot(slotIndex: number): Color {
    if (slotIndex < 0) return new Color();
    let backgroundColor = this.slotBackgroundColors[slotIndex];
    if (!backgroundColor) {
      backgroundColor = new Color();
      this.slotBackgroundColors[slotIndex] = backgroundColor;
    }
    return backgroundColor;
  }
}
