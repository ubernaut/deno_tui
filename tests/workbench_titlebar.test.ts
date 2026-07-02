import { assertEquals } from "./deps.ts";
import {
  createWorkbenchTitlebarLayout,
  layoutWorkbenchTitlebar,
  layoutWorkbenchTitlebarInto,
  workbenchTitlebarButtonRenderCommandsInto,
} from "../src/app/workbench_titlebar.ts";

Deno.test("workbench titlebar layout anchors window controls inside the right border", () => {
  const layout = layoutWorkbenchTitlebar({
    rect: { column: 2, row: 4, width: 48, height: 8 },
    title: "Data Table",
  });

  assertEquals(layout.hasWindowControls, true);
  assertEquals(layout.buttons.map((button) => [button.kind, button.label, button.rect]), [
    ["minimize", "-", { column: 34, row: 4, width: 3, height: 1 }],
    ["maximize", "M", { column: 38, row: 4, width: 3, height: 1 }],
    ["restore", "R", { column: 42, row: 4, width: 3, height: 1 }],
    ["close", "x", { column: 46, row: 4, width: 3, height: 1 }],
  ]);
});

Deno.test("workbench titlebar layout hides controls when the window is too narrow", () => {
  const layout = layoutWorkbenchTitlebar({
    rect: { column: 0, row: 0, width: 18, height: 5 },
    title: "Tiny",
  });

  assertEquals(layout.hasWindowControls, false);
  assertEquals(layout.buttons, []);
});

Deno.test("workbench titlebar layout only adds config when it fits between title and controls", () => {
  const wide = layoutWorkbenchTitlebar({
    rect: { column: 0, row: 0, width: 64, height: 8 },
    title: "Three",
    showConfig: true,
  });
  const narrow = layoutWorkbenchTitlebar({
    rect: { column: 0, row: 0, width: 30, height: 8 },
    title: "Long Three Renderer",
    showConfig: true,
  });

  assertEquals(wide.buttons.find((button) => button.kind === "config")?.rect, {
    column: 37,
    row: 0,
    width: 10,
    height: 1,
  });
  assertEquals(narrow.buttons.some((button) => button.kind === "config"), false);
});

Deno.test("workbench titlebar layout can reuse caller-owned button geometry", () => {
  const target = createWorkbenchTitlebarLayout();
  const first = layoutWorkbenchTitlebarInto(target, {
    rect: { column: 0, row: 0, width: 64, height: 8 },
    title: "Three",
    showConfig: true,
  });
  const config = first.buttons[0];

  const second = layoutWorkbenchTitlebarInto(target, {
    rect: { column: 4, row: 3, width: 48, height: 8 },
    title: "Data",
    showConfig: false,
  });

  assertEquals(second === target, true);
  assertEquals(second.buttons.length, 4);
  assertEquals(second.buttons[0] === config, true);
  assertEquals(second.buttons.some((button) => button.kind === "config"), false);
  assertEquals(second.buttons[0].rect, { column: 36, row: 3, width: 3, height: 1 });
  assertEquals(second.buttons[3].rect, { column: 48, row: 3, width: 3, height: 1 });
});

Deno.test("workbench titlebar render commands expose clipped text and hit rectangles", () => {
  const layout = layoutWorkbenchTitlebar({
    rect: { column: 0, row: 2, width: 64, height: 8 },
    title: "Three",
    showConfig: true,
  });
  const commands = workbenchTitlebarButtonRenderCommandsInto([], layout);

  assertEquals(commands.map((command) => [command.kind, command.label, command.text, command.rect]), [
    ["config", "config", "[ config ]", { column: 37, row: 2, width: 10, height: 1 }],
    ["minimize", "-", "[-]", { column: 48, row: 2, width: 3, height: 1 }],
    ["maximize", "M", "[M]", { column: 52, row: 2, width: 3, height: 1 }],
    ["restore", "R", "[R]", { column: 56, row: 2, width: 3, height: 1 }],
    ["close", "x", "[x]", { column: 60, row: 2, width: 3, height: 1 }],
  ]);
  assertEquals(commands.map((command) => command.hitRect), commands.map((command) => command.rect));
});

Deno.test("workbench titlebar render commands reuse caller-owned storage", () => {
  const layout = layoutWorkbenchTitlebar({
    rect: { column: 0, row: 0, width: 48, height: 8 },
    title: "Data",
  });
  const first = workbenchTitlebarButtonRenderCommandsInto([], layout);
  const firstCommand = first[0];

  const second = workbenchTitlebarButtonRenderCommandsInto(
    first,
    layoutWorkbenchTitlebar({
      rect: { column: 4, row: 3, width: 48, height: 8 },
      title: "Data",
    }),
  );

  assertEquals(second === first, true);
  assertEquals(second[0] === firstCommand, true);
  assertEquals(second[0]?.rect, { column: 36, row: 3, width: 3, height: 1 });
});
