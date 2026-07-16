import { assertEquals } from "./deps.ts";
import { layoutWorkbenchTitlebar, workbenchTitlebarButtonRenderCommandsInto } from "../src/app/workbench_titlebar.ts";

Deno.test("workbench titlebar shows maximize only for a normal window", () => {
  const layout = layoutWorkbenchTitlebar({
    rect: { column: 0, row: 2, width: 48, height: 8 },
    title: "Data",
    maximized: false,
  });

  assertEquals(layout.hasWindowControls, true);
  assertEquals(layout.buttons.map((button) => [button.kind, button.rect]), [
    ["minimize", { column: 36, row: 2, width: 3, height: 1 }],
    ["maximize", { column: 40, row: 2, width: 3, height: 1 }],
    ["close", { column: 44, row: 2, width: 3, height: 1 }],
  ]);
});

Deno.test("workbench titlebar replaces maximize with restore for a maximized window", () => {
  const layout = layoutWorkbenchTitlebar({
    rect: { column: 0, row: 2, width: 48, height: 8 },
    title: "Data",
    maximized: true,
  });

  assertEquals(layout.buttons.map((button) => [button.kind, button.rect]), [
    ["minimize", { column: 36, row: 2, width: 3, height: 1 }],
    ["restore", { column: 40, row: 2, width: 3, height: 1 }],
    ["close", { column: 44, row: 2, width: 3, height: 1 }],
  ]);
});

Deno.test("workbench titlebar state-aware controls fit narrower panes", () => {
  const normal = layoutWorkbenchTitlebar({
    rect: { column: 0, row: 0, width: 12, height: 4 },
    title: "Data",
    maximized: false,
  });
  const legacy = layoutWorkbenchTitlebar({
    rect: { column: 0, row: 0, width: 12, height: 4 },
    title: "Data",
  });

  assertEquals(normal.hasWindowControls, true);
  assertEquals(normal.buttons.map((button) => button.kind), ["minimize", "maximize", "close"]);
  assertEquals(legacy.hasWindowControls, false);
  assertEquals(legacy.buttons, []);
});

Deno.test("workbench titlebar exposes semantic labels and keyboard equivalents", () => {
  const layout = layoutWorkbenchTitlebar({
    rect: { column: 0, row: 0, width: 64, height: 8 },
    title: "Three",
    showConfig: true,
    maximized: false,
  });

  assertEquals(layout.buttons.map((button) => [button.kind, button.accessibilityLabel, button.shortcut]), [
    ["config", "Configure renderer", "G"],
    ["minimize", "Minimize window", "M"],
    ["maximize", "Maximize window", "F"],
    ["close", "Close window", "C"],
  ]);

  const commands = workbenchTitlebarButtonRenderCommandsInto([], layout);
  assertEquals(
    commands.map((command) => [command.kind, command.accessibilityLabel, command.shortcut]),
    layout.buttons.map((button) => [button.kind, button.accessibilityLabel, button.shortcut]),
  );
});
