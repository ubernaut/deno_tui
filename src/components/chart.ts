// Copyright 2023 Im-Beast. MIT license.
import { Component, type ComponentOptions } from "../component.ts";
import type { TextRectangle } from "../canvas/text.ts";
import { Computed, type Signal } from "../signals/mod.ts";
import { Text } from "./text.ts";

/** Options for configuring chart. */
export interface ChartOptions extends ComponentOptions {
  values: number[] | Signal<number[]>;
}

/** Renders bar Chart into deterministic text rows. */
export function renderBarChart(values: readonly number[], width: number, height: number): string[] {
  const safeWidth = Math.max(0, width);
  const safeHeight = Math.max(0, height);
  const rows = new Array<string>(safeHeight);
  const sampleStart = Math.max(0, values.length - safeWidth);
  const sampleCount = Math.min(safeWidth, values.length);
  let max = 1;
  for (let index = 0; index < sampleCount; index++) {
    max = Math.max(max, values[sampleStart + index] ?? 0);
  }
  const leftPadding = safeWidth - sampleCount;

  for (let row = 0; row < safeHeight; row++) {
    const threshold = ((safeHeight - row) / Math.max(1, safeHeight)) * max;
    let line = leftPadding > 0 ? " ".repeat(leftPadding) : "";
    for (let index = 0; index < sampleCount; index++) {
      line += (values[sampleStart + index] ?? 0) >= threshold ? "█" : " ";
    }
    rows[row] = line;
  }

  return rows;
}

/** Public class implementing a chart. */
export class Chart extends Component {
  constructor(private readonly options: ChartOptions) {
    super(options);
  }

  override draw(): void {
    super.draw();
    const rows = new Computed(() => {
      const values = Array.isArray(this.options.values) ? this.options.values : this.options.values.value;
      return renderBarChart(values, this.rectangle.value.width, this.rectangle.value.height);
    });

    const height = this.rectangle.peek().height;
    for (let index = 0; index < height; index++) {
      const line = new Text({
        parent: this,
        theme: this.theme,
        zIndex: this.zIndex,
        text: new Computed(() => rows.value[index] ?? ""),
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
    }
  }
}
