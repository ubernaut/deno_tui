// Copyright 2023 Im-Beast. MIT license.
import { assertEquals, assertStrictEquals } from "./deps.ts";
import {
  buildWorkspaceMenuEntries,
  buildWorkspaceMenuEntriesInto,
  currentWorkspaceVisualizationIds,
  currentWorkspaceWindows,
  defaultWorkspaceName,
  deleteWorkspaceModalContent,
  deleteWorkspaceState,
  normalizeWorkspaceName,
  renameWorkspaceModalContent,
  renameWorkspaceState,
  resolveWorkspaceMenuCommand,
  saveWorkspaceModalContent,
  saveWorkspaceState,
  workbenchWindowClosePlan,
  workspaceDeletedModalContent,
  workspaceLoadClosePlan,
  type WorkspaceMenuEntry,
  workspaceMenuLabels,
  workspaceMenuLabelsInto,
  workspaceMissingModalContent,
  workspaceNameModalBody,
  workspaceRenamedModalContent,
  workspaceSavedModalContent,
} from "../app/workbench_workspace_menu.ts";
import type { WorkbenchWorkspace, WorkbenchWorkspaceWindow } from "../src/app/mod.ts";

Deno.test("buildWorkspaceMenuEntries includes save and empty states", () => {
  const entries = buildWorkspaceMenuEntries([]);
  assertEquals(entries, [
    { label: "[+] Save Current...", action: "save" },
    { label: "    No saved workspaces", action: "empty" },
  ]);
  assertEquals(workspaceMenuLabels(entries), ["[+] Save Current...", "    No saved workspaces"]);
  const target = ["stale"];
  assertEquals(workspaceMenuLabelsInto(target, entries), ["[+] Save Current...", "    No saved workspaces"]);
  assertEquals(target, ["[+] Save Current...", "    No saved workspaces"]);
});

Deno.test("buildWorkspaceMenuEntries expands each workspace into open rename and delete actions", () => {
  const workspaces: WorkbenchWorkspace[] = [
    { name: "Alpha", visualizationIds: ["cpu", "gpu"], savedAt: 10 },
    { name: "Beta", visualizationIds: ["network"], savedAt: 20 },
  ];

  assertEquals(buildWorkspaceMenuEntries(workspaces), [
    { label: "[+] Save Current...", action: "save" },
    { label: "[>] Open Alpha (2)", action: "open", workspaceName: "Alpha" },
    { label: "[~] Rename Alpha", action: "rename", workspaceName: "Alpha" },
    { label: "[x] Delete Alpha", action: "delete", workspaceName: "Alpha" },
    { label: "[>] Open Beta (1)", action: "open", workspaceName: "Beta" },
    { label: "[~] Rename Beta", action: "rename", workspaceName: "Beta" },
    { label: "[x] Delete Beta", action: "delete", workspaceName: "Beta" },
  ]);
});

Deno.test("resolveWorkspaceMenuCommand maps entries to host commands", () => {
  const workspace = { name: "Alpha", visualizationIds: ["cpu"], savedAt: 10 };
  const find = (name: string | undefined) => name === "Alpha" ? workspace : undefined;

  assertEquals(resolveWorkspaceMenuCommand(undefined, find), { action: "none" });
  assertEquals(resolveWorkspaceMenuCommand({ label: "empty", action: "empty" }, find), { action: "none" });
  assertEquals(resolveWorkspaceMenuCommand({ label: "save", action: "save" }, find), { action: "save" });
  assertEquals(resolveWorkspaceMenuCommand({ label: "open", action: "open", workspaceName: "Alpha" }, find), {
    action: "open",
    workspace,
  });
  assertEquals(resolveWorkspaceMenuCommand({ label: "rename", action: "rename", workspaceName: "Alpha" }, find), {
    action: "rename",
    workspace,
  });
  assertEquals(resolveWorkspaceMenuCommand({ label: "delete", action: "delete", workspaceName: "Alpha" }, find), {
    action: "delete",
    workspace,
  });
  assertEquals(resolveWorkspaceMenuCommand({ label: "missing", action: "open", workspaceName: "Beta" }, find), {
    action: "none",
  });
});

Deno.test("buildWorkspaceMenuEntriesInto reuses and trims caller-owned entries", () => {
  const workspaces: WorkbenchWorkspace[] = [
    { name: "Alpha", visualizationIds: ["cpu", "gpu"], savedAt: 10 },
  ];
  const target: WorkspaceMenuEntry[] = [
    { label: "stale", action: "empty", workspaceName: "old" },
    { label: "stale", action: "empty", workspaceName: "old" },
    { label: "stale", action: "empty", workspaceName: "old" },
    { label: "stale", action: "empty", workspaceName: "old" },
    { label: "trim", action: "empty" },
  ];
  const firstEntry = target[0];
  const secondEntry = target[1];

  assertEquals(buildWorkspaceMenuEntriesInto(target, workspaces), [
    { label: "[+] Save Current...", action: "save" },
    { label: "[>] Open Alpha (2)", action: "open", workspaceName: "Alpha" },
    { label: "[~] Rename Alpha", action: "rename", workspaceName: "Alpha" },
    { label: "[x] Delete Alpha", action: "delete", workspaceName: "Alpha" },
  ]);
  assertEquals(target.length, 4);
  assertStrictEquals(target[0], firstEntry);
  assertStrictEquals(target[1], secondEntry);
  assertEquals(target[0]?.workspaceName, undefined);

  assertEquals(buildWorkspaceMenuEntriesInto(target, []), [
    { label: "[+] Save Current...", action: "save" },
    { label: "    No saved workspaces", action: "empty" },
  ]);
  assertEquals(target.length, 2);
  assertStrictEquals(target[0], firstEntry);
  assertStrictEquals(target[1], secondEntry);
  assertEquals(target[1]?.workspaceName, undefined);
});

Deno.test("workspace name helpers normalize names with count-based fallbacks", () => {
  assertEquals(defaultWorkspaceName(0), "Workspace 1");
  assertEquals(defaultWorkspaceName(2.8), "Workspace 3");
  assertEquals(defaultWorkspaceName(-10), "Workspace 1");
  assertEquals(normalizeWorkspaceName("  Demo   Wall ", 3), "Demo Wall");
  assertEquals(normalizeWorkspaceName("   ", 3), "Workspace 4");
});

Deno.test("currentWorkspaceVisualizationIds preserves window order", () => {
  const windows: WorkbenchWorkspaceWindow[] = [
    { visualizationId: "gpu" },
    { visualizationId: "cpu", ascii: { style: "blocks" } },
  ];
  assertEquals(currentWorkspaceVisualizationIds(windows), ["gpu", "cpu"]);
});

Deno.test("currentWorkspaceWindows projects active visualization windows only", () => {
  const asciiByWindow: Record<string, { style: string }> = {
    "viz:cpu": { style: "blocks" },
    "viz:gpu": { style: "glyphs" },
  };
  const visualizationByWindow: Partial<Record<string, string>> = {
    "viz:cpu": "cpu-monitor",
    "viz:gpu": "gpu-monitor",
  };
  const windows = currentWorkspaceWindows({
    windowIds: ["inspector", "viz:cpu", "viz:missing", "viz:gpu"],
    isVisualizationWindow: (id) => id.startsWith("viz:"),
    visualizationIdForWindow: (id) => visualizationByWindow[id],
    asciiForWindow: (id) => ({ ...asciiByWindow[id]! }),
  });

  assertEquals(windows, [
    { visualizationId: "cpu-monitor", ascii: { style: "blocks" } },
    { visualizationId: "gpu-monitor", ascii: { style: "glyphs" } },
  ]);
  assertEquals(windows[0]?.ascii === asciiByWindow["viz:cpu"], false);
});

Deno.test("workspaceLoadClosePlan identifies visualization cleanup and trims selected tiles", () => {
  const windowIds = ["explorer", "viz:cpu", "controls", "viz:gpu"] as const;
  type TestWindowId = typeof windowIds[number];
  const selected = {
    "viz:cpu": "cpu 0",
    "viz:gpu": "gpu",
  };

  const plan = workspaceLoadClosePlan({
    windowIds,
    isVisualizationWindow: (id: TestWindowId): id is Extract<TestWindowId, `viz:${string}`> => id.startsWith("viz:"),
    selectedVisualizationTiles: selected,
  });

  assertEquals(plan, {
    windowIds: ["explorer", "viz:cpu", "controls", "viz:gpu"],
    visualizationWindowIds: ["viz:cpu", "viz:gpu"],
    selectedVisualizationTiles: {},
    selectedVisualizationTilesChanged: true,
  });
  assertEquals(selected, {
    "viz:cpu": "cpu 0",
    "viz:gpu": "gpu",
  });
});

Deno.test("workspaceLoadClosePlan preserves selections when no visualization window owns them", () => {
  type TestWindowId = "explorer" | "controls";
  const plan = workspaceLoadClosePlan({
    windowIds: ["explorer", "controls"] as const,
    isVisualizationWindow: (_id: TestWindowId): _id is never => false,
    selectedVisualizationTiles: { "viz:cpu": "cpu 1" },
  });

  assertEquals(plan, {
    windowIds: ["explorer", "controls"],
    visualizationWindowIds: [],
    selectedVisualizationTiles: { "viz:cpu": "cpu 1" },
    selectedVisualizationTilesChanged: false,
  });
});

Deno.test("workbenchWindowClosePlan trims visualization selection and requests renderer cleanup", () => {
  type TestWindowId = "controls" | "terminalShell" | "viz:cpu";
  const selected = { "viz:cpu": "cpu 42", "viz:gpu": "gpu" };

  const plan = workbenchWindowClosePlan({
    windowId: "viz:cpu" as TestWindowId,
    isVisualizationWindow: (id: TestWindowId): id is Extract<TestWindowId, `viz:${string}`> => id.startsWith("viz:"),
    isTerminalShellWindow: (id) => id === "terminalShell",
    selectedVisualizationTiles: selected,
  });

  assertEquals(plan, {
    windowId: "viz:cpu",
    visualizationWindowId: "viz:cpu",
    stopTerminalShell: false,
    selectedVisualizationTiles: { "viz:gpu": "gpu" },
    selectedVisualizationTilesChanged: true,
  });
  assertEquals(selected, { "viz:cpu": "cpu 42", "viz:gpu": "gpu" });
});

Deno.test("workbenchWindowClosePlan identifies terminal shell and preserves non-visual selections", () => {
  type TestWindowId = "controls" | "terminalShell" | "viz:cpu";
  const selected = { "viz:cpu": "cpu 42" };
  const isVisualizationWindow = (id: TestWindowId): id is Extract<TestWindowId, `viz:${string}`> =>
    id.startsWith("viz:");

  assertEquals(
    workbenchWindowClosePlan({
      windowId: "terminalShell" as TestWindowId,
      isVisualizationWindow,
      isTerminalShellWindow: (id) => id === "terminalShell",
      selectedVisualizationTiles: selected,
    }),
    {
      windowId: "terminalShell",
      visualizationWindowId: undefined,
      stopTerminalShell: true,
      selectedVisualizationTiles: { "viz:cpu": "cpu 42" },
      selectedVisualizationTilesChanged: false,
    },
  );

  assertEquals(
    workbenchWindowClosePlan({
      windowId: "controls" as TestWindowId,
      isVisualizationWindow,
      isTerminalShellWindow: (id) => id === "terminalShell",
      selectedVisualizationTiles: selected,
    }),
    {
      windowId: "controls",
      visualizationWindowId: undefined,
      stopTerminalShell: false,
      selectedVisualizationTiles: { "viz:cpu": "cpu 42" },
      selectedVisualizationTilesChanged: false,
    },
  );
});

Deno.test("workspace state transitions save rename and delete workspaces", () => {
  const existing: WorkbenchWorkspace<{ style: string }>[] = [
    { name: "Alpha", visualizationIds: ["cpu"], savedAt: 10 },
    { name: "Beta", visualizationIds: ["gpu"], savedAt: 20 },
  ];

  const saved = saveWorkspaceState({
    workspaces: existing,
    draftName: "  Ops   Desk ",
    windows: [
      { visualizationId: "cpu", ascii: { style: "blocks" } },
      { visualizationId: "network" },
    ],
    now: 100,
  });
  assertEquals(saved.name, "Ops Desk");
  assertEquals(saved.visualizationIds, ["cpu", "network"]);
  assertEquals(saved.workspace, {
    name: "Ops Desk",
    visualizationIds: ["cpu", "network"],
    windows: [
      { visualizationId: "cpu", ascii: { style: "blocks" } },
      { visualizationId: "network" },
    ],
    savedAt: 100,
  });
  assertEquals(saved.workspaces.map((workspace) => workspace.name), ["Ops Desk", "Alpha", "Beta"]);

  const renamed = renameWorkspaceState({
    workspaces: saved.workspaces,
    targetName: "ops desk",
    draftName: "Night Ops",
    activeWorkspaceName: "Ops Desk",
    now: 120,
  });
  assertEquals(renamed, {
    status: "renamed",
    previousName: "Ops Desk",
    name: "Night Ops",
    visualizationCount: 2,
    activeWorkspaceName: "Night Ops",
    workspaces: [
      {
        name: "Night Ops",
        visualizationIds: ["cpu", "network"],
        windows: [
          { visualizationId: "cpu", ascii: { style: "blocks" } },
          { visualizationId: "network" },
        ],
        savedAt: 120,
      },
      { name: "Alpha", visualizationIds: ["cpu"], savedAt: 10 },
      { name: "Beta", visualizationIds: ["gpu"], savedAt: 20 },
    ],
  });

  if (renamed.status !== "renamed") throw new Error("expected renamed state");
  const deleted = deleteWorkspaceState({
    workspaces: renamed.workspaces,
    targetName: "night ops",
    activeWorkspaceName: "Night Ops",
  });
  assertEquals(deleted, {
    status: "deleted",
    name: "Night Ops",
    activeWorkspaceName: null,
    workspaces: [
      { name: "Alpha", visualizationIds: ["cpu"], savedAt: 10 },
      { name: "Beta", visualizationIds: ["gpu"], savedAt: 20 },
    ],
  });

  assertEquals(renameWorkspaceState({ workspaces: existing, targetName: "missing", draftName: "Nope" }), {
    status: "missing",
    targetName: "missing",
  });
  assertEquals(deleteWorkspaceState({ workspaces: existing, targetName: "missing" }), {
    status: "missing",
    targetName: "missing",
  });
});

Deno.test("workspaceNameModalBody describes save and rename prompts", () => {
  assertEquals(
    workspaceNameModalBody({
      mode: "save",
      draftName: "Ops",
      cursor: "|",
      storageLabel: "IndexedDB",
      loadedVisualizationIds: ["cpu", "gpu"],
    }),
    [
      "Name the current set of loaded widget windows.",
      "Name: Ops|",
      "Windows: cpu, gpu",
      "Storage: IndexedDB",
    ],
  );

  assertEquals(
    workspaceNameModalBody({
      mode: "rename",
      draftName: "Night Ops",
      storageLabel: "Deno JSON fallback",
      targetName: "old",
      targetWorkspace: { name: "Old", visualizationIds: ["cpu", "terminal"] },
    }),
    [
      "Rename the saved workspace.",
      "Name: Night Ops",
      "Current: Old",
      "Windows: 2",
      "Storage: Deno JSON fallback",
    ],
  );
});

Deno.test("workspace modal content helpers project prompts and outcomes", () => {
  assertEquals(saveWorkspaceModalContent(["Name: Ops"]), {
    title: "Save Workspace",
    tone: "confirm",
    body: ["Name: Ops"],
    actions: [
      { id: "workspace-cancel", label: "Cancel" },
      { id: "workspace-save", label: "Save", default: true },
    ],
  });

  assertEquals(renameWorkspaceModalContent(["Name: Night Ops"]), {
    title: "Rename Workspace",
    tone: "confirm",
    body: ["Name: Night Ops"],
    actions: [
      { id: "workspace-cancel", label: "Cancel" },
      { id: "workspace-rename", label: "Rename", default: true },
    ],
  });

  assertEquals(deleteWorkspaceModalContent({ name: "Ops", visualizationIds: ["cpu", "gpu"] }), {
    title: "Delete Workspace?",
    tone: "warning",
    body: [
      'Delete saved workspace "Ops"?',
      "2 widget window(s) saved in this workspace.",
      "This removes the saved workspace only; it does not close any currently open windows.",
    ],
    actions: [
      { id: "workspace-cancel", label: "Cancel" },
      { id: "workspace-delete", label: "Delete", destructive: true, default: true },
    ],
  });

  assertEquals(workspaceSavedModalContent("Ops", 2), {
    title: "Workspace Saved",
    tone: "success",
    body: ["Ops", "2 widget window(s) saved."],
    actions: [{ id: "dismiss", label: "OK", default: true }],
  });
  assertEquals(workspaceMissingModalContent(null), {
    title: "Workspace Missing",
    tone: "warning",
    body: ['Workspace "unknown" no longer exists.'],
    actions: [{ id: "dismiss", label: "OK", default: true }],
  });
  assertEquals(workspaceRenamedModalContent("Ops", "Night Ops", 3), {
    title: "Workspace Renamed",
    tone: "success",
    body: ["Ops -> Night Ops", "3 widget window(s)."],
    actions: [{ id: "dismiss", label: "OK", default: true }],
  });
  assertEquals(workspaceDeletedModalContent("Ops"), {
    title: "Workspace Deleted",
    tone: "success",
    body: ["Ops", "Saved workspace removed."],
    actions: [{ id: "dismiss", label: "OK", default: true }],
  });
});
