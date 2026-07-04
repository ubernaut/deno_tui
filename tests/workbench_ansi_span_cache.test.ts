import { assertEquals } from "./deps.ts";
import {
  type WorkbenchAnsiScreenSpanRowCache,
  workbenchAnsiSpanRowCleanCacheMatches,
  workbenchAnsiSpanRowRenderedHintCacheMatches,
} from "../src/app/workbench_ansi_span_cache.ts";

Deno.test("workbench ANSI span clean cache matching requires width and fingerprint", () => {
  const cache: WorkbenchAnsiScreenSpanRowCache = {
    width: 12,
    fingerprint: "12:rev:4",
    line: "cached",
  };

  assertEquals(workbenchAnsiSpanRowCleanCacheMatches(cache, 12, "12:rev:4"), true);
  assertEquals(workbenchAnsiSpanRowCleanCacheMatches(cache, 11, "12:rev:4"), false);
  assertEquals(workbenchAnsiSpanRowCleanCacheMatches(cache, 12, "12:rev:5"), false);
  assertEquals(workbenchAnsiSpanRowCleanCacheMatches(cache, 12, undefined), false);
  assertEquals(workbenchAnsiSpanRowCleanCacheMatches(undefined, 12, "12:rev:4"), false);
});

Deno.test("workbench ANSI span rendered-hint cache matching requires width and line", () => {
  const cache: WorkbenchAnsiScreenSpanRowCache = {
    width: 10,
    fingerprint: "10:rev:2",
    line: "\x1b[32mREADY\x1b[0m",
  };

  assertEquals(workbenchAnsiSpanRowRenderedHintCacheMatches(cache, 10, "\x1b[32mREADY\x1b[0m"), true);
  assertEquals(workbenchAnsiSpanRowRenderedHintCacheMatches(cache, 9, "\x1b[32mREADY\x1b[0m"), false);
  assertEquals(workbenchAnsiSpanRowRenderedHintCacheMatches(cache, 10, "\x1b[31mREADY\x1b[0m"), false);
  assertEquals(workbenchAnsiSpanRowRenderedHintCacheMatches(cache, 10, undefined), false);
  assertEquals(workbenchAnsiSpanRowRenderedHintCacheMatches(undefined, 10, "\x1b[32mREADY\x1b[0m"), false);
});
