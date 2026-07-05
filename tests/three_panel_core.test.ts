import { assertEquals } from "./deps.ts";
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
import { WorkbenchThreeCadenceMeter } from "../src/app/workbench_three_runtime.ts";
import { Signal } from "../src/signals/mod.ts";

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

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
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
