import { ButtonController } from "../src/components/button.ts";
import { CheckBoxController } from "../src/components/checkbox.ts";
import { ComboBoxController } from "../src/components/combobox.ts";
import { DataTableController } from "../src/components/data_table.ts";
import { createFileExplorerTree, FileExplorerController } from "../src/components/file_explorer.ts";
import { InputController } from "../src/components/input.ts";
import { MenuBarController } from "../src/components/menu_bar.ts";
import { ModalController } from "../src/components/modal.ts";
import { ProgressBarController } from "../src/components/progressbar.ts";
import { RadioGroupController } from "../src/components/radio_group.ts";
import { ScrollAreaController } from "../src/components/scroll_area.ts";
import { SliderController } from "../src/components/slider.ts";
import { StepperController } from "../src/components/stepper.ts";
import { TextBoxController } from "../src/components/textbox.ts";
import {
  appendBoundedWorkbenchLogRow,
  blitWorkbenchFrameCells,
  centerCellText as centerText,
  clampWorkbenchTileDensity,
  contrastText,
  dispatchWorkbenchTextPromptInput,
  findWorkbenchWorkspace,
  fitCellText as fit,
  formatWorkbenchDiagnosticStatus,
  HitTargetStack,
  initialWorkbenchDiagnosticLogRows,
  isWorkbenchVisualizationWindowId,
  loadWorkbenchWorkspaceStorage,
  persistWorkbenchWorkspaceStorage,
  prepareWorkbenchFrame,
  projectWorkbenchStandardTopMenuState,
  renderFrameRow,
  renderFrameSlice,
  resolveWorkbenchGlobalKey,
  resolveWorkbenchMenuFocusKey,
  resolveWorkbenchScreenDropdownKey,
  resolveWorkbenchTerminalOutputKeyAction,
  resolveWorkbenchTerminalShellKeyAction,
  subscribeWorkbenchDiagnosticLog,
  translateHitTargets,
  workbenchAdaptiveWindowLayout,
  type WorkbenchAnsiScreenFlushStats,
  WorkbenchAnsiScreenPainter,
  workbenchBuiltInWindowTogglePlan,
  type WorkbenchButtonTone,
  type WorkbenchDropdownOverlayRenderCommand,
  workbenchEmptyWorkspaceMessage,
  type WorkbenchFrame,
  workbenchFullscreenWindowRect,
  type WorkbenchHeaderLayout,
  type WorkbenchMenuBarHitLayout,
  type WorkbenchScrollbarRenderCommand,
  workbenchStandardTopMenuIdForItem,
  workbenchTerminalOutputRowsInto,
  type WorkbenchTerminalOutputToolbarAction,
  type WorkbenchTerminalOutputWindowRow,
  workbenchVisibleWindowRectsInto,
  workbenchVisualizationWindowId,
  workbenchVisualizationWindowRegistrationPlan,
  workbenchVisualizationWindowTogglePlan,
  type WorkbenchWindowOption,
  workbenchWindowOptionMenuLabelsInto,
  workbenchWindowOptionTogglePlan,
  type WorkbenchWorkspace,
  workbenchWorkspaceScrollbarRenderCommandsInto,
  WorkbenchWorkspaceViewportController,
  type WorkbenchWorkspaceWindow,
  workbenchWorkspaceWindowEntries,
  writeFrame,
} from "../src/app/workbench/mod.ts";
import {
  API_WORKBENCH_WORKSPACE_STORE_KEY,
  apiWorkbenchWorkspaceStorageLabel,
  apiWorkbenchWorkspaceStorageOptions,
  buildWorkspaceMenuEntriesInto,
  createApiWorkbenchWorkspaceStore,
  currentWorkspaceVisualizationIdsInto as workspaceVisualizationIdsFromWindowsInto,
  currentWorkspaceWindowsInto as currentWorkspaceWindowsFromIdsInto,
  defaultWorkspaceName as defaultWorkspaceNameFromCount,
  deleteWorkspaceModalContent,
  deleteWorkspaceState,
  renameWorkspaceModalContent,
  renameWorkspaceState,
  resolveWorkspaceMenuCommand,
  saveWorkspaceModalContent,
  saveWorkspaceState,
  workbenchWindowClosePlan,
  workspaceDeletedModalContent,
  workspaceLoadClosePlan,
  type WorkspaceMenuEntry,
  workspaceMenuLabelsInto,
  workspaceMissingModalContent,
  workspaceNameModalBody as buildWorkspaceNameModalBody,
  workspaceRenamedModalContent,
  workspaceSavedModalContent,
} from "../src/app/workbench_workspace_menu.ts";
import {
  readWorkbenchVerifiedConsoleSize,
  syncWorkbenchTerminalSize,
  WorkbenchFullRepaintPolicy,
} from "../src/app/workbench_repaint_policy.ts";
import {
  type ApiWorkbenchThreePressureInspection,
  ApiWorkbenchThreeRuntimeController,
  WorkbenchThreeCadenceMeter,
  WorkbenchThreeOverlayPressureGate,
} from "../src/app/workbench_three_runtime.ts";
import {
  apiWorkbenchThreeFrameIntervalForCells,
  createWorkbenchThreeWindowState,
  hideWorkbenchThreeRect,
  resolveWorkbenchThreeFullscreenAsciiOptions,
  resolveWorkbenchThreeLiveAsciiOptions,
  resolveWorkbenchThreeRuntimeBudgetSnapshot,
  resolveWorkbenchThreeTiledAsciiOptions,
  resolveWorkbenchThreeWindowStateInto,
  sameWorkbenchThreeAsciiOptions,
  setWorkbenchThreeRect,
  setWorkbenchThreeSceneSignal,
  WORKBENCH_THREE_DRAW_INTERVAL_MS,
  WORKBENCH_THREE_FULLSCREEN_MIN_CELLS,
  WORKBENCH_THREE_INITIAL_CELLS,
  workbenchStudioScene,
  workbenchThreeBodyRect,
  workbenchThreeContentGraphicsRect,
  workbenchThreeLiveRenderCells,
  type WorkbenchThreeScene as SharedWorkbenchThreeScene,
  type WorkbenchThreeWindowState,
  workbenchThreeWindowStateIsInteractive,
  workbenchVisualizationThreeScene,
} from "../src/app/workbench_three_policy.ts";
import {
  inspectWorkbenchWindowSignalState,
  WorkbenchController,
  workbenchWindowActionLog,
  type WorkbenchWindowActionLogKind,
} from "../src/app/workbench/controller.ts";
import {
  WorkbenchButtonRowBufferCache,
  WorkbenchModalBufferCache,
  WorkbenchShelfBufferCache,
  WorkbenchTerminalBufferCache,
  WorkbenchTerminalSessionTabBufferCache,
} from "../src/app/workbench_buffers.ts";
import {
  applyWorkbenchAsciiConfigRowAction,
  createDefaultWorkbenchAsciiOptions,
  defaultWorkbenchAsciiConfigRows,
  formatWorkbenchAsciiConfigRowText,
  formatWorkbenchAsciiConfigTitle,
  moveWorkbenchAsciiConfigSelection,
  resolveWorkbenchAsciiConfigKey,
  WorkbenchAsciiConfigController,
  type WorkbenchAsciiConfigRow,
  workbenchAsciiRendererModeLabel,
} from "../src/app/workbench_ascii.ts";
import {
  type WorkbenchAsciiConfigModalAction,
  WorkbenchAsciiConfigModalBufferCache,
} from "../src/app/workbench_ascii_modal.ts";
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
import { FrameScheduler } from "../src/runtime/render_loop.ts";
import { type TerminalBackend } from "../src/runtime/terminal_backend.ts";
import type { TerminalShellController } from "../src/runtime/terminal_shell.ts";
import { TerminalShellWorkspaceController } from "../src/runtime/terminal_shell_workspace.ts";
import { formatTerminalOutputWindowTitle, formatTerminalShellWindowTitle } from "../src/runtime/terminal_status.ts";
import { shellTerminalTemplate } from "../src/runtime/terminal_templates.ts";
import { Computed, Signal } from "../src/signals/mod.ts";
import { probeCompatibleWebGPUDevice } from "../src/three_ascii/webgpu_compat.ts";
import { Tui } from "../src/tui.ts";
import type { Rectangle } from "../src/types.ts";
import { textWidth } from "../src/utils/strings.ts";
import { maxTextWidth, type VisibleMenuSlice } from "../src/app/workbench_text.ts";
import {
  applyWorkbenchTerminalSearchPromptInput,
  resolveWorkbenchShellBackend,
  resolveWorkbenchTerminalProcessInputModeToggle,
  resolveWorkbenchTerminalShellInputModeToggle,
  workbenchTerminalSearchModalBody,
  type WorkbenchTerminalShellHeaderRow,
  type WorkbenchTerminalToolbarAction,
  workbenchTerminalToolbarStateFromSnapshot,
} from "../src/app/workbench_terminal.ts";
import { AudioRegistry } from "./audio.ts";
import {
  type ApiWorkbenchBuiltInWindowId,
  apiWorkbenchColumns,
  apiWorkbenchDocs,
  apiWorkbenchLiveRowsInto,
  apiWorkbenchPanelTitle,
  type ApiWorkbenchProcessRow,
  apiWorkbenchRows,
  type ApiWorkbenchThemeSpec,
  apiWorkbenchVisualizationSupportsThree,
  apiWorkbenchWindowTitle,
  createApiWorkbenchThemes,
  createApiWorkbenchWindowCatalog,
  nextApiWorkbenchTerminalSessionDraft,
  TERMINAL_OUTPUT_WINDOW_ID,
  TERMINAL_SHELL_WINDOW_ID,
} from "./api_workbench_catalog.ts";
import {
  apiWorkbenchControlAt,
  apiWorkbenchControlAtEdge,
  type ApiWorkbenchControlId,
  findApiWorkbenchHitTarget,
  isApiWorkbenchTextControlActive,
  isApiWorkbenchTouchOptimizedLayout,
  nextSortableDataColumn,
  resolveApiWorkbenchControlKey,
  resolveApiWorkbenchHitWindowId,
  resolveApiWorkbenchTitlebarHitAction,
  resolveApiWorkbenchWindowHScrollbarOffset,
  resolveApiWorkbenchWindowVScrollbarOffset,
  resolveApiWorkbenchWorkspaceScrollbarOffset,
} from "./api_workbench_controls.ts";
import { HTML_CSS_LAYOUT_WINDOW_ID } from "../src/markup/demo_fixtures.ts";
import { type HtmlCssLayoutRenderCommand, renderApiWorkbenchHtmlCssLayout } from "./html_css_layout_view.ts";
import { asciiDemoPresetIds } from "../src/three_ascii/demo_presets.ts";
import { cloneAsciiOptions, normalizeAsciiOptions, terminalGlyphStyleLabel } from "../src/three_ascii/options.ts";
import { resolveSourceFramesInto } from "./sources.ts";
import { makeStyle, requireInteractiveTerminal } from "./styles.ts";
import { SystemMonitor } from "./system_metrics.ts";
import { createWorkbenchThreePanelFrameView, ThreePanelFrameView } from "./three_panel.ts";
import {
  addApiWorkbenchCpuHexTileHits,
  ApiWorkbenchControlsViewBufferCache,
  explorerTextRowsInto,
  renderApiWorkbenchControls,
  renderApiWorkbenchDataPanel,
  renderApiWorkbenchExplorerPanel,
  renderApiWorkbenchInspectorPanel,
  renderApiWorkbenchLogsPanel,
  renderApiWorkbenchVisualizationMissing,
  renderApiWorkbenchVisualizationTextWindow,
  renderApiWorkbenchVisualizationThreeChrome,
  workbenchDemoModalContent,
  workbenchHelpModalContent,
  workbenchModalConfirmedContent,
  workbenchModalDetailsContent,
  workbenchQuitModalContent,
  workbenchWindowContentSize,
} from "./workbench_panels.ts";
import { WorkbenchThreeGridProjectionCache } from "../src/app/workbench_three_grid.ts";
import {
  formatWorkbenchKittyGraphicsStatus,
  WorkbenchKittyGraphicsController,
} from "../src/runtime/graphics_surface.ts";
import { WorkbenchFramePainter } from "../src/app/workbench_row_render.ts";
import { type RowStyle, type ThreeHeaderPerformance } from "../src/app/workbench_rows.ts";
import { shouldCountWorkbenchThreeGridPressure } from "../src/app/workbench_three_terminal_pressure.ts";
import {
  type WorkbenchThreePanelEntry,
  WorkbenchThreePanelRegistry,
  WorkbenchThreeViewportInteractionController,
} from "../src/app/workbench_three_panel_registry.ts";
import type { AsciiOptions, PanelRender, RenderContext, SlotConfig, SourceFrame, ThreeSceneMode } from "./types.ts";
import {
  cpuHexGridColumnCount,
  type CpuHexNavigationKey,
  type CpuHexTileLayout,
  cpuHexTileLayoutInto,
  cpuHexTileScrollTarget,
  nextCpuHexLabel,
  selectedCpuHexTilesWith,
  topCpuProcessLabelForCpu,
} from "./visualization_system.ts";
import { renderVisualization, visualizations, visualizationUsesThreeRenderer } from "./visualizations.ts";
import {
  monitorSourceIds,
  monitorSourceIdsInto,
  syntheticWorkbenchSourcesInto,
  syntheticWorkbenchSystem,
} from "./workbench_synthetic.ts";
import type { ComputedLayoutBox } from "../src/layout/mod.ts";
import {
  renderApiWorkbenchThreeFallback,
  renderApiWorkbenchThreeHeader,
  renderApiWorkbenchThreeSurface,
} from "./api_workbench_three_view.ts";
import {
  type ApiWorkbenchDropdownOverlay,
  ApiWorkbenchWindowShellBufferCache,
  renderApiWorkbenchChromeHeader,
  renderApiWorkbenchDropdownOverlay,
  renderApiWorkbenchModalOverlay,
  renderApiWorkbenchShelf,
  renderApiWorkbenchStatus,
  renderApiWorkbenchTerminalOutputBody,
  renderApiWorkbenchTerminalOutputToolbar,
  renderApiWorkbenchTerminalSessionTabs,
  renderApiWorkbenchTerminalShellHeader,
  renderApiWorkbenchTerminalShellPanes,
  renderApiWorkbenchTerminalShellToolbar,
  renderApiWorkbenchThreeConfigModal,
  renderApiWorkbenchWindowFrame,
  renderApiWorkbenchWindowShell,
  renderApiWorkbenchWindowTabs,
} from "./api_workbench_window_view.ts";

type BuiltInWindowId = ApiWorkbenchBuiltInWindowId;
type VisualizationWindowId = `viz:${string}`;
type WindowId = BuiltInWindowId | VisualizationWindowId;
type WorkbenchThreeScene = SharedWorkbenchThreeScene<ThreeSceneMode>;
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
  | { type: "asciiConfigAction"; action: WorkbenchAsciiConfigModalAction }
  | { type: "asciiConfigBackdrop" }
  | { type: "theme"; index: number }
  | { type: "newWindow"; index: number }
  | { type: "workspace"; index: number }
  | { type: "modalAction"; index: number }
  | { type: "control"; id: ControlId; action?: ControlHitAction; index?: number }
  | { type: "terminalOutput"; action: TerminalOutputAction }
  | { type: "terminalShell"; action: TerminalShellAction }
  | { type: "terminalShellPane"; id: string }
  | { type: "terminalShellSession"; id: string }
  | { type: "terminalShellContent" }
  | { type: "terminalShellCopyRow"; index: number }
  | { type: "dataRow"; index: number }
  | { type: "explorerRow"; index: number }
  | { type: "cpuHexTile"; id: VisualizationWindowId; label: string }
  | { type: "windowVScrollbar"; id: WindowId }
  | { type: "windowHScrollbar"; id: WindowId }
  | { type: "workspaceScrollbar" };
type ControlHitAction = "previous" | "next" | "activate" | "set" | "focus" | "toggle";
type ConfigHitAction = "previous" | "next" | "activate";
type TerminalOutputAction = WorkbenchTerminalOutputToolbarAction;
type TerminalShellAction = WorkbenchTerminalToolbarAction;
type ButtonTone = WorkbenchButtonTone;

type ThemeSpec = ApiWorkbenchThemeSpec;
type ProcessRow = ApiWorkbenchProcessRow;

type NewWindowOption = WorkbenchWindowOption;

type SavedWorkspace = WorkbenchWorkspace<AsciiOptions>;
type SavedWorkspaceWindow = WorkbenchWorkspaceWindow<AsciiOptions>;

type WorkspaceNameMode = "save" | "rename";

const terminalOutputButtonBuffers = new WorkbenchButtonRowBufferCache<TerminalOutputAction>();
const terminalShellButtonBuffers = new WorkbenchButtonRowBufferCache<TerminalShellAction>();
const terminalShellSessionTabBuffers = new WorkbenchTerminalSessionTabBufferCache();
const terminalShellBuffers = new WorkbenchTerminalBufferCache();
const terminalShellHeaderRows: WorkbenchTerminalShellHeaderRow[] = [];
const controlViewBuffers = new ApiWorkbenchControlsViewBufferCache();
const modalBuffers = new WorkbenchModalBufferCache<number>();
const themes: ThemeSpec[] = createApiWorkbenchThemes();
const themeLabels = themes.map((entry) => entry.label);
const themeMenuWidth = Math.max(20, maxTextWidth(themeLabels) + 6);
const rows: ProcessRow[] = apiWorkbenchRows;
const liveRowsBuffer: ProcessRow[] = [];
const columns = apiWorkbenchColumns;
const docs = apiWorkbenchDocs;
const htmlCssLayoutBoxes: ComputedLayoutBox[] = [];
const htmlCssLayoutRenderCommands: HtmlCssLayoutRenderCommand[] = [];
const dataTableTextRows: string[] = [];
const dataTableBodyRows: RowStyle[] = [];
const dataTableRenderRows: RowStyle[] = [];
const explorerRenderRows: RowStyle[] = [];
const explorerContentTextRows: string[] = [];
const inspectorRenderRows: RowStyle[] = [];
const inspectorActionTextRows: string[] = [];
const inspectorWrappedTextRows: string[] = [];
const visualizationTextRows: string[] = [];
const visualizationRenderRows: RowStyle[] = [];
const threeFallbackRowsBuffer: RowStyle[] = [];
const threeStatusRowsBuffer: RowStyle[] = [];
const logRenderRows: RowStyle[] = [];
const terminalOutputContentRows: string[] = [];
const terminalOutputWindowRows: WorkbenchTerminalOutputWindowRow[] = [];
const ASCII_DEMO_PRESET_IDS = asciiDemoPresetIds();
const explorerKeys = new Set(["up", "down", "left", "right", "pageup", "pagedown", "home", "end", "space", "return"]);
const windowCatalog = createApiWorkbenchWindowCatalog(visualizations);
const builtInWindowOrder = windowCatalog.builtInWindowOrder;
const visualizationWindowOptionIds = windowCatalog.visualizationWindowOptionIds;
const visualizationWindowOptionById = windowCatalog.visualizationWindowOptionById;
const newWindowOptions: NewWindowOption[] = windowCatalog.newWindowOptions;
const WORKSPACE_STORE_KEY = API_WORKBENCH_WORKSPACE_STORE_KEY;

requireInteractiveTerminal("deno task api-workbench");

const workbenchDiagnostics = new DiagnosticsCollector(120);
const systemMonitor = new SystemMonitor({ historyLength: 72, diagnostics: workbenchDiagnostics });
await systemMonitor.start(1000);
const workbenchAudioRegistry = new AudioRegistry([]);
const workspaceStore = createApiWorkbenchWorkspaceStore();
const savedWorkspaces = new Signal<SavedWorkspace[]>(await loadWorkbenchWorkspaceStorage(workspaceStorageOptions()), {
  deepObserve: true,
});
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
const terminalShell = new TerminalShellWorkspaceController({
  backendFactory: createWorkbenchShellBackend,
  columns: 80,
  rows: 24,
  scrollbackLimit: 2000,
  diagnostics: workbenchDiagnostics,
  onUpdate: scheduleDraw,
});
terminalShell.add(shellTerminalTemplate({ id: "shell-1", title: "Shell 1" }), { activate: true });
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
terminalShell.workspace.activeId.subscribe(scheduleDraw);
terminalShell.workspace.sessions.subscribe(scheduleDraw);
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
const terminalShellSearchDraft = new Signal("");
const terminalShellSearchPromptOpen = new Signal(false);
const menuFocused = new Signal(false);
const workbenchController = new WorkbenchController<"theme" | "newWindow" | "workspace">({
  activeId: "three",
  menu: {
    onChange: (state) => {
      const projected = projectWorkbenchStandardTopMenuState(state);
      themeMenuOpen.value = projected.themeMenuOpen;
      newWindowMenuOpen.value = projected.newWindowMenuOpen;
      workspaceMenuOpen.value = projected.workspaceMenuOpen;
      menuFocused.value = projected.menuFocused;
    },
  },
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
const genericModalBlocksThree = new Signal(false);
const activeWindow = new Signal<WindowId>("three");
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
const screenPainter = new WorkbenchAnsiScreenPainter(tui.stdout);
const repaintPolicy = new WorkbenchFullRepaintPolicy();
let workbenchScreenSizeObserved = false;
const hitTargets = new HitTargetStack<HitAction>();
const screenFrame: Frame = [];
const workspaceVirtualFrame: Frame = [];
const windowContentFrames = new Map<WindowId, Frame>();
const themeMenuSlice: VisibleMenuSlice = { items: [], indexes: [] };
const newWindowMenuSlice: VisibleMenuSlice = { items: [], indexes: [] };
const newWindowMenuLabels: string[] = [];
const workspaceMenuSlice: VisibleMenuSlice = { items: [], indexes: [] };
const workspaceMenuEntryBuffer: WorkspaceMenuEntry[] = [];
const workspaceMenuLabelBuffer: string[] = [];
const realSourceIdBuffer: string[] = [];
const realSourceFrameBuffer: SourceFrame[] = [];
const syntheticSourceFrameBuffer: SourceFrame[] = [];
const cpuHexHitTileBuffer: CpuHexTileLayout[] = [];
const cpuHexRevealTileBuffer: CpuHexTileLayout[] = [];
const threeGridProjectionCache = new WorkbenchThreeGridProjectionCache();
const menuBarHitLayouts: WorkbenchMenuBarHitLayout[] = [];
const headerLayout: WorkbenchHeaderLayout = { menu: { column: 0, row: 0, width: 0, height: 1 } };
const shelfBuffers = new WorkbenchShelfBufferCache<WindowId>();
const windowShellBuffers = new ApiWorkbenchWindowShellBufferCache<WindowId>();
const workspaceScrollbarRenderCommands: WorkbenchScrollbarRenderCommand[] = [];
const dropdownOverlayRenderCommands: WorkbenchDropdownOverlayRenderCommand[] = [];
const visibleWindowRects = new Map<WindowId, Rectangle>();
const frameWidthHints = new WeakMap<Frame, number>();
const currentWorkspaceWindowBuffer: SavedWorkspaceWindow[] = [];
const currentWorkspaceVisualizationIdBuffer: string[] = [];
const workbenchThreeWindowState = createWorkbenchThreeWindowState<WindowId>("three");
const workbenchThreeRuntime = new ApiWorkbenchThreeRuntimeController({
  hasLiveThreeWindow: () => workbenchThreeWindowState.live,
  hasFullscreenThreeWindow: () => workbenchThreeWindowState.fullscreenThree,
  onPressureChange: pushLog,
});
const workbenchThreeLiveMaxCells = workbenchThreeRuntime.liveMaxCells;
const workbenchThreeFullscreenMaxCells = workbenchThreeRuntime.fullscreenMaxCells;
const workbenchThreeFrameInterval = workbenchThreeRuntime.frameInterval;
const workbenchThreePressureDetails: ApiWorkbenchThreePressureInspection = workbenchThreeRuntime
  .inspectPressureDetails();
const workbenchThreeHeaderPerformance: ThreeHeaderPerformance = {
  totalMs: 0,
  initMs: 0,
  sceneMs: 0,
  readbackMs: 0,
  assemblyMs: 0,
  cells: 0,
};
const workbenchThreeHeaderRows: RowStyle[] = [];
const WORKBENCH_THREE_OVERLAY_PRESSURE_COOLDOWN_FRAMES = 6;
const workbenchThreeOverlayPressureGate = new WorkbenchThreeOverlayPressureGate(
  WORKBENCH_THREE_OVERLAY_PRESSURE_COOLDOWN_FRAMES,
);
let dropdownOverlay: DropdownOverlay | null = null;
let windowRenderContext: WindowRenderContext | null = null;
let workspacePlacementContext: WorkspacePlacementContext | null = null;
const drawScheduler = new FrameScheduler({ intervalMs: WORKBENCH_THREE_DRAW_INTERVAL_MS });
const renderedVisualizationThreePanels = new Set<VisualizationWindowId>();
const workbenchThreeIdleFrameInterval = apiWorkbenchThreeFrameIntervalForCells(WORKBENCH_THREE_INITIAL_CELLS, {
  live: false,
});
type Frame = WorkbenchFrame;
const framePainter = new WorkbenchFramePainter<Frame, ThemeSpec>({
  width: (target) => frameWidthHints.get(target) ?? currentWidth(),
  theme,
  style: makeStyle,
  contrastText,
  fit,
  write: writeFrame,
});
type DropdownOverlay = ApiWorkbenchDropdownOverlay;
type DynamicThreePanel = WorkbenchThreePanelEntry<ThreePanelFrameView, WorkbenchThreeScene>;
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
  onOpenChange: (open) => {
    genericModalBlocksThree.value = open && !threeConfigOpen.peek();
  },
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
const workbenchThreeFullscreenTargetCells = new Signal(WORKBENCH_THREE_FULLSCREEN_MIN_CELLS);
const workbenchThreeEffectiveMaxCells = new Signal(WORKBENCH_THREE_INITIAL_CELLS);
const threeCadence = new WorkbenchThreeCadenceMeter();
const threeRuntimeAscii = new Signal<AsciiOptions>(ascii.peek());
const threeScene = new Computed<WorkbenchThreeScene | null>(() =>
  workbenchStudioScene({
    blocked: false,
    minimized: minimized.value.three,
    available: threeAsciiAvailable.value,
    density: density.value.value,
    progress: progress.value.value,
    progressRatio: progress.ratio(),
    compactRows: compactRows.checked.value,
    livePreview: livePreview.checked.value,
    active: activeWindow.value === "three",
    pressed: activeControl.value === "button",
  })
);
const threePanel = createWorkbenchThreePanelFrameView({
  rectangle: threeBodyRect,
  graphicsRectangle: threeGraphicsRect,
  scene: threeScene,
  ascii: threeRuntimeAscii,
  enabled: threeAsciiAvailable,
  graphicsSurface: () => kittyGraphics.surfaceFor(ascii.peek()),
  frameInterval: workbenchThreeFrameInterval,
  idleFrameInterval: workbenchThreeIdleFrameInterval,
  interactive: () => workbenchThreeWindowStateIsInteractive(workbenchThreeWindowState, "three"),
  maxRenderCells: workbenchThreeEffectiveMaxCells,
  diagnostics: workbenchDiagnostics,
  onFrame: () => {
    threeCadence.record();
    scheduleDraw();
  },
  onUpdate: scheduleDraw,
});
const visualizationThreePanels = new WorkbenchThreePanelRegistry<
  VisualizationWindowId,
  ThreePanelFrameView,
  WorkbenchThreeScene
>(createVisualizationThreePanel);
const visualizationThreeSupport = new Map<string, boolean>();
const threeViewportInteraction = new WorkbenchThreeViewportInteractionController<WindowId>({
  findHit,
  panelForWindow: (id) =>
    id === "three" ? threePanel : isVisualizationWindow(id) ? visualizationThreePanels.get(id)?.panel : undefined,
  focusWindow: (id) => {
    windowManager.focus(id);
    syncWindowSignalsFromManager();
  },
});

tui.canvas.size.subscribe(() => {
  repaintPolicy.inspectScreenSize(tui.canvas.size.peek());
  screenPainter.clearScreen();
  repaintPolicy.resetFullRepaintClock();
  requestResizeFullRepaintWindowAfterInitialObservation();
  scheduleDraw();
});

tui.on("keyPress", (event) => {
  if (event.ctrl && event.key === "c" && !shellShouldReceiveCtrlC()) return;
  if (threeConfigOpen.peek()) {
    handleThreeConfigKey(event);
    draw();
    return;
  }
  if (modal.openState.peek()) {
    if (terminalShellSearchPromptOpen.peek() && handleTerminalShellSearchKey(event)) {
      draw();
      return;
    }
    if (workspaceNameMode.peek() && handleWorkspaceNameKey(event)) {
      draw();
      return;
    }
    modal.handleKeyPress(event);
    draw();
    return;
  }
  if (topMenus.inspect().openId !== null) {
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
    threeViewportInteraction.handlePress(event);
    return;
  }
  const threePress = threeViewportInteraction.handlePress(event);
  if (threePress.handled) {
    draw();
    return;
  }
  const hit = findHit(event.x, event.y);
  if (hit) applyHit(hit, event.x, event.y);
  draw();
});

tui.on("mouseScroll", (event) => {
  const shellHit = findHit(event.x, event.y);
  if (shellHit?.action.type === "terminalShellContent" && handleTerminalShellMouse(event, shellHit.rect)) {
    draw();
    return;
  }
  if (shellHit?.action.type === "terminalShellContent" && handleTerminalShellScroll(event)) {
    draw();
    return;
  }
  if (threeViewportInteraction.handleScroll(event)) {
    draw();
    return;
  }
  const hoveredHit = findHit(event.x, event.y);
  const hovered = hoveredHit
    ? resolveApiWorkbenchHitWindowId<WindowId>(hoveredHit.action, {
      terminalShell: TERMINAL_SHELL_WINDOW_ID,
      controls: "controls",
      data: "data",
      explorer: "explorer",
    })
    : undefined;
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
  if (syncTerminalSize() || repaintPolicy.fullRepaintWindowActive()) draw();
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
  terminalShellSearchDraft.dispose();
  terminalShellSearchPromptOpen.dispose();
  savedWorkspaces.dispose();
  menuFocused.dispose();
  threeConfigOpen.dispose();
  threeRuntimeAscii.dispose();
  workbenchThreeFullscreenTargetCells.dispose();
  workbenchThreeEffectiveMaxCells.dispose();
  threeConfigSelected.dispose();
  threeConfigWindow.dispose();
  threeConfigBaseline.dispose();
  genericModalBlocksThree.dispose();
  dynamicVisualizationWindows.dispose();
  selectedCpuHexTiles.dispose();
  commandInput.dispose();
  workflowStepper.dispose();
  progress.dispose();
  notes.dispose();
  explorer.dispose();
  table.dispose();
  threePanel.dispose();
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
  workbenchThreeRuntime.dispose();
  drawScheduler.cancel();
});

tui.run();
syncTerminalSize();
draw();

function draw(): void {
  syncTerminalSize();
  const forceFullRepaint = repaintPolicy.shouldForceFullRepaint(performance.now());
  const width = currentWidth();
  const height = currentHeight();
  hitTargets.clear();
  dropdownOverlay = null;
  syncWorkbenchThreeWindowState();
  workbenchThreeRuntime.resetPressureSample();
  const frame = prepareWorkbenchFrame(screenFrame, height);
  renderHeader(frame);
  renderWorkspace(frame);
  syncWorkbenchThreeRuntimeBudgetForViewport(width, height, threeBodyRect.peek());
  workbenchThreeRuntime.syncFrameInterval();
  renderStatus(frame);
  renderActiveDropdownOverlay(frame);
  renderModalOverlay(frame);
  if (forceFullRepaint) screenPainter.reset();
  const flushStats = screenPainter.flush(frame, width, height, renderFrameRow, renderFrameSlice);
  updateThreeTerminalPressure(flushStats, { ignoreSample: forceFullRepaint });
}

function syncWorkbenchThreeRuntimeBudgetForViewport(
  width: number,
  height: number,
  liveViewport: Pick<Rectangle, "width" | "height">,
): void {
  const snapshot = resolveWorkbenchThreeRuntimeBudgetSnapshot({
    id: "three",
    fullscreenId: maximized.peek(),
    ascii: ascii.peek(),
    liveMaxCells: workbenchThreeLiveMaxCells.peek(),
    liveViewport,
    fullscreenMaxCells: workbenchThreeFullscreenMaxCells.peek(),
    viewport: { width, height },
    fullscreenViewportPadding: { columns: 6, rows: 10 },
    isThreeWindow: (id) => isThreeRenderedWindow(id),
  });
  const fullscreenThree = workbenchThreeWindowState.fullscreenThree;
  const syncedFullscreenMaxCells = workbenchThreeRuntime.syncFullscreenTargetCells(
    snapshot.fullscreenTargetCells,
    fullscreenThree,
    snapshot.fullscreenViewportCells,
  );
  const liveViewportCells = Math.max(1, Math.floor(liveViewport.width) * Math.floor(liveViewport.height));
  const syncedLiveMaxCells = workbenchThreeRuntime.syncLiveTargetCells(
    workbenchThreeLiveRenderCells(liveViewport),
    workbenchThreeWindowState.live && !fullscreenThree,
    liveViewportCells,
  );
  if (workbenchThreeFullscreenTargetCells.peek() !== snapshot.fullscreenTargetCells) {
    workbenchThreeFullscreenTargetCells.value = snapshot.fullscreenTargetCells;
  }
  const effectiveMaxCells = fullscreenThree
    ? syncedFullscreenMaxCells
    : Math.max(syncedLiveMaxCells, snapshot.effectiveMaxCells);
  if (workbenchThreeEffectiveMaxCells.peek() !== effectiveMaxCells) {
    workbenchThreeEffectiveMaxCells.value = effectiveMaxCells;
  }
  const runtimeAscii = fullscreenThree
    ? snapshot.runtimeAscii
    : resolveWorkbenchThreeLiveAsciiOptions(ascii.peek(), effectiveMaxCells);
  if (!sameWorkbenchThreeAsciiOptions(threeRuntimeAscii.peek(), runtimeAscii)) {
    threeRuntimeAscii.value = runtimeAscii;
  }
}

function updateThreeTerminalPressure(
  stats: WorkbenchAnsiScreenFlushStats,
  options: { ignoreSample?: boolean } = {},
): void {
  const overlayOpen = modal.openState.peek() || topMenus.inspect().openId !== null || threeConfigOpen.peek();
  const pressureGate = workbenchThreeOverlayPressureGate.resolve(overlayOpen);
  if (pressureGate.resetCadence) {
    threeCadence.reset();
  }
  if (pressureGate.resetPressureCounters) {
    workbenchThreeRuntime.resetPressureCounters();
  }
  if (!pressureGate.updatePressure) {
    return;
  }
  if (options.ignoreSample) {
    workbenchThreeRuntime.resetPressureSample();
    return;
  }
  workbenchThreeRuntime.updatePressureFromCadence(stats, threeCadence.inspect());
}

function scheduleDraw(): void {
  drawScheduler.schedule(draw);
}

function renderHeader(frame: Frame): void {
  const width = currentWidth();
  const openMenuId = topMenus.inspect().openId;
  dropdownOverlay = renderApiWorkbenchChromeHeader({
    frame,
    width,
    menuItems: menu.items.peek(),
    menuActiveIndex: menu.activeIndex.peek(),
    openMenuId,
    dropdownEntries: openMenuId === "theme"
      ? {
        theme: {
          visible: themeMenuSlice,
          labels: themeLabels,
          selectedIndex: themeIndex.peek(),
          preferredWidth: themeMenuWidth,
        },
      }
      : openMenuId === "newWindow"
      ? {
        newWindow: {
          visible: newWindowMenuSlice,
          labels: workbenchWindowOptionMenuLabelsInto(newWindowMenuLabels, newWindowOptions, windowManager.ids()),
          selectedIndex: newWindowMenuIndex.peek(),
          preferredWidth: 28,
          maxVisibleItems: Math.max(6, currentHeight() - 5),
        },
      }
      : openMenuId === "workspace"
      ? {
        workspace: {
          visible: workspaceMenuSlice,
          labels: workspaceMenuLabelsInto(workspaceMenuLabelBuffer, workspaceMenuEntries()),
          selectedIndex: workspaceMenuIndex.peek(),
          preferredWidth: 30,
          maxVisibleItems: Math.max(6, currentHeight() - 5),
        },
      }
      : {},
    headerLayout,
    menuHitLayouts: menuBarHitLayouts,
    theme: theme(),
    paint,
    write,
    fillRow,
    writeButton,
    addHit,
  });
}

function renderWorkspace(frame: Frame): void {
  const bounds = { column: 0, row: 3, width: currentWidth(), height: Math.max(0, currentHeight() - 5) };
  fillRect(frame, bounds, theme().backgroundSoft);
  renderedVisualizationThreePanels.clear();
  if (bounds.width < 2 || bounds.height < 1) {
    hideBuiltinThreeRects();
    hideVisualizationThreePanelsExcept(renderedVisualizationThreePanels);
    return;
  }
  const layout = workspaceLayout({ column: 0, row: 0, width: Math.max(1, bounds.width - 1), height: bounds.height });
  const offset = workspaceViewport.update({ layout, viewportHeight: bounds.height, activeId: activeWindow.peek() });
  const virtual = prepareWorkbenchFrame(workspaceVirtualFrame, Math.max(bounds.height, layout.contentHeight));
  frameWidthHints.set(virtual, layout.bounds.width);
  fillRect(virtual, layout.bounds, theme().backgroundSoft);
  const hitStart = hitTargets.length;
  const max = maximized.peek();
  if (max) {
    const fullscreenRect = workbenchFullscreenWindowRect(layout.bounds);
    withWorkspacePlacement(bounds, 0, () => renderWindow(virtual, max, fullscreenRect));
    if (max !== "three") {
      hideBuiltinThreeRects();
    }
    hideVisualizationThreePanelsExcept(renderedVisualizationThreePanels);
    translateHitTargets(hitTargets, { startIndex: hitStart, rowDelta: bounds.row, clip: bounds });
    blitWorkbenchFrameCells(frame, virtual, { ...bounds, width: layout.bounds.width }, { columns: 0, rows: 0 });
    renderWindowTabs(frame);
    return;
  }

  if (layout.rects.size === 0) {
    hideBuiltinThreeRects();
    hideVisualizationThreePanelsExcept(renderedVisualizationThreePanels);
    write(
      frame,
      bounds.row + 1,
      2,
      paint(workbenchEmptyWorkspaceMessage({ windows: windowManager.inspect().windows }), {
        fg: theme().warn,
      }),
    );
    renderShelf(frame);
    return;
  }

  let renderedThree = false;
  const visibleRects = workbenchVisibleWindowRectsInto(visibleWindowRects, layout.rects, {
    viewport: { column: layout.bounds.column, row: offset, width: layout.bounds.width, height: bounds.height },
  });
  withWorkspacePlacement(bounds, offset, () => {
    for (const [id, rect] of visibleRects) {
      renderWindow(virtual, id, rect);
      if (id === "three") {
        renderedThree = true;
      }
    }
  });
  if (!renderedThree) {
    hideBuiltinThreeRects();
  }
  hideVisualizationThreePanelsExcept(renderedVisualizationThreePanels);
  translateHitTargets(hitTargets, { startIndex: hitStart, rowDelta: bounds.row - offset, clip: bounds });
  blitWorkbenchFrameCells(frame, virtual, { ...bounds, width: layout.bounds.width }, { columns: 0, rows: offset });
  renderWorkspaceScrollbar(frame, bounds);
  renderShelf(frame);
}

function renderWindow(frame: Frame, id: WindowId, rect: Rectangle): void {
  renderApiWorkbenchWindowShell<WindowId, HitAction>({
    frame,
    id,
    rect,
    minimized: Boolean(minimized.peek()[id]),
    active: activeWindow.peek() === id,
    title: windowTitle(id),
    showConfig: isThreeRenderedWindow(id),
    theme: theme(),
    buffers: windowShellBuffers,
    scroll: windowScroll(id),
    contentSizeForInner: (inner) => windowContentSize(id, inner),
    contentFrameForRows: (rows) => windowContentFrame(id, rows),
    setFrameWidthHint: (target, width) => frameWidthHints.set(target, width),
    hitTargetCount: () => hitTargets.length,
    renderContent: (contentFrame, contentRect, context) => {
      const previousWindowRenderContext = windowRenderContext;
      windowRenderContext = context;
      try {
        renderWindowContent(contentFrame, id, contentRect);
      } finally {
        windowRenderContext = previousWindowRenderContext;
      }
    },
    afterRenderContent: ({ contentHitStart, viewport, offset }) => {
      if (id === "controls" && dropdownOverlay?.coordinate === "workspace" && dropdownOverlay.kind === "control") {
        dropdownOverlay = {
          ...dropdownOverlay,
          rect: {
            ...dropdownOverlay.rect,
            column: viewport.column + dropdownOverlay.rect.column - offset.columns,
            row: viewport.row + dropdownOverlay.rect.row - offset.rows,
          },
        };
      }
      translateHitTargets(hitTargets, {
        startIndex: contentHitStart,
        columnDelta: viewport.column - offset.columns,
        rowDelta: viewport.row - offset.rows,
        clip: viewport,
      });
    },
    focusAction: (targetId): HitAction => ({ type: "focus", id: targetId }),
    titlebarAction: (targetId, kind) => resolveApiWorkbenchTitlebarHitAction(targetId, kind),
    scrollbarAction: (targetId, axis): HitAction =>
      axis === "vertical" ? { type: "windowVScrollbar", id: targetId } : { type: "windowHScrollbar", id: targetId },
    paint,
    write,
    fillRect,
    writeButton,
    addHit,
  });
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
    renderApiWorkbenchVisualizationMissing({ frame, rect, theme: t, writeRows });
    return;
  }
  const context = buildVisualizationContext(visualizationId, rect, { windowId: id });
  const rendered = renderVisualization(context);
  const accent = rendered.accent === "alarm"
    ? t.danger
    : rendered.accent === "amber"
    ? t.warn
    : rendered.accent === "phosphor"
    ? t.good
    : rendered.accent === "violet"
    ? t.borderStrong
    : t.accent;
  const threeScene = workbenchVisualizationThreeScene({
    scene: rendered.three ?? null,
    available: threeAsciiAvailable.peek(),
    blocked: false,
    width: rect.width,
    height: rect.height,
  });
  if (threeScene) {
    const sceneRect = renderApiWorkbenchVisualizationThreeChrome({
      frame,
      rect,
      option,
      rendered,
      ascii: context.slot.ascii,
      accent,
      theme: t,
      contrastText,
      fit,
      paint,
      write,
      writeRows,
    });
    addHit(sceneRect, { type: "threeViewport", id });
    const entry = visualizationThreePanels.ensure(id);
    const resized = setWorkbenchThreeRect(entry.rectangle, {
      column: 0,
      row: 0,
      width: sceneRect.width,
      height: sceneRect.height,
    });
    setWorkbenchThreeRect(entry.graphicsRectangle, contentRectToGraphicsRect(sceneRect));
    setWorkbenchThreeSceneSignal(entry.scene, threeScene);
    renderedVisualizationThreePanels.add(id);
    const grid = entry.panel.grid.peek();
    if (resized) {
      renderApiWorkbenchThreeSurface({
        frame,
        rect: sceneRect,
        grid,
        theme: t,
        projectionCache: threeGridProjectionCache,
        statusRows: threeStatusRowsBuffer,
        paint,
        center: centerText,
        writeRows,
        scale: true,
        countForPressure: false,
        statusMessage: "renderer resizing",
        onPressureRows: (rows) => workbenchThreeRuntime.recordRenderedGridForPressure(rows),
      });
      scheduleDraw();
      return;
    }
    renderApiWorkbenchThreeSurface({
      frame,
      rect: sceneRect,
      grid,
      theme: t,
      projectionCache: threeGridProjectionCache,
      statusRows: threeStatusRowsBuffer,
      paint,
      center: centerText,
      writeRows,
      scale: true,
      countForPressure: shouldCountWorkbenchThreeGridPressure(grid, entry.panel.inspectPerformance()),
      statusMessage: threeAsciiAvailable.peek() ? "renderer warming up" : "renderer unavailable",
      onPressureRows: (rows) => workbenchThreeRuntime.recordRenderedGridForPressure(rows),
    });
    return;
  }
  visualizationThreePanels.hide(id);
  renderApiWorkbenchVisualizationTextWindow({
    frame,
    rect,
    option,
    rendered,
    accent,
    rows: visualizationRenderRows,
    textRows: visualizationTextRows,
    theme: t,
    contrastText,
    writeRows,
  });
  if (visualizationId === "cpu-hex-grid") {
    addApiWorkbenchCpuHexTileHits({
      id,
      rect,
      cores: context.system.cpuCores,
      width: context.width,
      height: context.height,
      tiles: cpuHexHitTileBuffer,
      addHit,
    });
  }
}

function renderThree(frame: Frame, rect: Rectangle): void {
  const t = theme();
  const mode = threeRendererModeLabel(ascii.peek()).toUpperCase();
  if (threeAsciiAvailable.peek()) {
    const sceneRect = workbenchThreeBodyRect(rect, { headerRows: 3 });
    const resized = setThreeBodyRect(sceneRect);
    const performance = threePanel.inspectPerformance();
    const pressure = workbenchThreeRuntime.inspectPressureDetailsInto(workbenchThreePressureDetails);
    renderApiWorkbenchThreeHeader({
      frame,
      rect,
      mode,
      theme: t,
      rows: workbenchThreeHeaderRows,
      performanceTarget: workbenchThreeHeaderPerformance,
      rendererPerformance: performance,
      sourceMaxCells: workbenchThreeEffectiveMaxCells.peek(),
      frameIntervalMs: workbenchThreeFrameInterval.peek(),
      measuredFps: threeCadence.measuredFps(),
      pressure,
      writeRows,
    });
    addHit(sceneRect, { type: "threeViewport", id: "three" });
    setWorkbenchThreeRect(threeGraphicsRect, contentRectToGraphicsRect(sceneRect));
    const grid = threePanel.grid.peek();
    if (resized) {
      renderApiWorkbenchThreeSurface({
        frame,
        rect: sceneRect,
        grid,
        theme: t,
        projectionCache: threeGridProjectionCache,
        statusRows: threeStatusRowsBuffer,
        paint,
        center: centerText,
        writeRows,
        scale: true,
        countForPressure: false,
        statusMessage: "renderer resizing",
        onPressureRows: (rows) => workbenchThreeRuntime.recordRenderedGridForPressure(rows),
      });
      return;
    }
    renderApiWorkbenchThreeSurface({
      frame,
      rect: sceneRect,
      grid,
      theme: t,
      projectionCache: threeGridProjectionCache,
      statusRows: threeStatusRowsBuffer,
      paint,
      center: centerText,
      writeRows,
      scale: true,
      countForPressure: shouldCountWorkbenchThreeGridPressure(grid, performance),
      statusMessage: threeAsciiAvailable.peek() ? "renderer warming up" : "renderer unavailable",
      onPressureRows: (rows) => workbenchThreeRuntime.recordRenderedGridForPressure(rows),
    });
    return;
  }

  hideBuiltinThreeRects();
  renderApiWorkbenchThreeFallback({
    frame,
    rect,
    terminalGlyphStyle: ascii.peek().terminalGlyphStyle,
    rendererAvailable: threeAsciiAvailable.peek(),
    theme: t,
    rows: threeFallbackRowsBuffer,
    center: centerText,
    writeRows,
  });
}

function renderExplorer(frame: Frame, rect: Rectangle): void {
  const visible = explorer.tree.visibleRows();
  renderApiWorkbenchExplorerPanel({
    frame,
    rect,
    rows: visible,
    selectedIndex: explorer.tree.selectedIndex.peek(),
    renderRows: explorerRenderRows,
    theme: theme(),
    contrastText,
    writeRows,
    addHit,
  });
}

function renderInspector(frame: Frame, rect: Rectangle): void {
  renderApiWorkbenchInspectorPanel({
    frame,
    rect,
    themeLabel: themes[themeIndex.peek()]!.label,
    logs: commandLog.peek(),
    renderRows: inspectorRenderRows,
    actionTextRows: inspectorActionTextRows,
    wrappedTextRows: inspectorWrappedTextRows,
    theme: theme(),
    fit,
    writeRows,
  });
}

function renderData(frame: Frame, rect: Rectangle): void {
  renderApiWorkbenchDataPanel({
    frame,
    rect,
    columns,
    view: () => table.view.peek(),
    sort: () => table.state.peek().sort,
    setPageSize: (pageSize) => table.setPageSize(pageSize),
    buffers: {
      renderRows: dataTableRenderRows,
      textRows: dataTableTextRows,
      bodyRows: dataTableBodyRows,
    },
    theme: theme(),
    fit,
    contrastText,
    writeRows,
    addHit,
  });
}

function renderControls(frame: Frame, rect: Rectangle): void {
  const slider = density.inspect();
  const currentControl = activeControl.peek();
  const result = renderApiWorkbenchControls({
    frame,
    rect,
    state: {
      activeControl: currentControl,
      buttonPressCount: actionButton.pressCount.peek(),
      genericButtonPressCount: genericButton.pressCount.peek(),
      modalOpen: modal.openState.peek(),
      slider: {
        ratio: slider.normalizedValue,
        value: density.value.peek(),
        max: 10,
      },
      checkboxLivePreview: livePreview.checked.peek(),
      checkboxCompactRows: compactRows.checked.peek(),
      radioOptions: modeRadio.options.peek(),
      radioSelectedValue: modeRadio.selectedValue.peek(),
      radioActiveIndex: modeRadio.activeIndex.peek(),
      combo: {
        title: "Theme",
        label: themeCombo.label(),
        expanded: themeCombo.expanded.peek(),
        items: themeCombo.items.peek(),
        selectedIndex: themeCombo.selectedIndex.peek(),
      },
      dropdown: {
        title: "Dropdown",
        label: dropdown.label(),
        expanded: dropdown.expanded.peek(),
        items: dropdown.items.peek(),
        selectedIndex: dropdown.selectedIndex.peek(),
      },
      input: {
        title: "Input",
        text: commandInput.text.peek(),
        active: currentControl === "input",
      },
      stepper: {
        steps: workflowStepper.steps.peek(),
        activeIndex: workflowStepper.activeIndex.peek(),
      },
      progress: {
        ratio: progress.ratio(),
        value: progress.value.peek(),
      },
      textbox: {
        lines: notes.lines.peek(),
        cursor: notes.cursorPosition.peek(),
      },
    },
    buffers: controlViewBuffers,
    theme: theme(),
    contrastText,
    fit,
    paint,
    write,
    addHit,
  });
  if (result.dropdownOverlay) dropdownOverlay = result.dropdownOverlay;
}

function renderLogs(frame: Frame, rect: Rectangle): void {
  renderApiWorkbenchLogsPanel({
    frame,
    rect,
    sources: [docs, commandLog.peek()],
    renderRows: logRenderRows,
    theme: theme(),
    writeRows,
  });
}

function renderTerminalOutput(frame: Frame, rect: Rectangle): void {
  const t = theme();
  fillRect(frame, rect, t.surface);
  const inspection = terminalOutputSession.inspect();
  let row = rect.row;
  row = renderTerminalOutputToolbar(frame, rect, row);
  if (row >= rect.row + rect.height) return;

  const outputHeight = Math.max(0, rect.row + rect.height - row - 2);
  renderApiWorkbenchTerminalOutputBody({
    frame,
    rect,
    startRow: row,
    inspection,
    inputMode: terminalInputMode.peek(),
    lines: terminalOutputSession.output.visible(outputHeight),
    rows: terminalOutputWindowRows,
    theme: t,
    contrastText,
    fit,
    paint,
    write,
  });
}

function renderTerminalOutputToolbar(frame: Frame, rect: Rectangle, startRow: number): number {
  return renderApiWorkbenchTerminalOutputToolbar({
    frame,
    rect,
    startRow,
    state: {
      running: terminalOutputSession.running,
      outputLineCount: terminalOutputSession.output.lines.peek().length,
      follow: terminalOutputSession.output.follow.peek(),
      inputMode: terminalInputMode.peek(),
    },
    buffers: terminalOutputButtonBuffers,
    theme: theme(),
    contrastText,
    paint,
    write,
    addHit,
  });
}

function toggleTerminalInputMode(): void {
  const next = resolveWorkbenchTerminalProcessInputModeToggle({
    mode: terminalInputMode.peek(),
    running: terminalOutputSession.running,
  });
  if (next.changed) terminalInputMode.value = next.mode;
  pushLog(next.message);
}

function renderTerminalShell(frame: Frame, rect: Rectangle): void {
  const t = theme();
  fillRect(frame, rect, t.surface);
  let row = rect.row;
  row = renderTerminalShellToolbar(frame, rect, row);
  if (row >= rect.row + rect.height) return;

  const shell = activeTerminalShell();
  const inspection = shell?.inspect();
  if (!inspection || !shell) {
    write(
      frame,
      row,
      rect.column,
      paint(fit("No active shell session. Press [New] to create one.", rect.width), {
        fg: t.muted,
        bg: t.surface,
      }),
    );
    return;
  }
  const copyMode = inspection.scrollback.mode === "copy";
  row = renderApiWorkbenchTerminalShellHeader({
    frame,
    rect,
    startRow: row,
    inspection,
    inputMode: terminalShellInputMode.peek(),
    copyMode,
    rows: terminalShellHeaderRows,
    theme: t,
    contrastText,
    fit,
    paint,
    write,
  });

  const bodyRect = {
    column: rect.column,
    row,
    width: rect.width,
    height: Math.max(0, rect.row + rect.height - row),
  };
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

  renderApiWorkbenchTerminalShellPanes({
    frame,
    rect: bodyRect,
    inspection: terminalShell.inspect(),
    activeShell: activeTerminalShell(),
    shellForSession: (sessionId) => terminalShell.shell(sessionId),
    copyMode,
    rawInputActive: activeWindow.peek() === TERMINAL_SHELL_WINDOW_ID && terminalShellInputMode.peek() === "raw",
    buffers: terminalShellBuffers,
    theme: t,
    contrastText,
    fit,
    paint,
    write,
    fillRect,
    addHit,
  });
}

function renderTerminalShellToolbar(frame: Frame, rect: Rectangle, startRow: number): number {
  const workspaceInspection = terminalShell.inspect();
  const shell = activeTerminalShell();
  const shellInspection = shell?.inspect();
  const nextRow = renderApiWorkbenchTerminalShellToolbar({
    frame,
    rect,
    startRow,
    state: workbenchTerminalToolbarStateFromSnapshot({
      activeId: workspaceInspection.activeId,
      sessionCount: workspaceInspection.sessions.length,
      paneCount: workspaceInspection.workspace.layout.count,
      zoomedPaneId: workspaceInspection.workspace.layout.zoomedPaneId,
      shellRunning: shell?.running,
      shellStarting: shell?.status.peek() === "starting",
      inputMode: terminalShellInputMode.peek(),
      copyMode: shell?.scrollback.mode === "copy",
      scrollback: shellInspection?.scrollback,
    }),
    buffers: terminalShellButtonBuffers,
    theme: theme(),
    contrastText,
    paint,
    write,
    addHit,
  });
  return renderTerminalShellSessionTabs(frame, rect, nextRow, workspaceInspection);
}

function toggleTerminalShellInputMode(): void {
  const next = resolveWorkbenchTerminalShellInputModeToggle({
    mode: terminalShellInputMode.peek(),
    running: activeTerminalShell()?.running === true,
  });
  if (next.changed) terminalShellInputMode.value = next.mode;
  pushLog(next.message);
}

function openTerminalShellSearchModal(): void {
  const shell = activeTerminalShell();
  if (!shell) {
    pushLog("shell search unavailable");
    return;
  }
  focus(TERMINAL_SHELL_WINDOW_ID);
  terminalShellInputMode.value = "workbench";
  terminalShellSearchDraft.value = shell.scrollback.inspect().query ?? terminalShellSearchDraft.peek();
  terminalShellSearchPromptOpen.value = true;
  modal.open({
    title: "Search Shell Scrollback",
    tone: "info",
    body: terminalShellSearchModalBody(),
    actions: [
      { id: "terminal-search-cancel", label: "Cancel" },
      { id: "terminal-search-run", label: "Search", default: true },
    ],
  });
  pushLog("shell search prompt");
}

function terminalShellSearchModalBody(): string[] {
  const shell = activeTerminalShell();
  return workbenchTerminalSearchModalBody({
    query: terminalShellSearchDraft.peek(),
    scrollback: shell?.scrollback.inspect(),
  });
}

function refreshTerminalShellSearchModal(): void {
  if (!terminalShellSearchPromptOpen.peek() || !modal.openState.peek()) return;
  modal.update({ body: terminalShellSearchModalBody() });
}

function closeTerminalShellSearchModal(): void {
  terminalShellSearchPromptOpen.value = false;
  modal.close();
}

function handleTerminalShellSearchKey(event: { key: string; ctrl?: boolean; meta?: boolean }): boolean {
  const input = applyWorkbenchTerminalSearchPromptInput({
    event,
    value: terminalShellSearchDraft.peek(),
  });
  switch (input.action) {
    case "ignore":
      return false;
    case "cancel":
      closeTerminalShellSearchModal();
      pushLog("shell search cancelled");
      return true;
    case "submit":
      runTerminalShellSearch();
      return true;
    case "update":
      terminalShellSearchDraft.value = input.value;
      refreshTerminalShellSearchModal();
      return true;
  }
}

function runTerminalShellSearch(): void {
  const shell = activeTerminalShell();
  const query = terminalShellSearchDraft.peek();
  if (!shell) {
    closeTerminalShellSearchModal();
    pushLog("shell search unavailable");
    return;
  }
  const matches = shell.scrollback.search(query);
  terminalShellInputMode.value = "workbench";
  terminalShellSearchPromptOpen.value = false;
  modal.close();
  pushLog(matches.length > 0 ? `shell search ${matches.length} hits` : "shell search no matches");
  scheduleDraw();
}

function moveTerminalShellSearchMatch(delta: number): void {
  const shell = activeTerminalShell();
  if (!shell) return;
  const row = shell.scrollback.nextMatch(delta);
  terminalShellInputMode.value = "workbench";
  pushLog(row === undefined ? "shell search no matches" : `shell search row ${row + 1}`);
  scheduleDraw();
}

function activeTerminalShell(): TerminalShellController | undefined {
  return terminalShell.activeShell;
}

function addSplitTerminalShell(direction: "row" | "column") {
  const draft = nextApiWorkbenchTerminalSessionDraft(terminalShell.inspect().sessions);
  const descriptor = terminalShell.add(shellTerminalTemplate(draft), {
    activate: false,
  });
  terminalShell.workspace.splitActive(direction, descriptor.id, { title: descriptor.title });
  terminalShell.activate(descriptor.id);
  void terminalShell.start(descriptor.id).then(() => scheduleDraw());
  return descriptor;
}

function renderTerminalShellSessionTabs(
  frame: Frame,
  rect: Rectangle,
  startRow: number,
  inspection = terminalShell.inspect(),
): number {
  return renderApiWorkbenchTerminalSessionTabs({
    frame,
    rect,
    startRow,
    inspection,
    buffers: terminalShellSessionTabBuffers,
    theme: theme(),
    contrastText,
    paint,
    write,
    addHit,
  });
}

function renderHtmlCssLayout(frame: Frame, rect: Rectangle): void {
  renderApiWorkbenchHtmlCssLayout({
    frame,
    rect,
    boxes: htmlCssLayoutBoxes,
    commands: htmlCssLayoutRenderCommands,
    theme: theme(),
    contrastText,
    fit,
    paint,
    write,
    fillRect,
  });
}

function renderShelf(frame: Frame): void {
  const row = currentHeight() - 2;
  renderApiWorkbenchShelf({
    frame,
    row,
    column: 1,
    width: Math.max(0, currentWidth() - 1),
    windows: windowManager.inspect().windows,
    buffers: shelfBuffers,
    theme: theme(),
    titleForId: windowTitle,
    paint,
    write,
    writeButton,
    addHit,
  });
}

function renderWindowTabs(frame: Frame): void {
  const row = currentHeight() - 2;
  renderApiWorkbenchWindowTabs({
    frame,
    row,
    column: 1,
    width: Math.max(0, currentWidth() - 1),
    tabs: windowManager.inspect().tabs,
    buffers: shelfBuffers,
    theme: theme(),
    titleForId: windowTitle,
    paint,
    write,
    fillRow,
    writeButton,
    addHit,
  });
}

function renderStatus(frame: Frame): void {
  const width = currentWidth();
  renderApiWorkbenchStatus({
    frame,
    row: currentHeight() - 1,
    width,
    focus: windowTitle(activeWindow.peek()),
    themeLabel: theme().label,
    tileDensity: tileDensity.peek(),
    diagnostics: formatWorkbenchDiagnosticStatus(workbenchDiagnostics),
    theme: theme(),
    paint,
    write,
  });
}

function renderActiveDropdownOverlay(frame: Frame): void {
  const bounds = { column: 0, row: 3, width: currentWidth(), height: Math.max(0, currentHeight() - 5) };
  renderApiWorkbenchDropdownOverlay({
    frame,
    overlay: dropdownOverlay,
    workspaceBounds: bounds,
    screenBounds: { column: 0, row: 0, width: currentWidth(), height: currentHeight() },
    workspaceOffsetRows: workspaceScroll.offset.peek().rows,
    commands: dropdownOverlayRenderCommands,
    theme: theme(),
    paint,
    write,
    fillRect,
    addHit,
  });
}

function renderModalOverlay(frame: Frame): void {
  if (threeConfigOpen.peek()) {
    renderThreeConfigModal(frame);
    return;
  }
  if (!modal.openState.peek()) return;

  const screen = { column: 0, row: 0, width: currentWidth(), height: currentHeight() };
  renderApiWorkbenchModalOverlay({
    frame,
    bounds: screen,
    inspection: modal.inspect(),
    buffers: modalBuffers,
    theme: theme(),
    contrastText,
    fit,
    paint,
    write,
    fillRect,
    drawFrame,
    addHit,
  });
}

type ThreeConfigRow = WorkbenchAsciiConfigRow;

const threeConfigRows: readonly ThreeConfigRow[] = defaultWorkbenchAsciiConfigRows;
const threeConfigBuffers = new WorkbenchAsciiConfigModalBufferCache<ThreeConfigRow>();

function renderThreeConfigModal(frame: Frame): void {
  const screen = { column: 0, row: 0, width: currentWidth(), height: currentHeight() };
  const current = configuredAscii().peek();
  renderApiWorkbenchThreeConfigModal({
    frame,
    bounds: screen,
    rows: threeConfigRows,
    selectedIndex: threeConfigSelected.peek(),
    title: formatWorkbenchAsciiConfigTitle(windowTitle(configuredAsciiWindow()), current),
    buffers: threeConfigBuffers,
    theme: theme(),
    contrastText,
    fit,
    paint,
    write,
    fillRect,
    drawFrame,
    rowText: threeConfigRowText,
    addHit,
  });
}

function threeConfigRowText(row: ThreeConfigRow): string {
  const current = configuredAscii().peek();
  return formatWorkbenchAsciiConfigRowText(row, current, {
    kittyStatus: formatWorkbenchKittyGraphicsStatus({
      selected: current,
      tmux: kittyGraphics.tmux,
      tmuxPassthroughAllowed: kittyGraphics.tmuxPassthroughAllowed,
      surface: kittyGraphics.surfaceFor(current).inspect(),
    }),
  });
}

function applyThreeConfigRow(index: number, action: ConfigHitAction = "activate"): void {
  if (index < 0) {
    applyThreeConfigModalAction("cancel");
    return;
  }
  const row = threeConfigRows[index];
  if (!row) return;
  threeConfigSelected.value = index;
  const next = applyWorkbenchAsciiConfigRowAction(configuredAscii().peek(), row, action, ASCII_DEMO_PRESET_IDS);
  setConfiguredAscii(next.options, `three config ${next.message}`, { persist: false });
}

function drawFrame(frame: Frame, rect: Rectangle, title: string, active: boolean): void {
  renderApiWorkbenchWindowFrame({
    frame,
    rect,
    title,
    active,
    theme: theme(),
    buffers: windowShellBuffers,
    paint,
    write,
    fillRect,
  });
}

function workspaceLayout(bounds: Rectangle): {
  bounds: Rectangle;
  contentHeight: number;
  rects: Map<WindowId, Rectangle>;
} {
  const active = activeWindow.peek();
  return workbenchAdaptiveWindowLayout<WindowId>(windowManager, {
    bounds,
    tileDensity: tileDensity.peek(),
    featuredId: isThreeRenderedWindow(active) ? active : undefined,
    featuredMinWidth: 96,
    featuredMinHeight: 18,
    featuredHeightRatio: 0.62,
  });
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
  const outputLines = terminalOutputSession.output.lines.peek();
  return workbenchWindowContentSize({
    id,
    viewport,
    docs,
    explorerRows: explorerTextRowsInto(explorerContentTextRows, explorer.entries(), (entry) => entry.text),
    dataColumns: columns,
    dataRowCount: rows.length,
    terminalOutputLines: workbenchTerminalOutputRowsInto(terminalOutputContentRows, outputLines, {
      sourcePrefix: true,
    }),
    terminalOutputWindowId: TERMINAL_OUTPUT_WINDOW_ID,
    terminalShellWindowId: TERMINAL_SHELL_WINDOW_ID,
    isVisualizationWindow: (candidate) => isVisualizationWindow(candidate as WindowId),
    visualizationContentSize: (candidate, bounds, baseWidth, baseHeight) =>
      visualizationWindowContentSize(candidate as VisualizationWindowId, bounds, baseWidth, baseHeight),
  });
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
  if (threeAsciiAvailable.peek() && visualizationUsesThreeRenderer(visualizationId)) {
    return { width: baseWidth, height: baseHeight };
  }

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
  return visualizationTextContentSize(rendered, baseWidth, baseHeight);
}

function visualizationTextContentSize(
  rendered: PanelRender,
  baseWidth: number,
  baseHeight: number,
): { width: number; height: number } {
  let rowCount = 3;
  let width = Math.max(baseWidth, rendered.footer.trimEnd().length);
  let start = 0;
  for (let index = 0; index <= rendered.body.length; index += 1) {
    if (index < rendered.body.length && rendered.body[index] !== "\n") continue;
    width = Math.max(width, rendered.body.slice(start, index).trimEnd().length);
    rowCount += 1;
    start = index + 1;
  }
  return {
    width,
    height: Math.max(baseHeight, rowCount),
  };
}

function threeRendererModeLabel(options: AsciiOptions): string {
  return workbenchAsciiRendererModeLabel(options, terminalGlyphStyleLabel);
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
    ? resolveSourceFramesInto(
      realSourceFrameBuffer,
      monitorSourceIdsInto(realSourceIdBuffer, visualizationId),
      system,
      workbenchAudioRegistry,
      phase,
    )
    : syntheticWorkbenchSourcesInto(
      syntheticSourceFrameBuffer,
      visualizationId,
      option?.group ?? "Monitor",
      phase,
    );
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

function createVisualizationThreePanel(id: VisualizationWindowId): DynamicThreePanel {
  const rectangle = new Signal<Rectangle>({ column: 0, row: 0, width: 0, height: 0 }, { deepObserve: true });
  const graphicsRectangle = new Signal<Rectangle>({ column: 0, row: 0, width: 0, height: 0 }, { deepObserve: true });
  const scene = new Signal<WorkbenchThreeScene | null>(null);
  const runtimeAscii = new Computed<AsciiOptions>(() => {
    const savedAscii = asciiForWindow(id).value;
    const fullscreenId = maximized.value;
    if (fullscreenId === id) {
      return resolveWorkbenchThreeFullscreenAsciiOptions({
        id,
        fullscreenId,
        ascii: savedAscii,
        fullscreenMinCells: workbenchThreeFullscreenTargetCells.value,
      });
    }
    return resolveWorkbenchThreeTiledAsciiOptions({
      ascii: savedAscii,
      liveViewport: rectangle.value,
      liveMaxCells: workbenchThreeLiveMaxCells.value,
    });
  });
  const panel = createWorkbenchThreePanelFrameView({
    rectangle,
    graphicsRectangle,
    scene,
    ascii: runtimeAscii,
    enabled: threeAsciiAvailable,
    graphicsSurface: () => kittyGraphics.surfaceFor(asciiForWindow(id).peek()),
    frameInterval: workbenchThreeFrameInterval,
    idleFrameInterval: workbenchThreeIdleFrameInterval,
    interactive: () => workbenchThreeWindowStateIsInteractive(workbenchThreeWindowState, id),
    maxRenderCells: workbenchThreeEffectiveMaxCells,
    diagnostics: workbenchDiagnostics,
    onFrame: () => {
      threeCadence.record();
      scheduleDraw();
    },
    onUpdate: scheduleDraw,
  });
  return { rectangle, graphicsRectangle, scene, panel, resources: [runtimeAscii] };
}

function syncWorkbenchThreeWindowState(): WorkbenchThreeWindowState<WindowId> {
  return resolveWorkbenchThreeWindowStateInto(workbenchThreeWindowState, {
    activeId: activeWindow.peek(),
    fullscreenId: windowManager.fullscreenId.peek() as WindowId | undefined,
    windows: windowManager.orderedWindows(),
    isThreeWindow: (id) => isThreeRenderedWindow(id as WindowId),
    blocked: genericModalBlocksThree.peek(),
  });
}

function hideVisualizationThreePanelsExcept(visibleIds: ReadonlySet<VisualizationWindowId>): void {
  visualizationThreePanels.hideExcept(visibleIds);
}

function disposeVisualizationThreePanel(id: VisualizationWindowId): void {
  visualizationThreePanels.dispose(id);
}

function setThreeBodyRect(rect: Rectangle): boolean {
  const changed = setWorkbenchThreeRect(threeBodyRect, {
    column: 0,
    row: 0,
    width: rect.width,
    height: rect.height,
  });
  if (!changed) return false;
  threeCadence.reset();
  workbenchThreeRuntime.resetPressureCounters();
  syncWorkbenchThreeRuntimeBudgetForViewport(currentWidth(), currentHeight(), rect);
  scheduleDraw();
  return true;
}

function hideBuiltinThreeRects(): void {
  hideWorkbenchThreeRect(threeBodyRect);
  hideWorkbenchThreeRect(threeGraphicsRect);
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

function applyThreeConfigModalAction(action: WorkbenchAsciiConfigModalAction): void {
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
  return apiWorkbenchVisualizationSupportsThree(
    visualizationThreeSupport,
    visualizationId,
    probeVisualizationThreeSupport,
  );
}

function probeVisualizationThreeSupport(visualizationId: string): PanelRender {
  return renderVisualization(
    buildVisualizationContext(visualizationId, {
      column: 0,
      row: 0,
      width: 48,
      height: 16,
    }),
  );
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
  return workbenchThreeContentGraphicsRect(rect, {
    window: windowRenderContext,
    workspace: workspacePlacementContext,
  });
}

function renderWorkspaceScrollbar(frame: Frame, bounds: Rectangle): void {
  const overflow = workspaceScroll.inspectOverflow();
  const t = theme();
  const commands = workbenchWorkspaceScrollbarRenderCommandsInto(workspaceScrollbarRenderCommands, {
    bounds,
    visible: overflow.rows.scrollbarVisible,
    thumb: overflow.rows.thumb,
  });
  for (const command of commands) {
    addHit(command.rect, { type: "workspaceScrollbar" });
    for (const cell of command.cells) {
      write(frame, cell.row, cell.column, paint(cell.glyph, { fg: t.accent, bg: t.backgroundSoft, bold: true }));
    }
  }
}

function scrollWindow(id: WindowId, columns: number, rows: number): void {
  windowScroll(id).scrollBy(columns, rows);
}

function focus(id: WindowId): void {
  windowManager.focus(id);
  syncAndLogWindowAction("focus", id);
}

function focusNext(): void {
  const next = windowManager.focusNext(1)?.id as WindowId | undefined;
  if (next) syncAndLogWindowAction("focus", next);
}

function focusPrevious(): void {
  const next = windowManager.focusNext(-1)?.id as WindowId | undefined;
  if (next) syncAndLogWindowAction("focus", next);
}

function minimize(id: WindowId): void {
  windowManager.minimize(id);
  syncAndLogWindowAction("minimize", id);
}

function toggleMaximize(id: WindowId): void {
  windowManager.fullscreen(id);
  syncWindowSignalsFromManager();
  pushLog(workbenchWindowActionLog(maximized.peek() === id ? "maximize" : "restore", windowTitle(id)));
}

function restoreAll(): void {
  windowManager.restore();
  syncWindowSignalsFromManager();
  pushLog("restore all windows");
}

function syncAndLogWindowAction(kind: WorkbenchWindowActionLogKind, id: WindowId): void {
  syncWindowSignalsFromManager();
  pushLog(workbenchWindowActionLog(kind, windowTitle(id)));
}

function syncWindowSignalsFromManager(): void {
  const state = inspectWorkbenchWindowSignalState<WindowId>(windowManager, {
    windowIds: windowManager.ids({ includeClosed: true }) as WindowId[],
    defaultActiveId: "explorer",
  });
  activeWindow.value = state.activeId ?? "explorer";
  maximized.value = state.fullscreenId ?? null;
  minimized.value = state.minimized;
}

function adjustTileDensity(delta: number): void {
  tileDensity.value = clampWorkbenchTileDensity(tileDensity.peek() + delta);
  pushLog(`tile density ${tileDensity.peek()}`);
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
  workspaceNameDraft.value = defaultWorkspaceNameFromCount(savedWorkspaces.peek().length);
  modal.open(saveWorkspaceModalContent(workspaceNameModalBody()));
  pushLog("save workspace prompt");
}

function openRenameWorkspaceModal(workspace: SavedWorkspace): void {
  closeTopMenus();
  workspaceNameMode.value = "rename";
  workspaceTargetName.value = workspace.name;
  workspaceNameDraft.value = workspace.name;
  modal.open(renameWorkspaceModalContent(workspaceNameModalBody()));
  pushLog(`rename workspace prompt ${workspace.name}`);
}

function openDeleteWorkspaceModal(workspace: SavedWorkspace): void {
  closeTopMenus();
  workspaceNameMode.value = null;
  workspaceTargetName.value = workspace.name;
  modal.open(deleteWorkspaceModalContent(workspace));
  pushLog(`delete workspace prompt ${workspace.name}`);
}

function workspaceNameModalBody(): string[] {
  const mode = workspaceNameMode.peek();
  return buildWorkspaceNameModalBody({
    mode: mode === "rename" ? "rename" : "save",
    draftName: workspaceNameDraft.peek(),
    cursor: mode ? "▌" : "",
    loadedVisualizationIds: workspaceVisualizationIdsFromWindowsInto(
      currentWorkspaceVisualizationIdBuffer,
      currentWorkspaceWindows(),
    ),
    storageLabel: apiWorkbenchWorkspaceStorageLabel(),
    targetName: workspaceTargetName.peek(),
    targetWorkspace: workspaceByName(workspaceTargetName.peek()) ?? null,
  });
}

function refreshWorkspaceNameModal(): void {
  if (!workspaceNameMode.peek() || !modal.openState.peek()) return;
  modal.update({ body: workspaceNameModalBody() });
}

function handleWorkspaceNameKey(event: { key: string; ctrl?: boolean; meta?: boolean }): boolean {
  return dispatchWorkbenchTextPromptInput({
    event,
    value: workspaceNameDraft.peek(),
    maxLength: 48,
    measureText: textWidth,
  }, {
    onCancel: () => {
      clearWorkspaceModalState();
      modal.close();
    },
    onSubmit: () => {
      if (workspaceNameMode.peek() === "rename") void renameWorkspace();
      else void saveCurrentWorkspace();
    },
    onUpdate: (value) => {
      workspaceNameDraft.value = value;
      refreshWorkspaceNameModal();
    },
  });
}

async function saveCurrentWorkspace(): Promise<void> {
  const result = saveWorkspaceState({
    workspaces: savedWorkspaces.peek(),
    draftName: workspaceNameDraft.peek(),
    windows: currentWorkspaceWindows(),
  });
  savedWorkspaces.value = result.workspaces;
  await persistSavedWorkspaces();
  activeWorkspaceName.value = result.name;
  clearWorkspaceModalState();
  modal.open(workspaceSavedModalContent(result.name, result.visualizationIds.length));
  pushLog(`workspace saved ${result.name}`);
}

async function renameWorkspace(): Promise<void> {
  const result = renameWorkspaceState({
    workspaces: savedWorkspaces.peek(),
    targetName: workspaceTargetName.peek(),
    draftName: workspaceNameDraft.peek(),
    activeWorkspaceName: activeWorkspaceName.peek(),
  });
  if (result.status === "missing") {
    clearWorkspaceModalState();
    modal.open(workspaceMissingModalContent(result.targetName));
    return;
  }

  savedWorkspaces.value = result.workspaces;
  await persistSavedWorkspaces();
  activeWorkspaceName.value = result.activeWorkspaceName ?? null;
  clearWorkspaceModalState();
  modal.open(workspaceRenamedModalContent(result.previousName, result.name, result.visualizationCount));
  pushLog(`workspace renamed ${result.previousName} -> ${result.name}`);
}

async function deleteWorkspace(): Promise<void> {
  const result = deleteWorkspaceState({
    workspaces: savedWorkspaces.peek(),
    targetName: workspaceTargetName.peek(),
    activeWorkspaceName: activeWorkspaceName.peek(),
  });
  if (result.status === "missing") {
    clearWorkspaceModalState();
    modal.close();
    return;
  }
  savedWorkspaces.value = result.workspaces;
  await persistSavedWorkspaces();
  activeWorkspaceName.value = result.activeWorkspaceName ?? null;
  clearWorkspaceModalState();
  modal.open(workspaceDeletedModalContent(result.name));
  pushLog(`workspace deleted ${result.name}`);
}

function clearWorkspaceModalState(): void {
  workspaceNameMode.value = null;
  workspaceTargetName.value = null;
}

function applyWorkspaceMenuItem(index: number): void {
  const command = resolveWorkspaceMenuCommand(workspaceMenuEntries()[index], workspaceByName);
  switch (command.action) {
    case "save":
      return openSaveWorkspaceModal();
    case "open":
      return loadWorkspace(command.workspace);
    case "rename":
      return openRenameWorkspaceModal(command.workspace);
    case "delete":
      return openDeleteWorkspaceModal(command.workspace);
    case "none":
      return;
  }
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
  const plan = workspaceLoadClosePlan({
    windowIds: windowManager.ids() as WindowId[],
    isVisualizationWindow,
    selectedVisualizationTiles: selectedCpuHexTiles.peek(),
  });
  if (plan.windowIds.length === 0) return;

  for (const id of plan.visualizationWindowIds) {
    disposeVisualizationThreePanel(id);
    disposeAsciiForWindow(id);
  }
  for (const id of plan.windowIds) {
    windowManager.close(id);
    windowContentFrames.delete(id);
  }
  if (plan.selectedVisualizationTilesChanged) {
    selectedCpuHexTiles.value = plan.selectedVisualizationTiles as Record<VisualizationWindowId, string>;
  }
  syncWindowSignalsFromManager();
  pushLog(`closed ${plan.windowIds.length} window(s) for workspace load`);
}

function workspaceMenuEntries(): WorkspaceMenuEntry[] {
  return buildWorkspaceMenuEntriesInto(workspaceMenuEntryBuffer, savedWorkspaces.peek());
}

function workspaceMenuItemCount(): number {
  return workspaceMenuEntries().length;
}

function currentWorkspaceWindows(): SavedWorkspaceWindow[] {
  const dynamicWindows = dynamicVisualizationWindows.peek();
  return currentWorkspaceWindowsFromIdsInto(currentWorkspaceWindowBuffer, {
    windowIds: windowManager.ids() as WindowId[],
    isVisualizationWindow,
    visualizationIdForWindow: (windowId) => isVisualizationWindow(windowId) ? dynamicWindows[windowId] : undefined,
    asciiForWindow: (windowId) => cloneAsciiOptions(asciiForWindow(windowId).peek()),
  });
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
  savedWorkspaces.value = saveWorkspaceState({
    workspaces: savedWorkspaces.peek(),
    draftName: workspace.name,
    windows: currentWorkspaceWindows(),
  }).workspaces;
  await persistSavedWorkspaces();
}

async function persistSavedWorkspaces(): Promise<void> {
  await persistWorkbenchWorkspaceStorage(savedWorkspaces.peek(), workspaceStorageOptions());
}

function workspaceStorageOptions() {
  return apiWorkbenchWorkspaceStorageOptions<AsciiOptions>({
    key: WORKSPACE_STORE_KEY,
    store: workspaceStore,
    validVisualizationIds: visualizationWindowOptionIds,
    normalizeAscii: (candidate) =>
      candidate ? normalizeAsciiOptions(candidate as AsciiOptions, createDefaultWorkbenchAsciiOptions()) : undefined,
    diagnostics: workbenchDiagnostics,
  });
}

function openWorkbenchModal(): void {
  modal.open(workbenchDemoModalContent({ profile: "terminal" }));
  pushLog("modal opened");
}

function openQuitModal(): void {
  closeTopMenus();
  threeConfigOpen.value = false;
  modal.open(workbenchQuitModalContent({ profile: "terminal" }));
  pushLog("quit confirmation");
}

function openHelpModal(): void {
  modal.open(workbenchHelpModalContent({ profile: "terminal" }));
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
  if (actionId === "terminal-search-run") {
    runTerminalShellSearch();
    return;
  }
  if (actionId === "terminal-search-cancel") {
    closeTerminalShellSearchModal();
    pushLog("shell search cancelled");
    return;
  }
  if (actionId === "details") {
    modal.open(workbenchModalDetailsContent({ profile: "terminal" }));
    pushLog("modal details");
    return;
  }
  if (actionId === "back") {
    openWorkbenchModal();
    return;
  }
  if (actionId === "confirm") {
    modal.open(workbenchModalConfirmedContent({ profile: "terminal" }));
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
  else if (action.type === "windowTab") {
    windowManager.selectTab(action.id);
    syncAndLogWindowAction("fullscreenTab", action.id);
  } else if (action.type === "focus") focus(action.id);
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
  } else if (action.type === "terminalShellPane") {
    if (terminalShell.workspace.activatePane(action.id)) {
      terminalShellInputMode.value = activeTerminalShell()?.running ? "raw" : "workbench";
      focus(TERMINAL_SHELL_WINDOW_ID);
      pushLog("shell pane active");
    }
  } else if (action.type === "terminalShellSession") {
    if (terminalShell.activate(action.id)) {
      const session = terminalShell.inspect().sessions.find((entry) => entry.id === action.id);
      terminalShellInputMode.value = session?.shell.running ? "raw" : "workbench";
      focus(TERMINAL_SHELL_WINDOW_ID);
      pushLog(`shell active ${session?.title ?? action.id}`);
    }
  } else if (action.type === "terminalShellCopyRow") {
    const shell = activeTerminalShell();
    if (shell?.scrollback.setSelection(action.index)) {
      terminalShellInputMode.value = "workbench";
      focus(TERMINAL_SHELL_WINDOW_ID);
      pushLog(`shell selected row ${action.index + 1}`);
    }
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
    const next = resolveApiWorkbenchWindowVScrollbarOffset({
      contentHeight: scroll.contentHeight.peek(),
      viewportHeight: scroll.viewportHeight.peek(),
      currentColumns: scroll.offset.peek().columns,
      pointerRow: y - target.rect.row,
    });
    scroll.scrollTo(next.columns, next.rows);
    windowManager.focus(action.id);
    syncWindowSignalsFromManager();
  } else if (action.type === "windowHScrollbar") {
    const scroll = windowScroll(action.id);
    const next = resolveApiWorkbenchWindowHScrollbarOffset({
      contentWidth: scroll.contentWidth.peek(),
      viewportWidth: scroll.viewportWidth.peek(),
      currentRows: scroll.offset.peek().rows,
      pointerColumn: x - target.rect.column,
    });
    scroll.scrollTo(next.columns, next.rows);
    windowManager.focus(action.id);
    syncWindowSignalsFromManager();
  } else if (action.type === "workspaceScrollbar") {
    const next = resolveApiWorkbenchWorkspaceScrollbarOffset({
      contentHeight: workspaceScroll.contentHeight.peek(),
      viewportHeight: target.rect.height,
      pointerRow: y - target.rect.row,
    });
    workspaceScroll.scrollTo(next.columns, next.rows);
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
  const shell = activeTerminalShell();
  if (action === "new") {
    const descriptor = terminalShell.add(
      shellTerminalTemplate(nextApiWorkbenchTerminalSessionDraft(terminalShell.inspect().sessions)),
      {
        activate: true,
        start: true,
      },
    );
    terminalShellInputMode.value = "raw";
    pushLog(`shell add ${descriptor.title}`);
  } else if (action === "previous") {
    const descriptor = terminalShell.activateRelative(-1);
    pushLog(descriptor ? `shell active ${descriptor.title}` : "shell previous unavailable");
  } else if (action === "next") {
    const descriptor = terminalShell.activateRelative(1);
    pushLog(descriptor ? `shell active ${descriptor.title}` : "shell next unavailable");
  } else if (action === "close") {
    const activeId = terminalShell.inspect().activeId;
    if (activeId) {
      await terminalShell.remove(activeId);
      terminalShellInputMode.value = activeTerminalShell()?.running ? "raw" : "workbench";
      pushLog("shell session closed");
    }
  } else if (action === "splitRow" || action === "splitColumn") {
    const descriptor = addSplitTerminalShell(action === "splitRow" ? "row" : "column");
    if (descriptor) {
      terminalShellInputMode.value = "raw";
      pushLog(`shell split ${descriptor.title}`);
    }
  } else if (action === "zoomPane") {
    const paneId = terminalShell.workspace.inspectLayout().activePaneId;
    if (paneId) {
      terminalShell.workspace.toggleZoomPane(paneId);
      pushLog("shell pane zoom");
    }
  } else if (action === "closePane") {
    const paneId = terminalShell.workspace.inspectLayout().activePaneId;
    if (paneId && terminalShell.workspace.inspectLayout().count > 1) {
      terminalShell.workspace.closePane(paneId);
      terminalShellInputMode.value = activeTerminalShell()?.running ? "raw" : "workbench";
      pushLog("shell pane closed");
    }
  } else if (action === "start") {
    await terminalShell.start();
    activeTerminalShell()?.scrollback.exitCopyMode();
    terminalShellInputMode.value = "raw";
    pushLog("shell start");
  } else if (action === "stop") {
    await terminalShell.stop();
    terminalShellInputMode.value = "workbench";
    pushLog("shell stop");
  } else if (action === "restart") {
    await terminalShell.restart();
    activeTerminalShell()?.scrollback.exitCopyMode();
    terminalShellInputMode.value = "raw";
    pushLog("shell restart");
  } else if (action === "clear") {
    shell?.clear();
    shell?.scrollback.exitCopyMode();
    pushLog("shell clear");
  } else if (action === "raw") {
    toggleTerminalShellInputMode();
  } else if (action === "copy") {
    if (shell?.scrollback.mode === "copy") {
      shell.scrollback.exitCopyMode();
      pushLog("shell copy mode off");
    } else if (shell) {
      shell.scrollback.enterCopyMode();
      terminalShellInputMode.value = "workbench";
      pushLog("shell copy mode on");
    }
  } else if (action === "search") {
    openTerminalShellSearchModal();
  } else if (action === "previousMatch") {
    moveTerminalShellSearchMatch(-1);
  } else if (action === "nextMatch") {
    moveTerminalShellSearchMatch(1);
  } else if (action === "top") {
    shell?.scrollback.toTop();
    terminalShellInputMode.value = "workbench";
    pushLog("shell scroll top");
  } else if (action === "bottom") {
    shell?.scrollback.toBottom();
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
  const global = resolveWorkbenchGlobalKey(event, { activeWindowId: activeWindow.peek() });
  const globalHandled = applyWorkbenchGlobalKeyAction(global, { phase: "primary" });
  if (globalHandled) return;
  if (event.ctrl || event.meta) return;

  if (handleCpuHexGridKey(event)) return;
  if (applyWorkbenchGlobalKeyAction(global, { phase: "preWindow" })) return;
  if (activeWindow.peek() === "explorer" && explorerKeys.has(event.key)) {
    explorer.handleKeyPress(event, Math.max(1, currentHeight() - 8));
  } else if (activeWindow.peek() === "controls") handleControlsKey(event);
  else if (activeWindow.peek() === "data" && event.key.toLowerCase() === "s") {
    const current = table.state.peek().sort?.columnId;
    const next = nextSortableDataColumn(columns, current, event.shift ? -1 : 1);
    if (next) {
      table.toggleSort(next.id);
      pushLog(`sort data by ${next.label}`);
    }
  } else if (activeWindow.peek() === "data") table.handleKeyPress(event as never);
  else applyWorkbenchGlobalKeyAction(global, { phase: "postWindow" });
}

function applyWorkbenchGlobalKeyAction(
  action: ReturnType<typeof resolveWorkbenchGlobalKey>,
  options: { phase: "primary" | "preWindow" | "postWindow" },
): boolean {
  const id = activeWindow.peek();
  switch (action.kind) {
    case "ignore":
      return false;
    case "quit":
      openQuitModal();
      return true;
    case "focusMenu":
      focusMenu();
      return true;
    case "help":
      openHelpModal();
      return true;
    case "openNewWindowMenu":
      openNewWindowMenu();
      return true;
    case "openThemeMenu":
      openThemeMenu();
      return true;
    case "cycleTheme":
      setTheme(themeIndex.peek() + 1);
      return true;
    case "openThreeConfig":
      openThreeConfigModal(id);
      return true;
    case "closeWindow":
      closeWindow(id);
      return true;
    case "minimizeWindow":
      minimize(id);
      return true;
    case "toggleMaximize":
      toggleMaximize(id);
      return true;
    case "restoreAll":
      restoreAll();
      return true;
    case "focusControl":
      focusNextControl(action.delta);
      return true;
    case "focusWindow":
      action.delta < 0 ? focusPrevious() : focusNext();
      return true;
    case "focusWindowNumber": {
      const target = (windowManager.ids() as WindowId[])[action.index];
      if (!target) return false;
      focus(target);
      return true;
    }
    case "restoreNextMinimized":
      {
        const restored = windowManager.restoreNextMinimized();
        if (!restored) {
          pushLog("no minimized windows");
          return true;
        }
        syncWindowSignalsFromManager();
        pushLog(`restore ${windowTitle(restored.id as WindowId)}`);
      }
      return true;
    case "adjustTileDensity":
      adjustTileDensity(action.delta);
      return true;
    case "scrollPage":
      if (options.phase !== "preWindow") return false;
      scrollWindow(id, 0, action.delta * Math.max(1, windowScroll(id).viewportHeight.peek() - 1));
      return true;
    case "scrollHome":
      if (options.phase !== "preWindow") return false;
      windowScrolls.get(id)?.scrollTo(0, 0);
      return true;
    case "scrollEnd": {
      if (options.phase !== "preWindow") return false;
      const scroll = windowScrolls.get(id);
      scroll?.scrollTo(scroll.offset.peek().columns, scroll.maxOffset().rows);
      return true;
    }
    case "scrollHorizontal":
      if (options.phase !== "preWindow") return false;
      scrollWindow(id, action.delta, 0);
      return true;
    case "incrementDensity":
      if (options.phase !== "postWindow") return false;
      action.delta > 0 ? density.increment() : density.decrement();
      return true;
    case "toggleLivePreview":
      if (options.phase !== "postWindow") return false;
      livePreview.toggle();
      return true;
    case "scrollLine":
      if (options.phase !== "postWindow") return false;
      scrollWindow(id, action.columns, action.rows);
      return true;
  }
}

function handleTerminalShellKey(event: KeyPressEvent): boolean {
  const shell = activeTerminalShell();
  if (!shell) return false;
  if (shell.scrollback.mode === "copy") {
    if (event.key === "escape" || event.key.toLowerCase() === "i") {
      shell.scrollback.exitCopyMode();
      terminalShellInputMode.value = shell.running ? "raw" : "workbench";
      pushLog("shell copy mode off");
      return true;
    }
    if (event.ctrl || event.meta) return false;
    if (event.key === "pageup") shell.scrollback.page(-1);
    else if (event.key === "pagedown") shell.scrollback.page(1);
    else if (event.key === "home") shell.scrollback.toTop();
    else if (event.key === "end") shell.scrollback.toBottom();
    else if (event.key === "space") {
      shell.scrollback.selectVisibleRow(0);
      pushLog("shell selection started");
    } else if (event.key === "up" && event.shift) shell.scrollback.moveSelection(-1);
    else if (event.key === "down" && event.shift) shell.scrollback.moveSelection(1);
    else if (event.key === "up") shell.scrollback.scrollLines(-1);
    else if (event.key === "down") shell.scrollback.scrollLines(1);
    else if (event.key === "/") openTerminalShellSearchModal();
    else if (event.key === "n" && event.shift) moveTerminalShellSearchMatch(-1);
    else if (event.key.toLowerCase() === "n") moveTerminalShellSearchMatch(1);
    else if (event.key.toLowerCase() === "c") {
      const text = shell.scrollback.copySelection();
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
    void routeTerminalKeyPress(shell, event, {
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
  const action = resolveWorkbenchTerminalShellKeyAction(event);
  if (action === "copyPageUp" || action === "copyPageDown") {
    shell.scrollback.enterCopyMode();
    shell.scrollback.page(action === "copyPageUp" ? -1 : 1);
    terminalShellInputMode.value = "workbench";
    scheduleDraw();
    return true;
  }
  if (!action) return false;
  void applyTerminalShellAction(action);
  return true;
}

function handleTerminalShellPaste(event: PasteEvent): boolean {
  if (activeWindow.peek() !== TERMINAL_SHELL_WINDOW_ID || terminalShellInputMode.peek() !== "raw") return false;
  const shell = activeTerminalShell();
  if (!shell) return false;
  void routeTerminalPaste(shell, event, {
    mode: "raw",
    bracketedPaste: shell.inspect().screen.privateModes.includes(2004),
  }).then((decision) => {
    if (!decision.routed) pushLog(`shell paste ${decision.reason}`);
    scheduleDraw();
  });
  return true;
}

function handleTerminalShellMouse(event: MousePressEvent | MouseScrollEvent, rect: Rectangle): boolean {
  if (activeWindow.peek() !== TERMINAL_SHELL_WINDOW_ID || terminalShellInputMode.peek() !== "raw") return false;
  const shell = activeTerminalShell();
  if (!shell) return false;
  const mouseRouting = terminalMouseRoutingFromPrivateModes(shell.inspect().screen.privateModes);
  if (mouseRouting.mouseTracking === "none" || !mouseRouting.sgrMouse) return false;
  void routeTerminalMouse(shell, event, {
    mode: "raw",
    ...mouseRouting,
    mouseOrigin: { column: rect.column, row: rect.row },
  }).then((decision) => {
    if (!decision.routed && decision.reason !== "unencodable") pushLog(`shell mouse ${decision.reason}`);
    scheduleDraw();
  });
  return true;
}

function handleTerminalShellScroll(event: MouseScrollEvent): boolean {
  if (activeWindow.peek() !== TERMINAL_SHELL_WINDOW_ID) return false;
  const shell = activeTerminalShell();
  if (!shell) return false;
  const inspection = shell.scrollback.inspect();
  if (inspection.totalRows <= inspection.viewportRows) return false;
  shell.scrollback.scrollLines(event.scroll);
  terminalShellInputMode.value = "workbench";
  if (inspection.mode === "live") pushLog("shell copy mode on");
  return true;
}

function shellShouldReceiveCtrlC(): boolean {
  return activeWindow.peek() === TERMINAL_SHELL_WINDOW_ID && terminalShellInputMode.peek() === "raw" &&
    activeTerminalShell()?.running === true;
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
  const action = resolveWorkbenchTerminalOutputKeyAction(event);
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

  const scroll = windowScroll(id);
  const columns = cpuHexGridColumnCount(
    cores,
    Math.max(8, scroll.contentWidth.peek()),
    Math.max(4, scroll.viewportHeight.peek()),
  );
  const nextLabel = nextCpuHexLabel(cores, selectedCpuHexTiles.peek()[id], key as CpuHexNavigationKey, columns);
  if (nextLabel) selectCpuHexTile(id, nextLabel);
  return true;
}

function handleMenuFocusKey(event: { key: string; ctrl?: boolean; meta?: boolean; shift?: boolean }): void {
  const action = resolveWorkbenchMenuFocusKey(event);
  switch (action.kind) {
    case "ignore":
      return;
    case "close":
      closeTopMenus();
      return;
    case "focusWindow":
      closeTopMenus();
      action.delta < 0 ? focusPrevious() : focusNext();
      return;
    case "moveMenu":
      menu.handleKeyPress(event);
      return;
    case "selectActive":
      menu.selectActive();
      return;
  }
}

function handleScreenDropdownKey(event: { key: string; ctrl?: boolean; meta?: boolean; shift?: boolean }): void {
  const action = resolveWorkbenchScreenDropdownKey({
    event,
    openId: topMenus.inspect().openId,
    indexes: {
      theme: themeIndex.peek(),
      newWindow: newWindowMenuIndex.peek(),
      workspace: workspaceMenuIndex.peek(),
    },
    counts: {
      theme: themes.length,
      newWindow: newWindowOptions.length,
      workspace: workspaceMenuItemCount(),
    },
  });

  switch (action.kind) {
    case "ignore":
      return;
    case "quit":
      openQuitModal();
      return;
    case "help":
      closeTopMenus();
      openHelpModal();
      return;
    case "close":
      closeTopMenus();
      return;
    case "focusWindow":
      closeTopMenus();
      action.delta < 0 ? focusPrevious() : focusNext();
      return;
    case "moveTopMenu":
      menu.move(action.delta);
      openActiveTopMenu();
      return;
    case "menuItem":
      if (action.menuId === "theme") {
        themeIndex.value = action.index;
        if (action.activate) setTheme(action.index);
      } else if (action.menuId === "newWindow") {
        newWindowMenuIndex.value = action.index;
        if (action.activate) {
          toggleNewWindowOption(newWindowOptions[action.index], { keepMenuOpen: true });
        }
      } else {
        workspaceMenuIndex.value = action.index;
        if (action.activate) applyWorkspaceMenuItem(action.index);
      }
  }
}

function focusMenu(): void {
  topMenus.focus();
  topMenus.close(false);
  pushLog("menu focus");
}

function openActiveTopMenu(): void {
  switch (workbenchStandardTopMenuIdForItem(menu.active()?.id)) {
    case "theme":
      openThemeMenu();
      return;
    case "newWindow":
      openNewWindowMenu();
      return;
    case "workspace":
      {
        const index = menu.items.peek().findIndex((item) => item.id === "workspace");
        if (index >= 0) menu.setActive(index);
        workbenchController.openMenu("workspace", workspaceMenuItemCount());
        workspaceMenuIndex.value = workbenchController.menuIndex("workspace");
        pushLog("open workspace menu");
      }
      return;
  }
  topMenus.close(false);
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

function closeTopMenus(clearFocus = true): void {
  topMenus.close(clearFocus);
}

function handleThreeConfigKey(event: { key: string; shift?: boolean }): void {
  const action = resolveWorkbenchAsciiConfigKey(event);
  switch (action.kind) {
    case "modal":
      applyThreeConfigModalAction(action.action);
      return;
    case "selection":
      threeConfigSelected.value = moveWorkbenchAsciiConfigSelection(
        threeConfigSelected.peek(),
        threeConfigRows.length,
        action.delta,
      );
      return;
    case "row":
      applyThreeConfigRow(threeConfigSelected.peek(), action.action);
      return;
    case "none":
      return;
  }
}

function closeWindow(id: WindowId): void {
  const plan = workbenchWindowClosePlan({
    windowId: id,
    isVisualizationWindow,
    isTerminalShellWindow: (candidate) => candidate === TERMINAL_SHELL_WINDOW_ID,
    selectedVisualizationTiles: selectedCpuHexTiles.peek(),
  });
  if (plan.visualizationWindowId) {
    disposeVisualizationThreePanel(plan.visualizationWindowId);
    disposeAsciiForWindow(plan.visualizationWindowId);
    if (plan.selectedVisualizationTilesChanged) {
      selectedCpuHexTiles.value = plan.selectedVisualizationTiles as Record<VisualizationWindowId, string>;
    }
  }
  if (plan.stopTerminalShell) {
    void activeTerminalShell()?.stop();
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
  const plan = workbenchWindowOptionTogglePlan<BuiltInWindowId>(option);
  if (plan.action === "builtIn") return toggleBuiltInWindow(plan.id, options);
  if (plan.action === "visualization") return toggleVisualizationWindow(plan.option, options);
}

function toggleBuiltInWindow(
  id: BuiltInWindowId,
  options: { keepMenuOpen?: boolean } = {},
): void {
  const plan = workbenchBuiltInWindowTogglePlan({
    id,
    loadedWindowIds: windowManager.ids(),
    keepMenuOpen: options.keepMenuOpen,
    terminalShellWindowId: TERMINAL_SHELL_WINDOW_ID,
  });
  if (plan.action === "close") {
    closeWindow(id);
    if (!plan.keepMenuOpen) closeTopMenus();
    else topMenus.focus();
    return;
  }
  if (!plan.keepMenuOpen) closeTopMenus();
  windowManager.restore(id);
  syncWindowSignalsFromManager();
  focus(id);
  const shell = activeTerminalShell();
  if (plan.startTerminalShell && shell && !shell.running && shell.status.peek() !== "starting") {
    void terminalShell.start().then((started) => {
      if (started) terminalShellInputMode.value = "raw";
      scheduleDraw();
    });
  }
  if (plan.focusTopMenuAfterAction) topMenus.focus();
  pushLog(`add window ${windowTitle(id)}`);
}

function toggleVisualizationWindow(
  option: NewWindowOption | undefined,
  options: { keepMenuOpen?: boolean; ascii?: AsciiOptions } = {},
): void {
  const plan = workbenchVisualizationWindowTogglePlan({
    option,
    loadedWindowIds: windowManager.ids(),
  });
  if (plan.action === "close") {
    closeWindow(plan.id as VisualizationWindowId);
    if (!options.keepMenuOpen) closeTopMenus();
    else topMenus.focus();
    return;
  }
  if (plan.action === "add") addVisualizationWindow(plan.option, options);
}

function addVisualizationWindow(
  option: NewWindowOption | undefined,
  options: { keepMenuOpen?: boolean; ascii?: AsciiOptions } = {},
): void {
  if (!option) return;
  const id = workbenchVisualizationWindowId(option.id) as VisualizationWindowId;
  if (!options.keepMenuOpen) closeTopMenus();
  if (options.ascii) setAsciiForWindow(id, options.ascii);
  else asciiForWindow(id);
  const plan = workbenchVisualizationWindowRegistrationPlan({
    option,
    existingWindowIds: windowManager.ids({ includeClosed: true }),
    currentWindowCount: windowManager.windows.peek().length,
  });
  if (plan.action === "create") {
    dynamicVisualizationWindows.value = { ...dynamicVisualizationWindows.peek(), [id]: plan.visualizationId };
    windowScrolls.set(id, new ScrollAreaController({ showScrollbar: true }));
    windowManager.windows.value = [...windowManager.windows.peek(), plan.registration!];
  } else {
    windowManager.restore(id);
  }
  focus(id);
  if (options.keepMenuOpen) topMenus.focus();
  pushLog(`add window ${option.label}`);
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
    if (action === "set" && rect && x !== undefined) density.handlePointer(rect, x, rect.row);
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
  selectedCpuHexTiles.value = selectedCpuHexTilesWith(selectedCpuHexTiles.peek(), id, label);
  windowManager.focus(id);
  syncWindowSignalsFromManager();
  ensureCpuHexTileVisible(id, label);
  pushLog(`cpu ${label} selected: ${topCpuProcessLabelForCpu(label, systemMonitor.snapshot.peek().processes)}`);
}

function ensureCpuHexTileVisible(id: VisualizationWindowId, label: string): void {
  const scroll = windowScrolls.get(id);
  if (!scroll) return;
  const system = systemMonitor.snapshot.peek();
  const tiles = cpuHexTileLayoutInto(
    cpuHexRevealTileBuffer,
    system.cpuCores,
    Math.max(8, scroll.contentWidth.peek()),
    Math.max(4, scroll.viewportHeight.peek()),
  );
  const offset = scroll.offset.peek();
  const target = cpuHexTileScrollTarget({
    label,
    tiles,
    offset,
    viewportHeight: scroll.viewportHeight.peek(),
  });
  if (target) scroll.scrollTo(target.columns, target.rows);
}

function handleControlsKey(event: { key: string; ctrl?: boolean; meta?: boolean; shift?: boolean }): void {
  const id = activeControl.peek();
  const resolved = resolveApiWorkbenchControlKey(id, event, { dropdownExpanded: dropdown.expanded.peek() });
  switch (resolved.type) {
    case "textInput":
      id === "input" ? commandInput.handleKeyPress(event as never) : notes.handleKeyPress(event as never);
      return;
    case "dropdown":
      if (resolved.action === "move") dropdown.move(resolved.delta);
      else if (resolved.action === "first") dropdown.first();
      else if (resolved.action === "last") dropdown.last();
      else if (resolved.action === "close") dropdown.close();
      else dropdown.selectActive();
      return;
    case "radio":
      modeRadio.move(resolved.delta);
      return;
    case "focus":
      activeControl.value = apiWorkbenchControlAt(activeControl.peek(), resolved.delta);
      return;
    case "control":
      applyControlHit(id, resolved.action);
      return;
    case "none":
      return;
  }
}

function blurTextControl(): void {
  const previous = activeControl.peek();
  windowManager.focus("controls");
  syncWindowSignalsFromManager();
  activeControl.value = apiWorkbenchControlAt(activeControl.peek(), 1);
  pushLog(`control ${previous} blur`);
}

function focusNextControl(delta = 1): void {
  windowManager.focus("controls");
  syncWindowSignalsFromManager();
  const next = apiWorkbenchControlAtEdge(activeControl.peek(), delta);
  if (next) {
    activeControl.value = next;
    pushLog(`control ${activeControl.peek()} focus`);
    return;
  }
  delta < 0 ? focusPrevious() : focusNext();
}

function isTextControlActive(): boolean {
  return isApiWorkbenchTextControlActive(activeWindow.peek(), "controls", activeControl.peek());
}

function pushLog(message: string): void {
  commandLog.value = appendBoundedWorkbenchLogRow(
    commandLog.peek(),
    `${new Date().toLocaleTimeString()} ${message}`,
    8,
  );
}

function writeRows(frame: Frame, rect: Rectangle, rows: readonly RowStyle[]): void {
  framePainter.writeRows(frame, rect, rows);
}

function write(frame: Frame, row: number, column: number, value: string): void {
  framePainter.write(frame, row, column, value);
}

function fillRow(frame: Frame, row: number, bg: string): void {
  framePainter.fillRow(frame, row, bg);
}

function fillRect(frame: Frame, rect: Rectangle, bg: string): void {
  framePainter.fillRect(frame, rect, bg);
}

function paint(text: string, options: { fg?: string; bg?: string; bold?: boolean } = {}): string {
  return framePainter.paint(text, options);
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
  return framePainter.writeButton(frame, row, column, label, options);
}

function addHit(rect: Rectangle, action: HitAction): void {
  hitTargets.add(rect, action);
}

function findHit(x: number, y: number): { rect: Rectangle; action: HitAction } | undefined {
  return findApiWorkbenchHitTarget({
    targets: hitTargets,
    x,
    y,
    bounds: { column: 0, row: 0, width: currentWidth(), height: currentHeight() },
    touchOptimized: isApiWorkbenchTouchOptimizedLayout({
      columns: currentWidth(),
      rows: currentHeight(),
    }),
  });
}

function windowTitle(id: WindowId): string {
  const visualizationLabel = isVisualizationWindow(id)
    ? visualizationOption(dynamicVisualizationWindows.peek()[id])?.label ?? ""
    : undefined;
  const terminalOutputTitle = id === TERMINAL_OUTPUT_WINDOW_ID
    ? formatTerminalOutputWindowTitle(terminalOutputSession.inspect(), {
      mode: terminalInputMode.peek() === "raw" ? "RAW" : "WB",
    })
    : undefined;
  let terminalShellTitle: string | undefined;
  if (id === TERMINAL_SHELL_WINDOW_ID) {
    const mode = terminalShellInputMode.peek() === "raw" ? "RAW" : "WB";
    const shell = activeTerminalShell();
    terminalShellTitle = shell ? formatTerminalShellWindowTitle(shell.inspect(), { mode }) : `Shell ${mode} EMPTY`;
  }
  return apiWorkbenchWindowTitle({
    id,
    visualizationLabel,
    terminalOutputId: TERMINAL_OUTPUT_WINDOW_ID,
    terminalOutputTitle,
    terminalShellId: TERMINAL_SHELL_WINDOW_ID,
    terminalShellTitle,
    fallback: "Three ASCII",
  });
}

function isVisualizationWindow(id: WindowId): id is VisualizationWindowId {
  return isWorkbenchVisualizationWindowId(id);
}

function visualizationOption(visualizationId: string | undefined): NewWindowOption | undefined {
  return visualizationId ? visualizationWindowOptionById.get(visualizationId) : undefined;
}

function theme(): ThemeSpec {
  return themes[themeIndex.value] ?? themes[0]!;
}

function currentWidth(): number {
  return Math.max(1, Math.floor(tui.canvas.size.peek().columns));
}

function currentHeight(): number {
  return Math.max(1, Math.floor(tui.canvas.size.peek().rows));
}

function syncTerminalSize(): boolean {
  const result = syncWorkbenchTerminalSize(tui.canvas.size, readWorkbenchVerifiedConsoleSize);
  const observed = repaintPolicy.inspectScreenSize(tui.canvas.size.peek());
  if (!result.changed && !observed.changed) return false;
  screenPainter.clearScreen();
  repaintPolicy.resetFullRepaintClock();
  requestResizeFullRepaintWindowAfterInitialObservation();
  return true;
}

function requestResizeFullRepaintWindowAfterInitialObservation(): void {
  if (!workbenchScreenSizeObserved) {
    workbenchScreenSizeObserved = true;
    return;
  }
  repaintPolicy.requestFullRepaintWindow();
}
