import { assertEquals } from "./deps.ts";
import { layoutWorkbenchTitlebar } from "../src/app/workbench_titlebar.ts";

Deno.test("workbench titlebar layout anchors window controls inside the right border", () => {
  const layout = layoutWorkbenchTitlebar({
    rect: { column: 2, row: 4, width: 48, height: 8 },
    title: "Data Table",
  });

  assertEquals(layout.hasWindowControls, true);
  assertEquals(layout.buttons.map((button) => [button.kind, button.label, button.rect]), [
    ["minimize", "-", { column: 34, row: 4, width: 3, height: 1 }],
    ["maximize", "□", { column: 38, row: 4, width: 3, height: 1 }],
    ["restore", "↺", { column: 42, row: 4, width: 3, height: 1 }],
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
