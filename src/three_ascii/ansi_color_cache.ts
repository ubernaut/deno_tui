// Copyright 2023 Im-Beast. MIT license.

import { createLinearByteCache } from "./colors.ts";

/** Caches raw linear RGB inputs and their terminal byte-color keys by cell index. */
export class ThreeAsciiAnsiColorKeyCache {
  private readonly toByte = createLinearByteCache();
  private rawRed = new Float64Array(0);
  private rawGreen = new Float64Array(0);
  private rawBlue = new Float64Array(0);
  private byteKeys = new Uint32Array(0);

  prepare(cellCount: number): void {
    if (this.byteKeys.length === cellCount) return;
    this.rawRed = createNaNFloat64Array(cellCount);
    this.rawGreen = createNaNFloat64Array(cellCount);
    this.rawBlue = createNaNFloat64Array(cellCount);
    this.byteKeys = new Uint32Array(cellCount);
  }

  keyForIndex(index: number, rawRed: number, rawGreen: number, rawBlue: number): number {
    if (
      this.rawRed[index] === rawRed &&
      this.rawGreen[index] === rawGreen &&
      this.rawBlue[index] === rawBlue
    ) {
      return this.byteKeys[index]!;
    }

    const foregroundRed = this.toByte(rawRed);
    const foregroundGreen = this.toByte(rawGreen);
    const foregroundBlue = this.toByte(rawBlue);
    const key = (foregroundRed << 16) | (foregroundGreen << 8) | foregroundBlue;
    this.rawRed[index] = rawRed;
    this.rawGreen[index] = rawGreen;
    this.rawBlue[index] = rawBlue;
    this.byteKeys[index] = key;
    return key;
  }

  prune(): void {
    this.toByte.prune();
  }

  clear(): void {
    this.toByte.clear();
    this.rawRed = new Float64Array(0);
    this.rawGreen = new Float64Array(0);
    this.rawBlue = new Float64Array(0);
    this.byteKeys = new Uint32Array(0);
  }
}

function createNaNFloat64Array(length: number): Float64Array<ArrayBuffer> {
  const values = new Float64Array(length);
  values.fill(Number.NaN);
  return values;
}
