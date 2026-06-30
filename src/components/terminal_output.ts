// Copyright 2023 Im-Beast. MIT license.
import { Signal } from "../signals/mod.ts";
import { signalify } from "../utils/signals.ts";

const DEFAULT_TERMINAL_OUTPUT_LIMIT = 1000;

/** Output stream classification for terminal-style process output. */
export type TerminalOutputSource = "stdout" | "stderr" | "system";

/** One terminal output line with stream metadata. */
export interface TerminalOutputLine {
  source: TerminalOutputSource;
  text: string;
  timestamp?: number;
}

/** Options for configuring Terminal Output Controller. */
export interface TerminalOutputControllerOptions {
  lines?: TerminalOutputLine[] | Signal<TerminalOutputLine[]>;
  limit?: number | Signal<number>;
  follow?: boolean | Signal<boolean>;
}

/** Serializable inspection snapshot for terminal Output Controller. */
export interface TerminalOutputInspection {
  lines: TerminalOutputLine[];
  lineCount: number;
  visible: TerminalOutputLine[];
  limit: number;
  follow: boolean;
  empty: boolean;
}

/** Formats an output line for plain text renderers and copy buffers. */
export function formatTerminalOutputLine(line: TerminalOutputLine, options: { sourcePrefix?: boolean } = {}): string {
  if (!options.sourcePrefix) return line.text;
  const prefix = line.source === "stderr" ? "err" : line.source === "system" ? "sys" : "out";
  return `[${prefix}] ${line.text}`;
}

/** Returns the terminal output rows visible in a viewport. */
export function visibleTerminalOutputLines(
  lines: readonly TerminalOutputLine[],
  height: number,
  follow = true,
): TerminalOutputLine[] {
  const safeHeight = Math.max(0, Math.floor(height));
  return (follow ? lines.slice(-safeHeight) : lines.slice(0, safeHeight)).map((line) => ({ ...line }));
}

/** State controller for terminal-style command output panes. */
export class TerminalOutputController {
  readonly lines: Signal<TerminalOutputLine[]>;
  readonly limit: Signal<number>;
  readonly follow: Signal<boolean>;

  constructor(options: TerminalOutputControllerOptions = {}) {
    this.lines = signalify(options.lines ?? [], { deepObserve: true });
    this.limit = signalify(options.limit ?? DEFAULT_TERMINAL_OUTPUT_LIMIT);
    this.follow = signalify(options.follow ?? true);
    this.#trim();
  }

  append(line: TerminalOutputLine): void {
    this.lines.value.push(normalizeTerminalOutputLine(line));
    this.#trim();
  }

  appendText(source: TerminalOutputSource, text: string, timestamp = Date.now()): void {
    this.append({ source, text, timestamp });
  }

  appendMany(lines: readonly TerminalOutputLine[]): void {
    this.lines.value.push(...lines.map(normalizeTerminalOutputLine));
    this.#trim();
  }

  clear(): void {
    this.lines.value = [];
  }

  setLimit(limit: number): void {
    const normalizedLimit = normalizedTerminalOutputLimit(limit);
    this.limit.value = normalizedLimit;
    this.lines.value = normalizedLimit === 0 ? [] : this.lines.peek().slice(-normalizedLimit);
  }

  setFollow(follow: boolean): void {
    this.follow.value = follow;
  }

  toggleFollow(): boolean {
    this.follow.value = !this.follow.peek();
    return this.follow.peek();
  }

  visible(height: number): TerminalOutputLine[] {
    return visibleTerminalOutputLines(this.lines.peek(), height, this.follow.peek());
  }

  inspect(height = this.lines.peek().length): TerminalOutputInspection {
    const lines = this.lines.peek().map((line) => ({ ...line }));
    return {
      lines,
      lineCount: lines.length,
      visible: visibleTerminalOutputLines(lines, height, this.follow.peek()),
      limit: normalizedTerminalOutputLimit(this.limit.peek()),
      follow: this.follow.peek(),
      empty: lines.length === 0,
    };
  }

  dispose(): void {
    this.lines.dispose();
    this.limit.dispose();
    this.follow.dispose();
  }

  #trim(): void {
    const limit = normalizedTerminalOutputLimit(this.limit.peek());
    if (limit === 0) {
      this.lines.value = [];
    } else if (this.lines.value.length > limit) {
      this.lines.value = this.lines.peek().slice(-limit);
    }
  }
}

function normalizeTerminalOutputLine(line: TerminalOutputLine): TerminalOutputLine {
  return {
    source: line.source,
    text: String(line.text),
    timestamp: line.timestamp,
  };
}

function normalizedTerminalOutputLimit(limit: number): number {
  return Math.max(0, Math.floor(Number.isFinite(limit) ? limit : DEFAULT_TERMINAL_OUTPUT_LIMIT));
}
