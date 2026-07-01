import { assert, assertEquals, assertMatch } from "./deps.ts";
import { createDefaultAsciiOptions } from "../app/ascii_options.ts";
import { emptySnapshot } from "../app/system_metrics_snapshot.ts";
import type { RenderContext, ThreeSceneMode } from "../app/types.ts";
import { buildVisualizationDrive } from "../app/visualization_drive.ts";
import {
  appendThreeSceneFooter,
  renderThreeFallbackBody,
  threeSceneModeLabel,
} from "../app/visualization_three_fallback.ts";

const context: RenderContext = {
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

Deno.test("three fallback footer preserves primitive mode context", () => {
  assertEquals(
    appendThreeSceneFooter("SRC CPU", "lattice", 32),
    `SRC CPU / ${threeSceneModeLabel("lattice")} PRIMITIVES`,
  );
  assertEquals(appendThreeSceneFooter("", "field", 16), `${threeSceneModeLabel("field")} PRIMITIVES`);
});

Deno.test("three fallback body renders bounded mode-specific text fields", () => {
  const drive = buildVisualizationDrive(context, 32);
  const body = renderThreeFallbackBody(context, drive, "lattice");
  const lines = body.split("\n");

  assertMatch(body, /LATTICE DRIVE/);
  assertMatch(body, /CPU-MAI/u);
  assert(lines.length >= 3);
  assert(lines.every((line) => line.length <= context.width));
});

Deno.test("three fallback body covers all scene modes with visible output", () => {
  const drive = buildVisualizationDrive(context, 32);
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
    const body = renderThreeFallbackBody(context, drive, mode);
    assert(body.trim().length > 0, mode);
    assertMatch(body, new RegExp(`${threeSceneModeLabel(mode)} DRIVE`));
  }
});
