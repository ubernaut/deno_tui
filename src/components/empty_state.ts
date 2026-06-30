// Copyright 2023 Im-Beast. MIT license.
import type { TextRectangle } from "../canvas/text.ts";
import { Component, type ComponentOptions } from "../component.ts";
import { Computed, Signal } from "../signals/mod.ts";
import { signalify } from "../utils/signals.ts";
import { Text } from "./text.ts";

/** Options for configuring empty State. */
export interface EmptyStateOptions extends ComponentOptions {
  title: string | Signal<string>;
  message?: string | Signal<string>;
  action?: string | Signal<string>;
  icon?: string | Signal<string>;
  center?: boolean | Signal<boolean>;
}

/** Public interface describing an empty State Content. */
export interface EmptyStateContent {
  title: string;
  message?: string;
  action?: string;
  icon?: string;
}

/** Renders empty State into deterministic text rows. */
export function renderEmptyState(
  content: EmptyStateContent,
  width: number,
  height: number,
  center = true,
): string[] {
  const lines = [
    content.icon ?? "",
    content.title,
    content.message ?? "",
    content.action ?? "",
  ].filter((line) => line.length > 0);
  const safeHeight = Math.max(0, Math.floor(height));
  const visible = lines.slice(0, safeHeight).map((line) => fitEmptyStateLine(line, width));
  if (!center || visible.length >= safeHeight) return visible;

  const topPadding = Math.floor((safeHeight - visible.length) / 2);
  return [
    ...Array.from({ length: topPadding }, () => ""),
    ...visible,
  ].slice(0, safeHeight);
}

function fitEmptyStateLine(line: string, width: number): string {
  const safeWidth = Math.max(0, Math.floor(width));
  if (line.length <= safeWidth) return line;
  if (safeWidth === 0) return "";
  if (safeWidth === 1) return "…";
  return `${line.slice(0, safeWidth - 1)}…`;
}

/** Public class implementing an empty State. */
export class EmptyState extends Component {
  readonly title: Signal<string>;
  readonly message: Signal<string>;
  readonly action: Signal<string>;
  readonly icon: Signal<string>;
  readonly center: Signal<boolean>;

  constructor(options: EmptyStateOptions) {
    super(options);
    this.title = signalify(options.title);
    this.message = signalify(options.message ?? "");
    this.action = signalify(options.action ?? "");
    this.icon = signalify(options.icon ?? "");
    this.center = signalify(options.center ?? true);
  }

  override draw(): void {
    super.draw();
    const rows = new Computed(() =>
      renderEmptyState(
        {
          title: this.title.value,
          message: this.message.value,
          action: this.action.value,
          icon: this.icon.value,
        },
        this.rectangle.value.width,
        this.rectangle.value.height,
        this.center.value,
      )
    );

    Array.from({ length: this.rectangle.peek().height }, (_, index) => {
      const row = new Text({
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
      row.subComponentOf = this;
      this.subComponents[`row-${index}`] = row;
      return row;
    });
  }
}
