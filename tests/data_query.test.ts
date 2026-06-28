import { assertEquals } from "./deps.ts";
import {
  createDataQueryController,
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
