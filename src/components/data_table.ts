// Copyright 2023 Im-Beast. MIT license.
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
}

export interface DataTableView<TRow extends Record<string, unknown> = Record<string, unknown>> {
  rows: TRow[];
  totalRows: number;
  page: number;
  pageSize: number;
  pageCount: number;
  selectedIndex: number;
}

export function createDataTableView<TRow extends Record<string, unknown>>(
  rows: readonly TRow[],
  columns: readonly DataColumn<TRow>[],
  state: DataTableState = {},
): DataTableView<TRow> {
  const filtered = filterDataRows(rows, columns, state.query ?? "");
  const sorted = sortDataRows(filtered, state.sort);
  const pageSize = Math.max(1, Math.floor(state.pageSize ?? (sorted.length || 1)));
  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize));
  const page = clamp(Math.floor(state.page ?? 0), 0, pageCount - 1);
  const start = page * pageSize;
  const pageRows = sorted.slice(start, start + pageSize);
  return {
    rows: pageRows,
    totalRows: sorted.length,
    page,
    pageSize,
    pageCount,
    selectedIndex: clamp(Math.floor(state.selectedIndex ?? 0), 0, Math.max(0, pageRows.length - 1)),
  };
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
