import { assertEquals } from "./deps.ts";
import { nextFrameDelay } from "../src/runtime/frame_timing.ts";
import { threePanelFrameUpdate } from "../src/app/three_panel_frame_update.ts";
import {
  isCurrentThreePanelFrame,
  ownsThreePanelFrame,
  resolveThreePanelLifecycleState,
} from "../src/app/three_panel_lifecycle.ts";
import {
  resolveOptionalThreePanelValue,
  resolveThreePanelLiveValue,
  resolveThreePanelValue,
} from "../src/app/three_panel_values.ts";
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
