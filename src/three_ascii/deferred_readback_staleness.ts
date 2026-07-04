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
