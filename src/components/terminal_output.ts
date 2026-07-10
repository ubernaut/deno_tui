// Copyright 2023 Im-Beast. MIT license.
import {
  BoundedFollowLinesController,
  type BoundedFollowLinesInspection,
  type BoundedFollowLinesOptions,
} from "./bounded_follow_lines.ts";

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
export interface TerminalOutputControllerOptions extends BoundedFollowLinesOptions<TerminalOutputLine> {}

/** Serializable inspection snapshot for terminal Output Controller. */
export interface TerminalOutputInspection extends BoundedFollowLinesInspection<TerminalOutputLine> {}

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
  if (safeHeight === 0) return [];
  const start = follow ? Math.max(0, lines.length - safeHeight) : 0;
  const end = Math.min(lines.length, start + safeHeight);
  const visible = new Array<TerminalOutputLine>(Math.max(0, end - start));
  for (let index = 0; index < visible.length; index += 1) {
    visible[index] = { ...lines[start + index]! };
  }
  return visible;
}

/** State controller for terminal-style command output panes. */
export class TerminalOutputController extends BoundedFollowLinesController<TerminalOutputLine> {
  constructor(options: TerminalOutputControllerOptions = {}) {
    super(options, DEFAULT_TERMINAL_OUTPUT_LIMIT, normalizeTerminalOutputLine);
  }

  protected override copyLines(
    lines: readonly TerminalOutputLine[],
    start: number,
    end: number,
  ): TerminalOutputLine[] {
    return copyTerminalOutputLines(lines, start, end);
  }

  appendText(source: TerminalOutputSource, text: string, timestamp = Date.now()): void {
    this.append({ source, text, timestamp });
  }

  visible(height: number): TerminalOutputLine[] {
    return visibleTerminalOutputLines(this.lines.peek(), height, this.follow.peek());
  }
}

function normalizeTerminalOutputLine(line: TerminalOutputLine): TerminalOutputLine {
  return {
    source: line.source,
    text: String(line.text),
    timestamp: line.timestamp,
  };
}

function copyTerminalOutputLines(
  lines: readonly TerminalOutputLine[],
  start: number,
  end: number,
): TerminalOutputLine[] {
  const output = new Array<TerminalOutputLine>(Math.max(0, end - start));
  for (let index = 0; index < output.length; index += 1) {
    output[index] = normalizeTerminalOutputLine(lines[start + index]!);
  }
  return output;
}
