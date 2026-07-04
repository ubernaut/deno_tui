import { assertEquals } from "./deps.ts";
import {
  isCurrentThreePanelFrame,
  ownsThreePanelFrame,
  resolveThreePanelLifecycleState,
} from "../src/app/three_panel_lifecycle.ts";

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
