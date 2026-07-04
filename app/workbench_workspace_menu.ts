// Copyright 2023 Im-Beast. MIT license.
import {
  deleteWorkbenchWorkspace,
  findWorkbenchWorkspace,
  normalizeWorkbenchWorkspaceName,
  renameWorkbenchWorkspace,
  upsertWorkbenchWorkspace,
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

/** Resolved workspace menu command for a host renderer to execute. */
export type WorkspaceMenuCommand<TWorkspace extends Pick<WorkbenchWorkspace, "name"> = WorkbenchWorkspace> =
  | { action: "none" }
  | { action: "save" }
  | { action: "open" | "rename" | "delete"; workspace: TWorkspace };

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

/** Inputs for projecting currently loaded visualization windows into persisted workspace windows. */
export interface CurrentWorkspaceWindowsOptions<TWindowId extends string, TAscii = unknown> {
  windowIds: readonly TWindowId[];
  isVisualizationWindow: (id: TWindowId) => boolean;
  visualizationIdForWindow: (id: TWindowId) => string | undefined;
  asciiForWindow: (id: TWindowId) => TAscii;
}

/** Inputs for saving the current loaded windows as a workspace. */
export interface SaveWorkspaceStateOptions<TAscii = unknown> {
  workspaces: readonly WorkbenchWorkspace<TAscii>[];
  draftName: string;
  windows: readonly WorkbenchWorkspaceWindow<TAscii>[];
  now?: number;
}

/** Result of saving the current loaded windows as a workspace. */
export interface SaveWorkspaceStateResult<TAscii = unknown> {
  name: string;
  visualizationIds: string[];
  workspace: WorkbenchWorkspace<TAscii>;
  workspaces: WorkbenchWorkspace<TAscii>[];
}

/** Inputs for renaming a saved workspace. */
export interface RenameWorkspaceStateOptions<TAscii = unknown> {
  workspaces: readonly WorkbenchWorkspace<TAscii>[];
  targetName: string | null | undefined;
  draftName: string;
  activeWorkspaceName?: string | null;
  now?: number;
}

/** Result of renaming a saved workspace. */
export type RenameWorkspaceStateResult<TAscii = unknown> =
  | {
    status: "renamed";
    previousName: string;
    name: string;
    visualizationCount: number;
    workspaces: WorkbenchWorkspace<TAscii>[];
    activeWorkspaceName: string | null | undefined;
  }
  | { status: "missing"; targetName: string | null | undefined };

/** Inputs for deleting a saved workspace. */
export interface DeleteWorkspaceStateOptions<TAscii = unknown> {
  workspaces: readonly WorkbenchWorkspace<TAscii>[];
  targetName: string | null | undefined;
  activeWorkspaceName?: string | null;
}

/** Result of deleting a saved workspace. */
export type DeleteWorkspaceStateResult<TAscii = unknown> =
  | {
    status: "deleted";
    name: string;
    workspaces: WorkbenchWorkspace<TAscii>[];
    activeWorkspaceName: string | null | undefined;
  }
  | { status: "missing"; targetName: string | null | undefined };

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
  return buildWorkspaceMenuEntriesInto([], workspaces);
}

/** Projects API workbench workspace menu entries into a caller-owned buffer. */
export function buildWorkspaceMenuEntriesInto(
  target: WorkspaceMenuEntry[],
  workspaces: readonly WorkbenchWorkspace[],
): WorkspaceMenuEntry[] {
  let written = 0;
  target[written] = workspaceMenuEntry(target[written], "[+] Save Current...", "save");
  written += 1;
  for (const workspace of workspaces) {
    target[written] = workspaceMenuEntry(
      target[written],
      `[>] Open ${workspace.name} (${workspace.visualizationIds.length})`,
      "open",
      workspace.name,
    );
    written += 1;
    target[written] = workspaceMenuEntry(target[written], `[~] Rename ${workspace.name}`, "rename", workspace.name);
    written += 1;
    target[written] = workspaceMenuEntry(target[written], `[x] Delete ${workspace.name}`, "delete", workspace.name);
    written += 1;
  }
  if (workspaces.length === 0) {
    target[written] = workspaceMenuEntry(target[written], "    No saved workspaces", "empty");
    written += 1;
  }
  target.length = written;
  return target;
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

/** Resolves a selected workspace menu entry into a side-effect-free command. */
export function resolveWorkspaceMenuCommand<TWorkspace extends Pick<WorkbenchWorkspace, "name">>(
  entry: WorkspaceMenuEntry | undefined,
  findWorkspace: (name: string | undefined) => TWorkspace | undefined,
): WorkspaceMenuCommand<TWorkspace> {
  if (!entry || entry.action === "empty") return { action: "none" };
  if (entry.action === "save") return { action: "save" };
  const workspace = findWorkspace(entry.workspaceName);
  if (!workspace) return { action: "none" };
  return { action: entry.action, workspace };
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

/** Projects currently loaded visualization windows into a fresh persisted workspace window snapshot. */
export function currentWorkspaceWindows<TWindowId extends string, TAscii = unknown>(
  options: CurrentWorkspaceWindowsOptions<TWindowId, TAscii>,
): WorkbenchWorkspaceWindow<TAscii>[] {
  const windows: WorkbenchWorkspaceWindow<TAscii>[] = [];
  for (let index = 0; index < options.windowIds.length; index++) {
    const windowId = options.windowIds[index]!;
    if (!options.isVisualizationWindow(windowId)) continue;
    const visualizationId = options.visualizationIdForWindow(windowId);
    if (!visualizationId) continue;
    windows.push({ visualizationId, ascii: options.asciiForWindow(windowId) });
  }
  return windows;
}

/** Applies the save-workspace state transition without renderer side effects. */
export function saveWorkspaceState<TAscii = unknown>(
  options: SaveWorkspaceStateOptions<TAscii>,
): SaveWorkspaceStateResult<TAscii> {
  const name = normalizeWorkspaceName(options.draftName, options.workspaces.length);
  const windows = copyWorkspaceWindows(options.windows);
  const visualizationIds = currentWorkspaceVisualizationIds(windows);
  const workspace: WorkbenchWorkspace<TAscii> = {
    name,
    visualizationIds,
    windows,
    savedAt: options.now ?? Date.now(),
  };
  return {
    name,
    visualizationIds,
    workspace,
    workspaces: upsertWorkbenchWorkspace(options.workspaces, workspace),
  };
}

/** Applies the rename-workspace state transition without renderer side effects. */
export function renameWorkspaceState<TAscii = unknown>(
  options: RenameWorkspaceStateOptions<TAscii>,
): RenameWorkspaceStateResult<TAscii> {
  const workspace = findWorkbenchWorkspace(options.workspaces, options.targetName);
  if (!workspace) return { status: "missing", targetName: options.targetName };

  const name = normalizeWorkspaceName(options.draftName, options.workspaces.length);
  const workspaces = renameWorkbenchWorkspace(options.workspaces, workspace.name, name, options.now ?? Date.now());
  const renamed = findWorkbenchWorkspace(workspaces, name) ?? workspace;
  const activeWorkspaceName = options.activeWorkspaceName?.toLowerCase() === workspace.name.toLowerCase()
    ? name
    : options.activeWorkspaceName;
  return {
    status: "renamed",
    previousName: workspace.name,
    name,
    visualizationCount: renamed.visualizationIds.length,
    workspaces,
    activeWorkspaceName,
  };
}

/** Applies the delete-workspace state transition without renderer side effects. */
export function deleteWorkspaceState<TAscii = unknown>(
  options: DeleteWorkspaceStateOptions<TAscii>,
): DeleteWorkspaceStateResult<TAscii> {
  const workspace = findWorkbenchWorkspace(options.workspaces, options.targetName);
  if (!workspace) return { status: "missing", targetName: options.targetName };

  const activeWorkspaceName = options.activeWorkspaceName?.toLowerCase() === workspace.name.toLowerCase()
    ? null
    : options.activeWorkspaceName;
  return {
    status: "deleted",
    name: workspace.name,
    workspaces: deleteWorkbenchWorkspace(options.workspaces, workspace.name),
    activeWorkspaceName,
  };
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

function copyWorkspaceWindows<TAscii>(
  windows: readonly WorkbenchWorkspaceWindow<TAscii>[],
): WorkbenchWorkspaceWindow<TAscii>[] {
  const copy = new Array<WorkbenchWorkspaceWindow<TAscii>>(windows.length);
  for (let index = 0; index < windows.length; index++) copy[index] = { ...windows[index]! };
  return copy;
}

function workspaceMenuEntry(
  entry: WorkspaceMenuEntry | undefined,
  label: string,
  action: WorkspaceMenuAction,
  workspaceName?: string,
): WorkspaceMenuEntry {
  const next = entry ?? { label, action };
  next.label = label;
  next.action = action;
  if (workspaceName === undefined) {
    delete next.workspaceName;
  } else {
    next.workspaceName = workspaceName;
  }
  return next;
}
