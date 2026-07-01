import { assertEquals } from "./deps.ts";
import {
  defaultWorkbenchMinimizedState,
  deleteWorkbenchWorkspace,
  findWorkbenchWorkspace,
  normalizeWorkbenchPanelWorkspaceState,
  normalizeWorkbenchWorkspaceName,
  normalizeWorkbenchWorkspaces,
  renameWorkbenchWorkspace,
  upsertWorkbenchWorkspace,
  type WorkbenchWorkspace,
  workbenchWorkspaceWindowEntries,
} from "../src/app/mod.ts";

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
