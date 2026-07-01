// Copyright 2023 Im-Beast. MIT license.

import type { LayoutIntrinsicSize } from "./solver.ts";

/** A cached intrinsic measurement entry for text and layout nodes. */
export interface LayoutMeasurementCacheEntry extends LayoutIntrinsicSize {
  key: string;
}

/** Runtime statistics for intrinsic layout measurement caching. */
export interface LayoutMeasurementCacheStats {
  entries: number;
  hits: number;
  misses: number;
}

/** Options for the intrinsic layout measurement cache. */
export interface LayoutMeasurementCacheOptions {
  maxEntries?: number;
}

/** Small FIFO cache for renderer-neutral intrinsic text and widget measurements. */
export class LayoutMeasurementCache {
  readonly maxEntries: number;
  #entries = new Map<string, LayoutIntrinsicSize>();
  #hits = 0;
  #misses = 0;

  constructor(options: LayoutMeasurementCacheOptions = {}) {
    this.maxEntries = Math.max(1, Math.floor(options.maxEntries ?? 4096));
  }

  get(key: string): LayoutIntrinsicSize | undefined {
    const value = this.#entries.get(key);
    if (!value) {
      this.#misses += 1;
      return undefined;
    }
    this.#hits += 1;
    return { ...value };
  }

  set(key: string, value: LayoutIntrinsicSize): void {
    if (!this.#entries.has(key) && this.#entries.size >= this.maxEntries) {
      const oldest = this.#entries.keys().next().value;
      if (oldest !== undefined) this.#entries.delete(oldest);
    }
    this.#entries.set(key, {
      width: Math.max(0, Math.floor(value.width)),
      height: Math.max(0, Math.floor(value.height)),
    });
  }

  clear(): void {
    this.#entries.clear();
    this.#hits = 0;
    this.#misses = 0;
  }

  stats(): LayoutMeasurementCacheStats {
    return {
      entries: this.#entries.size,
      hits: this.#hits,
      misses: this.#misses,
    };
  }
}
