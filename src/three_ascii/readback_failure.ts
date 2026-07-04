import type { ThreeAsciiDeferredReadbackConsumeResult } from "./deferred_readback.ts";

export interface ThreeAsciiDeferredReadbackFailureQueue {
  lastCompletedGrid(): string[][];
  destroy(): void;
}

export interface ThreeAsciiDeferredReadbackFailureResult {
  handled: boolean;
  result?: ThreeAsciiDeferredReadbackConsumeResult;
}

export function handleThreeAsciiDeferredReadbackFailure(
  error: unknown,
  expectedError: new (...args: unknown[]) => Error,
  queue: ThreeAsciiDeferredReadbackFailureQueue,
): ThreeAsciiDeferredReadbackFailureResult {
  if (!(error instanceof expectedError)) {
    return { handled: false };
  }

  const grid = queue.lastCompletedGrid();
  queue.destroy();
  return { handled: true, result: { grid, readbackUnavailable: true } };
}
