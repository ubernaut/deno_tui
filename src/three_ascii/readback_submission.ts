import type { ThreeAsciiDeferredReadbackConsumeResult } from "./deferred_readback.ts";

export interface ThreeAsciiDeferredReadbackSubmission<TReadback> {
  readback?: TReadback;
  grid: string[][];
  submit: boolean;
  queue: boolean;
}

export function resolveThreeAsciiDeferredReadbackSubmission<TReadback>(
  completed: ThreeAsciiDeferredReadbackConsumeResult,
  readback: TReadback | undefined,
  lastCompletedGrid: string[][],
): ThreeAsciiDeferredReadbackSubmission<TReadback> {
  if (completed.readbackUnavailable) {
    return {
      grid: completed.grid ?? [],
      submit: false,
      queue: false,
    };
  }

  const grid = completed.grid ?? lastCompletedGrid;
  if (!readback) {
    return {
      grid,
      submit: false,
      queue: false,
    };
  }

  return {
    readback,
    grid,
    submit: true,
    queue: true,
  };
}
