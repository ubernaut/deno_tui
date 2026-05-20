import { assertMatch } from "./deps.ts";
import { renderVisualization } from "../app/visualizations.ts";
import type { RenderContext, SlotConfig, SystemSnapshot } from "../app/types.ts";

const baseSystem: SystemSnapshot = {
  timestamp: Date.now(),
  hostname: "signal-desk",
  osRelease: "linux",
  uptimeSeconds: 1234,
  loadavg: [0.5, 0.7, 0.9],
  cpuOverall: 42,
  cpuCores: [],
  cpuHistory: [],
  memory: {
    total: 1,
    used: 1,
    available: 1,
    free: 1,
    swapTotal: 1,
    swapUsed: 0,
    percent: 42,
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
};

function renderThreeFallback(visualizationId: SlotConfig["visualizationId"]) {
  const slot: SlotConfig = {
    id: "cpu",
    name: "CPU",
    visualizationId,
    inputSourceIds: ["sys:cpu"],
    cycleEnabled: false,
    cycleIntervalMs: 10000,
    ascii: {
      preset: "opentui-blocks",
      border: "sharp",
      terminalEdgeBias: 1.45,
      edgeThreshold: 14,
      normalThreshold: 0.24,
      depthThreshold: 0.15,
      exposure: 1.28,
      attenuation: 0.96,
      blendWithBase: 1,
      depthFalloff: 0.04,
      depthOffset: 150,
      edges: false,
      fill: true,
      invertLuminance: false,
    },
  };

  const context: RenderContext = {
    slot,
    system: baseSystem,
    phase: 12,
    width: 24,
    height: 8,
    sources: [{
      id: "sys:cpu",
      name: "CPU",
      accent: "signal",
      value: 0.64,
      series: [0.1, 0.2, 0.45, 0.7, 0.9, 0.6, 0.4, 0.65, 0.8, 0.55],
      detailLines: ["LOAD AVG 0.50"],
    }],
  };

  return renderVisualization(context);
}

Deno.test("three visualizations provide a chunky text fallback body", () => {
  const rendered = renderThreeFallback("three-lattice");
  assertMatch(rendered.body, /LATTICE DRIVE/);
  assertMatch(rendered.body, /[█▇▆▅▄▃▂▁]/u);
});
