import { assertEquals } from "./deps.ts";
import {
  buttonText,
  createWorkbenchShellSession,
  HitTargetStack,
  layoutWorkbenchButtonRow,
  layoutWorkbenchModal,
  layoutWorkbenchTitlebar,
  resolveWorkbenchGlobalKey,
  resolveWorkbenchShellBackend,
  resolveWorkbenchThreeTerminalPressureBudget,
  translateHitTargets,
  workbenchContentViewport,
  workbenchHelpRows,
  workbenchStandardTopMenuDropdownOverlayInto,
  workbenchStatusSnapshotLine,
  WorkbenchTopMenuController,
} from "../src/app/workbench/mod.ts";
import {
  workbenchDemoModalContent,
  workbenchHelpModalContent,
  workbenchModalConfirmedContent,
  workbenchModalDetailsContent,
  workbenchQuitModalContent,
} from "../app/workbench_modal_content.ts";

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
  assertEquals(typeof workbenchStandardTopMenuDropdownOverlayInto, "function");
  assertEquals(typeof workbenchStatusSnapshotLine, "function");
  assertEquals(typeof WorkbenchTopMenuController, "function");
  assertEquals(
    layoutWorkbenchButtonRow([{ label: "OK", action: "ok" }], { column: 0, row: 0, width: 10, height: 1 }, 0)
      .placements[0]?.rect,
    { column: 0, row: 0, width: 6, height: 1 },
  );
});

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

Deno.test("workbench help rows expose terminal navigation coverage", () => {
  const rows = workbenchHelpRows();

  assertEquals(rows.length, 17);
  assertEquals(rows.some((row) => row.includes("F10")), true);
  assertEquals(rows.some((row) => row.includes("Three ASCII widgets")), true);
  assertEquals(rows.some((row) => row.includes("Workspace menu")), true);
});

Deno.test("workbench help rows expose compact web and touch guidance", () => {
  const rows = workbenchHelpRows({ profile: "web" });

  assertEquals(rows.length, 6);
  assertEquals(rows.some((row) => row.includes("Touch:")), true);
  assertEquals(rows.some((row) => row.includes("click scrollbars")), true);
  assertEquals(rows.some((row) => row.includes("tiled layout helper")), true);
});

Deno.test("workbench modal content helpers preserve profile-specific copy and actions", () => {
  const terminalDemo = workbenchDemoModalContent({ profile: "terminal" });
  const webDemo = workbenchDemoModalContent({ profile: "web" });
  const terminalQuit = workbenchQuitModalContent({ profile: "terminal" });
  const webQuit = workbenchQuitModalContent({ profile: "web" });

  assertEquals(terminalDemo.title, "Confirm Action");
  assertEquals(Array.isArray(terminalDemo.body) && terminalDemo.body[0].includes("workspace"), true);
  assertEquals(Array.isArray(webDemo.body) && webDemo.body[0].includes("browser workbench"), true);
  assertEquals(terminalDemo.actions?.map((action) => action.id), ["cancel", "details", "confirm"]);
  assertEquals(terminalQuit.title, "Quit Workbench?");
  assertEquals(webQuit.title, "Close Web Workbench?");
  assertEquals(terminalQuit.actions?.find((action) => action.id === "quit")?.label, "Quit");
  assertEquals(webQuit.actions?.find((action) => action.id === "quit")?.label, "Close");
  assertEquals(webQuit.actions?.find((action) => action.id === "quit")?.destructive, true);
});

Deno.test("workbench modal helpers build help details and confirmation content", () => {
  const help = workbenchHelpModalContent({ profile: "terminal" });
  const details = workbenchModalDetailsContent({ profile: "web" });
  const confirmed = workbenchModalConfirmedContent({ profile: "terminal" });

  assertEquals(help.title, "Workbench Help");
  assertEquals(Array.isArray(help.body) && help.body.length, 17);
  assertEquals(help.actions?.map((action) => action.id), ["dismiss", "controls"]);
  assertEquals(details.title, "Modal Details");
  assertEquals(details.actions?.map((action) => action.id), ["back", "confirm", "dismiss"]);
  assertEquals(confirmed.tone, "success");
  assertEquals(confirmed.actions?.[0]?.default, true);
});
