import { assertEquals } from "./deps.ts";
import { resolveApiWorkbenchHitWindowId } from "../app/api_workbench_hit.ts";

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
