import { assertEquals } from "./deps.ts";
import { workbenchHelpRows } from "../src/app/workbench/mod.ts";
import {
  workbenchDemoModalContent,
  workbenchHelpModalContent,
  workbenchModalConfirmedContent,
  workbenchModalDetailsContent,
  workbenchQuitModalContent,
} from "../app/workbench_modal_content.ts";

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
