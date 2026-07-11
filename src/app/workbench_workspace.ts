// Copyright 2023 Im-Beast. MIT license.

/** A saved workbench window entry with optional per-window ASCII renderer settings. */
export interface WorkbenchWorkspaceWindow<TAscii = unknown> {
  visualizationId: string;
  ascii?: TAscii;
}

/** Version-tolerant saved workbench workspace shape shared by terminal and web adapters. */
export interface WorkbenchWorkspace<TAscii = unknown> {
  name: string;
  visualizationIds: string[];
  windows?: WorkbenchWorkspaceWindow<TAscii>[];
  savedAt: number;
}

/** Current version for serialized workbench workspace collections. */
export const WORKBENCH_WORKSPACE_STORAGE_VERSION = 1;

/** Versioned persisted workbench workspace collection shared by renderer adapters. */
export interface WorkbenchWorkspaceStorage<TAscii = unknown> {
  version: typeof WORKBENCH_WORKSPACE_STORAGE_VERSION;
  savedAt: number;
  workspaces: WorkbenchWorkspace<TAscii>[];
}

/** Options used to normalize persisted workbench workspaces. */
export interface NormalizeWorkbenchWorkspacesOptions<TAscii = unknown> {
  validVisualizationIds: Iterable<string>;
  limit?: number;
  fallbackName?: (index: number) => string;
  normalizeName?: (name: string, index: number) => string;
  normalizeAscii?: (value: unknown) => TAscii | undefined;
}

/** Lightweight panel layout state used by renderer adapters that do not save full window lists. */
export interface WorkbenchPanelWorkspaceState<TPanelId extends string = string> {
  active?: TPanelId;
  maximized?: TPanelId | null;
  minimized?: Partial<Record<TPanelId, boolean>>;
  tileDensity?: number;
}

/** Options used to normalize lightweight panel workspace state. */
export interface NormalizeWorkbenchPanelWorkspaceStateOptions<TPanelId extends string = string> {
  panelIds: readonly TPanelId[];
  defaultActive?: TPanelId;
  minTileDensity?: number;
  maxTileDensity?: number;
}

/** Normalizes a user supplied workspace name into a non-empty display name. */
export function normalizeWorkbenchWorkspaceName(name: unknown, fallback = "Workspace"): string {
  const trimmed = typeof name === "string" ? name.replace(/\s+/g, " ").trim() : "";
  return trimmed.length > 0 ? trimmed : fallback;
}

/** Creates the default minimized-state record for a fixed panel id list. */
export function defaultWorkbenchMinimizedState<TPanelId extends string>(
  panelIds: readonly TPanelId[],
  minimized: Partial<Record<TPanelId, boolean>> = {},
): Record<TPanelId, boolean> {
  const state = {} as Record<TPanelId, boolean>;
  for (const id of panelIds) {
    state[id] = Boolean(minimized[id]);
  }
  return state;
}

/** Normalizes persisted lightweight panel state and keeps active/maximized panels visible. */
export function normalizeWorkbenchPanelWorkspaceState<TPanelId extends string>(
  value: WorkbenchPanelWorkspaceState<TPanelId> | null | undefined,
  options: NormalizeWorkbenchPanelWorkspaceStateOptions<TPanelId>,
): WorkbenchPanelWorkspaceState<TPanelId> {
  const panelSet = new Set<string>(options.panelIds);
  const isPanelId = (candidate: unknown): candidate is TPanelId =>
    typeof candidate === "string" && panelSet.has(candidate);
  const active = isPanelId(value?.active) ? value.active : options.defaultActive;
  const maximized = value?.maximized === null || isPanelId(value?.maximized) ? value.maximized ?? null : undefined;
  const minimized = defaultWorkbenchMinimizedState(options.panelIds, value?.minimized ?? {});
  if (active) minimized[active] = false;
  if (maximized) minimized[maximized] = false;

  const minDensity = options.minTileDensity ?? -3;
  const maxDensity = options.maxTileDensity ?? 3;
  const tileDensity = Number.isFinite(value?.tileDensity)
    ? Math.max(minDensity, Math.min(maxDensity, Math.floor(value!.tileDensity!)))
    : undefined;

  return { active, maximized, minimized, tileDensity };
}

/** Normalizes saved workspaces, including legacy visualizationIds-only entries. */
export function normalizeWorkbenchWorkspaces<TAscii = unknown>(
  value: unknown,
  options: NormalizeWorkbenchWorkspacesOptions<TAscii>,
): WorkbenchWorkspace<TAscii>[] {
  if (!Array.isArray(value)) return [];
  const validIds = new Set(options.validVisualizationIds);
  const limit = Math.max(1, Math.floor(options.limit ?? 24));
  const fallbackName = options.fallbackName ?? ((index) => `Workspace ${index + 1}`);
  const normalizeName = options.normalizeName ??
    ((name, index) => normalizeWorkbenchWorkspaceName(name, fallbackName(index)));

  const workspaces: WorkbenchWorkspace<TAscii>[] = [];
  for (let index = 0; index < value.length && workspaces.length < limit; index++) {
    const entry = value[index];
    if (!entry || typeof entry !== "object") continue;
    const candidate = entry as Partial<WorkbenchWorkspace<TAscii>>;
    const name = normalizeName(typeof candidate.name === "string" ? candidate.name : "", index);
    if (!name) continue;

    const windows = normalizeWorkbenchWorkspaceWindows(candidate.windows, validIds, options.normalizeAscii);
    const visualizationIds = windows.length > 0
      ? workspaceVisualizationIds(windows)
      : normalizeVisualizationIds(candidate.visualizationIds, validIds);

    workspaces.push({
      name,
      visualizationIds,
      windows: windows.length > 0 ? windows : undefined,
      savedAt: typeof candidate.savedAt === "number" && Number.isFinite(candidate.savedAt) ? candidate.savedAt : 0,
    });
  }
  return workspaces;
}

/** Serializes workspaces into the current versioned storage envelope. */
export function serializeWorkbenchWorkspaces<TAscii>(
  workspaces: readonly WorkbenchWorkspace<TAscii>[],
  savedAt: number = Date.now(),
): WorkbenchWorkspaceStorage<TAscii> {
  const serialized: WorkbenchWorkspace<TAscii>[] = new Array(workspaces.length);
  for (let index = 0; index < workspaces.length; index++) {
    const workspace = workspaces[index]!;
    const visualizationIds = new Array<string>(workspace.visualizationIds.length);
    for (let idIndex = 0; idIndex < workspace.visualizationIds.length; idIndex++) {
      visualizationIds[idIndex] = workspace.visualizationIds[idIndex]!;
    }

    let windows: WorkbenchWorkspaceWindow<TAscii>[] | undefined;
    if (workspace.windows) {
      windows = new Array(workspace.windows.length);
      for (let windowIndex = 0; windowIndex < workspace.windows.length; windowIndex++) {
        windows[windowIndex] = { ...workspace.windows[windowIndex]! };
      }
    }

    serialized[index] = { ...workspace, visualizationIds, windows };
  }

  return {
    version: WORKBENCH_WORKSPACE_STORAGE_VERSION,
    savedAt,
    workspaces: serialized,
  };
}

/** Normalizes current and legacy persisted workspace storage shapes. */
export function normalizeWorkbenchWorkspaceStorage<TAscii = unknown>(
  value: unknown,
  options: NormalizeWorkbenchWorkspacesOptions<TAscii>,
): WorkbenchWorkspace<TAscii>[] {
  if (Array.isArray(value)) return normalizeWorkbenchWorkspaces(value, options);
  if (!value || typeof value !== "object") return [];
  const candidate = value as Partial<WorkbenchWorkspaceStorage<TAscii>>;
  return normalizeWorkbenchWorkspaces(candidate.workspaces, options);
}

/** Returns normalized window entries for a workspace, expanding legacy visualizationIds when needed. */
export function workbenchWorkspaceWindowEntries<TAscii = unknown>(
  workspace: WorkbenchWorkspace<TAscii>,
  options: Pick<NormalizeWorkbenchWorkspacesOptions<TAscii>, "validVisualizationIds" | "normalizeAscii">,
): WorkbenchWorkspaceWindow<TAscii>[] {
  const validIds = new Set(options.validVisualizationIds);
  const windows = normalizeWorkbenchWorkspaceWindows(workspace.windows, validIds, options.normalizeAscii);
  if (windows.length > 0) return windows;
  const visualizationIds = normalizeVisualizationIds(workspace.visualizationIds, validIds);
  const entries: WorkbenchWorkspaceWindow<TAscii>[] = new Array(visualizationIds.length);
  for (let index = 0; index < visualizationIds.length; index++) {
    entries[index] = { visualizationId: visualizationIds[index]! };
  }
  return entries;
}

/** Upserts a workspace by case-insensitive name while preserving recency order. */
export function upsertWorkbenchWorkspace<TAscii>(
  workspaces: readonly WorkbenchWorkspace<TAscii>[],
  workspace: WorkbenchWorkspace<TAscii>,
  limit = 24,
): WorkbenchWorkspace<TAscii>[] {
  const normalizedLimit = Math.max(1, Math.floor(limit));
  const next: WorkbenchWorkspace<TAscii>[] = [workspace];
  const name = workspace.name.toLowerCase();
  for (const entry of workspaces) {
    if (next.length >= normalizedLimit) break;
    if (entry.name.toLowerCase() !== name) next.push(entry);
  }
  return next;
}

/** Renames a saved workspace, replacing any existing workspace that already uses the target name. */
export function renameWorkbenchWorkspace<TAscii>(
  workspaces: readonly WorkbenchWorkspace<TAscii>[],
  currentName: string,
  nextName: string,
  savedAt: number = Date.now(),
  limit = 24,
): WorkbenchWorkspace<TAscii>[] {
  const current = findWorkbenchWorkspace(workspaces, currentName);
  if (!current) {
    const copy = new Array<WorkbenchWorkspace<TAscii>>(workspaces.length);
    for (let index = 0; index < workspaces.length; index++) copy[index] = workspaces[index]!;
    return copy;
  }
  const renamed = { ...current, name: nextName, savedAt };
  const normalizedLimit = Math.max(1, Math.floor(limit));
  const currentLower = current.name.toLowerCase();
  const nextLower = nextName.toLowerCase();
  const next: WorkbenchWorkspace<TAscii>[] = [renamed];
  for (const entry of workspaces) {
    if (next.length >= normalizedLimit) break;
    const name = entry.name.toLowerCase();
    if (name !== currentLower && name !== nextLower) next.push(entry);
  }
  return next;
}

/** Deletes a saved workspace by case-insensitive name. */
export function deleteWorkbenchWorkspace<TAscii>(
  workspaces: readonly WorkbenchWorkspace<TAscii>[],
  name: string,
): WorkbenchWorkspace<TAscii>[] {
  const lower = name.toLowerCase();
  const next: WorkbenchWorkspace<TAscii>[] = [];
  for (const entry of workspaces) {
    if (entry.name.toLowerCase() !== lower) next.push(entry);
  }
  return next;
}

/** Finds a saved workspace by case-insensitive name. */
export function findWorkbenchWorkspace<TAscii>(
  workspaces: readonly WorkbenchWorkspace<TAscii>[],
  name: string | null | undefined,
): WorkbenchWorkspace<TAscii> | undefined {
  if (!name) return undefined;
  const lower = name.toLowerCase();
  for (const workspace of workspaces) {
    if (workspace.name.toLowerCase() === lower) return workspace;
  }
  return undefined;
}

function normalizeWorkbenchWorkspaceWindows<TAscii>(
  value: unknown,
  validIds: ReadonlySet<string>,
  normalizeAscii?: (value: unknown) => TAscii | undefined,
): WorkbenchWorkspaceWindow<TAscii>[] {
  if (!Array.isArray(value)) return [];
  const windows: WorkbenchWorkspaceWindow<TAscii>[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object") continue;
    const candidate = entry as Partial<WorkbenchWorkspaceWindow<TAscii>>;
    if (typeof candidate.visualizationId !== "string" || !validIds.has(candidate.visualizationId)) continue;
    const ascii = normalizeAscii?.(candidate.ascii);
    windows.push(
      ascii === undefined ? { visualizationId: candidate.visualizationId } : {
        visualizationId: candidate.visualizationId,
        ascii,
      },
    );
  }
  return windows;
}

function normalizeVisualizationIds(value: unknown, validIds: ReadonlySet<string>): string[] {
  if (!Array.isArray(value)) return [];
  const ids: string[] = [];
  for (const id of value) {
    if (typeof id === "string" && validIds.has(id)) ids.push(id);
  }
  return ids;
}

function workspaceVisualizationIds<TAscii>(windows: readonly WorkbenchWorkspaceWindow<TAscii>[]): string[] {
  const ids = new Array<string>(windows.length);
  for (let index = 0; index < windows.length; index++) {
    ids[index] = windows[index]!.visualizationId;
  }
  return ids;
}
