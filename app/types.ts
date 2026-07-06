import type { Style } from "../src/theme.ts";
import type { ThreeAsciiConfigOptions } from "../src/three_ascii/options.ts";

export const slotIds = [
  "cpu",
  "cpuLegend",
  "gpu",
  "gpuChip",
  "gpuMemory",
  "memory",
  "temperature",
  "disk",
  "network",
  "processes",
] as const;

export type SlotId = typeof slotIds[number];

export const layoutIds = ["monitor", "single", "vertical", "horizontal", "quad"] as const;

export type LayoutId = typeof layoutIds[number];

const viewportModes = ["desktop", "compact", "mobile"] as const;

export type ViewportMode = typeof viewportModes[number];

const accentIds = ["alarm", "amber", "phosphor", "signal", "violet"] as const;

export type Accent = typeof accentIds[number];

export const borderModes = ["rounded", "sharp", "ascii"] as const;

export type BorderMode = typeof borderModes[number];

export const threeSceneModes = [
  "lattice",
  "atfield",
  "hexshell",
  "capture",
  "mapslab",
  "solenoid",
  "studio",
  "emergency",
  "counter",
  "plug",
  "surveillance",
  "relay",
  "rack",
  "scope",
  "biosignal",
  "harmonic",
  "psychograph",
  "field",
  "heat",
  "route",
  "topology",
  "command",
  "launch",
  "magi",
  "target",
  "waveform",
  "angel",
  "gate",
] as const;

export type ThreeSceneMode = typeof threeSceneModes[number];

export type Severity = "info" | "warning" | "alarm";

export type AsciiOptions = ThreeAsciiConfigOptions;

export interface SlotConfig {
  id: SlotId;
  name: string;
  visualizationId: string;
  inputSourceIds: string[];
  cycleEnabled: boolean;
  cycleIntervalMs: number;
  ascii: AsciiOptions;
}

export interface AlertMessage {
  severity: Severity;
  title: string;
  detail: string;
}

export interface CpuCoreSnapshot {
  label: string;
  usage: number;
}

interface MemorySnapshot {
  total: number;
  used: number;
  available: number;
  free: number;
  swapTotal: number;
  swapUsed: number;
  percent: number;
  swapPercent: number;
}

export interface TemperatureSnapshot {
  label: string;
  celsius: number;
}

export interface DiskSnapshot {
  filesystem: string;
  mount: string;
  total: number;
  used: number;
  available: number;
  percent: number;
}

export interface NetworkSnapshot {
  name: string;
  addresses: string[];
  rxBytes: number;
  txBytes: number;
  rxRate: number;
  txRate: number;
}

export interface ProcessSnapshot {
  pid: number;
  name: string;
  state: string;
  cpuPercent: number;
  memoryPercent: number;
  memoryBytes: number;
  processor?: number;
}

export interface GpuSnapshot {
  available: boolean;
  name: string;
  utilizationPercent: number;
  memoryUsed: number;
  memoryTotal: number;
  memoryPercent: number;
  temperatureCelsius: number | null;
  powerWatts: number | null;
  graphicsClockMhz: number | null;
  memoryClockMhz: number | null;
}

type SystemMetricStatus = "ok" | "degraded" | "unavailable" | "limited" | "stale";

export interface SystemMetricDiagnostic {
  source: string;
  status: SystemMetricStatus;
  detail: string;
  durationMs?: number;
  sampledAt: number;
}

export interface SystemSnapshot {
  timestamp: number;
  hostname: string;
  osRelease: string;
  uptimeSeconds: number;
  loadavg: [number, number, number];
  cpuOverall: number;
  cpuCores: CpuCoreSnapshot[];
  cpuHistory: number[];
  gpu: GpuSnapshot;
  gpuUtilizationHistory: number[];
  gpuMemoryHistory: number[];
  memory: MemorySnapshot;
  memoryHistory: number[];
  swapHistory: number[];
  temperatures: TemperatureSnapshot[];
  disks: DiskSnapshot[];
  networks: NetworkSnapshot[];
  rxHistory: number[];
  txHistory: number[];
  processes: ProcessSnapshot[];
  alerts: AlertMessage[];
  diagnostics: SystemMetricDiagnostic[];
}

export interface AudioCatalogEntry {
  id: string;
  sourceName: string;
  label: string;
  description: string;
  role: "audio-in" | "audio-out";
  isDefault: boolean;
}

export interface SourceFrame {
  id: string;
  name: string;
  accent: Accent;
  value: number;
  series: number[];
  detailLines: string[];
}

export interface PanelRender {
  title?: string;
  body: string;
  footer: string;
  alert: string;
  accent: Accent;
  severity: Severity;
  three?: {
    mode: ThreeSceneMode;
    signal: ThreeSceneSignal;
  };
}

export interface ThreeSceneSignal {
  x: number;
  y: number;
  depth: number;
  twist: number;
  lift: number;
  pulse: number;
  active: boolean;
  pressed: boolean;
}

export interface VisualizationDescriptor {
  id: string;
  name: string;
  accent: Accent;
  description: string;
}

export interface RenderContext {
  slot: SlotConfig;
  system: SystemSnapshot;
  sources: SourceFrame[];
  phase: number;
  width: number;
  height: number;
  selectedCpuLabel?: string;
}

type MenuKind = "help" | "routing" | "layout" | "options";

export interface MenuState {
  kind: MenuKind;
  column: number;
  index: number;
  targetSlotId: SlotId;
}

export type Rect = {
  column: number;
  row: number;
  width: number;
  height: number;
};

interface ThreeAsciiDemoWindowOptions {
  terminalWidth: number;
  terminalHeight: number;
  menuVisible: boolean;
  minimized: boolean;
  maximized: boolean;
  menuOuterWidth?: number;
  panelGap?: number;
  minBodyWidth?: number;
}

type ThreeAsciiDemoTitlebarControl = "minimize" | "maximize" | "restore" | "close";

export const THREE_ASCII_DEMO_WINDOW_CONTROL_TEXT = "[-] [M] [R] [x]";
export const THREE_ASCII_DEMO_WINDOW_CONTROL_WIDTH = 15;
const THREE_ASCII_DEMO_WINDOW_COMPACT_CONTROL_TEXT = "[-][M][R][x]";
const THREE_ASCII_DEMO_WINDOW_COMPACT_CONTROL_WIDTH = 12;

export function threeAsciiDemoSidePanelVisible(
  options: Pick<ThreeAsciiDemoWindowOptions, "menuVisible" | "minimized" | "maximized">,
): boolean {
  return options.menuVisible && !options.maximized && !options.minimized;
}

export function layoutThreeAsciiDemoWindow(options: ThreeAsciiDemoWindowOptions): Rect {
  const menuOuterWidth = Math.max(0, Math.floor(options.menuOuterWidth ?? 36));
  const panelGap = Math.max(0, Math.floor(options.panelGap ?? 2));
  const minBodyWidth = Math.max(1, Math.floor(options.minBodyWidth ?? 64));
  const terminalWidth = Math.max(0, Math.floor(options.terminalWidth));
  const terminalHeight = Math.max(0, Math.floor(options.terminalHeight));
  const availableWidth = Math.max(0, terminalWidth - 4);
  const reservePanel = threeAsciiDemoSidePanelVisible(options) &&
    terminalWidth >= minBodyWidth + menuOuterWidth + panelGap + 4;

  return {
    column: 2,
    row: 2,
    width: Math.max(1, availableWidth - (reservePanel ? menuOuterWidth + panelGap : 0)),
    height: options.minimized ? 3 : Math.max(10, terminalHeight - 4),
  };
}

export function threeAsciiDemoBodyRect(rect: Rect): Rect {
  return {
    column: rect.column + 1,
    row: rect.row + 1,
    width: Math.max(1, rect.width - 2),
    height: Math.max(1, rect.height - 2),
  };
}

export function threeAsciiDemoTitleRect(rect: Rect): Rect {
  return {
    column: rect.column + 2,
    row: rect.row,
    width: Math.max(0, rect.width - THREE_ASCII_DEMO_WINDOW_CONTROL_WIDTH - 4),
    height: 1,
  };
}

export function threeAsciiDemoControlRect(rect: Rect): Rect {
  const controlWidth = threeAsciiDemoControlWidth(rect.width);
  return {
    column: rect.column + Math.max(1, rect.width - controlWidth - 1),
    row: rect.row,
    width: controlWidth,
    height: 1,
  };
}

export function threeAsciiDemoControlText(rect: Rect): string {
  const width = threeAsciiDemoControlWidth(rect.width);
  if (width === THREE_ASCII_DEMO_WINDOW_CONTROL_WIDTH) return THREE_ASCII_DEMO_WINDOW_CONTROL_TEXT;
  if (width === THREE_ASCII_DEMO_WINDOW_COMPACT_CONTROL_WIDTH) return THREE_ASCII_DEMO_WINDOW_COMPACT_CONTROL_TEXT;
  return "";
}

export function threeAsciiDemoTitlebarControlAt(
  rect: Rect,
  x: number,
  y: number,
): ThreeAsciiDemoTitlebarControl | undefined {
  const controls = threeAsciiDemoControlRect(rect);
  if (controls.width <= 0 || y !== controls.row) return undefined;
  const gap = controls.width === THREE_ASCII_DEMO_WINDOW_CONTROL_WIDTH ? 1 : 0;
  if (x >= controls.column && x < controls.column + 3) return "minimize";
  if (x >= controls.column + 3 + gap && x < controls.column + 6 + gap) return "maximize";
  if (x >= controls.column + 6 + gap * 2 && x < controls.column + 9 + gap * 2) return "restore";
  if (x >= controls.column + 9 + gap * 3 && x < controls.column + 12 + gap * 3) return "close";
  return undefined;
}

function threeAsciiDemoControlWidth(windowWidth: number): number {
  if (windowWidth >= THREE_ASCII_DEMO_WINDOW_CONTROL_WIDTH + 2) return THREE_ASCII_DEMO_WINDOW_CONTROL_WIDTH;
  if (windowWidth >= THREE_ASCII_DEMO_WINDOW_COMPACT_CONTROL_WIDTH + 2) {
    return THREE_ASCII_DEMO_WINDOW_COMPACT_CONTROL_WIDTH;
  }
  return 0;
}

export interface MenuLine {
  text: string;
  style: Style;
}
