import { assertEquals, assertNotEquals, assertNotStrictEquals } from "./deps.ts";
import { assertRejects } from "./deps.ts";
import { nextFrameDelay } from "../src/runtime/frame_timing.ts";
import { threePanelFrameUpdate } from "../src/app/three_panel_core.ts";
import {
  isCurrentThreePanelFrame,
  ownsThreePanelFrame,
  resolveThreePanelLifecycleState,
} from "../src/app/three_panel_core.ts";
import {
  resolveOptionalThreePanelValue,
  resolveThreePanelLiveValue,
  resolveThreePanelValue,
  ThreePanelRenderQueue,
} from "../src/app/three_panel_core.ts";
import {
  emptyThreePanelRendererState,
  resolveThreePanelRendererStateUpdate,
  threePanelAsciiEffectOptionsEqual,
  threePanelRendererStateMatches,
} from "../src/app/three_panel_effect.ts";
import {
  fingerprintThreePanelGrid,
  hasThreePanelGridCells,
  threePanelBlankGrid,
  ThreePanelGridPublicationCache,
  ThreePanelGridPublisher,
} from "../src/app/three_panel_grid.ts";
import { ThreePanelGraphicsImageController } from "../src/app/three_panel_graphics.ts";
import { WorkbenchThreeCadenceMeter } from "../src/app/workbench_three_runtime.ts";
import { DiagnosticsCollector } from "../src/runtime/diagnostics.ts";
import type {
  GraphicsDeleteMode,
  GraphicsHandle,
  GraphicsImage,
  GraphicsPlacement,
  GraphicsSurface,
  GraphicsSurfaceInspection,
} from "../src/runtime/graphics_surface.ts";
import { Signal } from "../src/signals/mod.ts";
import { asciiEffectOptions, createDefaultAsciiOptions } from "../src/three_ascii/options.ts";
import type { ThreeAsciiImageFrame } from "../src/three_ascii/renderer.ts";

Deno.test("nextFrameDelay compensates for current frame render time", () => {
  assertEquals(nextFrameDelay(100, 1_000, 1_025), 75);
  assertEquals(nextFrameDelay(100, 1_000, 1_125), 0);
  assertEquals(nextFrameDelay(100, 1_000, 950), 100);
  assertEquals(nextFrameDelay(-1, 1_000, 1_025), 0);
});

Deno.test("three panel value resolver reads literals and signal-like values", () => {
  const signal = new Signal(42);

  assertEquals(resolveThreePanelValue(7), 7);
  assertEquals(resolveThreePanelValue(signal), 42);

  signal.value = 64;
  assertEquals(resolveThreePanelValue(signal), 64);

  signal.dispose();
});

Deno.test("three panel optional value resolver preserves undefined", () => {
  const signal = new Signal(12);

  assertEquals(resolveOptionalThreePanelValue<number>(undefined), undefined);
  assertEquals(resolveOptionalThreePanelValue(5), 5);
  assertEquals(resolveOptionalThreePanelValue(signal), 12);

  signal.dispose();
});

Deno.test("three panel live value resolver defaults true and supports callbacks", () => {
  let active = false;
  const signal = new Signal(false);

  assertEquals(resolveThreePanelLiveValue(undefined), true);
  assertEquals(resolveThreePanelLiveValue(true), true);
  assertEquals(resolveThreePanelLiveValue(signal), false);
  signal.value = true;
  assertEquals(resolveThreePanelLiveValue(signal), true);
  assertEquals(resolveThreePanelLiveValue(() => active), false);
  active = true;
  assertEquals(resolveThreePanelLiveValue(() => active), true);

  signal.dispose();
});

Deno.test("threePanelFrameUpdate describes empty unpublished grids", () => {
  assertEquals(threePanelFrameUpdate(undefined, false), {
    rendererBacked: false,
    rows: 0,
    columns: 0,
  });
  assertEquals(threePanelFrameUpdate([], true), {
    rendererBacked: true,
    rows: 0,
    columns: 0,
  });
});

Deno.test("threePanelFrameUpdate counts rows and first row columns", () => {
  assertEquals(threePanelFrameUpdate([["A", "B"], ["C"]], true), {
    rendererBacked: true,
    rows: 2,
    columns: 2,
  });
});

Deno.test("threePanelFrameUpdate tolerates sparse first rows", () => {
  assertEquals(threePanelFrameUpdate([undefined, ["A", "B", "C"]], false), {
    rendererBacked: false,
    rows: 2,
    columns: 0,
  });
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

Deno.test("ownsThreePanelFrame requires live generation and renderer bundle identity", () => {
  const renderer = {};
  const bundle = {};
  const base = {
    disposed: false,
    currentGeneration: 3,
    frameGeneration: 3,
    currentRenderer: renderer,
    frameRenderer: renderer,
    currentBundle: bundle,
    frameBundle: bundle,
  };

  assertEquals(ownsThreePanelFrame(base), true);
  assertEquals(ownsThreePanelFrame({ ...base, disposed: true }), false);
  assertEquals(ownsThreePanelFrame({ ...base, currentGeneration: 4 }), false);
  assertEquals(ownsThreePanelFrame({ ...base, currentRenderer: {} }), false);
  assertEquals(ownsThreePanelFrame({ ...base, currentBundle: {} }), false);
  assertEquals(ownsThreePanelFrame({ ...base, currentRenderer: undefined }), false);
  assertEquals(ownsThreePanelFrame({ ...base, currentBundle: undefined }), false);
});

Deno.test("isCurrentThreePanelFrame also requires the render loop to be running", () => {
  const renderer = {};
  const bundle = {};
  const base = {
    disposed: false,
    running: true,
    currentGeneration: 2,
    frameGeneration: 2,
    currentRenderer: renderer,
    frameRenderer: renderer,
    currentBundle: bundle,
    frameBundle: bundle,
  };

  assertEquals(isCurrentThreePanelFrame(base), true);
  assertEquals(isCurrentThreePanelFrame({ ...base, running: false }), false);
  assertEquals(isCurrentThreePanelFrame({ ...base, currentGeneration: 3 }), false);
});

Deno.test("WorkbenchThreeCadenceMeter reports observed frame cadence after repeated updates", () => {
  const meter = new WorkbenchThreeCadenceMeter({ alpha: 0.5 });

  assertEquals(meter.inspect(), { updates: 0, averageFrameMs: undefined, measuredFps: undefined });
  assertEquals(meter.record(100), { updates: 1, averageFrameMs: undefined, measuredFps: undefined });
  assertEquals(meter.record(150), { updates: 2, averageFrameMs: 50, measuredFps: 20 });
  assertEquals(meter.record(250), { updates: 3, averageFrameMs: 75, measuredFps: 1000 / 75 });
});

Deno.test("WorkbenchThreeCadenceMeter resets stale gaps without retaining old cadence", () => {
  const meter = new WorkbenchThreeCadenceMeter({ resetAfterMs: 100 });

  meter.record(0);
  meter.record(50);
  assertEquals(meter.inspect().averageFrameMs, 50);

  meter.record(500);
  assertEquals(meter.inspect().averageFrameMs, 450);

  meter.reset();
  assertEquals(meter.inspect(), { updates: 0, averageFrameMs: undefined, measuredFps: undefined });
});

Deno.test("WorkbenchThreeCadenceMeter hides stale measured fps before the next update", () => {
  const meter = new WorkbenchThreeCadenceMeter({ resetAfterMs: 100 });

  meter.record(0);
  meter.record(50);

  assertEquals(meter.inspectAt(75), { updates: 2, averageFrameMs: 50, measuredFps: 20 });
  assertEquals(meter.measuredFps(151), undefined);
  assertEquals(meter.inspectAt(151), { updates: 2, averageFrameMs: undefined, measuredFps: undefined });
});

Deno.test("ThreePanelRenderQueue serializes queued frame work", async () => {
  const queue = new ThreePanelRenderQueue();
  const order: string[] = [];
  const releaseFirst = deferred<void>();

  const first = queue.run(async () => {
    order.push("first:start");
    await releaseFirst.promise;
    order.push("first:end");
    return "first";
  });
  const second = queue.run(() => {
    order.push("second");
    return "second";
  });

  await waitFor(() => order.length === 1);
  assertEquals(order, ["first:start"]);
  assertEquals(queue.inspect().running, 1);
  assertEquals(queue.inspect().pending, 1);

  releaseFirst.resolve();
  assertEquals(await Promise.all([first, second]), ["first", "second"]);
  assertEquals(order, ["first:start", "first:end", "second"]);
  assertEquals(queue.inspect(), {
    running: 0,
    pending: 0,
    scheduled: 2,
    completed: 2,
    failed: 0,
  });
});

Deno.test("ThreePanelRenderQueue continues after a failed frame", async () => {
  const queue = new ThreePanelRenderQueue();
  const error = new Error("frame failed");

  await assertRejects(
    () =>
      queue.run(() => {
        throw error;
      }),
    Error,
    "frame failed",
  );

  assertEquals(await queue.run(() => "next"), "next");
  assertEquals(queue.inspect(), {
    running: 0,
    pending: 0,
    scheduled: 2,
    completed: 1,
    failed: 1,
  });
});

Deno.test("threePanelAsciiEffectOptionsEqual rejects missing previous state", () => {
  const next = asciiEffectOptions(createDefaultAsciiOptions("sharp"));
  assertEquals(threePanelAsciiEffectOptionsEqual(undefined, next), false);
});

Deno.test("threePanelAsciiEffectOptionsEqual accepts matching effect state", () => {
  const options = createDefaultAsciiOptions("sharp");
  assertEquals(threePanelAsciiEffectOptionsEqual(asciiEffectOptions(options), asciiEffectOptions(options)), true);
});

Deno.test("threePanelAsciiEffectOptionsEqual detects changed renderer effect fields", () => {
  const base = createDefaultAsciiOptions("sharp");
  const changed = { ...base, edgeThreshold: base.edgeThreshold + 1 };
  assertEquals(threePanelAsciiEffectOptionsEqual(asciiEffectOptions(base), asciiEffectOptions(changed)), false);
});

Deno.test("threePanelRendererStateMatches ignores scene signal churn and detects renderer changes", () => {
  const base = createDefaultAsciiOptions("sharp");
  const effectOptions = asciiEffectOptions(base);
  const current = {
    columns: 40,
    rows: 12,
    effectOptions,
    terminalEdgeBias: base.terminalEdgeBias,
    terminalGlyphStyle: base.terminalGlyphStyle,
  };

  assertEquals(threePanelRendererStateMatches(current, { ...current, effectOptions }), true);
  assertEquals(threePanelRendererStateMatches(current, { ...current, columns: 41, effectOptions }), false);
  assertEquals(
    threePanelRendererStateMatches(current, {
      ...current,
      effectOptions: asciiEffectOptions({ ...base, edgeThreshold: base.edgeThreshold + 1 }),
    }),
    false,
  );
  assertEquals(
    threePanelRendererStateMatches(current, {
      ...current,
      terminalGlyphStyle: "glyphs",
      effectOptions,
    }),
    false,
  );
});

Deno.test("resolveThreePanelRendererStateUpdate reports setter-specific changes", () => {
  const base = createDefaultAsciiOptions("sharp");
  const effectOptions = asciiEffectOptions(base);
  const current = {
    columns: 40,
    rows: 12,
    effectOptions,
    terminalEdgeBias: base.terminalEdgeBias,
    terminalGlyphStyle: base.terminalGlyphStyle,
  };

  assertEquals(resolveThreePanelRendererStateUpdate(current, { ...current, effectOptions }).changed, false);

  assertEquals(resolveThreePanelRendererStateUpdate(current, { ...current, columns: 41, effectOptions }), {
    next: { ...current, columns: 41, effectOptions },
    resize: true,
    effect: false,
    terminalEdgeBias: false,
    terminalGlyphStyle: false,
    changed: true,
  });

  assertEquals(
    resolveThreePanelRendererStateUpdate(current, {
      ...current,
      effectOptions: asciiEffectOptions({ ...base, exposure: base.exposure + 0.1 }),
    }).effect,
    true,
  );
  assertEquals(
    resolveThreePanelRendererStateUpdate(current, { ...current, terminalEdgeBias: base.terminalEdgeBias + 0.1 })
      .terminalEdgeBias,
    true,
  );
  assertEquals(
    resolveThreePanelRendererStateUpdate(current, { ...current, terminalGlyphStyle: "glyphs" }).terminalGlyphStyle,
    true,
  );
});

Deno.test("emptyThreePanelRendererState forces initial renderer configuration", () => {
  const base = createDefaultAsciiOptions("sharp");
  const next = {
    columns: 80,
    rows: 24,
    effectOptions: asciiEffectOptions(base),
    terminalEdgeBias: base.terminalEdgeBias,
    terminalGlyphStyle: base.terminalGlyphStyle,
  };

  assertEquals(resolveThreePanelRendererStateUpdate(emptyThreePanelRendererState(), next), {
    next,
    resize: true,
    effect: true,
    terminalEdgeBias: true,
    terminalGlyphStyle: true,
    changed: true,
  });
});

Deno.test("threePanelBlankGrid creates stable space-filled rows", () => {
  assertEquals(threePanelBlankGrid(-1, 2), [[], []]);
  assertEquals(threePanelBlankGrid(3, 2), [
    [" ", " ", " "],
    [" ", " ", " "],
  ]);
});

Deno.test("fingerprintThreePanelGrid distinguishes content shape and text", () => {
  const base = fingerprintThreePanelGrid([
    ["A", "B"],
    ["C", "D"],
  ]);

  assertEquals(fingerprintThreePanelGrid([["A", "B"], ["C", "D"]]), base);
  assertNotEquals(fingerprintThreePanelGrid([["A", "B"], ["C", "E"]]), base);
  assertNotEquals(fingerprintThreePanelGrid([["A", "B", "C"], ["D"]]), base);
  assertNotEquals(fingerprintThreePanelGrid([["AB"], ["CD"]]), base);
  assertNotEquals(fingerprintThreePanelGrid([["A", "B"], undefined, ["C", "D"]]), base);
});

Deno.test("ThreePanelGridPublicationCache skips repeated revisioned grids", () => {
  const cache = new ThreePanelGridPublicationCache();
  const grid = [["A"]];

  assertEquals(cache.shouldPublish({ grid, revision: 1 }), true);
  assertEquals(cache.shouldPublish({ grid, revision: 1 }), false);
  assertEquals(cache.shouldPublish({ grid: [["A"]], revision: 2 }), false);
  assertEquals(cache.shouldPublish({ grid: [["B"]], revision: 3 }), true);
});

Deno.test("ThreePanelGridPublicationCache preserves unrevisioned identity and fingerprint behavior", () => {
  const cache = new ThreePanelGridPublicationCache();
  const grid = [["A"]];

  assertEquals(cache.shouldPublish({ grid, currentGrid: [] }), true);
  assertEquals(cache.shouldPublish({ grid, currentGrid: grid }), false);
  assertEquals(cache.shouldPublish({ grid: [["A"]], currentGrid: grid, forceUpdate: true }), false);
  assertEquals(cache.shouldPublish({ grid: [["B"]], currentGrid: grid }), true);
});

Deno.test("ThreePanelGridPublicationCache reset allows a matching grid to publish again", () => {
  const cache = new ThreePanelGridPublicationCache();
  const grid = [["A"]];

  assertEquals(cache.shouldPublish({ grid }), true);
  assertEquals(cache.shouldPublish({ grid: [["A"]] }), false);
  cache.reset();
  assertEquals(cache.shouldPublish({ grid: [["A"]] }), true);
});

Deno.test("ThreePanelGridPublisher reuses blank grids and resets buffers", () => {
  const publisher = new ThreePanelGridPublisher();
  const first = publisher.blankGridFor(3, 2);

  assertEquals(first, [
    [" ", " ", " "],
    [" ", " ", " "],
  ]);
  assertEquals(publisher.blankGridFor(3, 2), first);

  const resized = publisher.blankGridFor(2, 1);
  assertEquals(resized, [[" ", " "]]);
  assertNotEquals(resized, first);

  publisher.reset();
  assertNotStrictEquals(publisher.blankGridFor(2, 1), resized);
});

Deno.test("ThreePanelGridPublisher projects publication decisions with renderer-backed state", () => {
  const publisher = new ThreePanelGridPublisher();
  const grid = [["A"]];

  assertEquals(publisher.shouldPublish({ grid, currentGrid: [], rendererBacked: true }), {
    publish: true,
    grid,
    rendererBacked: true,
  });
  assertEquals(publisher.shouldPublish({ grid: [["A"]], currentGrid: grid, rendererBacked: true }), {
    publish: false,
    grid: [["A"]],
    rendererBacked: true,
  });
  assertEquals(publisher.shouldPublish({ grid: [["B"]], currentGrid: grid }), {
    publish: true,
    grid: [["B"]],
    rendererBacked: false,
  });
});

Deno.test("hasThreePanelGridCells reports visible grid dimensions", () => {
  assertEquals(hasThreePanelGridCells([]), false);
  assertEquals(hasThreePanelGridCells([[]]), false);
  assertEquals(hasThreePanelGridCells([undefined]), false);
  assertEquals(hasThreePanelGridCells([[" "]]), true);
});

Deno.test("ThreePanelGraphicsImageController replaces and clears image handles", async () => {
  const surface = new FakeGraphicsSurface();
  let generation = 1;
  let disposed = false;
  const controller = new ThreePanelGraphicsImageController({
    currentGeneration: () => generation,
    disposed: () => disposed,
  });

  await controller.put(surface, imageFrame(), { column: 2, row: 3, width: 8, height: 4 }, generation);
  assertEquals(controller.hasHandle, true);
  assertEquals(surface.puts.length, 1);
  assertEquals(surface.puts[0]?.placement, { column: 2, row: 3, width: 8, height: 4, zIndex: 1 });

  await controller.put(surface, imageFrame(), { column: 4, row: 5, width: 6, height: 3 }, generation);
  assertEquals(surface.deleted.map((entry) => entry.mode), ["image"]);
  assertEquals(surface.puts.length, 2);
  assertEquals(controller.hasHandle, true);

  disposed = true;
  await controller.clear(surface);
  assertEquals(surface.deleted.length, 2);
  assertEquals(controller.hasHandle, false);
});

Deno.test("ThreePanelGraphicsImageController deletes stale frame handles and preserves current state", async () => {
  const surface = new FakeGraphicsSurface();
  let generation = 1;
  const controller = new ThreePanelGraphicsImageController({
    currentGeneration: () => generation,
    disposed: () => false,
  });

  generation = 2;
  await controller.put(surface, imageFrame(), { column: 0, row: 0, width: 4, height: 2 }, 1);

  assertEquals(surface.puts.length, 1);
  assertEquals(surface.deleted.length, 1);
  assertEquals(controller.hasHandle, false);
});

Deno.test("ThreePanelGraphicsImageController forgets handles even when no surface can clear them", async () => {
  const surface = new FakeGraphicsSurface();
  const controller = new ThreePanelGraphicsImageController({
    currentGeneration: () => 1,
    disposed: () => false,
  });

  await controller.put(surface, imageFrame(), { column: 0, row: 0, width: 4, height: 2 }, 1);
  await controller.clear(undefined);

  assertEquals(controller.hasHandle, false);
  assertEquals(surface.deleted.length, 0);
});

Deno.test("ThreePanelGraphicsImageController reports cleanup failures", async () => {
  const surface = new FakeGraphicsSurface();
  const diagnostics = new DiagnosticsCollector();
  const controller = new ThreePanelGraphicsImageController({
    diagnostics,
    currentGeneration: () => 1,
    disposed: () => false,
  });

  await controller.put(surface, imageFrame(), { column: 0, row: 0, width: 4, height: 2 }, 1);
  surface.failDeletes = true;
  await controller.clear(surface);

  assertEquals(diagnostics.entries().map((entry) => [entry.source, entry.code, entry.severity, entry.detail]), [
    ["three-panel", "graphics-delete-failed", "debug", "delete unavailable"],
  ]);
});

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function imageFrame(): ThreeAsciiImageFrame {
  return {
    data: new Uint8Array([1, 2, 3, 4]),
    encoding: "bytes",
    format: 32,
    pixelWidth: 1,
    pixelHeight: 1,
  };
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
    };
  }
}

async function waitFor(predicate: () => boolean, timeoutMs = 200): Promise<void> {
  const startedAt = performance.now();
  while (!predicate()) {
    if (performance.now() - startedAt > timeoutMs) {
      throw new Error("timed out waiting for render queue state");
    }
    await new Promise((resolve) => setTimeout(resolve, 1));
  }
}
