// Copyright 2023 Im-Beast. MIT license.
import { Component, type ComponentOptions } from "../component.ts";
import type { TextRectangle } from "../canvas/text.ts";
import { Computed, Signal } from "../signals/mod.ts";
import { signalify } from "../utils/signals.ts";
import { clamp } from "../utils/numbers.ts";
import { Text } from "./text.ts";

/** Public interface describing a tab Item. */
export interface TabItem {
  id: string;
  label: string;
  disabled?: boolean;
}

/** Options for configuring tabs. */
export interface TabsOptions extends ComponentOptions {
  tabs: TabItem[] | Signal<TabItem[]>;
  activeIndex?: number | Signal<number>;
  controller?: TabsController;
  onChange?: (tab: TabItem, index: number) => void | Promise<void>;
}

/** Options for configuring tabs Controller. */
export interface TabsControllerOptions {
  tabs: TabItem[] | Signal<TabItem[]>;
  activeIndex?: number | Signal<number>;
  onChange?: (tab: TabItem, index: number) => void | Promise<void>;
}

/** Serializable inspection snapshot for tabs. */
export interface TabsInspection {
  tabs: TabItem[];
  tabCount: number;
  activeIndex: number;
  active?: TabItem;
  empty: boolean;
}

/** Renders tabs into deterministic text rows. */
export function renderTabs(tabs: readonly TabItem[], activeIndex: number): string {
  const active = clampTabIndex(tabs, activeIndex);
  let output = "";
  for (let index = 0; index < tabs.length; index += 1) {
    const tab = tabs[index]!;
    const label = tab.disabled ? `(${tab.label})` : tab.label;
    if (output) output += " ";
    output += index === active ? `[${label}]` : ` ${label} `;
  }
  return output;
}

/** Clamps tab Index to its valid range. */
export function clampTabIndex(tabs: readonly TabItem[], activeIndex: number): number {
  if (tabs.length === 0) return -1;
  const clamped = clamp(activeIndex, 0, tabs.length - 1);
  if (!tabs[clamped]?.disabled) return clamped;
  const next = shiftTabIndex(tabs, clamped, 1);
  if (!tabs[next]?.disabled) return next;
  const previous = shiftTabIndex(tabs, clamped, -1);
  return tabs[previous]?.disabled ? clamped : previous;
}

/** Moves tab Index by a relative offset. */
export function shiftTabIndex(tabs: readonly TabItem[], activeIndex: number, delta: number): number {
  if (tabs.length === 0) return -1;
  let next = clamp(activeIndex, 0, tabs.length - 1);
  for (let count = 0; count < tabs.length; count += 1) {
    next = (next + delta + tabs.length) % tabs.length;
    if (!tabs[next]?.disabled) return next;
  }
  return activeIndex;
}

/** Public helper for tab For Index. */
export function tabForIndex(tabs: readonly TabItem[], activeIndex: number): TabItem | undefined {
  const tab = tabs[clampTabIndex(tabs, activeIndex)];
  return tab?.disabled ? undefined : tab;
}

/** State controller for tabs behavior. */
export class TabsController {
  readonly tabs: Signal<TabItem[]>;
  readonly activeIndex: Signal<number>;
  readonly #ownsTabs: boolean;
  readonly #ownsActiveIndex: boolean;
  readonly #onChange?: (tab: TabItem, index: number) => void | Promise<void>;

  constructor(options: TabsControllerOptions) {
    this.#ownsTabs = !(options.tabs instanceof Signal);
    this.#ownsActiveIndex = !(options.activeIndex instanceof Signal);
    this.tabs = signalify(options.tabs, { deepObserve: true });
    this.activeIndex = signalify(options.activeIndex ?? 0);
    this.#onChange = options.onChange;
    this.activeIndex.value = clampTabIndex(this.tabs.peek(), this.activeIndex.peek());
  }

  active(): TabItem | undefined {
    return tabForIndex(this.tabs.peek(), this.activeIndex.peek());
  }

  move(delta: number): TabItem | undefined {
    return this.setActive(shiftTabIndex(this.tabs.peek(), this.activeIndex.peek(), delta));
  }

  first(): TabItem | undefined {
    return this.setActive(0);
  }

  last(): TabItem | undefined {
    return this.setActive(this.tabs.peek().length - 1);
  }

  setActive(index: number): TabItem | undefined {
    const next = clampTabIndex(this.tabs.peek(), index);
    this.activeIndex.value = next;
    const tab = this.tabs.peek()[next];
    if (tab && !tab.disabled) {
      void this.#onChange?.(tab, next);
      return tab;
    }
    return undefined;
  }

  handleKeyPress({ key, ctrl, meta, shift }: { key: string; ctrl?: boolean; meta?: boolean; shift?: boolean }): void {
    if (ctrl || meta || shift) return;
    if (key === "left") {
      this.move(-1);
    } else if (key === "right") {
      this.move(1);
    } else if (key === "home") {
      this.first();
    } else if (key === "end") {
      this.last();
    }
  }

  inspect(): TabsInspection {
    const tabs = cloneTabs(this.tabs.peek());
    const activeIndex = clampTabIndex(tabs, this.activeIndex.peek());
    const active = tabForIndex(tabs, activeIndex);
    return {
      tabs,
      tabCount: tabs.length,
      activeIndex,
      active: active ? { ...active } : undefined,
      empty: tabs.length === 0,
    };
  }

  dispose(): void {
    if (this.#ownsTabs) this.tabs.dispose();
    if (this.#ownsActiveIndex) this.activeIndex.dispose();
  }
}

function cloneTabs(tabs: readonly TabItem[]): TabItem[] {
  const clone = new Array<TabItem>(tabs.length);
  for (let index = 0; index < tabs.length; index += 1) {
    clone[index] = { ...tabs[index]! };
  }
  return clone;
}

/** Public class implementing a tabs. */
export class Tabs extends Component {
  tabs: Signal<TabItem[]>;
  activeIndex: Signal<number>;
  readonly controller: TabsController;

  constructor(options: TabsOptions) {
    super(options);
    const ownsController = !options.controller;
    this.controller = options.controller ??
      new TabsController({
        tabs: options.tabs,
        activeIndex: options.activeIndex,
        onChange: options.onChange,
      });
    this.tabs = this.controller.tabs;
    this.activeIndex = this.controller.activeIndex;

    this.on("keyPress", (event) => this.controller.handleKeyPress(event));
    if (ownsController) this.on("destroy", () => this.controller.dispose());
  }

  active(): TabItem | undefined {
    return this.controller.active();
  }

  move(delta: number): TabItem | undefined {
    return this.controller.move(delta);
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
