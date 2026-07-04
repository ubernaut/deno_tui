import { Color } from "npm:three@0.183.2";

import { destroyThreeAsciiGpuBufferSlot, type ThreeAsciiGpuBufferSlot } from "./gpu_buffers.ts";
import type { ThreeAsciiReadbackLayout } from "./readback.ts";
import type { TerminalGlyphStyle } from "./glyphs.ts";

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
}

export interface ThreeAsciiDeferredReadbackQueueOptions {
  slotCount?: number;
  mapModeRead: number;
  now?: () => number;
}

export interface ThreeAsciiDeferredReadbackConsumeResult {
  grid?: string[][];
  readbackMs?: number;
}

/** Owns deferred WebGPU readback slots and stale-frame invalidation for terminal Three ASCII frames. */
export class ThreeAsciiDeferredReadbackQueue<TBuffer extends ThreeAsciiDeferredReadbackBuffer> {
  readonly pending: Array<ThreeAsciiDeferredReadbackFrame<TBuffer>> = [];

  private readonly slots: Array<ThreeAsciiGpuBufferSlot<TBuffer> | undefined> = [];
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

  isSaturated(): boolean {
    let unresolved = 0;
    for (const pending of this.pending) {
      if (!pending.resolved) unresolved += 1;
    }
    return unresolved >= this.slotCount;
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
      "slot" | "generation" | "resolved" | "error" | "readbackStart" | "readbackMs"
    >,
  ): void {
    const pending: ThreeAsciiDeferredReadbackFrame<TBuffer> = {
      ...options,
      slot,
      generation: this.generation,
      resolved: false,
      readbackStart: this.now(),
      readbackMs: 0,
    };
    this.pending.push(pending);
    slot.gpu.mapAsync(this.mapModeRead).then(
      () => {
        pending.readbackMs = this.now() - pending.readbackStart;
        pending.resolved = true;
      },
      (error) => {
        pending.error = error;
        pending.resolved = true;
      },
    );
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
    this.nextSlotIndex = 0;
    this.lastGrid = [];
    this.generation += 1;
  }
}
