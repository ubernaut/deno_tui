import { assertEquals } from "./deps.ts";
import { resolveThreeAsciiDeferredReadbackStaleness } from "../src/three_ascii/deferred_readback_staleness.ts";

Deno.test("resolveThreeAsciiDeferredReadbackStaleness resets after completed grids", () => {
  assertEquals(
    resolveThreeAsciiDeferredReadbackStaleness({
      staleFrames: 3,
      maxStaleFrames: 2,
      completedGrid: true,
      hasCachedGrid: true,
    }),
    { staleFrames: 0, forceBlockingReadback: false },
  );
});

Deno.test("resolveThreeAsciiDeferredReadbackStaleness ignores disabled deferred recovery", () => {
  assertEquals(
    resolveThreeAsciiDeferredReadbackStaleness({
      staleFrames: 1,
      maxStaleFrames: 0,
      completedGrid: false,
      hasCachedGrid: true,
    }),
    { staleFrames: 1, forceBlockingReadback: false },
  );
});

Deno.test("resolveThreeAsciiDeferredReadbackStaleness counts uncached startup frames", () => {
  assertEquals(
    resolveThreeAsciiDeferredReadbackStaleness({
      staleFrames: 1,
      maxStaleFrames: 2,
      completedGrid: false,
      hasCachedGrid: false,
    }),
    { staleFrames: 2, forceBlockingReadback: true },
  );
});

Deno.test("resolveThreeAsciiDeferredReadbackStaleness forces blocking at threshold", () => {
  assertEquals(
    resolveThreeAsciiDeferredReadbackStaleness({
      staleFrames: 1,
      maxStaleFrames: 3,
      completedGrid: false,
      hasCachedGrid: true,
    }),
    { staleFrames: 2, forceBlockingReadback: false },
  );
  assertEquals(
    resolveThreeAsciiDeferredReadbackStaleness({
      staleFrames: 2,
      maxStaleFrames: 3,
      completedGrid: false,
      hasCachedGrid: true,
    }),
    { staleFrames: 3, forceBlockingReadback: true },
  );
});
