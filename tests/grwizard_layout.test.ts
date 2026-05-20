import { assertEquals } from "./deps.ts";
import { detectWizardViewport, layoutDashboardPanels } from "../app/grwizard_layout.ts";
import type { Rect } from "../app/types.ts";

Deno.test("detectWizardViewport downgrades from large to tiny as space falls away", () => {
  assertEquals(detectWizardViewport({ column: 0, row: 0, width: 150, height: 40 }), "large");
  assertEquals(detectWizardViewport({ column: 0, row: 0, width: 120, height: 32 }), "medium");
  assertEquals(detectWizardViewport({ column: 0, row: 0, width: 92, height: 24 }), "small");
  assertEquals(detectWizardViewport({ column: 0, row: 0, width: 70, height: 18 }), "tiny");
});

Deno.test("overview on large screens exposes the multi-panel wall", () => {
  const bounds: Rect = { column: 1, row: 3, width: 138, height: 34 };
  const layout = layoutDashboardPanels(bounds, "large", "overview");

  assertEquals(layout.goal.width > 0, true);
  assertEquals(layout.progress.width > 0, true);
  assertEquals(layout.model.width > 0, true);
  assertEquals(layout.board.width > 0, true);
  assertEquals(layout.output.width > 0, true);
  assertEquals(layout.main.width, 0);
});

Deno.test("small overview stacks goal, board, and output", () => {
  const bounds: Rect = { column: 0, row: 0, width: 92, height: 24 };
  const layout = layoutDashboardPanels(bounds, "small", "overview");

  assertEquals(layout.goal.height > 0, true);
  assertEquals(layout.board.height > 0, true);
  assertEquals(layout.output.height > 0, true);
  assertEquals(layout.main.height, 0);
});

Deno.test("non-overview tabs collapse to a single main panel", () => {
  const bounds: Rect = { column: 0, row: 0, width: 120, height: 30 };
  const layout = layoutDashboardPanels(bounds, "medium", "model");

  assertEquals(layout.main, bounds);
  assertEquals(layout.goal.width, 0);
  assertEquals(layout.board.width, 0);
});
