import { BoxObject } from "../src/canvas/box.ts";
import { TextObject, type TextRectangle } from "../src/canvas/text.ts";
import { handleInput } from "../src/input.ts";
import { Computed, Effect, Signal } from "../src/signals/mod.ts";
import { probeCompatibleWebGPUDevice } from "../src/three_ascii/webgpu_compat.ts";
import { Tui } from "../src/tui.ts";
import { adaptiveGridItemRect, adaptiveGridPage } from "../src/layout/mod.ts";
import { createDefaultAsciiOptions, terminalGlyphStyleLabel } from "./ascii_options.ts";
import { demos, formatCountdown, type NeonDemo, type NeonSection } from "./neon_theme.ts";
import { accentColor, makeStyle, palette, severityAccent } from "./styles.ts";
import { requireInteractiveTerminal } from "./terminal_guard.ts";
import { ThreePanelView } from "./three_panel.ts";
import type {
  Accent,
  AsciiOptions,
  BorderMode,
  PanelRender,
  Rect,
  RenderContext,
  SlotConfig,
  SourceFrame,
  SystemSnapshot,
} from "./types.ts";
import { renderVisualization } from "./visualizations.ts";
import { PanelView } from "./ui.ts";

type ShowcaseSection = NeonSection | "all";

const sectionOrder: ShowcaseSection[] = ["all", "overview", "signals", "control", "three"];
const sectionLabels: Record<ShowcaseSection, string> = {
  all: "ALL",
  overview: "OVERVIEW",
  signals: "SIGNALS",
  control: "CONTROL",
  three: "THREE",
};

requireInteractiveTerminal("deno task showcase");

const tui = new Tui({
  style: makeStyle({ bg: palette.void }),
  refreshRate: 1000 / 24,
});

handleInput(tui);
tui.dispatch();

const phase = new Signal(0);
const section = new Signal<ShowcaseSection>("all");
const selectedIndex = new Signal(0);
const fullscreen = new Signal(false);
const threeAsciiAvailable = new Signal(await probeCompatibleWebGPUDevice());
const ascii = new Signal<AsciiOptions>({
  ...createDefaultAsciiOptions(),
  preset: "opentui-blocks",
  terminalGlyphStyle: "blocks",
  border: "sharp",
  terminalEdgeBias: 1.35,
  blendWithBase: 0.8,
});

const timer = setInterval(() => {
  phase.value += 1;
}, 120);

const bounds = new Computed<Rect>(() => ({
  column: 0,
  row: 0,
  width: tui.rectangle.value.width,
  height: tui.rectangle.value.height,
}));

const contentRect = new Computed<Rect>(() => ({
  column: 1,
  row: 4,
  width: Math.max(0, bounds.value.width - 2),
  height: Math.max(0, bounds.value.height - 6),
}));

const visibleDemos = new Computed(() =>
  section.value === "all" ? demos : demos.filter((demo) => demo.section === section.value)
);

new Effect(() => {
  const count = visibleDemos.value.length;
  if (selectedIndex.value >= count) {
    selectedIndex.value = Math.max(0, count - 1);
  }
});

const selectedDemo = new Computed(() => visibleDemos.value[selectedIndex.value] ?? visibleDemos.value[0] ?? demos[0]!);

const headerBackground = new BoxObject({
  canvas: tui.canvas,
  zIndex: 100,
  style: makeStyle({ bg: palette.panel }),
  rectangle: new Computed(() => ({ column: 0, row: 0, width: bounds.value.width, height: 3 })),
});

const headerTitle = new TextObject({
  canvas: tui.canvas,
  zIndex: 101,
  style: new Computed(() => makeStyle({ fg: accentColor(selectedDemo.value.accent), bg: palette.panel, bold: true })),
  overwriteRectangle: true,
  rectangle: new Computed<TextRectangle>(() => ({ column: 1, row: 0, width: Math.max(0, bounds.value.width - 2) })),
  value: new Computed(() =>
    crop(
      `NEON EXODUS / ACEROLA ASCII SHOWCASE / ${sectionLabels[section.value]} / ${formatCountdown(phase.value)}`,
      Math.max(0, bounds.value.width - 2),
    ).padEnd(Math.max(0, bounds.value.width - 2), " ")
  ),
});

const headerTabs = new TextObject({
  canvas: tui.canvas,
  zIndex: 101,
  style: makeStyle({ fg: palette.paper, bg: palette.panel }),
  overwriteRectangle: true,
  rectangle: new Computed<TextRectangle>(() => ({ column: 1, row: 1, width: Math.max(0, bounds.value.width - 2) })),
  value: new Computed(() => {
    const tabs = sectionOrder.map((id, index) => {
      const label = `${index + 1} ${sectionLabels[id]}`;
      return id === section.value ? `[${label}]` : label;
    });
    return crop(tabs.join("   "), Math.max(0, bounds.value.width - 2)).padEnd(Math.max(0, bounds.value.width - 2), " ");
  }),
});

const headerStatus = new TextObject({
  canvas: tui.canvas,
  zIndex: 101,
  style: new Computed(() => makeStyle({ fg: palette.dim, bg: palette.panel })),
  overwriteRectangle: true,
  rectangle: new Computed<TextRectangle>(() => ({ column: 1, row: 2, width: Math.max(0, bounds.value.width - 2) })),
  value: new Computed(() => {
    const selected = selectedDemo.value;
    const engine = threeAsciiAvailable.value ? "ACEROLA WEBGPU READY" : "TEXT FALLBACK ACTIVE";
    const message = `${selected.badge} / ${selected.title.toUpperCase()} / ${engine} / STYLE ${
      terminalGlyphStyleLabel(ascii.value.terminalGlyphStyle).toUpperCase()
    } / B,G,M STYLE  ARROWS MOVE  ENTER MAX  1-5 FILTER  Q EXIT`;
    return crop(message, Math.max(0, bounds.value.width - 2)).padEnd(Math.max(0, bounds.value.width - 2), " ");
  }),
});

const footerBackground = new BoxObject({
  canvas: tui.canvas,
  zIndex: 100,
  style: makeStyle({ bg: palette.panel }),
  rectangle: new Computed(() => ({
    column: 0,
    row: Math.max(0, bounds.value.height - 1),
    width: bounds.value.width,
    height: bounds.value.height > 0 ? 1 : 0,
  })),
});

const footerText = new TextObject({
  canvas: tui.canvas,
  zIndex: 101,
  style: makeStyle({ fg: palette.dim, bg: palette.panel }),
  overwriteRectangle: true,
  rectangle: new Computed<TextRectangle>(() => ({
    column: 1,
    row: Math.max(0, bounds.value.height - 1),
    width: Math.max(0, bounds.value.width - 2),
  })),
  value: new Computed(() => {
    const page = pageState();
    const text =
      `PAGE ${page.current + 1}/${page.total}  SELECTED ${selectedIndex.value + 1}/${visibleDemos.value.length}  ` +
      `${fullscreen.value ? "FULLSCREEN" : "GRID"}  ${selectedDemo.value.subtitle}`;
    return crop(text, Math.max(0, bounds.value.width - 2)).padEnd(Math.max(0, bounds.value.width - 2), " ");
  }),
});

for (let index = 0; index < demos.length; index += 1) {
  const demo = new Computed(() => visibleDemos.value[index] ?? null);
  const rect = new Computed(() => cardRect(index));
  const selected = new Computed(() => selectedIndex.value === index && !!demo.value);
  const render = new Computed(() => {
    const current = demo.value;
    if (!current || rect.value.width <= 0 || rect.value.height <= 0) {
      return emptyRender();
    }
    return renderShowcaseDemo(current, rect.value, selected.value);
  });

  const panel = new PanelView({
    canvas: tui.canvas,
    rectangle: rect,
    title: new Computed(() => {
      const current = demo.value;
      if (!current) {
        return "";
      }
      return `${current.code} / ${current.title}`.toUpperCase();
    }),
    alert: new Computed(() => render.value.alert),
    body: new Computed(() => render.value.body),
    bodyPadToWidth: new Computed(() => !(render.value.three && selected.value && threeAsciiAvailable.value)),
    footer: new Computed(() => render.value.footer),
    backgroundStyle: new Computed(() =>
      makeStyle({
        bg: selected.value ? palette.panelSoft : palette.panel,
        fg: palette.paper,
      })
    ),
    frameStyle: new Computed(() =>
      makeStyle({
        fg: selected.value ? palette.paper : accentColor(render.value.accent),
        bg: selected.value ? palette.panelSoft : undefined,
        bold: selected.value,
      })
    ),
    titleStyle: new Computed(() =>
      makeStyle({
        fg: titleInk(render.value.accent),
        bg: accentColor(render.value.accent),
        bold: true,
      })
    ),
    alertStyle: new Computed(() =>
      makeStyle({
        fg: titleInk(severityAccent(render.value.severity)),
        bg: accentColor(severityAccent(render.value.severity)),
        bold: render.value.alert.length > 0,
      })
    ),
    bodyStyle: new Computed(() =>
      makeStyle({
        fg: render.value.severity === "alarm"
          ? accentColor("alarm")
          : render.value.severity === "warning"
          ? accentColor("amber")
          : palette.paper,
        bg: selected.value ? palette.panelSoft : palette.panel,
      })
    ),
    footerStyle: new Computed(() =>
      makeStyle({
        fg: selected.value ? accentColor(render.value.accent) : palette.dim,
        bg: selected.value ? palette.panelSoft : palette.panel,
      })
    ),
    borderMode: new Computed<BorderMode>(() => selected.value ? "sharp" : "rounded"),
    zIndex: 10,
  });

  new ThreePanelView({
    canvas: tui.canvas,
    rectangle: panel.bodyRect,
    scene: new Computed(() => selected.value ? render.value.three ?? null : null),
    ascii,
    enabled: threeAsciiAvailable,
    zIndex: 20,
    frameInterval: 1000 / 12,
  });

  panel.draw();
}

for (const object of [headerBackground, headerTitle, headerTabs, headerStatus, footerBackground, footerText]) {
  object.draw();
}

tui.on("keyPress", (event) => {
  if (event.ctrl && event.key === "c") {
    return;
  }

  switch (event.key) {
    case "q":
      tui.emit("destroy");
      return;
    case "escape":
      fullscreen.value = false;
      return;
    case "return":
    case "f":
      fullscreen.value = !fullscreen.value;
      return;
    case "1":
    case "2":
    case "3":
    case "4":
    case "5":
      setSection(sectionOrder[Number(event.key) - 1] ?? "all");
      return;
    case "b":
      setAsciiStyle("blocks");
      return;
    case "g":
      setAsciiStyle("glyphs");
      return;
    case "m":
      setAsciiStyle("mixed");
      return;
    case "left":
      moveSelection(-1);
      return;
    case "right":
      moveSelection(1);
      return;
    case "up":
      moveSelection(-gridColumns());
      return;
    case "down":
      moveSelection(gridColumns());
      return;
  }
});

tui.on("destroy", () => {
  clearInterval(timer);
});

tui.run();

function setSection(next: ShowcaseSection) {
  if (section.peek() !== next) {
    section.value = next;
    selectedIndex.value = 0;
    fullscreen.value = false;
  }
}

function setAsciiStyle(style: AsciiOptions["terminalGlyphStyle"]) {
  ascii.value.terminalGlyphStyle = style;
  ascii.value.preset = "custom";
}

function moveSelection(delta: number) {
  const count = visibleDemos.peek().length;
  if (count === 0) {
    selectedIndex.value = 0;
    return;
  }
  selectedIndex.value = (selectedIndex.peek() + delta + count) % count;
}

function cardRect(index: number): Rect {
  const current = visibleDemos.value[index];
  if (!current) {
    return hiddenRect();
  }

  const area = contentRect.value;
  if (fullscreen.value) {
    return selectedIndex.value === index ? area : hiddenRect();
  }

  const page = gridPage();
  const pageStart = page.pageStart;
  const local = index - pageStart;

  if (local < 0 || local >= page.grid.pageSize) {
    return hiddenRect();
  }

  return adaptiveGridItemRect(area, page.grid, local);
}

function gridColumns() {
  return gridPage().grid.columns;
}

function gridRows() {
  return gridPage().grid.rows;
}

function pageState() {
  const page = gridPage();
  return { current: page.pageIndex, total: page.pageCount };
}

function gridPage() {
  const area = contentRect.peek();
  return adaptiveGridPage(area, selectedIndex.peek(), {
    itemCount: visibleDemos.peek().length,
    minColumnWidth: section.peek() === "three" ? 42 : 34,
    minRowHeight: area.width >= 112 ? 10 : 8,
    maxColumns: section.peek() === "all" ? 4 : 3,
    gap: 1,
  });
}

function renderShowcaseDemo(demo: NeonDemo, rect: Rect, selected: boolean): PanelRender {
  const context = buildRenderContext(demo, rect, selected);
  return renderVisualization(context);
}

function buildRenderContext(demo: NeonDemo, rect: Rect, selected: boolean): RenderContext {
  const slot: SlotConfig = {
    id: "cpu",
    name: demo.badge,
    visualizationId: demo.id,
    inputSourceIds: ["demo:drive", "demo:harmonic", "demo:noise"],
    cycleEnabled: false,
    cycleIntervalMs: 10000,
    ascii: ascii.peek(),
  };

  return {
    slot,
    system: syntheticSystemSnapshot(demo),
    sources: syntheticSources(demo, selected),
    phase: phase.value,
    width: Math.max(8, rect.width - 2),
    height: Math.max(4, rect.height - 4),
  };
}

function syntheticSources(demo: NeonDemo, selected: boolean): SourceFrame[] {
  const base = demo.id.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const specs: Array<{ name: string; accent: Accent; offset: number }> = [
    { name: demo.badge, accent: demo.accent, offset: base % 31 },
    { name: "Harmonic", accent: "signal", offset: base % 17 },
    { name: "Noise", accent: selected ? "amber" : "violet", offset: base % 43 },
  ];

  return specs.map((spec, index) => {
    const series = Array.from(
      { length: 64 },
      (_, sample) => unitWave(phase.value + sample + spec.offset, 0.12 + index * 0.035, 0.08 + index * 0.025),
    );
    const value = series[series.length - 1] ?? 0.5;
    return {
      id: `demo:${demo.id}:${index}`,
      name: spec.name,
      accent: value > 0.88 ? "alarm" : value > 0.72 ? spec.accent : spec.accent,
      value,
      series,
      detailLines: [`${Math.round(value * 100)}% ${demo.code}`],
    };
  });
}

function syntheticSystemSnapshot(demo: NeonDemo): SystemSnapshot {
  const hot = unitWave(phase.value, 0.08, 0.13);
  return {
    timestamp: Date.now(),
    hostname: "showcase",
    osRelease: "neon",
    uptimeSeconds: phase.value,
    loadavg: [hot * 2, hot * 1.4, hot],
    cpuOverall: hot * 100,
    cpuCores: [],
    cpuHistory: Array.from({ length: 64 }, (_, index) => unitWave(phase.value + index, 0.08, 0.03) * 100),
    gpu: {
      available: true,
      name: "SHOWCASE RENDER CORE",
      utilizationPercent: hot * 100,
      memoryUsed: hot * 18 * 1024 ** 3,
      memoryTotal: 24 * 1024 ** 3,
      memoryPercent: hot * 75,
      temperatureCelsius: 36 + hot * 47,
      powerWatts: 85 + hot * 220,
      graphicsClockMhz: 1500 + hot * 950,
      memoryClockMhz: 9000 + hot * 1200,
    },
    gpuUtilizationHistory: Array.from({ length: 64 }, (_, index) => unitWave(phase.value + index, 0.075, 0.29)),
    gpuMemoryHistory: Array.from({ length: 64 }, (_, index) => unitWave(phase.value + index, 0.045, 0.51)),
    memory: {
      total: 32 * 1024 ** 3,
      used: hot * 24 * 1024 ** 3,
      available: (1 - hot) * 24 * 1024 ** 3,
      free: (1 - hot) * 24 * 1024 ** 3,
      swapTotal: 8 * 1024 ** 3,
      swapUsed: hot * 2 * 1024 ** 3,
      percent: hot * 100,
      swapPercent: hot * 25,
    },
    memoryHistory: Array.from({ length: 64 }, (_, index) => unitWave(phase.value + index, 0.05, 0.1)),
    swapHistory: Array.from({ length: 64 }, (_, index) => unitWave(phase.value + index, 0.04, 0.2) * 0.35),
    temperatures: [{ label: "CORE", celsius: 40 + hot * 48 }],
    disks: [{
      filesystem: "/dev/showcase",
      mount: "/",
      total: 1,
      used: hot,
      available: 1 - hot,
      percent: Math.round(hot * 100),
    }],
    networks: [{
      name: "eth0",
      addresses: ["127.0.0.1"],
      rxBytes: 0,
      txBytes: 0,
      rxRate: hot * 95_000_000,
      txRate: hot * 72_000_000,
    }],
    rxHistory: Array.from({ length: 64 }, (_, index) => unitWave(phase.value + index, 0.11, 0.2)),
    txHistory: Array.from({ length: 64 }, (_, index) => unitWave(phase.value + index, 0.09, 0.4)),
    processes: [],
    alerts: hot > 0.92 ? [{ severity: "warning", title: demo.badge, detail: "DRIVE SATURATION" }] : [],
    diagnostics: [],
  };
}

function unitWave(value: number, frequency: number, offset: number) {
  return Math.max(
    0,
    Math.min(
      1,
      0.5 +
        Math.sin(value * frequency + offset) * 0.34 +
        Math.cos(value * (frequency * 0.37) + offset * 2.1) * 0.16,
    ),
  );
}

function emptyRender(): PanelRender {
  return {
    body: "",
    footer: "",
    alert: "",
    accent: "signal",
    severity: "info",
  };
}

function titleInk(accent: Accent) {
  return accent === "phosphor" || accent === "signal" || accent === "amber" ? palette.void : palette.paper;
}

function hiddenRect(): Rect {
  return { column: 0, row: 0, width: 0, height: 0 };
}

function crop(text: string, width: number) {
  if (width <= 0) {
    return "";
  }
  return text.length <= width ? text : `${text.slice(0, Math.max(0, width - 1))}…`;
}
