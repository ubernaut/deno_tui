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
import { InputController } from "../src/components/input.ts";
import { MenuBarController, renderMenuBar } from "../src/components/menu_bar.ts";
import { ProgressBarController } from "../src/components/progressbar.ts";
import { RadioGroupController } from "../src/components/radio_group.ts";
import { ScrollAreaController, scrollbarGlyph, scrollbarThumb } from "../src/components/scroll_area.ts";
import { SliderController } from "../src/components/slider.ts";
import { renderStatusBar } from "../src/components/statusbar.ts";
import { renderStepper, StepperController } from "../src/components/stepper.ts";
import { TextBoxController } from "../src/components/textbox.ts";
import { handleInput } from "../src/input.ts";
import { SplitPaneController } from "../src/layout/mod.ts";
import { Computed, Signal } from "../src/signals/mod.ts";
import { Tui } from "../src/tui.ts";
import type { Rectangle } from "../src/types.ts";
import { stripStyles, textWidth } from "../src/utils/strings.ts";
import { grWizardThemePalettes } from "../src/grwizard_themes.ts";
import { makeStyle } from "./styles.ts";

type WindowId = "inspector" | "data" | "controls" | "logs";
type ControlId =
  | "button"
  | "genericButton"
  | "slider"
  | "checkbox"
  | "radio"
  | "combo"
  | "dropdown"
  | "input"
  | "stepper"
  | "textbox";
type HitAction =
  | { type: "focus"; id: WindowId }
  | { type: "minimize"; id: WindowId }
  | { type: "maximize"; id: WindowId }
  | { type: "restore"; id: WindowId }
  | { type: "close"; id: WindowId }
  | { type: "theme"; index: number }
  | { type: "control"; id: ControlId; action?: ControlHitAction; index?: number }
  | { type: "dataRow"; index: number };
type ControlHitAction = "previous" | "next" | "activate" | "set" | "focus";

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
}

interface ProcessRow extends Record<string, unknown> {
  id: string;
  surface: string;
  api: string;
  state: string;
  latency: number;
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
}));

const rows: ProcessRow[] = [
  { id: "layout", surface: "Adaptive Grid", api: "layout", state: "ready", latency: 4 },
  { id: "split", surface: "Split Pane", api: "layout", state: "resizing", latency: 6 },
  { id: "menu", surface: "Menu Bar", api: "component", state: "active", latency: 2 },
  { id: "scroll", surface: "Scroll Area", api: "viewport", state: "tracking", latency: 3 },
  { id: "data", surface: "Data Table", api: "data", state: "sorted", latency: 8 },
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
  "MenuBarController owns active menu state and selection.",
  "SplitPaneController resizes panes with preserved ratios.",
  "ScrollAreaController clamps offsets and reports scrollbar thumbs.",
  "DataTableController handles keyed selection, sorting, paging, and filtering.",
  "SliderController and CheckBoxController expose input state without renderer coupling.",
  "Theme selection updates all surfaces through shared semantic tokens.",
  "Window controls demonstrate minimize, maximize, restore, focus, and layout recomposition.",
  "Mouse clicks work on window buttons and theme swatches; keyboard shortcuts mirror command surfaces.",
  "This demo intentionally uses public controllers plus canvas primitives so the composition remains transparent.",
  "Resize the terminal: panels collapse from side-by-side to stacked narrow layouts.",
  "Use [ and ] to resize the main split; use T to cycle themes.",
  "Use Tab or 1-4 to focus windows; use M, F, R for window controls.",
];

const tui = new Tui({
  style: makeStyle({ bg: themes[0]!.background }),
  refreshRate: 1000 / 24,
  enableMouse: true,
});

handleInput(tui);
tui.dispatch();

const themeIndex = new Signal(0);
const activeWindow = new Signal<WindowId>("inspector");
const activeControl = new Signal<ControlId>("button");
const maximized = new Signal<WindowId | null>(null);
const minimized = new Signal<Record<WindowId, boolean>>({
  inspector: false,
  data: false,
  controls: false,
  logs: false,
}, { deepObserve: true });
const commandLog = new Signal<string[]>(["ready: API workbench mounted"], { deepObserve: true });
const lineSignals: Signal<string>[] = [];
let hitTargets: Array<{ rect: Rectangle; action: HitAction }> = [];
type Frame = string[][];

const menu = new MenuBarController({
  items: [
    { id: "file", label: "File" },
    { id: "view", label: "View" },
    { id: "layout", label: "Layout" },
    { id: "theme", label: "Theme" },
    { id: "help", label: "Help" },
  ],
  onSelect: (item) => pushLog(`menu selected: ${item.label}`),
});
const split = new SplitPaneController({
  direction: "row",
  ratio: 0.5,
  minFirst: 32,
  minSecond: 32,
  resizeMode: "ratio",
});
const logScroll = new ScrollAreaController({ contentHeight: docs.length, showScrollbar: true });
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
  expanded: true,
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
const notes = new TextBoxController({
  text: "Editable notes\nclick controls or type here",
  cursorPosition: { x: 0, y: 1 },
});
const table = new DataTableController<ProcessRow>({
  rows,
  columns,
  rowKey: (row) => row.id,
  initialState: { pageSize: 5, sort: { columnId: "latency", direction: "asc" } },
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
  if (isTextControlActive() && event.key !== "escape") {
    handleControlsKey(event);
    draw();
    return;
  }
  if (event.key === "q") tui.emit("destroy");
  else if (event.key === "tab") focusNext();
  else if (event.key === "1") focus("inspector");
  else if (event.key === "2") focus("data");
  else if (event.key === "3") focus("controls");
  else if (event.key === "4") focus("logs");
  else if (event.key === "m") minimize(activeWindow.peek());
  else if (event.key === "f" || event.key === "return") toggleMaximize(activeWindow.peek());
  else if (event.key === "r" || event.key === "escape") restoreAll();
  else if (event.key === "t") setTheme(themeIndex.peek() + 1);
  else if (event.key === "[") resizeSplit(-4);
  else if (event.key === "]") resizeSplit(4);
  else if (activeWindow.peek() === "controls") handleControlsKey(event);
  else if (event.key === "+" || event.key === "=") density.increment();
  else if (event.key === "-" || event.key === "_") density.decrement();
  else if (event.key === "x" || event.key === "space") livePreview.toggle();
  else if (event.key === "left" || event.key === "right") menu.handleKeyPress(event);
  else if (activeWindow.peek() === "logs" && event.key === "up") logScroll.scrollBy(0, -1);
  else if (activeWindow.peek() === "logs" && event.key === "down") logScroll.scrollBy(0, 1);
  else if (activeWindow.peek() === "data") table.handleKeyPress(event);
  draw();
});

tui.on("mousePress", (event) => {
  if (event.release) return;
  const hit = findHit(event.x, event.y);
  if (hit) applyHit(hit, event.x);
  draw();
});

tui.on("mouseScroll", (event) => {
  if (activeWindow.peek() === "logs") {
    logScroll.scrollBy(0, event.scroll);
    draw();
  }
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
  split.dispose();
  logScroll.dispose();
  density.dispose();
  livePreview.dispose();
  compactRows.dispose();
  actionButton.dispose();
  genericButton.dispose();
  modeRadio.dispose();
  themeCombo.dispose();
  dropdown.dispose();
  commandInput.dispose();
  workflowStepper.dispose();
  progress.dispose();
  notes.dispose();
  table.dispose();
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
  logScroll.setContentSize(Math.max(1, width - 6), docs.length);
  const frame: Frame = Array.from({ length: height }, () => []);
  renderHeader(frame);
  renderWorkspace(frame);
  renderStatus(frame);
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
  write(
    frame,
    0,
    17,
    paint(fit(renderMenuBar(menu.items.peek(), menu.activeIndex.peek()), Math.max(0, width - 18)), {
      fg: t.text,
      bg: t.backgroundSoft,
    }),
  );
  const themeRow = themes.map((entry, index) => {
    const selected = index === themeIndex.peek();
    return selected ? `[${entry.label}]` : ` ${entry.label} `;
  }).join(" ");
  write(frame, 1, 0, paint(" Themes ", { fg: t.background, bg: t.border, bold: true }));
  const help = width >= 132
    ? "Tab focus  M min  F max  R restore  [/] resize  T theme  Q quit"
    : width >= 96
    ? "Tab  M/F/R  T theme  Q quit"
    : width >= 56
    ? "Tab focus  T theme  Q quit"
    : "T theme  Q quit";
  const helpWidth = textWidth(help);
  const showHelp = width >= 34;
  const helpStart = showHelp ? Math.max(0, width - helpWidth) : width;
  const themeStart = 9;
  const themeWidth = Math.max(0, helpStart - themeStart - 1);
  let cursor = 9;
  for (const [index, entry] of themes.entries()) {
    const label = index === themeIndex.peek() ? `[${entry.label}]` : ` ${entry.label} `;
    if (cursor + textWidth(label) <= themeStart + themeWidth) {
      addHit({ column: cursor, row: 1, width: textWidth(label), height: 1 }, { type: "theme", index });
    }
    cursor += textWidth(label) + 1;
  }
  if (themeWidth > 0) write(frame, 1, themeStart, paint(fit(themeRow, themeWidth), { fg: t.text, bg: t.panel }));
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

function renderWorkspace(frame: Frame): void {
  const bounds = { column: 0, row: 3, width: currentWidth(), height: Math.max(0, currentHeight() - 5) };
  fillRect(frame, bounds, theme().backgroundSoft);
  const max = maximized.peek();
  if (max) {
    renderWindow(frame, max, bounds);
    renderShelf(frame);
    return;
  }

  const visible = (["inspector", "data", "controls", "logs"] as WindowId[]).filter((id) => !minimized.peek()[id]);
  if (visible.length === 0) {
    write(frame, bounds.row + 1, 2, paint("All windows minimized. Press R to restore.", { fg: theme().warn }));
    renderShelf(frame);
    return;
  }

  const stacked = bounds.width < 92 || bounds.height < 18;
  if (stacked || visible.length < 4) {
    for (const [index, id] of visible.entries()) {
      renderWindow(frame, id, stackRects(bounds, visible.length)[index]!);
    }
  } else {
    split.setDirection("row");
    const rows = splitPane(bounds, "column", 0.46);
    const top = split.rects(rows.first);
    const bottom = split.rects(rows.second);
    renderWindow(frame, "inspector", top.first);
    renderWindow(frame, "data", top.second);
    renderWindow(frame, "controls", bottom.first);
    renderWindow(frame, "logs", bottom.second);
  }
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
  fillRect(frame, inner, t.surface);
  if (id === "inspector") renderInspector(frame, inner);
  else if (id === "data") renderData(frame, inner);
  else if (id === "controls") renderControls(frame, inner);
  else renderLogs(frame, inner);
}

function renderInspector(frame: Frame, rect: Rectangle): void {
  const t = theme();
  const lines = [
    { text: " Composable API surfaces ", fg: t.background, bg: t.accent, bold: true },
    { text: "menu      MenuBarController", fg: t.good, bg: t.surface },
    { text: "layout    SplitPaneController + adaptive bounds", fg: t.good, bg: t.surface },
    { text: "viewport  ScrollAreaController", fg: t.good, bg: t.surface },
    { text: "data      DataTableController", fg: t.good, bg: t.surface },
    { text: "controls  SliderController / CheckBoxController", fg: t.good, bg: t.surface },
    { text: `theme     ${themes[themeIndex.peek()]!.label}`, fg: t.warn, bg: t.surface, bold: true },
    { text: "", bg: t.surface },
    { text: " Recent actions ", fg: t.background, bg: t.border, bold: true },
    ...commandLog.peek().slice(-Math.max(0, rect.height - 10)).map((line) => ({
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
    } = {},
  ) => {
    if (row >= rect.row + rect.height) return;
    const active = activeControl.peek() === id;
    const line = `${active && !options.indent ? ">" : " "} ${options.indent ? "  " : ""}${value}`;
    write(
      frame,
      row,
      rect.column,
      paint(fit(line, rect.width), {
        fg: active ? t.background : t.text,
        bg: active ? t.warn : t.surface,
        bold: active,
      }),
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
    `${
      paint("[ Run Action ]", { fg: t.background, bg: t.accent, bold: true })
    } presses=${actionButton.pressCount.peek()}`,
  );
  writeControl(
    "genericButton",
    `${
      paint("[ Generic Button ]", { fg: t.background, bg: t.border, bold: true })
    } presses=${genericButton.pressCount.peek()}`,
  );
  writeControl("slider", `Slider    ${paint(track, { fg: t.good, bg: t.accentDeep })} ${density.value.peek()}/10`, {
    previous: true,
    next: true,
  });
  addHit({ column: rect.column + 12, row: row - 1, width: trackWidth, height: 1 }, {
    type: "control",
    id: "slider",
    action: "set",
  });
  writeControl(
    "checkbox",
    `Checkboxes  ${renderCheckBoxMark(livePreview.checked.peek())} live preview  ${
      renderCheckBoxMark(compactRows.checked.peek())
    } compact rows`,
  );
  addHit({ column: rect.column + 13, row: row - 1, width: 16, height: 1 }, {
    type: "control",
    id: "checkbox",
    action: "activate",
    index: 0,
  });
  addHit({ column: rect.column + 29, row: row - 1, width: 16, height: 1 }, {
    type: "control",
    id: "checkbox",
    action: "next",
    index: 1,
  });
  writeControl("radio", `Radio     ${renderInlineRadioOptions()}`, {
    previous: true,
    next: true,
  });
  addInlineRadioHits(rect, row - 1);
  writeSection("combo", `Theme combo  ${themeCombo.expanded.peek() ? "▾" : "▸"} ${themeCombo.label()}`);
  writeWrappedOptions(frame, rect, row, "combo", themeCombo.items.peek(), themeCombo.selectedIndex.peek(), t);
  row += wrappedOptionRowCount(themeCombo.items.peek(), rect.width - 4);
  writeSection("dropdown", `Dropdown  ${dropdown.expanded.peek() ? "▾" : "▸"} ${dropdown.label()}`);
  for (const [index, item] of dropdown.items.peek().entries()) {
    const selected = dropdown.selectedIndex.peek() === index;
    writeControl("dropdown", `${selected ? "●" : "○"} ${item}`, {
      indent: true,
      action: "activate",
      index,
    });
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
  writeControl("textbox", `TextBox   ${notes.text.peek().split("\n").join(" / ")}`, { action: "focus" });
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

function renderLogs(frame: Frame, rect: Rectangle): void {
  const t = theme();
  logScroll.setViewportSize(rect.width, rect.height);
  const offset = logScroll.offset.peek().rows;
  const lines = docs.slice(offset, offset + rect.height);
  writeRows(
    frame,
    { ...rect, width: Math.max(0, rect.width - 1) },
    lines.map((line) => ({
      text: line,
      fg: t.text,
      bg: t.surface,
    })),
  );
  const thumb = scrollbarThumb(docs.length, rect.height, offset);
  if (logScroll.showScrollbar.peek()) {
    for (let row = 0; row < rect.height; row += 1) {
      write(frame, rect.row + row, rect.column + rect.width - 1, paint(scrollbarGlyph(row, thumb), { fg: t.accent }));
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

function renderInlineRadioOptions(): string {
  const options = modeRadio.options.peek();
  const active = modeRadio.activeIndex.peek();
  const selected = modeRadio.selectedValue.peek();
  return options.map((option, index) => {
    const cursor = index === active ? ">" : " ";
    const mark = option.value === selected ? "●" : "○";
    return `${cursor} ${mark} ${option.label}`;
  }).join("  ");
}

function addInlineRadioHits(rect: Rectangle, row: number): void {
  let column = rect.column + 12;
  for (const [index, option] of modeRadio.options.peek().entries()) {
    const width = textWidth(
      `${index === modeRadio.activeIndex.peek() ? ">" : " "} ${
        option.value === modeRadio.selectedValue.peek() ? "●" : "○"
      } ${option.label}`,
    );
    addHit({ column, row, width, height: 1 }, {
      type: "control",
      id: "radio",
      action: "activate",
      index,
    });
    column += width + 2;
  }
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
  const entries = (Object.entries(minimized.peek()) as Array<[WindowId, boolean]>).filter(([, hidden]) => hidden);
  if (entries.length === 0) return;
  write(frame, row, column, paint("minimized ", { fg: theme().muted, bg: theme().backgroundSoft }));
  column += 10;
  for (const [id] of entries) {
    const label = `[${windowTitle(id)}]`;
    write(frame, row, column, paint(label, { fg: theme().background, bg: theme().border, bold: true }));
    addHit({ column, row, width: textWidth(label), height: 1 }, { type: "restore", id });
    column += textWidth(label) + 1;
  }
}

function renderStatus(frame: Frame): void {
  const t = theme();
  const width = currentWidth();
  const left = `focus ${windowTitle(activeWindow.peek())} | ${theme().label} | split ${
    (split.snapshot().ratio ?? 0).toFixed(2)
  }`;
  const right = "1-4 focus  arrows table/logs  mouse buttons";
  write(frame, currentHeight() - 1, 0, paint(renderStatusBar(left, right, width), { fg: t.text, bg: t.panelSoft }));
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

function splitPane(bounds: Rectangle, direction: "row" | "column", ratio: number) {
  const temp = new SplitPaneController({ direction, ratio, minFirst: 6, minSecond: 6, resizeMode: "ratio" });
  const rects = temp.rects(bounds);
  temp.dispose();
  return rects;
}

function stackRects(bounds: Rectangle, count: number): Rectangle[] {
  if (count <= 0) return [];
  const gap = bounds.height >= count * 5 ? 1 : 0;
  const available = Math.max(0, bounds.height - gap * (count - 1));
  let row = bounds.row;
  let remaining = available;
  return Array.from({ length: count }, (_, index) => {
    const slots = count - index;
    const height = index === count - 1 ? remaining : Math.max(4, Math.floor(remaining / slots));
    const rect = { column: bounds.column, row, width: bounds.width, height };
    row += height + gap;
    remaining = Math.max(0, remaining - height);
    return rect;
  });
}

function focus(id: WindowId): void {
  activeWindow.value = id;
  minimized.value[id] = false;
  pushLog(`focus ${windowTitle(id)}`);
}

function focusNext(): void {
  const ids: WindowId[] = ["inspector", "data", "controls", "logs"];
  const index = ids.indexOf(activeWindow.peek());
  focus(ids[(index + 1) % ids.length]!);
}

function minimize(id: WindowId): void {
  minimized.value[id] = true;
  if (maximized.peek() === id) maximized.value = null;
  pushLog(`minimize ${windowTitle(id)}`);
}

function toggleMaximize(id: WindowId): void {
  maximized.value = maximized.peek() === id ? null : id;
  minimized.value[id] = false;
  pushLog(`${maximized.peek() === id ? "maximize" : "restore"} ${windowTitle(id)}`);
}

function restoreAll(): void {
  maximized.value = null;
  minimized.value = { inspector: false, data: false, controls: false, logs: false };
  pushLog("restore all windows");
}

function resizeSplit(delta: number): void {
  split.resize({ column: 0, row: 0, width: currentWidth(), height: currentHeight() }, delta);
  pushLog(`resize split ${delta > 0 ? "+" : ""}${delta}`);
}

function setTheme(index: number): void {
  themeIndex.value = (index + themes.length) % themes.length;
  pushLog(`theme ${theme().label}`);
}

function applyHit(target: { rect: Rectangle; action: HitAction }, x: number): void {
  const action = target.action;
  if (action.type === "focus") focus(action.id);
  else if (action.type === "minimize") minimize(action.id);
  else if (action.type === "maximize") toggleMaximize(action.id);
  else if (action.type === "close") closeWindow(action.id);
  else if (action.type === "restore") {
    minimized.value[action.id] = false;
    maximized.value = null;
    focus(action.id);
  } else if (action.type === "control") {
    applyControlHit(action.id, action.action ?? "activate", target.rect, x, action.index);
  } else if (action.type === "dataRow") selectDataRow(action.index);
  else setTheme(action.index);
}

function closeWindow(id: WindowId): void {
  minimized.value[id] = true;
  if (maximized.peek() === id) maximized.value = null;
  pushLog(`close ${windowTitle(id)}`);
  const next = (["inspector", "data", "controls", "logs"] as WindowId[]).find((candidate) =>
    !minimized.peek()[candidate]
  );
  if (next) activeWindow.value = next;
}

function applyControlHit(
  id: ControlId,
  action: ControlHitAction,
  rect?: Rectangle,
  x?: number,
  index?: number,
): void {
  activeWindow.value = "controls";
  activeControl.value = id;
  if (action === "focus") {
    pushLog(`control ${id} focus`);
    return;
  }
  if (id === "button") actionButton.press("mouse");
  else if (id === "genericButton") genericButton.press("mouse");
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
    else if (action === "previous") dropdown.move(-1);
    else if (action === "next") dropdown.move(1);
    else dropdown.selectActive();
  } else if (id === "input") commandInput.submit();
  else if (id === "stepper") {
    if (index !== undefined) workflowStepper.setActive(index);
    else action === "previous" ? workflowStepper.move(-1) : workflowStepper.move(1);
  } else if (id === "textbox") notes.setText(`${notes.text.peek()}\nclicked`);
  progress.setValue(Math.min(100, progress.value.peek() + 7));
  pushLog(`control ${id} ${action}`);
}

function selectDataRow(index: number): void {
  activeWindow.value = "data";
  table.select(index);
  const selected = table.selectedKey() ?? `${index}`;
  pushLog(`data row selected: ${selected}`);
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

function isTextControlActive(): boolean {
  return activeWindow.peek() === "controls" && (activeControl.peek() === "input" || activeControl.peek() === "textbox");
}

function controlAt(delta: number): ControlId {
  const ids: ControlId[] = [
    "button",
    "genericButton",
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

function paint(text: string, options: { fg?: string; bg?: string; bold?: boolean } = {}): string {
  return makeStyle({ fg: options.fg ?? theme().text, bg: options.bg, bold: options.bold })(text);
}

function pill(text: string, t = theme()): string {
  return paint(` ${text} `, { fg: t.background, bg: t.accent, bold: true });
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

function inset(rect: Rectangle, amount: number): Rectangle {
  return {
    column: rect.column + amount,
    row: rect.row + amount,
    width: Math.max(0, rect.width - amount * 2),
    height: Math.max(0, rect.height - amount * 2),
  };
}

function windowTitle(id: WindowId): string {
  return id === "inspector" ? "Inspector" : id === "data" ? "Data Table" : id === "controls" ? "Controls" : "Logs";
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
