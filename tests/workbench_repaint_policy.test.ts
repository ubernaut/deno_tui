import { assertEquals } from "./deps.ts";
import {
  DEFAULT_WORKBENCH_FULL_REPAINT_INTERVAL_MS,
  DEFAULT_WORKBENCH_RESIZE_REPAINT_WINDOW_MS,
  normalizeWorkbenchFullRepaintInterval,
  syncWorkbenchTerminalSize,
  WorkbenchFullRepaintPolicy,
  workbenchScreenHeight,
  type WorkbenchScreenSizeTarget,
  workbenchScreenWidth,
} from "../src/app/workbench_repaint_policy.ts";

Deno.test("WorkbenchFullRepaintPolicy uses a conservative default interval", () => {
  assertEquals(normalizeWorkbenchFullRepaintInterval(undefined), DEFAULT_WORKBENCH_FULL_REPAINT_INTERVAL_MS);
  assertEquals(DEFAULT_WORKBENCH_FULL_REPAINT_INTERVAL_MS >= 15_000, true);
});

Deno.test("WorkbenchFullRepaintPolicy forces repaint only after the interval elapses", () => {
  let now = 100;
  const policy = new WorkbenchFullRepaintPolicy({ intervalMs: 1_000, now: () => now });

  assertEquals(policy.shouldForceFullRepaint(), false);
  now = 1_099;
  assertEquals(policy.shouldForceFullRepaint(), false);
  now = 1_100;
  assertEquals(policy.shouldForceFullRepaint(), true);
  assertEquals(policy.shouldForceFullRepaint(), false);
});

Deno.test("WorkbenchFullRepaintPolicy can disable periodic full repaint", () => {
  const policy = new WorkbenchFullRepaintPolicy({ intervalMs: 0, now: () => 10_000 });

  assertEquals(policy.shouldForceFullRepaint(), false);
});

Deno.test("WorkbenchFullRepaintPolicy reports terminal size transitions independently of poll source", () => {
  const policy = new WorkbenchFullRepaintPolicy({ intervalMs: 1_000, now: () => 0 });

  assertEquals(policy.inspectScreenSize({ columns: 80, rows: 24 }), {
    changed: true,
    size: { columns: 80, rows: 24 },
  });
  assertEquals(policy.inspectScreenSize({ columns: 80, rows: 24 }).changed, false);
  assertEquals(policy.inspectScreenSize({ columns: 120, rows: 40 }), {
    changed: true,
    size: { columns: 120, rows: 40 },
  });
});

Deno.test("WorkbenchFullRepaintPolicy resetFullRepaintClock delays the next periodic repaint", () => {
  let now = 0;
  const policy = new WorkbenchFullRepaintPolicy({ intervalMs: 1_000, now: () => now });

  now = 1_500;
  assertEquals(policy.shouldForceFullRepaint(), true);
  now = 2_250;
  policy.resetFullRepaintClock();
  now = 3_000;
  assertEquals(policy.shouldForceFullRepaint(), false);
  now = 3_250;
  assertEquals(policy.shouldForceFullRepaint(), true);
});

Deno.test("WorkbenchFullRepaintPolicy can request a temporary full repaint window", () => {
  let now = 0;
  const policy = new WorkbenchFullRepaintPolicy({ intervalMs: 15_000, now: () => now });

  policy.requestFullRepaintWindow(DEFAULT_WORKBENCH_RESIZE_REPAINT_WINDOW_MS);
  now = DEFAULT_WORKBENCH_RESIZE_REPAINT_WINDOW_MS - 1;
  assertEquals(policy.shouldForceFullRepaint(), true);
  now = DEFAULT_WORKBENCH_RESIZE_REPAINT_WINDOW_MS;
  assertEquals(policy.shouldForceFullRepaint(), false);
});

Deno.test("syncWorkbenchTerminalSize reports unchanged terminal size", () => {
  const target = fakeSizeTarget({ columns: 80, rows: 24 });
  const result = syncWorkbenchTerminalSize(target, () => ({ columns: 80, rows: 24 }));

  assertEquals(result, { changed: false, size: { columns: 80, rows: 24 } });
  assertEquals(target.writes, 0);
});

Deno.test("syncWorkbenchTerminalSize writes normalized changed size", () => {
  const target = fakeSizeTarget({ columns: 80, rows: 24 });
  const result = syncWorkbenchTerminalSize(target, () => ({ columns: 120.9, rows: 36.2 }));

  assertEquals(result, { changed: true, size: { columns: 120, rows: 36 } });
  assertEquals(target.peek(), { columns: 120, rows: 36 });
  assertEquals(target.writes, 1);
});

Deno.test("syncWorkbenchTerminalSize keeps current size when reading fails", () => {
  const target = fakeSizeTarget({ columns: 80, rows: 24 });
  const result = syncWorkbenchTerminalSize(target, () => {
    throw new Error("not a tty");
  });

  assertEquals(result.changed, false);
  assertEquals(result.size, { columns: 80, rows: 24 });
  assertEquals(result.error instanceof Error, true);
  assertEquals(target.writes, 0);
});

Deno.test("workbench screen dimension helpers clamp invalid rectangles", () => {
  assertEquals(workbenchScreenWidth({ width: 150.9 }), 150);
  assertEquals(workbenchScreenHeight({ height: 46.8 }), 46);
  assertEquals(workbenchScreenWidth({ width: 0 }), 1);
  assertEquals(workbenchScreenHeight({ height: -10 }), 1);
});

function fakeSizeTarget(initial: { columns: number; rows: number }): WorkbenchScreenSizeTarget & { writes: number } {
  let current = { ...initial };
  return {
    writes: 0,
    peek: () => current,
    get value() {
      return current;
    },
    set value(next) {
      this.writes += 1;
      current = next;
    },
  };
}
