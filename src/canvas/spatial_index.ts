// Copyright 2023 Im-Beast. MIT license.
import type { Rectangle } from "../types.ts";
import type { DirtyRegion } from "./dirty_region.ts";
import type { DrawObject } from "./draw_object.ts";

/** Lightweight inspection data for row-indexed canvas objects. */
export interface DrawObjectSpatialIndexStats {
  objects: number;
  rows: number;
  rowEntries: number;
}

/**
 * Row-based spatial index for canvas draw objects.
 *
 * Terminal UIs are naturally row oriented: most invalidation work starts from a
 * rectangle or row segment. This index keeps overlap queries from scanning the
 * full drawn-object list for every moved pane while preserving the canvas z
 * ordering rules in the caller.
 */
export class DrawObjectSpatialIndex {
  readonly #rows = new Map<number, DrawObject[]>();
  readonly #objects = new Set<DrawObject>();
  #rowEntries = 0;

  static fromObjects(objects: Iterable<DrawObject>): DrawObjectSpatialIndex {
    const index = new DrawObjectSpatialIndex();
    for (const object of objects) {
      index.add(object);
    }
    return index;
  }

  add(object: DrawObject): void {
    if (object.outOfBounds) return;
    const rectangle = object.rectangle.peek();
    const startRow = Math.floor(rectangle.row);
    const endRow = startRow + Math.max(0, Math.floor(rectangle.height));
    const startColumn = Math.floor(rectangle.column);
    const endColumn = startColumn + Math.max(0, Math.floor(rectangle.width));
    if (endRow <= startRow || endColumn <= startColumn) return;

    this.#objects.add(object);
    for (let row = startRow; row < endRow; row += 1) {
      const rowObjects = this.#rows.get(row);
      if (rowObjects) {
        rowObjects.push(object);
      } else {
        this.#rows.set(row, [object]);
      }
      this.#rowEntries += 1;
    }
  }

  query(rectangle: Rectangle): DrawObject[] {
    const startRow = Math.floor(rectangle.row);
    const endRow = startRow + Math.max(0, Math.floor(rectangle.height));
    const startColumn = Math.floor(rectangle.column);
    const endColumn = startColumn + Math.max(0, Math.floor(rectangle.width));
    if (endRow <= startRow || endColumn <= startColumn) return [];

    const candidates = new Set<DrawObject>();
    for (let row = startRow; row < endRow; row += 1) {
      for (const object of this.#rows.get(row) ?? []) {
        const objectRectangle = object.rectangle.peek();
        const objectStartColumn = Math.floor(objectRectangle.column);
        const objectEndColumn = objectStartColumn + Math.max(0, Math.floor(objectRectangle.width));
        if (objectEndColumn <= startColumn || objectStartColumn >= endColumn) continue;
        candidates.add(object);
      }
    }
    return [...candidates];
  }

  queryDirtyRegion(region: DirtyRegion): DrawObject[] {
    if (region.isEmpty()) return [];
    const candidates = new Set<DrawObject>();
    for (const segment of region.inspect()) {
      const startColumn = segment.startColumn;
      const endColumn = segment.endColumn;
      for (const object of this.#rows.get(segment.row) ?? []) {
        const objectRectangle = object.rectangle.peek();
        const objectStartColumn = Math.floor(objectRectangle.column);
        const objectEndColumn = objectStartColumn + Math.max(0, Math.floor(objectRectangle.width));
        if (objectEndColumn <= startColumn || objectStartColumn >= endColumn) continue;
        candidates.add(object);
      }
    }
    return [...candidates];
  }

  inspect(): DrawObjectSpatialIndexStats {
    return {
      objects: this.#objects.size,
      rows: this.#rows.size,
      rowEntries: this.#rowEntries,
    };
  }
}
