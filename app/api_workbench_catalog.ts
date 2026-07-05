import type { DataColumn } from "../src/components/data_table.ts";
import { contrastText } from "../src/app/workbench/mod.ts";
import {
  createWorkbenchVisualizationWindowOptions,
  type WorkbenchVisualizationOptionSource,
  type WorkbenchWindowOption,
} from "../src/app/workbench_window_registry.ts";
import { grWizardThemePalettes } from "../src/grwizard_themes.ts";
import { HTML_CSS_LAYOUT_OPTION_ID, HTML_CSS_LAYOUT_WINDOW_ID } from "../src/markup/demo_fixtures.ts";
import type { ProcessSessionStatus } from "../src/runtime/process_session.ts";
import { terminalStatusTone } from "../src/runtime/terminal_status.ts";

export interface ApiWorkbenchThemeSpec {
  id: string;
  label: string;
  background: string;
  backgroundSoft: string;
  panel: string;
  panelSoft: string;
  surface: string;
  border: string;
  borderStrong: string;
  accent: string;
  accentDeep: string;
  text: string;
  muted: string;
  soft: string;
  good: string;
  warn: string;
  danger: string;
  buttonBg: string;
  buttonText: string;
  buttonActiveBg: string;
  buttonActiveText: string;
  buttonMutedBg: string;
  buttonMutedText: string;
}

export interface ApiWorkbenchProcessRow extends Record<string, unknown> {
  id: string;
  surface: string;
  api: string;
  state: string;
  latency: number;
}

export interface ApiWorkbenchTerminalCellStyleInput {
  foreground?: number;
  background?: number;
  bold?: boolean;
}

export function apiWorkbenchTerminalStatusToneColor(
  status: ProcessSessionStatus | "starting" | undefined,
  theme: ApiWorkbenchThemeSpec,
): string {
  switch (terminalStatusTone(status)) {
    case "good":
      return theme.good;
    case "danger":
      return theme.danger;
    case "warning":
      return theme.warn;
    case "accent":
      return theme.accent;
    case "muted":
      return theme.borderStrong;
  }
}

export function apiWorkbenchTerminalOutputLineStyle(
  source: "stdout" | "stderr" | "system",
  theme: ApiWorkbenchThemeSpec,
): { fg: string; bg: string; bold?: boolean } {
  if (source === "stderr") return { fg: theme.danger, bg: theme.surface, bold: true };
  if (source === "system") return { fg: theme.warn, bg: theme.panelSoft, bold: true };
  return { fg: theme.text, bg: theme.surface };
}

export function apiWorkbenchTerminalAnsiColor(
  code: number | undefined,
  theme: ApiWorkbenchThemeSpec,
  background: boolean,
): string | undefined {
  if (code === undefined) return undefined;
  const normalized = background ? code - 40 : code - 30;
  switch (normalized) {
    case 0:
      return theme.background;
    case 1:
      return theme.danger;
    case 2:
      return theme.good;
    case 3:
      return theme.warn;
    case 4:
      return theme.accent;
    case 5:
      return theme.borderStrong;
    case 6:
      return theme.accent;
    case 7:
      return theme.text;
    default:
      return undefined;
  }
}

export function apiWorkbenchTerminalCellStyle(
  cell: ApiWorkbenchTerminalCellStyleInput,
  theme: ApiWorkbenchThemeSpec,
  cursor: boolean,
): { fg: string; bg: string; bold?: boolean } {
  if (cursor) return { fg: theme.background, bg: theme.accent, bold: true };
  return {
    fg: apiWorkbenchTerminalAnsiColor(cell.foreground, theme, false) ?? theme.text,
    bg: apiWorkbenchTerminalAnsiColor(cell.background, theme, true) ?? theme.surface,
    bold: cell.bold,
  };
}

export const apiWorkbenchPanelTitles: Record<string, string> = {
  explorer: "Explorer",
  inspector: "Inspector",
  data: "Data Table",
  controls: "Controls",
  logs: "Logs",
  three: "Three ASCII",
  htmlLayout: "HTML/CSS Layout",
  terminal: "Terminal",
};

export const apiWorkbenchShortPanelTitles: Record<string, string> = {
  htmlLayout: "Layout",
  inspector: "Inspect",
};

export function apiWorkbenchPanelTitle(id: string, fallback = "Three ASCII"): string {
  return apiWorkbenchPanelTitles[id] ?? fallback;
}

export function apiWorkbenchShortPanelTitle(id: string, fallback?: string): string {
  return apiWorkbenchShortPanelTitles[id] ?? apiWorkbenchPanelTitle(id, fallback);
}

export interface ApiWorkbenchWindowTitleOptions {
  id: string;
  visualizationLabel?: string;
  terminalOutputId?: string;
  terminalOutputTitle?: string;
  terminalShellId?: string;
  terminalShellTitle?: string;
  fallback?: string;
}

export function apiWorkbenchWindowTitle(options: ApiWorkbenchWindowTitleOptions): string {
  if (options.visualizationLabel !== undefined) {
    return options.visualizationLabel || "Visualization";
  }
  if (options.id === options.terminalOutputId && options.terminalOutputTitle) {
    return options.terminalOutputTitle;
  }
  if (options.id === options.terminalShellId && options.terminalShellTitle) {
    return options.terminalShellTitle;
  }
  return apiWorkbenchPanelTitle(options.id, options.fallback);
}

export const TERMINAL_OUTPUT_WINDOW_ID = "terminalOutput";
export const TERMINAL_OUTPUT_OPTION_ID = "terminal-output";
export const TERMINAL_SHELL_WINDOW_ID = "terminalShell";
export const TERMINAL_SHELL_OPTION_ID = "terminal-shell";

export type ApiWorkbenchBuiltInWindowId =
  | "explorer"
  | "inspector"
  | "data"
  | "controls"
  | "logs"
  | "three"
  | typeof HTML_CSS_LAYOUT_WINDOW_ID
  | typeof TERMINAL_OUTPUT_WINDOW_ID
  | typeof TERMINAL_SHELL_WINDOW_ID;

export interface ApiWorkbenchWindowCatalog {
  builtInWindowOrder: readonly ApiWorkbenchBuiltInWindowId[];
  htmlCssLayoutWindowOption: WorkbenchWindowOption;
  terminalOutputWindowOption: WorkbenchWindowOption;
  terminalShellWindowOption: WorkbenchWindowOption;
  visualizationWindowOptions: WorkbenchWindowOption[];
  visualizationWindowOptionIds: string[];
  visualizationWindowOptionById: Map<string, WorkbenchWindowOption>;
  newWindowOptions: WorkbenchWindowOption[];
}

export const apiWorkbenchBuiltInWindowOrder: readonly ApiWorkbenchBuiltInWindowId[] = [
  "explorer",
  "inspector",
  "data",
  "controls",
  "logs",
  "three",
  HTML_CSS_LAYOUT_WINDOW_ID,
  TERMINAL_OUTPUT_WINDOW_ID,
  TERMINAL_SHELL_WINDOW_ID,
];

export const apiWorkbenchHtmlCssLayoutWindowOption: WorkbenchWindowOption = {
  id: HTML_CSS_LAYOUT_OPTION_ID,
  label: "HTML/CSS Layout",
  group: "Layout",
  description: "Renderer-neutral markup, CSS cascade, wrapped flex boxes, and absolute positioning.",
  windowId: HTML_CSS_LAYOUT_WINDOW_ID,
};

export const apiWorkbenchTerminalOutputWindowOption: WorkbenchWindowOption = {
  id: TERMINAL_OUTPUT_OPTION_ID,
  label: "Terminal Output",
  group: "Terminal",
  description: "Run a subprocess inside a managed workbench window with stdout/stderr scrollback.",
  windowId: TERMINAL_OUTPUT_WINDOW_ID,
};

export const apiWorkbenchTerminalShellWindowOption: WorkbenchWindowOption = {
  id: TERMINAL_SHELL_OPTION_ID,
  label: "Shell",
  group: "Terminal",
  description: "Open an interactive PTY-backed shell using the host OS shell.",
  windowId: TERMINAL_SHELL_WINDOW_ID,
};

export function createApiWorkbenchWindowCatalog(
  visualizations: readonly WorkbenchVisualizationOptionSource[],
): ApiWorkbenchWindowCatalog {
  const visualizationWindowOptions = createWorkbenchVisualizationWindowOptions(visualizations);
  const visualizationWindowOptionIds = new Array<string>(visualizationWindowOptions.length);
  const visualizationWindowOptionById = new Map<string, WorkbenchWindowOption>();
  for (let index = 0; index < visualizationWindowOptions.length; index += 1) {
    const option = visualizationWindowOptions[index]!;
    visualizationWindowOptionIds[index] = option.id;
    visualizationWindowOptionById.set(option.id, option);
  }
  return {
    builtInWindowOrder: apiWorkbenchBuiltInWindowOrder,
    htmlCssLayoutWindowOption: apiWorkbenchHtmlCssLayoutWindowOption,
    terminalOutputWindowOption: apiWorkbenchTerminalOutputWindowOption,
    terminalShellWindowOption: apiWorkbenchTerminalShellWindowOption,
    visualizationWindowOptions,
    visualizationWindowOptionIds,
    visualizationWindowOptionById,
    newWindowOptions: [
      apiWorkbenchTerminalShellWindowOption,
      apiWorkbenchTerminalOutputWindowOption,
      apiWorkbenchHtmlCssLayoutWindowOption,
      ...visualizationWindowOptions,
    ],
  };
}

export interface ApiWorkbenchVisualizationThreeProbe {
  three?: unknown;
}

export function apiWorkbenchVisualizationSupportsThree(
  cache: Map<string, boolean>,
  visualizationId: string,
  probe: (visualizationId: string) => ApiWorkbenchVisualizationThreeProbe,
): boolean {
  const cached = cache.get(visualizationId);
  if (cached !== undefined) return cached;
  const supportsThree = Boolean(probe(visualizationId).three);
  cache.set(visualizationId, supportsThree);
  return supportsThree;
}

export function createApiWorkbenchThemes(): ApiWorkbenchThemeSpec[] {
  return grWizardThemePalettes.map((palette) => ({
    id: palette.name,
    label: palette.label,
    background: palette.bg,
    backgroundSoft: palette.bgAlt,
    panel: palette.panel,
    panelSoft: palette.panelAlt,
    surface: palette.surface,
    border: palette.border,
    borderStrong: palette.borderStrong,
    accent: palette.accent,
    accentDeep: palette.accentDeep,
    text: palette.text,
    muted: palette.textMuted,
    soft: palette.textSoft,
    good: palette.success,
    warn: palette.warning,
    danger: palette.danger,
    buttonBg: palette.accentDeep,
    buttonText: contrastText(palette.accentDeep, palette.bg, palette.text),
    buttonActiveBg: palette.accent,
    buttonActiveText: contrastText(palette.accent, palette.bg, palette.text),
    buttonMutedBg: palette.panelAlt,
    buttonMutedText: palette.textMuted,
  }));
}

export const apiWorkbenchRows: ApiWorkbenchProcessRow[] = [
  { id: "explorer", surface: "File Explorer", api: "tree", state: "browsing", latency: 3 },
  { id: "layout", surface: "Adaptive Grid", api: "layout", state: "ready", latency: 4 },
  { id: "tiles", surface: "Tile Layout", api: "layout", state: "balancing", latency: 6 },
  { id: "menu", surface: "Menu Bar", api: "component", state: "active", latency: 2 },
  { id: "scroll", surface: "Scroll Area", api: "viewport", state: "tracking", latency: 3 },
  { id: "data", surface: "Data Table", api: "data", state: "sorted", latency: 8 },
  { id: "modal", surface: "Modal Window", api: "overlay", state: "armed", latency: 4 },
  { id: "theme", surface: "Theme Selector", api: "theme", state: "bound", latency: 5 },
  { id: "worker", surface: "Worker Pool", api: "runtime", state: "queued", latency: 11 },
  { id: "cache", surface: "Cached Resource", api: "runtime", state: "warm", latency: 1 },
];

export function apiWorkbenchLiveRowsInto(
  target: ApiWorkbenchProcessRow[],
  rows: readonly ApiWorkbenchProcessRow[],
  offset: number,
  modulus: number,
): ApiWorkbenchProcessRow[] {
  const safeModulus = Math.max(1, Math.floor(modulus));
  target.length = rows.length;
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index]!;
    target[index] = {
      id: row.id,
      surface: row.surface,
      api: row.api,
      state: row.state,
      latency: Math.max(1, ((row.latency + index + offset) % safeModulus) + 1),
    };
  }
  return target;
}

export const apiWorkbenchColumns: DataColumn<ApiWorkbenchProcessRow>[] = [
  { id: "surface", label: "Surface", width: 18, sortable: true },
  { id: "api", label: "API", width: 10, sortable: true },
  { id: "state", label: "State", width: 10, sortable: true },
  { id: "latency", label: "ms", width: 4, sortable: true, format: (value) => `${value}` },
];

export const apiWorkbenchDocs = [
  "API Workbench demonstrates controller-first composition.",
  "WindowManagerController owns focus, fullscreen, minimized state, and shared top/bottom chrome.",
  "FileExplorerController builds a tree-backed browser for project files and command surfaces.",
  "MenuBarController owns active menu state and selection.",
  "tileRects balances panes across one, two, three, or four columns.",
  "ScrollAreaController clamps offsets and reports scrollbar thumbs.",
  "DataTableController handles keyed selection, sorting, paging, and filtering.",
  "HTML/CSS Layout window runs markup, cascade, wrapped flex, and absolute positioning through LayoutEngine.",
  "Terminal Output window runs a real subprocess, streams stdout/stderr, and keeps bounded scrollback.",
  "ModalController provides centered pop-over content with trapped keyboard focus and action buttons.",
  "ThreePanelFrameView feeds Acerola three.js ASCII cells into the shared workbench frame buffer.",
  "Three ASCII viewports support mousewheel zoom plus click-drag model rotation.",
  "SliderController and CheckBoxController expose input state without renderer coupling.",
  "Theme selection updates all surfaces through shared semantic tokens.",
  "Window controls demonstrate minimize, maximize, restore, focus, and layout recomposition.",
  "Mouse clicks work on window buttons and theme swatches; keyboard shortcuts mirror command surfaces.",
  "This demo intentionally uses public controllers plus canvas primitives so the composition remains transparent.",
  "Resize the terminal: panels collapse from side-by-side to stacked narrow layouts.",
  "Use [ and ] to tune tile density; use T to cycle themes.",
  "Use Tab or 1-8 to focus built-in windows; use M, F, R for window controls.",
];
