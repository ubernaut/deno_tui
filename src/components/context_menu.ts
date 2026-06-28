// Copyright 2023 Im-Beast. MIT license.
import type { TextRectangle } from "../canvas/text.ts";
import { Component, type ComponentOptions } from "../component.ts";
import { Computed, Signal } from "../signals/mod.ts";
import { signalify } from "../utils/signals.ts";
import { Text } from "./text.ts";

export interface ContextMenuItem {
  id: string;
  label: string;
  disabled?: boolean;
  separatorBefore?: boolean;
}

export interface ContextMenuOptions extends ComponentOptions {
  items: ContextMenuItem[] | Signal<ContextMenuItem[]>;
  selectedIndex?: number | Signal<number>;
  onSelect?: (item: ContextMenuItem) => void | Promise<void>;
}

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

export function clampContextMenuSelection(items: readonly ContextMenuItem[], selectedIndex: number): number {
  if (items.length === 0) return 0;
  const clamped = Math.max(0, Math.min(selectedIndex, items.length - 1));
  if (isSelectableContextItem(items[clamped])) return clamped;

  const next = shiftContextMenuSelection(items, clamped, 1);
  if (isSelectableContextItem(items[next])) return next;
  const previous = shiftContextMenuSelection(items, clamped, -1);
  return isSelectableContextItem(items[previous]) ? previous : clamped;
}

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

export class ContextMenu extends Component {
  items: Signal<ContextMenuItem[]>;
  selectedIndex: Signal<number>;

  constructor(private readonly options: ContextMenuOptions) {
    super(options);
    this.items = signalify(options.items, { deepObserve: true });
    this.selectedIndex = signalify(options.selectedIndex ?? 0);

    this.on("keyPress", ({ key, ctrl, meta, shift }) => {
      if (ctrl || meta || shift) return;
      if (key === "up") {
        this.selectedIndex.value = shiftContextMenuSelection(this.items.peek(), this.selectedIndex.peek(), -1);
      } else if (key === "down") {
        this.selectedIndex.value = shiftContextMenuSelection(this.items.peek(), this.selectedIndex.peek(), 1);
      } else if (key === "home") {
        this.selectedIndex.value = clampContextMenuSelection(this.items.peek(), 0);
      } else if (key === "end") {
        this.selectedIndex.value = clampContextMenuSelection(this.items.peek(), this.items.peek().length - 1);
      } else if (key === "return") {
        const item = this.selected();
        if (item) void this.options.onSelect?.(item);
      }
      this.selectedIndex.value = clampContextMenuSelection(this.items.peek(), this.selectedIndex.peek());
    });
  }

  selected(): ContextMenuItem | undefined {
    const index = clampContextMenuSelection(this.items.peek(), this.selectedIndex.peek());
    const item = this.items.peek()[index];
    return isSelectableContextItem(item) ? item : undefined;
  }

  override draw(): void {
    super.draw();
    const rows = new Computed(() =>
      renderContextMenuRows(this.items.value, this.selectedIndex.value, this.rectangle.value.height)
    );
    Array.from({ length: this.rectangle.peek().height }, (_, index) => {
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
    });
  }
}
