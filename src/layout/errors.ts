// Copyright 2023 Im-Beast. MIT license.
/** Error thrown for invalid layout Invalid Elements Pattern operations. */
export class LayoutInvalidElementsPatternError extends Error {
  constructor() {
    super(
      `Invalid elements pattern, same-name elements should be arranged in a row, e.g. ["dog", "dog", "cat"], not ["dog", "cat", "dog"]`,
    );
  }
}

/** Error thrown for invalid layout Missing Element operations. */
export class LayoutMissingElementError extends Error {
  constructor(name: string) {
    super(`Element "${name}" hasn't been found in layout`);
  }
}
