// Copyright 2023 Im-Beast. MIT license.
import { type Signal } from "../signals/mod.ts";
import { signalify } from "../utils/signals.ts";

export interface BoundedFollowLinesOptions<T> {
  lines?: T[] | Signal<T[]>;
  limit?: number | Signal<number>;
  follow?: boolean | Signal<boolean>;
}

export interface BoundedFollowLinesInspection<T> {
  lines: T[];
  lineCount: number;
  visible: T[];
  limit: number;
  follow: boolean;
  empty: boolean;
}

/** Internal owner for bounded line storage shared by output controllers. */
export abstract class BoundedFollowLinesController<T> {
  readonly lines: Signal<T[]>;
  readonly limit: Signal<number>;
  readonly follow: Signal<boolean>;

  constructor(
    options: BoundedFollowLinesOptions<T>,
    private readonly defaultLimit: number,
    private readonly transformLine?: (line: T) => T,
  ) {
    this.lines = signalify<T[]>(options.lines ?? [], { deepObserve: true });
    this.limit = signalify(options.limit ?? defaultLimit);
    this.follow = signalify(options.follow ?? true);
    this.#trim();
  }

  protected normalizeHeight(height: number): number {
    return Math.max(0, Math.floor(height));
  }

  protected abstract copyLines(lines: readonly T[], start: number, end: number): T[];

  append(line: T): void {
    this.lines.value.push(this.transformLine ? this.transformLine(line) : line);
    this.#trim();
  }

  appendMany(lines: readonly T[]): void {
    for (const line of lines) {
      this.lines.value.push(this.transformLine ? this.transformLine(line) : line);
    }
    this.#trim();
  }

  clear(): void {
    this.lines.value = [];
  }

  setLimit(limit: number): void {
    const normalizedLimit = this.#normalizeLimit(limit);
    this.limit.value = normalizedLimit;
    this.lines.value = this.#tailLines(this.lines.peek(), normalizedLimit);
  }

  setFollow(follow: boolean): void {
    this.follow.value = follow;
  }

  toggleFollow(): boolean {
    this.follow.value = !this.follow.peek();
    return this.follow.peek();
  }

  inspect(height: number = this.lines.peek().length): BoundedFollowLinesInspection<T> {
    const lines = this.copyLines(this.lines.peek(), 0, this.lines.peek().length);
    return {
      lines,
      lineCount: lines.length,
      visible: this.#visibleLines(lines, this.normalizeHeight(height), this.follow.peek()),
      limit: this.#normalizeLimit(this.limit.peek()),
      follow: this.follow.peek(),
      empty: lines.length === 0,
    };
  }

  dispose(): void {
    this.lines.dispose();
    this.limit.dispose();
    this.follow.dispose();
  }

  #normalizeLimit(limit: number): number {
    return Math.max(0, Math.floor(Number.isFinite(limit) ? limit : this.defaultLimit));
  }

  #visibleLines(lines: readonly T[], height: number, follow: boolean): T[] {
    if (height === 0) return [];
    const start = follow ? Math.max(0, lines.length - height) : 0;
    const end = Math.min(lines.length, start + height);
    return this.copyLines(lines, start, end);
  }

  #tailLines(lines: readonly T[], limit: number): T[] {
    if (limit === 0 || lines.length === 0) return [];
    const start = Math.max(0, lines.length - limit);
    return this.copyLines(lines, start, lines.length);
  }

  #trim(): void {
    const limit = this.#normalizeLimit(this.limit.peek());
    if (limit === 0) {
      this.lines.value = [];
    } else if (this.lines.peek().length > limit) {
      this.lines.value = this.#tailLines(this.lines.peek(), limit);
    }
  }
}
