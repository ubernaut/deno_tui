// Copyright 2023 Im-Beast. MIT license.
import type { TextRectangle } from "../canvas/text.ts";
import { Component, type ComponentOptions } from "../component.ts";
import { Computed, Signal } from "../signals/mod.ts";
import { signalify } from "../utils/signals.ts";
import { Text } from "./text.ts";

/** Public interface describing a menu Bar Item. */
export interface MenuBarItem {
  id: string;
  label: string;
  disabled?: boolean;
}

/** Options for configuring menu Bar. */
export interface MenuBarOptions extends ComponentOptions {
  items: MenuBarItem[] | Signal<MenuBarItem[]>;
  activeIndex?: number | Signal<number>;
  controller?: MenuBarController;
  onChange?: (item: MenuBarItem, index: number) => void | Promise<void>;
  onSelect?: (item: MenuBarItem, index: number) => void | Promise<void>;
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
  return items.map((item, index) => {
    const label = item.disabled ? `(${item.label})` : item.label;
    return index === activeIndex ? `[${label}]` : label;
  }).join(" ");
}

/** Moves menu Index by a relative offset. */
export function shiftMenuIndex(items: readonly MenuBarItem[], activeIndex: number, delta: number): number {
  if (items.length === 0) return -1;
  let next = activeIndex;
  for (let count = 0; count < items.length; count += 1) {
    next = (next + delta + items.length) % items.length;
    if (!items[next]?.disabled) return next;
  }
  return activeIndex;
}

/** Clamps menu Index to its valid range. */
export function clampMenuIndex(items: readonly MenuBarItem[], activeIndex: number): number {
  if (items.length === 0) return -1;
  const clamped = Math.max(0, Math.min(activeIndex, items.length - 1));
  if (!items[clamped]?.disabled) return clamped;
  const next = shiftMenuIndex(items, clamped, 1);
  if (!items[next]?.disabled) return next;
  const previous = shiftMenuIndex(items, clamped, -1);
  return items[previous]?.disabled ? clamped : previous;
}

/** Public helper for menu Item For Index. */
export function menuItemForIndex(items: readonly MenuBarItem[], activeIndex: number): MenuBarItem | undefined {
  const item = items[clampMenuIndex(items, activeIndex)];
  return item?.disabled ? undefined : item;
}

/** State controller for menu Bar behavior. */
export class MenuBarController {
  readonly items: Signal<MenuBarItem[]>;
  readonly activeIndex: Signal<number>;
  readonly #ownsItems: boolean;
  readonly #ownsActiveIndex: boolean;
  readonly #onChange?: (item: MenuBarItem, index: number) => void | Promise<void>;
  readonly #onSelect?: (item: MenuBarItem, index: number) => void | Promise<void>;

  constructor(options: MenuBarControllerOptions) {
    this.#ownsItems = !(options.items instanceof Signal);
    this.#ownsActiveIndex = !(options.activeIndex instanceof Signal);
    this.items = signalify(options.items, { deepObserve: true });
    this.activeIndex = signalify(options.activeIndex ?? 0);
    this.#onChange = options.onChange;
    this.#onSelect = options.onSelect;
    this.activeIndex.value = clampMenuIndex(this.items.peek(), this.activeIndex.peek());
  }

  active(): MenuBarItem | undefined {
    return menuItemForIndex(this.items.peek(), this.activeIndex.peek());
  }

  move(delta: number): MenuBarItem | undefined {
    return this.setActive(shiftMenuIndex(this.items.peek(), this.activeIndex.peek(), delta));
  }

  first(): MenuBarItem | undefined {
    return this.setActive(0);
  }

  last(): MenuBarItem | undefined {
    return this.setActive(this.items.peek().length - 1);
  }

  setActive(index: number): MenuBarItem | undefined {
    const next = clampMenuIndex(this.items.peek(), index);
    this.activeIndex.value = next;
    const item = this.items.peek()[next];
    if (item && !item.disabled) {
      void this.#onChange?.(item, next);
      return item;
    }
    return undefined;
  }

  selectActive(): MenuBarItem | undefined {
    const index = clampMenuIndex(this.items.peek(), this.activeIndex.peek());
    const item = this.items.peek()[index];
    if (item && !item.disabled) {
      void this.#onSelect?.(item, index);
      return item;
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
    } else if (key === "return" || key === "space") {
      this.selectActive();
    }
  }

  inspect(): MenuBarInspection {
    const items = this.items.peek().map((item) => ({ ...item }));
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

  dispose(): void {
    if (this.#ownsItems) this.items.dispose();
    if (this.#ownsActiveIndex) this.activeIndex.dispose();
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
    const text = new Text({
      parent: this,
      theme: this.theme,
      zIndex: this.zIndex,
      text: new Computed(() => renderMenuBar(this.items.value, this.activeIndex.value)),
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
