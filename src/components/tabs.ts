// Copyright 2023 Im-Beast. MIT license.
import { Component, type ComponentOptions } from "../component.ts";
import { Computed, Signal } from "../signals/mod.ts";
import {
  ActiveItemController,
  activeItemForIndex,
  clampActiveItemIndex,
  cloneActiveItems,
  shiftActiveItemIndex,
  WRAPPED_ACTIVE_ITEM_INDEX_POLICY,
} from "./active_item.ts";
import { drawTextChild } from "./text_children.ts";

/** Public interface describing a tab Item. */
export interface TabItem {
  id: string;
  label: string;
  disabled?: boolean;
}

/** Options for configuring tabs. */
export interface TabsOptions extends ComponentOptions, TabsControllerOptions {
  controller?: TabsController;
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
  return clampActiveItemIndex(tabs, activeIndex, WRAPPED_ACTIVE_ITEM_INDEX_POLICY);
}

/** Moves tab Index by a relative offset. */
export function shiftTabIndex(tabs: readonly TabItem[], activeIndex: number, delta: number): number {
  return shiftActiveItemIndex(tabs, activeIndex, delta, WRAPPED_ACTIVE_ITEM_INDEX_POLICY);
}

/** Public helper for tab For Index. */
export function tabForIndex(tabs: readonly TabItem[], activeIndex: number): TabItem | undefined {
  return activeItemForIndex(tabs, activeIndex, WRAPPED_ACTIVE_ITEM_INDEX_POLICY);
}

/** State controller for tabs behavior. */
export class TabsController extends ActiveItemController<TabItem> {
  readonly tabs: Signal<TabItem[]>;

  constructor(options: TabsControllerOptions) {
    super({
      items: options.tabs,
      activeIndex: options.activeIndex,
      policy: WRAPPED_ACTIVE_ITEM_INDEX_POLICY,
      onChange: options.onChange,
    });
    this.tabs = this.activeItems;
  }

  inspect(): TabsInspection {
    const tabs = cloneActiveItems(this.tabs.peek());
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

    drawTextChild(this, new Computed(() => renderTabs(this.tabs.value, this.activeIndex.value)), {
      key: "tabs",
    });
  }
}
