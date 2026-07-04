import { assertEquals } from "./deps.ts";
import { resolveThreeAsciiDeferredPreSceneFrame } from "../src/three_ascii/deferred_frame.ts";

Deno.test("resolveThreeAsciiDeferredPreSceneFrame is inactive outside ANSI-only deferred mode", () => {
  const base = {
    completed: {},
    staleFrames: 2,
    maxStaleFrames: 3,
    hasCachedGrid: true,
    saturated: true,
  };

  assertEquals(
    resolveThreeAsciiDeferredPreSceneFrame({
      ...base,
      renderAnsi: false,
      renderImage: true,
      readbackStrategy: "deferred",
    }),
    { kind: "inactive", staleFrames: 2, forceBlockingReadback: false },
  );
  assertEquals(
    resolveThreeAsciiDeferredPreSceneFrame({
      ...base,
      renderAnsi: true,
      renderImage: false,
      readbackStrategy: "blocking",
    }),
    { kind: "inactive", staleFrames: 2, forceBlockingReadback: false },
  );
});

Deno.test("resolveThreeAsciiDeferredPreSceneFrame preserves cached grids after unavailable readback", () => {
  assertEquals(
    resolveThreeAsciiDeferredPreSceneFrame({
      renderAnsi: true,
      renderImage: false,
      readbackStrategy: "deferred",
      completed: { grid: [["cached"]], readbackUnavailable: true },
      staleFrames: 2,
      maxStaleFrames: 3,
      hasCachedGrid: true,
      saturated: true,
    }),
    { kind: "readbackUnavailable", staleFrames: 2, forceBlockingReadback: false },
  );
});

Deno.test("resolveThreeAsciiDeferredPreSceneFrame reports saturated queues before scene submission", () => {
  assertEquals(
    resolveThreeAsciiDeferredPreSceneFrame({
      renderAnsi: true,
      renderImage: false,
      readbackStrategy: "deferred",
      completed: {},
      staleFrames: 0,
      maxStaleFrames: 3,
      hasCachedGrid: true,
      saturated: true,
    }),
    { kind: "saturated", staleFrames: 1, forceBlockingReadback: false },
  );
});

Deno.test("resolveThreeAsciiDeferredPreSceneFrame forces blocking after stale cached frames", () => {
  assertEquals(
    resolveThreeAsciiDeferredPreSceneFrame({
      renderAnsi: true,
      renderImage: false,
      readbackStrategy: "deferred",
      completed: {},
      staleFrames: 1,
      maxStaleFrames: 2,
      hasCachedGrid: true,
      saturated: false,
    }),
    { kind: "continue", staleFrames: 2, forceBlockingReadback: true },
  );
  assertEquals(
    resolveThreeAsciiDeferredPreSceneFrame({
      renderAnsi: true,
      renderImage: false,
      readbackStrategy: "deferred",
      completed: { grid: [["fresh"]] },
      staleFrames: 2,
      maxStaleFrames: 2,
      hasCachedGrid: true,
      saturated: false,
    }),
    { kind: "continue", staleFrames: 0, forceBlockingReadback: false },
  );
});
