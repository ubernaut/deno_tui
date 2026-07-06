import { assert, assertEquals, assertMatch, assertStringIncludes } from "./deps.ts";
import { createDefaultAsciiOptions } from "../src/three_ascii/options.ts";
import { emptySystemSnapshot } from "./fixtures/system_snapshot.ts";
import type { RenderContext, SlotConfig, SourceFrame, SystemSnapshot } from "../app/types.ts";
import { compactSpaces, maxTrimmedTextWidth } from "../src/app/workbench_text.ts";
import { createNeonThreeScene } from "../app/neon_three.ts";
import { renderVisualization } from "../app/visualizations.ts";
import type { Object3D } from "three";

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
  system: emptySystemSnapshot("host", "linux", 4),
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
  const lattice = renderVisualization({
    ...fallbackContext,
    width: 32,
    slot: { ...fallbackContext.slot, visualizationId: "three-lattice" },
  });
  const field = renderVisualization({
    ...fallbackContext,
    width: 24,
    slot: { ...fallbackContext.slot, visualizationId: "field-ring" },
  });

  assertStringIncludes(lattice.footer, "LATTICE PRIMITIVES");
  assertStringIncludes(field.footer, "FIELD PRIMITIVES");
});

Deno.test("studio Three scene framing tightens for wide terminal panes", () => {
  function frameStudioAspect(aspect: number) {
    const bundle = createNeonThreeScene("studio");
    const group = bundle.scene.children.find((child: Object3D) => child.type === "Group");
    assert(group);

    bundle.camera.aspect = aspect;
    bundle.tick(1000, {
      x: 0.5,
      y: 0.5,
      depth: 0.5,
      twist: 0,
      lift: 0,
      pulse: 0.5,
      active: true,
      pressed: false,
    });
    const result = {
      cameraY: bundle.camera.position.y,
      cameraZ: bundle.camera.position.z,
      groupScale: group.scale.x,
    };
    bundle.dispose();
    return result;
  }

  const normal = frameStudioAspect(1.2);
  const wide = frameStudioAspect(1.95);
  const tall = frameStudioAspect(0.75);

  assert(wide.cameraZ < normal.cameraZ);
  assert(wide.cameraY < normal.cameraY);
  assert(wide.groupScale > normal.groupScale);
  assert(tall.cameraZ > normal.cameraZ);
  assertEquals(tall.groupScale, 1);
});

Deno.test("three fallback body renders bounded mode-specific text fields", () => {
  const body = renderVisualization(fallbackContext).body;
  const lines = body.split("\n");

  assertMatch(body, /LATTICE DRIVE/);
  assertMatch(body, /CPU-MAI/u);
  assert(lines.length >= 3);
  assert(lines.every((line) => line.length <= fallbackContext.width));
});

Deno.test("three visualization renderer exposes a chunky text fallback body", () => {
  const rendered = renderVisualization(fallbackContext);

  assertMatch(rendered.body, /LATTICE DRIVE/);
  assertMatch(rendered.body, /[█▇▆▅▄▃▂▁]/u);
  assertEquals(rendered.three?.mode, "lattice");
});

Deno.test("three fallback body covers all scene modes with visible output", () => {
  const cases = [
    ["three-lattice", "lattice", "LATTICE DRIVE"],
    ["three-atfield", "atfield", "AT-FIELD DRIVE"],
    ["three-hexshell", "hexshell", "HEX SHELL DRIVE"],
    ["three-capture", "capture", "CAPTURE DRIVE"],
    ["three-mapslab", "mapslab", "MAP SLAB DRIVE"],
    ["three-solenoid", "solenoid", "SOLENOID DRIVE"],
    ["three-ascii-studio", "studio", "ACEROLA DRIVE"],
  ];

  for (const [visualizationId, mode, bodyHeading] of cases) {
    const rendered = renderVisualization({
      ...fallbackContext,
      slot: { ...fallbackContext.slot, visualizationId },
    });

    assert(rendered.body.trim().length > 0, visualizationId);
    assertStringIncludes(rendered.body, bodyHeading);
    assertEquals(rendered.three?.mode, mode);
  }
});

Deno.test("three visualization signal stays normalized and active", () => {
  const signal = renderVisualization(context()).three?.signal;

  assert(signal);
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
    slot: { ...slot, visualizationId: "gate-status" },
  });
  const rendered = renderVisualization(renderContext);

  assertEquals(rendered.three?.mode, "gate");
  assertEquals(rendered.three?.signal.pressed, true);
});

Deno.test("three visualization modes project distinct public signals", () => {
  const lattice = renderVisualization({
    ...context({ phase: 40 }),
    slot: { ...slot, visualizationId: "three-lattice" },
  }).three?.signal;
  const gate = renderVisualization({
    ...context({ phase: 40 }),
    slot: { ...slot, visualizationId: "gate-status" },
  }).three?.signal;

  assert(lattice);
  assert(gate);
  assert(lattice.twist !== gate.twist || lattice.lift !== gate.lift);
});

Deno.test("compactSpaces and maxTrimmedTextWidth keep display helpers deterministic", () => {
  assertEquals(compactSpaces("  a   b\n c  "), "a b c");
  assertEquals(maxTrimmedTextWidth(["abc   ", "abcdef", "x"]), 6);
});
