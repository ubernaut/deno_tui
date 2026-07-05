import { assertEquals, assertStringIncludes } from "./deps.ts";
import { emptySnapshot } from "../app/system_metrics.ts";
import { buildVisualizationDrive } from "../app/visualization_drive.ts";
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
} from "../app/visualization_fields.ts";

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

Deno.test("visualization fields render bounded multiline text", () => {
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
