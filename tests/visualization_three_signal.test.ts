import { assert, assertEquals } from "./deps.ts";
import { driveThreeSignal, modeTwist } from "../app/visualization_three_signal.ts";
import { buildVisualizationDrive } from "../app/visualization_drive.ts";
import type { RenderContext, SlotConfig, SourceFrame, SystemSnapshot } from "../app/types.ts";

const slot: SlotConfig = {
  id: "cpu",
  name: "CPU",
  visualizationId: "three-lattice",
  inputSourceIds: [],
  cycleEnabled: false,
  cycleIntervalMs: 0,
  ascii: {} as SlotConfig["ascii"],
};

const system: SystemSnapshot = {
  timestamp: 0,
  hostname: "test-rig",
  osRelease: "linux",
  uptimeSeconds: 1,
  loadavg: [0, 0, 0],
  cpuOverall: 10,
  cpuCores: [],
  cpuHistory: [],
  gpu: {
    available: false,
    name: "",
    utilizationPercent: 0,
    memoryUsed: 0,
    memoryTotal: 0,
    memoryPercent: 0,
    temperatureCelsius: null,
    powerWatts: null,
    graphicsClockMhz: null,
    memoryClockMhz: null,
  },
  gpuUtilizationHistory: [],
  gpuMemoryHistory: [],
  memory: {
    total: 1,
    used: 0,
    available: 1,
    free: 1,
    swapTotal: 0,
    swapUsed: 0,
    percent: 0,
    swapPercent: 0,
  },
  memoryHistory: [],
  swapHistory: [],
  temperatures: [],
  disks: [],
  networks: [],
  rxHistory: [],
  txHistory: [],
  processes: [],
  alerts: [],
  diagnostics: [],
};

const sources: SourceFrame[] = [
  {
    id: "signal",
    name: "Signal",
    accent: "signal",
    value: 0.74,
    series: [0.1, 0.22, 0.38, 0.51, 0.66, 0.74],
    detailLines: [],
  },
];

function context(overrides: Partial<RenderContext> = {}): RenderContext {
  return {
    slot,
    system,
    sources,
    phase: 12,
    width: 48,
    height: 12,
    ...overrides,
  };
}

Deno.test("three visualization signal stays normalized and active", () => {
  const renderContext = context();
  const drive = buildVisualizationDrive(renderContext, 48);
  const signal = driveThreeSignal(renderContext, drive, "lattice");

  assert(signal.x >= 0 && signal.x <= 1);
  assert(signal.y >= 0 && signal.y <= 1);
  assert(signal.depth >= 0.12 && signal.depth <= 0.98);
  assert(signal.pulse >= 0.12 && signal.pulse <= 1);
  assert(signal.active);
  assertEquals(signal.pressed, false);
});

Deno.test("three visualization signal enters pressed state on alarm context", () => {
  const renderContext = context({
    system: {
      ...system,
      alerts: [{ severity: "alarm", title: "LIMIT", detail: "fixture" }],
    },
  });
  const drive = buildVisualizationDrive(renderContext, 48);
  assertEquals(driveThreeSignal(renderContext, drive, "gate").pressed, true);
});

Deno.test("three visualization mode twist exposes distinct mode biases", () => {
  assertEquals(modeTwist("lattice"), { phase: 0, speed: 0.12, offset: 0.18, lift: 0.32 });
  assertEquals(modeTwist("gate"), { phase: 53, speed: 0.12, offset: 0.18, lift: 0.42 });
});
