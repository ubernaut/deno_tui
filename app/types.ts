import type { Style } from "../src/theme.ts";
import type { TerminalGlyphStyle } from "../src/three_ascii/glyphs.ts";

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

export const viewportModes = ["desktop", "compact", "mobile"] as const;

export type ViewportMode = typeof viewportModes[number];

export const accentIds = ["alarm", "amber", "phosphor", "signal", "violet"] as const;

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

export interface AsciiOptions {
  preset: string;
  border: BorderMode;
  terminalGlyphStyle: TerminalGlyphStyle;
  terminalEdgeBias: number;
  edgeThreshold: number;
  normalThreshold: number;
  depthThreshold: number;
  exposure: number;
  attenuation: number;
  blendWithBase: number;
  depthFalloff: number;
  depthOffset: number;
  wireframeThickness: number;
  edges: boolean;
  fill: boolean;
  invertLuminance: boolean;
  kittyGraphics: boolean;
  kittyDisableAscii: boolean;
}

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

export interface MemorySnapshot {
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
}

export interface AudioCatalogEntry {
  id: string;
  sourceName: string;
  label: string;
  description: string;
  role: "audio-in" | "audio-out";
  isDefault: boolean;
}

export interface AudioMeterSnapshot {
  rms: number;
  peak: number;
  history: number[];
  active: boolean;
}

export interface SourceDescriptor {
  id: string;
  name: string;
  description: string;
  group: string;
  kind: "system" | "audio" | "synthetic";
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

export type MenuKind = "help" | "routing" | "layout" | "options";

export interface MenuState {
  kind: MenuKind;
  column: number;
  index: number;
  targetSlotId: SlotId;
}

export interface AppState {
  layout: LayoutId;
  selectedSlotId: SlotId;
  phase: number;
  sourceCatalog: SourceDescriptor[];
  slots: Record<SlotId, SlotConfig>;
  menu: MenuState | null;
}

export type Rect = {
  column: number;
  row: number;
  width: number;
  height: number;
};

export interface MenuLine {
  text: string;
  style: Style;
}
