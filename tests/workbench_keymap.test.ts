import { assertEquals } from "./deps.ts";
import { resolveWorkbenchGlobalKey } from "../src/app/workbench_keymap.ts";

Deno.test("workbench global keymap resolves app-level commands", () => {
  assertEquals(resolveWorkbenchGlobalKey({ key: "q" }), { kind: "quit" });
  assertEquals(resolveWorkbenchGlobalKey({ key: "f10" }), { kind: "focusMenu" });
  assertEquals(resolveWorkbenchGlobalKey({ key: "?" }), { kind: "help" });
  assertEquals(resolveWorkbenchGlobalKey({ key: "n" }), { kind: "openNewWindowMenu" });
  assertEquals(resolveWorkbenchGlobalKey({ key: "t" }), { kind: "cycleTheme" });
  assertEquals(resolveWorkbenchGlobalKey({ key: "t", shift: true }), { kind: "openThemeMenu" });
  assertEquals(resolveWorkbenchGlobalKey({ key: "g" }), { kind: "openThreeConfig" });
  assertEquals(resolveWorkbenchGlobalKey({ key: "c" }), { kind: "closeWindow" });
  assertEquals(resolveWorkbenchGlobalKey({ key: "m" }), { kind: "minimizeWindow" });
  assertEquals(resolveWorkbenchGlobalKey({ key: "return" }), { kind: "toggleMaximize" });
  assertEquals(resolveWorkbenchGlobalKey({ key: "escape" }), { kind: "restoreAll" });
  assertEquals(resolveWorkbenchGlobalKey({ key: "0" }), { kind: "restoreNextMinimized" });
});

Deno.test("workbench global keymap resolves focus and indexed window shortcuts", () => {
  assertEquals(resolveWorkbenchGlobalKey({ key: "tab" }, { activeWindowId: "inspector" }), {
    kind: "focusWindow",
    delta: 1,
  });
  assertEquals(resolveWorkbenchGlobalKey({ key: "tab", shift: true }, { activeWindowId: "inspector" }), {
    kind: "focusWindow",
    delta: -1,
  });
  assertEquals(resolveWorkbenchGlobalKey({ key: "tab" }, { activeWindowId: "controls" }), {
    kind: "focusControl",
    delta: 1,
  });
  assertEquals(resolveWorkbenchGlobalKey({ key: "4" }), { kind: "focusWindowNumber", index: 3 });
  assertEquals(resolveWorkbenchGlobalKey({ key: "9" }), { kind: "focusWindowNumber", index: 8 });
});

Deno.test("workbench global keymap resolves layout, density, preview, and scroll shortcuts", () => {
  assertEquals(resolveWorkbenchGlobalKey({ key: "[" }), { kind: "adjustTileDensity", delta: -1 });
  assertEquals(resolveWorkbenchGlobalKey({ key: "]" }), { kind: "adjustTileDensity", delta: 1 });
  assertEquals(resolveWorkbenchGlobalKey({ key: "pageup" }), { kind: "scrollPage", delta: -1 });
  assertEquals(resolveWorkbenchGlobalKey({ key: "pagedown" }), { kind: "scrollPage", delta: 1 });
  assertEquals(resolveWorkbenchGlobalKey({ key: "home" }), { kind: "scrollHome" });
  assertEquals(resolveWorkbenchGlobalKey({ key: "end" }), { kind: "scrollEnd" });
  assertEquals(resolveWorkbenchGlobalKey({ key: "left", shift: true }), { kind: "scrollHorizontal", delta: -4 });
  assertEquals(resolveWorkbenchGlobalKey({ key: "right", shift: true }), { kind: "scrollHorizontal", delta: 4 });
  assertEquals(resolveWorkbenchGlobalKey({ key: "+" }), { kind: "incrementDensity", delta: 1 });
  assertEquals(resolveWorkbenchGlobalKey({ key: "_" }), { kind: "incrementDensity", delta: -1 });
  assertEquals(resolveWorkbenchGlobalKey({ key: "space" }), { kind: "toggleLivePreview" });
  assertEquals(resolveWorkbenchGlobalKey({ key: "left" }), { kind: "scrollLine", columns: -1, rows: 0 });
  assertEquals(resolveWorkbenchGlobalKey({ key: "down" }), { kind: "scrollLine", columns: 0, rows: 1 });
});

Deno.test("workbench global keymap ignores modified and unmapped shortcuts", () => {
  assertEquals(resolveWorkbenchGlobalKey({ key: "q", ctrl: true }), { kind: "ignore" });
  assertEquals(resolveWorkbenchGlobalKey({ key: "left", meta: true }), { kind: "ignore" });
  assertEquals(resolveWorkbenchGlobalKey({ key: "unknown" }), { kind: "ignore" });
});
