import { assertEquals } from "./deps.ts";
import { nextFrameDelay } from "../src/runtime/frame_timing.ts";

Deno.test("nextFrameDelay compensates for current frame render time", () => {
  assertEquals(nextFrameDelay(100, 1_000, 1_025), 75);
  assertEquals(nextFrameDelay(100, 1_000, 1_125), 0);
  assertEquals(nextFrameDelay(100, 1_000, 950), 100);
  assertEquals(nextFrameDelay(-1, 1_000, 1_025), 0);
});
