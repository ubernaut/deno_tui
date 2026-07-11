// Copyright 2023 Im-Beast. MIT license.
import { Effect } from "../signals/effect.ts";
import { Signal } from "../signals/signal.ts";
import type { Rectangle } from "../types.ts";
import { signalify } from "../utils/signals.ts";
import { LayoutInvalidElementsPatternError, LayoutMissingElementError } from "./errors.ts";
import type { Layout, LayoutElement, LayoutOptions } from "./types.ts";

export abstract class LinearLayout<T extends string> implements Layout<T> {
  rectangle: Signal<Rectangle>;
  gapX: Signal<number>;
  gapY: Signal<number>;
  pattern: Signal<T[]>;
  totalUnitLength = 0;
  elements: LayoutElement<T>[] = [];
  elementNameToIndex: Map<T, number> = new Map<T, number>();

  readonly #patternEffect: Effect;
  readonly #elementsEffect: Effect;

  constructor(options: LayoutOptions<T>) {
    this.pattern = signalify(options.pattern, {
      deepObserve: true,
      watchObjectIndex: true,
    });
    this.gapX = signalify(options.gapX ?? 0);
    this.gapY = signalify(options.gapY ?? 0);
    this.rectangle = signalify(options.rectangle, { deepObserve: true });

    this.#patternEffect = new Effect(() => {
      this.updatePattern();
      this.updateElements();
    });
    this.#elementsEffect = new Effect(() => this.updateElements());
  }

  updatePattern(): void {
    const { elementNameToIndex, elements } = this;
    elementNameToIndex.clear();

    const pattern = this.pattern.value;
    this.totalUnitLength = pattern.length;
    if (pattern.length === 0) {
      elements.length = 0;
      return;
    }

    let lastElement: T | undefined;
    let elementCount = 0;
    for (const name of pattern) {
      let index = elementNameToIndex.get(name);
      if (index === undefined) {
        const element = elements[elementCount];
        if (element) {
          element.name = name;
          element.unitLength = 0;
        } else {
          elements[elementCount] = {
            name,
            unitLength: 0,
            rectangle: new Signal(
              { column: 0, height: 0, row: 0, width: 0 },
              { deepObserve: true },
            ),
          };
        }
        index = elementCount++;
        elementNameToIndex.set(name, index);
      } else if (lastElement !== name) {
        throw new LayoutInvalidElementsPatternError();
      }

      elements[index]!.unitLength++;
      lastElement = name;
    }

    elements.length = elementCount;
  }

  abstract updateElements(): void;

  element(name: T): Signal<Rectangle> {
    const index = this.elementNameToIndex.get(name);
    if (index === undefined) throw new LayoutMissingElementError(name);
    return this.elements[index]!.rectangle;
  }

  dispose(): void {
    this.#patternEffect.dispose();
    this.#elementsEffect.dispose();
  }
}
