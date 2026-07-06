import { assertEquals, assertStringIncludes } from "./deps.ts";
import { Signal } from "../src/signals/mod.ts";
import { canvasRowText, createTestCanvas } from "../src/testing/mod.ts";
import { createDefaultAsciiOptions } from "../src/three_ascii/options.ts";
import { emptySnapshot } from "../app/system_metrics.ts";
import { ListView, MultilineTextView, PanelView } from "../app/ui.ts";
import { buildVisualizationDrive } from "../app/visualization_drive.ts";
import {
  alertText,
  barChart,
  createMatrix,
  crop,
  drawEllipse,
  drawLine,
  driveAlert,
  formatLoadAverage,
  gridify,
  hottestAccent,
  miniMeter,
  plotHistory,
  renderMatrix,
  sceneAlert,
  setCell,
  severityForValue,
  signalChart,
  sourceDetailFooter,
  sourceFooter,
  sourceNameMatrix,
  sourceWarnings,
} from "../app/visualization_primitives.ts";
import {
  biosignalStrip,
  channelMatrix,
  circularField,
  componentIndex,
  harmonicField,
  heatmap,
  liveFeed,
  networkTopology,
  psychograph,
  routeBoard,
  tacticalMap,
  telemetryRack,
} from "../app/visualizations.ts";
import type { BorderMode, MenuLine, Rect, RenderContext, SourceFrame } from "../app/types.ts";

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

Deno.test("app multiline and list views allocate visible rows and grow on resize", () => {
  const canvas = createTestCanvas({ size: { columns: 40, rows: 30 } });

  const textRect = new Signal<Rect>({ column: 0, row: 0, width: 20, height: 4 });
  const textView = new MultilineTextView({
    canvas,
    rectangle: textRect,
    text: new Signal(Array.from({ length: 64 }, (_, index) => `LINE ${index}`).join("\n")),
    style: new Signal((text: string) => text),
    zIndex: 1,
    lineLimit: 1024,
  });

  const listRect = new Signal<Rect>({ column: 0, row: 5, width: 20, height: 3 });
  const listLines = new Signal<MenuLine[]>(
    Array.from({ length: 64 }, (_, index) => ({ text: `ITEM ${index}`, style: (text: string) => text })),
  );
  const listView = new ListView({
    canvas,
    rectangle: listRect,
    lines: listLines,
    zIndex: 2,
  });

  textView.draw();
  listView.draw();

  assertEquals(textView.lines.length, 4);
  assertEquals(listView.lines.length, 3);

  textRect.value = { column: 0, row: 0, width: 20, height: 9 };
  listRect.value = { column: 0, row: 5, width: 20, height: 7 };

  assertEquals(textView.lines.length, 9);
  assertEquals(listView.lines.length, 7);
});

Deno.test("app multiline views render from a scroll offset", () => {
  const canvas = createTestCanvas({ size: { columns: 32, rows: 8 } });
  const offset = new Signal(2);
  const textView = new MultilineTextView({
    canvas,
    rectangle: new Signal<Rect>({ column: 0, row: 0, width: 18, height: 3 }),
    text: new Signal(["ZERO", "ONE", "TWO", "THREE", "FOUR"].join("\n")),
    style: new Signal((text: string) => text),
    zIndex: 1,
    lineOffset: offset,
  });

  textView.draw();
  canvas.render();

  assertStringIncludes(canvasRowText(canvas, 0, 18), "TWO");
  assertStringIncludes(canvasRowText(canvas, 2, 18), "FOUR");
});

Deno.test("app panel bodies keep rendering deep lines in tall single-pane layouts", () => {
  const canvas = createTestCanvas({ size: { columns: 64, rows: 360 } });

  const rect = new Signal<Rect>({ column: 0, row: 0, width: 64, height: 340 });
  const bodyLines = Array.from(
    { length: 320 },
    (_, index) => index === 300 ? `LINE ${index} RESIZE MARKER` : `LINE ${index}`,
  );

  const panel = new PanelView({
    canvas,
    rectangle: rect,
    title: new Signal("CPU / TEST"),
    alert: new Signal(""),
    body: new Signal(bodyLines.join("\n")),
    footer: new Signal("FOOTER"),
    backgroundStyle: new Signal((text: string) => text),
    frameStyle: new Signal((text: string) => text),
    titleStyle: new Signal((text: string) => text),
    alertStyle: new Signal((text: string) => text),
    bodyStyle: new Signal((text: string) => text),
    footerStyle: new Signal((text: string) => text),
    borderMode: new Signal<BorderMode>("sharp"),
    zIndex: 1,
  });

  panel.draw();
  canvas.render();

  assertStringIncludes(canvasRowText(canvas, 302, 64), "RESIZE MARKER");
});

Deno.test("visualization primitives crop and gridify text cells", () => {
  assertEquals(crop("abcdef", 4), "abc…");
  assertEquals(crop("abc", 4), "abc");
  const grid = gridify(["alpha", "beta", "gamma"], 36);
  assertStringIncludes(grid, "alpha");
  assertStringIncludes(grid, "gamma");
  assertEquals(formatLoadAverage([1, 2.345, 0]), "1.00 / 2.35 / 0.00");
  assertEquals(severityForValue(71, 72, 88), "info");
  assertEquals(severityForValue(72, 72, 88), "warning");
  assertEquals(severityForValue(88, 72, 88), "alarm");
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

Deno.test("visualization fields render bounded multiline text", () => {
  const drive = buildVisualizationDrive(
    {
      phase: 17,
      system: emptySnapshot("host", "os", 4),
      sources: [
        {
          id: "cpu",
          name: "CPU",
          accent: "signal",
          value: 0.72,
          series: [0.15, 0.3, 0.55, 0.82, 0.64, 0.91, 0.48, 0.72],
          detailLines: ["LOAD AVG 1.00"],
        },
        {
          id: "mem",
          name: "MEM",
          accent: "amber",
          value: 0.48,
          series: [0.2, 0.42, 0.51, 0.49, 0.62, 0.57, 0.44, 0.48],
          detailLines: ["USED 48%"],
        },
      ],
    },
    24,
  );
  const fields = [
    harmonicField(24, 6, drive, "*"),
    psychograph(24, 6, drive, "#"),
    circularField(24, 6, drive),
    heatmap(24, 6, drive, [" ", ".", "#"]),
    routeBoard(24, 6, drive, [" ", ".", "+", "#"]),
    tacticalMap(24, 6, drive),
    networkTopology(24, 6, drive),
    liveFeed(24, 6, drive),
    channelMatrix(24, 6, drive),
    telemetryRack(24, 6, drive, [" ", "░", "▒", "▓", "█"]),
    biosignalStrip(24, 6, drive),
    componentIndex(24, 6, drive, ["alpha", "beta", "gamma"]),
  ];

  for (const field of fields) {
    const rows = field.split("\n");
    assertEquals(rows.length, 6);
    assertEquals(rows.every((row) => row.length === 24), true);
  }
  assertStringIncludes(fields[0], "*");
  assertStringIncludes(fields[1], "#");
  assertStringIncludes(fields[2], "◆");
  assertStringIncludes(fields[3], ".");
  assertStringIncludes(fields[4], "█");
  assertStringIncludes(fields[5], "/");
  assertStringIncludes(fields[6], "●");
  assertStringIncludes(fields[7], "│");
  assertStringIncludes(fields[8], "│");
  assertStringIncludes(fields[9], "CPU");
  assertStringIncludes(fields[10], "PULSE");
  assertStringIncludes(fields[11], "ALPHA");
});
