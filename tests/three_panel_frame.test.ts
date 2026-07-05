import { assert, assertEquals } from "./deps.ts";
import { Signal } from "../src/signals/mod.ts";
import { createDefaultAsciiOptions } from "../src/three_ascii/options.ts";
import {
  resolveThreePanelAdaptiveRenderBudget,
  resolveThreePanelRenderPolicy,
  resolveThreePanelRenderSize,
  ThreePanelAdaptiveRenderBudgetController,
  type ThreePanelFrameUpdate,
  ThreePanelFrameView,
  type ThreePanelGridRenderer,
  ThreePanelRenderQueue,
  type ThreeSceneState,
} from "../app/three_panel.ts";
import { resolveThreePanelLifecycleState } from "../src/app/three_panel_core.ts";
import { Canvas, MemoryCanvasSink, type ThreeAsciiGridRenderer, ThreeAsciiObject } from "../src/canvas/mod.ts";
import type {
  GraphicsDeleteMode,
  GraphicsHandle,
  GraphicsImage,
  GraphicsPlacement,
  GraphicsSurface,
  GraphicsSurfaceInspection,
} from "../src/runtime/graphics_surface.ts";
import { DiagnosticsCollector } from "../src/runtime/diagnostics.ts";
import { emptyStyle } from "../src/theme.ts";
import { View } from "../src/view.ts";
import type { Camera, Scene } from "npm:three@0.183.2";
import type { TerminalGlyphStyle } from "../src/three_ascii/glyphs.ts";
import type {
  ThreeAsciiRendererOptions,
  ThreeAsciiRendererPerformance,
  ThreeAsciiRenderFrameOptions,
} from "../src/three_ascii/renderer.ts";

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

Deno.test("resolveThreePanelRenderSize preserves small panes and caps large panes by area", () => {
  assertEquals(resolveThreePanelRenderSize({ width: 80, height: 24 }, 3_840), { columns: 80, rows: 24 });

  const capped = resolveThreePanelRenderSize({ width: 160, height: 60 }, 3_840);
  assert(capped.columns < 160);
  assert(capped.rows < 60);
  assert(capped.columns * capped.rows <= 3_840);
  assert(capped.columns / capped.rows > 160 / 60 - 0.2);
});

Deno.test("resolveThreePanelAdaptiveRenderBudget steps down on sustained slow frames", () => {
  const warmup = resolveThreePanelAdaptiveRenderBudget({
    requestedMaxCells: 3_840,
    frameMs: 220,
    targetMs: 1000 / 18,
    slowFrames: 0,
    fastFrames: 0,
    sampleFrames: 0,
  });
  assertEquals(warmup.direction, "steady");
  assertEquals(warmup.slowFrames, 0);
  assertEquals(warmup.maxCells, undefined);

  const first = resolveThreePanelAdaptiveRenderBudget({
    requestedMaxCells: 3_840,
    frameMs: 220,
    targetMs: 1000 / 18,
    slowFrames: 0,
    fastFrames: 0,
    sampleFrames: 1,
  });
  assertEquals(first.direction, "steady");
  assertEquals(first.maxCells, undefined);

  const second = resolveThreePanelAdaptiveRenderBudget({
    requestedMaxCells: 3_840,
    frameMs: 220,
    targetMs: 1000 / 18,
    slowFrames: first.slowFrames,
    fastFrames: first.fastFrames,
    sampleFrames: 2,
  });
  assertEquals(second.direction, "down");
  assertEquals(second.maxCells, 1_920);

  const recovered = resolveThreePanelAdaptiveRenderBudget({
    requestedMaxCells: 3_840,
    currentMaxCells: 1_920,
    frameMs: 20,
    targetMs: 1000 / 18,
    slowFrames: 0,
    fastFrames: 119,
  });
  assertEquals(recovered.direction, "up");
  assertEquals(recovered.maxCells, undefined);
});

Deno.test("ThreePanelAdaptiveRenderBudgetController owns warmup and requested-size state", () => {
  const controller = new ThreePanelAdaptiveRenderBudgetController();

  const initial = controller.renderSize({ width: 160, height: 60 }, 3_840);
  assert(initial.columns * initial.rows <= 3_840);
  assertEquals(
    controller.update({ requestedMaxCells: 3_840, frameMs: 1_000, targetMs: 1000 / 18 }),
    { maxCells: undefined, slowFrames: 0, fastFrames: 0, direction: "steady", changed: false },
  );
  assertEquals(
    controller.update({ requestedMaxCells: 3_840, frameMs: 220, targetMs: 1000 / 18 }).direction,
    "steady",
  );
  const reduced = controller.update({ requestedMaxCells: 3_840, frameMs: 220, targetMs: 1000 / 18 });
  assertEquals(reduced.direction, "down");
  assertEquals(reduced.maxCells, 1_920);
  assertEquals(reduced.changed, true);
  const reducedSize = controller.renderSize({ width: 160, height: 60 }, 3_840);
  assert(reducedSize.columns * reducedSize.rows <= 1_920);

  const resetSize = controller.renderSize({ width: 160, height: 60 }, 7_680);
  assert(resetSize.columns * resetSize.rows > reducedSize.columns * reducedSize.rows);
  assert(resetSize.columns * resetSize.rows <= 7_680);
  assertEquals(
    controller.update({ requestedMaxCells: 7_680, frameMs: 1_000, targetMs: 1000 / 18 }).direction,
    "steady",
  );
});

Deno.test("resolveThreePanelLifecycleState reports explicit transition phases", () => {
  const base = {
    disposed: false,
    failed: false,
    destroyPending: false,
    rebuildPending: false,
    syncPending: false,
    rendering: false,
    hasRenderer: false,
    visible: false,
    gridRows: 0,
  };

  assertEquals(resolveThreePanelLifecycleState(base), "idle");
  assertEquals(resolveThreePanelLifecycleState({ ...base, hasRenderer: true, visible: true }), "initializing");
  assertEquals(resolveThreePanelLifecycleState({ ...base, rendering: true }), "rendering");
  assertEquals(resolveThreePanelLifecycleState({ ...base, syncPending: true, rendering: true }), "resizing");
  assertEquals(resolveThreePanelLifecycleState({ ...base, rebuildPending: true, syncPending: true }), "reconfiguring");
  assertEquals(resolveThreePanelLifecycleState({ ...base, destroyPending: true }), "stopping");
  assertEquals(resolveThreePanelLifecycleState({ ...base, failed: true }), "failed");
  assertEquals(resolveThreePanelLifecycleState({ ...base, disposed: true, failed: true }), "disposed");
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
  assertEquals(updates, 1);

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

Deno.test("ThreePanelFrameView shows startup grid while first frame initializes", async () => {
  const rectangle = new Signal({ column: 0, row: 0, width: 32, height: 8 }, { deepObserve: true });
  const scene = new Signal<ThreeSceneState | null>(sceneState());
  const ascii = new Signal(createDefaultAsciiOptions("sharp"));
  const enabled = new Signal(true);
  const updates: ThreePanelFrameUpdate[] = [];
  const frames: ThreePanelFrameUpdate[] = [];
  let renderer: SlowGridRenderer | undefined;
  const panel = new ThreePanelFrameView({
    rectangle,
    scene,
    ascii,
    enabled,
    frameInterval: 1000 / 30,
    rendererFactory: (options) => renderer = new SlowGridRenderer(options.columns, options.rows),
    onFrame: (update) => {
      frames.push(update);
    },
    onUpdate: (update) => {
      if (update) updates.push(update);
    },
  });

  try {
    await waitFor(() => (renderer?.startCount ?? 0) >= 1);
    assertEquals(panel.grid.peek().flat().join("").includes("ASCII RENDERER STARTING"), true);
    assertEquals(updates.at(-1), { rendererBacked: false, rows: 8, columns: 32 });
    assertEquals(frames, []);
    renderer?.completeFrame();
    await waitFor(() => panel.grid.peek().flat().join("").includes("ASCII RENDERER STARTING") === false);
    assertEquals(frames.at(-1), { rendererBacked: true, rows: 8, columns: 32 });
    assertEquals(updates.at(-1), { rendererBacked: true, rows: 8, columns: 32 });
  } finally {
    panel.dispose();
    rectangle.dispose();
    scene.dispose();
    ascii.dispose();
    enabled.dispose();
  }
});

Deno.test("ThreePanelFrameView keeps startup grid across empty deferred frames", async () => {
  const rectangle = new Signal({ column: 0, row: 0, width: 32, height: 8 }, { deepObserve: true });
  const scene = new Signal<ThreeSceneState | null>(sceneState());
  const ascii = new Signal(createDefaultAsciiOptions("sharp"));
  const enabled = new Signal(true);
  let renderer: EmptyThenGridRenderer | undefined;
  const panel = new ThreePanelFrameView({
    rectangle,
    scene,
    ascii,
    enabled,
    frameInterval: 1,
    rendererFactory: (options) => renderer = new EmptyThenGridRenderer(options.columns, options.rows),
  });

  try {
    await waitFor(() => renderer !== undefined && renderer.renderCount >= 1);
    assertEquals(panel.grid.peek().flat().join("").includes("ASCII RENDERER STARTING"), true);

    renderer!.completeEmptyFrame();
    await waitFor(() => (renderer?.renderCount ?? 0) >= 2);
    assertEquals(panel.grid.peek().flat().join("").includes("ASCII RENDERER STARTING"), false);
    assertEquals(panel.grid.peek().length, 8);
    assertEquals(panel.grid.peek()[0]?.[0], "█");
  } finally {
    panel.dispose();
    rectangle.dispose();
    scene.dispose();
    ascii.dispose();
    enabled.dispose();
  }
});

Deno.test("ThreePanelFrameView defaults to deferred readback", async () => {
  const rectangle = new Signal({ column: 0, row: 0, width: 32, height: 8 }, { deepObserve: true });
  const scene = new Signal<ThreeSceneState | null>(sceneState());
  const ascii = new Signal(createDefaultAsciiOptions("sharp"));
  let readbackStrategy: ThreeAsciiRendererOptions["readbackStrategy"];
  let renderer: FakeGridRenderer | undefined;
  const panel = new ThreePanelFrameView({
    rectangle,
    scene,
    ascii,
    frameInterval: 1,
    rendererFactory: (options) => {
      readbackStrategy = options.readbackStrategy;
      renderer = new FakeGridRenderer(options.columns, options.rows);
      return renderer;
    },
  });

  try {
    await waitFor(() => (renderer?.renderCount ?? 0) > 0);
    assertEquals(readbackStrategy, "deferred");
  } finally {
    panel.dispose();
    rectangle.dispose();
    scene.dispose();
    ascii.dispose();
  }
});

Deno.test("ThreePanelFrameView exposes renderer performance telemetry", async () => {
  const rectangle = new Signal({ column: 0, row: 0, width: 16, height: 8 }, { deepObserve: true });
  const scene = new Signal<ThreeSceneState | null>(sceneState());
  const ascii = new Signal(createDefaultAsciiOptions("sharp"));
  const enabled = new Signal(true);
  let renderer: FakeGridRenderer | undefined;
  const panel = new ThreePanelFrameView({
    rectangle,
    scene,
    ascii,
    enabled,
    frameInterval: 1,
    rendererFactory: (options) => renderer = new FakeGridRenderer(options.columns, options.rows),
  });

  try {
    await waitFor(() => (renderer?.renderCount ?? 0) > 0);
    assertEquals(panel.inspectPerformance()?.cells, 16 * 8);
    assertEquals(panel.inspectPerformance()?.terminalGlyphStyle, "blocks");
  } finally {
    panel.dispose();
    rectangle.dispose();
    scene.dispose();
    ascii.dispose();
    enabled.dispose();
  }
});

Deno.test("ThreePanelFrameView applies lower idle render-cell caps", async () => {
  const rectangle = new Signal({ column: 0, row: 0, width: 48, height: 20 }, { deepObserve: true });
  const scene = new Signal<ThreeSceneState | null>(sceneState());
  const ascii = new Signal({ ...createDefaultAsciiOptions("sharp"), renderMaxCells: 960 });
  const interactive = new Signal(true);
  let renderer: FakeGridRenderer | undefined;
  const panel = new ThreePanelFrameView({
    rectangle,
    scene,
    ascii,
    interactive,
    frameInterval: 1,
    idleFrameInterval: 100,
    maxRenderCells: 960,
    idleMaxRenderCells: 60,
    rendererFactory: (options) => renderer = new FakeGridRenderer(options.columns, options.rows),
  });

  try {
    await waitFor(() => (renderer?.renderCount ?? 0) > 0);
    assert((renderer?.columns ?? 0) * (renderer?.rows ?? 0) <= 960);
    assert((renderer?.columns ?? 0) * (renderer?.rows ?? 0) > 60);

    interactive.value = false;
    await waitFor(() => (renderer?.sizes ?? []).some(([columns, rows]) => columns * rows <= 60));
    assert((renderer?.columns ?? 0) * (renderer?.rows ?? 0) <= 60);

    interactive.value = true;
    await waitFor(() => (renderer?.columns ?? 0) * (renderer?.rows ?? 0) > 60);
    assert((renderer?.columns ?? 0) * (renderer?.rows ?? 0) <= 960);
  } finally {
    panel.dispose();
    rectangle.dispose();
    scene.dispose();
    ascii.dispose();
    interactive.dispose();
  }
});

Deno.test("ThreePanelFrameView serializes shared render queue work across panes", async () => {
  const queue = new ThreePanelRenderQueue();
  const firstRectangle = new Signal({ column: 0, row: 0, width: 12, height: 6 }, { deepObserve: true });
  const secondRectangle = new Signal({ column: 0, row: 0, width: 12, height: 6 }, { deepObserve: true });
  const firstScene = new Signal<ThreeSceneState | null>(sceneState());
  const secondScene = new Signal<ThreeSceneState | null>({ ...sceneState(), mode: "lattice" });
  const firstAscii = new Signal(createDefaultAsciiOptions("sharp"));
  const secondAscii = new Signal(createDefaultAsciiOptions("sharp"));
  const renderers: SlowGridRenderer[] = [];
  const firstPanel = new ThreePanelFrameView({
    rectangle: firstRectangle,
    scene: firstScene,
    ascii: firstAscii,
    frameInterval: 1000 / 30,
    renderQueue: queue,
    rendererFactory: (options) => {
      const renderer = new SlowGridRenderer(options.columns, options.rows, "A");
      renderers.push(renderer);
      return renderer;
    },
  });
  const secondPanel = new ThreePanelFrameView({
    rectangle: secondRectangle,
    scene: secondScene,
    ascii: secondAscii,
    frameInterval: 1000 / 30,
    renderQueue: queue,
    rendererFactory: (options) => {
      const renderer = new SlowGridRenderer(options.columns, options.rows, "B");
      renderers.push(renderer);
      return renderer;
    },
  });

  try {
    await waitFor(() => renderers.length === 2 && renderers[0]!.startCount === 1);
    assertEquals(renderers[1]!.startCount, 0);
    assertEquals(queue.inspect().running, 1);
    assertEquals(queue.inspect().pending, 1);

    renderers[0]!.completeFrame();
    await waitFor(() => renderers[1]!.startCount === 1);
    assertEquals(queue.inspect().running, 1);
    assertEquals(queue.inspect().pending, 0);

    renderers[1]!.completeFrame();
    await waitFor(() => secondPanel.grid.peek()[0]?.[0] === "B");
    assertEquals(firstPanel.grid.peek()[0]?.[0], "A");
  } finally {
    firstPanel.dispose();
    secondPanel.dispose();
    firstRectangle.dispose();
    secondRectangle.dispose();
    firstScene.dispose();
    secondScene.dispose();
    firstAscii.dispose();
    secondAscii.dispose();
  }
});

Deno.test("ThreePanelFrameView only applies renderer settings when they change", async () => {
  const rectangle = new Signal({ column: 0, row: 0, width: 12, height: 6 }, { deepObserve: true });
  const scene = new Signal<ThreeSceneState | null>(sceneState());
  const ascii = new Signal(createDefaultAsciiOptions("sharp"));
  const enabled = new Signal(true);
  let renderer: FakeGridRenderer | undefined;
  const panel = new ThreePanelFrameView({
    rectangle,
    scene,
    ascii,
    enabled,
    frameInterval: 1,
    rendererFactory: (options) => renderer = new FakeGridRenderer(options.columns, options.rows),
  });

  try {
    await waitFor(() => (renderer?.renderCount ?? 0) >= 3);

    assertEquals(renderer?.setSizeCalls, 0);
    assertEquals(renderer?.setEffectOptionsCalls, 0);
    assertEquals(renderer?.setTerminalEdgeBiasCalls, 0);
    assertEquals(renderer?.setTerminalGlyphStyleCalls, 0);

    ascii.value = { ...ascii.peek(), edgeThreshold: ascii.peek().edgeThreshold + 1 };
    await waitFor(() => (renderer?.setEffectOptionsCalls ?? 0) >= 1);

    assertEquals(renderer?.setSizeCalls, 0);
    assertEquals(renderer?.setEffectOptionsCalls, 1);
    assertEquals(renderer?.setTerminalEdgeBiasCalls, 0);
    assertEquals(renderer?.setTerminalGlyphStyleCalls, 0);
  } finally {
    panel.dispose();
    rectangle.dispose();
    scene.dispose();
    ascii.dispose();
    enabled.dispose();
  }
});

Deno.test("ThreePanelFrameView updates when renderer reuses a mutable grid reference", async () => {
  const rectangle = new Signal({ column: 0, row: 0, width: 4, height: 2 }, { deepObserve: true });
  const scene = new Signal<ThreeSceneState | null>(sceneState());
  const ascii = new Signal(createDefaultAsciiOptions("sharp"));
  const enabled = new Signal(true);
  let updates = 0;
  let renderer: ReusedGridRenderer | undefined;
  const panel = new ThreePanelFrameView({
    rectangle,
    scene,
    ascii,
    enabled,
    frameInterval: 1,
    onUpdate: () => {
      updates += 1;
    },
    rendererFactory: (options) => renderer = new ReusedGridRenderer(options.columns, options.rows),
  });

  try {
    await waitFor(() => (renderer?.renderCount ?? 0) >= 3);

    assert(renderer);
    assert(updates >= 3);
    assertEquals(panel.grid.peek(), renderer.grid);
    assertEquals(panel.grid.peek()[0]?.[0], String(renderer.renderCount % 10));
  } finally {
    panel.dispose();
    rectangle.dispose();
    scene.dispose();
    ascii.dispose();
    enabled.dispose();
  }
});

Deno.test("ThreePanelFrameView skips redraws for unchanged repeated grid content", async () => {
  const rectangle = new Signal({ column: 0, row: 0, width: 4, height: 2 }, { deepObserve: true });
  const scene = new Signal<ThreeSceneState | null>(sceneState());
  const ascii = new Signal(createDefaultAsciiOptions("sharp"));
  const enabled = new Signal(true);
  let updates = 0;
  let renderer: FakeGridRenderer | undefined;
  const panel = new ThreePanelFrameView({
    rectangle,
    scene,
    ascii,
    enabled,
    frameInterval: 1,
    onUpdate: () => {
      updates += 1;
    },
    rendererFactory: (options) => renderer = new FakeGridRenderer(options.columns, options.rows),
  });

  try {
    await waitFor(() => (renderer?.renderCount ?? 0) >= 5);

    assert(renderer);
    assert(renderer.renderCount >= 5);
    assertEquals(updates, 2);
  } finally {
    panel.dispose();
    rectangle.dispose();
    scene.dispose();
    ascii.dispose();
    enabled.dispose();
  }
});

Deno.test("ThreePanelFrameView skips redraws for unchanged revisioned grid content", async () => {
  const rectangle = new Signal({ column: 0, row: 0, width: 4, height: 2 }, { deepObserve: true });
  const scene = new Signal<ThreeSceneState | null>(sceneState());
  const ascii = new Signal(createDefaultAsciiOptions("sharp"));
  const enabled = new Signal(true);
  let updates = 0;
  let renderer: RevisionedStableGridRenderer | undefined;
  const panel = new ThreePanelFrameView({
    rectangle,
    scene,
    ascii,
    enabled,
    frameInterval: 1,
    onUpdate: () => {
      updates += 1;
    },
    rendererFactory: (options) => renderer = new RevisionedStableGridRenderer(options.columns, options.rows),
  });

  try {
    await waitFor(() => (renderer?.renderCount ?? 0) >= 5);

    assert(renderer);
    assert(renderer.renderCount >= 5);
    assertEquals(updates, 2);
  } finally {
    panel.dispose();
    rectangle.dispose();
    scene.dispose();
    ascii.dispose();
    enabled.dispose();
  }
});

Deno.test("ThreePanelFrameView treats unchanged grid revisions as unchanged frames", async () => {
  const rectangle = new Signal({ column: 0, row: 0, width: 4, height: 2 }, { deepObserve: true });
  const scene = new Signal<ThreeSceneState | null>(sceneState());
  const ascii = new Signal(createDefaultAsciiOptions("sharp"));
  const enabled = new Signal(true);
  let updates = 0;
  let renderer: StableRevisionGridRenderer | undefined;
  const panel = new ThreePanelFrameView({
    rectangle,
    scene,
    ascii,
    enabled,
    frameInterval: 1,
    onUpdate: () => {
      updates += 1;
    },
    rendererFactory: (options) => renderer = new StableRevisionGridRenderer(options.columns, options.rows),
  });

  try {
    await waitFor(() => (renderer?.renderCount ?? 0) >= 5);

    assert(renderer);
    assert(renderer.renderCount >= 5);
    assertEquals(updates, 2);
  } finally {
    panel.dispose();
    rectangle.dispose();
    scene.dispose();
    ascii.dispose();
    enabled.dispose();
  }
});

Deno.test("ThreePanelFrameView caps large ASCII renderer sizes", async () => {
  const rectangle = new Signal({ column: 0, row: 0, width: 160, height: 60 }, { deepObserve: true });
  const scene = new Signal<ThreeSceneState | null>(sceneState());
  const ascii = new Signal(createDefaultAsciiOptions("sharp"));
  const enabled = new Signal(true);
  let renderer: FakeGridRenderer | undefined;
  const panel = new ThreePanelFrameView({
    rectangle,
    scene,
    ascii,
    enabled,
    frameInterval: 1,
    rendererFactory: (options) => renderer = new FakeGridRenderer(options.columns, options.rows),
  });

  try {
    await waitFor(() => (renderer?.renderCount ?? 0) >= 1);

    assert(renderer);
    assert(renderer.columns * renderer.rows <= 3_840);
    assert(renderer.columns < 160);
    assert(renderer.rows < 60);

    const expanded = resolveThreePanelRenderSize(rectangle.peek(), 7_680);
    ascii.value = { ...ascii.peek(), renderMaxCells: 7_680 };
    await waitFor(() =>
      renderer?.sizes.some(([columns, rows]) => columns === expanded.columns && rows === expanded.rows) === true
    );

    rectangle.value = { column: 0, row: 0, width: 80, height: 24 };
    await waitFor(() => renderer?.sizes.some(([columns, rows]) => columns === 80 && rows === 24) === true);
  } finally {
    panel.dispose();
    rectangle.dispose();
    scene.dispose();
    ascii.dispose();
    enabled.dispose();
  }
});

Deno.test("ThreePanelFrameView accepts reactive render cell caps", async () => {
  const rectangle = new Signal({ column: 0, row: 0, width: 160, height: 60 }, { deepObserve: true });
  const scene = new Signal<ThreeSceneState | null>(sceneState());
  const ascii = new Signal({ ...createDefaultAsciiOptions("sharp"), renderMaxCells: 7_680 });
  const enabled = new Signal(true);
  const maxRenderCells = new Signal(960);
  let renderer: FakeGridRenderer | undefined;
  const panel = new ThreePanelFrameView({
    rectangle,
    scene,
    ascii,
    enabled,
    maxRenderCells,
    frameInterval: 1,
    rendererFactory: (options) => renderer = new FakeGridRenderer(options.columns, options.rows),
  });

  try {
    await waitFor(() => (renderer?.renderCount ?? 0) >= 1);

    assert(renderer);
    assert(renderer.sizes.some(([columns, rows]) => columns * rows <= 960));

    maxRenderCells.value = 1_920;
    await waitFor(() => renderer?.sizes.some(([columns, rows]) => columns * rows > 960) === true);
    assertEquals(ascii.peek().renderMaxCells, 7_680);
  } finally {
    panel.dispose();
    rectangle.dispose();
    scene.dispose();
    ascii.dispose();
    enabled.dispose();
    maxRenderCells.dispose();
  }
});

Deno.test("ThreePanelFrameView keeps user render cells under reactive pressure caps", async () => {
  const rectangle = new Signal({ column: 0, row: 0, width: 160, height: 60 }, { deepObserve: true });
  const scene = new Signal<ThreeSceneState | null>(sceneState());
  const ascii = new Signal({ ...createDefaultAsciiOptions("sharp"), renderMaxCells: 480 });
  const enabled = new Signal(true);
  const maxRenderCells = new Signal(1_920);
  let renderer: FakeGridRenderer | undefined;
  const panel = new ThreePanelFrameView({
    rectangle,
    scene,
    ascii,
    enabled,
    maxRenderCells,
    frameInterval: 1,
    rendererFactory: (options) => renderer = new FakeGridRenderer(options.columns, options.rows),
  });

  try {
    await waitFor(() => (renderer?.renderCount ?? 0) >= 1);

    assert(renderer);
    assert(renderer.sizes.some(([columns, rows]) => columns * rows <= 480));

    ascii.value = { ...ascii.peek(), renderMaxCells: 960 };
    await waitFor(() => renderer?.sizes.some(([columns, rows]) => columns * rows > 480) === true);
    assert(renderer.sizes.every(([columns, rows]) => columns * rows <= 1_920));
  } finally {
    panel.dispose();
    rectangle.dispose();
    scene.dispose();
    ascii.dispose();
    enabled.dispose();
    maxRenderCells.dispose();
  }
});

Deno.test("ThreePanelFrameView accepts reactive frame intervals", async () => {
  const rectangle = new Signal({ column: 0, row: 0, width: 32, height: 12 }, { deepObserve: true });
  const scene = new Signal<ThreeSceneState | null>(sceneState());
  const ascii = new Signal(createDefaultAsciiOptions("sharp"));
  const enabled = new Signal(true);
  const frameInterval = new Signal(50);
  let renderer: FakeGridRenderer | undefined;
  const panel = new ThreePanelFrameView({
    rectangle,
    scene,
    ascii,
    enabled,
    frameInterval,
    rendererFactory: (options) => renderer = new FakeGridRenderer(options.columns, options.rows),
  });

  try {
    await waitFor(() => (renderer?.renderCount ?? 0) >= 1);
    const firstCount = renderer!.renderCount;

    frameInterval.value = 100;
    await waitFor(() => (renderer?.renderCount ?? 0) > firstCount);
  } finally {
    panel.dispose();
    rectangle.dispose();
    scene.dispose();
    ascii.dispose();
    enabled.dispose();
    frameInterval.dispose();
  }
});

Deno.test("ThreePanelFrameView lowers render cells after slow renderer telemetry", async () => {
  const rectangle = new Signal({ column: 0, row: 0, width: 160, height: 60 }, { deepObserve: true });
  const scene = new Signal<ThreeSceneState | null>(sceneState());
  const ascii = new Signal({ ...createDefaultAsciiOptions("sharp"), renderMaxCells: 3_840 });
  const enabled = new Signal(true);
  const diagnostics = new DiagnosticsCollector();
  let renderer: TelemetryGridRenderer | undefined;
  const panel = new ThreePanelFrameView({
    rectangle,
    scene,
    ascii,
    enabled,
    frameInterval: 1,
    diagnostics,
    rendererFactory: (options) => renderer = new TelemetryGridRenderer(options.columns, options.rows, 220),
  });

  try {
    await waitFor(() => (renderer?.renderCount ?? 0) >= 3);

    assert(renderer);
    assertEquals(ascii.peek().renderMaxCells, 3_840);
    assert(renderer.sizes.some(([columns, rows]) => columns * rows <= 1_920));
    assert(
      diagnostics.entries().some((entry) =>
        entry.source === "three-panel" && entry.code === "three-ascii-adaptive-render-cells"
      ),
    );
  } finally {
    panel.dispose();
    rectangle.dispose();
    scene.dispose();
    ascii.dispose();
    enabled.dispose();
  }
});

Deno.test("ThreePanelFrameView does not lower render cells from a startup outlier", async () => {
  const rectangle = new Signal({ column: 0, row: 0, width: 160, height: 60 }, { deepObserve: true });
  const scene = new Signal<ThreeSceneState | null>(sceneState());
  const ascii = new Signal({ ...createDefaultAsciiOptions("sharp"), renderMaxCells: 3_840 });
  const enabled = new Signal(true);
  let renderer: SequenceTelemetryGridRenderer | undefined;
  const panel = new ThreePanelFrameView({
    rectangle,
    scene,
    ascii,
    enabled,
    frameInterval: 1,
    rendererFactory: (options) =>
      renderer = new SequenceTelemetryGridRenderer(options.columns, options.rows, [
        1_000,
        16,
        16,
        16,
      ]),
  });

  try {
    await waitFor(() => (renderer?.renderCount ?? 0) >= 4);

    assert(renderer);
    assertEquals(ascii.peek().renderMaxCells, 3_840);
    assertEquals(renderer.sizes.some(([columns, rows]) => columns * rows <= 1_920), false);
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

    assertEquals(panel.inspectLifecycle().state, "resizing");
    assertEquals(panel.inspectLifecycle().syncPending, true);
    assertEquals(renderer?.setSizeDuringRender, 0);
    await waitFor(() => panel.grid.peek().length === 8);
    assertEquals(panel.grid.peek()[0]?.length, 20);
    assertEquals(panel.grid.peek().flat().join("").includes("RESIZING"), true);
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
    assertEquals(panel.grid.peek()[0]?.[0] === "A", false);
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

Deno.test("ThreePanelFrameView keeps in-flight frames for signal-only scene updates", async () => {
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
    rendererFactory: (options) => renderer = new SlowGridRenderer(options.columns, options.rows, "S"),
  });

  try {
    await waitFor(() => (renderer?.startCount ?? 0) >= 1);
    scene.value = {
      mode: scene.peek()!.mode,
      signal: { ...scene.peek()!.signal, pulse: scene.peek()!.signal.pulse + 0.1 },
    };
    await new Promise((resolve) => setTimeout(resolve, 0));

    assertEquals(panel.inspectLifecycle().state, "rendering");
    renderer?.completeFrame();
    await waitFor(() => panel.grid.peek()[0]?.[0] === "S");
    assertEquals(renderer?.destroyed, false);
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

    assertEquals(panel.inspectLifecycle().state, "reconfiguring");
    renderers[0]?.completeFrame();

    await waitFor(() => (renderers[1]?.startCount ?? 0) >= 1);
    assertEquals(panel.grid.peek()[0]?.[0] === "A", false);
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
    assertEquals(panel.inspectLifecycle().state, "resizing");
    renderers[2]?.completeFrame();

    await waitFor(() => (renderers[2]?.startCount ?? 0) >= 2);
    assertEquals(renderers[2]?.setSizeDuringRender, 0);
    renderers[2]?.completeFrame();
    await waitFor(() => panel.grid.peek()[0]?.[0] === "2");

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
  let updates = 0;
  let renderer: FakeGridRenderer | undefined;
  const panel = new ThreePanelFrameView({
    rectangle,
    graphicsRectangle,
    scene,
    ascii,
    enabled,
    graphicsSurface: surface,
    frameInterval: 1000 / 30,
    onUpdate: () => {
      updates += 1;
    },
    rendererFactory: (options) => renderer = new FakeGridRenderer(options.columns, options.rows),
  });

  try {
    await waitFor(() => surface.puts.length >= 1);
    assert(renderer);
    assertEquals(renderer.renderFrameOptions[0], { ansi: false, image: true });
    assertEquals(renderer.renderCount, 0);
    assertEquals(panel.grid.peek(), Array.from({ length: 4 }, () => Array.from({ length: 8 }, () => " ")));
    const firstGrid = panel.grid.peek();
    const updatesAfterFirstGrid = updates;
    await waitFor(() => surface.puts.length >= 2);
    assertEquals(
      renderer.renderFrameOptions.every((options) => options.ansi === false && options.image === true),
      true,
    );
    assertEquals(renderer.renderCount, 0);
    assertEquals(panel.grid.peek() === firstGrid, true);
    assertEquals(updates, updatesAfterFirstGrid);
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

Deno.test("ThreePanelFrameView reports Kitty fallback diagnostics and keeps ASCII visible", async () => {
  const rectangle = new Signal({ column: 0, row: 0, width: 8, height: 4 }, { deepObserve: true });
  const graphicsRectangle = new Signal({ column: 5, row: 6, width: 8, height: 4 }, { deepObserve: true });
  const scene = new Signal<ThreeSceneState | null>(sceneState());
  const ascii = new Signal({
    ...createDefaultAsciiOptions("sharp"),
    kittyGraphics: true,
    kittyDisableAscii: true,
  });
  const enabled = new Signal(true);
  const surface = new UnavailableGraphicsSurface("raster graphics surface is unavailable");
  const diagnostics = new DiagnosticsCollector();
  const panel = new ThreePanelFrameView({
    rectangle,
    graphicsRectangle,
    scene,
    ascii,
    enabled,
    graphicsSurface: surface,
    diagnostics,
    frameInterval: 1000 / 30,
    rendererFactory: (options) => new FakeGridRenderer(options.columns, options.rows),
  });

  try {
    await waitFor(() => panel.grid.peek().length === 4);
    assertEquals(panel.grid.peek()[0]?.[0], "█");
    assertEquals(surface.puts.length, 0);
    assertEquals(diagnostics.entries().map((entry) => [entry.source, entry.code, entry.severity, entry.detail]), [
      [
        "three-panel",
        "kitty-graphics-fallback",
        "warning",
        "raster graphics surface is unavailable",
      ],
    ]);
  } finally {
    panel.dispose();
    rectangle.dispose();
    graphicsRectangle.dispose();
    scene.dispose();
    ascii.dispose();
    enabled.dispose();
  }
});

Deno.test("ThreePanelFrameView reports graphics cleanup diagnostics", async () => {
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
  const diagnostics = new DiagnosticsCollector();
  const panel = new ThreePanelFrameView({
    rectangle,
    graphicsRectangle,
    scene,
    ascii,
    enabled,
    graphicsSurface: surface,
    diagnostics,
    frameInterval: 1000 / 30,
    rendererFactory: (options) => new FakeGridRenderer(options.columns, options.rows),
  });

  try {
    await waitFor(() => surface.puts.length >= 1);
    surface.failDeletes = true;
    panel.dispose();
    await waitFor(() => diagnostics.entries().some((entry) => entry.code === "graphics-delete-failed"));
    assertEquals(diagnostics.entries().map((entry) => [entry.source, entry.code, entry.severity, entry.detail]), [
      ["three-panel", "graphics-delete-failed", "debug", "delete unavailable"],
    ]);
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

Deno.test("ThreeAsciiObject skips redundant renderer size sync on steady frames", async () => {
  const rectangle = new Signal({ column: 0, row: 0, width: 12, height: 6 }, { deepObserve: true });
  const sink = new MemoryCanvasSink();
  const canvas = new Canvas({ sink, size: { columns: 40, rows: 20 } });
  let renderer: FakeGridRenderer | undefined;
  const object = new ThreeAsciiObject({
    canvas,
    rectangle,
    scene: {} as Scene,
    camera: {} as Camera,
    style: emptyStyle,
    zIndex: 1,
    frameInterval: 5,
    rendererFactory: (options) => renderer = new FakeGridRenderer(options.columns, options.rows),
  });

  object.draw();

  try {
    await waitFor(() => (renderer?.renderCount ?? 0) >= 3);
    assertEquals(renderer?.setSizeCalls, 0);
    assertEquals(renderer?.sizes, [[12, 6]]);
  } finally {
    object.erase();
    rectangle.dispose();
  }
});

Deno.test("ThreeAsciiObject syncs renderer size changed before draw", async () => {
  const rectangle = new Signal({ column: 0, row: 0, width: 12, height: 6 }, { deepObserve: true });
  const sink = new MemoryCanvasSink();
  const canvas = new Canvas({ sink, size: { columns: 40, rows: 20 } });
  let renderer: FakeGridRenderer | undefined;
  const object = new ThreeAsciiObject({
    canvas,
    rectangle,
    scene: {} as Scene,
    camera: {} as Camera,
    style: emptyStyle,
    zIndex: 1,
    frameInterval: 5,
    rendererFactory: (options) => renderer = new FakeGridRenderer(options.columns, options.rows),
  });

  rectangle.value = { column: 0, row: 0, width: 20, height: 8 };
  object.draw();

  try {
    await waitFor(() => (renderer?.renderCount ?? 0) >= 1);
    assertEquals(renderer?.setSizeCalls, 1);
    assertEquals(renderer?.sizes, [[12, 6], [20, 8]]);
  } finally {
    object.erase();
    rectangle.dispose();
  }
});

Deno.test("ThreeAsciiObject defaults to deferred readback and preserves explicit blocking", () => {
  const rectangle = new Signal({ column: 0, row: 0, width: 12, height: 6 }, { deepObserve: true });
  const sink = new MemoryCanvasSink();
  const canvas = new Canvas({ sink, size: { columns: 40, rows: 20 } });
  const strategies: ThreeAsciiRendererOptions["readbackStrategy"][] = [];

  const deferredObject = new ThreeAsciiObject({
    canvas,
    rectangle,
    scene: {} as Scene,
    camera: {} as Camera,
    style: emptyStyle,
    zIndex: 1,
    rendererFactory: (options) => {
      strategies.push(options.readbackStrategy);
      return new FakeGridRenderer(options.columns, options.rows);
    },
  });
  deferredObject.erase();

  const blockingObject = new ThreeAsciiObject({
    canvas,
    rectangle,
    scene: {} as Scene,
    camera: {} as Camera,
    style: emptyStyle,
    zIndex: 1,
    readbackStrategy: "blocking",
    rendererFactory: (options) => {
      strategies.push(options.readbackStrategy);
      return new FakeGridRenderer(options.columns, options.rows);
    },
  });
  blockingObject.erase();

  assertEquals(strategies, ["deferred", "blocking"]);
  rectangle.dispose();
});

Deno.test("ThreeAsciiObject queues a startup grid before first frame completes", async () => {
  const rectangle = new Signal({ column: 0, row: 0, width: 32, height: 8 }, { deepObserve: true });
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
    assertEquals(object.grid.flat().join("").includes("ASCII RENDERER STARTING"), true);
    assert(queuedCellCount(object) > 0);
    await waitFor(() => (renderer?.startCount ?? 0) >= 1);
    renderer?.completeFrame();
    await waitFor(() => object.grid.flat().join("").includes("ASCII RENDERER STARTING") === false);
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

Deno.test("ThreeAsciiObject queues rerender cells only for changed ASCII grid cells", async () => {
  const rectangle = new Signal({ column: 0, row: 0, width: 2, height: 2 }, { deepObserve: true });
  const sink = new MemoryCanvasSink();
  const canvas = new Canvas({ sink, size: { columns: 8, rows: 8 } });
  let renderer: ControlledSequenceGridRenderer | undefined;
  const object = new ThreeAsciiObject({
    canvas,
    rectangle,
    scene: {} as Scene,
    camera: {} as Camera,
    style: emptyStyle,
    zIndex: 1,
    frameInterval: 5,
    rendererFactory: () =>
      renderer = new ControlledSequenceGridRenderer([
        [["A", "B"], ["C", "D"]],
        [["A", "B"], ["C", "D"]],
        [["A", "X"], ["C", "D"]],
      ]),
  });

  object.draw();
  clearQueuedCells(object);

  try {
    await waitFor(() => (renderer?.startCount ?? 0) >= 1);
    renderer?.completeFrame();
    await waitFor(() => queuedCellCount(object) === 3);

    clearQueuedCells(object);
    await waitFor(() => (renderer?.startCount ?? 0) >= 2);
    renderer?.completeFrame();
    await waitFor(() => (renderer?.completedCount ?? 0) >= 2);
    assertEquals(queuedCellCount(object), 0);

    await waitFor(() => (renderer?.startCount ?? 0) >= 3);
    renderer?.completeFrame();
    await waitFor(() => queuedCellCount(object) === 1);
    assertEquals(object.rerenderRanges[0], [{ row: 0, startColumn: 1, endColumn: 2 }]);
  } finally {
    object.erase();
    rectangle.dispose();
  }
});

Deno.test("ThreeAsciiObject skips grid diffing for unchanged renderer revisions", async () => {
  const rectangle = new Signal({ column: 0, row: 0, width: 4, height: 2 }, { deepObserve: true });
  const sink = new MemoryCanvasSink();
  const canvas = new Canvas({ sink, size: { columns: 8, rows: 8 } });
  let renderer: StableRevisionGridRenderer | undefined;
  const object = new ThreeAsciiObject({
    canvas,
    rectangle,
    scene: {} as Scene,
    camera: {} as Camera,
    style: emptyStyle,
    zIndex: 1,
    frameInterval: 5,
    rendererFactory: (options) => renderer = new StableRevisionGridRenderer(options.columns, options.rows),
  });

  object.draw();

  try {
    await waitFor(() => (renderer?.renderCount ?? 0) >= 2);
    clearQueuedCells(object);

    await waitFor(() => (renderer?.renderCount ?? 0) >= 5);
    assertEquals(queuedCellCount(object), 0);
  } finally {
    object.erase();
    rectangle.dispose();
  }
});

Deno.test("ThreeAsciiObject changed-cell queue respects view clipping", async () => {
  const rectangle = new Signal({ column: 0, row: 0, width: 3, height: 2 }, { deepObserve: true });
  const view = new View({ rectangle: { column: 1, row: 0, width: 1, height: 1 } });
  const sink = new MemoryCanvasSink();
  const canvas = new Canvas({ sink, size: { columns: 8, rows: 8 } });
  let renderer: ControlledSequenceGridRenderer | undefined;
  const object = new ThreeAsciiObject({
    canvas,
    rectangle,
    view,
    scene: {} as Scene,
    camera: {} as Camera,
    style: emptyStyle,
    zIndex: 1,
    frameInterval: 5,
    rendererFactory: () =>
      renderer = new ControlledSequenceGridRenderer([
        [["A", "B", "C"], ["D", "E", "F"]],
      ]),
  });

  object.draw();

  try {
    await waitFor(() => (renderer?.startCount ?? 0) >= 1);
    renderer?.completeFrame();
    await waitFor(() => queuedCellCount(object) === 1);
    assertEquals(object.rerenderRanges[0], [{ row: 0, startColumn: 1, endColumn: 2 }]);
    assertEquals(object.rerenderCells[0]?.has(0) ?? false, false);
    assertEquals(object.rerenderCells[0]?.has(2) ?? false, false);
    assertEquals(object.rerenderRanges[1]?.length ?? 0, 0);
  } finally {
    object.erase();
    rectangle.dispose();
    view.rectangle.dispose();
    view.offset.dispose();
    view.maxOffset.dispose();
  }
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

function queuedCellCount(object: ThreeAsciiObject): number {
  const cellCount = object.rerenderCells.reduce((total, row) => total + (row?.size ?? 0), 0);
  return object.rerenderRanges.reduce(
    (total, row) => total + (row?.reduce((rowTotal, range) => rowTotal + range.endColumn - range.startColumn, 0) ?? 0),
    cellCount,
  );
}

function clearQueuedCells(object: ThreeAsciiObject): void {
  for (const row of object.rerenderCells) {
    row?.clear();
  }
  for (const row of object.rerenderRanges) {
    if (row) row.length = 0;
  }
}

class FakeGridRenderer implements ThreePanelGridRenderer, ThreeAsciiGridRenderer {
  readonly scene = {} as Scene;
  readonly camera = {} as Camera;
  setSizeCalls = 0;
  setEffectOptionsCalls = 0;
  setTerminalEdgeBiasCalls = 0;
  setTerminalGlyphStyleCalls = 0;
  renderCount = 0;
  renderFrameOptions: ThreeAsciiRenderFrameOptions[] = [];
  sizes: Array<[number, number]> = [];
  private terminalEdgeBias = 1;
  private terminalGlyphStyle: TerminalGlyphStyle = "blocks";
  private performance: ThreeAsciiRendererPerformance;

  constructor(public columns: number, public rows: number, private readonly glyph = "█") {
    this.sizes.push([columns, rows]);
    this.performance = this.createPerformance();
  }

  setSize(columns: number, rows: number): void {
    this.setSizeCalls += 1;
    this.columns = columns;
    this.rows = rows;
    this.sizes.push([columns, rows]);
    this.performance = this.createPerformance();
  }

  setEffectOptions(): void {
    this.setEffectOptionsCalls += 1;
  }

  getTerminalEdgeBias(): number {
    return this.terminalEdgeBias;
  }

  setTerminalEdgeBias(value: number): void {
    this.setTerminalEdgeBiasCalls += 1;
    this.terminalEdgeBias = value;
  }

  getTerminalGlyphStyle(): TerminalGlyphStyle {
    return this.terminalGlyphStyle;
  }

  setTerminalGlyphStyle(value: TerminalGlyphStyle): void {
    this.setTerminalGlyphStyleCalls += 1;
    this.terminalGlyphStyle = value;
    this.performance = this.createPerformance();
  }

  async renderToAnsiGrid(
    _deltaTime?: number,
    onFrame?: (deltaTime: number) => void | Promise<void>,
  ): Promise<string[][]> {
    await onFrame?.(0.016);
    this.renderCount += 1;
    this.performance = this.createPerformance();
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
    this.renderFrameOptions.push({ ...options });
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

  inspectPerformance(): ThreeAsciiRendererPerformance {
    return { ...this.performance };
  }

  private createPerformance(): ThreeAsciiRendererPerformance {
    return {
      columns: this.columns,
      rows: this.rows,
      cells: this.columns * this.rows,
      terminalGlyphStyle: this.terminalGlyphStyle,
      totalMs: 16,
      initMs: 0,
      sceneMs: 10,
      ansiMs: 6,
      readbackMs: 4,
      assemblyMs: 2,
    };
  }
}

class ReusedGridRenderer extends FakeGridRenderer {
  readonly grid: string[][];

  constructor(columns: number, rows: number) {
    super(columns, rows);
    this.grid = Array.from({ length: rows }, () => Array.from({ length: columns }, () => "0"));
  }

  override setSize(columns: number, rows: number): void {
    super.setSize(columns, rows);
    this.grid.length = rows;
    for (let row = 0; row < rows; row += 1) {
      const values = this.grid[row] ?? [];
      values.length = columns;
      values.fill("0");
      this.grid[row] = values;
    }
  }

  override async renderToAnsiGrid(
    _deltaTime?: number,
    onFrame?: (deltaTime: number) => void | Promise<void>,
  ): Promise<string[][]> {
    await onFrame?.(0.016);
    this.renderCount += 1;
    const glyph = String(this.renderCount % 10);
    for (const row of this.grid) row.fill(glyph);
    return this.grid;
  }
}

class RevisionedStableGridRenderer extends FakeGridRenderer {
  override async renderFrame(
    deltaTime?: number,
    onFrame?: (deltaTime: number) => void | Promise<void>,
    options: ThreeAsciiRenderFrameOptions = { ansi: true },
  ) {
    const frame = await super.renderFrame(deltaTime, onFrame, options);
    return { ...frame, gridRevision: this.renderCount };
  }
}

class StableRevisionGridRenderer extends FakeGridRenderer {
  override async renderFrame(
    deltaTime?: number,
    onFrame?: (deltaTime: number) => void | Promise<void>,
    options: ThreeAsciiRenderFrameOptions = { ansi: true },
  ) {
    const frame = await super.renderFrame(deltaTime, onFrame, options);
    return { ...frame, gridRevision: 1 };
  }
}

class EmptyThenGridRenderer extends FakeGridRenderer {
  private releaseEmptyFrame?: () => void;

  override async renderFrame(
    deltaTime?: number,
    onFrame?: (deltaTime: number) => void | Promise<void>,
    _options: ThreeAsciiRenderFrameOptions = { ansi: true },
  ) {
    this.renderCount += 1;
    if (this.renderCount === 1) {
      await onFrame?.(deltaTime ?? 0.016);
      await new Promise<void>((resolve) => {
        this.releaseEmptyFrame = resolve;
      });
      return { grid: [], gridRevision: 0 };
    }
    this.renderCount -= 1;
    const grid = await super.renderToAnsiGrid(deltaTime, onFrame);
    return {
      grid,
      gridRevision: this.renderCount,
    };
  }

  completeEmptyFrame(): void {
    const release = this.releaseEmptyFrame;
    this.releaseEmptyFrame = undefined;
    release?.();
  }
}

class TelemetryGridRenderer extends FakeGridRenderer {
  constructor(columns: number, rows: number, private readonly totalMs: number) {
    super(columns, rows);
  }

  override inspectPerformance(): ThreeAsciiRendererPerformance {
    return {
      columns: this.columns,
      rows: this.rows,
      cells: this.columns * this.rows,
      terminalGlyphStyle: this.getTerminalGlyphStyle(),
      totalMs: this.totalMs,
      initMs: 0,
      sceneMs: this.totalMs * 0.7,
      ansiMs: this.totalMs * 0.3,
      readbackMs: this.totalMs * 0.2,
      assemblyMs: this.totalMs * 0.05,
    };
  }
}

class SequenceTelemetryGridRenderer extends FakeGridRenderer {
  constructor(columns: number, rows: number, private readonly totalMsByFrame: readonly number[]) {
    super(columns, rows);
  }

  override inspectPerformance(): ThreeAsciiRendererPerformance {
    const totalMs = this.totalMsByFrame[Math.max(0, Math.min(this.renderCount - 1, this.totalMsByFrame.length - 1))] ??
      16;
    return {
      columns: this.columns,
      rows: this.rows,
      cells: this.columns * this.rows,
      terminalGlyphStyle: this.getTerminalGlyphStyle(),
      totalMs,
      initMs: 0,
      sceneMs: totalMs * 0.7,
      ansiMs: totalMs * 0.3,
      readbackMs: totalMs * 0.2,
      assemblyMs: totalMs * 0.05,
    };
  }
}

class ControlledSequenceGridRenderer extends FakeGridRenderer {
  startCount = 0;
  completedCount = 0;
  private releaseFrame?: () => void;

  constructor(private readonly frames: string[][][]) {
    super(frames[0]?.[0]?.length ?? 1, frames[0]?.length ?? 1);
  }

  override async renderToAnsiGrid(
    _deltaTime?: number,
    onFrame?: (deltaTime: number) => void | Promise<void>,
  ): Promise<string[][]> {
    await onFrame?.(0.016);
    this.startCount += 1;
    await new Promise<void>((resolve) => {
      this.releaseFrame = resolve;
    });
    const frame = this.frames[Math.min(this.completedCount, this.frames.length - 1)] ?? [[" "]];
    this.completedCount += 1;
    return frame.map((row) => [...row]);
  }

  completeFrame(): void {
    const release = this.releaseFrame;
    this.releaseFrame = undefined;
    release?.();
  }
}

class FakeGraphicsSurface implements GraphicsSurface {
  readonly kind = "kitty" as const;
  readonly puts: Array<{ image: GraphicsImage; placement: GraphicsPlacement }> = [];
  readonly deleted: Array<{ handle: GraphicsHandle; mode?: GraphicsDeleteMode }> = [];
  failDeletes = false;
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
    if (this.failDeletes) throw new Error("delete unavailable");
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

class UnavailableGraphicsSurface extends FakeGraphicsSurface {
  constructor(private readonly unavailableReason: string) {
    super();
  }

  override inspect(): GraphicsSurfaceInspection {
    return {
      ...super.inspect(),
      available: false,
      reason: this.unavailableReason,
    };
  }
}

class SlowGridRenderer extends FakeGridRenderer {
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
