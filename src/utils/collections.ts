// Copyright 2023 Im-Beast. MIT license.

/** Returns unique strings in ascending code-unit order. */
export function uniqueSortedStrings<T extends string>(values: Iterable<T>): T[] {
  return [...new Set(values)].sort();
}

/** Returns string set values in ascending code-unit order. */
export function sortedSetValues<T extends string>(values: ReadonlySet<T>): T[] {
  return [...values].sort();
}

/** Internal id-keyed collection with lazily cached sorted values and ids. */
export class OrderedIdCollection<T extends { readonly id: string }> {
  readonly #values = new Map<string, T>();
  #ordered?: T[];
  #ids?: string[];

  constructor(private readonly compare: (left: T, right: T) => number) {}

  set(value: T): void {
    this.#values.set(value.id, value);
    this.#ordered = undefined;
    this.#ids = undefined;
  }

  delete(id: string): boolean {
    const deleted = this.#values.delete(id);
    if (deleted) {
      this.#ordered = undefined;
      this.#ids = undefined;
    }
    return deleted;
  }

  clear(): void {
    this.#values.clear();
    this.#ordered = undefined;
    this.#ids = undefined;
  }

  has(id: string): boolean {
    return this.#values.has(id);
  }

  get(id: string): T | undefined {
    return this.#values.get(id);
  }

  ids(): string[] {
    if (!this.#ids) {
      const values = this.ordered();
      const ids = new Array<string>(values.length);
      for (let index = 0; index < values.length; index += 1) ids[index] = values[index]!.id;
      this.#ids = ids;
    }
    return this.#ids.slice();
  }

  ordered(): readonly T[] {
    if (!this.#ordered) {
      this.#ordered = Array.from(this.#values.values()).sort(this.compare);
    }
    return this.#ordered;
  }
}
