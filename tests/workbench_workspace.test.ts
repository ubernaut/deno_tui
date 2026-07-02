import { assertEquals } from "./deps.ts";
import {
  appendBoundedWorkbenchLogRow,
  createWorkbenchWorkspaceStore,
  defaultWorkbenchMinimizedState,
  deleteWorkbenchWorkspace,
  findWorkbenchWorkspace,
  loadWorkbenchWorkspaceStorage,
  normalizeWorkbenchPanelWorkspaceState,
  normalizeWorkbenchWorkspaceName,
  normalizeWorkbenchWorkspaces,
  normalizeWorkbenchWorkspaceStorage,
  persistWorkbenchWorkspaceStorage,
  renameWorkbenchWorkspace,
  serializeWorkbenchWorkspaces,
  upsertWorkbenchWorkspace,
  WORKBENCH_WORKSPACE_STORAGE_VERSION,
  type WorkbenchWorkspace,
  workbenchWorkspaceWindowEntries,
} from "../src/app/mod.ts";
import { MemoryStore } from "../src/runtime/storage.ts";

Deno.test("workbench log helpers append bounded immutable rows", () => {
  const rows = ["one", "two", "three"];
  const next = appendBoundedWorkbenchLogRow(rows, "four", 3);

  assertEquals(next, ["two", "three", "four"]);
  assertEquals(rows, ["one", "two", "three"]);
  assertEquals(appendBoundedWorkbenchLogRow([], "only", 0), ["only"]);
});

Deno.test("workbench workspace helpers normalize names and panel state", () => {
  const panelIds = ["left", "right", "logs"] as const;
  assertEquals(normalizeWorkbenchWorkspaceName("  Demo    Layout  "), "Demo Layout");
  assertEquals(defaultWorkbenchMinimizedState(panelIds, { left: true, logs: false }), {
    left: true,
    right: false,
    logs: false,
  });

  assertEquals(
    normalizeWorkbenchPanelWorkspaceState({
      active: "right",
      maximized: "left",
      minimized: { left: true, right: true, logs: true },
      tileDensity: 99,
    }, {
      panelIds,
      defaultActive: "left",
      minTileDensity: -2,
      maxTileDensity: 2,
    }),
    {
      active: "right",
      maximized: "left",
      minimized: { left: false, right: false, logs: true },
      tileDensity: 2,
    },
  );
});

Deno.test("workbench workspace helpers normalize saved and legacy workspace entries", () => {
  const workspaces = normalizeWorkbenchWorkspaces([
    {
      name: "  Alpha  ",
      visualizationIds: ["cpu", "missing"],
      savedAt: 10,
    },
    {
      name: "Beta",
      windows: [
        { visualizationId: "gpu", ascii: { style: "blocks" } },
        { visualizationId: "missing", ascii: { style: "glyphs" } },
      ],
      savedAt: 20,
    },
  ], {
    validVisualizationIds: ["cpu", "gpu"],
    normalizeAscii: (value) => typeof value === "object" && value ? value as { style: string } : undefined,
  });

  assertEquals(workspaces, [
    { name: "Alpha", visualizationIds: ["cpu"], windows: undefined, savedAt: 10 },
    {
      name: "Beta",
      visualizationIds: ["gpu"],
      windows: [{ visualizationId: "gpu", ascii: { style: "blocks" } }],
      savedAt: 20,
    },
  ]);
  assertEquals(workbenchWorkspaceWindowEntries(workspaces[0]!, { validVisualizationIds: ["cpu", "gpu"] }), [
    { visualizationId: "cpu" },
  ]);
});

Deno.test("workbench workspace helpers serialize versioned storage and migrate legacy arrays", () => {
  const workspace: WorkbenchWorkspace<{ style: string }> = {
    name: "Alpha",
    visualizationIds: ["cpu"],
    windows: [{ visualizationId: "cpu", ascii: { style: "blocks" } }],
    savedAt: 10,
  };
  const storage = serializeWorkbenchWorkspaces([workspace], 20);
  workspace.visualizationIds.push("gpu");
  workspace.windows?.push({ visualizationId: "gpu", ascii: { style: "glyphs" } });

  assertEquals(storage, {
    version: WORKBENCH_WORKSPACE_STORAGE_VERSION,
    savedAt: 20,
    workspaces: [{
      name: "Alpha",
      visualizationIds: ["cpu"],
      windows: [{ visualizationId: "cpu", ascii: { style: "blocks" } }],
      savedAt: 10,
    }],
  });
  assertEquals(
    normalizeWorkbenchWorkspaceStorage(storage, {
      validVisualizationIds: ["cpu", "gpu"],
      normalizeAscii: (value) => typeof value === "object" && value ? value as { style: string } : undefined,
    }),
    storage.workspaces,
  );
  assertEquals(
    normalizeWorkbenchWorkspaceStorage([{
      name: "Legacy",
      visualizationIds: ["gpu", "missing"],
      savedAt: 30,
    }], { validVisualizationIds: ["cpu", "gpu"] }),
    [{ name: "Legacy", visualizationIds: ["gpu"], windows: undefined, savedAt: 30 }],
  );
});

Deno.test("workbench workspace helpers upsert rename find and delete by case-insensitive name", () => {
  const base: WorkbenchWorkspace[] = [
    { name: "Alpha", visualizationIds: ["cpu"], savedAt: 1 },
    { name: "Beta", visualizationIds: ["gpu"], savedAt: 2 },
  ];

  const upserted = upsertWorkbenchWorkspace(base, { name: "alpha", visualizationIds: ["net"], savedAt: 3 });
  assertEquals(upserted.map((workspace) => workspace.name), ["alpha", "Beta"]);
  assertEquals(findWorkbenchWorkspace(upserted, "ALPHA")?.visualizationIds, ["net"]);

  const renamed = renameWorkbenchWorkspace(upserted, "alpha", "Beta", 4);
  assertEquals(renamed, [{ name: "Beta", visualizationIds: ["net"], savedAt: 4 }]);
  assertEquals(deleteWorkbenchWorkspace(renamed, "beta"), []);
});

Deno.test("workbench workspace storage helpers load normalize and persist envelopes", async () => {
  const store = new MemoryStore<unknown>();
  await store.set("workspaces", [{
    name: "Demo",
    visualizationIds: ["cpu", "missing"],
    savedAt: 10,
  }]);

  const options = {
    key: "workspaces",
    store,
    validVisualizationIds: ["cpu"],
  };
  const loaded = await loadWorkbenchWorkspaceStorage(options);
  await persistWorkbenchWorkspaceStorage(loaded, options, 20);

  assertEquals(loaded, [{ name: "Demo", visualizationIds: ["cpu"], windows: undefined, savedAt: 10 }]);
  assertEquals(await store.get("workspaces"), {
    version: WORKBENCH_WORKSPACE_STORAGE_VERSION,
    savedAt: 20,
    workspaces: loaded,
  });
});

Deno.test("workbench workspace storage helpers report recoverable load and persist failures", async () => {
  const diagnostics: unknown[] = [];
  const failingStore = {
    get: async () => {
      throw new Error("read failed");
    },
    set: async () => {
      throw new Error("write failed");
    },
    delete: async () => {},
  };
  const options = {
    key: "workspaces",
    store: failingStore,
    validVisualizationIds: ["cpu"],
    diagnostics: { report: (entry: unknown) => diagnostics.push(entry) },
    diagnosticSource: "test-workbench",
    storageLabel: "Memory",
  };

  assertEquals(await loadWorkbenchWorkspaceStorage(options), []);
  await persistWorkbenchWorkspaceStorage([], options, 30);

  assertEquals(diagnostics.length, 2);
  assertEquals((diagnostics[0] as { source: string }).source, "test-workbench");
  assertEquals((diagnostics[0] as { code: string }).code, "memory-workspace-load-failed");
  assertEquals((diagnostics[1] as { code: string }).code, "memory-workspace-persist-failed");
});

Deno.test("workbench workspace store factory falls back to json when indexeddb is unavailable", () => {
  const store = createWorkbenchWorkspaceStore({
    databaseName: "workbench-test",
    storeName: "workspaces",
    fallbackPath: ".workbench-test.json",
    hasIndexedDb: false,
  });

  assertEquals(store.constructor.name, "JsonFileStore");
});
