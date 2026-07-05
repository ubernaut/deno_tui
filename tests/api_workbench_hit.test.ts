import { assertEquals } from "./deps.ts";
import {
  expandedApiWorkbenchTouchHitRect,
  findApiWorkbenchHitTarget,
  isApiWorkbenchTouchOptimizedLayout,
  resolveApiWorkbenchHitWindowId,
  resolveApiWorkbenchTitlebarHitAction,
  resolveApiWorkbenchWindowHScrollbarOffset,
  resolveApiWorkbenchWindowVScrollbarOffset,
  resolveApiWorkbenchWorkspaceScrollbarOffset,
} from "../app/api_workbench_hit.ts";
import type { Rectangle } from "../src/types.ts";

const ids = {
  terminalShell: "terminal-shell",
  controls: "controls",
  data: "data",
  explorer: "explorer",
} as const;

Deno.test("resolveApiWorkbenchHitWindowId returns explicit window ids for chrome hits", () => {
  for (
    const type of [
      "focus",
      "minimize",
      "maximize",
      "restore",
      "close",
      "windowVScrollbar",
      "windowHScrollbar",
      "threeViewport",
    ] as const
  ) {
    assertEquals(resolveApiWorkbenchHitWindowId({ type, id: "three" }, ids), "three");
  }
});

Deno.test("resolveApiWorkbenchTitlebarHitAction maps button kinds to hit actions", () => {
  assertEquals(resolveApiWorkbenchTitlebarHitAction("three", "config"), { type: "threeConfig", id: "three" });
  assertEquals(resolveApiWorkbenchTitlebarHitAction("data", "minimize"), { type: "minimize", id: "data" });
  assertEquals(resolveApiWorkbenchTitlebarHitAction("data", "maximize"), { type: "maximize", id: "data" });
  assertEquals(resolveApiWorkbenchTitlebarHitAction("data", "restore"), { type: "restore", id: "data" });
  assertEquals(resolveApiWorkbenchTitlebarHitAction("data", "close"), { type: "close", id: "data" });
});

Deno.test("resolveApiWorkbenchHitWindowId maps content hits to owning built-in windows", () => {
  assertEquals(resolveApiWorkbenchHitWindowId({ type: "terminalShellContent" }, ids), "terminal-shell");
  assertEquals(resolveApiWorkbenchHitWindowId({ type: "control" }, ids), "controls");
  assertEquals(resolveApiWorkbenchHitWindowId({ type: "dataRow" }, ids), "data");
  assertEquals(resolveApiWorkbenchHitWindowId({ type: "explorerRow" }, ids), "explorer");
});

Deno.test("resolveApiWorkbenchHitWindowId ignores actions without an owning window", () => {
  assertEquals(resolveApiWorkbenchHitWindowId({ type: "theme" }, ids), undefined);
  assertEquals(resolveApiWorkbenchHitWindowId({ type: "workspace" }, ids), undefined);
  assertEquals(resolveApiWorkbenchHitWindowId({ type: "modalAction" }, ids), undefined);
});

Deno.test("resolveApiWorkbench scrollbar offsets preserve the non-scrolled axis", () => {
  assertEquals(
    resolveApiWorkbenchWindowVScrollbarOffset({
      contentHeight: 40,
      viewportHeight: 10,
      currentColumns: 7,
      pointerRow: 9,
    }),
    { columns: 7, rows: 30 },
  );
  assertEquals(
    resolveApiWorkbenchWindowHScrollbarOffset({
      contentWidth: 80,
      viewportWidth: 20,
      currentRows: 6,
      pointerColumn: 10,
    }),
    { columns: 32, rows: 6 },
  );
});

Deno.test("resolveApiWorkbench workspace scrollbar offset scrolls rows only", () => {
  assertEquals(
    resolveApiWorkbenchWorkspaceScrollbarOffset({
      contentHeight: 100,
      viewportHeight: 20,
      pointerRow: 10,
    }),
    { columns: 0, rows: 42 },
  );
  assertEquals(
    resolveApiWorkbenchWorkspaceScrollbarOffset({
      contentHeight: 100,
      viewportHeight: 20,
      pointerRow: -4,
    }),
    { columns: 0, rows: 0 },
  );
});

Deno.test("api workbench touch layout expands on coarse or compact screens", () => {
  assertEquals(isApiWorkbenchTouchOptimizedLayout({ columns: 120, rows: 40 }), false);
  assertEquals(isApiWorkbenchTouchOptimizedLayout({ coarsePointer: true, columns: 120, rows: 40 }), true);
  assertEquals(isApiWorkbenchTouchOptimizedLayout({ columns: 91, rows: 40 }), true);
  assertEquals(isApiWorkbenchTouchOptimizedLayout({ columns: 120, rows: 29 }), true);
});

Deno.test("api workbench expanded touch hit rect grows small targets and clips to bounds", () => {
  assertEquals(
    expandedApiWorkbenchTouchHitRect({
      rect: { column: 10, row: 5, width: 2, height: 1 },
      bounds: { column: 0, row: 0, width: 40, height: 20 },
    }),
    { column: 8, row: 4, width: 6, height: 3 },
  );
  assertEquals(
    expandedApiWorkbenchTouchHitRect({
      rect: { column: 0, row: 0, width: 2, height: 1 },
      bounds: { column: 0, row: 0, width: 5, height: 2 },
    }),
    { column: 0, row: 0, width: 4, height: 2 },
  );
});

Deno.test("api workbench shared hit lookup expands targets only for touch layouts", () => {
  const targets = hitStack([
    { rect: { column: 10, row: 5, width: 2, height: 1 }, action: "small" },
    { rect: { column: 20, row: 5, width: 4, height: 1 }, action: "direct" },
  ]);
  const bounds = { column: 0, row: 0, width: 40, height: 20 };

  assertEquals(findApiWorkbenchHitTarget({ targets, x: 21, y: 5, bounds })?.action, "direct");
  assertEquals(findApiWorkbenchHitTarget({ targets, x: 8, y: 4, bounds })?.action, undefined);
  assertEquals(findApiWorkbenchHitTarget({ targets, x: 8, y: 4, bounds, touchOptimized: true })?.action, "small");
});

function hitStack<TAction>(entries: Array<{ rect: Rectangle; action: TAction }>) {
  return {
    find(x: number, y: number) {
      for (let index = entries.length - 1; index >= 0; index -= 1) {
        const entry = entries[index]!;
        if (contains(entry.rect, x, y)) return entry;
      }
    },
    findExpanded(
      x: number,
      y: number,
      expand: (rect: Rectangle, target: { rect: Rectangle; action: TAction }) => Rectangle | undefined,
    ) {
      for (let index = entries.length - 1; index >= 0; index -= 1) {
        const entry = entries[index]!;
        const rect = expand(entry.rect, entry);
        if (rect && contains(rect, x, y)) return { rect, action: entry.action };
      }
    },
  };
}

function contains(rect: Rectangle, x: number, y: number): boolean {
  return x >= rect.column && x < rect.column + rect.width && y >= rect.row && y < rect.row + rect.height;
}
