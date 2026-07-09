// Copyright 2023 Im-Beast. MIT license.
import { Component, type ComponentOptions } from "../component.ts";
import { Computed, type Signal } from "../signals/mod.ts";
import { drawTextChild } from "./text_children.ts";

/** Options for configuring gauge. */
export interface GaugeOptions extends ComponentOptions {
  value: number | Signal<number>;
  min?: number;
  max?: number;
  label?: string;
}

/** Renders gauge into deterministic text rows. */
export function renderGauge(value: number, width: number, min = 0, max = 1, label = ""): string {
  const safeWidth = Math.max(0, width);
  if (safeWidth === 0) return "";
  const prefix = label ? `${label} ` : "";
  const barWidth = Math.max(0, safeWidth - prefix.length - 2);
  const normalized = Math.max(0, Math.min(1, (value - min) / Math.max(0.000001, max - min)));
  const filled = Math.round(normalized * barWidth);
  return `${prefix}[${"█".repeat(filled)}${" ".repeat(Math.max(0, barWidth - filled))}]`.slice(0, safeWidth);
}

/** Public class implementing a gauge. */
export class Gauge extends Component {
  constructor(private readonly options: GaugeOptions) {
    super(options);
  }

  override draw(): void {
    super.draw();
    drawTextChild(
      this,
      new Computed(() => {
        const value = typeof this.options.value === "number" ? this.options.value : this.options.value.value;
        return renderGauge(value, this.rectangle.value.width, this.options.min, this.options.max, this.options.label);
      }),
    );
  }
}
