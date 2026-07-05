import { assertEquals } from "./deps.ts";
import {
  applyWorkbenchTextPromptInput,
  buttonText,
  compactSpaces,
  createWorkbenchShellSession,
  dispatchWorkbenchTextPromptInput,
  HitTargetStack,
  layoutWorkbenchButtonRow,
  layoutWorkbenchModal,
  layoutWorkbenchTitlebar,
  maxTextWidth,
  maxTextWidthBy,
  maxTrimmedTextWidth,
  resolveWorkbenchGlobalKey,
  resolveWorkbenchShellBackend,
  resolveWorkbenchThreeTerminalPressureBudget,
  translateHitTargets,
  visibleMenuSlice,
  visibleMenuSliceInto,
  visibleProjectedMenuSliceInto,
  workbenchContentViewport,
  workbenchHelpRows,
  workbenchStandardTopMenuDropdownOverlayInto,
  workbenchStatusSnapshotLine,
  WorkbenchTopMenuController,
  wrapPlainText,
  wrapPlainTextInto,
} from "../src/app/workbench/mod.ts";
import {
  workbenchDemoModalContent,
  workbenchHelpModalContent,
  workbenchModalConfirmedContent,
  workbenchModalDetailsContent,
  workbenchQuitModalContent,
} from "../app/workbench_panels.ts";

const fit = (value: string, width: number) => value.slice(0, Math.max(0, width));

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

Deno.test("workbench facade text helpers normalize whitespace and measure rows", () => {
  assertEquals(compactSpaces("  a   b\n c  "), "a b c");
  assertEquals(maxTextWidth(["abc", "abcdef", "x"]), 6);
  assertEquals(maxTextWidthBy([{ label: "abc" }, { label: "abcdef" }], (entry) => entry.label), 6);
  assertEquals(maxTrimmedTextWidth(["abc   ", "abcdef", "x"]), 6);
});

Deno.test("workbench facade text helpers wrap plain text after stripping styles", () => {
  assertEquals(wrapPlainText("\x1b[31mhello\x1b[0m wide world", 8, fit), [
    "hello",
    "wide",
    "world",
  ]);
  assertEquals(wrapPlainText("supercalifragilistic", 5, fit), ["super"]);
  assertEquals(wrapPlainText("   ", 5, fit), [""]);

  const target = wrapPlainText("first pass", 5, fit);
  const sameTarget = wrapPlainTextInto(target, "\x1b[32mhello\x1b[0m compact world", 8, fit);
  assertEquals(sameTarget === target, true);
  assertEquals(target, [
    "hello",
    "compact",
    "world",
  ]);
  assertEquals(wrapPlainTextInto(target, "   ", 8, fit), [""]);
  assertEquals(target.length, 1);
});

Deno.test("workbench facade text helpers project visible menu slices around selection", () => {
  const items = ["a", "b", "c", "d", "e"];
  assertEquals(visibleMenuSlice(items, 0, 3), { items: ["a", "b", "c"], indexes: [0, 1, 2] });
  assertEquals(visibleMenuSlice(items, 2, 3), { items: ["b", "c", "d"], indexes: [1, 2, 3] });
  assertEquals(visibleMenuSlice(items, 4, 3), { items: ["c", "d", "e"], indexes: [2, 3, 4] });

  const full = visibleMenuSlice(items, 2, 10);
  full.items[0] = "mutated";
  assertEquals(items[0], "a");

  const target = { items: ["stale"], indexes: [99] };
  assertEquals(visibleMenuSliceInto(target, items, 4, 3), { items: ["c", "d", "e"], indexes: [2, 3, 4] });
  assertEquals(visibleMenuSliceInto(target, ["x"], 0, 3), { items: ["x"], indexes: [0] });
  assertEquals(target.items.length, 1);
  assertEquals(target.indexes.length, 1);

  assertEquals(
    visibleProjectedMenuSliceInto(
      target,
      [{ label: "alpha" }, { label: "beta" }],
      0,
      4,
      (entry, index) => `${index}:${entry.label}`,
    ),
    { items: ["0:alpha", "1:beta"], indexes: [0, 1] },
  );
});

Deno.test("workbench facade text prompt input edits printable cell-width keys", () => {
  assertEquals(
    applyWorkbenchTextPromptInput({ event: { key: "a" }, value: "dem", maxLength: 8 }),
    { action: "update", value: "dema" },
  );
  assertEquals(
    applyWorkbenchTextPromptInput({ event: { key: "b" }, value: "1234", maxLength: 4 }),
    { action: "update", value: "1234" },
  );
});

Deno.test("workbench facade text prompt input handles backspace submit and cancel", () => {
  assertEquals(
    applyWorkbenchTextPromptInput({ event: { key: "backspace" }, value: "demo" }),
    { action: "update", value: "dem" },
  );
  assertEquals(
    applyWorkbenchTextPromptInput({ event: { key: "return" }, value: "demo" }),
    { action: "submit", value: "demo" },
  );
  assertEquals(
    applyWorkbenchTextPromptInput({ event: { key: "escape" }, value: "demo" }),
    { action: "cancel", value: "demo" },
  );
});

Deno.test("workbench facade text prompt input ignores modified and non-cell keys", () => {
  assertEquals(
    applyWorkbenchTextPromptInput({ event: { key: "x", ctrl: true }, value: "demo" }),
    { action: "ignore", value: "demo" },
  );
  assertEquals(
    applyWorkbenchTextPromptInput({ event: { key: "left" }, value: "demo" }),
    { action: "ignore", value: "demo" },
  );
  assertEquals(
    applyWorkbenchTextPromptInput({
      event: { key: "字" },
      value: "demo",
      measureText: () => 2,
    }),
    { action: "ignore", value: "demo" },
  );
});

Deno.test("workbench facade text prompt dispatcher reports handled actions and callbacks", () => {
  const calls: string[] = [];

  assertEquals(
    dispatchWorkbenchTextPromptInput(
      { event: { key: "x", ctrl: true }, value: "demo" },
      { onUpdate: (value) => calls.push(`update:${value}`) },
    ),
    false,
  );
  assertEquals(calls, []);

  assertEquals(
    dispatchWorkbenchTextPromptInput(
      { event: { key: "a" }, value: "demo", maxLength: 8 },
      { onUpdate: (value) => calls.push(`update:${value}`) },
    ),
    true,
  );
  assertEquals(
    dispatchWorkbenchTextPromptInput(
      { event: { key: "return" }, value: "demoa" },
      { onSubmit: (value) => calls.push(`submit:${value}`) },
    ),
    true,
  );
  assertEquals(
    dispatchWorkbenchTextPromptInput(
      { event: { key: "escape" }, value: "demoa" },
      { onCancel: (value) => calls.push(`cancel:${value}`) },
    ),
    true,
  );

  assertEquals(calls, ["update:demoa", "submit:demoa", "cancel:demoa"]);
});
