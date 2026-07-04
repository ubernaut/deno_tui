export interface WorkbenchThreeCadenceInspection {
  updates: number;
  averageFrameMs?: number;
  measuredFps?: number;
}

export interface WorkbenchThreeCadenceMeterOptions {
  alpha?: number;
  resetAfterMs?: number;
}

/** Tracks observed Three grid publication cadence without retaining per-frame samples. */
export class WorkbenchThreeCadenceMeter {
  #updates = 0;
  #lastUpdateAt?: number;
  #averageFrameMs?: number;
  readonly #alpha: number;
  readonly #resetAfterMs: number;

  constructor(options: WorkbenchThreeCadenceMeterOptions = {}) {
    this.#alpha = Math.min(1, Math.max(0.01, options.alpha ?? 0.25));
    this.#resetAfterMs = Math.max(1, options.resetAfterMs ?? 2_000);
  }

  record(now = performance.now()): WorkbenchThreeCadenceInspection {
    this.#updates += 1;
    const previous = this.#lastUpdateAt;
    this.#lastUpdateAt = now;
    if (previous === undefined) return this.inspect();

    const delta = now - previous;
    if (delta <= 0) return this.inspect();
    if (delta > this.#resetAfterMs || this.#averageFrameMs === undefined) {
      this.#averageFrameMs = delta;
      return this.inspect();
    }

    this.#averageFrameMs = this.#averageFrameMs + (delta - this.#averageFrameMs) * this.#alpha;
    return this.inspect();
  }

  reset(): void {
    this.#updates = 0;
    this.#lastUpdateAt = undefined;
    this.#averageFrameMs = undefined;
  }

  inspect(): WorkbenchThreeCadenceInspection {
    const averageFrameMs = this.#averageFrameMs;
    return {
      updates: this.#updates,
      averageFrameMs,
      measuredFps: averageFrameMs && averageFrameMs > 0 ? 1000 / averageFrameMs : undefined,
    };
  }
}
