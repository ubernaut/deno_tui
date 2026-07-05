import type { ThreeAsciiDeferredReadbackConsumeResult } from "./deferred_readback.ts";
import type { ThreeAsciiReadbackStrategy } from "./renderer_options.ts";

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
