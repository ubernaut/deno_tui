import { assertEquals } from "./deps.ts";
import {
  type WorkbenchDataTableBuffers,
  workbenchDataTablePageSize,
  workbenchDataTableRowsInto,
  type WorkbenchDataTableTheme,
} from "../app/workbench_panels.ts";
import type { RowStyle } from "../src/app/workbench_rows.ts";
import type { DataColumn, DataTableView } from "../src/components/data_table.ts";

interface Row extends Record<string, unknown> {
  id: string;
  name: string;
  state: string;
}

const columns: DataColumn<Row>[] = [
  { id: "name", label: "Name", width: 8, sortable: true },
  { id: "state", label: "State", width: 6, sortable: true },
];

const view: DataTableView<Row> = {
  rows: [
    { id: "one", name: "Data", state: "ready" },
    { id: "two", name: "Logs", state: "warm" },
  ],
  totalRows: 2,
  page: 0,
  pageSize: 2,
  pageCount: 1,
  selectedIndex: 1,
  selectedKey: "two",
  selectedRow: { id: "two", name: "Logs", state: "warm" },
};

const theme: WorkbenchDataTableTheme = {
  accentDeep: "#552288",
  background: "#000000",
  buttonActiveBg: "#aaff00",
  buttonActiveText: "#000000",
  muted: "#bbaadd",
  panelSoft: "#221133",
  soft: "#9988aa",
  surface: "#050510",
  text: "#eeeeee",
  warn: "#ffaa00",
};

const fit = (text: string, width: number) => text.slice(0, Math.max(0, width));

Deno.test("workbench data table projects header body spacer and footer rows", () => {
  const rows = workbenchDataTableRowsInto([], {
    view,
    columns,
    sort: { columnId: "state", direction: "desc" },
    width: 80,
    theme,
    fit,
    contrast: () => "#000000",
    buffers: { textRows: [], bodyRows: [] },
  });

  assertEquals(rows[0], { text: "Name     State↓", fg: "#000000", bg: "#552288", bold: true });
  assertEquals(rows[1], { text: "  Data     ready ", fg: "#eeeeee", bg: "#050510", bold: false });
  assertEquals(rows[2], { text: "> Logs     warm  ", fg: "#000000", bg: "#ffaa00", bold: true });
  assertEquals(rows[3], { text: "", bg: "#050510" });
  assertEquals(rows[4], {
    text: "page 1/1 selected two arrows/page keys S sort",
    fg: "#bbaadd",
    bg: "#221133",
  });
});

Deno.test("workbench data table rows reuse caller-owned body buffers", () => {
  const target: RowStyle[] = [];
  const bodyRow: RowStyle = { text: "stale", fg: "x", bg: "y", bold: true };
  const buffers: WorkbenchDataTableBuffers = { textRows: ["stale"], bodyRows: [bodyRow] };
  const rows = workbenchDataTableRowsInto(target, {
    view: { ...view, rows: view.rows.slice(0, 1), selectedIndex: 0 },
    columns,
    width: 80,
    theme,
    fit,
    contrast: () => "#000000",
    buffers,
  });

  assertEquals(rows === target, true);
  assertEquals(buffers.bodyRows.length, 1);
  assertEquals(buffers.bodyRows[0] === bodyRow, true);
  assertEquals(rows[1] === bodyRow, true);
  assertEquals(rows[1]?.text, "> Data     ready ");
});

Deno.test("workbench data table page size accounts for wrapped footer rows", () => {
  assertEquals(
    workbenchDataTablePageSize({
      height: 8,
      width: 80,
      page: 1,
      pageCount: 3,
      selectedKey: "data",
      theme,
      fit,
    }),
    5,
  );
  assertEquals(
    workbenchDataTablePageSize({
      height: 8,
      width: 10,
      page: 1,
      pageCount: 3,
      selectedKey: "data",
      theme,
      fit,
    }),
    1,
  );
});
