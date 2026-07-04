import type { ThreeAsciiDeferredReadbackConsumeResult } from "./deferred_readback.ts";
import { resolveThreeAsciiDeferredReadbackStaleness } from "./deferred_readback_staleness.ts";
import type { ThreeAsciiReadbackStrategy } from "./renderer_options.ts";

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
