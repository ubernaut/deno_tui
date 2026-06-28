import { assertEquals } from "./deps.ts";
import {
  createDataTableView,
  type DataColumn,
  nextSort,
  renderDataTableHeader,
  renderDataTableRows,
  sortDataRows,
} from "../src/components/data_table.ts";

interface ProcessRow extends Record<string, unknown> {
  pid: number;
  name: string;
  cpu: number;
}

const columns: DataColumn<ProcessRow>[] = [
  { id: "pid", label: "PID", width: 4, sortable: true },
  { id: "name", label: "Name", width: 8, sortable: true },
  { id: "cpu", label: "CPU", width: 5, sortable: true, format: (value) => `${value}%` },
];

const rows: ProcessRow[] = [
  { pid: 10, name: "deno", cpu: 12 },
  { pid: 2, name: "shell", cpu: 3 },
  { pid: 101, name: "renderer", cpu: 55 },
];

Deno.test("createDataTableView filters sorts paginates and clamps selection", () => {
  const view = createDataTableView(rows, columns, {
    query: "e",
    sort: { columnId: "cpu", direction: "desc" },
    pageSize: 1,
    page: 1,
    selectedIndex: 10,
  });

  assertEquals(view.totalRows, 3);
  assertEquals(view.page, 1);
  assertEquals(view.pageCount, 3);
  assertEquals(view.selectedIndex, 0);
  assertEquals(view.rows, [{ pid: 10, name: "deno", cpu: 12 }]);
});

Deno.test("data table sorting handles numbers and numeric strings", () => {
  assertEquals(sortDataRows(rows, { columnId: "pid", direction: "asc" }).map((row) => row.pid), [2, 10, 101]);
  assertEquals(
    sortDataRows([{ value: "10" }, { value: "2" }, { value: "1" }], { columnId: "value", direction: "asc" }),
    [{ value: "1" }, { value: "2" }, { value: "10" }],
  );
});

Deno.test("data table render helpers expose sorted headers and selected rows", () => {
  assertEquals(renderDataTableHeader(columns, { columnId: "cpu", direction: "desc" }), "PID  Name     CPU↓ ");
  assertEquals(renderDataTableRows(rows.slice(0, 2), columns, 1), [
    "  10   deno     12%  ",
    "> 2    shell    3%   ",
  ]);
  assertEquals(nextSort(undefined, "pid"), { columnId: "pid", direction: "asc" });
  assertEquals(nextSort({ columnId: "pid", direction: "asc" }, "pid"), { columnId: "pid", direction: "desc" });
});
