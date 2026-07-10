// Copyright 2023 Im-Beast. MIT license.
import { LinearLayout } from "./linear_layout.ts";

/**
 * Reactively divides a rectangle into proportional horizontal regions.
 * Contiguous repeated names receive multiple width units.
 *
 * @example
 * ```ts
 * const layout = new HorizontalLayout({
 *   pattern: ["sidebar", "content", "content"],
 *   rectangle: tui.rectangle,
 *   gapX: 1,
 * });
 * ```
 */
export class HorizontalLayout<T extends string> extends LinearLayout<T> {
  override updateElements(): void {
    const { elements, totalUnitLength } = this;
    if (elements.length === 0 || totalUnitLength <= 0) return;

    const gapX = this.gapX.value;
    const gapY = this.gapY.value;

    const { column, row, width, height } = this.rectangle.value;

    const elementWidth = Math.round(width / totalUnitLength);

    let currentColumn = 0;
    let widthDiff = width - (elementWidth * totalUnitLength) - gapX;
    let partDiff = (widthDiff < 0 ? 1 : -1) *
      Math.ceil(Math.abs(widthDiff) / elements.length);
    for (const element of elements) {
      const rectangle = element.rectangle.peek();

      rectangle.height = height - gapY * 2;
      rectangle.row = row + gapY;

      const currentElementWidth = (elementWidth - partDiff) * element.unitLength;

      widthDiff += partDiff;
      if (widthDiff === 0) {
        partDiff = 0;
      }

      rectangle.width = currentElementWidth - gapX;

      rectangle.column = gapX + currentColumn + column;
      currentColumn += rectangle.width + gapX;
    }
  }
}
