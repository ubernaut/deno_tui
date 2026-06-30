import { assert, assertEquals } from "./deps.ts";
import { Signal } from "../src/signals/mod.ts";
import { createDefaultAsciiOptions } from "../app/ascii_options.ts";
import { ThreePanelFrameView, type ThreePanelGridRenderer, type ThreeSceneState } from "../app/three_panel.ts";
import { Canvas, MemoryCanvasSink, type ThreeAsciiGridRenderer, ThreeAsciiObject } from "../src/canvas/mod.ts";
import { emptyStyle } from "../src/theme.ts";
import type { Camera, Scene } from "npm:three@0.183.2";
import type { TerminalGlyphStyle } from "../src/three_ascii/glyphs.ts";

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

Deno.test("ThreePanelFrameView defers resize while a frame is rendering", async () => {
  const rectangle = new Signal({ column: 0, row: 0, width: 12, height: 6 }, { deepObserve: true });
  const scene = new Signal<ThreeSceneState | null>(sceneState());
  const ascii = new Signal(createDefaultAsciiOptions("sharp"));
  const enabled = new Signal(true);
  let renderer: SlowGridRenderer | undefined;
  const panel = new ThreePanelFrameView({
    rectangle,
    scene,
    ascii,
    enabled,
    frameInterval: 1000 / 30,
    rendererFactory: (options) => renderer = new SlowGridRenderer(options.columns, options.rows),
  });

  try {
    await waitFor(() => (renderer?.startCount ?? 0) >= 1);
    rectangle.value = { column: 0, row: 0, width: 20, height: 8 };
    await new Promise((resolve) => setTimeout(resolve, 0));

    assertEquals(renderer?.setSizeDuringRender, 0);
    renderer?.completeFrame();

    await waitFor(() => (renderer?.startCount ?? 0) >= 2);
    assertEquals(renderer?.setSizeDuringRender, 0);
    renderer?.completeFrame();

    await waitFor(() => panel.grid.peek().length === 8);
    assertEquals(renderer?.sizes.at(-1), [20, 8]);
  } finally {
    panel.dispose();
    rectangle.dispose();
    scene.dispose();
    ascii.dispose();
    enabled.dispose();
  }
});

Deno.test("ThreePanelFrameView disposes safely while a frame is rendering", async () => {
  const rectangle = new Signal({ column: 0, row: 0, width: 12, height: 6 }, { deepObserve: true });
  const scene = new Signal<ThreeSceneState | null>(sceneState());
  const ascii = new Signal(createDefaultAsciiOptions("sharp"));
  const enabled = new Signal(true);
  let updates = 0;
  let renderer: SlowGridRenderer | undefined;
  const panel = new ThreePanelFrameView({
    rectangle,
    scene,
    ascii,
    enabled,
    frameInterval: 1000 / 30,
    onUpdate: () => {
      updates += 1;
    },
    rendererFactory: (options) => renderer = new SlowGridRenderer(options.columns, options.rows),
  });

  await waitFor(() => (renderer?.startCount ?? 0) >= 1);
  const updatesBeforeDispose = updates;
  panel.dispose();
  renderer?.completeFrame();

  await waitFor(() => renderer?.destroyed === true);
  assertEquals(updates, updatesBeforeDispose);

  rectangle.dispose();
  scene.dispose();
  ascii.dispose();
  enabled.dispose();
});

Deno.test("ThreeAsciiObject defers resize while a frame is rendering", async () => {
  const rectangle = new Signal({ column: 0, row: 0, width: 12, height: 6 }, { deepObserve: true });
  const sink = new MemoryCanvasSink();
  const canvas = new Canvas({ sink, size: { columns: 40, rows: 20 } });
  let renderer: SlowGridRenderer | undefined;
  const object = new ThreeAsciiObject({
    canvas,
    rectangle,
    scene: {} as Scene,
    camera: {} as Camera,
    style: emptyStyle,
    zIndex: 1,
    frameInterval: 1000 / 30,
    rendererFactory: (options) => renderer = new SlowGridRenderer(options.columns, options.rows),
  });

  object.draw();

  try {
    await waitFor(() => (renderer?.startCount ?? 0) >= 1);
    rectangle.value = { column: 0, row: 0, width: 20, height: 8 };
    await new Promise((resolve) => setTimeout(resolve, 0));

    assertEquals(renderer?.setSizeDuringRender, 0);
    renderer?.completeFrame();

    await waitFor(() => (renderer?.startCount ?? 0) >= 2);
    assertEquals(renderer?.setSizeDuringRender, 0);
    renderer?.completeFrame();

    await waitFor(() => renderer?.sizes.at(-1)?.[0] === 20 && renderer?.sizes.at(-1)?.[1] === 8);
  } finally {
    object.erase();
    rectangle.dispose();
  }
});

Deno.test("ThreeAsciiObject erases safely while a frame is rendering", async () => {
  const rectangle = new Signal({ column: 0, row: 0, width: 12, height: 6 }, { deepObserve: true });
  const sink = new MemoryCanvasSink();
  const canvas = new Canvas({ sink, size: { columns: 40, rows: 20 } });
  let renderer: SlowGridRenderer | undefined;
  const object = new ThreeAsciiObject({
    canvas,
    rectangle,
    scene: {} as Scene,
    camera: {} as Camera,
    style: emptyStyle,
    zIndex: 1,
    frameInterval: 1000 / 30,
    rendererFactory: (options) => renderer = new SlowGridRenderer(options.columns, options.rows),
  });

  object.draw();
  await waitFor(() => (renderer?.startCount ?? 0) >= 1);
  object.erase();
  renderer?.completeFrame();

  await waitFor(() => renderer?.destroyed === true);
  rectangle.dispose();
});

function sceneState(): ThreeSceneState {
  return {
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
  };
}

async function waitFor(condition: () => boolean): Promise<void> {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    if (condition()) return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  assert(condition());
}

class FakeGridRenderer implements ThreePanelGridRenderer, ThreeAsciiGridRenderer {
  readonly scene = {} as Scene;
  readonly camera = {} as Camera;
  private terminalEdgeBias = 1;
  private terminalGlyphStyle: TerminalGlyphStyle = "blocks";

  constructor(private columns: number, private rows: number) {}

  setSize(columns: number, rows: number): void {
    this.columns = columns;
    this.rows = rows;
  }

  setEffectOptions(): void {}

  getTerminalEdgeBias(): number {
    return this.terminalEdgeBias;
  }

  setTerminalEdgeBias(value: number): void {
    this.terminalEdgeBias = value;
  }

  getTerminalGlyphStyle(): TerminalGlyphStyle {
    return this.terminalGlyphStyle;
  }

  setTerminalGlyphStyle(value: TerminalGlyphStyle): void {
    this.terminalGlyphStyle = value;
  }

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

class SlowGridRenderer extends FakeGridRenderer {
  readonly sizes: Array<[number, number]> = [];
  startCount = 0;
  setSizeDuringRender = 0;
  destroyed = false;
  private rendering = false;
  private releaseFrame?: () => void;

  override setSize(columns: number, rows: number): void {
    if (this.rendering) {
      this.setSizeDuringRender += 1;
    }
    this.sizes.push([columns, rows]);
    super.setSize(columns, rows);
  }

  override async renderToAnsiGrid(
    deltaTime?: number,
    onFrame?: (deltaTime: number) => void | Promise<void>,
  ): Promise<string[][]> {
    this.rendering = true;
    this.startCount += 1;
    await new Promise<void>((resolve) => {
      this.releaseFrame = resolve;
    });
    this.rendering = false;
    return await super.renderToAnsiGrid(deltaTime, onFrame);
  }

  completeFrame(): void {
    const release = this.releaseFrame;
    this.releaseFrame = undefined;
    release?.();
  }

  override destroy(): void {
    this.destroyed = true;
  }
}
