// Copyright 2023 Im-Beast. MIT license.
import type { Rectangle } from "../types.ts";

/** A half-open dirty segment on one terminal row. */
export interface DirtyRowSegment {
  row: number;
  startColumn: number;
  endColumn: number;
}

/** Row-segment dirty region used to reason about canvas invalidation without expanding every cell. */
export class DirtyRegion {
  readonly #rows = new Map<number, DirtyRowSegment[]>();

  /** Creates a dirty region from rectangle bounds. */
  static fromRectangles(rectangles: readonly Rectangle[]): DirtyRegion {
    const region = new DirtyRegion();
    for (const rectangle of rectangles) {
      region.addRectangle(rectangle);
    }
    return region;
  }

  /** Adds a rectangular dirty area, ignoring empty or invalid dimensions. */
  addRectangle(rectangle: Rectangle): void {
    const startRow = Math.floor(rectangle.row);
    const endRow = startRow + Math.max(0, Math.floor(rectangle.height));
    const startColumn = Math.floor(rectangle.column);
    const endColumn = startColumn + Math.max(0, Math.floor(rectangle.width));
    for (let row = startRow; row < endRow; row += 1) {
      this.addSegment(row, startColumn, endColumn);
    }
  }

  /** Adds a half-open dirty segment to one row and merges overlap or adjacency. */
  addSegment(row: number, startColumn: number, endColumn: number): void {
    const normalizedRow = Math.floor(row);
    const start = Math.floor(Math.min(startColumn, endColumn));
    const end = Math.floor(Math.max(startColumn, endColumn));
    if (end <= start) return;

    const segments = this.#rows.get(normalizedRow) ?? [];
    segments.push({ row: normalizedRow, startColumn: start, endColumn: end });
    segments.sort((left, right) => left.startColumn - right.startColumn || left.endColumn - right.endColumn);

    const merged: DirtyRowSegment[] = [];
    for (const segment of segments) {
      const previous = merged.at(-1);
      if (!previous || segment.startColumn > previous.endColumn) {
        merged.push({ ...segment });
        continue;
      }
      previous.endColumn = Math.max(previous.endColumn, segment.endColumn);
    }
    this.#rows.set(normalizedRow, merged);
  }

  /** Removes all row segments from the dirty region. */
  clear(): void {
    this.#rows.clear();
  }

  /** Returns true when the dirty region has no row segments. */
  isEmpty(): boolean {
    return this.#rows.size === 0;
  }

  /** Returns cloned row segments sorted by row then start column. */
  inspect(): DirtyRowSegment[] {
    return [...this.#rows.entries()]
      .sort(([left], [right]) => left - right)
      .flatMap(([, segments]) => segments.map((segment) => ({ ...segment })));
  }

  /** Returns true when any dirty segment intersects the rectangle. */
  intersects(rectangle: Rectangle): boolean {
    return this.intersections(rectangle).length > 0;
  }

  /** Returns row segments clipped to the supplied rectangle. */
  intersections(rectangle: Rectangle): DirtyRowSegment[] {
    const rowStart = Math.floor(rectangle.row);
    const rowEnd = rowStart + Math.max(0, Math.floor(rectangle.height));
    const columnStart = Math.floor(rectangle.column);
    const columnEnd = columnStart + Math.max(0, Math.floor(rectangle.width));
    if (rowEnd <= rowStart || columnEnd <= columnStart) return [];

    const intersections: DirtyRowSegment[] = [];
    for (let row = rowStart; row < rowEnd; row += 1) {
      for (const segment of this.#rows.get(row) ?? []) {
        const startColumn = Math.max(columnStart, segment.startColumn);
        const endColumn = Math.min(columnEnd, segment.endColumn);
        if (endColumn > startColumn) {
          intersections.push({ row, startColumn, endColumn });
        }
      }
    }
    return intersections;
  }
}
