// Copyright 2023 Im-Beast. MIT license.

export type ComponentCategory =
  | "primitive"
  | "input"
  | "navigation"
  | "overlay"
  | "data"
  | "feedback"
  | "visualization"
  | "layout";

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

export interface ComponentCatalogEntry {
  id: string;
  name: string;
  category: ComponentCategory;
  description: string;
  capabilities: readonly ComponentCapability[];
}

export const componentCatalog = [
  component("box", "Box", "primitive", "Filled rectangular surface for backgrounds and panels.", [
    "component",
    "themeable",
  ]),
  component("button", "Button", "input", "Clickable and focusable command button.", [
    "component",
    "keyboard",
    "mouse",
    "themeable",
  ]),
  component("checkbox", "CheckBox", "input", "Boolean input with keyboard and mouse toggling.", [
    "component",
    "keyboard",
    "mouse",
    "themeable",
  ]),
  component("combobox", "ComboBox", "input", "Text input with selectable suggestions.", [
    "component",
    "keyboard",
    "selection",
    "themeable",
  ]),
  component("input", "Input", "input", "Single-line text entry.", ["component", "keyboard", "themeable"]),
  component("textbox", "TextBox", "input", "Multi-line text editor with cursor, line numbers, and selection.", [
    "component",
    "keyboard",
    "themeable",
  ]),
  component("slider", "Slider", "input", "Horizontal or vertical numeric slider.", [
    "component",
    "keyboard",
    "mouse",
    "themeable",
  ]),
  component("radio-group", "RadioGroup", "input", "Single-choice option group renderer.", [
    "render-helper",
    "selection",
    "keyboard",
    "themeable",
  ]),
  component("list", "List", "data", "Selectable list component.", ["component", "selection", "themeable"]),
  component("virtual-list", "VirtualList", "data", "Windowed list component for large item sets.", [
    "component",
    "selection",
    "virtualized",
    "themeable",
  ]),
  component("table", "Table", "data", "Scrollable table component with headers and selection.", [
    "component",
    "selection",
    "themeable",
  ]),
  component("data-table", "DataTable", "data", "Filtering, sorting, pagination, and row formatting helpers.", [
    "controller",
    "render-helper",
    "selection",
  ]),
  component("tree", "Tree", "data", "Hierarchical rows with expansion state.", [
    "render-helper",
    "selection",
    "keyboard",
  ]),
  component("tabs", "Tabs", "navigation", "Segmented route or view selector.", [
    "render-helper",
    "selection",
    "keyboard",
    "themeable",
  ]),
  component("breadcrumbs", "Breadcrumbs", "navigation", "Truncated path and route trail renderer.", [
    "render-helper",
  ]),
  component("stepper", "Stepper", "navigation", "Sequential workflow step indicator.", [
    "render-helper",
    "selection",
  ]),
  component("menu-bar", "MenuBar", "navigation", "Top-level command menu row.", [
    "render-helper",
    "selection",
    "keyboard",
  ]),
  component("key-help", "KeyHelp", "navigation", "Formatted key binding help rows.", ["render-helper", "keyboard"]),
  component("command-palette", "CommandPalette", "overlay", "Filterable command surface.", [
    "render-helper",
    "selection",
    "keyboard",
    "async",
  ]),
  component("context-menu", "ContextMenu", "overlay", "Selectable contextual command list.", [
    "render-helper",
    "selection",
    "keyboard",
    "mouse",
  ]),
  component("modal", "Modal", "overlay", "Centered overlay frame and focus target.", [
    "render-helper",
    "keyboard",
    "themeable",
  ]),
  component("toast", "ToastStack", "overlay", "Transient notification stack renderer.", [
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
  component("scroll-area", "ScrollArea", "layout", "Viewport and scrollbar helper renderers.", [
    "render-helper",
    "virtualized",
  ]),
  component("label", "Label", "primitive", "Aligned text component.", ["component", "themeable"]),
  component("text", "Text", "primitive", "Raw text draw object.", ["component", "themeable"]),
] as const satisfies readonly ComponentCatalogEntry[];

export function listComponents(): ComponentCatalogEntry[] {
  return [...componentCatalog];
}

export function findComponent(idOrName: string): ComponentCatalogEntry | undefined {
  const normalized = normalizeComponentLookup(idOrName);
  return componentCatalog.find((entry) =>
    normalizeComponentLookup(entry.id) === normalized || normalizeComponentLookup(entry.name) === normalized
  );
}

export function componentsByCategory(category: ComponentCategory): ComponentCatalogEntry[] {
  return componentCatalog.filter((entry) => entry.category === category);
}

export function componentsWithCapability(capability: ComponentCapability): ComponentCatalogEntry[] {
  return componentCatalog.filter((entry) => entry.capabilities.includes(capability));
}

export function componentCategories(): ComponentCategory[] {
  return [...new Set(componentCatalog.map((entry) => entry.category))].sort();
}

export function componentCapabilities(): ComponentCapability[] {
  return [...new Set(componentCatalog.flatMap((entry) => entry.capabilities))].sort();
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
