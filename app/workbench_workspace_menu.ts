// Copyright 2023 Im-Beast. MIT license.
import {
  normalizeWorkbenchWorkspaceName,
  type WorkbenchWorkspace,
  type WorkbenchWorkspaceWindow,
} from "../src/app/mod.ts";

/** Workspace menu action supported by the API workbench demo. */
export type WorkspaceMenuAction = "save" | "open" | "rename" | "delete" | "empty";

/** One rendered workspace menu entry. */
export interface WorkspaceMenuEntry {
  label: string;
  action: WorkspaceMenuAction;
  workspaceName?: string;
}

/** Builds the API workbench workspace menu entries from persisted workspace state. */
export function buildWorkspaceMenuEntries(workspaces: readonly WorkbenchWorkspace[]): WorkspaceMenuEntry[] {
  const entries: WorkspaceMenuEntry[] = [{ label: "[+] Save Current...", action: "save" }];
  for (const workspace of workspaces) {
    entries.push(
      {
        label: `[>] Open ${workspace.name} (${workspace.visualizationIds.length})`,
        action: "open",
        workspaceName: workspace.name,
      },
      { label: `[~] Rename ${workspace.name}`, action: "rename", workspaceName: workspace.name },
      { label: `[x] Delete ${workspace.name}`, action: "delete", workspaceName: workspace.name },
    );
  }
  if (workspaces.length === 0) entries.push({ label: "    No saved workspaces", action: "empty" });
  return entries;
}

/** Returns display labels for the workspace menu entries. */
export function workspaceMenuLabels(entries: readonly WorkspaceMenuEntry[]): string[] {
  return entries.map((entry) => entry.label);
}

/** Builds a deterministic fallback workspace name from the saved workspace count. */
export function defaultWorkspaceName(savedWorkspaceCount: number): string {
  return `Workspace ${Math.max(0, Math.floor(savedWorkspaceCount)) + 1}`;
}

/** Normalizes a user-provided workspace name with the API workbench fallback policy. */
export function normalizeWorkspaceName(name: string, savedWorkspaceCount: number): string {
  return normalizeWorkbenchWorkspaceName(name, defaultWorkspaceName(savedWorkspaceCount));
}

/** Returns visualization ids in the same order as saved workspace window entries. */
export function currentWorkspaceVisualizationIds(windows: readonly WorkbenchWorkspaceWindow[]): string[] {
  return windows.map((window) => window.visualizationId);
}
