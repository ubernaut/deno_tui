import { assert, assertEquals, assertMatch, assertStringIncludes } from "./deps.ts";
import { createDefaultWorkbenchAsciiOptions } from "../src/app/workbench_ascii.ts";
import { createDefaultAsciiOptions } from "../src/three_ascii/options.ts";
import { emptySnapshot } from "../app/system_metrics.ts";
import type {
  PanelRender,
  RenderContext,
  SlotConfig,
  SourceFrame,
  SystemSnapshot,
  ThreeSceneMode,
} from "../app/types.ts";
import { buildVisualizationDrive } from "../app/visualization_drive.ts";
import {
  threeRendererModeLabel,
  visualizationTextContentSize,
  visualizationThreeStatusLine,
  workbenchThreeFallbackRowsInto,
  workbenchThreePreviewRowsInto,
  workbenchThreeStatusRowsInto,
  workbenchVisualizationRowsInto,
  type WorkbenchVisualizationWindowOption,
} from "../app/workbench_visualization_window.ts";
import { compactSpaces, maxTrimmedTextWidth } from "../src/app/workbench_text.ts";
import { studioCameraFramingForAspect } from "../app/neon_three.ts";
import {
  appendThreeSceneFooter,
  driveThreeSignal,
  modeTwist,
  renderThreeFallbackBody,
  renderVisualization,
  threeSceneModeLabel,
} from "../app/visualizations.ts";
import type { RowStyle } from "../src/app/workbench_rows.ts";

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

const windowOption: WorkbenchVisualizationWindowOption = {
  label: "CPU Hex Grid",
  description: "core utilization topology",
  group: "Monitor",
};

const windowRender: PanelRender = {
  title: "Hex Grid",
  body: "core 0  12%\ncore 1  95%      ",
  footer: "selected cpu-1",
  alert: "",
  accent: "signal",
  severity: "info",
};

const rowTheme = {
  buttonActiveText: "#ffffff",
  buttonActiveBg: "#7a2cff",
  accent: "#9cff3a",
  good: "#1ee7d2",
  warn: "#ffb02e",
  soft: "#c7b8ff",
  surface: "#101018",
};

const visualizationTheme = {
  background: "#000000",
  danger: "#ff3366",
  muted: "#887799",
  panelSoft: "#21182f",
  soft: "#c7b8ff",
  surface: "#101018",
  text: "#f8f5ff",
  warn: "#ffb02e",
};

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

Deno.test("studio Three scene framing tightens for wide terminal panes", () => {
  const normal = studioCameraFramingForAspect(1.2);
  const wide = studioCameraFramingForAspect(1.95);
  const tall = studioCameraFramingForAspect(0.75);

  assert(wide.cameraZ < normal.cameraZ);
  assert(wide.cameraY < normal.cameraY);
  assert(wide.groupScale > normal.groupScale);
  assert(tall.cameraZ > normal.cameraZ);
  assertEquals(tall.groupScale, 1);
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

Deno.test("three visualization renderer exposes a chunky text fallback body", () => {
  const rendered = renderVisualization(fallbackContext);

  assertMatch(rendered.body, /LATTICE DRIVE/);
  assertMatch(rendered.body, /[█▇▆▅▄▃▂▁]/u);
  assertEquals(rendered.three?.mode, "lattice");
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

Deno.test("workbenchVisualizationRowsInto styles visualization rows and reuses storage", () => {
  const target: RowStyle[] = [{ text: "stale", fg: "x", bg: "y", bold: false }];
  const firstRow = target[0];
  const textRows = ["stale"];
  const rows = workbenchVisualizationRowsInto(target, textRows, windowOption, {
    ...windowRender,
    severity: "warning",
  }, {
    accent: "#9cff3a",
    theme: visualizationTheme,
    contrast: () => "#000000",
  });

  assertEquals(rows === target, true);
  assertEquals(rows[0] === firstRow, true);
  assertEquals(rows[0], { text: " MONITOR · Hex Grid ", fg: "#000000", bg: "#9cff3a", bold: true });
  assertEquals(rows[1], { text: "core utilization topology", fg: "#ffb02e", bg: "#101018", bold: true });
  assertEquals(rows[2], { text: "core 0  12%", fg: "#9cff3a", bg: "#101018", bold: true });
  assertEquals(rows[3], { text: "core 1  95%      ", fg: "#f8f5ff", bg: "#101018", bold: false });
  assertEquals(rows[4], { text: "selected cpu-1", fg: "#887799", bg: "#21182f", bold: undefined });
  assertEquals(textRows, [
    " MONITOR · Hex Grid ",
    "core utilization topology",
    "core 0  12%",
    "core 1  95%      ",
    "selected cpu-1",
  ]);
});

Deno.test("workbenchVisualizationRowsInto maps alarm and info severity", () => {
  const alarm = workbenchVisualizationRowsInto([], [], windowOption, {
    ...windowRender,
    alert: "thermal warning",
    severity: "alarm",
  }, {
    accent: "#9cff3a",
    theme: visualizationTheme,
    contrast: () => "#000000",
  });
  const info = workbenchVisualizationRowsInto([], [], windowOption, { ...windowRender, severity: "info" }, {
    accent: "#9cff3a",
    theme: visualizationTheme,
    contrast: () => "#000000",
  });

  assertEquals(alarm[1], { text: "! thermal warning", fg: "#ff3366", bg: "#101018", bold: true });
  assertEquals(info[1], { text: "core utilization topology", fg: "#c7b8ff", bg: "#101018", bold: false });
});

Deno.test("visualizationTextContentSize expands to rendered text dimensions", () => {
  assertEquals(visualizationTextContentSize(windowRender, 8, 3), {
    width: "selected cpu-1".length,
    height: 5,
  });
  assertEquals(visualizationTextContentSize(windowRender, 40, 8), {
    width: 40,
    height: 8,
  });
});

Deno.test("visualizationThreeStatusLine uses renderer mode labels and compact spacing", () => {
  const ascii = createDefaultWorkbenchAsciiOptions();
  const status = visualizationThreeStatusLine(
    {
      ...windowRender,
      three: {
        mode: "lattice",
        signal: { x: 0, y: 0, depth: 0, twist: 0, lift: 0, pulse: 0, active: true, pressed: false },
      },
    },
    windowOption,
    ascii,
  );
  assertStringIncludes(status, "ACEROLA LATTICE");
  assertStringIncludes(status, threeRendererModeLabel(ascii).toUpperCase());
  assertStringIncludes(status, windowOption.label);
});

Deno.test("workbenchThreeFallbackRowsInto projects styled fallback rows", () => {
  const target = [{ text: "stale" }];
  const rows = workbenchThreeFallbackRowsInto(target, {
    width: 48,
    height: 10,
    terminalGlyphStyle: "blocks",
    rendererAvailable: false,
    theme: rowTheme,
    center: (text) => text,
  });

  assertEquals(rows, target);
  assertEquals(rows[0], {
    text: " THREE ASCII FALLBACK · BLOCKS ",
    fg: rowTheme.buttonActiveText,
    bg: rowTheme.buttonActiveBg,
    bold: true,
  });
  assertEquals(rows[1], {
    text: "WebGPU/WebGL backend unavailable; text preview active",
    fg: rowTheme.warn,
    bg: rowTheme.surface,
    bold: true,
  });
  assertStringIncludes(rows.map((row) => row.text).join("\n"), "TORUS");
  assertEquals(rows.at(-1), {
    text: "scene: torus knot + sphere + box + floor",
    fg: rowTheme.soft,
    bg: rowTheme.surface,
  });
});

Deno.test("workbenchThreeFallbackRowsInto reports warming state without alarm bold", () => {
  const rows = workbenchThreeFallbackRowsInto([], {
    width: 24,
    height: 3,
    terminalGlyphStyle: "mixed",
    rendererAvailable: true,
    theme: rowTheme,
  });

  assertEquals(rows[0]?.text, " THREE ASCII FALLBACK · MIXED ");
  assertEquals(rows[1], { text: "renderer warming up", fg: rowTheme.warn, bg: rowTheme.surface, bold: false });
  assertEquals(rows.length, 4);
});

Deno.test("workbenchThreeStatusRowsInto projects full-width centered status rows", () => {
  const rows = workbenchThreeStatusRowsInto([], {
    width: 9,
    height: 3,
    message: "wait",
    theme: rowTheme,
  });

  assertEquals(rows, [
    { text: "         ", fg: undefined, bg: rowTheme.surface, bold: undefined },
    { text: "  wait   ", fg: rowTheme.warn, bg: rowTheme.surface, bold: undefined },
    { text: "         ", fg: undefined, bg: rowTheme.surface, bold: undefined },
  ]);
});

Deno.test("workbenchThreePreviewRowsInto projects web-safe preview rows", () => {
  const target = ["stale"];
  const orbRows: string[] = [];
  const rows = workbenchThreePreviewRowsInto(target, {
    width: 16,
    height: 9,
    phase: 4,
    tileDensity: 2,
    themeLabel: "Unit-01",
    orbRows,
  });

  assertEquals(rows, target);
  assertEquals(rows[0], " ACEROLA THREE ASCII · MIXED · WEB SAFE PREVIEW ");
  assertStringIncludes(rows[1]!, "WebGPU renderer");
  assertStringIncludes(rows.at(-1)!, "theme Unit-01");
  assertEquals(orbRows.length, 3);
});

Deno.test("workbenchThreePreviewRowsInto clips to short panes and reuses orb storage", () => {
  const target: string[] = [];
  const orbRows = ["old", "rows"];
  const firstOrb = orbRows[0];
  const rows = workbenchThreePreviewRowsInto(target, {
    width: 10,
    height: 4,
    phase: 0,
    tileDensity: -1,
    themeLabel: "Signal",
    orbRows,
  });

  assertEquals(rows.length, 4);
  assertEquals(rows[0], " ACEROLA THREE ASCII · GLYPHS · WEB SAFE PREVIEW ");
  assertEquals(
    workbenchThreePreviewRowsInto([], {
      width: 10,
      height: 4,
      phase: 0,
      tileDensity: 3,
      themeLabel: "Signal",
      orbRows: [],
    })[0],
    " ACEROLA THREE ASCII · BLOCKS · WEB SAFE PREVIEW ",
  );
  assertEquals(orbRows[0] === firstOrb, false);
  assertEquals(orbRows.length, 3);
});

Deno.test("compactSpaces and maxTrimmedTextWidth keep display helpers deterministic", () => {
  assertEquals(compactSpaces("  a   b\n c  "), "a b c");
  assertEquals(maxTrimmedTextWidth(["abc   ", "abcdef", "x"]), 6);
});
