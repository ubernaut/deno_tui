// Copyright 2023 Im-Beast. MIT license.

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
