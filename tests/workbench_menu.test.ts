import { assertEquals } from "./deps.ts";
import {
  isWorkbenchMenuActivationKey,
  isWorkbenchMenuCloseKey,
  moveWorkbenchMenuIndex,
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
