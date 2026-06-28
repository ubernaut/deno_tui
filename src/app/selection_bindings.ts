// Copyright 2023 Im-Beast. MIT license.
import { type SelectionController } from "../selection.ts";
import { Signal } from "../signals/mod.ts";

export type SelectionItemsSource<TItems extends readonly unknown[]> = TItems | Signal<TItems>;

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
