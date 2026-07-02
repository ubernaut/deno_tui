// Copyright 2023 Im-Beast. MIT license.
import { Computed, Signal } from "../signals/mod.ts";
import { clamp } from "../utils/numbers.ts";
import {
  CachedAsyncResource,
  type CachedAsyncResourceInspection,
  type CachedAsyncResourceOptions,
} from "./resource.ts";

const QUERY_WHITESPACE = /\s/;

/** Public type alias for a data Query Sort Direction. */
export type DataQuerySortDirection = "asc" | "desc";

/** Public interface describing a data Query Sort. */
export interface DataQuerySort {
  field: string;
  direction: DataQuerySortDirection;
}

/** Public type alias for a data Query Filters. */
export type DataQueryFilters = Record<string, unknown>;

/** Public interface describing a data Query Params. */
export interface DataQueryParams<TFilters extends DataQueryFilters = DataQueryFilters> {
  query?: string;
  filters?: TFilters;
  sort?: DataQuerySort;
  page?: number;
  pageSize?: number;
}

/** Public interface describing a normalized Data Query Params. */
export interface NormalizedDataQueryParams<TFilters extends DataQueryFilters = DataQueryFilters>
  extends Required<Pick<DataQueryParams<TFilters>, "query" | "filters" | "page" | "pageSize">> {
  sort?: DataQuerySort;
}

/** Public interface describing a data Query Result. */
export interface DataQueryResult<TRow = unknown> {
  rows: TRow[];
  totalRows: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

/** Options for configuring local Data Query. */
export interface LocalDataQueryOptions<TRow, TFilters extends DataQueryFilters = DataQueryFilters> {
  searchable?: readonly (keyof TRow & string)[] | ((row: TRow) => readonly unknown[]);
  filter?: (row: TRow, filters: TFilters) => boolean;
  compare?: (left: unknown, right: unknown, sort: DataQuerySort) => number;
}

/** Options for configuring data Query Controller. */
export interface DataQueryControllerOptions<
  TRow,
  TFilters extends DataQueryFilters = DataQueryFilters,
  Stored = DataQueryResult<TRow>,
> extends
  Omit<
    CachedAsyncResourceOptions<NormalizedDataQueryParams<TFilters>, DataQueryResult<TRow>, Stored>,
    "loader" | "initialParams"
  > {
  loader: CachedAsyncResourceOptions<
    NormalizedDataQueryParams<TFilters>,
    DataQueryResult<TRow>,
    Stored
  >["loader"];
  initialParams?: DataQueryParams<TFilters>;
}

/** Serializable inspection snapshot for data Query. */
export interface DataQueryInspection<TRow = unknown, TFilters extends DataQueryFilters = DataQueryFilters>
  extends CachedAsyncResourceInspection<DataQueryResult<TRow>, NormalizedDataQueryParams<TFilters>> {
  params: NormalizedDataQueryParams<TFilters>;
  rowCount: number;
  totalRows: number;
  pageCount: number;
}

/** State controller for data Query behavior. */
export class DataQueryController<
  TRow = unknown,
  TFilters extends DataQueryFilters = DataQueryFilters,
  Stored = DataQueryResult<TRow>,
> {
  readonly params: Signal<NormalizedDataQueryParams<TFilters>>;
  readonly resource: CachedAsyncResource<NormalizedDataQueryParams<TFilters>, DataQueryResult<TRow>, Stored>;
  readonly state: CachedAsyncResource<NormalizedDataQueryParams<TFilters>, DataQueryResult<TRow>, Stored>["state"];
  readonly result: Computed<DataQueryResult<TRow>>;

  constructor(options: DataQueryControllerOptions<TRow, TFilters, Stored>) {
    const initialParams = normalizeDataQueryParams(options.initialParams);
    this.params = new Signal(initialParams, { deepObserve: true });
    this.resource = new CachedAsyncResource({
      ...options,
      initialParams,
    });
    this.state = this.resource.state;
    this.result = new Computed(() => this.state.value.data ?? emptyDataQueryResult(this.params.value));
  }

  async load(params: DataQueryParams<TFilters> = this.params.peek()): Promise<DataQueryResult<TRow>> {
    const next = normalizeDataQueryParams(params, this.params.peek());
    this.params.value = next;
    const state = await this.resource.load(next);
    return state.data ?? emptyDataQueryResult(next);
  }

  async restore(params: DataQueryParams<TFilters> = this.params.peek()): Promise<DataQueryResult<TRow> | undefined> {
    const next = normalizeDataQueryParams(params, this.params.peek());
    this.params.value = next;
    const state = await this.resource.restore(next);
    return state?.data;
  }

  reload(): Promise<DataQueryResult<TRow>> {
    return this.load(this.params.peek());
  }

  async clearCache(params: DataQueryParams<TFilters> = this.params.peek()): Promise<void> {
    await this.resource.clear(normalizeDataQueryParams(params, this.params.peek()));
  }

  setQuery(query: string): Promise<DataQueryResult<TRow>> {
    return this.load({ ...this.params.peek(), query, page: 0 });
  }

  setFilters(filters: TFilters): Promise<DataQueryResult<TRow>> {
    return this.load({ ...this.params.peek(), filters, page: 0 });
  }

  patchFilters(filters: Partial<TFilters>): Promise<DataQueryResult<TRow>> {
    return this.setFilters({ ...this.params.peek().filters, ...filters } as TFilters);
  }

  clearFilters(): Promise<DataQueryResult<TRow>> {
    return this.setFilters({} as TFilters);
  }

  setSort(sort: DataQuerySort | undefined): Promise<DataQueryResult<TRow>> {
    return this.load({ ...this.params.peek(), sort, page: 0 });
  }

  toggleSort(field: string): Promise<DataQueryResult<TRow>> {
    return this.setSort(nextDataQuerySort(this.params.peek().sort, field));
  }

  setPage(page: number): Promise<DataQueryResult<TRow>> {
    const maxPage = Math.max(0, this.result.peek().pageCount - 1);
    return this.load({ ...this.params.peek(), page: clamp(Math.floor(page), 0, maxPage) });
  }

  nextPage(): Promise<DataQueryResult<TRow>> {
    return this.setPage(this.params.peek().page + 1);
  }

  previousPage(): Promise<DataQueryResult<TRow>> {
    return this.setPage(this.params.peek().page - 1);
  }

  setPageSize(pageSize: number): Promise<DataQueryResult<TRow>> {
    return this.load({ ...this.params.peek(), pageSize, page: 0 });
  }

  abort(): void {
    this.resource.abort();
  }

  inspect(): DataQueryInspection<TRow, TFilters> {
    const state = this.resource.inspect();
    const result = state.data ?? emptyDataQueryResult(this.params.peek());
    return {
      ...state,
      params: this.params.peek(),
      rowCount: result.rows.length,
      totalRows: result.totalRows,
      pageCount: result.pageCount,
    };
  }

  dispose(): void {
    this.result.dispose();
    this.params.dispose();
    this.resource.dispose();
  }
}

/** Creates an data Query Controller. */
export function createDataQueryController<
  TRow,
  TFilters extends DataQueryFilters = DataQueryFilters,
  Stored = DataQueryResult<TRow>,
>(
  options: DataQueryControllerOptions<TRow, TFilters, Stored>,
): DataQueryController<TRow, TFilters, Stored> {
  return new DataQueryController(options);
}

/** Public helper for normalize Data Query Params. */
export function normalizeDataQueryParams<TFilters extends DataQueryFilters = DataQueryFilters>(
  params: DataQueryParams<TFilters> = {},
  fallback: NormalizedDataQueryParams<TFilters> = {
    query: "",
    filters: {} as TFilters,
    page: 0,
    pageSize: 25,
  },
): NormalizedDataQueryParams<TFilters> {
  return {
    query: params.query ?? fallback.query,
    filters: params.filters ?? fallback.filters,
    sort: params.sort ?? fallback.sort,
    page: Math.max(0, Math.floor(params.page ?? fallback.page)),
    pageSize: Math.max(1, Math.floor(params.pageSize ?? fallback.pageSize)),
  };
}

/** Public helper for next Data Query Sort. */
export function nextDataQuerySort(sort: DataQuerySort | undefined, field: string): DataQuerySort | undefined {
  if (sort?.field !== field) return { field, direction: "asc" };
  return sort.direction === "asc" ? { field, direction: "desc" } : undefined;
}

/** Queries local Data records with deterministic filtering. */
export function queryLocalData<
  TRow extends Record<string, unknown>,
  TFilters extends DataQueryFilters = DataQueryFilters,
>(
  rows: readonly TRow[],
  params: DataQueryParams<TFilters> = {},
  options: LocalDataQueryOptions<TRow, TFilters> = {},
): DataQueryResult<TRow> {
  const normalized = normalizeDataQueryParams(params);
  const terms = parseDataQueryTerms(normalized.query);
  const filtered: TRow[] = [];
  for (const row of rows) {
    if (matchesDataQuery(row, terms, normalized.filters, options)) filtered.push(row);
  }
  const sorted = sortLocalData(filtered, normalized.sort, options.compare);
  return pageDataQueryRows(sorted, normalized);
}

/** Public helper for page Data Query Rows. */
export function pageDataQueryRows<TRow>(
  rows: readonly TRow[],
  params: DataQueryParams,
): DataQueryResult<TRow> {
  const normalized = normalizeDataQueryParams(params);
  const pageSize = normalized.pageSize;
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const page = clamp(normalized.page, 0, pageCount - 1);
  const start = page * pageSize;
  const end = Math.min(rows.length, start + pageSize);
  const pageRows = new Array<TRow>(Math.max(0, end - start));
  for (let index = start; index < end; index += 1) {
    pageRows[index - start] = rows[index]!;
  }
  return {
    rows: pageRows,
    totalRows: rows.length,
    page,
    pageSize,
    pageCount,
  };
}

function emptyDataQueryResult<TRow>(params: DataQueryParams): DataQueryResult<TRow> {
  const normalized = normalizeDataQueryParams(params);
  return {
    rows: [],
    totalRows: 0,
    page: normalized.page,
    pageSize: normalized.pageSize,
    pageCount: 1,
  };
}

function matchesDataQuery<TRow extends Record<string, unknown>, TFilters extends DataQueryFilters>(
  row: TRow,
  terms: readonly string[],
  filters: TFilters,
  options: LocalDataQueryOptions<TRow, TFilters>,
): boolean {
  if (options.filter && !options.filter(row, filters)) return false;
  if (!matchesExactFilters(row, filters)) return false;
  if (terms.length === 0) return true;
  return matchesSearchableTerms(row, terms, options.searchable);
}

function matchesSearchableTerms<TRow extends Record<string, unknown>>(
  row: TRow,
  terms: readonly string[],
  searchable?: LocalDataQueryOptions<TRow>["searchable"],
): boolean {
  for (const term of terms) {
    if (!searchableValueIncludes(row, searchable, term)) return false;
  }
  return true;
}

function searchableValueIncludes<TRow extends Record<string, unknown>>(
  row: TRow,
  searchable: LocalDataQueryOptions<TRow>["searchable"] | undefined,
  term: string,
): boolean {
  if (typeof searchable === "function") {
    for (const value of searchable(row)) {
      if (stringifyDataQueryValue(value).toLowerCase().includes(term)) return true;
    }
    return false;
  }
  if (searchable) {
    for (const field of searchable) {
      if (stringifyDataQueryValue(row[field]).toLowerCase().includes(term)) return true;
    }
    return false;
  }
  for (const field of Object.keys(row)) {
    if (stringifyDataQueryValue(row[field]).toLowerCase().includes(term)) return true;
  }
  return false;
}

function matchesExactFilters(row: Record<string, unknown>, filters: DataQueryFilters): boolean {
  for (const field of Object.keys(filters)) {
    const expected = filters[field];
    if (expected === undefined || expected === null || expected === "") continue;
    const actual = row[field];
    if (Array.isArray(expected)) {
      if (!expected.includes(actual)) return false;
      continue;
    }
    if (actual !== expected) return false;
  }
  return true;
}

function parseDataQueryTerms(query: string): string[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return [];
  const terms: string[] = [];
  let start = -1;
  for (let index = 0; index <= normalized.length; index += 1) {
    const whitespace = index >= normalized.length || QUERY_WHITESPACE.test(normalized[index]!);
    if (whitespace) {
      if (start >= 0) {
        terms.push(normalized.slice(start, index));
        start = -1;
      }
    } else if (start < 0) {
      start = index;
    }
  }
  return terms;
}

function sortLocalData<TRow extends Record<string, unknown>>(
  rows: readonly TRow[],
  sort: DataQuerySort | undefined,
  compare: LocalDataQueryOptions<TRow>["compare"],
): TRow[] {
  if (!sort) return [...rows];
  const direction = sort.direction === "desc" ? -1 : 1;
  return [...rows].sort((left, right) =>
    (compare?.(left[sort.field], right[sort.field], sort) ??
      compareDataQueryValues(left[sort.field], right[sort.field])) *
    direction
  );
}

function compareDataQueryValues(left: unknown, right: unknown): number {
  if (typeof left === "number" && typeof right === "number") return left - right;
  const leftString = stringifyDataQueryValue(left);
  const rightString = stringifyDataQueryValue(right);
  return leftString.localeCompare(rightString, undefined, { numeric: true, sensitivity: "base" });
}

function stringifyDataQueryValue(value: unknown): string {
  if (value === undefined || value === null) return "";
  if (value instanceof Date) return value.toISOString();
  return String(value);
}
