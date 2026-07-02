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

/** Mode for a workspace name-editing modal. */
export type WorkspaceNameModalMode = "save" | "rename";

/** Inputs for the workspace name modal body projection. */
export interface WorkspaceNameModalBodyOptions {
  mode: WorkspaceNameModalMode;
  draftName: string;
  cursor?: string;
  storageLabel: string;
  loadedVisualizationIds?: readonly string[];
  targetWorkspace?: Pick<WorkbenchWorkspace, "name" | "visualizationIds"> | null;
  targetName?: string | null;
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
  return workspaceMenuLabelsInto([], entries);
}

/** Projects display labels into a caller-owned buffer for redraw-heavy menus. */
export function workspaceMenuLabelsInto(
  target: string[],
  entries: readonly WorkspaceMenuEntry[],
): string[] {
  target.length = entries.length;
  for (let index = 0; index < entries.length; index++) {
    target[index] = entries[index]!.label;
  }
  return target;
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
  const ids = new Array<string>(windows.length);
  for (let index = 0; index < windows.length; index++) {
    ids[index] = windows[index]!.visualizationId;
  }
  return ids;
}

/** Builds the modal body for save/rename workspace prompts. */
export function workspaceNameModalBody(options: WorkspaceNameModalBodyOptions): string[] {
  const cursor = options.cursor ?? "";
  if (options.mode === "rename") {
    return [
      "Rename the saved workspace.",
      `Name: ${options.draftName}${cursor}`,
      `Current: ${options.targetWorkspace?.name ?? options.targetName ?? "unknown"}`,
      `Windows: ${options.targetWorkspace?.visualizationIds.length ?? 0}`,
      `Storage: ${options.storageLabel}`,
    ];
  }

  const loaded = options.loadedVisualizationIds ?? [];
  return [
    "Name the current set of loaded widget windows.",
    `Name: ${options.draftName}${cursor}`,
    `Windows: ${loaded.length === 0 ? "none" : loaded.join(", ")}`,
    `Storage: ${options.storageLabel}`,
  ];
}
