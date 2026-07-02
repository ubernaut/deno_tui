// Copyright 2023 Im-Beast. MIT license.

/** Public type alias for a compare Fn. */
export type CompareFn<T> = (a: T, b: T) => number;

/**
 * Creates array that automatically sorts elements using `compareFn`
 * Additionally allows for removing elements
 */
export class SortedArray<T = unknown> extends Array<T> {
  compareFn?: CompareFn<T>;

  constructor(compareFn?: CompareFn<T>, ...items: T[]) {
    super(...items);
    this.compareFn = compareFn;
  }

  override push(...items: T[]): number {
    super.push(...items);
    this.sort(this.compareFn);
    return this.length;
  }

  remove(...items: T[]): number {
    for (const item of items) {
      const index = this.indexOf(item);
      if (index >= 0) {
        this.splice(index, 1);
      }
    }
    return this.length;
  }
}

/** Inserts a string into a sorted array unless it is already present. */
export function insertUniqueSortedString(values: string[], value: string): void {
  let low = 0;
  let high = values.length;
  while (low < high) {
    const middle = (low + high) >> 1;
    const comparison = value.localeCompare(values[middle]!);
    if (comparison === 0) return;
    if (comparison < 0) high = middle;
    else low = middle + 1;
  }
  values.splice(low, 0, value);
}
