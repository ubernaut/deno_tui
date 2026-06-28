// Copyright 2023 Im-Beast. MIT license.
import type { KeyPressEvent } from "../input_reader/types.ts";
import { clampSelectionIndex } from "../selection.ts";
import { Computed, Signal } from "../signals/mod.ts";
import { clamp } from "../utils/numbers.ts";

export type SortDirection = "asc" | "desc";

export interface DataColumn<TRow extends Record<string, unknown> = Record<string, unknown>> {
  id: keyof TRow & string;
  label?: string;
  width?: number;
  sortable?: boolean;
  format?: (value: TRow[keyof TRow], row: TRow) => string;
}

export interface DataSort {
  columnId: string;
  direction: SortDirection;
}

export interface DataTableState {
  query?: string;
  sort?: DataSort;
  page?: number;
  pageSize?: number;
  selectedIndex?: number;
  selectedKey?: string;
}

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

export interface DataTableControllerOptions<TRow extends Record<string, unknown> = Record<string, unknown>> {
  rows: readonly TRow[] | Signal<readonly TRow[]>;
  columns: readonly DataColumn<TRow>[] | Signal<readonly DataColumn<TRow>[]>;
  initialState?: DataTableState;
  rowKey?: (row: TRow, index: number) => string;
}

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

export function createDataTableView<TRow extends Record<string, unknown>>(
  rows: readonly TRow[],
  columns: readonly DataColumn<TRow>[],
  state: DataTableState = {},
  rowKey?: (row: TRow, index: number) => string,
): DataTableView<TRow> {
  const filtered = filterDataRows(rows, columns, state.query ?? "");
  const sorted = sortDataRows(filtered, state.sort);
  const pageSize = Math.max(1, Math.floor(state.pageSize ?? (sorted.length || 1)));
  const selectedAbsoluteIndex = selectedRowIndex(sorted, state, rowKey);
  const pageForSelection = selectedAbsoluteIndex >= 0 ? Math.floor(selectedAbsoluteIndex / pageSize) : undefined;
  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize));
  const page = clamp(Math.floor(pageForSelection ?? state.page ?? 0), 0, pageCount - 1);
  const start = page * pageSize;
  const pageRows = sorted.slice(start, start + pageSize);
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

export function filterDataRows<TRow extends Record<string, unknown>>(
  rows: readonly TRow[],
  columns: readonly DataColumn<TRow>[],
  query: string,
): TRow[] {
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return [...rows];
  return rows.filter((row) => {
    const haystack = columns.map((column) => stringifyCell(row[column.id])).join(" ").toLowerCase();
    return terms.every((term) => haystack.includes(term));
  });
}

export function sortDataRows<TRow extends Record<string, unknown>>(
  rows: readonly TRow[],
  sort?: DataSort,
): TRow[] {
  if (!sort) return [...rows];
  const direction = sort.direction === "desc" ? -1 : 1;
  return [...rows].sort((left, right) => compareCells(left[sort.columnId], right[sort.columnId]) * direction);
}

export function renderDataTableHeader<TRow extends Record<string, unknown>>(
  columns: readonly DataColumn<TRow>[],
  sort?: DataSort,
): string {
  return columns.map((column) => {
    const suffix = sort?.columnId === column.id ? (sort.direction === "asc" ? "↑" : "↓") : "";
    return padCell(`${column.label ?? column.id}${suffix}`, column.width);
  }).join(" ");
}

export function renderDataTableRows<TRow extends Record<string, unknown>>(
  rows: readonly TRow[],
  columns: readonly DataColumn<TRow>[],
  selectedIndex = 0,
): string[] {
  return rows.map((row, index) => {
    const marker = index === selectedIndex ? ">" : " ";
    const cells = columns.map((column) => {
      const value = column.format ? column.format(row[column.id], row) : stringifyCell(row[column.id]);
      return padCell(value, column.width);
    });
    return `${marker} ${cells.join(" ")}`;
  });
}

export function nextSort(current: DataSort | undefined, columnId: string): DataSort {
  if (current?.columnId === columnId && current.direction === "asc") {
    return { columnId, direction: "desc" };
  }
  return { columnId, direction: "asc" };
}

export function canSortColumn<TRow extends Record<string, unknown>>(
  columns: readonly DataColumn<TRow>[],
  columnId: string,
): boolean {
  return columns.some((column) => column.id === columnId && column.sortable !== false);
}

function selectedRowIndex<TRow extends Record<string, unknown>>(
  rows: readonly TRow[],
  state: DataTableState,
  rowKey?: (row: TRow, index: number) => string,
): number {
  if (!rowKey || state.selectedKey === undefined) return -1;
  return rows.findIndex((row, index) => rowKey(row, index) === state.selectedKey);
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
  return value.length > width ? value.slice(0, width) : value.padEnd(width);
}
