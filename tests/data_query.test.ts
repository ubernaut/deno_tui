import { assertEquals, assertExists } from "./deps.ts";
import {
  bindDataQueryCommands,
  bindDataQueryParams,
  bindDataQueryResult,
  bindDataQuerySetting,
  bindDataQueryTable,
  CommandRegistry,
  createApp,
  createDataQueryController,
  createDataQueryPlugin,
  type DataColumn,
  type DataQueryCommandAction,
  dataQueryCommands,
  type DataQueryResult,
  DataTableController,
  MemoryStore,
  nextDataQuerySort,
  normalizeDataQueryParams,
  queryLocalData,
  SettingsController,
  Signal,
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

const columns: DataColumn<ProcessRow>[] = [
  { id: "pid", label: "PID", sortable: true },
  { id: "name", label: "Name", sortable: true },
  { id: "group", label: "Group" },
  { id: "cpu", label: "CPU", sortable: true },
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

  assertEquals(
    queryLocalData(rows, { filters: { group: ["shell"], cpu: null }, pageSize: 10 }).rows.map((row) => row.pid),
    [2],
  );
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

Deno.test("bindDataQueryParams debounces signal changes and loads query params", async () => {
  const loaded: string[] = [];
  const params = new Signal({ query: "runtime", pageSize: 2 });
  const controller = createDataQueryController<ProcessRow>({
    loader: ({ params }) => {
      loaded.push(params.query);
      return queryLocalData(rows, params, { searchable: ["name", "group"] });
    },
  });
  const binding = bindDataQueryParams(controller, params, {
    initialLoad: false,
    debounceMs: 5,
  });

  params.value = { query: "shell", pageSize: 2 };
  params.value = { query: "runtime", pageSize: 2 };
  await delay(20);

  assertEquals(loaded, ["runtime"]);
  assertEquals(controller.result.peek().rows.map((row) => row.pid), [10, 101]);
  assertEquals(binding.inspect().pending, false);

  binding.dispose();
  params.value = { query: "shell", pageSize: 2 };
  await delay(10);
  assertEquals(loaded, ["runtime"]);
  controller.dispose();
});

Deno.test("bindDataQueryResult projects query rows into a row signal", async () => {
  const projected = new Signal<readonly ProcessRow[]>([]);
  const controller = createDataQueryController<ProcessRow>({
    initialParams: { query: "runtime", pageSize: 2 },
    loader: ({ params }) => queryLocalData(rows, params, { searchable: ["name", "group"] }),
  });

  await controller.reload();
  const binding = bindDataQueryResult(controller, projected);
  assertEquals(projected.peek().map((row) => row.pid), [10, 101]);

  await controller.setQuery("shell");
  assertEquals(projected.peek().map((row) => row.pid), [2]);
  assertEquals(binding.inspect(), {
    disposed: false,
    rowCount: 1,
    totalRows: 1,
    page: 0,
    pageSize: 2,
    pageCount: 1,
  });

  binding.dispose();
  await controller.setQuery("runtime");
  assertEquals(projected.peek().map((row) => row.pid), [2]);
  controller.dispose();
});

Deno.test("bindDataQueryTable projects remote query pages into a table without local double filtering", async () => {
  const controller = createDataQueryController<ProcessRow>({
    initialParams: {
      query: "runtime",
      sort: { field: "cpu", direction: "desc" },
      pageSize: 2,
    },
    loader: ({ params }) => queryLocalData(rows, params, { searchable: ["name", "group"] }),
  });
  const table = new DataTableController({
    rows: [],
    columns,
    rowKey: (row) => String(row.pid),
    initialState: {
      query: "local-filter-that-would-hide-everything",
      sort: { columnId: "name", direction: "asc" },
      page: 4,
      pageSize: 1,
      selectedKey: "33",
    },
  });

  await controller.reload();
  const binding = bindDataQueryTable(controller, table);

  assertEquals(table.rows.peek().map((row) => row.pid), [101, 33]);
  assertEquals(table.view.peek().rows.map((row) => row.pid), [101, 33]);
  assertEquals(table.inspect().query, "");
  assertEquals(table.inspect().sort, undefined);
  assertEquals(table.inspect().page, 0);
  assertEquals(table.inspect().pageSize, 2);
  assertEquals(table.selectedKey(), "33");
  assertEquals(binding.inspect().totalRows, 3);

  binding.dispose();
  table.dispose();
  controller.dispose();
});

Deno.test("bindDataQuerySetting restores persists and sanitizes query params", async () => {
  const store = new MemoryStore<unknown>();
  await store.set(
    "prefs.process-query",
    JSON.stringify({
      query: "runtime",
      filters: { group: "runtime", empty: "" },
      sort: { field: "cpu", direction: "sideways" },
      page: -2,
      pageSize: 0,
    }),
  );
  const settings = new SettingsController({ store, namespace: "prefs" });
  const controller = createDataQueryController<ProcessRow, { group?: string; empty?: string }>({
    initialParams: { query: "shell", pageSize: 10 },
    loader: ({ params }) => queryLocalData(rows, params, { searchable: ["name", "group"] }),
  });
  const binding = bindDataQuerySetting(controller, settings, {
    key: "process-query",
    serialize: (value) => JSON.stringify(value),
    deserialize: (value: string) => JSON.parse(value),
  });

  await settings.ready();
  assertEquals(controller.params.peek(), {
    query: "runtime",
    filters: { group: "runtime" },
    page: 0,
    pageSize: 1,
  });
  assertEquals(binding.setting.value.peek(), {
    query: "runtime",
    filters: { group: "runtime" },
    page: 0,
    pageSize: 1,
  });

  await controller.setQuery("renderer");
  await controller.setPageSize(25);
  await controller.setSort({ field: "pid", direction: "desc" });
  await Promise.resolve();
  await settings.flush();
  assertEquals(
    await store.get("prefs.process-query"),
    JSON.stringify({
      query: "renderer",
      filters: { group: "runtime" },
      sort: { field: "pid", direction: "desc" },
      page: 0,
      pageSize: 25,
    }),
  );

  binding.dispose();
  await controller.setQuery("shell");
  await Promise.resolve();
  assertEquals(binding.setting.value.peek().query, "renderer");
  controller.dispose();
});

Deno.test("createDataQueryPlugin installs query commands settings table binding and keymap", async () => {
  const store = new MemoryStore<unknown>();
  const settings = new SettingsController({ store, namespace: "prefs" });
  const controller = createDataQueryController<ProcessRow>({
    initialParams: { query: "runtime", pageSize: 2 },
    loader: ({ params }) => queryLocalData(rows, params, { searchable: ["name", "group"] }),
  });
  const table = new DataTableController({
    rows: [],
    columns,
    rowKey: (row) => String(row.pid),
  });
  const app = createApp<DataQueryCommandAction<ProcessRow>>({ tui: { destroy() {} } as never });
  const actions: DataQueryCommandAction<ProcessRow>[] = [];
  app.onAction((action) => void actions.push(action));
  const plugin = createDataQueryPlugin({
    id: "processes",
    label: "Processes",
    controller,
    table,
    settings,
    persistParams: { key: "process-query" },
    commands: {
      idPrefix: "processes.query",
      group: "processes",
      includeSortCommands: true,
      sortFields: [{ field: "cpu", label: "CPU" }],
    },
    mirrorKeymap: { includeDisabled: true },
  });

  const dispose = app.use(plugin);
  assertEquals(app.hasPlugin("processes"), true);
  assertEquals(plugin.inspect().tableBindingEnabled, true);
  assertEquals(plugin.inspect().paramsPersistenceEnabled, true);
  assertEquals(app.keymap.inspect().count, 2);

  await app.executeCommand("processes.query.reload");
  assertEquals(actions.at(-1)?.type, "dataQuery.loaded");
  assertEquals(table.rows.peek().map((row) => row.pid), [10, 101]);

  await app.executeCommand("processes.query.sort.cpu");
  await settings.flush();
  assertEquals(controller.params.peek().sort, { field: "cpu", direction: "asc" });
  assertEquals(await store.get("prefs.process-query"), {
    query: "runtime",
    filters: {},
    sort: { field: "cpu", direction: "asc" },
    page: 0,
    pageSize: 2,
  });

  dispose();
  assertEquals(app.hasPlugin("processes"), false);
  assertEquals(app.commands.inspect().count, 0);
  assertEquals(app.keymap.inspect().count, 0);
  table.dispose();
  controller.dispose();
});

Deno.test("createDataQueryPlugin rolls back installed surfaces when custom install fails", () => {
  const controller = createDataQueryController<ProcessRow>({
    loader: ({ params }) => queryLocalData(rows, params),
  });
  const app = createApp<DataQueryCommandAction<ProcessRow>>({ tui: { destroy() {} } as never });
  const plugin = createDataQueryPlugin({
    controller,
    commands: { idPrefix: "failing.query" },
    install: () => {
      throw new Error("install failed");
    },
  });

  let message = "";
  try {
    app.use(plugin);
  } catch (error) {
    message = error instanceof Error ? error.message : String(error);
  }

  assertEquals(message, "install failed");
  assertEquals(app.commands.inspect().count, 0);
  assertEquals(app.hasPlugin("data-query"), false);
  controller.dispose();
});

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
