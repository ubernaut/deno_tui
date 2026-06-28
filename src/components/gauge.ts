// Copyright 2023 Im-Beast. MIT license.
import type { TextRectangle } from "../canvas/text.ts";
import { Component, type ComponentOptions } from "../component.ts";
import { Computed, type Signal } from "../signals/mod.ts";
import { Text } from "./text.ts";

export interface GaugeOptions extends ComponentOptions {
  value: number | Signal<number>;
  min?: number;
  max?: number;
  label?: string;
}

export function renderGauge(value: number, width: number, min = 0, max = 1, label = ""): string {
  const safeWidth = Math.max(0, width);
  if (safeWidth === 0) return "";
  const prefix = label ? `${label} ` : "";
  const barWidth = Math.max(0, safeWidth - prefix.length - 2);
  const normalized = Math.max(0, Math.min(1, (value - min) / Math.max(0.000001, max - min)));
  const filled = Math.round(normalized * barWidth);
  return `${prefix}[${"█".repeat(filled)}${" ".repeat(Math.max(0, barWidth - filled))}]`.slice(0, safeWidth);
}

export class Gauge extends Component {
  constructor(private readonly options: GaugeOptions) {
    super(options);
  }

  override draw(): void {
    super.draw();
    const text = new Text({
      parent: this,
      theme: this.theme,
      zIndex: this.zIndex,
      text: new Computed(() => {
        const value = typeof this.options.value === "number" ? this.options.value : this.options.value.value;
        return renderGauge(value, this.rectangle.value.width, this.options.min, this.options.max, this.options.label);
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
