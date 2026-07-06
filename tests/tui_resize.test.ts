import { assertEquals } from "./deps.ts";
import { shouldUseRecentlyVerifiedTerminalSize } from "../src/tui.ts";

Deno.test("Tui keeps a recent verified terminal size over stale consoleSize reads", () => {
  assertEquals(
    shouldUseRecentlyVerifiedTerminalSize(
      { columns: 100, rows: 30 },
      { size: { columns: 160, rows: 48 }, readAt: 1_000 },
      1_500,
    ),
    true,
  );
});

Deno.test("Tui accepts consoleSize again after the verified resize hold expires", () => {
  assertEquals(
    shouldUseRecentlyVerifiedTerminalSize(
      { columns: 100, rows: 30 },
      { size: { columns: 160, rows: 48 }, readAt: 1_000 },
      3_000,
    ),
    false,
  );
});

Deno.test("Tui does not pin the verified size once consoleSize matches it", () => {
  assertEquals(
    shouldUseRecentlyVerifiedTerminalSize(
      { columns: 160, rows: 48 },
      { size: { columns: 160, rows: 48 }, readAt: 1_000 },
      1_500,
    ),
    false,
  );
});
