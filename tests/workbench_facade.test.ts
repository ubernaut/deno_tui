import { assertEquals } from "./deps.ts";
import {
  buttonText,
  createWorkbenchShellSession,
  HitTargetStack,
  layoutWorkbenchButtonRow,
  layoutWorkbenchModal,
  layoutWorkbenchTitlebar,
  resolveWorkbenchShellBackend,
  resolveWorkbenchThreeTerminalPressureBudget,
  threeHeaderRows,
  translateHitTargets,
  workbenchContentViewport,
  workbenchFrameRenderCommandsInto,
  workbenchStyledRowsRenderCommandsInto,
  WorkbenchTopMenuController,
  workbenchWindowContentSize,
  workspaceMenuLabels,
} from "../src/app/workbench/mod.ts";

Deno.test("workbench facade exposes renderer-neutral helpers", () => {
  assertEquals(buttonText("OK"), "[ OK ]");
  assertEquals(
    workbenchContentViewport({
      inner: { column: 0, row: 0, width: 12, height: 6 },
      contentWidth: 12,
      contentHeight: 8,
    }),
    { column: 0, row: 0, width: 11, height: 5 },
  );
  assertEquals(
    layoutWorkbenchTitlebar({ rect: { column: 0, row: 0, width: 30, height: 4 }, title: "Demo" }).buttons.map((
      button,
    ) => button.kind),
    ["minimize", "maximize", "restore", "close"],
  );

  const stack = new HitTargetStack<string>();
  stack.add({ column: 1, row: 1, width: 4, height: 2 }, "demo");
  translateHitTargets(stack, {
    startIndex: 0,
    columnDelta: 2,
    rowDelta: 1,
    clip: { column: 0, row: 0, width: 10, height: 10 },
  });
  assertEquals(stack.find(3, 2)?.action, "demo");
  assertEquals(
    layoutWorkbenchModal({ bounds: { column: 0, row: 0, width: 80, height: 24 }, contentHeight: 10 }).rect,
    { column: 4, row: 7, width: 72, height: 10 },
  );
  assertEquals(typeof resolveWorkbenchShellBackend, "function");
  assertEquals(typeof createWorkbenchShellSession, "function");
  assertEquals(typeof resolveWorkbenchThreeTerminalPressureBudget, "function");
  assertEquals(typeof workbenchFrameRenderCommandsInto, "function");
  assertEquals(typeof workbenchStyledRowsRenderCommandsInto, "function");
  assertEquals(typeof threeHeaderRows, "function");
  assertEquals(typeof workbenchWindowContentSize, "function");
  assertEquals(typeof workspaceMenuLabels, "function");
  assertEquals(typeof WorkbenchTopMenuController, "function");
  assertEquals(
    layoutWorkbenchButtonRow([{ label: "OK", action: "ok" }], { column: 0, row: 0, width: 10, height: 1 }, 0)
      .placements[0]?.rect,
    { column: 0, row: 0, width: 6, height: 1 },
  );
});
