// Copyright 2023 Im-Beast. MIT license.
import { Component, type ComponentOptions } from "../component.ts";
import type { TextRectangle } from "../canvas/text.ts";
import { Computed, type Signal } from "../signals/mod.ts";
import { Text } from "./text.ts";

export interface LogViewerOptions extends ComponentOptions {
  lines: string[] | Signal<string[]>;
  follow?: boolean;
}

export function visibleLogLines(lines: readonly string[], height: number, follow = true): string[] {
  const safeHeight = Math.max(0, height);
  return (follow ? lines.slice(-safeHeight) : lines.slice(0, safeHeight)).map((line) => line);
}

export class LogViewer extends Component {
  constructor(private readonly options: LogViewerOptions) {
    super(options);
  }

  override draw(): void {
    super.draw();
    Array.from({ length: this.rectangle.peek().height }, (_, index) => {
      const line = new Text({
        parent: this,
        theme: this.theme,
        zIndex: this.zIndex,
        text: new Computed(() => {
          const lines = Array.isArray(this.options.lines) ? this.options.lines : this.options.lines.value;
          return visibleLogLines(lines, this.rectangle.value.height, this.options.follow ?? true)[index] ?? "";
        }),
        overwriteWidth: true,
        rectangle: new Computed<TextRectangle>(() => ({
          column: this.rectangle.value.column,
          row: this.rectangle.value.row + index,
          width: this.rectangle.value.width,
        })),
        visible: this.visible,
      });
      line.subComponentOf = this;
      this.subComponents[`line-${index}`] = line;
    });
  }
}
