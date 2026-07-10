// Copyright 2023 Im-Beast. MIT license.
import type { KeyPressEvent } from "../input_reader/types.ts";
import { clampSelectionIndex } from "../selection.ts";
import { Computed, Signal } from "../signals/mod.ts";
import { clamp } from "../utils/numbers.ts";
import { splitSearchTerms } from "../utils/search.ts";
import { cropToWidth, textWidth } from "../utils/strings.ts";

/** Public type alias for a sort Direction. */
export type SortDirection = "asc" | "desc";

/** Public interface describing a data Column. */
export interface DataColumn<TRow extends Record<string, unknown> = Record<string, unknown>> {
  id: keyof TRow & string;
  label?: string;
  width?: number;
  sortable?: boolean;
  format?: (value: TRow[keyof TRow], row: TRow) => string;
}

/** Public interface describing a data Sort. */
export interface DataSort {
  columnId: string;
  direction: SortDirection;
}

/** State snapshot for data Table. */
export interface DataTableState {
  query?: string;
  sort?: DataSort;
  page?: number;
  pageSize?: number;
  selectedIndex?: number;
  selectedKey?: string;
}

/** Public interface describing a data Table View. */
export interface DataTableView<TRow extends Record<string, unknown> = Record<string, unknown>> {
  rows: TRow[];
  totalRows: number;
  page: number;
  pageSize: number;
  pageCount: number;
  selectedIndex: number;
  selectedKey?: string;
  selectedRow?: TRow;
}

/** Options for configuring data Table Controller. */
export interface DataTableControllerOptions<TRow extends Record<string, unknown> = Record<string, unknown>> {
  rows: readonly TRow[] | Signal<readonly TRow[]>;
  columns: readonly DataColumn<TRow>[] | Signal<readonly DataColumn<TRow>[]>;
  initialState?: DataTableState;
  rowKey?: (row: TRow, index: number) => string;
}

/** Serializable inspection snapshot for data Table. */
export interface DataTableInspection<TRow extends Record<string, unknown> = Record<string, unknown>> {
  rowCount: number;
  visibleRowCount: number;
  columnCount: number;
  query: string;
  sort?: DataSort;
  page: number;
  pageSize: number;
  pageCount: number;
  selectedIndex: number;
  selectedKey?: string;
  selectedRow?: TRow;
}

/** Creates an data Table View. */
export function createDataTableView<TRow extends Record<string, unknown>>(
  rows: readonly TRow[],
  columns: readonly DataColumn<TRow>[],
  state: DataTableState = {},
  rowKey?: (row: TRow, index: number) => string,
): DataTableView<TRow> {
  const query = state.query ?? "";
  const filtered: readonly TRow[] = query.trim() ? filterDataRows(rows, columns, query) : rows;
  const sorted: readonly TRow[] = state.sort ? sortDataRows(filtered, state.sort) : filtered;
  const pageSize = Math.max(1, Math.floor(state.pageSize ?? (sorted.length || 1)));
  const selectedAbsoluteIndex = selectedRowIndex(sorted, state, rowKey);
  const pageForSelection = selectedAbsoluteIndex >= 0 ? Math.floor(selectedAbsoluteIndex / pageSize) : undefined;
  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize));
  const page = clamp(Math.floor(pageForSelection ?? state.page ?? 0), 0, pageCount - 1);
  const start = page * pageSize;
  const pageRows = copyDataTablePageRows(sorted, start, pageSize);
  const selectedIndex = selectedAbsoluteIndex >= start && selectedAbsoluteIndex < start + pageRows.length
    ? selectedAbsoluteIndex - start
    : clampSelectionIndex(pageRows.length, state.selectedIndex ?? 0);
  const selectedRow = pageRows[selectedIndex];
  return {
    rows: pageRows,
    totalRows: sorted.length,
    page,
    pageSize,
    pageCount,
    selectedIndex,
    selectedKey: selectedRow && rowKey ? rowKey(selectedRow, start + selectedIndex) : undefined,
    selectedRow,
  };
}

function copyDataTablePageRows<TRow>(rows: readonly TRow[], start: number, pageSize: number): TRow[] {
  const count = Math.max(0, Math.min(pageSize, rows.length - start));
  const pageRows = new Array<TRow>(count);
  for (let index = 0; index < count; index += 1) {
    pageRows[index] = rows[start + index]!;
  }
  return pageRows;
}

/** State controller for data Table behavior. */
export class DataTableController<TRow extends Record<string, unknown> = Record<string, unknown>> {
  readonly rows: Signal<readonly TRow[]>;
  readonly columns: Signal<readonly DataColumn<TRow>[]>;
  readonly state: Signal<DataTableState>;
  readonly view: Computed<DataTableView<TRow>>;
  readonly #rowKey?: (row: TRow, index: number) => string;

  constructor(options: DataTableControllerOptions<TRow>) {
    this.rows = options.rows instanceof Signal ? options.rows : new Signal<readonly TRow[]>([...options.rows]);
    this.columns = options.columns instanceof Signal
      ? options.columns
      : new Signal<readonly DataColumn<TRow>[]>([...options.columns]);
    this.#rowKey = options.rowKey;
    this.state = new Signal<DataTableState>({ ...(options.initialState ?? {}) }, { deepObserve: true });
    this.view = new Computed(() =>
      createDataTableView(this.rows.value, this.columns.value, this.state.value, this.#rowKey)
    );
  }

  setQuery(query: string): void {
    this.patchState({ query, page: 0, selectedIndex: 0 });
  }

  setPage(page: number): void {
    this.patchState({
      page: clamp(Math.floor(page), 0, this.view.peek().pageCount - 1),
      selectedIndex: 0,
      selectedKey: undefined,
    });
  }

  nextPage(): void {
    this.setPage(this.view.peek().page + 1);
  }

  previousPage(): void {
    this.setPage(this.view.peek().page - 1);
  }

  setPageSize(pageSize: number): void {
    this.patchState({ pageSize: Math.max(1, Math.floor(pageSize)), page: 0, selectedIndex: 0 });
  }

  setSort(sort: DataSort | undefined): void {
    if (sort && !canSortColumn(this.columns.peek(), sort.columnId)) return;
    this.patchState({ sort, page: 0, selectedIndex: 0 });
  }

  toggleSort(columnId: string): void {
    if (!canSortColumn(this.columns.peek(), columnId)) return;
    this.setSort(nextSort(this.state.peek().sort, columnId));
  }

  select(index: number): void {
    const view = this.view.peek();
    const selectedIndex = clampSelectionIndex(view.rows.length, index);
    this.patchState({
      selectedIndex,
      selectedKey: this.keyForVisibleRow(selectedIndex),
    });
  }

  selectKey(key: string | undefined): void {
    this.patchState({ selectedKey: key, selectedIndex: 0 });
  }

  moveSelection(delta: number): void {
    this.select(this.view.peek().selectedIndex + Math.floor(delta));
  }

  first(): void {
    this.select(0);
  }

  last(): void {
    this.select(this.view.peek().rows.length - 1);
  }

  handleKeyPress(event: KeyPressEvent): TRow | undefined {
    if (event.ctrl || event.meta || event.shift) return undefined;
    if (event.key === "up") this.moveSelection(-1);
    else if (event.key === "down") this.moveSelection(1);
    else if (event.key === "pageup") this.previousPage();
    else if (event.key === "pagedown") this.nextPage();
    else if (event.key === "home") this.first();
    else if (event.key === "end") this.last();
    else if (event.key === "return") return this.selectedRow();
    return undefined;
  }

  selectedRow(): TRow | undefined {
    return this.view.peek().selectedRow;
  }

  selectedKey(): string | undefined {
    return this.view.peek().selectedKey;
  }

  inspect(): DataTableInspection<TRow> {
    const view = this.view.peek();
    const state = this.state.peek();
    return {
      rowCount: this.rows.peek().length,
      visibleRowCount: view.totalRows,
      columnCount: this.columns.peek().length,
      query: state.query ?? "",
      sort: state.sort,
      page: view.page,
      pageSize: view.pageSize,
      pageCount: view.pageCount,
      selectedIndex: view.selectedIndex,
      selectedKey: view.selectedKey,
      selectedRow: view.selectedRow,
    };
  }

  dispose(): void {
    this.view.dispose();
  }

  private patchState(patch: Partial<DataTableState>): void {
    this.state.value = {
      ...this.state.peek(),
      ...patch,
    };
  }

  private keyForVisibleRow(index: number): string | undefined {
    const view = this.view.peek();
    const row = view.rows[index];
    if (!row || !this.#rowKey) return undefined;
    return this.#rowKey(row, view.page * view.pageSize + index);
  }
}

/** Public helper for filter Data Rows. */
export function filterDataRows<TRow extends Record<string, unknown>>(
  rows: readonly TRow[],
  columns: readonly DataColumn<TRow>[],
  query: string,
): TRow[] {
  const terms = splitSearchTerms(query);
  if (terms.length === 0) return copyDataRows(rows);
  const filtered: TRow[] = [];
  for (const row of rows) {
    if (dataRowMatchesTerms(row, columns, terms)) filtered.push(row);
  }
  return filtered;
}

function dataRowMatchesTerms<TRow extends Record<string, unknown>>(
  row: TRow,
  columns: readonly DataColumn<TRow>[],
  terms: readonly string[],
): boolean {
  for (const term of terms) {
    let matched = false;
    for (const column of columns) {
      if (stringifyCell(row[column.id]).toLowerCase().includes(term)) {
        matched = true;
        break;
      }
    }
    if (!matched) return false;
  }
  return true;
}

/** Public helper for sort Data Rows. */
export function sortDataRows<TRow extends Record<string, unknown>>(
  rows: readonly TRow[],
  sort?: DataSort,
): TRow[] {
  const sorted = copyDataRows(rows);
  if (!sort) return sorted;
  const direction = sort.direction === "desc" ? -1 : 1;
  sorted.sort((left, right) => compareCells(left[sort.columnId], right[sort.columnId]) * direction);
  return sorted;
}

function copyDataRows<TRow>(rows: readonly TRow[]): TRow[] {
  const output = new Array<TRow>(rows.length);
  for (let index = 0; index < rows.length; index += 1) output[index] = rows[index]!;
  return output;
}

/** Renders data Table Header into deterministic text rows. */
export function renderDataTableHeader<TRow extends Record<string, unknown>>(
  columns: readonly DataColumn<TRow>[],
  sort?: DataSort,
): string {
  let header = "";
  for (let index = 0; index < columns.length; index += 1) {
    const column = columns[index]!;
    const suffix = sort?.columnId === column.id ? (sort.direction === "asc" ? "↑" : "↓") : "";
    if (index > 0) header += " ";
    header += padCell(`${column.label ?? column.id}${suffix}`, column.width);
  }
  return header;
}

/** Renders data Table Rows into deterministic text rows. */
export function renderDataTableRows<TRow extends Record<string, unknown>>(
  rows: readonly TRow[],
  columns: readonly DataColumn<TRow>[],
  selectedIndex = 0,
): string[] {
  return renderDataTableRowsInto(new Array<string>(rows.length), rows, columns, selectedIndex);
}

/** Renders data Table Rows into caller-owned deterministic text rows. */
export function renderDataTableRowsInto<TRow extends Record<string, unknown>>(
  target: string[],
  rows: readonly TRow[],
  columns: readonly DataColumn<TRow>[],
  selectedIndex = 0,
): string[] {
  target.length = rows.length;
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index]!;
    const marker = index === selectedIndex ? ">" : " ";
    let line = `${marker} `;
    for (let columnIndex = 0; columnIndex < columns.length; columnIndex += 1) {
      const column = columns[columnIndex]!;
      const value = column.format ? column.format(row[column.id], row) : stringifyCell(row[column.id]);
      if (columnIndex > 0) line += " ";
      line += padCell(value, column.width);
    }
    target[index] = line;
  }
  return target;
}

/** Public helper for next Sort. */
export function nextSort(current: DataSort | undefined, columnId: string): DataSort {
  if (current?.columnId === columnId && current.direction === "asc") {
    return { columnId, direction: "desc" };
  }
  return { columnId, direction: "asc" };
}

/** Public helper for can Sort Column. */
export function canSortColumn<TRow extends Record<string, unknown>>(
  columns: readonly DataColumn<TRow>[],
  columnId: string,
): boolean {
  for (const column of columns) {
    if (column.id === columnId && column.sortable !== false) return true;
  }
  return false;
}

function selectedRowIndex<TRow extends Record<string, unknown>>(
  rows: readonly TRow[],
  state: DataTableState,
  rowKey?: (row: TRow, index: number) => string,
): number {
  if (!rowKey || state.selectedKey === undefined) return -1;
  for (let index = 0; index < rows.length; index += 1) {
    if (rowKey(rows[index]!, index) === state.selectedKey) return index;
  }
  return -1;
}

function stringifyCell(value: unknown): string {
  if (value === undefined || value === null) return "";
  return String(value);
}

function compareCells(left: unknown, right: unknown): number {
  if (typeof left === "number" && typeof right === "number") return left - right;
  return stringifyCell(left).localeCompare(stringifyCell(right), undefined, { numeric: true, sensitivity: "base" });
}

function padCell(value: string, width?: number): string {
  if (!width) return value;
  const cropped = cropToWidth(value, width);
  return cropped + " ".repeat(Math.max(0, width - textWidth(cropped)));
}
