import { BoxObject } from "../src/canvas/box.ts";
import { TextObject, type TextRectangle } from "../src/canvas/text.ts";
import { ButtonController } from "../src/components/button.ts";
import { CheckBoxController, renderCheckBoxMark } from "../src/components/checkbox.ts";
import { ComboBoxController } from "../src/components/combobox.ts";
import { DataTableController, renderDataTableHeader, renderDataTableRowsInto } from "../src/components/data_table.ts";
import { createFileExplorerTree, FileExplorerController } from "../src/components/file_explorer.ts";
import { InputController } from "../src/components/input.ts";
import { MenuBarController, renderMenuBar } from "../src/components/menu_bar.ts";
import { modalContentHeight, ModalController, renderModalRows } from "../src/components/modal.ts";
import { ProgressBarController } from "../src/components/progressbar.ts";
import { RadioGroupController } from "../src/components/radio_group.ts";
import { ScrollAreaController, scrollbarOffsetForPointer } from "../src/components/scroll_area.ts";
import { SliderController } from "../src/components/slider.ts";
import { renderStatusBar } from "../src/components/statusbar.ts";
import { renderStepper, StepperController } from "../src/components/stepper.ts";
import { formatTerminalOutputLine } from "../src/components/terminal_output.ts";
import { TextBoxController, wrapTextBoxLines } from "../src/components/textbox.ts";
import {
  appendBoundedWorkbenchLogRow,
  buttonText,
  centerCellText as centerText,
  clampWorkbenchTileDensity,
  clipRect,
  contrastText,
  createWorkbenchVisualizationWindowOptions,
  deleteWorkbenchWorkspace,
  fillFrameRect,
  fillFrameRow,
  findWorkbenchWorkspace,
  fitCellText as fit,
  formatWorkbenchDiagnosticStatus,
  HitTargetStack,
  initialWorkbenchDiagnosticLogRows,
  inset,
  intersects,
  isWorkbenchMenuActivationKey,
  isWorkbenchVisualizationWindowId,
  layoutWorkbenchMenuBarHits,
  layoutWorkbenchModal,
  layoutWorkbenchPopover,
  layoutWorkbenchShelf,
  layoutWorkbenchTabs,
  layoutWorkbenchTitlebar,
  layoutWorkbenchTopMenuItemRect,
  maxTextWidthBy,
  normalizeWorkbenchWorkspaceName,
  normalizeWorkbenchWorkspaceStorage,
  prepareWorkbenchFrame,
  renameWorkbenchWorkspace,
  renderFrameRow,
  renderFrameSlice,
  serializeWorkbenchWorkspaces,
  subscribeWorkbenchDiagnosticLog,
  translateHitTargets,
  upsertWorkbenchWorkspace,
  workbenchAdaptiveTileOptions,
  workbenchContentViewport,
  type WorkbenchFrame,
  workbenchHorizontalScrollbarCellsInto,
  workbenchShelfEntriesInto,
  workbenchStatusLeft,
  workbenchTabEntriesInto,
  type WorkbenchTitlebarButtonKind,
  workbenchVerticalScrollbarCellsInto,
  workbenchVerticalScrollbarRect,
  workbenchVisualizationIdFromWindowId,
  workbenchVisualizationWindowId,
  workbenchWindowLayout,
  type WorkbenchWindowOption,
  workbenchWindowOptionMenuLabelsInto,
  workbenchWindowOptionMinimums,
  workbenchWindowScrollbarRects,
  type WorkbenchWorkspace,
  WorkbenchWorkspaceViewportController,
  type WorkbenchWorkspaceWindow,
  workbenchWorkspaceWindowEntries,
  writeFrame,
} from "../src/app/workbench/mod.ts";
import { WorkbenchController } from "../src/app/workbench/controller.ts";
import {
  createDefaultWorkbenchAsciiOptions,
  defaultWorkbenchAsciiConfigRows,
  formatWorkbenchAsciiConfigRowText,
  stepWorkbenchAsciiGlyphStyle,
  stepWorkbenchAsciiNumericOption,
  stepWorkbenchAsciiPreset,
  toggleWorkbenchAsciiOption,
  WorkbenchAsciiConfigController,
  type WorkbenchAsciiConfigRow,
  type WorkbenchAsciiKittyKey,
  type WorkbenchAsciiNumericKey,
  type WorkbenchAsciiToggleKey,
} from "../src/app/workbench_ascii.ts";
import { handleInput } from "../src/input.ts";
import type { KeyPressEvent, MousePressEvent, MouseScrollEvent, PasteEvent } from "../src/input_reader/types.ts";
import {
  routeTerminalKeyPress,
  routeTerminalMouse,
  routeTerminalPaste,
  type TerminalInputMode,
  terminalMouseRoutingFromPrivateModes,
} from "../src/app/terminal_input.ts";
import { DiagnosticsCollector } from "../src/runtime/diagnostics.ts";
import { formatProcessCommandLine, ProcessSessionController } from "../src/runtime/process_session.ts";
import { MicrotaskScheduler } from "../src/runtime/render_loop.ts";
import { type AsyncStore, createRuntimeStore, JsonFileStore } from "../src/runtime/storage.ts";
import { createStorageFallbackDiagnostic } from "../src/runtime/storage_diagnostics.ts";
import { type TerminalBackend } from "../src/runtime/terminal_backend.ts";
import { TerminalShellController } from "../src/runtime/terminal_shell.ts";
import {
  formatTerminalShellWindowTitle,
  summarizeTerminalStatus,
  terminalBackendKindLabel,
} from "../src/runtime/terminal_status.ts";
import { terminalCellStyle, terminalOutputLineStyle } from "../src/app/workbench_terminal_style.ts";
import { Computed, Signal } from "../src/signals/mod.ts";
import { probeCompatibleWebGPUDevice } from "../src/three_ascii/webgpu_compat.ts";
import { Tui } from "../src/tui.ts";
import type { Rectangle } from "../src/types.ts";
import { stripStyles, textWidth } from "../src/utils/strings.ts";
import { workbenchButtonPaintOptions } from "../src/app/workbench_button_style.ts";
import {
  layoutWorkbenchControlButtonLine,
  layoutWrappedControlOptions,
  wrappedControlOptionRowCount,
} from "../src/app/workbench_control_layout.ts";
import {
  compactSpaces,
  maxTextWidth,
  type VisibleMenuSlice,
  visibleMenuSliceInto,
  wrapPlainText,
} from "../src/app/workbench_text.ts";
import { resolveWorkbenchShellBackend } from "../src/app/workbench_terminal.ts";
import { AudioRegistry } from "./audio.ts";
import {
  apiWorkbenchColumns,
  apiWorkbenchDocs,
  apiWorkbenchLiveRowsInto,
  apiWorkbenchPanelTitle,
  type ApiWorkbenchProcessRow,
  apiWorkbenchRows,
  type ApiWorkbenchThemeSpec,
  createApiWorkbenchThemes,
} from "./api_workbench_catalog.ts";
import {
  type ApiWorkbenchControlId,
  nextApiWorkbenchControlId,
  nextSortableDataColumn,
} from "./api_workbench_controls.ts";
import {
  createHtmlCssLayoutDemo,
  HTML_CSS_LAYOUT_OPTION_ID,
  HTML_CSS_LAYOUT_WINDOW_ID,
  htmlCssLayoutDemoBoxLabel,
} from "../src/markup/demo_fixtures.ts";
import { htmlCssLayoutBoxStyle, htmlCssVisibleLayoutBoxesInto } from "./html_css_layout_view.ts";
import {
  ASCII_DEMO_PRESETS,
  asciiDemoPresetIds,
  asciiPresetLabel,
  cloneAsciiOptions,
  formatAsciiControlValue,
  normalizeAsciiOptions,
  terminalGlyphStyleLabel,
} from "./ascii_options.ts";
import { getSourceFrame } from "./sources.ts";
import { makeStyle } from "./styles.ts";
import { SystemMonitor } from "./system_metrics.ts";
import { requireInteractiveTerminal } from "./terminal_guard.ts";
import { ThreePanelFrameView } from "./three_panel.ts";
import {
  threeRendererModeLabel,
  visualizationTextContentSize,
  visualizationThreeStatusLine,
  visualizationWindowRowsInto,
} from "./workbench_visualization_window.ts";
import {
  buildWorkspaceMenuEntries,
  currentWorkspaceVisualizationIds as workspaceVisualizationIdsFromWindows,
  defaultWorkspaceName as defaultWorkspaceNameFromCount,
  normalizeWorkspaceName as normalizeWorkspaceNameFromCount,
  type WorkspaceMenuEntry,
  workspaceMenuLabelsInto,
  workspaceNameModalBody as buildWorkspaceNameModalBody,
} from "./workbench_workspace_menu.ts";
import { WorkbenchKittyGraphicsController } from "./workbench_kitty_graphics.ts";
import { dataFooterRows, type RowStyle, threeHeaderRows } from "./workbench_rows.ts";
import type {
  Accent,
  AsciiOptions,
  PanelRender,
  ProcessSnapshot,
  RenderContext,
  SlotConfig,
  SourceFrame,
  SystemSnapshot,
  ThreeSceneMode,
  ThreeSceneSignal,
} from "./types.ts";
import { cpuHexGridColumnCount, cpuHexTileLayout, renderVisualization, visualizations } from "./visualizations.ts";
import {
  monitorSourceIds,
  monitorSourceIdsInto,
  syntheticWorkbenchSources,
  syntheticWorkbenchSystem,
} from "./workbench_synthetic.ts";
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
type ControlId = ApiWorkbenchControlId;
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
  | { type: "terminalShellContent" }
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
type AsciiNumericKey = WorkbenchAsciiNumericKey;
type AsciiToggleKey = WorkbenchAsciiToggleKey;
type AsciiKittyKey = WorkbenchAsciiKittyKey;

type ThemeSpec = ApiWorkbenchThemeSpec;
type ProcessRow = ApiWorkbenchProcessRow;

type NewWindowOption = WorkbenchWindowOption;

type SavedWorkspace = WorkbenchWorkspace<AsciiOptions>;
type SavedWorkspaceWindow = WorkbenchWorkspaceWindow<AsciiOptions>;

type WorkspaceNameMode = "save" | "rename";
const themes: ThemeSpec[] = createApiWorkbenchThemes();
const themeLabels = themes.map((entry) => entry.label);
const themeMenuWidth = Math.max(20, maxTextWidth(themeLabels) + 6);
const rows: ProcessRow[] = apiWorkbenchRows;
const liveRowsBuffer: ProcessRow[] = [];
const columns = apiWorkbenchColumns;
const docs = apiWorkbenchDocs;
const htmlCssLayoutBoxes: ComputedLayoutBox[] = [];
const dataTableTextRows: string[] = [];
const dataTableBodyRows: RowStyle[] = [];
const dataTableRenderRows: RowStyle[] = [];
const explorerRenderRows: RowStyle[] = [];
const inspectorRenderRows: RowStyle[] = [];
const inspectorActionTextRows: string[] = [];
const visualizationTextRows: string[] = [];
const visualizationRenderRows: RowStyle[] = [];
const threeFallbackRowsBuffer: RowStyle[] = [];
const logRenderRows: RowStyle[] = [];
const THREE_FALLBACK_BODY: readonly string[] = [
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
const ASCII_DEMO_PRESET_IDS = asciiDemoPresetIds();
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
const visualizationWindowOptionIds = new Array<string>(visualizationWindowOptions.length);
const visualizationWindowOptionById = new Map<string, NewWindowOption>();
for (let index = 0; index < visualizationWindowOptions.length; index += 1) {
  const option = visualizationWindowOptions[index]!;
  visualizationWindowOptionIds[index] = option.id;
  visualizationWindowOptionById.set(option.id, option);
}
const newWindowOptions: NewWindowOption[] = [
  terminalShellWindowOption,
  terminalOutputWindowOption,
  htmlCssLayoutWindowOption,
  ...visualizationWindowOptions,
];
const WORKSPACE_STORE_KEY = "api-workbench.workspaces";

requireInteractiveTerminal("deno task api-workbench");

const workbenchDiagnostics = new DiagnosticsCollector(120);
const systemMonitor = new SystemMonitor({ historyLength: 72, diagnostics: workbenchDiagnostics });
await systemMonitor.start(1000);
const workbenchAudioRegistry = new AudioRegistry([]);
const workspaceStore = createWorkspaceStore();
const savedWorkspaces = new Signal<SavedWorkspace[]>(await loadSavedWorkspaces(), { deepObserve: true });
const threeAsciiAvailable = new Signal(await probeCompatibleWebGPUDevice());
const asciiConfigs = new WorkbenchAsciiConfigController<WindowId>("three");
const ascii = asciiConfigs.root;

const tui = new Tui({
  style: makeStyle({ bg: themes[0]!.background }),
  refreshRate: 1000 / 24,
  enableMouse: true,
});
const kittyTextEncoder = new TextEncoder();
const kittyGraphics = await WorkbenchKittyGraphicsController.create({
  writer: {
    write: (data) => {
      tui.stdout.writeSync(kittyTextEncoder.encode(data));
    },
  },
  diagnostics: workbenchDiagnostics,
});
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
  diagnostics: workbenchDiagnostics,
});
const terminalInputMode = new Signal<TerminalInputMode>("workbench");
const terminalShell = new TerminalShellController({
  backendFactory: createWorkbenchShellBackend,
  columns: 80,
  rows: 24,
  scrollbackLimit: 2000,
  diagnostics: workbenchDiagnostics,
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
const workbenchController = new WorkbenchController<"theme" | "newWindow" | "workspace">({
  activeId: "inspector",
  menu: { onChange: syncTopMenuState },
  windows: [
    { id: "explorer", title: apiWorkbenchPanelTitle("explorer"), minWidth: 26, minHeight: 12 },
    { id: "inspector", title: apiWorkbenchPanelTitle("inspector"), minWidth: 32, minHeight: 11 },
    { id: "data", title: apiWorkbenchPanelTitle("data"), minWidth: 42, minHeight: 12 },
    { id: "controls", title: apiWorkbenchPanelTitle("controls"), minWidth: 40, minHeight: 18 },
    { id: "logs", title: apiWorkbenchPanelTitle("logs"), minWidth: 36, minHeight: 12 },
    { id: "three", title: apiWorkbenchPanelTitle("three"), minWidth: 42, minHeight: 16 },
    {
      id: HTML_CSS_LAYOUT_WINDOW_ID,
      title: apiWorkbenchPanelTitle(HTML_CSS_LAYOUT_WINDOW_ID),
      minWidth: 46,
      minHeight: 16,
      state: "closed",
    },
    { id: TERMINAL_OUTPUT_WINDOW_ID, title: "Terminal Output", minWidth: 48, minHeight: 14, state: "closed" },
    { id: TERMINAL_SHELL_WINDOW_ID, title: "Shell", minWidth: 54, minHeight: 16, state: "closed" },
  ],
});
const topMenus = workbenchController.menus;
const windowManager = workbenchController.windows;
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
const commandLog = new Signal<string[]>(
  initialWorkbenchDiagnosticLogRows(workbenchDiagnostics, ["ready: API workbench mounted"], { maxLogEntries: 8 }),
  { deepObserve: true },
);
const unsubscribeWorkbenchDiagnostics = subscribeWorkbenchDiagnosticLog(workbenchDiagnostics, (message) => {
  pushLog(message);
  scheduleDraw();
});
const dynamicVisualizationWindows = new Signal<Record<VisualizationWindowId, string>>({}, { deepObserve: true });
const selectedCpuHexTiles = new Signal<Record<VisualizationWindowId, string>>({}, { deepObserve: true });
const lineSignals: Signal<string>[] = [];
const hitTargets = new HitTargetStack<HitAction>();
const screenFrame: Frame = [];
const workspaceVirtualFrame: Frame = [];
const windowContentFrames = new Map<WindowId, Frame>();
const newWindowMenuSlice: VisibleMenuSlice = { items: [], indexes: [] };
const newWindowMenuLabels: string[] = [];
const workspaceMenuSlice: VisibleMenuSlice = { items: [], indexes: [] };
const workspaceMenuLabelBuffer: string[] = [];
const realSourceIdBuffer: string[] = [];
const minimizedShelfEntries: Array<{ id: WindowId; title: string }> = [];
const fullscreenTabEntries: Array<{ id: WindowId; title: string; selected?: boolean; hidden?: boolean }> = [];
const verticalScrollbarCells: Array<{ column: number; row: number; glyph: string }> = [];
const horizontalScrollbarCells: Array<{ column: number; row: number; glyph: string }> = [];
let dropdownOverlay: DropdownOverlay | null = null;
let threeDragWindow: WindowId | null = null;
let windowRenderContext: WindowRenderContext | null = null;
let workspacePlacementContext: WorkspacePlacementContext | null = null;
const drawScheduler = new MicrotaskScheduler();
const renderedVisualizationThreePanels = new Set<VisualizationWindowId>();
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
      workbenchController.toggleMenu("newWindow", newWindowOptions.length);
      newWindowMenuIndex.value = workbenchController.menuIndex("newWindow");
      pushLog(`${newWindowMenuOpen.peek() ? "open" : "close"} new window menu`);
      return;
    }
    if (item.id === "theme") {
      topMenus.toggle("theme");
      pushLog(`${themeMenuOpen.peek() ? "open" : "close"} theme menu`);
      return;
    }
    if (item.id === "workspace") {
      workbenchController.toggleMenu("workspace", workspaceMenuItemCount());
      workspaceMenuIndex.value = workbenchController.menuIndex("workspace");
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
const workspaceViewport = new WorkbenchWorkspaceViewportController<WindowId>({ scroll: workspaceScroll });
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
  items: themeLabels,
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
  graphicsSurface: () => kittyGraphics.surfaceFor(ascii.peek()),
  frameInterval: 1000 / 18,
  diagnostics: workbenchDiagnostics,
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
  const shellHit = findHit(event.x, event.y);
  if (shellHit?.action.type === "terminalShellContent" && handleTerminalShellMouse(event, shellHit.rect)) {
    draw();
    return;
  }
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
  const shellHit = findHit(event.x, event.y);
  if (shellHit?.action.type === "terminalShellContent" && handleTerminalShellMouse(event, shellHit.rect)) {
    draw();
    return;
  }
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
    table.rows.value = apiWorkbenchLiveRowsInto(liveRowsBuffer, rows, density.value.peek(), 17);
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
  void kittyGraphics.clear("visible");
  void terminalOutputSession.dispose();
  void terminalShell.dispose();
  terminalInputMode.dispose();
  terminalShellInputMode.dispose();
  unsubscribeWorkbenchDiagnostics();
  systemMonitor.stop();
  workbenchAudioRegistry.dispose();
  asciiConfigs.dispose();
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
  const frame = prepareWorkbenchFrame(screenFrame, height);
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
      themeMenuWidth,
      themes.length + 2,
    );
    dropdownOverlay = {
      kind: "theme",
      coordinate: "screen",
      rect: themeRect,
      items: themeLabels,
      selectedIndex: themeIndex.peek(),
    };
  }
  if (newWindowMenuOpen.peek()) {
    const labels = workbenchWindowOptionMenuLabelsInto(newWindowMenuLabels, newWindowOptions, windowManager.ids());
    const visible = visibleMenuSliceInto(
      newWindowMenuSlice,
      labels,
      newWindowMenuIndex.peek(),
      Math.max(6, currentHeight() - 5),
    );
    const menuRect = menuItemRect(
      menuStart,
      "new",
      Math.max(28, maxTextWidth(labels) + 6),
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
    const visible = visibleMenuSliceInto(
      workspaceMenuSlice,
      labels,
      workspaceMenuIndex.peek(),
      Math.max(6, currentHeight() - 5),
    );
    const menuRect = menuItemRect(
      menuStart,
      "workspace",
      Math.max(30, maxTextWidth(labels) + 6),
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
  for (
    const hit of layoutWorkbenchMenuBarHits({
      column,
      row,
      width,
      items: menu.items.peek(),
      activeIndex: menu.activeIndex.peek(),
      measureText: textWidth,
    })
  ) {
    addHit(hit.rect, { type: "menu", index: hit.index });
  }
}

function menuItemRect(menuStart: number, itemId: string, preferredWidth: number, preferredHeight: number): Rectangle {
  return layoutWorkbenchTopMenuItemRect({
    menuStart,
    itemId,
    items: menu.items.peek(),
    activeIndex: menu.activeIndex.peek(),
    preferredWidth,
    preferredHeight,
    maxWidth: currentWidth(),
    measureText: textWidth,
  });
}

function renderWorkspace(frame: Frame): void {
  const bounds = { column: 0, row: 3, width: currentWidth(), height: Math.max(0, currentHeight() - 5) };
  fillRect(frame, bounds, theme().backgroundSoft);
  renderedVisualizationThreePanels.clear();
  if (bounds.width < 2 || bounds.height < 1) {
    setThreeBodyRect({ column: 0, row: 0, width: 0, height: 0 });
    setThreeGraphicsRect({ column: 0, row: 0, width: 0, height: 0 });
    hideVisualizationThreePanelsExcept(renderedVisualizationThreePanels);
    return;
  }
  const layout = workspaceLayout({ column: 0, row: 0, width: Math.max(1, bounds.width - 1), height: bounds.height });
  const offset = workspaceViewport.update({ layout, viewportHeight: bounds.height, activeId: activeWindow.peek() });
  const virtual = prepareWorkbenchFrame(workspaceVirtualFrame, Math.max(bounds.height, layout.contentHeight));
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
    translateHitTargets(hitTargets, { startIndex: hitStart, rowDelta: bounds.row - offset, clip: bounds });
    blitWorkspace(frame, virtual, bounds, offset, layout.bounds.width);
    renderWorkspaceScrollbar(frame, bounds);
    renderWindowTabs(frame);
    return;
  }

  if (layout.rects.size === 0) {
    setThreeBodyRect({ column: 0, row: 0, width: 0, height: 0 });
    setThreeGraphicsRect({ column: 0, row: 0, width: 0, height: 0 });
    hideVisualizationThreePanelsExcept(renderedVisualizationThreePanels);
    write(frame, bounds.row + 1, 2, paint(emptyWorkspaceMessage(), { fg: theme().warn }));
    renderShelf(frame);
    return;
  }

  let renderedThree = false;
  withWorkspacePlacement(bounds, offset, () => {
    for (const [id, rect] of layout.rects) {
      renderWindow(virtual, id, rect);
      if (id === "three") {
        renderedThree = true;
      }
    }
  });
  if (!renderedThree) {
    setThreeBodyRect({ column: 0, row: 0, width: 0, height: 0 });
    setThreeGraphicsRect({ column: 0, row: 0, width: 0, height: 0 });
  }
  hideVisualizationThreePanelsExcept(renderedVisualizationThreePanels);
  translateHitTargets(hitTargets, { startIndex: hitStart, rowDelta: bounds.row - offset, clip: bounds });
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
  const contentFrame = windowContentFrame(id, contentSize.height);
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

function windowContentFrame(id: WindowId, rows: number): Frame {
  let frame = windowContentFrames.get(id);
  if (!frame) {
    frame = [];
    windowContentFrames.set(id, frame);
  }
  return prepareWorkbenchFrame(frame, rows);
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
  const rows = visualizationWindowRowsInto(visualizationTextRows, option, rendered);
  visualizationRenderRows.length = rows.length;
  for (let index = 0; index < rows.length; index += 1) {
    if (index === 0) {
      visualizationRenderRows[index] = {
        text: rows[index]!,
        fg: contrastText(accent, t.background, t.text),
        bg: accent,
        bold: true,
      };
    } else if (index === 1) {
      visualizationRenderRows[index] = {
        text: rows[index]!,
        fg: rendered.severity === "alarm" ? t.danger : rendered.severity === "warning" ? t.warn : t.soft,
        bg: t.surface,
        bold: rendered.severity !== "info",
      };
    } else if (index === rows.length - 1) {
      visualizationRenderRows[index] = { text: rows[index]!, fg: t.muted, bg: t.panelSoft };
    } else {
      const bodyIndex = index - 2;
      visualizationRenderRows[index] = {
        text: rows[index]!,
        fg: bodyIndex % 3 === 0 ? accent : bodyIndex % 3 === 1 ? t.text : t.soft,
        bg: t.surface,
        bold: bodyIndex === 0,
      };
    }
  }
  writeRows(frame, rect, visualizationRenderRows);
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
  const fallback = renderThreeFallbackInto(threeFallbackRowsBuffer, rect.width, rect.height, t);
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

function renderThreeFallbackInto(target: RowStyle[], width: number, height: number, t: ThemeSpec): RowStyle[] {
  const title = ` THREE ASCII FALLBACK · ${terminalGlyphStyleLabel(ascii.peek().terminalGlyphStyle).toUpperCase()} `;
  target.length = 0;
  target.push(
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
  );
  const bodyRows = Math.min(THREE_FALLBACK_BODY.length, Math.max(0, height - 5));
  for (let index = 0; index < bodyRows; index += 1) {
    target.push({
      text: centerText(THREE_FALLBACK_BODY[index]!, width),
      fg: index % 3 === 0 ? t.accent : index % 3 === 1 ? t.good : t.warn,
      bg: t.surface,
      bold: true,
    });
  }
  target.push({ text: "scene: torus knot + sphere + box + floor", fg: t.soft, bg: t.surface });
  return target;
}

function renderExplorer(frame: Frame, rect: Rectangle): void {
  const t = theme();
  const visible = explorer.tree.visibleRows();
  const selectedIndex = explorer.tree.selectedIndex.peek();
  explorerRenderRows.length = visible.length;
  for (let index = 0; index < visible.length; index += 1) {
    const row = visible[index]!;
    const selected = row.index === selectedIndex;
    const node = row.node as { kind?: string; path?: string };
    const icon = row.hasChildren ? row.expanded ? "▾" : "▸" : node.kind === "file" ? "·" : " ";
    const label = `${"  ".repeat(row.depth)}${icon} ${row.label}`;
    explorerRenderRows[index] = {
      text: label,
      fg: selected ? contrastText(t.warn, t.background, t.text) : node.kind === "directory" ? t.good : t.text,
      bg: selected ? t.warn : t.surface,
      bold: selected || node.kind === "directory",
    };
  }
  writeRows(frame, rect, explorerRenderRows);
  for (let index = 0; index < visible.length; index += 1) {
    addHit({ column: rect.column, row: rect.row + index, width: rect.width, height: 1 }, {
      type: "explorerRow",
      index,
    });
  }
}

function renderInspector(frame: Frame, rect: Rectangle): void {
  const t = theme();
  inspectorRenderRows.length = 0;
  inspectorRenderRows.push(
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
  );
  const availableActionRows = Math.max(0, rect.height - inspectorRenderRows.length);
  inspectorActionTextRows.length = 0;
  if (availableActionRows > 0) {
    const logs = commandLog.peek();
    const start = Math.max(0, logs.length - Math.max(4, availableActionRows));
    for (let index = start; index < logs.length; index += 1) {
      const wrapped = wrapPlainText(`• ${logs[index]!}`, rect.width, fit);
      for (let row = 0; row < wrapped.length; row += 1) {
        inspectorActionTextRows.push(wrapped[row]!);
      }
    }
    const firstActionRow = Math.max(0, inspectorActionTextRows.length - availableActionRows);
    for (let index = firstActionRow; index < inspectorActionTextRows.length; index += 1) {
      inspectorRenderRows.push({
        text: inspectorActionTextRows[index]!,
        fg: t.text,
        bg: t.panelSoft,
      });
    }
  }
  writeRows(frame, rect, inspectorRenderRows);
}

function renderData(frame: Frame, rect: Rectangle): void {
  const t = theme();
  const pendingView = table.view.peek();
  const footerRows = dataFooterRows({
    page: pendingView.page + 1,
    pageCount: pendingView.pageCount,
    selectedKey: pendingView.selectedKey,
    width: rect.width,
    theme: t,
    fit,
  });
  table.setPageSize(Math.max(1, rect.height - 2 - footerRows.length));
  const view = table.view.peek();
  const textRows = renderDataTableRowsInto(dataTableTextRows, view.rows, columns, view.selectedIndex);
  dataTableBodyRows.length = textRows.length;
  for (let index = 0; index < textRows.length; index += 1) {
    const selected = index === view.selectedIndex;
    dataTableBodyRows[index] = {
      text: textRows[index]!,
      fg: selected ? contrastText(t.warn, t.background, t.text) : t.text,
      bg: selected ? t.warn : t.surface,
      bold: selected,
    };
  }

  const finalFooterRows = dataFooterRows({
    page: view.page + 1,
    pageCount: view.pageCount,
    selectedKey: view.selectedKey,
    width: rect.width,
    theme: t,
    fit,
  });
  dataTableRenderRows.length = 0;
  dataTableRenderRows.push({
    text: renderDataTableHeader(columns, table.state.peek().sort),
    fg: contrastText(t.accentDeep, t.background, t.text),
    bg: t.accentDeep,
    bold: true,
  });
  for (let index = 0; index < dataTableBodyRows.length; index += 1) {
    dataTableRenderRows.push(dataTableBodyRows[index]!);
  }
  dataTableRenderRows.push({ text: "", bg: t.surface });
  for (let index = 0; index < finalFooterRows.length; index += 1) {
    dataTableRenderRows.push(finalFooterRows[index]!);
  }
  writeRows(frame, rect, dataTableRenderRows);
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
      write(frame, row, rect.column, paint(" ".repeat(rect.width), { fg: t.text, bg: t.surface }));
      for (const segment of layoutWorkbenchControlButtonLine(prefix, value, rect.width)) {
        const style = segment.kind === "button"
          ? buttonPaintOptions(t, active ? "active" : "base")
          : segment.kind === "detail"
          ? {
            fg: active ? t.warn : t.text,
            bg: t.surface,
            bold: active,
          }
          : baseStyle;
        write(
          frame,
          row,
          rect.column + segment.columnOffset,
          paint(segment.text, style),
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
    const items = dropdown.items.peek();
    const contentWidth = Math.max(maxTextWidth(items), textWidth(dropdown.label()), 12);
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
  logRenderRows.length = docs.length;
  for (let index = 0; index < docs.length; index += 1) {
    logRenderRows[index] = {
      text: docs[index]!,
      fg: t.text,
      bg: t.surface,
    };
  }
  writeRows(frame, rect, logRenderRows);
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
  addHit({ column: rect.column, row, width: rect.width, height: screenHeight }, { type: "terminalShellContent" });
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
  const boxes = htmlCssVisibleLayoutBoxesInto(htmlCssLayoutBoxes, result.layout.boxes);

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
  const style = htmlCssLayoutBoxStyle(box, t, contrastText);
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
  const rows = layoutWrappedControlOptions(items, selectedIndex, width);
  for (const [offset, line] of rows.entries()) {
    const row = startRow + offset;
    if (row >= rect.row + rect.height || line.text.length === 0) return;
    const active = activeControl.peek() === id;
    write(
      frame,
      row,
      rect.column + 2,
      paint(fit(line.text, width), {
        fg: active ? t.background : t.text,
        bg: active ? t.warn : t.surface,
        bold: active,
      }),
    );
    for (const token of line.tokens) {
      addHit({ column: rect.column + 2 + token.columnOffset, row, width: token.width, height: 1 }, {
        type: "control",
        id,
        action: "activate",
        index: token.index,
      });
    }
  }
}

function wrappedOptionRowCount(items: readonly string[], width: number): number {
  return wrappedControlOptionRowCount(items, undefined, width);
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
  const entries = workbenchShelfEntriesInto(minimizedShelfEntries, windowManager.inspect().windows, windowTitle);
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
    tabs: workbenchTabEntriesInto(fullscreenTabEntries, windowManager.inspect().tabs, windowTitle),
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
  const left = workbenchStatusLeft({
    focus: windowTitle(activeWindow.peek()),
    theme: theme().label,
    tileDensity: tileDensity.peek(),
    diagnostics: formatWorkbenchDiagnosticStatus(workbenchDiagnostics),
  });
  const right = "F10 menu  N new  Shift+T themes  G config  0 restore minimized";
  write(frame, currentHeight() - 1, 0, paint(renderStatusBar(left, right, width), { fg: t.text, bg: t.panelSoft }));
}

function renderActiveDropdownOverlay(frame: Frame): void {
  const bounds = { column: 0, row: 3, width: currentWidth(), height: Math.max(0, currentHeight() - 5) };
  renderDropdownOverlay(frame, bounds, workspaceScroll.offset.peek().rows);
}

function emptyWorkspaceMessage(): string {
  const inspection = windowManager.inspect();
  let minimizedCount = 0;
  let openCount = 0;
  for (let index = 0; index < inspection.windows.length; index += 1) {
    const entry = inspection.windows[index]!;
    if (!entry.closed) openCount += 1;
    if (entry.minimized) minimizedCount += 1;
  }
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

type ThreeConfigRow = WorkbenchAsciiConfigRow;

const threeConfigRows: readonly ThreeConfigRow[] = defaultWorkbenchAsciiConfigRows;

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
  } · ${asciiPresetLabel(current.preset)}`;
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
  return formatWorkbenchAsciiConfigRowText(row, configuredAscii().peek(), { kittyStatus: kittyGraphicsStatus() });
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
  const current = configuredAscii().peek();
  const next = stepWorkbenchAsciiPreset(current, ASCII_DEMO_PRESET_IDS, delta);
  setConfiguredAscii(next.options, `three config preset ${next.label}`, { persist: false });
}

function stepAsciiGlyphStyle(delta: number): void {
  const current = configuredAscii().peek();
  const next = stepWorkbenchAsciiGlyphStyle(current, delta);
  setConfiguredAscii(
    next,
    `three config glyph style ${terminalGlyphStyleLabel(next.terminalGlyphStyle)}`,
    { persist: false },
  );
}

function toggleAsciiOption(key: AsciiToggleKey): void {
  const current = configuredAscii().peek();
  const next = toggleWorkbenchAsciiOption(current, key);
  setConfiguredAscii(
    next,
    `three config ${key} ${next[key] ? "on" : "off"}`,
    { persist: false },
  );
}

function toggleAsciiKittyOption(key: AsciiKittyKey): void {
  const current = configuredAscii().peek();
  const next = toggleWorkbenchAsciiOption(current, key);
  setConfiguredAscii(
    next,
    `three config ${key} ${next[key] ? "on" : "off"}`,
    { persist: false },
  );
}

function kittyGraphicsStatus(): string {
  if (configuredAscii().peek().kittyGraphics && kittyGraphics.tmux && !kittyGraphics.tmuxPassthroughAllowed) {
    return "[unavailable: tmux allow-passthrough off]";
  }
  const inspection = kittyGraphics.surfaceFor(configuredAscii().peek()).inspect();
  if (inspection.available) return `[${inspection.mode ?? "available"}]`;
  return `[unavailable: ${inspection.reason ?? "not detected"}]`;
}

function stepAsciiNumeric(key: AsciiNumericKey, delta: number): void {
  const current = configuredAscii().peek();
  const next = stepWorkbenchAsciiNumericOption(current, key, delta);
  setConfiguredAscii(
    next,
    `three config ${key} ${formatAsciiControlValue(key, Number(next[key]))}`,
    { persist: false },
  );
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
  const layout = windowManager.layout({
    bounds,
    tileOptions: workbenchAdaptiveTileOptions({ bounds, tileDensity: tileDensity.peek() }),
  });
  return workbenchWindowLayout<WindowId>(bounds, layout);
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
      width: Math.max(baseWidth, maxTextWidthBy(entries, (entry) => entry.text) + 2),
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
    let width = 8;
    for (let index = 0; index < columns.length; index += 1) {
      width += (columns[index]?.width ?? 12) + 2;
    }
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
    const outputWidth = maxTextWidthBy(
      terminalOutputSession.output.lines.peek(),
      (line) => formatTerminalOutputLine(line, { sourcePrefix: true }),
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
  return visualizationTextContentSize(option, rendered, baseWidth, baseHeight);
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
  const sourceIds = monitorSourceIdsInto(realSourceIdBuffer, visualizationId);
  const sources = new Array<SourceFrame>(sourceIds.length);
  for (let index = 0; index < sourceIds.length; index += 1) {
    sources[index] = getSourceFrame(sourceIds[index]!, system, workbenchAudioRegistry, phase);
  }
  return sources;
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
  const scrollbars = workbenchWindowScrollbarRects({ inner, viewport, overflow });
  if (scrollbars.vertical) {
    const rect = scrollbars.vertical;
    addHit(rect, { type: "windowVScrollbar", id });
    for (const cell of workbenchVerticalScrollbarCellsInto(verticalScrollbarCells, rect, overflow.rows.thumb)) {
      write(
        frame,
        cell.row,
        cell.column,
        paint(cell.glyph, { fg: t.accent, bg: t.panelSoft, bold: true }),
      );
    }
  }
  if (scrollbars.horizontal) {
    const rect = scrollbars.horizontal;
    addHit(rect, { type: "windowHScrollbar", id });
    for (const cell of workbenchHorizontalScrollbarCellsInto(horizontalScrollbarCells, rect, overflow.columns.thumb)) {
      write(
        frame,
        cell.row,
        cell.column,
        paint(cell.glyph, { fg: t.accent, bg: t.panelSoft, bold: true }),
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
    graphicsSurface: () => kittyGraphics.surfaceFor(asciiForWindow(id).peek()),
    frameInterval: 1000 / 18,
    diagnostics: workbenchDiagnostics,
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

function hideVisualizationThreePanelsExcept(visibleIds: ReadonlySet<VisualizationWindowId>): void {
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

function asciiForWindow(id: WindowId): Signal<AsciiOptions> {
  return asciiConfigs.signalForWindow(id);
}

function setAsciiForWindow(id: WindowId, options: AsciiOptions): void {
  asciiConfigs.setForWindow(id, normalizeAsciiOptions(options, createDefaultWorkbenchAsciiOptions()));
}

function disposeAsciiForWindow(id: WindowId): void {
  asciiConfigs.disposeWindow(id);
}

function configuredAsciiWindow(): WindowId {
  return asciiConfigs.configuredWindow(threeConfigWindow.peek(), isThreeRenderedWindow);
}

function configuredAscii(): Signal<AsciiOptions> {
  return asciiConfigs.configuredSignal(threeConfigWindow.peek(), isThreeRenderedWindow);
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
  const rect = workbenchVerticalScrollbarRect({ bounds, visible: overflow.rows.scrollbarVisible });
  if (!rect) return;
  const t = theme();
  addHit(rect, { type: "workspaceScrollbar" });
  for (const cell of workbenchVerticalScrollbarCellsInto(verticalScrollbarCells, rect, overflow.rows.thumb)) {
    write(
      frame,
      cell.row,
      cell.column,
      paint(cell.glyph, { fg: t.accent, bg: t.backgroundSoft, bold: true }),
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
  if (action.type === "terminalShellContent") return TERMINAL_SHELL_WINDOW_ID;
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
  const nextMinimized: Record<string, boolean> = {};
  for (let index = 0; index < inspection.windows.length; index += 1) {
    const entry = inspection.windows[index]!;
    nextMinimized[entry.id as WindowId] = entry.minimized;
  }
  minimized.value = nextMinimized;
}

function adjustTileDensity(delta: number): void {
  tileDensity.value = clampWorkbenchTileDensity(tileDensity.peek() + delta);
  pushLog(`tile density ${tileDensity.peek()}`);
}

function cycleDataSortColumn(delta: number): void {
  const current = table.state.peek().sort?.columnId;
  const next = nextSortableDataColumn(columns, current, delta);
  if (!next) return;
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
  return buildWorkspaceNameModalBody({
    mode: mode === "rename" ? "rename" : "save",
    draftName: workspaceNameDraft.peek(),
    cursor: mode ? "▌" : "",
    loadedVisualizationIds: currentWorkspaceVisualizationIds(),
    storageLabel: "indexedDB" in globalThis ? "IndexedDB" : "Deno JSON fallback",
    targetName: workspaceTargetName.peek(),
    targetWorkspace: workspaceByName(workspaceTargetName.peek()) ?? null,
  });
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
  const visualizationIds = workspaceVisualizationIdsFromWindows(windows);
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
    windowContentFrames.delete(id);
  }
  if (selectedChanged) selectedCpuHexTiles.value = selected;
  syncWindowSignalsFromManager();
  pushLog(`closed ${ids.length} window(s) for workspace load`);
}

function workspaceMenuEntries(): WorkspaceMenuEntry[] {
  return buildWorkspaceMenuEntries(savedWorkspaces.peek());
}

function workspaceMenuLabels(): string[] {
  return workspaceMenuLabelsInto(workspaceMenuLabelBuffer, workspaceMenuEntries());
}

function workspaceMenuItemCount(): number {
  return workspaceMenuEntries().length;
}

function currentWorkspaceVisualizationIds(): string[] {
  return workspaceVisualizationIdsFromWindows(currentWorkspaceWindows());
}

function currentWorkspaceWindows(): SavedWorkspaceWindow[] {
  const ids = windowManager.ids();
  const dynamicWindows = dynamicVisualizationWindows.peek();
  const windows: SavedWorkspaceWindow[] = [];
  for (let index = 0; index < ids.length; index += 1) {
    const windowId = ids[index] as WindowId;
    if (!isVisualizationWindow(windowId)) continue;
    const visualizationId = dynamicWindows[windowId];
    if (!visualizationId) continue;
    windows.push({ visualizationId, ascii: cloneAsciiOptions(asciiForWindow(windowId).peek()) });
  }
  return windows;
}

function defaultWorkspaceName(): string {
  return defaultWorkspaceNameFromCount(savedWorkspaces.peek().length);
}

function normalizeWorkspaceName(name: string): string {
  return normalizeWorkspaceNameFromCount(name, savedWorkspaces.peek().length);
}

function workspaceByName(name: string | null | undefined): SavedWorkspace | undefined {
  return findWorkbenchWorkspace(savedWorkspaces.peek(), name);
}

function workspaceWindowEntries(workspace: SavedWorkspace): SavedWorkspaceWindow[] {
  return workbenchWorkspaceWindowEntries(workspace, {
    validVisualizationIds: visualizationWindowOptionIds,
    normalizeAscii: (value) =>
      value ? normalizeAsciiOptions(value as AsciiOptions, createDefaultWorkbenchAsciiOptions()) : undefined,
  });
}

async function persistActiveWorkspaceState(): Promise<void> {
  const name = activeWorkspaceName.peek();
  const workspace = workspaceByName(name);
  if (!workspace) return;
  const windows = currentWorkspaceWindows();
  const next: SavedWorkspace = {
    ...workspace,
    visualizationIds: workspaceVisualizationIdsFromWindows(windows),
    windows,
    savedAt: Date.now(),
  };
  savedWorkspaces.value = upsertWorkbenchWorkspace(savedWorkspaces.peek(), next);
  await persistSavedWorkspaces();
}

async function loadSavedWorkspaces(): Promise<SavedWorkspace[]> {
  const stored = await workspaceStore.get(WORKSPACE_STORE_KEY).catch((error) => {
    reportWorkspaceStorageFallback("workspace load", error);
    return undefined;
  });
  return normalizeSavedWorkspaces(stored);
}

async function persistSavedWorkspaces(): Promise<void> {
  await workspaceStore.set(WORKSPACE_STORE_KEY, serializeWorkbenchWorkspaces(savedWorkspaces.peek())).catch((error) => {
    reportWorkspaceStorageFallback("workspace persist", error);
  });
}

function reportWorkspaceStorageFallback(operation: string, error: unknown): void {
  const diagnostic = createStorageFallbackDiagnostic({
    source: "api-workbench",
    storage: "indexedDB" in globalThis ? "IndexedDB" : "Deno JSON",
    operation,
    error,
  });
  workbenchDiagnostics.report(diagnostic);
}

function normalizeSavedWorkspaces(value: unknown): SavedWorkspace[] {
  return normalizeWorkbenchWorkspaceStorage(value, {
    validVisualizationIds: visualizationWindowOptionIds,
    normalizeName: (name, index) => normalizeWorkbenchWorkspaceName(name, `Workspace ${index + 1}`),
    normalizeAscii: (candidate) =>
      candidate ? normalizeAsciiOptions(candidate as AsciiOptions, createDefaultWorkbenchAsciiOptions()) : undefined,
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
  void routeTerminalPaste(terminalShell, event, {
    mode: "raw",
    bracketedPaste: terminalShell.inspect().screen.privateModes.includes(2004),
  }).then((decision) => {
    if (!decision.routed) pushLog(`shell paste ${decision.reason}`);
    scheduleDraw();
  });
  return true;
}

function handleTerminalShellMouse(event: MousePressEvent | MouseScrollEvent, rect: Rectangle): boolean {
  if (activeWindow.peek() !== TERMINAL_SHELL_WINDOW_ID || terminalShellInputMode.peek() !== "raw") return false;
  const mouseRouting = terminalMouseRoutingFromPrivateModes(terminalShell.inspect().screen.privateModes);
  if (mouseRouting.mouseTracking === "none" || !mouseRouting.sgrMouse) return false;
  void routeTerminalMouse(terminalShell, event, {
    mode: "raw",
    ...mouseRouting,
    mouseOrigin: { column: rect.column, row: rect.row },
  }).then((decision) => {
    if (!decision.routed && decision.reason !== "unencodable") pushLog(`shell mouse ${decision.reason}`);
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
    newWindowMenuIndex.value = workbenchController.moveMenuIndex("newWindow", count, event.key);
    if (isWorkbenchMenuActivationKey(event.key)) {
      toggleNewWindowOption(newWindowOptions[newWindowMenuIndex.peek()], { keepMenuOpen: true });
    }
    return;
  }
  if (workspaceMenuOpen.peek()) {
    const count = workspaceMenuItemCount();
    if (count === 0) return;
    workspaceMenuIndex.value = workbenchController.moveMenuIndex("workspace", count, event.key);
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
  workbenchController.openMenu("newWindow", newWindowOptions.length);
  newWindowMenuIndex.value = workbenchController.menuIndex("newWindow");
  pushLog("open new window menu");
}

function openWorkspaceMenu(): void {
  const index = menu.items.peek().findIndex((item) => item.id === "workspace");
  if (index >= 0) menu.setActive(index);
  workbenchController.openMenu("workspace", workspaceMenuItemCount());
  workspaceMenuIndex.value = workbenchController.menuIndex("workspace");
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
  windowContentFrames.delete(id);
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
  selectedCpuHexTiles.value = selectedCpuHexTilesWith(id, label);
  windowManager.focus(id);
  syncWindowSignalsFromManager();
  ensureCpuHexTileVisible(id, label);
  pushLog(`cpu ${label} selected: ${topCpuProcessLabel(label, systemMonitor.snapshot.peek())}`);
}

function selectedCpuHexTilesWith(
  id: VisualizationWindowId,
  label: string,
): Record<VisualizationWindowId, string> {
  const source = selectedCpuHexTiles.peek();
  const next: Record<VisualizationWindowId, string> = {};
  for (const key in source) {
    const windowId = key as VisualizationWindowId;
    next[windowId] = source[windowId]!;
  }
  next[id] = label;
  return next;
}

function topCpuProcessLabel(label: string, system: SystemSnapshot): string {
  let count = 0;
  let output = "";
  for (let index = 0; index < system.processes.length && count < 3; index += 1) {
    const process = system.processes[index]!;
    if (!processMatchesCpuLabel(process, label)) continue;
    if (count > 0) output += ", ";
    output += `${process.name}:${process.cpuPercent.toFixed(0)}%`;
    count += 1;
  }
  return count > 0 ? output : "no top process in sample";
}

function processMatchesCpuLabel(process: ProcessSnapshot, label: string): boolean {
  const cpuId = Number(label);
  return Number.isFinite(cpuId) ? process.processor === cpuId : String(process.processor) === label;
}

function ensureCpuHexTileVisible(id: VisualizationWindowId, label: string): void {
  const scroll = windowScrolls.get(id);
  if (!scroll) return;
  const system = systemMonitor.snapshot.peek();
  const tiles = cpuHexTileLayout(
    system.cpuCores,
    Math.max(8, scroll.contentWidth.peek()),
    Math.max(4, scroll.viewportHeight.peek()),
  );
  let tile: (typeof tiles)[number] | undefined;
  for (let index = 0; index < tiles.length; index += 1) {
    const entry = tiles[index]!;
    if (entry.label === label) {
      tile = entry;
      break;
    }
  }
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
  return nextApiWorkbenchControlId(activeControl.peek(), delta, { wrap: true }) ?? "button";
}

function controlAtEdge(delta: number): ControlId | undefined {
  return nextApiWorkbenchControlId(activeControl.peek(), delta);
}

function pushLog(message: string): void {
  commandLog.value = appendBoundedWorkbenchLogRow(
    commandLog.peek(),
    `${new Date().toLocaleTimeString()} ${message}`,
    8,
  );
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
  return workbenchButtonPaintOptions(t, contrastText, state, tone);
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
  return id === TERMINAL_OUTPUT_WINDOW_ID
    ? terminalOutputWindowTitle()
    : id === TERMINAL_SHELL_WINDOW_ID
    ? terminalShellWindowTitle()
    : apiWorkbenchPanelTitle(id, "Three ASCII");
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
  return windowManager.ids() as WindowId[];
}

function isVisualizationWindow(id: WindowId): id is VisualizationWindowId {
  return isWorkbenchVisualizationWindowId(id);
}

function visualizationWindowId(visualizationId: string): VisualizationWindowId {
  return workbenchVisualizationWindowId(visualizationId) as VisualizationWindowId;
}

function visualizationOption(visualizationId: string | undefined): NewWindowOption | undefined {
  return visualizationId ? visualizationWindowOptionById.get(visualizationId) : undefined;
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
