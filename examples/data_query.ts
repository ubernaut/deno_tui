import {
  createApp,
  createDataQueryController,
  createDataQueryPlugin,
  createRuntimeStore,
  type DataColumn,
  type DataQueryCommandAction,
  type DataQueryResult,
  DataTableController,
  queryLocalData,
  SettingsController,
} from "../mod.ts";

interface ProcessRow extends Record<string, unknown> {
  pid: number;
  name: string;
  group: "runtime" | "shell" | "renderer";
  cpu: number;
}

const rows: ProcessRow[] = [
  { pid: 10, name: "deno", group: "runtime", cpu: 12 },
  { pid: 2, name: "shell", group: "shell", cpu: 3 },
  { pid: 101, name: "three-ascii", group: "renderer", cpu: 55 },
  { pid: 33, name: "worker-pool", group: "runtime", cpu: 21 },
  { pid: 44, name: "theme-resolver", group: "runtime", cpu: 8 },
];
const columns: DataColumn<ProcessRow>[] = [
  { id: "pid", label: "PID", width: 5 },
  { id: "name", label: "Name", width: 16 },
  { id: "group", label: "Group", width: 9 },
  { id: "cpu", label: "CPU", width: 5 },
];

const store = createRuntimeStore<DataQueryResult<ProcessRow>>({
  databaseName: "deno-tui-data-query-demo",
  storeName: "queries",
  preferIndexedDb: false,
});
const settings = new SettingsController({
  namespace: "demo",
  store: createRuntimeStore<unknown>({
    databaseName: "deno-tui-data-query-demo",
    storeName: "settings",
    preferIndexedDb: false,
  }),
});

const processes = createDataQueryController<ProcessRow>({
  store,
  key: (params) => `processes:${params.query}:${params.sort?.field ?? "none"}:${params.sort?.direction ?? "none"}`,
  initialParams: { pageSize: 3 },
  loader: async ({ params }) => {
    await Promise.resolve();
    return queryLocalData(rows, params, {
      searchable: ["name", "group"],
    });
  },
});
const app = createApp<DataQueryCommandAction<ProcessRow>>({ tui: { destroy() {} } as never });
const actions: DataQueryCommandAction<ProcessRow>[] = [];
app.onAction((action) => void actions.push(action));
const table = new DataTableController({
  rows: [],
  columns,
  rowKey: (row) => String(row.pid),
});
const plugin = createDataQueryPlugin({
  id: "processes",
  label: "Process Query",
  controller: processes,
  table,
  settings,
  persistParams: { key: "process-query" },
  commands: {
    idPrefix: "processes.query",
    includeSortCommands: true,
    sortFields: [{ field: "cpu", label: "CPU" }],
  },
  mirrorKeymap: { includeDisabled: true },
});
const stopPlugin = app.use(plugin);

await processes.setQuery("runtime");
await app.executeCommand("processes.query.sort.cpu");
await app.executeCommand("processes.query.sort.cpu");
await settings.flush();

console.log("Runtime data query");
console.log(`Rows: ${processes.result.peek().rows.map((row) => `${row.name}:${row.cpu}%`).join(", ")}`);
console.log(`Table rows: ${table.view.peek().rows.map((row) => row.name).join(", ")}`);
console.log(`Total: ${processes.inspect().totalRows}`);
console.log(`Cache: ${processes.inspect().key}`);
console.log(`Plugin: ${plugin.inspect().label}`);
console.log(`Keymap bindings: ${app.keymap.inspect().count}`);
console.log(`Command actions: ${actions.map((action) => action.type).join(", ")}`);

const restored = createDataQueryController<ProcessRow>({
  store,
  key: (params) => `processes:${params.query}:${params.sort?.field ?? "none"}:${params.sort?.direction ?? "none"}`,
  initialParams: {
    query: "runtime",
    sort: { field: "cpu", direction: "desc" },
    pageSize: 3,
  },
  loader: () => queryLocalData([], {}),
});

await restored.restore();
console.log(`Restored cached rows: ${restored.result.peek().rows.length}`);

stopPlugin();
table.dispose();
processes.dispose();
restored.dispose();
