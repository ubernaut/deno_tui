import { assert, assertEquals } from "./deps.ts";
import { Signal } from "../src/signals/mod.ts";
import { createDefaultAsciiOptions } from "../app/ascii_options.ts";
import {
  resolveThreePanelRenderPolicy,
  ThreePanelFrameView,
  type ThreePanelGridRenderer,
  type ThreeSceneState,
} from "../app/three_panel.ts";
import { Canvas, MemoryCanvasSink, type ThreeAsciiGridRenderer, ThreeAsciiObject } from "../src/canvas/mod.ts";
import type {
  GraphicsDeleteMode,
  GraphicsHandle,
  GraphicsImage,
  GraphicsPlacement,
  GraphicsSurface,
  GraphicsSurfaceInspection,
} from "../src/runtime/graphics_surface.ts";
import { emptyStyle } from "../src/theme.ts";
import type { Camera, Scene } from "npm:three@0.183.2";
import type { TerminalGlyphStyle } from "../src/three_ascii/glyphs.ts";
import type { ThreeAsciiRenderFrameOptions } from "../src/three_ascii/renderer.ts";

Deno.test("resolveThreePanelRenderPolicy selects ASCII and Kitty frame modes", () => {
  const ascii = createDefaultAsciiOptions("sharp");
  assertEquals(
    resolveThreePanelRenderPolicy({
      ascii,
      graphicsAvailable: true,
      graphicsRectangle: { width: 8, height: 4 },
      rendererSupportsImage: true,
    }),
    {
      kittyActive: false,
      renderAscii: true,
      renderImage: false,
      frameOptions: { ansi: true, image: false },
    },
  );

  assertEquals(
    resolveThreePanelRenderPolicy({
      ascii: { ...ascii, kittyGraphics: true, kittyDisableAscii: false },
      graphicsAvailable: true,
      graphicsRectangle: { width: 8, height: 4 },
      rendererSupportsImage: true,
    }),
    {
      kittyActive: true,
      renderAscii: true,
      renderImage: true,
      frameOptions: { ansi: true, image: true },
    },
  );

  assertEquals(
    resolveThreePanelRenderPolicy({
      ascii: { ...ascii, kittyGraphics: true, kittyDisableAscii: true },
      graphicsAvailable: true,
      graphicsRectangle: { width: 8, height: 4 },
      rendererSupportsImage: true,
    }),
    {
      kittyActive: true,
      renderAscii: false,
      renderImage: true,
      frameOptions: { ansi: false, image: true },
    },
  );

  assertEquals(
    resolveThreePanelRenderPolicy({
      ascii: { ...ascii, kittyGraphics: true, kittyDisableAscii: true },
      graphicsAvailable: true,
      graphicsRectangle: { width: 0, height: 4 },
      rendererSupportsImage: true,
    }).kittyActive,
    false,
  );
});

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
  assertEquals(panel.inspectLifecycle().state, "idle");

  scene.value = null;
  await new Promise((resolve) => setTimeout(resolve, 0));

  assertEquals(panel.grid.peek(), []);
  assertEquals(updates, 2);

  panel.dispose();
  assertEquals(panel.inspectLifecycle().state, "disposed");
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
    assertEquals(panel.inspectLifecycle().state, "rendering");
    rectangle.value = { column: 0, row: 0, width: 20, height: 8 };
    await new Promise((resolve) => setTimeout(resolve, 0));

    assertEquals(panel.inspectLifecycle().state, "stopping");
    assertEquals(panel.inspectLifecycle().syncPending, true);
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
  assertEquals(panel.inspectLifecycle().state, "rendering");
  const updatesBeforeDispose = updates;
  panel.dispose();
  assertEquals(panel.inspectLifecycle().state, "disposed");
  renderer?.completeFrame();

  await waitFor(() => renderer?.destroyed === true);
  assertEquals(updates, updatesBeforeDispose);

  rectangle.dispose();
  scene.dispose();
  ascii.dispose();
  enabled.dispose();
});

Deno.test("ThreePanelFrameView drops stale frames after a rebuild request", async () => {
  const rectangle = new Signal({ column: 0, row: 0, width: 12, height: 6 }, { deepObserve: true });
  const scene = new Signal<ThreeSceneState | null>(sceneState());
  const ascii = new Signal(createDefaultAsciiOptions("sharp"));
  const enabled = new Signal(true);
  const renderers: SlowGridRenderer[] = [];
  const panel = new ThreePanelFrameView({
    rectangle,
    scene,
    ascii,
    enabled,
    frameInterval: 1000 / 30,
    rendererFactory: (options) => {
      const renderer = new SlowGridRenderer(options.columns, options.rows, renderers.length === 0 ? "A" : "B");
      renderers.push(renderer);
      return renderer;
    },
  });

  try {
    await waitFor(() => (renderers[0]?.startCount ?? 0) >= 1);
    scene.value = { ...sceneState(), mode: "lattice" };
    await new Promise((resolve) => setTimeout(resolve, 0));

    renderers[0]?.completeFrame();

    await waitFor(() => (renderers[1]?.startCount ?? 0) >= 1);
    assertEquals(panel.grid.peek(), []);
    assertEquals(renderers[0]?.destroyed, true);

    renderers[1]?.completeFrame();
    await waitFor(() => panel.grid.peek()[0]?.[0] === "B");
    assertEquals(panel.grid.peek()[0]?.[0], "B");
  } finally {
    panel.dispose();
    rectangle.dispose();
    scene.dispose();
    ascii.dispose();
    enabled.dispose();
  }
});

Deno.test("ThreePanelFrameView hides safely while a frame is rendering", async () => {
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
    assertEquals(panel.inspectLifecycle().state, "rendering");

    enabled.value = false;
    await new Promise((resolve) => setTimeout(resolve, 0));

    assertEquals(panel.inspectLifecycle().state, "stopping");
    assertEquals(panel.grid.peek(), []);

    renderer?.completeFrame();
    await waitFor(() => renderer?.destroyed === true);

    assertEquals(panel.grid.peek(), []);
    assertEquals(panel.inspectLifecycle().hasRenderer, false);
    assertEquals(panel.inspectLifecycle().state, "idle");
  } finally {
    panel.dispose();
    rectangle.dispose();
    scene.dispose();
    ascii.dispose();
    enabled.dispose();
  }
});

Deno.test("ThreePanelFrameView drops stale frames after ascii config rebuilds", async () => {
  const rectangle = new Signal({ column: 0, row: 0, width: 12, height: 6 }, { deepObserve: true });
  const scene = new Signal<ThreeSceneState | null>(sceneState());
  const ascii = new Signal(createDefaultAsciiOptions("sharp"));
  const enabled = new Signal(true);
  const renderers: SlowGridRenderer[] = [];
  const panel = new ThreePanelFrameView({
    rectangle,
    scene,
    ascii,
    enabled,
    frameInterval: 1000 / 30,
    rendererFactory: (options) => {
      const renderer = new SlowGridRenderer(options.columns, options.rows, renderers.length === 0 ? "A" : "B");
      renderers.push(renderer);
      return renderer;
    },
  });

  try {
    await waitFor(() => (renderers[0]?.startCount ?? 0) >= 1);

    ascii.value = { ...ascii.peek(), wireframeThickness: ascii.peek().wireframeThickness + 1 };
    await new Promise((resolve) => setTimeout(resolve, 0));

    assertEquals(panel.inspectLifecycle().state, "stopping");
    renderers[0]?.completeFrame();

    await waitFor(() => (renderers[1]?.startCount ?? 0) >= 1);
    assertEquals(panel.grid.peek(), []);
    assertEquals(renderers[0]?.destroyed, true);

    renderers[1]?.completeFrame();
    await waitFor(() => panel.grid.peek()[0]?.[0] === "B");
    assertEquals(panel.grid.peek()[0]?.[0], "B");
  } finally {
    panel.dispose();
    rectangle.dispose();
    scene.dispose();
    ascii.dispose();
    enabled.dispose();
  }
});

Deno.test("ThreePanelFrameView tolerates repeated hide restore reconfigure resize and dispose cycles", async () => {
  const rectangle = new Signal({ column: 0, row: 0, width: 12, height: 6 }, { deepObserve: true });
  const scene = new Signal<ThreeSceneState | null>(sceneState());
  const ascii = new Signal(createDefaultAsciiOptions("sharp"));
  const enabled = new Signal(true);
  const renderers: SlowGridRenderer[] = [];
  const panel = new ThreePanelFrameView({
    rectangle,
    scene,
    ascii,
    enabled,
    frameInterval: 1000 / 30,
    rendererFactory: (options) => {
      const renderer = new SlowGridRenderer(options.columns, options.rows, String(renderers.length));
      renderers.push(renderer);
      return renderer;
    },
  });

  try {
    await waitFor(() => (renderers[0]?.startCount ?? 0) >= 1);
    enabled.value = false;
    await new Promise((resolve) => setTimeout(resolve, 0));
    renderers[0]?.completeFrame();
    await waitFor(() => renderers[0]?.destroyed === true);
    assertEquals(panel.grid.peek(), []);

    enabled.value = true;
    await waitFor(() => (renderers[1]?.startCount ?? 0) >= 1);
    renderers[1]?.completeFrame();
    await waitFor(() => panel.grid.peek()[0]?.[0] === "1");

    ascii.value = { ...ascii.peek(), wireframeThickness: ascii.peek().wireframeThickness + 1 };
    await waitFor(() => (renderers[2]?.startCount ?? 0) >= 1);
    assertEquals(renderers[1]?.destroyed, true);
    rectangle.value = { column: 0, row: 0, width: 20, height: 8 };
    await new Promise((resolve) => setTimeout(resolve, 0));
    assertEquals(panel.inspectLifecycle().state, "stopping");
    renderers[2]?.completeFrame();

    await waitFor(() => (renderers[2]?.startCount ?? 0) >= 2);
    assertEquals(renderers[2]?.setSizeDuringRender, 0);
    renderers[2]?.completeFrame();
    await waitFor(() => panel.grid.peek().length === 8);

    const updatesBeforeDispose = panel.grid.peek();
    await waitFor(() => (renderers[2]?.startCount ?? 0) >= 3);
    panel.dispose();
    assertEquals(panel.inspectLifecycle().state, "disposed");
    renderers[2]?.completeFrame();
    await waitFor(() => renderers[2]?.destroyed === true);
    assertEquals(panel.grid.peek(), updatesBeforeDispose);
  } finally {
    panel.dispose();
    rectangle.dispose();
    scene.dispose();
    ascii.dispose();
    enabled.dispose();
  }
});

Deno.test("ThreePanelFrameView can use Kitty image frames without drawing ASCII cells", async () => {
  const rectangle = new Signal({ column: 0, row: 0, width: 8, height: 4 }, { deepObserve: true });
  const graphicsRectangle = new Signal({ column: 5, row: 6, width: 8, height: 4 }, { deepObserve: true });
  const scene = new Signal<ThreeSceneState | null>(sceneState());
  const ascii = new Signal({
    ...createDefaultAsciiOptions("sharp"),
    kittyGraphics: true,
    kittyDisableAscii: true,
  });
  const enabled = new Signal(true);
  const surface = new FakeGraphicsSurface();
  const panel = new ThreePanelFrameView({
    rectangle,
    graphicsRectangle,
    scene,
    ascii,
    enabled,
    graphicsSurface: surface,
    frameInterval: 1000 / 30,
    rendererFactory: (options) => new FakeGridRenderer(options.columns, options.rows),
  });

  try {
    await waitFor(() => surface.puts.length >= 1);
    assertEquals(panel.grid.peek(), Array.from({ length: 4 }, () => Array.from({ length: 8 }, () => " ")));
    assertEquals(surface.puts[0]!.image.format, 32);
    assertEquals(surface.puts[0]!.placement, { column: 5, row: 6, width: 8, height: 4, zIndex: 1 });
  } finally {
    panel.dispose();
    rectangle.dispose();
    graphicsRectangle.dispose();
    scene.dispose();
    ascii.dispose();
    enabled.dispose();
  }
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
  assertEquals(object.grid, []);
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

  constructor(private columns: number, private rows: number, private readonly glyph = "█") {}

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
      (_, row) => Array.from({ length: this.columns }, (_, column) => (row + column) % 2 === 0 ? this.glyph : " "),
    );
  }

  async renderFrame(
    deltaTime?: number,
    onFrame?: (deltaTime: number) => void | Promise<void>,
    options: ThreeAsciiRenderFrameOptions = { ansi: true },
  ) {
    const frame: {
      grid?: string[][];
      image?: { data: Uint8Array; encoding: "bytes"; format: 32; pixelWidth: number; pixelHeight: number };
    } = {};
    if (options.ansi ?? true) {
      frame.grid = await this.renderToAnsiGrid(deltaTime, onFrame);
    } else {
      await onFrame?.(deltaTime ?? 0.016);
    }
    if (options.image) {
      frame.image = {
        data: new Uint8Array(this.columns * this.rows * 4),
        encoding: "bytes",
        format: 32,
        pixelWidth: this.columns * 8,
        pixelHeight: this.rows * 8,
      };
    }
    return frame;
  }

  destroy(): void {}
}

class FakeGraphicsSurface implements GraphicsSurface {
  readonly kind = "kitty" as const;
  readonly puts: Array<{ image: GraphicsImage; placement: GraphicsPlacement }> = [];
  readonly deleted: Array<{ handle: GraphicsHandle; mode?: GraphicsDeleteMode }> = [];
  private nextId = 1;

  async putImage(image: GraphicsImage, placement: GraphicsPlacement): Promise<GraphicsHandle> {
    this.puts.push({ image, placement });
    return {
      id: `kitty:${this.nextId}:1`,
      kind: this.kind,
      imageId: this.nextId++,
      placementId: 1,
      placement,
    };
  }

  async moveImage(): Promise<void> {}

  async deleteImage(handle: GraphicsHandle, mode?: GraphicsDeleteMode): Promise<void> {
    this.deleted.push({ handle, mode });
  }

  async clear(): Promise<void> {}

  inspect(): GraphicsSurfaceInspection {
    return {
      kind: this.kind,
      available: true,
      handles: [],
      commandCount: this.puts.length + this.deleted.length,
      mode: "direct",
      reason: "test",
    };
  }
}

class SlowGridRenderer extends FakeGridRenderer {
  readonly sizes: Array<[number, number]> = [];
  startCount = 0;
  setSizeDuringRender = 0;
  destroyed = false;
  private rendering = false;
  private releaseFrame?: () => void;

  constructor(columns: number, rows: number, glyph = "█") {
    super(columns, rows, glyph);
  }

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
