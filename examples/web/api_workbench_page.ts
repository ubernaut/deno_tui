/// <reference lib="dom" />
/// <reference lib="dom.iterable" />
import {
  appendBoundedWorkbenchLogRow,
  BoxObject,
  ButtonController,
  buttonText as formatButtonText,
  CheckBoxController,
  clampWorkbenchTileDensity,
  clipRect,
  ComboBoxController,
  Computed,
  type ComputedLayoutBox,
  contains,
  contrastText,
  createAnsiStyle,
  createFileExplorerTree,
  createRuntimeStore,
  createTerminalWorkspaceController,
  createWebTui,
  DataTableController,
  defaultWorkbenchMinimizedState,
  FileExplorerController,
  fillStringFrameRect,
  fitCellText,
  formatWorkbenchDiagnosticStatus,
  type HitTarget,
  HitTargetStack,
  initialWorkbenchDiagnosticLogRows,
  InputController,
  isWorkbenchMenuActivationKey,
  isWorkbenchMenuCloseKey,
  layoutWorkbenchButtonRowInto,
  layoutWorkbenchMenuBarHits,
  layoutWorkbenchModal,
  layoutWorkbenchPopover,
  layoutWorkbenchShelf,
  layoutWorkbenchTabs,
  layoutWorkbenchTitlebar,
  layoutWorkbenchTopMenuItemRect,
  layoutWrappedControlOptions,
  maxTextWidth,
  MenuBarController,
  modalContentHeight,
  ModalController,
  moveWorkbenchMenuIndex,
  normalizeTerminalWorkspaceSnapshot,
  normalizeWorkbenchPanelWorkspaceState,
  prepareWorkbenchRows,
  ProgressBarController,
  RadioGroupController,
  renderCheckBoxMark,
  renderDataTableHeader,
  renderDataTableRowsInto,
  renderMenuBar,
  renderModalRows,
  renderStatusBar,
  renderStepper,
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
  textWidth,
  translateHitTargets,
  workbenchAdaptiveTileOptions,
  workbenchButtonPaintOptions,
  type WorkbenchButtonRowItem,
  type WorkbenchButtonRowPlacement,
  type WorkbenchPanelWorkspaceState,
  workbenchShelfEntriesInto,
  workbenchStatusLeft,
  workbenchTabEntriesInto,
  type WorkbenchTerminalPaneProjection,
  workbenchTerminalPaneProjectionsInto,
  type WorkbenchTerminalSessionTab,
  type WorkbenchTerminalSessionTabPlacement,
  workbenchTerminalSessionTabsInto,
  type WorkbenchTerminalToolbarAction,
  workbenchTerminalToolbarItemsInto,
  type WorkbenchTitlebarButtonKind,
  workbenchVerticalScrollbarCellsInto,
  workbenchVerticalScrollbarRect,
  workbenchWindowLayout,
  WorkbenchWorkspaceViewportController,
  wrappedControlOptionRowCount,
  wrapTextBoxLines,
  writeStringFrameRow,
} from "../../mod.web.ts";
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
} from "../../app/api_workbench_catalog.ts";
import {
  type ApiWorkbenchControlHitPlacement,
  type ApiWorkbenchControlId,
  apiWorkbenchControlLineInto,
  type ApiWorkbenchControlLineSegment,
  apiWorkbenchControlTrack,
  apiWorkbenchDropdownPopoverRect,
  apiWorkbenchSliderSetHitInto,
  apiWorkbenchStepperHitPlacementsInto,
  nextApiWorkbenchControlId,
  nextSortableDataColumn,
} from "../../app/api_workbench_controls.ts";
import { htmlCssLayoutBoxStyle, htmlCssVisibleLayoutBoxesInto } from "../../app/html_css_layout_view.ts";
import {
  applyWorkbenchWindowSignalState,
  inspectWorkbenchWindowSignalState,
  WorkbenchController,
} from "../../src/app/workbench/controller.ts";
import { createHtmlCssLayoutDemo, htmlCssLayoutDemoBoxLabel } from "../../src/markup/demo_fixtures.ts";
import { DiagnosticsCollector } from "../../src/runtime/diagnostics.ts";
import { StorageFallbackDiagnostics } from "../../src/runtime/storage_diagnostics.ts";
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
type ButtonTone = "default" | "danger" | "warning" | "success" | "muted";
type MobileAction = "next" | "controls" | "theme" | "help" | "restore" | "wide" | "dense";
type WebTerminalAction = WorkbenchTerminalToolbarAction;

interface DropdownOverlay {
  kind: "theme" | "control";
  rect: Rectangle;
  items: string[];
  selectedIndex?: number;
}

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
const panelLineBuffer: string[] = [];
const panelDataRowsBuffer: string[] = [];
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
const webTerminalPaneProjections: WorkbenchTerminalPaneProjection[] = [];
const hitTargets = new HitTargetStack<Hit>();
const screenRows: string[] = [];
const workspaceVirtualRows: string[] = [];
const threePreviewOrbRows: string[] = [];
const htmlCssLayoutBoxes: ComputedLayoutBox[] = [];
const minimizedShelfEntries: Array<{ id: PanelId; title: string }> = [];
const fullscreenTabEntries: Array<{ id: PanelId; title: string; selected?: boolean; hidden?: boolean }> = [];
const verticalScrollbarCells: Array<{ column: number; row: number; glyph: string }> = [];
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
const webTerminalButtonItems: WorkbenchButtonRowItem<WebTerminalAction>[] = [];
const webTerminalButtonPlacements: WorkbenchButtonRowPlacement<WebTerminalAction>[] = [];
const webTerminalSessionTabSources: WorkbenchTerminalSessionTab[] = [];
const webTerminalSessionTabPlacements: WorkbenchTerminalSessionTabPlacement[] = [];
const controlLineSegments: ApiWorkbenchControlLineSegment[] = [];
const controlLineHitPlacements: ApiWorkbenchControlHitPlacement[] = [];
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
let dropdownOverlay: DropdownOverlay | null = null;
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
  style: new Computed(() => createAnsiStyle({ background: hex(theme().background) })),
  zIndex: -2,
}).draw();

ensureLines();
host.platform.size.subscribe(() => {
  ensureLines();
  draw();
});

host.on("keyPress", (event) => {
  const { key } = event;
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
  write(frame, 0, 0, paint(" ".repeat(width), theme().text, theme().backgroundSoft));
  write(frame, 1, 0, paint(" ".repeat(width), theme().text, theme().panel));
  write(frame, 0, 1, paint(` API WORKBENCH `, theme().background, theme().accent, true));
  const closeLabel = buttonText("x", true);
  const closeWidth = textWidth(closeLabel);
  const menuWidth = Math.max(0, width - 18 - closeWidth);
  renderMenuHits(17, 0, menuWidth);
  write(
    frame,
    0,
    17,
    paint(
      fit(renderMenuBar(menu.items.peek(), menu.activeIndex.peek()), menuWidth),
      theme().text,
      theme().backgroundSoft,
    ),
  );
  if (width >= 22) {
    writeButton(frame, 0, width - closeWidth, "x", { compact: true, tone: "danger" });
    hitTargets.add({ column: width - closeWidth, row: 0, width: closeWidth, height: 1 }, { type: "quit" });
  }
  if (themeMenuOpen.peek()) {
    dropdownOverlay = {
      kind: "theme",
      rect: menuItemRect(
        17,
        "theme",
        themeMenuWidth,
        themes.length + 2,
      ),
      items: themeLabels,
      selectedIndex: themeIndex.peek(),
    };
  }
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
      write(virtual, 1, 2, paint("All panels minimized. Press R or click restore."));
      hitTargets.add({ ...layout.bounds, row: 0 }, { type: "restore" });
    } else {
      for (const [id, rect] of layout.rects) {
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
  renderDropdownOverlay(frame);
  renderModalOverlay(frame);
  frame[height - 1] = fit(
    paint(
      renderStatusBar(
        workbenchStatusLeft({
          focus: active.peek(),
          theme: theme().label,
          tileDensity: tileDensity.peek(),
          diagnostics: formatWorkbenchDiagnosticStatus(webDiagnostics),
        }),
        "1-8 focus  T theme  H help  Q quit  click controls",
        width,
      ),
      theme().text,
      theme().panelSoft,
    ),
    width,
  );
  for (let row = 0; row < height; row++) lineSignals[row]!.value = fit(frame[row] ?? "", width);
  for (let row = height; row < lineSignals.length; row++) lineSignals[row]!.value = "";
}

function renderShelf(frame: string[]): void {
  const row = rowsCount() - 2;
  syncWebWindowManagerState();
  const entries = workbenchShelfEntriesInto(minimizedShelfEntries, webWindows.inspect().windows, panelTitle);
  if (entries.length === 0) return;
  const layout = layoutWorkbenchShelf({ row, column: 2, width: Math.max(0, cols() - 2), entries });
  write(frame, row, layout.prefixRect.column, paint(layout.prefix, theme().muted, theme().backgroundSoft));
  for (const button of layout.buttons) {
    writeButton(frame, row, button.rect.column, button.label, { tone: "muted", maxWidth: button.rect.width });
    hitTargets.add(button.rect, { type: "restore", id: button.id });
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
    hitTargets.add(hit.rect, { type: "menu", index: hit.index });
  }
}

function renderMobileCommandStrip(frame: string[]): void {
  if (!isTouchOptimizedLayout() || rowsCount() < 8) return;
  const actions: Array<{ action: MobileAction; label: string; tone?: ButtonTone; active?: boolean }> = [
    { action: "next", label: `Next ${shortPanelTitle(active.peek())}` },
    { action: "controls", label: "Controls", active: active.peek() === "controls" },
    { action: "theme", label: "Theme", active: themeMenuOpen.peek() },
    { action: "help", label: "Help" },
    { action: "restore", label: "Restore", tone: "muted" },
    { action: "wide", label: "Wide", tone: "muted" },
    { action: "dense", label: "Dense", tone: "muted" },
  ];
  let row = 1;
  let column = 1;
  for (const entry of actions) {
    if (column >= cols() - 1) break;
    let maxWidth = Math.max(0, cols() - column - 1);
    const desiredWidth = textWidth(buttonText(entry.label));
    if (desiredWidth > maxWidth && row < 2) {
      row += 1;
      column = 1;
      maxWidth = Math.max(0, cols() - column - 1);
    }
    const width = writeButton(frame, row, column, entry.label, {
      state: entry.active ? "active" : "base",
      tone: entry.tone ?? "default",
      maxWidth,
    });
    if (width <= 0) break;
    hitTargets.add({ column, row, width, height: 1 }, { type: "mobileAction", action: entry.action });
    column += width + 1;
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
    maxWidth: cols(),
    measureText: textWidth,
  });
}

function renderWindowTabs(frame: string[]): void {
  const row = rowsCount() - 2;
  syncWebWindowManagerState();
  const layout = layoutWorkbenchTabs({
    row,
    column: 2,
    width: Math.max(0, cols() - 2),
    tabs: workbenchTabEntriesInto(fullscreenTabEntries, webWindows.inspect().tabs, panelTitle),
  });
  write(frame, row, layout.prefixRect.column, paint(layout.prefix, theme().muted, theme().backgroundSoft));
  for (const button of layout.buttons) {
    writeButton(frame, row, button.rect.column, button.label, {
      state: button.selected ? "active" : "base",
      tone: button.hidden ? "muted" : "default",
      maxWidth: button.rect.width,
    });
    hitTargets.add(button.rect, { type: "restore", id: button.id });
  }
}

function renderPanel(frame: string[], id: PanelId, rect: Rectangle): void {
  if (rect.width < 10 || rect.height < 4) return;
  hitTargets.add(rect, { type: "focus", id });
  const selected = active.peek() === id;
  fillRect(frame, rect, selected ? theme().panelSoft : theme().panel);
  const border = selected ? theme().accent : theme().borderStrong;
  const title = panelTitle(id).toUpperCase();
  const top = `┌ ${title} ${"─".repeat(Math.max(0, rect.width - title.length - 24))}             ┐`;
  write(
    frame,
    rect.row,
    rect.column,
    paint(fit(top, rect.width), border, selected ? theme().panelSoft : theme().panel, selected),
  );
  for (const button of layoutWorkbenchTitlebar({ rect, title: panelTitle(id) }).buttons) {
    if (button.kind === "config") continue;
    writeButton(frame, button.rect.row, button.rect.column, button.label, {
      compact: button.compact,
      tone: button.tone,
    });
    hitTargets.add(button.rect, panelTitlebarHit(id, button.kind));
  }
  for (let r = 1; r < rect.height - 1; r++) {
    write(
      frame,
      rect.row + r,
      rect.column,
      paint(`│${" ".repeat(rect.width - 2)}│`, border, selected ? theme().panelSoft : theme().panel),
    );
  }
  write(
    frame,
    rect.row + rect.height - 1,
    rect.column,
    paint(`└${"─".repeat(rect.width - 2)}┘`, border, selected ? theme().panelSoft : theme().panel),
  );
  const inner = {
    column: rect.column + 2,
    row: rect.row + 1,
    width: Math.max(0, rect.width - 4),
    height: Math.max(0, rect.height - 2),
  };
  fillRect(frame, inner, theme().surface);
  if (id === "explorer") renderExplorer(frame, inner);
  else if (id === "controls") renderControls(frame, inner);
  else if (id === "logs") renderLogs(frame, inner);
  else if (id === "three") renderThreePreview(frame, inner);
  else if (id === "htmlLayout") renderHtmlCssLayout(frame, inner);
  else if (id === "terminal") renderTerminalProtocol(frame, inner);
  else {
    const lines = panelLines(id, inner.height);
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index]!;
      const style = panelLineStyle(id, index);
      write(frame, inner.row + index, inner.column, paint(fit(line, inner.width), style.fg, style.bg, style.bold));
    }
    if (id === "data") {
      for (let index = 0; index < Math.min(table.view.peek().rows.length, Math.max(0, inner.height - 1)); index += 1) {
        hitTargets.add({ column: inner.column, row: inner.row + 1 + index, width: inner.width, height: 1 }, {
          type: "dataRow",
          index,
        });
      }
    }
  }
}

function panelTitlebarHit(id: PanelId, kind: WorkbenchTitlebarButtonKind): Hit {
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
  const end = Math.min(lineCount, offset + rect.height);
  for (let sourceIndex = offset; sourceIndex < end; sourceIndex += 1) {
    const line = sourceIndex < docs.length ? docs[sourceIndex]! : logRows[sourceIndex - docs.length]!;
    write(
      frame,
      rect.row + sourceIndex - offset,
      rect.column,
      paint(fit(line, bodyWidth), theme().text, theme().surface),
    );
  }
  if (!overflow.rows.scrollbarVisible || rect.width < 1) return;
  const column = rect.column + rect.width - 1;
  const thumb = overflow.rows.thumb;
  hitTargets.add({ column, row: rect.row, width: 1, height: rect.height }, { type: "logScrollbar" });
  for (let row = 0; row < rect.height; row += 1) {
    write(frame, rect.row + row, column, paint(scrollbarGlyph(row, thumb), theme().accent, theme().surface, true));
  }
}

function renderExplorer(frame: string[], rect: Rectangle): void {
  const visible = explorer.tree.visibleRows();
  const selectedIndex = explorer.tree.selectedIndex.peek();
  const rowCount = Math.min(visible.length, rect.height);
  for (let offset = 0; offset < rowCount; offset += 1) {
    const row = visible[offset]!;
    const selected = row.index === selectedIndex;
    const node = row.node as { kind?: string; path?: string };
    const icon = row.hasChildren ? row.expanded ? "▾" : "▸" : node.kind === "file" ? "·" : " ";
    const label = `${"  ".repeat(row.depth)}${icon} ${row.label}`;
    write(
      frame,
      rect.row + offset,
      rect.column,
      paint(
        fit(label, rect.width),
        selected
          ? contrastText(theme().warn, theme().background, theme().text)
          : node.kind === "directory"
          ? theme().good
          : theme().text,
        selected ? theme().warn : theme().surface,
        selected || node.kind === "directory",
      ),
    );
    hitTargets.add({ column: rect.column, row: rect.row + offset, width: rect.width, height: 1 }, {
      type: "explorerRow",
      index: row.index,
    });
  }
}

function renderThreePreview(frame: string[], rect: Rectangle): void {
  const phase = Math.floor(performance.now() / 90);
  const mode = ["BLOCKS", "GLYPHS", "MIXED"][Math.abs(tileDensity.peek()) % 3] ?? "MIXED";
  let row = 0;
  row = writeThreePreviewLine(frame, rect, row, ` ACEROLA THREE ASCII · ${mode} · WEB SAFE PREVIEW `);
  row = writeThreePreviewLine(
    frame,
    rect,
    row,
    "Full WebGPU renderer is mounted below this workbench on the Pages build.",
  );
  row = writeThreePreviewLine(
    frame,
    rect,
    row,
    "Use the standalone Three demo for live WebGPU; this pane mirrors controls and state.",
  );
  row = writeThreePreviewLine(frame, rect, row, "");
  for (const line of asciiOrb(threePreviewOrbRows, rect.width, Math.max(3, rect.height - 6), phase)) {
    row = writeThreePreviewLine(frame, rect, row, line);
    if (row >= rect.height) return;
  }
  row = writeThreePreviewLine(frame, rect, row, "");
  writeThreePreviewLine(
    frame,
    rect,
    row,
    `preset mixed-best  glyph ${mode.toLowerCase()}  density ${tileDensity.peek()}  theme ${theme().label}`,
  );
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

function asciiOrb(target: string[], width: number, height: number, phase: number): string[] {
  const columns = Math.max(8, width);
  const rows = Math.max(3, height);
  const glyphs = " .:-=+*#%@";
  return prepareWorkbenchRows(target, rows, () => "", (_line, row) => {
    let line = "";
    for (let column = 0; column < columns; column += 1) {
      const x = (column / Math.max(1, columns - 1)) * 2 - 1;
      const y = (row / Math.max(1, rows - 1)) * 2 - 1;
      const ring = Math.abs(Math.sqrt(x * x * 2.8 + y * y * 1.8) - 0.62);
      const wave = Math.sin(column * 0.32 + phase * 0.18) + Math.cos(row * 0.7 - phase * 0.14);
      const value = Math.max(0, Math.min(1, 1 - ring * 3.5 + wave * 0.15));
      line += glyphs[Math.floor(value * (glyphs.length - 1))] ?? " ";
    }
    return line;
  });
}

function renderHtmlCssLayout(frame: string[], rect: Rectangle): void {
  const t = theme();
  const result = createHtmlCssLayoutDemo(rect);
  const boxes = htmlCssVisibleLayoutBoxesInto(htmlCssLayoutBoxes, result.layout.boxes);

  for (const box of boxes) {
    renderHtmlCssLayoutBox(frame, box, rect, t);
  }

  const rows = [
    "parseTuiMarkup -> parseCssStylesheet -> applyCssCascade -> LayoutEngine",
    "Flex rows wrap; nested CSS Grid uses fr tracks, spans, and media rules.",
    "Resize the browser to recalculate terminal-cell layout through the web host.",
  ];
  const start = Math.max(rect.row, rect.row + rect.height - rows.length);
  for (let index = 0; index < rows.length && start + index < rect.row + rect.height; index += 1) {
    write(
      frame,
      start + index,
      rect.column,
      paint(fit(rows[index]!, rect.width), index === 0 ? t.accent : t.soft, t.panelSoft, index === 0),
    );
  }
}

function renderHtmlCssLayoutBox(frame: string[], box: ComputedLayoutBox, bounds: Rectangle, t: ThemeSpec): void {
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
  write(frame, content.row, content.column, paint(fit(label, content.width), style.fg, style.bg, style.bold));
  if (content.height > 1 && box.text) {
    write(frame, content.row + 1, content.column, paint(fit(box.text, content.width), t.text, style.bg));
  }
  if (content.height > 2 && (box.id.startsWith("metric-") || box.id.startsWith("grid-"))) {
    const detail = `${box.rect.width}x${box.rect.height} content ${box.contentRect.width}x${box.contentRect.height}`;
    write(frame, content.row + 2, content.column, paint(fit(detail, content.width), t.muted, style.bg));
  }
}

function drawHtmlCssLayoutOutline(frame: string[], rect: Rectangle, fg: string, bg: string, bold = false): void {
  if (rect.width < 2 || rect.height < 2) return;
  write(frame, rect.row, rect.column, paint(`┌${"─".repeat(Math.max(0, rect.width - 2))}┐`, fg, bg, bold));
  for (let row = rect.row + 1; row < rect.row + rect.height - 1; row += 1) {
    write(frame, row, rect.column, paint("│", fg, bg, bold));
    write(frame, row, rect.column + rect.width - 1, paint("│", fg, bg, bold));
  }
  write(
    frame,
    rect.row + rect.height - 1,
    rect.column,
    paint(`└${"─".repeat(Math.max(0, rect.width - 2))}┘`, fg, bg, bold),
  );
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
  const headerRows = [
    "REMOTE TERMINAL / BROWSER SHELL MODEL",
    `active ${
      workspace.active?.title ?? "none"
    }  screen ${inspection.columns}x${inspection.rows}  cursor ${inspection.cursor.column},${inspection.cursor.row}  sessions ${workspace.count}  panes ${workspace.layout.count}`,
  ];
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
  workbenchTerminalToolbarItemsInto(webTerminalButtonItems, {
    activeId: workspace.activeId,
    sessionCount: workspace.sessions.length,
    paneCount: workspace.layout.count,
    zoomedPaneId: workspace.layout.zoomedPaneId,
    scrollbackTotalRows: scrollbackInspection?.totalRows,
    scrollbackViewportRows: scrollbackInspection?.viewportRows,
    searchQuery: scrollbackInspection?.query,
    searchMatchCount: scrollbackInspection?.matches.length,
  }, { actions: webTerminalActions });
  layoutWorkbenchButtonRowInto(webTerminalButtonPlacements, webTerminalButtonItems, rect, rect.row);
  for (const placement of webTerminalButtonPlacements) {
    const written = writeButton(frame, placement.rect.row, placement.rect.column, placement.item.label, {
      state: placement.state,
      tone: placement.tone,
      maxWidth: placement.rect.width,
    });
    if (!placement.item.disabled && written > 0) {
      hitTargets.add({ ...placement.rect, width: written }, { type: "terminalAction", action: placement.item.action });
    }
  }
}

function renderTerminalSessionTabs(frame: string[], rect: Rectangle): void {
  if (rect.height <= 0 || rect.width <= 0) return;
  const workspace = webTerminalWorkspace.inspect();
  const t = theme();
  webTerminalSessionTabSources.length = 0;
  for (const session of workspace.sessions) {
    webTerminalSessionTabSources.push({
      id: session.id,
      title: session.title,
      running: session.running,
      status: session.status,
    });
  }
  fillRect(frame, rect, theme().panelSoft);
  const tabs = workbenchTerminalSessionTabsInto(
    webTerminalSessionTabPlacements,
    webTerminalSessionTabSources,
    workspace.activeId,
    rect,
  );
  for (const tab of tabs) {
    write(
      frame,
      rect.row,
      tab.column,
      paint(
        tab.label,
        tab.active ? contrastText(t.accent, t.background, t.text) : t.text,
        tab.active ? t.accent : t.panelSoft,
        tab.active,
      ),
    );
    hitTargets.add({ column: tab.column, row: tab.row, width: tab.width, height: 1 }, {
      type: "terminalSession",
      id: tab.id,
    });
  }
}

function renderWebTerminalPanes(
  frame: string[],
  rect: Rectangle,
  workspace = webTerminalWorkspace.inspect(),
): void {
  if (rect.width <= 0 || rect.height <= 0) return;
  const projections = workbenchTerminalPaneProjectionsInto(
    webTerminalPaneProjections,
    workspace.layout,
    rect,
    {
      gap: 1,
      fallbackSessionId: workspace.activeId,
      titleForSession: (sessionId) => workspace.sessions.find((entry) => entry.id === sessionId)?.title,
    },
  );
  for (const projection of projections) {
    renderWebTerminalPane(frame, projection);
  }
}

function renderWebTerminalPane(
  frame: string[],
  projection: WorkbenchTerminalPaneProjection,
): void {
  const rect = projection.rect;
  if (rect.width <= 0 || rect.height <= 0) return;
  const t = theme();
  const activePane = projection.active;
  fillRect(frame, rect, activePane ? t.background : t.surface);
  const content = projection.contentRect;
  if (projection.titleVisible) {
    const bg = activePane ? t.accentDeep : t.panelSoft;
    write(
      frame,
      rect.row,
      rect.column,
      paint(
        fit(projection.title, rect.width),
        activePane ? contrastText(bg, t.background, t.text) : t.soft,
        bg,
        activePane,
      ),
    );
    if (projection.paneId) {
      hitTargets.add({ column: rect.column, row: rect.row, width: rect.width, height: 1 }, {
        type: "terminalPane",
        id: projection.paneId,
      });
    }
  }
  const sessionId = projection.sessionId;
  const screen = syncWebTerminalScreen(sessionId, content.width, content.height);
  const scrollback = syncWebTerminalScrollback(sessionId, screen, content.height);
  hitTargets.add(content, { type: "terminalContent", sessionId, paneId: projection.paneId });
  const inspection = scrollback.inspect();
  const rows = inspection.mode === "copy" ? inspection.visibleRows : screen.textRows();
  const selection = inspection.selection;
  const selectionStart = selection ? Math.min(selection.anchor, selection.focus) : -1;
  const selectionEnd = selection ? Math.max(selection.anchor, selection.focus) : -1;
  const screenRowCount = Math.min(rows.length, content.height);
  for (let index = 0; index < screenRowCount; index += 1) {
    const line = rows[index]!;
    const rowIndex = inspection.offset + index;
    const selected = inspection.mode === "copy" && rowIndex >= selectionStart && rowIndex <= selectionEnd;
    write(
      frame,
      content.row + index,
      content.column,
      paint(
        fit(line, content.width),
        selected ? t.background : t.text,
        selected ? t.warn : activePane ? t.background : t.surface,
        selected,
      ),
    );
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
    const id = nextWebTerminalSessionId();
    const title = webTerminalSessionTitle(id);
    webTerminalWorkspace.add({
      id,
      title,
      kind: "command",
      command: "web-shell",
      metadata: { source: "browser-demo" },
    }, {
      activate: true,
      backendId: "browser-mock",
      status: "running",
      running: true,
    });
    push(`terminal new ${title}`);
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
    const id = nextWebTerminalSessionId();
    const title = webTerminalSessionTitle(id);
    const descriptor = webTerminalWorkspace.add({
      id,
      title,
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
    push(`terminal split ${title}`);
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

function nextWebTerminalSessionId(): string {
  const existing = new Set(webTerminalWorkspace.inspect().sessions.map((session) => session.id));
  for (let index = 1; index < 10000; index += 1) {
    const id = `pages-shell-${index}`;
    if (!existing.has(id)) return id;
  }
  return `pages-shell-${Date.now()}`;
}

function webTerminalSessionTitle(id: string): string {
  const match = /^pages-shell-(\d+)$/.exec(id);
  return match ? `Pages Shell ${match[1]}` : "Pages Shell";
}

function panelLines(id: PanelId, height: number): string[] {
  panelLineBuffer.length = 0;
  const safeHeight = Math.max(0, height);
  if (safeHeight === 0 || id === "controls") return panelLineBuffer;

  if (id === "data") {
    panelLineBuffer.push(renderDataTableHeader(table.columns.peek(), table.state.peek().sort));
    renderDataTableRowsInto(
      panelDataRowsBuffer,
      table.view.peek().rows,
      table.columns.peek(),
      table.view.peek().selectedIndex,
    );
    for (let index = 0; index < panelDataRowsBuffer.length && panelLineBuffer.length < safeHeight; index += 1) {
      panelLineBuffer.push(panelDataRowsBuffer[index]!);
    }
    return panelLineBuffer;
  }

  if (id === "logs") {
    const source = log.peek();
    const start = Math.max(0, source.length - Math.max(1, safeHeight));
    for (let index = start; index < source.length && panelLineBuffer.length < safeHeight; index += 1) {
      panelLineBuffer.push(source[index]!);
    }
    return panelLineBuffer;
  }

  panelLineBuffer.push("API Workbench Web");
  for (let index = 0; index < docs.length && panelLineBuffer.length < safeHeight; index += 1) {
    panelLineBuffer.push(docs[index]!);
  }
  return panelLineBuffer;
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
  else if (hit.type === "restore") hit.id ? restorePanel(hit.id) : restore();
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
  if (isWorkbenchMenuCloseKey(event.key)) {
    closeThemeMenu();
    return;
  }
  themeIndex.value = moveWorkbenchMenuIndex(themeIndex.peek(), themes.length, event);
  if (isWorkbenchMenuActivationKey(event.key)) setTheme(themeIndex.peek());
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
  const layout = webWindows.layout({
    bounds,
    tileOptions: workbenchAdaptiveTileOptions({ bounds, tileDensity: tileDensity.peek() }),
  });
  return workbenchWindowLayout<PanelId>(bounds, layout);
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
  const rect = workbenchVerticalScrollbarRect({ bounds, visible: overflow.rows.scrollbarVisible });
  if (!rect) return;
  hitTargets.add(rect, { type: "workspaceScrollbar" });
  for (const cell of workbenchVerticalScrollbarCellsInto(verticalScrollbarCells, rect, overflow.rows.thumb)) {
    write(
      frame,
      cell.row,
      cell.column,
      paint(cell.glyph, theme().accent, theme().backgroundSoft, true),
    );
  }
}

function renderDropdownOverlay(frame: string[]): void {
  const overlay = dropdownOverlay;
  if (!overlay || overlay.items.length === 0) return;
  const rect = layoutWorkbenchPopover({
    rect: overlay.rect,
    bounds: { column: 0, row: 0, width: cols(), height: rowsCount() },
  });
  if (!rect) return;
  fillRect(frame, rect, theme().panelSoft);
  write(
    frame,
    rect.row,
    rect.column,
    paint(`┌${"─".repeat(Math.max(0, rect.width - 2))}┐`, theme().accent, theme().panelSoft, true),
  );
  for (const [index, item] of overlay.items.entries()) {
    const row = rect.row + 1 + index;
    if (row >= rect.row + rect.height - 1) break;
    const selected = overlay.selectedIndex === index;
    const marker = selected ? "●" : "○";
    write(
      frame,
      row,
      rect.column,
      paint(
        `│ ${fit(`${marker} ${item}`, rect.width - 4)} │`,
        selected ? contrastText(theme().warn, theme().background, theme().text) : theme().text,
        selected ? theme().warn : theme().panelSoft,
        selected,
      ),
    );
    hitTargets.add({ column: rect.column + 1, row, width: Math.max(0, rect.width - 2), height: 1 }, {
      type: "theme",
      index,
    });
  }
  write(
    frame,
    rect.row + rect.height - 1,
    rect.column,
    paint(`└${"─".repeat(Math.max(0, rect.width - 2))}┘`, theme().accent, theme().panelSoft, true),
  );
}

function renderModalOverlay(frame: string[]): void {
  if (!modal.openState.peek()) return;
  hitTargets.add({ column: 0, row: 0, width: cols(), height: rowsCount() }, { type: "modalAction", index: -1 });
  const inspection = modal.inspect();
  const probeWidth = Math.min(Math.max(38, cols() - 8), 74);
  const { rect, inner, shadow } = layoutWorkbenchModal({
    bounds: { column: 0, row: 0, width: cols(), height: rowsCount() },
    contentHeight: modalContentHeight(inspection, probeWidth),
    maxWidth: 74,
  });
  if (shadow.width > 0 && shadow.height > 0) fillRect(frame, shadow, theme().background);
  fillRect(frame, rect, theme().panelSoft);
  drawFrame(frame, rect, inspection.title, true);
  const rows = renderModalRows(inspection, { width: rect.width, height: inner.height });
  for (let index = 0; index < rows.length && index < inner.height; index += 1) {
    const actionRow = inspection.actions.length > 0 && index === rows.length - 1;
    const titleRow = index === 0;
    write(
      frame,
      inner.row + index,
      inner.column,
      paint(
        fit(actionRow ? "" : rows[index]!, inner.width),
        titleRow ? theme().accent : theme().text,
        actionRow ? theme().panel : theme().panelSoft,
        actionRow || titleRow,
      ),
    );
  }
  if (inspection.actions.length === 0 || rows.length === 0) return;
  const actionRow = inner.row + Math.min(rows.length, inner.height) - 1;
  modalActionButtonItems.length = 0;
  for (let index = 0; index < inspection.actions.length; index += 1) {
    const action = inspection.actions[index]!;
    modalActionButtonItems.push({
      label: action.label,
      action: index,
      disabled: action.disabled,
      active: index === inspection.selectedActionIndex,
      tone: action.destructive ? "danger" : "default",
    });
  }
  layoutWorkbenchButtonRowInto(
    modalActionButtonPlacements,
    modalActionButtonItems,
    { column: inner.column, row: actionRow, width: inner.width, height: 1 },
    actionRow,
  );
  for (const placement of modalActionButtonPlacements) {
    writeButton(frame, placement.rect.row, placement.rect.column, placement.item.label, {
      state: placement.state,
      tone: placement.tone,
    });
    hitTargets.add(placement.rect, { type: "modalAction", index: placement.item.action });
  }
}

function panelLineStyle(id: PanelId, index: number): { fg: string; bg: string; bold?: boolean } {
  const t = theme();
  if (id === "data" && index === 0) {
    return { fg: contrastText(t.accentDeep, t.background, t.text), bg: t.accentDeep, bold: true };
  }
  if (id === "data" && index > 0 && index - 1 === table.view.peek().selectedIndex) {
    return { fg: contrastText(t.warn, t.background, t.text), bg: t.warn, bold: true };
  }
  if (id === "inspector" && (index === 0 || index === 7)) {
    return { fg: t.background, bg: index === 0 ? t.accent : t.border, bold: true };
  }
  if (id === "logs") return { fg: t.text, bg: t.surface };
  return { fg: t.text, bg: t.surface };
}
function push(message: string): void {
  log.value = appendBoundedWorkbenchLogRow(log.peek(), `${new Date().toLocaleTimeString()} ${message}`, 40);
}

function openWorkbenchModal(): void {
  closeThemeMenu();
  modal.open({
    title: "Confirm Action",
    tone: "confirm",
    body: [
      "Modal windows sit above the browser workbench and use the same renderer-neutral controller as terminal modals.",
      "Keyboard focus is trapped while the modal is open. Use Tab, arrows, Enter, Escape, or click an action.",
    ],
    actions: [
      { id: "cancel", label: "Cancel" },
      { id: "details", label: "Details" },
      { id: "confirm", label: "Confirm", default: true },
    ],
  });
  push("modal opened");
}

function openHelpModal(): void {
  closeThemeMenu();
  modal.open({
    title: "Web Workbench Help",
    tone: "info",
    body: [
      "Keyboard: Tab cycles panels. Use 1-8 to focus Explorer, Inspector, Data, Controls, Logs, Three ASCII, HTML/CSS Layout, and Terminal.",
      "Use M to minimize, F or Enter to maximize/restore, R to restore all panels, T for themes, H for help, and Q to quit.",
      "Controls: arrow keys adjust sliders, radio groups, combo boxes, steppers, and dropdowns. Enter or Space activates.",
      "Mouse: click panels to focus, click rows to select, click controls to change values, and click scrollbars to jump.",
      "Touch: use the compact command strip, tap larger hit zones around controls, and drag inside panels to scroll.",
      "Resize the browser. The same tiled layout helper used by the terminal workbench recomputes panel geometry.",
    ],
    actions: [
      { id: "dismiss", label: "Dismiss", default: true },
      { id: "controls", label: "Focus Controls" },
    ],
  });
  push("help opened");
}

function openQuitModal(): void {
  closeThemeMenu();
  modal.open({
    title: "Close Web Workbench?",
    tone: "warning",
    body: [
      "Hide the API workbench browser demo?",
      "This only removes the demo host from the page; reload the page to mount it again.",
    ],
    actions: [
      { id: "cancel", label: "Cancel" },
      { id: "quit", label: "Close", destructive: true, default: true },
    ],
  });
  push("quit confirmation");
}

function applyModalAction(actionId: string): void {
  if (actionId === "details") {
    modal.open({
      title: "Modal Details",
      tone: "info",
      body: [
        "ModalController owns open state, body rows, action focus, and keyboard behavior.",
        "The browser renderer adds a centered overlay, backdrop click blocking, and theme-aware action buttons.",
      ],
      actions: [
        { id: "back", label: "Back" },
        { id: "confirm", label: "Confirm", default: true },
        { id: "dismiss", label: "Dismiss" },
      ],
    });
    push("modal details");
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
      body: "The web modal action completed.",
      actions: [{ id: "dismiss", label: "Dismiss", default: true }],
    });
    push("modal confirmed");
    return;
  }
  if (actionId === "controls") {
    modal.close();
    focus("controls");
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
  let row = rect.row;
  const t = theme();
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
    const selected = activeControl.peek() === id;
    if (options.button) {
      write(frame, startRow, rect.column, paint(" ".repeat(rect.width), t.text, t.surface));
    }
    for (let index = 0; index < controlLineSegments.length; index += 1) {
      const segment = controlLineSegments[index]!;
      if (options.button && segment.kind === "button") {
        writeButton(frame, segment.row, segment.column, segment.text.replace(/^\[\s*|\s*\]$/g, ""), {
          state: selected ? "active" : "base",
          maxWidth: segment.width,
        });
      } else if (options.button && segment.kind === "detail") {
        write(
          frame,
          segment.row,
          segment.column,
          paint(segment.text, selected ? t.warn : t.text, t.surface, selected),
        );
      } else {
        write(
          frame,
          segment.row,
          segment.column,
          paint(
            segment.text,
            selected ? t.background : t.text,
            selected ? t.warn : t.surface,
            selected,
          ),
        );
      }
    }
    for (let index = 0; index < controlLineHitPlacements.length; index += 1) {
      const hit = controlLineHitPlacements[index]!;
      hitTargets.add({
        column: hit.column,
        row: hit.row,
        width: hit.width,
        height: hit.height,
      }, { type: "control", id: hit.id, action: hit.action, index: hit.index });
    }
    row = nextRow;
  };
  const sliderTrack = apiWorkbenchControlTrack({
    ratio: slider.inspect().normalizedValue,
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
  writeControl("button", `${buttonText("Run Action")} presses=${actionButton.pressCount.peek()}`, { button: true });
  writeControl("genericButton", `${buttonText("Generic Button")} presses=${genericButton.pressCount.peek()}`, {
    button: true,
  });
  writeControl("modal", `${buttonText("Open Modal")} state=${modal.openState.peek() ? "open" : "closed"}`, {
    button: true,
  });
  writeControl("slider", `Slider    ${sliderTrack.text} ${slider.value.peek()}/10`, {
    previous: true,
    next: true,
  });
  const sliderSetHit = apiWorkbenchSliderSetHitInto(controlSliderSetHit, rect, row - 1, sliderTrack);
  hitTargets.add({
    column: sliderSetHit.column,
    row: sliderSetHit.row,
    width: sliderSetHit.width,
    height: sliderSetHit.height,
  }, {
    type: "control",
    id: sliderSetHit.id,
    action: sliderSetHit.action,
  });
  writeControl("checkbox", "Checkboxes");
  writeControl("checkbox", `${renderCheckBoxMark(live.checked.peek())} live preview`, { indent: true, index: 0 });
  writeControl("checkbox", `${renderCheckBoxMark(compact.checked.peek())} compact rows`, { indent: true, index: 1 });
  writeControl("radio", "Radio", {
    previous: true,
    next: true,
  });
  for (const [index, option] of radio.options.peek().entries()) {
    const mark = option.value === radio.selectedValue.peek() ? "●" : "○";
    const cursor = index === radio.activeIndex.peek() ? ">" : " ";
    writeControl("radio", `${cursor} ${mark} ${option.label}`, { indent: true, index });
  }
  writeControl("combo", `Theme combo  ${combo.expanded.peek() ? "v" : ">"} ${combo.label()}`, {
    previous: true,
    next: true,
  });
  writeWrappedOptions(frame, rect, row, "combo", combo.items.peek(), combo.selectedIndex.peek(), t);
  row += wrappedControlOptionRowCount(combo.items.peek(), undefined, rect.width - 4);
  writeControl("dropdown", `Dropdown  ${dropdown.expanded.peek() ? "v" : ">"} ${dropdown.label()}`, {
    action: "toggle",
  });
  if (dropdown.expanded.peek()) {
    const items = dropdown.items.peek();
    renderControlDropdownPopover(
      frame,
      apiWorkbenchDropdownPopoverRect({ rect, row, items, label: dropdown.label() }),
    );
  }
  writeControl("input", `Input     ${input.text.peek()}${activeControl.peek() === "input" ? "|" : ""}`, {
    action: "focus",
  });
  const stepperRow = row;
  writeControl(
    "stepper",
    `Stepper   ${
      renderStepper(stepper.steps.peek(), stepper.activeIndex.peek(), "horizontal", Math.max(8, rect.width - 12))[0] ??
        ""
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
      paint(fit(`Progress  ${progressTrack.text} ${progress.value.peek()}%`, rect.width), t.text, t.surface),
    );
  }
}

function renderTextboxControl(frame: string[], rect: Rectangle, row: number, t: ThemeSpec): number {
  if (row >= rect.row + rect.height) return row;
  const selected = activeControl.peek() === "textbox";
  const height = Math.min(5, Math.max(2, rect.row + rect.height - row));
  const labelWidth = Math.min(10, Math.max(0, rect.width - 12));
  const textColumn = rect.column + labelWidth;
  const textAreaWidth = Math.max(1, rect.width - labelWidth);
  const visualLines = wrapTextBoxLines(textBox.lines.peek(), textAreaWidth - 2, { wordWrap: true });
  const cursor = textBox.cursorPosition.peek();
  const cursorRow = visualLines.findIndex((line) =>
    line.lineIndex === cursor.y && cursor.x >= line.startColumn && cursor.x <= line.endColumn
  );
  const start = Math.max(0, Math.min(Math.max(0, cursorRow - height + 1), Math.max(0, visualLines.length - height)));
  const header = `${selected ? ">" : " "} TextBox`;
  for (let offset = 0; offset < height; offset += 1) {
    const line = visualLines[start + offset] ?? {
      text: "",
      lineIndex: 0,
      startColumn: 0,
      endColumn: 0,
      continuation: false,
    };
    const cursorOnLine = selected && line.lineIndex === cursor.y && cursor.x >= line.startColumn &&
      cursor.x <= line.endColumn;
    const marker = cursorOnLine ? "|" : " ";
    write(
      frame,
      row + offset,
      rect.column,
      paint(
        fit(offset === 0 ? header : " ".repeat(Math.max(0, labelWidth)), labelWidth),
        selected && offset === 0 ? t.background : t.text,
        selected && offset === 0 ? t.warn : t.surface,
        selected && offset === 0,
      ),
    );
    write(
      frame,
      row + offset,
      textColumn,
      paint(
        fit(`${line.continuation ? ">" : " "}${line.text}${marker}`, textAreaWidth),
        selected ? t.background : t.text,
        selected ? t.warn : t.surface,
        selected,
      ),
    );
  }
  hitTargets.add({ column: rect.column, row, width: rect.width, height }, {
    type: "control",
    id: "textbox",
    action: "focus",
  });
  return row + height;
}

function writeWrappedOptions(
  frame: string[],
  rect: Rectangle,
  startRow: number,
  id: ControlId,
  items: readonly string[],
  selectedIndex: number | undefined,
  t: ThemeSpec,
): void {
  const width = Math.max(8, rect.width - 4);
  const rows = layoutWrappedControlOptions(items, selectedIndex, width);
  for (let offset = 0; offset < rows.length; offset += 1) {
    const line = rows[offset]!;
    const row = startRow + offset;
    if (row >= rect.row + rect.height || line.text.length === 0) return;
    const selected = activeControl.peek() === id;
    write(
      frame,
      row,
      rect.column + 2,
      paint(fit(line.text, width), selected ? t.background : t.text, selected ? t.warn : t.surface, selected),
    );
    for (let index = 0; index < line.tokens.length; index += 1) {
      const token = line.tokens[index]!;
      hitTargets.add({ column: rect.column + 2 + token.columnOffset, row, width: token.width, height: 1 }, {
        type: "control",
        id,
        action: "activate",
        index: token.index,
      });
    }
  }
}

function addInlineStepperHits(rect: Rectangle, row: number): void {
  const placements = apiWorkbenchStepperHitPlacementsInto(
    controlStepperHitPlacements,
    stepper.steps.peek(),
    stepper.activeIndex.peek(),
    rect,
    row,
  );
  for (let index = 0; index < placements.length; index += 1) {
    const placement = placements[index]!;
    hitTargets.add({
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

function renderControlDropdownPopover(frame: string[], rect: Rectangle): void {
  const t = theme();
  fillRect(frame, rect, t.panelSoft);
  write(
    frame,
    rect.row,
    rect.column,
    paint(`┌${"─".repeat(Math.max(0, rect.width - 2))}┐`, t.accent, t.panelSoft, true),
  );
  for (const [index, item] of dropdown.items.peek().entries()) {
    const selected = dropdown.selectedIndex.peek() === index;
    const marker = selected ? "●" : "○";
    const row = rect.row + 1 + index;
    write(
      frame,
      row,
      rect.column,
      paint(
        `│ ${fit(`${marker} ${item}`, rect.width - 4)} │`,
        selected ? contrastText(t.warn, t.background, t.text) : t.text,
        selected ? t.warn : t.panelSoft,
        selected,
      ),
    );
    hitTargets.add({ column: rect.column + 1, row, width: Math.max(0, rect.width - 2), height: 1 }, {
      type: "control",
      id: "dropdown",
      action: "activate",
      index,
    });
  }
  write(
    frame,
    rect.row + rect.height - 1,
    rect.column,
    paint(`└${"─".repeat(Math.max(0, rect.width - 2))}┘`, t.accent, t.panelSoft, true),
  );
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
    if (action === "set" && rect && x !== undefined) setSliderFromPointer(slider, rect, x);
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

function setSliderFromPointer(controller: SliderController, rect: Rectangle, x: number): void {
  const inspection = controller.inspect();
  const local = Math.max(0, Math.min(rect.width - 1, x - rect.column));
  const ratio = rect.width <= 1 ? 0 : local / (rect.width - 1);
  const raw = inspection.min + ratio * (inspection.max - inspection.min);
  const stepped = inspection.min + Math.round((raw - inspection.min) / inspection.step) * inspection.step;
  controller.setValue(stepped);
}

function handleControlsKey(event: { key: string; ctrl?: boolean; meta?: boolean; shift?: boolean }): void {
  if (activeControl.peek() === "input") input.handleKeyPress(event as never);
  else if (activeControl.peek() === "textbox") textBox.handleKeyPress(event as never);
  else if (event.key === "up") activeControl.value = controlAt(-1);
  else if (event.key === "down") activeControl.value = controlAt(1);
  else if (event.key === "left") applyControlHit(activeControl.peek(), "previous");
  else if (event.key === "right") applyControlHit(activeControl.peek(), "next");
  else if (event.key === "space" || event.key === "return") applyControlHit(activeControl.peek(), "activate");
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
  return nextApiWorkbenchControlId(activeControl.peek(), delta, { wrap: true }) ?? "button";
}

function controlAtEdge(delta: number): ControlId | undefined {
  return nextApiWorkbenchControlId(activeControl.peek(), delta);
}
function isTextControlActive(): boolean {
  return active.peek() === "controls" && (activeControl.peek() === "input" || activeControl.peek() === "textbox");
}
function write(frame: string[], row: number, column: number, value: string): void {
  writeStringFrameRow(frame, cols(), row, column, value);
}

function fit(value: string, width: number): string {
  return fitCellText(value, width);
}
function fillRect(frame: string[], rect: Rectangle, bg: string): void {
  fillStringFrameRect(frame, cols(), rect, paint(" ".repeat(Math.max(0, rect.width)), theme().text, bg));
}

function drawFrame(frame: string[], rect: Rectangle, title: string, selected: boolean): void {
  const border = selected ? theme().accent : theme().borderStrong;
  const bg = selected ? theme().panelSoft : theme().panel;
  write(frame, rect.row, rect.column, paint(`┌${"─".repeat(Math.max(0, rect.width - 2))}┐`, border, bg, selected));
  for (let row = rect.row + 1; row < rect.row + rect.height - 1; row += 1) {
    write(frame, row, rect.column, paint("│", border, bg, selected));
    write(frame, row, rect.column + rect.width - 1, paint("│", border, bg, selected));
  }
  write(
    frame,
    rect.row + rect.height - 1,
    rect.column,
    paint(`└${"─".repeat(Math.max(0, rect.width - 2))}┘`, border, bg, selected),
  );
  write(
    frame,
    rect.row,
    rect.column + 2,
    paint(` ${title.toUpperCase()} `, theme().background, selected ? theme().accent : theme().border, true),
  );
}

function buttonText(label: string, compact = false): string {
  return formatButtonText(label, { compact });
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
  const text = buttonText(label, options.compact);
  const width = Math.max(0, Math.min(textWidth(text), options.maxWidth ?? textWidth(text)));
  if (width <= 0) return 0;
  const style = buttonPaintOptions(options.state ?? "base", options.tone ?? "default");
  write(frame, row, column, paint(fit(text, width), style.fg, style.bg, style.bold));
  return width;
}

function buttonPaintOptions(
  state: "base" | "active" | "disabled" = "base",
  tone: ButtonTone = "default",
): { fg: string; bg: string; bold: boolean } {
  return workbenchButtonPaintOptions(theme(), contrastText, state, tone);
}

function paint(value: string, fg = theme().text, bg = theme().background, bold = false): string {
  return makeStyle({ fg, bg, bold })(value);
}
function findHit(x: number, y: number): HitTarget<Hit> | undefined {
  const target = hitTargets.find(x, y);
  if (target) return target;
  if (!isTouchOptimizedLayout()) return undefined;
  const entries = hitTargets.entries();
  for (let index = entries.length - 1; index >= 0; index -= 1) {
    const expandedTarget = entries[index]!;
    const expanded = expandedTouchHitRect(expandedTarget.rect);
    if (contains(expanded, x, y)) return { ...expandedTarget, rect: expanded };
  }
}

function isTouchOptimizedLayout(): boolean {
  const coarsePointer = globalThis.matchMedia?.("(pointer: coarse)")?.matches ?? false;
  return coarsePointer || cols() < 92 || rowsCount() < 30;
}

function expandedTouchHitRect(rect: Rectangle): Rectangle {
  const minimumWidth = rect.width <= 3 ? 6 : rect.width <= 10 ? Math.max(10, rect.width) : rect.width;
  const minimumHeight = rect.height <= 1 ? 3 : rect.height;
  const growColumns = Math.max(0, minimumWidth - rect.width);
  const growRows = Math.max(0, minimumHeight - rect.height);
  return clipRect(
    {
      column: rect.column - Math.floor(growColumns / 2),
      row: rect.row - Math.floor(growRows / 2),
      width: rect.width + growColumns,
      height: rect.height + growRows,
    },
    { column: 0, row: 0, width: cols(), height: rowsCount() },
  );
}
function hex(value: string): [number, number, number] {
  const color = value.replace("#", "");
  return [
    Number.parseInt(color.slice(0, 2), 16),
    Number.parseInt(color.slice(2, 4), 16),
    Number.parseInt(color.slice(4, 6), 16),
  ];
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
};

function defaultMinimizedState(): Record<PanelId, boolean> {
  return defaultWorkbenchMinimizedState(panelIds);
}

function loadCachedWebWorkspaceState(): WebWorkspaceState {
  try {
    const saved = globalThis.localStorage?.getItem(WORKSPACE_STORAGE_KEY);
    if (!saved) return {};
    return normalizeWebWorkspaceState(JSON.parse(saved) as WebWorkspaceState);
  } catch (error) {
    reportWebStorageDiagnostic("workspace-read", "localStorage", error);
    return {};
  }
}

async function hydrateWebWorkspaceState(): Promise<void> {
  try {
    const stored = await webWorkspaceStore.get("default");
    if (stored) applyWebWorkspaceState(normalizeWebWorkspaceState(stored));
  } catch (error) {
    reportWebStorageDiagnostic("workspace-hydrate", "IndexedDB", error);
  }
}

function applyWebWorkspaceState(state: WebWorkspaceState): void {
  if (state.active) active.value = state.active;
  if (state.maximized !== undefined) maximized.value = state.maximized;
  if (state.minimized) minimized.value = { ...defaultMinimizedState(), ...state.minimized };
  if (state.tileDensity !== undefined) tileDensity.value = Math.max(-3, Math.min(3, Math.floor(state.tileDensity)));
  if (state.terminal) applyWebTerminalWorkspaceSnapshot(state.terminal);
}

function normalizeWebWorkspaceState(value: WebWorkspaceState | null | undefined): WebWorkspaceState {
  const state = normalizeWorkbenchPanelWorkspaceState(value, {
    panelIds,
    defaultActive: "inspector",
    minTileDensity: -3,
    maxTileDensity: 3,
  });
  const terminal = normalizeWebTerminalWorkspaceSnapshot(value?.terminal);
  return terminal ? { ...state, terminal } : state;
}

function persistWebWorkspaceState(): void {
  try {
    const snapshot: WebWorkspaceState = {
      active: active.peek(),
      maximized: maximized.peek(),
      minimized: minimized.peek(),
      tileDensity: tileDensity.peek(),
      terminal: snapshotTerminalWorkspace(webTerminalWorkspace),
    };
    globalThis.localStorage?.setItem(WORKSPACE_STORAGE_KEY, JSON.stringify(snapshot));
    void webWorkspaceStore.set("default", snapshot).catch((error) =>
      reportWebStorageDiagnostic("workspace-persist", "IndexedDB", error)
    );
  } catch (error) {
    reportWebStorageDiagnostic("workspace-persist", "localStorage", error);
  }
}

function normalizeWebTerminalWorkspaceSnapshot(value: unknown): TerminalWorkspaceSnapshot | undefined {
  if (!value || typeof value !== "object") return undefined;
  const candidate = value as Partial<TerminalWorkspaceSnapshot>;
  if (!Array.isArray(candidate.sessions) || candidate.sessions.length === 0) return undefined;
  try {
    return normalizeTerminalWorkspaceSnapshot(candidate as TerminalWorkspaceSnapshot);
  } catch (error) {
    reportWebStorageDiagnostic("terminal-workspace-normalize", "workspace-state", error);
    return undefined;
  }
}

function applyWebTerminalWorkspaceSnapshot(snapshot: TerminalWorkspaceSnapshot): void {
  const restored = normalizeTerminalWorkspaceSnapshot(snapshot);
  webTerminalWorkspace.sessions.value = restored.sessions;
  webTerminalWorkspace.activeId.value = restored.activeId;
  webTerminalWorkspace.layout.value = restored.layout;
  webTerminalScreenKeys.clear();
}

function defaultWebTerminalWorkspaceSnapshot(): Pick<TerminalWorkspaceSnapshot, "activeId" | "sessions" | "layout"> {
  return {
    activeId: "pages-shell",
    sessions: [
      {
        id: "pages-shell",
        title: "Pages Shell",
        template: { id: "pages-shell", title: "Pages Shell", kind: "command", command: "web-shell" },
        backendId: "browser-mock",
        commandLine: "web-shell",
        status: "running",
        running: true,
        columns: 80,
        rows: 12,
        reconnectable: false,
        restartPolicy: "never",
        createdAt: 0,
        updatedAt: 0,
      },
      {
        id: "remote-attach",
        title: "Remote Attach",
        template: {
          id: "remote-attach",
          title: "Remote Attach",
          kind: "attach",
          sessionId: "ws://localhost:8787/terminal",
          reconnectable: true,
        },
        backendId: "remote",
        status: "idle",
        running: false,
        reconnectable: true,
        restartPolicy: "never",
        createdAt: 0,
        updatedAt: 0,
      },
      {
        id: "ci-task",
        title: "CI Task",
        template: { id: "ci-task", title: "CI Task", kind: "deno-task", command: "deno", args: ["task", "health"] },
        backendId: "process-template",
        commandLine: "deno task health",
        status: "idle",
        running: false,
        columns: 100,
        rows: 30,
        reconnectable: false,
        restartPolicy: "on-failure",
        createdAt: 0,
        updatedAt: 0,
      },
    ],
    layout: {},
  };
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
