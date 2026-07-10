// Copyright 2023 Im-Beast. MIT license.
import { sortedSetValues } from "../utils/collections.ts";
import { escapeMarkdownCell } from "../utils/formatting.ts";

/** High-level widget grouping for catalogs and docs browsers. */
export type ComponentCategory =
  | "primitive"
  | "input"
  | "navigation"
  | "overlay"
  | "data"
  | "feedback"
  | "visualization"
  | "layout";

/** Capability tags that describe how a component can be used. */
export type ComponentCapability =
  | "component"
  | "controller"
  | "render-helper"
  | "selection"
  | "virtualized"
  | "keyboard"
  | "mouse"
  | "themeable"
  | "async"
  | "three"
  | "dashboard";

/** Searchable metadata for one public component or widget helper. */
export interface ComponentCatalogEntry {
  id: string;
  name: string;
  category: ComponentCategory;
  description: string;
  capabilities: readonly ComponentCapability[];
}

/** Query options for filtering the component catalog. */
export interface ComponentCatalogQuery {
  category?: ComponentCategory;
  capability?: ComponentCapability;
  capabilities?: readonly ComponentCapability[];
  search?: string;
}

/** Aggregate component catalog counts by category and capability. */
export interface ComponentCatalogInspection {
  count: number;
  categories: Record<ComponentCategory, number>;
  capabilities: Record<ComponentCapability, number>;
}

/** Serializable component catalog report for docs, marketplaces, and tooling. */
export interface ComponentCatalogReport {
  entries: ComponentCatalogEntry[];
  inspection: ComponentCatalogInspection;
  categories: ComponentCategory[];
  capabilities: ComponentCapability[];
}

/** Options for building a component catalog report. */
export interface ComponentCatalogReportOptions {
  entries?: readonly ComponentCatalogEntry[];
  query?: ComponentCatalogQuery;
}

/** Options for formatting a component catalog report as Markdown. */
export interface ComponentCatalogMarkdownOptions extends ComponentCatalogReportOptions {
  title?: string;
  includeSummary?: boolean;
}

/** Built-in component and helper inventory for demos, docs, and plugin surfaces. */
export const componentCatalog = [
  component("box", "Box", "primitive", "Filled rectangular surface for backgrounds and panels.", [
    "component",
    "themeable",
  ]),
  component("button", "Button", "input", "Clickable and focusable command button.", [
    "component",
    "controller",
    "keyboard",
    "mouse",
    "themeable",
  ]),
  component("checkbox", "CheckBox", "input", "Boolean input with keyboard and mouse toggling.", [
    "component",
    "controller",
    "keyboard",
    "mouse",
    "themeable",
  ]),
  component("combobox", "ComboBox", "input", "Text input with selectable suggestions.", [
    "component",
    "controller",
    "keyboard",
    "mouse",
    "selection",
    "themeable",
  ]),
  component("input", "Input", "input", "Single-line text entry.", [
    "component",
    "controller",
    "keyboard",
    "themeable",
  ]),
  component("textbox", "TextBox", "input", "Multi-line text editor with cursor, line numbers, and selection.", [
    "component",
    "controller",
    "keyboard",
    "themeable",
  ]),
  component("slider", "Slider", "input", "Horizontal or vertical numeric slider.", [
    "component",
    "controller",
    "keyboard",
    "mouse",
    "themeable",
  ]),
  component("radio-group", "RadioGroup", "input", "Single-choice option group renderer.", [
    "component",
    "controller",
    "render-helper",
    "selection",
    "keyboard",
    "mouse",
    "themeable",
  ]),
  component("list", "List", "data", "Selectable list component.", [
    "component",
    "controller",
    "selection",
    "themeable",
  ]),
  component("virtual-list", "VirtualList", "data", "Windowed list component for large item sets.", [
    "component",
    "controller",
    "selection",
    "virtualized",
    "themeable",
  ]),
  component("table", "Table", "data", "Scrollable table component with headers and selection.", [
    "component",
    "controller",
    "selection",
    "themeable",
  ]),
  component("data-table", "DataTable", "data", "Filtering, sorting, pagination, and row formatting helpers.", [
    "controller",
    "render-helper",
    "selection",
  ]),
  component("tree", "Tree", "data", "Hierarchical rows with expansion state.", [
    "component",
    "controller",
    "render-helper",
    "selection",
    "keyboard",
    "themeable",
  ]),
  component("file-explorer", "FileExplorer", "data", "Path-aware tree controller for project and file browsers.", [
    "controller",
    "selection",
    "keyboard",
    "mouse",
    "themeable",
  ]),
  component("tabs", "Tabs", "navigation", "Segmented route or view selector.", [
    "controller",
    "render-helper",
    "selection",
    "keyboard",
    "themeable",
  ]),
  component("breadcrumbs", "Breadcrumbs", "navigation", "Truncated path and route trail renderer.", [
    "render-helper",
  ]),
  component("stepper", "Stepper", "navigation", "Sequential workflow step indicator.", [
    "controller",
    "render-helper",
    "selection",
  ]),
  component("menu-bar", "MenuBar", "navigation", "Top-level command menu row.", [
    "controller",
    "render-helper",
    "selection",
    "keyboard",
  ]),
  component("key-help", "KeyHelp", "navigation", "Formatted key binding help rows.", ["render-helper", "keyboard"]),
  component("command-palette", "CommandPalette", "overlay", "Filterable command surface.", [
    "controller",
    "render-helper",
    "selection",
    "keyboard",
    "async",
  ]),
  component("context-menu", "ContextMenu", "overlay", "Selectable contextual command list.", [
    "controller",
    "render-helper",
    "selection",
    "keyboard",
    "mouse",
  ]),
  component("modal", "Modal", "overlay", "Centered overlay frame and focus target.", [
    "controller",
    "render-helper",
    "keyboard",
    "mouse",
    "themeable",
  ]),
  component("toast", "ToastStack", "overlay", "Transient notification stack renderer.", [
    "controller",
    "render-helper",
    "async",
  ]),
  component("empty-state", "EmptyState", "feedback", "Centered empty, loading, or fallback message.", [
    "render-helper",
    "async",
  ]),
  component("spinner", "Spinner", "feedback", "Animated status indicator renderer.", [
    "render-helper",
    "async",
  ]),
  component("progressbar", "ProgressBar", "feedback", "Horizontal or vertical progress component.", [
    "component",
    "controller",
    "themeable",
  ]),
  component("statusbar", "StatusBar", "feedback", "Left/right status row renderer.", [
    "component",
    "render-helper",
    "themeable",
  ]),
  component("sparkline", "Sparkline", "visualization", "Compact trend renderer for metric arrays.", [
    "component",
    "render-helper",
    "dashboard",
  ]),
  component("gauge", "Gauge", "visualization", "Compact labeled value bar renderer.", ["render-helper", "dashboard"]),
  component("chart", "Chart", "visualization", "Text bar chart renderer.", ["render-helper", "dashboard"]),
  component("log-viewer", "LogViewer", "data", "Tail-following log row window helpers.", [
    "controller",
    "render-helper",
    "virtualized",
    "dashboard",
  ]),
  component("metric-series", "MetricSeries", "data", "Bounded metric history controller and statistics.", [
    "controller",
    "dashboard",
  ]),
  component("three-ascii", "ThreeAscii", "visualization", "Three.js scene renderer for terminal ASCII output.", [
    "component",
    "three",
    "dashboard",
  ]),
  component("frame", "Frame", "layout", "Bordered component frame.", ["component", "themeable"]),
  component("window-manager", "WindowManager", "layout", "Tiling window state, fullscreen tabs, and chrome model.", [
    "controller",
    "keyboard",
    "mouse",
  ]),
  component("scroll-area", "ScrollArea", "layout", "Viewport and scrollbar helper renderers.", [
    "controller",
    "render-helper",
    "virtualized",
  ]),
  component("pad", "Pad", "layout", "Off-screen scrollable text surface with viewport slicing and cursor reveal.", [
    "controller",
    "render-helper",
    "virtualized",
    "keyboard",
    "mouse",
  ]),
  component("label", "Label", "primitive", "Aligned text component.", ["component", "themeable"]),
  component("text", "Text", "primitive", "Raw text draw object.", ["component", "themeable"]),
] as const satisfies readonly ComponentCatalogEntry[];

const COMPONENT_LOOKUP_INDEX = createComponentLookupIndex(componentCatalog);
const COMPONENT_SEARCH_INDEX = createComponentSearchIndex(componentCatalog);
const COMPONENT_CATEGORIES = collectComponentCategories(componentCatalog);
const COMPONENT_CAPABILITIES = collectComponentCapabilities(componentCatalog);

/** Returns a copy of the built-in component catalog. */
export function listComponents(): ComponentCatalogEntry[] {
  return cloneComponentEntries(componentCatalog);
}

/** Finds a component by id or display name, ignoring separators and case. */
export function findComponent(idOrName: string): ComponentCatalogEntry | undefined {
  return COMPONENT_LOOKUP_INDEX.get(normalizeComponentLookup(idOrName));
}

/** Returns all catalog entries in one category. */
export function componentsByCategory(category: ComponentCategory): ComponentCatalogEntry[] {
  const entries: ComponentCatalogEntry[] = [];
  for (let index = 0; index < componentCatalog.length; index += 1) {
    const entry = componentCatalog[index]!;
    if (entry.category === category) entries.push(entry);
  }
  return entries;
}

/** Returns all catalog entries that expose a capability tag. */
export function componentsWithCapability(capability: ComponentCapability): ComponentCatalogEntry[] {
  const entries: ComponentCatalogEntry[] = [];
  for (let index = 0; index < componentCatalog.length; index += 1) {
    const entry = componentCatalog[index]!;
    if (entry.capabilities.includes(capability)) entries.push(entry);
  }
  return entries;
}

/** Filters components by category, capabilities, and full-text search. */
export function queryComponents(query: ComponentCatalogQuery = {}): ComponentCatalogEntry[] {
  const capabilities: ComponentCapability[] = [];
  if (query.capability) capabilities.push(query.capability);
  const extraCapabilities = query.capabilities ?? [];
  for (let index = 0; index < extraCapabilities.length; index += 1) capabilities.push(extraCapabilities[index]!);
  const search = query.search ? normalizeComponentLookup(query.search) : "";
  const entries: ComponentCatalogEntry[] = [];
  for (let index = 0; index < componentCatalog.length; index += 1) {
    const entry = componentCatalog[index]!;
    if (query.category && entry.category !== query.category) continue;
    if (!componentHasAllCapabilities(entry, capabilities)) continue;
    if (!search || componentMatchesSearch(entry, search)) entries.push(entry);
  }
  return entries;
}

/** Returns the known component categories in sorted order. */
export function componentCategories(): ComponentCategory[] {
  return COMPONENT_CATEGORIES.slice();
}

/** Returns the known component capability tags in sorted order. */
export function componentCapabilities(): ComponentCapability[] {
  return COMPONENT_CAPABILITIES.slice();
}

function createComponentCategoryCounts(): Record<ComponentCategory, number> {
  const categories = componentCategories();
  const counts = {} as Record<ComponentCategory, number>;
  for (let index = 0; index < categories.length; index += 1) counts[categories[index]!] = 0;
  return counts;
}

function createComponentCapabilityCounts(): Record<ComponentCapability, number> {
  const capabilities = componentCapabilities();
  const counts = {} as Record<ComponentCapability, number>;
  for (let index = 0; index < capabilities.length; index += 1) counts[capabilities[index]!] = 0;
  return counts;
}

/** Counts catalog entries by category and capability. */
export function inspectComponentCatalog(
  entries: readonly ComponentCatalogEntry[] = componentCatalog,
): ComponentCatalogInspection {
  const categories = createComponentCategoryCounts();
  const capabilities = createComponentCapabilityCounts();

  for (const entry of entries) {
    categories[entry.category] += 1;
    for (const capability of entry.capabilities) {
      capabilities[capability] += 1;
    }
  }

  return {
    count: entries.length,
    categories,
    capabilities,
  };
}

/** Creates a deterministic serializable component catalog report. */
export function createComponentCatalogReport(options: ComponentCatalogReportOptions = {}): ComponentCatalogReport {
  const entries = cloneComponentEntries(options.entries ?? queryComponents(options.query));
  return {
    entries,
    inspection: inspectComponentCatalog(entries),
    categories: componentCategories(),
    capabilities: componentCapabilities(),
  };
}

/** Formats catalog entries as a Markdown table with an optional summary. */
export function formatComponentCatalogMarkdown(options: ComponentCatalogMarkdownOptions = {}): string {
  const report = createComponentCatalogReport(options);
  const lines: string[] = [];
  lines.push(`# ${options.title ?? "Component Catalog"}`);
  lines.push("");

  if (options.includeSummary ?? true) {
    lines.push(`Components: ${report.inspection.count}`);
    lines.push(`Categories: ${formatNonZeroEntries(report.inspection.categories)}`);
    lines.push("");
  }

  lines.push("| Component | Category | Capabilities | Description |");
  lines.push("| --- | --- | --- | --- |");
  for (const entry of report.entries) {
    lines.push(
      `| ${escapeMarkdownCell(entry.name)} | ${entry.category} | ${
        escapeMarkdownCell(entry.capabilities.join(", "))
      } | ${escapeMarkdownCell(entry.description)} |`,
    );
  }

  return lines.join("\n");
}

function component(
  id: string,
  name: string,
  category: ComponentCategory,
  description: string,
  capabilities: readonly ComponentCapability[],
): ComponentCatalogEntry {
  return { id, name, category, description, capabilities };
}

function normalizeComponentLookup(value: string): string {
  return value.toLowerCase().replace(/[\s_-]+/g, "");
}

function cloneComponentEntries(entries: readonly ComponentCatalogEntry[]): ComponentCatalogEntry[] {
  const cloned: ComponentCatalogEntry[] = [];
  for (let index = 0; index < entries.length; index += 1) cloned.push(entries[index]!);
  return cloned;
}

function componentHasAllCapabilities(
  entry: ComponentCatalogEntry,
  capabilities: readonly ComponentCapability[],
): boolean {
  for (let index = 0; index < capabilities.length; index += 1) {
    if (!entry.capabilities.includes(capabilities[index]!)) return false;
  }
  return true;
}

function componentMatchesSearch(entry: ComponentCatalogEntry, search: string): boolean {
  const indexed = COMPONENT_SEARCH_INDEX.get(entry);
  if (indexed) return indexed.includes(search);
  if (normalizeComponentLookup(entry.id).includes(search)) return true;
  if (normalizeComponentLookup(entry.name).includes(search)) return true;
  if (normalizeComponentLookup(entry.description).includes(search)) return true;
  if (normalizeComponentLookup(entry.category).includes(search)) return true;
  for (let index = 0; index < entry.capabilities.length; index += 1) {
    if (normalizeComponentLookup(entry.capabilities[index]!).includes(search)) return true;
  }
  return false;
}

function createComponentLookupIndex(
  entries: readonly ComponentCatalogEntry[],
): Map<string, ComponentCatalogEntry> {
  const lookup = new Map<string, ComponentCatalogEntry>();
  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index]!;
    lookup.set(normalizeComponentLookup(entry.id), entry);
    lookup.set(normalizeComponentLookup(entry.name), entry);
  }
  return lookup;
}

function createComponentSearchIndex(
  entries: readonly ComponentCatalogEntry[],
): Map<ComponentCatalogEntry, string> {
  const lookup = new Map<ComponentCatalogEntry, string>();
  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index]!;
    let text = `${normalizeComponentLookup(entry.id)} ${normalizeComponentLookup(entry.name)} ${
      normalizeComponentLookup(entry.description)
    } ${normalizeComponentLookup(entry.category)}`;
    for (let capabilityIndex = 0; capabilityIndex < entry.capabilities.length; capabilityIndex += 1) {
      text += ` ${normalizeComponentLookup(entry.capabilities[capabilityIndex]!)}`;
    }
    lookup.set(entry, text);
  }
  return lookup;
}

function collectComponentCategories(entries: readonly ComponentCatalogEntry[]): ComponentCategory[] {
  const categories = new Set<ComponentCategory>();
  for (let index = 0; index < entries.length; index += 1) categories.add(entries[index]!.category);
  return sortedSetValues(categories);
}

function collectComponentCapabilities(entries: readonly ComponentCatalogEntry[]): ComponentCapability[] {
  const capabilities = new Set<ComponentCapability>();
  for (let index = 0; index < entries.length; index += 1) {
    const entryCapabilities = entries[index]!.capabilities;
    for (let capabilityIndex = 0; capabilityIndex < entryCapabilities.length; capabilityIndex += 1) {
      capabilities.add(entryCapabilities[capabilityIndex]!);
    }
  }
  return sortedSetValues(capabilities);
}

function formatNonZeroEntries<T extends string>(record: Record<T, number>): string {
  const parts: string[] = [];
  for (const key in record) {
    const count = record[key];
    if (count > 0) parts.push(`${key} (${count})`);
  }
  return parts.join(", ");
}
