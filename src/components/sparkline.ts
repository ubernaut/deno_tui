// Copyright 2023 Im-Beast. MIT license.
import type { TextRectangle } from "../canvas/text.ts";
import { Component, type ComponentOptions } from "../component.ts";
import { Computed, type Signal } from "../signals/mod.ts";
import { Text } from "./text.ts";

const SPARKLINE_GLYPHS = ["▁", "▂", "▃", "▄", "▅", "▆", "▇", "█"] as const;

export interface SparklineOptions extends ComponentOptions {
  values: number[] | Signal<number[]>;
}

export function renderSparkline(values: readonly number[], width: number): string {
  const safeWidth = Math.max(0, width);
  if (safeWidth === 0) return "";
  if (values.length === 0) return " ".repeat(safeWidth);
  const sampled = sampleSeries(values, safeWidth);
  const min = Math.min(...sampled);
  const max = Math.max(...sampled);
  const span = Math.max(0.000001, max - min);
  return sampled.map((value) => {
    const index = Math.max(0, Math.min(SPARKLINE_GLYPHS.length - 1, Math.round(((value - min) / span) * 7)));
    return SPARKLINE_GLYPHS[index];
  }).join("");
}

function sampleSeries(values: readonly number[], width: number): number[] {
  if (values.length <= width) {
    return [...values, ...Array.from({ length: width - values.length }, () => values.at(-1) ?? 0)];
  }
  return Array.from({ length: width }, (_, index) => {
    const sourceIndex = Math.floor((index / Math.max(1, width - 1)) * (values.length - 1));
    return values[sourceIndex] ?? 0;
  });
}

export class Sparkline extends Component {
  constructor(private readonly options: SparklineOptions) {
    super(options);
  }

  override draw(): void {
    super.draw();
    const text = new Text({
      parent: this,
      theme: this.theme,
      zIndex: this.zIndex,
      text: new Computed(() => {
        const values = Array.isArray(this.options.values) ? this.options.values : this.options.values.value;
        return renderSparkline(values, this.rectangle.value.width);
      }),
      overwriteWidth: true,
      rectangle: new Computed<TextRectangle>(() => ({
        column: this.rectangle.value.column,
        row: this.rectangle.value.row,
        width: this.rectangle.value.width,
      })),
      visible: this.visible,
    });
    text.subComponentOf = this;
    this.subComponents.text = text;
  }
}
