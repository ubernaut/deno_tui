// Copyright 2023 Im-Beast. MIT license.

/** Returns unique strings in ascending code-unit order. */
export function uniqueSortedStrings<T extends string>(values: Iterable<T>): T[] {
  return [...new Set(values)].sort();
}
