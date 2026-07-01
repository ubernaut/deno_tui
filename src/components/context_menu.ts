// Copyright 2023 Im-Beast. MIT license.
import type { TextRectangle } from "../canvas/text.ts";
import { Component, type ComponentOptions } from "../component.ts";
import type { KeyPressEvent } from "../input_reader/types.ts";
import { Computed, Signal } from "../signals/mod.ts";
import { signalify } from "../utils/signals.ts";
import { Text } from "./text.ts";

/** Public interface describing a context Menu Item. */
export interface ContextMenuItem {
  id: string;
  label: string;
  disabled?: boolean;
  separatorBefore?: boolean;
}

/** Options for configuring context Menu. */
export interface ContextMenuOptions extends ComponentOptions {
  items: ContextMenuItem[] | Signal<ContextMenuItem[]>;
  selectedIndex?: number | Signal<number>;
  controller?: ContextMenuController;
  onSelect?: (item: ContextMenuItem) => void | Promise<void>;
}

/** Options for configuring context Menu Controller. */
export interface ContextMenuControllerOptions {
  items: ContextMenuItem[] | Signal<ContextMenuItem[]>;
  selectedIndex?: number | Signal<number>;
}

/** Serializable inspection snapshot for context Menu. */
export interface ContextMenuInspection {
  selectedIndex: number;
  itemCount: number;
  selected?: ContextMenuItem;
}

/** Renders context Menu Rows into deterministic text rows. */
export function renderContextMenuRows(
  items: readonly ContextMenuItem[],
  selectedIndex: number,
  height: number,
): string[] {
  return visibleContextMenuItems(items, selectedIndex, height).map((row) => {
    if (row.item.separatorBefore) return "─".repeat(Math.max(1, row.label.length + 2));
    const marker = row.selected ? ">" : " ";
    const label = row.item.disabled ? `(${row.label})` : row.label;
    return `${marker} ${label}`;
  });
}

/** Public helper for visible Context Menu Items. */
export function visibleContextMenuItems(
  items: readonly ContextMenuItem[],
  selectedIndex: number,
  height: number,
): Array<{ item: ContextMenuItem; index: number; label: string; selected: boolean }> {
  const safeHeight = Math.max(0, height);
  if (safeHeight === 0) return [];
  const selected = clampContextMenuSelection(items, selectedIndex);
  const offset = Math.max(0, Math.min(selected - Math.floor(safeHeight / 2), Math.max(0, items.length - safeHeight)));
  return items.slice(offset, offset + safeHeight).map((item, index) => {
    const itemIndex = offset + index;
    return {
      item,
      index: itemIndex,
      label: item.label,
      selected: itemIndex === selected && !item.disabled && !item.separatorBefore,
    };
  });
}

/** Clamps context Menu Selection to its valid range. */
export function clampContextMenuSelection(items: readonly ContextMenuItem[], selectedIndex: number): number {
  if (items.length === 0) return 0;
  const clamped = Math.max(0, Math.min(selectedIndex, items.length - 1));
  if (isSelectableContextItem(items[clamped])) return clamped;

  const next = shiftContextMenuSelection(items, clamped, 1);
  if (isSelectableContextItem(items[next])) return next;
  const previous = shiftContextMenuSelection(items, clamped, -1);
  return isSelectableContextItem(items[previous]) ? previous : clamped;
}

/** Moves context Menu Selection by a relative offset. */
export function shiftContextMenuSelection(
  items: readonly ContextMenuItem[],
  selectedIndex: number,
  delta: number,
): number {
  if (items.length === 0) return 0;
  let next = Math.max(0, Math.min(selectedIndex, items.length - 1));
  for (let count = 0; count < items.length; count += 1) {
    next = Math.max(0, Math.min(items.length - 1, next + delta));
    if (isSelectableContextItem(items[next])) return next;
    if (next === 0 || next === items.length - 1) break;
  }
  return selectedIndex;
}

function isSelectableContextItem(item: ContextMenuItem | undefined): boolean {
  return !!item && !item.disabled && !item.separatorBefore;
}

/** State controller for context Menu behavior. */
export class ContextMenuController {
  readonly items: Signal<ContextMenuItem[]>;
  readonly selectedIndex: Signal<number>;
  readonly #ownsItems: boolean;
  readonly #ownsSelectedIndex: boolean;

  constructor(options: ContextMenuControllerOptions) {
    this.#ownsItems = !(options.items instanceof Signal);
    this.#ownsSelectedIndex = !(options.selectedIndex instanceof Signal);
    this.items = signalify(options.items, { deepObserve: true });
    this.selectedIndex = signalify(options.selectedIndex ?? 0);
    this.clamp();
  }

  move(delta: number): void {
    this.selectedIndex.value = shiftContextMenuSelection(this.items.peek(), this.selectedIndex.peek(), delta);
    this.clamp();
  }

  first(): void {
    this.selectedIndex.value = clampContextMenuSelection(this.items.peek(), 0);
  }

  last(): void {
    this.selectedIndex.value = clampContextMenuSelection(this.items.peek(), this.items.peek().length - 1);
  }

  clamp(): void {
    this.selectedIndex.value = clampContextMenuSelection(this.items.peek(), this.selectedIndex.peek());
  }

  selected(): ContextMenuItem | undefined {
    const index = clampContextMenuSelection(this.items.peek(), this.selectedIndex.peek());
    const item = this.items.peek()[index];
    return isSelectableContextItem(item) ? item : undefined;
  }

  handleKeyPress(event: KeyPressEvent): ContextMenuItem | undefined {
    if (event.ctrl || event.meta || event.shift) return undefined;
    if (event.key === "up") {
      this.move(-1);
    } else if (event.key === "down") {
      this.move(1);
    } else if (event.key === "home") {
      this.first();
    } else if (event.key === "end") {
      this.last();
    } else if (event.key === "return") {
      return this.selected();
    }
    this.clamp();
    return undefined;
  }

  inspect(): ContextMenuInspection {
    return {
      selectedIndex: this.selectedIndex.peek(),
      itemCount: this.items.peek().length,
      selected: this.selected(),
    };
  }

  dispose(): void {
    if (this.#ownsItems) this.items.dispose();
    if (this.#ownsSelectedIndex) this.selectedIndex.dispose();
  }
}

/** Public class implementing a context Menu. */
export class ContextMenu extends Component {
  items: Signal<ContextMenuItem[]>;
  selectedIndex: Signal<number>;
  readonly controller: ContextMenuController;

  constructor(private readonly options: ContextMenuOptions) {
    super(options);
    const ownsController = !options.controller;
    this.controller = options.controller ??
      new ContextMenuController({
        items: options.items,
        selectedIndex: options.selectedIndex,
      });
    this.items = this.controller.items;
    this.selectedIndex = this.controller.selectedIndex;

    this.on("keyPress", (event) => {
      const item = this.controller.handleKeyPress(event);
      if (item) void this.options.onSelect?.(item);
    });
    if (ownsController) this.on("destroy", () => this.controller.dispose());
  }

  selected(): ContextMenuItem | undefined {
    return this.controller.selected();
  }

  override draw(): void {
    super.draw();
    const rows = new Computed(() =>
      renderContextMenuRows(this.items.value, this.selectedIndex.value, this.rectangle.value.height)
    );
    const height = this.rectangle.peek().height;
    for (let index = 0; index < height; index++) {
      const text = new Text({
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
      text.subComponentOf = this;
      this.subComponents[`row-${index}`] = text;
    }
  }
}
