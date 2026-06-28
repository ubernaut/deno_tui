/// <reference lib="dom" />
/// <reference lib="dom.iterable" />
import { BoxObject } from "../../src/canvas/box.ts";
import { TextObject } from "../../src/canvas/text.ts";
import { Signal } from "../../src/signals/mod.ts";
import { createAnsiStyle } from "../../src/theme.ts";
import { stripStyles, textWidth } from "../../src/utils/strings.ts";
import { createWebTui } from "../../src/web/host.ts";
import {
  cycleDemo,
  neonDemosForSection,
  type NeonSuiteSection,
  neonSuiteSectionLabels,
  neonSuiteSections,
  renderNeonSuiteDemo,
} from "../../app/neon_suite.ts";
import { accentColor, makeStyle, palette } from "../../app/styles.ts";
import type { NeonDemo } from "../../app/neon_theme.ts";

const columns = 120;
const rows = 36;
const root = document.querySelector<HTMLElement>("#app");
if (!root) throw new Error("Missing #app mount element.");

const host = createWebTui({
  root,
  columns,
  rows,
  sinkOptions: {
    cellWidth: 10,
    cellHeight: 19,
    foreground: palette.paper,
    background: palette.void,
  },
});

new BoxObject({
  canvas: host.canvas,
  rectangle: { column: 0, row: 0, width: columns, height: rows },
  filler: " ",
  style: createAnsiStyle({ background: [5, 7, 13] }),
  zIndex: -1,
}).draw();

const lineSignals = Array.from({ length: rows }, () => new Signal(""));
for (let row = 0; row < rows; row += 1) {
  new TextObject({
    canvas: host.canvas,
    rectangle: { column: 0, row, width: columns },
    value: lineSignals[row]!,
    overwriteRectangle: true,
    multiCodePointSupport: true,
    style: (text) => text,
    zIndex: 1,
  }).draw();
}

let phase = 0;
let section: NeonSuiteSection = "all";
let selectedId = "warning-stack";
let source: "opentui" | "web" | "extended" = "web";

host.on("keyPress", ({ key }) => {
  if (key === "1") section = "all";
  else if (key === "2") section = "overview";
  else if (key === "3") section = "signals";
  else if (key === "4") section = "control";
  else if (key === "5") section = "three";
  else if (key === "o") source = "opentui";
  else if (key === "w") source = "web";
  else if (key === "e") source = "extended";
  else if (key === "left" || key === "up") selectedId = cycleDemo(section, selectedId, -1, source);
  else if (key === "right" || key === "down") selectedId = cycleDemo(section, selectedId, 1, source);
  ensureSelectedVisible();
  draw();
});

host.start();
root.focus();
draw();
setInterval(() => {
  phase += 1;
  draw();
}, 240);

globalThis.addEventListener("beforeunload", () => host.destroy());

function draw(): void {
  const frame = Array.from({ length: rows }, () => "");
  frame[0] = headerLine();
  frame[1] = navLine();
  frame[2] = hintLine();

  const visible = visibleDemos();
  const selectedIndex = Math.max(0, visible.findIndex((demo) => demo.id === selectedId));
  const selected = visible[selectedIndex] ?? visible[0];
  const grid = section === "all"
    ? { cols: 3, panelWidth: 38, panelHeight: 10 }
    : { cols: 2, panelWidth: 57, panelHeight: 13 };
  const startRow = section === "all" ? 5 : 6;
  const startColumn = 2;
  const gap = 2;
  const count = section === "all" ? 9 : 6;
  const offset = Math.max(0, selectedIndex - (selectedIndex % grid.cols));
  const demos = visible.slice(offset, offset + count);

  for (const [index, demo] of demos.entries()) {
    const column = startColumn + (index % grid.cols) * (grid.panelWidth + gap);
    const row = startRow + Math.floor(index / grid.cols) * (grid.panelHeight + 1);
    placePanel(frame, column, row, grid.panelWidth, grid.panelHeight, demo, demo.id === selectedId);
  }

  if (selected && section !== "all") {
    placeSelectedDetail(frame, selected);
  }

  frame[rows - 1] = makeStyle({ fg: palette.dim })(
    fit(
      "1-5 SECTION  O/W/E SOURCE  ARROWS SELECT  DEFAULT: NEON EXODUS WEB PORT  /  STANDALONE CLIENT PACKAGE",
      columns,
    ),
  );

  for (let row = 0; row < rows; row += 1) {
    lineSignals[row]!.value = fit(frame[row] ?? "", columns);
  }
}

function visibleDemos(): NeonDemo[] {
  return neonDemosForSection(section, { source });
}

function ensureSelectedVisible(): void {
  const visible = visibleDemos();
  if (!visible.some((demo) => demo.id === selectedId)) {
    selectedId = visible[0]?.id ?? selectedId;
  }
}

function headerLine(): string {
  const title = makeStyle({ fg: palette.alarm, bold: true })(" NEON EXODUS ");
  const subtitle = makeStyle({ fg: palette.paper, bold: true })(" / DENO TUI WEB STANDALONE / ");
  const clock = makeStyle({ fg: palette.amber, bold: true })(new Date().toLocaleTimeString());
  return fit(`${title}${subtitle}${clock}`, columns);
}

function navLine(): string {
  return neonSuiteSections.map((entry, index) => {
    const active = entry === section;
    const label = `${index + 1} ${neonSuiteSectionLabels[entry]}`;
    return active ? makeStyle({ fg: palette.void, bg: palette.signal, bold: true })(` ${label} `) : ` ${label} `;
  }).join("   ");
}

function hintLine(): string {
  const summary =
    `${source.toUpperCase()} SOURCE / ${visibleDemos().length} DEMOS / SELECTED ${selectedId.toUpperCase()} / PHASE ${
      String(phase).padStart(4, "0")
    }`;
  return makeStyle({ fg: palette.dim })(fit(summary, columns));
}

function placePanel(
  frame: string[],
  column: number,
  row: number,
  width: number,
  height: number,
  demo: NeonDemo,
  selected: boolean,
): void {
  const render = renderNeonSuiteDemo({
    demo,
    phase,
    width: Math.max(12, width - 2),
    height: Math.max(5, height - 4),
    selected,
    renderMode: section === "all" ? "compact" : "dense",
  });
  const accent = selected ? palette.paper : accentColor(render.accent);
  const border = makeStyle({ fg: accent, bold: selected });
  const title = makeStyle({ fg: palette.void, bg: accent, bold: true })(
    fit(` ${demo.code} / ${demo.title.toUpperCase()} `, width - 2),
  );
  write(frame, row, column, border(`┌${"─".repeat(width - 2)}┐`));
  write(frame, row + 1, column, `${border("│")}${title}${pad("", width - 2 - textWidth(title))}${border("│")}`);

  const body = render.body.split("\n").slice(0, Math.max(0, height - 4));
  for (let index = 0; index < height - 4; index += 1) {
    const value = body[index] ?? "";
    write(frame, row + 2 + index, column, `${border("│")}${fit(value, width - 2)}${border("│")}`);
  }

  const footer = makeStyle({ fg: palette.dim })(fit(` ${render.footer || demo.subtitle} `, width - 2));
  write(
    frame,
    row + height - 2,
    column,
    `${border("│")}${footer}${pad("", width - 2 - textWidth(footer))}${border("│")}`,
  );
  write(frame, row + height - 1, column, border(`└${"─".repeat(width - 2)}┘`));
}

function placeSelectedDetail(frame: string[], demo: NeonDemo): void {
  const render = renderNeonSuiteDemo({
    demo,
    phase,
    width: 110,
    height: 6,
    selected: true,
    renderMode: "max",
  });
  const top = rows - 8;
  const accent = accentColor(render.accent);
  const border = makeStyle({ fg: accent, bold: true });
  write(frame, top, 4, border(`┌${"─".repeat(110)}┐`));
  write(
    frame,
    top + 1,
    4,
    `${border("│")}${
      makeStyle({ fg: palette.void, bg: accent, bold: true })(
        fit(` SELECTED / ${demo.code} / ${demo.title.toUpperCase()} `, 110),
      )
    }${border("│")}`,
  );
  const lines = render.body.split("\n").slice(0, 4);
  for (let index = 0; index < 4; index += 1) {
    write(frame, top + 2 + index, 4, `${border("│")}${fit(lines[index] ?? "", 110)}${border("│")}`);
  }
  write(frame, top + 6, 4, border(`└${"─".repeat(110)}┘`));
}

function write(frame: string[], row: number, column: number, value: string): void {
  if (row < 0 || row >= frame.length || column >= columns) return;
  const line = frame[row] ?? "";
  const visible = textWidth(line);
  if (visible <= column) {
    frame[row] = line + " ".repeat(column - visible) + value;
    return;
  }
  const plainPrefix = stripStyles(line).padEnd(column, " ").slice(0, column);
  frame[row] = plainPrefix + value;
}

function fit(value: string, width: number): string {
  const visible = textWidth(value);
  if (visible === width) return value;
  if (visible < width) return value + pad("", width - visible);
  const stripped = stripStyles(value);
  return stripped.length <= width ? stripped.padEnd(width, " ") : `${stripped.slice(0, Math.max(0, width - 1))}…`;
}

function pad(value: string, width: number): string {
  return value + " ".repeat(Math.max(0, width));
}
