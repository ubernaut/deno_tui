import { assert, assertEquals } from "./deps.ts";
import { Signal } from "../src/signals/mod.ts";
import { createDefaultAsciiOptions } from "../app/ascii_options.ts";
import { ThreePanelFrameView, type ThreePanelGridRenderer, type ThreeSceneState } from "../app/three_panel.ts";

Deno.test("ThreePanelFrameView stays inert while disabled", async () => {
  const rectangle = new Signal({ column: 0, row: 0, width: 12, height: 6 }, { deepObserve: true });
  const scene = new Signal<ThreeSceneState | null>({
    mode: "studio" as const,
    signal: {
      x: 0.5,
      y: 0.5,
      depth: 0.5,
      twist: 0,
      lift: 0,
      pulse: 0,
      active: false,
      pressed: false,
    },
  });
  const ascii = new Signal(createDefaultAsciiOptions("sharp"));
  const enabled = new Signal(false);
  let updates = 0;

  const panel = new ThreePanelFrameView({
    rectangle,
    scene,
    ascii,
    enabled,
    onUpdate: () => {
      updates += 1;
    },
  });

  await new Promise((resolve) => setTimeout(resolve, 0));

  assertEquals(panel.grid.peek(), []);
  assertEquals(updates, 1);

  scene.value = null;
  await new Promise((resolve) => setTimeout(resolve, 0));

  assertEquals(panel.grid.peek(), []);
  assertEquals(updates, 2);

  panel.dispose();
  rectangle.dispose();
  scene.dispose();
  ascii.dispose();
  enabled.dispose();
});

Deno.test("ThreePanelFrameView tracks mouse-style zoom and rotation", () => {
  const rectangle = new Signal({ column: 0, row: 0, width: 12, height: 6 }, { deepObserve: true });
  const scene = new Signal<ThreeSceneState | null>(null);
  const ascii = new Signal(createDefaultAsciiOptions("sharp"));
  const enabled = new Signal(false);
  let updates = 0;

  const panel = new ThreePanelFrameView({
    rectangle,
    scene,
    ascii,
    enabled,
    onUpdate: () => {
      updates += 1;
    },
  });

  assertEquals(panel.inspectInteraction(), { rotationX: 0, rotationY: 0, zoom: 1 });

  const rotated = panel.rotateBy(10, -4);
  assert(rotated.rotationY > 0);
  assert(rotated.rotationX < 0);
  assertEquals(rotated.zoom, 1);

  const zoomedIn = panel.zoomBy(-1);
  assert(zoomedIn.zoom > 1);

  const zoomedOut = panel.zoomBy(200);
  assertEquals(zoomedOut.zoom, 0.35);

  assertEquals(panel.resetInteraction(), { rotationX: 0, rotationY: 0, zoom: 1 });
  assert(updates >= 4);

  panel.dispose();
  rectangle.dispose();
  scene.dispose();
  ascii.dispose();
  enabled.dispose();
});

Deno.test("ThreePanelFrameView starts after same-tick rectangle activation", async () => {
  const rectangle = new Signal({ column: 0, row: 0, width: 0, height: 0 }, { deepObserve: true });
  const scene = new Signal<ThreeSceneState | null>({
    mode: "studio" as const,
    signal: {
      x: 0.5,
      y: 0.5,
      depth: 0.5,
      twist: 0,
      lift: 0,
      pulse: 0.4,
      active: false,
      pressed: false,
    },
  });
  const ascii = new Signal(createDefaultAsciiOptions("sharp"));
  const enabled = new Signal(true);
  const panel = new ThreePanelFrameView({
    rectangle,
    scene,
    ascii,
    enabled,
    frameInterval: 1000 / 30,
    rendererFactory: (options) => new FakeGridRenderer(options.columns, options.rows),
  });

  try {
    rectangle.value = { column: 0, row: 0, width: 24, height: 8 };

    for (let attempt = 0; attempt < 10 && panel.grid.peek().length === 0; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 10));
    }

    assertEquals(panel.grid.peek().length, 8);
  } finally {
    panel.dispose();
    rectangle.dispose();
    scene.dispose();
    ascii.dispose();
    enabled.dispose();
  }
});

class FakeGridRenderer implements ThreePanelGridRenderer {
  constructor(private columns: number, private rows: number) {}

  setSize(columns: number, rows: number): void {
    this.columns = columns;
    this.rows = rows;
  }

  setEffectOptions(): void {}

  setTerminalEdgeBias(): void {}

  setTerminalGlyphStyle(): void {}

  async renderToAnsiGrid(
    _deltaTime?: number,
    onFrame?: (deltaTime: number) => void | Promise<void>,
  ): Promise<string[][]> {
    await onFrame?.(0.016);
    return Array.from(
      { length: this.rows },
      (_, row) => Array.from({ length: this.columns }, (_, column) => (row + column) % 2 === 0 ? "█" : " "),
    );
  }

  destroy(): void {}
}
