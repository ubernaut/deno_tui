/// <reference lib="dom" />
/// <reference lib="dom.iterable" />
import {
  appendBoundedWorkbenchLogRow,
  BoxObject,
  ButtonController,
  CheckBoxController,
  clampWorkbenchTileDensity,
  ComboBoxController,
  Computed,
  type ComputedLayoutBox,
  contrastText,
  createAnsiStyle,
  createFileExplorerTree,
  createRuntimeStore,
  createTerminalWorkspaceController,
  createWebTui,
  DataTableController,
  defaultWorkbenchMinimizedState,
  FileExplorerController,
  fitCellText,
  formatWorkbenchDiagnosticStatus,
  type HitTarget,
  HitTargetStack,
  hydrateWorkbenchPanelWorkspaceStore,
  initialWorkbenchDiagnosticLogRows,
  InputController,
  layoutWorkbenchButtonRowInto,
  layoutWorkbenchShelfInto,
  layoutWorkbenchTabsInto,
  layoutWorkbenchTitlebarInto,
  loadWorkbenchPanelWorkspaceCache,
  maxTextWidth,
  MenuBarController,
  ModalController,
  normalizeTerminalWorkspaceSnapshot,
  normalizeWorkbenchPanelWorkspaceState,
  parseHexColor,
  persistWorkbenchPanelWorkspaceState,
  prepareWorkbenchRows,
  ProgressBarController,
  projectWorkbenchButtonCommand,
  RadioGroupController,
  resolveWorkbenchScreenDropdownKey,
  ScrollAreaController,
  scrollbarGlyph,
  scrollbarOffsetForPointer,
  Signal,
  SliderController,
  snapshotTerminalWorkspace,
  StepperController,
  subscribeWorkbenchDiagnosticLog,
  TerminalScreenController,
  TerminalScrollbackController,
  type TerminalWorkspaceSnapshot,
  TextBoxController,
  TextObject,
  type TextRectangle,
  translateHitTargets,
  updateWorkbenchStringLineSignals,
  workbenchAdaptiveWindowLayout,
  workbenchButtonRowRenderCommandsInto,
  type WorkbenchButtonTone,
  type WorkbenchDropdownOverlayRenderCommand,
  workbenchEmptyWorkspaceMessage,
  type WorkbenchFrameBoxLine,
  type WorkbenchHeaderLayout,
  type WorkbenchMenuBarHitLayout,
  type WorkbenchPanelWorkspaceState,
  type WorkbenchScrollbarRenderCommand,
  workbenchShelfEntriesInto,
  workbenchShelfRenderCommandsInto,
  workbenchTabEntriesInto,
  workbenchTerminalCopyRowsInto,
  type WorkbenchTerminalPaneProjection,
  workbenchTerminalPaneProjectionsInto,
  type WorkbenchTerminalPaneTitleRenderCommand,
  workbenchTerminalPaneTitleRenderCommandsInto,
  workbenchTerminalProtocolHeaderRowsInto,
  workbenchTerminalSessionTabRenderCommandsInto,
  workbenchTerminalSessionTabsInto,
  workbenchTerminalSessionTabSourcesInto,
  type WorkbenchTerminalToolbarAction,
  workbenchTerminalToolbarItemsInto,
  workbenchTerminalToolbarStateFromSnapshot,
  type WorkbenchTitlebarButtonKind,
  workbenchTitlebarButtonRenderCommandsInto,
  type WorkbenchTopMenuVisibleSlice,
  workbenchVisibleWindowRectsInto,
  workbenchWorkspaceScrollbarRenderCommandsInto,
  WorkbenchWorkspaceViewportController,
  writeStringFrameRow,
} from "../../mod.web.ts";
import {
  WorkbenchButtonRowBufferCache,
  WorkbenchModalBufferCache,
  WorkbenchShelfBufferCache,
  WorkbenchTerminalBufferCache,
  WorkbenchTerminalSessionTabBufferCache,
  WorkbenchTitlebarBufferCache,
} from "../../src/app/workbench_buffers.ts";
import {
  apiWorkbenchColumns,
  apiWorkbenchDocs,
  apiWorkbenchLiveRowsInto,
  apiWorkbenchPanelTitle,
  type ApiWorkbenchProcessRow,
  apiWorkbenchRows,
  apiWorkbenchShortPanelTitle,
  type ApiWorkbenchThemeSpec,
  createApiWorkbenchThemes,
  nextApiWorkbenchTerminalSessionDraft,
} from "../../app/api_workbench_catalog.ts";
import {
  apiWorkbenchControlAt,
  apiWorkbenchControlAtEdge,
  type ApiWorkbenchControlId,
  findApiWorkbenchHitTarget,
  isApiWorkbenchTextControlActive,
  isApiWorkbenchTouchOptimizedLayout,
  nextSortableDataColumn,
  resolveApiWorkbenchControlKey,
} from "../../app/api_workbench_controls.ts";
import {
  ApiWorkbenchControlsViewBufferCache,
  renderApiWorkbenchControls,
} from "../../app/api_workbench_controls_view.ts";
import {
  renderApiWorkbenchDataPanel,
  renderApiWorkbenchExplorerPanel,
  renderApiWorkbenchInspectorPanel,
} from "../../app/api_workbench_builtin_panels_view.ts";
import {
  type ApiWorkbenchDropdownOverlay,
  renderApiWorkbenchChromeHeader,
  renderApiWorkbenchDropdownOverlay,
  renderApiWorkbenchStatus,
} from "../../app/api_workbench_chrome_view.ts";
import {
  renderApiWorkbenchModalOverlay,
  renderApiWorkbenchThreeConfigModal,
} from "../../app/api_workbench_modal_view.ts";
import {
  type HtmlCssLayoutRenderCommand,
  htmlCssLayoutRenderCommandsInto,
  htmlCssLayoutSummaryRows,
  htmlCssVisibleLayoutBoxesInto,
} from "../../app/html_css_layout_view.ts";
import {
  workbenchDemoModalContent,
  workbenchHelpModalContent,
  workbenchLogRowsFromSourcesInto,
  workbenchModalConfirmedContent,
  workbenchModalDetailsContent,
  workbenchQuitModalContent,
} from "../../app/workbench_panels.ts";
import {
  type WorkbenchFrameRenderCommand,
  workbenchFrameRenderCommandsInto,
} from "../../src/app/workbench_frame_render.ts";
import { WorkbenchFramePainter } from "../../src/app/workbench_row_render.ts";
import type { RowStyle } from "../../src/app/workbench_rows.ts";
import { workbenchThreePreviewRowsInto } from "../../app/workbench_visualization_window.ts";
import {
  type WorkbenchMobileCommandAction,
  workbenchMobileCommandStripItemsInto,
} from "../../src/app/workbench_control_layout.ts";
import {
  defaultWebTerminalWorkspaceSnapshot,
  normalizeWebTerminalWorkspaceSnapshot as normalizeWebTerminalWorkspaceSnapshotSource,
} from "./api_workbench_terminal_workspace.ts";
import {
  applyWorkbenchAsciiConfigRowAction,
  createDefaultWorkbenchAsciiOptions,
  defaultWorkbenchAsciiConfigRows,
  formatWorkbenchAsciiConfigRowText,
  moveWorkbenchAsciiConfigSelection,
  WorkbenchAsciiConfigController,
  type WorkbenchAsciiConfigRow,
} from "../../src/app/workbench_ascii.ts";
import {
  type WorkbenchAsciiConfigModalAction,
  WorkbenchAsciiConfigModalBufferCache,
} from "../../src/app/workbench_ascii_modal.ts";
import {
  applyWorkbenchWindowSignalState,
  inspectWorkbenchWindowSignalState,
  WorkbenchController,
} from "../../src/app/workbench/controller.ts";
import { createHtmlCssLayoutDemo } from "../../src/markup/demo_fixtures.ts";
import { DiagnosticsCollector } from "../../src/runtime/diagnostics.ts";
import { StorageFallbackDiagnostics } from "../../src/runtime/storage_diagnostics.ts";
import { asciiDemoPresetIds } from "../../src/three_ascii/demo_presets.ts";
import {
  asciiPresetLabel,
  cloneAsciiOptions,
  normalizeAsciiOptions,
  terminalGlyphStyleLabel,
  type ThreeAsciiConfigOptions,
} from "../../src/three_ascii/options.ts";
import type { Rectangle } from "../../src/types.ts";
import { makeStyle } from "../../app/styles.ts";

type PanelId = "explorer" | "inspector" | "data" | "controls" | "logs" | "three" | "htmlLayout" | "terminal";
type ControlId = ApiWorkbenchControlId;
type Hit =
  | { type: "menu"; index: number }
  | { type: "mobileAction"; action: MobileAction }
  | { type: "quit" }
  | { type: "focus"; id: PanelId }
  | { type: "min"; id: PanelId }
  | { type: "max"; id: PanelId }
  | { type: "restore"; id?: PanelId }
  | { type: "close"; id: PanelId }
  | { type: "threeConfig"; id: PanelId }
  | { type: "asciiConfig"; index: number; action?: ConfigHitAction }
  | { type: "asciiConfigAction"; action: WorkbenchAsciiConfigModalAction }
  | { type: "asciiConfigBackdrop" }
  | { type: "theme"; index: number }
  | { type: "modalAction"; index: number }
  | { type: "control"; id: ControlId; action?: ControlHitAction; index?: number }
  | { type: "dataRow"; index: number }
  | { type: "explorerRow"; index: number }
  | { type: "logScrollbar" }
  | { type: "terminalAction"; action: WebTerminalAction }
  | { type: "terminalPane"; id: string }
  | { type: "terminalContent"; sessionId?: string; paneId?: string }
  | { type: "terminalSession"; id: string }
  | { type: "workspaceScrollbar" };
type ControlHitAction = "previous" | "next" | "activate" | "set" | "focus" | "toggle";
type ConfigHitAction = "previous" | "next" | "activate";
type ButtonTone = WorkbenchButtonTone;
type MobileAction = WorkbenchMobileCommandAction;
type WebTerminalAction = WorkbenchTerminalToolbarAction;
type AsciiOptions = ThreeAsciiConfigOptions;
type AsciiConfigRow = WorkbenchAsciiConfigRow;

type ThemeSpec = ApiWorkbenchThemeSpec;

const THEME_STORAGE_KEY = "deno-tui.web-workbench.theme";
const WORKSPACE_STORAGE_KEY = "deno-tui.web-workbench.workspace";

type Row = ApiWorkbenchProcessRow;

const root = document.querySelector<HTMLElement>("#api-workbench");
if (!root) throw new Error("Missing #api-workbench mount element.");
const mount = root;

const host = createWebTui({
  root: mount,
  refreshRate: 1000 / 30,
  sinkOptions: {
    cellWidth: 9,
    cellHeight: 16,
    foreground: "#eff7ff",
    background: "#05070d",
    font: "14px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
  },
});

const themes: ThemeSpec[] = createApiWorkbenchThemes();
const themeLabels = themes.map((entry) => entry.label);
const themeMenuWidth = Math.max(22, maxTextWidth(themeLabels) + 6);
const rows: Row[] = apiWorkbenchRows;
const liveRowsBuffer: Row[] = [];
const columns = apiWorkbenchColumns;
const docs = apiWorkbenchDocs;
const ASCII_DEMO_PRESET_IDS = asciiDemoPresetIds();
const asciiConfigRows: readonly AsciiConfigRow[] = defaultWorkbenchAsciiConfigRows;
const panelIds: readonly PanelId[] = [
  "explorer",
  "inspector",
  "data",
  "controls",
  "logs",
  "three",
  "htmlLayout",
  "terminal",
];
const explorerKeys = new Set(["up", "down", "left", "right", "pageup", "pagedown", "home", "end", "space", "return"]);

const webWorkspaceStore = createRuntimeStore<WebWorkspaceState>({
  databaseName: "deno-tui-web-workbench",
  storeName: "workspace",
  scope: globalThis,
});
const webDiagnostics = new DiagnosticsCollector(80);
const storageDiagnostics = new StorageFallbackDiagnostics(webDiagnostics);
const initialWorkspace = loadCachedWebWorkspaceState();
const themeIndex = new Signal(initialThemeIndex());
const active = new Signal<PanelId>(initialWorkspace.active ?? "inspector");
const maximized = new Signal<PanelId | null>(initialWorkspace.maximized ?? null);
const minimized = new Signal<Record<PanelId, boolean>>(
  { ...defaultMinimizedState(), ...initialWorkspace.minimized },
  { deepObserve: true },
);
const themeMenuOpen = new Signal(false);
const workbenchController = new WorkbenchController<"theme">({
  menu: {
    onChange: (state) => {
      themeMenuOpen.value = state.openId === "theme";
    },
  },
  windows: panelIds.map((id, order) => ({ id, title: apiWorkbenchPanelTitle(id), order, minWidth: 26, minHeight: 10 })),
});
const topMenus = workbenchController.menus;
const webWindows = workbenchController.windows;
let webWindowManagerStateKey = "";
const tileDensity = new Signal(Math.max(-3, Math.min(3, Math.floor(initialWorkspace.tileDensity ?? 0))));
const asciiConfigs = new WorkbenchAsciiConfigController<PanelId>(
  "three",
  normalizeAsciiOptions(initialWorkspace.ascii, createDefaultWorkbenchAsciiOptions()),
);
const ascii = asciiConfigs.root;
const threeConfigOpen = new Signal(false);
const threeConfigSelected = new Signal(0);
const threeConfigWindow = new Signal<PanelId>("three");
const threeConfigBaseline = new Signal<AsciiOptions | null>(null);
const lineSignals: Signal<string>[] = [];
const log = new Signal<string[]>(
  initialWorkbenchDiagnosticLogRows(webDiagnostics, ["ready: web api workbench mounted"], { maxLogEntries: 40 }),
  { deepObserve: true },
);
subscribeWorkbenchDiagnosticLog(webDiagnostics, push);
const webTerminalWorkspace = createTerminalWorkspaceController({
  ...(initialWorkspace.terminal ?? defaultWebTerminalWorkspaceSnapshot()),
});
webTerminalWorkspace.activeId.subscribe(persistWebWorkspaceState);
webTerminalWorkspace.sessions.subscribe(persistWebWorkspaceState);
webTerminalWorkspace.layout.subscribe(persistWebWorkspaceState);
const webTerminalScreens = new Map<string, TerminalScreenController>();
const webTerminalScrollbacks = new Map<string, TerminalScrollbackController>();
const webTerminalScreenKeys = new Map<string, string>();
const webTerminalBuffers = new WorkbenchTerminalBufferCache();
const hitTargets = new HitTargetStack<Hit>();
const titlebarBuffers = new WorkbenchTitlebarBufferCache<PanelId>();
const screenRows: string[] = [];
const workspaceVirtualRows: string[] = [];
const threePreviewRows: string[] = [];
const threePreviewOrbRows: string[] = [];
const dataTableTextRows: string[] = [];
const dataTableBodyRows: RowStyle[] = [];
const dataTableRenderRows: RowStyle[] = [];
const explorerRenderRows: RowStyle[] = [];
const inspectorRenderRows: RowStyle[] = [];
const inspectorActionTextRows: string[] = [];
const inspectorWrappedTextRows: string[] = [];
const logRenderRows: RowStyle[] = [];
const htmlCssLayoutBoxes: ComputedLayoutBox[] = [];
const htmlCssLayoutRenderCommands: HtmlCssLayoutRenderCommand[] = [];
const shelfBuffers = new WorkbenchShelfBufferCache<PanelId>();
const menuBarHitLayouts: WorkbenchMenuBarHitLayout[] = [];
const headerLayout: WorkbenchHeaderLayout = { menu: { column: 0, row: 0, width: 0, height: 1 } };
const windowFrameBoxLines: WorkbenchFrameBoxLine[] = [];
const windowFrameRenderCommands: WorkbenchFrameRenderCommand[] = [];
const framePainter = new WorkbenchFramePainter<string[], ThemeSpec>({
  width: () => cols(),
  theme,
  style: makeStyle,
  contrastText,
  fit,
  write: writeStringFrameRow,
});
const workspaceScrollbarRenderCommands: WorkbenchScrollbarRenderCommand[] = [];
const visiblePanelRects = new Map<PanelId, Rectangle>();
const webTerminalActions: readonly WebTerminalAction[] = [
  "new",
  "previous",
  "next",
  "close",
  "splitRow",
  "splitColumn",
  "zoomPane",
  "closePane",
  "restart",
  "search",
  "previousMatch",
  "nextMatch",
];
const webTerminalButtonBuffers = new WorkbenchButtonRowBufferCache<WebTerminalAction>();
const asciiConfigBuffers = new WorkbenchAsciiConfigModalBufferCache<AsciiConfigRow>();
const mobileCommandButtonBuffers = new WorkbenchButtonRowBufferCache<MobileAction>();
const webTerminalSessionTabBuffers = new WorkbenchTerminalSessionTabBufferCache();
const webTerminalHeaderRows: string[] = [];
const controlViewBuffers = new ApiWorkbenchControlsViewBufferCache();
const modalBuffers = new WorkbenchModalBufferCache<number>();
const dropdownOverlayRenderCommands: WorkbenchDropdownOverlayRenderCommand[] = [];
const themeMenuSlice: WorkbenchTopMenuVisibleSlice = { items: [], indexes: [] };
let dropdownOverlay: ApiWorkbenchDropdownOverlay | null = null;
let pointerDrag: {
  x: number;
  y: number;
  workspaceRows: number;
  logRows: number;
  target?: HitTarget<Hit>;
  moved: boolean;
} | null = null;

themeIndex.subscribe((index) => persistThemeIndex(index));
active.subscribe(persistWebWorkspaceState);
maximized.subscribe(persistWebWorkspaceState);
minimized.subscribe(persistWebWorkspaceState);
tileDensity.subscribe(persistWebWorkspaceState);
ascii.subscribe(persistWebWorkspaceState);
void hydrateWebWorkspaceState();

const menu = new MenuBarController({
  items: ["File", "View", "Layout", "Theme", "Help"].map((label) => ({ id: label.toLowerCase(), label })),
  onSelect: (item) => {
    if (item.id === "theme") {
      topMenus.toggle("theme");
      push(`${themeMenuOpen.peek() ? "open" : "close"} theme menu`);
      return;
    }
    topMenus.close(false);
    if (item.id === "help") {
      openHelpModal();
      return;
    }
    push(`menu ${item.label}`);
  },
});
const workspaceScroll = new ScrollAreaController({ showScrollbar: true });
const workspaceViewport = new WorkbenchWorkspaceViewportController<PanelId>({ scroll: workspaceScroll });
const logScroll = new ScrollAreaController({ showScrollbar: true });
const slider = new SliderController({ min: 1, max: 10, value: 6, step: 1, orientation: "horizontal" });
const live = new CheckBoxController({ checked: true });
const compact = new CheckBoxController({ checked: false });
const actionButton = new ButtonController({ label: "Run Action", onPress: () => push("button pressed") });
const genericButton = new ButtonController({ label: "Generic Button", onPress: () => push("generic button pressed") });
const modalButton = new ButtonController({ label: "Open Modal", onPress: () => openWorkbenchModal() });
const modal = new ModalController({
  title: "Confirm Action",
  tone: "confirm",
  body: [
    "The web workbench uses the same ModalController shape as the terminal app.",
    "Use Tab or arrows to move actions, Enter to activate, Escape to close.",
  ],
  actions: [
    { id: "cancel", label: "Cancel" },
    { id: "details", label: "Details" },
    { id: "confirm", label: "Confirm", default: true },
  ],
  onAction: (action) => applyModalAction(action.id),
});
const radio = new RadioGroupController({
  options: [
    { value: "fast", label: "Fast" },
    { value: "balanced", label: "Balanced" },
    { value: "precise", label: "Precise" },
  ],
  selectedValue: "balanced",
});
const combo = new ComboBoxController({
  items: themeLabels,
  selectedIndex: 0,
  placeholder: "theme",
  onSelect: (_item, index) => setTheme(index),
});
const dropdown = new ComboBoxController({
  items: ["CPU stream", "GPU queue", "Network bus", "Disk cache"],
  selectedIndex: 1,
  placeholder: "source",
  onSelect: (item) => push(`dropdown ${item}`),
});
const input = new InputController({ text: "deno task web:demo:check", cursorPosition: 24, placeholder: "command" });
const stepper = new StepperController({
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
const initialTextBoxText = "Browser notes\nsame controllers, same wrapped multiline text area, same keyboard editing.";
const textBox = new TextBoxController({
  text: initialTextBoxText,
  cursorPosition: { x: initialTextBoxText.split("\n").at(-1)?.length ?? 0, y: 1 },
  wordWrap: true,
});
const activeControl = new Signal<ControlId>("button");
const explorer = new FileExplorerController({
  root: createFileExplorerTree([
    "/README.md",
    "/mod.web.ts",
    "/examples/web/api_workbench_page.ts",
    "/examples/web/neon_exodus_page.ts",
    "/examples/web/three_ascii_page.ts",
    "/src/markup/demo_fixtures.ts",
    "/src/web/host.ts",
    "/src/web/platform.ts",
    "/src/web/remote_terminal.ts",
    "/src/markup/css.ts",
    "/src/markup/html.ts",
    "/src/layout/solvers/simple.ts",
    "/src/layout/solvers/yoga.ts",
    "/src/components/modal.ts",
    "/src/components/file_explorer.ts",
    "/src/layout/responsive.ts",
    "/tests/web_runtime.test.ts",
  ]),
  onOpen: (entry) => push(`open ${entry.path}`),
});
const table = new DataTableController<Row>({
  rows,
  columns,
  rowKey: (row) => row.id,
  initialState: { pageSize: 4, sort: { columnId: "latency", direction: "asc" } },
});

new BoxObject({
  canvas: host.canvas,
  rectangle: new Computed(() => ({ column: 0, row: 0, width: cols(), height: rowsCount() })),
  filler: " ",
  style: new Computed(() => createAnsiStyle({ background: parseHexColor(theme().background) ?? [0, 0, 0] })),
  zIndex: -2,
}).draw();

ensureLines();
host.platform.size.subscribe(() => {
  ensureLines();
  draw();
});

host.on("keyPress", (event) => {
  const { key } = event;
  if (threeConfigOpen.peek()) {
    handleThreeConfigKey(event);
    draw();
    return;
  }
  if (modal.openState.peek()) {
    modal.handleKeyPress(event);
    draw();
    return;
  }
  if (themeMenuOpen.peek()) {
    handleThemeMenuKey(event);
    draw();
    return;
  }
  if (isTextControlActive() && (key === "escape" || key === "tab")) {
    blurTextControl();
    draw();
    return;
  }
  if (isTextControlActive()) {
    handleControlsKey(event);
    draw();
    return;
  }
  if (key === "tab" && active.peek() === "controls") focusNextControl(event.shift ? -1 : 1);
  else if (key === "tab") focusNext();
  else if (focusPanelByNumber(key)) return draw();
  else if (key === "h" || key === "?") openHelpModal();
  else if (key === "q") openQuitModal();
  else if (key === "m") minimize(active.peek());
  else if (key === "f" || key === "return") toggleMax(active.peek());
  else if (key === "r" || key === "escape") restore();
  else if (key === "t") toggleThemeMenu();
  else if (key === "[") adjustTileDensity(-1);
  else if (key === "]") adjustTileDensity(1);
  else if (active.peek() === "controls") handleControlsKey(event);
  else if (active.peek() === "explorer" && explorerKeys.has(key)) {
    explorer.handleKeyPress(event, Math.max(1, rowsCount() - 8));
  } else if (active.peek() === "data" && key.toLowerCase() === "s") {
    cycleDataSortColumn(event.shift ? -1 : 1);
  } else if (active.peek() === "data") table.handleKeyPress(event as never);
  else if (key === "+" || key === "=") slider.increment();
  else if (key === "-") slider.decrement();
  else if (key === "space") live.toggle();
  else if (key === "left" || key === "right") {
    menu.handleKeyPress({ key, ctrl: false, meta: false, shift: false });
  }
  draw();
});

host.on("mousePress", (event) => {
  if (event.release) {
    pointerDrag = null;
    return;
  }
  const target = findHit(event.x, event.y);
  if (handlePointerDrag(event, target)) {
    draw();
    return;
  }
  if (!pointerDrag) {
    pointerDrag = {
      x: event.x,
      y: event.y,
      workspaceRows: workspaceScroll.offset.peek().rows,
      logRows: logScroll.offset.peek().rows,
      target,
      moved: false,
    };
  }
  if (target) applyHit(target, event.x, event.y);
  draw();
});

host.on("mouseScroll", (event) => {
  const target = findHit(event.x, event.y);
  if (target?.action.type === "terminalContent" && handleWebTerminalScroll(target.action, event.scroll)) {
    draw();
    return;
  }
  if (active.peek() === "logs") logScroll.scrollBy(0, event.scroll);
  else workspaceScroll.scrollBy(0, event.scroll);
  draw();
});

host.start();
draw();
const timer = setInterval(() => {
  if (live.checked.peek()) {
    table.rows.value = apiWorkbenchLiveRowsInto(liveRowsBuffer, rows, slider.value.peek(), 18);
    draw();
  }
}, 650);
globalThis.addEventListener("beforeunload", () => {
  clearInterval(timer);
  workspaceScroll.dispose();
  logScroll.dispose();
  actionButton.dispose();
  genericButton.dispose();
  modalButton.dispose();
  modal.dispose();
  radio.dispose();
  combo.dispose();
  dropdown.dispose();
  input.dispose();
  stepper.dispose();
  progress.dispose();
  textBox.dispose();
  compact.dispose();
  explorer.dispose();
  workbenchController.dispose();
  themeMenuOpen.dispose();
  tileDensity.dispose();
  asciiConfigs.dispose();
  threeConfigOpen.dispose();
  threeConfigSelected.dispose();
  threeConfigWindow.dispose();
  threeConfigBaseline.dispose();
  host.destroy();
});

function draw(): void {
  hitTargets.clear();
  dropdownOverlay = null;
  const width = cols();
  const height = rowsCount();
  const frame = prepareWorkbenchRows(
    screenRows,
    height,
    () => "",
    () => paint(" ".repeat(width), theme().text, theme().background),
  );
  const currentTheme = theme();
  dropdownOverlay = renderApiWorkbenchChromeHeader<string[]>({
    frame,
    width,
    menuItems: menu.items.peek(),
    menuActiveIndex: menu.activeIndex.peek(),
    openMenuId: topMenus.inspect().openId,
    dropdownEntries: topMenus.inspect().openId === "theme"
      ? {
        theme: {
          visible: themeMenuSlice,
          labels: themeLabels,
          selectedIndex: themeIndex.peek(),
          preferredWidth: themeMenuWidth,
        },
      }
      : {},
    titleColumn: 1,
    closeMinWidth: 22,
    reserveCloseWhenHidden: true,
    showHelp: false,
    headerLayout,
    menuHitLayouts: menuBarHitLayouts,
    theme: currentTheme,
    paint: (value, style) => paint(value, style.fg, style.bg, style.bold),
    write,
    fillRow: (target, row, bg) => write(target, row, 0, paint(" ".repeat(width), currentTheme.text, bg)),
    writeButton,
    addHit: (rect, action) => hitTargets.add(rect, action),
  });
  renderMobileCommandStrip(frame);
  const body = { column: 1, row: 3, width: Math.max(10, width - 2), height: Math.max(6, height - 5) };
  const layout = workspaceLayout({
    column: 0,
    row: 0,
    width: Math.max(1, body.width - 1),
    height: body.height,
  });
  const offset = workspaceViewport.update({ layout, viewportHeight: body.height, activeId: active.peek() });
  const virtual = prepareWorkbenchRows(
    workspaceVirtualRows,
    Math.max(body.height, layout.contentHeight),
    () => "",
    () => paint(" ".repeat(layout.bounds.width), theme().text, theme().backgroundSoft),
  );
  fillRect(virtual, layout.bounds, theme().backgroundSoft);
  const hitStart = hitTargets.length;
  if (maximized.peek()) {
    renderPanel(virtual, maximized.peek()!, layout.bounds);
  } else {
    if (layout.rects.size === 0) {
      write(
        virtual,
        1,
        2,
        paint(
          workbenchEmptyWorkspaceMessage({
            windows: webWindows.inspect().windows,
            labels: { minimized: "All panels minimized. Press R or click restore." },
          }),
        ),
      );
      hitTargets.add({ ...layout.bounds, row: 0 }, { type: "restore" });
    } else {
      const visibleRects = workbenchVisibleWindowRectsInto(visiblePanelRects, layout.rects, {
        viewport: { column: layout.bounds.column, row: offset, width: layout.bounds.width, height: body.height },
      });
      for (const [id, rect] of visibleRects) {
        renderPanel(virtual, id, rect);
      }
    }
  }
  translateHitTargets(hitTargets, {
    startIndex: hitStart,
    columnDelta: body.column,
    rowDelta: body.row - offset,
    clip: body,
  });
  blitWorkspace(frame, virtual, body, offset, layout.bounds.width);
  renderWorkspaceScrollbar(frame, body);
  maximized.peek() ? renderWindowTabs(frame) : renderShelf(frame);
  renderDropdownOverlay(frame, body, offset);
  renderThreeConfigModal(frame);
  renderModalOverlay(frame);
  renderApiWorkbenchStatus<string[]>({
    frame,
    row: height - 1,
    width,
    focus: active.peek(),
    themeLabel: currentTheme.label,
    tileDensity: tileDensity.peek(),
    diagnostics: formatWorkbenchDiagnosticStatus(webDiagnostics),
    shortcutProfile: "web",
    theme: currentTheme,
    paint: (value, style) => paint(value, style.fg, style.bg, style.bold),
    write,
  });
  updateWorkbenchStringLineSignals(lineSignals, frame, width, height);
}

function renderShelf(frame: string[]): void {
  const row = rowsCount() - 2;
  syncWebWindowManagerState();
  const entries = workbenchShelfEntriesInto(shelfBuffers.entries, webWindows.inspect().windows, panelTitle);
  if (entries.length === 0) return;
  const layout = layoutWorkbenchShelfInto(shelfBuffers.shelfLayout, {
    row,
    column: 2,
    width: Math.max(0, cols() - 2),
    entries,
  });
  const commands = workbenchShelfRenderCommandsInto(shelfBuffers.shelfCommands, layout);
  for (const command of commands) {
    if (command.kind === "prefix") {
      write(frame, command.rect.row, command.rect.column, paint(command.text, theme().muted, theme().backgroundSoft));
    } else {
      writeButton(frame, command.rect.row, command.rect.column, command.label, {
        state: command.state,
        tone: command.tone,
        maxWidth: command.rect.width,
      });
      hitTargets.add(command.hitRect, { type: "restore", id: command.id });
    }
  }
}

function renderMobileCommandStrip(frame: string[]): void {
  if (!isTouchOptimizedLayout() || rowsCount() < 8) return;
  workbenchMobileCommandStripItemsInto(mobileCommandButtonBuffers.items, {
    activeTitle: shortPanelTitle(active.peek()),
    controlsActive: active.peek() === "controls",
    themeActive: themeMenuOpen.peek(),
  });
  layoutWorkbenchButtonRowInto(
    mobileCommandButtonBuffers.placements,
    mobileCommandButtonBuffers.items,
    { column: 1, row: 1, width: Math.max(0, cols() - 2), height: 2 },
    1,
  );
  workbenchButtonRowRenderCommandsInto(mobileCommandButtonBuffers.commands, mobileCommandButtonBuffers.placements);
  for (const command of mobileCommandButtonBuffers.commands) {
    const button = projectWorkbenchButtonCommand(command, theme(), contrastText);
    write(
      frame,
      command.rect.row,
      command.rect.column,
      paint(button.text, button.style.fg, button.style.bg, button.style.bold),
    );
    hitTargets.add(command.hitRect, { type: "mobileAction", action: command.item.action });
  }
}

function renderWindowTabs(frame: string[]): void {
  const row = rowsCount() - 2;
  syncWebWindowManagerState();
  const layout = layoutWorkbenchTabsInto(shelfBuffers.tabLayout, {
    row,
    column: 2,
    width: Math.max(0, cols() - 2),
    tabs: workbenchTabEntriesInto(shelfBuffers.tabs, webWindows.inspect().tabs, panelTitle),
  });
  const commands = workbenchShelfRenderCommandsInto(shelfBuffers.tabCommands, layout);
  for (const command of commands) {
    if (command.kind === "prefix") {
      write(frame, command.rect.row, command.rect.column, paint(command.text, theme().muted, theme().backgroundSoft));
    } else {
      writeButton(frame, command.rect.row, command.rect.column, command.label, {
        state: command.state,
        tone: command.tone,
        maxWidth: command.rect.width,
      });
      hitTargets.add(command.hitRect, { type: "restore", id: command.id });
    }
  }
}

function renderPanel(frame: string[], id: PanelId, rect: Rectangle): void {
  if (rect.width < 10 || rect.height < 4) return;
  hitTargets.add(rect, { type: "focus", id });
  const selected = active.peek() === id;
  drawFrame(frame, rect, panelTitle(id), selected);
  const titlebar = layoutWorkbenchTitlebarInto(titlebarBuffers.layout(id), {
    rect,
    title: panelTitle(id),
    showConfig: id === "three",
  });
  const titlebarCommands = workbenchTitlebarButtonRenderCommandsInto(titlebarBuffers.renderCommands(id), titlebar);
  for (const command of titlebarCommands) {
    writeButton(frame, command.rect.row, command.rect.column, command.label, {
      compact: command.compact,
      tone: command.tone,
    });
    hitTargets.add(command.hitRect, panelTitlebarHit(id, command.kind));
  }
  const inner = {
    column: rect.column + 2,
    row: rect.row + 1,
    width: Math.max(0, rect.width - 4),
    height: Math.max(0, rect.height - 2),
  };
  fillRect(frame, inner, theme().surface);
  if (id === "explorer") renderExplorer(frame, inner);
  else if (id === "inspector") renderInspector(frame, inner);
  else if (id === "controls") renderControls(frame, inner);
  else if (id === "logs") renderLogs(frame, inner);
  else if (id === "data") renderData(frame, inner);
  else if (id === "three") renderThreePreview(frame, inner);
  else if (id === "htmlLayout") renderHtmlCssLayout(frame, inner);
  else if (id === "terminal") renderTerminalProtocol(frame, inner);
}

function panelTitlebarHit(id: PanelId, kind: WorkbenchTitlebarButtonKind): Hit {
  if (kind === "config") return { type: "threeConfig", id };
  if (kind === "minimize") return { type: "min", id };
  if (kind === "maximize") return { type: "max", id };
  if (kind === "close") return { type: "close", id };
  return { type: "restore", id };
}

function panelTitle(id: PanelId): string {
  return apiWorkbenchPanelTitle(id, id[0]!.toUpperCase() + id.slice(1));
}

function shortPanelTitle(id: PanelId): string {
  return apiWorkbenchShortPanelTitle(id, panelTitle(id));
}

function renderLogs(frame: string[], rect: Rectangle): void {
  const logRows = log.peek();
  const lineCount = docs.length + logRows.length;
  logScroll.setViewportSize(rect.width, rect.height);
  logScroll.setContentSize(rect.width, lineCount);
  const offset = logScroll.offset.peek().rows;
  const overflow = logScroll.inspectOverflow();
  const bodyWidth = Math.max(0, rect.width - 1);
  const t = theme();
  const rows = workbenchLogRowsFromSourcesInto(logRenderRows, [docs, logRows], t);
  writeStyledRows(frame, { ...rect, width: bodyWidth }, rows, offset);
  if (!overflow.rows.scrollbarVisible || rect.width < 1) return;
  const column = rect.column + rect.width - 1;
  const thumb = overflow.rows.thumb;
  hitTargets.add({ column, row: rect.row, width: 1, height: rect.height }, { type: "logScrollbar" });
  for (let row = 0; row < rect.height; row += 1) {
    write(frame, rect.row + row, column, paint(scrollbarGlyph(row, thumb), t.accent, t.surface, true));
  }
}

function renderExplorer(frame: string[], rect: Rectangle): void {
  const visible = explorer.tree.visibleRows();
  renderApiWorkbenchExplorerPanel({
    frame,
    rect,
    rows: visible,
    selectedIndex: explorer.tree.selectedIndex.peek(),
    theme: theme(),
    renderRows: explorerRenderRows,
    contrastText,
    writeRows: writeStyledRows,
    addHit: (hitRect, action) => hitTargets.add(hitRect, action),
  });
}

function renderInspector(frame: string[], rect: Rectangle): void {
  const t = theme();
  renderApiWorkbenchInspectorPanel({
    frame,
    rect,
    themeLabel: t.label,
    logs: log.peek(),
    renderRows: inspectorRenderRows,
    theme: t,
    fit,
    actionTextRows: inspectorActionTextRows,
    wrappedTextRows: inspectorWrappedTextRows,
    writeRows: writeStyledRows,
  });
}

function renderData(frame: string[], rect: Rectangle): void {
  const t = theme();
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
    theme: t,
    fit,
    contrastText,
    writeRows: writeStyledRows,
    addHit: (hitRect, action) => hitTargets.add(hitRect, action),
  });
}

function renderThreePreview(frame: string[], rect: Rectangle): void {
  const phase = Math.floor(performance.now() / 90);
  const rows = workbenchThreePreviewRowsInto(threePreviewRows, {
    width: rect.width,
    height: rect.height,
    phase,
    tileDensity: tileDensity.peek(),
    themeLabel: theme().label,
    asciiOptions: ascii.peek(),
    orbRows: threePreviewOrbRows,
  });
  for (let index = 0; index < rows.length && index < rect.height; index += 1) {
    writeThreePreviewLine(frame, rect, index, rows[index]!);
  }
}

function writeThreePreviewLine(frame: string[], rect: Rectangle, index: number, line: string): number {
  if (index >= rect.height) return index;
  const header = index === 0;
  const accent = index % 3 === 0 ? theme().accent : index % 3 === 1 ? theme().good : theme().warn;
  write(
    frame,
    rect.row + index,
    rect.column,
    paint(
      fit(line, rect.width),
      header ? contrastText(theme().accent, theme().background, theme().text) : accent,
      header ? theme().accent : theme().surface,
      header || index > 3,
    ),
  );
  return index + 1;
}

function renderHtmlCssLayout(frame: string[], rect: Rectangle): void {
  const t = theme();
  const result = createHtmlCssLayoutDemo(rect);
  const boxes = htmlCssVisibleLayoutBoxesInto(htmlCssLayoutBoxes, result.layout.boxes);
  const commands = htmlCssLayoutRenderCommandsInto(htmlCssLayoutRenderCommands, {
    bounds: rect,
    boxes,
    theme: t,
    contrast: contrastText,
    summaryRows: htmlCssLayoutSummaryRows("web"),
  });
  for (const command of commands) {
    if (command.kind === "fill") {
      fillRect(frame, command.rect, command.bg);
    } else {
      write(
        frame,
        command.row,
        command.column,
        paint(fit(command.text, command.maxWidth), command.fg, command.bg, command.bold),
      );
    }
  }
}

function renderTerminalProtocol(frame: string[], rect: Rectangle): void {
  const t = theme();
  if (rect.height <= 0 || rect.width <= 0) return;
  const screenHeight = Math.max(3, rect.height - 6);
  const screenRect = {
    column: rect.column,
    row: rect.row + 4,
    width: rect.width,
    height: Math.min(screenHeight, Math.max(0, rect.height - 5)),
  };
  const workspace = webTerminalWorkspace.inspect();
  const activeScreen = syncWebTerminalScreen(workspace.activeId, screenRect.width, screenRect.height);
  const inspection = activeScreen.inspect();
  const headerRows = workbenchTerminalProtocolHeaderRowsInto(webTerminalHeaderRows, {
    activeTitle: workspace.active?.title,
    columns: inspection.columns,
    rows: inspection.rows,
    cursorColumn: inspection.cursor.column,
    cursorRow: inspection.cursor.row,
    sessionCount: workspace.count,
    paneCount: workspace.layout.count,
  });
  const headerRowCount = Math.min(2, rect.height);
  for (let index = 0; index < headerRowCount; index += 1) {
    const line = headerRows[index]!;
    const bg = index === 0 ? t.accentDeep : t.panelSoft;
    const fg = index === 0 ? contrastText(t.accentDeep, t.background, t.text) : index === 1 ? t.warn : t.soft;
    write(frame, rect.row + index, rect.column, paint(fit(line, rect.width), fg, bg, index === 0));
  }
  renderTerminalSessionTabs(frame, { column: rect.column, row: rect.row + 2, width: rect.width, height: 1 });
  renderTerminalToolbar(frame, { column: rect.column, row: rect.row + 3, width: rect.width, height: 1 }, workspace);

  fillRect(frame, screenRect, t.background);
  renderWebTerminalPanes(frame, screenRect, workspace);

  const footerRow = rect.row + rect.height - 1;
  if (footerRow >= screenRect.row) {
    const footer =
      "GitHub Pages uses this safe mock; hosted apps attach a PTY/process backend over the remote protocol.";
    write(frame, footerRow, rect.column, paint(fit(footer, rect.width), t.muted, t.surface));
  }
}

function renderTerminalToolbar(
  frame: string[],
  rect: Rectangle,
  workspace = webTerminalWorkspace.inspect(),
): void {
  if (rect.height <= 0 || rect.width <= 0) return;
  const scrollback = activeWebTerminalScrollback();
  const scrollbackInspection = scrollback?.inspect();
  workbenchTerminalToolbarItemsInto(
    webTerminalButtonBuffers.items,
    workbenchTerminalToolbarStateFromSnapshot({
      activeId: workspace.activeId,
      sessionCount: workspace.sessions.length,
      paneCount: workspace.layout.count,
      zoomedPaneId: workspace.layout.zoomedPaneId,
      scrollback: scrollbackInspection,
    }),
    { actions: webTerminalActions },
  );
  layoutWorkbenchButtonRowInto(webTerminalButtonBuffers.placements, webTerminalButtonBuffers.items, rect, rect.row);
  workbenchButtonRowRenderCommandsInto(webTerminalButtonBuffers.commands, webTerminalButtonBuffers.placements);
  for (const command of webTerminalButtonBuffers.commands) {
    const button = projectWorkbenchButtonCommand(command, theme(), contrastText);
    write(
      frame,
      command.rect.row,
      command.rect.column,
      paint(button.text, button.style.fg, button.style.bg, button.style.bold),
    );
    if (!command.item.disabled) {
      hitTargets.add(command.hitRect, { type: "terminalAction", action: command.item.action });
    }
  }
}

function renderTerminalSessionTabs(frame: string[], rect: Rectangle): void {
  if (rect.height <= 0 || rect.width <= 0) return;
  const workspace = webTerminalWorkspace.inspect();
  const t = theme();
  workbenchTerminalSessionTabSourcesInto(webTerminalSessionTabBuffers.sources, workspace.sessions);
  workbenchTerminalSessionTabsInto(
    webTerminalSessionTabBuffers.placements,
    webTerminalSessionTabBuffers.sources,
    workspace.activeId,
    rect,
  );
  workbenchTerminalSessionTabRenderCommandsInto(
    webTerminalSessionTabBuffers.commands,
    webTerminalSessionTabBuffers.placements,
    rect,
  );
  for (const command of webTerminalSessionTabBuffers.commands) {
    write(
      frame,
      command.rect.row,
      command.rect.column,
      paint(
        command.text,
        command.active ? contrastText(t.accent, t.background, t.text) : t.text,
        command.active ? t.accent : t.panelSoft,
        command.active,
      ),
    );
    if (command.kind === "tab" && command.id) {
      hitTargets.add(command.rect, {
        type: "terminalSession",
        id: command.id,
      });
    }
  }
}

function renderWebTerminalPanes(
  frame: string[],
  rect: Rectangle,
  workspace = webTerminalWorkspace.inspect(),
): void {
  if (rect.width <= 0 || rect.height <= 0) return;
  const projections = workbenchTerminalPaneProjectionsInto(
    webTerminalBuffers.paneProjections,
    workspace.layout,
    rect,
    {
      gap: 1,
      fallbackSessionId: workspace.activeId,
      titleForSession: (sessionId) => workspace.sessions.find((entry) => entry.id === sessionId)?.title,
    },
  );
  const titleCommands = workbenchTerminalPaneTitleRenderCommandsInto(
    webTerminalBuffers.paneTitleCommands,
    projections,
    theme(),
    contrastText,
  );
  let titleIndex = 0;
  for (const projection of projections) {
    const titleCommand = projection.titleVisible ? titleCommands[titleIndex++] : undefined;
    renderWebTerminalPane(frame, projection, titleCommand);
  }
}

function renderWebTerminalPane(
  frame: string[],
  projection: WorkbenchTerminalPaneProjection,
  titleCommand?: WorkbenchTerminalPaneTitleRenderCommand,
): void {
  const rect = projection.rect;
  if (rect.width <= 0 || rect.height <= 0) return;
  const t = theme();
  const activePane = projection.active;
  fillRect(frame, rect, activePane ? t.background : t.surface);
  const content = projection.contentRect;
  if (titleCommand) {
    write(
      frame,
      titleCommand.rect.row,
      titleCommand.rect.column,
      paint(titleCommand.text, titleCommand.style.fg, titleCommand.style.bg, titleCommand.style.bold),
    );
    if (titleCommand.paneId) {
      hitTargets.add(titleCommand.hitRect, {
        type: "terminalPane",
        id: titleCommand.paneId,
      });
    }
  }
  const sessionId = projection.sessionId;
  const screen = syncWebTerminalScreen(sessionId, content.width, content.height);
  const scrollback = syncWebTerminalScrollback(sessionId, screen, content.height);
  hitTargets.add(content, { type: "terminalContent", sessionId, paneId: projection.paneId });
  const inspection = scrollback.inspect();
  if (inspection.mode === "copy") {
    const copyRows = workbenchTerminalCopyRowsInto(webTerminalBuffers.copyRows, {
      visibleRows: inspection.visibleRows,
      offset: inspection.offset,
      height: content.height,
      selection: inspection.selection,
      prefixWidth: 5,
    });
    for (const row of copyRows) {
      write(
        frame,
        content.row + row.screenRow,
        content.column,
        paint(
          fit(row.text, content.width),
          row.selected ? t.background : t.text,
          row.selected ? t.warn : activePane ? t.background : t.surface,
          row.selected,
        ),
      );
    }
  } else {
    const rows = screen.textRows();
    const screenRowCount = Math.min(rows.length, content.height);
    for (let index = 0; index < screenRowCount; index += 1) {
      write(
        frame,
        content.row + index,
        content.column,
        paint(
          fit(rows[index]!, content.width),
          t.text,
          activePane ? t.background : t.surface,
          false,
        ),
      );
    }
  }
  if (inspection.mode === "copy") {
    const status = inspection.query
      ? `search "${inspection.query}" ${inspection.matches.length} hit(s)`
      : `copy rows ${inspection.offset + 1}-${
        Math.min(inspection.offset + inspection.viewportRows, inspection.totalRows)
      }`;
    write(
      frame,
      content.row + Math.max(0, content.height - 1),
      content.column,
      paint(fit(status, content.width), t.warn, t.panelSoft, true),
    );
    return;
  }
  const cursor = screen.cursor;
  if (activePane && cursor.row < content.height && cursor.column < content.width) {
    write(
      frame,
      content.row + cursor.row,
      content.column + cursor.column,
      paint(" ", t.background, t.accent, true),
    );
  }
}

function activeWebTerminalScrollback(): TerminalScrollbackController | undefined {
  const sessionId = webTerminalWorkspace.inspect().activeId;
  if (!sessionId) return undefined;
  const screen = webTerminalScreens.get(sessionId) ?? syncWebTerminalScreen(sessionId, 80, 20);
  return syncWebTerminalScrollback(sessionId, screen, screen.rows);
}

function handleWebTerminalScroll(
  target: Extract<Hit, { type: "terminalContent" }>,
  delta: number,
): boolean {
  if (target.paneId) webTerminalWorkspace.activatePane(target.paneId);
  else if (target.sessionId) webTerminalWorkspace.activate(target.sessionId);
  const sessionId = target.sessionId ?? webTerminalWorkspace.inspect().activeId;
  const screen = webTerminalScreens.get(sessionId ?? "");
  if (!screen) return false;
  const scrollback = syncWebTerminalScrollback(sessionId, screen, screen.rows);
  const inspection = scrollback.inspect();
  if (inspection.totalRows <= inspection.viewportRows) return false;
  scrollback.scrollLines(delta);
  active.value = "terminal";
  if (inspection.mode === "live") push("terminal copy mode on");
  return true;
}

function syncWebTerminalScrollback(
  sessionId: string | undefined,
  screen: TerminalScreenController,
  viewportRows: number,
): TerminalScrollbackController {
  const safeId = sessionId ?? "none";
  let scrollback = webTerminalScrollbacks.get(safeId);
  if (!scrollback) {
    scrollback = new TerminalScrollbackController({ screen, viewportRows });
    webTerminalScrollbacks.set(safeId, scrollback);
  } else {
    scrollback.setViewportRows(viewportRows);
  }
  return scrollback;
}

function syncWebTerminalScreen(sessionId: string | undefined, width: number, height: number): TerminalScreenController {
  const columns = Math.max(20, Math.floor(width));
  const rows = Math.max(3, Math.floor(height));
  const safeId = sessionId ?? "none";
  let screen = webTerminalScreens.get(safeId);
  if (!screen) {
    screen = new TerminalScreenController({ columns, rows, scrollbackLimit: 64 });
    webTerminalScreens.set(safeId, screen);
  }
  const key = `${columns}x${rows}:${theme().id}:${safeId}`;
  if (key === webTerminalScreenKeys.get(safeId)) return screen;
  webTerminalScreenKeys.set(safeId, key);
  screen.resize(columns, rows);
  screen.clear();
  const transcript = safeId === "remote-attach"
    ? [
      "\x1b[1mremote-attach\x1b[0m:\x1b[34m~/deno_tui\x1b[0m$ connect ws://localhost:8787/terminal",
      "\x1b[33mwaiting for explicit endpoint\x1b[0m",
      "RemoteTerminalClient would stream browser input to a server TerminalSessionHandle.",
      "The server side can attach a PTY, process backend, tmux session, or remote bridge.",
      "",
      "No local OS shell is exposed from this static Pages build.",
      "",
      "\x1b[1mremote-attach\x1b[0m$ _",
    ]
    : safeId === "ci-task"
    ? [
      "\x1b[1mci-task\x1b[0m:\x1b[34m~/deno_tui\x1b[0m$ deno task health",
      "Check scripts/health.ts",
      "\x1b[32mok\x1b[0m api inventory  \x1b[32mok\x1b[0m web pages build  \x1b[32mok\x1b[0m e2e",
      "\x1b[33mtemplate only\x1b[0m: start this through a hosted backend to run real commands.",
      "",
      "\x1b[1mci-task\x1b[0m$ _",
    ]
    : [
      "\x1b[1mweb-shell\x1b[0m:\x1b[34m~/deno_tui\x1b[0m$ deno task web:demo:check",
      "\x1b[32mok\x1b[0m mod.web.ts import graph is browser-safe",
      "\x1b[32mok\x1b[0m pointer, wheel, paste, focus, resize adapters active",
      "\x1b[32mok\x1b[0m HTML/CSS layout boxes shared with terminal renderer",
      "",
      "\x1b[1mweb-shell\x1b[0m:\x1b[34m~/deno_tui\x1b[0m$ connect ws://localhost:8787/terminal",
      "\x1b[33mremote endpoint required\x1b[0m: local OS shells stay server-side by design",
      "transport would stream output bytes into TerminalScreenController",
      "keyboard and paste events encode through the same terminal input helpers",
      "",
      "\x1b[1mweb-shell\x1b[0m:\x1b[34m~/deno_tui\x1b[0m$ _",
    ];
  screen.write(transcript.join("\r\n"));
  return screen;
}

function applyWebTerminalAction(action: WebTerminalAction): void {
  const inspection = webTerminalWorkspace.inspect();
  if (action === "new") {
    const draft = nextApiWorkbenchTerminalSessionDraft(webTerminalWorkspace.inspect().sessions, {
      prefix: "pages-shell",
      label: "Pages Shell",
    });
    webTerminalWorkspace.add({
      id: draft.id,
      title: draft.title,
      kind: "command",
      command: "web-shell",
      metadata: { source: "browser-demo" },
    }, {
      activate: true,
      backendId: "browser-mock",
      status: "running",
      running: true,
    });
    push(`terminal new ${draft.title}`);
  } else if (action === "previous") {
    const descriptor = webTerminalWorkspace.activateRelative(-1);
    push(descriptor ? `terminal session ${descriptor.title}` : "terminal previous unavailable");
  } else if (action === "next") {
    const descriptor = webTerminalWorkspace.activateRelative(1);
    push(descriptor ? `terminal session ${descriptor.title}` : "terminal next unavailable");
  } else if (action === "close") {
    if (inspection.activeId && inspection.sessions.length > 1) {
      webTerminalWorkspace.remove(inspection.activeId);
      push("terminal session closed");
    }
  } else if (action === "splitRow" || action === "splitColumn") {
    const draft = nextApiWorkbenchTerminalSessionDraft(webTerminalWorkspace.inspect().sessions, {
      prefix: "pages-shell",
      label: "Pages Shell",
    });
    const descriptor = webTerminalWorkspace.add({
      id: draft.id,
      title: draft.title,
      kind: "command",
      command: "web-shell",
      metadata: { source: "browser-demo" },
    }, {
      activate: false,
      backendId: "browser-mock",
      status: "running",
      running: true,
    });
    webTerminalWorkspace.splitActive(action === "splitRow" ? "row" : "column", descriptor.id, {
      title: descriptor.title,
    });
    webTerminalWorkspace.activate(descriptor.id);
    push(`terminal split ${draft.title}`);
  } else if (action === "zoomPane") {
    const paneId = webTerminalWorkspace.inspect().layout.activePaneId;
    if (paneId) {
      webTerminalWorkspace.toggleZoomPane(paneId);
      push("terminal pane zoom");
    }
  } else if (action === "closePane") {
    const layout = webTerminalWorkspace.inspect().layout;
    if (layout.activePaneId && layout.count > 1) {
      webTerminalWorkspace.closePane(layout.activePaneId);
      push("terminal pane closed");
    }
  } else if (action === "restart") {
    if (inspection.activeId) {
      webTerminalWorkspace.restart(inspection.activeId);
      push(`terminal restart ${webTerminalWorkspace.active?.title ?? inspection.activeId}`);
    }
  } else if (action === "search") {
    const scrollback = activeWebTerminalScrollback();
    if (scrollback) {
      const current = scrollback.inspect().query ?? "terminal";
      const query = prompt("Search terminal scrollback", current) ?? "";
      const matches = scrollback.search(query);
      push(matches.length > 0 ? `terminal search ${matches.length} hits` : "terminal search no matches");
    }
  } else if (action === "previousMatch" || action === "nextMatch") {
    const scrollback = activeWebTerminalScrollback();
    const row = scrollback?.nextMatch(action === "previousMatch" ? -1 : 1);
    push(row === undefined ? "terminal search no matches" : `terminal search row ${row + 1}`);
  }
  webTerminalScreenKeys.clear();
  active.value = "terminal";
}

function ensureLines(): void {
  for (let row = lineSignals.length; row < rowsCount(); row++) {
    const signal = new Signal("");
    lineSignals.push(signal);
    const rowIndex = row;
    new TextObject({
      canvas: host.canvas,
      rectangle: new Computed<TextRectangle>(() => ({ column: 0, row: rowIndex, width: cols() })),
      value: signal,
      overwriteRectangle: true,
      multiCodePointSupport: true,
      style: (text) => text,
      zIndex: 2,
    }).draw();
  }
}

function applyHit(target: HitTarget<Hit>, x: number, y: number): void {
  const hit = target.action;
  if (hit.type === "menu") {
    menu.setActive(hit.index);
    menu.selectActive();
  } else if (hit.type === "mobileAction") {
    applyMobileAction(hit.action);
  } else if (hit.type === "quit") openQuitModal();
  else if (hit.type === "focus") focus(hit.id);
  else if (hit.type === "min") minimize(hit.id);
  else if (hit.type === "max") toggleMax(hit.id);
  else if (hit.type === "close") closePanel(hit.id);
  else if (hit.type === "threeConfig") openThreeConfigModal(hit.id);
  else if (hit.type === "asciiConfig") applyThreeConfigHit(hit.index, hit.action ?? "activate");
  else if (hit.type === "asciiConfigAction") applyThreeConfigModalAction(hit.action);
  else if (hit.type === "asciiConfigBackdrop") {
    restoreThreeConfigBaseline();
    closeThreeConfigModal();
  } else if (hit.type === "restore") hit.id ? restorePanel(hit.id) : restore();
  else if (hit.type === "control") applyControlHit(hit.id, hit.action ?? "activate", target.rect, x, hit.index);
  else if (hit.type === "modalAction" && hit.index >= 0) modal.activateAction(hit.index);
  else if (hit.type === "dataRow") selectDataRow(hit.index);
  else if (hit.type === "explorerRow") selectExplorerRow(hit.index);
  else if (hit.type === "logScrollbar") {
    const lines = docs.length + log.peek().length;
    logScroll.scrollTo(0, scrollbarOffsetForPointer(lines, target.rect.height, y - target.rect.row));
    active.value = "logs";
  } else if (hit.type === "terminalSession") {
    webTerminalWorkspace.activate(hit.id);
    webTerminalScreenKeys.clear();
    active.value = "terminal";
    push(`terminal session ${hit.id}`);
  } else if (hit.type === "terminalPane") {
    if (webTerminalWorkspace.activatePane(hit.id)) {
      webTerminalScreenKeys.clear();
      active.value = "terminal";
      push("terminal pane active");
    }
  } else if (hit.type === "terminalContent") {
    if (hit.paneId) webTerminalWorkspace.activatePane(hit.paneId);
    else if (hit.sessionId) webTerminalWorkspace.activate(hit.sessionId);
    const screen = webTerminalScreens.get(hit.sessionId ?? "");
    if (screen) {
      const scrollback = syncWebTerminalScrollback(hit.sessionId, screen, target.rect.height);
      scrollback.selectVisibleRow(y - target.rect.row);
      push("terminal row selected");
    }
    active.value = "terminal";
  } else if (hit.type === "terminalAction") {
    applyWebTerminalAction(hit.action);
  } else if (hit.type === "workspaceScrollbar") {
    workspaceScroll.scrollTo(
      0,
      scrollbarOffsetForPointer(workspaceScroll.contentHeight.peek(), target.rect.height, y - target.rect.row),
    );
  } else setTheme(hit.index);
}

function applyMobileAction(action: MobileAction): void {
  if (action === "next") {
    closeThemeMenu();
    focusNext();
  } else if (action === "controls") {
    closeThemeMenu();
    focus("controls");
  } else if (action === "theme") {
    toggleThemeMenu();
  } else if (action === "help") {
    openHelpModal();
  } else if (action === "restore") {
    restore();
  } else if (action === "wide") {
    adjustTileDensity(-1);
  } else if (action === "dense") {
    adjustTileDensity(1);
  }
}

function handlePointerDrag(
  event: { x: number; y: number; drag?: boolean; movementX?: number; movementY?: number },
  target: HitTarget<Hit> | undefined,
): boolean {
  if (!event.drag || !pointerDrag) return false;
  const deltaColumns = pointerDrag.x - event.x;
  const deltaRows = pointerDrag.y - event.y;
  const moved = Math.abs(deltaRows) >= 1 || Math.abs(deltaColumns) >= 2 ||
    Math.abs(event.movementY ?? 0) >= 8 || Math.abs(event.movementX ?? 0) >= 12;
  if (!moved) return false;

  if (target?.action.type === "control" && target.action.id === "slider") {
    applyHit(target, event.x, event.y);
    pointerDrag.moved = true;
    return true;
  }

  const origin = pointerDrag.target?.action;
  const logOrigin = origin?.type === "logScrollbar" || origin?.type === "focus" && origin.id === "logs" ||
    active.peek() === "logs" && origin?.type !== "workspaceScrollbar";
  if (logOrigin) {
    logScroll.scrollTo(0, pointerDrag.logRows + deltaRows);
    active.value = "logs";
  } else {
    workspaceScroll.scrollTo(0, pointerDrag.workspaceRows + deltaRows);
  }
  pointerDrag.moved = true;
  return true;
}

function focus(id: PanelId): void {
  syncWebWindowManagerState();
  workbenchController.focusWindow(id);
  syncWebSignalsFromWindowManager();
  push(`focus ${id}`);
}
function focusNext(): void {
  syncWebWindowManagerState();
  const focused = workbenchController.focusNextWindow();
  syncWebSignalsFromWindowManager();
  if (focused) push(`focus ${focused}`);
}
function focusPrevious(): void {
  syncWebWindowManagerState();
  const focused = workbenchController.focusNextWindow(-1);
  syncWebSignalsFromWindowManager();
  if (focused) push(`focus ${focused}`);
}
function minimize(id: PanelId): void {
  syncWebWindowManagerState();
  workbenchController.minimizeWindow(id);
  syncWebSignalsFromWindowManager();
  push(`minimize ${id}`);
}
function closePanel(id: PanelId): void {
  syncWebWindowManagerState();
  workbenchController.closeWindow(id);
  syncWebSignalsFromWindowManager();
  push(`close ${id}`);
}
function toggleMax(id: PanelId): void {
  syncWebWindowManagerState();
  workbenchController.toggleFullscreenWindow(id);
  syncWebSignalsFromWindowManager();
  push(`${maximized.peek() ? "maximize" : "restore"} ${id}`);
}
function restorePanel(id: PanelId): void {
  syncWebWindowManagerState();
  workbenchController.restoreWindows(id);
  syncWebSignalsFromWindowManager();
  push(`restore ${id}`);
}
function restore(): void {
  syncWebWindowManagerState();
  workbenchController.restoreWindows();
  syncWebSignalsFromWindowManager();
  push("restore all");
}
function setTheme(index: number): void {
  themeIndex.value = ((index % themes.length) + themes.length) % themes.length;
  closeThemeMenu();
  push(`theme ${theme().label}`);
}

function handleThemeMenuKey(event: { key: string; shift?: boolean }): void {
  const action = resolveWorkbenchScreenDropdownKey({
    event,
    openId: topMenus.inspect().openId,
    indexes: { theme: themeIndex.peek() },
    counts: { theme: themes.length },
  });
  switch (action.kind) {
    case "ignore":
      return;
    case "quit":
      openQuitModal();
      return;
    case "help":
      closeThemeMenu();
      openHelpModal();
      return;
    case "close":
      closeThemeMenu();
      return;
    case "focusWindow":
      closeThemeMenu();
      action.delta < 0 ? focusPrevious() : focusNext();
      return;
    case "moveTopMenu":
      return;
    case "menuItem":
      if (action.menuId !== "theme") return;
      themeIndex.value = action.index;
      if (action.activate) setTheme(action.index);
      return;
  }
}

function toggleThemeMenu(): void {
  topMenus.toggle("theme");
  push(`${themeMenuOpen.peek() ? "open" : "close"} theme menu`);
}

function closeThemeMenu(): void {
  topMenus.close(false);
}

function focusPanelByNumber(key: string): boolean {
  const index = Number.parseInt(key, 10);
  if (!Number.isInteger(index) || index < 1) return false;
  const id = panelIds[index - 1];
  if (!id) return false;
  focus(id);
  return true;
}

function cycleDataSortColumn(delta: number): void {
  const current = table.state.peek().sort?.columnId;
  const next = nextSortableDataColumn(table.columns.peek(), current, delta);
  if (!next) return;
  table.toggleSort(next.id);
  push(`sort data by ${next.label}`);
}

function selectExplorerRow(index: number): void {
  active.value = "explorer";
  explorer.tree.setSelectedIndex(index);
  const entry = explorer.selected();
  if (entry?.kind === "file") explorer.openActive();
  else if (entry?.kind === "directory") explorer.tree.toggleActive();
  push(`explorer ${entry?.path ?? index}`);
}
function adjustTileDensity(delta: number): void {
  tileDensity.value = clampWorkbenchTileDensity(tileDensity.peek() + delta);
  push(`tile density ${tileDensity.peek()}`);
}

function workspaceLayout(bounds: Rectangle): {
  bounds: Rectangle;
  contentHeight: number;
  rects: Map<PanelId, Rectangle>;
} {
  syncWebWindowManagerState();
  return workbenchAdaptiveWindowLayout<PanelId>(webWindows, { bounds, tileDensity: tileDensity.peek() });
}

function syncWebWindowManagerState(): void {
  const fullscreenId = maximized.peek() ?? undefined;
  const minimizedState = minimized.peek();
  let minimizedKey = "";
  for (let index = 0; index < panelIds.length; index += 1) {
    minimizedKey += minimizedState[panelIds[index]!] ? "1" : "0";
  }
  const key = `${active.peek()}|${fullscreenId ?? ""}|${minimizedKey}`;
  if (key === webWindowManagerStateKey) return;
  webWindowManagerStateKey = key;
  applyWorkbenchWindowSignalState<PanelId>(
    webWindows,
    { activeId: active.peek(), fullscreenId, minimized: minimizedState },
    {
      windowIds: panelIds,
      createWindow: (id, order) => ({
        id,
        title: apiWorkbenchPanelTitle(id),
        order,
        minWidth: 26,
        minHeight: 10,
      }),
    },
  );
}

function syncWebSignalsFromWindowManager(): void {
  const state = inspectWorkbenchWindowSignalState<PanelId>(webWindows, {
    windowIds: panelIds,
    defaultActiveId: "inspector",
  });
  if (state.activeId) active.value = state.activeId;
  maximized.value = state.fullscreenId ?? null;
  minimized.value = state.minimized;
  webWindowManagerStateKey = "";
}

function blitWorkspace(frame: string[], virtual: string[], bounds: Rectangle, offset: number, width: number): void {
  for (let row = 0; row < bounds.height; row += 1) {
    write(frame, bounds.row + row, bounds.column, fit(virtual[offset + row] ?? "", width));
  }
}

function renderWorkspaceScrollbar(frame: string[], bounds: Rectangle): void {
  const overflow = workspaceScroll.inspectOverflow();
  const commands = workbenchWorkspaceScrollbarRenderCommandsInto(workspaceScrollbarRenderCommands, {
    bounds,
    visible: overflow.rows.scrollbarVisible,
    thumb: overflow.rows.thumb,
  });
  for (const command of commands) {
    hitTargets.add(command.rect, { type: "workspaceScrollbar" });
    for (const cell of command.cells) {
      write(frame, cell.row, cell.column, paint(cell.glyph, theme().accent, theme().backgroundSoft, true));
    }
  }
}

function renderDropdownOverlay(frame: string[], workspaceBounds: Rectangle, workspaceOffsetRows: number): void {
  renderApiWorkbenchDropdownOverlay<string[]>({
    frame,
    overlay: dropdownOverlay,
    workspaceBounds,
    screenBounds: { column: 0, row: 0, width: cols(), height: rowsCount() },
    workspaceOffsetRows,
    commands: dropdownOverlayRenderCommands,
    theme: theme(),
    paint: (value, style) => paint(value, style.fg, style.bg, style.bold),
    write,
    fillRect,
    addHit: (rect, action) => {
      if (action.type === "theme" || action.type === "control") hitTargets.add(rect, action);
    },
  });
}

function renderThreeConfigModal(frame: string[]): void {
  if (!threeConfigOpen.peek()) return;
  const currentTheme = theme();
  const options = currentThreeConfigSignal().peek();
  const header = ` ${asciiPresetLabel(options.preset)} · ${
    terminalGlyphStyleLabel(options.terminalGlyphStyle)
  } · web preview `;
  renderApiWorkbenchThreeConfigModal({
    frame,
    bounds: { column: 0, row: 0, width: cols(), height: rowsCount() },
    rows: asciiConfigRows,
    selectedIndex: threeConfigSelected.peek(),
    title: header,
    frameTitle: "Three ASCII Config",
    titleStyle: { fg: currentTheme.background, bg: currentTheme.accent, bold: true },
    helpText: "Use arrows/clicks to adjust. A apply, Enter OK, Esc cancel.",
    footerText: "This editor persists to the web workspace snapshot.",
    footerStyle: { fg: currentTheme.soft, bg: currentTheme.panelSoft },
    rowSplitMinWidth: 1,
    activateRowHits: true,
    buffers: asciiConfigBuffers,
    theme: currentTheme,
    contrastText,
    fit,
    paint: (value, style) => paint(value, style.fg, style.bg, style.bold),
    write,
    fillRect,
    drawFrame,
    rowText: (row, layout) =>
      formatWorkbenchAsciiConfigRowText(row, options, {
        kittyStatus: "browser preview",
        trackWidth: Math.max(8, Math.min(18, layout.inner.width - 42)),
      }),
    rowStyle: (selected, nextTheme) =>
      selected
        ? { fg: contrastText(nextTheme.warn, nextTheme.background, nextTheme.text), bg: nextTheme.warn, bold: true }
        : { fg: nextTheme.text, bg: nextTheme.panelSoft },
    addHit: (rect, action) => hitTargets.add(rect, action),
  });
}

function renderModalOverlay(frame: string[]): void {
  if (!modal.openState.peek()) return;
  renderApiWorkbenchModalOverlay({
    frame,
    bounds: { column: 0, row: 0, width: cols(), height: rowsCount() },
    inspection: modal.inspect(),
    buffers: modalBuffers,
    theme: theme(),
    contrastText,
    fit,
    paint: (value, style) => paint(value, style.fg, style.bg, style.bold),
    write,
    fillRect,
    drawFrame,
    maxWidth: 74,
    addHit: (rect, action) => hitTargets.add(rect, action),
  });
}

function push(message: string): void {
  log.value = appendBoundedWorkbenchLogRow(log.peek(), `${new Date().toLocaleTimeString()} ${message}`, 40);
}

function openWorkbenchModal(): void {
  closeThemeMenu();
  closeThreeConfigModal();
  modal.open(workbenchDemoModalContent({ profile: "web" }));
  push("modal opened");
}

function openHelpModal(): void {
  closeThemeMenu();
  closeThreeConfigModal();
  modal.open(workbenchHelpModalContent({ profile: "web" }));
  push("help opened");
}

function openQuitModal(): void {
  closeThemeMenu();
  closeThreeConfigModal();
  modal.open(workbenchQuitModalContent({ profile: "web" }));
  push("quit confirmation");
}

function openThreeConfigModal(id: PanelId): void {
  closeThemeMenu();
  modal.close();
  active.value = id;
  threeConfigWindow.value = "three";
  threeConfigBaseline.value = cloneAsciiOptions(currentThreeConfigSignal().peek());
  threeConfigSelected.value = 0;
  threeConfigOpen.value = true;
  push("three config opened");
}

function closeThreeConfigModal(): void {
  threeConfigOpen.value = false;
  threeConfigBaseline.value = null;
}

function currentThreeConfigSignal(): Signal<AsciiOptions> {
  return asciiConfigs.configuredSignal(threeConfigWindow.peek(), (id) => id === "three");
}

function setCurrentThreeConfig(options: AsciiOptions, message: string, persist = false): void {
  asciiConfigs.setForWindow(threeConfigWindow.peek(), options);
  if (persist) persistWebWorkspaceState();
  push(message);
}

function restoreThreeConfigBaseline(): void {
  const baseline = threeConfigBaseline.peek();
  if (!baseline) return;
  asciiConfigs.setForWindow(threeConfigWindow.peek(), baseline);
  persistWebWorkspaceState();
  push("three config canceled");
}

function applyThreeConfigModalAction(action: WorkbenchAsciiConfigModalAction): void {
  if (action === "cancel") {
    restoreThreeConfigBaseline();
    closeThreeConfigModal();
    return;
  }
  persistWebWorkspaceState();
  push("three config applied");
  if (action === "ok") closeThreeConfigModal();
}

function handleThreeConfigKey(event: { key: string; shift?: boolean }): void {
  const key = event.key.toLowerCase();
  if (key === "escape") {
    restoreThreeConfigBaseline();
    closeThreeConfigModal();
    return;
  }
  if (key === "a") {
    applyThreeConfigModalAction("apply");
    return;
  }
  if (key === "o" || key === "return") {
    applyThreeConfigModalAction("ok");
    return;
  }
  if (key === "up") {
    moveThreeConfigSelection(-1);
    return;
  }
  if (key === "down" || key === "tab") {
    moveThreeConfigSelection(event.shift ? -1 : 1);
    return;
  }
  if (key === "pageup") {
    moveThreeConfigSelection(-5);
    return;
  }
  if (key === "pagedown") {
    moveThreeConfigSelection(5);
    return;
  }
  if (key === "left") {
    applyThreeConfigHit(threeConfigSelected.peek(), "previous");
    return;
  }
  if (key === "right") {
    applyThreeConfigHit(threeConfigSelected.peek(), "next");
    return;
  }
  if (key === "space") applyThreeConfigHit(threeConfigSelected.peek(), "activate");
}

function moveThreeConfigSelection(delta: number): void {
  threeConfigSelected.value = moveWorkbenchAsciiConfigSelection(
    threeConfigSelected.peek(),
    asciiConfigRows.length,
    delta,
  );
}

function applyThreeConfigHit(index: number, action: ConfigHitAction): void {
  const row = asciiConfigRows[index];
  if (!row) return;
  threeConfigSelected.value = index;
  const next = applyWorkbenchAsciiConfigRowAction(
    currentThreeConfigSignal().peek(),
    row,
    action,
    ASCII_DEMO_PRESET_IDS,
  );
  setCurrentThreeConfig(next.options, `three ${next.message}`);
}

function applyModalAction(actionId: string): void {
  if (actionId === "details") {
    modal.open(workbenchModalDetailsContent({ profile: "web" }));
    push("modal details");
    return;
  }
  if (actionId === "back") {
    openWorkbenchModal();
    return;
  }
  if (actionId === "confirm") {
    modal.open(workbenchModalConfirmedContent({ profile: "web" }));
    push("modal confirmed");
    return;
  }
  if (actionId === "controls") {
    modal.close();
    focus("controls");
    return;
  }
  if (actionId === "three-focus") {
    modal.close();
    focus("three");
    return;
  }
  if (actionId === "quit") {
    mount.style.display = "none";
    modal.close();
    push("web workbench hidden");
    return;
  }
  modal.close();
  push(`modal ${actionId}`);
}

function renderControls(frame: string[], rect: Rectangle): void {
  const t = theme();
  const currentControl = activeControl.peek();
  const sliderState = slider.inspect();
  const result = renderApiWorkbenchControls({
    frame,
    rect,
    state: {
      activeControl: currentControl,
      buttonPressCount: actionButton.pressCount.peek(),
      genericButtonPressCount: genericButton.pressCount.peek(),
      modalOpen: modal.openState.peek(),
      slider: {
        ratio: sliderState.normalizedValue,
        value: slider.value.peek(),
        max: 10,
      },
      checkboxLivePreview: live.checked.peek(),
      checkboxCompactRows: compact.checked.peek(),
      radioOptions: radio.options.peek(),
      radioSelectedValue: radio.selectedValue.peek(),
      radioActiveIndex: radio.activeIndex.peek(),
      combo: {
        title: "Theme combo",
        label: combo.label(),
        expanded: combo.expanded.peek(),
        items: combo.items.peek(),
        selectedIndex: combo.selectedIndex.peek(),
        expandedGlyph: "v",
        collapsedGlyph: ">",
        previous: true,
        next: true,
      },
      dropdown: {
        title: "Dropdown",
        label: dropdown.label(),
        expanded: dropdown.expanded.peek(),
        items: dropdown.items.peek(),
        selectedIndex: dropdown.selectedIndex.peek(),
        expandedGlyph: "v",
        collapsedGlyph: ">",
      },
      input: {
        title: "Input",
        text: input.text.peek(),
        active: currentControl === "input",
        cursorGlyph: "|",
      },
      stepper: {
        steps: stepper.steps.peek(),
        activeIndex: stepper.activeIndex.peek(),
      },
      progress: {
        ratio: progress.ratio(),
        value: progress.value.peek(),
      },
      textbox: {
        lines: textBox.lines.peek(),
        cursor: textBox.cursorPosition.peek(),
        renderOptions: { cursorGlyph: "|", continuationGlyph: ">" },
      },
    },
    buffers: controlViewBuffers,
    theme: t,
    contrastText,
    fit,
    paint: (value, style) => paint(value, style.fg, style.bg, style.bold),
    write,
    addHit: (hitRect, action) => hitTargets.add(hitRect, action),
  });
  if (result.dropdownOverlay) dropdownOverlay = result.dropdownOverlay;
}

function applyControlHit(
  id: ControlId,
  action: ControlHitAction,
  rect?: Rectangle,
  x?: number,
  index?: number,
): void {
  active.value = "controls";
  activeControl.value = id;
  if (action === "focus") {
    push(`control ${id} focus`);
    return;
  }
  if (id === "button") actionButton.press("mouse");
  else if (id === "genericButton") genericButton.press("mouse");
  else if (id === "modal") modalButton.press("mouse");
  else if (id === "slider") {
    if (action === "set" && rect && x !== undefined) slider.handlePointer(rect, x, rect.row);
    else action === "previous" ? slider.decrement() : slider.increment();
  } else if (id === "checkbox") index === 1 || action === "next" ? compact.toggle() : live.toggle();
  else if (id === "radio") {
    if (index !== undefined) {
      radio.setActive(index);
      radio.selectActive();
    } else if (action === "previous") radio.move(-1);
    else if (action === "next") radio.move(1);
    else radio.selectActive();
  } else if (id === "combo") {
    if (index !== undefined) {
      combo.selectIndex(index);
      setTheme(index);
    } else if (action === "previous") combo.move(-1);
    else if (action === "next") combo.move(1);
    else combo.selectActive();
  } else if (id === "dropdown") {
    if (index !== undefined) dropdown.selectIndex(index);
    else if (action === "toggle") dropdown.toggle();
    else if (action === "previous") dropdown.move(-1);
    else if (action === "next") dropdown.move(1);
    else if (dropdown.expanded.peek()) dropdown.selectActive();
    else dropdown.open();
  } else if (id === "input") input.submit();
  else if (id === "stepper") {
    if (index !== undefined) stepper.setActive(index);
    else action === "previous" ? stepper.move(-1) : stepper.move(1);
  } else if (id === "textbox") textBox.setText(`${textBox.text.peek()}\nclicked`);
  progress.setValue(Math.min(100, progress.value.peek() + 7));
  push(`control ${id} ${action}`);
}

function selectDataRow(index: number): void {
  active.value = "data";
  table.select(index);
  push(`data row ${table.selectedKey() ?? index}`);
}

function handleControlsKey(event: { key: string; ctrl?: boolean; meta?: boolean; shift?: boolean }): void {
  const id = activeControl.peek();
  const resolved = resolveApiWorkbenchControlKey(id, event, { dropdownExpanded: dropdown.expanded.peek() });
  switch (resolved.type) {
    case "textInput":
      id === "input" ? input.handleKeyPress(event as never) : textBox.handleKeyPress(event as never);
      return;
    case "dropdown":
      if (resolved.action === "move") dropdown.move(resolved.delta);
      else if (resolved.action === "first") dropdown.first();
      else if (resolved.action === "last") dropdown.last();
      else if (resolved.action === "close") dropdown.close();
      else dropdown.selectActive();
      return;
    case "radio":
      radio.move(resolved.delta);
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
  active.value = "controls";
  activeControl.value = controlAt(1);
  push(`control ${previous} blur`);
}

function focusNextControl(delta = 1): void {
  active.value = "controls";
  const next = controlAtEdge(delta);
  if (next) {
    activeControl.value = next;
    push(`control ${activeControl.peek()} focus`);
    return;
  }
  delta < 0 ? focusPrevious() : focusNext();
}

function controlAt(delta: number): ControlId {
  return apiWorkbenchControlAt(activeControl.peek(), delta);
}

function controlAtEdge(delta: number): ControlId | undefined {
  return apiWorkbenchControlAtEdge(activeControl.peek(), delta);
}
function isTextControlActive(): boolean {
  return isApiWorkbenchTextControlActive(active.peek(), "controls", activeControl.peek());
}
function write(frame: string[], row: number, column: number, value: string): void {
  framePainter.write(frame, row, column, value);
}

function writeStyledRows(frame: string[], rect: Rectangle, rows: readonly RowStyle[], sourceStart = 0): void {
  framePainter.writeRows(frame, rect, rows, sourceStart);
}

function fit(value: string, width: number): string {
  return fitCellText(value, width);
}
function fillRect(frame: string[], rect: Rectangle, bg: string): void {
  framePainter.fillRect(frame, rect, bg);
}

function drawFrame(frame: string[], rect: Rectangle, title: string, selected: boolean): void {
  const commands = workbenchFrameRenderCommandsInto(windowFrameRenderCommands, windowFrameBoxLines, {
    rect,
    title,
    active: selected,
    theme: theme(),
  });
  for (const command of commands) {
    if (command.kind === "fill") {
      fillRect(frame, command.rect, command.bg);
    } else {
      write(
        frame,
        command.row,
        command.column,
        paint(command.text, command.style.fg, command.style.bg, command.style.bold),
      );
    }
  }
}

function writeButton(
  frame: string[],
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

function paint(value: string, fg = theme().text, bg = theme().background, bold = false): string {
  return framePainter.paint(value, { fg, bg, bold });
}
function findHit(x: number, y: number): HitTarget<Hit> | undefined {
  return findApiWorkbenchHitTarget({
    targets: hitTargets,
    x,
    y,
    bounds: { column: 0, row: 0, width: cols(), height: rowsCount() },
    touchOptimized: isTouchOptimizedLayout(),
  });
}

function isTouchOptimizedLayout(): boolean {
  const coarsePointer = globalThis.matchMedia?.("(pointer: coarse)")?.matches ?? false;
  return isApiWorkbenchTouchOptimizedLayout({
    coarsePointer,
    columns: cols(),
    rows: rowsCount(),
  });
}
function initialThemeIndex(): number {
  try {
    const saved = globalThis.localStorage?.getItem(THEME_STORAGE_KEY);
    const index = themes.findIndex((entry) => entry.id === saved || entry.label === saved);
    return index >= 0 ? index : 0;
  } catch (error) {
    reportWebStorageDiagnostic("theme-read", "localStorage", error);
    return 0;
  }
}

type WebWorkspaceState = WorkbenchPanelWorkspaceState<PanelId> & {
  terminal?: TerminalWorkspaceSnapshot;
  ascii?: ThreeAsciiConfigOptions;
};

function defaultMinimizedState(): Record<PanelId, boolean> {
  return defaultWorkbenchMinimizedState(panelIds);
}

function loadCachedWebWorkspaceState(): WebWorkspaceState {
  return loadWorkbenchPanelWorkspaceCache({
    key: WORKSPACE_STORAGE_KEY,
    normalize: normalizeWebWorkspaceState,
    fallback: {},
    diagnostics: storageDiagnostics,
    diagnosticSource: "web-workbench",
  });
}

async function hydrateWebWorkspaceState(): Promise<void> {
  await hydrateWorkbenchPanelWorkspaceStore({
    key: "default",
    store: webWorkspaceStore,
    normalize: normalizeWebWorkspaceState,
    apply: applyWebWorkspaceState,
    diagnostics: storageDiagnostics,
    diagnosticSource: "web-workbench",
  });
}

function applyWebWorkspaceState(state: WebWorkspaceState): void {
  if (state.active) active.value = state.active;
  if (state.maximized !== undefined) maximized.value = state.maximized;
  if (state.minimized) minimized.value = { ...defaultMinimizedState(), ...state.minimized };
  if (state.tileDensity !== undefined) tileDensity.value = Math.max(-3, Math.min(3, Math.floor(state.tileDensity)));
  if (state.ascii) asciiConfigs.setForWindow("three", state.ascii);
  if (state.terminal) applyWebTerminalWorkspaceSnapshot(state.terminal);
}

function normalizeWebWorkspaceState(value: unknown): WebWorkspaceState {
  const candidate = value && typeof value === "object" ? value as WebWorkspaceState : undefined;
  const state = normalizeWorkbenchPanelWorkspaceState(candidate, {
    panelIds,
    defaultActive: "inspector",
    minTileDensity: -3,
    maxTileDensity: 3,
  });
  const terminal = normalizeWebTerminalWorkspaceSnapshot(candidate?.terminal);
  const asciiOptions = candidate?.ascii
    ? normalizeAsciiOptions(candidate.ascii, createDefaultWorkbenchAsciiOptions())
    : undefined;
  return { ...state, ...(terminal ? { terminal } : {}), ...(asciiOptions ? { ascii: asciiOptions } : {}) };
}

function persistWebWorkspaceState(): void {
  persistWorkbenchPanelWorkspaceState({
    active: active.peek(),
    maximized: maximized.peek(),
    minimized: minimized.peek(),
    tileDensity: tileDensity.peek(),
    ascii: cloneAsciiOptions(ascii.peek()),
    terminal: snapshotTerminalWorkspace(webTerminalWorkspace),
  }, {
    cacheKey: WORKSPACE_STORAGE_KEY,
    storeKey: "default",
    store: webWorkspaceStore,
    diagnostics: storageDiagnostics,
    diagnosticSource: "web-workbench",
  });
}

function normalizeWebTerminalWorkspaceSnapshot(value: unknown): TerminalWorkspaceSnapshot | undefined {
  return normalizeWebTerminalWorkspaceSnapshotSource(value, {
    onError: (error) => reportWebStorageDiagnostic("terminal-workspace-normalize", "workspace-state", error),
  });
}

function applyWebTerminalWorkspaceSnapshot(snapshot: TerminalWorkspaceSnapshot): void {
  const restored = normalizeTerminalWorkspaceSnapshot(snapshot);
  webTerminalWorkspace.sessions.value = restored.sessions;
  webTerminalWorkspace.activeId.value = restored.activeId;
  webTerminalWorkspace.layout.value = restored.layout;
  webTerminalScreenKeys.clear();
}

function persistThemeIndex(index: number): void {
  try {
    globalThis.localStorage?.setItem(THEME_STORAGE_KEY, themes[index]?.id ?? themes[0]!.id);
  } catch (error) {
    reportWebStorageDiagnostic("theme-persist", "localStorage", error);
  }
}

function reportWebStorageDiagnostic(operation: string, storage: string, error: unknown): void {
  storageDiagnostics.report({
    source: "web-workbench",
    storage,
    operation,
    error,
  });
}

function theme(): ThemeSpec {
  return themes[themeIndex.value]!;
}
function cols(): number {
  return host.platform.size.value.columns;
}
function rowsCount(): number {
  return host.platform.size.value.rows;
}
