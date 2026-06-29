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
import {
  ScrollAreaController,
  scrollbarGlyph,
  scrollbarOffsetForPointer,
  scrollbarThumb,
} from "../src/components/scroll_area.ts";
import { SliderController } from "../src/components/slider.ts";
import { renderStatusBar } from "../src/components/statusbar.ts";
import { renderStepper, StepperController } from "../src/components/stepper.ts";
import { TextBoxController, wrapTextBoxLines } from "../src/components/textbox.ts";
import { handleInput } from "../src/input.ts";
import { WindowManagerController } from "../src/layout/mod.ts";
import { Computed, Signal } from "../src/signals/mod.ts";
import { probeCompatibleWebGPUDevice } from "../src/three_ascii/webgpu_compat.ts";
import { Tui } from "../src/tui.ts";
import type { Rectangle } from "../src/types.ts";
import { stripStyles, textWidth } from "../src/utils/strings.ts";
import { grWizardThemePalettes } from "../src/grwizard_themes.ts";
import { createDefaultAsciiOptions, terminalGlyphStyleLabel } from "./ascii_options.ts";
import { demos as neonDemos } from "./neon_theme.ts";
import { makeStyle } from "./styles.ts";
import { requireInteractiveTerminal } from "./terminal_guard.ts";
import { ThreePanelView } from "./three_panel.ts";
import type {
  Accent,
  AsciiOptions,
  RenderContext,
  SlotConfig,
  SourceFrame,
  SystemSnapshot,
  ThreeSceneMode,
  ThreeSceneSignal,
} from "./types.ts";
import { renderVisualization, visualizations } from "./visualizations.ts";

type BuiltInWindowId = "explorer" | "inspector" | "data" | "controls" | "logs" | "three";
type VisualizationWindowId = `viz:${string}`;
type WindowId = BuiltInWindowId | VisualizationWindowId;
const builtInWindowOrder: readonly BuiltInWindowId[] = ["explorer", "inspector", "data", "controls", "logs", "three"];
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
  | { type: "theme"; index: number }
  | { type: "newWindow"; index: number }
  | { type: "modalAction"; index: number }
  | { type: "control"; id: ControlId; action?: ControlHitAction; index?: number }
  | { type: "dataRow"; index: number }
  | { type: "explorerRow"; index: number }
  | { type: "windowVScrollbar"; id: WindowId }
  | { type: "windowHScrollbar"; id: WindowId }
  | { type: "workspaceScrollbar" };
type ControlHitAction = "previous" | "next" | "activate" | "set" | "focus" | "toggle";

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

interface NewWindowOption {
  id: string;
  label: string;
  group: "Monitor" | "Neon" | "Neon 3D";
  description: string;
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
  "ModalController provides centered pop-over content with trapped keyboard focus and action buttons.",
  "ThreePanelView embeds the Acerola three.js ASCII renderer directly inside a managed workbench window.",
  "SliderController and CheckBoxController expose input state without renderer coupling.",
  "Theme selection updates all surfaces through shared semantic tokens.",
  "Window controls demonstrate minimize, maximize, restore, focus, and layout recomposition.",
  "Mouse clicks work on window buttons and theme swatches; keyboard shortcuts mirror command surfaces.",
  "This demo intentionally uses public controllers plus canvas primitives so the composition remains transparent.",
  "Resize the terminal: panels collapse from side-by-side to stacked narrow layouts.",
  "Use [ and ] to tune tile density; use T to cycle themes.",
  "Use Tab or 1-6 to focus windows; use M, F, R for window controls.",
];
const explorerKeys = new Set(["up", "down", "left", "right", "pageup", "pagedown", "home", "end", "space", "return"]);
const neonDemoIds = new Set(neonDemos.map((demo) => demo.id));
const newWindowOptions: NewWindowOption[] = visualizations.map((entry) => ({
  id: entry.id,
  label: entry.name,
  group: entry.id.startsWith("three-") ? "Neon 3D" : neonDemoIds.has(entry.id) ? "Neon" : "Monitor",
  description: entry.description,
}));

requireInteractiveTerminal("deno task api-workbench");

const threeAsciiAvailable = new Signal(await probeCompatibleWebGPUDevice());
const ascii = new Signal<AsciiOptions>({
  ...createDefaultAsciiOptions("sharp"),
  terminalGlyphStyle: "mixed",
  preset: "custom",
});

const tui = new Tui({
  style: makeStyle({ bg: themes[0]!.background }),
  refreshRate: 1000 / 24,
  enableMouse: true,
});

handleInput(tui);
tui.dispatch();

const themeIndex = new Signal(0);
const themeMenuOpen = new Signal(false);
const newWindowMenuOpen = new Signal(false);
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
  ],
});
const commandLog = new Signal<string[]>(["ready: API workbench mounted"], { deepObserve: true });
const dynamicVisualizationWindows = new Signal<Record<VisualizationWindowId, string>>({}, { deepObserve: true });
const lineSignals: Signal<string>[] = [];
let hitTargets: Array<{ rect: Rectangle; action: HitAction }> = [];
let lastVisibleWindow: WindowId | null = null;
let lastWorkspaceWidth = 0;
let lastWorkspaceHeight = 0;
let dropdownOverlay: DropdownOverlay | null = null;
type Frame = string[][];
interface DropdownOverlay {
  kind: "control" | "theme" | "newWindow";
  coordinate: "workspace" | "screen";
  rect: Rectangle;
  items: string[];
  selectedIndex?: number;
}

const menu = new MenuBarController({
  items: [
    { id: "file", label: "File" },
    { id: "new", label: "New" },
    { id: "view", label: "View" },
    { id: "layout", label: "Layout" },
    { id: "theme", label: "Theme" },
    { id: "help", label: "Help" },
  ],
  onSelect: (item) => {
    if (item.id === "new") {
      themeMenuOpen.value = false;
      newWindowMenuOpen.value = !newWindowMenuOpen.peek();
      pushLog(`${newWindowMenuOpen.peek() ? "open" : "close"} new window menu`);
      return;
    }
    if (item.id === "theme") {
      newWindowMenuOpen.value = false;
      themeMenuOpen.value = !themeMenuOpen.peek();
      pushLog(`${themeMenuOpen.peek() ? "open" : "close"} theme menu`);
      return;
    }
    if (item.id === "help") {
      themeMenuOpen.value = false;
      newWindowMenuOpen.value = false;
      openHelpModal();
      return;
    }
    themeMenuOpen.value = false;
    newWindowMenuOpen.value = false;
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
const threeScene = new Computed<{ mode: ThreeSceneMode; signal: ThreeSceneSignal } | null>(() =>
  modal.openState.value || minimized.value.three || !threeAsciiAvailable.value ? null : {
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
const threePanel = new ThreePanelView({
  canvas: tui.canvas,
  rectangle: threeBodyRect,
  scene: threeScene,
  ascii,
  enabled: threeAsciiAvailable,
  zIndex: 3,
  frameInterval: 1000 / 18,
});

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
  if (event.ctrl && event.key === "c") return;
  if (modal.openState.peek()) {
    modal.handleKeyPress(event);
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
  if (event.key === "q") tui.emit("destroy");
  else if (event.key === "tab" && activeWindow.peek() === "controls") focusNextControl(event.shift ? -1 : 1);
  else if (event.key === "tab") focusNext();
  else if (event.key === "1") focus("explorer");
  else if (event.key === "2") focus("inspector");
  else if (event.key === "3") focus("data");
  else if (event.key === "4") focus("controls");
  else if (event.key === "5") focus("logs");
  else if (event.key === "6") focus("three");
  else if (activeWindow.peek() === "explorer" && explorerKeys.has(event.key)) {
    explorer.handleKeyPress(event, Math.max(1, currentHeight() - 8));
  } else if (event.key === "m") minimize(activeWindow.peek());
  else if (event.key === "f" || event.key === "return") toggleMaximize(activeWindow.peek());
  else if (event.key === "r" || event.key === "escape") restoreAll();
  else if (event.key === "t") setTheme(themeIndex.peek() + 1);
  else if (event.key === "[") adjustTileDensity(-1);
  else if (event.key === "]") adjustTileDensity(1);
  else if (event.key === "pageup") scrollWindow(activeWindow.peek(), 0, -windowScrollPage(activeWindow.peek()));
  else if (event.key === "pagedown") scrollWindow(activeWindow.peek(), 0, windowScrollPage(activeWindow.peek()));
  else if (event.key === "home") windowScrolls.get(activeWindow.peek())?.scrollTo(0, 0);
  else if (event.key === "end") {
    const scroll = windowScrolls.get(activeWindow.peek());
    scroll?.scrollTo(scroll.offset.peek().columns, scroll.maxOffset().rows);
  } else if (event.key === "left" && event.shift) scrollWindow(activeWindow.peek(), -4, 0);
  else if (event.key === "right" && event.shift) scrollWindow(activeWindow.peek(), 4, 0);
  else if (activeWindow.peek() === "controls") handleControlsKey(event);
  else if (event.key === "+" || event.key === "=") density.increment();
  else if (event.key === "-" || event.key === "_") density.decrement();
  else if (event.key === "x" || event.key === "space") livePreview.toggle();
  else if (event.key === "left" || event.key === "right") menu.handleKeyPress(event);
  else if (activeWindow.peek() === "data") table.handleKeyPress(event);
  else if (event.key === "up") scrollWindow(activeWindow.peek(), 0, -1);
  else if (event.key === "down") scrollWindow(activeWindow.peek(), 0, 1);
  draw();
});

tui.on("mousePress", (event) => {
  if (event.release) return;
  const hit = findHit(event.x, event.y);
  if (hit) applyHit(hit, event.x, event.y);
  draw();
});

tui.on("mouseScroll", (event) => {
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
  dynamicVisualizationWindows.dispose();
  commandInput.dispose();
  workflowStepper.dispose();
  progress.dispose();
  notes.dispose();
  explorer.dispose();
  table.dispose();
  threePanel.dispose();
  threeScene.dispose();
  threeBodyRect.dispose();
  ascii.dispose();
  threeAsciiAvailable.dispose();
});

tui.run();
syncTerminalSize();
draw();

function draw(): void {
  syncTerminalSize();
  ensureLineObjects();
  const width = currentWidth();
  const height = currentHeight();
  hitTargets = [];
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

function renderHeader(frame: Frame): void {
  const width = currentWidth();
  const t = theme();
  fillRow(frame, 0, t.backgroundSoft);
  fillRow(frame, 1, t.panel);
  write(frame, 0, 0, paint(" API WORKBENCH ", { fg: t.background, bg: t.accent, bold: true }));
  const menuStart = 17;
  const closeLabel = width >= 20 ? " [x] " : "";
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
    write(frame, 0, closeColumn, paint(closeLabel, { fg: t.background, bg: t.danger, bold: true }));
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
    const labels = newWindowOptions.map((entry) => `${entry.group}: ${entry.label}`);
    const menuRect = menuItemRect(
      menuStart,
      "new",
      Math.max(28, ...labels.map((label) => textWidth(label) + 6)),
      Math.min(labels.length + 2, Math.max(8, currentHeight() - 3)),
    );
    dropdownOverlay = {
      kind: "newWindow",
      coordinate: "screen",
      rect: menuRect,
      items: labels,
    };
  }
  const help = width >= 132
    ? "Tab focus  M min  F max  R restore  [/] tiles  T theme  Q quit"
    : width >= 96
    ? "Tab  M/F/R  T theme  Q quit"
    : width >= 56
    ? "Tab focus  T theme  Q quit"
    : "T theme  Q quit";
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
  if (bounds.width < 2 || bounds.height < 1) return;
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
    renderWindow(virtual, max, layout.bounds);
    updateThreeBodyRect(max === "three" ? layout.bounds : undefined, bounds, offset);
    translateWorkspaceHits(hitStart, bounds.row - offset, bounds);
    blitWorkspace(frame, virtual, bounds, offset, layout.bounds.width);
    renderWorkspaceScrollbar(frame, bounds, layout.contentHeight, offset);
    renderWindowTabs(frame);
    return;
  }

  const visible = windowIds().filter((id) => !minimized.peek()[id]);
  if (visible.length === 0) {
    setThreeBodyRect({ column: 0, row: 0, width: 0, height: 0 });
    write(frame, bounds.row + 1, 2, paint(emptyWorkspaceMessage(), { fg: theme().warn }));
    renderShelf(frame);
    return;
  }

  let renderedThree = false;
  for (const id of visible) {
    const rect = layout.rects.get(id);
    if (rect) {
      renderWindow(virtual, id, rect);
      if (id === "three") {
        renderedThree = true;
        updateThreeBodyRect(rect, bounds, offset);
      }
    }
  }
  if (!renderedThree) setThreeBodyRect({ column: 0, row: 0, width: 0, height: 0 });
  translateWorkspaceHits(hitStart, bounds.row - offset, bounds);
  blitWorkspace(frame, virtual, bounds, offset, layout.bounds.width);
  renderWorkspaceScrollbar(frame, bounds, layout.contentHeight, offset);
  renderShelf(frame);
}

function renderWindow(frame: Frame, id: WindowId, rect: Rectangle): void {
  if (rect.width < 8 || rect.height < 4 || minimized.peek()[id]) return;
  const t = theme();
  const active = activeWindow.peek() === id;
  addHit(rect, { type: "focus", id });
  drawFrame(frame, rect, windowTitle(id), active);
  const buttonRow = rect.row;
  const closeX = rect.column + rect.width - 4;
  const restoreX = rect.column + rect.width - 8;
  const maxX = rect.column + rect.width - 12;
  const minX = rect.column + rect.width - 16;
  if (rect.width >= 22) {
    write(frame, buttonRow, minX, paint("[-]", { fg: t.background, bg: t.warn, bold: true }));
    write(frame, buttonRow, maxX, paint("[□]", { fg: t.background, bg: t.good, bold: true }));
    write(frame, buttonRow, restoreX, paint("[↺]", { fg: t.background, bg: t.border, bold: true }));
    write(frame, buttonRow, closeX, paint("[x]", { fg: t.background, bg: t.danger, bold: true }));
    addHit({ column: minX, row: buttonRow, width: 3, height: 1 }, { type: "minimize", id });
    addHit({ column: maxX, row: buttonRow, width: 3, height: 1 }, { type: "maximize", id });
    addHit({ column: restoreX, row: buttonRow, width: 3, height: 1 }, { type: "restore", id });
    addHit({ column: closeX, row: buttonRow, width: 3, height: 1 }, { type: "close", id });
  }

  const inner = inset(rect, 1);
  const scroll = windowScroll(id);
  const contentSize = windowContentSize(id, inner);
  const viewport = windowContentViewport(inner, contentSize.width, contentSize.height);
  scroll.setViewportSize(viewport.width, viewport.height);
  scroll.setContentSize(contentSize.width, contentSize.height);
  fillRect(frame, inner, t.surface);
  const contentFrame: Frame = Array.from({ length: contentSize.height }, () => []);
  fillRect(contentFrame, { column: 0, row: 0, width: contentSize.width, height: contentSize.height }, t.surface);
  const contentHitStart = hitTargets.length;
  renderWindowContent(contentFrame, id, { column: 0, row: 0, width: contentSize.width, height: contentSize.height });
  translateDropdownOverlayForWindow(id, viewport, scroll.offset.peek());
  translateContentHits(contentHitStart, viewport, scroll.offset.peek());
  blitWindowContent(frame, contentFrame, viewport, scroll.offset.peek());
  renderWindowScrollbars(frame, id, inner, viewport, contentSize);
}

function renderWindowContent(frame: Frame, id: WindowId, rect: Rectangle): void {
  if (id === "explorer") renderExplorer(frame, rect);
  else if (id === "inspector") renderInspector(frame, rect);
  else if (id === "data") renderData(frame, rect);
  else if (id === "controls") renderControls(frame, rect);
  else if (id === "logs") renderLogs(frame, rect);
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
  const rendered = renderVisualization(buildVisualizationContext(visualizationId, rect));
  const accent = accentColor(rendered.accent);
  const lines = rendered.body.split("\n");
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
}

function renderThree(frame: Frame, rect: Rectangle): void {
  const t = theme();
  const mode = terminalGlyphStyleLabel(ascii.peek().terminalGlyphStyle).toUpperCase();
  if (threeAsciiAvailable.peek()) {
    writeRows(frame, rect, [
      {
        text: ` ACEROLA THREE.JS ASCII · ${mode} · STUDIO GEOMETRY `,
        fg: t.buttonActiveText,
        bg: t.buttonActiveBg,
        bold: true,
      },
      { text: "torus knot  sphere  block  floor plane", fg: t.soft, bg: t.surface },
      { text: "", bg: t.surface },
    ]);
    return;
  }

  const fallback = renderThreeFallback(rect.width, rect.height, t);
  writeRows(frame, rect, fallback);
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
  const lines = [
    { text: " Composable API surfaces ", fg: t.background, bg: t.accent, bold: true },
    { text: "explorer  FileExplorerController", fg: t.good, bg: t.surface },
    { text: "menu      MenuBarController", fg: t.good, bg: t.surface },
    { text: "layout    WindowManagerController", fg: t.good, bg: t.surface },
    { text: "viewport  ScrollAreaController", fg: t.good, bg: t.surface },
    { text: "data      DataTableController", fg: t.good, bg: t.surface },
    { text: "controls  SliderController / CheckBoxController", fg: t.good, bg: t.surface },
    { text: "three     ThreePanelView + Acerola ASCII", fg: t.good, bg: t.surface },
    { text: `theme     ${themes[themeIndex.peek()]!.label}`, fg: t.warn, bg: t.surface, bold: true },
    { text: "", bg: t.surface },
    { text: " Recent actions ", fg: t.background, bg: t.border, bold: true },
    ...commandLog.peek().slice(-Math.max(0, rect.height - 11)).map((line) => ({
      text: `• ${line}`,
      fg: t.text,
      bg: t.panelSoft,
    })),
  ];
  writeRows(frame, rect, lines);
}

function renderData(frame: Frame, rect: Rectangle): void {
  const t = theme();
  const view = table.view.peek();
  table.setPageSize(Math.max(1, rect.height - 4));
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
    {
      text: `page ${view.page + 1}/${view.pageCount}  selected ${view.selectedKey ?? "-"}  arrows/page keys navigate`,
      fg: t.muted,
      bg: t.panelSoft,
    },
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
    const line = `${active && !options.indent ? ">" : " "} ${options.indent ? "  " : ""}${value}`;
    const style = options.button ? buttonPaintOptions(t, active ? "active" : "base") : {
      fg: active ? t.background : t.text,
      bg: active ? t.warn : t.surface,
      bold: active,
    };
    write(
      frame,
      row,
      rect.column,
      paint(fit(line, rect.width), style),
    );
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
    `[ Run Action ] presses=${actionButton.pressCount.peek()}`,
    { button: true },
  );
  writeControl(
    "genericButton",
    `[ Generic Button ] presses=${genericButton.pressCount.peek()}`,
    { button: true },
  );
  writeControl(
    "modal",
    `[ Open Modal ] state=${modal.openState.peek() ? "open" : "closed"}`,
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
  writeSection("combo", `Theme combo  ${themeCombo.expanded.peek() ? "▾" : "▸"} ${themeCombo.label()}`);
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
  let column = 1;
  const entries = windowManager.inspect().windows
    .filter((entry) => entry.minimized && !entry.closed)
    .map((entry) => entry.id as WindowId);
  if (entries.length === 0) return;
  write(frame, row, column, paint("minimized ", { fg: theme().muted, bg: theme().backgroundSoft }));
  column += 10;
  for (const id of entries) {
    const label = `[${windowTitle(id)}]`;
    write(frame, row, column, paint(label, { fg: theme().background, bg: theme().border, bold: true }));
    addHit({ column, row, width: textWidth(label), height: 1 }, { type: "restore", id });
    column += textWidth(label) + 1;
  }
}

function renderWindowTabs(frame: Frame): void {
  const row = currentHeight() - 2;
  const t = theme();
  fillRow(frame, row, t.backgroundSoft);
  write(frame, row, 1, paint("windows ", { fg: t.muted, bg: t.backgroundSoft }));
  let column = 9;
  for (const tab of windowManager.inspect().tabs) {
    const id = tab.id as WindowId;
    if (column >= currentWidth() - 1) break;
    const selected = tab.fullscreen;
    const hidden = tab.minimized;
    const marker = selected ? "●" : hidden ? "○" : " ";
    const label = `[${marker} ${windowTitle(id)}]`;
    const width = Math.min(textWidth(label), Math.max(0, currentWidth() - column));
    if (width <= 0) break;
    write(
      frame,
      row,
      column,
      paint(fit(label, width), {
        fg: selected ? t.background : hidden ? t.muted : t.text,
        bg: selected ? t.accent : hidden ? t.panel : t.panelSoft,
        bold: selected,
      }),
    );
    addHit({ column, row, width, height: 1 }, { type: "windowTab", id });
    column += width + 1;
  }
}

function renderStatus(frame: Frame): void {
  const t = theme();
  const width = currentWidth();
  const densityLabel = tileDensity.peek() === 0 ? "balanced" : tileDensity.peek() > 0 ? "dense" : "wide";
  const left = `focus ${windowTitle(activeWindow.peek())} | ${theme().label} | tiles ${densityLabel}`;
  const right = "New menu adds widgets  [/] tile density  arrows/scrollbars  mouse";
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
  if (!modal.openState.peek()) return;

  const t = theme();
  const screen = { column: 0, row: 0, width: currentWidth(), height: currentHeight() };
  addHit(screen, { type: "modalAction", index: -1 });

  const inspection = modal.inspect();
  const width = Math.min(Math.max(38, currentWidth() - 8), 72);
  const contentHeight = modalContentHeight(inspection, width);
  const height = Math.min(Math.max(9, contentHeight), Math.max(7, currentHeight() - 6));
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
  drawFrame(frame, rect, inspection.title, true);

  const inner = inset(rect, 1);
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
    const label = action.disabled
      ? `( ${action.label} )`
      : index === inspection.selectedActionIndex
      ? `[ ${action.label} ]`
      : `  ${action.label}  `;
    const width = textWidth(label);
    if (cursor + width > inner.column + inner.width) break;
    write(
      frame,
      actionRow,
      cursor,
      paint(
        label,
        action.destructive ? dangerButtonPaintOptions(t, action.disabled) : buttonPaintOptions(
          t,
          action.disabled ? "disabled" : index === inspection.selectedActionIndex ? "active" : "base",
        ),
      ),
    );
    addHit({ column: cursor, row: actionRow, width, height: 1 }, { type: "modalAction", index });
    cursor += width + 1;
  }
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
    return { width: Math.max(baseWidth, 104), height: Math.max(baseHeight, 42) };
  }
  if (id === "logs") {
    return { width: Math.max(baseWidth, maxTextWidth(docs) + 2), height: Math.max(baseHeight, docs.length) };
  }
  if (id === "data") {
    const width = columns.reduce((sum, column) => sum + (column.width ?? 12) + 2, 8);
    return { width: Math.max(baseWidth, width), height: Math.max(baseHeight, rows.length + 4) };
  }
  if (id === "three") {
    return { width: Math.max(baseWidth, 76), height: Math.max(baseHeight, 24) };
  }
  if (isVisualizationWindow(id)) {
    return { width: Math.max(baseWidth, 86), height: Math.max(baseHeight, 28) };
  }
  return { width: Math.max(baseWidth, 82), height: Math.max(baseHeight, 16) };
}

function buildVisualizationContext(visualizationId: string, rect: Rectangle): RenderContext {
  const option = visualizationOption(visualizationId);
  const phase = Math.floor(performance.now() / 80);
  const slot: SlotConfig = {
    id: "cpu",
    name: option?.label ?? visualizationId,
    visualizationId,
    inputSourceIds: ["workbench:primary", "workbench:secondary", "workbench:noise"],
    cycleEnabled: false,
    cycleIntervalMs: 10000,
    ascii: ascii.peek(),
  };
  return {
    slot,
    system: syntheticWorkbenchSystem(phase, option?.group ?? "Monitor"),
    sources: syntheticWorkbenchSources(visualizationId, option?.group ?? "Monitor", phase),
    phase,
    width: Math.max(8, rect.width),
    height: Math.max(4, rect.height - 3),
  };
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
  return {
    timestamp: Date.now(),
    hostname: "workbench",
    osRelease: "demo",
    uptimeSeconds: phase,
    loadavg: [hot * 2.4, warm * 1.8, Math.max(hot, warm)],
    cpuOverall: hot * 100,
    cpuCores: Array.from({ length: 8 }, (_, index) => ({
      label: `cpu${index}`,
      usage: unitWave(phase + index * 7, 0.06, index * 0.13) * 100,
    })),
    cpuHistory: Array.from({ length: 72 }, (_, index) => unitWave(phase + index, 0.07, 0.03) * 100),
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
    })),
    alerts: hot > 0.92 ? [{ severity: "warning", title: "WORKBENCH", detail: "LOAD SPIKE" }] : [],
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

function windowContentViewport(inner: Rectangle, contentWidth: number, contentHeight: number): Rectangle {
  let width = inner.width;
  let height = inner.height;
  let needsVertical = contentHeight > height;
  let needsHorizontal = contentWidth > width;
  if (needsVertical) width = Math.max(0, width - 1);
  if (needsHorizontal) height = Math.max(0, height - 1);
  needsVertical = contentHeight > height;
  needsHorizontal = contentWidth > width;
  if (needsVertical && width === inner.width) width = Math.max(0, width - 1);
  if (needsHorizontal && height === inner.height) height = Math.max(0, height - 1);
  return { column: inner.column, row: inner.row, width, height };
}

function translateContentHits(
  startIndex: number,
  viewport: Rectangle,
  offset: { columns: number; rows: number },
): void {
  for (let index = hitTargets.length - 1; index >= startIndex; index -= 1) {
    const target = hitTargets[index]!;
    const translated = {
      ...target.rect,
      column: viewport.column + target.rect.column - offset.columns,
      row: viewport.row + target.rect.row - offset.rows,
    };
    if (!intersects(translated, viewport)) {
      hitTargets.splice(index, 1);
      continue;
    }
    target.rect = clipRect(translated, viewport);
  }
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
  const maxOffset = scroll.maxOffset();
  if (maxOffset.rows > 0 && viewport.height > 0) {
    const column = inner.column + inner.width - 1;
    const thumb = scrollbarThumb(contentSize.height, viewport.height, scroll.offset.peek().rows);
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
  if (maxOffset.columns > 0 && viewport.width > 0) {
    const row = inner.row + inner.height - 1;
    const thumb = scrollbarThumb(contentSize.width, viewport.width, scroll.offset.peek().columns);
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

function updateThreeBodyRect(rect: Rectangle | undefined, viewport: Rectangle, offset: number): void {
  if (!rect || modal.openState.peek() || screenDropdownOpen() || minimized.peek().three) {
    setThreeBodyRect({ column: 0, row: 0, width: 0, height: 0 });
    return;
  }
  const inner = inset(rect, 1);
  const contentSize = windowContentSize("three", inner);
  const bodyViewport = windowContentViewport(inner, contentSize.width, contentSize.height);
  const scroll = windowScroll("three").offset.peek();
  const sceneRect = { column: 0, row: 3, width: contentSize.width, height: Math.max(0, contentSize.height - 3) };
  const translated = {
    ...sceneRect,
    column: bodyViewport.column + sceneRect.column - scroll.columns,
    row: bodyViewport.row + viewport.row - offset + sceneRect.row - scroll.rows,
  };
  const clipped = clipRect(translated, { ...bodyViewport, row: bodyViewport.row + viewport.row - offset });
  setThreeBodyRect(clipped.width >= 8 && clipped.height >= 6 ? clipped : { column: 0, row: 0, width: 0, height: 0 });
}

function setThreeBodyRect(rect: Rectangle): void {
  const current = threeBodyRect.peek();
  if (
    current.column === rect.column && current.row === rect.row && current.width === rect.width &&
    current.height === rect.height
  ) {
    return;
  }
  threeBodyRect.value = rect;
}

function screenDropdownOpen(): boolean {
  return themeMenuOpen.peek() || newWindowMenuOpen.peek();
}

function translateWorkspaceHits(startIndex: number, rowDelta: number, clip: Rectangle): void {
  for (let index = hitTargets.length - 1; index >= startIndex; index -= 1) {
    const target = hitTargets[index]!;
    const translated = { ...target.rect, row: target.rect.row + rowDelta };
    if (!intersects(translated, clip)) {
      hitTargets.splice(index, 1);
      continue;
    }
    target.rect = clipRect(translated, clip);
  }
}

function blitWorkspace(frame: Frame, virtual: Frame, bounds: Rectangle, offset: number, width: number): void {
  for (let row = 0; row < bounds.height; row += 1) {
    write(frame, bounds.row + row, bounds.column, renderFrameRow(virtual[offset + row] ?? [], width));
  }
}

function renderWorkspaceScrollbar(frame: Frame, bounds: Rectangle, contentHeight: number, offset: number): void {
  if (contentHeight <= bounds.height || bounds.width < 2) return;
  const t = theme();
  const column = bounds.column + bounds.width - 1;
  const thumb = scrollbarThumb(contentHeight, bounds.height, offset);
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

  const clipped = clipRect(rect, clip);
  if (clipped.width < 8 || clipped.height < 1) return;

  fillRect(frame, clipped, t.panelSoft);
  const top = `┌${"─".repeat(Math.max(0, rect.width - 2))}┐`;
  const bottom = `└${"─".repeat(Math.max(0, rect.width - 2))}┘`;
  writeClippedOverlayRow(frame, clip, rect.row, rect.column, top, { fg: t.accent, bg: t.panelSoft, bold: true });
  for (const [index, item] of overlay.items.entries()) {
    const selected = overlay.selectedIndex === index;
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
          ? { type: "theme", index }
          : overlay.kind === "newWindow"
          ? { type: "newWindow", index }
          : { type: "control", id: "dropdown", action: "activate", index },
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

  if (layout.contentHeight <= viewportHeight) {
    workspaceScroll.scrollTo(0, 0);
    return;
  }

  const offset = workspaceScroll.offset.peek().rows;
  const top = activeRect.row;
  const bottom = activeRect.row + activeRect.height;
  if (top < offset) {
    workspaceScroll.scrollTo(0, top);
  } else if (bottom > offset + viewportHeight) {
    workspaceScroll.scrollTo(0, bottom - viewportHeight);
  }
}

function scrollWindow(id: WindowId, columns: number, rows: number): void {
  windowScroll(id).scrollBy(columns, rows);
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
    action.type === "windowHScrollbar"
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

function setTheme(index: number): void {
  themeIndex.value = (index + themes.length) % themes.length;
  themeMenuOpen.value = false;
  newWindowMenuOpen.value = false;
  pushLog(`theme ${theme().label}`);
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

function openHelpModal(): void {
  modal.open({
    title: "Workbench Help",
    tone: "info",
    body: [
      "Keyboard: Tab moves focus through windows. Inside Controls, Tab moves through controls and leaves the pane after the last control. Shift+Tab moves backward.",
      "Use 1-6 to focus Explorer, Inspector, Data Table, Controls, Logs, or Three ASCII. Use M to minimize, F or Enter to maximize, R or Escape to restore windows.",
      "When a window is fullscreen, use the bottom tabs or 1-6 to switch between fullscreen windows.",
      "Use arrows in the Data Table and Logs. In Controls, arrows adjust sliders, radio groups, combo boxes, steppers, and dropdown selections.",
      "Mouse: click windows to focus them, click rows to select them, click controls to change values, drag or click scrollbars to move through overflow content.",
      "Use the New menu to add Monitor, Neon Exodus, and Neon 3D widget windows to the workspace.",
      "Use the Theme menu to switch palettes. Click the [x] button in the top-right menu bar or press Q to quit.",
    ],
    actions: [
      { id: "dismiss", label: "Dismiss", default: true },
      { id: "controls", label: "Focus Controls" },
    ],
  });
  pushLog("help opened");
}

function applyModalAction(actionId: string): void {
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

  modal.close();
  pushLog(`modal ${actionId}`);
}

function applyHit(target: { rect: Rectangle; action: HitAction }, x: number, y: number): void {
  const action = target.action;
  if (action.type === "menu") {
    menu.setActive(action.index);
    menu.selectActive();
  } else if (action.type === "quit") tui.emit("destroy");
  else if (action.type === "windowTab") selectWindowTab(action.id);
  else if (action.type === "focus") focus(action.id);
  else if (action.type === "minimize") minimize(action.id);
  else if (action.type === "maximize") toggleMaximize(action.id);
  else if (action.type === "close") closeWindow(action.id);
  else if (action.type === "restore") {
    windowManager.restore(action.id);
    syncWindowSignalsFromManager();
    pushLog(`restore ${windowTitle(action.id)}`);
  } else if (action.type === "control") {
    applyControlHit(action.id, action.action ?? "activate", target.rect, x, action.index);
  } else if (action.type === "modalAction") {
    if (action.index >= 0) modal.activateAction(action.index);
  } else if (action.type === "dataRow") selectDataRow(action.index);
  else if (action.type === "explorerRow") selectExplorerRow(action.index);
  else if (action.type === "newWindow") addVisualizationWindow(newWindowOptions[action.index]);
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

function closeWindow(id: WindowId): void {
  windowManager.close(id);
  syncWindowSignalsFromManager();
  pushLog(`close ${windowTitle(id)}`);
}

function addVisualizationWindow(option: NewWindowOption | undefined): void {
  if (!option) return;
  const id = visualizationWindowId(option.id);
  newWindowMenuOpen.value = false;
  themeMenuOpen.value = false;
  if (!windowManager.ids({ includeClosed: true }).includes(id)) {
    dynamicVisualizationWindows.value = { ...dynamicVisualizationWindows.peek(), [id]: option.id };
    windowScrolls.set(id, new ScrollAreaController({ showScrollbar: true }));
    windowManager.windows.value = [
      ...windowManager.windows.peek(),
      {
        id,
        title: option.label,
        minWidth: option.group === "Monitor" ? 38 : 42,
        minHeight: option.group === "Monitor" ? 14 : 16,
        closable: true,
        order: windowManager.windows.peek().length,
      },
    ];
  } else {
    windowManager.restore(id);
  }
  focus(id);
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
  if (row < 0 || row >= frame.length || column >= currentWidth()) return;
  const cells = frame[row] ??= [];
  const styledCells = toStyledCells(value);
  for (let index = 0; index < styledCells.length && column + index < currentWidth(); index += 1) {
    cells[column + index] = styledCells[index]!;
  }
}

function fillRow(frame: Frame, row: number, bg: string): void {
  write(frame, row, 0, makeStyle({ bg })(" ".repeat(currentWidth())));
}

function fillRect(frame: Frame, rect: Rectangle, bg: string): void {
  for (let row = rect.row; row < rect.row + rect.height; row += 1) {
    write(frame, row, rect.column, makeStyle({ bg })(" ".repeat(Math.max(0, rect.width))));
  }
}

function renderFrameRow(cells: string[], width: number): string {
  const row: string[] = [];
  for (let column = 0; column < width; column += 1) {
    row.push(cells[column] ?? " ");
  }
  return row.join("");
}

function renderFrameSlice(cells: string[], start: number, width: number): string {
  const row: string[] = [];
  for (let column = 0; column < width; column += 1) {
    row.push(cells[start + column] ?? " ");
  }
  return row.join("");
}

function maxTextWidth(values: readonly string[]): number {
  return values.reduce((max, value) => Math.max(max, textWidth(value)), 0);
}

function toStyledCells(value: string): string[] {
  const cells: string[] = [];
  let style = "";
  for (let index = 0; index < value.length;) {
    if (value.charCodeAt(index) === 0x1b) {
      const match = /^\x1b\[[0-9;]*m/.exec(value.slice(index));
      if (match) {
        const sequence = match[0];
        style = sequence.includes("[0m") ? "" : style + sequence;
        index += sequence.length;
        continue;
      }
    }
    const char = value[index]!;
    cells.push(style ? `${style}${char}\x1b[0m` : char);
    index += char.length;
  }
  return cells;
}

function fit(value: string, width: number): string {
  const visible = textWidth(value);
  if (visible === width) return value;
  if (visible < width) return value + " ".repeat(Math.max(0, width - visible));
  const plain = stripStyles(value);
  return `${plain.slice(0, Math.max(0, width - 1))}…`;
}

function centerText(value: string, width: number): string {
  const cropped = fit(value, width);
  const remaining = Math.max(0, width - textWidth(cropped));
  return `${" ".repeat(Math.floor(remaining / 2))}${cropped}`;
}

function paint(text: string, options: { fg?: string; bg?: string; bold?: boolean } = {}): string {
  return makeStyle({ fg: options.fg ?? theme().text, bg: options.bg, bold: options.bold })(text);
}

function pill(text: string, t = theme()): string {
  return paint(` ${text} `, buttonPaintOptions(t, "active"));
}

function buttonPaintOptions(
  t: ThemeSpec,
  state: "base" | "active" | "disabled" = "base",
): { fg: string; bg: string; bold: boolean } {
  if (state === "disabled") {
    return { fg: t.buttonMutedText, bg: t.buttonMutedBg, bold: false };
  }
  if (state === "active") {
    return { fg: t.buttonActiveText, bg: t.buttonActiveBg, bold: true };
  }
  return { fg: t.buttonText, bg: t.buttonBg, bold: true };
}

function dangerButtonPaintOptions(t: ThemeSpec, disabled?: boolean): { fg: string; bg: string; bold: boolean } {
  if (disabled) return buttonPaintOptions(t, "disabled");
  return { fg: contrastText(t.danger, t.background, t.text), bg: t.danger, bold: true };
}

function contrastText(background: string, dark: string, light: string): string {
  const bg = parseHexColor(background);
  const darkRgb = parseHexColor(dark);
  const lightRgb = parseHexColor(light);
  if (!bg || !darkRgb || !lightRgb) return relativeLuminance(bg ?? [0, 0, 0]) > 0.5 ? dark : light;
  return contrastRatio(bg, lightRgb) >= contrastRatio(bg, darkRgb) ? light : dark;
}

function contrastRatio(left: [number, number, number], right: [number, number, number]): number {
  const leftLum = relativeLuminance(left);
  const rightLum = relativeLuminance(right);
  const brightest = Math.max(leftLum, rightLum);
  const darkest = Math.min(leftLum, rightLum);
  return (brightest + 0.05) / (darkest + 0.05);
}

function relativeLuminance([red, green, blue]: [number, number, number]): number {
  const [r, g, b] = [red, green, blue].map((channel) => {
    const value = channel / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

function parseHexColor(value: string): [number, number, number] | undefined {
  const color = value.trim().replace(/^#/, "");
  if (!/^[\da-f]{6}$/i.test(color)) return undefined;
  return [0, 2, 4].map((index) => Number.parseInt(color.slice(index, index + 2), 16)) as [
    number,
    number,
    number,
  ];
}

function addHit(rect: Rectangle, action: HitAction): void {
  hitTargets.push({ rect, action });
}

function findHit(x: number, y: number): { rect: Rectangle; action: HitAction } | undefined {
  for (let index = hitTargets.length - 1; index >= 0; index -= 1) {
    const target = hitTargets[index]!;
    if (contains(target.rect, x, y)) return target;
  }
}

function contains(rect: Rectangle, x: number, y: number): boolean {
  return x >= rect.column && x < rect.column + rect.width && y >= rect.row && y < rect.row + rect.height;
}

function intersects(left: Rectangle, right: Rectangle): boolean {
  return left.column < right.column + right.width && left.column + left.width > right.column &&
    left.row < right.row + right.height && left.row + left.height > right.row;
}

function clipRect(rect: Rectangle, clip: Rectangle): Rectangle {
  const column = Math.max(rect.column, clip.column);
  const row = Math.max(rect.row, clip.row);
  const right = Math.min(rect.column + rect.width, clip.column + clip.width);
  const bottom = Math.min(rect.row + rect.height, clip.row + clip.height);
  return { column, row, width: Math.max(0, right - column), height: Math.max(0, bottom - row) };
}

function inset(rect: Rectangle, amount: number): Rectangle {
  return {
    column: rect.column + amount,
    row: rect.row + amount,
    width: Math.max(0, rect.width - amount * 2),
    height: Math.max(0, rect.height - amount * 2),
  };
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
    : "Three ASCII";
}

function windowIds(): WindowId[] {
  return windowManager.ids().map((id) => id as WindowId);
}

function isVisualizationWindow(id: WindowId): id is VisualizationWindowId {
  return id.startsWith("viz:");
}

function visualizationWindowId(visualizationId: string): VisualizationWindowId {
  return `viz:${visualizationId.replace(/[^a-z0-9-]/gi, "-").toLowerCase()}` as VisualizationWindowId;
}

function visualizationOption(visualizationId: string | undefined): NewWindowOption | undefined {
  return visualizationId ? newWindowOptions.find((entry) => entry.id === visualizationId) : undefined;
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
