// Copyright 2023 Im-Beast. MIT license.
import {
  normalizeWorkbenchWorkspaceName,
  type WorkbenchWorkspace,
  type WorkbenchWorkspaceWindow,
} from "../src/app/mod.ts";
import type { ModalContent } from "../src/components/modal.ts";

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

/** Builds the save-workspace prompt content for the workbench modal controller. */
export function saveWorkspaceModalContent(body: string[]): ModalContent {
  return {
    title: "Save Workspace",
    tone: "confirm",
    body,
    actions: [
      { id: "workspace-cancel", label: "Cancel" },
      { id: "workspace-save", label: "Save", default: true },
    ],
  };
}

/** Builds the rename-workspace prompt content for the workbench modal controller. */
export function renameWorkspaceModalContent(body: string[]): ModalContent {
  return {
    title: "Rename Workspace",
    tone: "confirm",
    body,
    actions: [
      { id: "workspace-cancel", label: "Cancel" },
      { id: "workspace-rename", label: "Rename", default: true },
    ],
  };
}

/** Builds the delete-workspace confirmation content for the workbench modal controller. */
export function deleteWorkspaceModalContent(
  workspace: Pick<WorkbenchWorkspace, "name" | "visualizationIds">,
): ModalContent {
  return {
    title: "Delete Workspace?",
    tone: "warning",
    body: [
      `Delete saved workspace "${workspace.name}"?`,
      `${workspace.visualizationIds.length} widget window(s) saved in this workspace.`,
      "This removes the saved workspace only; it does not close any currently open windows.",
    ],
    actions: [
      { id: "workspace-cancel", label: "Cancel" },
      { id: "workspace-delete", label: "Delete", destructive: true, default: true },
    ],
  };
}

/** Builds success content after a workspace is saved. */
export function workspaceSavedModalContent(name: string, visualizationCount: number): ModalContent {
  return {
    title: "Workspace Saved",
    tone: "success",
    body: [name, `${Math.max(0, Math.floor(visualizationCount))} widget window(s) saved.`],
    actions: [{ id: "dismiss", label: "OK", default: true }],
  };
}

/** Builds warning content for a missing workspace. */
export function workspaceMissingModalContent(name?: string | null): ModalContent {
  return {
    title: "Workspace Missing",
    tone: "warning",
    body: [`Workspace "${name ?? "unknown"}" no longer exists.`],
    actions: [{ id: "dismiss", label: "OK", default: true }],
  };
}

/** Builds success content after a workspace is renamed. */
export function workspaceRenamedModalContent(
  previousName: string,
  nextName: string,
  visualizationCount: number,
): ModalContent {
  return {
    title: "Workspace Renamed",
    tone: "success",
    body: [`${previousName} -> ${nextName}`, `${Math.max(0, Math.floor(visualizationCount))} widget window(s).`],
    actions: [{ id: "dismiss", label: "OK", default: true }],
  };
}

/** Builds success content after a workspace is deleted. */
export function workspaceDeletedModalContent(name: string): ModalContent {
  return {
    title: "Workspace Deleted",
    tone: "success",
    body: [name, "Saved workspace removed."],
    actions: [{ id: "dismiss", label: "OK", default: true }],
  };
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
