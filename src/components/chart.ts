// Copyright 2023 Im-Beast. MIT license.
import { Component, type ComponentOptions } from "../component.ts";
import type { TextRectangle } from "../canvas/text.ts";
import { Computed, type Signal } from "../signals/mod.ts";
import { Text } from "./text.ts";

export interface ChartOptions extends ComponentOptions {
  values: number[] | Signal<number[]>;
}

export function renderBarChart(values: readonly number[], width: number, height: number): string[] {
  const safeWidth = Math.max(0, width);
  const safeHeight = Math.max(0, height);
  const sampled = values.slice(-safeWidth);
  const max = Math.max(1, ...sampled);
  return Array.from({ length: safeHeight }, (_, row) => {
    const threshold = ((safeHeight - row) / Math.max(1, safeHeight)) * max;
    return sampled.map((value) => value >= threshold ? "█" : " ").join("").padStart(safeWidth, " ");
  });
}

export class Chart extends Component {
  constructor(private readonly options: ChartOptions) {
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
          const values = Array.isArray(this.options.values) ? this.options.values : this.options.values.value;
          return renderBarChart(values, this.rectangle.value.width, this.rectangle.value.height)[index] ?? "";
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
