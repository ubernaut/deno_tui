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
