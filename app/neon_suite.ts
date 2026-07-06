import { createDefaultAsciiOptions } from "../src/three_ascii/options.ts";
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
import { stringSeed, unitWave, waveSeries } from "./visualization_primitives.ts";
import { renderVisualization } from "./visualizations.ts";

export type NeonSuiteSection = NeonSection | "all";
type NeonRenderMode = "card" | "compact" | "dense" | "max";

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

const demosById = new Map<string, NeonDemo>();
for (const demo of demos) demosById.set(demo.id, demo);

const neonOpenTuiDemoIds = neonDemoIds({ includeTallWebLast: false });

const neonWebDemoIds = neonDemoIds({ includeTallWebLast: true });

export function neonDemosForSection(
  section: NeonSuiteSection,
  options: { source?: "opentui" | "web" | "extended" } = {},
): NeonDemo[] {
  const ids = options.source === "web" ? neonWebDemoIds : options.source === "opentui" ? neonOpenTuiDemoIds : undefined;
  const source = ids ? demosForIds(ids) : demos;
  if (section === "all") return source;
  const filtered: NeonDemo[] = [];
  for (let index = 0; index < source.length; index += 1) {
    const demo = source[index]!;
    if (demo.section === section) filtered.push(demo);
  }
  return filtered;
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

function buildNeonRenderContext(options: {
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
  const suite = source === "opentui" ? neonOpenTuiDemoIds : source === "web" ? neonWebDemoIds : undefined;
  const entries = suite ? demosForIds(suite) : demos;
  const sections: Record<NeonSection, number> = {
    overview: 0,
    signals: 0,
    control: 0,
    three: 0,
  };
  let threeCount = 0;
  for (let index = 0; index < entries.length; index += 1) {
    const section = entries[index]!.section;
    sections[section] += 1;
    if (section === "three") threeCount += 1;
  }
  return {
    source,
    count: entries.length,
    sections,
    threeCount,
  };
}

function neonDemoIds(options: { includeTallWebLast: boolean }): string[] {
  const ids: string[] = [];
  if (!options.includeTallWebLast) {
    for (let index = 0; index < demos.length; index += 1) {
      const demo = demos[index]!;
      if (demo.id !== "three-ascii-studio") ids.push(demo.id);
    }
    return ids;
  }

  for (let index = 0; index < demos.length; index += 1) {
    const demo = demos[index]!;
    if (demo.id !== "three-ascii-studio" && !tallWebDemoIds.has(demo.id)) ids.push(demo.id);
  }
  for (let index = 0; index < demos.length; index += 1) {
    const demo = demos[index]!;
    if (demo.id !== "three-ascii-studio" && tallWebDemoIds.has(demo.id)) ids.push(demo.id);
  }
  return ids;
}

function demosForIds(ids: readonly string[]): NeonDemo[] {
  const found: NeonDemo[] = [];
  for (let index = 0; index < ids.length; index += 1) {
    const demo = demosById.get(ids[index]!);
    if (demo) found.push(demo);
  }
  return found;
}

export function formatNeonSuiteAlert(
  summary: Pick<ReturnType<typeof neonSuiteSummary>, "count" | "threeCount">,
  width = 48,
): string {
  if (width < 16) return `${summary.count}/${summary.threeCount} 3D`;
  if (width < 24) return `${summary.count} demos`;
  if (width < 40) return `${summary.count} demos / ${summary.threeCount} 3D`;
  return `${summary.count} DEMOS / ${summary.threeCount} THREE.JS SCENES`;
}

export function fitText(text: string, width: number): string {
  if (width <= 0) return "";
  return text.length <= width ? text : `${text.slice(0, Math.max(0, width - 1))}…`;
}

export function hiddenRect(): Rect {
  return { column: 0, row: 0, width: 0, height: 0 };
}

export function emptyNeonSuiteRender(): PanelRender {
  return {
    body: "",
    footer: "",
    alert: "",
    accent: "signal",
    severity: "info",
  };
}

function syntheticSources(demo: NeonDemo, phase: number, selected: boolean): SourceFrame[] {
  const base = stringSeed(demo.id);
  const specs: Array<{ name: string; accent: Accent; offset: number }> = [
    { name: demo.badge, accent: demo.accent, offset: base % 31 },
    { name: "Harmonic", accent: "signal", offset: base % 17 },
    { name: "Noise", accent: selected ? "amber" : "violet", offset: base % 43 },
  ];

  const sources = new Array<SourceFrame>(specs.length);
  for (let index = 0; index < specs.length; index++) {
    const spec = specs[index]!;
    const series = waveSeries(64, phase + spec.offset, 0.12 + index * 0.035, 0.08 + index * 0.025);
    const value = series[series.length - 1] ?? 0.5;
    sources[index] = {
      id: `demo:${demo.id}:${index}`,
      name: spec.name,
      accent: spec.accent,
      value,
      series,
      detailLines: [`${Math.round(value * 100)}% ${demo.code}`],
    };
  }
  return sources;
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
    cpuHistory: waveSeries(64, phase, 0.08, 0.03, 100),
    gpu: {
      available: true,
      name: "NEON RENDER CORE",
      utilizationPercent: hot * 100,
      memoryUsed: hot * 18 * 1024 ** 3,
      memoryTotal: 24 * 1024 ** 3,
      memoryPercent: hot * 75,
      temperatureCelsius: 36 + hot * 47,
      powerWatts: 85 + hot * 220,
      graphicsClockMhz: 1500 + hot * 950,
      memoryClockMhz: 9000 + hot * 1200,
    },
    gpuUtilizationHistory: waveSeries(64, phase, 0.075, 0.29),
    gpuMemoryHistory: waveSeries(64, phase, 0.045, 0.51),
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
    memoryHistory: waveSeries(64, phase, 0.05, 0.1),
    swapHistory: waveSeries(64, phase, 0.04, 0.2, 0.35),
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
    rxHistory: waveSeries(64, phase, 0.11, 0.2),
    txHistory: waveSeries(64, phase, 0.09, 0.4),
    processes: [],
    alerts: hot > 0.92 ? [{ severity: "warning", title: demo.badge, detail: "DRIVE SATURATION" }] : [],
    diagnostics: [],
  };
}
