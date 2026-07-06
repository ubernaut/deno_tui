/// <reference lib="dom" />
/// <reference lib="dom.iterable" />
import { BoxObject } from "../../src/canvas/box.ts";
import { TextObject, type TextRectangle } from "../../src/canvas/text.ts";
import { Computed, Signal } from "../../src/signals/mod.ts";
import { adaptiveGridItemRect, adaptiveGridPage } from "../../src/layout/mod.ts";
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
import type { NeonDemo } from "../../app/visualizations.ts";

const root = document.querySelector<HTMLElement>("#app");
if (!root) throw new Error("Missing #app mount element.");

const host = createWebTui({
  root,
  sinkOptions: {
    cellWidth: 10,
    cellHeight: 19,
    foreground: palette.paper,
    background: palette.void,
  },
});

new BoxObject({
  canvas: host.canvas,
  rectangle: new Computed(() => ({ column: 0, row: 0, width: currentColumns(), height: currentRows() })),
  filler: " ",
  style: createAnsiStyle({ background: [5, 7, 13] }),
  zIndex: -1,
}).draw();

const lineSignals: Signal<string>[] = [];
ensureLineSignals();

host.platform.size.subscribe(() => {
  ensureLineSignals();
  draw();
});

function ensureLineSignals(): void {
  for (let row = lineSignals.length; row < currentRows(); row += 1) {
    const signal = new Signal("");
    lineSignals.push(signal);
    const rowIndex = row;
    new TextObject({
      canvas: host.canvas,
      rectangle: new Computed<TextRectangle>(() => ({ column: 0, row: rowIndex, width: currentColumns() })),
      value: signal,
      overwriteRectangle: true,
      multiCodePointSupport: true,
      style: (text) => text,
      zIndex: 1,
    }).draw();
  }
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
  const columns = currentColumns();
  const rows = currentRows();
  ensureLineSignals();
  const frame = Array.from({ length: rows }, () => "");
  frame[0] = headerLine();
  frame[1] = navLine();
  frame[2] = hintLine();

  const visible = visibleDemos();
  const selectedIndex = Math.max(0, visible.findIndex((demo) => demo.id === selectedId));
  const selected = visible[selectedIndex] ?? visible[0];
  const content = {
    column: 1,
    row: section === "all" ? 5 : 6,
    width: Math.max(0, columns - 2),
    height: Math.max(0, rows - (section === "all" ? 7 : 15)),
  };
  const page = adaptiveGridPage(content, selectedIndex, {
    itemCount: visible.length,
    minColumnWidth: section === "all" ? 34 : 42,
    minRowHeight: section === "all" ? 9 : 11,
    maxColumns: section === "all" ? 4 : 3,
    gap: 1,
  });
  const demos = visible.slice(page.pageStart, page.pageStart + page.grid.pageSize);

  for (const [index, demo] of demos.entries()) {
    const rect = adaptiveGridItemRect(content, page.grid, index, 1);
    placePanel(frame, rect.column, rect.row, rect.width, rect.height, demo, demo.id === selectedId);
  }

  if (selected && section !== "all" && rows >= 24) {
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
  for (let row = rows; row < lineSignals.length; row += 1) {
    lineSignals[row]!.value = "";
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
  const columns = currentColumns();
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
  const columns = currentColumns();
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
  if (width < 4 || height < 4) return;
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
    fit(` ${demo.code} / ${demo.title.toUpperCase()} `, Math.max(0, width - 2)),
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
  const columns = currentColumns();
  const rows = currentRows();
  const width = Math.max(24, Math.min(110, columns - 8));
  const render = renderNeonSuiteDemo({
    demo,
    phase,
    width,
    height: 6,
    selected: true,
    renderMode: "max",
  });
  const top = rows - 8;
  const accent = accentColor(render.accent);
  const border = makeStyle({ fg: accent, bold: true });
  write(frame, top, 4, border(`┌${"─".repeat(width)}┐`));
  write(
    frame,
    top + 1,
    4,
    `${border("│")}${
      makeStyle({ fg: palette.void, bg: accent, bold: true })(
        fit(` SELECTED / ${demo.code} / ${demo.title.toUpperCase()} `, width),
      )
    }${border("│")}`,
  );
  const lines = render.body.split("\n").slice(0, 4);
  for (let index = 0; index < 4; index += 1) {
    write(frame, top + 2 + index, 4, `${border("│")}${fit(lines[index] ?? "", width)}${border("│")}`);
  }
  write(frame, top + 6, 4, border(`└${"─".repeat(width)}┘`));
}

function write(frame: string[], row: number, column: number, value: string): void {
  const columns = currentColumns();
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

function currentColumns(): number {
  return Math.max(1, host.platform.size.peek().columns);
}

function currentRows(): number {
  return Math.max(1, host.platform.size.peek().rows);
}
