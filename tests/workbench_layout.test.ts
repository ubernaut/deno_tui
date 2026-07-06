import { assertEquals, assertStrictEquals } from "./deps.ts";
import {
  clampWorkbenchTileDensity,
  WorkbenchActiveRevealTracker,
  workbenchAdaptiveTileOptions,
  workbenchAdaptiveWindowLayout,
  workbenchContentViewport,
  workbenchFullscreenWindowRect,
  workbenchHorizontalScrollbarCellsInto,
  workbenchRevealActiveRowOffset,
  workbenchVerticalScrollbarCellsInto,
  workbenchVerticalScrollbarRect,
  workbenchVisibleWindowRectsInto,
  workbenchWindowLayout,
  workbenchWindowScrollbarRects,
  workbenchWindowScrollbarRenderCommandsInto,
  workbenchWorkspaceScrollbarRenderCommandsInto,
  WorkbenchWorkspaceViewportController,
} from "../src/app/workbench_layout.ts";
import {
  DEFAULT_WORKBENCH_FULL_REPAINT_INTERVAL_MS,
  DEFAULT_WORKBENCH_RESIZE_REPAINT_WINDOW_MS,
  normalizeWorkbenchFullRepaintInterval,
  readWorkbenchVerifiedConsoleSize,
  syncWorkbenchTerminalSize,
  WorkbenchFullRepaintPolicy,
  workbenchScreenHeight,
  type WorkbenchScreenSizeTarget,
  workbenchScreenWidth,
} from "../src/app/workbench_repaint_policy.ts";
import { shouldUseRecentlyVerifiedTerminalSize } from "../src/tui.ts";
import type { ViewportAxisOverflow, ViewportOverflowInspection } from "../src/viewport.ts";

Deno.test("clampWorkbenchTileDensity keeps density in the shared supported range", () => {
  assertEquals(clampWorkbenchTileDensity(4.8), 3);
  assertEquals(clampWorkbenchTileDensity(-9), -3);
  assertEquals(clampWorkbenchTileDensity(Number.NaN), 0);
  assertEquals(clampWorkbenchTileDensity(2.9), 2);
});

Deno.test("workbenchAdaptiveTileOptions shares density-aware tile defaults", () => {
  assertEquals(workbenchAdaptiveTileOptions({ bounds: { column: 0, row: 0, width: 120, height: 40 } }), {
    minTileWidth: 38,
    minTileHeight: 10,
    maxColumns: 3,
    targetAspectRatio: 2.25,
    allowVerticalOverflow: true,
    gap: 1,
  });

  assertEquals(
    workbenchAdaptiveTileOptions({ bounds: { column: 0, row: 0, width: 180, height: 40 }, tileDensity: 2 }),
    {
      minTileWidth: 30,
      minTileHeight: 10,
      maxColumns: 4,
      targetAspectRatio: 2.49,
      allowVerticalOverflow: true,
      gap: 1,
    },
  );
});

Deno.test("workbenchWindowLayout projects visible rects and clamps content height to viewport", () => {
  const layout = workbenchWindowLayout<"a" | "b">(
    { column: 1, row: 2, width: 80, height: 20 },
    {
      contentHeight: 12,
      visible: [
        { id: "a", rect: { column: 1, row: 2, width: 20, height: 10 } },
        { id: "b" },
      ],
    },
  );

  assertEquals(layout.bounds, { column: 1, row: 2, width: 80, height: 20 });
  assertEquals(layout.contentHeight, 20);
  assertEquals(layout.rects.get("a"), { column: 1, row: 2, width: 20, height: 10 });
  assertEquals(layout.rects.has("b"), false);
});

Deno.test("workbenchAdaptiveWindowLayout runs managers with shared tile defaults", () => {
  const calls: unknown[] = [];
  const bounds = { column: 0, row: 0, width: 180, height: 30 };
  const layout = workbenchAdaptiveWindowLayout<"a">({
    layout(options) {
      calls.push(options);
      return {
        contentHeight: 42,
        visible: [{ id: "a", rect: { column: 2, row: 3, width: 40, height: 12 } }],
      };
    },
  }, { bounds, tileDensity: 1 });

  assertEquals(calls, [{
    bounds,
    tileOptions: {
      minTileWidth: 34,
      minTileHeight: 10,
      maxColumns: 4,
      targetAspectRatio: 2.37,
      allowVerticalOverflow: true,
      gap: 1,
    },
  }]);
  assertEquals(layout.contentHeight, 42);
  assertEquals(layout.rects.get("a"), { column: 2, row: 3, width: 40, height: 12 });
});

Deno.test("workbenchFullscreenWindowRect uses the visible viewport instead of virtual content height", () => {
  assertEquals(
    workbenchFullscreenWindowRect({ column: 0, row: 0, width: 119, height: 29 }),
    { column: 0, row: 0, width: 119, height: 29 },
  );
  assertEquals(
    workbenchFullscreenWindowRect({ column: 2, row: 3, width: -1, height: -4 }),
    { column: 2, row: 3, width: 0, height: 0 },
  );
});

Deno.test("workbenchVisibleWindowRectsInto filters virtual rects to viewport", () => {
  const source = new Map([
    ["above", { column: 0, row: 0, width: 20, height: 4 }],
    ["visible", { column: 0, row: 5, width: 20, height: 4 }],
    ["below", { column: 0, row: 20, width: 20, height: 4 }],
    ["right", { column: 90, row: 8, width: 10, height: 4 }],
  ]);
  const target = new Map<string, { column: number; row: number; width: number; height: number }>();

  const result = workbenchVisibleWindowRectsInto(target, source, {
    viewport: { column: 0, row: 4, width: 80, height: 10 },
  });

  assertStrictEquals(result, target);
  assertEquals([...result.keys()], ["visible"]);
  assertEquals(result.get("visible"), { column: 0, row: 5, width: 20, height: 4 });
});

Deno.test("workbenchVerticalScrollbarRect locates the right-edge workspace hit region", () => {
  assertEquals(
    workbenchVerticalScrollbarRect({
      bounds: { column: 2, row: 3, width: 20, height: 9 },
      visible: true,
    }),
    { column: 21, row: 3, width: 1, height: 9 },
  );
  assertEquals(
    workbenchVerticalScrollbarRect({
      bounds: { column: 2, row: 3, width: 1, height: 9 },
      visible: true,
    }),
    undefined,
  );
  assertEquals(
    workbenchVerticalScrollbarRect({
      bounds: { column: 2, row: 3, width: 20, height: 9 },
      visible: false,
    }),
    undefined,
  );
});

Deno.test("workbenchWindowScrollbarRects locates per-window content scrollbar regions", () => {
  const inner = { column: 10, row: 4, width: 30, height: 12 };
  const viewport = { column: 11, row: 5, width: 27, height: 9 };
  const overflow: ViewportOverflowInspection = {
    rows: axisOverflow({ scrollbarVisible: true, thumb: { start: 2, size: 4, visible: true } }),
    columns: axisOverflow({ scrollbarVisible: true, thumb: { start: 3, size: 8, visible: true } }),
    maxOffset: { columns: 10, rows: 20 },
    offset: { columns: 1, rows: 2 },
  };

  assertEquals(workbenchWindowScrollbarRects({ inner, viewport, overflow }), {
    vertical: { column: 39, row: 5, width: 1, height: 9 },
    horizontal: { column: 11, row: 15, width: 27, height: 1 },
  });
  assertEquals(
    workbenchWindowScrollbarRects({
      inner,
      viewport: { ...viewport, height: 0 },
      overflow,
    }).vertical,
    undefined,
  );
  assertEquals(
    workbenchWindowScrollbarRects({
      inner,
      viewport: { ...viewport, width: 0 },
      overflow,
    }).horizontal,
    undefined,
  );
  assertEquals(
    workbenchWindowScrollbarRects({
      inner,
      viewport,
      overflow: {
        ...overflow,
        rows: axisOverflow({ scrollbarVisible: false, thumb: overflow.rows.thumb }),
        columns: axisOverflow({ scrollbarVisible: false, thumb: overflow.columns.thumb }),
      },
    }),
    { vertical: undefined, horizontal: undefined },
  );
});

function axisOverflow(
  options: Partial<ViewportAxisOverflow> = {},
): ViewportAxisOverflow {
  return {
    contentLength: 20,
    viewportLength: 8,
    maxOffset: 12,
    offset: 2,
    overflow: "auto",
    hasOverflow: true,
    canScroll: true,
    scrollbarVisible: true,
    thumb: { start: 1, size: 3, visible: true },
    visibleRange: { start: 2, end: 10 },
    ...options,
  };
}

Deno.test("workbench scrollbar cell projectors use caller-owned buffers", () => {
  const vertical: Array<{ column: number; row: number; glyph: string }> = [{ column: -1, row: -1, glyph: "x" }];
  const firstVerticalCell = vertical[0];
  const verticalResult = workbenchVerticalScrollbarCellsInto(
    vertical,
    { column: 4, row: 2, width: 1, height: 4 },
    { start: 1, size: 2, visible: true },
  );

  assertEquals(verticalResult, vertical);
  assertStrictEquals(vertical[0], firstVerticalCell);
  assertEquals(vertical, [
    { column: 4, row: 2, glyph: "│" },
    { column: 4, row: 3, glyph: "█" },
    { column: 4, row: 4, glyph: "█" },
    { column: 4, row: 5, glyph: "│" },
  ]);

  const horizontal: Array<{ column: number; row: number; glyph: string }> = [];
  assertEquals(
    workbenchHorizontalScrollbarCellsInto(
      horizontal,
      { column: 3, row: 8, width: 5, height: 1 },
      { start: 2, size: 2, visible: true },
    ),
    [
      { column: 3, row: 8, glyph: "│" },
      { column: 4, row: 8, glyph: "│" },
      { column: 5, row: 8, glyph: "█" },
      { column: 6, row: 8, glyph: "█" },
      { column: 7, row: 8, glyph: "│" },
    ],
  );
  const firstHorizontalCell = horizontal[0];
  workbenchHorizontalScrollbarCellsInto(
    horizontal,
    { column: 0, row: 0, width: 2, height: 1 },
    { start: 0, size: 1, visible: true },
  );
  assertStrictEquals(horizontal[0], firstHorizontalCell);
  assertEquals(horizontal.length, 2);
});

Deno.test("workbench workspace scrollbar render commands project cells and reuse storage", () => {
  const commands = workbenchWorkspaceScrollbarRenderCommandsInto([], {
    bounds: { column: 2, row: 3, width: 10, height: 4 },
    visible: true,
    thumb: { start: 1, size: 2, visible: true },
  });
  const firstCommand = commands[0];
  const firstCell = firstCommand?.cells[0];

  assertEquals(commands, [
    {
      axis: "vertical",
      rect: { column: 11, row: 3, width: 1, height: 4 },
      cells: [
        { column: 11, row: 3, glyph: "│" },
        { column: 11, row: 4, glyph: "█" },
        { column: 11, row: 5, glyph: "█" },
        { column: 11, row: 6, glyph: "│" },
      ],
    },
  ]);

  const reused = workbenchWorkspaceScrollbarRenderCommandsInto(commands, {
    bounds: { column: 0, row: 0, width: 6, height: 2 },
    visible: true,
    thumb: { start: 0, size: 1, visible: true },
  });
  assertStrictEquals(reused[0], firstCommand);
  assertStrictEquals(reused[0]?.cells[0], firstCell);
  assertEquals(reused[0]?.rect, { column: 5, row: 0, width: 1, height: 2 });
  assertEquals(reused[0]?.cells.length, 2);

  const hidden = workbenchWorkspaceScrollbarRenderCommandsInto(commands, {
    bounds: { column: 2, row: 3, width: 10, height: 4 },
    visible: false,
    thumb: { start: 0, size: 1, visible: true },
  });
  assertEquals(hidden, []);
});

Deno.test("workbench window scrollbar render commands project vertical and horizontal commands", () => {
  const inner = { column: 10, row: 4, width: 30, height: 12 };
  const viewport = { column: 11, row: 5, width: 27, height: 9 };
  const overflow: ViewportOverflowInspection = {
    rows: axisOverflow({ scrollbarVisible: true, thumb: { start: 2, size: 4, visible: true } }),
    columns: axisOverflow({ scrollbarVisible: true, thumb: { start: 3, size: 8, visible: true } }),
    maxOffset: { columns: 10, rows: 20 },
    offset: { columns: 1, rows: 2 },
  };

  const commands = workbenchWindowScrollbarRenderCommandsInto([], { inner, viewport, overflow });

  assertEquals(commands.map((command) => [command.axis, command.rect, command.cells.length]), [
    ["vertical", { column: 39, row: 5, width: 1, height: 9 }, 9],
    ["horizontal", { column: 11, row: 15, width: 27, height: 1 }, 27],
  ]);
  assertEquals(commands[0]?.cells[2], { column: 39, row: 7, glyph: "█" });
  assertEquals(commands[1]?.cells[3], { column: 14, row: 15, glyph: "█" });

  const firstVertical = commands[0];
  const firstHorizontal = commands[1];
  const verticalOnly = workbenchWindowScrollbarRenderCommandsInto(commands, {
    inner,
    viewport,
    overflow: {
      ...overflow,
      columns: axisOverflow({ scrollbarVisible: false, thumb: overflow.columns.thumb }),
    },
  });

  assertEquals(verticalOnly.length, 1);
  assertStrictEquals(verticalOnly[0], firstVertical);
  assertEquals(verticalOnly[0]?.axis, "vertical");
  assertEquals(verticalOnly.includes(firstHorizontal!), false);
});

Deno.test("WorkbenchActiveRevealTracker only emits offsets when active item or viewport changes", () => {
  const tracker = new WorkbenchActiveRevealTracker<"a" | "b">();
  const activeRect = { column: 0, row: 18, width: 20, height: 6 };
  const base = {
    activeId: "a" as const,
    activeRect,
    contentHeight: 40,
    viewportWidth: 80,
    viewportHeight: 12,
    offsetRows: 0,
  };

  assertEquals(tracker.revealOffset(base), 12);
  assertEquals(tracker.revealOffset(base), undefined);
  assertEquals(tracker.revealOffset({ ...base, viewportHeight: 10, offsetRows: 12 }), 14);
  assertEquals(tracker.revealOffset({ ...base, activeId: "b", offsetRows: 0 }), 12);
  tracker.reset();
  assertEquals(tracker.revealOffset(base), 12);
});

Deno.test("workbench content viewport keeps full inner rect when content fits", () => {
  assertEquals(
    workbenchContentViewport({
      inner: { column: 2, row: 3, width: 20, height: 10 },
      contentWidth: 20,
      contentHeight: 10,
    }),
    { column: 2, row: 3, width: 20, height: 10 },
  );
});

Deno.test("workbench content viewport reserves cells for direct and coupled overflow", () => {
  assertEquals(
    workbenchContentViewport({
      inner: { column: 0, row: 0, width: 20, height: 10 },
      contentWidth: 19,
      contentHeight: 11,
    }),
    { column: 0, row: 0, width: 19, height: 10 },
  );
  assertEquals(
    workbenchContentViewport({
      inner: { column: 0, row: 0, width: 20, height: 10 },
      contentWidth: 21,
      contentHeight: 9,
    }),
    { column: 0, row: 0, width: 20, height: 9 },
  );
  assertEquals(
    workbenchContentViewport({
      inner: { column: 0, row: 0, width: 20, height: 10 },
      contentWidth: 20,
      contentHeight: 11,
    }),
    { column: 0, row: 0, width: 19, height: 9 },
  );
  assertEquals(
    workbenchContentViewport({
      inner: { column: 0, row: 0, width: 20, height: 10 },
      contentWidth: 21,
      contentHeight: 10,
    }),
    { column: 0, row: 0, width: 19, height: 9 },
  );
});

Deno.test("workbench reveal active row scrolls only when needed", () => {
  assertEquals(
    workbenchRevealActiveRowOffset({
      activeRect: { column: 0, row: 12, width: 10, height: 4 },
      contentHeight: 40,
      viewportHeight: 10,
      offsetRows: 10,
    }),
    undefined,
  );
  assertEquals(
    workbenchRevealActiveRowOffset({
      activeRect: { column: 0, row: 4, width: 10, height: 4 },
      contentHeight: 40,
      viewportHeight: 10,
      offsetRows: 12,
    }),
    4,
  );
  assertEquals(
    workbenchRevealActiveRowOffset({
      activeRect: { column: 0, row: 24, width: 10, height: 8 },
      contentHeight: 40,
      viewportHeight: 10,
      offsetRows: 10,
    }),
    22,
  );
  assertEquals(
    workbenchRevealActiveRowOffset({
      activeRect: { column: 0, row: 4, width: 10, height: 4 },
      contentHeight: 8,
      viewportHeight: 10,
      offsetRows: 5,
    }),
    0,
  );
  assertEquals(
    workbenchRevealActiveRowOffset({
      activeRect: { column: 0, row: 38, width: 10, height: 6 },
      contentHeight: 40,
      viewportHeight: 10,
      offsetRows: 0,
    }),
    30,
  );
});

Deno.test("WorkbenchWorkspaceViewportController sizes scroll area and reveals active windows", () => {
  const scroll = new FakeWorkspaceScroll();
  const controller = new WorkbenchWorkspaceViewportController<"a" | "b">({ scroll });
  const layout = workbenchWindowLayout<"a" | "b">(
    { column: 0, row: 0, width: 80, height: 12 },
    {
      contentHeight: 40,
      visible: [
        { id: "a", rect: { column: 0, row: 18, width: 20, height: 6 } },
        { id: "b", rect: { column: 0, row: 2, width: 20, height: 6 } },
      ],
    },
  );

  assertEquals(controller.update({ layout, viewportHeight: 12, activeId: "a" }), 12);
  assertEquals(scroll.viewport, { width: 80, height: 12 });
  assertEquals(scroll.content, { width: 80, height: 40 });
  assertEquals(scroll.scrollCalls, [{ columns: 0, rows: 12 }]);
  assertEquals(controller.update({ layout, viewportHeight: 12, activeId: "a" }), 12);
  assertEquals(scroll.scrollCalls.length, 1);
  assertEquals(controller.update({ layout, viewportHeight: 12, activeId: "b" }), 2);
  assertEquals(scroll.scrollCalls.at(-1), { columns: 0, rows: 2 });
});

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
  assertEquals(policy.fullRepaintWindowActive(), true);
  assertEquals(policy.shouldForceFullRepaint(), true);
  now = DEFAULT_WORKBENCH_RESIZE_REPAINT_WINDOW_MS;
  assertEquals(policy.fullRepaintWindowActive(), false);
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

Deno.test("readWorkbenchVerifiedConsoleSize prefers verified stty dimensions over stale console size", () => {
  assertEquals(
    readWorkbenchVerifiedConsoleSize({
      consoleSize: () => ({ columns: 100, rows: 30 }),
      sttySize: () => ({ columns: 180, rows: 50 }),
      now: () => 1_000,
      cacheMs: 0,
    }),
    { columns: 180, rows: 50 },
  );
});

Deno.test("syncWorkbenchTerminalSize can use verified dimensions for resize polling", () => {
  const target = fakeSizeTarget({ columns: 100, rows: 30 });
  const result = syncWorkbenchTerminalSize(target, () =>
    readWorkbenchVerifiedConsoleSize({
      consoleSize: () => ({ columns: 100, rows: 30 }),
      sttySize: () => ({ columns: 180, rows: 50 }),
      now: () => 2_000,
      cacheMs: 0,
    }));

  assertEquals(result, { changed: true, size: { columns: 180, rows: 50 } });
  assertEquals(target.peek(), { columns: 180, rows: 50 });
  assertEquals(target.writes, 1);
});

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

Deno.test("workbench screen dimension helpers clamp invalid rectangles", () => {
  assertEquals(workbenchScreenWidth({ width: 150.9 }), 150);
  assertEquals(workbenchScreenHeight({ height: 46.8 }), 46);
  assertEquals(workbenchScreenWidth({ width: 0 }), 1);
  assertEquals(workbenchScreenHeight({ height: -10 }), 1);
});

class FakeWorkspaceScroll {
  offset = {
    peek: () => ({ rows: this.rows }),
  };
  rows = 0;
  viewport = { width: 0, height: 0 };
  content = { width: 0, height: 0 };
  scrollCalls: Array<{ columns: number; rows: number }> = [];

  setViewportSize(width: number, height: number): void {
    this.viewport = { width, height };
  }

  setContentSize(width: number, height: number): void {
    this.content = { width, height };
  }

  scrollTo(columns: number, rows: number): void {
    this.rows = rows;
    this.scrollCalls.push({ columns, rows });
  }
}

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
