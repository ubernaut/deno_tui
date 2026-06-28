import { assertEquals } from "./deps.ts";
import {
  canSortColumn,
  createDataTableView,
  type DataColumn,
  DataTableController,
  nextSort,
  renderDataTableHeader,
  renderDataTableRows,
  sortDataRows,
} from "../src/components/data_table.ts";
import type { Key, KeyPressEvent } from "../src/input_reader/types.ts";
import { Signal } from "../src/signals/mod.ts";

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
  assertEquals(view.selectedRow, { pid: 10, name: "deno", cpu: 12 });
  assertEquals(view.rows, [{ pid: 10, name: "deno", cpu: 12 }]);
});

Deno.test("createDataTableView can preserve selected rows by key", () => {
  const view = createDataTableView(
    rows,
    columns,
    {
      sort: { columnId: "cpu", direction: "desc" },
      pageSize: 1,
      selectedKey: "2",
    },
    (row) => String(row.pid),
  );

  assertEquals(view.page, 2);
  assertEquals(view.selectedIndex, 0);
  assertEquals(view.selectedKey, "2");
  assertEquals(view.selectedRow, { pid: 2, name: "shell", cpu: 3 });
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

Deno.test("DataTableController keeps query sort pagination and selection in sync", async () => {
  const controller = new DataTableController({
    rows,
    columns,
    initialState: { pageSize: 2 },
  });
  await Promise.resolve();

  assertEquals(controller.view.peek().rows.map((row) => row.pid), [10, 2]);

  controller.toggleSort("cpu");
  assertEquals(controller.state.peek().sort, { columnId: "cpu", direction: "asc" });
  assertEquals(controller.view.peek().rows.map((row) => row.pid), [2, 10]);

  controller.toggleSort("cpu");
  assertEquals(controller.state.peek().sort, { columnId: "cpu", direction: "desc" });
  assertEquals(controller.view.peek().rows.map((row) => row.pid), [101, 10]);

  controller.nextPage();
  assertEquals(controller.view.peek().page, 1);
  assertEquals(controller.view.peek().rows.map((row) => row.pid), [2]);

  controller.setQuery("deno");
  assertEquals(controller.view.peek().page, 0);
  assertEquals(controller.view.peek().rows.map((row) => row.pid), [10]);
  assertEquals(controller.selectedRow()?.name, "deno");
  controller.dispose();
});

Deno.test("DataTableController inspects table state and handles navigation keys", async () => {
  const controller = new DataTableController({
    rows,
    columns,
    rowKey: (row) => String(row.pid),
    initialState: { pageSize: 2 },
  });
  await Promise.resolve();

  assertEquals(controller.inspect(), {
    rowCount: 3,
    visibleRowCount: 3,
    columnCount: 3,
    query: "",
    sort: undefined,
    page: 0,
    pageSize: 2,
    pageCount: 2,
    selectedIndex: 0,
    selectedKey: "10",
    selectedRow: { pid: 10, name: "deno", cpu: 12 },
  });

  controller.handleKeyPress(keyPress("down"));
  assertEquals(controller.selectedKey(), "2");
  assertEquals(controller.selectedRow()?.pid, 2);

  controller.handleKeyPress(keyPress("pagedown"));
  assertEquals(controller.inspect().page, 1);
  assertEquals(controller.selectedRow()?.pid, 101);
  assertEquals(controller.handleKeyPress(keyPress("return"))?.name, "renderer");

  controller.handleKeyPress(keyPress("pageup"));
  controller.handleKeyPress(keyPress("end"));
  assertEquals(controller.selectedRow()?.pid, 2);
  controller.handleKeyPress(keyPress("home"));
  assertEquals(controller.selectedRow()?.pid, 10);
  controller.dispose();
});

Deno.test("DataTableController reacts to row signals and clamps selection", async () => {
  const source = new Signal<readonly ProcessRow[]>(rows.slice(0, 2));
  const controller = new DataTableController({
    rows: source,
    columns,
    initialState: { selectedIndex: 1, pageSize: 5 },
  });
  await Promise.resolve();

  assertEquals(controller.selectedRow()?.pid, 2);
  controller.moveSelection(10);
  assertEquals(controller.view.peek().selectedIndex, 1);

  source.value = [{ pid: 33, name: "new", cpu: 1 }];
  assertEquals(controller.view.peek().selectedIndex, 0);
  assertEquals(controller.selectedRow()?.pid, 33);

  controller.dispose();
  source.value = rows;
  assertEquals(controller.view.peek().rows, [{ pid: 33, name: "new", cpu: 1 }]);
});

Deno.test("DataTableController keeps keyed selection across sort filter and refresh", async () => {
  const source = new Signal<readonly ProcessRow[]>(rows);
  const controller = new DataTableController({
    rows: source,
    columns,
    rowKey: (row) => String(row.pid),
    initialState: { pageSize: 1 },
  });
  await Promise.resolve();

  controller.selectKey("2");
  assertEquals(controller.view.peek().page, 1);
  assertEquals(controller.selectedRow()?.name, "shell");

  controller.nextPage();
  assertEquals(controller.view.peek().page, 2);
  assertEquals(controller.selectedKey(), "101");
  assertEquals(controller.selectedRow()?.name, "renderer");

  controller.selectKey("2");
  controller.toggleSort("cpu");
  assertEquals(controller.view.peek().page, 0);
  assertEquals(controller.view.peek().selectedKey, "2");
  assertEquals(controller.selectedRow()?.name, "shell");

  source.value = [
    { pid: 99, name: "other", cpu: 1 },
    { pid: 2, name: "shell2", cpu: 99 },
  ];
  assertEquals(controller.view.peek().selectedKey, "2");
  assertEquals(controller.selectedRow()?.name, "shell2");

  controller.setQuery("other");
  assertEquals(controller.view.peek().selectedKey, "99");
  assertEquals(controller.selectedRow()?.name, "other");

  controller.dispose();
});

Deno.test("DataTableController ignores unsortable columns", async () => {
  const tableColumns: DataColumn<ProcessRow>[] = [
    { id: "pid", sortable: false },
    { id: "name" },
  ];
  const controller = new DataTableController({
    rows,
    columns: tableColumns,
  });
  await Promise.resolve();

  assertEquals(canSortColumn(tableColumns, "pid"), false);
  assertEquals(canSortColumn(tableColumns, "name"), true);

  controller.toggleSort("pid");
  assertEquals(controller.state.peek().sort, undefined);

  controller.toggleSort("name");
  assertEquals(controller.state.peek().sort, { columnId: "name", direction: "asc" });

  controller.setSort({ columnId: "missing", direction: "asc" });
  assertEquals(controller.state.peek().sort, { columnId: "name", direction: "asc" });
  controller.dispose();
});

function keyPress(key: Key, options: Partial<Omit<KeyPressEvent, "key" | "buffer">> = {}): KeyPressEvent {
  return {
    key,
    ctrl: options.ctrl ?? false,
    meta: options.meta ?? false,
    shift: options.shift ?? false,
    buffer: new Uint8Array(),
  };
}
