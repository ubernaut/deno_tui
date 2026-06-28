import {
  bindDataTableCommands,
  bindSelectionCommands,
  CommandRegistry,
  DataTableController,
  executeCommandSurfaceItem,
  searchCommandSurfaceItems,
  selectedValues,
  SelectionController,
  Signal,
} from "../mod.ts";

type ProcessRow = {
  id: string;
  name: string;
  cpu: number;
  memory: number;
  status: string;
};

const rows = new Signal<readonly ProcessRow[]>([
  { id: "p-001", name: "renderer", cpu: 72, memory: 412, status: "hot" },
  { id: "p-002", name: "worker-pool", cpu: 39, memory: 260, status: "ready" },
  { id: "p-003", name: "theme-cache", cpu: 7, memory: 84, status: "ready" },
  { id: "p-004", name: "query-index", cpu: 21, memory: 128, status: "ready" },
  { id: "p-005", name: "terminal-session", cpu: 4, memory: 32, status: "idle" },
]);

const table = new DataTableController<ProcessRow>({
  rows,
  rowKey: (row) => row.id,
  initialState: { pageSize: 2 },
  columns: [
    { id: "name", label: "Name", sortable: true },
    { id: "cpu", label: "CPU", sortable: true, format: (value) => `${value}%` },
    { id: "memory", label: "Memory", sortable: true, format: (value) => `${value} MiB` },
    { id: "status", label: "Status", sortable: true },
  ],
});

table.setQuery("ready");
table.toggleSort("cpu");
table.nextPage();

const visibleRows = new Signal(table.view.peek().rows, { deepObserve: true });
const visibleLength = new Signal(visibleRows.peek().length);
const selection = new SelectionController({
  length: visibleLength,
  mode: "multiple",
  initialState: { activeIndex: 0, selected: [0] },
});
selection.toggle(1);

const registry = new CommandRegistry();
const disposeTable = bindDataTableCommands(registry, table, { idPrefix: "processes", group: "table" });
const disposeSelection = bindSelectionCommands(registry, selection, {
  idPrefix: "visible",
  group: "selection",
  includeClear: true,
  pageSize: 2,
});

await executeCommandSurfaceItem(
  registry,
  searchCommandSurfaceItems(registry, { query: "previous page", limit: 1 })[0]!,
);
await registry.execute("processes.sort.memory");
await registry.execute("visible.pageNext");
visibleRows.value = table.view.peek().rows;
visibleLength.value = visibleRows.peek().length;
selection.select(0);
selection.range(1);

const tableInspection = table.inspect();
const selected = selectedValues(visibleRows.peek(), selection.state.peek(), { valueForItem: (row) => row.id });

console.log("# Table And Selection Workflow Demo");
console.log("");
console.log(`Rows: ${tableInspection.rowCount}, visible after query: ${tableInspection.visibleRowCount}`);
console.log(`Page: ${tableInspection.page + 1}/${tableInspection.pageCount}, page size: ${tableInspection.pageSize}`);
console.log(`Sort: ${tableInspection.sort?.columnId ?? "none"} ${tableInspection.sort?.direction ?? ""}`.trim());
console.log(
  `Selected table row: ${tableInspection.selectedRow?.name ?? "none"} (${tableInspection.selectedKey ?? "no-key"})`,
);
console.log(`Visible rows: ${table.view.peek().rows.map((row) => `${row.name}:${row.cpu}%`).join(", ")}`);
console.log(
  `Multi-selection state: active=${selection.state.peek().activeIndex}, selected=${
    selection.state.peek().selected.join(",")
  }`,
);
console.log(`Selected visible ids: ${selected.join(", ") || "none"}`);
console.log(`Command groups: ${registry.inspect().groups.join(", ")}`);
console.log(
  `Search hits: ${searchCommandSurfaceItems(registry, { query: "sort", limit: 4 }).map((item) => item.id).join(", ")}`,
);

disposeSelection();
disposeTable();
selection.dispose();
visibleLength.dispose();
visibleRows.dispose();
rows.dispose();
table.dispose();
