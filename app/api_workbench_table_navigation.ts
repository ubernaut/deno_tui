import type { DataColumn } from "../src/components/data_table.ts";

export function nextSortableDataColumn<TRow extends Record<string, unknown>>(
  columns: readonly DataColumn<TRow>[],
  currentColumnId: string | undefined,
  delta: number,
): DataColumn<TRow> | undefined {
  let sortableCount = 0;
  let currentSortableIndex = -1;
  for (let index = 0; index < columns.length; index += 1) {
    const column = columns[index]!;
    if (column.sortable === false) continue;
    if (column.id === currentColumnId) currentSortableIndex = sortableCount;
    sortableCount += 1;
  }
  if (sortableCount === 0) return undefined;

  let targetSortableIndex = currentSortableIndex < 0 ? 0 : currentSortableIndex;
  targetSortableIndex = ((targetSortableIndex + delta) % sortableCount + sortableCount) % sortableCount;

  let sortableIndex = 0;
  for (let index = 0; index < columns.length; index += 1) {
    const column = columns[index]!;
    if (column.sortable === false) continue;
    if (sortableIndex === targetSortableIndex) return column;
    sortableIndex += 1;
  }
  return undefined;
}
