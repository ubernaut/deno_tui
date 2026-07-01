import { BoxObject } from "../src/canvas/box.ts";
import { TextObject, type TextRectangle } from "../src/canvas/text.ts";
import { ButtonController } from "../src/components/button.ts";
import { CheckBoxController, renderCheckBoxMark } from "../src/components/checkbox.ts";
import { ComboBoxController } from "../src/components/combobox.ts";
import {
  type DataColumn,
  DataTableController,
  renderDataTableHeader,
  renderDataTableRows,
} from "../src/components/data_table.ts";
import { createFileExplorerTree, FileExplorerController } from "../src/components/file_explorer.ts";
import { InputController } from "../src/components/input.ts";
import { MenuBarController, renderMenuBar } from "../src/components/menu_bar.ts";
import { modalContentHeight, ModalController, renderModalRows } from "../src/components/modal.ts";
import { ProgressBarController } from "../src/components/progressbar.ts";
import { RadioGroupController } from "../src/components/radio_group.ts";
import { ScrollAreaController, scrollbarGlyph, scrollbarOffsetForPointer } from "../src/components/scroll_area.ts";
import { SliderController } from "../src/components/slider.ts";
import { renderStatusBar } from "../src/components/statusbar.ts";
import { renderStepper, StepperController } from "../src/components/stepper.ts";
import { formatTerminalOutputLine } from "../src/components/terminal_output.ts";
import { TextBoxController, wrapTextBoxLines } from "../src/components/textbox.ts";
import {
  buttonText,
  centerCellText as centerText,
  clipRect,
  contrastText,
  createWorkbenchVisualizationWindowOptions,
  deleteWorkbenchWorkspace,
  fillFrameRect,
  fillFrameRow,
  findWorkbenchWorkspace,
  fitCellText as fit,
  HitTargetStack,
  inset,
  intersects,
  isWorkbenchMenuActivationKey,
  isWorkbenchVisualizationWindowId,
  isWorkbenchWindowOptionLoaded,
  layoutWorkbenchModal,
  layoutWorkbenchPopover,
  layoutWorkbenchShelf,
  layoutWorkbenchTabs,
  layoutWorkbenchTitlebar,
  moveWorkbenchMenuIndex,
  normalizeWorkbenchWorkspaceName,
  normalizeWorkbenchWorkspaceStorage,
  renameWorkbenchWorkspace,
  renderFrameRow,
  renderFrameSlice,
  serializeWorkbenchWorkspaces,
  translateHitTargets,
  upsertWorkbenchWorkspace,
  workbenchContentViewport,
  type WorkbenchFrame,
  workbenchRevealActiveRowOffset,
  type WorkbenchTitlebarButtonKind,
  WorkbenchTopMenuController,
  workbenchVisualizationIdFromWindowId,
  workbenchVisualizationWindowId,
  type WorkbenchWindowOption,
  workbenchWindowOptionMenuLabel,
  workbenchWindowOptionMinimums,
  type WorkbenchWorkspace,
  type WorkbenchWorkspaceWindow,
  workbenchWorkspaceWindowEntries,
  writeFrame,
} from "../src/app/workbench/mod.ts";
import { handleInput } from "../src/input.ts";
import type { KeyPressEvent, MousePressEvent, MouseScrollEvent, PasteEvent } from "../src/input_reader/types.ts";
import { routeTerminalKeyPress, routeTerminalPaste, type TerminalInputMode } from "../src/app/terminal_input.ts";
import { WindowManagerController } from "../src/layout/mod.ts";
import { createKittyGraphicsSurface, type GraphicsSurface } from "../src/runtime/graphics_surface.ts";
import { formatProcessCommandLine, ProcessSessionController } from "../src/runtime/process_session.ts";
import { MicrotaskScheduler } from "../src/runtime/render_loop.ts";
import { type AsyncStore, createRuntimeStore, JsonFileStore } from "../src/runtime/storage.ts";
import { type TerminalBackend } from "../src/runtime/terminal_backend.ts";
import { TerminalShellController } from "../src/runtime/terminal_shell.ts";
import {
  formatTerminalShellWindowTitle,
  summarizeTerminalStatus,
  terminalBackendKindLabel,
} from "../src/runtime/terminal_status.ts";
import { Computed, Signal } from "../src/signals/mod.ts";
import { probeCompatibleWebGPUDevice } from "../src/three_ascii/webgpu_compat.ts";
import { Tui } from "../src/tui.ts";
import type { Rectangle } from "../src/types.ts";
import { stripStyles, textWidth } from "../src/utils/strings.ts";
import { resolveWorkbenchShellBackend } from "../src/app/workbench_terminal.ts";
import { AudioRegistry } from "./audio.ts";
import { grWizardThemePalettes } from "../src/grwizard_themes.ts";
import {
  createHtmlCssLayoutDemo,
  HTML_CSS_LAYOUT_OPTION_ID,
  HTML_CSS_LAYOUT_WINDOW_ID,
  htmlCssLayoutDemoBoxLabel,
} from "../src/markup/demo_fixtures.ts";
import {
  applyAsciiPreset,
  ASCII_DEMO_PRESETS,
  asciiControlValues,
  cloneAsciiOptions,
  createDefaultAsciiOptions,
  formatAsciiControlValue,
  normalizeAsciiOptions,
  TERMINAL_GLYPH_STYLES,
  terminalGlyphStyleLabel,
} from "./ascii_options.ts";
import { getSourceFrame } from "./sources.ts";
import { makeStyle } from "./styles.ts";
import { SystemMonitor } from "./system_metrics.ts";
import { requireInteractiveTerminal } from "./terminal_guard.ts";
import { ThreePanelFrameView } from "./three_panel.ts";
import type {
  Accent,
  AsciiOptions,
  PanelRender,
  RenderContext,
  SlotConfig,
  SourceFrame,
  SystemSnapshot,
  ThreeSceneMode,
  ThreeSceneSignal,
} from "./types.ts";
import { cpuHexGridColumnCount, cpuHexTileLayout, renderVisualization, visualizations } from "./visualizations.ts";
import type { ComputedLayoutBox } from "../src/layout/mod.ts";

const TERMINAL_OUTPUT_WINDOW_ID = "terminalOutput";
const TERMINAL_OUTPUT_OPTION_ID = "terminal-output";
const TERMINAL_SHELL_WINDOW_ID = "terminalShell";
const TERMINAL_SHELL_OPTION_ID = "terminal-shell";

type BuiltInWindowId =
  | "explorer"
  | "inspector"
  | "data"
  | "controls"
  | "logs"
  | "three"
  | "htmlLayout"
  | typeof TERMINAL_OUTPUT_WINDOW_ID
  | typeof TERMINAL_SHELL_WINDOW_ID;
type VisualizationWindowId = `viz:${string}`;
type WindowId = BuiltInWindowId | VisualizationWindowId;
const builtInWindowOrder: readonly BuiltInWindowId[] = [
  "explorer",
  "inspector",
  "data",
  "controls",
  "logs",
  "three",
  "htmlLayout",
  TERMINAL_OUTPUT_WINDOW_ID,
  TERMINAL_SHELL_WINDOW_ID,
];
type ControlId =
  | "button"
  | "genericButton"
  | "modal"
  | "slider"
  | "checkbox"
  | "radio"
  | "combo"
  | "dropdown"
  | "input"
  | "stepper"
  | "textbox";
type HitAction =
  | { type: "menu"; index: number }
  | { type: "quit" }
  | { type: "windowTab"; id: WindowId }
  | { type: "focus"; id: WindowId }
  | { type: "minimize"; id: WindowId }
  | { type: "maximize"; id: WindowId }
  | { type: "restore"; id: WindowId }
  | { type: "close"; id: WindowId }
  | { type: "threeConfig"; id: WindowId }
  | { type: "threeViewport"; id: WindowId }
  | { type: "asciiConfig"; index: number; action?: ConfigHitAction }
  | { type: "asciiConfigAction"; action: AsciiConfigModalAction }
  | { type: "asciiConfigBackdrop" }
  | { type: "theme"; index: number }
  | { type: "newWindow"; index: number }
  | { type: "workspace"; index: number }
  | { type: "modalAction"; index: number }
  | { type: "control"; id: ControlId; action?: ControlHitAction; index?: number }
  | { type: "terminalOutput"; action: TerminalOutputAction }
  | { type: "terminalShell"; action: TerminalShellAction }
  | { type: "dataRow"; index: number }
  | { type: "explorerRow"; index: number }
  | { type: "cpuHexTile"; id: VisualizationWindowId; label: string }
  | { type: "windowVScrollbar"; id: WindowId }
  | { type: "windowHScrollbar"; id: WindowId }
  | { type: "workspaceScrollbar" };
type ControlHitAction = "previous" | "next" | "activate" | "set" | "focus" | "toggle";
type ConfigHitAction = "previous" | "next" | "activate";
type AsciiConfigModalAction = "cancel" | "apply" | "ok";
type TerminalOutputAction = "run" | "stop" | "restart" | "clear" | "follow" | "copy" | "raw";
type TerminalShellAction = "start" | "stop" | "restart" | "clear" | "raw" | "copy" | "top" | "bottom";
type ButtonTone = "default" | "danger" | "warning" | "success" | "muted";
type AsciiNumericKey =
  | "edgeThreshold"
  | "normalThreshold"
  | "depthThreshold"
  | "exposure"
  | "attenuation"
  | "blendWithBase"
  | "depthFalloff"
  | "depthOffset"
  | "wireframeThickness"
  | "terminalEdgeBias";
type AsciiToggleKey = "edges" | "fill" | "invertLuminance";
type AsciiKittyKey = "kittyGraphics" | "kittyDisableAscii";

interface ThemeSpec {
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

interface ProcessRow extends Record<string, unknown> {
  id: string;
  surface: string;
  api: string;
  state: string;
  latency: number;
}

type NewWindowOption = WorkbenchWindowOption;

type SavedWorkspace = WorkbenchWorkspace<AsciiOptions>;
type SavedWorkspaceWindow = WorkbenchWorkspaceWindow<AsciiOptions>;

type WorkspaceNameMode = "save" | "rename";
type WorkspaceMenuAction = "save" | "open" | "rename" | "delete" | "empty";

interface WorkspaceMenuEntry {
  label: string;
  action: WorkspaceMenuAction;
  workspaceName?: string;
}

const themes: ThemeSpec[] = grWizardThemePalettes.map((palette) => ({
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

const rows: ProcessRow[] = [
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

const columns: DataColumn<ProcessRow>[] = [
  { id: "surface", label: "Surface", width: 18, sortable: true },
  { id: "api", label: "API", width: 10, sortable: true },
  { id: "state", label: "State", width: 10, sortable: true },
  { id: "latency", label: "ms", width: 4, sortable: true, format: (value) => `${value}` },
];

const docs = [
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
const explorerKeys = new Set(["up", "down", "left", "right", "pageup", "pagedown", "home", "end", "space", "return"]);
const htmlCssLayoutWindowOption: NewWindowOption = {
  id: HTML_CSS_LAYOUT_OPTION_ID,
  label: "HTML/CSS Layout",
  group: "Layout",
  description: "Renderer-neutral markup, CSS cascade, wrapped flex boxes, and absolute positioning.",
  windowId: HTML_CSS_LAYOUT_WINDOW_ID,
};
const terminalOutputWindowOption: NewWindowOption = {
  id: TERMINAL_OUTPUT_OPTION_ID,
  label: "Terminal Output",
  group: "Terminal",
  description: "Run a subprocess inside a managed workbench window with stdout/stderr scrollback.",
  windowId: TERMINAL_OUTPUT_WINDOW_ID,
};
const terminalShellWindowOption: NewWindowOption = {
  id: TERMINAL_SHELL_OPTION_ID,
  label: "Shell",
  group: "Terminal",
  description: "Open an interactive PTY-backed shell using the host OS shell.",
  windowId: TERMINAL_SHELL_WINDOW_ID,
};
const visualizationWindowOptions: NewWindowOption[] = createWorkbenchVisualizationWindowOptions(visualizations);
const newWindowOptions: NewWindowOption[] = [
  terminalShellWindowOption,
  terminalOutputWindowOption,
  htmlCssLayoutWindowOption,
  ...visualizationWindowOptions,
];
const WORKSPACE_STORE_KEY = "api-workbench.workspaces";

requireInteractiveTerminal("deno task api-workbench");

const systemMonitor = new SystemMonitor(72);
await systemMonitor.start(1000);
const workbenchAudioRegistry = new AudioRegistry([]);
const workspaceStore = createWorkspaceStore();
const savedWorkspaces = new Signal<SavedWorkspace[]>(await loadSavedWorkspaces(), { deepObserve: true });
const threeAsciiAvailable = new Signal(await probeCompatibleWebGPUDevice());
const ascii = new Signal<AsciiOptions>(defaultWorkbenchAsciiOptions());
const windowAscii = new Map<WindowId, Signal<AsciiOptions>>([["three", ascii]]);
const tmuxPassthroughAllowed = await detectWorkbenchTmuxPassthrough();

const tui = new Tui({
  style: makeStyle({ bg: themes[0]!.background }),
  refreshRate: 1000 / 24,
  enableMouse: true,
});
const kittyTextEncoder = new TextEncoder();
const autoKittyGraphicsSurface: GraphicsSurface = createWorkbenchKittySurface(false);
const forcedKittyGraphicsSurface: GraphicsSurface = createWorkbenchKittySurface(true);
const terminalOutputSession = new ProcessSessionController({
  command: Deno.execPath(),
  args: [
    "eval",
    [
      "const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));",
      "console.log('deno_tui terminal output window');",
      "console.log('press I in the workbench to enter raw input mode; Escape returns to workbench mode');",
      "const reader = Deno.stdin.readable.getReader();",
      "const decoder = new TextDecoder();",
      "for (let index = 1; index <= 20; index += 1) {",
      "  console.log(`stdout frame ${index}  ${new Date().toISOString()}`);",
      "  if (index % 3 === 0) console.error(`stderr checkpoint ${index}`);",
      "  const input = await Promise.race([reader.read(), sleep(250).then(() => undefined)]);",
      "  if (input?.value) console.log(`stdin bytes ${Array.from(input.value).join(',')}  text=${JSON.stringify(decoder.decode(input.value))}`);",
      "  if (input?.done) break;",
      "}",
      "console.log('process complete');",
    ].join("\n"),
  ],
  limit: 400,
});
const terminalInputMode = new Signal<TerminalInputMode>("workbench");
const terminalShell = new TerminalShellController({
  backendFactory: createWorkbenchShellBackend,
  columns: 80,
  rows: 24,
  scrollbackLimit: 2000,
  onUpdate: scheduleDraw,
});
const terminalShellInputMode = new Signal<TerminalInputMode>("raw");
terminalOutputSession.status.subscribe((status) => {
  if (status !== "running" && terminalInputMode.peek() === "raw") {
    terminalInputMode.value = "workbench";
  }
  scheduleDraw();
});
terminalOutputSession.exit.subscribe(scheduleDraw);
terminalOutputSession.output.lines.subscribe(scheduleDraw);
terminalOutputSession.output.follow.subscribe(scheduleDraw);
terminalInputMode.subscribe(scheduleDraw);
terminalShell.status.subscribe(scheduleDraw);
terminalShell.output.lines.subscribe(scheduleDraw);
terminalShellInputMode.subscribe(scheduleDraw);

async function createWorkbenchShellBackend(): Promise<TerminalBackend> {
  const resolution = await resolveWorkbenchShellBackend({
    onFallback: (reason) => pushLog(`shell PTY unavailable; using process fallback: ${reason}`),
  });
  return resolution.backend;
}

function createWorkbenchKittySurface(force: boolean): GraphicsSurface {
  const canForce = force && (!Deno.env.get("TMUX") || tmuxPassthroughAllowed);
  return createKittyGraphicsSurface({
    writer: {
      write: (data) => {
        tui.stdout.writeSync(kittyTextEncoder.encode(data));
      },
    },
    detection: canForce && Deno.env.get("TMUX") ? { tmuxPassthrough: true } : undefined,
    force: canForce,
    quiet: 2,
    maxChunkBytes: 16384,
  });
}

function kittyGraphicsSurfaceFor(options: AsciiOptions): GraphicsSurface {
  return options.kittyGraphics ? forcedKittyGraphicsSurface : autoKittyGraphicsSurface;
}

async function clearKittyGraphicsSurfaces(): Promise<void> {
  await Promise.all([
    autoKittyGraphicsSurface.clear("visible"),
    forcedKittyGraphicsSurface.clear("visible"),
  ]);
}

async function detectWorkbenchTmuxPassthrough(): Promise<boolean> {
  if (!Deno.env.get("TMUX")) return true;
  try {
    const output = await new Deno.Command("tmux", {
      args: ["show-options", "-gqv", "allow-passthrough"],
    }).output();
    if (!output.success) return false;
    const value = new TextDecoder().decode(output.stdout).trim().toLowerCase();
    return value === "on" || value === "all" || value === "1" || value === "yes";
  } catch {
    return false;
  }
}

handleInput(tui);
tui.dispatch();

const themeIndex = new Signal(0);
const themeMenuOpen = new Signal(false);
const newWindowMenuOpen = new Signal(false);
const newWindowMenuIndex = new Signal(0);
const workspaceMenuOpen = new Signal(false);
const workspaceMenuIndex = new Signal(0);
const workspaceNameDraft = new Signal("");
const workspaceNameMode = new Signal<WorkspaceNameMode | null>(null);
const workspaceTargetName = new Signal<string | null>(null);
const activeWorkspaceName = new Signal<string | null>(null);
const menuFocused = new Signal(false);
const topMenus = new WorkbenchTopMenuController<"theme" | "newWindow" | "workspace">({
  onChange: syncTopMenuState,
});
const threeConfigOpen = new Signal(false);
const threeConfigSelected = new Signal(0);
const threeConfigWindow = new Signal<WindowId>("three");
const threeConfigBaseline = new Signal<AsciiOptions | null>(null);
const activeWindow = new Signal<WindowId>("inspector");
const activeControl = new Signal<ControlId>("button");
const maximized = new Signal<WindowId | null>(null);
const minimized = new Signal<Record<string, boolean>>({
  explorer: false,
  inspector: false,
  data: false,
  controls: false,
  logs: false,
  three: false,
}, { deepObserve: true });
const windowManager = new WindowManagerController({
  activeId: "inspector",
  windows: [
    { id: "explorer", title: "Explorer", minWidth: 26, minHeight: 12 },
    { id: "inspector", title: "Inspector", minWidth: 32, minHeight: 11 },
    { id: "data", title: "Data Table", minWidth: 42, minHeight: 12 },
    { id: "controls", title: "Controls", minWidth: 40, minHeight: 18 },
    { id: "logs", title: "Logs", minWidth: 36, minHeight: 12 },
    { id: "three", title: "Three ASCII", minWidth: 42, minHeight: 16 },
    { id: HTML_CSS_LAYOUT_WINDOW_ID, title: "HTML/CSS Layout", minWidth: 46, minHeight: 16, state: "closed" },
    { id: TERMINAL_OUTPUT_WINDOW_ID, title: "Terminal Output", minWidth: 48, minHeight: 14, state: "closed" },
    { id: TERMINAL_SHELL_WINDOW_ID, title: "Shell", minWidth: 54, minHeight: 16, state: "closed" },
  ],
});
const commandLog = new Signal<string[]>(["ready: API workbench mounted"], { deepObserve: true });
const dynamicVisualizationWindows = new Signal<Record<VisualizationWindowId, string>>({}, { deepObserve: true });
const selectedCpuHexTiles = new Signal<Record<VisualizationWindowId, string>>({}, { deepObserve: true });
const lineSignals: Signal<string>[] = [];
const hitTargets = new HitTargetStack<HitAction>();
let lastVisibleWindow: WindowId | null = null;
let lastWorkspaceWidth = 0;
let lastWorkspaceHeight = 0;
let dropdownOverlay: DropdownOverlay | null = null;
let threeDragWindow: WindowId | null = null;
let windowRenderContext: WindowRenderContext | null = null;
let workspacePlacementContext: WorkspacePlacementContext | null = null;
const drawScheduler = new MicrotaskScheduler();
let renderedVisualizationThreePanels = new Set<VisualizationWindowId>();
type Frame = WorkbenchFrame;
interface DropdownOverlay {
  kind: "control" | "theme" | "newWindow" | "workspace";
  coordinate: "workspace" | "screen";
  rect: Rectangle;
  items: string[];
  itemIndexes?: number[];
  selectedIndex?: number;
}
type WorkbenchThreeScene = { mode: ThreeSceneMode; signal: ThreeSceneSignal };
interface DynamicThreePanel {
  rectangle: Signal<Rectangle>;
  graphicsRectangle: Signal<Rectangle>;
  scene: Signal<WorkbenchThreeScene | null>;
  panel: ThreePanelFrameView;
}
interface WindowRenderContext {
  viewport: Rectangle;
  offset: { columns: number; rows: number };
}
interface WorkspacePlacementContext {
  rowDelta: number;
  columnDelta: number;
  clip: Rectangle;
}

const menu = new MenuBarController({
  items: [
    { id: "file", label: "File" },
    { id: "new", label: "New" },
    { id: "workspace", label: "Workspace" },
    { id: "view", label: "View" },
    { id: "layout", label: "Layout" },
    { id: "theme", label: "Theme" },
    { id: "help", label: "Help" },
  ],
  onSelect: (item) => {
    if (item.id === "new") {
      topMenus.toggle("newWindow");
      newWindowMenuIndex.value = Math.max(0, Math.min(newWindowMenuIndex.peek(), newWindowOptions.length - 1));
      pushLog(`${newWindowMenuOpen.peek() ? "open" : "close"} new window menu`);
      return;
    }
    if (item.id === "theme") {
      topMenus.toggle("theme");
      pushLog(`${themeMenuOpen.peek() ? "open" : "close"} theme menu`);
      return;
    }
    if (item.id === "workspace") {
      topMenus.toggle("workspace");
      workspaceMenuIndex.value = Math.max(0, Math.min(workspaceMenuIndex.peek(), workspaceMenuItemCount() - 1));
      pushLog(`${workspaceMenuOpen.peek() ? "open" : "close"} workspace menu`);
      return;
    }
    if (item.id === "help") {
      topMenus.close();
      openHelpModal();
      return;
    }
    topMenus.close(false);
    topMenus.focus();
    pushLog(`menu selected: ${item.label}`);
  },
});
const tileDensity = new Signal(0);
const workspaceScroll = new ScrollAreaController({ showScrollbar: true });
const windowScrolls = new Map<WindowId, ScrollAreaController>(
  builtInWindowOrder.map((id) => [id, new ScrollAreaController({ showScrollbar: true })]),
);
const density = new SliderController({ min: 1, max: 10, step: 1, value: 6, orientation: "horizontal" });
const livePreview = new CheckBoxController({ checked: true });
const compactRows = new CheckBoxController({ checked: false });
const actionButton = new ButtonController({
  label: "Run Action",
  onPress: () => pushLog("button pressed"),
});
const genericButton = new ButtonController({
  label: "Generic Button",
  onPress: () => pushLog("generic button pressed"),
});
const modalButton = new ButtonController({
  label: "Open Modal",
  onPress: () => openWorkbenchModal(),
});
const modal = new ModalController({
  title: "Confirm Action",
  body: [
    "Modal windows sit above the workspace and can contain text, menus, warnings, errors, and buttons.",
    "Use Tab or arrow keys to move between actions; Enter activates the selected action.",
  ],
  tone: "confirm",
  actions: [
    { id: "cancel", label: "Cancel" },
    { id: "details", label: "Details" },
    { id: "confirm", label: "Confirm", default: true },
  ],
  onAction: (action) => applyModalAction(action.id),
});
const modeRadio = new RadioGroupController({
  options: [
    { value: "fast", label: "Fast" },
    { value: "balanced", label: "Balanced" },
    { value: "precise", label: "Precise" },
  ],
  selectedValue: "balanced",
});
const themeCombo = new ComboBoxController({
  items: themes.map((entry) => entry.label),
  selectedIndex: 0,
  placeholder: "theme",
  onSelect: (_item, index) => setTheme(index),
});
const dropdown = new ComboBoxController({
  items: ["CPU stream", "GPU queue", "Network bus", "Disk cache"],
  selectedIndex: 1,
  placeholder: "source",
  onSelect: (item) => pushLog(`dropdown selected: ${item}`),
});
const commandInput = new InputController({
  text: "deno task health",
  cursorPosition: "deno task health".length,
  placeholder: "type command",
  onSubmit: (value) => pushLog(`input submitted: ${value}`),
});
const workflowStepper = new StepperController({
  steps: [
    { id: "draft", label: "Draft", completed: true },
    { id: "review", label: "Review" },
    { id: "ship", label: "Ship" },
  ],
  activeIndex: 1,
});
const progress = new ProgressBarController({
  min: 0,
  max: 100,
  value: 42,
  smooth: false,
  direction: "normal",
  orientation: "horizontal",
});
const initialNotesText =
  "Editable notes\nclick controls or type here. This text box keeps newline breaks and wraps long lines inside the control.";
const notes = new TextBoxController({
  text: initialNotesText,
  cursorPosition: { x: initialNotesText.split("\n").at(-1)?.length ?? 0, y: 1 },
  wordWrap: true,
});
const explorer = new FileExplorerController({
  root: createFileExplorerTree([
    "/README.md",
    "/mod.ts",
    "/app/api_workbench.ts",
    "/app/neon_exodus.ts",
    "/src/components/file_explorer.ts",
    "/src/components/tree.ts",
    "/src/components/modal.ts",
    "/src/components/data_table.ts",
    "/src/layout/window_manager.ts",
    "/src/layout/responsive.ts",
    "/src/app/commands.ts",
    "/src/runtime/worker_pool.ts",
    "/tests/widget_helpers.test.ts",
    "/tests/responsive_layout.test.ts",
  ]),
  onOpen: (entry) => pushLog(`open ${entry.path}`),
});
const table = new DataTableController<ProcessRow>({
  rows,
  columns,
  rowKey: (row) => row.id,
  initialState: { pageSize: 5, sort: { columnId: "latency", direction: "asc" } },
});
const threeBodyRect = new Signal<Rectangle>({ column: 0, row: 0, width: 0, height: 0 }, { deepObserve: true });
const threeGraphicsRect = new Signal<Rectangle>({ column: 0, row: 0, width: 0, height: 0 }, { deepObserve: true });
const threeScene = new Computed<{ mode: ThreeSceneMode; signal: ThreeSceneSignal } | null>(() =>
  minimized.value.three || !threeAsciiAvailable.value ? null : {
    mode: "studio",
    signal: {
      x: density.value.value / 10,
      y: progress.value.value / 100,
      depth: density.value.value / 10,
      twist: compactRows.checked.value ? 0.8 : 0.25,
      lift: progress.ratio(),
      pulse: livePreview.checked.value ? 0.7 : 0.15,
      active: activeWindow.value === "three",
      pressed: activeControl.value === "button",
    },
  }
);
const threePanel = new ThreePanelFrameView({
  rectangle: threeBodyRect,
  graphicsRectangle: threeGraphicsRect,
  scene: threeScene,
  ascii,
  enabled: threeAsciiAvailable,
  graphicsSurface: () => kittyGraphicsSurfaceFor(ascii.peek()),
  frameInterval: 1000 / 18,
  onUpdate: scheduleDraw,
});
const visualizationThreePanels = new Map<VisualizationWindowId, DynamicThreePanel>();
const visualizationThreeSupport = new Map<string, boolean>();

new BoxObject({
  canvas: tui.canvas,
  rectangle: tui.rectangle,
  style: new Computed(() => makeStyle({ bg: theme().background })),
  zIndex: -1,
}).draw();

ensureLineObjects();
tui.rectangle.subscribe(() => {
  ensureLineObjects();
  draw();
});

tui.on("keyPress", (event) => {
  if (event.ctrl && event.key === "c" && !shellShouldReceiveCtrlC()) return;
  if (threeConfigOpen.peek()) {
    handleThreeConfigKey(event);
    draw();
    return;
  }
  if (modal.openState.peek()) {
    if (workspaceNameMode.peek() && handleWorkspaceNameKey(event)) {
      draw();
      return;
    }
    modal.handleKeyPress(event);
    draw();
    return;
  }
  if (screenDropdownOpen()) {
    handleScreenDropdownKey(event);
    draw();
    return;
  }
  if (menuFocused.peek()) {
    handleMenuFocusKey(event);
    draw();
    return;
  }
  if (isTextControlActive() && event.key === "escape") {
    blurTextControl();
    draw();
    return;
  }
  if (isTextControlActive() && event.key === "tab") {
    focusNextControl(event.shift ? -1 : 1);
    draw();
    return;
  }
  if (isTextControlActive()) {
    handleControlsKey(event);
    draw();
    return;
  }
  handleWorkbenchKey(event);
  draw();
});

tui.on("paste", (event) => {
  if (handleTerminalShellPaste(event)) draw();
});

tui.on("mousePress", (event) => {
  if (event.release) {
    threeDragWindow = null;
    return;
  }
  if (event.drag && threeDragWindow) {
    if (rotateThreeWindow(threeDragWindow, event)) {
      draw();
      return;
    }
    threeDragWindow = null;
  }
  const hit = findHit(event.x, event.y);
  if (hit?.action.type === "threeViewport") {
    threeDragWindow = hit.action.id;
    focusWindowSilently(hit.action.id);
    if (event.drag) rotateThreeWindow(hit.action.id, event);
    draw();
    return;
  }
  threeDragWindow = null;
  if (hit) applyHit(hit, event.x, event.y);
  draw();
});

tui.on("mouseScroll", (event) => {
  if (zoomThreeWindowAt(event)) {
    draw();
    return;
  }
  const hovered = windowAt(event.x, event.y);
  if (hovered) {
    scrollWindow(hovered, event.shift ? event.scroll * 4 : 0, event.shift ? 0 : event.scroll);
  } else {
    workspaceScroll.scrollBy(0, event.scroll);
  }
  draw();
});

const liveTimer = setInterval(() => {
  if (livePreview.checked.peek()) {
    const nextRows = rows.map((row, index) => ({
      ...row,
      latency: Math.max(1, ((row.latency + index + density.value.peek()) % 17) + 1),
    }));
    table.rows.value = nextRows;
    draw();
  }
}, 500);
const resizeTimer = setInterval(() => {
  if (syncTerminalSize()) draw();
}, 100);

tui.on("destroy", () => {
  clearInterval(liveTimer);
  clearInterval(resizeTimer);
  menu.dispose();
  workspaceScroll.dispose();
  for (const scroll of windowScrolls.values()) {
    scroll.dispose();
  }
  windowManager.dispose();
  density.dispose();
  livePreview.dispose();
  compactRows.dispose();
  actionButton.dispose();
  genericButton.dispose();
  modeRadio.dispose();
  themeCombo.dispose();
  dropdown.dispose();
  modalButton.dispose();
  modal.dispose();
  newWindowMenuIndex.dispose();
  workspaceMenuIndex.dispose();
  workspaceNameDraft.dispose();
  workspaceNameMode.dispose();
  workspaceTargetName.dispose();
  activeWorkspaceName.dispose();
  savedWorkspaces.dispose();
  menuFocused.dispose();
  threeConfigOpen.dispose();
  threeConfigSelected.dispose();
  threeConfigWindow.dispose();
  threeConfigBaseline.dispose();
  dynamicVisualizationWindows.dispose();
  selectedCpuHexTiles.dispose();
  commandInput.dispose();
  workflowStepper.dispose();
  progress.dispose();
  notes.dispose();
  explorer.dispose();
  table.dispose();
  threePanel.dispose();
  for (const entry of visualizationThreePanels.values()) {
    entry.panel.dispose();
    entry.scene.dispose();
    entry.rectangle.dispose();
    entry.graphicsRectangle.dispose();
  }
  visualizationThreePanels.clear();
  threeScene.dispose();
  threeBodyRect.dispose();
  threeGraphicsRect.dispose();
  void clearKittyGraphicsSurfaces();
  void terminalOutputSession.dispose();
  void terminalShell.dispose();
  terminalInputMode.dispose();
  terminalShellInputMode.dispose();
  systemMonitor.stop();
  workbenchAudioRegistry.dispose();
  for (const [id, signal] of windowAscii) {
    if (id !== "three") signal.dispose();
  }
  windowAscii.clear();
  ascii.dispose();
  threeAsciiAvailable.dispose();
  drawScheduler.cancel();
});

tui.run();
syncTerminalSize();
draw();

function draw(): void {
  syncTerminalSize();
  ensureLineObjects();
  const width = currentWidth();
  const height = currentHeight();
  hitTargets.clear();
  dropdownOverlay = null;
  const frame: Frame = Array.from({ length: height }, () => []);
  renderHeader(frame);
  renderWorkspace(frame);
  renderStatus(frame);
  renderActiveDropdownOverlay(frame);
  renderModalOverlay(frame);
  for (let row = 0; row < height; row += 1) {
    lineSignals[row]!.value = renderFrameRow(frame[row] ?? [], width);
  }
  for (let row = height; row < lineSignals.length; row += 1) {
    lineSignals[row]!.value = "";
  }
}

function scheduleDraw(): void {
  drawScheduler.schedule(draw);
}

function renderHeader(frame: Frame): void {
  const width = currentWidth();
  const t = theme();
  fillRow(frame, 0, t.backgroundSoft);
  fillRow(frame, 1, t.panel);
  write(frame, 0, 0, paint(" API WORKBENCH ", { fg: t.background, bg: t.accent, bold: true }));
  const menuStart = 17;
  const closeLabel = width >= 20 ? buttonText("x", { compact: true }) : "";
  const closeWidth = textWidth(closeLabel);
  const menuWidth = Math.max(0, width - menuStart - closeWidth);
  renderMenuHits(menuStart, 0, menuWidth);
  write(
    frame,
    0,
    menuStart,
    paint(fit(renderMenuBar(menu.items.peek(), menu.activeIndex.peek()), menuWidth), {
      fg: t.text,
      bg: t.backgroundSoft,
    }),
  );
  if (closeLabel) {
    const closeColumn = Math.max(0, width - closeWidth);
    writeButton(frame, 0, closeColumn, "x", { compact: true, tone: "danger" });
    addHit({ column: closeColumn, row: 0, width: closeWidth, height: 1 }, { type: "quit" });
  }
  if (themeMenuOpen.peek()) {
    const themeRect = menuItemRect(
      menuStart,
      "theme",
      Math.max(20, ...themes.map((entry) => textWidth(entry.label) + 6)),
      themes.length + 2,
    );
    dropdownOverlay = {
      kind: "theme",
      coordinate: "screen",
      rect: themeRect,
      items: themes.map((entry) => entry.label),
      selectedIndex: themeIndex.peek(),
    };
  }
  if (newWindowMenuOpen.peek()) {
    const labels = newWindowOptions.map((entry) => newWindowMenuLabel(entry));
    const visible = visibleMenuSlice(labels, newWindowMenuIndex.peek(), Math.max(6, currentHeight() - 5));
    const menuRect = menuItemRect(
      menuStart,
      "new",
      Math.max(28, ...labels.map((label) => textWidth(label) + 6)),
      visible.items.length + 2,
    );
    dropdownOverlay = {
      kind: "newWindow",
      coordinate: "screen",
      rect: menuRect,
      items: visible.items,
      itemIndexes: visible.indexes,
      selectedIndex: visible.indexes.indexOf(newWindowMenuIndex.peek()),
    };
  }
  if (workspaceMenuOpen.peek()) {
    const labels = workspaceMenuLabels();
    const visible = visibleMenuSlice(labels, workspaceMenuIndex.peek(), Math.max(6, currentHeight() - 5));
    const menuRect = menuItemRect(
      menuStart,
      "workspace",
      Math.max(30, ...labels.map((label) => textWidth(label) + 6)),
      visible.items.length + 2,
    );
    dropdownOverlay = {
      kind: "workspace",
      coordinate: "screen",
      rect: menuRect,
      items: visible.items,
      itemIndexes: visible.indexes,
      selectedIndex: visible.indexes.indexOf(workspaceMenuIndex.peek()),
    };
  }
  const help = width >= 132
    ? "F10 menu  N new  T theme  G config  C close  Tab focus  M/F/R  Q quit"
    : width >= 96
    ? "F10 menu  N new  G config  Tab  M/F/R  Q quit"
    : width >= 56
    ? "F10 menu  N new  Tab focus  Q quit"
    : "F10 menu  Q quit";
  const helpWidth = textWidth(help);
  const showHelp = width >= 34;
  const helpStart = showHelp ? Math.max(0, width - helpWidth) : width;
  if (showHelp) {
    write(
      frame,
      1,
      helpStart,
      paint(help, {
        fg: t.muted,
        bg: t.panel,
      }),
    );
  }
}

function renderMenuHits(column: number, row: number, width: number): void {
  let cursor = column;
  for (const [index, item] of menu.items.peek().entries()) {
    const label = item.disabled ? `(${item.label})` : item.label;
    const token = index === menu.activeIndex.peek() ? `[${label}]` : label;
    const tokenWidth = textWidth(token);
    if (cursor + tokenWidth > column + width) break;
    addHit({ column: cursor, row, width: tokenWidth, height: 1 }, { type: "menu", index });
    cursor += tokenWidth + 1;
  }
}

function menuItemRect(menuStart: number, itemId: string, preferredWidth: number, preferredHeight: number): Rectangle {
  let cursor = menuStart;
  for (const [index, item] of menu.items.peek().entries()) {
    const label = item.disabled ? `(${item.label})` : item.label;
    const token = index === menu.activeIndex.peek() ? `[${label}]` : label;
    if (item.id === itemId) {
      return {
        column: cursor,
        row: 1,
        width: Math.min(preferredWidth, Math.max(20, currentWidth() - cursor)),
        height: preferredHeight,
      };
    }
    cursor += textWidth(token) + 1;
  }
  return { column: menuStart, row: 1, width: Math.min(preferredWidth, currentWidth()), height: preferredHeight };
}

function renderWorkspace(frame: Frame): void {
  const bounds = { column: 0, row: 3, width: currentWidth(), height: Math.max(0, currentHeight() - 5) };
  fillRect(frame, bounds, theme().backgroundSoft);
  renderedVisualizationThreePanels = new Set();
  if (bounds.width < 2 || bounds.height < 1) {
    setThreeBodyRect({ column: 0, row: 0, width: 0, height: 0 });
    setThreeGraphicsRect({ column: 0, row: 0, width: 0, height: 0 });
    hideVisualizationThreePanelsExcept(renderedVisualizationThreePanels);
    return;
  }
  const layout = workspaceLayout({ column: 0, row: 0, width: Math.max(1, bounds.width - 1), height: bounds.height });
  workspaceScroll.setViewportSize(layout.bounds.width, bounds.height);
  workspaceScroll.setContentSize(layout.bounds.width, layout.contentHeight);
  ensureActiveWindowVisible(layout, bounds.height);
  const offset = workspaceScroll.offset.peek().rows;
  const virtual: Frame = Array.from({ length: Math.max(bounds.height, layout.contentHeight) }, () => []);
  fillRect(virtual, layout.bounds, theme().backgroundSoft);
  const hitStart = hitTargets.length;
  const max = maximized.peek();
  if (max) {
    withWorkspacePlacement(bounds, offset, () => renderWindow(virtual, max, layout.bounds));
    if (max !== "three") {
      setThreeBodyRect({ column: 0, row: 0, width: 0, height: 0 });
      setThreeGraphicsRect({ column: 0, row: 0, width: 0, height: 0 });
    }
    hideVisualizationThreePanelsExcept(renderedVisualizationThreePanels);
    translateWorkspaceHits(hitStart, bounds.row - offset, bounds);
    blitWorkspace(frame, virtual, bounds, offset, layout.bounds.width);
    renderWorkspaceScrollbar(frame, bounds);
    renderWindowTabs(frame);
    return;
  }

  const visible = windowIds().filter((id) => !minimized.peek()[id]);
  if (visible.length === 0) {
    setThreeBodyRect({ column: 0, row: 0, width: 0, height: 0 });
    setThreeGraphicsRect({ column: 0, row: 0, width: 0, height: 0 });
    hideVisualizationThreePanelsExcept(new Set());
    write(frame, bounds.row + 1, 2, paint(emptyWorkspaceMessage(), { fg: theme().warn }));
    renderShelf(frame);
    return;
  }

  let renderedThree = false;
  withWorkspacePlacement(bounds, offset, () => {
    for (const id of visible) {
      const rect = layout.rects.get(id);
      if (rect) {
        renderWindow(virtual, id, rect);
        if (id === "three") {
          renderedThree = true;
        }
      }
    }
  });
  if (!renderedThree) {
    setThreeBodyRect({ column: 0, row: 0, width: 0, height: 0 });
    setThreeGraphicsRect({ column: 0, row: 0, width: 0, height: 0 });
  }
  hideVisualizationThreePanelsExcept(renderedVisualizationThreePanels);
  translateWorkspaceHits(hitStart, bounds.row - offset, bounds);
  blitWorkspace(frame, virtual, bounds, offset, layout.bounds.width);
  renderWorkspaceScrollbar(frame, bounds);
  renderShelf(frame);
}

function renderWindow(frame: Frame, id: WindowId, rect: Rectangle): void {
  if (rect.width < 8 || rect.height < 4 || minimized.peek()[id]) return;
  const t = theme();
  const active = activeWindow.peek() === id;
  addHit(rect, { type: "focus", id });
  drawFrame(frame, rect, windowTitle(id), active);
  for (
    const button of layoutWorkbenchTitlebar({
      rect,
      title: windowTitle(id),
      showConfig: isThreeRenderedWindow(id),
    }).buttons
  ) {
    writeButton(frame, button.rect.row, button.rect.column, button.label, {
      compact: button.compact,
      tone: button.tone,
    });
    addHit(button.rect, titlebarHit(id, button.kind));
  }

  const inner = inset(rect, 1);
  const scroll = windowScroll(id);
  const contentSize = windowContentSize(id, inner);
  const viewport = workbenchContentViewport({
    inner,
    contentWidth: contentSize.width,
    contentHeight: contentSize.height,
  });
  scroll.setViewportSize(viewport.width, viewport.height);
  scroll.setContentSize(contentSize.width, contentSize.height);
  fillRect(frame, inner, t.surface);
  const contentFrame: Frame = Array.from({ length: contentSize.height }, () => []);
  fillRect(contentFrame, { column: 0, row: 0, width: contentSize.width, height: contentSize.height }, t.surface);
  const contentHitStart = hitTargets.length;
  const previousWindowRenderContext = windowRenderContext;
  windowRenderContext = { viewport, offset: scroll.offset.peek() };
  try {
    renderWindowContent(contentFrame, id, { column: 0, row: 0, width: contentSize.width, height: contentSize.height });
  } finally {
    windowRenderContext = previousWindowRenderContext;
  }
  translateDropdownOverlayForWindow(id, viewport, scroll.offset.peek());
  translateContentHits(contentHitStart, viewport, scroll.offset.peek());
  blitWindowContent(frame, contentFrame, viewport, scroll.offset.peek());
  renderWindowScrollbars(frame, id, inner, viewport, contentSize);
}

function titlebarHit(id: WindowId, kind: WorkbenchTitlebarButtonKind): HitAction {
  if (kind === "config") return { type: "threeConfig", id };
  if (kind === "minimize") return { type: "minimize", id };
  if (kind === "maximize") return { type: "maximize", id };
  if (kind === "close") return { type: "close", id };
  return { type: "restore", id };
}

function renderWindowContent(frame: Frame, id: WindowId, rect: Rectangle): void {
  if (id === "explorer") renderExplorer(frame, rect);
  else if (id === "inspector") renderInspector(frame, rect);
  else if (id === "data") renderData(frame, rect);
  else if (id === "controls") renderControls(frame, rect);
  else if (id === "logs") renderLogs(frame, rect);
  else if (id === "htmlLayout") renderHtmlCssLayout(frame, rect);
  else if (id === TERMINAL_OUTPUT_WINDOW_ID) renderTerminalOutput(frame, rect);
  else if (id === TERMINAL_SHELL_WINDOW_ID) renderTerminalShell(frame, rect);
  else if (isVisualizationWindow(id)) renderVisualizationWindow(frame, id, rect);
  else renderThree(frame, rect);
}

function renderVisualizationWindow(frame: Frame, id: VisualizationWindowId, rect: Rectangle): void {
  const visualizationId = dynamicVisualizationWindows.peek()[id];
  const option = visualizationOption(visualizationId);
  const t = theme();
  if (!visualizationId || !option) {
    writeRows(frame, rect, [{ text: "Visualization window not found", fg: t.warn, bg: t.surface, bold: true }]);
    return;
  }
  const context = buildVisualizationContext(visualizationId, rect, { windowId: id });
  const rendered = renderVisualization(context);
  const accent = accentColor(rendered.accent);
  const lines = rendered.body.split("\n");
  const useThreeScene = Boolean(rendered.three && threeAsciiAvailable.peek() && rect.width >= 8 && rect.height >= 9);
  if (useThreeScene) {
    writeRows(frame, rect, [
      {
        text: ` ${option.group.toUpperCase()} · ${rendered.title ?? option.label.toUpperCase()} `,
        fg: contrastText(accent, t.background, t.text),
        bg: accent,
        bold: true,
      },
      {
        text: rendered.alert ? `! ${rendered.alert}` : option.description,
        fg: rendered.severity === "alarm" ? t.danger : rendered.severity === "warning" ? t.warn : t.soft,
        bg: t.surface,
        bold: rendered.severity !== "info",
      },
      {
        text: visualizationThreeStatusLine(rendered, option, context.slot.ascii),
        fg: t.buttonActiveText,
        bg: t.buttonActiveBg,
        bold: true,
      },
    ]);
    if (rect.height > 3) {
      write(
        frame,
        rect.row + rect.height - 1,
        rect.column,
        paint(fit(rendered.footer, rect.width), { fg: t.muted, bg: t.panelSoft }),
      );
    }
    const sceneRect = {
      column: rect.column,
      row: rect.row + 3,
      width: rect.width,
      height: Math.max(0, rect.height - 4),
    };
    addHit(sceneRect, { type: "threeViewport", id });
    const entry = ensureVisualizationThreePanel(id);
    setSignalRect(entry.rectangle, { column: 0, row: 0, width: sceneRect.width, height: sceneRect.height });
    setSignalRect(entry.graphicsRectangle, contentRectToGraphicsRect(sceneRect));
    entry.scene.value = rendered.three ?? null;
    renderedVisualizationThreePanels.add(id);
    renderThreeGrid(frame, sceneRect, entry.panel.grid.peek(), t);
    return;
  }
  hideVisualizationThreePanel(id);
  writeRows(frame, rect, [
    {
      text: ` ${option.group.toUpperCase()} · ${rendered.title ?? option.label.toUpperCase()} `,
      fg: contrastText(accent, t.background, t.text),
      bg: accent,
      bold: true,
    },
    {
      text: rendered.alert ? `! ${rendered.alert}` : option.description,
      fg: rendered.severity === "alarm" ? t.danger : rendered.severity === "warning" ? t.warn : t.soft,
      bg: t.surface,
      bold: rendered.severity !== "info",
    },
    ...lines.map((text, index) => ({
      text,
      fg: index % 3 === 0 ? accent : index % 3 === 1 ? t.text : t.soft,
      bg: t.surface,
      bold: index === 0,
    })),
    { text: rendered.footer, fg: t.muted, bg: t.panelSoft },
  ]);
  if (visualizationId === "cpu-hex-grid") {
    addCpuHexTileHits(id, rect, context);
  }
}

function addCpuHexTileHits(id: VisualizationWindowId, rect: Rectangle, context: RenderContext): void {
  const tiles = cpuHexTileLayout(context.system.cpuCores, context.width, context.height);
  const bodyHeaderRows = 2;
  const cpuHexSummaryRows = 2;
  const rowOffset = rect.row + bodyHeaderRows + cpuHexSummaryRows;
  for (const tile of tiles) {
    addHit({
      column: rect.column + tile.column,
      row: rowOffset + tile.row,
      width: tile.width,
      height: tile.height,
    }, { type: "cpuHexTile", id, label: tile.label });
  }
}

function renderThree(frame: Frame, rect: Rectangle): void {
  const t = theme();
  const mode = threeRendererModeLabel(ascii.peek()).toUpperCase();
  if (threeAsciiAvailable.peek()) {
    writeRows(frame, rect, threeHeaderRows(mode, rect.width, t));
    const sceneRect = {
      column: rect.column,
      row: rect.row + 3,
      width: rect.width,
      height: Math.max(0, rect.height - 3),
    };
    addHit(sceneRect, { type: "threeViewport", id: "three" });
    setThreeBodyRect({ column: 0, row: 0, width: sceneRect.width, height: sceneRect.height });
    setThreeGraphicsRect(contentRectToGraphicsRect(sceneRect));
    renderThreeGrid(frame, sceneRect, threePanel.grid.peek(), t);
    return;
  }

  setThreeBodyRect({ column: 0, row: 0, width: 0, height: 0 });
  setThreeGraphicsRect({ column: 0, row: 0, width: 0, height: 0 });
  const fallback = renderThreeFallback(rect.width, rect.height, t);
  writeRows(frame, rect, fallback);
}

function renderThreeGrid(frame: Frame, rect: Rectangle, grid: string[][], t: ThemeSpec): void {
  if (rect.width <= 0 || rect.height <= 0) return;

  if (grid.length === 0) {
    const message = threeAsciiAvailable.peek() ? "renderer warming up" : "renderer unavailable";
    write(
      frame,
      rect.row + Math.floor(rect.height / 2),
      rect.column,
      paint(centerText(message, rect.width), { fg: t.warn, bg: t.surface }),
    );
    return;
  }

  for (let row = 0; row < rect.height; row += 1) {
    const source = grid[row] ?? [];
    const target = frame[rect.row + row] ??= [];
    for (let column = 0; column < rect.width; column += 1) {
      target[rect.column + column] = source[column] ?? paint(" ", { bg: t.surface });
    }
  }
}

function renderThreeFallback(width: number, height: number, t: ThemeSpec): RowStyle[] {
  const title = ` THREE ASCII FALLBACK · ${terminalGlyphStyleLabel(ascii.peek().terminalGlyphStyle).toUpperCase()} `;
  const body = [
    "         .-=========-.         ",
    "      .-#%%%@@@@@@%%%#-.       ",
    "    .+%%@*=-.     .-=*@%+.     ",
    "   :#%@-     TORUS     -@%#:   ",
    "   *%@=   <> SPHERE <>  =@%*   ",
    "   :#%@-      CUBE      -@%#:  ",
    "    .+%%@*=-.     .-=*@%+.     ",
    "      .-#%%%@@@@@@%%%#-.       ",
    "         `-=========-'         ",
  ];
  return [
    { text: title, fg: t.buttonActiveText, bg: t.buttonActiveBg, bold: true },
    {
      text: threeAsciiAvailable.peek()
        ? "renderer warming up"
        : "WebGPU/WebGL backend unavailable; text preview active",
      fg: t.warn,
      bg: t.surface,
      bold: !threeAsciiAvailable.peek(),
    },
    { text: "", bg: t.surface },
    ...body.slice(0, Math.max(0, height - 5)).map((text, index) => ({
      text: centerText(text, width),
      fg: index % 3 === 0 ? t.accent : index % 3 === 1 ? t.good : t.warn,
      bg: t.surface,
      bold: true,
    })),
    { text: "scene: torus knot + sphere + box + floor", fg: t.soft, bg: t.surface },
  ];
}

function renderExplorer(frame: Frame, rect: Rectangle): void {
  const t = theme();
  const visible = explorer.tree.visibleRows();
  const selectedIndex = explorer.tree.selectedIndex.peek();
  writeRows(
    frame,
    rect,
    visible.map((row) => {
      const selected = row.index === selectedIndex;
      const node = row.node as { kind?: string; path?: string };
      const icon = row.hasChildren ? row.expanded ? "▾" : "▸" : node.kind === "file" ? "·" : " ";
      const label = `${"  ".repeat(row.depth)}${icon} ${row.label}`;
      return {
        text: label,
        fg: selected ? contrastText(t.warn, t.background, t.text) : node.kind === "directory" ? t.good : t.text,
        bg: selected ? t.warn : t.surface,
        bold: selected || node.kind === "directory",
      };
    }),
  );
  for (let index = 0; index < visible.length; index += 1) {
    addHit({ column: rect.column, row: rect.row + index, width: rect.width, height: 1 }, {
      type: "explorerRow",
      index,
    });
  }
}

function renderInspector(frame: Frame, rect: Rectangle): void {
  const t = theme();
  const headerLines = [
    { text: " Composable API surfaces ", fg: t.background, bg: t.accent, bold: true },
    { text: "explorer  FileExplorerController", fg: t.good, bg: t.surface },
    { text: "menu      MenuBarController", fg: t.good, bg: t.surface },
    { text: "layout    WindowManagerController", fg: t.good, bg: t.surface },
    { text: "viewport  ScrollAreaController", fg: t.good, bg: t.surface },
    { text: "data      DataTableController", fg: t.good, bg: t.surface },
    { text: "controls  SliderController / CheckBoxController", fg: t.good, bg: t.surface },
    { text: "three     ThreePanelFrameView + Acerola ASCII", fg: t.good, bg: t.surface },
    { text: `theme     ${themes[themeIndex.peek()]!.label}`, fg: t.warn, bg: t.surface, bold: true },
    { text: "", bg: t.surface },
    { text: " Recent actions ", fg: t.background, bg: t.border, bold: true },
  ];
  const availableActionRows = Math.max(0, rect.height - headerLines.length);
  const actionLines = commandLog.peek()
    .slice(-Math.max(4, availableActionRows))
    .flatMap((line) => wrapPlain(`• ${line}`, rect.width))
    .slice(-availableActionRows)
    .map((line) => ({
      text: line,
      fg: t.text,
      bg: t.panelSoft,
    }));
  writeRows(frame, rect, [...headerLines, ...actionLines]);
}

function renderData(frame: Frame, rect: Rectangle): void {
  const t = theme();
  const pendingView = table.view.peek();
  const footerRows = dataFooterRows(
    pendingView.page + 1,
    pendingView.pageCount,
    pendingView.selectedKey,
    rect.width,
    t,
  );
  table.setPageSize(Math.max(1, rect.height - 2 - footerRows.length));
  const view = table.view.peek();
  const bodyRows = renderDataTableRows(view.rows, columns, view.selectedIndex).map((line, index) => ({
    text: line,
    fg: index === view.selectedIndex ? contrastText(t.warn, t.background, t.text) : t.text,
    bg: index === view.selectedIndex ? t.warn : t.surface,
    bold: index === view.selectedIndex,
  }));
  writeRows(frame, rect, [
    {
      text: renderDataTableHeader(columns, table.state.peek().sort),
      fg: contrastText(t.accentDeep, t.background, t.text),
      bg: t.accentDeep,
      bold: true,
    },
    ...bodyRows,
    { text: "", bg: t.surface },
    ...dataFooterRows(view.page + 1, view.pageCount, view.selectedKey, rect.width, t),
  ]);
  for (let index = 0; index < Math.min(view.rows.length, Math.max(0, rect.height - 1)); index += 1) {
    addHit({ column: rect.column, row: rect.row + 1 + index, width: rect.width, height: 1 }, {
      type: "dataRow",
      index,
    });
  }
}

function renderControls(frame: Frame, rect: Rectangle): void {
  const t = theme();
  let row = rect.row;
  const writeControl = (
    id: ControlId,
    value: string,
    options: {
      previous?: boolean;
      next?: boolean;
      action?: ControlHitAction;
      indent?: boolean;
      index?: number;
      button?: boolean;
    } = {},
  ) => {
    if (row >= rect.row + rect.height) return;
    const active = activeControl.peek() === id;
    const prefix = `${active && !options.indent ? ">" : " "} ${options.indent ? "  " : ""}`;
    const line = `${prefix}${value}`;
    const baseStyle = {
      fg: active ? t.background : t.text,
      bg: active ? t.warn : t.surface,
      bold: active,
    };
    if (options.button) {
      const match = /^(\[[^\]]+\])(.*)$/.exec(value);
      const buttonText = match?.[1] ?? value;
      const detailText = match?.[2] ?? "";
      write(frame, row, rect.column, paint(" ".repeat(rect.width), { fg: t.text, bg: t.surface }));
      write(frame, row, rect.column, paint(fit(prefix, rect.width), baseStyle));
      let column = rect.column + textWidth(prefix);
      const remainingForButton = Math.max(0, rect.width - textWidth(prefix));
      write(
        frame,
        row,
        column,
        paint(fit(buttonText, remainingForButton), buttonPaintOptions(t, active ? "active" : "base")),
      );
      column += Math.min(textWidth(buttonText), remainingForButton);
      const remainingForDetail = Math.max(0, rect.width - (column - rect.column));
      if (remainingForDetail > 0) {
        write(
          frame,
          row,
          column,
          paint(fit(detailText, remainingForDetail), {
            fg: active ? t.warn : t.text,
            bg: t.surface,
            bold: active,
          }),
        );
      }
    } else {
      write(
        frame,
        row,
        rect.column,
        paint(fit(line, rect.width), baseStyle),
      );
    }
    addHit({ column: rect.column, row, width: rect.width, height: 1 }, {
      type: "control",
      id,
      action: options.action ?? "activate",
      index: options.index,
    });
    if (options.previous) {
      addHit({ column: rect.column, row, width: Math.max(1, Math.floor(rect.width / 2)), height: 1 }, {
        type: "control",
        id,
        action: "previous",
      });
    }
    if (options.next) {
      addHit({
        column: rect.column + Math.floor(rect.width / 2),
        row,
        width: Math.ceil(rect.width / 2),
        height: 1,
      }, { type: "control", id, action: "next" });
    }
    row += 1;
  };
  const writeSection = (id: ControlId, label: string) => {
    writeControl(id, label, { action: "activate" });
  };
  const trackWidth = Math.max(8, Math.min(24, rect.width - 20));
  const slider = density.inspect();
  const filled = Math.round(slider.normalizedValue * trackWidth);
  const track = `${"█".repeat(filled)}${"░".repeat(Math.max(0, trackWidth - filled))}`;
  const progressTrackWidth = Math.max(8, Math.min(24, rect.width - 18));
  const progressFilled = Math.round(progress.ratio() * progressTrackWidth);
  const progressTrack = `${"█".repeat(progressFilled)}${"░".repeat(Math.max(0, progressTrackWidth - progressFilled))}`;
  writeControl(
    "button",
    `${buttonText("Run Action")} presses=${actionButton.pressCount.peek()}`,
    { button: true },
  );
  writeControl(
    "genericButton",
    `${buttonText("Generic Button")} presses=${genericButton.pressCount.peek()}`,
    { button: true },
  );
  writeControl(
    "modal",
    `${buttonText("Open Modal")} state=${modal.openState.peek() ? "open" : "closed"}`,
    { button: true },
  );
  writeControl("slider", `Slider    ${track} ${density.value.peek()}/10`, {
    previous: true,
    next: true,
  });
  addHit({ column: rect.column + 12, row: row - 1, width: trackWidth, height: 1 }, {
    type: "control",
    id: "slider",
    action: "set",
  });
  writeControl("checkbox", "Checkboxes");
  writeControl("checkbox", `${renderCheckBoxMark(livePreview.checked.peek())} live preview`, {
    indent: true,
    index: 0,
  });
  writeControl("checkbox", `${renderCheckBoxMark(compactRows.checked.peek())} compact rows`, {
    indent: true,
    index: 1,
  });
  writeControl("radio", "Radio", {
    previous: true,
    next: true,
  });
  for (const [index, option] of modeRadio.options.peek().entries()) {
    const mark = option.value === modeRadio.selectedValue.peek() ? "●" : "○";
    const cursor = index === modeRadio.activeIndex.peek() ? ">" : " ";
    writeControl("radio", `${cursor} ${mark} ${option.label}`, {
      indent: true,
      index,
    });
  }
  const themeHeader = `Theme  ${themeCombo.expanded.peek() ? "▾" : "▸"} ${themeCombo.label()}`;
  if (textWidth(`> ${themeHeader}`) > rect.width && rect.width > 16) {
    writeSection("combo", `Theme  ${themeCombo.expanded.peek() ? "▾" : "▸"}`);
    writeControl("combo", themeCombo.label(), { indent: true });
  } else {
    writeSection("combo", themeHeader);
  }
  writeWrappedOptions(frame, rect, row, "combo", themeCombo.items.peek(), themeCombo.selectedIndex.peek(), t);
  row += wrappedOptionRowCount(themeCombo.items.peek(), rect.width - 4);
  writeControl("dropdown", `Dropdown  ${dropdown.expanded.peek() ? "▾" : "▸"} ${dropdown.label()}`, {
    action: "toggle",
  });
  if (dropdown.expanded.peek()) {
    const items = [...dropdown.items.peek()];
    const contentWidth = Math.max(...items.map((item) => textWidth(item)), textWidth(dropdown.label()), 12);
    dropdownOverlay = {
      kind: "control",
      coordinate: "workspace",
      rect: {
        column: rect.column + 2,
        row,
        width: Math.min(Math.max(16, contentWidth + 6), Math.max(16, rect.width - 4)),
        height: items.length + 2,
      },
      items,
      selectedIndex: dropdown.selectedIndex.peek(),
    };
  }
  writeControl("input", `Input     ${commandInput.text.peek()}${activeControl.peek() === "input" ? "▌" : ""}`, {
    action: "focus",
  });
  const stepperRow = row;
  writeControl(
    "stepper",
    `Stepper   ${
      renderStepper(
        workflowStepper.steps.peek(),
        workflowStepper.activeIndex.peek(),
        "horizontal",
        Math.max(8, rect.width - 12),
      )[0] ?? ""
    }`,
    {
      previous: true,
      next: true,
    },
  );
  addInlineStepperHits(rect, stepperRow);
  row = renderTextboxControl(frame, rect, row, t);
  if (row < rect.row + rect.height) {
    write(
      frame,
      row,
      rect.column,
      paint(fit(`Progress  ${progressTrack} ${progress.value.peek()}%`, rect.width), {
        fg: t.text,
        bg: t.surface,
      }),
    );
  }
}

function renderTextboxControl(frame: Frame, rect: Rectangle, row: number, t: ThemeSpec): number {
  if (row >= rect.row + rect.height) return row;
  const active = activeControl.peek() === "textbox";
  const height = Math.min(5, Math.max(2, rect.row + rect.height - row));
  const labelWidth = Math.min(10, Math.max(0, rect.width - 12));
  const textColumn = rect.column + labelWidth;
  const textWidth = Math.max(1, rect.width - labelWidth);
  const visualLines = wrapTextBoxLines(notes.lines.peek(), textWidth - 2, { wordWrap: true });
  const cursor = notes.cursorPosition.peek();
  const cursorRow = visualLines.findIndex((line) =>
    line.lineIndex === cursor.y && cursor.x >= line.startColumn && cursor.x <= line.endColumn
  );
  const start = Math.max(0, Math.min(Math.max(0, cursorRow - height + 1), Math.max(0, visualLines.length - height)));
  const header = `${active ? ">" : " "} TextBox`;
  for (let offset = 0; offset < height; offset += 1) {
    const line = visualLines[start + offset] ?? {
      text: "",
      lineIndex: 0,
      startColumn: 0,
      endColumn: 0,
      continuation: false,
    };
    const cursorOnLine = active && line.lineIndex === cursor.y && cursor.x >= line.startColumn &&
      cursor.x <= line.endColumn;
    const marker = cursorOnLine ? "▌" : " ";
    write(
      frame,
      row + offset,
      rect.column,
      paint(fit(offset === 0 ? header : " ".repeat(Math.max(0, labelWidth)), labelWidth), {
        fg: active && offset === 0 ? t.background : t.text,
        bg: active && offset === 0 ? t.warn : t.surface,
        bold: active && offset === 0,
      }),
    );
    write(
      frame,
      row + offset,
      textColumn,
      paint(fit(`${line.continuation ? "↳" : " "}${line.text}${marker}`, textWidth), {
        fg: active ? t.background : t.text,
        bg: active ? t.warn : t.surface,
        bold: active,
      }),
    );
  }
  addHit({ column: rect.column, row, width: rect.width, height }, {
    type: "control",
    id: "textbox",
    action: "focus",
  });
  return row + height;
}

function renderLogs(frame: Frame, rect: Rectangle): void {
  const t = theme();
  writeRows(
    frame,
    rect,
    docs.map((line) => ({
      text: line,
      fg: t.text,
      bg: t.surface,
    })),
  );
}

function renderTerminalOutput(frame: Frame, rect: Rectangle): void {
  const t = theme();
  fillRect(frame, rect, t.surface);
  const inspection = terminalOutputSession.inspect();
  let row = rect.row;
  row = renderTerminalOutputToolbar(frame, rect, row);
  if (row >= rect.row + rect.height) return;

  const statusTone = inspection.status === "running"
    ? t.good
    : inspection.status === "failed"
    ? t.danger
    : inspection.status === "cancelled"
    ? t.warn
    : t.accent;
  const statusSummary = summarizeTerminalStatus(inspection, {
    title: terminalInputModeLabel(),
    backendId: "process",
    width: rect.width,
  });
  write(
    frame,
    row,
    rect.column,
    paint(fit(statusSummary.text, rect.width), {
      fg: contrastText(statusTone, t.background, t.text),
      bg: statusTone,
      bold: true,
    }),
  );
  row += 1;

  const hint = terminalInputMode.peek() === "raw"
    ? "raw input: printable keys go to child process  Esc workbench mode  Ctrl+C reserved"
    : "keys: P run  S stop  U restart  K clear  V follow  Y copy  I raw input";
  write(frame, row, rect.column, paint(fit(hint, rect.width), { fg: t.soft, bg: t.panelSoft }));
  row += 1;

  const outputHeight = Math.max(0, rect.row + rect.height - row);
  const lines = terminalOutputSession.output.visible(outputHeight);
  if (lines.length === 0) {
    write(
      frame,
      row,
      rect.column,
      paint(fit("No output yet. Press [Run] to start the demo command.", rect.width), {
        fg: t.muted,
        bg: t.surface,
      }),
    );
    return;
  }

  for (let index = 0; index < Math.min(outputHeight, lines.length); index += 1) {
    const line = lines[index]!;
    const style = terminalOutputLineStyle(line.source, t);
    write(
      frame,
      row + index,
      rect.column,
      paint(fit(formatTerminalOutputLine(line, { sourcePrefix: true }), rect.width), style),
    );
  }
}

function renderTerminalOutputToolbar(frame: Frame, rect: Rectangle, startRow: number): number {
  const bottom = rect.row + rect.height;
  let row = startRow;
  let column = rect.column;
  const gap = 1;
  const addButton = (
    label: string,
    action: TerminalOutputAction,
    options: { disabled?: boolean; tone?: ButtonTone; active?: boolean } = {},
  ) => {
    const width = textWidth(buttonText(label));
    if (column > rect.column && column + width > rect.column + rect.width) {
      row += 1;
      column = rect.column;
    }
    if (row >= bottom) return;
    const state = options.disabled ? "disabled" : options.active ? "active" : "base";
    const written = writeButton(frame, row, column, label, { state, tone: options.tone });
    if (!options.disabled) {
      addHit({ column, row, width: written, height: 1 }, { type: "terminalOutput", action });
    }
    column += written + gap;
  };

  addButton("Run", "run", { disabled: terminalOutputSession.running, tone: "success" });
  addButton("Stop", "stop", { disabled: !terminalOutputSession.running, tone: "danger" });
  addButton("Restart", "restart", { tone: "warning" });
  addButton("Clear", "clear", { disabled: terminalOutputSession.output.lines.peek().length === 0, tone: "muted" });
  addButton("Follow", "follow", { active: terminalOutputSession.output.follow.peek() });
  addButton("Raw", "raw", { active: terminalInputMode.peek() === "raw", disabled: !terminalOutputSession.running });
  addButton("Copy Cmd", "copy", { tone: "muted" });
  return Math.min(bottom, row + 1);
}

function terminalOutputLineStyle(
  source: "stdout" | "stderr" | "system",
  t: ThemeSpec,
): { fg: string; bg: string; bold?: boolean } {
  if (source === "stderr") return { fg: t.danger, bg: t.surface, bold: true };
  if (source === "system") return { fg: t.warn, bg: t.panelSoft, bold: true };
  return { fg: t.text, bg: t.surface };
}

function terminalInputModeLabel(): string {
  return terminalInputMode.peek() === "raw" ? "RAW INPUT" : "WORKBENCH";
}

function toggleTerminalInputMode(): void {
  if (terminalInputMode.peek() === "raw") {
    terminalInputMode.value = "workbench";
    pushLog("terminal input workbench mode");
    return;
  }
  if (!terminalOutputSession.running) {
    pushLog("terminal raw input requires running process");
    return;
  }
  terminalInputMode.value = "raw";
  pushLog("terminal input raw mode");
}

function renderTerminalShell(frame: Frame, rect: Rectangle): void {
  const t = theme();
  fillRect(frame, rect, t.surface);
  let row = rect.row;
  row = renderTerminalShellToolbar(frame, rect, row);
  if (row >= rect.row + rect.height) return;

  const screenHeight = Math.max(1, rect.row + rect.height - row - 2);
  terminalShell.resize(rect.width, screenHeight);
  const inspection = terminalShell.inspect();
  const copyMode = inspection.scrollback.mode === "copy";
  const statusTone = inspection.status === "running"
    ? t.good
    : inspection.status === "failed"
    ? t.danger
    : inspection.status === "cancelled"
    ? t.warn
    : inspection.status === "starting"
    ? t.accent
    : t.borderStrong;
  const backend = inspection.backendLabel ?? "pending";
  const mode = copyMode ? "COPY MODE" : terminalShellInputModeLabel();
  const status = compactSpaces(
    `${mode} ${inspection.status.toUpperCase()} ${
      terminalBackendKindLabel(inspection.pty)
    } ${backend} · ${inspection.commandLine} · rows ${inspection.scrollback.offset + 1}-${
      Math.min(inspection.scrollback.offset + inspection.scrollback.viewportRows, inspection.scrollback.totalRows)
    }/${inspection.scrollback.totalRows}`,
  );
  write(
    frame,
    row,
    rect.column,
    paint(fit(status, rect.width), {
      fg: contrastText(statusTone, t.background, t.text),
      bg: statusTone,
      bold: true,
    }),
  );
  row += 1;

  const hint = copyMode
    ? "copy mode: PageUp/PageDown scroll  Home/End jump  C copy selection  Esc live input"
    : terminalShellInputMode.peek() === "raw"
    ? "raw shell input: keys go to shell  Ctrl+C interrupts shell  Esc returns to Workbench"
    : "keys: P start  S stop  U restart  K clear  I raw input  PageUp copy scroll";
  write(frame, row, rect.column, paint(fit(hint, rect.width), { fg: t.soft, bg: t.panelSoft }));
  row += 1;

  if (inspection.error) {
    write(
      frame,
      row,
      rect.column,
      paint(fit(`shell error: ${inspection.error}`, rect.width), {
        fg: t.danger,
        bg: t.surface,
        bold: true,
      }),
    );
    return;
  }
  if (inspection.status === "idle") {
    write(
      frame,
      row,
      rect.column,
      paint(fit("Press [Start] or P to open your login shell in a PTY.", rect.width), {
        fg: t.muted,
        bg: t.surface,
      }),
    );
    return;
  }

  if (copyMode) {
    const rows = inspection.scrollback.visibleRows;
    for (let screenRow = 0; screenRow < screenHeight; screenRow += 1) {
      const text = rows[screenRow] ?? "";
      const lineNumber = inspection.scrollback.offset + screenRow + 1;
      const prefix = `${lineNumber.toString().padStart(4, " ")} `;
      write(
        frame,
        row + screenRow,
        rect.column,
        paint(fit(prefix, Math.min(5, rect.width)), {
          fg: t.soft,
          bg: t.panelSoft,
        }),
      );
      if (rect.width > 5) {
        write(
          frame,
          row + screenRow,
          rect.column + 5,
          paint(fit(text, rect.width - 5), {
            fg: t.text,
            bg: t.surface,
          }),
        );
      }
    }
    return;
  }

  const cursor = terminalShell.screen.cursor;
  const cursorActive = activeWindow.peek() === TERMINAL_SHELL_WINDOW_ID && terminalShellInputMode.peek() === "raw" &&
    terminalShell.running;
  const rows = terminalShell.screen.cellRows();
  for (let screenRow = 0; screenRow < screenHeight; screenRow += 1) {
    const cells = rows[screenRow] ?? [];
    for (let column = 0; column < rect.width; column += 1) {
      const cell = cells[column] ?? { char: " " };
      const atCursor = cursorActive && cursor.row === screenRow && cursor.column === column;
      const style = terminalCellStyle(cell, t, atCursor);
      const char = atCursor && cell.char === " " ? " " : cell.char;
      write(frame, row + screenRow, rect.column + column, paint(char, style));
    }
  }
}

function renderTerminalShellToolbar(frame: Frame, rect: Rectangle, startRow: number): number {
  const bottom = rect.row + rect.height;
  let row = startRow;
  let column = rect.column;
  const shellInspection = terminalShell.inspect();
  const addButton = (
    label: string,
    action: TerminalShellAction,
    options: { disabled?: boolean; tone?: ButtonTone; active?: boolean } = {},
  ) => {
    const width = textWidth(buttonText(label));
    if (column > rect.column && column + width > rect.column + rect.width) {
      row += 1;
      column = rect.column;
    }
    if (row >= bottom) return;
    const state = options.disabled ? "disabled" : options.active ? "active" : "base";
    const written = writeButton(frame, row, column, label, { state, tone: options.tone });
    if (!options.disabled) {
      addHit({ column, row, width: written, height: 1 }, { type: "terminalShell", action });
    }
    column += written + 1;
  };

  addButton("Start", "start", { disabled: terminalShell.running || terminalShell.status.peek() === "starting" });
  addButton("Stop", "stop", { disabled: !terminalShell.running, tone: "danger" });
  addButton("Restart", "restart", { tone: "warning" });
  addButton("Clear", "clear", { tone: "muted" });
  addButton("Raw", "raw", { active: terminalShellInputMode.peek() === "raw", disabled: !terminalShell.running });
  addButton("Copy", "copy", { active: terminalShell.scrollback.mode === "copy" });
  addButton("Top", "top", {
    disabled: shellInspection.scrollback.totalRows <= shellInspection.scrollback.viewportRows,
  });
  addButton("Bottom", "bottom", {
    disabled: shellInspection.scrollback.totalRows <= shellInspection.scrollback.viewportRows,
  });
  return Math.min(bottom, row + 1);
}

function terminalCellStyle(
  cell: { foreground?: number; background?: number; bold?: boolean },
  t: ThemeSpec,
  cursor: boolean,
): { fg: string; bg: string; bold?: boolean } {
  if (cursor) return { fg: t.background, bg: t.accent, bold: true };
  return {
    fg: terminalAnsiColor(cell.foreground, t, false) ?? t.text,
    bg: terminalAnsiColor(cell.background, t, true) ?? t.surface,
    bold: cell.bold,
  };
}

function terminalAnsiColor(code: number | undefined, t: ThemeSpec, background: boolean): string | undefined {
  if (code === undefined) return undefined;
  const normalized = background ? code - 40 : code - 30;
  switch (normalized) {
    case 0:
      return t.background;
    case 1:
      return t.danger;
    case 2:
      return t.good;
    case 3:
      return t.warn;
    case 4:
      return t.accent;
    case 5:
      return t.borderStrong;
    case 6:
      return t.accent;
    case 7:
      return t.text;
    default:
      return undefined;
  }
}

function terminalShellInputModeLabel(): string {
  return terminalShellInputMode.peek() === "raw" ? "RAW SHELL" : "WORKBENCH";
}

function toggleTerminalShellInputMode(): void {
  if (terminalShellInputMode.peek() === "raw") {
    terminalShellInputMode.value = "workbench";
    pushLog("shell input workbench mode");
    return;
  }
  if (!terminalShell.running) {
    pushLog("shell raw input requires a running shell");
    return;
  }
  terminalShellInputMode.value = "raw";
  pushLog("shell input raw mode");
}

function renderHtmlCssLayout(frame: Frame, rect: Rectangle): void {
  const t = theme();
  const result = createHtmlCssLayoutDemo(rect);
  const boxes = result.layout.boxes
    .filter((box) => box.visible)
    .sort((left, right) => left.zIndex - right.zIndex || boxPaintOrder(left) - boxPaintOrder(right));

  for (const box of boxes) {
    renderHtmlCssLayoutBox(frame, box, rect, t);
  }

  const summaryRows = [
    "parseTuiMarkup -> parseCssStylesheet -> applyCssCascade -> LayoutEngine",
    "Default solver supports flex-wrap, CSS Grid tracks, fr units, and absolute inset.",
    "Resize this window: metric cards wrap; nested grid retessellates with media rules.",
  ];
  const summaryStart = Math.max(rect.row, rect.row + rect.height - summaryRows.length);
  for (let index = 0; index < summaryRows.length && summaryStart + index < rect.row + rect.height; index += 1) {
    write(
      frame,
      summaryStart + index,
      rect.column,
      paint(fit(summaryRows[index]!, rect.width), {
        fg: index === 0 ? t.accent : t.soft,
        bg: t.panelSoft,
        bold: index === 0,
      }),
    );
  }
}

function renderHtmlCssLayoutBox(
  frame: Frame,
  box: ComputedLayoutBox,
  bounds: Rectangle,
  t: ThemeSpec,
): void {
  const rect = clipRect(box.rect, bounds);
  if (rect.width <= 0 || rect.height <= 0) return;
  const style = htmlCssLayoutBoxStyle(box, t);
  fillRect(frame, rect, style.bg);
  if (box.id !== "layout-demo") {
    drawHtmlCssLayoutOutline(frame, rect, style.border, style.bg, style.bold);
  }

  const content = clipRect(box.contentRect, bounds);
  if (content.width <= 0 || content.height <= 0) return;
  const label = htmlCssLayoutDemoBoxLabel(box);
  write(
    frame,
    content.row,
    content.column,
    paint(fit(label, content.width), {
      fg: style.fg,
      bg: style.bg,
      bold: style.bold,
    }),
  );
  if (content.height > 1 && box.text) {
    write(
      frame,
      content.row + 1,
      content.column,
      paint(fit(box.text, content.width), { fg: t.text, bg: style.bg }),
    );
  }
  if (content.height > 2 && (box.id.startsWith("metric-") || box.id.startsWith("grid-"))) {
    const detail = `${box.rect.width}x${box.rect.height}  content ${box.contentRect.width}x${box.contentRect.height}`;
    write(frame, content.row + 2, content.column, paint(fit(detail, content.width), { fg: t.muted, bg: style.bg }));
  }
}

function htmlCssLayoutBoxStyle(
  box: ComputedLayoutBox,
  t: ThemeSpec,
): { fg: string; bg: string; border: string; bold?: boolean } {
  if (box.id === "layout-toolbar") {
    return { fg: contrastText(t.accentDeep, t.background, t.text), bg: t.accentDeep, border: t.accent, bold: true };
  }
  if (box.id === "layout-stage") {
    return { fg: t.text, bg: t.panelSoft, border: t.borderStrong, bold: true };
  }
  if (box.id === "layout-grid") {
    return { fg: t.text, bg: t.surface, border: t.accent, bold: true };
  }
  if (box.id === "grid-shell") {
    return { fg: t.buttonActiveText, bg: t.buttonActiveBg, border: t.accent, bold: true };
  }
  if (box.id === "grid-worker") {
    return { fg: contrastText(t.warn, t.background, t.text), bg: t.warn, border: t.danger, bold: true };
  }
  if (box.id.startsWith("grid-")) {
    return { fg: t.text, bg: t.panel, border: t.accent };
  }
  if (box.id === "layout-badge") {
    return { fg: contrastText(t.warn, t.background, t.text), bg: t.warn, border: t.danger, bold: true };
  }
  if (box.id === "layout-footer") {
    return { fg: t.muted, bg: t.panel, border: t.border };
  }
  if (box.id === "metric-cpu") {
    return { fg: t.buttonActiveText, bg: t.buttonActiveBg, border: t.accent, bold: true };
  }
  if (box.id.startsWith("metric-")) {
    return { fg: t.text, bg: t.panel, border: t.accent };
  }
  return { fg: t.text, bg: t.surface, border: t.border };
}

function boxPaintOrder(box: ComputedLayoutBox): number {
  if (box.id === "layout-demo") return 0;
  if (box.id === "layout-stage") return 1;
  if (box.id === "layout-grid") return 2;
  if (box.id.startsWith("grid-")) return 3;
  if (box.id.startsWith("metric-")) return 2;
  if (box.id === "layout-badge") return 4;
  return 2;
}

function drawHtmlCssLayoutOutline(
  frame: Frame,
  rect: Rectangle,
  fg: string,
  bg: string,
  bold = false,
): void {
  if (rect.width < 2 || rect.height < 2) return;
  const style = { fg, bg, bold };
  write(frame, rect.row, rect.column, paint(`┌${"─".repeat(Math.max(0, rect.width - 2))}┐`, style));
  for (let row = rect.row + 1; row < rect.row + rect.height - 1; row += 1) {
    write(frame, row, rect.column, paint("│", style));
    write(frame, row, rect.column + rect.width - 1, paint("│", style));
  }
  write(
    frame,
    rect.row + rect.height - 1,
    rect.column,
    paint(`└${"─".repeat(Math.max(0, rect.width - 2))}┘`, style),
  );
}

function writeWrappedOptions(
  frame: Frame,
  rect: Rectangle,
  startRow: number,
  id: ControlId,
  items: readonly string[],
  selectedIndex: number | undefined,
  t: ThemeSpec,
): void {
  const width = Math.max(8, rect.width - 4);
  let row = startRow;
  let line = "";
  let lineStartColumn = rect.column + 2;
  const flush = () => {
    if (row >= rect.row + rect.height || line.length === 0) return;
    const active = activeControl.peek() === id;
    write(
      frame,
      row,
      lineStartColumn,
      paint(fit(line, width), {
        fg: active ? t.background : t.text,
        bg: active ? t.warn : t.surface,
        bold: active,
      }),
    );
    line = "";
    row += 1;
    lineStartColumn = rect.column + 2;
  };
  for (const [index, item] of items.entries()) {
    const token = `${index === selectedIndex ? "[" : " "}${item}${index === selectedIndex ? "]" : " "} `;
    if (textWidth(line) + textWidth(token) > width) flush();
    addHit({ column: lineStartColumn + textWidth(line), row, width: textWidth(token), height: 1 }, {
      type: "control",
      id,
      action: "activate",
      index,
    });
    line += token;
  }
  flush();
}

function wrappedOptionRowCount(items: readonly string[], width: number): number {
  const safeWidth = Math.max(8, width);
  let rows = 1;
  let lineWidth = 0;
  for (const item of items) {
    const tokenWidth = textWidth(` ${item}  `);
    if (lineWidth > 0 && lineWidth + tokenWidth > safeWidth) {
      rows += 1;
      lineWidth = 0;
    }
    lineWidth += tokenWidth;
  }
  return rows;
}

function addInlineStepperHits(rect: Rectangle, row: number): void {
  const steps = workflowStepper.steps.peek();
  let column = rect.column + 12;
  for (const [index, step] of steps.entries()) {
    const label = step.disabled ? `(${step.label})` : step.completed ? `✓ ${step.label}` : step.label;
    const token = index === workflowStepper.activeIndex.peek() ? `[${label}]` : label;
    const width = textWidth(token);
    if (column + width > rect.column + rect.width) break;
    addHit({ column, row, width, height: 1 }, {
      type: "control",
      id: "stepper",
      action: "activate",
      index,
    });
    column += width + 3;
  }
}

function renderShelf(frame: Frame): void {
  const row = currentHeight() - 2;
  const entries = windowManager.inspect().windows
    .filter((entry) => entry.minimized && !entry.closed)
    .map((entry) => ({ id: entry.id as WindowId, title: windowTitle(entry.id as WindowId) }));
  if (entries.length === 0) return;
  const layout = layoutWorkbenchShelf({ row, column: 1, width: Math.max(0, currentWidth() - 1), entries });
  write(frame, row, layout.prefixRect.column, paint(layout.prefix, { fg: theme().muted, bg: theme().backgroundSoft }));
  for (const button of layout.buttons) {
    writeButton(frame, row, button.rect.column, button.label, { tone: "muted", maxWidth: button.rect.width });
    addHit(button.rect, { type: "restore", id: button.id });
  }
}

function renderWindowTabs(frame: Frame): void {
  const row = currentHeight() - 2;
  const t = theme();
  fillRow(frame, row, t.backgroundSoft);
  const layout = layoutWorkbenchTabs({
    row,
    column: 1,
    width: Math.max(0, currentWidth() - 1),
    tabs: windowManager.inspect().tabs.map((tab) => ({
      id: tab.id as WindowId,
      title: windowTitle(tab.id as WindowId),
      selected: tab.fullscreen,
      hidden: tab.minimized,
    })),
  });
  write(frame, row, layout.prefixRect.column, paint(layout.prefix, { fg: t.muted, bg: t.backgroundSoft }));
  for (const button of layout.buttons) {
    writeButton(frame, row, button.rect.column, button.label, {
      state: button.selected ? "active" : "base",
      tone: button.hidden ? "muted" : "default",
      maxWidth: button.rect.width,
    });
    addHit(button.rect, { type: "windowTab", id: button.id });
  }
}

function renderStatus(frame: Frame): void {
  const t = theme();
  const width = currentWidth();
  const densityLabel = tileDensity.peek() === 0 ? "balanced" : tileDensity.peek() > 0 ? "dense" : "wide";
  const left = `focus ${windowTitle(activeWindow.peek())} | ${theme().label} | tiles ${densityLabel}`;
  const right = "F10 menu  N new  Shift+T themes  G config  0 restore minimized";
  write(frame, currentHeight() - 1, 0, paint(renderStatusBar(left, right, width), { fg: t.text, bg: t.panelSoft }));
}

function renderActiveDropdownOverlay(frame: Frame): void {
  const bounds = { column: 0, row: 3, width: currentWidth(), height: Math.max(0, currentHeight() - 5) };
  renderDropdownOverlay(frame, bounds, workspaceScroll.offset.peek().rows);
}

function emptyWorkspaceMessage(): string {
  const inspection = windowManager.inspect();
  const minimizedCount = inspection.windows.filter((entry) => entry.minimized).length;
  const openCount = inspection.windows.filter((entry) => !entry.closed).length;
  if (openCount === 0) return "All windows closed. Use New to add a widget window.";
  if (minimizedCount > 0) return "All open windows minimized. Press R or use the shelf to restore.";
  return "No visible windows. Use New to add a widget window.";
}

function renderModalOverlay(frame: Frame): void {
  if (threeConfigOpen.peek()) {
    renderThreeConfigModal(frame);
    return;
  }
  if (!modal.openState.peek()) return;

  const t = theme();
  const screen = { column: 0, row: 0, width: currentWidth(), height: currentHeight() };
  addHit(screen, { type: "modalAction", index: -1 });

  const inspection = modal.inspect();
  const probeWidth = Math.min(Math.max(38, currentWidth() - 8), 72);
  const { rect, inner, shadow } = layoutWorkbenchModal({
    bounds: screen,
    contentHeight: modalContentHeight(inspection, probeWidth),
    maxWidth: 72,
  });
  if (shadow.width > 0 && shadow.height > 0) fillRect(frame, shadow, t.background);

  fillRect(frame, rect, t.panelSoft);
  drawFrame(frame, rect, inspection.title, true);

  const rows = renderModalRows(inspection, { width: rect.width, height: inner.height });
  for (let index = 0; index < rows.length && index < inner.height; index += 1) {
    const actionRow = inspection.actions.length > 0 && index === rows.length - 1;
    const titleRow = index === 0;
    write(
      frame,
      inner.row + index,
      inner.column,
      paint(fit(actionRow ? "" : rows[index]!, inner.width), {
        fg: titleRow ? t.accent : t.text,
        bg: actionRow ? t.panel : t.panelSoft,
        bold: actionRow || titleRow,
      }),
    );
  }

  if (inspection.actions.length === 0 || rows.length === 0) return;
  const actionRow = inner.row + Math.min(rows.length, inner.height) - 1;
  let cursor = inner.column;
  for (const [index, action] of inspection.actions.entries()) {
    const width = textWidth(buttonText(action.label));
    if (cursor + width > inner.column + inner.width) break;
    writeButton(frame, actionRow, cursor, action.label, {
      state: action.disabled ? "disabled" : index === inspection.selectedActionIndex ? "active" : "base",
      tone: action.destructive ? "danger" : "default",
    });
    addHit({ column: cursor, row: actionRow, width, height: 1 }, { type: "modalAction", index });
    cursor += width + 1;
  }
}

type ThreeConfigRow =
  | { kind: "preset"; label: string }
  | { kind: "glyphStyle"; label: string }
  | { kind: "kitty"; key: AsciiKittyKey; label: string }
  | { kind: "toggle"; key: AsciiToggleKey; label: string }
  | { kind: "numeric"; key: AsciiNumericKey; label: string };

const threeConfigRows: readonly ThreeConfigRow[] = [
  { kind: "preset", label: "Preset" },
  { kind: "glyphStyle", label: "Glyph style" },
  { kind: "kitty", key: "kittyGraphics", label: "Kitty graphics" },
  { kind: "kitty", key: "kittyDisableAscii", label: "Disable ASCII under Kitty" },
  { kind: "numeric", key: "terminalEdgeBias", label: "Edge glyph bias" },
  { kind: "numeric", key: "wireframeThickness", label: "Wire thickness" },
  { kind: "toggle", key: "edges", label: "Edge pass" },
  { kind: "toggle", key: "fill", label: "Fill pass" },
  { kind: "toggle", key: "invertLuminance", label: "Invert luminance" },
  { kind: "numeric", key: "edgeThreshold", label: "Edge threshold" },
  { kind: "numeric", key: "normalThreshold", label: "Normal edge" },
  { kind: "numeric", key: "depthThreshold", label: "Depth edge" },
  { kind: "numeric", key: "exposure", label: "Exposure" },
  { kind: "numeric", key: "attenuation", label: "Attenuation" },
  { kind: "numeric", key: "blendWithBase", label: "Base blend" },
  { kind: "numeric", key: "depthFalloff", label: "Fog falloff" },
  { kind: "numeric", key: "depthOffset", label: "Fog offset" },
];

function renderThreeConfigModal(frame: Frame): void {
  const t = theme();
  const screen = { column: 0, row: 0, width: currentWidth(), height: currentHeight() };
  addHit(screen, { type: "asciiConfigBackdrop" });
  const width = Math.min(Math.max(54, currentWidth() - 8), 82);
  const height = Math.min(Math.max(16, threeConfigRows.length + 7), Math.max(10, currentHeight() - 4));
  const rect = {
    column: Math.max(0, Math.floor((currentWidth() - width) / 2)),
    row: Math.max(1, Math.floor((currentHeight() - height) / 2)),
    width,
    height,
  };
  const shadow = clipRect(
    { column: rect.column + 2, row: rect.row + 1, width: rect.width, height: rect.height },
    screen,
  );
  if (shadow.width > 0 && shadow.height > 0) fillRect(frame, shadow, t.background);
  fillRect(frame, rect, t.panelSoft);
  drawFrame(frame, rect, "Three Renderer Config", true);

  const inner = inset(rect, 1);
  const current = configuredAscii().peek();
  const title = `ASCII ${windowTitle(configuredAsciiWindow())} · ${
    terminalGlyphStyleLabel(current.terminalGlyphStyle)
  } · ${asciiPresetLabelLocal(current.preset)}`;
  write(frame, inner.row, inner.column, paint(fit(title, inner.width), { fg: t.accent, bg: t.panelSoft, bold: true }));
  const rowsTop = inner.row + 2;
  const actionRow = inner.row + inner.height - 2;
  const footerRow = inner.row + inner.height - 1;
  const visibleRows = Math.max(0, actionRow - rowsTop);
  for (let visibleIndex = 0; visibleIndex < Math.min(visibleRows, threeConfigRows.length); visibleIndex += 1) {
    const rowIndex = visibleIndex;
    const row = threeConfigRows[rowIndex]!;
    const y = rowsTop + visibleIndex;
    const selected = threeConfigSelected.peek() === rowIndex;
    const bg = selected ? t.warn : t.surface;
    const fg = selected ? t.background : t.text;
    write(frame, y, inner.column, paint(" ".repeat(inner.width), { bg }));
    write(frame, y, inner.column, paint(fit(threeConfigRowText(row), inner.width), { fg, bg, bold: selected }));
    const leftWidth = Math.max(6, Math.floor(inner.width / 2));
    addHit({ column: inner.column, row: y, width: leftWidth, height: 1 }, {
      type: "asciiConfig",
      index: rowIndex,
      action: "previous",
    });
    addHit({ column: inner.column + leftWidth, row: y, width: inner.width - leftWidth, height: 1 }, {
      type: "asciiConfig",
      index: rowIndex,
      action: "next",
    });
  }
  let actionColumn = inner.column;
  for (
    const action of [
      { id: "cancel" as const, label: "Cancel", tone: "muted" as const },
      { id: "apply" as const, label: "Apply", tone: "default" as const },
      { id: "ok" as const, label: "OK", tone: "success" as const },
    ]
  ) {
    const width = textWidth(buttonText(action.label));
    if (actionColumn + width > inner.column + inner.width) break;
    writeButton(frame, actionRow, actionColumn, action.label, { tone: action.tone });
    addHit({ column: actionColumn, row: actionRow, width, height: 1 }, {
      type: "asciiConfigAction",
      action: action.id,
    });
    actionColumn += width + 1;
  }
  const footer = "Up/Down select  Left/Right change  Enter toggle  A apply  O OK  Esc cancel";
  write(
    frame,
    footerRow,
    inner.column,
    paint(fit(footer, inner.width), {
      fg: t.muted,
      bg: t.panel,
    }),
  );
}

function threeConfigRowText(row: ThreeConfigRow): string {
  const current = configuredAscii().peek();
  if (row.kind === "preset") {
    return `${row.label.padEnd(18)} [<] ${asciiPresetLabelLocal(current.preset)} [>]`;
  }
  if (row.kind === "glyphStyle") {
    const labels = TERMINAL_GLYPH_STYLES.map((style) =>
      style === current.terminalGlyphStyle
        ? `[${terminalGlyphStyleLabel(style)}]`
        : ` ${terminalGlyphStyleLabel(style)} `
    ).join(" ");
    return `${row.label.padEnd(18)} ${labels}`;
  }
  if (row.kind === "toggle") {
    return `${row.label.padEnd(18)} ${current[row.key] ? "[x]" : "[ ]"}`;
  }
  if (row.kind === "kitty") {
    const status = row.key === "kittyGraphics" ? kittyGraphicsStatus() : "applies only when Kitty is active";
    return `${row.label.padEnd(26)} ${current[row.key] ? "[x]" : "[ ]"} ${status}`;
  }
  const value = Number(current[row.key]);
  const values = asciiControlValues(row.key);
  const ratio = numericOptionRatio(values, value);
  const trackWidth = 14;
  const filled = Math.round(ratio * trackWidth);
  const track = `${"█".repeat(filled)}${"░".repeat(Math.max(0, trackWidth - filled))}`;
  return `${row.label.padEnd(18)} [<] ${track} ${formatAsciiControlValue(row.key, value).padStart(5)} [>]`;
}

function applyThreeConfigRow(index: number, action: ConfigHitAction = "activate"): void {
  if (index < 0) {
    applyThreeConfigModalAction("cancel");
    return;
  }
  const row = threeConfigRows[index];
  if (!row) return;
  threeConfigSelected.value = index;
  if (row.kind === "preset") {
    stepAsciiPreset(action === "previous" ? -1 : 1);
  } else if (row.kind === "glyphStyle") {
    stepAsciiGlyphStyle(action === "previous" ? -1 : 1);
  } else if (row.kind === "kitty") {
    toggleAsciiKittyOption(row.key);
  } else if (row.kind === "toggle") {
    toggleAsciiOption(row.key);
  } else {
    stepAsciiNumeric(row.key, action === "previous" ? -1 : 1);
  }
}

function stepAsciiPreset(delta: number): void {
  const ids = ASCII_DEMO_PRESETS.map((preset) => preset.id);
  const current = configuredAscii().peek();
  const currentIndex = Math.max(0, ids.indexOf(current.preset));
  const nextId = ids[(currentIndex + delta + ids.length) % ids.length]!;
  const next = { ...current };
  applyAsciiPreset(next, nextId);
  setConfiguredAscii(next, `three config preset ${asciiPresetLabelLocal(nextId)}`, { persist: false });
}

function stepAsciiGlyphStyle(delta: number): void {
  const current = configuredAscii().peek();
  const index = TERMINAL_GLYPH_STYLES.indexOf(current.terminalGlyphStyle);
  const next = TERMINAL_GLYPH_STYLES[(index + delta + TERMINAL_GLYPH_STYLES.length) % TERMINAL_GLYPH_STYLES.length]!;
  setConfiguredAscii(
    { ...current, terminalGlyphStyle: next, preset: "custom" },
    `three config glyph style ${terminalGlyphStyleLabel(next)}`,
    { persist: false },
  );
}

function toggleAsciiOption(key: AsciiToggleKey): void {
  const current = configuredAscii().peek();
  setConfiguredAscii(
    { ...current, [key]: !current[key], preset: "custom" },
    `three config ${key} ${!current[key] ? "on" : "off"}`,
    { persist: false },
  );
}

function toggleAsciiKittyOption(key: AsciiKittyKey): void {
  const current = configuredAscii().peek();
  const next = !current[key];
  setConfiguredAscii(
    { ...current, [key]: next, preset: "custom" },
    `three config ${key} ${next ? "on" : "off"}`,
    { persist: false },
  );
}

function kittyGraphicsStatus(): string {
  if (configuredAscii().peek().kittyGraphics && Deno.env.get("TMUX") && !tmuxPassthroughAllowed) {
    return "[unavailable: tmux allow-passthrough off]";
  }
  const inspection = kittyGraphicsSurfaceFor(configuredAscii().peek()).inspect();
  if (inspection.available) return `[${inspection.mode ?? "available"}]`;
  return `[unavailable: ${inspection.reason ?? "not detected"}]`;
}

function stepAsciiNumeric(key: AsciiNumericKey, delta: number): void {
  const current = configuredAscii().peek();
  const values = asciiControlValues(key);
  const currentValue = Number(current[key]);
  const closest = closestValueIndex(values, currentValue);
  const nextValue = values[Math.max(0, Math.min(values.length - 1, closest + delta))]!;
  setConfiguredAscii(
    { ...current, [key]: nextValue, preset: "custom" },
    `three config ${key} ${formatAsciiControlValue(key, nextValue)}`,
    { persist: false },
  );
}

function numericOptionRatio(values: readonly number[], value: number): number {
  const min = values[0] ?? 0;
  const max = values.at(-1) ?? min;
  return max === min ? 1 : Math.max(0, Math.min(1, (value - min) / (max - min)));
}

function closestValueIndex(values: readonly number[], value: number): number {
  let best = 0;
  let distance = Number.POSITIVE_INFINITY;
  for (const [index, candidate] of values.entries()) {
    const nextDistance = Math.abs(candidate - value);
    if (nextDistance < distance) {
      best = index;
      distance = nextDistance;
    }
  }
  return best;
}

function asciiPresetLabelLocal(presetId: string): string {
  return ASCII_DEMO_PRESETS.find((preset) => preset.id === presetId)?.label ?? "Custom";
}

function drawFrame(frame: Frame, rect: Rectangle, title: string, active: boolean): void {
  const t = theme();
  fillRect(frame, rect, active ? t.panelSoft : t.panel);
  const borderStyle = { fg: active ? t.accent : t.borderStrong, bg: active ? t.panelSoft : t.panel, bold: active };
  const titleStyle = { fg: t.background, bg: active ? t.accent : t.border, bold: true };
  const horizontal = "─".repeat(Math.max(0, rect.width - 2));
  write(frame, rect.row, rect.column, paint(`┌${horizontal}┐`, borderStyle));
  for (let y = rect.row + 1; y < rect.row + rect.height - 1; y += 1) {
    write(frame, y, rect.column, paint("│", borderStyle));
    write(frame, y, rect.column + rect.width - 1, paint("│", borderStyle));
  }
  write(frame, rect.row + rect.height - 1, rect.column, paint(`└${horizontal}┘`, borderStyle));
  write(frame, rect.row, rect.column + 2, paint(` ${title.toUpperCase()} `, titleStyle));
}

function workspaceLayout(bounds: Rectangle): {
  bounds: Rectangle;
  contentHeight: number;
  rects: Map<WindowId, Rectangle>;
} {
  const rects = new Map<WindowId, Rectangle>();
  const densityOffset = tileDensity.peek() * 4;
  const layout = windowManager.layout({
    bounds,
    tileOptions: {
      minTileWidth: Math.max(26, 38 - densityOffset),
      minTileHeight: 10,
      maxColumns: bounds.width >= 172 ? 4 : 3,
      targetAspectRatio: 2.25 + tileDensity.peek() * 0.12,
      allowVerticalOverflow: true,
    },
  });
  for (const entry of layout.visible) {
    if (entry.rect) rects.set(entry.id as WindowId, entry.rect);
  }
  return { bounds, contentHeight: Math.max(bounds.height, layout.contentHeight), rects };
}

function windowScroll(id: WindowId): ScrollAreaController {
  let scroll = windowScrolls.get(id);
  if (!scroll) {
    scroll = new ScrollAreaController({ showScrollbar: true });
    windowScrolls.set(id, scroll);
  }
  return scroll;
}

function windowContentSize(id: WindowId, viewport: Rectangle): { width: number; height: number } {
  const baseWidth = Math.max(1, viewport.width);
  const baseHeight = Math.max(1, viewport.height);
  if (id === "explorer") {
    const entries = explorer.entries();
    return {
      width: Math.max(baseWidth, maxTextWidth(entries.map((entry) => entry.text)) + 2),
      height: Math.max(baseHeight, entries.length),
    };
  }
  if (id === "controls") {
    return { width: baseWidth, height: Math.max(baseHeight, 44) };
  }
  if (id === "inspector") {
    return { width: baseWidth, height: Math.max(baseHeight, 18) };
  }
  if (id === "logs") {
    return { width: Math.max(baseWidth, maxTextWidth(docs) + 2), height: Math.max(baseHeight, docs.length) };
  }
  if (id === "data") {
    const width = columns.reduce((sum, column) => sum + (column.width ?? 12) + 2, 8);
    return { width: Math.max(baseWidth, width), height: Math.max(baseHeight, rows.length + 4) };
  }
  if (id === "three") {
    return { width: baseWidth, height: baseHeight };
  }
  if (id === "htmlLayout") {
    return { width: baseWidth, height: Math.max(baseHeight, 20) };
  }
  if (id === TERMINAL_SHELL_WINDOW_ID) {
    return { width: Math.max(baseWidth, 72), height: Math.max(baseHeight, 24) };
  }
  if (id === TERMINAL_OUTPUT_WINDOW_ID) {
    const outputWidth = maxTextWidth(
      terminalOutputSession.output.lines.peek().map((line) => formatTerminalOutputLine(line, { sourcePrefix: true })),
    );
    return {
      width: Math.max(baseWidth, Math.min(120, Math.max(64, outputWidth + 2))),
      height: Math.max(baseHeight, terminalOutputSession.output.lines.peek().length + 4, 16),
    };
  }
  if (isVisualizationWindow(id)) {
    return visualizationWindowContentSize(id, viewport, baseWidth, baseHeight);
  }
  return { width: baseWidth, height: Math.max(baseHeight, 16) };
}

function visualizationWindowContentSize(
  id: VisualizationWindowId,
  viewport: Rectangle,
  baseWidth: number,
  baseHeight: number,
): { width: number; height: number } {
  const visualizationId = dynamicVisualizationWindows.peek()[id];
  const option = visualizationOption(visualizationId);
  if (!visualizationId || !option) return { width: baseWidth, height: baseHeight };

  const rendered = renderVisualization(buildVisualizationContext(visualizationId, {
    ...viewport,
    width: baseWidth,
    height: baseHeight,
  }, { windowId: id }));
  if (rendered.three && threeAsciiAvailable.peek()) {
    return {
      width: baseWidth,
      height: baseHeight,
    };
  }
  const rows = visualizationWindowRows(option, rendered);
  const scrollableRows = [
    ...rendered.body.split("\n"),
    rendered.footer,
  ];
  return {
    width: Math.max(baseWidth, maxTrimmedTextWidth(scrollableRows)),
    height: Math.max(baseHeight, rows.length),
  };
}

function visualizationWindowRows(
  option: NonNullable<ReturnType<typeof visualizationOption>>,
  rendered: PanelRender,
): string[] {
  return [
    ` ${option.group.toUpperCase()} · ${rendered.title ?? option.label.toUpperCase()} `,
    rendered.alert ? `! ${rendered.alert}` : option.description,
    ...rendered.body.split("\n"),
    rendered.footer,
  ];
}

function visualizationThreeStatusLine(
  rendered: PanelRender,
  option: NonNullable<ReturnType<typeof visualizationOption>>,
  options: AsciiOptions,
): string {
  const mode = rendered.three?.mode.toUpperCase() ?? "TEXT";
  return compactSpaces(`ACEROLA ${mode} · ${threeRendererModeLabel(options).toUpperCase()} · ${option.label}`);
}

function threeRendererModeLabel(options: AsciiOptions): string {
  const glyphs = terminalGlyphStyleLabel(options.terminalGlyphStyle);
  if (!options.kittyGraphics) return glyphs;
  const suffix = options.kittyDisableAscii ? "Kitty only" : "Kitty + ASCII";
  return `${glyphs} · ${suffix}`;
}

function buildVisualizationContext(
  visualizationId: string,
  rect: Rectangle,
  options: { windowId?: VisualizationWindowId } = {},
): RenderContext {
  const option = visualizationOption(visualizationId);
  const phase = Math.floor(performance.now() / 80);
  const usesRealSystem = option?.group === "Monitor";
  const system = usesRealSystem
    ? systemMonitor.snapshot.peek()
    : syntheticWorkbenchSystem(phase, option?.group ?? "Monitor");
  const sources = usesRealSystem
    ? realWorkbenchSources(visualizationId, system, phase)
    : syntheticWorkbenchSources(visualizationId, option?.group ?? "Monitor", phase);
  const slot: SlotConfig = {
    id: "cpu",
    name: option?.label ?? visualizationId,
    visualizationId,
    inputSourceIds: usesRealSystem
      ? monitorSourceIds(visualizationId)
      : ["workbench:primary", "workbench:secondary", "workbench:noise"],
    cycleEnabled: false,
    cycleIntervalMs: 10000,
    ascii: options.windowId ? asciiForWindow(options.windowId).peek() : ascii.peek(),
  };
  return {
    slot,
    system,
    sources,
    phase,
    width: Math.max(8, rect.width),
    height: Math.max(4, rect.height - 3),
    selectedCpuLabel: visualizationId === "cpu-hex-grid" && options.windowId
      ? selectedCpuHexTiles.peek()[options.windowId]
      : undefined,
  };
}

function realWorkbenchSources(visualizationId: string, system: SystemSnapshot, phase: number): SourceFrame[] {
  return monitorSourceIds(visualizationId).map((sourceId) =>
    getSourceFrame(sourceId, system, workbenchAudioRegistry, phase)
  );
}

function monitorSourceIds(visualizationId: string): string[] {
  switch (visualizationId) {
    case "cpu-monitor":
      return ["sys:cpu", "sys:load"];
    case "cpu-legend":
      return ["sys:cpu-cores"];
    case "cpu-hex-grid":
      return ["sys:cpu-cores", "sys:processes"];
    case "gpu-combined-monitor":
      return ["sys:gpu", "sys:gpu-chip", "sys:gpu-memory"];
    case "gpu-chip-monitor":
      return ["sys:gpu-chip", "sys:gpu"];
    case "gpu-memory-monitor":
      return ["sys:gpu-memory", "sys:gpu"];
    case "memory-monitor":
      return ["sys:memory", "sys:swap", "sys:load"];
    case "temperature-monitor":
      return ["sys:temperature", "sys:alerts"];
    case "disk-monitor":
      return ["sys:disk", "sys:alerts"];
    case "network-monitor":
      return ["sys:network"];
    case "process-monitor":
      return ["sys:processes", "sys:cpu"];
    default:
      return ["sys:cpu", "sys:memory", "sys:alerts"];
  }
}

function syntheticWorkbenchSources(id: string, group: NewWindowOption["group"], phase: number): SourceFrame[] {
  const seed = id.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const specs: Array<{ id: string; name: string; accent: Accent; offset: number }> = [
    { id: "primary", name: group, accent: group === "Monitor" ? "signal" : "phosphor", offset: seed % 29 },
    { id: "secondary", name: "Harmonic", accent: "violet", offset: seed % 41 },
    { id: "noise", name: "Noise", accent: seed % 2 === 0 ? "amber" : "alarm", offset: seed % 17 },
  ];
  return specs.map((spec, index) => {
    const series = Array.from(
      { length: 72 },
      (_, sample) => unitWave(phase + sample + spec.offset, 0.08 + index * 0.025, 0.11 + index * 0.07),
    );
    const value = series.at(-1) ?? 0.5;
    return {
      id: `workbench:${id}:${spec.id}`,
      name: spec.name,
      accent: spec.accent,
      value,
      series,
      detailLines: [`${Math.round(value * 100)}%`, group],
    };
  });
}

function syntheticWorkbenchSystem(phase: number, group: NewWindowOption["group"]): SystemSnapshot {
  const hot = unitWave(phase, 0.07, group === "Monitor" ? 0.1 : 0.33);
  const warm = unitWave(phase, 0.045, 0.55);
  const cpuCoreCount = Math.max(1, navigator.hardwareConcurrency || 1);
  return {
    timestamp: Date.now(),
    hostname: "workbench",
    osRelease: "demo",
    uptimeSeconds: phase,
    loadavg: [hot * 2.4, warm * 1.8, Math.max(hot, warm)],
    cpuOverall: hot * 100,
    cpuCores: Array.from({ length: cpuCoreCount }, (_, index) => ({
      label: String(index),
      usage: unitWave(phase + index * 7, 0.06, index * 0.13) * 100,
    })),
    cpuHistory: Array.from({ length: 72 }, (_, index) => unitWave(phase + index, 0.07, 0.03) * 100),
    gpu: {
      available: true,
      name: "Workbench RTX",
      utilizationPercent: hot * 100,
      memoryUsed: warm * 18 * 1024 ** 3,
      memoryTotal: 24 * 1024 ** 3,
      memoryPercent: warm * 75,
      temperatureCelsius: 34 + hot * 48,
      powerWatts: 90 + hot * 230,
      graphicsClockMhz: 1500 + hot * 1050,
      memoryClockMhz: 9000 + warm * 1500,
    },
    gpuUtilizationHistory: Array.from({ length: 72 }, (_, index) => unitWave(phase + index, 0.075, 0.31)),
    gpuMemoryHistory: Array.from({ length: 72 }, (_, index) => unitWave(phase + index, 0.042, 0.62)),
    memory: {
      total: 32 * 1024 ** 3,
      used: warm * 26 * 1024 ** 3,
      available: (1 - warm) * 26 * 1024 ** 3,
      free: (1 - warm) * 18 * 1024 ** 3,
      swapTotal: 8 * 1024 ** 3,
      swapUsed: hot * 2 * 1024 ** 3,
      percent: warm * 100,
      swapPercent: hot * 25,
    },
    memoryHistory: Array.from({ length: 72 }, (_, index) => unitWave(phase + index, 0.045, 0.21)),
    swapHistory: Array.from({ length: 72 }, (_, index) => unitWave(phase + index, 0.038, 0.49) * 0.35),
    temperatures: [
      { label: "CPU", celsius: 38 + hot * 50 },
      { label: "GPU", celsius: 35 + warm * 46 },
    ],
    disks: [
      {
        filesystem: "/dev/nvme0n1",
        mount: "/",
        total: 1024 * 1024 ** 3,
        used: warm * 820 * 1024 ** 3,
        available: (1 - warm) * 820 * 1024 ** 3,
        percent: Math.round(warm * 100),
      },
    ],
    networks: [
      {
        name: "eth0",
        addresses: ["10.0.0.2"],
        rxBytes: phase * 95_000,
        txBytes: phase * 72_000,
        rxRate: hot * 95_000_000,
        txRate: warm * 72_000_000,
      },
    ],
    rxHistory: Array.from({ length: 72 }, (_, index) => unitWave(phase + index, 0.1, 0.2)),
    txHistory: Array.from({ length: 72 }, (_, index) => unitWave(phase + index, 0.085, 0.4)),
    processes: Array.from({ length: 8 }, (_, index) => ({
      pid: 4200 + index,
      name: ["deno", "webgpu", "worker", "renderer", "scheduler", "cache", "input", "theme"][index] ?? "task",
      state: index % 3 === 0 ? "run" : "sleep",
      cpuPercent: unitWave(phase + index, 0.09, index * 0.2) * 80,
      memoryPercent: unitWave(phase + index, 0.05, index * 0.15) * 18,
      memoryBytes: (128 + index * 64) * 1024 ** 2,
      processor: index % cpuCoreCount,
    })),
    alerts: hot > 0.92 ? [{ severity: "warning", title: "WORKBENCH", detail: "LOAD SPIKE" }] : [],
    diagnostics: [],
  };
}

function unitWave(value: number, frequency: number, offset: number): number {
  return Math.max(
    0,
    Math.min(
      1,
      0.5 + Math.sin(value * frequency + offset) * 0.34 +
        Math.cos(value * (frequency * 0.37) + offset * 2.1) * 0.16,
    ),
  );
}

function translateContentHits(
  startIndex: number,
  viewport: Rectangle,
  offset: { columns: number; rows: number },
): void {
  translateHitTargets(hitTargets, {
    startIndex,
    columnDelta: viewport.column - offset.columns,
    rowDelta: viewport.row - offset.rows,
    clip: viewport,
  });
}

function translateDropdownOverlayForWindow(
  id: WindowId,
  viewport: Rectangle,
  offset: { columns: number; rows: number },
): void {
  if (id !== "controls" || dropdownOverlay?.coordinate !== "workspace" || dropdownOverlay.kind !== "control") return;
  dropdownOverlay = {
    ...dropdownOverlay,
    rect: {
      ...dropdownOverlay.rect,
      column: viewport.column + dropdownOverlay.rect.column - offset.columns,
      row: viewport.row + dropdownOverlay.rect.row - offset.rows,
    },
  };
}

function blitWindowContent(
  frame: Frame,
  content: Frame,
  viewport: Rectangle,
  offset: { columns: number; rows: number },
) {
  for (let row = 0; row < viewport.height; row += 1) {
    const cells = content[offset.rows + row] ?? [];
    write(frame, viewport.row + row, viewport.column, renderFrameSlice(cells, offset.columns, viewport.width));
  }
}

function renderWindowScrollbars(
  frame: Frame,
  id: WindowId,
  inner: Rectangle,
  viewport: Rectangle,
  contentSize: { width: number; height: number },
): void {
  const scroll = windowScroll(id);
  const t = theme();
  const overflow = scroll.inspectOverflow();
  if (overflow.rows.scrollbarVisible && viewport.height > 0) {
    const column = inner.column + inner.width - 1;
    const thumb = overflow.rows.thumb;
    addHit({ column, row: viewport.row, width: 1, height: viewport.height }, { type: "windowVScrollbar", id });
    for (let row = 0; row < viewport.height; row += 1) {
      write(
        frame,
        viewport.row + row,
        column,
        paint(scrollbarGlyph(row, thumb), { fg: t.accent, bg: t.panelSoft, bold: true }),
      );
    }
  }
  if (overflow.columns.scrollbarVisible && viewport.width > 0) {
    const row = inner.row + inner.height - 1;
    const thumb = overflow.columns.thumb;
    addHit({ column: viewport.column, row, width: viewport.width, height: 1 }, { type: "windowHScrollbar", id });
    for (let column = 0; column < viewport.width; column += 1) {
      write(
        frame,
        row,
        viewport.column + column,
        paint(scrollbarGlyph(column, thumb), { fg: t.accent, bg: t.panelSoft, bold: true }),
      );
    }
  }
}

function ensureVisualizationThreePanel(id: VisualizationWindowId): DynamicThreePanel {
  const existing = visualizationThreePanels.get(id);
  if (existing) return existing;

  const rectangle = new Signal<Rectangle>({ column: 0, row: 0, width: 0, height: 0 }, { deepObserve: true });
  const graphicsRectangle = new Signal<Rectangle>({ column: 0, row: 0, width: 0, height: 0 }, { deepObserve: true });
  const scene = new Signal<WorkbenchThreeScene | null>(null);
  const panel = new ThreePanelFrameView({
    rectangle,
    graphicsRectangle,
    scene,
    ascii: asciiForWindow(id),
    enabled: threeAsciiAvailable,
    graphicsSurface: () => kittyGraphicsSurfaceFor(asciiForWindow(id).peek()),
    frameInterval: 1000 / 18,
    onUpdate: scheduleDraw,
  });
  const entry = { rectangle, graphicsRectangle, scene, panel };
  visualizationThreePanels.set(id, entry);
  return entry;
}

function hideVisualizationThreePanel(id: VisualizationWindowId): void {
  const entry = visualizationThreePanels.get(id);
  if (!entry) return;
  entry.scene.value = null;
  setSignalRect(entry.rectangle, { column: 0, row: 0, width: 0, height: 0 });
  setSignalRect(entry.graphicsRectangle, { column: 0, row: 0, width: 0, height: 0 });
}

function hideVisualizationThreePanelsExcept(visibleIds: Set<VisualizationWindowId>): void {
  for (const id of visualizationThreePanels.keys()) {
    if (!visibleIds.has(id)) hideVisualizationThreePanel(id);
  }
}

function disposeVisualizationThreePanel(id: VisualizationWindowId): void {
  const entry = visualizationThreePanels.get(id);
  if (!entry) return;
  entry.panel.dispose();
  entry.scene.dispose();
  entry.rectangle.dispose();
  entry.graphicsRectangle.dispose();
  visualizationThreePanels.delete(id);
}

function setThreeBodyRect(rect: Rectangle): void {
  setSignalRect(threeBodyRect, rect);
}

function setThreeGraphicsRect(rect: Rectangle): void {
  setSignalRect(threeGraphicsRect, rect);
}

function setSignalRect(target: Signal<Rectangle>, rect: Rectangle): void {
  const current = target.peek();
  if (
    current.column === rect.column && current.row === rect.row && current.width === rect.width &&
    current.height === rect.height
  ) {
    return;
  }
  target.value = rect;
}

function screenDropdownOpen(): boolean {
  return topMenus.inspect().openId !== null;
}

function defaultWorkbenchAsciiOptions(): AsciiOptions {
  return {
    ...createDefaultAsciiOptions("sharp"),
    preset: "custom",
  };
}

function asciiForWindow(id: WindowId): Signal<AsciiOptions> {
  const existing = windowAscii.get(id);
  if (existing) return existing;
  const created = new Signal<AsciiOptions>(cloneAsciiOptions(ascii.peek()));
  windowAscii.set(id, created);
  return created;
}

function setAsciiForWindow(id: WindowId, options: AsciiOptions): void {
  asciiForWindow(id).value = normalizeAsciiOptions(options, defaultWorkbenchAsciiOptions());
}

function disposeAsciiForWindow(id: WindowId): void {
  if (id === "three") return;
  const signal = windowAscii.get(id);
  signal?.dispose();
  windowAscii.delete(id);
}

function configuredAsciiWindow(): WindowId {
  const id = threeConfigWindow.peek();
  return isThreeRenderedWindow(id) ? id : "three";
}

function configuredAscii(): Signal<AsciiOptions> {
  return asciiForWindow(configuredAsciiWindow());
}

function setConfiguredAscii(
  next: AsciiOptions,
  message: string,
  options: { persist?: boolean } = {},
): void {
  const id = configuredAsciiWindow();
  setAsciiForWindow(id, next);
  if (options.persist !== false && isVisualizationWindow(id)) void persistActiveWorkspaceState();
  pushLog(`${message} (${windowTitle(id)})`);
}

function applyThreeConfigModalAction(action: AsciiConfigModalAction): void {
  if (action === "cancel") {
    const baseline = threeConfigBaseline.peek();
    if (baseline) {
      setConfiguredAscii(cloneAsciiOptions(baseline), "three config cancelled", { persist: true });
    }
    closeThreeConfigModal();
    return;
  }

  const current = cloneAsciiOptions(configuredAscii().peek());
  setConfiguredAscii(current, action === "apply" ? "three config applied" : "three config ok", { persist: true });
  threeConfigBaseline.value = cloneAsciiOptions(current);
  if (action === "ok") closeThreeConfigModal();
}

function isThreeRenderedWindow(id: WindowId): boolean {
  if (id === "three") return true;
  return isVisualizationWindow(id) && visualizationWindowSupportsThree(id);
}

function visualizationWindowSupportsThree(id: VisualizationWindowId): boolean {
  const visualizationId = dynamicVisualizationWindows.peek()[id];
  if (!visualizationId) return false;
  return visualizationIdSupportsThree(visualizationId);
}

function visualizationIdSupportsThree(visualizationId: string): boolean {
  const cached = visualizationThreeSupport.get(visualizationId);
  if (cached !== undefined) return cached;
  const supportsThree = Boolean(
    renderVisualization(buildVisualizationContext(visualizationId, {
      column: 0,
      row: 0,
      width: 48,
      height: 16,
    })).three,
  );
  visualizationThreeSupport.set(visualizationId, supportsThree);
  return supportsThree;
}

function translateWorkspaceHits(startIndex: number, rowDelta: number, clip: Rectangle): void {
  translateHitTargets(hitTargets, { startIndex, rowDelta, clip });
}

function withWorkspacePlacement(bounds: Rectangle, offset: number, render: () => void): void {
  const previous = workspacePlacementContext;
  workspacePlacementContext = {
    rowDelta: bounds.row - offset,
    columnDelta: bounds.column,
    clip: bounds,
  };
  try {
    render();
  } finally {
    workspacePlacementContext = previous;
  }
}

function contentRectToGraphicsRect(rect: Rectangle): Rectangle {
  const windowContext = windowRenderContext;
  if (!windowContext) return rect;
  const windowRect = {
    column: windowContext.viewport.column + rect.column - windowContext.offset.columns,
    row: windowContext.viewport.row + rect.row - windowContext.offset.rows,
    width: rect.width,
    height: rect.height,
  };
  const visibleInWindow = clipRect(windowRect, windowContext.viewport);
  if (visibleInWindow.width !== rect.width || visibleInWindow.height !== rect.height) {
    return { column: visibleInWindow.column, row: visibleInWindow.row, width: 0, height: 0 };
  }

  const workspaceContext = workspacePlacementContext;
  if (!workspaceContext) return windowRect;
  const screenRect = {
    ...windowRect,
    column: windowRect.column + workspaceContext.columnDelta,
    row: windowRect.row + workspaceContext.rowDelta,
  };
  const visibleOnScreen = clipRect(screenRect, workspaceContext.clip);
  if (visibleOnScreen.width !== rect.width || visibleOnScreen.height !== rect.height) {
    return { column: visibleOnScreen.column, row: visibleOnScreen.row, width: 0, height: 0 };
  }
  return screenRect;
}

function blitWorkspace(frame: Frame, virtual: Frame, bounds: Rectangle, offset: number, width: number): void {
  for (let row = 0; row < bounds.height; row += 1) {
    write(frame, bounds.row + row, bounds.column, renderFrameRow(virtual[offset + row] ?? [], width));
  }
}

function renderWorkspaceScrollbar(frame: Frame, bounds: Rectangle): void {
  const overflow = workspaceScroll.inspectOverflow();
  if (!overflow.rows.scrollbarVisible || bounds.width < 2) return;
  const t = theme();
  const column = bounds.column + bounds.width - 1;
  const thumb = overflow.rows.thumb;
  addHit({ column, row: bounds.row, width: 1, height: bounds.height }, { type: "workspaceScrollbar" });
  for (let row = 0; row < bounds.height; row += 1) {
    write(
      frame,
      bounds.row + row,
      column,
      paint(scrollbarGlyph(row, thumb), { fg: t.accent, bg: t.backgroundSoft, bold: true }),
    );
  }
}

function renderDropdownOverlay(frame: Frame, bounds: Rectangle, offset: number): void {
  const overlay = dropdownOverlay;
  if (!overlay || overlay.items.length === 0) return;

  const t = theme();
  const clip = overlay.coordinate === "workspace"
    ? bounds
    : { column: 0, row: 0, width: currentWidth(), height: currentHeight() };
  const rect = overlay.coordinate === "workspace"
    ? { ...overlay.rect, row: overlay.rect.row + bounds.row - offset }
    : overlay.rect;
  if (!intersects(rect, clip)) return;

  const clipped = layoutWorkbenchPopover({ rect, bounds: clip });
  if (!clipped) return;

  fillRect(frame, clipped, t.panelSoft);
  const top = `┌${"─".repeat(Math.max(0, rect.width - 2))}┐`;
  const bottom = `└${"─".repeat(Math.max(0, rect.width - 2))}┘`;
  writeClippedOverlayRow(frame, clip, rect.row, rect.column, top, { fg: t.accent, bg: t.panelSoft, bold: true });
  for (const [index, item] of overlay.items.entries()) {
    const selected = overlay.selectedIndex === index;
    const actionIndex = overlay.itemIndexes?.[index] ?? index;
    const marker = selected ? "●" : "○";
    const row = rect.row + 1 + index;
    const style = selected
      ? { fg: t.background, bg: t.warn, bold: true }
      : { fg: t.text, bg: t.panelSoft, bold: false };
    writeClippedOverlayRow(frame, clip, row, rect.column, `│ ${fit(`${marker} ${item}`, rect.width - 4)} │`, style);
    const hit = clipRect({ column: rect.column + 1, row, width: Math.max(0, rect.width - 2), height: 1 }, clip);
    if (hit.width > 0 && hit.height > 0) {
      addHit(
        hit,
        overlay.kind === "theme"
          ? { type: "theme", index: actionIndex }
          : overlay.kind === "newWindow"
          ? { type: "newWindow", index: actionIndex }
          : overlay.kind === "workspace"
          ? { type: "workspace", index: actionIndex }
          : { type: "control", id: "dropdown", action: "activate", index: actionIndex },
      );
    }
  }
  writeClippedOverlayRow(
    frame,
    clip,
    rect.row + rect.height - 1,
    rect.column,
    bottom,
    { fg: t.accent, bg: t.panelSoft, bold: true },
  );
}

function writeClippedOverlayRow(
  frame: Frame,
  bounds: Rectangle,
  row: number,
  column: number,
  value: string,
  style: { fg?: string; bg?: string; bold?: boolean },
): void {
  if (row < bounds.row || row >= bounds.row + bounds.height) return;
  const start = Math.max(column, bounds.column);
  const end = Math.min(column + textWidth(value), bounds.column + bounds.width);
  if (end <= start) return;
  const visibleWidth = end - start;
  const leftTrim = Math.max(0, start - column);
  const text = stripStyles(value).slice(leftTrim, leftTrim + visibleWidth);
  write(frame, row, start, paint(fit(text, visibleWidth), style));
}

function ensureActiveWindowVisible(
  layout: { bounds: Rectangle; contentHeight: number; rects: Map<WindowId, Rectangle> },
  viewportHeight: number,
): void {
  const active = activeWindow.peek();
  const activeRect = layout.rects.get(active);
  const workspaceChanged = lastWorkspaceWidth !== layout.bounds.width || lastWorkspaceHeight !== viewportHeight;
  const activeChanged = lastVisibleWindow !== active;
  if (!activeRect || (!activeChanged && !workspaceChanged)) return;

  lastVisibleWindow = active;
  lastWorkspaceWidth = layout.bounds.width;
  lastWorkspaceHeight = viewportHeight;

  const offset = workbenchRevealActiveRowOffset({
    activeRect,
    contentHeight: layout.contentHeight,
    viewportHeight,
    offsetRows: workspaceScroll.offset.peek().rows,
  });
  if (offset !== undefined) workspaceScroll.scrollTo(0, offset);
}

function scrollWindow(id: WindowId, columns: number, rows: number): void {
  windowScroll(id).scrollBy(columns, rows);
}

function zoomThreeWindowAt(event: MouseScrollEvent): boolean {
  const hit = findHit(event.x, event.y);
  if (hit?.action.type !== "threeViewport") return false;
  const panel = threePanelForWindow(hit.action.id);
  if (!panel) return false;
  panel.zoomBy(event.scroll);
  focusWindowSilently(hit.action.id);
  return true;
}

function rotateThreeWindow(id: WindowId, event: MousePressEvent): boolean {
  const panel = threePanelForWindow(id);
  if (!panel) return false;
  panel.rotateBy(event.movementX, event.movementY);
  focusWindowSilently(id);
  return true;
}

function threePanelForWindow(id: WindowId): ThreePanelFrameView | undefined {
  if (id === "three") return threePanel;
  return isVisualizationWindow(id) ? visualizationThreePanels.get(id)?.panel : undefined;
}

function focusWindowSilently(id: WindowId): void {
  windowManager.focus(id);
  syncWindowSignalsFromManager();
}

function windowScrollPage(id: WindowId): number {
  return Math.max(1, windowScroll(id).viewportHeight.peek() - 1);
}

function windowAt(x: number, y: number): WindowId | undefined {
  const hit = findHit(x, y);
  if (!hit) return undefined;
  const action = hit.action;
  if (
    action.type === "focus" || action.type === "minimize" || action.type === "maximize" ||
    action.type === "restore" || action.type === "close" || action.type === "windowVScrollbar" ||
    action.type === "windowHScrollbar" || action.type === "threeViewport"
  ) {
    return action.id;
  }
  if (action.type === "control") return "controls";
  if (action.type === "dataRow") return "data";
  if (action.type === "explorerRow") return "explorer";
}

function focus(id: WindowId): void {
  windowManager.focus(id);
  syncWindowSignalsFromManager();
  pushLog(`focus ${windowTitle(id)}`);
}

function focusNext(): void {
  const ids = windowManager.ids() as WindowId[];
  if (ids.length === 0) return;
  const index = ids.indexOf(activeWindow.peek());
  focus(ids[(index + 1) % ids.length]!);
}

function focusPrevious(): void {
  const ids = windowManager.ids() as WindowId[];
  if (ids.length === 0) return;
  const index = ids.indexOf(activeWindow.peek());
  focus(ids[(index - 1 + ids.length) % ids.length]!);
}

function minimize(id: WindowId): void {
  windowManager.minimize(id);
  syncWindowSignalsFromManager();
  pushLog(`minimize ${windowTitle(id)}`);
}

function toggleMaximize(id: WindowId): void {
  windowManager.fullscreen(id);
  syncWindowSignalsFromManager();
  pushLog(`${maximized.peek() === id ? "maximize" : "restore"} ${windowTitle(id)}`);
}

function selectWindowTab(id: WindowId): void {
  windowManager.selectTab(id);
  syncWindowSignalsFromManager();
  pushLog(`fullscreen tab ${windowTitle(id)}`);
}

function restoreAll(): void {
  windowManager.restore();
  syncWindowSignalsFromManager();
  pushLog("restore all windows");
}

function syncWindowSignalsFromManager(): void {
  const inspection = windowManager.inspect();
  activeWindow.value = (inspection.activeId as WindowId | undefined) ?? "explorer";
  maximized.value = (inspection.fullscreenId as WindowId | undefined) ?? null;
  minimized.value = Object.fromEntries(
    inspection.windows.map((entry) => [entry.id, entry.minimized]),
  );
}

function adjustTileDensity(delta: number): void {
  tileDensity.value = Math.max(-3, Math.min(3, tileDensity.peek() + delta));
  pushLog(`tile density ${tileDensity.peek()}`);
}

function cycleDataSortColumn(delta: number): void {
  const sortable = columns.filter((column) => column.sortable !== false);
  if (sortable.length === 0) return;
  const current = table.state.peek().sort?.columnId;
  const index = Math.max(0, sortable.findIndex((column) => column.id === current));
  const next = sortable[(index + delta + sortable.length) % sortable.length]!;
  table.toggleSort(next.id);
  pushLog(`sort data by ${next.label}`);
}

function setTheme(index: number): void {
  themeIndex.value = (index + themes.length) % themes.length;
  closeTopMenus();
  pushLog(`theme ${theme().label}`);
}

function openSaveWorkspaceModal(): void {
  closeTopMenus();
  workspaceNameMode.value = "save";
  workspaceTargetName.value = null;
  workspaceNameDraft.value = defaultWorkspaceName();
  modal.open({
    title: "Save Workspace",
    tone: "confirm",
    body: workspaceNameModalBody(),
    actions: [
      { id: "workspace-cancel", label: "Cancel" },
      { id: "workspace-save", label: "Save", default: true },
    ],
  });
  pushLog("save workspace prompt");
}

function openRenameWorkspaceModal(workspace: SavedWorkspace): void {
  closeTopMenus();
  workspaceNameMode.value = "rename";
  workspaceTargetName.value = workspace.name;
  workspaceNameDraft.value = workspace.name;
  modal.open({
    title: "Rename Workspace",
    tone: "confirm",
    body: workspaceNameModalBody(),
    actions: [
      { id: "workspace-cancel", label: "Cancel" },
      { id: "workspace-rename", label: "Rename", default: true },
    ],
  });
  pushLog(`rename workspace prompt ${workspace.name}`);
}

function openDeleteWorkspaceModal(workspace: SavedWorkspace): void {
  closeTopMenus();
  workspaceNameMode.value = null;
  workspaceTargetName.value = workspace.name;
  modal.open({
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
  });
  pushLog(`delete workspace prompt ${workspace.name}`);
}

function workspaceNameModalBody(): string[] {
  const mode = workspaceNameMode.peek();
  const loaded = currentWorkspaceVisualizationIds();
  const cursor = mode ? "▌" : "";
  if (mode === "rename") {
    const workspace = workspaceByName(workspaceTargetName.peek());
    return [
      "Rename the saved workspace.",
      `Name: ${workspaceNameDraft.peek()}${cursor}`,
      `Current: ${workspace?.name ?? workspaceTargetName.peek() ?? "unknown"}`,
      `Windows: ${workspace?.visualizationIds.length ?? 0}`,
      "indexedDB" in globalThis ? "Storage: IndexedDB" : "Storage: Deno JSON fallback",
    ];
  }
  return [
    "Name the current set of loaded widget windows.",
    `Name: ${workspaceNameDraft.peek()}${cursor}`,
    `Windows: ${loaded.length === 0 ? "none" : loaded.join(", ")}`,
    "indexedDB" in globalThis ? "Storage: IndexedDB" : "Storage: Deno JSON fallback",
  ];
}

function refreshWorkspaceNameModal(): void {
  if (!workspaceNameMode.peek() || !modal.openState.peek()) return;
  modal.update({ body: workspaceNameModalBody() });
}

function handleWorkspaceNameKey(event: { key: string; ctrl?: boolean; meta?: boolean }): boolean {
  if (event.ctrl || event.meta) return false;
  if (event.key === "escape") {
    clearWorkspaceModalState();
    modal.close();
    return true;
  }
  if (event.key === "backspace") {
    workspaceNameDraft.value = workspaceNameDraft.peek().slice(0, -1);
    refreshWorkspaceNameModal();
    return true;
  }
  if (event.key === "return") {
    if (workspaceNameMode.peek() === "rename") void renameWorkspace();
    else void saveCurrentWorkspace();
    return true;
  }
  if (event.key.length === 1 && textWidth(event.key) === 1) {
    workspaceNameDraft.value = `${workspaceNameDraft.peek()}${event.key}`.slice(0, 48);
    refreshWorkspaceNameModal();
    return true;
  }
  return false;
}

async function saveCurrentWorkspace(): Promise<void> {
  const name = normalizeWorkspaceName(workspaceNameDraft.peek());
  const windows = currentWorkspaceWindows();
  const visualizationIds = windows.map((window) => window.visualizationId);
  const next: SavedWorkspace = { name, visualizationIds, windows, savedAt: Date.now() };
  savedWorkspaces.value = upsertWorkbenchWorkspace(savedWorkspaces.peek(), next);
  await persistSavedWorkspaces();
  activeWorkspaceName.value = name;
  clearWorkspaceModalState();
  modal.open({
    title: "Workspace Saved",
    tone: "success",
    body: [`${name}`, `${visualizationIds.length} widget window(s) saved.`],
    actions: [{ id: "dismiss", label: "OK", default: true }],
  });
  pushLog(`workspace saved ${name}`);
}

async function renameWorkspace(): Promise<void> {
  const originalName = workspaceTargetName.peek();
  const workspace = workspaceByName(originalName);
  if (!workspace) {
    clearWorkspaceModalState();
    modal.open({
      title: "Workspace Missing",
      tone: "warning",
      body: [`Workspace "${originalName ?? "unknown"}" no longer exists.`],
      actions: [{ id: "dismiss", label: "OK", default: true }],
    });
    return;
  }

  const name = normalizeWorkspaceName(workspaceNameDraft.peek());
  savedWorkspaces.value = renameWorkbenchWorkspace(savedWorkspaces.peek(), workspace.name, name);
  const renamed = workspaceByName(name) ?? workspace;
  await persistSavedWorkspaces();
  if (activeWorkspaceName.peek()?.toLowerCase() === workspace.name.toLowerCase()) {
    activeWorkspaceName.value = name;
  }
  clearWorkspaceModalState();
  modal.open({
    title: "Workspace Renamed",
    tone: "success",
    body: [`${workspace.name} -> ${name}`, `${renamed.visualizationIds.length} widget window(s).`],
    actions: [{ id: "dismiss", label: "OK", default: true }],
  });
  pushLog(`workspace renamed ${workspace.name} -> ${name}`);
}

async function deleteWorkspace(): Promise<void> {
  const name = workspaceTargetName.peek();
  const workspace = workspaceByName(name);
  if (!workspace) {
    clearWorkspaceModalState();
    modal.close();
    return;
  }
  savedWorkspaces.value = deleteWorkbenchWorkspace(savedWorkspaces.peek(), workspace.name);
  await persistSavedWorkspaces();
  if (activeWorkspaceName.peek()?.toLowerCase() === workspace.name.toLowerCase()) {
    activeWorkspaceName.value = null;
  }
  clearWorkspaceModalState();
  modal.open({
    title: "Workspace Deleted",
    tone: "success",
    body: [`${workspace.name}`, "Saved workspace removed."],
    actions: [{ id: "dismiss", label: "OK", default: true }],
  });
  pushLog(`workspace deleted ${workspace.name}`);
}

function clearWorkspaceModalState(): void {
  workspaceNameMode.value = null;
  workspaceTargetName.value = null;
}

function applyWorkspaceMenuItem(index: number): void {
  const entry = workspaceMenuEntries()[index];
  if (!entry) return;
  if (entry.action === "save") return openSaveWorkspaceModal();
  if (entry.action === "empty") return;
  const workspace = workspaceByName(entry.workspaceName);
  if (!workspace) return;
  if (entry.action === "open") return loadWorkspace(workspace);
  if (entry.action === "rename") return openRenameWorkspaceModal(workspace);
  if (entry.action === "delete") return openDeleteWorkspaceModal(workspace);
}

function loadWorkspace(workspace: SavedWorkspace): void {
  closeTopMenus();
  closeAllWindowsForWorkspaceLoad();
  for (const entry of workspaceWindowEntries(workspace)) {
    addVisualizationWindow(visualizationOption(entry.visualizationId), { ascii: entry.ascii });
  }
  activeWorkspaceName.value = workspace.name;
  workspaceScroll.scrollTo(0, 0);
  pushLog(`workspace loaded ${workspace.name}`);
}

function closeAllWindowsForWorkspaceLoad(): void {
  const ids = windowManager.ids() as WindowId[];
  if (ids.length === 0) return;

  const selected = { ...selectedCpuHexTiles.peek() };
  let selectedChanged = false;
  for (const id of ids) {
    if (isVisualizationWindow(id)) {
      disposeVisualizationThreePanel(id);
      disposeAsciiForWindow(id);
      if (id in selected) {
        delete selected[id];
        selectedChanged = true;
      }
    }
    windowManager.close(id);
  }
  if (selectedChanged) selectedCpuHexTiles.value = selected;
  syncWindowSignalsFromManager();
  pushLog(`closed ${ids.length} window(s) for workspace load`);
}

function workspaceMenuEntries(): WorkspaceMenuEntry[] {
  const entries: WorkspaceMenuEntry[] = [{ label: "[+] Save Current...", action: "save" }];
  const workspaces = savedWorkspaces.peek();
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

function workspaceMenuLabels(): string[] {
  return workspaceMenuEntries().map((entry) => entry.label);
}

function workspaceMenuItemCount(): number {
  return workspaceMenuEntries().length;
}

function currentWorkspaceVisualizationIds(): string[] {
  return currentWorkspaceWindows().map((window) => window.visualizationId);
}

function currentWorkspaceWindows(): SavedWorkspaceWindow[] {
  return windowManager.ids()
    .filter((id) => isVisualizationWindow(id as WindowId))
    .flatMap((id): SavedWorkspaceWindow[] => {
      const windowId = id as VisualizationWindowId;
      const visualizationId = dynamicVisualizationWindows.peek()[windowId];
      return visualizationId ? [{ visualizationId, ascii: cloneAsciiOptions(asciiForWindow(windowId).peek()) }] : [];
    });
}

function defaultWorkspaceName(): string {
  const count = savedWorkspaces.peek().length + 1;
  return `Workspace ${count}`;
}

function normalizeWorkspaceName(name: string): string {
  return normalizeWorkbenchWorkspaceName(name, defaultWorkspaceName());
}

function workspaceByName(name: string | null | undefined): SavedWorkspace | undefined {
  return findWorkbenchWorkspace(savedWorkspaces.peek(), name);
}

function workspaceWindowEntries(workspace: SavedWorkspace): SavedWorkspaceWindow[] {
  return workbenchWorkspaceWindowEntries(workspace, {
    validVisualizationIds: visualizationWindowOptions.map((option) => option.id),
    normalizeAscii: (value) =>
      value ? normalizeAsciiOptions(value as AsciiOptions, defaultWorkbenchAsciiOptions()) : undefined,
  });
}

async function persistActiveWorkspaceState(): Promise<void> {
  const name = activeWorkspaceName.peek();
  const workspace = workspaceByName(name);
  if (!workspace) return;
  const windows = currentWorkspaceWindows();
  const next: SavedWorkspace = {
    ...workspace,
    visualizationIds: windows.map((window) => window.visualizationId),
    windows,
    savedAt: Date.now(),
  };
  savedWorkspaces.value = upsertWorkbenchWorkspace(savedWorkspaces.peek(), next);
  await persistSavedWorkspaces();
}

async function loadSavedWorkspaces(): Promise<SavedWorkspace[]> {
  const stored = await workspaceStore.get(WORKSPACE_STORE_KEY).catch(() => undefined);
  return normalizeSavedWorkspaces(stored);
}

async function persistSavedWorkspaces(): Promise<void> {
  await workspaceStore.set(WORKSPACE_STORE_KEY, serializeWorkbenchWorkspaces(savedWorkspaces.peek())).catch((error) => {
    pushLog(`workspace save failed ${error instanceof Error ? error.message : "unknown"}`);
  });
}

function normalizeSavedWorkspaces(value: unknown): SavedWorkspace[] {
  return normalizeWorkbenchWorkspaceStorage(value, {
    validVisualizationIds: visualizationWindowOptions.map((option) => option.id),
    normalizeName: (name, index) => normalizeWorkbenchWorkspaceName(name, `Workspace ${index + 1}`),
    normalizeAscii: (candidate) =>
      candidate ? normalizeAsciiOptions(candidate as AsciiOptions, defaultWorkbenchAsciiOptions()) : undefined,
  });
}

function createWorkspaceStore(): AsyncStore<unknown> {
  if ("indexedDB" in globalThis) {
    return createRuntimeStore<unknown>({
      databaseName: "deno-tui-api-workbench",
      storeName: "workspaces",
      version: 1,
    });
  }
  return new JsonFileStore<unknown>(".api-workbench-workspaces.json");
}

function openWorkbenchModal(): void {
  modal.open({
    title: "Confirm Action",
    tone: "confirm",
    body: [
      "Modal windows sit above the workspace and can contain text, menus, warnings, errors, and buttons.",
      "Keyboard focus is trapped while the modal is open. Use Tab, arrows, Enter, Escape, or click an action.",
    ],
    actions: [
      { id: "cancel", label: "Cancel" },
      { id: "details", label: "Details" },
      { id: "confirm", label: "Confirm", default: true },
    ],
  });
  pushLog("modal opened");
}

function openQuitModal(): void {
  closeTopMenus();
  threeConfigOpen.value = false;
  modal.open({
    title: "Quit Workbench?",
    tone: "warning",
    body: [
      "Close the API workbench and return to the terminal?",
      "Use Enter to confirm, Escape to cancel, or Tab to choose an action.",
    ],
    actions: [
      { id: "cancel", label: "Cancel" },
      { id: "quit", label: "Quit", destructive: true, default: true },
    ],
  });
  pushLog("quit confirmation");
}

function openHelpModal(): void {
  modal.open({
    title: "Workbench Help",
    tone: "info",
    body: [
      "Keyboard: Tab moves focus through windows. Inside Controls, Tab moves through controls and leaves the pane after the last control. Shift+Tab moves backward.",
      "Use F10 to focus the top menu, Left/Right to move, Down or Enter to open, arrows to choose menu items, Enter to activate, and Escape to leave.",
      "Use N to open the New menu, Shift+T to open Theme, T to cycle themes, H or ? for help, Q to request quit, and 0 to restore the next minimized window.",
      "Use 1-8 to focus built-in windows, and higher numbers for added windows. Use M to minimize, F or Enter to maximize, C to close, and R or Escape to restore windows.",
      "When a window is fullscreen, use the bottom tabs, Tab, or number shortcuts to switch between fullscreen windows.",
      "Use G from any Three ASCII, Neon 3D, or NGE primitive window to open renderer config. In config, use Up/Down to select settings and Left/Right or Enter to change them.",
      "Use arrows in the Data Table, Explorer, Logs, and overflow windows. In Data Table, S cycles the sort column. Shift+Left/Right scrolls horizontally when content is wider than the pane.",
      "In Controls, arrows adjust sliders, radio groups, combo boxes, steppers, and dropdown selections. Enter or Space activates the selected control.",
      "Three ASCII widgets: mousewheel over the rendered scene zooms; click and drag the scene to rotate the model.",
      "Mouse: click windows to focus them, click rows to select them, click controls to change values, drag or click scrollbars to move through overflow content.",
      "Use the New menu to add Monitor, Neon Exodus, and Neon 3D widget windows to the workspace.",
      "The New menu also includes Shell, Terminal Output, and HTML/CSS Layout windows for interactive shells, process output, and markup/CSS layout demos.",
      "In Shell, P/S/U/K start, stop, restart, and clear. Press I for raw input; while raw, type normal commands, Ctrl+C interrupts the shell, and Escape returns to Workbench mode.",
      "In Terminal Output, P/S/U/K/V/Y run, stop, restart, clear, follow, and copy the command. Press I while the process is running to send printable keys to child stdin; Escape returns to workbench mode.",
      "Use the Workspace menu to save, open, rename, or delete workspace layouts. Opening a saved workspace replaces the currently loaded widget windows.",
      "Use the Theme menu to switch palettes. Click the [x] button in the top-right menu bar or press Q to open quit confirmation.",
    ],
    actions: [
      { id: "dismiss", label: "Dismiss", default: true },
      { id: "controls", label: "Focus Controls" },
    ],
  });
  pushLog("help opened");
}

function applyModalAction(actionId: string): void {
  if (actionId === "workspace-save") {
    void saveCurrentWorkspace();
    return;
  }
  if (actionId === "workspace-rename") {
    void renameWorkspace();
    return;
  }
  if (actionId === "workspace-delete") {
    void deleteWorkspace();
    return;
  }
  if (actionId === "workspace-cancel") {
    clearWorkspaceModalState();
    modal.close();
    pushLog("workspace action cancelled");
    return;
  }
  if (actionId === "details") {
    modal.open({
      title: "Modal Details",
      tone: "info",
      body: [
        "The ModalController is renderer-neutral and exposes open state, tone, content, action focus, and callbacks.",
        "Workbench rendering adds a theme-aware pop-over, blocks background clicks, and routes action hit targets back to the controller.",
      ],
      actions: [
        { id: "back", label: "Back" },
        { id: "confirm", label: "Confirm", default: true },
        { id: "dismiss", label: "Dismiss" },
      ],
    });
    pushLog("modal details");
    return;
  }
  if (actionId === "back") {
    openWorkbenchModal();
    return;
  }
  if (actionId === "confirm") {
    modal.open({
      title: "Action Confirmed",
      tone: "success",
      body:
        "The modal action completed. This same surface can be used for confirmations, alerts, menus, and error dialogs.",
      actions: [{ id: "dismiss", label: "Dismiss", default: true }],
    });
    pushLog("modal confirmed");
    return;
  }
  if (actionId === "controls") {
    modal.close();
    focus("controls");
    return;
  }
  if (actionId === "quit") {
    tui.emit("destroy");
    return;
  }

  modal.close();
  pushLog(`modal ${actionId}`);
}

function applyHit(target: { rect: Rectangle; action: HitAction }, x: number, y: number): void {
  const action = target.action;
  if (action.type === "menu") {
    menu.setActive(action.index);
    menu.selectActive();
  } else if (action.type === "quit") openQuitModal();
  else if (action.type === "windowTab") selectWindowTab(action.id);
  else if (action.type === "focus") focus(action.id);
  else if (action.type === "minimize") minimize(action.id);
  else if (action.type === "maximize") toggleMaximize(action.id);
  else if (action.type === "close") closeWindow(action.id);
  else if (action.type === "threeViewport") focus(action.id);
  else if (action.type === "threeConfig") openThreeConfigModal(action.id);
  else if (action.type === "asciiConfig") applyThreeConfigRow(action.index, action.action ?? "activate");
  else if (action.type === "asciiConfigAction") applyThreeConfigModalAction(action.action);
  else if (action.type === "asciiConfigBackdrop") return;
  else if (action.type === "restore") {
    windowManager.restore(action.id);
    syncWindowSignalsFromManager();
    pushLog(`restore ${windowTitle(action.id)}`);
  } else if (action.type === "control") {
    applyControlHit(action.id, action.action ?? "activate", target.rect, x, action.index);
  } else if (action.type === "terminalOutput") {
    void applyTerminalOutputAction(action.action);
  } else if (action.type === "terminalShell") {
    void applyTerminalShellAction(action.action);
  } else if (action.type === "modalAction") {
    if (action.index >= 0) modal.activateAction(action.index);
  } else if (action.type === "dataRow") selectDataRow(action.index);
  else if (action.type === "explorerRow") selectExplorerRow(action.index);
  else if (action.type === "cpuHexTile") selectCpuHexTile(action.id, action.label);
  else if (action.type === "newWindow") {
    toggleNewWindowOption(newWindowOptions[action.index], { keepMenuOpen: true });
  } else if (action.type === "workspace") applyWorkspaceMenuItem(action.index);
  else if (action.type === "windowVScrollbar") {
    const scroll = windowScroll(action.id);
    scroll.scrollTo(
      scroll.offset.peek().columns,
      scrollbarOffsetForPointer(scroll.contentHeight.peek(), scroll.viewportHeight.peek(), y - target.rect.row),
    );
    windowManager.focus(action.id);
    syncWindowSignalsFromManager();
  } else if (action.type === "windowHScrollbar") {
    const scroll = windowScroll(action.id);
    scroll.scrollTo(
      scrollbarOffsetForPointer(scroll.contentWidth.peek(), scroll.viewportWidth.peek(), x - target.rect.column),
      scroll.offset.peek().rows,
    );
    windowManager.focus(action.id);
    syncWindowSignalsFromManager();
  } else if (action.type === "workspaceScrollbar") {
    workspaceScroll.scrollTo(
      0,
      scrollbarOffsetForPointer(workspaceScroll.contentHeight.peek(), target.rect.height, y - target.rect.row),
    );
  } else if (action.type === "theme") setTheme(action.index);
}

async function applyTerminalOutputAction(action: TerminalOutputAction): Promise<void> {
  focus(TERMINAL_OUTPUT_WINDOW_ID);
  if (action === "run") {
    await terminalOutputSession.start();
    pushLog("terminal run");
  } else if (action === "stop") {
    await terminalOutputSession.stop();
    pushLog("terminal stop");
  } else if (action === "restart") {
    await terminalOutputSession.restart();
    pushLog("terminal restart");
  } else if (action === "clear") {
    terminalOutputSession.clearOutput();
    pushLog("terminal clear");
  } else if (action === "follow") {
    const follow = terminalOutputSession.output.toggleFollow();
    pushLog(`terminal follow ${follow ? "on" : "off"}`);
  } else if (action === "raw") {
    toggleTerminalInputMode();
  } else if (action === "copy") {
    pushLog(`terminal command ${formatProcessCommandLine(terminalOutputSession.command.peek())}`);
  }
  scheduleDraw();
}

async function applyTerminalShellAction(action: TerminalShellAction): Promise<void> {
  focus(TERMINAL_SHELL_WINDOW_ID);
  if (action === "start") {
    await terminalShell.start();
    terminalShell.scrollback.exitCopyMode();
    terminalShellInputMode.value = "raw";
    pushLog("shell start");
  } else if (action === "stop") {
    await terminalShell.stop();
    terminalShellInputMode.value = "workbench";
    pushLog("shell stop");
  } else if (action === "restart") {
    await terminalShell.restart();
    terminalShell.scrollback.exitCopyMode();
    terminalShellInputMode.value = "raw";
    pushLog("shell restart");
  } else if (action === "clear") {
    terminalShell.clear();
    terminalShell.scrollback.exitCopyMode();
    pushLog("shell clear");
  } else if (action === "raw") {
    toggleTerminalShellInputMode();
  } else if (action === "copy") {
    if (terminalShell.scrollback.mode === "copy") {
      terminalShell.scrollback.exitCopyMode();
      pushLog("shell copy mode off");
    } else {
      terminalShell.scrollback.enterCopyMode();
      terminalShellInputMode.value = "workbench";
      pushLog("shell copy mode on");
    }
  } else if (action === "top") {
    terminalShell.scrollback.toTop();
    terminalShellInputMode.value = "workbench";
    pushLog("shell scroll top");
  } else if (action === "bottom") {
    terminalShell.scrollback.toBottom();
    terminalShellInputMode.value = "workbench";
    pushLog("shell scroll bottom");
  }
  scheduleDraw();
}

function openThreeConfigModal(id: WindowId): void {
  if (!isThreeRenderedWindow(id)) return;
  modal.close();
  closeTopMenus();
  threeConfigWindow.value = id;
  threeConfigBaseline.value = cloneAsciiOptions(asciiForWindow(id).peek());
  threeConfigOpen.value = true;
  threeConfigSelected.value = 0;
  focus(id);
  pushLog(`configure ${windowTitle(id)}`);
}

function closeThreeConfigModal(): void {
  threeConfigOpen.value = false;
  threeConfigBaseline.value = null;
  pushLog("three config closed");
}

function handleWorkbenchKey(event: KeyPressEvent): void {
  if (activeWindow.peek() === TERMINAL_SHELL_WINDOW_ID && handleTerminalShellKey(event)) return;
  if (activeWindow.peek() === TERMINAL_OUTPUT_WINDOW_ID && handleTerminalOutputKey(event)) return;
  if (event.ctrl || event.meta) return;
  if (event.key === "q") openQuitModal();
  else if (event.key === "f10") focusMenu();
  else if (event.key === "?" || event.key === "h") openHelpModal();
  else if (event.key === "n") openNewWindowMenu();
  else if (event.key === "t" && event.shift) openThemeMenu();
  else if (event.key === "t") setTheme(themeIndex.peek() + 1);
  else if (event.key === "g") openThreeConfigModal(activeWindow.peek());
  else if (event.key === "c") closeWindow(activeWindow.peek());
  else if (event.key === "m") minimize(activeWindow.peek());
  else if (event.key === "f" || event.key === "return") toggleMaximize(activeWindow.peek());
  else if (event.key === "r" || event.key === "escape") restoreAll();
  else if (event.key === "tab" && activeWindow.peek() === "controls") focusNextControl(event.shift ? -1 : 1);
  else if (event.key === "tab") event.shift ? focusPrevious() : focusNext();
  else if (focusWindowByNumber(event.key)) return;
  else if (event.key === "0") restoreNextMinimizedWindow();
  else if (event.key === "[") adjustTileDensity(-1);
  else if (event.key === "]") adjustTileDensity(1);
  else if (handleCpuHexGridKey(event)) return;
  else if (event.key === "pageup") scrollWindow(activeWindow.peek(), 0, -windowScrollPage(activeWindow.peek()));
  else if (event.key === "pagedown") scrollWindow(activeWindow.peek(), 0, windowScrollPage(activeWindow.peek()));
  else if (event.key === "home") windowScrolls.get(activeWindow.peek())?.scrollTo(0, 0);
  else if (event.key === "end") {
    const scroll = windowScrolls.get(activeWindow.peek());
    scroll?.scrollTo(scroll.offset.peek().columns, scroll.maxOffset().rows);
  } else if (event.key === "left" && event.shift) scrollWindow(activeWindow.peek(), -4, 0);
  else if (event.key === "right" && event.shift) scrollWindow(activeWindow.peek(), 4, 0);
  else if (activeWindow.peek() === "explorer" && explorerKeys.has(event.key)) {
    explorer.handleKeyPress(event, Math.max(1, currentHeight() - 8));
  } else if (activeWindow.peek() === "controls") handleControlsKey(event);
  else if (activeWindow.peek() === "data" && event.key.toLowerCase() === "s") {
    cycleDataSortColumn(event.shift ? -1 : 1);
  } else if (activeWindow.peek() === "data") table.handleKeyPress(event as never);
  else if (event.key === "+" || event.key === "=") density.increment();
  else if (event.key === "-" || event.key === "_") density.decrement();
  else if (event.key === "x" || event.key === "space") livePreview.toggle();
  else if (event.key === "left") scrollWindow(activeWindow.peek(), -1, 0);
  else if (event.key === "right") scrollWindow(activeWindow.peek(), 1, 0);
  else if (event.key === "up") scrollWindow(activeWindow.peek(), 0, -1);
  else if (event.key === "down") scrollWindow(activeWindow.peek(), 0, 1);
}

function handleTerminalShellKey(event: KeyPressEvent): boolean {
  if (terminalShell.scrollback.mode === "copy") {
    if (event.key === "escape" || event.key.toLowerCase() === "i") {
      terminalShell.scrollback.exitCopyMode();
      terminalShellInputMode.value = terminalShell.running ? "raw" : "workbench";
      pushLog("shell copy mode off");
      return true;
    }
    if (event.ctrl || event.meta) return false;
    if (event.key === "pageup") terminalShell.scrollback.page(-1);
    else if (event.key === "pagedown") terminalShell.scrollback.page(1);
    else if (event.key === "home") terminalShell.scrollback.toTop();
    else if (event.key === "end") terminalShell.scrollback.toBottom();
    else if (event.key === "up") terminalShell.scrollback.scrollLines(-1);
    else if (event.key === "down") terminalShell.scrollback.scrollLines(1);
    else if (event.key.toLowerCase() === "c") {
      const text = terminalShell.scrollback.copySelection();
      pushLog(text ? `shell copied ${text.length} chars` : "shell selection empty");
    } else return false;
    scheduleDraw();
    return true;
  }

  if (terminalShellInputMode.peek() === "raw") {
    if (event.key === "escape") {
      terminalShellInputMode.value = "workbench";
      pushLog("shell input workbench mode");
      return true;
    }
    if (event.meta || event.key === "f10") return false;
    void routeTerminalKeyPress(terminalShell, event, {
      mode: "raw",
      reservedKeys: ["f10", "escape"],
      reservedCtrlKeys: [],
    }).then((decision) => {
      if (!decision.routed && decision.reason !== "reserved") {
        pushLog(`shell input ${decision.reason}`);
      }
      scheduleDraw();
    });
    return true;
  }

  if (event.ctrl || event.meta) return false;
  const key = event.key.toLowerCase();
  if (event.key === "pageup" || event.key === "pagedown") {
    terminalShell.scrollback.enterCopyMode();
    terminalShell.scrollback.page(event.key === "pageup" ? -1 : 1);
    terminalShellInputMode.value = "workbench";
    scheduleDraw();
    return true;
  }
  const action = key === "p"
    ? "start"
    : key === "s"
    ? "stop"
    : key === "u"
    ? "restart"
    : key === "k"
    ? "clear"
    : key === "i"
    ? "raw"
    : event.key === "home"
    ? "top"
    : event.key === "end"
    ? "bottom"
    : undefined;
  if (!action) return false;
  void applyTerminalShellAction(action);
  return true;
}

function handleTerminalShellPaste(event: PasteEvent): boolean {
  if (activeWindow.peek() !== TERMINAL_SHELL_WINDOW_ID || terminalShellInputMode.peek() !== "raw") return false;
  void routeTerminalPaste(terminalShell, event, { mode: "raw" }).then((decision) => {
    if (!decision.routed) pushLog(`shell paste ${decision.reason}`);
    scheduleDraw();
  });
  return true;
}

function shellShouldReceiveCtrlC(): boolean {
  return activeWindow.peek() === TERMINAL_SHELL_WINDOW_ID && terminalShellInputMode.peek() === "raw" &&
    terminalShell.running;
}

function handleTerminalOutputKey(event: KeyPressEvent): boolean {
  if (terminalInputMode.peek() === "raw") {
    if (event.key === "escape") {
      terminalInputMode.value = "workbench";
      pushLog("terminal input workbench mode");
      return true;
    }
    if (event.meta || event.key === "f10" || (event.ctrl && event.key === "c")) return false;
    void routeTerminalKeyPress(terminalOutputSession, event, { mode: "raw" }).then((decision) => {
      if (!decision.routed && decision.reason !== "reserved") {
        pushLog(`terminal input ${decision.reason}`);
      }
      scheduleDraw();
    });
    return true;
  }
  if (event.ctrl || event.meta) return false;
  const key = event.key.toLowerCase();
  const action = key === "p"
    ? "run"
    : key === "s"
    ? "stop"
    : key === "u"
    ? "restart"
    : key === "k"
    ? "clear"
    : key === "v"
    ? "follow"
    : key === "y"
    ? "copy"
    : key === "i"
    ? "raw"
    : undefined;
  if (!action) return false;
  void applyTerminalOutputAction(action);
  return true;
}

function handleCpuHexGridKey(event: { key: string; ctrl?: boolean; meta?: boolean; shift?: boolean }): boolean {
  if (event.ctrl || event.meta || event.shift) return false;
  const key = event.key;
  if (key !== "left" && key !== "right" && key !== "up" && key !== "down" && key !== "home" && key !== "end") {
    return false;
  }

  const id = activeWindow.peek();
  if (!isVisualizationWindow(id) || dynamicVisualizationWindows.peek()[id] !== "cpu-hex-grid") return false;

  const system = systemMonitor.snapshot.peek();
  const cores = system.cpuCores;
  if (cores.length === 0) return true;

  const currentLabel = selectedCpuHexTiles.peek()[id];
  const currentIndex = Math.max(0, cores.findIndex((core) => core.label === currentLabel));
  const scroll = windowScroll(id);
  const columns = cpuHexGridColumnCount(
    cores,
    Math.max(8, scroll.contentWidth.peek()),
    Math.max(4, scroll.viewportHeight.peek()),
  );
  const rawNextIndex = key === "home"
    ? 0
    : key === "end"
    ? cores.length - 1
    : key === "left"
    ? currentIndex - 1
    : key === "right"
    ? currentIndex + 1
    : key === "up"
    ? currentIndex - columns
    : currentIndex + columns;
  const nextIndex = Math.max(0, Math.min(cores.length - 1, rawNextIndex));

  selectCpuHexTile(id, cores[nextIndex]!.label);
  return true;
}

function handleMenuFocusKey(event: { key: string; ctrl?: boolean; meta?: boolean; shift?: boolean }): void {
  if (event.ctrl || event.meta) return;
  if (event.key === "escape") {
    closeTopMenus();
    return;
  }
  if (event.key === "tab") {
    closeTopMenus();
    event.shift ? focusPrevious() : focusNext();
    return;
  }
  if (event.key === "left" || event.key === "right" || event.key === "home" || event.key === "end") {
    menu.handleKeyPress(event);
    return;
  }
  if (event.key === "down" || event.key === "return" || event.key === "space") {
    menu.selectActive();
  }
}

function handleScreenDropdownKey(event: { key: string; ctrl?: boolean; meta?: boolean; shift?: boolean }): void {
  if (event.ctrl || event.meta) return;
  if (event.key === "q") {
    openQuitModal();
    return;
  }
  if (event.key === "?" || event.key === "h") {
    closeTopMenus();
    openHelpModal();
    return;
  }
  if (event.key === "escape") {
    closeTopMenus();
    return;
  }
  if (event.key === "tab") {
    closeTopMenus();
    event.shift ? focusPrevious() : focusNext();
    return;
  }
  if (event.key === "left" || event.key === "right") {
    const delta = event.key === "left" ? -1 : 1;
    menu.move(delta);
    openActiveTopMenu();
    return;
  }
  if (themeMenuOpen.peek()) {
    if (event.key === "up") themeIndex.value = (themeIndex.peek() - 1 + themes.length) % themes.length;
    else if (event.key === "down") themeIndex.value = (themeIndex.peek() + 1) % themes.length;
    else if (event.key === "home") themeIndex.value = 0;
    else if (event.key === "end") themeIndex.value = themes.length - 1;
    else if (isWorkbenchMenuActivationKey(event.key)) setTheme(themeIndex.peek());
    return;
  }
  if (newWindowMenuOpen.peek()) {
    const count = newWindowOptions.length;
    if (count === 0) return;
    newWindowMenuIndex.value = moveWorkbenchMenuIndex(newWindowMenuIndex.peek(), count, event);
    if (isWorkbenchMenuActivationKey(event.key)) {
      toggleNewWindowOption(newWindowOptions[newWindowMenuIndex.peek()], { keepMenuOpen: true });
    }
    return;
  }
  if (workspaceMenuOpen.peek()) {
    const count = workspaceMenuItemCount();
    if (count === 0) return;
    workspaceMenuIndex.value = moveWorkbenchMenuIndex(workspaceMenuIndex.peek(), count, event);
    if (isWorkbenchMenuActivationKey(event.key)) {
      applyWorkspaceMenuItem(workspaceMenuIndex.peek());
    }
  }
}

function focusMenu(): void {
  topMenus.focus();
  topMenus.close(false);
  pushLog("menu focus");
}

function openActiveTopMenu(): void {
  const item = menu.active();
  if (item?.id === "theme") openThemeMenu();
  else if (item?.id === "new") openNewWindowMenu();
  else if (item?.id === "workspace") openWorkspaceMenu();
  else {
    topMenus.close(false);
  }
}

function openThemeMenu(): void {
  const index = menu.items.peek().findIndex((item) => item.id === "theme");
  if (index >= 0) menu.setActive(index);
  topMenus.open("theme");
  pushLog("open theme menu");
}

function openNewWindowMenu(): void {
  const index = menu.items.peek().findIndex((item) => item.id === "new");
  if (index >= 0) menu.setActive(index);
  topMenus.open("newWindow");
  newWindowMenuIndex.value = Math.max(0, Math.min(newWindowMenuIndex.peek(), newWindowOptions.length - 1));
  pushLog("open new window menu");
}

function openWorkspaceMenu(): void {
  const index = menu.items.peek().findIndex((item) => item.id === "workspace");
  if (index >= 0) menu.setActive(index);
  topMenus.open("workspace");
  workspaceMenuIndex.value = Math.max(0, Math.min(workspaceMenuIndex.peek(), workspaceMenuItemCount() - 1));
  pushLog("open workspace menu");
}

function closeTopMenus(clearFocus = true): void {
  topMenus.close(clearFocus);
}

function syncTopMenuState(state: { openId: "theme" | "newWindow" | "workspace" | null; focused: boolean }): void {
  themeMenuOpen.value = state.openId === "theme";
  newWindowMenuOpen.value = state.openId === "newWindow";
  workspaceMenuOpen.value = state.openId === "workspace";
  menuFocused.value = state.focused;
}

function focusWindowByNumber(key: string): boolean {
  const index = Number.parseInt(key, 10);
  if (!Number.isInteger(index) || index < 1) return false;
  const id = windowIds()[index - 1];
  if (!id) return false;
  focus(id);
  return true;
}

function restoreNextMinimizedWindow(): void {
  const entry = windowManager.inspect().windows.find((window) => window.minimized && !window.closed);
  if (!entry) {
    pushLog("no minimized windows");
    return;
  }
  windowManager.restore(entry.id);
  syncWindowSignalsFromManager();
  pushLog(`restore ${windowTitle(entry.id as WindowId)}`);
}

function handleThreeConfigKey(event: { key: string; shift?: boolean }): void {
  if (event.key === "escape" || event.key === "q") {
    applyThreeConfigModalAction("cancel");
    return;
  }
  if (event.key === "a" || event.key === "A") {
    applyThreeConfigModalAction("apply");
    return;
  }
  if (event.key === "o" || event.key === "O") {
    applyThreeConfigModalAction("ok");
    return;
  }
  if (event.key === "up") {
    threeConfigSelected.value = (threeConfigSelected.peek() - 1 + threeConfigRows.length) % threeConfigRows.length;
    return;
  }
  if (event.key === "down" || event.key === "tab") {
    const delta = event.shift ? -1 : 1;
    threeConfigSelected.value = (threeConfigSelected.peek() + delta + threeConfigRows.length) % threeConfigRows.length;
    return;
  }
  if (event.key === "left") {
    applyThreeConfigRow(threeConfigSelected.peek(), "previous");
    return;
  }
  if (event.key === "right" || event.key === "return" || event.key === "space") {
    applyThreeConfigRow(threeConfigSelected.peek(), "next");
  }
}

function closeWindow(id: WindowId): void {
  if (isVisualizationWindow(id)) {
    disposeVisualizationThreePanel(id);
    disposeAsciiForWindow(id);
    const { [id]: _removed, ...remainingSelections } = selectedCpuHexTiles.peek();
    selectedCpuHexTiles.value = remainingSelections;
  }
  if (id === TERMINAL_SHELL_WINDOW_ID) {
    void terminalShell.stop();
    terminalShellInputMode.value = "workbench";
  }
  windowManager.close(id);
  syncWindowSignalsFromManager();
  pushLog(`close ${windowTitle(id)}`);
}

function toggleNewWindowOption(
  option: NewWindowOption | undefined,
  options: { keepMenuOpen?: boolean; ascii?: AsciiOptions } = {},
): void {
  if (!option) return;
  if (option.id === HTML_CSS_LAYOUT_OPTION_ID) {
    toggleBuiltInWindow(HTML_CSS_LAYOUT_WINDOW_ID, options);
    return;
  }
  if (option.id === TERMINAL_OUTPUT_OPTION_ID) {
    toggleBuiltInWindow(TERMINAL_OUTPUT_WINDOW_ID, options);
    return;
  }
  if (option.id === TERMINAL_SHELL_OPTION_ID) {
    toggleBuiltInWindow(TERMINAL_SHELL_WINDOW_ID, options);
    return;
  }
  toggleVisualizationWindow(option, options);
}

function toggleBuiltInWindow(
  id: BuiltInWindowId,
  options: { keepMenuOpen?: boolean } = {},
): void {
  const keepMenuOpen = id === TERMINAL_SHELL_WINDOW_ID ? false : options.keepMenuOpen;
  if (windowManager.ids().includes(id)) {
    closeWindow(id);
    if (!keepMenuOpen) closeTopMenus();
    else topMenus.focus();
    return;
  }
  if (!keepMenuOpen) closeTopMenus();
  windowManager.restore(id);
  syncWindowSignalsFromManager();
  focus(id);
  if (id === TERMINAL_SHELL_WINDOW_ID && !terminalShell.running && terminalShell.status.peek() !== "starting") {
    void terminalShell.start().then((started) => {
      if (started) terminalShellInputMode.value = "raw";
      scheduleDraw();
    });
  }
  if (keepMenuOpen) topMenus.focus();
  pushLog(`add window ${windowTitle(id)}`);
}

function toggleVisualizationWindow(
  option: NewWindowOption | undefined,
  options: { keepMenuOpen?: boolean; ascii?: AsciiOptions } = {},
): void {
  if (!option) return;
  if (isVisualizationLoaded(option.id)) {
    closeWindow(visualizationWindowId(option.id));
    if (!options.keepMenuOpen) closeTopMenus();
    else topMenus.focus();
    return;
  }
  addVisualizationWindow(option, options);
}

function addVisualizationWindow(
  option: NewWindowOption | undefined,
  options: { keepMenuOpen?: boolean; ascii?: AsciiOptions } = {},
): void {
  if (!option) return;
  const id = visualizationWindowId(option.id);
  if (!options.keepMenuOpen) closeTopMenus();
  if (options.ascii) setAsciiForWindow(id, options.ascii);
  else asciiForWindow(id);
  if (!windowManager.ids({ includeClosed: true }).includes(id)) {
    dynamicVisualizationWindows.value = { ...dynamicVisualizationWindows.peek(), [id]: option.id };
    windowScrolls.set(id, new ScrollAreaController({ showScrollbar: true }));
    windowManager.windows.value = [
      ...windowManager.windows.peek(),
      {
        id,
        title: option.label,
        ...visualizationWindowMinimums(option),
        closable: true,
        order: windowManager.windows.peek().length,
      },
    ];
  } else {
    windowManager.restore(id);
  }
  focus(id);
  if (options.keepMenuOpen) topMenus.focus();
  pushLog(`add window ${option.label}`);
}

function isVisualizationLoaded(visualizationId: string): boolean {
  const id = visualizationWindowId(visualizationId);
  return windowManager.ids().includes(id);
}

function isNewWindowOptionLoaded(option: NewWindowOption): boolean {
  return isWorkbenchWindowOptionLoaded(option, windowManager.ids());
}

function newWindowMenuLabel(option: NewWindowOption): string {
  return workbenchWindowOptionMenuLabel(option, isNewWindowOptionLoaded(option));
}

function visualizationWindowMinimums(option: NewWindowOption): { minWidth: number; minHeight: number } {
  return workbenchWindowOptionMinimums(option);
}

function applyControlHit(
  id: ControlId,
  action: ControlHitAction,
  rect?: Rectangle,
  x?: number,
  index?: number,
): void {
  windowManager.focus("controls");
  syncWindowSignalsFromManager();
  activeControl.value = id;
  if (action === "focus") {
    pushLog(`control ${id} focus`);
    return;
  }
  if (id === "button") actionButton.press("mouse");
  else if (id === "genericButton") genericButton.press("mouse");
  else if (id === "modal") modalButton.press("mouse");
  else if (id === "slider") {
    if (action === "set" && rect && x !== undefined) setSliderFromPointer(density, rect, x);
    else action === "previous" ? density.decrement() : density.increment();
  } else if (id === "checkbox") index === 1 || action === "next" ? compactRows.toggle() : livePreview.toggle();
  else if (id === "radio") {
    if (index !== undefined) {
      modeRadio.setActive(index);
      modeRadio.selectActive();
    } else if (action === "previous") modeRadio.move(-1);
    else if (action === "next") modeRadio.move(1);
    else modeRadio.selectActive();
  } else if (id === "combo") {
    if (index !== undefined) {
      const selected = themeCombo.selectIndex(index);
      if (selected) setTheme(index);
    } else if (action === "previous") themeCombo.move(-1);
    else if (action === "next") themeCombo.move(1);
    else {
      const selected = themeCombo.selectActive();
      if (selected) setTheme(themeCombo.selectedIndex.peek() ?? 0);
    }
  } else if (id === "dropdown") {
    if (index !== undefined) dropdown.selectIndex(index);
    else if (action === "toggle") dropdown.toggle();
    else if (action === "previous") dropdown.move(-1);
    else if (action === "next") dropdown.move(1);
    else if (dropdown.expanded.peek()) dropdown.selectActive();
    else dropdown.open();
  } else if (id === "input") commandInput.submit();
  else if (id === "stepper") {
    if (index !== undefined) workflowStepper.setActive(index);
    else action === "previous" ? workflowStepper.move(-1) : workflowStepper.move(1);
  } else if (id === "textbox") notes.setText(`${notes.text.peek()}\nclicked`);
  progress.setValue(Math.min(100, progress.value.peek() + 7));
  pushLog(`control ${id} ${action}`);
}

function selectDataRow(index: number): void {
  windowManager.focus("data");
  syncWindowSignalsFromManager();
  table.select(index);
  const selected = table.selectedKey() ?? `${index}`;
  pushLog(`data row selected: ${selected}`);
}

function selectExplorerRow(index: number): void {
  windowManager.focus("explorer");
  syncWindowSignalsFromManager();
  explorer.tree.setSelectedIndex(index);
  const entry = explorer.selected();
  if (entry?.kind === "file") explorer.openActive();
  else if (entry?.kind === "directory") explorer.tree.toggleActive();
  pushLog(`explorer ${entry?.path ?? index}`);
}

function selectCpuHexTile(id: VisualizationWindowId, label: string): void {
  if (dynamicVisualizationWindows.peek()[id] !== "cpu-hex-grid") return;
  selectedCpuHexTiles.value = { ...selectedCpuHexTiles.peek(), [id]: label };
  windowManager.focus(id);
  syncWindowSignalsFromManager();
  ensureCpuHexTileVisible(id, label);
  const processes = processesForCpuLabel(label, systemMonitor.snapshot.peek()).slice(0, 3);
  const processLabel = processes.length > 0
    ? processes.map((process) => `${process.name}:${process.cpuPercent.toFixed(0)}%`).join(", ")
    : "no top process in sample";
  pushLog(`cpu ${label} selected: ${processLabel}`);
}

function processesForCpuLabel(label: string, system: SystemSnapshot) {
  const cpuId = Number(label);
  return Number.isFinite(cpuId)
    ? system.processes.filter((process) => process.processor === cpuId)
    : system.processes.filter((process) => String(process.processor) === label);
}

function ensureCpuHexTileVisible(id: VisualizationWindowId, label: string): void {
  const scroll = windowScrolls.get(id);
  if (!scroll) return;
  const system = systemMonitor.snapshot.peek();
  const tile = cpuHexTileLayout(
    system.cpuCores,
    Math.max(8, scroll.contentWidth.peek()),
    Math.max(4, scroll.viewportHeight.peek()),
  ).find((entry) => entry.label === label);
  if (!tile) return;

  const bodyHeaderRows = 2;
  const cpuHexSummaryRows = 2;
  const tileRow = bodyHeaderRows + cpuHexSummaryRows + tile.row;
  const offset = scroll.offset.peek();
  if (tileRow < offset.rows) {
    scroll.scrollTo(offset.columns, tileRow);
  } else if (tileRow >= offset.rows + scroll.viewportHeight.peek()) {
    scroll.scrollTo(offset.columns, tileRow - Math.max(0, scroll.viewportHeight.peek() - 1));
  }
}

function setSliderFromPointer(controller: SliderController, rect: Rectangle, x: number): void {
  const inspection = controller.inspect();
  const local = Math.max(0, Math.min(rect.width - 1, x - rect.column));
  const ratio = rect.width <= 1 ? 0 : local / (rect.width - 1);
  const raw = inspection.min + ratio * (inspection.max - inspection.min);
  const stepped = inspection.min + Math.round((raw - inspection.min) / inspection.step) * inspection.step;
  controller.setValue(stepped);
}

function handleControlsKey(event: { key: string; ctrl?: boolean; meta?: boolean; shift?: boolean }): void {
  const id = activeControl.peek();
  if (id === "input") {
    commandInput.handleKeyPress(event as never);
    return;
  }
  if (id === "textbox") {
    notes.handleKeyPress(event as never);
    return;
  }
  if (id === "dropdown" && dropdown.expanded.peek()) {
    if (event.key === "up") dropdown.move(-1);
    else if (event.key === "down") dropdown.move(1);
    else if (event.key === "home") dropdown.first();
    else if (event.key === "end") dropdown.last();
    else if (event.key === "escape") dropdown.close();
    else if (event.key === "return" || event.key === "space") dropdown.selectActive();
    else if (event.key === "left") applyControlHit(id, "previous");
    else if (event.key === "right") applyControlHit(id, "next");
    return;
  }
  if (id === "radio" && (event.key === "up" || event.key === "down")) {
    modeRadio.move(event.key === "up" ? -1 : 1);
    return;
  }
  if (event.key === "up") {
    activeControl.value = controlAt(-1);
    return;
  }
  if (event.key === "down") {
    activeControl.value = controlAt(1);
    return;
  }
  if (event.key === "left") {
    applyControlHit(id, "previous");
  } else if (event.key === "right") {
    applyControlHit(id, "next");
  } else if (event.key === "space" || event.key === "return") {
    applyControlHit(id, "activate");
  }
}

function blurTextControl(): void {
  const previous = activeControl.peek();
  windowManager.focus("controls");
  syncWindowSignalsFromManager();
  activeControl.value = controlAt(1);
  pushLog(`control ${previous} blur`);
}

function focusNextControl(delta = 1): void {
  windowManager.focus("controls");
  syncWindowSignalsFromManager();
  const next = controlAtEdge(delta);
  if (next) {
    activeControl.value = next;
    pushLog(`control ${activeControl.peek()} focus`);
    return;
  }
  delta < 0 ? focusPrevious() : focusNext();
}

function isTextControlActive(): boolean {
  return activeWindow.peek() === "controls" && (activeControl.peek() === "input" || activeControl.peek() === "textbox");
}

function controlAt(delta: number): ControlId {
  const ids: ControlId[] = [
    "button",
    "genericButton",
    "modal",
    "slider",
    "checkbox",
    "radio",
    "combo",
    "dropdown",
    "input",
    "stepper",
    "textbox",
  ];
  const index = ids.indexOf(activeControl.peek());
  return ids[(index + delta + ids.length) % ids.length]!;
}

function controlAtEdge(delta: number): ControlId | undefined {
  const ids: ControlId[] = [
    "button",
    "genericButton",
    "modal",
    "slider",
    "checkbox",
    "radio",
    "combo",
    "dropdown",
    "input",
    "stepper",
    "textbox",
  ];
  const index = ids.indexOf(activeControl.peek());
  const next = index + delta;
  return next < 0 || next >= ids.length ? undefined : ids[next];
}

function pushLog(message: string): void {
  commandLog.value = [...commandLog.peek(), `${new Date().toLocaleTimeString()} ${message}`].slice(-8);
}

function ensureLineObjects(): void {
  for (let row = lineSignals.length; row < currentHeight(); row += 1) {
    const signal = new Signal("");
    const rowIndex = row;
    lineSignals.push(signal);
    new TextObject({
      canvas: tui.canvas,
      rectangle: new Computed<TextRectangle>(() => ({ column: 0, row: rowIndex, width: currentWidth() })),
      value: signal,
      overwriteRectangle: true,
      multiCodePointSupport: true,
      style: new Computed(() => makeStyle({ fg: theme().text, bg: theme().background })),
      zIndex: 2,
    }).draw();
  }
}

type RowStyle = { text: string; fg?: string; bg?: string; bold?: boolean };

function writeRows(frame: Frame, rect: Rectangle, rows: RowStyle[]): void {
  const t = theme();
  for (let index = 0; index < Math.min(rect.height, rows.length); index += 1) {
    const row = rows[index]!;
    write(
      frame,
      rect.row + index,
      rect.column,
      paint(fit(row.text, rect.width), {
        fg: row.fg ?? t.text,
        bg: row.bg ?? t.surface,
        bold: row.bold,
      }),
    );
  }
}

function write(frame: Frame, row: number, column: number, value: string): void {
  writeFrame(frame, currentWidth(), row, column, value);
}

function fillRow(frame: Frame, row: number, bg: string): void {
  fillFrameRow(frame, currentWidth(), row, makeStyle({ bg }));
}

function fillRect(frame: Frame, rect: Rectangle, bg: string): void {
  fillFrameRect(frame, currentWidth(), rect, makeStyle({ bg }));
}

function maxTextWidth(values: readonly string[]): number {
  return values.reduce((max, value) => Math.max(max, textWidth(value)), 0);
}

function maxTrimmedTextWidth(values: readonly string[]): number {
  return values.reduce((max, value) => Math.max(max, textWidth(value.trimEnd())), 0);
}

function visibleMenuSlice(
  items: string[],
  selectedIndex: number,
  maxItems: number,
): { items: string[]; indexes: number[] } {
  const count = Math.max(1, maxItems);
  if (items.length <= count) {
    return { items, indexes: items.map((_, index) => index) };
  }
  const start = Math.max(0, Math.min(selectedIndex - Math.floor(count / 2), items.length - count));
  return {
    items: items.slice(start, start + count),
    indexes: Array.from({ length: count }, (_, index) => start + index),
  };
}

function threeHeaderRows(mode: string, width: number, t: ThemeSpec): RowStyle[] {
  const title = compactSpaces(`ACEROLA THREE.JS ASCII · ${mode} · STUDIO GEOMETRY`);
  const compactTitle = compactSpaces(`THREE ASCII · ${mode}`);
  const geometry = "torus knot · sphere · block · floor plane";
  const compactGeometry = "torus · sphere · block · floor";
  const titleText = width >= textWidth(` ${title} `) ? ` ${title} ` : ` ${compactTitle} `;
  const detailText = width >= textWidth(geometry) ? geometry : compactGeometry;
  return [
    {
      text: titleText,
      fg: t.buttonActiveText,
      bg: t.buttonActiveBg,
      bold: true,
    },
    { text: detailText, fg: t.soft, bg: t.surface },
    { text: "", bg: t.surface },
  ];
}

function dataFooterRows(
  page: number,
  pageCount: number,
  selectedKey: string | undefined,
  width: number,
  t: ThemeSpec,
): RowStyle[] {
  const selected = selectedKey ?? "-";
  const full = compactSpaces(`page ${page}/${pageCount}  selected ${selected}  arrows/page keys  S sort`);
  const rows = textWidth(full) <= width
    ? [full]
    : wrapPlain(`page ${page}/${pageCount} selected ${selected} arrows/page keys S sort`, width);
  return rows.map((text) => ({ text, fg: t.muted, bg: t.panelSoft }));
}

function wrapPlain(value: string, width: number): string[] {
  const safeWidth = Math.max(1, width);
  const words = stripStyles(value).replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  if (words.length === 0) return [""];
  const rows: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line.length > 0 ? `${line} ${word}` : word;
    if (textWidth(next) <= safeWidth) {
      line = next;
      continue;
    }
    if (line.length > 0) rows.push(line);
    line = textWidth(word) <= safeWidth ? word : fit(word, safeWidth).trimEnd();
  }
  if (line.length > 0) rows.push(line);
  return rows;
}

function compactSpaces(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function paint(text: string, options: { fg?: string; bg?: string; bold?: boolean } = {}): string {
  return makeStyle({ fg: options.fg ?? theme().text, bg: options.bg, bold: options.bold })(text);
}

function writeButton(
  frame: Frame,
  row: number,
  column: number,
  label: string,
  options: {
    state?: "base" | "active" | "disabled";
    tone?: ButtonTone;
    compact?: boolean;
    maxWidth?: number;
  } = {},
): number {
  const text = buttonText(label, { compact: options.compact });
  const width = Math.max(0, Math.min(textWidth(text), options.maxWidth ?? textWidth(text)));
  if (width <= 0) return 0;
  write(
    frame,
    row,
    column,
    paint(fit(text, width), buttonPaintOptions(theme(), options.state ?? "base", options.tone ?? "default")),
  );
  return width;
}

function buttonPaintOptions(
  t: ThemeSpec,
  state: "base" | "active" | "disabled" = "base",
  tone: ButtonTone = "default",
): { fg: string; bg: string; bold: boolean } {
  if (state === "disabled") {
    return { fg: t.buttonMutedText, bg: t.buttonMutedBg, bold: false };
  }
  const toneBg = tone === "danger"
    ? t.danger
    : tone === "warning"
    ? t.warn
    : tone === "success"
    ? t.good
    : tone === "muted"
    ? t.border
    : undefined;
  if (toneBg) {
    return { fg: contrastText(toneBg, t.background, t.text), bg: toneBg, bold: true };
  }
  if (state === "active") {
    return {
      fg: contrastText(t.buttonActiveBg, t.background, t.text),
      bg: t.buttonActiveBg,
      bold: true,
    };
  }
  return { fg: contrastText(t.buttonBg, t.background, t.text), bg: t.buttonBg, bold: true };
}

function addHit(rect: Rectangle, action: HitAction): void {
  hitTargets.add(rect, action);
}

function findHit(x: number, y: number): { rect: Rectangle; action: HitAction } | undefined {
  return hitTargets.find(x, y);
}

function windowTitle(id: WindowId): string {
  if (isVisualizationWindow(id)) {
    return visualizationOption(dynamicVisualizationWindows.peek()[id])?.label ?? "Visualization";
  }
  return id === "explorer"
    ? "Explorer"
    : id === "inspector"
    ? "Inspector"
    : id === "data"
    ? "Data Table"
    : id === "controls"
    ? "Controls"
    : id === "logs"
    ? "Logs"
    : id === "htmlLayout"
    ? "HTML/CSS Layout"
    : id === TERMINAL_OUTPUT_WINDOW_ID
    ? terminalOutputWindowTitle()
    : id === TERMINAL_SHELL_WINDOW_ID
    ? terminalShellWindowTitle()
    : "Three ASCII";
}

function terminalOutputWindowTitle(): string {
  const mode = terminalInputMode.peek() === "raw" ? "RAW" : "WB";
  return `Terminal Output ${mode} ${terminalOutputSession.status.peek().toUpperCase()}`;
}

function terminalShellWindowTitle(): string {
  const mode = terminalShellInputMode.peek() === "raw" ? "RAW" : "WB";
  return formatTerminalShellWindowTitle(terminalShell.inspect(), { mode });
}

function windowIds(): WindowId[] {
  return windowManager.ids().map((id) => id as WindowId);
}

function isVisualizationWindow(id: WindowId): id is VisualizationWindowId {
  return isWorkbenchVisualizationWindowId(id);
}

function visualizationWindowId(visualizationId: string): VisualizationWindowId {
  return workbenchVisualizationWindowId(visualizationId) as VisualizationWindowId;
}

function visualizationOption(visualizationId: string | undefined): NewWindowOption | undefined {
  return visualizationId ? visualizationWindowOptions.find((entry) => entry.id === visualizationId) : undefined;
}

function accentColor(accent: Accent): string {
  const t = theme();
  return accent === "alarm"
    ? t.danger
    : accent === "amber"
    ? t.warn
    : accent === "phosphor"
    ? t.good
    : accent === "violet"
    ? t.borderStrong
    : t.accent;
}

function theme(): ThemeSpec {
  return themes[themeIndex.value] ?? themes[0]!;
}

function currentWidth(): number {
  return Math.max(1, tui.rectangle.value.width);
}

function currentHeight(): number {
  return Math.max(1, tui.rectangle.value.height);
}

function syncTerminalSize(): boolean {
  try {
    const { columns, rows } = Deno.consoleSize();
    const size = tui.canvas.size.peek();
    if (size.columns === columns && size.rows === rows) return false;
    size.columns = columns;
    size.rows = rows;
    ensureLineObjects();
    return true;
  } catch {
    return false;
  }
}
