import { assertEquals } from "./deps.ts";
import { demos } from "../app/neon_theme.ts";
import {
  cycleDemo,
  demoIndex,
  moveGridSelection,
  neonDemosForSection,
  neonOpenTuiDemoIds,
  neonSuiteSummary,
  neonWebDemoIds,
  renderNeonSuiteDemo,
} from "../app/neon_suite.ts";

Deno.test("neon suite exposes OpenTUI parity web ordering and extended counts", () => {
  assertEquals(neonOpenTuiDemoIds.length, 24);
  assertEquals(neonWebDemoIds.length, 24);
  assertEquals(neonSuiteSummary("opentui").count, 24);
  assertEquals(neonSuiteSummary("web").count, 24);
  assertEquals(neonSuiteSummary("extended").count, 25);
  assertEquals(neonSuiteSummary("extended").threeCount, 7);
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
});
