import { BoxObject } from "../src/canvas/box.ts";
import { TextObject, type TextRectangle } from "../src/canvas/text.ts";
import { ButtonController } from "../src/components/button.ts";
import { CheckBoxController } from "../src/components/checkbox.ts";
import { ComboBoxController } from "../src/components/combobox.ts";
import { DataTableController } from "../src/components/data_table.ts";
import { createFileExplorerTree, FileExplorerController } from "../src/components/file_explorer.ts";
import { InputController } from "../src/components/input.ts";
import { MenuBarController, renderMenuBar } from "../src/components/menu_bar.ts";
import { modalContentHeight, ModalController } from "../src/components/modal.ts";
import { ProgressBarController } from "../src/components/progressbar.ts";
import { RadioGroupController } from "../src/components/radio_group.ts";
import { ScrollAreaController, scrollbarOffsetForPointer } from "../src/components/scroll_area.ts";
import { SliderController } from "../src/components/slider.ts";
import { StepperController } from "../src/components/stepper.ts";
import { formatTerminalOutputLine } from "../src/components/terminal_output.ts";
import { TextBoxController, type TextBoxVisualLine } from "../src/components/textbox.ts";
import {
  appendBoundedWorkbenchLogRow,
  buttonText,
  centerCellText as centerText,
  clampWorkbenchTileDensity,
  clipRect,
  contrastText,
  createWorkbenchShelfLayoutBuffers,
  createWorkbenchTitlebarLayout,
  createWorkbenchVisualizationWindowOptions,
  createWorkbenchWorkspaceStore,
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
  layoutWorkbenchHeaderInto,
  layoutWorkbenchMenuBarHitsInto,
  layoutWorkbenchModal,
  layoutWorkbenchShelfInto,
  layoutWorkbenchTabsInto,
  layoutWorkbenchTitlebarInto,
  layoutWorkbenchTopMenuItemRect,
  loadWorkbenchWorkspaceStorage,
  normalizeWorkbenchWorkspaceName,
  persistWorkbenchWorkspaceStorage,
  prepareWorkbenchFrame,
  projectWorkbenchButton,
  projectWorkbenchButtonCommand,
  renameWorkbenchWorkspace,
  renderFrameRow,
  renderFrameSlice,
  subscribeWorkbenchDiagnosticLog,
  translateHitTargets,
  updateWorkbenchLineSignals,
  upsertWorkbenchWorkspace,
  workbenchAdaptiveWindowLayout,
  workbenchButtonPaintOptions,
  type WorkbenchButtonTone,
  workbenchContentViewport,
  type WorkbenchDropdownOverlayRenderCommand,
  workbenchDropdownOverlayRenderCommandsInto,
  workbenchEmptyWorkspaceMessage,
  type WorkbenchFrame,
  type WorkbenchFrameBoxLine,
  workbenchFrameBoxLinesInto,
  workbenchHeaderHelp,
  type WorkbenchHeaderLayout,
  type WorkbenchMenuBarHitLayout,
  workbenchModalActionButtonsInto,
  type WorkbenchModalRowRenderCommand,
  workbenchModalRowRenderCommandsInto,
  type WorkbenchScrollbarRenderCommand,
  workbenchShelfEntriesInto,
  workbenchShelfRenderCommandsInto,
  workbenchStatusLine,
  workbenchTabEntriesInto,
  type WorkbenchTerminalOutputToolbarAction,
  workbenchTerminalOutputToolbarItemsInto,
  type WorkbenchTitlebarButtonKind,
  type WorkbenchTitlebarButtonRenderCommand,
  workbenchTitlebarButtonRenderCommandsInto,
  type WorkbenchTitlebarLayout,
  workbenchVisualizationIdFromWindowId,
  workbenchVisualizationWindowId,
  type WorkbenchWindowOption,
  workbenchWindowOptionMenuLabelsInto,
  workbenchWindowOptionMinimums,
  workbenchWindowScrollbarRenderCommandsInto,
  type WorkbenchWorkspace,
  workbenchWorkspaceScrollbarRenderCommandsInto,
  type WorkbenchWorkspaceStorageOptions,
  WorkbenchWorkspaceViewportController,
  type WorkbenchWorkspaceWindow,
  workbenchWorkspaceWindowEntries,
  writeFrame,
} from "../src/app/workbench/mod.ts";
import { inspectWorkbenchWindowSignalState, WorkbenchController } from "../src/app/workbench/controller.ts";
import {
  applyWorkbenchAsciiConfigRowAction,
  createDefaultWorkbenchAsciiOptions,
  defaultWorkbenchAsciiConfigRows,
  formatWorkbenchAsciiConfigRowText,
  formatWorkbenchAsciiConfigTitle,
  moveWorkbenchAsciiConfigSelection,
  WorkbenchAsciiConfigController,
  type WorkbenchAsciiConfigRow,
} from "../src/app/workbench_ascii.ts";
import {
  layoutWorkbenchAsciiConfigModal,
  type WorkbenchAsciiConfigModalAction,
  workbenchAsciiConfigModalActionRenderCommandsInto,
  type WorkbenchAsciiConfigRowPlacement,
  workbenchAsciiConfigRowPlacementsInto,
  type WorkbenchAsciiConfigRowRenderCommand,
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
import { MicrotaskScheduler } from "../src/runtime/render_loop.ts";
import { type TerminalBackend } from "../src/runtime/terminal_backend.ts";
import type { TerminalShellController } from "../src/runtime/terminal_shell.ts";
import { TerminalShellWorkspaceController } from "../src/runtime/terminal_shell_workspace.ts";
import {
  formatTerminalOutputHint,
  formatTerminalOutputWindowTitle,
  formatTerminalShellHint,
  formatTerminalShellStatusLine,
  formatTerminalShellWindowTitle,
  summarizeTerminalStatus,
  terminalInputModeDisplayLabel,
} from "../src/runtime/terminal_status.ts";
import { shellTerminalTemplate } from "../src/runtime/terminal_templates.ts";
import {
  terminalCellStyle,
  terminalOutputLineStyle,
  terminalStatusToneColor,
} from "../src/app/workbench_terminal_style.ts";
import { Computed, Signal } from "../src/signals/mod.ts";
import { probeCompatibleWebGPUDevice } from "../src/three_ascii/webgpu_compat.ts";
import { Tui } from "../src/tui.ts";
import type { Rectangle } from "../src/types.ts";
import { textWidth } from "../src/utils/strings.ts";
import {
  layoutWorkbenchButtonRowInto,
  type WorkbenchButtonRowItem,
  type WorkbenchButtonRowPlacement,
  type WorkbenchButtonRowRenderCommand,
  workbenchButtonRowRenderCommandsInto,
  wrappedControlOptionRowCount,
} from "../src/app/workbench_control_layout.ts";
import { maxTextWidth, type VisibleMenuSlice, visibleMenuSliceInto } from "../src/app/workbench_text.ts";
import {
  nextWorkbenchTerminalSessionId,
  resolveWorkbenchShellBackend,
  type WorkbenchTerminalCopyRowProjection,
  workbenchTerminalCopyRowsInto,
  type WorkbenchTerminalPaneProjection,
  workbenchTerminalPaneProjectionsInto,
  type WorkbenchTerminalSessionTab,
  type WorkbenchTerminalSessionTabPlacement,
  type WorkbenchTerminalSessionTabRenderCommand,
  workbenchTerminalSessionTabRenderCommandsInto,
  workbenchTerminalSessionTabsInto,
  workbenchTerminalSessionTitleFromId,
  type WorkbenchTerminalToolbarAction,
  workbenchTerminalToolbarItemsInto,
} from "../src/app/workbench_terminal.ts";
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
  apiWorkbenchButtonRowInto,
  type ApiWorkbenchCheckboxOption,
  apiWorkbenchCheckboxRowsInto,
  apiWorkbenchComboHeaderRowsInto,
  apiWorkbenchControlBaseStyle,
  apiWorkbenchControlButtonDetailStyle,
  type ApiWorkbenchControlHitPlacement,
  type ApiWorkbenchControlId,
  apiWorkbenchControlLineInto,
  type ApiWorkbenchControlLineRenderCommand,
  apiWorkbenchControlLineRenderCommandsInto,
  type ApiWorkbenchControlLineSegment,
  apiWorkbenchControlsRowsInto,
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
  nextApiWorkbenchControlId,
  nextSortableDataColumn,
} from "./api_workbench_controls.ts";
import {
  createHtmlCssLayoutDemo,
  HTML_CSS_LAYOUT_OPTION_ID,
  HTML_CSS_LAYOUT_WINDOW_ID,
} from "../src/markup/demo_fixtures.ts";
import {
  type HtmlCssLayoutRenderCommand,
  htmlCssLayoutRenderCommandsInto,
  htmlCssLayoutSummaryRows,
  htmlCssVisibleLayoutBoxesInto,
} from "./html_css_layout_view.ts";
import { ASCII_DEMO_PRESETS, asciiDemoPresetIds, cloneAsciiOptions, normalizeAsciiOptions } from "./ascii_options.ts";
import { resolveSourceFramesInto } from "./sources.ts";
import { makeStyle } from "./styles.ts";
import { SystemMonitor } from "./system_metrics.ts";
import { requireInteractiveTerminal } from "./terminal_guard.ts";
import { ThreePanelFrameView } from "./three_panel.ts";
import { workbenchDataTablePageSize, workbenchDataTableRowsInto } from "./workbench_data_table.ts";
import { explorerTextRowsInto, workbenchWindowContentSize } from "./workbench_content_size.ts";
import { workbenchExplorerRowsInto } from "./workbench_explorer.ts";
import { workbenchInspectorRowsInto } from "./workbench_inspector.ts";
import { workbenchLogRowsFromSourcesInto } from "./workbench_logs.ts";
import { writeWorkbenchThreeGrid } from "./workbench_three_grid.ts";
import { setWorkbenchThreeSceneSignal, type WorkbenchThreeScene } from "./workbench_three_scene.ts";
import {
  threeRendererModeLabel,
  visualizationTextContentSize,
  visualizationThreeStatusLine,
  workbenchThreeFallbackRowsInto,
  workbenchVisualizationRowsInto,
} from "./workbench_visualization_window.ts";
import {
  buildWorkspaceMenuEntriesInto,
  currentWorkspaceVisualizationIds as workspaceVisualizationIdsFromWindows,
  currentWorkspaceWindows as currentWorkspaceWindowsFromIds,
  defaultWorkspaceName as defaultWorkspaceNameFromCount,
  deleteWorkspaceModalContent,
  normalizeWorkspaceName as normalizeWorkspaceNameFromCount,
  renameWorkspaceModalContent,
  saveWorkspaceModalContent,
  workspaceDeletedModalContent,
  type WorkspaceMenuEntry,
  workspaceMenuLabelsInto,
  workspaceMissingModalContent,
  workspaceNameModalBody as buildWorkspaceNameModalBody,
  workspaceRenamedModalContent,
  workspaceSavedModalContent,
} from "./workbench_workspace_menu.ts";
import {
  workbenchDemoModalContent,
  workbenchHelpModalContent,
  workbenchModalConfirmedContent,
  workbenchModalDetailsContent,
  workbenchQuitModalContent,
} from "./workbench_modal_content.ts";
import { WorkbenchKittyGraphicsController } from "./workbench_kitty_graphics.ts";
import { type RowStyle, threeHeaderRows } from "./workbench_rows.ts";
import type {
  Accent,
  AsciiOptions,
  PanelRender,
  RenderContext,
  SlotConfig,
  SourceFrame,
  SystemSnapshot,
} from "./types.ts";
import {
  cpuHexGridColumnCount,
  type CpuHexNavigationKey,
  type CpuHexTileLayout,
  cpuHexTileLayoutInto,
  nextCpuHexLabel,
  renderVisualization,
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
const terminalOutputButtonItems: WorkbenchButtonRowItem<TerminalOutputAction>[] = [];
const terminalOutputButtonPlacements: WorkbenchButtonRowPlacement<TerminalOutputAction>[] = [];
const terminalOutputButtonCommands: WorkbenchButtonRowRenderCommand<TerminalOutputAction>[] = [];
const terminalShellButtonItems: WorkbenchButtonRowItem<TerminalShellAction>[] = [];
const terminalShellButtonPlacements: WorkbenchButtonRowPlacement<TerminalShellAction>[] = [];
const terminalShellButtonCommands: WorkbenchButtonRowRenderCommand<TerminalShellAction>[] = [];
const terminalShellSessionTabSources: WorkbenchTerminalSessionTab[] = [];
const terminalShellSessionTabPlacements: WorkbenchTerminalSessionTabPlacement[] = [];
const terminalShellSessionTabCommands: WorkbenchTerminalSessionTabRenderCommand[] = [];
const terminalShellPaneProjections: WorkbenchTerminalPaneProjection[] = [];
const terminalShellCopyRows: WorkbenchTerminalCopyRowProjection[] = [];
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
const modalActionButtonItems: WorkbenchButtonRowItem<number>[] = [];
const modalActionButtonPlacements: WorkbenchButtonRowPlacement<number>[] = [];
const modalActionButtonCommands: WorkbenchButtonRowRenderCommand<number>[] = [];
const asciiConfigActionButtonItems: WorkbenchButtonRowItem<WorkbenchAsciiConfigModalAction>[] = [];
const asciiConfigActionButtonPlacements: WorkbenchButtonRowPlacement<WorkbenchAsciiConfigModalAction>[] = [];
const asciiConfigActionButtonCommands: WorkbenchButtonRowRenderCommand<WorkbenchAsciiConfigModalAction>[] = [];
const modalRowRenderCommands: WorkbenchModalRowRenderCommand[] = [];
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
const logRenderRows: RowStyle[] = [];
const terminalOutputContentRows: string[] = [];
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
const titlebarLayouts = new Map<WindowId, WorkbenchTitlebarLayout>();
const titlebarRenderCommands = new Map<WindowId, WorkbenchTitlebarButtonRenderCommand[]>();
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
const menuBarHitLayouts: WorkbenchMenuBarHitLayout[] = [];
const headerLayout: WorkbenchHeaderLayout = { menu: { column: 0, row: 0, width: 0, height: 1 } };
const minimizedShelfEntries: Array<{ id: WindowId; title: string }> = [];
const fullscreenTabEntries: Array<{ id: WindowId; title: string; selected?: boolean; hidden?: boolean }> = [];
const minimizedShelfLayoutBuffers = createWorkbenchShelfLayoutBuffers<WindowId>();
const fullscreenTabLayoutBuffers = createWorkbenchShelfLayoutBuffers<WindowId>();
const minimizedShelfRenderCommands: ReturnType<typeof workbenchShelfRenderCommandsInto<WindowId>> = [];
const fullscreenTabRenderCommands: ReturnType<typeof workbenchShelfRenderCommandsInto<WindowId>> = [];
const windowFrameBoxLines: WorkbenchFrameBoxLine[] = [];
const windowScrollbarRenderCommands: WorkbenchScrollbarRenderCommand[] = [];
const workspaceScrollbarRenderCommands: WorkbenchScrollbarRenderCommand[] = [];
const dropdownOverlayRenderCommands: WorkbenchDropdownOverlayRenderCommand[] = [];
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
const threeScene = new Computed<WorkbenchThreeScene | null>(() =>
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
  if (shellHit?.action.type === "terminalShellContent" && handleTerminalShellScroll(event)) {
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
  terminalShellSearchDraft.dispose();
  terminalShellSearchPromptOpen.dispose();
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
  updateWorkbenchLineSignals(lineSignals, frame, width, height);
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
  const titlebar = layoutWorkbenchTitlebarInto(titlebarLayout(id), {
    rect,
    title: windowTitle(id),
    showConfig: isThreeRenderedWindow(id),
  });
  const titlebarCommands = workbenchTitlebarButtonRenderCommandsInto(titlebarRenderCommandBuffer(id), titlebar);
  for (const command of titlebarCommands) {
    writeButton(frame, command.rect.row, command.rect.column, command.label, {
      compact: command.compact,
      tone: command.tone,
    });
    addHit(command.hitRect, titlebarHit(id, command.kind));
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
    setWorkbenchThreeSceneSignal(entry.scene, rendered.three ?? null);
    renderedVisualizationThreePanels.add(id);
    renderThreeGrid(frame, sceneRect, entry.panel.grid.peek(), t);
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
    writeRows(frame, rect, threeHeaderRows(mode, rect.width, t, threePanel.inspectPerformance()));
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

  writeWorkbenchThreeGrid(frame, rect, grid, paint(" ", { bg: t.surface }), { scale: "down" });
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
  controlCheckboxOptions[0] = { label: "live preview", checked: livePreview.checked.peek() };
  controlCheckboxOptions[1] = { label: "compact rows", checked: compactRows.checked.peek() };
  controlCheckboxOptions.length = 2;
  const selectedRadioValue = modeRadio.selectedValue.peek();
  const radioOptions = modeRadio.options.peek();
  for (let index = 0; index < radioOptions.length; index += 1) {
    const option = radioOptions[index]!;
    controlRadioOptions[index] = {
      label: option.label,
      selected: option.value === selectedRadioValue,
    };
  }
  controlRadioOptions.length = radioOptions.length;
  apiWorkbenchControlsRowsInto(controlProjectedRows, {
    buttonPressCount: actionButton.pressCount.peek(),
    genericButtonPressCount: genericButton.pressCount.peek(),
    modalOpen: modal.openState.peek(),
    slider: {
      track: sliderTrack,
      value: density.value.peek(),
      max: 10,
    },
    checkboxes: controlCheckboxOptions,
    radio: {
      items: controlRadioOptions,
      activeIndex: modeRadio.activeIndex.peek(),
    },
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

  const statusTone = terminalStatusToneColor(inspection.status, t);
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

  write(
    frame,
    row,
    rect.column,
    paint(fit(formatTerminalOutputHint(terminalInputMode.peek()), rect.width), { fg: t.soft, bg: t.panelSoft }),
  );
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
  workbenchTerminalOutputToolbarItemsInto(terminalOutputButtonItems, {
    running: terminalOutputSession.running,
    outputLineCount: terminalOutputSession.output.lines.peek().length,
    follow: terminalOutputSession.output.follow.peek(),
    inputMode: terminalInputMode.peek(),
  });
  const nextRow = layoutWorkbenchButtonRowInto(
    terminalOutputButtonPlacements,
    terminalOutputButtonItems,
    rect,
    startRow,
  );

  workbenchButtonRowRenderCommandsInto(terminalOutputButtonCommands, terminalOutputButtonPlacements);
  for (const button of terminalOutputButtonCommands) {
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

function terminalInputModeLabel(): string {
  return terminalInputModeDisplayLabel(terminalInputMode.peek());
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
  const statusTone = terminalStatusToneColor(inspection.status, t);
  const mode = copyMode ? "COPY MODE" : terminalShellInputModeLabel();
  const status = formatTerminalShellStatusLine({
    mode,
    status: inspection.status,
    pty: inspection.pty,
    backendLabel: inspection.backendLabel,
    commandLine: inspection.commandLine,
    scrollbackOffset: inspection.scrollback.offset,
    scrollbackViewportRows: inspection.scrollback.viewportRows,
    scrollbackTotalRows: inspection.scrollback.totalRows,
  });
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

  write(
    frame,
    row,
    rect.column,
    paint(
      fit(formatTerminalShellHint({ copyMode, inputMode: terminalShellInputMode.peek() }), rect.width),
      { fg: t.soft, bg: t.panelSoft },
    ),
  );
  row += 1;

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
    terminalShellPaneProjections,
    workspace.layout,
    rect,
    {
      gap: 1,
      fallbackSessionId: workspace.activeId,
      titleForSession: (sessionId) => workspace.sessions.find((entry) => entry.id === sessionId)?.title,
    },
  );
  for (const projection of projections) {
    const shell = projection.sessionId ? terminalShell.shell(projection.sessionId) : activeTerminalShell();
    if (!shell) continue;
    renderTerminalShellPane(frame, projection, shell, copyMode && projection.active);
  }
}

function renderTerminalShellPane(
  frame: Frame,
  projection: WorkbenchTerminalPaneProjection,
  shell: TerminalShellController,
  copyMode: boolean,
): void {
  const rect = projection.rect;
  if (rect.width <= 0 || rect.height <= 0) return;
  const active = projection.active;
  const t = theme();
  fillRect(frame, rect, active ? t.surface : t.background);
  const content = projection.contentRect;
  if (projection.titleVisible) {
    const bg = active ? t.accentDeep : t.panelSoft;
    write(
      frame,
      rect.row,
      rect.column,
      paint(fit(projection.title, rect.width), {
        fg: active ? contrastText(bg, t.background, t.text) : t.soft,
        bg,
        bold: active,
      }),
    );
    if (projection.paneId) {
      addHit({ column: rect.column, row: rect.row, width: rect.width, height: 1 }, {
        type: "terminalShellPane",
        id: projection.paneId,
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
      const style = terminalCellStyle(cell, t, atCursor);
      const char = atCursor && cell.char === " " ? " " : cell.char;
      write(frame, content.row + screenRow, content.column + column, paint(char, style));
    }
  }
}

function renderTerminalShellCopyPane(frame: Frame, rect: Rectangle, shell: TerminalShellController): void {
  const t = theme();
  const inspection = shell.inspect();
  const rows = workbenchTerminalCopyRowsInto(terminalShellCopyRows, {
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
  workbenchTerminalToolbarItemsInto(terminalShellButtonItems, {
    activeId: workspaceInspection.activeId,
    sessionCount: workspaceInspection.sessions.length,
    paneCount: workspaceInspection.workspace.layout.count,
    zoomedPaneId: workspaceInspection.workspace.layout.zoomedPaneId,
    shellRunning: shell?.running,
    shellStarting: shell?.status.peek() === "starting",
    inputMode: terminalShellInputMode.peek(),
    copyMode: shell?.scrollback.mode === "copy",
    scrollbackTotalRows: shellInspection?.scrollback.totalRows,
    scrollbackViewportRows: shellInspection?.scrollback.viewportRows,
    searchQuery: shellInspection?.scrollback.query,
    searchMatchCount: shellInspection?.scrollback.matches.length,
  });
  const nextRow = layoutWorkbenchButtonRowInto(
    terminalShellButtonPlacements,
    terminalShellButtonItems,
    rect,
    startRow,
  );

  workbenchButtonRowRenderCommandsInto(terminalShellButtonCommands, terminalShellButtonPlacements);
  for (const button of terminalShellButtonCommands) {
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

function terminalShellInputModeLabel(): string {
  return terminalInputModeDisplayLabel(terminalShellInputMode.peek(), { rawLabel: "RAW SHELL" });
}

function toggleTerminalShellInputMode(): void {
  if (terminalShellInputMode.peek() === "raw") {
    terminalShellInputMode.value = "workbench";
    pushLog("shell input workbench mode");
    return;
  }
  if (!activeTerminalShell()?.running) {
    pushLog("shell raw input requires a running shell");
    return;
  }
  terminalShellInputMode.value = "raw";
  pushLog("shell input raw mode");
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
  const inspection = shell?.scrollback.inspect();
  const matches = inspection?.matches.length ?? 0;
  const active = inspection?.activeMatch === undefined ? "" : ` hit ${inspection.activeMatch + 1}/${matches}`;
  return [
    `Query  ${terminalShellSearchDraft.peek()}▌`,
    matches > 0 ? `Matches ${matches}${active}` : "Matches none yet",
    "Enter searches, Escape cancels, N/Shift+N move between matches in copy mode.",
  ];
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
  if (event.ctrl || event.meta) return false;
  if (event.key === "escape") {
    closeTerminalShellSearchModal();
    pushLog("shell search cancelled");
    return true;
  }
  if (event.key === "backspace") {
    terminalShellSearchDraft.value = terminalShellSearchDraft.peek().slice(0, -1);
    refreshTerminalShellSearchModal();
    return true;
  }
  if (event.key === "return") {
    runTerminalShellSearch();
    return true;
  }
  if (event.key.length === 1 && textWidth(event.key) === 1) {
    terminalShellSearchDraft.value = `${terminalShellSearchDraft.peek()}${event.key}`.slice(0, 80);
    refreshTerminalShellSearchModal();
    return true;
  }
  return false;
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

function nextWorkbenchShellSessionId(): string {
  return nextWorkbenchTerminalSessionId(terminalShell.inspect().sessions);
}

function sessionTitleFromId(id: string): string {
  return workbenchTerminalSessionTitleFromId(id);
}

function addSplitTerminalShell(direction: "row" | "column") {
  const id = nextWorkbenchShellSessionId();
  const descriptor = terminalShell.add(shellTerminalTemplate({ id, title: sessionTitleFromId(id) }), {
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
  terminalShellSessionTabSources.length = 0;
  for (const session of inspection.sessions) {
    terminalShellSessionTabSources.push({
      id: session.id,
      title: session.title,
      running: session.shell.running,
      status: session.shell.status,
    });
  }
  workbenchTerminalSessionTabsInto(
    terminalShellSessionTabPlacements,
    terminalShellSessionTabSources,
    inspection.activeId,
    { column: rect.column, row: startRow, width: rect.width, height: 1 },
  );
  workbenchTerminalSessionTabRenderCommandsInto(terminalShellSessionTabCommands, terminalShellSessionTabPlacements, {
    column: rect.column,
    row: startRow,
    width: rect.width,
    height: 1,
  });
  for (const command of terminalShellSessionTabCommands) {
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
  const entries = workbenchShelfEntriesInto(minimizedShelfEntries, windowManager.inspect().windows, windowTitle);
  if (entries.length === 0) return;
  const layout = layoutWorkbenchShelfInto(minimizedShelfLayoutBuffers, {
    row,
    column: 1,
    width: Math.max(0, currentWidth() - 1),
    entries,
  });
  const commands = workbenchShelfRenderCommandsInto(minimizedShelfRenderCommands, layout);
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
  const layout = layoutWorkbenchTabsInto(fullscreenTabLayoutBuffers, {
    row,
    column: 1,
    width: Math.max(0, currentWidth() - 1),
    tabs: workbenchTabEntriesInto(fullscreenTabEntries, windowManager.inspect().tabs, windowTitle),
  });
  const commands = workbenchShelfRenderCommandsInto(fullscreenTabRenderCommands, layout);
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
  const line = workbenchStatusLine({
    focus: windowTitle(activeWindow.peek()),
    theme: theme().label,
    tileDensity: tileDensity.peek(),
    diagnostics: formatWorkbenchDiagnosticStatus(workbenchDiagnostics),
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

  const rowCommands = workbenchModalRowRenderCommandsInto(modalRowRenderCommands, {
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
  workbenchModalActionButtonsInto(modalActionButtonItems, inspection);
  layoutWorkbenchButtonRowInto(
    modalActionButtonPlacements,
    modalActionButtonItems,
    { column: inner.column, row: actionRow, width: inner.width, height: 1 },
    actionRow,
  );
  workbenchButtonRowRenderCommandsInto(modalActionButtonCommands, modalActionButtonPlacements);
  for (const command of modalActionButtonCommands) {
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
const threeConfigRowPlacements: WorkbenchAsciiConfigRowPlacement<ThreeConfigRow>[] = [];
const threeConfigRowRenderCommands: WorkbenchAsciiConfigRowRenderCommand<ThreeConfigRow>[] = [];

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
  const placements = workbenchAsciiConfigRowPlacementsInto(threeConfigRowPlacements, threeConfigRows, {
    inner,
    rowsTop: layout.rowsTop,
    visibleRows: layout.visibleRows,
    selectedIndex: threeConfigSelected.peek(),
  });
  const rowCommands = workbenchAsciiConfigRowRenderCommandsInto(threeConfigRowRenderCommands, placements, {
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
    asciiConfigActionButtonCommands,
    asciiConfigActionButtonItems,
    asciiConfigActionButtonPlacements,
    { inner, actionRow: layout.actionRow },
  );
  for (const command of asciiConfigActionButtonCommands) {
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
  if (configuredAscii().peek().kittyGraphics && kittyGraphics.tmux && !kittyGraphics.tmuxPassthroughAllowed) {
    return "[unavailable: tmux allow-passthrough off]";
  }
  const inspection = kittyGraphics.surfaceFor(configuredAscii().peek()).inspect();
  if (inspection.available) return `[${inspection.mode ?? "available"}]`;
  return `[unavailable: ${inspection.reason ?? "not detected"}]`;
}

function drawFrame(frame: Frame, rect: Rectangle, title: string, active: boolean): void {
  const t = theme();
  fillRect(frame, rect, active ? t.panelSoft : t.panel);
  const borderStyle = { fg: active ? t.accent : t.borderStrong, bg: active ? t.panelSoft : t.panel, bold: active };
  const titleStyle = { fg: t.background, bg: active ? t.accent : t.border, bold: true };
  const lines = workbenchFrameBoxLinesInto(windowFrameBoxLines, rect, title);
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]!;
    write(frame, line.row, line.column, paint(line.text, line.kind === "title" ? titleStyle : borderStyle));
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
  terminalOutputContentRows.length = outputLines.length;
  for (let index = 0; index < outputLines.length; index += 1) {
    terminalOutputContentRows[index] = formatTerminalOutputLine(outputLines[index]!, { sourcePrefix: true });
  }
  return workbenchWindowContentSize({
    id,
    viewport,
    docs,
    explorerRows: explorerTextRowsInto(explorerContentTextRows, explorer.entries(), (entry) => entry.text),
    dataColumns: columns,
    dataRowCount: rows.length,
    terminalOutputLines: terminalOutputContentRows,
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
  setWorkbenchThreeSceneSignal(entry.scene, null);
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
  modal.open(workspaceSavedModalContent(name, visualizationIds.length));
  pushLog(`workspace saved ${name}`);
}

async function renameWorkspace(): Promise<void> {
  const originalName = workspaceTargetName.peek();
  const workspace = workspaceByName(originalName);
  if (!workspace) {
    clearWorkspaceModalState();
    modal.open(workspaceMissingModalContent(originalName));
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
  modal.open(workspaceRenamedModalContent(workspace.name, name, renamed.visualizationIds.length));
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
  modal.open(workspaceDeletedModalContent(workspace.name));
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
  return buildWorkspaceMenuEntriesInto(workspaceMenuEntryBuffer, savedWorkspaces.peek());
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
  const dynamicWindows = dynamicVisualizationWindows.peek();
  return currentWorkspaceWindowsFromIds({
    windowIds: windowManager.ids() as WindowId[],
    isVisualizationWindow,
    visualizationIdForWindow: (windowId) => isVisualizationWindow(windowId) ? dynamicWindows[windowId] : undefined,
    asciiForWindow: (windowId) => cloneAsciiOptions(asciiForWindow(windowId).peek()),
  });
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
  return await loadWorkbenchWorkspaceStorage(workspaceStorageOptions());
}

async function persistSavedWorkspaces(): Promise<void> {
  await persistWorkbenchWorkspaceStorage(savedWorkspaces.peek(), workspaceStorageOptions());
}

function workspaceStorageOptions(): WorkbenchWorkspaceStorageOptions<AsciiOptions> {
  return {
    key: WORKSPACE_STORE_KEY,
    store: workspaceStore,
    validVisualizationIds: visualizationWindowOptionIds,
    normalizeName: (name, index) => normalizeWorkbenchWorkspaceName(name, `Workspace ${index + 1}`),
    normalizeAscii: (candidate) =>
      candidate ? normalizeAsciiOptions(candidate as AsciiOptions, createDefaultWorkbenchAsciiOptions()) : undefined,
    diagnostics: workbenchDiagnostics,
    diagnosticSource: "api-workbench",
    storageLabel: "indexedDB" in globalThis ? "IndexedDB" : "Deno JSON",
  };
}

function createWorkspaceStore() {
  return createWorkbenchWorkspaceStore({
    databaseName: "deno-tui-api-workbench",
    storeName: "workspaces",
    fallbackPath: ".api-workbench-workspaces.json",
    version: 1,
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
  const shell = activeTerminalShell();
  if (action === "new") {
    const id = nextWorkbenchShellSessionId();
    const descriptor = terminalShell.add(shellTerminalTemplate({ id, title: sessionTitleFromId(id) }), {
      activate: true,
      start: true,
    });
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
  const key = event.key.toLowerCase();
  if (event.key === "pageup" || event.key === "pagedown") {
    shell.scrollback.enterCopyMode();
    shell.scrollback.page(event.key === "pageup" ? -1 : 1);
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
    : key === "n"
    ? "new"
    : key === "-"
    ? "splitRow"
    : key === "\\"
    ? "splitColumn"
    : key === "z"
    ? "zoomPane"
    : key === ","
    ? "previous"
    : key === "."
    ? "next"
    : key === "i"
    ? "raw"
    : event.key === "/"
    ? "search"
    : key === "n" && event.shift
    ? "previousMatch"
    : key === "n"
    ? "nextMatch"
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
    threeConfigSelected.value = moveWorkbenchAsciiConfigSelection(
      threeConfigSelected.peek(),
      threeConfigRows.length,
      -1,
    );
    return;
  }
  if (event.key === "down" || event.key === "tab") {
    const delta = event.shift ? -1 : 1;
    threeConfigSelected.value = moveWorkbenchAsciiConfigSelection(
      threeConfigSelected.peek(),
      threeConfigRows.length,
      delta,
    );
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
  const shell = activeTerminalShell();
  if (id === TERMINAL_SHELL_WINDOW_ID && shell && !shell.running && shell.status.peek() !== "starting") {
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
  selectedCpuHexTiles.value = selectedCpuHexTilesWith(id, label);
  windowManager.focus(id);
  syncWindowSignalsFromManager();
  ensureCpuHexTileVisible(id, label);
  pushLog(`cpu ${label} selected: ${topCpuProcessLabelForCpu(label, systemMonitor.snapshot.peek().processes)}`);
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
  const button = projectWorkbenchButton(
    label,
    theme(),
    contrastText,
    {
      compact: options.compact,
      maxWidth: options.maxWidth,
      state: options.state,
      tone: options.tone,
    },
  );
  if (button.width <= 0) return 0;
  write(frame, row, column, paint(button.text, button.style));
  return button.width;
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

function titlebarLayout(id: WindowId): WorkbenchTitlebarLayout {
  let layout = titlebarLayouts.get(id);
  if (!layout) {
    layout = createWorkbenchTitlebarLayout();
    titlebarLayouts.set(id, layout);
  }
  return layout;
}

function titlebarRenderCommandBuffer(id: WindowId): WorkbenchTitlebarButtonRenderCommand[] {
  let commands = titlebarRenderCommands.get(id);
  if (!commands) {
    commands = [];
    titlebarRenderCommands.set(id, commands);
  }
  return commands;
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
