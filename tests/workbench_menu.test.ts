import { assertEquals } from "./deps.ts";
import {
  isWorkbenchMenuActivationKey,
  isWorkbenchMenuCloseKey,
  layoutWorkbenchTopMenuItemRect,
  moveWorkbenchMenuIndex,
  WorkbenchTopMenuController,
} from "../src/app/workbench_menu.ts";

Deno.test("workbench menu helpers identify activation and close keys", () => {
  assertEquals(isWorkbenchMenuActivationKey("return"), true);
  assertEquals(isWorkbenchMenuActivationKey("space"), true);
  assertEquals(isWorkbenchMenuActivationKey("down"), false);
  assertEquals(isWorkbenchMenuCloseKey("escape"), true);
  assertEquals(isWorkbenchMenuCloseKey("tab"), true);
  assertEquals(isWorkbenchMenuCloseKey("return"), false);
});

Deno.test("workbench menu index movement wraps and clamps common dropdown keys", () => {
  assertEquals(moveWorkbenchMenuIndex(0, 4, { key: "up" }), 3);
  assertEquals(moveWorkbenchMenuIndex(3, 4, { key: "down" }), 0);
  assertEquals(moveWorkbenchMenuIndex(2, 4, { key: "home" }), 0);
  assertEquals(moveWorkbenchMenuIndex(2, 4, { key: "end" }), 3);
  assertEquals(moveWorkbenchMenuIndex(8, 4, { key: "right" }), 0);
});

Deno.test("workbench menu page movement uses configurable page size", () => {
  assertEquals(moveWorkbenchMenuIndex(8, 10, { key: "pageup" }), 2);
  assertEquals(moveWorkbenchMenuIndex(8, 10, { key: "pageup" }, { pageSize: 3 }), 5);
  assertEquals(moveWorkbenchMenuIndex(3, 10, { key: "pagedown" }), 9);
  assertEquals(moveWorkbenchMenuIndex(3, 10, { key: "pagedown" }, { pageSize: 2 }), 5);
  assertEquals(moveWorkbenchMenuIndex(3, 0, { key: "down" }), 0);
});

Deno.test("WorkbenchTopMenuController keeps one top menu open and focus synchronized", () => {
  const events: unknown[] = [];
  const controller = new WorkbenchTopMenuController<"theme" | "new">({
    onChange: (inspection) => events.push(inspection),
  });

  assertEquals(controller.inspect(), { openId: null, focused: false });
  assertEquals(controller.open("theme"), { openId: "theme", focused: true });
  assertEquals(controller.isOpen("theme"), true);
  assertEquals(controller.toggle("theme"), { openId: null, focused: true });
  assertEquals(controller.toggle("new"), { openId: "new", focused: true });
  assertEquals(controller.close(), { openId: null, focused: false });
  assertEquals(controller.focus(), { openId: null, focused: true });

  assertEquals(events, [
    { openId: "theme", focused: true },
    { openId: null, focused: true },
    { openId: "new", focused: true },
    { openId: null, focused: false },
    { openId: null, focused: true },
  ]);
});

Deno.test("layoutWorkbenchTopMenuItemRect anchors below menu items", () => {
  const items = [
    { id: "file", label: "File" },
    { id: "view", label: "View", disabled: true },
    { id: "theme", label: "Theme" },
  ];

  assertEquals(
    layoutWorkbenchTopMenuItemRect({
      menuStart: 10,
      itemId: "theme",
      items,
      activeIndex: 0,
      preferredWidth: 30,
      preferredHeight: 6,
      maxWidth: 80,
      measureText: (value) => value.length,
    }),
    { column: 24, row: 1, width: 30, height: 6 },
  );
});

Deno.test("layoutWorkbenchTopMenuItemRect falls back to menu start when item is missing", () => {
  assertEquals(
    layoutWorkbenchTopMenuItemRect({
      menuStart: 4,
      itemId: "missing",
      items: [{ id: "file", label: "File" }],
      preferredWidth: 50,
      preferredHeight: 8,
      maxWidth: 24,
    }),
    { column: 4, row: 1, width: 24, height: 8 },
  );
});
