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
  readonly #querySeen = new Set<DrawObject>();
  #rowEntries = 0;
  #activeRows = 0;

  static fromObjects(objects: Iterable<DrawObject>): DrawObjectSpatialIndex {
    const index = new DrawObjectSpatialIndex();
    return index.resetFromObjects(objects);
  }

  /** Clears and rebuilds this index from a current draw-object collection. */
  resetFromObjects(objects: Iterable<DrawObject>): DrawObjectSpatialIndex {
    this.clearRetainingRows();
    for (const object of objects) this.add(object);
    return this;
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
        if (rowObjects.length === 0) this.#activeRows += 1;
        rowObjects.push(object);
      } else {
        this.#rows.set(row, [object]);
        this.#activeRows += 1;
      }
      this.#rowEntries += 1;
    }
  }

  query(rectangle: Rectangle): DrawObject[] {
    return this.queryInto([], rectangle);
  }

  /** Writes objects intersecting the rectangle into a caller-owned buffer. */
  queryInto(target: DrawObject[], rectangle: Rectangle): DrawObject[] {
    target.length = 0;
    const startRow = Math.floor(rectangle.row);
    const endRow = startRow + Math.max(0, Math.floor(rectangle.height));
    const startColumn = Math.floor(rectangle.column);
    const endColumn = startColumn + Math.max(0, Math.floor(rectangle.width));
    if (endRow <= startRow || endColumn <= startColumn) return target;

    const candidates = this.#querySeen;
    candidates.clear();
    for (let row = startRow; row < endRow; row += 1) {
      for (const object of this.#rows.get(row) ?? []) {
        const objectRectangle = object.rectangle.peek();
        const objectStartColumn = Math.floor(objectRectangle.column);
        const objectEndColumn = objectStartColumn + Math.max(0, Math.floor(objectRectangle.width));
        if (objectEndColumn <= startColumn || objectStartColumn >= endColumn) continue;
        candidates.add(object);
      }
    }
    for (const object of candidates) target.push(object);
    candidates.clear();
    return target;
  }

  queryDirtyRegion(region: DirtyRegion): DrawObject[] {
    return this.queryDirtyRegionInto([], region);
  }

  /** Writes objects intersecting the dirty region into a caller-owned buffer. */
  queryDirtyRegionInto(target: DrawObject[], region: DirtyRegion): DrawObject[] {
    target.length = 0;
    if (region.isEmpty()) return target;
    const candidates = this.#querySeen;
    candidates.clear();
    region.forEachSegment((segment) => {
      const startColumn = segment.startColumn;
      const endColumn = segment.endColumn;
      for (const object of this.#rows.get(segment.row) ?? []) {
        const objectRectangle = object.rectangle.peek();
        const objectStartColumn = Math.floor(objectRectangle.column);
        const objectEndColumn = objectStartColumn + Math.max(0, Math.floor(objectRectangle.width));
        if (objectEndColumn <= startColumn || objectStartColumn >= endColumn) continue;
        candidates.add(object);
      }
    });
    for (const object of candidates) target.push(object);
    candidates.clear();
    return target;
  }

  inspect(): DrawObjectSpatialIndexStats {
    return {
      objects: this.#objects.size,
      rows: this.#activeRows,
      rowEntries: this.#rowEntries,
    };
  }

  clear(): void {
    this.#rows.clear();
    this.#objects.clear();
    this.#querySeen.clear();
    this.#rowEntries = 0;
    this.#activeRows = 0;
  }

  private clearRetainingRows(): void {
    for (const rowObjects of this.#rows.values()) rowObjects.length = 0;
    this.#objects.clear();
    this.#querySeen.clear();
    this.#rowEntries = 0;
    this.#activeRows = 0;
  }
}
