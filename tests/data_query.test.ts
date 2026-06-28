import { assertEquals, assertExists } from "./deps.ts";
import {
  bindDataQueryCommands,
  CommandRegistry,
  createDataQueryController,
  type DataQueryCommandAction,
  dataQueryCommands,
  type DataQueryResult,
  MemoryStore,
  nextDataQuerySort,
  normalizeDataQueryParams,
  queryLocalData,
} from "../mod.ts";

interface ProcessRow extends Record<string, unknown> {
  pid: number;
  name: string;
  group: "runtime" | "shell";
  cpu: number;
}

const rows: ProcessRow[] = [
  { pid: 10, name: "deno", group: "runtime", cpu: 12 },
  { pid: 2, name: "shell", group: "shell", cpu: 3 },
  { pid: 101, name: "renderer", group: "runtime", cpu: 55 },
  { pid: 33, name: "worker", group: "runtime", cpu: 21 },
];

Deno.test("normalizeDataQueryParams clamps page and page size with fallback state", () => {
  assertEquals(normalizeDataQueryParams({ page: -4, pageSize: 0, query: "gpu" }), {
    query: "gpu",
    filters: {},
    sort: undefined,
    page: 0,
    pageSize: 1,
  });

  assertEquals(
    normalizeDataQueryParams({ sort: { field: "cpu", direction: "desc" } }, {
      query: "runtime",
      filters: { group: "runtime" },
      page: 2,
      pageSize: 50,
    }),
    {
      query: "runtime",
      filters: { group: "runtime" },
      sort: { field: "cpu", direction: "desc" },
      page: 2,
      pageSize: 50,
    },
  );
});

Deno.test("queryLocalData filters searches sorts and pages rows", () => {
  const result = queryLocalData(rows, {
    query: "er",
    filters: { group: "runtime" },
    sort: { field: "cpu", direction: "desc" },
    pageSize: 2,
  }, {
    searchable: ["name"],
  });

  assertEquals(result, {
    rows: [
      { pid: 101, name: "renderer", group: "runtime", cpu: 55 },
      { pid: 33, name: "worker", group: "runtime", cpu: 21 },
    ],
    totalRows: 2,
    page: 0,
    pageSize: 2,
    pageCount: 1,
  });
});

Deno.test("nextDataQuerySort cycles ascending descending and cleared", () => {
  assertEquals(nextDataQuerySort(undefined, "cpu"), { field: "cpu", direction: "asc" });
  assertEquals(nextDataQuerySort({ field: "cpu", direction: "asc" }, "cpu"), { field: "cpu", direction: "desc" });
  assertEquals(nextDataQuerySort({ field: "cpu", direction: "desc" }, "cpu"), undefined);
  assertEquals(nextDataQuerySort({ field: "name", direction: "desc" }, "cpu"), { field: "cpu", direction: "asc" });
});

Deno.test("DataQueryController loads cached query results and exposes inspection", async () => {
  const store = new MemoryStore<DataQueryResult<ProcessRow>>();
  const controller = createDataQueryController<ProcessRow>({
    store,
    key: (params) => `processes:${params.query}:${params.page}:${params.pageSize}`,
    initialParams: { pageSize: 2 },
    loader: ({ params }) => queryLocalData(rows, params, { searchable: ["name", "group"] }),
  });

  const first = await controller.setQuery("runtime");
  assertEquals(first.rows.map((row) => row.pid), [10, 101]);
  assertEquals(controller.inspect().cached, false);
  assertEquals(controller.inspect().totalRows, 3);

  await controller.nextPage();
  assertEquals(controller.result.peek().rows.map((row) => row.pid), [33]);

  const restored = createDataQueryController<ProcessRow>({
    store,
    key: (params) => `processes:${params.query}:${params.page}:${params.pageSize}`,
    initialParams: { query: "runtime", pageSize: 2 },
    loader: () => queryLocalData([], {}),
  });
  const restoredResult = await restored.restore();

  assertEquals(restoredResult?.rows.map((row) => row.pid), [10, 101]);
  assertEquals(restored.inspect().cached, true);
  assertEquals(restored.inspect().key, "processes:runtime:0:2");

  await restored.clearCache();
  assertEquals(await store.get("processes:runtime:0:2"), undefined);
  controller.dispose();
  restored.dispose();
});

Deno.test("data query commands drive reload paging sorting and cache actions", async () => {
  const store = new MemoryStore<DataQueryResult<ProcessRow>>();
  const actions: DataQueryCommandAction<ProcessRow>[] = [];
  const controller = createDataQueryController<ProcessRow>({
    store,
    key: (params) =>
      `processes:${params.query}:${params.sort?.field ?? "none"}:${
        params.sort?.direction ?? "none"
      }:${params.page}:${params.pageSize}`,
    initialParams: { query: "runtime", pageSize: 2 },
    loader: ({ params }) => queryLocalData(rows, params, { searchable: ["name", "group"] }),
  });
  const registry = new CommandRegistry<DataQueryCommandAction<ProcessRow>>();
  const dispose = bindDataQueryCommands(registry, controller, {
    id: "processes",
    idPrefix: "processes.query",
    includePageSizeCommands: true,
    pageSizes: [1, 2],
    includeSortCommands: true,
    sortFields: [{ field: "cpu", label: "CPU" }],
  });

  await registry.execute("processes.query.reload", (action) => void actions.push(action));
  assertEquals(actions.at(-1)?.type, "dataQuery.loaded");
  assertEquals(controller.result.peek().rows.map((row) => row.pid), [10, 101]);

  await registry.execute("processes.query.nextPage", (action) => void actions.push(action));
  assertEquals(actions.at(-1)?.type, "dataQuery.pageChanged");
  const pagePayload = actions[actions.length - 1]!.payload;
  assertExists(pagePayload);
  assertEquals(pagePayload.inspection.params.page, 1);
  assertEquals(controller.result.peek().rows.map((row) => row.pid), [33]);

  await registry.execute("processes.query.sort.cpu", (action) => void actions.push(action));
  assertEquals(actions.at(-1)?.type, "dataQuery.sortChanged");
  assertEquals(controller.params.peek().sort, { field: "cpu", direction: "asc" });

  await registry.execute("processes.query.sort.cpu", (action) => void actions.push(action));
  assertEquals(controller.params.peek().sort, { field: "cpu", direction: "desc" });
  assertEquals(controller.result.peek().rows.map((row) => row.pid), [101, 33]);

  await registry.execute("processes.query.pageSize.1", (action) => void actions.push(action));
  assertEquals(actions.at(-1)?.type, "dataQuery.pageSizeChanged");
  assertEquals(controller.params.peek().pageSize, 1);

  await registry.execute("processes.query.clearQuery", (action) => void actions.push(action));
  assertEquals(actions.at(-1)?.type, "dataQuery.queryCleared");
  assertEquals(controller.params.peek().query, "");

  await controller.patchFilters({ group: "runtime" });
  await registry.execute("processes.query.clearFilters", (action) => void actions.push(action));
  assertEquals(actions.at(-1)?.type, "dataQuery.filtersCleared");
  assertEquals(controller.params.peek().filters, {});

  await registry.execute("processes.query.clearCache", (action) => void actions.push(action));
  assertEquals(actions.at(-1)?.type, "dataQuery.cacheCleared");
  dispose();
  assertEquals(registry.inspect().count, 0);
  controller.dispose();
});

Deno.test("data query commands can omit optional command groups and disable empty state", async () => {
  const controller = createDataQueryController<ProcessRow>({
    initialParams: { pageSize: 2 },
    loader: ({ params }) => queryLocalData(rows.slice(0, 1), params),
  });
  await controller.reload();

  const commands = dataQueryCommands(controller, {
    includeReload: false,
    includeRestore: false,
    includeCacheCommands: false,
    includeQueryCommands: false,
    includeFilterCommands: false,
    includePagingCommands: false,
    includePageSizeCommands: true,
    pageSizes: [2],
    includeSortCommands: true,
    sortFields: ["pid"],
  });

  assertEquals(commands.map((command) => command.id), ["query.pageSize.2", "query.sort.pid"]);
  assertEquals(commands[0].disabled instanceof Function ? commands[0].disabled() : commands[0].disabled, true);
  controller.dispose();
});
