// Copyright 2023 Im-Beast. MIT license.
import { LinearLayout } from "./linear_layout.ts";

/**
 * Reactively divides a rectangle into proportional vertical regions.
 * Contiguous repeated names receive multiple height units.
 *
 * @example
 * ```ts
 * const layout = new VerticalLayout({
 *   pattern: ["toolbar", "content", "content"],
 *   rectangle: tui.rectangle,
 *   gapY: 1,
 * });
 * ```
 */
export class VerticalLayout<T extends string> extends LinearLayout<T> {
  override updateElements(): void {
    const { elements, totalUnitLength } = this;
    if (elements.length === 0 || totalUnitLength <= 0) return;

    const gapX = this.gapX.value;
    const gapY = this.gapY.value;

    const { column, row, width, height } = this.rectangle.value;

    const elementHeight = Math.round(height / totalUnitLength);

    let currentRow = 0;
    let heightDiff = height - (elementHeight * totalUnitLength) - gapY;
    let partDiff = (heightDiff < 0 ? 1 : -1) * Math.ceil(Math.abs(heightDiff) / elements.length);
    for (const element of elements) {
      const rectangle = element.rectangle.peek();

      rectangle.width = width - gapX * 2;
      rectangle.column = column + gapX;

      const currentElementHeight = (elementHeight - partDiff) * element.unitLength;

      heightDiff += partDiff;
      if (heightDiff === 0) {
        partDiff = 0;
      }

      rectangle.height = currentElementHeight - gapY;

      rectangle.row = gapY + currentRow + row;

      currentRow += rectangle.height + gapY;
    }
  }
}
