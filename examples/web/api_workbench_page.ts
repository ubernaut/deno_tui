/// <reference lib="dom" />
/// <reference lib="dom.iterable" />
import {
  BoxObject,
  CheckBoxController,
  Computed,
  createAnsiStyle,
  createWebTui,
  DataTableController,
  MenuBarController,
  renderDataTableHeader,
  renderDataTableRows,
  renderMenuBar,
  renderStatusBar,
  Signal,
  SliderController,
  SplitPaneController,
  TextObject,
  type TextRectangle,
  textWidth,
} from "../../mod.web.ts";
import { grWizardThemePalettes } from "../../src/grwizard_themes.ts";
import type { Rectangle } from "../../src/types.ts";
import { stripStyles } from "../../src/utils/strings.ts";
import { makeStyle } from "../../app/styles.ts";

type PanelId = "inspector" | "data" | "controls" | "logs";
type Hit =
  | { type: "focus"; id: PanelId }
  | { type: "min"; id: PanelId }
  | { type: "max"; id: PanelId }
  | { type: "restore" }
  | { type: "theme"; index: number };

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

const menu = new MenuBarController({
  items: ["File", "View", "Layout", "Theme", "Help"].map((label) => ({ id: label.toLowerCase(), label })),
  onSelect: (item) => push(`menu ${item.label}`),
});
const split = new SplitPaneController({
  direction: "row",
  ratio: 0.58,
  minFirst: 28,
  minSecond: 28,
  resizeMode: "ratio",
});
const slider = new SliderController({ min: 1, max: 10, value: 6, step: 1, orientation: "horizontal" });
const live = new CheckBoxController({ checked: true });
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
  if (key === "tab") focusNext();
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
  const target = hitTargets.find(({ rect }) => contains(rect, event.x, event.y));
  if (target) applyHit(target.hit);
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
  const max = maximized.peek();
  if (max) {
    renderPanel(frame, max, body);
  } else {
    const visible = (["inspector", "data", "controls", "logs"] as PanelId[]).filter((id) => !minimized.peek()[id]);
    if (visible.length === 0) {
      write(frame, body.row + 1, body.column + 2, paint("All panels minimized. Press R or click restore."));
      hitTargets.push({ rect: body, hit: { type: "restore" } });
    } else if (width < 88) {
      const each = Math.max(5, Math.floor(body.height / visible.length));
      visible.forEach((id, index) =>
        renderPanel(frame, id, {
          column: body.column,
          row: body.row + index * each,
          width: body.width,
          height: index === visible.length - 1 ? body.height - index * each : each - 1,
        })
      );
    } else {
      const parts = split.resize(body, 0);
      const lower = splitRects("row", parts.second, 0.5);
      renderPanel(frame, "inspector", parts.first);
      renderPanel(frame, "data", lower.first);
      renderPanel(frame, "controls", lower.second);
      renderPanel(frame, "logs", {
        column: body.column,
        row: body.row + body.height - 7,
        width: body.width,
        height: 7,
      });
    }
  }
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

function renderPanel(frame: string[], id: PanelId, rect: Rectangle): void {
  if (rect.width < 10 || rect.height < 4) return;
  hitTargets.push({ rect, hit: { type: "focus", id } });
  const selected = active.peek() === id;
  fillRect(frame, rect, selected ? theme().panelAlt : theme().panel);
  const border = selected ? theme().accent : theme().borderStrong;
  const top = `┌ ${id.toUpperCase()} ${"─".repeat(Math.max(0, rect.width - id.length - 20))} [-] [□] [↺] ┐`;
  write(
    frame,
    rect.row,
    rect.column,
    paint(fit(top, rect.width), border, selected ? theme().panelAlt : theme().panel, selected),
  );
  hitTargets.push({
    rect: { column: rect.column + rect.width - 12, row: rect.row, width: 3, height: 1 },
    hit: { type: "min", id },
  });
  hitTargets.push({
    rect: { column: rect.column + rect.width - 8, row: rect.row, width: 3, height: 1 },
    hit: { type: "max", id },
  });
  hitTargets.push({
    rect: { column: rect.column + rect.width - 4, row: rect.row, width: 3, height: 1 },
    hit: { type: "restore" },
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
  const lines = panelLines(id, inner.width, inner.height);
  lines.forEach((line, index) =>
    write(frame, inner.row + index, inner.column, paint(fit(line, inner.width), theme().text, theme().surface))
  );
}

function panelLines(id: PanelId, width: number, height: number): string[] {
  const source = id === "data"
    ? [
      renderDataTableHeader(table.columns.peek(), table.state.peek().sort),
      ...renderDataTableRows(table.view.peek().rows, table.columns.peek(), table.view.peek().selectedIndex),
    ]
    : id === "controls"
    ? [
      `${paint(" Density ", theme().bg, theme().accent, true)} ${
        paint("█".repeat(slider.value.peek()).padEnd(10, "░"), theme().good, theme().accentDeep)
      } ${slider.value.peek()}/10`,
      `${paint(live.checked.peek() ? "[x]" : "[ ]", theme().good, theme().surface, true)} live preview`,
      "[/] resize split",
      "T theme  Space toggle",
    ]
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

function applyHit(hit: Hit): void {
  if (hit.type === "focus") focus(hit.id);
  else if (hit.type === "min") minimize(hit.id);
  else if (hit.type === "max") toggleMax(hit.id);
  else if (hit.type === "restore") restore();
  else setTheme(hit.index);
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
function toggleMax(id: PanelId): void {
  maximized.value = maximized.peek() === id ? null : id;
  push(`${maximized.peek() ? "maximize" : "restore"} ${id}`);
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
function splitRects(direction: "row", rect: Rectangle, ratio: number) {
  const controller = new SplitPaneController({ direction, ratio, minFirst: 6, minSecond: 6, resizeMode: "ratio" });
  const result = controller.resize(rect, 0);
  controller.dispose();
  return result;
}
function push(message: string): void {
  log.value = [...log.peek(), `${new Date().toLocaleTimeString()} ${message}`].slice(-40);
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
