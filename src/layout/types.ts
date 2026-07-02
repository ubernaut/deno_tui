// Copyright 2023 Im-Beast. MIT license.
import type { Signal, SignalOfObject } from "../signals/signal.ts";
import type { Rectangle } from "../types.ts";

/** Options for configuring layout. */
export interface LayoutOptions<T extends string> {
  /** Position and size of Layout */
  rectangle: Rectangle | SignalOfObject<Rectangle>;
  /** Arrangement of elements on layout */
  pattern: T[] | Signal<T[]>;
  /** Horizontal gap between elements */
  gapX?: number | Signal<number>;
  /** Vertical gap between elements */
  gapY?: number | Signal<number>;
}

/** Public interface describing a layout Element. */
export interface LayoutElement<T extends string> {
  name: T;
  unitLength: number;
  rectangle: Signal<Rectangle>;
}

/** Public interface describing a layout. */
export interface Layout<T extends string> {
  element(name: T): Signal<Rectangle>;
  updatePattern(): void;
  updateElements(): void;
  dispose?(): void;

  rectangle: Signal<Rectangle>;
  gapX: Signal<number>;
  gapY: Signal<number>;

  pattern: unknown;
  elements: unknown[];
  elementNameToIndex: Map<T, number>;
}
