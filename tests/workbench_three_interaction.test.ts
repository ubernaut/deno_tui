import { assertEquals } from "./deps.ts";
import { WorkbenchThreeViewportInteractionController } from "../app/workbench_three_interaction.ts";

Deno.test("WorkbenchThreeViewportInteractionController starts and continues viewport drags", () => {
  const harness = createHarness();

  assertEquals(harness.controller.handlePress(press({ x: 3, y: 4 })).handled, true);
  assertEquals(harness.controller.dragWindow, "three");
  assertEquals(harness.focused, ["three"]);

  assertEquals(
    harness.controller.handlePress(press({ x: 9, y: 9, drag: true, movementX: 2, movementY: -1 })).handled,
    true,
  );
  assertEquals(harness.panels.three.rotations, [[2, -1]]);
  assertEquals(harness.focused, ["three", "three"]);
});

Deno.test("WorkbenchThreeViewportInteractionController clears drag on release or missing panel", () => {
  const harness = createHarness();

  harness.controller.handlePress(press({ x: 3, y: 4 }));
  assertEquals(harness.controller.handlePress(press({ x: 3, y: 4, release: true })), {
    handled: true,
    dragWindow: null,
  });

  harness.panels.three.available = false;
  harness.controller.handlePress(press({ x: 3, y: 4 }));
  assertEquals(
    harness.controller.handlePress(press({ x: 3, y: 4, drag: true, movementX: 1, movementY: 1 })),
    { handled: true, dragWindow: "three" },
  );
  assertEquals(harness.panels.three.rotations, []);
});

Deno.test("WorkbenchThreeViewportInteractionController zooms hovered viewport", () => {
  const harness = createHarness();

  assertEquals(harness.controller.handleScroll({ x: 3, y: 4, scroll: -1 }), true);
  assertEquals(harness.panels.three.zooms, [-1]);
  assertEquals(harness.focused, ["three"]);
  assertEquals(harness.controller.handleScroll({ x: 0, y: 0, scroll: 1 }), false);
});

function createHarness() {
  const panels = { three: new FakePanel() };
  const focused: string[] = [];
  const controller = new WorkbenchThreeViewportInteractionController({
    findHit: (x, y) => x === 3 && y === 4 ? { action: { type: "threeViewport", id: "three" } } : undefined,
    panelForWindow: (id) => panels[id as "three"].available ? panels[id as "three"] : undefined,
    focusWindow: (id) => focused.push(id),
  });
  return { controller, panels, focused };
}

function press(
  options: Partial<Parameters<WorkbenchThreeViewportInteractionController<string>["handlePress"]>[0]>,
): Parameters<WorkbenchThreeViewportInteractionController<string>["handlePress"]>[0] {
  return {
    x: 0,
    y: 0,
    drag: false,
    release: false,
    movementX: 0,
    movementY: 0,
    ...options,
  };
}

class FakePanel {
  available = true;
  rotations: number[][] = [];
  zooms: number[] = [];

  rotateBy(deltaColumns: number, deltaRows: number): void {
    this.rotations.push([deltaColumns, deltaRows]);
  }

  zoomBy(scrollSteps: number): void {
    this.zooms.push(scrollSteps);
  }
}
