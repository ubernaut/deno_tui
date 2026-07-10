// Copyright 2023 Im-Beast. MIT license.
import { Component, type ComponentOptions } from "../component.ts";
import { Computed, Signal } from "../signals/mod.ts";
import {
  BoundedFollowLinesController,
  type BoundedFollowLinesInspection,
  type BoundedFollowLinesOptions,
} from "./bounded_follow_lines.ts";
import { drawTextRows } from "./text_children.ts";

const DEFAULT_LOG_LINE_LIMIT = 500;

/** Options for configuring log Viewer. */
export interface LogViewerOptions extends ComponentOptions {
  lines: string[] | Signal<string[]>;
  follow?: boolean;
}

/** Options for configuring log Viewer Controller. */
export interface LogViewerControllerOptions extends BoundedFollowLinesOptions<string> {}

/** Serializable inspection snapshot for log Viewer. */
export interface LogViewerInspection extends BoundedFollowLinesInspection<string> {}

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
export class LogViewerController extends BoundedFollowLinesController<string> {
  constructor(options: LogViewerControllerOptions = {}) {
    super(options, DEFAULT_LOG_LINE_LIMIT);
  }

  protected override normalizeHeight(height: number): number {
    return Math.max(0, height);
  }

  protected override copyLines(lines: readonly string[], start: number, end: number): string[] {
    return copyLogLines(lines, start, end);
  }

  visible(height: number): string[] {
    return visibleLogLines(this.lines.peek(), height, this.follow.peek());
  }
}

/** Public class implementing a log Viewer. */
export class LogViewer extends Component {
  readonly #visibleRows: Computed<string[]>;

  constructor(private readonly options: LogViewerOptions) {
    super(options);
    this.#visibleRows = new Computed(() => {
      const lines = Array.isArray(this.options.lines) ? this.options.lines : this.options.lines.value;
      return visibleLogLines(lines, this.rectangle.value.height, this.options.follow ?? true);
    });
    this.on("destroy", () => this.#visibleRows.dispose());
  }

  override draw(): void {
    super.draw();
    drawTextRows(this, this.#visibleRows, { keyPrefix: "line" });
  }
}

function copyLogLines(lines: readonly string[], start: number, end: number): string[] {
  const output = new Array<string>(Math.max(0, end - start));
  for (let index = 0; index < output.length; index += 1) {
    output[index] = lines[start + index] ?? "";
  }
  return output;
}
