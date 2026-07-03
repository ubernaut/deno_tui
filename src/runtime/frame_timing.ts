// Copyright 2023 Im-Beast. MIT license.

/** Returns the next frame delay after accounting for time already spent rendering the current frame. */
export function nextFrameDelay(intervalMs: number, frameStartedAt: number, now: number): number {
  const interval = Math.max(0, intervalMs);
  const elapsed = Math.max(0, now - frameStartedAt);
  return Math.max(0, interval - elapsed);
}
