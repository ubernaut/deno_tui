import { createDataQueryController, createRuntimeStore, type DataQueryResult, queryLocalData } from "../mod.ts";

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

const store = createRuntimeStore<DataQueryResult<ProcessRow>>({
  databaseName: "deno-tui-data-query-demo",
  storeName: "queries",
  preferIndexedDb: false,
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

await processes.setQuery("runtime");
await processes.toggleSort("cpu");
await processes.toggleSort("cpu");

console.log("Runtime data query");
console.log(`Rows: ${processes.result.peek().rows.map((row) => `${row.name}:${row.cpu}%`).join(", ")}`);
console.log(`Total: ${processes.inspect().totalRows}`);
console.log(`Cache: ${processes.inspect().key}`);

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

processes.dispose();
restored.dispose();
