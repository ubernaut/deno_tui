// Copyright 2023 Im-Beast. MIT license.

/** Maximum retained tail for a stream that never terminates its current line. */
export const MAX_PENDING_OUTPUT_LINE_LENGTH = 64 * 1024;

/**
 * Incrementally separates output lines without repeatedly scanning an
 * unterminated prefix. Full-screen terminal streams commonly contain megabytes
 * of cursor controls and no line feeds, so the retained diagnostic tail is
 * deliberately bounded while the raw output path remains lossless.
 */
export class BoundedOutputLineBuffer {
  readonly #maximumPendingLength: number;
  #pending = "";
  #truncated = false;

  constructor(maximumPendingLength = MAX_PENDING_OUTPUT_LINE_LENGTH) {
    this.#maximumPendingLength = Math.max(0, Math.floor(maximumPendingLength));
  }

  get pendingLength(): number {
    return this.#pending.length;
  }

  get truncated(): boolean {
    return this.#truncated;
  }

  /** Appends one decoded chunk and returns whether truncation began now. */
  append(chunk: string, emit: (line: string) => void): boolean {
    let start = 0;
    let newline = chunk.indexOf("\n", start);
    while (newline >= 0) {
      const suffix = chunk.slice(start, newline);
      const line = this.#pending + suffix;
      emit(line.endsWith("\r") ? line.slice(0, -1) : line);
      this.#pending = "";
      start = newline + 1;
      newline = chunk.indexOf("\n", start);
    }

    const beganTruncating = this.#appendPending(chunk.slice(start));
    return beganTruncating;
  }

  /** Emits and clears the retained unterminated tail. */
  finish(emit: (line: string) => void): void {
    if (this.#pending) emit(this.#pending);
    this.#pending = "";
  }

  #appendPending(suffix: string): boolean {
    if (!suffix) return false;
    const totalLength = this.#pending.length + suffix.length;
    if (totalLength <= this.#maximumPendingLength) {
      this.#pending += suffix;
      return false;
    }

    const beganTruncating = !this.#truncated;
    this.#truncated = true;
    if (this.#maximumPendingLength === 0) {
      this.#pending = "";
    } else if (suffix.length >= this.#maximumPendingLength) {
      this.#pending = suffix.slice(-this.#maximumPendingLength);
    } else {
      const retainedPrefix = this.#maximumPendingLength - suffix.length;
      this.#pending = this.#pending.slice(-retainedPrefix) + suffix;
    }
    return beganTruncating;
  }
}
