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
