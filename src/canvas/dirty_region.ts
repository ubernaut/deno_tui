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
      region.addRectangleUnmerged(rectangle);
    }
    region.mergeRows();
    return region;
  }

  private addRectangleUnmerged(rectangle: Rectangle): void {
    const startRow = Math.floor(rectangle.row);
    const endRow = startRow + Math.max(0, Math.floor(rectangle.height));
    const startColumn = Math.floor(rectangle.column);
    const endColumn = startColumn + Math.max(0, Math.floor(rectangle.width));
    if (endRow <= startRow || endColumn <= startColumn) return;

    for (let row = startRow; row < endRow; row += 1) {
      const segments = this.#rows.get(row);
      const segment = { row, startColumn, endColumn };
      if (segments) segments.push(segment);
      else this.#rows.set(row, [segment]);
    }
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
    this.#rows.set(normalizedRow, mergeRowSegments(segments));
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
    const rows: number[] = [];
    for (const row of this.#rows.keys()) {
      rows.push(row);
    }
    rows.sort((left, right) => left - right);

    const output: DirtyRowSegment[] = [];
    for (const row of rows) {
      const segments = this.#rows.get(row);
      if (!segments) continue;
      for (const segment of segments) {
        output.push({ ...segment });
      }
    }
    return output;
  }

  /** Returns true when any dirty segment intersects the rectangle. */
  intersects(rectangle: Rectangle): boolean {
    const rowStart = Math.floor(rectangle.row);
    const rowEnd = rowStart + Math.max(0, Math.floor(rectangle.height));
    const columnStart = Math.floor(rectangle.column);
    const columnEnd = columnStart + Math.max(0, Math.floor(rectangle.width));
    if (rowEnd <= rowStart || columnEnd <= columnStart) return false;

    for (let row = rowStart; row < rowEnd; row += 1) {
      for (const segment of this.#rows.get(row) ?? []) {
        if (Math.min(columnEnd, segment.endColumn) > Math.max(columnStart, segment.startColumn)) return true;
      }
    }
    return false;
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

  private mergeRows(): void {
    for (const [row, segments] of this.#rows) {
      this.#rows.set(row, mergeRowSegments(segments));
    }
  }
}

function mergeRowSegments(segments: readonly DirtyRowSegment[]): DirtyRowSegment[] {
  const sorted = new Array<DirtyRowSegment>(segments.length);
  for (let index = 0; index < segments.length; index += 1) {
    sorted[index] = { ...segments[index]! };
  }
  sorted.sort((left, right) => left.startColumn - right.startColumn || left.endColumn - right.endColumn);
  const merged: DirtyRowSegment[] = [];
  for (const segment of sorted) {
    const previous = merged.at(-1);
    if (!previous || segment.startColumn > previous.endColumn) {
      merged.push(segment);
      continue;
    }
    previous.endColumn = Math.max(previous.endColumn, segment.endColumn);
  }
  return merged;
}
