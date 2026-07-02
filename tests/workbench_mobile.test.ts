import { assertEquals } from "./deps.ts";
import { layoutWorkbenchButtonRowInto, type WorkbenchButtonRowPlacement } from "../src/app/workbench_control_layout.ts";
import {
  type WorkbenchMobileCommandAction,
  workbenchMobileCommandStripItemsInto,
} from "../src/app/workbench_mobile.ts";

Deno.test("workbench mobile command strip projects stable touch actions", () => {
  const target = workbenchMobileCommandStripItemsInto([], {
    activeTitle: "Data",
    controlsActive: true,
    themeActive: false,
  });

  assertEquals(target.map((item) => item.action), ["next", "controls", "theme", "help", "restore", "wide", "dense"]);
  assertEquals(target.map((item) => item.label), [
    "Next Data",
    "Controls",
    "Theme",
    "Help",
    "Restore",
    "Wide",
    "Dense",
  ]);
  assertEquals(target[1]!.active, true);
  assertEquals(target[2]!.active, false);
  assertEquals(target.slice(4).map((item) => item.tone), ["muted", "muted", "muted"]);
});

Deno.test("workbench mobile command strip uses shared wrapped button layout", () => {
  const items = workbenchMobileCommandStripItemsInto([], {
    activeTitle: "Inspector",
    themeActive: true,
  });
  const placements: WorkbenchButtonRowPlacement<WorkbenchMobileCommandAction>[] = [];
  const nextRow = layoutWorkbenchButtonRowInto(
    placements,
    items,
    { column: 1, row: 1, width: 28, height: 2 },
    1,
  );

  assertEquals(nextRow, 3);
  assertEquals(placements.map((placement) => [placement.item.action, placement.rect.row, placement.state]), [
    ["next", 1, "base"],
    ["controls", 2, "base"],
    ["theme", 2, "active"],
  ]);
});
