import { createDefaultAsciiOptions } from "./ascii_options.ts";
import { demos, type NeonDemo, type NeonSection } from "./neon_theme.ts";
import type {
  Accent,
  AsciiOptions,
  PanelRender,
  Rect,
  RenderContext,
  SlotConfig,
  SourceFrame,
  SystemSnapshot,
} from "./types.ts";
import { renderVisualization } from "./visualizations.ts";

export type NeonSuiteSection = NeonSection | "all";
export type NeonRenderMode = "card" | "compact" | "dense" | "max";

export const neonSuiteSections: readonly NeonSuiteSection[] = ["all", "overview", "signals", "control", "three"];

export const neonSuiteSectionLabels: Record<NeonSuiteSection, string> = {
  all: "ALL",
  overview: "OVERVIEW",
  signals: "SIGNALS",
  control: "CONTROL",
  three: "THREE",
};

const tallWebDemoIds = new Set([
  "magi-board",
  "route-board",
  "gate-status",
  "tactical-map",
  "network-topology",
  "component-index",
]);

export const neonOpenTuiDemoIds = demos.filter((demo) => demo.id !== "three-ascii-studio").map((demo) => demo.id);

export const neonWebDemoIds = [
  ...demos.filter((demo) => demo.id !== "three-ascii-studio" && !tallWebDemoIds.has(demo.id)).map((demo) => demo.id),
  ...demos.filter((demo) => demo.id !== "three-ascii-studio" && tallWebDemoIds.has(demo.id)).map((demo) => demo.id),
];

export function neonDemosForSection(
  section: NeonSuiteSection,
  options: { source?: "opentui" | "web" | "extended" } = {},
): NeonDemo[] {
  const ids = options.source === "web" ? neonWebDemoIds : options.source === "opentui" ? neonOpenTuiDemoIds : undefined;
  const source = ids ? ids.map((id) => demoById(id)).filter((demo): demo is NeonDemo => Boolean(demo)) : demos;
  return section === "all" ? source : source.filter((demo) => demo.section === section);
}

export function demoById(id: string): NeonDemo | undefined {
  return demos.find((demo) => demo.id === id);
}

export function demoIndex(id: string, section: NeonSuiteSection, source: "opentui" | "web" | "extended" = "extended") {
  return neonDemosForSection(section, { source }).findIndex((demo) => demo.id === id);
}

export function cycleDemo(
  section: NeonSuiteSection,
  selectedId: string,
  direction: -1 | 1,
  source: "opentui" | "web" | "extended" = "extended",
): string {
  const visible = neonDemosForSection(section, { source });
  const current = visible.findIndex((demo) => demo.id === selectedId);
  if (current === -1 || visible.length === 0) {
    return visible[0]?.id ?? demos[0]?.id ?? "";
  }
  return visible[(current + direction + visible.length) % visible.length]?.id ?? selectedId;
}

export function moveGridSelection(current: number, keyName: string, columns: number, total: number): number {
  const row = Math.floor(current / columns);
  const column = current % columns;
  const lastIndex = total - 1;

  if (keyName === "left") return column === 0 ? current : current - 1;
  if (keyName === "right") return current >= lastIndex || column === columns - 1 ? current : current + 1;
  if (keyName === "up") return row === 0 ? current : current - columns;
  if (keyName === "down") {
    const next = current + columns;
    if (next <= lastIndex) return next;
    const rowStart = (row + 1) * columns;
    return rowStart <= lastIndex ? lastIndex : current;
  }
  return current;
}

export function neonColumnsForWidth(width: number, section: NeonSuiteSection): number {
  if (section === "all") return width >= 236 ? 4 : width >= 176 ? 3 : width >= 112 ? 2 : 1;
  if (section === "three") return width >= 150 ? 3 : width >= 100 ? 2 : 1;
  return width >= 176 ? 3 : width >= 116 ? 2 : 1;
}

export function neonSceneHeight(width: number, height: number, section: NeonSuiteSection): number {
  if (section === "all") return width >= 236 ? 6 : width >= 176 ? 7 : height < 42 ? 6 : 8;
  if (section === "three") return height < 40 ? 8 : 10;
  return height < 40 ? 6 : 8;
}

export function renderNeonSuiteDemo(options: {
  demo: NeonDemo;
  phase: number;
  width: number;
  height: number;
  selected?: boolean;
  ascii?: AsciiOptions;
  renderMode?: NeonRenderMode;
}): PanelRender {
  const context = buildNeonRenderContext(options);
  return renderVisualization(context);
}

export function buildNeonRenderContext(options: {
  demo: NeonDemo;
  phase: number;
  width: number;
  height: number;
  selected?: boolean;
  ascii?: AsciiOptions;
  renderMode?: NeonRenderMode;
}): RenderContext {
  const slot: SlotConfig = {
    id: "cpu",
    name: options.demo.badge,
    visualizationId: options.demo.id,
    inputSourceIds: ["demo:drive", "demo:harmonic", "demo:noise"],
    cycleEnabled: false,
    cycleIntervalMs: 10000,
    ascii: options.ascii ?? createDefaultAsciiOptions(),
  };

  const selected = options.selected ?? false;
  return {
    slot,
    system: syntheticSystemSnapshot(options.demo, options.phase),
    sources: syntheticSources(options.demo, options.phase, selected),
    phase: options.phase,
    width: Math.max(8, options.width),
    height: Math.max(4, options.height),
  };
}

export function neonSuiteSummary(source: "opentui" | "web" | "extended" = "extended") {
  const suite = source === "opentui"
    ? neonOpenTuiDemoIds
    : source === "web"
    ? neonWebDemoIds
    : demos.map((demo) => demo.id);
  const entries = suite.map((id) => demoById(id)).filter((demo): demo is NeonDemo => Boolean(demo));
  return {
    source,
    count: entries.length,
    sections: Object.fromEntries(
      neonSuiteSections
        .filter((section) => section !== "all")
        .map((section) => [section, entries.filter((demo) => demo.section === section).length]),
    ) as Record<NeonSection, number>,
    threeCount: entries.filter((demo) => demo.section === "three").length,
  };
}

export function fitText(text: string, width: number): string {
  if (width <= 0) return "";
  return text.length <= width ? text : `${text.slice(0, Math.max(0, width - 1))}…`;
}

export function hiddenRect(): Rect {
  return { column: 0, row: 0, width: 0, height: 0 };
}

function syntheticSources(demo: NeonDemo, phase: number, selected: boolean): SourceFrame[] {
  const base = demo.id.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const specs: Array<{ name: string; accent: Accent; offset: number }> = [
    { name: demo.badge, accent: demo.accent, offset: base % 31 },
    { name: "Harmonic", accent: "signal", offset: base % 17 },
    { name: "Noise", accent: selected ? "amber" : "violet", offset: base % 43 },
  ];

  return specs.map((spec, index) => {
    const series = Array.from(
      { length: 64 },
      (_, sample) => unitWave(phase + sample + spec.offset, 0.12 + index * 0.035, 0.08 + index * 0.025),
    );
    const value = series[series.length - 1] ?? 0.5;
    return {
      id: `demo:${demo.id}:${index}`,
      name: spec.name,
      accent: spec.accent,
      value,
      series,
      detailLines: [`${Math.round(value * 100)}% ${demo.code}`],
    };
  });
}

function syntheticSystemSnapshot(demo: NeonDemo, phase: number): SystemSnapshot {
  const hot = unitWave(phase, 0.08, 0.13);
  return {
    timestamp: Date.now(),
    hostname: "neon-exodus",
    osRelease: "suite",
    uptimeSeconds: phase,
    loadavg: [hot * 2, hot * 1.4, hot],
    cpuOverall: hot * 100,
    cpuCores: [],
    cpuHistory: Array.from({ length: 64 }, (_, index) => unitWave(phase + index, 0.08, 0.03) * 100),
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
    memoryHistory: Array.from({ length: 64 }, (_, index) => unitWave(phase + index, 0.05, 0.1)),
    swapHistory: Array.from({ length: 64 }, (_, index) => unitWave(phase + index, 0.04, 0.2) * 0.35),
    temperatures: [{ label: "CORE", celsius: 40 + hot * 48 }],
    disks: [{
      filesystem: "/dev/neon",
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
    rxHistory: Array.from({ length: 64 }, (_, index) => unitWave(phase + index, 0.11, 0.2)),
    txHistory: Array.from({ length: 64 }, (_, index) => unitWave(phase + index, 0.09, 0.4)),
    processes: [],
    alerts: hot > 0.92 ? [{ severity: "warning", title: demo.badge, detail: "DRIVE SATURATION" }] : [],
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
