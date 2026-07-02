import { assertEquals } from "./deps.ts";
import {
  isWorkbenchMenuActivationKey,
  isWorkbenchMenuCloseKey,
  layoutWorkbenchHeader,
  layoutWorkbenchHeaderInto,
  layoutWorkbenchMenuBarHits,
  layoutWorkbenchMenuBarHitsInto,
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

Deno.test("layoutWorkbenchMenuBarHits returns visible menu item rectangles", () => {
  assertEquals(
    layoutWorkbenchMenuBarHits({
      column: 2,
      row: 0,
      width: 17,
      activeIndex: 1,
      items: [
        { id: "file", label: "File" },
        { id: "view", label: "View" },
        { id: "layout", label: "Layout" },
      ],
    }),
    [
      { index: 0, rect: { column: 2, row: 0, width: 4, height: 1 }, token: "File" },
      { index: 1, rect: { column: 7, row: 0, width: 6, height: 1 }, token: "[View]" },
    ],
  );
});

Deno.test("layoutWorkbenchMenuBarHitsInto reuses caller-owned storage", () => {
  const target = layoutWorkbenchMenuBarHits({
    column: 2,
    row: 0,
    width: 17,
    activeIndex: 1,
    items: [
      { id: "file", label: "File" },
      { id: "view", label: "View" },
    ],
  });
  const sameTarget = layoutWorkbenchMenuBarHitsInto(target, {
    column: 4,
    row: 2,
    width: 20,
    items: [
      { id: "theme", label: "Theme" },
      { id: "help", label: "Help", disabled: true },
    ],
  });

  assertEquals(sameTarget === target, true);
  assertEquals(target, [
    { index: 0, rect: { column: 4, row: 2, width: 5, height: 1 }, token: "Theme" },
    { index: 1, rect: { column: 10, row: 2, width: 6, height: 1 }, token: "(Help)" },
  ]);
});

Deno.test("layoutWorkbenchHeader projects menu and close button geometry", () => {
  assertEquals(
    layoutWorkbenchHeader({ width: 80, menuStart: 17, closeWidth: 3, closeMinWidth: 20 }),
    {
      menu: { column: 17, row: 0, width: 60, height: 1 },
      close: { column: 77, row: 0, width: 3, height: 1 },
    },
  );

  assertEquals(
    layoutWorkbenchHeader({ width: 19, menuStart: 17, closeWidth: 3, closeMinWidth: 20 }),
    {
      menu: { column: 17, row: 0, width: 2, height: 1 },
      close: undefined,
    },
  );

  assertEquals(
    layoutWorkbenchHeader({
      width: 19,
      menuStart: 17,
      closeWidth: 3,
      closeMinWidth: 22,
      reserveCloseWhenHidden: true,
    }),
    {
      menu: { column: 17, row: 0, width: 0, height: 1 },
      close: undefined,
    },
  );
});

Deno.test("layoutWorkbenchHeaderInto reuses caller-owned geometry", () => {
  const target = layoutWorkbenchHeader({
    width: 80,
    menuStart: 17,
    closeWidth: 3,
    closeMinWidth: 20,
  });
  const close = target.close;
  const sameTarget = layoutWorkbenchHeaderInto(target, {
    width: 48,
    row: 2,
    menuStart: 10,
    closeWidth: 4,
    closeMinWidth: 20,
  });

  assertEquals(sameTarget === target, true);
  assertEquals(target.close === close, true);
  assertEquals(target, {
    menu: { column: 10, row: 2, width: 34, height: 1 },
    close: { column: 44, row: 2, width: 4, height: 1 },
  });

  layoutWorkbenchHeaderInto(target, {
    width: 12,
    menuStart: 10,
    closeWidth: 4,
    closeMinWidth: 20,
  });
  assertEquals(target, {
    menu: { column: 10, row: 0, width: 2, height: 1 },
    close: undefined,
  });
});
