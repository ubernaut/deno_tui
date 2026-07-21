import { assert, assertEquals } from "./deps.ts";
import { crayon } from "crayon";
import { ScrollArea, Signal, TextBox } from "../mod.app.ts";
import { createTestTerminalApp } from "../mod.testing.ts";

Deno.test("component visibility does not write through read-only child visibility", async () => {
  const visible = new Signal(true);
  const lineNumbering = new Signal(true);
  let area: ScrollArea | undefined;
  let textBox: TextBox | undefined;
  const harness = await createTestTerminalApp({
    size: { columns: 20, rows: 8 },
    setup(app) {
      area = new ScrollArea({
        parent: app.tui,
        theme: { base: crayon.white },
        zIndex: 1,
        visible,
        rectangle: { column: 0, row: 0, width: 12, height: 4 },
        contentHeight: 20,
        showScrollbar: true,
      });
      textBox = new TextBox({
        parent: app.tui,
        theme: { base: crayon.white, cursor: { base: crayon.invert } },
        zIndex: 1,
        visible,
        rectangle: { column: 0, row: 4, width: 12, height: 4 },
        text: "alpha\nbeta",
        lineNumbering,
      });
    },
  });

  try {
    harness.pilot.snapshot();
    assert(area);
    assert(area.children.length > 0);
    assert(textBox);

    // Removing line-number objects leaves a sparse draw-object array.
    lineNumbering.value = false;

    visible.value = false;
    assertEquals(area.visible.peek(), false);
    assertEquals(textBox.visible.peek(), false);
    visible.value = true;
    assertEquals(area.visible.peek(), true);
  } finally {
    harness.destroy();
    lineNumbering.dispose();
    visible.dispose();
  }
});
