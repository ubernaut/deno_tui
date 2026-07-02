import { assertEquals } from "./deps.ts";
import {
  layoutWorkbenchModal,
  layoutWorkbenchPopover,
  workbenchModalActionButtonsInto,
} from "../src/app/workbench_overlay.ts";

Deno.test("workbench modal layout centers within desktop bounds", () => {
  const layout = layoutWorkbenchModal({
    bounds: { column: 0, row: 0, width: 120, height: 40 },
    contentHeight: 12,
    maxWidth: 72,
  });

  assertEquals(layout.rect, { column: 24, row: 14, width: 72, height: 12 });
  assertEquals(layout.inner, { column: 25, row: 15, width: 70, height: 10 });
  assertEquals(layout.shadow, { column: 26, row: 15, width: 72, height: 12 });
});

Deno.test("workbench modal layout remains inside cramped bounds", () => {
  const layout = layoutWorkbenchModal({
    bounds: { column: 2, row: 1, width: 30, height: 8 },
    contentHeight: 20,
    minWidth: 38,
    minHeight: 9,
  });

  assertEquals(layout.rect, { column: 2, row: 2, width: 30, height: 7 });
  assertEquals(layout.inner, { column: 3, row: 3, width: 28, height: 5 });
  assertEquals(layout.shadow, { column: 4, row: 3, width: 28, height: 6 });
});

Deno.test("workbench popover layout clips or hides too-small overlays", () => {
  assertEquals(
    layoutWorkbenchPopover({
      rect: { column: 8, row: 3, width: 20, height: 6 },
      bounds: { column: 0, row: 0, width: 24, height: 8 },
    }),
    { column: 8, row: 3, width: 16, height: 5 },
  );

  assertEquals(
    layoutWorkbenchPopover({
      rect: { column: 22, row: 2, width: 4, height: 5 },
      bounds: { column: 0, row: 0, width: 24, height: 8 },
    }),
    undefined,
  );
});

Deno.test("workbench modal action buttons project selected disabled and destructive state", () => {
  const target = [{ label: "stale", action: 99 }];
  const buttons = workbenchModalActionButtonsInto(target, {
    selectedActionIndex: 2,
    actions: [
      { id: "cancel", label: "Cancel" },
      { id: "details", label: "Details", disabled: true },
      { id: "delete", label: "Delete", destructive: true },
    ],
  });

  assertEquals(buttons, [
    { label: "Cancel", action: 0, disabled: undefined, active: false, tone: "default" },
    { label: "Details", action: 1, disabled: true, active: false, tone: "default" },
    { label: "Delete", action: 2, disabled: undefined, active: true, tone: "danger" },
  ]);
  assertEquals(buttons, target);

  assertEquals(
    workbenchModalActionButtonsInto([], {
      selectedActionIndex: 0,
      actions: [{ id: "remove", label: "Remove", destructive: true }],
    }, { dangerTone: "muted" }),
    [{ label: "Remove", action: 0, disabled: undefined, active: true, tone: "muted" }],
  );
});
