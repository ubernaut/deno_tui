// Copyright 2023 Im-Beast. MIT license.
import { Component, type ComponentOptions } from "../component.ts";
import type { TextRectangle } from "../canvas/text.ts";
import { Computed, Signal } from "../signals/mod.ts";
import { signalify } from "../utils/signals.ts";
import { clamp } from "../utils/numbers.ts";
import { Text } from "./text.ts";

export interface TabItem {
  id: string;
  label: string;
}

export interface TabsOptions extends ComponentOptions {
  tabs: TabItem[] | Signal<TabItem[]>;
  activeIndex?: number | Signal<number>;
}

export function renderTabs(tabs: readonly TabItem[], activeIndex: number): string {
  const active = clamp(activeIndex, 0, Math.max(0, tabs.length - 1));
  return tabs.map((tab, index) => index === active ? `[${tab.label}]` : ` ${tab.label} `).join(" ");
}

export class Tabs extends Component {
  tabs: Signal<TabItem[]>;
  activeIndex: Signal<number>;

  constructor(options: TabsOptions) {
    super(options);
    this.tabs = signalify(options.tabs, { deepObserve: true });
    this.activeIndex = signalify(options.activeIndex ?? 0);
  }

  override draw(): void {
    super.draw();

    const text = new Text({
      parent: this,
      theme: this.theme,
      zIndex: this.zIndex,
      text: new Computed(() => renderTabs(this.tabs.value, this.activeIndex.value)),
      overwriteWidth: true,
      rectangle: new Computed<TextRectangle>(() => ({
        column: this.rectangle.value.column,
        row: this.rectangle.value.row,
        width: this.rectangle.value.width,
      })),
      visible: this.visible,
    });
    text.subComponentOf = this;
    this.subComponents.tabs = text;
  }
}
