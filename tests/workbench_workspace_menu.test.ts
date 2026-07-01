// Copyright 2023 Im-Beast. MIT license.
import { assertEquals } from "./deps.ts";
import {
  buildWorkspaceMenuEntries,
  currentWorkspaceVisualizationIds,
  defaultWorkspaceName,
  normalizeWorkspaceName,
  workspaceMenuLabels,
} from "../app/workbench_workspace_menu.ts";
import type { WorkbenchWorkspace, WorkbenchWorkspaceWindow } from "../src/app/mod.ts";

Deno.test("buildWorkspaceMenuEntries includes save and empty states", () => {
  const entries = buildWorkspaceMenuEntries([]);
  assertEquals(entries, [
    { label: "[+] Save Current...", action: "save" },
    { label: "    No saved workspaces", action: "empty" },
  ]);
  assertEquals(workspaceMenuLabels(entries), ["[+] Save Current...", "    No saved workspaces"]);
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
