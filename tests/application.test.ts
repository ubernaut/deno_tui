import { crayon } from "crayon";
import { assertEquals } from "./deps.ts";
import { type Action, Button, createTerminalApp, Signal, type TerminalAppOptions } from "../mod.app.ts";
import type { ComponentState } from "../src/component.ts";
import { type EmitterEvent, EventEmitter } from "../src/event_emitter.ts";
import type { InputEventRecord } from "../src/input_reader/mod.ts";
import { createTestMousePress } from "../src/testing/input.ts";
import { createTestCanvas, createTestStdout } from "../src/testing/snapshot.ts";
import { Tui } from "../src/tui.ts";
import type { Stdout } from "../src/types.ts";

type TestAction =
  | { type: "route"; payload: string }
  | { type: "notice"; payload: string };

class FakeTui extends EventEmitter<InputEventRecord & { destroy: EmitterEvent<[]> }> {
  dispatchCalls = 0;
  runCalls = 0;
  destroyCalls = 0;

  dispatch(): void {
    this.dispatchCalls += 1;
  }

  run(): void {
    this.runCalls += 1;
  }

  destroy(): void {
    this.destroyCalls += 1;
  }
}

Deno.test("focused app entrypoint declaratively wires routes commands focus mouse and lifecycle", async () => {
  const tui = new FakeTui();
  const focusable = { state: new Signal<ComponentState>("base") };
  const actions: TestAction[] = [];
  let setupCount = 0;
  let disposeCount = 0;
  const options: TerminalAppOptions<TestAction> = {
    tui: tui as unknown as Tui,
    input: false,
    exitOnSignal: false,
    routes: [
      { id: "home", title: "Home" },
      { id: "settings", title: "Settings" },
    ],
    commands: [{
      id: "route.settings",
      label: "Open Settings",
      binding: { key: "s" },
      action: { type: "route", payload: "settings" },
    }],
    focusItems: [focusable],
    mouseTargets: [{
      id: "main",
      bounds: { column: 0, row: 0, width: 20, height: 5 },
      onPress: () => true,
    }],
    onAction: (action) => {
      actions.push(action);
    },
    setup: () => {
      setupCount += 1;
      return () => disposeCount += 1;
    },
  };

  const app = createTerminalApp(options);
  assertEquals(app.routes.activeRouteId.peek(), "home");
  assertEquals(app.inspect().commands.count, 1);
  assertEquals(app.inspect().keymap.count, 1);
  assertEquals(app.inspect().focus.count, 1);
  assertEquals(app.inspect().mouse.length, 1);
  assertEquals(setupCount, 1);

  assertEquals(await app.executeCommand("route.settings"), true);
  assertEquals(actions, [{ type: "route", payload: "settings" }]);

  app.start();
  app.start();
  assertEquals(app.started, true);
  assertEquals(tui.dispatchCalls, 0);
  assertEquals(tui.runCalls, 1);

  app.destroy();
  app.destroy();
  app.start();
  assertEquals(app.started, false);
  assertEquals(tui.destroyCalls, 1);
  assertEquals(tui.runCalls, 1);
  assertEquals(disposeCount, 1);
  focusable.state.dispose();
});

Deno.test("focused app entrypoint can retain default process signal ownership", () => {
  const tui = new FakeTui();
  const app = createTerminalApp<Action>({
    tui: tui as unknown as Tui,
    input: false,
  });

  app.start();
  assertEquals(tui.dispatchCalls, 1);
  assertEquals(tui.runCalls, 1);
  app.destroy();
});

Deno.test("focused app component registration activates and disposes real buttons", async () => {
  const stdout = createTestStdout();
  const canvas = createTestCanvas({ stdout, size: { columns: 24, rows: 8 } });
  const tui = new Tui({ canvas, stdout: stdout as unknown as Stdout });
  const app = createTerminalApp({ tui, input: false, exitOnSignal: false });
  const button = new Button({
    parent: tui,
    rectangle: { column: 2, row: 2, width: 10, height: 3 },
    zIndex: 1,
    theme: {
      base: crayon.bgBlue,
      focused: crayon.bgLightBlue,
      active: crayon.bgCyan,
    },
    label: { text: "Run" },
  });
  await Promise.resolve();
  const unregister = app.registerComponent(button, { id: "run" });

  assertEquals(app.inspect().focus.count, 1);
  assertEquals(app.inspect().mouse.length, 1);
  assertEquals(await app.mouse.dispatch(createTestMousePress({ x: 4, y: 3 })), {
    handled: true,
    targetId: "run",
    kind: "press",
    captured: false,
  });
  assertEquals(button.buttonController.inspect().pressCount, 1);
  assertEquals(button.state.peek(), "active");

  await app.mouse.dispatch(createTestMousePress({ x: 4, y: 3, release: true }));
  assertEquals(button.state.peek(), "focused");
  unregister();
  assertEquals(app.inspect().focus.count, 0);
  assertEquals(app.inspect().mouse.length, 0);
  app.destroy();
});

Deno.test("Tui preserves externally managed canvas dimensions", async () => {
  const stdout = createTestStdout();
  const canvas = createTestCanvas({
    stdout,
    size: { columns: 48, rows: 16 },
  });
  const tui = new Tui({
    canvas,
    stdout: stdout as unknown as Stdout,
  });

  assertEquals(tui.manageTerminalSize, false);
  assertEquals(tui.rectangle.value, { column: 0, row: 0, width: 48, height: 16 });
  await Promise.resolve();
  canvas.size.value = { columns: 72, rows: 24 };
  assertEquals(tui.rectangle.value, { column: 0, row: 0, width: 72, height: 24 });
  tui.destroy();
});
