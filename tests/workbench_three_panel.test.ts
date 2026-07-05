import { assert, assertEquals, assertStrictEquals } from "./deps.ts";
import { Signal } from "../src/signals/mod.ts";
import { createDefaultAsciiOptions } from "../src/three_ascii/options.ts";
import {
  createWorkbenchThreePanelFrameView,
  type ThreePanelGridRenderer,
  type ThreeSceneState,
} from "../app/three_panel.ts";
import type { Rectangle } from "../src/types.ts";
import {
  hideWorkbenchThreeRect,
  setWorkbenchThreeRect,
  WORKBENCH_THREE_HIDDEN_RECT,
  workbenchThreeBodyRect,
  workbenchThreeContentGraphicsRect,
  workbenchThreeGraphicsRect,
} from "../src/app/workbench_three_geometry.ts";
import { WorkbenchThreeViewportInteractionController } from "../src/app/workbench_three_interaction.ts";
import {
  type WorkbenchThreePanelEntry,
  WorkbenchThreePanelRegistry,
} from "../src/app/workbench_three_panel_registry.ts";
import {
  type ThreeHeaderPerformance,
  threeHeaderPerformanceText,
  writeThreeHeaderPerformance,
  writeThreeHeaderRuntimePerformance,
} from "../src/app/workbench_three_header.ts";
import { applyWorkbenchThreePanelFrameDefaults } from "../src/app/workbench_three_policy.ts";
import type { WorkbenchThreeScene } from "../src/app/workbench_three_scene.ts";
import type { TerminalGlyphStyle } from "../src/three_ascii/glyphs.ts";
import type {
  ThreeAsciiRendererOptions,
  ThreeAsciiRendererPerformance,
  ThreeAsciiRenderFrameOptions,
} from "../src/three_ascii/renderer.ts";
import { WORKBENCH_THREE_READBACK_STRATEGY, WORKBENCH_THREE_RESCUE_CELLS } from "../src/app/workbench_three_policy.ts";

Deno.test("createWorkbenchThreePanelFrameView applies shared workbench Three defaults", async () => {
  const rectangle = new Signal({ column: 0, row: 0, width: 48, height: 20 }, { deepObserve: true });
  const scene = new Signal<ThreeSceneState | null>(sceneState());
  const ascii = new Signal({ ...createDefaultAsciiOptions("sharp"), renderMaxCells: 960 });
  const interactive = new Signal(false);
  let renderer: FactoryGridRenderer | undefined;
  let readbackStrategy: ThreeAsciiRendererOptions["readbackStrategy"];

  const panel = createWorkbenchThreePanelFrameView({
    rectangle,
    scene,
    ascii,
    interactive,
    frameInterval: 1,
    maxRenderCells: 960,
    rendererFactory: (options) => {
      readbackStrategy = options.readbackStrategy;
      renderer = new FactoryGridRenderer(options.columns, options.rows);
      return renderer;
    },
  });

  try {
    await waitFor(() => (renderer?.renderCount ?? 0) > 0);
    assert((renderer?.columns ?? 0) * (renderer?.rows ?? 0) <= WORKBENCH_THREE_RESCUE_CELLS);
    assertEquals(readbackStrategy, WORKBENCH_THREE_READBACK_STRATEGY);
  } finally {
    panel.dispose();
    rectangle.dispose();
    scene.dispose();
    ascii.dispose();
    interactive.dispose();
  }
});

Deno.test("applyWorkbenchThreePanelFrameDefaults preserves explicit overrides", () => {
  assertEquals(applyWorkbenchThreePanelFrameDefaults({}), {
    idleMaxRenderCells: WORKBENCH_THREE_RESCUE_CELLS,
    readbackStrategy: WORKBENCH_THREE_READBACK_STRATEGY,
  });
  assertEquals(applyWorkbenchThreePanelFrameDefaults({ idleMaxRenderCells: 480, readbackStrategy: "deferred" }), {
    idleMaxRenderCells: 480,
    readbackStrategy: "deferred",
  });
});

Deno.test("setWorkbenchThreeRect skips unchanged rectangle writes", () => {
  const target = new FakeRectSignal({ column: 1, row: 2, width: 3, height: 4 });

  assertEquals(setWorkbenchThreeRect(target, { column: 1, row: 2, width: 3, height: 4 }), false);
  assertEquals(target.writes, 0);

  assertEquals(setWorkbenchThreeRect(target, { column: 1, row: 2, width: 5, height: 4 }), true);
  assertEquals(target.writes, 1);
  assertEquals(target.peek(), { column: 1, row: 2, width: 5, height: 4 });
});

Deno.test("hideWorkbenchThreeRect skips unchanged hidden rectangle writes", () => {
  const target = new FakeRectSignal(WORKBENCH_THREE_HIDDEN_RECT);

  assertEquals(hideWorkbenchThreeRect(target), false);
  assertEquals(target.writes, 0);

  target.value = { column: 2, row: 3, width: 4, height: 5 };
  target.writes = 0;
  assertEquals(hideWorkbenchThreeRect(target), true);
  assertEquals(target.writes, 1);
  assertEquals(target.peek(), WORKBENCH_THREE_HIDDEN_RECT);
});

Deno.test("workbenchThreeGraphicsRect maps content through window and workspace offsets", () => {
  assertEquals(
    workbenchThreeGraphicsRect({
      rect: { column: 2, row: 3, width: 10, height: 4 },
      window: {
        viewport: { column: 20, row: 8, width: 40, height: 15 },
        offset: { columns: 1, rows: 2 },
      },
      workspace: {
        columnDelta: 5,
        rowDelta: 4,
        clip: { column: 0, row: 0, width: 80, height: 40 },
      },
    }),
    { column: 26, row: 13, width: 10, height: 4 },
  );
});

Deno.test("workbenchThreeGraphicsRect hides partially clipped image surfaces", () => {
  assertEquals(
    workbenchThreeGraphicsRect({
      rect: { column: 35, row: 2, width: 10, height: 4 },
      window: {
        viewport: { column: 0, row: 0, width: 40, height: 15 },
        offset: { columns: 0, rows: 0 },
      },
    }),
    { column: 35, row: 2, width: 0, height: 0 },
  );

  assertEquals(
    workbenchThreeGraphicsRect({
      rect: { column: 5, row: 5, width: 10, height: 4 },
      window: {
        viewport: { column: 0, row: 0, width: 40, height: 15 },
        offset: { columns: 0, rows: 0 },
      },
      workspace: {
        columnDelta: 0,
        rowDelta: 12,
        clip: { column: 0, row: 0, width: 80, height: 18 },
      },
    }),
    { column: 5, row: 17, width: 0, height: 0 },
  );
});

Deno.test("workbenchThreeContentGraphicsRect preserves content rect semantics", () => {
  assertEquals(
    workbenchThreeContentGraphicsRect(
      { column: 2, row: 3, width: 10, height: 4 },
      {
        window: {
          viewport: { column: 20, row: 8, width: 40, height: 15 },
          offset: { columns: 1, rows: 2 },
        },
        workspace: {
          columnDelta: 5,
          rowDelta: 4,
          clip: { column: 0, row: 0, width: 80, height: 40 },
        },
      },
    ),
    { column: 26, row: 13, width: 10, height: 4 },
  );
});

Deno.test("workbenchThreeBodyRect derives the render body below chrome rows", () => {
  assertEquals(
    workbenchThreeBodyRect({ column: 4, row: 6, width: 30, height: 12 }, { headerRows: 3, footerRows: 1 }),
    { column: 4, row: 9, width: 30, height: 8 },
  );
  assertEquals(
    workbenchThreeBodyRect({ column: 4, row: 6, width: 30, height: 2 }, { headerRows: 3, footerRows: 1 }),
    { column: 4, row: 9, width: 30, height: 0 },
  );
});

Deno.test("threeHeaderPerformanceText formats detailed target measured queue and pressure telemetry", () => {
  assertEquals(
    threeHeaderPerformanceText({
      totalMs: 17.4,
      sceneMs: 12.2,
      readbackMs: 4.1,
      assemblyMs: 1.3,
      cells: 1920,
      deferredReadbackSlots: 6,
      deferredReadbackUnresolved: 2,
      sourceMaxCells: 3840,
      targetFps: 14.2,
      measuredFps: 11.8,
      pressureCells: 60,
      pressureHighFrames: 0,
      pressureLowFrames: 12,
      pressureByteRate: 12_581,
      pressureScoped: true,
      pressureChangedRows: 18,
      pressureRenderedRows: 17,
    }, 120),
    "frame 17ms scene 12 read 4 asm 1 1920c cap 3840c @14fps live 12fps q2/6 io 13KB/s rows 18/17 tier 60c h0/l12",
  );
});

Deno.test("threeHeaderPerformanceText prefers measured fps in compact mode and falls back when narrow", () => {
  const input = {
    totalMs: 17.4,
    sceneMs: 12.2,
    readbackMs: 4.1,
    assemblyMs: 1.3,
    cells: 1920,
    deferredReadbackSlots: 6,
    deferredReadbackUnresolved: 6,
    deferredReadbackSaturated: true,
    targetFps: 18,
    measuredFps: 9.7,
    pressureCells: 30,
    pressureHighFrames: 1,
    pressureLowFrames: 0,
    pressureScoped: false,
    pressureChangedRows: 54,
    pressureRenderedRows: 17,
  };

  assertEquals(threeHeaderPerformanceText(input, 80), "17ms 1920c live 10fps sat6/6 wide rows 54/17 tier 30c h1/l0");
  assertEquals(threeHeaderPerformanceText(input, 32), "17ms 1920c live 10fps");
  assertEquals(threeHeaderPerformanceText(input, 20), "17ms 1920c");
});

Deno.test("writeThreeHeaderPerformance reuses caller-owned snapshots", () => {
  const target: ThreeHeaderPerformance = {
    totalMs: 0,
    initMs: 0,
    sceneMs: 0,
    readbackMs: 0,
    assemblyMs: 0,
    cells: 0,
  };

  const result = writeThreeHeaderPerformance(target, {
    columns: 12,
    rows: 5,
    cells: 60,
    terminalGlyphStyle: "blocks",
    totalMs: 8.6,
    initMs: 0,
    sceneMs: 4.2,
    ansiMs: 1.1,
    readbackMs: 2.2,
    assemblyMs: 1.1,
    deferredReadbackSlots: 4,
    deferredReadbackPending: 1,
    deferredReadbackUnresolved: 2,
    deferredReadbackResolved: 1,
    deferredReadbackSaturated: false,
  }, {
    sourceMaxCells: 120,
    targetFps: 20,
    measuredFps: 18.3,
    pressureCells: 60,
    pressureHighFrames: 2,
    pressureLowFrames: 4,
    pressureByteRate: 2048,
    pressureScoped: true,
    pressureChangedRows: 18,
    pressureRenderedRows: 17,
  });

  assertStrictEquals(result, target);
  assertEquals(result, {
    totalMs: 8.6,
    initMs: 0,
    sceneMs: 4.2,
    readbackMs: 2.2,
    assemblyMs: 1.1,
    cells: 60,
    deferredReadbackSlots: 4,
    deferredReadbackPending: 1,
    deferredReadbackUnresolved: 2,
    deferredReadbackSaturated: false,
    sourceMaxCells: 120,
    targetFps: 20,
    measuredFps: 18.3,
    pressureCells: 60,
    pressureHighFrames: 2,
    pressureLowFrames: 4,
    pressureByteRate: 2048,
    pressureScoped: true,
    pressureChangedRows: 18,
    pressureRenderedRows: 17,
  });
});

Deno.test("writeThreeHeaderRuntimePerformance composes pressure cadence telemetry", () => {
  const target: ThreeHeaderPerformance = {
    totalMs: 0,
    initMs: 0,
    sceneMs: 0,
    readbackMs: 0,
    assemblyMs: 0,
    cells: 0,
  };

  const result = writeThreeHeaderRuntimePerformance(target, {
    columns: 24,
    rows: 10,
    cells: 240,
    terminalGlyphStyle: "blocks",
    totalMs: 6.5,
    initMs: 0,
    sceneMs: 4.5,
    ansiMs: 0.4,
    readbackMs: 1.2,
    assemblyMs: 0.8,
  }, {
    sourceMaxCells: 960,
    frameIntervalMs: 50,
    measuredFps: 19.6,
    pressure: {
      currentCells: 960,
      highFrames: 1,
      lowFrames: 2,
      lastByteRate: 123_456,
      lastScoped: true,
      lastChangedRows: 18,
      lastRenderedRows: 17,
    },
  });

  assertStrictEquals(result, target);
  assertEquals(result.sourceMaxCells, 960);
  assertEquals(result.targetFps, 20);
  assertEquals(result.measuredFps, 19.6);
  assertEquals(result.pressureCells, 960);
  assertEquals(result.pressureHighFrames, 1);
  assertEquals(result.pressureLowFrames, 2);
  assertEquals(result.pressureByteRate, 123_456);
  assertEquals(result.pressureScoped, true);
  assertEquals(result.pressureChangedRows, 18);
  assertEquals(result.pressureRenderedRows, 17);
});

Deno.test("WorkbenchThreeViewportInteractionController starts and continues viewport drags", () => {
  const harness = createInteractionHarness();

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
  const harness = createInteractionHarness();

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
  const harness = createInteractionHarness();

  assertEquals(harness.controller.handleScroll({ x: 3, y: 4, scroll: -1 }), true);
  assertEquals(harness.panels.three.zooms, [-1]);
  assertEquals(harness.focused, ["three"]);
  assertEquals(harness.controller.handleScroll({ x: 0, y: 0, scroll: 1 }), false);
});

Deno.test("WorkbenchThreePanelRegistry lazily creates and reuses panel entries", () => {
  let created = 0;
  const registry = new WorkbenchThreePanelRegistry((id: string) => {
    created += 1;
    return fakeRegistryEntry(id);
  });

  const first = registry.ensure("viz:one");
  const second = registry.ensure("viz:one");

  assertStrictEquals(first, second);
  assertEquals(created, 1);
  assertEquals(registry.get("viz:one"), first);
});

Deno.test("WorkbenchThreePanelRegistry hides panels outside the visible set", () => {
  const registry = new WorkbenchThreePanelRegistry(fakeRegistryEntry);
  const visible = registry.ensure("viz:visible");
  const hidden = registry.ensure("viz:hidden");

  registry.hideExcept(new Set(["viz:visible"]));

  assertEquals(visible.scene.peek()?.mode, "studio");
  assertEquals(visible.rectangle.peek(), { column: 2, row: 3, width: 4, height: 5 });
  assertEquals(hidden.scene.peek(), null);
  assertEquals(hidden.rectangle.peek(), { column: 0, row: 0, width: 0, height: 0 });
  assertEquals(hidden.graphicsRectangle.peek(), { column: 0, row: 0, width: 0, height: 0 });
});

Deno.test("WorkbenchThreePanelRegistry disposes individual entries and clears all entries", () => {
  const registry = new WorkbenchThreePanelRegistry(fakeRegistryEntry);
  const one = registry.ensure("viz:one");
  const two = registry.ensure("viz:two");

  registry.dispose("viz:one");
  assertEquals(one.panel.disposed, 1);
  assertEquals((one.scene as FakeRegistrySignal<WorkbenchThreeScene | null>).disposed, 1);
  assertEquals(registry.get("viz:one"), undefined);
  assertEquals(two.panel.disposed, 0);

  registry.clear();
  assertEquals(two.panel.disposed, 1);
  assertEquals((two.scene as FakeRegistrySignal<WorkbenchThreeScene | null>).disposed, 1);
  assertEquals(registry.entries.size, 0);
});

function sceneState(): ThreeSceneState {
  return {
    mode: "studio",
    signal: {
      x: 0.5,
      y: 0.5,
      depth: 0.5,
      twist: 0,
      lift: 0,
      pulse: 0.4,
      active: true,
      pressed: false,
    },
  };
}

async function waitFor(predicate: () => boolean): Promise<void> {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error("Timed out waiting for workbench Three panel factory test condition.");
}

function createInteractionHarness() {
  const panels = { three: new FakeInteractivePanel() };
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

function fakeRegistryEntry(id: string): WorkbenchThreePanelEntry<FakeRegistryPanel, WorkbenchThreeScene> {
  return {
    rectangle: new FakeRegistrySignal({ column: 2, row: 3, width: 4, height: 5 }),
    graphicsRectangle: new FakeRegistrySignal({ column: 8, row: 9, width: 10, height: 11 }),
    scene: new FakeRegistrySignal<WorkbenchThreeScene | null>({
      mode: "studio",
      signal: {
        x: id.length,
        y: 0,
        depth: 0,
        twist: 0,
        lift: 0,
        pulse: 0,
        active: true,
        pressed: false,
      },
    }),
    panel: new FakeRegistryPanel(),
  };
}

class FactoryGridRenderer implements ThreePanelGridRenderer {
  renderCount = 0;
  private terminalEdgeBias = 1;
  private terminalGlyphStyle: TerminalGlyphStyle = "blocks";

  constructor(public columns: number, public rows: number) {}

  setSize(columns: number, rows: number): void {
    this.columns = columns;
    this.rows = rows;
  }

  setEffectOptions(): void {}

  setTerminalEdgeBias(value: number): void {
    this.terminalEdgeBias = value;
  }

  setTerminalGlyphStyle(value: TerminalGlyphStyle): void {
    this.terminalGlyphStyle = value;
  }

  async renderToAnsiGrid(): Promise<string[][]> {
    this.renderCount += 1;
    return this.grid();
  }

  async renderFrame(
    _deltaTime?: number,
    onFrame?: (deltaTime: number) => void | Promise<void>,
    _options?: ThreeAsciiRenderFrameOptions,
  ) {
    await onFrame?.(0.016);
    return { grid: await this.renderToAnsiGrid(), gridRevision: this.renderCount };
  }

  inspectPerformance(): ThreeAsciiRendererPerformance {
    return {
      totalMs: 1,
      initMs: 0,
      sceneMs: 1,
      sceneUpdateMs: 0,
      sceneRenderMs: 1,
      ansiMs: 0,
      readbackMs: 0,
      assemblyMs: 0,
      columns: this.columns,
      rows: this.rows,
      cells: this.columns * this.rows,
      terminalGlyphStyle: this.terminalGlyphStyle,
    };
  }

  destroy(): void {}

  private grid(): string[][] {
    return Array.from({ length: this.rows }, () => Array.from({ length: this.columns }, () => "█"));
  }
}

class FakeInteractivePanel {
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

class FakeRectSignal {
  writes = 0;

  constructor(private current: Rectangle) {}

  peek(): Rectangle {
    return this.current;
  }

  set value(next: Rectangle) {
    this.current = next;
    this.writes += 1;
  }
}

class FakeRegistryPanel {
  disposed = 0;

  dispose(): void {
    this.disposed += 1;
  }
}

class FakeRegistrySignal<T> {
  disposed = 0;

  constructor(private current: T) {}

  peek(): T {
    return this.current;
  }

  set value(next: T) {
    this.current = next;
  }

  dispose(): void {
    this.disposed += 1;
  }
}
