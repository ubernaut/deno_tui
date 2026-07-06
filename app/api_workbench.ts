import { ButtonController } from "../src/components/button.ts";
import { CheckBoxController } from "../src/components/checkbox.ts";
import { ComboBoxController } from "../src/components/combobox.ts";
import { DataTableController } from "../src/components/data_table.ts";
import { createFileExplorerTree, FileExplorerController } from "../src/components/file_explorer.ts";
import { InputController } from "../src/components/input.ts";
import { MenuBarController, renderMenuBar } from "../src/components/menu_bar.ts";
import { modalContentHeight, ModalController, type ModalInspection } from "../src/components/modal.ts";
import { ProgressBarController } from "../src/components/progressbar.ts";
import { RadioGroupController } from "../src/components/radio_group.ts";
import { ScrollAreaController } from "../src/components/scroll_area.ts";
import { SliderController } from "../src/components/slider.ts";
import { StepperController } from "../src/components/stepper.ts";
import { TextBoxController, type TextBoxVisualLine } from "../src/components/textbox.ts";
import {
  appendBoundedWorkbenchLogRow,
  blitWorkbenchFrameCells,
  buttonText,
  centerCellText as centerText,
  clampWorkbenchTileDensity,
  contrastText,
  dispatchWorkbenchTextPromptInput,
  findWorkbenchWorkspace,
  fitCellText as fit,
  formatWorkbenchDiagnosticStatus,
  HitTargetStack,
  initialWorkbenchDiagnosticLogRows,
  inset,
  intersects,
  isWorkbenchMenuActivationKey,
  isWorkbenchVisualizationWindowId,
  layoutWorkbenchHeaderInto,
  layoutWorkbenchMenuBarHitsInto,
  layoutWorkbenchModal,
  layoutWorkbenchShelfInto,
  layoutWorkbenchTabsInto,
  layoutWorkbenchTitlebarInto,
  loadWorkbenchWorkspaceStorage,
  persistWorkbenchWorkspaceStorage,
  prepareWorkbenchFrame,
  projectWorkbenchButtonCommand,
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
  workbenchButtonPaintOptions,
  type WorkbenchButtonTone,
  workbenchContentViewport,
  type WorkbenchDropdownOverlayRenderCommand,
  workbenchDropdownOverlayRenderCommandsInto,
  workbenchEmptyWorkspaceMessage,
  type WorkbenchFrame,
  type WorkbenchFrameBoxLine,
  workbenchFullscreenWindowRect,
  workbenchHeaderHelp,
  type WorkbenchHeaderLayout,
  type WorkbenchMenuBarHitLayout,
  workbenchModalActionButtonsInto,
  workbenchModalRowRenderCommandsInto,
  type WorkbenchScrollbarRenderCommand,
  workbenchShelfEntriesInto,
  workbenchShelfRenderCommandsInto,
  workbenchStandardTopMenuDropdownOverlayInto,
  workbenchStandardTopMenuIdForItem,
  workbenchStatusSnapshotLine,
  workbenchTabEntriesInto,
  workbenchTerminalOutputRowsInto,
  type WorkbenchTerminalOutputToolbarAction,
  workbenchTerminalOutputToolbarItemsInto,
  type WorkbenchTerminalOutputWindowRow,
  workbenchTerminalOutputWindowRowsInto,
  workbenchTitlebarButtonRenderCommandsInto,
  workbenchVisibleWindowRectsInto,
  workbenchVisualizationIdFromWindowId,
  workbenchVisualizationWindowId,
  workbenchVisualizationWindowRegistrationPlan,
  workbenchVisualizationWindowTogglePlan,
  type WorkbenchWindowOption,
  workbenchWindowOptionMenuLabelsInto,
  workbenchWindowOptionTogglePlan,
  workbenchWindowScrollbarRenderCommandsInto,
  type WorkbenchWorkspace,
  workbenchWorkspaceScrollbarRenderCommandsInto,
  WorkbenchWorkspaceViewportController,
  type WorkbenchWorkspaceWindow,
  workbenchWorkspaceWindowEntries,
  writeFrame,
} from "../src/app/workbench/mod.ts";
import {
  API_WORKBENCH_WORKSPACE_STORE_KEY,
  apiWorkbenchWorkspaceStorageOptions,
  createApiWorkbenchWorkspaceStore,
} from "../src/app/workbench_workspace_menu.ts";
import {
  readWorkbenchVerifiedConsoleSize,
  syncWorkbenchTerminalSize,
  WorkbenchFullRepaintPolicy,
} from "../src/app/workbench_repaint_policy.ts";
import { WorkbenchThreeCadenceMeter, WorkbenchThreeOverlayPressureGate } from "../src/app/workbench_three_runtime.ts";
import {
  createWorkbenchThreeWindowState,
  resolveWorkbenchThreeWindowStateInto,
  type WorkbenchThreeWindowState,
  workbenchThreeWindowStateIsInteractive,
} from "../src/app/workbench_three_policy.ts";
import {
  inspectWorkbenchWindowSignalState,
  WorkbenchController,
  workbenchWindowActionLog,
  type WorkbenchWindowActionLogKind,
} from "../src/app/workbench/controller.ts";
import { WorkbenchShelfBufferCache } from "../src/app/workbench_buffers.ts";
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
} from "../src/app/workbench_ascii.ts";
import {
  layoutWorkbenchAsciiConfigModal,
  type WorkbenchAsciiConfigModalAction,
  workbenchAsciiConfigModalActionRenderCommandsInto,
  WorkbenchAsciiConfigModalBufferCache,
  workbenchAsciiConfigRowPlacementsInto,
  workbenchAsciiConfigRowRenderCommandsInto,
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
import {
  formatTerminalOutputHint,
  formatTerminalOutputWindowTitle,
  formatTerminalShellWindowTitle,
  summarizeTerminalStatus,
  terminalInputModeDisplayLabel,
} from "../src/runtime/terminal_status.ts";
import { shellTerminalTemplate } from "../src/runtime/terminal_templates.ts";
import { Computed, Signal } from "../src/signals/mod.ts";
import { probeCompatibleWebGPUDevice } from "../src/three_ascii/webgpu_compat.ts";
import { Tui } from "../src/tui.ts";
import type { Rectangle } from "../src/types.ts";
import { textWidth } from "../src/utils/strings.ts";
import {
  layoutWorkbenchButtonRowInto,
  workbenchButtonRowRenderCommandsInto,
  wrappedControlOptionRowCount,
} from "../src/app/workbench_control_layout.ts";
import {
  WorkbenchButtonRowBufferCache,
  WorkbenchModalBufferCache,
  WorkbenchTerminalBufferCache,
  WorkbenchTerminalSessionTabBufferCache,
  WorkbenchTitlebarBufferCache,
} from "../src/app/workbench_buffers.ts";
import { maxTextWidth, type VisibleMenuSlice } from "../src/app/workbench_text.ts";
import {
  applyWorkbenchTerminalSearchPromptInput,
  resolveWorkbenchShellBackend,
  resolveWorkbenchTerminalProcessInputModeToggle,
  resolveWorkbenchTerminalShellInputModeToggle,
  workbenchTerminalCopyRowsInto,
  type WorkbenchTerminalPaneProjection,
  workbenchTerminalPaneProjectionsInto,
  type WorkbenchTerminalPaneTitleRenderCommand,
  workbenchTerminalPaneTitleRenderCommandsInto,
  workbenchTerminalSearchModalBody,
  workbenchTerminalSessionTabRenderCommandsInto,
  workbenchTerminalSessionTabsInto,
  workbenchTerminalSessionTabSourcesInto,
  type WorkbenchTerminalShellHeaderRow,
  workbenchTerminalShellHeaderRowsInto,
  type WorkbenchTerminalToolbarAction,
  workbenchTerminalToolbarItemsInto,
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
  apiWorkbenchTerminalCellStyle,
  apiWorkbenchTerminalOutputLineStyle,
  apiWorkbenchTerminalStatusToneColor,
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
  apiWorkbenchButtonRowInto,
  type ApiWorkbenchCheckboxOption,
  apiWorkbenchCheckboxRowsInto,
  apiWorkbenchComboHeaderRowsInto,
  apiWorkbenchControlAt,
  apiWorkbenchControlAtEdge,
  apiWorkbenchControlBaseStyle,
  apiWorkbenchControlButtonDetailStyle,
  type ApiWorkbenchControlHitPlacement,
  type ApiWorkbenchControlId,
  apiWorkbenchControlLineInto,
  type ApiWorkbenchControlLineRenderCommand,
  apiWorkbenchControlLineRenderCommandsInto,
  type ApiWorkbenchControlLineSegment,
  apiWorkbenchControlsRowsInto,
  apiWorkbenchControlsSnapshotRowsInto,
  apiWorkbenchControlTrack,
  apiWorkbenchDropdownHeaderRowInto,
  apiWorkbenchDropdownPopoverRect,
  apiWorkbenchInputRowInto,
  apiWorkbenchProgressRowInto,
  type ApiWorkbenchProjectedControlRow,
  type ApiWorkbenchRadioOption,
  apiWorkbenchRadioRowsInto,
  apiWorkbenchSliderRowInto,
  apiWorkbenchSliderSetHitInto,
  apiWorkbenchStepperHitPlacementsInto,
  apiWorkbenchStepperRowInto,
  apiWorkbenchTextboxCommandStyle,
  apiWorkbenchTextboxProjectionInto,
  type ApiWorkbenchTextboxProjectionRow,
  type ApiWorkbenchTextboxRenderCommand,
  apiWorkbenchTextboxRenderCommandsInto,
  type ApiWorkbenchWrappedOptionsRenderCommand,
  apiWorkbenchWrappedOptionsRenderCommandsInto,
  apiWorkbenchWrappedOptionStyle,
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
import { createHtmlCssLayoutDemo, HTML_CSS_LAYOUT_WINDOW_ID } from "../src/markup/demo_fixtures.ts";
import {
  type HtmlCssLayoutRenderCommand,
  htmlCssLayoutRenderCommandsInto,
  htmlCssLayoutSummaryRows,
  htmlCssVisibleLayoutBoxesInto,
} from "./html_css_layout_view.ts";
import { ASCII_DEMO_PRESETS, asciiDemoPresetIds } from "../src/three_ascii/demo_presets.ts";
import { cloneAsciiOptions, normalizeAsciiOptions } from "../src/three_ascii/options.ts";
import { resolveSourceFramesInto } from "./sources.ts";
import { makeStyle, requireInteractiveTerminal } from "./styles.ts";
import { SystemMonitor } from "./system_metrics.ts";
import { createWorkbenchThreePanelFrameView, ThreePanelFrameView } from "./three_panel.ts";
import {
  explorerTextRowsInto,
  workbenchDataTablePageSize,
  workbenchDataTableRowsInto,
  workbenchDemoModalContent,
  workbenchExplorerRowsInto,
  workbenchHelpModalContent,
  workbenchInspectorRowsInto,
  workbenchLogRowsFromSourcesInto,
  workbenchModalConfirmedContent,
  workbenchModalDetailsContent,
  workbenchQuitModalContent,
  workbenchWindowContentSize,
} from "./workbench_panels.ts";
import { renderWorkbenchThreeSurface, WorkbenchThreeGridProjectionCache } from "../src/app/workbench_three_grid.ts";
import {
  hideWorkbenchThreeRect,
  setWorkbenchThreeRect,
  workbenchThreeBodyRect,
  workbenchThreeContentGraphicsRect,
} from "../src/app/workbench_three_geometry.ts";
import {
  setWorkbenchThreeSceneSignal,
  workbenchStudioScene,
  type WorkbenchThreeScene as SharedWorkbenchThreeScene,
  workbenchVisualizationThreeScene,
} from "../src/app/workbench_three_scene.ts";
import {
  threeRendererModeLabel,
  visualizationTextContentSize,
  visualizationThreeStatusLine,
  workbenchThreeFallbackRowsInto,
  workbenchThreeStatusRowsInto,
  workbenchVisualizationRowsInto,
} from "./workbench_visualization_window.ts";
import {
  apiWorkbenchWorkspaceStorageLabel,
  buildWorkspaceMenuEntriesInto,
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
  formatWorkbenchKittyGraphicsStatus,
  WorkbenchKittyGraphicsController,
} from "../src/runtime/graphics_surface.ts";
import {
  type WorkbenchFrameRenderCommand,
  workbenchFrameRenderCommandsInto,
} from "../src/app/workbench_frame_render.ts";
import { WorkbenchFramePainter } from "../src/app/workbench_row_render.ts";
import { type RowStyle, type ThreeHeaderPerformance, threeHeaderRowsInto } from "../src/app/workbench_rows.ts";
import { writeThreeHeaderRuntimePerformance } from "../src/app/workbench_three_header.ts";
import { shouldCountWorkbenchThreeGridPressure } from "../src/app/workbench_three_terminal_pressure.ts";
import {
  apiWorkbenchThreeFrameIntervalForCells,
  resolveWorkbenchThreeFullscreenAsciiOptions,
  resolveWorkbenchThreeLiveAsciiOptions,
  resolveWorkbenchThreeRuntimeBudgetSnapshot,
  resolveWorkbenchThreeTiledAsciiOptions,
  sameWorkbenchThreeAsciiOptions,
  WORKBENCH_THREE_DRAW_INTERVAL_MS,
  WORKBENCH_THREE_FULLSCREEN_MIN_CELLS,
  WORKBENCH_THREE_INITIAL_CELLS,
  workbenchThreeLiveRenderCells,
} from "../src/app/workbench_three_policy.ts";
import {
  type WorkbenchThreePanelEntry,
  WorkbenchThreePanelRegistry,
  WorkbenchThreeViewportInteractionController,
} from "../src/app/workbench_three_panel_registry.ts";
import {
  type ApiWorkbenchThreePressureInspection,
  ApiWorkbenchThreeRuntimeController,
} from "../src/app/workbench_three_runtime.ts";
import type {
  Accent,
  AsciiOptions,
  PanelRender,
  RenderContext,
  SlotConfig,
  SourceFrame,
  SystemSnapshot,
  ThreeSceneMode,
} from "./types.ts";
import {
  cpuHexGridColumnCount,
  type CpuHexNavigationKey,
  type CpuHexTileLayout,
  cpuHexTileLayoutInto,
  cpuHexTileScrollTarget,
  nextCpuHexLabel,
  renderVisualization,
  selectedCpuHexTilesWith,
  topCpuProcessLabelForCpu,
  visualizations,
  visualizationUsesThreeRenderer,
} from "./visualizations.ts";
import {
  monitorSourceIds,
  monitorSourceIdsInto,
  syntheticWorkbenchSourcesInto,
  syntheticWorkbenchSystem,
} from "./workbench_synthetic.ts";
import type { ComputedLayoutBox } from "../src/layout/mod.ts";

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
const controlLineSegments: ApiWorkbenchControlLineSegment[] = [];
const controlLineRenderCommands: ApiWorkbenchControlLineRenderCommand[] = [];
const controlLineHitPlacements: ApiWorkbenchControlHitPlacement[] = [];
const controlProjectedRows: ApiWorkbenchProjectedControlRow[] = [];
const controlCheckboxOptions: ApiWorkbenchCheckboxOption[] = [];
const controlRadioOptions: ApiWorkbenchRadioOption[] = [];
const controlTextboxProjectionRows: ApiWorkbenchTextboxProjectionRow[] = [];
const controlTextboxRenderCommands: ApiWorkbenchTextboxRenderCommand[] = [];
const controlTextboxVisualLines: TextBoxVisualLine[] = [];
const controlWrappedOptionRenderCommands: ApiWorkbenchWrappedOptionsRenderCommand[] = [];
const controlWrappedOptionHitPlacements: ApiWorkbenchControlHitPlacement[] = [];
const controlSliderSetHit: ApiWorkbenchControlHitPlacement = {
  column: 0,
  row: 0,
  width: 0,
  height: 1,
  id: "slider",
  action: "set",
};
const controlStepperHitPlacements: ApiWorkbenchControlHitPlacement[] = [];
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
const titlebarBuffers = new WorkbenchTitlebarBufferCache<WindowId>();
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
const windowFrameBoxLines: WorkbenchFrameBoxLine[] = [];
const windowFrameRenderCommands: WorkbenchFrameRenderCommand[] = [];
const windowScrollbarRenderCommands: WorkbenchScrollbarRenderCommand[] = [];
const workspaceScrollbarRenderCommands: WorkbenchScrollbarRenderCommand[] = [];
const dropdownOverlayRenderCommands: WorkbenchDropdownOverlayRenderCommand[] = [];
const visibleWindowRects = new Map<WindowId, Rectangle>();
const frameWidthHints = new WeakMap<Frame, number>();
const currentWorkspaceWindowBuffer: SavedWorkspaceWindow[] = [];
const currentWorkspaceVisualizationIdBuffer: string[] = [];
const workbenchThreeWindowState = createWorkbenchThreeWindowState<WindowId>("three");
const workbenchThreeRuntime = new ApiWorkbenchThreeRuntimeController({
  hasLiveThreeWindow: hasLiveThreeRenderedWindow,
  hasFullscreenThreeWindow,
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
interface DropdownOverlay {
  kind: "control" | "theme" | "newWindow" | "workspace";
  coordinate: "workspace" | "screen";
  rect: Rectangle;
  items: string[];
  itemIndexes?: number[];
  selectedIndex?: number;
}
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
  onOpenChange: (open, inspection) => setGenericModalBlocksThree(open, inspection),
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
  interactive: () => isThreeWindowInteractive("three"),
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
  findHit: (x, y) => findHit(x, y),
  panelForWindow: (id) => threePanelForWindow(id),
  focusWindow: focusWindowSilently,
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
  const forceFullRepaint = shouldForceWorkbenchFullRepaint(performance.now());
  const width = currentWidth();
  const height = currentHeight();
  hitTargets.clear();
  dropdownOverlay = null;
  syncWorkbenchThreeWindowState();
  workbenchThreeRuntime.resetPressureSample();
  const frame = prepareWorkbenchFrame(screenFrame, height);
  renderHeader(frame);
  renderWorkspace(frame);
  syncWorkbenchThreeRuntimeBudget(width, height);
  syncWorkbenchThreeFrameInterval();
  renderStatus(frame);
  renderActiveDropdownOverlay(frame);
  renderModalOverlay(frame);
  if (forceFullRepaint) screenPainter.reset();
  const flushStats = screenPainter.flush(frame, width, height, renderFrameRow, renderFrameSlice);
  updateThreeTerminalPressure(flushStats, { ignoreSample: forceFullRepaint });
}

function shouldForceWorkbenchFullRepaint(now: number): boolean {
  return repaintPolicy.shouldForceFullRepaint(now);
}

function syncWorkbenchThreeRuntimeBudget(width: number, height: number): void {
  syncWorkbenchThreeRuntimeBudgetForViewport(width, height, threeBodyRect.peek());
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
  const fullscreenThree = hasFullscreenThreeWindow();
  const syncedFullscreenMaxCells = workbenchThreeRuntime.syncFullscreenTargetCells(
    snapshot.fullscreenTargetCells,
    fullscreenThree,
    snapshot.fullscreenViewportCells,
  );
  const liveViewportCells = Math.max(1, Math.floor(liveViewport.width) * Math.floor(liveViewport.height));
  const syncedLiveMaxCells = workbenchThreeRuntime.syncLiveTargetCells(
    workbenchThreeLiveRenderCells(liveViewport),
    hasLiveThreeRenderedWindow() && !fullscreenThree,
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
  const overlayOpen = modal.openState.peek() || screenDropdownOpen() || threeConfigOpen.peek();
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

function hasFullscreenThreeWindow(): boolean {
  return workbenchThreeWindowState.fullscreenThree;
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
  const closeLabel = width >= 20 ? buttonText("x", { compact: true }) : "";
  const closeWidth = textWidth(closeLabel);
  const header = layoutWorkbenchHeaderInto(headerLayout, { width, menuStart: 17, closeWidth, closeMinWidth: 20 });
  renderMenuHits(header.menu.column, header.menu.row, header.menu.width);
  write(
    frame,
    header.menu.row,
    header.menu.column,
    paint(fit(renderMenuBar(menu.items.peek(), menu.activeIndex.peek()), header.menu.width), {
      fg: t.text,
      bg: t.backgroundSoft,
    }),
  );
  if (header.close) {
    writeButton(frame, header.close.row, header.close.column, "x", { compact: true, tone: "danger" });
    addHit(header.close, { type: "quit" });
  }
  const menuStart = header.menu.column;
  const openMenuId = topMenus.inspect().openId;
  dropdownOverlay = workbenchStandardTopMenuDropdownOverlayInto({
    openId: openMenuId,
    menuStart,
    menuItems: menu.items.peek(),
    menuActiveIndex: menu.activeIndex.peek(),
    maxWidth: currentWidth(),
    entries: openMenuId === "theme"
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
          labels: workspaceMenuLabels(),
          selectedIndex: workspaceMenuIndex.peek(),
          preferredWidth: 30,
          maxVisibleItems: Math.max(6, currentHeight() - 5),
        },
      }
      : {},
    measureText: textWidth,
  });
  const help = workbenchHeaderHelp({ width });
  const helpWidth = textWidth(help);
  const showHelp = help.length > 0;
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
  const hits = layoutWorkbenchMenuBarHitsInto(menuBarHitLayouts, {
    column,
    row,
    width,
    items: menu.items.peek(),
    activeIndex: menu.activeIndex.peek(),
    measureText: textWidth,
  });
  for (const hit of hits) {
    addHit(hit.rect, { type: "menu", index: hit.index });
  }
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
    blitWorkspace(frame, virtual, bounds, 0, layout.bounds.width);
    renderWindowTabs(frame);
    return;
  }

  if (layout.rects.size === 0) {
    hideBuiltinThreeRects();
    hideVisualizationThreePanelsExcept(renderedVisualizationThreePanels);
    write(frame, bounds.row + 1, 2, paint(emptyWorkspaceMessage(), { fg: theme().warn }));
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
  const titlebar = layoutWorkbenchTitlebarInto(titlebarBuffers.layout(id), {
    rect,
    title: windowTitle(id),
    showConfig: isThreeRenderedWindow(id),
  });
  const titlebarCommands = workbenchTitlebarButtonRenderCommandsInto(titlebarBuffers.renderCommands(id), titlebar);
  for (const command of titlebarCommands) {
    writeButton(frame, command.rect.row, command.rect.column, command.label, {
      compact: command.compact,
      tone: command.tone,
    });
    addHit(command.hitRect, resolveApiWorkbenchTitlebarHitAction(id, command.kind));
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
  frameWidthHints.set(contentFrame, contentSize.width);
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
  const threeScene = workbenchVisualizationThreeScene({
    scene: rendered.three ?? null,
    available: threeAsciiAvailable.peek(),
    blocked: false,
    width: rect.width,
    height: rect.height,
  });
  if (threeScene) {
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
    const sceneRect = workbenchThreeBodyRect(rect, { headerRows: 3, footerRows: 1 });
    addHit(sceneRect, { type: "threeViewport", id });
    const entry = ensureVisualizationThreePanel(id);
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
      renderThreeGridOrResizePlaceholder(frame, sceneRect, grid, t, {
        scale: threeGridScaleModeForWindow(id),
        countForPressure: false,
      });
      scheduleDraw();
      return;
    }
    renderThreeGrid(frame, sceneRect, grid, t, {
      scale: threeGridScaleModeForWindow(id),
      countForPressure: shouldCountWorkbenchThreeGridPressure(grid, entry.panel.inspectPerformance()),
    });
    return;
  }
  hideVisualizationThreePanel(id);
  writeRows(
    frame,
    rect,
    workbenchVisualizationRowsInto(visualizationRenderRows, visualizationTextRows, option, rendered, {
      accent,
      theme: t,
      contrast: contrastText,
    }),
  );
  if (visualizationId === "cpu-hex-grid") {
    addCpuHexTileHits(id, rect, context);
  }
}

function addCpuHexTileHits(id: VisualizationWindowId, rect: Rectangle, context: RenderContext): void {
  const tiles = cpuHexTileLayoutInto(cpuHexHitTileBuffer, context.system.cpuCores, context.width, context.height);
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
    const sceneRect = workbenchThreeBodyRect(rect, { headerRows: 3 });
    const resized = setThreeBodyRect(sceneRect);
    const performance = threePanel.inspectPerformance();
    const pressure = workbenchThreeRuntime.inspectPressureDetailsInto(workbenchThreePressureDetails);
    writeRows(
      frame,
      rect,
      threeHeaderRowsInto(
        workbenchThreeHeaderRows,
        mode,
        rect.width,
        t,
        performance
          ? writeThreeHeaderRuntimePerformance(workbenchThreeHeaderPerformance, performance, {
            sourceMaxCells: workbenchThreeEffectiveMaxCells.peek(),
            frameIntervalMs: workbenchThreeFrameInterval.peek(),
            measuredFps: threeCadence.measuredFps(),
            pressure,
          })
          : undefined,
      ),
    );
    addHit(sceneRect, { type: "threeViewport", id: "three" });
    setThreeGraphicsRect(contentRectToGraphicsRect(sceneRect));
    const grid = threePanel.grid.peek();
    if (resized) {
      renderThreeGridOrResizePlaceholder(frame, sceneRect, grid, t, {
        scale: threeGridScaleModeForWindow("three"),
        countForPressure: false,
      });
      return;
    }
    renderThreeGrid(frame, sceneRect, grid, t, {
      scale: threeGridScaleModeForWindow("three"),
      countForPressure: shouldCountWorkbenchThreeGridPressure(grid, performance),
    });
    return;
  }

  hideBuiltinThreeRects();
  const fallback = workbenchThreeFallbackRowsInto(threeFallbackRowsBuffer, {
    width: rect.width,
    height: rect.height,
    terminalGlyphStyle: ascii.peek().terminalGlyphStyle,
    rendererAvailable: threeAsciiAvailable.peek(),
    theme: t,
    center: centerText,
  });
  writeRows(frame, rect, fallback);
}

function renderThreeResizePlaceholder(frame: Frame, rect: Rectangle, t: ThemeSpec): void {
  renderThreeSurface(frame, rect, [], t, {
    statusMessage: "renderer resizing",
    countForPressure: false,
  });
}

function renderThreeGridOrResizePlaceholder(
  frame: Frame,
  rect: Rectangle,
  grid: string[][],
  t: ThemeSpec,
  options: {
    scale?: boolean | "down";
    countForPressure?: boolean;
  } = {},
): void {
  const resizeScale = grid.length > 0 && (grid[0]?.length ?? 0) > 0 ? true : options.scale;
  renderThreeSurface(frame, rect, grid, t, {
    ...options,
    scale: resizeScale,
    statusMessage: "renderer resizing",
  });
}

function renderThreeGrid(
  frame: Frame,
  rect: Rectangle,
  grid: string[][],
  t: ThemeSpec,
  options: { countForPressure?: boolean; scale?: boolean | "down" } = {},
): void {
  renderThreeSurface(frame, rect, grid, t, {
    ...options,
    statusMessage: threeAsciiAvailable.peek() ? "renderer warming up" : "renderer unavailable",
  });
}

function renderThreeSurface(
  frame: Frame,
  rect: Rectangle,
  grid: string[][],
  t: ThemeSpec,
  options: {
    countForPressure?: boolean;
    scale?: boolean | "down";
    statusMessage: string;
  },
): void {
  renderWorkbenchThreeSurface({
    frame,
    rect,
    grid,
    fallbackCell: paint(" ", { bg: t.surface }),
    projectionCache: threeGridProjectionCache,
    writeRows,
    statusRows: () =>
      workbenchThreeStatusRowsInto(threeStatusRowsBuffer, {
        width: rect.width,
        height: rect.height,
        message: options.statusMessage,
        theme: t,
        center: centerText,
      }),
    scale: options.scale,
    countForPressure: options.countForPressure,
    onPressureRows: (rows) => workbenchThreeRuntime.recordRenderedGridForPressure(rows),
  });
}

function threeGridScaleModeForWindow(_id: WindowId): boolean | "down" {
  return true;
}

function renderExplorer(frame: Frame, rect: Rectangle): void {
  const visible = explorer.tree.visibleRows();
  writeRows(
    frame,
    rect,
    workbenchExplorerRowsInto(explorerRenderRows, {
      rows: visible,
      selectedIndex: explorer.tree.selectedIndex.peek(),
      theme: theme(),
      contrast: contrastText,
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
  writeRows(
    frame,
    rect,
    workbenchInspectorRowsInto(inspectorRenderRows, {
      width: rect.width,
      height: rect.height,
      themeLabel: themes[themeIndex.peek()]!.label,
      logs: commandLog.peek(),
      theme: theme(),
      fit,
      buffers: {
        actionTextRows: inspectorActionTextRows,
        wrappedTextRows: inspectorWrappedTextRows,
      },
    }),
  );
}

function renderData(frame: Frame, rect: Rectangle): void {
  const t = theme();
  const pendingView = table.view.peek();
  table.setPageSize(workbenchDataTablePageSize({
    height: rect.height,
    width: rect.width,
    page: pendingView.page + 1,
    pageCount: pendingView.pageCount,
    selectedKey: pendingView.selectedKey,
    theme: t,
    fit,
  }));
  const view = table.view.peek();
  writeRows(
    frame,
    rect,
    workbenchDataTableRowsInto(dataTableRenderRows, {
      view,
      columns,
      sort: table.state.peek().sort,
      width: rect.width,
      theme: t,
      fit,
      contrast: contrastText,
      buffers: { textRows: dataTableTextRows, bodyRows: dataTableBodyRows },
    }),
  );
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
    const startRow = row;
    const nextRow = apiWorkbenchControlLineInto(
      controlLineSegments,
      controlLineHitPlacements,
      id,
      value,
      rect,
      row,
      activeControl.peek(),
      options,
    );
    if (nextRow === row) return;
    const active = activeControl.peek() === id;
    const baseStyle = apiWorkbenchControlBaseStyle(t, active);
    const renderCommands = apiWorkbenchControlLineRenderCommandsInto(controlLineRenderCommands, controlLineSegments, {
      rect,
      row: startRow,
      button: options.button,
    });
    for (const command of renderCommands) {
      if (command.kind === "fill") {
        write(frame, command.row, command.column, paint(" ".repeat(command.width), { fg: t.text, bg: t.surface }));
        continue;
      }
      if (options.button) {
        const style = command.role === "button"
          ? workbenchButtonPaintOptions(t, contrastText, active ? "active" : "base")
          : command.role === "detail"
          ? apiWorkbenchControlButtonDetailStyle(t, active)
          : baseStyle;
        write(
          frame,
          command.row,
          command.column,
          paint(command.text, style),
        );
      } else {
        write(frame, command.row, command.column, paint(command.text, baseStyle));
      }
    }
    for (let index = 0; index < controlLineHitPlacements.length; index += 1) {
      const hit = controlLineHitPlacements[index]!;
      addHit({
        column: hit.column,
        row: hit.row,
        width: hit.width,
        height: hit.height,
      }, { type: "control", id: hit.id, action: hit.action, index: hit.index });
    }
    row = nextRow;
  };
  const writeSection = (id: ControlId, label: string) => {
    writeControl(id, label, { action: "activate" });
  };
  const slider = density.inspect();
  const sliderTrack = apiWorkbenchControlTrack({
    ratio: slider.normalizedValue,
    boundsWidth: rect.width,
    reservedWidth: 20,
    maxWidth: 24,
  });
  const progressTrack = apiWorkbenchControlTrack({
    ratio: progress.ratio(),
    boundsWidth: rect.width,
    reservedWidth: 18,
    maxWidth: 24,
  });
  apiWorkbenchControlsSnapshotRowsInto(controlProjectedRows, {
    buttonPressCount: actionButton.pressCount.peek(),
    genericButtonPressCount: genericButton.pressCount.peek(),
    modalOpen: modal.openState.peek(),
    slider: {
      track: sliderTrack,
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
      rectWidth: rect.width,
    },
    dropdown: {
      title: "Dropdown",
      label: dropdown.label(),
      expanded: dropdown.expanded.peek(),
    },
    input: {
      title: "Input",
      text: commandInput.text.peek(),
      active: activeControl.peek() === "input",
    },
    stepper: {
      steps: workflowStepper.steps.peek(),
      activeIndex: workflowStepper.activeIndex.peek(),
      rectWidth: rect.width,
    },
    progress: {
      track: progressTrack,
      value: progress.value.peek(),
    },
    buffers: {
      checkboxes: controlCheckboxOptions,
      radio: controlRadioOptions,
    },
  });
  for (let index = 0; index < controlProjectedRows.length; index += 1) {
    const controlRow = controlProjectedRows[index]!;
    if (controlRow.id === "slider" && controlRow.value.startsWith("Progress")) {
      if (row < rect.row + rect.height) {
        write(
          frame,
          row,
          rect.column,
          paint(fit(controlRow.value, rect.width), {
            fg: t.text,
            bg: t.surface,
          }),
        );
      }
      continue;
    }

    if (controlRow.id === "textbox") {
      row = renderTextboxControl(frame, rect, row, t);
      continue;
    }

    const beforeRow = row;
    writeControl(controlRow.id, controlRow.value, controlRow.options);
    if (controlRow.id === "slider") {
      const sliderSetHit = apiWorkbenchSliderSetHitInto(controlSliderSetHit, rect, beforeRow, sliderTrack);
      addHit({
        column: sliderSetHit.column,
        row: sliderSetHit.row,
        width: sliderSetHit.width,
        height: sliderSetHit.height,
      }, {
        type: "control",
        id: sliderSetHit.id,
        action: sliderSetHit.action,
      });
    } else if (controlRow.id === "combo" && controlProjectedRows[index + 1]?.id !== "combo") {
      writeWrappedOptions(frame, rect, row, "combo", themeCombo.items.peek(), themeCombo.selectedIndex.peek(), t);
      row += wrappedControlOptionRowCount(themeCombo.items.peek(), undefined, rect.width - 4);
    } else if (controlRow.id === "dropdown") {
      if (dropdown.expanded.peek()) {
        const items = dropdown.items.peek();
        dropdownOverlay = {
          kind: "control",
          coordinate: "workspace",
          rect: apiWorkbenchDropdownPopoverRect({ rect, row, items, label: dropdown.label() }),
          items,
          selectedIndex: dropdown.selectedIndex.peek(),
        };
      }
    } else if (controlRow.id === "stepper") {
      addInlineStepperHits(rect, beforeRow);
    }
  }
}

function renderTextboxControl(frame: Frame, rect: Rectangle, row: number, t: ThemeSpec): number {
  const active = activeControl.peek() === "textbox";
  const projection = apiWorkbenchTextboxProjectionInto(controlTextboxProjectionRows, {
    rect,
    row,
    lines: notes.lines.peek(),
    visualLines: controlTextboxVisualLines,
    cursor: notes.cursorPosition.peek(),
    active,
  });
  if (projection.height <= 0) return projection.nextRow;
  const commands = apiWorkbenchTextboxRenderCommandsInto(controlTextboxRenderCommands, projection.rows);
  for (const command of commands) {
    write(
      frame,
      command.row,
      command.column,
      paint(command.text, apiWorkbenchTextboxCommandStyle(t, command, active)),
    );
  }
  addHit(projection.hit, {
    type: "control",
    id: "textbox",
    action: "focus",
  });
  return projection.nextRow;
}

function renderLogs(frame: Frame, rect: Rectangle): void {
  writeRows(frame, rect, workbenchLogRowsFromSourcesInto(logRenderRows, [docs, commandLog.peek()], theme()));
}

function renderTerminalOutput(frame: Frame, rect: Rectangle): void {
  const t = theme();
  fillRect(frame, rect, t.surface);
  const inspection = terminalOutputSession.inspect();
  let row = rect.row;
  row = renderTerminalOutputToolbar(frame, rect, row);
  if (row >= rect.row + rect.height) return;

  const statusTone = apiWorkbenchTerminalStatusToneColor(inspection.status, t);
  const statusSummary = summarizeTerminalStatus(inspection, {
    title: terminalInputModeDisplayLabel(terminalInputMode.peek()),
    backendId: "process",
    width: rect.width,
  });
  const outputHeight = Math.max(0, rect.row + rect.height - row - 2);
  const lines = terminalOutputSession.output.visible(outputHeight);
  const projectedRows = workbenchTerminalOutputWindowRowsInto(terminalOutputWindowRows, {
    statusText: statusSummary.text,
    hintText: formatTerminalOutputHint(terminalInputMode.peek()),
    lines,
    sourcePrefix: true,
  });
  const maxRows = Math.min(projectedRows.length, Math.max(0, rect.row + rect.height - row));
  for (let index = 0; index < maxRows; index += 1) {
    const projected = projectedRows[index]!;
    const style = projected.kind === "status"
      ? {
        fg: contrastText(statusTone, t.background, t.text),
        bg: statusTone,
        bold: true,
      }
      : projected.kind === "hint"
      ? { fg: t.soft, bg: t.panelSoft }
      : projected.kind === "empty"
      ? { fg: t.muted, bg: t.surface }
      : apiWorkbenchTerminalOutputLineStyle(projected.source ?? "stdout", t);
    write(
      frame,
      row + index,
      rect.column,
      paint(fit(projected.text, rect.width), style),
    );
  }
}

function renderTerminalOutputToolbar(frame: Frame, rect: Rectangle, startRow: number): number {
  workbenchTerminalOutputToolbarItemsInto(terminalOutputButtonBuffers.items, {
    running: terminalOutputSession.running,
    outputLineCount: terminalOutputSession.output.lines.peek().length,
    follow: terminalOutputSession.output.follow.peek(),
    inputMode: terminalInputMode.peek(),
  });
  const nextRow = layoutWorkbenchButtonRowInto(
    terminalOutputButtonBuffers.placements,
    terminalOutputButtonBuffers.items,
    rect,
    startRow,
  );

  workbenchButtonRowRenderCommandsInto(terminalOutputButtonBuffers.commands, terminalOutputButtonBuffers.placements);
  for (const button of terminalOutputButtonBuffers.commands) {
    const projection = projectWorkbenchButtonCommand(button, theme(), contrastText);
    write(
      frame,
      button.rect.row,
      button.rect.column,
      paint(projection.text, projection.style),
    );
    if (!button.item.disabled) {
      addHit(button.hitRect, { type: "terminalOutput", action: button.item.action });
    }
  }
  return nextRow;
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
  const statusTone = apiWorkbenchTerminalStatusToneColor(inspection.status, t);
  const mode = copyMode ? "COPY MODE" : terminalInputModeDisplayLabel(terminalShellInputMode.peek(), {
    rawLabel: "RAW SHELL",
  });
  const headerRows = workbenchTerminalShellHeaderRowsInto(terminalShellHeaderRows, {
    status: {
      mode,
      status: inspection.status,
      pty: inspection.pty,
      backendLabel: inspection.backendLabel,
      commandLine: inspection.commandLine,
      scrollbackOffset: inspection.scrollback.offset,
      scrollbackViewportRows: inspection.scrollback.viewportRows,
      scrollbackTotalRows: inspection.scrollback.totalRows,
    },
    hint: { copyMode, inputMode: terminalShellInputMode.peek() },
  });
  for (const header of headerRows) {
    const statusRow = header.kind === "status";
    write(
      frame,
      row,
      rect.column,
      paint(
        fit(header.text, rect.width),
        statusRow
          ? {
            fg: contrastText(statusTone, t.background, t.text),
            bg: statusTone,
            bold: true,
          }
          : { fg: t.soft, bg: t.panelSoft },
      ),
    );
    row += 1;
  }

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

  renderTerminalShellPanes(frame, bodyRect, copyMode);
}

function renderTerminalShellPanes(frame: Frame, rect: Rectangle, copyMode: boolean): void {
  if (rect.width <= 0 || rect.height <= 0) return;
  const workspace = terminalShell.inspect().workspace;
  const projections = workbenchTerminalPaneProjectionsInto(
    terminalShellBuffers.paneProjections,
    workspace.layout,
    rect,
    {
      gap: 1,
      fallbackSessionId: workspace.activeId,
      titleForSession: (sessionId) => workspace.sessions.find((entry) => entry.id === sessionId)?.title,
    },
  );
  const titleCommands = workbenchTerminalPaneTitleRenderCommandsInto(
    terminalShellBuffers.paneTitleCommands,
    projections,
    theme(),
    contrastText,
  );
  let titleIndex = 0;
  for (const projection of projections) {
    const shell = projection.sessionId ? terminalShell.shell(projection.sessionId) : activeTerminalShell();
    if (!shell) continue;
    const titleCommand = projection.titleVisible ? titleCommands[titleIndex++] : undefined;
    renderTerminalShellPane(frame, projection, shell, copyMode && projection.active, titleCommand);
  }
}

function renderTerminalShellPane(
  frame: Frame,
  projection: WorkbenchTerminalPaneProjection,
  shell: TerminalShellController,
  copyMode: boolean,
  titleCommand?: WorkbenchTerminalPaneTitleRenderCommand,
): void {
  const rect = projection.rect;
  if (rect.width <= 0 || rect.height <= 0) return;
  const active = projection.active;
  const t = theme();
  fillRect(frame, rect, active ? t.surface : t.background);
  const content = projection.contentRect;
  if (titleCommand) {
    write(
      frame,
      titleCommand.rect.row,
      titleCommand.rect.column,
      paint(titleCommand.text, titleCommand.style),
    );
    if (titleCommand.paneId) {
      addHit(titleCommand.hitRect, {
        type: "terminalShellPane",
        id: titleCommand.paneId,
      });
    }
  }
  if (content.width <= 0 || content.height <= 0) return;
  shell.resize(content.width, content.height);
  if (active) addHit(content, { type: "terminalShellContent" });
  if (copyMode) {
    renderTerminalShellCopyPane(frame, content, shell);
    return;
  }
  const cursor = shell.screen.cursor;
  const cursorActive = activeWindow.peek() === TERMINAL_SHELL_WINDOW_ID && terminalShellInputMode.peek() === "raw" &&
    active && shell.running;
  const rows = shell.screen.cellRows();
  for (let screenRow = 0; screenRow < content.height; screenRow += 1) {
    const cells = rows[screenRow] ?? [];
    for (let column = 0; column < content.width; column += 1) {
      const cell = cells[column] ?? { char: " " };
      const atCursor = cursorActive && cursor.row === screenRow && cursor.column === column;
      const style = apiWorkbenchTerminalCellStyle(cell, t, atCursor);
      const char = atCursor && cell.char === " " ? " " : cell.char;
      write(frame, content.row + screenRow, content.column + column, paint(char, style));
    }
  }
}

function renderTerminalShellCopyPane(frame: Frame, rect: Rectangle, shell: TerminalShellController): void {
  const t = theme();
  const inspection = shell.inspect();
  const rows = workbenchTerminalCopyRowsInto(terminalShellBuffers.copyRows, {
    visibleRows: inspection.scrollback.visibleRows,
    offset: inspection.scrollback.offset,
    height: rect.height,
    selection: inspection.scrollback.selection,
    prefixWidth: 5,
  });
  for (const row of rows) {
    addHit({ column: rect.column, row: rect.row + row.screenRow, width: rect.width, height: 1 }, {
      type: "terminalShellCopyRow",
      index: row.rowIndex,
    });
    write(
      frame,
      rect.row + row.screenRow,
      rect.column,
      paint(fit(row.prefix, Math.min(5, rect.width)), {
        fg: row.selected ? t.background : t.soft,
        bg: row.selected ? t.warn : t.panelSoft,
        bold: row.selected,
      }),
    );
    if (rect.width > 5) {
      write(
        frame,
        rect.row + row.screenRow,
        rect.column + 5,
        paint(fit(row.text, rect.width - 5), {
          fg: row.selected ? t.background : t.text,
          bg: row.selected ? t.warn : t.surface,
          bold: row.selected,
        }),
      );
    }
  }
}

function renderTerminalShellToolbar(frame: Frame, rect: Rectangle, startRow: number): number {
  const workspaceInspection = terminalShell.inspect();
  const shell = activeTerminalShell();
  const shellInspection = shell?.inspect();
  workbenchTerminalToolbarItemsInto(
    terminalShellButtonBuffers.items,
    workbenchTerminalToolbarStateFromSnapshot({
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
  );
  const nextRow = layoutWorkbenchButtonRowInto(
    terminalShellButtonBuffers.placements,
    terminalShellButtonBuffers.items,
    rect,
    startRow,
  );

  workbenchButtonRowRenderCommandsInto(terminalShellButtonBuffers.commands, terminalShellButtonBuffers.placements);
  for (const button of terminalShellButtonBuffers.commands) {
    const projection = projectWorkbenchButtonCommand(button, theme(), contrastText);
    write(
      frame,
      button.rect.row,
      button.rect.column,
      paint(projection.text, projection.style),
    );
    if (!button.item.disabled) {
      addHit(button.hitRect, { type: "terminalShell", action: button.item.action });
    }
  }
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
  const t = theme();
  if (startRow >= rect.row + rect.height) return startRow;
  workbenchTerminalSessionTabSourcesInto(terminalShellSessionTabBuffers.sources, inspection.sessions);
  workbenchTerminalSessionTabsInto(
    terminalShellSessionTabBuffers.placements,
    terminalShellSessionTabBuffers.sources,
    inspection.activeId,
    { column: rect.column, row: startRow, width: rect.width, height: 1 },
  );
  workbenchTerminalSessionTabRenderCommandsInto(
    terminalShellSessionTabBuffers.commands,
    terminalShellSessionTabBuffers.placements,
    {
      column: rect.column,
      row: startRow,
      width: rect.width,
      height: 1,
    },
  );
  for (const command of terminalShellSessionTabBuffers.commands) {
    const style = command.active
      ? { fg: contrastText(t.accent, t.background, t.text), bg: t.accent, bold: true }
      : { fg: t.text, bg: t.panelSoft, bold: false };
    write(frame, command.rect.row, command.rect.column, paint(command.text, style));
    if (command.kind === "tab" && command.id) {
      addHit(command.rect, {
        type: "terminalShellSession",
        id: command.id,
      });
    }
  }
  return startRow + 1;
}

function renderHtmlCssLayout(frame: Frame, rect: Rectangle): void {
  const t = theme();
  const result = createHtmlCssLayoutDemo(rect);
  const boxes = htmlCssVisibleLayoutBoxesInto(htmlCssLayoutBoxes, result.layout.boxes);
  const commands = htmlCssLayoutRenderCommandsInto(htmlCssLayoutRenderCommands, {
    bounds: rect,
    boxes,
    theme: t,
    contrast: contrastText,
    summaryRows: htmlCssLayoutSummaryRows("terminal"),
  });
  for (const command of commands) {
    if (command.kind === "fill") {
      fillRect(frame, command.rect, command.bg);
    } else {
      write(
        frame,
        command.row,
        command.column,
        paint(fit(command.text, command.maxWidth), {
          fg: command.fg,
          bg: command.bg,
          bold: command.bold,
        }),
      );
    }
  }
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
  const commands = apiWorkbenchWrappedOptionsRenderCommandsInto(
    controlWrappedOptionRenderCommands,
    controlWrappedOptionHitPlacements,
    {
      rect,
      startRow,
      id,
      items,
      selectedIndex,
      activeId: activeControl.peek(),
    },
  );
  for (const command of commands) {
    write(
      frame,
      command.row,
      command.column,
      paint(command.text, apiWorkbenchWrappedOptionStyle(t, command.active)),
    );
  }
  for (let index = 0; index < controlWrappedOptionHitPlacements.length; index += 1) {
    const hit = controlWrappedOptionHitPlacements[index]!;
    addHit({ column: hit.column, row: hit.row, width: hit.width, height: hit.height }, {
      type: "control",
      id: hit.id,
      action: hit.action,
      index: hit.index,
    });
  }
}

function addInlineStepperHits(rect: Rectangle, row: number): void {
  const placements = apiWorkbenchStepperHitPlacementsInto(
    controlStepperHitPlacements,
    workflowStepper.steps.peek(),
    workflowStepper.activeIndex.peek(),
    rect,
    row,
  );
  for (let index = 0; index < placements.length; index += 1) {
    const placement = placements[index]!;
    addHit({
      column: placement.column,
      row: placement.row,
      width: placement.width,
      height: placement.height,
    }, {
      type: "control",
      id: placement.id,
      action: placement.action,
      index: placement.index,
    });
  }
}

function renderShelf(frame: Frame): void {
  const row = currentHeight() - 2;
  const entries = workbenchShelfEntriesInto(shelfBuffers.entries, windowManager.inspect().windows, windowTitle);
  if (entries.length === 0) return;
  const layout = layoutWorkbenchShelfInto(shelfBuffers.shelfLayout, {
    row,
    column: 1,
    width: Math.max(0, currentWidth() - 1),
    entries,
  });
  const commands = workbenchShelfRenderCommandsInto(shelfBuffers.shelfCommands, layout);
  for (const command of commands) {
    if (command.kind === "prefix") {
      write(
        frame,
        command.rect.row,
        command.rect.column,
        paint(command.text, { fg: theme().muted, bg: theme().backgroundSoft }),
      );
    } else {
      writeButton(frame, command.rect.row, command.rect.column, command.label, {
        state: command.state,
        tone: command.tone,
        maxWidth: command.rect.width,
      });
      addHit(command.hitRect, { type: "restore", id: command.id });
    }
  }
}

function renderWindowTabs(frame: Frame): void {
  const row = currentHeight() - 2;
  const t = theme();
  fillRow(frame, row, t.backgroundSoft);
  const layout = layoutWorkbenchTabsInto(shelfBuffers.tabLayout, {
    row,
    column: 1,
    width: Math.max(0, currentWidth() - 1),
    tabs: workbenchTabEntriesInto(shelfBuffers.tabs, windowManager.inspect().tabs, windowTitle),
  });
  const commands = workbenchShelfRenderCommandsInto(shelfBuffers.tabCommands, layout);
  for (const command of commands) {
    if (command.kind === "prefix") {
      write(frame, command.rect.row, command.rect.column, paint(command.text, { fg: t.muted, bg: t.backgroundSoft }));
    } else {
      writeButton(frame, command.rect.row, command.rect.column, command.label, {
        state: command.state,
        tone: command.tone,
        maxWidth: command.rect.width,
      });
      addHit(command.hitRect, { type: "windowTab", id: command.id });
    }
  }
}

function renderStatus(frame: Frame): void {
  const t = theme();
  const width = currentWidth();
  const line = workbenchStatusSnapshotLine({
    snapshot: {
      focus: windowTitle(activeWindow.peek()),
      theme: theme().label,
      tileDensity: tileDensity.peek(),
      diagnostics: formatWorkbenchDiagnosticStatus(workbenchDiagnostics),
    },
    width,
  });
  write(frame, currentHeight() - 1, 0, paint(line, { fg: t.text, bg: t.panelSoft }));
}

function renderActiveDropdownOverlay(frame: Frame): void {
  const bounds = { column: 0, row: 3, width: currentWidth(), height: Math.max(0, currentHeight() - 5) };
  renderDropdownOverlay(frame, bounds, workspaceScroll.offset.peek().rows);
}

function emptyWorkspaceMessage(): string {
  return workbenchEmptyWorkspaceMessage({ windows: windowManager.inspect().windows });
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

  const rowCommands = workbenchModalRowRenderCommandsInto(modalBuffers.rowCommands, {
    inspection,
    inner,
    contentWidth: rect.width,
  });
  let actionRow: number | undefined;
  for (const command of rowCommands) {
    if (command.kind === "actions") actionRow = command.rect.row;
    write(
      frame,
      command.rect.row,
      command.rect.column,
      paint(fit(command.text, command.rect.width), {
        fg: command.kind === "title" ? t.accent : t.text,
        bg: command.kind === "actions" ? t.panel : t.panelSoft,
        bold: command.kind === "actions" || command.kind === "title",
      }),
    );
  }

  if (inspection.actions.length === 0 || actionRow === undefined) return;
  workbenchModalActionButtonsInto(modalBuffers.actionItems, inspection);
  layoutWorkbenchButtonRowInto(
    modalBuffers.actionPlacements,
    modalBuffers.actionItems,
    { column: inner.column, row: actionRow, width: inner.width, height: 1 },
    actionRow,
  );
  workbenchButtonRowRenderCommandsInto(modalBuffers.actionCommands, modalBuffers.actionPlacements);
  for (const command of modalBuffers.actionCommands) {
    const button = projectWorkbenchButtonCommand(command, theme(), contrastText);
    write(
      frame,
      command.rect.row,
      command.rect.column,
      paint(button.text, button.style),
    );
    addHit(command.hitRect, { type: "modalAction", index: command.item.action });
  }
}

type ThreeConfigRow = WorkbenchAsciiConfigRow;

const threeConfigRows: readonly ThreeConfigRow[] = defaultWorkbenchAsciiConfigRows;
const threeConfigBuffers = new WorkbenchAsciiConfigModalBufferCache<ThreeConfigRow>();

function renderThreeConfigModal(frame: Frame): void {
  const t = theme();
  const screen = { column: 0, row: 0, width: currentWidth(), height: currentHeight() };
  addHit(screen, { type: "asciiConfigBackdrop" });
  const layout = layoutWorkbenchAsciiConfigModal({ bounds: screen, rowCount: threeConfigRows.length });
  if (layout.shadow.width > 0 && layout.shadow.height > 0) fillRect(frame, layout.shadow, t.background);
  fillRect(frame, layout.rect, t.panelSoft);
  drawFrame(frame, layout.rect, "Three Renderer Config", true);

  const inner = layout.inner;
  const current = configuredAscii().peek();
  const title = formatWorkbenchAsciiConfigTitle(windowTitle(configuredAsciiWindow()), current);
  write(frame, inner.row, inner.column, paint(fit(title, inner.width), { fg: t.accent, bg: t.panelSoft, bold: true }));
  const placements = workbenchAsciiConfigRowPlacementsInto(threeConfigBuffers.rowPlacements, threeConfigRows, {
    inner,
    rowsTop: layout.rowsTop,
    visibleRows: layout.visibleRows,
    selectedIndex: threeConfigSelected.peek(),
  });
  const rowCommands = workbenchAsciiConfigRowRenderCommandsInto(threeConfigBuffers.rowRenderCommands, placements, {
    text: threeConfigRowText,
  });
  for (const command of rowCommands) {
    const selected = command.selected;
    const bg = selected ? t.warn : t.surface;
    const fg = selected ? t.background : t.text;
    const text = command.kind === "fill" ? " ".repeat(command.rect.width) : fit(command.text, command.rect.width);
    write(
      frame,
      command.rect.row,
      command.rect.column,
      paint(text, { fg, bg, bold: command.kind === "text" && selected }),
    );
  }
  for (const placement of placements) {
    addHit(placement.previousRect, {
      type: "asciiConfig",
      index: placement.rowIndex,
      action: "previous",
    });
    addHit(placement.nextRect, {
      type: "asciiConfig",
      index: placement.rowIndex,
      action: "next",
    });
  }
  workbenchAsciiConfigModalActionRenderCommandsInto(
    threeConfigBuffers.actionCommands,
    threeConfigBuffers.actionItems,
    threeConfigBuffers.actionPlacements,
    { inner, actionRow: layout.actionRow },
  );
  for (const command of threeConfigBuffers.actionCommands) {
    const button = projectWorkbenchButtonCommand(command, theme(), contrastText);
    write(
      frame,
      command.rect.row,
      command.rect.column,
      paint(button.text, button.style),
    );
    addHit(command.hitRect, {
      type: "asciiConfigAction",
      action: command.item.action,
    });
  }
  const footer = "Up/Down select  Left/Right change  Enter toggle  A apply  O OK  Esc cancel";
  write(
    frame,
    layout.footerRow,
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
  const next = applyWorkbenchAsciiConfigRowAction(configuredAscii().peek(), row, action, ASCII_DEMO_PRESET_IDS);
  setConfiguredAscii(next.options, `three config ${next.message}`, { persist: false });
}

function kittyGraphicsStatus(): string {
  const current = configuredAscii().peek();
  return formatWorkbenchKittyGraphicsStatus({
    selected: current,
    tmux: kittyGraphics.tmux,
    tmuxPassthroughAllowed: kittyGraphics.tmuxPassthroughAllowed,
    surface: kittyGraphics.surfaceFor(current).inspect(),
  });
}

function drawFrame(frame: Frame, rect: Rectangle, title: string, active: boolean): void {
  const commands = workbenchFrameRenderCommandsInto(windowFrameRenderCommands, windowFrameBoxLines, {
    rect,
    title,
    active,
    theme: theme(),
  });
  for (const command of commands) {
    if (command.kind === "fill") {
      fillRect(frame, command.rect, command.bg);
    } else {
      write(frame, command.row, command.column, paint(command.text, command.style));
    }
  }
}

function workspaceLayout(bounds: Rectangle): {
  bounds: Rectangle;
  contentHeight: number;
  rects: Map<WindowId, Rectangle>;
} {
  return workbenchAdaptiveWindowLayout<WindowId>(windowManager, { bounds, tileDensity: tileDensity.peek() });
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
  const sources = usesRealSystem ? realWorkbenchSources(visualizationId, system, phase) : syntheticWorkbenchSourcesInto(
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

function realWorkbenchSources(visualizationId: string, system: SystemSnapshot, phase: number): SourceFrame[] {
  const sourceIds = monitorSourceIdsInto(realSourceIdBuffer, visualizationId);
  return resolveSourceFramesInto(realSourceFrameBuffer, sourceIds, system, workbenchAudioRegistry, phase);
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
  blitWorkbenchFrameCells(frame, content, viewport, offset);
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
  const commands = workbenchWindowScrollbarRenderCommandsInto(windowScrollbarRenderCommands, {
    inner,
    viewport,
    overflow,
  });
  for (const command of commands) {
    addHit(command.rect, { type: command.axis === "vertical" ? "windowVScrollbar" : "windowHScrollbar", id });
    for (const cell of command.cells) {
      write(frame, cell.row, cell.column, paint(cell.glyph, { fg: t.accent, bg: t.panelSoft, bold: true }));
    }
  }
}

function ensureVisualizationThreePanel(id: VisualizationWindowId): DynamicThreePanel {
  return visualizationThreePanels.ensure(id);
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
    interactive: () => isThreeWindowInteractive(id),
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

function syncWorkbenchThreeFrameInterval(): void {
  workbenchThreeRuntime.syncFrameInterval();
}

function hasLiveThreeRenderedWindow(): boolean {
  return workbenchThreeWindowState.live;
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

function isThreeWindowInteractive(id: WindowId): boolean {
  return workbenchThreeWindowStateIsInteractive(workbenchThreeWindowState, id);
}

function setGenericModalBlocksThree(open: boolean, _inspection?: ModalInspection): void {
  genericModalBlocksThree.value = open && !threeConfigOpen.peek();
}

function hideVisualizationThreePanel(id: VisualizationWindowId): void {
  visualizationThreePanels.hide(id);
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

function setThreeGraphicsRect(rect: Rectangle): void {
  setWorkbenchThreeRect(threeGraphicsRect, rect);
}

function hideBuiltinThreeRects(): void {
  hideWorkbenchThreeRect(threeBodyRect);
  hideWorkbenchThreeRect(threeGraphicsRect);
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

function blitWorkspace(frame: Frame, virtual: Frame, bounds: Rectangle, offset: number, width: number): void {
  blitWorkbenchFrameCells(frame, virtual, { ...bounds, width }, { columns: 0, rows: offset });
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

  const commands = workbenchDropdownOverlayRenderCommandsInto(dropdownOverlayRenderCommands, {
    rect,
    bounds: clip,
    items: overlay.items,
    itemIndexes: overlay.itemIndexes,
    selectedIndex: overlay.selectedIndex,
  });
  for (const command of commands) {
    if (command.kind === "fill") {
      fillRect(frame, command.rect, t.panelSoft);
      continue;
    }
    const style = command.selected
      ? { fg: t.background, bg: t.warn, bold: true }
      : command.kind === "item"
      ? { fg: t.text, bg: t.panelSoft, bold: false }
      : { fg: t.accent, bg: t.panelSoft, bold: true };
    write(frame, command.rect.row, command.rect.column, paint(command.text ?? "", style));
    if (command.kind === "item" && command.hitRect && command.hitRect.width > 0 && command.hitRect.height > 0) {
      const actionIndex = command.itemIndex ?? command.sourceIndex ?? 0;
      addHit(
        command.hitRect,
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
}

function scrollWindow(id: WindowId, columns: number, rows: number): void {
  windowScroll(id).scrollBy(columns, rows);
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
  return resolveApiWorkbenchHitWindowId<WindowId>(hit.action, {
    terminalShell: TERMINAL_SHELL_WINDOW_ID,
    controls: "controls",
    data: "data",
    explorer: "explorer",
  });
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

function selectWindowTab(id: WindowId): void {
  windowManager.selectTab(id);
  syncAndLogWindowAction("fullscreenTab", id);
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
    loadedVisualizationIds: currentWorkspaceVisualizationIds(),
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

function workspaceMenuLabels(): string[] {
  return workspaceMenuLabelsInto(workspaceMenuLabelBuffer, workspaceMenuEntries());
}

function workspaceMenuItemCount(): number {
  return workspaceMenuEntries().length;
}

function currentWorkspaceVisualizationIds(): string[] {
  return workspaceVisualizationIdsFromWindowsInto(currentWorkspaceVisualizationIdBuffer, currentWorkspaceWindows());
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

function defaultWorkspaceName(): string {
  return defaultWorkspaceNameFromCount(savedWorkspaces.peek().length);
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

async function loadSavedWorkspaces(): Promise<SavedWorkspace[]> {
  return await loadWorkbenchWorkspaceStorage(workspaceStorageOptions());
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
    cycleDataSortColumn(event.shift ? -1 : 1);
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
      const target = windowIds()[action.index];
      if (!target) return false;
      focus(target);
      return true;
    }
    case "restoreNextMinimized":
      restoreNextMinimizedWindow();
      return true;
    case "adjustTileDensity":
      adjustTileDensity(action.delta);
      return true;
    case "scrollPage":
      if (options.phase !== "preWindow") return false;
      scrollWindow(id, 0, action.delta * windowScrollPage(id));
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
      openWorkspaceMenu();
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
  const projected = projectWorkbenchStandardTopMenuState(state);
  themeMenuOpen.value = projected.themeMenuOpen;
  newWindowMenuOpen.value = projected.newWindowMenuOpen;
  workspaceMenuOpen.value = projected.workspaceMenuOpen;
  menuFocused.value = projected.menuFocused;
}

function restoreNextMinimizedWindow(): void {
  const restored = windowManager.restoreNextMinimized();
  if (!restored) {
    pushLog("no minimized windows");
    return;
  }
  syncWindowSignalsFromManager();
  pushLog(`restore ${windowTitle(restored.id as WindowId)}`);
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
      activeControl.value = controlAt(resolved.delta);
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
  return isApiWorkbenchTextControlActive(activeWindow.peek(), "controls", activeControl.peek());
}

function controlAt(delta: number): ControlId {
  return apiWorkbenchControlAt(activeControl.peek(), delta);
}

function controlAtEdge(delta: number): ControlId | undefined {
  return apiWorkbenchControlAtEdge(activeControl.peek(), delta);
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

function workbenchFrameWidth(frame: Frame): number {
  return framePainter.width(frame);
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
    touchOptimized: isTouchOptimizedLayout(),
  });
}

function isTouchOptimizedLayout(): boolean {
  return isApiWorkbenchTouchOptimizedLayout({
    columns: currentWidth(),
    rows: currentHeight(),
  });
}

function windowTitle(id: WindowId): string {
  const visualizationLabel = isVisualizationWindow(id)
    ? visualizationOption(dynamicVisualizationWindows.peek()[id])?.label ?? ""
    : undefined;
  return apiWorkbenchWindowTitle({
    id,
    visualizationLabel,
    terminalOutputId: TERMINAL_OUTPUT_WINDOW_ID,
    terminalOutputTitle: id === TERMINAL_OUTPUT_WINDOW_ID ? terminalOutputWindowTitle() : undefined,
    terminalShellId: TERMINAL_SHELL_WINDOW_ID,
    terminalShellTitle: id === TERMINAL_SHELL_WINDOW_ID ? terminalShellWindowTitle() : undefined,
    fallback: "Three ASCII",
  });
}

function terminalOutputWindowTitle(): string {
  const mode = terminalInputMode.peek() === "raw" ? "RAW" : "WB";
  return formatTerminalOutputWindowTitle(terminalOutputSession.inspect(), { mode });
}

function terminalShellWindowTitle(): string {
  const mode = terminalShellInputMode.peek() === "raw" ? "RAW" : "WB";
  const shell = activeTerminalShell();
  return shell ? formatTerminalShellWindowTitle(shell.inspect(), { mode }) : `Shell ${mode} EMPTY`;
}

function windowIds(): WindowId[] {
  return windowManager.ids() as WindowId[];
}

function isVisualizationWindow(id: WindowId): id is VisualizationWindowId {
  return isWorkbenchVisualizationWindowId(id);
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
