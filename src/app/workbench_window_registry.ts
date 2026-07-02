// Copyright 2023 Im-Beast. MIT license.

/** Shared grouping used by workbench New Window menus and catalogs. */
export type WorkbenchWindowOptionGroup = "Layout" | "Monitor" | "Neon" | "Neon 3D" | "Terminal";

/** Shared metadata for a window that can be opened from a workbench launcher. */
export interface WorkbenchWindowOption {
  id: string;
  label: string;
  group: WorkbenchWindowOptionGroup;
  description: string;
  windowId?: string;
}

/** Visualization-like source metadata that can be projected into a workbench window option. */
export interface WorkbenchVisualizationOptionSource {
  id: string;
  name: string;
  description: string;
  family?: "monitor" | "neon" | "neon3d";
}

/** Options for creating the shared workbench New Window catalog. */
export interface WorkbenchWindowOptionCatalogInput {
  builtIns?: readonly WorkbenchWindowOption[];
  visualizations?: readonly WorkbenchVisualizationOptionSource[];
  neonIds?: ReadonlySet<string>;
}

/** Minimum window dimensions for a workbench option. */
export interface WorkbenchWindowOptionMinimums {
  minWidth: number;
  minHeight: number;
}

/** Create a stable workbench window option list from built-ins and visualization metadata. */
export function createWorkbenchWindowOptions(input: WorkbenchWindowOptionCatalogInput): WorkbenchWindowOption[] {
  const builtIns = input.builtIns ?? [];
  const visualizations = input.visualizations ?? [];
  const options = new Array<WorkbenchWindowOption>(builtIns.length + visualizations.length);
  let index = 0;
  for (const builtIn of builtIns) {
    options[index] = builtIn;
    index += 1;
  }
  appendWorkbenchVisualizationWindowOptions(options, index, visualizations, input.neonIds ?? new Set());
  return options;
}

/** Project visualization metadata into workbench launcher options. */
export function createWorkbenchVisualizationWindowOptions(
  visualizations: readonly WorkbenchVisualizationOptionSource[],
  neonIds: ReadonlySet<string> = new Set(),
): WorkbenchWindowOption[] {
  const options = new Array<WorkbenchWindowOption>(visualizations.length);
  appendWorkbenchVisualizationWindowOptions(options, 0, visualizations, neonIds);
  return options;
}

function appendWorkbenchVisualizationWindowOptions(
  target: WorkbenchWindowOption[],
  startIndex: number,
  visualizations: readonly WorkbenchVisualizationOptionSource[],
  neonIds: ReadonlySet<string>,
): void {
  for (let index = 0; index < visualizations.length; index += 1) {
    const entry = visualizations[index]!;
    target[startIndex + index] = {
      id: entry.id,
      label: entry.name,
      group: workbenchWindowOptionGroupForVisualization(entry, neonIds),
      description: entry.description,
    };
  }
}

function workbenchWindowOptionGroupForVisualization(
  entry: WorkbenchVisualizationOptionSource,
  neonIds: ReadonlySet<string> = new Set(),
): WorkbenchWindowOptionGroup {
  if (entry.family === "neon3d") return "Neon 3D";
  if (entry.family === "neon") return "Neon";
  if (entry.family === "monitor") return "Monitor";
  return entry.id.startsWith("three-") ? "Neon 3D" : neonIds.has(entry.id) ? "Neon" : "Monitor";
}

/** Convert a visualization id into the managed workbench window id. */
export function workbenchVisualizationWindowId(visualizationId: string): `viz:${string}` {
  return `viz:${visualizationId.replace(/[^a-z0-9-]/gi, "-").toLowerCase()}`;
}

/** Return whether a managed workbench window id points at a visualization option. */
export function isWorkbenchVisualizationWindowId(id: string): id is `viz:${string}` {
  return id.startsWith("viz:");
}

/** Extract the source visualization id from a managed visualization window id. */
export function workbenchVisualizationIdFromWindowId(id: string): string | undefined {
  return isWorkbenchVisualizationWindowId(id) ? id.slice("viz:".length) : undefined;
}

/** Return whether an option is currently loaded based on managed window ids. */
export function isWorkbenchWindowOptionLoaded(
  option: WorkbenchWindowOption,
  loadedWindowIds: Iterable<string>,
): boolean {
  const ids = loadedWindowIds instanceof Set ? loadedWindowIds : new Set(loadedWindowIds);
  return ids.has(option.windowId ?? workbenchVisualizationWindowId(option.id));
}

/** Render a New Window menu label with checkbox state, group, and title. */
export function workbenchWindowOptionMenuLabel(option: WorkbenchWindowOption, loaded: boolean): string {
  return `${loaded ? "[x]" : "[ ]"} ${option.group}: ${option.label}`;
}

/** Project New Window menu labels into a caller-owned buffer with one loaded-window lookup set. */
export function workbenchWindowOptionMenuLabelsInto(
  target: string[],
  options: readonly WorkbenchWindowOption[],
  loadedWindowIds: Iterable<string>,
): string[] {
  const ids = loadedWindowIds instanceof Set ? loadedWindowIds : new Set(loadedWindowIds);
  target.length = options.length;
  for (let index = 0; index < options.length; index += 1) {
    const option = options[index]!;
    target[index] = workbenchWindowOptionMenuLabel(
      option,
      ids.has(option.windowId ?? workbenchVisualizationWindowId(option.id)),
    );
  }
  return target;
}

/** Resolve minimum dimensions for a workbench window option. */
export function workbenchWindowOptionMinimums(option: WorkbenchWindowOption): WorkbenchWindowOptionMinimums {
  if (option.windowId) return { minWidth: 34, minHeight: 10 };
  if (option.group === "Monitor") {
    if (option.id === "cpu-legend" || option.id === "process-monitor") return { minWidth: 34, minHeight: 14 };
    if (option.id.includes("gpu")) return { minWidth: 40, minHeight: 13 };
    return { minWidth: 36, minHeight: 12 };
  }
  if (option.group === "Neon 3D") return { minWidth: 42, minHeight: 16 };
  if (option.id === "component-index" || option.id === "magi-board") return { minWidth: 42, minHeight: 15 };
  return { minWidth: 38, minHeight: 13 };
}
