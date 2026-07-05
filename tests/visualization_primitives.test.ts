import { assertEquals, assertStringIncludes } from "./deps.ts";
import { createDefaultAsciiOptions } from "../src/three_ascii/options.ts";
import { emptySnapshot } from "../app/system_metrics_snapshot.ts";
import { buildVisualizationDrive } from "../app/visualization_drive.ts";
import {
  alertText,
  driveAlert,
  hottestAccent,
  sceneAlert,
  sourceDetailFooter,
  sourceFooter,
  sourceNameMatrix,
  sourceWarnings,
} from "../app/visualization_panel_helpers.ts";
import {
  barChart,
  createMatrix,
  crop,
  drawEllipse,
  drawLine,
  gridify,
  miniMeter,
  plotHistory,
  renderMatrix,
  setCell,
  signalChart,
} from "../app/visualization_primitives.ts";
import type { RenderContext, SourceFrame } from "../app/types.ts";

const sources: SourceFrame[] = [
  {
    id: "cpu",
    name: "cpu-main-node",
    accent: "signal",
    value: 0.72,
    series: [0.15, 0.3, 0.55, 0.82, 0.64, 0.91, 0.48, 0.72],
    detailLines: ["LOAD AVG 1.00"],
  },
  {
    id: "gpu",
    name: "gpu",
    accent: "alarm",
    value: 0.96,
    series: [0.82, 0.9, 0.96],
    detailLines: ["THERMAL LIMIT"],
  },
];

const context: RenderContext = {
  width: 32,
  height: 8,
  phase: 17,
  slot: {
    id: "cpu",
    name: "CPU",
    visualizationId: "demo",
    inputSourceIds: [],
    cycleEnabled: false,
    cycleIntervalMs: 1000,
    ascii: createDefaultAsciiOptions(),
  },
  system: {
    ...emptySnapshot("host", "os", 4),
    alerts: [{ title: "GPU HOT", detail: "96%", severity: "warning" }],
  },
  sources,
};

Deno.test("visualization primitives crop and gridify text cells", () => {
  assertEquals(crop("abcdef", 4), "abc…");
  assertEquals(crop("abc", 4), "abc");
  const grid = gridify(["alpha", "beta", "gamma"], 36);
  assertStringIncludes(grid, "alpha");
  assertStringIncludes(grid, "gamma");
});

Deno.test("visualization primitives render meters and charts", () => {
  assertEquals(miniMeter(0.5, 6, 0.1), "[▒▒▒···]");
  assertStringIncludes(signalChart([0, 0.5, 1], 6, 3, "*"), "*");
  assertStringIncludes(plotHistory([0, 0.5, 1], 6, 3, "*"), "*");
  assertStringIncludes(barChart([0, 0.5, 1], 6, 3, [" ", ".", "#"]), "#");
});

Deno.test("visualization primitives draw bounded matrix shapes", () => {
  const matrix = createMatrix(8, 4, ".");
  setCell(matrix, 1, 1, "A");
  setCell(matrix, -1, 1, "X");
  drawLine(matrix, 0, 0, 7, 3, "/");
  drawEllipse(matrix, 4, 2, 2, 1, "o");

  const rendered = renderMatrix(matrix);
  assertStringIncludes(rendered, "A");
  assertStringIncludes(rendered, "/");
  assertStringIncludes(rendered, "o");
  assertEquals(rendered.split("\n").length, 4);
});

Deno.test("visualization panel helpers format source and alert summaries", () => {
  const drive = buildVisualizationDrive(context, 32);

  assertEquals(alertText(context), "GPU HOT / 96%");
  assertEquals(hottestAccent(sources), "alarm");
  assertEquals(sourceFooter(sources), "SRC CPU-MAIN-NO… + GPU");
  assertEquals(sourceDetailFooter(sources), "CPU-MAI… LOAD AVG 1.00 / GPU THERMAL LIMIT");
  assertEquals(sceneAlert(sources), "GPU CRIT");
  assertEquals(sourceNameMatrix(sources), "CPU-MAI… / GPU");
  assertEquals(sourceWarnings(sources, drive).slice(0, 2), [
    "CPU-MAIN-NODE  LOAD AVG 1.00",
    "GPU  THERMAL LIMIT",
  ]);
});

Deno.test("visualization panel helpers report highest priority drive state", () => {
  assertEquals(driveAlert({ hazard: 0.93 } as ReturnType<typeof buildVisualizationDrive>), "LIMIT CASCADE");
  assertEquals(
    driveAlert({ hazard: 0.5, divergence: 0.7 } as ReturnType<typeof buildVisualizationDrive>),
    "CHANNEL FRACTURE",
  );
  assertEquals(
    driveAlert({ hazard: 0.5, divergence: 0.2, volatility: 0.6 } as ReturnType<typeof buildVisualizationDrive>),
    "OSCILLATION SPIKE",
  );
  assertEquals(
    driveAlert({
      hazard: 0.5,
      divergence: 0.2,
      volatility: 0.1,
      slope: 0.3,
    } as ReturnType<typeof buildVisualizationDrive>),
    "SURGE FRONT",
  );
});
