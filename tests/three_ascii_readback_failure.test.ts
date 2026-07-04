import { assertEquals, assertThrows } from "./deps.ts";
import { ThreeAsciiReadbackError } from "../src/three_ascii/renderer.ts";
import { handleThreeAsciiDeferredReadbackFailure } from "../src/three_ascii/readback_failure.ts";

Deno.test("handleThreeAsciiDeferredReadbackFailure preserves cached grid and destroys failed queue", () => {
  const cachedGrid = [["cached"]];
  let destroyed = 0;
  const result = handleThreeAsciiDeferredReadbackFailure(
    new ThreeAsciiReadbackError(new Error("map rejected")),
    ThreeAsciiReadbackError,
    {
      lastCompletedGrid: () => cachedGrid,
      destroy: () => {
        destroyed += 1;
      },
    },
  );

  assertEquals(result, {
    handled: true,
    result: { grid: cachedGrid, readbackUnavailable: true },
  });
  assertEquals(destroyed, 1);
});

Deno.test("handleThreeAsciiDeferredReadbackFailure ignores unrelated errors", () => {
  const result = handleThreeAsciiDeferredReadbackFailure(
    new Error("boom"),
    ThreeAsciiReadbackError,
    {
      lastCompletedGrid: () => {
        throw new Error("should not read cached grid");
      },
      destroy: () => {
        throw new Error("should not destroy queue");
      },
    },
  );

  assertEquals(result, { handled: false });
});

Deno.test("handleThreeAsciiDeferredReadbackFailure lets queue cleanup errors surface", () => {
  assertThrows(
    () =>
      handleThreeAsciiDeferredReadbackFailure(
        new ThreeAsciiReadbackError(new Error("map rejected")),
        ThreeAsciiReadbackError,
        {
          lastCompletedGrid: () => [["cached"]],
          destroy: () => {
            throw new Error("destroy failed");
          },
        },
      ),
    Error,
    "destroy failed",
  );
});
