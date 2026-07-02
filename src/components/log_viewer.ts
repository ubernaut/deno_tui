// Copyright 2023 Im-Beast. MIT license.
import { Component, type ComponentOptions } from "../component.ts";
import { Computed, Signal } from "../signals/mod.ts";
import { signalify } from "../utils/signals.ts";
import { drawTextRows } from "./text_rows.ts";

const DEFAULT_LOG_LINE_LIMIT = 500;

/** Options for configuring log Viewer. */
export interface LogViewerOptions extends ComponentOptions {
  lines: string[] | Signal<string[]>;
  follow?: boolean;
}

/** Options for configuring log Viewer Controller. */
export interface LogViewerControllerOptions {
  lines?: string[] | Signal<string[]>;
  limit?: number | Signal<number>;
  follow?: boolean | Signal<boolean>;
}

/** Serializable inspection snapshot for log Viewer. */
export interface LogViewerInspection {
  lines: string[];
  lineCount: number;
  visible: string[];
  limit: number;
  follow: boolean;
  empty: boolean;
}

/** Public helper for visible Log Lines. */
export function visibleLogLines(lines: readonly string[], height: number, follow = true): string[] {
  const safeHeight = Math.max(0, height);
  if (safeHeight === 0) return [];
  const start = follow ? Math.max(0, lines.length - safeHeight) : 0;
  const end = Math.min(lines.length, start + safeHeight);
  const visible = new Array<string>(Math.max(0, end - start));
  for (let index = 0; index < visible.length; index += 1) {
    visible[index] = lines[start + index] ?? "";
  }
  return visible;
}

/** State controller for log Viewer behavior. */
export class LogViewerController {
  readonly lines: Signal<string[]>;
  readonly limit: Signal<number>;
  readonly follow: Signal<boolean>;

  constructor(options: LogViewerControllerOptions = {}) {
    this.lines = signalify(options.lines ?? [], { deepObserve: true });
    this.limit = signalify(options.limit ?? DEFAULT_LOG_LINE_LIMIT);
    this.follow = signalify(options.follow ?? true);
    this.#trim();
  }

  append(line: string): void {
    this.lines.value.push(line);
    this.#trim();
  }

  appendMany(lines: readonly string[]): void {
    this.lines.value.push(...lines);
    this.#trim();
  }

  clear(): void {
    this.lines.value = [];
  }

  setLimit(limit: number): void {
    const normalizedLimit = normalizedLogLimit(limit);
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

  visible(height: number): string[] {
    return visibleLogLines(this.lines.peek(), height, this.follow.peek());
  }

  inspect(height = this.lines.peek().length): LogViewerInspection {
    const lines = this.lines.peek().map((line) => line);
    return {
      lines,
      lineCount: lines.length,
      visible: visibleLogLines(lines, height, this.follow.peek()),
      limit: normalizedLogLimit(this.limit.peek()),
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
    const limit = normalizedLogLimit(this.limit.peek());
    if (limit === 0) {
      this.lines.value = [];
    } else if (this.lines.value.length > limit) {
      this.lines.value = this.lines.peek().slice(-limit);
    }
  }
}

/** Public class implementing a log Viewer. */
export class LogViewer extends Component {
  constructor(private readonly options: LogViewerOptions) {
    super(options);
  }

  override draw(): void {
    super.draw();
    const visibleRows = new Computed(() => {
      const lines = Array.isArray(this.options.lines) ? this.options.lines : this.options.lines.value;
      return visibleLogLines(lines, this.rectangle.value.height, this.options.follow ?? true);
    });
    drawTextRows(this, visibleRows, { keyPrefix: "line" });
  }
}

function normalizedLogLimit(limit: number): number {
  return Math.max(0, Math.floor(Number.isFinite(limit) ? limit : DEFAULT_LOG_LINE_LIMIT));
}
