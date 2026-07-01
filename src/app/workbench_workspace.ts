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

  return value.flatMap((entry, index): WorkbenchWorkspace<TAscii>[] => {
    if (!entry || typeof entry !== "object") return [];
    const candidate = entry as Partial<WorkbenchWorkspace<TAscii>>;
    const name = normalizeName(typeof candidate.name === "string" ? candidate.name : "", index);
    if (!name) return [];

    const windows = normalizeWorkbenchWorkspaceWindows(candidate.windows, validIds, options.normalizeAscii);
    const visualizationIds = windows.length > 0
      ? windows.map((window) => window.visualizationId)
      : normalizeVisualizationIds(candidate.visualizationIds, validIds);

    return [{
      name,
      visualizationIds,
      windows: windows.length > 0 ? windows : undefined,
      savedAt: typeof candidate.savedAt === "number" && Number.isFinite(candidate.savedAt) ? candidate.savedAt : 0,
    }];
  }).slice(0, limit);
}

/** Returns normalized window entries for a workspace, expanding legacy visualizationIds when needed. */
export function workbenchWorkspaceWindowEntries<TAscii = unknown>(
  workspace: WorkbenchWorkspace<TAscii>,
  options: Pick<NormalizeWorkbenchWorkspacesOptions<TAscii>, "validVisualizationIds" | "normalizeAscii">,
): WorkbenchWorkspaceWindow<TAscii>[] {
  const validIds = new Set(options.validVisualizationIds);
  const windows = normalizeWorkbenchWorkspaceWindows(workspace.windows, validIds, options.normalizeAscii);
  if (windows.length > 0) return windows;
  return normalizeVisualizationIds(workspace.visualizationIds, validIds).map((visualizationId) => ({
    visualizationId,
  }));
}

/** Upserts a workspace by case-insensitive name while preserving recency order. */
export function upsertWorkbenchWorkspace<TAscii>(
  workspaces: readonly WorkbenchWorkspace<TAscii>[],
  workspace: WorkbenchWorkspace<TAscii>,
  limit = 24,
): WorkbenchWorkspace<TAscii>[] {
  return [
    workspace,
    ...workspaces.filter((entry) => entry.name.toLowerCase() !== workspace.name.toLowerCase()),
  ].slice(0, Math.max(1, Math.floor(limit)));
}

/** Renames a saved workspace, replacing any existing workspace that already uses the target name. */
export function renameWorkbenchWorkspace<TAscii>(
  workspaces: readonly WorkbenchWorkspace<TAscii>[],
  currentName: string,
  nextName: string,
  savedAt = Date.now(),
  limit = 24,
): WorkbenchWorkspace<TAscii>[] {
  const current = findWorkbenchWorkspace(workspaces, currentName);
  if (!current) return [...workspaces];
  const renamed = { ...current, name: nextName, savedAt };
  return [
    renamed,
    ...workspaces.filter((entry) =>
      entry.name.toLowerCase() !== current.name.toLowerCase() &&
      entry.name.toLowerCase() !== nextName.toLowerCase()
    ),
  ].slice(0, Math.max(1, Math.floor(limit)));
}

/** Deletes a saved workspace by case-insensitive name. */
export function deleteWorkbenchWorkspace<TAscii>(
  workspaces: readonly WorkbenchWorkspace<TAscii>[],
  name: string,
): WorkbenchWorkspace<TAscii>[] {
  return workspaces.filter((entry) => entry.name.toLowerCase() !== name.toLowerCase());
}

/** Finds a saved workspace by case-insensitive name. */
export function findWorkbenchWorkspace<TAscii>(
  workspaces: readonly WorkbenchWorkspace<TAscii>[],
  name: string | null | undefined,
): WorkbenchWorkspace<TAscii> | undefined {
  if (!name) return undefined;
  return workspaces.find((workspace) => workspace.name.toLowerCase() === name.toLowerCase());
}

function normalizeWorkbenchWorkspaceWindows<TAscii>(
  value: unknown,
  validIds: ReadonlySet<string>,
  normalizeAscii?: (value: unknown) => TAscii | undefined,
): WorkbenchWorkspaceWindow<TAscii>[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry): WorkbenchWorkspaceWindow<TAscii>[] => {
    if (!entry || typeof entry !== "object") return [];
    const candidate = entry as Partial<WorkbenchWorkspaceWindow<TAscii>>;
    if (typeof candidate.visualizationId !== "string" || !validIds.has(candidate.visualizationId)) return [];
    const ascii = normalizeAscii?.(candidate.ascii);
    return [
      ascii === undefined ? { visualizationId: candidate.visualizationId } : {
        visualizationId: candidate.visualizationId,
        ascii,
      },
    ];
  });
}

function normalizeVisualizationIds(value: unknown, validIds: ReadonlySet<string>): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((id): id is string => typeof id === "string" && validIds.has(id));
}
