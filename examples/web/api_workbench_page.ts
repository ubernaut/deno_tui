/// <reference lib="dom" />
/// <reference lib="dom.iterable" />
import {
  BoxObject,
  ButtonController,
  buttonText as formatButtonText,
  CheckBoxController,
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
  fitCellText,
  InputController,
  intersects,
  isWorkbenchMenuActivationKey,
  isWorkbenchMenuCloseKey,
  layoutWorkbenchShelf,
  layoutWorkbenchTabs,
  layoutWorkbenchTitlebar,
  MenuBarController,
  modalContentHeight,
  ModalController,
  moveWorkbenchMenuIndex,
  normalizeWorkbenchPanelWorkspaceState,
  ProgressBarController,
  RadioGroupController,
  renderCheckBoxMark,
  renderDataTableHeader,
  renderDataTableRows,
  renderMenuBar,
  renderModalRows,
  renderStatusBar,
  renderStepper,
  ScrollAreaController,
  scrollbarGlyph,
  scrollbarOffsetForPointer,
  Signal,
  SliderController,
  StepperController,
  TerminalScreenController,
  TextBoxController,
  TextObject,
  type TextRectangle,
  textWidth,
  toStyledCells,
  WindowManagerController,
  type WorkbenchPanelWorkspaceState,
  workbenchRevealActiveRowOffset,
  type WorkbenchTitlebarButtonKind,
  wrapTextBoxLines,
} from "../../mod.web.ts";
import { grWizardThemePalettes } from "../../src/grwizard_themes.ts";
import { createHtmlCssLayoutDemo, htmlCssLayoutDemoBoxLabel } from "../../src/markup/demo_fixtures.ts";
import type { Rectangle } from "../../src/types.ts";
import { makeStyle } from "../../app/styles.ts";

type PanelId = "explorer" | "inspector" | "data" | "controls" | "logs" | "three" | "htmlLayout" | "terminal";
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
  | { type: "terminalSession"; id: string }
  | { type: "workspaceScrollbar" };
type ControlHitAction = "previous" | "next" | "activate" | "set" | "focus" | "toggle";
type ButtonTone = "default" | "danger" | "warning" | "success" | "muted";
type MobileAction = "next" | "controls" | "theme" | "help" | "restore" | "wide" | "dense";
type HitTarget = { rect: Rectangle; hit: Hit };

interface DropdownOverlay {
  kind: "theme" | "control";
  rect: Rectangle;
  items: string[];
  selectedIndex?: number;
}

interface ThemeSpec {
  id: string;
  label: string;
  bg: string;
  bgAlt: string;
  panel: string;
  panelAlt: string;
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
  buttonActiveBg: string;
  buttonMutedBg: string;
}

const THEME_STORAGE_KEY = "deno-tui.web-workbench.theme";
const WORKSPACE_STORAGE_KEY = "deno-tui.web-workbench.workspace";

interface Row extends Record<string, unknown> {
  id: string;
  surface: string;
  state: string;
  ms: number;
}

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

const themes: ThemeSpec[] = grWizardThemePalettes.map((palette) => ({
  id: palette.name,
  label: palette.label,
  bg: palette.bg,
  bgAlt: palette.bgAlt,
  panel: palette.panel,
  panelAlt: palette.panelAlt,
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
  buttonActiveBg: palette.accent,
  buttonMutedBg: palette.panelAlt,
}));
const rows: Row[] = [
  { id: "explorer", surface: "FileExplorer", state: "browsing", ms: 3 },
  { id: "menu", surface: "MenuBar", state: "active", ms: 2 },
  { id: "tiles", surface: "Tile Layout", state: "balanced", ms: 5 },
  { id: "layout", surface: "HTML/CSS Layout", state: "solver", ms: 7 },
  { id: "table", surface: "DataTable", state: "sorted", ms: 8 },
  { id: "scroll", surface: "ScrollArea", state: "tracking", ms: 3 },
  { id: "theme", surface: "Theme", state: "bound", ms: 4 },
  { id: "terminal", surface: "Remote Terminal", state: "browser-safe", ms: 5 },
  { id: "mouse", surface: "Pointer", state: "captured", ms: 1 },
  { id: "three", surface: "Three ASCII", state: "preview", ms: 6 },
];
const docs = [
  "Click panel buttons to minimize, maximize, or restore.",
  "Open the Theme menu for the same dropdown-style theme selector as the terminal workbench.",
  "Use Tab, 1-8, M, F, R, T, H, Q, [ and ] from the keyboard.",
  "The browser host maps pointer cells to the same mouse events as the terminal.",
  "Touch: compact command buttons, larger hit targets, and drag scrolling are enabled on small/coarse-pointer screens.",
  "Resize the browser: the terminal grid recalculates from CSS dimensions.",
  "The web workbench includes Explorer, Data, Controls, Logs, and a browser-safe Three ASCII preview pane.",
  "HTML/CSS Layout previews parseTuiMarkup, CSS cascade, flex wrap, and absolute positioning in a browser-hosted window.",
  "Terminal shows browser-safe session tabs backed by TerminalWorkspaceController and TerminalScreenController.",
  "The demo uses public controllers and canvas primitives from mod.web.ts.",
];
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
const initialWorkspace = loadCachedWebWorkspaceState();
const themeIndex = new Signal(initialThemeIndex());
const active = new Signal<PanelId>(initialWorkspace.active ?? "inspector");
const maximized = new Signal<PanelId | null>(initialWorkspace.maximized ?? null);
const minimized = new Signal<Record<PanelId, boolean>>(
  { ...defaultMinimizedState(), ...initialWorkspace.minimized },
  { deepObserve: true },
);
const themeMenuOpen = new Signal(false);
const tileDensity = new Signal(Math.max(-3, Math.min(3, Math.floor(initialWorkspace.tileDensity ?? 0))));
const lineSignals: Signal<string>[] = [];
const log = new Signal<string[]>(["ready: web api workbench mounted"], { deepObserve: true });
const webTerminalScreen = new TerminalScreenController({ columns: 80, rows: 12, scrollbackLimit: 64 });
const webTerminalWorkspace = createTerminalWorkspaceController({
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
});
let webTerminalScreenKey = "";
let hitTargets: HitTarget[] = [];
let lastVisiblePanel: PanelId | null = null;
let lastWorkspaceWidth = 0;
let lastWorkspaceHeight = 0;
let dropdownOverlay: DropdownOverlay | null = null;
let pointerDrag: {
  x: number;
  y: number;
  workspaceRows: number;
  logRows: number;
  target?: HitTarget;
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
      themeMenuOpen.value = !themeMenuOpen.peek();
      push(`${themeMenuOpen.peek() ? "open" : "close"} theme menu`);
      return;
    }
    themeMenuOpen.value = false;
    if (item.id === "help") {
      openHelpModal();
      return;
    }
    push(`menu ${item.label}`);
  },
});
const workspaceScroll = new ScrollAreaController({ showScrollbar: true });
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
  items: themes.map((entry) => entry.label),
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
  columns: [
    { id: "surface", label: "Surface", width: 14, sortable: true },
    { id: "state", label: "State", width: 10, sortable: true },
    { id: "ms", label: "ms", width: 4, sortable: true, format: (value) => `${value}` },
  ],
  rowKey: (row) => row.id,
  initialState: { pageSize: 4, sort: { columnId: "ms", direction: "asc" } },
});

new BoxObject({
  canvas: host.canvas,
  rectangle: new Computed(() => ({ column: 0, row: 0, width: cols(), height: rowsCount() })),
  filler: " ",
  style: new Computed(() => createAnsiStyle({ background: hex(theme().bg) })),
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
  if (key === "tab" && active.peek() === "controls") focusNextControl();
  else if (key === "tab") focusNext();
  else if (focusPanelByNumber(key)) return draw();
  else if (key === "h" || key === "?") openHelpModal();
  else if (key === "q") openQuitModal();
  else if (key === "m") minimize(active.peek());
  else if (key === "f" || key === "return") toggleMax(active.peek());
  else if (key === "r" || key === "escape") restore();
  else if (key === "t") themeMenuOpen.value = !themeMenuOpen.peek();
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
  if (active.peek() === "logs") logScroll.scrollBy(0, event.scroll);
  else workspaceScroll.scrollBy(0, event.scroll);
  draw();
});

host.start();
draw();
const timer = setInterval(() => {
  if (live.checked.peek()) {
    table.rows.value = rows.map((row, index) => ({ ...row, ms: ((row.ms + index + slider.value.peek()) % 18) + 1 }));
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
  themeMenuOpen.dispose();
  tileDensity.dispose();
  host.destroy();
});

function draw(): void {
  hitTargets = [];
  dropdownOverlay = null;
  const width = cols();
  const height = rowsCount();
  const frame = Array.from({ length: height }, () => paint(" ".repeat(width), theme().text, theme().bg));
  write(frame, 0, 0, paint(" ".repeat(width), theme().text, theme().bgAlt));
  write(frame, 1, 0, paint(" ".repeat(width), theme().text, theme().panel));
  write(frame, 0, 1, paint(` API WORKBENCH `, theme().bg, theme().accent, true));
  const closeLabel = buttonText("x", true);
  const closeWidth = textWidth(closeLabel);
  const menuWidth = Math.max(0, width - 18 - closeWidth);
  renderMenuHits(17, 0, menuWidth);
  write(
    frame,
    0,
    17,
    paint(fit(renderMenuBar(menu.items.peek(), menu.activeIndex.peek()), menuWidth), theme().text, theme().bgAlt),
  );
  if (width >= 22) {
    writeButton(frame, 0, width - closeWidth, "x", { compact: true, tone: "danger" });
    hitTargets.push({
      rect: { column: width - closeWidth, row: 0, width: closeWidth, height: 1 },
      hit: { type: "quit" },
    });
  }
  if (themeMenuOpen.peek()) {
    dropdownOverlay = {
      kind: "theme",
      rect: menuItemRect(
        17,
        "theme",
        Math.max(22, ...themes.map((entry) => textWidth(entry.label) + 6)),
        themes.length + 2,
      ),
      items: themes.map((entry) => entry.label),
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
  workspaceScroll.setViewportSize(layout.bounds.width, body.height);
  workspaceScroll.setContentSize(layout.bounds.width, layout.contentHeight);
  ensureActivePanelVisible(layout, body.height);
  const offset = workspaceScroll.offset.peek().rows;
  const virtual = Array.from(
    { length: Math.max(body.height, layout.contentHeight) },
    () => paint(" ".repeat(layout.bounds.width), theme().text, theme().bgAlt),
  );
  fillRect(virtual, layout.bounds, theme().bgAlt);
  const hitStart = hitTargets.length;
  if (maximized.peek()) {
    renderPanel(virtual, maximized.peek()!, layout.bounds);
  } else {
    const visible = panelIds.filter((id) => !minimized.peek()[id]);
    if (visible.length === 0) {
      write(virtual, 1, 2, paint("All panels minimized. Press R or click restore."));
      hitTargets.push({ rect: { ...layout.bounds, row: 0 }, hit: { type: "restore" } });
    } else {
      for (const id of visible) {
        const rect = layout.rects.get(id);
        if (rect) renderPanel(virtual, id, rect);
      }
    }
  }
  translateWorkspaceHits(hitStart, body.column, body.row - offset, body);
  blitWorkspace(frame, virtual, body, offset, layout.bounds.width);
  renderWorkspaceScrollbar(frame, body);
  maximized.peek() ? renderWindowTabs(frame) : renderShelf(frame);
  renderDropdownOverlay(frame);
  renderModalOverlay(frame);
  const densityLabel = tileDensity.peek() === 0 ? "balanced" : tileDensity.peek() > 0 ? "dense" : "wide";
  frame[height - 1] = fit(
    paint(
      renderStatusBar(
        `focus ${active.peek()} | ${theme().label} | tiles ${densityLabel}`,
        "1-8 focus  T theme  H help  Q quit  click controls",
        width,
      ),
      theme().text,
      theme().panelAlt,
    ),
    width,
  );
  for (let row = 0; row < height; row++) lineSignals[row]!.value = fit(frame[row] ?? "", width);
  for (let row = height; row < lineSignals.length; row++) lineSignals[row]!.value = "";
}

function renderShelf(frame: string[]): void {
  const row = rowsCount() - 2;
  const entries = (Object.entries(minimized.peek()) as Array<[PanelId, boolean]>)
    .filter(([, value]) => value)
    .map(([id]) => ({ id, title: panelTitle(id) }));
  if (entries.length === 0) return;
  const layout = layoutWorkbenchShelf({ row, column: 2, width: Math.max(0, cols() - 2), entries });
  write(frame, row, layout.prefixRect.column, paint(layout.prefix, theme().muted, theme().bgAlt));
  for (const button of layout.buttons) {
    writeButton(frame, row, button.rect.column, button.label, { tone: "muted", maxWidth: button.rect.width });
    hitTargets.push({ rect: button.rect, hit: { type: "restore", id: button.id } });
  }
}

function renderMenuHits(column: number, row: number, width: number): void {
  let cursor = column;
  for (const [index, item] of menu.items.peek().entries()) {
    const token = index === menu.activeIndex.peek() ? `[${item.label}]` : item.label;
    const tokenWidth = textWidth(token);
    if (cursor + tokenWidth > column + width) break;
    hitTargets.push({ rect: { column: cursor, row, width: tokenWidth, height: 1 }, hit: { type: "menu", index } });
    cursor += tokenWidth + 1;
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
    hitTargets.push({
      rect: { column, row, width, height: 1 },
      hit: { type: "mobileAction", action: entry.action },
    });
    column += width + 1;
  }
}

function menuItemRect(menuStart: number, itemId: string, preferredWidth: number, preferredHeight: number): Rectangle {
  let cursor = menuStart;
  for (const [index, item] of menu.items.peek().entries()) {
    const token = index === menu.activeIndex.peek() ? `[${item.label}]` : item.label;
    if (item.id === itemId) {
      return {
        column: cursor,
        row: 1,
        width: Math.min(preferredWidth, Math.max(20, cols() - cursor)),
        height: preferredHeight,
      };
    }
    cursor += textWidth(token) + 1;
  }
  return { column: menuStart, row: 1, width: Math.min(preferredWidth, cols()), height: preferredHeight };
}

function renderWindowTabs(frame: string[]): void {
  const row = rowsCount() - 2;
  const layout = layoutWorkbenchTabs({
    row,
    column: 2,
    width: Math.max(0, cols() - 2),
    tabs: panelIds.map((id) => ({
      id,
      title: panelTitle(id),
      selected: maximized.peek() === id,
      hidden: minimized.peek()[id],
    })),
  });
  write(frame, row, layout.prefixRect.column, paint(layout.prefix, theme().muted, theme().bgAlt));
  for (const button of layout.buttons) {
    writeButton(frame, row, button.rect.column, button.label, {
      state: button.selected ? "active" : "base",
      tone: button.hidden ? "muted" : "default",
      maxWidth: button.rect.width,
    });
    hitTargets.push({ rect: button.rect, hit: { type: "restore", id: button.id } });
  }
}

function renderPanel(frame: string[], id: PanelId, rect: Rectangle): void {
  if (rect.width < 10 || rect.height < 4) return;
  hitTargets.push({ rect, hit: { type: "focus", id } });
  const selected = active.peek() === id;
  fillRect(frame, rect, selected ? theme().panelAlt : theme().panel);
  const border = selected ? theme().accent : theme().borderStrong;
  const title = panelTitle(id).toUpperCase();
  const top = `┌ ${title} ${"─".repeat(Math.max(0, rect.width - title.length - 24))}             ┐`;
  write(
    frame,
    rect.row,
    rect.column,
    paint(fit(top, rect.width), border, selected ? theme().panelAlt : theme().panel, selected),
  );
  for (const button of layoutWorkbenchTitlebar({ rect, title: panelTitle(id) }).buttons) {
    if (button.kind === "config") continue;
    writeButton(frame, button.rect.row, button.rect.column, button.label, {
      compact: button.compact,
      tone: button.tone,
    });
    hitTargets.push({ rect: button.rect, hit: panelTitlebarHit(id, button.kind) });
  }
  for (let r = 1; r < rect.height - 1; r++) {
    write(
      frame,
      rect.row + r,
      rect.column,
      paint(`│${" ".repeat(rect.width - 2)}│`, border, selected ? theme().panelAlt : theme().panel),
    );
  }
  write(
    frame,
    rect.row + rect.height - 1,
    rect.column,
    paint(`└${"─".repeat(rect.width - 2)}┘`, border, selected ? theme().panelAlt : theme().panel),
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
    lines.forEach((line, index) => {
      const style = panelLineStyle(id, index);
      write(frame, inner.row + index, inner.column, paint(fit(line, inner.width), style.fg, style.bg, style.bold));
    });
    if (id === "data") {
      for (let index = 0; index < Math.min(table.view.peek().rows.length, Math.max(0, inner.height - 1)); index += 1) {
        hitTargets.push({
          rect: { column: inner.column, row: inner.row + 1 + index, width: inner.width, height: 1 },
          hit: { type: "dataRow", index },
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
  return id === "explorer"
    ? "Explorer"
    : id === "data"
    ? "Data Table"
    : id === "three"
    ? "Three ASCII"
    : id === "htmlLayout"
    ? "HTML/CSS Layout"
    : id === "terminal"
    ? "Terminal"
    : id[0]!.toUpperCase() + id.slice(1);
}

function shortPanelTitle(id: PanelId): string {
  return id === "htmlLayout" ? "Layout" : id === "inspector" ? "Inspect" : panelTitle(id);
}

function renderLogs(frame: string[], rect: Rectangle): void {
  const lines = [...docs, ...log.peek()];
  logScroll.setViewportSize(rect.width, rect.height);
  logScroll.setContentSize(rect.width, lines.length);
  const offset = logScroll.offset.peek().rows;
  const overflow = logScroll.inspectOverflow();
  const bodyWidth = Math.max(0, rect.width - 1);
  lines.slice(offset, offset + rect.height).forEach((line, index) => {
    write(frame, rect.row + index, rect.column, paint(fit(line, bodyWidth), theme().text, theme().surface));
  });
  if (!overflow.rows.scrollbarVisible || rect.width < 1) return;
  const column = rect.column + rect.width - 1;
  const thumb = overflow.rows.thumb;
  hitTargets.push({ rect: { column, row: rect.row, width: 1, height: rect.height }, hit: { type: "logScrollbar" } });
  for (let row = 0; row < rect.height; row += 1) {
    write(frame, rect.row + row, column, paint(scrollbarGlyph(row, thumb), theme().accent, theme().surface, true));
  }
}

function renderExplorer(frame: string[], rect: Rectangle): void {
  const visible = explorer.tree.visibleRows();
  const selectedIndex = explorer.tree.selectedIndex.peek();
  visible.slice(0, rect.height).forEach((row, offset) => {
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
          ? contrastText(theme().warn, theme().bg, theme().text)
          : node.kind === "directory"
          ? theme().good
          : theme().text,
        selected ? theme().warn : theme().surface,
        selected || node.kind === "directory",
      ),
    );
    hitTargets.push({
      rect: { column: rect.column, row: rect.row + offset, width: rect.width, height: 1 },
      hit: { type: "explorerRow", index: row.index },
    });
  });
}

function renderThreePreview(frame: string[], rect: Rectangle): void {
  const phase = Math.floor(performance.now() / 90);
  const mode = ["BLOCKS", "GLYPHS", "MIXED"][Math.abs(tileDensity.peek()) % 3] ?? "MIXED";
  const rows = [
    ` ACEROLA THREE ASCII · ${mode} · WEB SAFE PREVIEW `,
    "Full WebGPU renderer is mounted below this workbench on the Pages build.",
    "Use the standalone Three demo for live WebGPU; this pane mirrors controls and state.",
    "",
    ...asciiOrb(rect.width, Math.max(3, rect.height - 6), phase),
    "",
    `preset mixed-best  glyph ${mode.toLowerCase()}  density ${tileDensity.peek()}  theme ${theme().label}`,
  ].slice(0, rect.height);
  rows.forEach((line, index) => {
    const header = index === 0;
    const accent = index % 3 === 0 ? theme().accent : index % 3 === 1 ? theme().good : theme().warn;
    write(
      frame,
      rect.row + index,
      rect.column,
      paint(
        fit(line, rect.width),
        header ? contrastText(theme().accent, theme().bg, theme().text) : accent,
        header ? theme().accent : theme().surface,
        header || index > 3,
      ),
    );
  });
}

function asciiOrb(width: number, height: number, phase: number): string[] {
  const columns = Math.max(8, width);
  const rows = Math.max(3, height);
  const glyphs = " .:-=+*#%@";
  return Array.from({ length: rows }, (_, row) => {
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
  const boxes = result.layout.boxes
    .filter((box) => box.visible)
    .sort((left, right) => left.zIndex - right.zIndex || boxPaintOrder(left) - boxPaintOrder(right));

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
      paint(fit(rows[index]!, rect.width), index === 0 ? t.accent : t.soft, t.panelAlt, index === 0),
    );
  }
}

function renderHtmlCssLayoutBox(frame: string[], box: ComputedLayoutBox, bounds: Rectangle, t: ThemeSpec): void {
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
  write(frame, content.row, content.column, paint(fit(label, content.width), style.fg, style.bg, style.bold));
  if (content.height > 1 && box.text) {
    write(frame, content.row + 1, content.column, paint(fit(box.text, content.width), t.text, style.bg));
  }
  if (content.height > 2 && (box.id.startsWith("metric-") || box.id.startsWith("grid-"))) {
    const detail = `${box.rect.width}x${box.rect.height} content ${box.contentRect.width}x${box.contentRect.height}`;
    write(frame, content.row + 2, content.column, paint(fit(detail, content.width), t.muted, style.bg));
  }
}

function htmlCssLayoutBoxStyle(
  box: ComputedLayoutBox,
  t: ThemeSpec,
): { fg: string; bg: string; border: string; bold?: boolean } {
  if (box.id === "layout-toolbar") {
    return { fg: contrastText(t.accentDeep, t.bg, t.text), bg: t.accentDeep, border: t.accent, bold: true };
  }
  if (box.id === "layout-stage") return { fg: t.text, bg: t.panelAlt, border: t.borderStrong, bold: true };
  if (box.id === "layout-grid") return { fg: t.text, bg: t.surface, border: t.accent, bold: true };
  if (box.id === "grid-shell") {
    return { fg: contrastText(t.buttonActiveBg, t.bg, t.text), bg: t.buttonActiveBg, border: t.accent, bold: true };
  }
  if (box.id === "grid-worker") {
    return { fg: contrastText(t.warn, t.bg, t.text), bg: t.warn, border: t.danger, bold: true };
  }
  if (box.id.startsWith("grid-")) return { fg: t.text, bg: t.panel, border: t.accent };
  if (box.id === "layout-badge") {
    return { fg: contrastText(t.warn, t.bg, t.text), bg: t.warn, border: t.danger, bold: true };
  }
  if (box.id === "layout-footer") return { fg: t.muted, bg: t.panel, border: t.border };
  if (box.id === "metric-cpu") {
    return { fg: contrastText(t.buttonActiveBg, t.bg, t.text), bg: t.buttonActiveBg, border: t.accent, bold: true };
  }
  if (box.id.startsWith("metric-")) return { fg: t.text, bg: t.panel, border: t.accent };
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
  syncWebTerminalScreen(screenRect.width, screenRect.height);

  const inspection = webTerminalScreen.inspect();
  const workspace = webTerminalWorkspace.inspect();
  const headerRows = [
    "REMOTE TERMINAL / BROWSER SHELL MODEL",
    `active ${
      workspace.active?.title ?? "none"
    }  screen ${inspection.columns}x${inspection.rows}  cursor ${inspection.cursor.column},${inspection.cursor.row}  sessions ${workspace.count}`,
  ];
  headerRows.slice(0, Math.min(2, rect.height)).forEach((line, index) => {
    const bg = index === 0 ? t.accentDeep : t.panelAlt;
    const fg = index === 0 ? contrastText(t.accentDeep, t.bg, t.text) : index === 1 ? t.warn : t.soft;
    write(frame, rect.row + index, rect.column, paint(fit(line, rect.width), fg, bg, index === 0));
  });
  renderTerminalSessionTabs(frame, { column: rect.column, row: rect.row + 2, width: rect.width, height: 1 });

  fillRect(frame, screenRect, t.bg);
  const rows = webTerminalScreen.textRows();
  rows.slice(0, screenRect.height).forEach((line, index) => {
    write(frame, screenRect.row + index, screenRect.column, paint(fit(line, screenRect.width), t.text, t.bg));
  });
  const cursor = webTerminalScreen.cursor;
  if (cursor.row < screenRect.height && cursor.column < screenRect.width) {
    write(frame, screenRect.row + cursor.row, screenRect.column + cursor.column, paint(" ", t.bg, t.accent, true));
  }

  const footerRow = rect.row + rect.height - 1;
  if (footerRow >= screenRect.row) {
    const footer =
      "GitHub Pages uses this safe mock; hosted apps attach a PTY/process backend over the remote protocol.";
    write(frame, footerRow, rect.column, paint(fit(footer, rect.width), t.muted, t.surface));
  }
}

function renderTerminalSessionTabs(frame: string[], rect: Rectangle): void {
  if (rect.height <= 0 || rect.width <= 0) return;
  const workspace = webTerminalWorkspace.inspect();
  let column = rect.column;
  fillRect(frame, rect, theme().panelAlt);
  for (const session of workspace.sessions) {
    const activeSession = workspace.activeId === session.id;
    const label = `${activeSession ? "●" : "○"} ${session.title}`;
    const width = Math.min(rect.column + rect.width - column, Math.max(8, textWidth(label) + 2));
    if (width <= 0) break;
    write(
      frame,
      rect.row,
      column,
      paint(
        fit(` ${label}`, width),
        activeSession ? contrastText(theme().accent, theme().bg, theme().text) : theme().text,
        activeSession ? theme().accent : theme().panelAlt,
        activeSession,
      ),
    );
    hitTargets.push({
      rect: { column, row: rect.row, width, height: 1 },
      hit: { type: "terminalSession", id: session.id },
    });
    column += width;
    if (column >= rect.column + rect.width) break;
  }
}

function syncWebTerminalScreen(width: number, height: number): void {
  const columns = Math.max(20, Math.floor(width));
  const rows = Math.max(3, Math.floor(height));
  const activeSession = webTerminalWorkspace.active;
  const key = `${columns}x${rows}:${theme().id}:${activeSession?.id ?? "none"}`;
  if (key === webTerminalScreenKey) return;
  webTerminalScreenKey = key;
  webTerminalScreen.resize(columns, rows);
  webTerminalScreen.clear();
  const transcript = activeSession?.id === "remote-attach"
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
    : activeSession?.id === "ci-task"
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
  webTerminalScreen.write(transcript.join("\r\n"));
}

function panelLines(id: PanelId, height: number): string[] {
  const source = id === "data"
    ? [
      renderDataTableHeader(table.columns.peek(), table.state.peek().sort),
      ...renderDataTableRows(table.view.peek().rows, table.columns.peek(), table.view.peek().selectedIndex),
    ]
    : id === "controls"
    ? []
    : id === "logs"
    ? [...log.peek()].slice(-Math.max(1, height))
    : ["API Workbench Web", ...docs];
  return source.slice(0, height);
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

function applyHit(target: HitTarget, x: number, y: number): void {
  const hit = target.hit;
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
    webTerminalScreenKey = "";
    active.value = "terminal";
    push(`terminal session ${hit.id}`);
  } else if (hit.type === "workspaceScrollbar") {
    workspaceScroll.scrollTo(
      0,
      scrollbarOffsetForPointer(workspaceScroll.contentHeight.peek(), target.rect.height, y - target.rect.row),
    );
  } else setTheme(hit.index);
}

function applyMobileAction(action: MobileAction): void {
  if (action === "next") {
    themeMenuOpen.value = false;
    focusNext();
  } else if (action === "controls") {
    themeMenuOpen.value = false;
    focus("controls");
  } else if (action === "theme") {
    themeMenuOpen.value = !themeMenuOpen.peek();
    push(`${themeMenuOpen.peek() ? "open" : "close"} theme menu`);
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
  target: HitTarget | undefined,
): boolean {
  if (!event.drag || !pointerDrag) return false;
  const deltaColumns = pointerDrag.x - event.x;
  const deltaRows = pointerDrag.y - event.y;
  const moved = Math.abs(deltaRows) >= 1 || Math.abs(deltaColumns) >= 2 ||
    Math.abs(event.movementY ?? 0) >= 8 || Math.abs(event.movementX ?? 0) >= 12;
  if (!moved) return false;

  if (target?.hit.type === "control" && target.hit.id === "slider") {
    applyHit(target, event.x, event.y);
    pointerDrag.moved = true;
    return true;
  }

  const origin = pointerDrag.target?.hit;
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
  if (minimized.peek()[id]) minimized.value[id] = false;
  active.value = id;
  push(`focus ${id}`);
}
function focusNext(): void {
  const ids = panelIds.filter((id) => !minimized.peek()[id]);
  if (ids.length === 0) return;
  focus(ids[(ids.indexOf(active.peek()) + 1) % ids.length]!);
}
function minimize(id: PanelId): void {
  minimized.value[id] = true;
  if (maximized.peek() === id) maximized.value = null;
  push(`minimize ${id}`);
}
function closePanel(id: PanelId): void {
  minimized.value[id] = true;
  if (maximized.peek() === id) maximized.value = null;
  const next = panelIds.find((panel) => !minimized.peek()[panel]);
  if (next) active.value = next;
  push(`close ${id}`);
}
function toggleMax(id: PanelId): void {
  maximized.value = maximized.peek() === id ? null : id;
  push(`${maximized.peek() ? "maximize" : "restore"} ${id}`);
}
function restorePanel(id: PanelId): void {
  minimized.value[id] = false;
  maximized.value = null;
  focus(id);
}
function restore(): void {
  maximized.value = null;
  minimized.value = defaultMinimizedState();
  push("restore all");
}
function setTheme(index: number): void {
  themeIndex.value = ((index % themes.length) + themes.length) % themes.length;
  themeMenuOpen.value = false;
  push(`theme ${theme().label}`);
}

function handleThemeMenuKey(event: { key: string; shift?: boolean }): void {
  if (isWorkbenchMenuCloseKey(event.key)) {
    themeMenuOpen.value = false;
    return;
  }
  themeIndex.value = moveWorkbenchMenuIndex(themeIndex.peek(), themes.length, event);
  if (isWorkbenchMenuActivationKey(event.key)) setTheme(themeIndex.peek());
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
  const sortable = table.columns.peek().filter((column) => column.sortable !== false);
  if (sortable.length === 0) return;
  const current = table.state.peek().sort?.columnId;
  const index = Math.max(0, sortable.findIndex((column) => column.id === current));
  const next = sortable[(index + delta + sortable.length) % sortable.length]!;
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
  tileDensity.value = Math.max(-3, Math.min(3, tileDensity.peek() + delta));
  push(`tile density ${tileDensity.peek()}`);
}

function workspaceLayout(bounds: Rectangle): {
  bounds: Rectangle;
  contentHeight: number;
  rects: Map<PanelId, Rectangle>;
} {
  const rects = new Map<PanelId, Rectangle>();
  const densityOffset = tileDensity.peek() * 4;
  const fullscreenId = maximized.peek() ?? undefined;
  const manager = new WindowManagerController({
    activeId: active.peek(),
    fullscreenId,
    windows: panelIds.map((id, order) => ({
      id,
      title: id,
      order,
      state: minimized.peek()[id] && id !== fullscreenId ? "minimized" : "normal",
      minWidth: 26,
      minHeight: 10,
    })),
  });

  const layout = manager.layout({
    bounds,
    tileOptions: {
      minTileWidth: Math.max(26, 38 - densityOffset),
      minTileHeight: 10,
      maxColumns: bounds.width >= 172 ? 4 : 3,
      targetAspectRatio: 2.25 + tileDensity.peek() * 0.12,
      allowVerticalOverflow: true,
      gap: 1,
    },
  });
  for (const entry of layout.visible) {
    if (entry.rect) rects.set(entry.id as PanelId, entry.rect);
  }
  manager.dispose();
  return { bounds, contentHeight: Math.max(bounds.height, layout.contentHeight), rects };
}

function translateWorkspaceHits(startIndex: number, columnDelta: number, rowDelta: number, clip: Rectangle): void {
  for (let index = hitTargets.length - 1; index >= startIndex; index -= 1) {
    const target = hitTargets[index]!;
    const translated = { ...target.rect, column: target.rect.column + columnDelta, row: target.rect.row + rowDelta };
    if (!intersects(translated, clip)) {
      hitTargets.splice(index, 1);
      continue;
    }
    target.rect = clipRect(translated, clip);
  }
}

function blitWorkspace(frame: string[], virtual: string[], bounds: Rectangle, offset: number, width: number): void {
  for (let row = 0; row < bounds.height; row += 1) {
    write(frame, bounds.row + row, bounds.column, fit(virtual[offset + row] ?? "", width));
  }
}

function renderWorkspaceScrollbar(frame: string[], bounds: Rectangle): void {
  const overflow = workspaceScroll.inspectOverflow();
  if (!overflow.rows.scrollbarVisible || bounds.width < 2) return;
  const column = bounds.column + bounds.width - 1;
  const thumb = overflow.rows.thumb;
  hitTargets.push({
    rect: { column, row: bounds.row, width: 1, height: bounds.height },
    hit: { type: "workspaceScrollbar" },
  });
  for (let row = 0; row < bounds.height; row += 1) {
    write(frame, bounds.row + row, column, paint(scrollbarGlyph(row, thumb), theme().accent, theme().bgAlt, true));
  }
}

function renderDropdownOverlay(frame: string[]): void {
  const overlay = dropdownOverlay;
  if (!overlay || overlay.items.length === 0) return;
  const rect = clipRect(overlay.rect, { column: 0, row: 0, width: cols(), height: rowsCount() });
  if (rect.width < 8 || rect.height < 1) return;
  fillRect(frame, rect, theme().panelAlt);
  write(
    frame,
    rect.row,
    rect.column,
    paint(`┌${"─".repeat(Math.max(0, rect.width - 2))}┐`, theme().accent, theme().panelAlt, true),
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
        selected ? contrastText(theme().warn, theme().bg, theme().text) : theme().text,
        selected ? theme().warn : theme().panelAlt,
        selected,
      ),
    );
    hitTargets.push({
      rect: { column: rect.column + 1, row, width: Math.max(0, rect.width - 2), height: 1 },
      hit: { type: "theme", index },
    });
  }
  write(
    frame,
    rect.row + rect.height - 1,
    rect.column,
    paint(`└${"─".repeat(Math.max(0, rect.width - 2))}┘`, theme().accent, theme().panelAlt, true),
  );
}

function renderModalOverlay(frame: string[]): void {
  if (!modal.openState.peek()) return;
  hitTargets.push({
    rect: { column: 0, row: 0, width: cols(), height: rowsCount() },
    hit: { type: "modalAction", index: -1 },
  });
  const inspection = modal.inspect();
  const width = Math.min(Math.max(38, cols() - 8), 74);
  const contentHeight = modalContentHeight(inspection, width);
  const height = Math.min(Math.max(9, contentHeight), Math.max(7, rowsCount() - 6));
  const rect = {
    column: Math.max(0, Math.floor((cols() - width) / 2)),
    row: Math.max(1, Math.floor((rowsCount() - height) / 2)),
    width,
    height,
  };
  const shadow = clipRect({ column: rect.column + 2, row: rect.row + 1, width: rect.width, height: rect.height }, {
    column: 0,
    row: 0,
    width: cols(),
    height: rowsCount(),
  });
  if (shadow.width > 0 && shadow.height > 0) fillRect(frame, shadow, theme().bg);
  fillRect(frame, rect, theme().panelAlt);
  drawFrame(frame, rect, inspection.title, true);
  const inner = { column: rect.column + 1, row: rect.row + 1, width: rect.width - 2, height: rect.height - 2 };
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
        actionRow ? theme().panel : theme().panelAlt,
        actionRow || titleRow,
      ),
    );
  }
  if (inspection.actions.length === 0 || rows.length === 0) return;
  const actionRow = inner.row + Math.min(rows.length, inner.height) - 1;
  let column = inner.column;
  for (const [index, action] of inspection.actions.entries()) {
    const width = textWidth(buttonText(action.label));
    if (column + width > inner.column + inner.width) break;
    writeButton(frame, actionRow, column, action.label, {
      state: action.disabled ? "disabled" : index === inspection.selectedActionIndex ? "active" : "base",
      tone: action.destructive ? "danger" : "default",
    });
    hitTargets.push({ rect: { column, row: actionRow, width, height: 1 }, hit: { type: "modalAction", index } });
    column += width + 1;
  }
}

function ensureActivePanelVisible(
  layout: { bounds: Rectangle; contentHeight: number; rects: Map<PanelId, Rectangle> },
  viewportHeight: number,
): void {
  const activePanel = active.peek();
  const activeRect = layout.rects.get(activePanel);
  const workspaceChanged = lastWorkspaceWidth !== layout.bounds.width || lastWorkspaceHeight !== viewportHeight;
  const activeChanged = lastVisiblePanel !== activePanel;
  if (!activeRect || (!activeChanged && !workspaceChanged)) return;

  lastVisiblePanel = activePanel;
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

function panelLineStyle(id: PanelId, index: number): { fg: string; bg: string; bold?: boolean } {
  const t = theme();
  if (id === "data" && index === 0) {
    return { fg: contrastText(t.accentDeep, t.bg, t.text), bg: t.accentDeep, bold: true };
  }
  if (id === "data" && index > 0 && index - 1 === table.view.peek().selectedIndex) {
    return { fg: contrastText(t.warn, t.bg, t.text), bg: t.warn, bold: true };
  }
  if (id === "inspector" && (index === 0 || index === 7)) {
    return { fg: t.bg, bg: index === 0 ? t.accent : t.border, bold: true };
  }
  if (id === "logs") return { fg: t.text, bg: t.surface };
  return { fg: t.text, bg: t.surface };
}
function push(message: string): void {
  log.value = [...log.peek(), `${new Date().toLocaleTimeString()} ${message}`].slice(-40);
}

function openWorkbenchModal(): void {
  themeMenuOpen.value = false;
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
  themeMenuOpen.value = false;
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
  themeMenuOpen.value = false;
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
    if (row >= rect.row + rect.height) return;
    const selected = activeControl.peek() === id;
    const prefix = `${selected && !options.indent ? ">" : " "} ${options.indent ? "  " : ""}`;
    if (options.button) {
      const match = /^(\[[^\]]+\])(.*)$/.exec(value);
      const button = match?.[1] ?? value;
      const detail = match?.[2] ?? "";
      write(frame, row, rect.column, paint(" ".repeat(rect.width), t.text, t.surface));
      write(
        frame,
        row,
        rect.column,
        paint(fit(prefix, rect.width), selected ? t.bg : t.text, selected ? t.warn : t.surface, selected),
      );
      let column = rect.column + textWidth(prefix);
      const buttonWidth = Math.max(0, rect.width - textWidth(prefix));
      writeButton(frame, row, column, button.replace(/^\[\s*|\s*\]$/g, ""), {
        state: selected ? "active" : "base",
        maxWidth: buttonWidth,
      });
      column += Math.min(textWidth(button), buttonWidth);
      if (column < rect.column + rect.width) {
        write(
          frame,
          row,
          column,
          paint(fit(detail, rect.column + rect.width - column), selected ? t.warn : t.text, t.surface, selected),
        );
      }
    } else {
      write(
        frame,
        row,
        rect.column,
        paint(
          fit(`${prefix}${value}`, rect.width),
          selected ? t.bg : t.text,
          selected ? t.warn : t.surface,
          selected,
        ),
      );
    }
    hitTargets.push({
      rect: { column: rect.column, row, width: rect.width, height: 1 },
      hit: { type: "control", id, action: options.action ?? "activate", index: options.index },
    });
    if (options.previous) {
      hitTargets.push({
        rect: { column: rect.column, row, width: Math.max(1, Math.floor(rect.width / 2)), height: 1 },
        hit: { type: "control", id, action: "previous" },
      });
    }
    if (options.next) {
      hitTargets.push({
        rect: {
          column: rect.column + Math.floor(rect.width / 2),
          row,
          width: Math.ceil(rect.width / 2),
          height: 1,
        },
        hit: { type: "control", id, action: "next" },
      });
    }
    row += 1;
  };
  const sliderTrack = `${"█".repeat(slider.value.peek())}${"░".repeat(10 - slider.value.peek())}`;
  const progressWidth = Math.max(8, Math.min(18, rect.width - 18));
  const progressFilled = Math.round(progress.ratio() * progressWidth);
  const progressTrack = `${"█".repeat(progressFilled)}${"░".repeat(progressWidth - progressFilled)}`;
  writeControl("button", `${buttonText("Run Action")} presses=${actionButton.pressCount.peek()}`, { button: true });
  writeControl("genericButton", `${buttonText("Generic Button")} presses=${genericButton.pressCount.peek()}`, {
    button: true,
  });
  writeControl("modal", `${buttonText("Open Modal")} state=${modal.openState.peek() ? "open" : "closed"}`, {
    button: true,
  });
  writeControl("slider", `Slider    ${sliderTrack} ${slider.value.peek()}/10`, {
    previous: true,
    next: true,
  });
  hitTargets.push({
    rect: { column: rect.column + 12, row: row - 1, width: 10, height: 1 },
    hit: { type: "control", id: "slider", action: "set" },
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
  row += wrappedOptionRowCount(combo.items.peek(), rect.width - 4);
  writeControl("dropdown", `Dropdown  ${dropdown.expanded.peek() ? "v" : ">"} ${dropdown.label()}`, {
    action: "toggle",
  });
  if (dropdown.expanded.peek()) {
    renderControlDropdownPopover(frame, {
      column: rect.column + 2,
      row,
      width: Math.min(
        Math.max(16, Math.max(...dropdown.items.peek().map((item) => textWidth(item))) + 6),
        Math.max(16, rect.width - 4),
      ),
      height: dropdown.items.peek().length + 2,
    });
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
      paint(fit(`Progress  ${progressTrack} ${progress.value.peek()}%`, rect.width), t.text, t.surface),
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
        selected && offset === 0 ? t.bg : t.text,
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
        selected ? t.bg : t.text,
        selected ? t.warn : t.surface,
        selected,
      ),
    );
  }
  hitTargets.push({
    rect: { column: rect.column, row, width: rect.width, height },
    hit: { type: "control", id: "textbox", action: "focus" },
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
  let row = startRow;
  let line = "";
  const flush = () => {
    if (row >= rect.row + rect.height || line.length === 0) return;
    const selected = activeControl.peek() === id;
    write(
      frame,
      row,
      rect.column + 2,
      paint(fit(line, width), selected ? t.bg : t.text, selected ? t.warn : t.surface, selected),
    );
    line = "";
    row += 1;
  };
  for (const [index, item] of items.entries()) {
    const token = `${index === selectedIndex ? "[" : " "}${item}${index === selectedIndex ? "]" : " "} `;
    if (textWidth(line) + textWidth(token) > width) flush();
    hitTargets.push({
      rect: { column: rect.column + 2 + textWidth(line), row, width: textWidth(token), height: 1 },
      hit: { type: "control", id, action: "activate", index },
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
  const steps = stepper.steps.peek();
  let column = rect.column + 12;
  for (const [index, step] of steps.entries()) {
    const label = step.disabled ? `(${step.label})` : step.completed ? `✓ ${step.label}` : step.label;
    const token = index === stepper.activeIndex.peek() ? `[${label}]` : label;
    const width = textWidth(token);
    if (column + width > rect.column + rect.width) break;
    hitTargets.push({
      rect: { column, row, width, height: 1 },
      hit: { type: "control", id: "stepper", action: "activate", index },
    });
    column += width + 3;
  }
}

function renderControlDropdownPopover(frame: string[], rect: Rectangle): void {
  const t = theme();
  fillRect(frame, rect, t.panelAlt);
  write(
    frame,
    rect.row,
    rect.column,
    paint(`┌${"─".repeat(Math.max(0, rect.width - 2))}┐`, t.accent, t.panelAlt, true),
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
        selected ? contrastText(t.warn, t.bg, t.text) : t.text,
        selected ? t.warn : t.panelAlt,
        selected,
      ),
    );
    hitTargets.push({
      rect: { column: rect.column + 1, row, width: Math.max(0, rect.width - 2), height: 1 },
      hit: { type: "control", id: "dropdown", action: "activate", index },
    });
  }
  write(
    frame,
    rect.row + rect.height - 1,
    rect.column,
    paint(`└${"─".repeat(Math.max(0, rect.width - 2))}┘`, t.accent, t.panelAlt, true),
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

function focusNextControl(): void {
  active.value = "controls";
  activeControl.value = controlAt(1);
  push(`control ${activeControl.peek()} focus`);
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
  return ids[(ids.indexOf(activeControl.peek()) + delta + ids.length) % ids.length]!;
}
function isTextControlActive(): boolean {
  return active.peek() === "controls" && (activeControl.peek() === "input" || activeControl.peek() === "textbox");
}
function write(frame: string[], row: number, column: number, value: string): void {
  if (row < 0 || row >= frame.length || column >= cols()) return;
  const cells = toStyledCells(frame[row] ?? "");
  const valueCells = toStyledCells(value);
  while (cells.length < column) cells.push(" ");
  for (let index = 0; index < valueCells.length && column + index < cols(); index += 1) {
    cells[column + index] = valueCells[index]!;
  }
  frame[row] = cells.slice(0, cols()).join("");
}

function fit(value: string, width: number): string {
  return fitCellText(value, width);
}
function fillRect(frame: string[], rect: Rectangle, bg: string): void {
  for (let row = rect.row; row < rect.row + rect.height; row += 1) {
    write(frame, row, rect.column, paint(" ".repeat(Math.max(0, rect.width)), theme().text, bg));
  }
}

function drawFrame(frame: string[], rect: Rectangle, title: string, selected: boolean): void {
  const border = selected ? theme().accent : theme().borderStrong;
  const bg = selected ? theme().panelAlt : theme().panel;
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
    paint(` ${title.toUpperCase()} `, theme().bg, selected ? theme().accent : theme().border, true),
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
  if (state === "disabled") return { fg: theme().muted, bg: theme().buttonMutedBg, bold: false };
  const toneBg = tone === "danger"
    ? theme().danger
    : tone === "warning"
    ? theme().warn
    : tone === "success"
    ? theme().good
    : tone === "muted"
    ? theme().border
    : undefined;
  if (toneBg) return { fg: contrastText(toneBg, theme().bg, theme().text), bg: toneBg, bold: true };
  const bg = state === "active" ? theme().buttonActiveBg : theme().buttonBg;
  return { fg: contrastText(bg, theme().bg, theme().text), bg, bold: true };
}

function paint(value: string, fg = theme().text, bg = theme().bg, bold = false): string {
  return makeStyle({ fg, bg, bold })(value);
}
function findHit(x: number, y: number): HitTarget | undefined {
  for (let index = hitTargets.length - 1; index >= 0; index -= 1) {
    const target = hitTargets[index]!;
    if (contains(target.rect, x, y)) return target;
  }
  if (!isTouchOptimizedLayout()) return undefined;
  for (let index = hitTargets.length - 1; index >= 0; index -= 1) {
    const target = hitTargets[index]!;
    const expanded = expandedTouchHitRect(target.rect);
    if (contains(expanded, x, y)) return { ...target, rect: expanded };
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
  return [0, 2, 4].map((index) => Number.parseInt(color.slice(index, index + 2), 16)) as [number, number, number];
}
function initialThemeIndex(): number {
  try {
    const saved = globalThis.localStorage?.getItem(THEME_STORAGE_KEY);
    const index = themes.findIndex((entry) => entry.id === saved || entry.label === saved);
    return index >= 0 ? index : 0;
  } catch {
    return 0;
  }
}

type WebWorkspaceState = WorkbenchPanelWorkspaceState<PanelId>;

function defaultMinimizedState(): Record<PanelId, boolean> {
  return defaultWorkbenchMinimizedState(panelIds);
}

function loadCachedWebWorkspaceState(): WebWorkspaceState {
  try {
    const saved = globalThis.localStorage?.getItem(WORKSPACE_STORAGE_KEY);
    if (!saved) return {};
    return normalizeWebWorkspaceState(JSON.parse(saved) as WebWorkspaceState);
  } catch {
    return {};
  }
}

async function hydrateWebWorkspaceState(): Promise<void> {
  try {
    const stored = await webWorkspaceStore.get("default");
    if (stored) applyWebWorkspaceState(normalizeWebWorkspaceState(stored));
  } catch {
    // IndexedDB may be unavailable or blocked. The local boot cache and in-memory signals remain usable.
  }
}

function applyWebWorkspaceState(state: WebWorkspaceState): void {
  if (state.active) active.value = state.active;
  if (state.maximized !== undefined) maximized.value = state.maximized;
  if (state.minimized) minimized.value = { ...defaultMinimizedState(), ...state.minimized };
  if (state.tileDensity !== undefined) tileDensity.value = Math.max(-3, Math.min(3, Math.floor(state.tileDensity)));
}

function normalizeWebWorkspaceState(value: WebWorkspaceState | null | undefined): WebWorkspaceState {
  return normalizeWorkbenchPanelWorkspaceState(value, {
    panelIds,
    defaultActive: "inspector",
    minTileDensity: -3,
    maxTileDensity: 3,
  });
}

function persistWebWorkspaceState(): void {
  try {
    const snapshot: WebWorkspaceState = {
      active: active.peek(),
      maximized: maximized.peek(),
      minimized: minimized.peek(),
      tileDensity: tileDensity.peek(),
    };
    globalThis.localStorage?.setItem(WORKSPACE_STORAGE_KEY, JSON.stringify(snapshot));
    void webWorkspaceStore.set("default", snapshot).catch(() => undefined);
  } catch {
    // Storage may be unavailable in restrictive browser contexts; the workspace still works in memory.
  }
}

function persistThemeIndex(index: number): void {
  try {
    globalThis.localStorage?.setItem(THEME_STORAGE_KEY, themes[index]?.id ?? themes[0]!.id);
  } catch {
    // Storage may be unavailable in restrictive browser contexts; theme switching still works in memory.
  }
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
