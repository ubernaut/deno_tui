import { assert, assertEquals } from "./deps.ts";
import type { Object3D } from "three";
import { createNeonThreeScene, neonThreeSceneCatalog, neonThreeSceneModeLabel } from "../app/neon_three.ts";
import { demos } from "../app/neon_theme.ts";
import { colors } from "../app/neon_theme.ts";
import {
  cycleDemo,
  demoIndex,
  emptyNeonSuiteRender,
  formatNeonSuiteAlert,
  moveGridSelection,
  neonDemosForSection,
  neonOpenTuiDemoIds,
  neonSuiteSummary,
  neonWebDemoIds,
  renderNeonSuiteDemo,
} from "../app/neon_suite.ts";
import { palette } from "../app/styles.ts";
import { threeSceneModes, type ThreeSceneSignal } from "../app/types.ts";

const signal: ThreeSceneSignal = {
  x: 0.5,
  y: 0.5,
  depth: 0.7,
  twist: 0.2,
  lift: -0.15,
  pulse: 0.8,
  active: true,
  pressed: false,
};

Deno.test("neon suite exposes OpenTUI parity web ordering and extended counts", () => {
  assertEquals(neonOpenTuiDemoIds.length, 24);
  assertEquals(neonWebDemoIds.length, 24);
  assertEquals(neonSuiteSummary("opentui").count, 24);
  assertEquals(neonSuiteSummary("web").count, 24);
  assertEquals(neonSuiteSummary("extended").count, 25);
  assertEquals(neonSuiteSummary("extended").threeCount, 7);
  assertEquals(formatNeonSuiteAlert(neonSuiteSummary("opentui"), 80), "24 DEMOS / 6 THREE.JS SCENES");
  assertEquals(formatNeonSuiteAlert(neonSuiteSummary("opentui"), 32), "24 demos / 6 3D");
  assertEquals(formatNeonSuiteAlert(neonSuiteSummary("opentui"), 14), "24/6 3D");
});

Deno.test("neon theme colors derive from shared app palette", () => {
  assertEquals(colors, {
    void: palette.void,
    alarm: palette.alarm,
    amber: palette.amber,
    phosphor: palette.phosphor,
    signal: palette.signal,
    violet: palette.violet,
  });
});

Deno.test("neon suite all view can use the web dense ordering", () => {
  const web = neonDemosForSection("all", { source: "web" });
  assertEquals(web.length, 24);
  assertEquals(web.at(-1)?.id, "component-index");
  assertEquals(web.some((demo) => demo.id === "three-ascii-studio"), false);

  const extended = neonDemosForSection("three", { source: "extended" });
  assertEquals(extended.map((demo) => demo.id).includes("three-ascii-studio"), true);
});

Deno.test("neon suite selection helpers match OpenTUI grid behavior", () => {
  assertEquals(moveGridSelection(0, "left", 3, 8), 0);
  assertEquals(moveGridSelection(0, "right", 3, 8), 1);
  assertEquals(moveGridSelection(2, "right", 3, 8), 2);
  assertEquals(moveGridSelection(1, "down", 3, 8), 4);
  assertEquals(moveGridSelection(7, "down", 3, 8), 7);
  assertEquals(cycleDemo("overview", "warning-stack", 1, "opentui"), "counter-board");
  assertEquals(demoIndex("three-solenoid", "three", "opentui"), 5);
});

Deno.test("neon suite renderer covers text and three scene demos", () => {
  const warning = demos.find((demo) => demo.id === "warning-stack")!;
  const lattice = demos.find((demo) => demo.id === "three-lattice")!;

  const warningRender = renderNeonSuiteDemo({ demo: warning, phase: 4, width: 48, height: 8, selected: true });
  assertEquals(warningRender.body.includes("ALERT-000"), true);
  assertEquals(warningRender.three, undefined);

  const threeRender = renderNeonSuiteDemo({ demo: lattice, phase: 4, width: 48, height: 8, selected: true });
  assertEquals(threeRender.three?.mode, "lattice");
  assertEquals(emptyNeonSuiteRender(), {
    body: "",
    footer: "",
    alert: "",
    accent: "signal",
    severity: "info",
  });
});

Deno.test("neon suite maps non-text NGE widgets to primitive three scenes", () => {
  const matrix = demos.find((demo) => demo.id === "channel-matrix")!;
  const warning = demos.find((demo) => demo.id === "warning-stack")!;

  const matrixRender = renderNeonSuiteDemo({ demo: matrix, phase: 40, width: 52, height: 12, selected: true });
  const warningRender = renderNeonSuiteDemo({ demo: warning, phase: 40, width: 52, height: 12, selected: true });

  assertEquals(matrixRender.three?.mode, "relay");
  assertEquals(matrixRender.footer.includes("RELAY PRIMITIVES"), true);
  assertEquals(warningRender.three, undefined);
});

Deno.test("neon suite maps geometric widgets to dedicated NGE primitive modes", () => {
  const expectations = new Map([
    ["counter-board", "counter"],
    ["profile-card", "plug"],
    ["live-feed", "surveillance"],
    ["channel-matrix", "relay"],
    ["telemetry-rack", "rack"],
    ["biosignal-strip", "biosignal"],
    ["harmonic-graph", "harmonic"],
    ["psychograph", "psychograph"],
    ["field-ring", "field"],
    ["hex-heatmap", "heat"],
    ["route-board", "route"],
    ["tactical-map", "command"],
    ["network-topology", "topology"],
  ]);

  for (const [id, mode] of expectations) {
    const demo = demos.find((entry) => entry.id === id)!;
    const rendered = renderNeonSuiteDemo({ demo, phase: 32, width: 64, height: 14, selected: true });
    assertEquals(rendered.three?.mode, mode);
  }
});

Deno.test("neon three scene catalog covers every mode with labels", () => {
  const catalogModes = neonThreeSceneCatalog.map((entry) => entry.mode);
  assert(catalogModes.length === threeSceneModes.length);
  for (const mode of threeSceneModes) {
    assert(catalogModes.includes(mode));
    assert(neonThreeSceneModeLabel(mode).length > 0);
  }
});

for (const { mode } of neonThreeSceneCatalog) {
  Deno.test(`createNeonThreeScene supports ${mode}`, () => {
    const bundle = createNeonThreeScene(mode);
    bundle.tick(performance.now(), signal);
    bundle.dispose();
  });
}

Deno.test("neon three wireframe thickness adds real geometry for ASCII sampling", () => {
  const thin = createNeonThreeScene("lattice", { wireframeThickness: 0.5 });
  const thick = createNeonThreeScene("lattice", { wireframeThickness: 4 });
  let thinMeshes = 0;
  let thickMeshes = 0;
  let thickInstancedMeshes = 0;
  thin.scene.traverse((object: Object3D) => {
    if (object.type === "Mesh") thinMeshes += 1;
  });
  thick.scene.traverse((object: Object3D) => {
    if (object.type === "Mesh") thickMeshes += 1;
    if ((object as Object3D & { isInstancedMesh?: boolean }).isInstancedMesh) thickInstancedMeshes += 1;
  });
  thin.dispose();
  thick.dispose();

  assert(thickMeshes > thinMeshes);
  assert(thickInstancedMeshes > 0);
});
