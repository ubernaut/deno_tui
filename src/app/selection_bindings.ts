// Copyright 2023 Im-Beast. MIT license.
import { type SelectionController } from "../selection.ts";
import { Signal } from "../signals/mod.ts";
import type { Action } from "./actions.ts";
import type { Command, CommandRegistry } from "./commands.ts";

export type SelectionItemsSource<TItems extends readonly unknown[]> = TItems | Signal<TItems>;

export type SelectionCommandKind =
  | "first"
  | "previous"
  | "next"
  | "last"
  | "pagePrevious"
  | "pageNext"
  | "toggle"
  | "clear";

export type SelectionPageSize = number | Signal<number> | (() => number);

export interface SelectionCommandOptions {
  idPrefix?: string;
  group?: string;
  pageSize?: SelectionPageSize;
  includeToggle?: boolean;
  includeClear?: boolean;
  disabledWhenEmpty?: boolean;
  labels?: Partial<Record<SelectionCommandKind, string>>;
}

export interface SelectionValueBindingOptions<TItem, TValue = TItem> {
  valueForItem?: (item: TItem, index: number) => TValue;
  equals?: (left: TValue, right: TValue) => boolean;
  initialSync?: "selection" | "value";
  syncLength?: boolean;
  onMissingValue?: (value: TValue) => void;
}

export function bindSelectionValue<TItems extends readonly unknown[], TValue = TItems[number]>(
  selection: SelectionController,
  items: SelectionItemsSource<TItems>,
  selectedValue: Signal<TValue | undefined>,
  options: SelectionValueBindingOptions<TItems[number], TValue> = {},
): () => void {
  const source = items instanceof Signal ? items : undefined;
  const valueForItem = options.valueForItem ?? ((item: TItems[number]) => item as unknown as TValue);
  const equals = options.equals ?? Object.is;
  const syncLength = options.syncLength ?? true;
  let syncing = false;

  const readItems = (): TItems => source ? source.peek() : items as TItems;
  const normalizeLength = () => {
    if (!syncLength) return;
    const length = readItems().length;
    if (selection.length.peek() !== length) {
      selection.length.value = length;
    }
  };
  const valueAt = (index: number): TValue | undefined => {
    const currentItems = readItems();
    const item = currentItems[index];
    return item === undefined ? undefined : valueForItem(item, index);
  };
  const findValueIndex = (value: TValue) =>
    readItems().findIndex((item, itemIndex) => equals(valueForItem(item, itemIndex), value));
  const syncValueFromSelection = () => {
    if (syncing) return;
    normalizeLength();

    const next = valueAt(selection.state.peek().activeIndex);
    if (
      selectedValue.peek() !== undefined &&
      next !== undefined &&
      equals(selectedValue.peek() as TValue, next)
    ) {
      return;
    }

    syncing = true;
    selectedValue.value = next;
    syncing = false;
  };
  const syncSelectionFromValue = (next: TValue | undefined) => {
    if (syncing) return;
    normalizeLength();
    if (next === undefined) {
      syncValueFromSelection();
      return;
    }

    const index = findValueIndex(next);
    if (index >= 0) {
      if (selection.state.peek().activeIndex !== index) {
        syncing = true;
        selection.select(index);
        syncing = false;
      }
      return;
    }

    options.onMissingValue?.(next);
    syncValueFromSelection();
  };
  const syncFromItems = () => {
    const next = selectedValue.peek();
    if (next !== undefined) {
      const index = findValueIndex(next);
      if (index >= 0) {
        normalizeLength();
        if (selection.state.peek().activeIndex !== index) {
          selection.select(index);
        }
        return;
      }

      options.onMissingValue?.(next);
    }

    normalizeLength();
    syncValueFromSelection();
  };

  normalizeLength();
  if (options.initialSync === "value") {
    syncSelectionFromValue(selectedValue.peek());
  } else {
    syncValueFromSelection();
  }

  selection.state.subscribe(syncValueFromSelection);
  selectedValue.subscribe(syncSelectionFromValue);
  source?.subscribe(syncFromItems);

  return () => {
    selection.state.unsubscribe(syncValueFromSelection);
    selectedValue.unsubscribe(syncSelectionFromValue);
    source?.unsubscribe(syncFromItems);
  };
}

export function selectionCommands<TAction extends Action = Action>(
  selection: SelectionController,
  options: SelectionCommandOptions = {},
): Command<TAction>[] {
  const idPrefix = options.idPrefix ?? "selection";
  const group = options.group ?? "selection";
  const disabledWhenEmpty = options.disabledWhenEmpty ?? true;
  const disabled = () => disabledWhenEmpty && selection.length.peek() <= 0;
  const pageSize = () => Math.max(1, Math.floor(readPageSize(options.pageSize)));
  const label = (kind: SelectionCommandKind, fallback: string) => options.labels?.[kind] ?? fallback;
  const commands: Command<TAction>[] = [
    {
      id: `${idPrefix}.first`,
      label: label("first", "First Item"),
      group,
      binding: { key: "home" },
      disabled,
      action: () => selection.select(0),
    },
    {
      id: `${idPrefix}.previous`,
      label: label("previous", "Previous Item"),
      group,
      binding: { key: "up" },
      disabled,
      action: () => selection.move(-1),
    },
    {
      id: `${idPrefix}.next`,
      label: label("next", "Next Item"),
      group,
      binding: { key: "down" },
      disabled,
      action: () => selection.move(1),
    },
    {
      id: `${idPrefix}.last`,
      label: label("last", "Last Item"),
      group,
      binding: { key: "end" },
      disabled,
      action: () => selection.select(selection.length.peek() - 1),
    },
    {
      id: `${idPrefix}.pagePrevious`,
      label: label("pagePrevious", "Previous Page"),
      group,
      binding: { key: "pageup" },
      disabled,
      action: () => selection.move(-pageSize()),
    },
    {
      id: `${idPrefix}.pageNext`,
      label: label("pageNext", "Next Page"),
      group,
      binding: { key: "pagedown" },
      disabled,
      action: () => selection.move(pageSize()),
    },
  ];

  if (options.includeToggle ?? true) {
    commands.push({
      id: `${idPrefix}.toggle`,
      label: label("toggle", "Toggle Selection"),
      group,
      binding: { key: "space" },
      disabled,
      action: () => selection.toggle(),
    });
  }

  if (options.includeClear ?? false) {
    commands.push({
      id: `${idPrefix}.clear`,
      label: label("clear", "Clear Selection"),
      group,
      disabled,
      action: () => selection.clear(),
    });
  }

  return commands;
}

export function bindSelectionCommands<TAction extends Action = Action>(
  registry: CommandRegistry<TAction>,
  selection: SelectionController,
  options: SelectionCommandOptions = {},
): () => void {
  return registry.registerAll(selectionCommands<TAction>(selection, options));
}

function readPageSize(pageSize: SelectionPageSize | undefined): number {
  if (pageSize instanceof Signal) return pageSize.peek();
  if (typeof pageSize === "function") return pageSize();
  return pageSize ?? 10;
}
