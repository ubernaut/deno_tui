import { crayon } from "crayon";
import { assertEquals, assertStringIncludes } from "./deps.ts";
import { Button, Computed, Input, Signal, Text } from "../mod.app.ts";
import { createTestTerminalApp } from "../mod.testing.ts";

type CounterAction = { type: "increment" } | { type: "delayed" };

Deno.test("TerminalAppPilot drives keys clicks resize commands and snapshots", async () => {
  const count = new Signal(0);
  const harness = await createTestTerminalApp<CounterAction>({
    size: { columns: 24, rows: 8 },
    commands: [{
      id: "increment",
      label: "Increment",
      binding: { key: "i" },
      action: { type: "increment" },
    }],
    onAction: (action) => {
      if (action.type === "increment") count.value += 1;
    },
    setup(app) {
      new Text({
        parent: app.tui,
        rectangle: { column: 1, row: 1, width: 22 },
        zIndex: 1,
        theme: { base: crayon.white },
        text: new Computed(() =>
          `Count ${count.value} / ${app.tui.rectangle.value.width}x${app.tui.rectangle.value.height}`
        ),
      });
      const button = new Button({
        parent: app.tui,
        rectangle: { column: 2, row: 3, width: 10, height: 3 },
        zIndex: 1,
        theme: {
          base: crayon.bgBlue,
          focused: crayon.bgLightBlue,
          active: crayon.bgCyan,
        },
        label: { text: "Increment" },
        onPress: () => void app.executeCommand("increment"),
      });
      app.registerComponent(button, { id: "increment-button" });
    },
  });

  try {
    assertStringIncludes(harness.pilot.snapshot(), "Count 0 / 24x8");
    await harness.pilot.press("i");
    assertEquals(count.peek(), 1);

    const click = await harness.pilot.click(4, 4);
    assertEquals(click.press.targetId, "increment-button");
    assertEquals(click.release.targetId, "increment-button");
    assertEquals(count.peek(), 2);

    await harness.pilot.resize(32, 10);
    assertEquals(harness.canvas.size.peek(), { columns: 32, rows: 10 });
    assertStringIncludes(harness.pilot.snapshot(), "Count 2 / 32x10");
    assertEquals(await harness.pilot.executeCommand("increment"), true);
    assertEquals(count.peek(), 3);
  } finally {
    harness.destroy();
    count.dispose();
  }
});

Deno.test("TerminalApp focus traversal does not deliver its Tab to the newly focused input", async () => {
  const firstText = new Signal("");
  const secondText = new Signal("");
  let first!: Input;
  let second!: Input;
  const harness = await createTestTerminalApp({
    setup(app) {
      first = new Input({
        parent: app.tui,
        rectangle: { column: 0, row: 0, width: 10, height: 1 },
        zIndex: 1,
        theme: { base: crayon.white, focused: crayon.cyan, cursor: { base: crayon.invert } },
        text: firstText,
      });
      second = new Input({
        parent: app.tui,
        rectangle: { column: 0, row: 1, width: 10, height: 1 },
        zIndex: 1,
        theme: { base: crayon.white, focused: crayon.cyan, cursor: { base: crayon.invert } },
        text: secondText,
      });
      app.registerComponent(first, { id: "first" });
      app.registerComponent(second, { id: "second" });
      app.focus.focus(first);
    },
  });

  try {
    await harness.pilot.press("tab");
    assertEquals(harness.app.focus.current(), second);
    assertEquals(firstText.peek(), "");
    assertEquals(secondText.peek(), "");
  } finally {
    harness.destroy();
    firstText.dispose();
    secondText.dispose();
  }
});

Deno.test("TerminalAppPilot settles async actions and emits paste focus and scroll", async () => {
  const events: string[] = [];
  let delayed = false;
  const harness = await createTestTerminalApp<CounterAction>({
    commands: [{ id: "delayed", label: "Delayed", binding: { key: "d" }, action: { type: "delayed" } }],
    onAction: async (action) => {
      if (action.type !== "delayed") return;
      await new Promise((resolve) => setTimeout(resolve, 5));
      delayed = true;
    },
    setup(app) {
      app.tui.on("paste", (event) => {
        events.push(`paste:${event.text}`);
      });
      app.tui.on("terminalFocus", (event) => {
        events.push(`focus:${event.focused}`);
      });
      app.mouse.register({
        id: "scroll-target",
        bounds: { column: 0, row: 0, width: 10, height: 10 },
        onScroll: (event) => {
          events.push(`scroll:${event.scroll}`);
          return true;
        },
      });
    },
  });

  try {
    await harness.pilot.press("d");
    assertEquals(delayed, true);
    await harness.pilot.paste("alpha\nbeta");
    await harness.pilot.focus(false);
    const scroll = await harness.pilot.scroll(-1, 2, 2);
    assertEquals(scroll.targetId, "scroll-target");
    await harness.pilot.waitFor(() => events.length === 3);
    assertEquals(events, ["paste:alpha\nbeta", "focus:false", "scroll:-1"]);
  } finally {
    harness.destroy();
  }
});
