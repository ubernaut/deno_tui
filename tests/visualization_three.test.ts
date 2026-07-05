import { assert, assertEquals, assertMatch } from "./deps.ts";
import { createDefaultAsciiOptions } from "../src/three_ascii/options.ts";
import { emptySnapshot } from "../app/system_metrics_snapshot.ts";
import type { RenderContext, SlotConfig, SourceFrame, SystemSnapshot, ThreeSceneMode } from "../app/types.ts";
import { buildVisualizationDrive } from "../app/visualization_drive.ts";
import {
  appendThreeSceneFooter,
  driveThreeSignal,
  modeTwist,
  renderThreeFallbackBody,
  threeSceneModeLabel,
} from "../app/visualization_three.ts";

const fallbackContext: RenderContext = {
  width: 28,
  height: 8,
  phase: 23,
  slot: {
    id: "cpu",
    name: "CPU",
    visualizationId: "three-lattice",
    inputSourceIds: ["sys:cpu"],
    cycleEnabled: false,
    cycleIntervalMs: 1000,
    ascii: createDefaultAsciiOptions(),
  },
  system: emptySnapshot("host", "linux", 4),
  sources: [{
    id: "sys:cpu",
    name: "cpu-main-node",
    accent: "signal",
    value: 0.72,
    series: [0.15, 0.3, 0.55, 0.82, 0.64, 0.91, 0.48, 0.72],
    detailLines: ["LOAD AVG 1.00"],
  }],
};

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

Deno.test("three fallback footer preserves primitive mode context", () => {
  assertEquals(
    appendThreeSceneFooter("SRC CPU", "lattice", 32),
    `SRC CPU / ${threeSceneModeLabel("lattice")} PRIMITIVES`,
  );
  assertEquals(appendThreeSceneFooter("", "field", 16), `${threeSceneModeLabel("field")} PRIMITIVES`);
});

Deno.test("three fallback body renders bounded mode-specific text fields", () => {
  const drive = buildVisualizationDrive(fallbackContext, 32);
  const body = renderThreeFallbackBody(fallbackContext, drive, "lattice");
  const lines = body.split("\n");

  assertMatch(body, /LATTICE DRIVE/);
  assertMatch(body, /CPU-MAI/u);
  assert(lines.length >= 3);
  assert(lines.every((line) => line.length <= fallbackContext.width));
});

Deno.test("three fallback body covers all scene modes with visible output", () => {
  const drive = buildVisualizationDrive(fallbackContext, 32);
  const modes: ThreeSceneMode[] = [
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
  ];

  for (const mode of modes) {
    const body = renderThreeFallbackBody(fallbackContext, drive, mode);
    assert(body.trim().length > 0, mode);
    assertMatch(body, new RegExp(`${threeSceneModeLabel(mode)} DRIVE`));
  }
});

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
