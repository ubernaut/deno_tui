// Copyright 2023 Im-Beast. MIT license.
import type { TextRectangle } from "../canvas/text.ts";
import { Component, type ComponentOptions } from "../component.ts";
import { Computed, Signal } from "../signals/mod.ts";
import { signalify } from "../utils/signals.ts";
import { Text } from "./text.ts";

/** Public interface describing a breadcrumb Item. */
export interface BreadcrumbItem {
  id: string;
  label: string;
}

/** Options for configuring breadcrumbs. */
export interface BreadcrumbsOptions extends ComponentOptions {
  items: BreadcrumbItem[] | Signal<BreadcrumbItem[]>;
  separator?: string | Signal<string>;
  maxWidth?: number | Signal<number>;
}

/** Renders breadcrumbs into deterministic text rows. */
export function renderBreadcrumbs(
  items: readonly BreadcrumbItem[],
  separator = "/",
  maxWidth = Number.POSITIVE_INFINITY,
): string {
  const safeWidth = Math.max(0, maxWidth);
  const full = items.map((item) => item.label).join(` ${separator} `);
  if (full.length <= safeWidth) return full;
  if (safeWidth <= 1) return "…".slice(0, safeWidth);

  const last = items.at(-1)?.label ?? "";
  const prefix = `… ${separator} `;
  if (prefix.length + last.length <= safeWidth) {
    return `${prefix}${last}`;
  }
  return `${prefix}${last}`.slice(0, safeWidth - 1) + "…";
}

/** Public class implementing a breadcrumbs. */
export class Breadcrumbs extends Component {
  items: Signal<BreadcrumbItem[]>;
  separator: Signal<string>;
  maxWidth: Signal<number | undefined>;

  constructor(options: BreadcrumbsOptions) {
    super(options);
    this.items = signalify(options.items, { deepObserve: true });
    this.separator = signalify(options.separator ?? "/");
    this.maxWidth = options.maxWidth instanceof Signal
      ? options.maxWidth as Signal<number | undefined>
      : signalify(options.maxWidth);
  }

  override draw(): void {
    super.draw();
    const text = new Text({
      parent: this,
      theme: this.theme,
      zIndex: this.zIndex,
      text: new Computed(() =>
        renderBreadcrumbs(
          this.items.value,
          this.separator.value,
          this.maxWidth.value ?? this.rectangle.value.width,
        )
      ),
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
