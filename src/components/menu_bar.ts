// Copyright 2023 Im-Beast. MIT license.
import { Component, type ComponentOptions } from "../component.ts";
import { Computed, Signal } from "../signals/mod.ts";
import {
  ActiveItemController,
  activeItemForIndex,
  type ActiveItemIndexPolicy,
  clampActiveItemIndex,
  cloneActiveItems,
  shiftActiveItemIndex,
} from "./active_item.ts";
import { drawTextChild } from "./text_children.ts";

const MENU_ACTIVE_ITEM_INDEX_POLICY: ActiveItemIndexPolicy = { emptyIndex: -1, wrap: true, clampStart: false };

/** Public interface describing a menu Bar Item. */
export interface MenuBarItem {
  id: string;
  label: string;
  disabled?: boolean;
}

/** Options for configuring menu Bar. */
export interface MenuBarOptions extends ComponentOptions, MenuBarControllerOptions {
  controller?: MenuBarController;
}

/** Options for configuring menu Bar Controller. */
export interface MenuBarControllerOptions {
  items: MenuBarItem[] | Signal<MenuBarItem[]>;
  activeIndex?: number | Signal<number>;
  onChange?: (item: MenuBarItem, index: number) => void | Promise<void>;
  onSelect?: (item: MenuBarItem, index: number) => void | Promise<void>;
}

/** Serializable inspection snapshot for menu Bar. */
export interface MenuBarInspection {
  items: MenuBarItem[];
  itemCount: number;
  activeIndex: number;
  active?: MenuBarItem;
  empty: boolean;
}

/** Renders menu Bar into deterministic text rows. */
export function renderMenuBar(items: readonly MenuBarItem[], activeIndex: number): string {
  let output = "";
  for (let index = 0; index < items.length; index += 1) {
    const item = items[index]!;
    const label = item.disabled ? `(${item.label})` : item.label;
    if (output) output += " ";
    output += index === activeIndex ? `[${label}]` : label;
  }
  return output;
}

/** Moves menu Index by a relative offset. */
export function shiftMenuIndex(items: readonly MenuBarItem[], activeIndex: number, delta: number): number {
  return shiftActiveItemIndex(items, activeIndex, delta, MENU_ACTIVE_ITEM_INDEX_POLICY);
}

/** Clamps menu Index to its valid range. */
export function clampMenuIndex(items: readonly MenuBarItem[], activeIndex: number): number {
  return clampActiveItemIndex(items, activeIndex, MENU_ACTIVE_ITEM_INDEX_POLICY);
}

/** Public helper for menu Item For Index. */
export function menuItemForIndex(items: readonly MenuBarItem[], activeIndex: number): MenuBarItem | undefined {
  return activeItemForIndex(items, activeIndex, MENU_ACTIVE_ITEM_INDEX_POLICY);
}

/** State controller for menu Bar behavior. */
export class MenuBarController extends ActiveItemController<MenuBarItem> {
  readonly items: Signal<MenuBarItem[]>;
  readonly #onSelect?: (item: MenuBarItem, index: number) => void | Promise<void>;

  constructor(options: MenuBarControllerOptions) {
    super({
      items: options.items,
      activeIndex: options.activeIndex,
      policy: MENU_ACTIVE_ITEM_INDEX_POLICY,
      onChange: options.onChange,
    });
    this.items = this.activeItems;
    this.#onSelect = options.onSelect;
  }

  selectActive(): MenuBarItem | undefined {
    const index = this.clampIndex(this.activeIndex.peek());
    const item = this.items.peek()[index];
    if (item && !item.disabled) {
      void this.#onSelect?.(item, index);
      return item;
    }
    return undefined;
  }

  inspect(): MenuBarInspection {
    const items = cloneActiveItems(this.items.peek());
    const activeIndex = clampMenuIndex(items, this.activeIndex.peek());
    const active = menuItemForIndex(items, activeIndex);
    return {
      items,
      itemCount: items.length,
      activeIndex,
      active: active ? { ...active } : undefined,
      empty: items.length === 0,
    };
  }

  protected override selectsOnKeyPress(): boolean {
    return true;
  }

  protected override selectActiveFromKey(): void {
    this.selectActive();
  }
}

/** Public class implementing a menu Bar. */
export class MenuBar extends Component {
  items: Signal<MenuBarItem[]>;
  activeIndex: Signal<number>;
  readonly controller: MenuBarController;

  constructor(options: MenuBarOptions) {
    super(options);
    const ownsController = !options.controller;
    this.controller = options.controller ??
      new MenuBarController({
        items: options.items,
        activeIndex: options.activeIndex,
        onChange: options.onChange,
        onSelect: options.onSelect,
      });
    this.items = this.controller.items;
    this.activeIndex = this.controller.activeIndex;

    this.on("keyPress", (event) => this.controller.handleKeyPress(event));
    if (ownsController) this.on("destroy", () => this.controller.dispose());
  }

  active(): MenuBarItem | undefined {
    return this.controller.active();
  }

  move(delta: number): MenuBarItem | undefined {
    return this.controller.move(delta);
  }

  selectActive(): MenuBarItem | undefined {
    return this.controller.selectActive();
  }

  override draw(): void {
    super.draw();
    drawTextChild(this, new Computed(() => renderMenuBar(this.items.value, this.activeIndex.value)));
  }
}
