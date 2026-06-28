/// <reference lib="dom" />
/// <reference lib="dom.iterable" />
import {
  BoxObject,
  ButtonController,
  CheckBoxController,
  ComboBoxController,
  Computed,
  createAnsiStyle,
  createWebTui,
  DataTableController,
  InputController,
  MenuBarController,
  ProgressBarController,
  RadioGroupController,
  renderCheckBoxMark,
  renderDataTableHeader,
  renderDataTableRows,
  renderMenuBar,
  renderStatusBar,
  renderStepper,
  ScrollAreaController,
  scrollbarGlyph,
  scrollbarOffsetForPointer,
  scrollbarThumb,
  Signal,
  SliderController,
  SplitPaneController,
  StepperController,
  TextBoxController,
  TextObject,
  type TextRectangle,
  textWidth,
  wrapTextBoxLines,
} from "../../mod.web.ts";
import { grWizardThemePalettes } from "../../src/grwizard_themes.ts";
import type { Rectangle } from "../../src/types.ts";
import { stripStyles } from "../../src/utils/strings.ts";
import { makeStyle } from "../../app/styles.ts";

type PanelId = "inspector" | "data" | "controls" | "logs";
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
type Hit =
  | { type: "focus"; id: PanelId }
  | { type: "min"; id: PanelId }
  | { type: "max"; id: PanelId }
  | { type: "restore"; id?: PanelId }
  | { type: "close"; id: PanelId }
  | { type: "theme"; index: number }
  | { type: "control"; id: ControlId; action?: ControlHitAction; index?: number }
  | { type: "dataRow"; index: number }
  | { type: "logScrollbar" }
  | { type: "workspaceScrollbar" };
type ControlHitAction = "previous" | "next" | "activate" | "set" | "focus" | "toggle";

interface ThemeSpec {
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
}

interface Row extends Record<string, unknown> {
  id: string;
  surface: string;
  state: string;
  ms: number;
}

const root = document.querySelector<HTMLElement>("#api-workbench");
if (!root) throw new Error("Missing #api-workbench mount element.");

const host = createWebTui({
  root,
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
}));
const rows: Row[] = [
  { id: "menu", surface: "MenuBar", state: "active", ms: 2 },
  { id: "split", surface: "SplitPane", state: "resized", ms: 5 },
  { id: "table", surface: "DataTable", state: "sorted", ms: 8 },
  { id: "scroll", surface: "ScrollArea", state: "tracking", ms: 3 },
  { id: "theme", surface: "Theme", state: "bound", ms: 4 },
  { id: "mouse", surface: "Pointer", state: "captured", ms: 1 },
];
const docs = [
  "Click panel buttons to minimize, maximize, or restore.",
  "Click theme names to switch the whole workbench.",
  "Use Tab, 1-4, M, F, R, T, [ and ] from the keyboard.",
  "The browser host maps pointer cells to the same mouse events as the terminal.",
  "Resize the browser: the terminal grid recalculates from CSS dimensions.",
  "The demo uses public controllers and canvas primitives from mod.web.ts.",
];

const themeIndex = new Signal(0);
const active = new Signal<PanelId>("inspector");
const maximized = new Signal<PanelId | null>(null);
const minimized = new Signal<Record<PanelId, boolean>>({
  inspector: false,
  data: false,
  controls: false,
  logs: false,
}, { deepObserve: true });
const lineSignals: Signal<string>[] = [];
const log = new Signal<string[]>(["ready: web api workbench mounted"], { deepObserve: true });
let hitTargets: Array<{ rect: Rectangle; hit: Hit }> = [];
let lastVisiblePanel: PanelId | null = null;
let lastWorkspaceWidth = 0;
let lastWorkspaceHeight = 0;

const menu = new MenuBarController({
  items: ["File", "View", "Layout", "Theme", "Help"].map((label) => ({ id: label.toLowerCase(), label })),
  onSelect: (item) => push(`menu ${item.label}`),
});
const split = new SplitPaneController({
  direction: "row",
  ratio: 0.5,
  minFirst: 28,
  minSecond: 28,
  resizeMode: "ratio",
});
const workspaceScroll = new ScrollAreaController({ showScrollbar: true });
const logScroll = new ScrollAreaController({ showScrollbar: true });
const slider = new SliderController({ min: 1, max: 10, value: 6, step: 1, orientation: "horizontal" });
const live = new CheckBoxController({ checked: true });
const compact = new CheckBoxController({ checked: false });
const actionButton = new ButtonController({ label: "Run Action", onPress: () => push("button pressed") });
const genericButton = new ButtonController({ label: "Generic Button", onPress: () => push("generic button pressed") });
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

host.on("keyPress", ({ key }) => {
  if (isTextControlActive() && (key === "escape" || key === "tab")) {
    blurTextControl();
    draw();
    return;
  }
  if (isTextControlActive()) {
    handleControlsKey({ key, ctrl: false, meta: false, shift: false });
    draw();
    return;
  }
  if (key === "tab" && active.peek() === "controls") focusNextControl();
  else if (key === "tab") focusNext();
  else if (key === "1") focus("inspector");
  else if (key === "2") focus("data");
  else if (key === "3") focus("controls");
  else if (key === "4") focus("logs");
  else if (key === "m") minimize(active.peek());
  else if (key === "f" || key === "return") toggleMax(active.peek());
  else if (key === "r" || key === "escape") restore();
  else if (key === "t") setTheme(themeIndex.peek() + 1);
  else if (key === "[") resizeSplit(-4);
  else if (key === "]") resizeSplit(4);
  else if (active.peek() === "controls") handleControlsKey({ key, ctrl: false, meta: false, shift: false });
  else if (key === "+" || key === "=") slider.increment();
  else if (key === "-") slider.decrement();
  else if (key === "space") live.toggle();
  else if (key === "left" || key === "right") {
    menu.handleKeyPress({ key, ctrl: false, meta: false, shift: false });
  }
  draw();
});

host.on("mousePress", (event) => {
  if (event.release) return;
  const target = findHit(event.x, event.y);
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
  radio.dispose();
  combo.dispose();
  dropdown.dispose();
  input.dispose();
  stepper.dispose();
  progress.dispose();
  textBox.dispose();
  compact.dispose();
  host.destroy();
});

function draw(): void {
  hitTargets = [];
  const width = cols();
  const height = rowsCount();
  const frame = Array.from({ length: height }, () => paint(" ".repeat(width), theme().text, theme().bg));
  write(frame, 0, 0, paint(" ".repeat(width), theme().text, theme().bgAlt));
  write(frame, 1, 0, paint(" ".repeat(width), theme().text, theme().panel));
  write(frame, 0, 1, paint(` API WORKBENCH `, theme().bg, theme().accent, true));
  write(
    frame,
    0,
    17,
    paint(fit(renderMenuBar(menu.items.peek(), menu.activeIndex.peek()), width - 18), theme().text, theme().bgAlt),
  );
  drawThemes(frame, width);
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
    const visible = (["inspector", "data", "controls", "logs"] as PanelId[]).filter((id) => !minimized.peek()[id]);
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
  renderWorkspaceScrollbar(frame, body, layout.contentHeight, offset);
  renderShelf(frame);
  frame[height - 1] = fit(
    paint(
      renderStatusBar(
        `focus ${active.peek()} | ${theme().label} | split ${Math.round((split.snapshot().ratio ?? 0) * 100)}%`,
        "click controls or use keyboard",
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
  let column = 2;
  const hidden = (Object.entries(minimized.peek()) as Array<[PanelId, boolean]>).filter(([, value]) => value);
  if (hidden.length === 0) return;
  write(frame, row, column, paint("minimized ", theme().muted, theme().bgAlt));
  column += 10;
  for (const [id] of hidden) {
    const label = `[${id}]`;
    write(frame, row, column, paint(label, theme().bg, theme().border, true));
    hitTargets.push({ rect: { column, row, width: label.length, height: 1 }, hit: { type: "restore", id } });
    column += label.length + 1;
  }
}

function renderPanel(frame: string[], id: PanelId, rect: Rectangle): void {
  if (rect.width < 10 || rect.height < 4) return;
  hitTargets.push({ rect, hit: { type: "focus", id } });
  const selected = active.peek() === id;
  fillRect(frame, rect, selected ? theme().panelAlt : theme().panel);
  const border = selected ? theme().accent : theme().borderStrong;
  const top = `┌ ${id.toUpperCase()} ${"─".repeat(Math.max(0, rect.width - id.length - 24))} [-] [□] [↺] [x] ┐`;
  write(
    frame,
    rect.row,
    rect.column,
    paint(fit(top, rect.width), border, selected ? theme().panelAlt : theme().panel, selected),
  );
  hitTargets.push({
    rect: { column: rect.column + rect.width - 16, row: rect.row, width: 3, height: 1 },
    hit: { type: "min", id },
  });
  hitTargets.push({
    rect: { column: rect.column + rect.width - 12, row: rect.row, width: 3, height: 1 },
    hit: { type: "max", id },
  });
  hitTargets.push({
    rect: { column: rect.column + rect.width - 8, row: rect.row, width: 3, height: 1 },
    hit: { type: "restore", id },
  });
  hitTargets.push({
    rect: { column: rect.column + rect.width - 4, row: rect.row, width: 3, height: 1 },
    hit: { type: "close", id },
  });
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
  if (id === "controls") renderControls(frame, inner);
  else if (id === "logs") renderLogs(frame, inner);
  else {
    const lines = panelLines(id, inner.width, inner.height);
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

function renderLogs(frame: string[], rect: Rectangle): void {
  const lines = [...docs, ...log.peek()];
  logScroll.setViewportSize(rect.width, rect.height);
  logScroll.setContentSize(rect.width, lines.length);
  const offset = logScroll.offset.peek().rows;
  const bodyWidth = Math.max(0, rect.width - 1);
  lines.slice(offset, offset + rect.height).forEach((line, index) => {
    write(frame, rect.row + index, rect.column, paint(fit(line, bodyWidth), theme().text, theme().surface));
  });
  if (lines.length <= rect.height || rect.width < 1) return;
  const column = rect.column + rect.width - 1;
  const thumb = scrollbarThumb(lines.length, rect.height, offset);
  hitTargets.push({ rect: { column, row: rect.row, width: 1, height: rect.height }, hit: { type: "logScrollbar" } });
  for (let row = 0; row < rect.height; row += 1) {
    write(frame, rect.row + row, column, paint(scrollbarGlyph(row, thumb), theme().accent, theme().surface, true));
  }
}

function panelLines(id: PanelId, width: number, height: number): string[] {
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

function drawThemes(frame: string[], width: number): void {
  let column = Math.max(2, width - themes.reduce((total, entry) => total + entry.label.length + 4, 0));
  themes.forEach((entry, index) => {
    const label = ` ${entry.label} `;
    write(
      frame,
      1,
      column,
      paint(
        label,
        index === themeIndex.peek() ? theme().bg : entry.soft,
        index === themeIndex.peek() ? entry.accent : theme().panel,
      ),
    );
    hitTargets.push({ rect: { column, row: 1, width: label.length, height: 1 }, hit: { type: "theme", index } });
    column += label.length + 1;
  });
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

function applyHit(target: { rect: Rectangle; hit: Hit }, x: number, y: number): void {
  const hit = target.hit;
  if (hit.type === "focus") focus(hit.id);
  else if (hit.type === "min") minimize(hit.id);
  else if (hit.type === "max") toggleMax(hit.id);
  else if (hit.type === "close") closePanel(hit.id);
  else if (hit.type === "restore") hit.id ? restorePanel(hit.id) : restore();
  else if (hit.type === "control") applyControlHit(hit.id, hit.action ?? "activate", target.rect, x, hit.index);
  else if (hit.type === "dataRow") selectDataRow(hit.index);
  else if (hit.type === "logScrollbar") {
    const lines = docs.length + log.peek().length;
    logScroll.scrollTo(0, scrollbarOffsetForPointer(lines, target.rect.height, y - target.rect.row));
    active.value = "logs";
  } else if (hit.type === "workspaceScrollbar") {
    workspaceScroll.scrollTo(
      0,
      scrollbarOffsetForPointer(workspaceScroll.contentHeight.peek(), target.rect.height, y - target.rect.row),
    );
  } else setTheme(hit.index);
}

function focus(id: PanelId): void {
  active.value = id;
  push(`focus ${id}`);
}
function focusNext(): void {
  const ids: PanelId[] = ["inspector", "data", "controls", "logs"];
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
  const next = (["inspector", "data", "controls", "logs"] as PanelId[]).find((panel) => !minimized.peek()[panel]);
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
  minimized.value = { inspector: false, data: false, controls: false, logs: false };
  push("restore all");
}
function setTheme(index: number): void {
  themeIndex.value = ((index % themes.length) + themes.length) % themes.length;
  push(`theme ${theme().label}`);
}
function resizeSplit(delta: number): void {
  split.resize({ column: 0, row: 0, width: cols(), height: rowsCount() }, delta);
  push(`resize ${delta}`);
}
function splitRects(direction: "row" | "column", rect: Rectangle, ratio: number) {
  const controller = new SplitPaneController({ direction, ratio, minFirst: 6, minSecond: 6, resizeMode: "ratio" });
  const result = controller.resize(rect, 0);
  controller.dispose();
  return result;
}

function workspaceLayout(bounds: Rectangle): {
  bounds: Rectangle;
  contentHeight: number;
  rects: Map<PanelId, Rectangle>;
} {
  const rects = new Map<PanelId, Rectangle>();
  const max = maximized.peek();
  if (max) {
    rects.set(max, bounds);
    return { bounds, contentHeight: bounds.height, rects };
  }
  const visible = (["inspector", "data", "controls", "logs"] as PanelId[]).filter((id) => !minimized.peek()[id]);
  if (visible.length === 0) return { bounds, contentHeight: bounds.height, rects };
  const stacked = bounds.width < 88 || bounds.height < 18 || visible.length < 4;
  if (stacked) {
    const stackedRects = stackWorkspaceRects(bounds, visible);
    for (const [index, id] of visible.entries()) rects.set(id, stackedRects[index]!);
    const bottom = stackedRects.reduce((maxRow, rect) => Math.max(maxRow, rect.row + rect.height), bounds.row);
    return { bounds, contentHeight: Math.max(bounds.height, bottom - bounds.row), rects };
  }
  const rows = splitRects("column", bounds, 0.46);
  const top = split.resize(rows.first, 0);
  const bottom = split.resize(rows.second, 0);
  rects.set("inspector", top.first);
  rects.set("data", top.second);
  rects.set("controls", bottom.first);
  rects.set("logs", bottom.second);
  return { bounds, contentHeight: bounds.height, rects };
}

function stackWorkspaceRects(bounds: Rectangle, ids: PanelId[]): Rectangle[] {
  const gap = ids.length > 1 ? 1 : 0;
  const preferred = ids.map((id) => preferredPanelHeight(id, bounds.width));
  const preferredTotal = preferred.reduce((total, height) => total + height, 0) + gap * Math.max(0, ids.length - 1);
  if (preferredTotal <= bounds.height) return stackRects(bounds, ids.length);
  let row = bounds.row;
  return ids.map((id, index) => {
    const height = preferred[index] ?? preferredPanelHeight(id, bounds.width);
    const rect = { column: bounds.column, row, width: bounds.width, height };
    row += height + gap;
    return rect;
  });
}

function preferredPanelHeight(id: PanelId, width: number): number {
  if (id === "controls") return width < 56 ? 22 : 18;
  if (id === "data") return 12;
  if (id === "logs") return 12;
  return 11;
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

function renderWorkspaceScrollbar(frame: string[], bounds: Rectangle, contentHeight: number, offset: number): void {
  if (contentHeight <= bounds.height || bounds.width < 2) return;
  const column = bounds.column + bounds.width - 1;
  const thumb = scrollbarThumb(contentHeight, bounds.height, offset);
  hitTargets.push({
    rect: { column, row: bounds.row, width: 1, height: bounds.height },
    hit: { type: "workspaceScrollbar" },
  });
  for (let row = 0; row < bounds.height; row += 1) {
    write(frame, bounds.row + row, column, paint(scrollbarGlyph(row, thumb), theme().accent, theme().bgAlt, true));
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

function stackRects(rect: Rectangle, count: number): Rectangle[] {
  if (count <= 0) return [];
  const gap = rect.height >= count * 5 ? 1 : 0;
  const available = Math.max(0, rect.height - gap * (count - 1));
  let row = rect.row;
  let remaining = available;
  return Array.from({ length: count }, (_, index) => {
    const slots = count - index;
    const height = index === count - 1 ? remaining : Math.max(4, Math.floor(remaining / slots));
    const next = { column: rect.column, row, width: rect.width, height };
    row += height + gap;
    remaining = Math.max(0, remaining - height);
    return next;
  });
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
    } = {},
  ) => {
    if (row >= rect.row + rect.height) return;
    const selected = activeControl.peek() === id;
    write(
      frame,
      row,
      rect.column,
      paint(
        fit(`${selected && !options.indent ? ">" : " "} ${options.indent ? "  " : ""}${value}`, rect.width),
        selected ? t.bg : t.text,
        selected ? t.warn : t.surface,
        selected,
      ),
    );
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
  writeControl("button", `[ Run Action ] presses=${actionButton.pressCount.peek()}`);
  writeControl("genericButton", `[ Generic Button ] presses=${genericButton.pressCount.peek()}`);
  writeControl("slider", `Slider    ${sliderTrack} ${slider.value.peek()}/10`, {
    previous: true,
    next: true,
  });
  hitTargets.push({
    rect: { column: rect.column + 12, row: row - 1, width: 10, height: 1 },
    hit: { type: "control", id: "slider", action: "set" },
  });
  writeControl(
    "checkbox",
    `Checkboxes  ${renderCheckBoxMark(live.checked.peek())} live preview  ${
      renderCheckBoxMark(compact.checked.peek())
    } compact rows`,
  );
  hitTargets.push({
    rect: { column: rect.column + 13, row: row - 1, width: 16, height: 1 },
    hit: { type: "control", id: "checkbox", action: "activate", index: 0 },
  });
  hitTargets.push({
    rect: { column: rect.column + 29, row: row - 1, width: 16, height: 1 },
    hit: { type: "control", id: "checkbox", action: "next", index: 1 },
  });
  writeControl("radio", `Radio     ${renderInlineRadioOptions()}`, {
    previous: true,
    next: true,
  });
  addInlineRadioHits(rect, row - 1);
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
    for (const [index, item] of dropdown.items.peek().entries()) {
      writeControl("dropdown", `${dropdown.selectedIndex.peek() === index ? "●" : "○"} ${item}`, {
        indent: true,
        action: "activate",
        index,
      });
    }
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

function renderInlineRadioOptions(): string {
  const options = radio.options.peek();
  const active = radio.activeIndex.peek();
  const selected = radio.selectedValue.peek();
  return options.map((option, index) => {
    const cursor = index === active ? ">" : " ";
    const mark = option.value === selected ? "●" : "○";
    return `${cursor} ${mark} ${option.label}`;
  }).join("  ");
}

function addInlineRadioHits(rect: Rectangle, row: number): void {
  let column = rect.column + 12;
  for (const [index, option] of radio.options.peek().entries()) {
    const width = textWidth(
      `${index === radio.activeIndex.peek() ? ">" : " "} ${
        option.value === radio.selectedValue.peek() ? "●" : "○"
      } ${option.label}`,
    );
    hitTargets.push({
      rect: { column, row, width, height: 1 },
      hit: { type: "control", id: "radio", action: "activate", index },
    });
    column += width + 2;
  }
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
  const line = frame[row] ?? "";
  const visible = textWidth(line);
  const valueWidth = textWidth(value);
  if (visible <= column) {
    frame[row] = line + " ".repeat(column - visible) + value;
    return;
  }
  frame[row] = stripStyles(line).slice(0, column).padEnd(column, " ") + value +
    stripStyles(line).slice(column + valueWidth);
}
function fit(value: string, width: number): string {
  const plain = stripStyles(value);
  return textWidth(plain) > width
    ? plain.slice(0, Math.max(0, width - 1)) + "…"
    : value + " ".repeat(Math.max(0, width - textWidth(plain)));
}
function fillRect(frame: string[], rect: Rectangle, bg: string): void {
  for (let row = rect.row; row < rect.row + rect.height; row += 1) {
    write(frame, row, rect.column, paint(" ".repeat(Math.max(0, rect.width)), theme().text, bg));
  }
}
function paint(value: string, fg = theme().text, bg = theme().bg, bold = false): string {
  return makeStyle({ fg, bg, bold })(value);
}
function contains(rect: Rectangle, x: number, y: number): boolean {
  return x >= rect.column && y >= rect.row && x < rect.column + rect.width && y < rect.row + rect.height;
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
function findHit(x: number, y: number): { rect: Rectangle; hit: Hit } | undefined {
  for (let index = hitTargets.length - 1; index >= 0; index -= 1) {
    const target = hitTargets[index]!;
    if (contains(target.rect, x, y)) return target;
  }
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
function hex(value: string): [number, number, number] {
  const color = value.replace("#", "");
  return [0, 2, 4].map((index) => Number.parseInt(color.slice(index, index + 2), 16)) as [number, number, number];
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
