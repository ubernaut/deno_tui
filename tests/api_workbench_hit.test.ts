import { assertEquals } from "./deps.ts";
import {
  resolveApiWorkbenchHitWindowId,
  resolveApiWorkbenchTitlebarHitAction,
  resolveApiWorkbenchWindowHScrollbarOffset,
  resolveApiWorkbenchWindowVScrollbarOffset,
  resolveApiWorkbenchWorkspaceScrollbarOffset,
} from "../app/api_workbench_hit.ts";

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
