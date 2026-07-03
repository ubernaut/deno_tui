// Copyright 2023 Im-Beast. MIT license.
import {
  type DataColumn,
  type DataSort,
  type DataTableView,
  renderDataTableHeader,
  renderDataTableRowsInto,
} from "../src/components/data_table.ts";
import { dataFooterRows, type RowStyle, type WorkbenchRowTheme } from "./workbench_rows.ts";

/** Minimal theme tokens needed by the API workbench data-table panel. */
export interface WorkbenchDataTableTheme extends WorkbenchRowTheme {
  accentDeep: string;
  background: string;
  surface: string;
  text: string;
  warn: string;
}

/** Caller-owned buffers used to project workbench data table rows. */
export interface WorkbenchDataTableBuffers {
  textRows: string[];
  bodyRows: RowStyle[];
}

/** Options for projecting a data-table view into terminal row styles. */
export interface WorkbenchDataTableRowsOptions<TRow extends Record<string, unknown>> {
  view: DataTableView<TRow>;
  columns: readonly DataColumn<TRow>[];
  sort?: DataSort;
  width: number;
  theme: WorkbenchDataTableTheme;
  fit: (text: string, width: number) => string;
  contrast: (color: string, darkFallback: string, lightFallback: string) => string;
  buffers: WorkbenchDataTableBuffers;
}

/** Projects header, body, spacer, and footer rows for the API workbench data table. */
export function workbenchDataTableRowsInto<TRow extends Record<string, unknown>>(
  target: RowStyle[],
  options: WorkbenchDataTableRowsOptions<TRow>,
): RowStyle[] {
  const { view, columns, width, theme: t, fit, contrast, buffers } = options;
  const textRows = renderDataTableRowsInto(buffers.textRows, view.rows, columns, view.selectedIndex);
  buffers.bodyRows.length = textRows.length;
  for (let index = 0; index < textRows.length; index += 1) {
    const selected = index === view.selectedIndex;
    const row = buffers.bodyRows[index] ?? { text: "" };
    row.text = textRows[index]!;
    row.fg = selected ? contrast(t.warn, t.background, t.text) : t.text;
    row.bg = selected ? t.warn : t.surface;
    row.bold = selected;
    buffers.bodyRows[index] = row;
  }

  const footerRows = dataFooterRows({
    page: view.page + 1,
    pageCount: view.pageCount,
    selectedKey: view.selectedKey,
    width,
    theme: t,
    fit,
  });

  target.length = 0;
  target.push({
    text: renderDataTableHeader(columns, options.sort),
    fg: contrast(t.accentDeep, t.background, t.text),
    bg: t.accentDeep,
    bold: true,
  });
  for (let index = 0; index < buffers.bodyRows.length; index += 1) {
    target.push(buffers.bodyRows[index]!);
  }
  target.push({ text: "", bg: t.surface });
  for (let index = 0; index < footerRows.length; index += 1) {
    target.push(footerRows[index]!);
  }
  return target;
}

/** Returns the page size that leaves room for header, spacer, and responsive footer rows. */
export function workbenchDataTablePageSize(options: {
  height: number;
  width: number;
  page: number;
  pageCount: number;
  selectedKey?: string;
  theme: WorkbenchRowTheme;
  fit: (text: string, width: number) => string;
}): number {
  const footerRows = dataFooterRows({
    page: options.page,
    pageCount: options.pageCount,
    selectedKey: options.selectedKey,
    width: options.width,
    theme: options.theme,
    fit: options.fit,
  });
  return Math.max(1, Math.floor(options.height) - 2 - footerRows.length);
}
