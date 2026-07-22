// Copyright 2023 Im-Beast. MIT license.

import { assert, assertEquals, assertNotEquals, assertStringIncludes } from "../deps.ts";
import { encodeTerminalPaste, POINTER_INPUT_SCHEMA_VERSION, type PointerInputEvent } from "../../mod.ts";
import { createTestTerminalApp } from "../../src/testing/app.ts";
import { stripAnsi } from "../../src/testing/snapshot.ts";
import { createTestKeyPress, createTestMousePress } from "../../src/testing/input.ts";
import { decodeBuffer } from "../../src/input_reader/mod.ts";
import type { Key, MouseScrollEvent } from "../../src/input_reader/types.ts";
import {
  bindMuxstonePointerInput,
  createMuxstoneTerminalOptions,
  type MuxstoneAppMountRef,
  muxstoneGlobalConfigLayout,
  muxstoneGlyphColumns,
  muxstoneMetaballBackgroundVisible,
  muxstoneMetaballsMayAdvance,
  type MuxstonePointerInputSource,
  muxstoneQuitLayout,
  muxstoneScpLayout,
  muxstoneWindowConfigLayout,
  projectMuxstoneTerminalBar,
} from "../../examples/showcases/muxstone/app.ts";
import {
  createMuxstoneController,
  MUXSTONE_NETWORK_WINDOW_ID,
  MUXSTONE_SESSIONS_WINDOW_ID,
  type MuxstoneController,
} from "../../examples/showcases/muxstone/controller.ts";
import {
  cycleMuxstoneGlobalSetting,
  cycleMuxstoneWindowSetting,
  defaultMuxstoneGlobalSettings,
  defaultMuxstoneWindowSettings,
  MUXSTONE_BACKGROUND_IDS,
  MUXSTONE_GLOBAL_SETTING_SPECS,
  MUXSTONE_THEMES,
  MUXSTONE_WINDOW_SETTING_SPECS,
  type MuxstoneAttachResult,
  type MuxstoneClientPort,
  type MuxstoneOutputFrame,
  type MuxstoneSessionSummary,
  type MuxstoneSpawnOptions,
  muxstoneTheme,
  muxstoneWindowId,
  normalizeMuxstoneGlobalSettings,
  normalizeMuxstoneWindowSettings,
  normalizeMuxstoneWorkspaceState,
} from "../../examples/showcases/muxstone/model.ts";
import { MUXSTONE_PROTOCOL_LIMITS } from "../../examples/showcases/muxstone/protocol.ts";
import type { TailnetStatusResult } from "../../examples/showcases/muxstone/tailnet.ts";
import { muxstoneTerminalForegroundRgb } from "../../examples/showcases/muxstone/terminal_palette.ts";
import {
  MUXSTONE_METABALL_LEVELS,
  MuxstoneMetaballField,
} from "../../examples/showcases/muxstone/metaball_background.ts";

Deno.test("Muxstone metaballs are deterministic, pointer-attracted, window-averse, and quantized", () => {
  const bounds = { column: 0, row: 2, width: 64, height: 20 } as const;
  const first = new MuxstoneMetaballField({ seed: 42, count: 1 });
  const second = new MuxstoneMetaballField({ seed: 42, count: 1 });
  assertEquals([...first.rasterize(bounds)], [...second.rasterize(bounds)]);
  assertEquals(first.inspect(), second.inspect());

  const beforePointer = first.inspect().balls[0]!;
  const direction = beforePointer.x < bounds.width / 2 ? 1 : -1;
  first.setPointer({
    column: direction > 0 ? bounds.column + bounds.width - 1 : bounds.column,
    row: beforePointer.y,
  }, 0);
  first.advance({ bounds, now: 16.7 });
  const afterPointer = first.inspect().balls[0]!;
  assert(direction * (afterPointer.vx - beforePointer.vx) > 0);

  const avoiding = new MuxstoneMetaballField({ seed: 7, count: 1 });
  avoiding.rasterize(bounds);
  const beforeObstacle = avoiding.inspect().balls[0]!;
  avoiding.advance({
    bounds,
    now: 16.7,
    obstacles: [{
      column: Math.floor(beforeObstacle.x + beforeObstacle.radius * 0.7),
      row: bounds.row - 100,
      width: 40,
      height: 200,
    }],
  });
  assert(avoiding.inspect().balls[0]!.vx < beforeObstacle.vx);

  const levels = first.rasterize(bounds);
  assert(Math.max(...levels) > 0);
  assert(Math.max(...levels) < MUXSTONE_METABALL_LEVELS);
  assertEquals(levels.length, bounds.width * bounds.height);
});

Deno.test("Muxstone paints the metaball field behind floating desktop windows", async () => {
  const client = new FakeMuxstoneClient([]);
  const controller = await createMuxstoneController({ client, initialSessions: [] });
  const mount: MuxstoneAppMountRef = {};
  const { tuiOptions: _tuiOptions, ...headlessOptions } = createMuxstoneTerminalOptions(controller, mount);
  const harness = await createTestTerminalApp({ ...headlessOptions, size: { columns: 80, rows: 24 } });
  try {
    const mounted = mount.current;
    assert(mounted);
    const body = mounted.bodyRect.peek();
    const manager = mounted.windowProjection.peek().floatingWindows.find((window) =>
      window.id === MUXSTONE_SESSIONS_WINDOW_ID
    );
    assert(manager);
    const uncoveredStyles = new Set<string>();
    for (let row = body.row; row < body.row + body.height; row += 1) {
      for (let column = body.column; column < body.column + body.width; column += 1) {
        const covered = column >= manager.rect.column && column < manager.rect.column + manager.rect.width &&
          row >= manager.rect.row && row < manager.rect.row + manager.rect.height;
        if (covered) continue;
        const value = harness.canvas.frameBuffer[row]?.[column] ?? "";
        uncoveredStyles.add(typeof value === "string" ? value : new TextDecoder().decode(value));
      }
    }
    assert(uncoveredStyles.size > 1);
  } finally {
    harness.destroy();
    await controller.dispose();
  }
});

Deno.test("Muxstone metaballs keep moving during sustained visible terminal output", async () => {
  assertEquals(muxstoneMetaballsMayAdvance(124, 0, false), false);
  assertEquals(muxstoneMetaballsMayAdvance(125, 0, false), true);
  assertEquals(muxstoneMetaballsMayAdvance(1_000, 0, true), false);

  const initial = session("asciichurn-output", "asciichurn", 0);
  const client = new FakeMuxstoneClient([initial]);
  const controller = await createMuxstoneController({ client, initialSessions: [initial] });
  const mount: MuxstoneAppMountRef = {};
  const { tuiOptions: _tuiOptions, ...headlessOptions } = createMuxstoneTerminalOptions(controller, mount);
  const harness = await createTestTerminalApp({ ...headlessOptions, size: { columns: 96, rows: 28 } });
  let outputTimer: ReturnType<typeof setInterval> | undefined;

  try {
    const mounted = mount.current;
    assert(mounted);
    controller.windowHost.execute(
      { kind: "minimize", id: MUXSTONE_SESSIONS_WINDOW_ID },
      mounted.bodyRect.peek(),
    );
    controller.windowHost.execute({
      kind: "set-placement",
      id: muxstoneWindowId(initial.id),
      placement: "floating",
      rect: { column: 5, row: 5, width: 42, height: 15 },
    }, mounted.bodyRect.peek());
    assertEquals(
      muxstoneMetaballBackgroundVisible(mounted.windowProjection.peek(), mounted.bodyRect.peek()),
      true,
    );

    harness.app.start();
    await waitForCondition(() => mounted.metaballFrameRevision() > 0, 1_500);

    let sequence = 0;
    const emitAsciichurnFrame = () => {
      sequence += 1;
      client.emitOutput({
        sessionId: initial.id,
        sequence,
        data: `\r${sequence % 10}`,
      });
    };
    emitAsciichurnFrame();
    outputTimer = setInterval(emitAsciichurnFrame, 20);
    const revisionDuringOutput = mounted.metaballFrameRevision();
    await waitForCondition(() => mounted.metaballFrameRevision() >= revisionDuringOutput + 2, 1_500);
  } finally {
    if (outputTimer !== undefined) clearInterval(outputTimer);
    harness.destroy();
    await controller.dispose();
  }
});

Deno.test("Muxstone mounted app renders styled terminal cells and routes ordered prefix/raw input", async () => {
  const initial = session("shell-1", "primary", 1);
  const client = new FakeMuxstoneClient([initial], {
    "shell-1": [{
      sessionId: "shell-1",
      sequence: 1,
      data: "\x1b]2;asciichurn\x07\x1b[31;44;1mR\x1b[0m\x1b[38;5;196;48;5;22mX\x1b[0m\x1b[38;2;12;34;56mY\x1b[0m",
    }],
  });
  const controller = await createMuxstoneController({
    client,
    initialSessions: [initial],
    defaultCommand: "/bin/test-shell",
  });
  const mount: MuxstoneAppMountRef = {};
  const terminalOptions = createMuxstoneTerminalOptions(controller, mount);
  const { tuiOptions: _tuiOptions, ...headlessOptions } = terminalOptions;
  const harness = await createTestTerminalApp({
    ...headlessOptions,
    size: { columns: 110, rows: 32 },
  });

  try {
    const mounted = mount.current;
    assert(mounted);
    await mounted.whenIdle();
    controller.windowHost.execute(
      { kind: "close", id: MUXSTONE_SESSIONS_WINDOW_ID },
      mounted.bodyRect.peek(),
    );
    await harness.pilot.settle();

    const projection = mounted.windowProjection.peek();
    const terminal = projection.windows.find((window) => window.id === muxstoneWindowId("shell-1"));
    assert(terminal);
    const paintedValue = harness.canvas.frameBuffer[terminal.clientRect.row]?.[terminal.clientRect.column] ?? "";
    const painted = typeof paintedValue === "string" ? paintedValue : new TextDecoder().decode(paintedValue);
    assertStringIncludes(painted, "\x1b[1;38;2;205;49;49;48;2;36;114;200mR");
    const paletteValue = harness.canvas.frameBuffer[terminal.clientRect.row]?.[terminal.clientRect.column + 1] ?? "";
    const palette = typeof paletteValue === "string" ? paletteValue : new TextDecoder().decode(paletteValue);
    assertStringIncludes(palette, "\x1b[38;2;255;0;0;48;2;0;95;0mX");
    const truecolorValue = harness.canvas.frameBuffer[terminal.clientRect.row]?.[terminal.clientRect.column + 2] ?? "";
    const truecolor = typeof truecolorValue === "string" ? truecolorValue : new TextDecoder().decode(truecolorValue);
    assertStringIncludes(truecolor, "\x1b[38;2;12;34;56;48;2;14;21;34mY");
    assertStringIncludes(harness.pilot.snapshot(), "asciichurn");
    assertStringIncludes(harness.pilot.snapshot(), "MUXSTONE");

    await harness.pilot.press("n", { ctrl: true, buffer: new Uint8Array([14]) });
    await harness.pilot.press("f", { buffer: new TextEncoder().encode("f") });
    await mounted.whenIdle();
    let floating = mounted.windowProjection.peek().floatingWindows.find((window) =>
      window.id === muxstoneWindowId("shell-1")
    );
    assert(floating);
    const beforeDrag = { ...floating.rect };
    const dragX = floating.titleBarRect.column + 2;
    const dragY = floating.rect.row;
    assertEquals(
      (await harness.app.mouse.dispatch(createTestMousePress({ x: dragX, y: dragY }))).handled,
      true,
    );
    assertEquals(
      (await harness.app.mouse.dispatch(createTestMousePress({
        x: dragX + 5,
        y: dragY + 4,
        drag: true,
        movementX: 5,
        movementY: 4,
      }))).handled,
      true,
    );
    assertEquals(
      (await harness.app.mouse.dispatch(createTestMousePress({
        x: dragX + 5,
        y: dragY + 4,
        release: true,
        button: undefined,
      }))).handled,
      true,
    );
    await mounted.whenIdle();
    floating = mounted.windowProjection.peek().floatingWindows.find((window) =>
      window.id === muxstoneWindowId("shell-1")
    );
    assert(floating);
    assertEquals(floating.rect, {
      ...beforeDrag,
      column: beforeDrag.column + 5,
      row: beforeDrag.row + 4,
    });

    await harness.pilot.press("n", { ctrl: true, buffer: new Uint8Array([14]) });
    await harness.pilot.press("f", { buffer: new TextEncoder().encode("f") });
    await mounted.whenIdle();
    assertEquals(
      mounted.windowProjection.peek().tiledWindows.some((window) => window.id === muxstoneWindowId("shell-1")),
      true,
    );

    await harness.pilot.press("n", { ctrl: true, buffer: new Uint8Array([14]) });
    await mounted.whenIdle();
    assertEquals(controller.prefixPending.peek(), true);
    assertEquals(client.inputs.length, 0);

    await harness.pilot.press("t", { buffer: new TextEncoder().encode("t") });
    await mounted.whenIdle();
    assertEquals(controller.themeId.peek(), MUXSTONE_THEMES[1]!.id);
    assertEquals(client.inputs.length, 0);

    await harness.pilot.press("a", { buffer: new TextEncoder().encode("a") });
    await mounted.whenIdle();
    assertEquals(client.inputs, [{ sessionId: "shell-1", data: "a" }]);

    await harness.pilot.press("n", { ctrl: true, buffer: new Uint8Array([14]) });
    await harness.pilot.press("c", { buffer: new TextEncoder().encode("c") });
    await mounted.whenIdle();
    assertEquals(controller.sessions.peek().length, 2);
    assertEquals(client.spawned.length, 1);
    assertEquals(client.inputs.length, 1);
  } finally {
    harness.destroy();
    await controller.dispose();
  }
});

Deno.test("Muxstone forwards negotiated nested mouse and touch input to the captured terminal", async () => {
  const first = session("mouse-a", "mouse A", 0);
  const second = session("mouse-b", "mouse B", 0);
  const client = new FakeMuxstoneClient([first, second]);
  const controller = await createMuxstoneController({ client, initialSessions: [first, second] });
  const mount: MuxstoneAppMountRef = {};
  const { tuiOptions: _tuiOptions, ...headlessOptions } = createMuxstoneTerminalOptions(controller, mount);
  const harness = await createTestTerminalApp({
    ...headlessOptions,
    size: { columns: 100, rows: 30 },
  });

  try {
    const mounted = mount.current;
    assert(mounted);
    await mounted.whenIdle();
    controller.windowHost.execute({ kind: "close", id: MUXSTONE_SESSIONS_WINDOW_ID }, mounted.bodyRect.peek());
    controller.windowHost.execute({
      kind: "set-placement",
      id: muxstoneWindowId(first.id),
      placement: "floating",
      rect: { column: 4, row: 5, width: 34, height: 14 },
    }, mounted.bodyRect.peek());
    controller.windowHost.execute({ kind: "focus", id: muxstoneWindowId(first.id) }, mounted.bodyRect.peek());
    await harness.pilot.settle();

    const runtime = controller.runtime(first.id)!;
    runtime.screen.write("\x1b[?1002;1006h");
    let terminal = mounted.windowProjection.peek().floatingWindows.find((window) =>
      window.id === muxstoneWindowId(first.id)
    );
    assert(terminal);
    const x = terminal.clientRect.column + 1;
    const y = terminal.clientRect.row + 1;
    client.inputs.splice(0);
    client.delayInputAcks = true;

    assertEquals(await mounted.handlePointer(mousePointer("down", x, y, 1)), true);
    await Promise.resolve();
    assert(client.pendingInputAckCount > 0);
    controller.windowHost.execute({ kind: "focus", id: muxstoneWindowId(second.id) }, mounted.bodyRect.peek());
    assertEquals(await mounted.handlePointer(mousePointer("move", x + 2, y + 1, 2)), true);
    assertEquals(await mounted.handlePointer(mousePointer("up", x + 2, y + 1, 3)), true);
    await client.resolveAllInputAcks();
    await mounted.whenIdle();
    assert(client.inputs.every((input) => input.sessionId === first.id));
    assertEquals(
      client.inputs.map((input) => input.data).join(""),
      "\x1b[<0;2;2M\x1b[<32;4;3M\x1b[<0;4;3m",
    );

    client.delayInputAcks = false;
    client.inputs.splice(0);
    assertEquals((await harness.pilot.scroll(-1, x + 1, y)).handled, true);
    await mounted.whenIdle();
    assertEquals(client.inputs.map((input) => input.data).join(""), "\x1b[<64;3;2M");

    runtime.screen.write("\x1b[?1002l\x1b[?1003h");
    client.inputs.splice(0);
    assertEquals(await mounted.handlePointer(mouseHoverPointer(x + 3, y + 2, 4, true)), true);
    await mounted.whenIdle();
    assertEquals(client.inputs.map((input) => input.data).join(""), "\x1b[<43;5;4M");

    runtime.screen.write("\x1b[?1003l\x1b[?1002h");
    client.inputs.splice(0);
    const secondary = { ...touchPointer("down", x, y, 5, 62), primary: false };
    assertEquals(await mounted.handlePointer(secondary), false);
    await mounted.whenIdle();
    assertEquals(client.inputs, []);

    assertEquals(await mounted.handlePointer(touchPointer("down", x + 1, y + 1, 6, 63)), true);
    assertEquals(await mounted.handlePointer(touchPointer("move", x + 2, y + 2, 7, 63)), true);
    assertEquals(await mounted.handlePointer(touchPointer("up", x + 2, y + 2, 8, 63)), true);
    await mounted.whenIdle();
    assertEquals(
      client.inputs.map((input) => input.data).join(""),
      "\x1b[<0;3;3M\x1b[<32;4;4M\x1b[<0;4;4m",
    );

    client.inputs.splice(0);
    await mounted.handlePointer(touchPointer("down", x, y, 9, 64));
    controller.openHelp();
    await mounted.handlePointer(touchPointer("move", x + 1, y + 1, 10, 64));
    await mounted.whenIdle();
    assertEquals(client.inputs.map((input) => input.data).join(""), "\x1b[<0;2;2M\x1b[<0;3;3m");
    controller.closeHelp();

    controller.windowHost.execute({
      kind: "set-placement",
      id: muxstoneWindowId(second.id),
      placement: "floating",
      rect: {
        column: terminal.clientRect.column + 3,
        row: terminal.clientRect.row + 2,
        width: 20,
        height: 8,
      },
    }, mounted.bodyRect.peek());
    controller.windowHost.execute({ kind: "focus", id: muxstoneWindowId(second.id) }, mounted.bodyRect.peek());
    terminal = mounted.windowProjection.peek().floatingWindows.find((window) =>
      window.id === muxstoneWindowId(second.id)
    );
    assert(terminal);
    runtime.screen.write("\x1b[?1002l\x1b[?1003h");
    client.inputs.splice(0);
    await mounted.handlePointer(mouseHoverPointer(
      terminal.titleBarRect.column + 2,
      terminal.titleBarRect.row,
      11,
    ));
    await mounted.whenIdle();
    assertEquals(client.inputs, []);
  } finally {
    client.delayInputAcks = false;
    await client.resolveAllInputAcks();
    harness.destroy();
    await controller.dispose();
  }
});

Deno.test("Muxstone coalesces output bursts to one retained desktop invalidation", async () => {
  const initial = session("repaint-burst", "repaint burst", 0);
  const client = new FakeMuxstoneClient([initial]);
  const controller = await createMuxstoneController({ client, initialSessions: [initial] });
  const mount: MuxstoneAppMountRef = {};
  const { tuiOptions: _tuiOptions, ...headlessOptions } = createMuxstoneTerminalOptions(controller, mount);
  const harness = await createTestTerminalApp({ ...headlessOptions, size: { columns: 80, rows: 24 } });

  try {
    assert(mount.current);
    await harness.pilot.settle();
    assertEquals(harness.canvas.updateObjects.length, 0);
    for (let sequence = 1; sequence <= 64; sequence += 1) {
      client.emitOutput({ sessionId: initial.id, sequence, data: "x" });
    }
    assertEquals(controller.runtime(initial.id)!.lastSequence, 64);
    assertEquals(
      harness.canvas.updateObjects.filter((object) => object.type === "muxstone-desktop").length,
      1,
    );
    assertEquals(harness.canvas.updateObjects.length, new Set(harness.canvas.updateObjects).size);
    await harness.pilot.settle();
    assertEquals(harness.canvas.updateObjects.length, 0);
  } finally {
    harness.destroy();
    await controller.dispose();
  }
});

Deno.test("Muxstone invalidates output from a terminal spawned after the desktop mounts", async () => {
  const client = new FakeMuxstoneClient([]);
  const controller = await createMuxstoneController({ client, initialSessions: [] });
  const mount: MuxstoneAppMountRef = {};
  const { tuiOptions: _tuiOptions, ...headlessOptions } = createMuxstoneTerminalOptions(controller, mount);
  const harness = await createTestTerminalApp({ ...headlessOptions, size: { columns: 80, rows: 24 } });

  try {
    const mounted = mount.current;
    assert(mounted);
    await harness.pilot.settle();
    await controller.spawn({ bounds: mounted.bodyRect.peek() });
    await mounted.whenIdle();
    await harness.pilot.settle();
    assertEquals(
      mounted.windowProjection.peek().floatingWindows.some((window) => window.id === muxstoneWindowId("spawned-1")),
      true,
    );
    assertEquals(harness.canvas.updateObjects.length, 0);
    assertEquals(
      controller.windowHost.controller.inspect().windows.find((window) => window.id === MUXSTONE_SESSIONS_WINDOW_ID)
        ?.state,
      "minimized",
    );

    const runtime = controller.runtime("spawned-1");
    assert(runtime);
    client.emitOutput({ sessionId: runtime.sessionId, sequence: 1, data: "fresh-output" });

    assertEquals(runtime.lastSequence, 1);
    assertEquals(
      harness.canvas.updateObjects.filter((object) => object.type === "muxstone-desktop").length,
      1,
    );
    await harness.pilot.settle();
    assertStringIncludes(harness.pilot.snapshot(), "fresh-output");
  } finally {
    harness.destroy();
    await controller.dispose();
  }
});

Deno.test("Muxstone title-bar x kills its terminal and fullscreen suppresses the metaball desktop", async () => {
  const initial = session("chrome-x", "close target", 0);
  const client = new FakeMuxstoneClient([initial]);
  const controller = await createMuxstoneController({ client, initialSessions: [initial] });
  const mount: MuxstoneAppMountRef = {};
  const { tuiOptions: _tuiOptions, ...headlessOptions } = createMuxstoneTerminalOptions(controller, mount);
  const harness = await createTestTerminalApp({ ...headlessOptions, size: { columns: 96, rows: 28 } });

  try {
    const mounted = mount.current;
    assert(mounted);
    await mounted.whenIdle();
    assertEquals(
      muxstoneMetaballBackgroundVisible(mounted.windowProjection.peek(), mounted.bodyRect.peek()),
      false,
    );
    controller.windowHost.execute(
      { kind: "set-placement", id: muxstoneWindowId(initial.id), placement: "floating" },
      mounted.bodyRect.peek(),
    );
    assertEquals(
      muxstoneMetaballBackgroundVisible(mounted.windowProjection.peek(), mounted.bodyRect.peek()),
      true,
    );

    controller.windowHost.execute(
      { kind: "maximize", id: muxstoneWindowId(initial.id) },
      mounted.bodyRect.peek(),
    );
    assertEquals(
      muxstoneMetaballBackgroundVisible(mounted.windowProjection.peek(), mounted.bodyRect.peek()),
      false,
    );
    controller.windowHost.execute(
      { kind: "restore", id: muxstoneWindowId(initial.id) },
      mounted.bodyRect.peek(),
    );
    assertEquals(
      muxstoneMetaballBackgroundVisible(mounted.windowProjection.peek(), mounted.bodyRect.peek()),
      true,
    );

    // The always-on-top session manager overlaps this floating terminal's
    // title bar in the default test geometry. Minimize it so the click reaches
    // the terminal control the assertion is exercising.
    controller.windowHost.execute(
      { kind: "minimize", id: MUXSTONE_SESSIONS_WINDOW_ID },
      mounted.bodyRect.peek(),
    );

    const terminal = mounted.windowProjection.peek().windows.find((window) =>
      window.id === muxstoneWindowId(initial.id)
    );
    const close = terminal?.controls.find((control) => control.kind === "close");
    assert(close);
    assertEquals(
      (await harness.pilot.click(
        close.hitRect.column + Math.floor(close.hitRect.width / 2),
        close.hitRect.row + Math.floor(close.hitRect.height / 2),
      )).press.handled,
      true,
    );
    await mounted.whenIdle();

    assertEquals(client.killed, [initial.id]);
    assertEquals(client.detached, []);
    assertEquals(client.listSnapshot(), []);
    assertEquals(controller.runtime(initial.id), undefined);
    assertEquals(
      mounted.windowProjection.peek().windows.some((window) => window.id === muxstoneWindowId(initial.id)),
      false,
    );
  } finally {
    harness.destroy();
    await controller.dispose();
  }
});

Deno.test("Muxstone title-bar x kills a visible terminal even when its initial attach failed", async () => {
  const initial = session("attach-failed-x", "unattached target", 0);
  const client = new FakeMuxstoneClient([initial]);
  client.rejectAttach = true;
  const controller = await createMuxstoneController({ client, initialSessions: [initial] });
  const mount: MuxstoneAppMountRef = {};
  const { tuiOptions: _tuiOptions, ...headlessOptions } = createMuxstoneTerminalOptions(controller, mount);
  const harness = await createTestTerminalApp({ ...headlessOptions, size: { columns: 96, rows: 28 } });

  try {
    const mounted = mount.current;
    assert(mounted);
    assertEquals(controller.runtime(initial.id)?.attached.peek(), false);
    const terminal = mounted.windowProjection.peek().windows.find((window) =>
      window.id === muxstoneWindowId(initial.id)
    );
    const close = terminal?.controls.find((control) => control.kind === "close");
    assert(close);
    await mounted.handlePointer(touchPointer("down", close.hitRect.column, close.hitRect.row, 901));
    await mounted.handlePointer(touchPointer("up", close.hitRect.column, close.hitRect.row, 902));
    await mounted.whenIdle();

    assertEquals(client.killed, [initial.id]);
    assertEquals(client.listSnapshot(), []);
    assertEquals(controller.runtime(initial.id), undefined);
  } finally {
    harness.destroy();
    await controller.dispose();
  }
});

Deno.test("Muxstone restores a chrome-closed terminal when the host rejects its kill", async () => {
  const initial = session("kill-rejected-x", "keep this", 0);
  const client = new FakeMuxstoneClient([initial]);
  const controller = await createMuxstoneController({ client, initialSessions: [initial] });
  const mount: MuxstoneAppMountRef = {};
  const { tuiOptions: _tuiOptions, ...headlessOptions } = createMuxstoneTerminalOptions(controller, mount);
  const harness = await createTestTerminalApp({ ...headlessOptions, size: { columns: 96, rows: 28 } });

  try {
    const mounted = mount.current;
    assert(mounted);
    client.rejectKill = true;
    let terminal = mounted.windowProjection.peek().windows.find((window) => window.id === muxstoneWindowId(initial.id));
    let close = terminal?.controls.find((control) => control.kind === "close");
    assert(close);
    await harness.pilot.click(close.hitRect.column, close.hitRect.row);
    await mounted.whenIdle();

    assertEquals(client.killed, [initial.id]);
    assertEquals(controller.runtime(initial.id)?.attached.peek(), true);
    assertEquals(
      controller.windowHost.controller.inspect().windows.find((window) => window.id === muxstoneWindowId(initial.id))
        ?.state,
      "normal",
    );
    client.emitOutput({ sessionId: initial.id, sequence: 1, data: "after-rejected-kill" });
    assertEquals(controller.runtime(initial.id)?.lastSequence, 1);

    client.rejectKill = false;
    terminal = mounted.windowProjection.peek().windows.find((window) => window.id === muxstoneWindowId(initial.id));
    close = terminal?.controls.find((control) => control.kind === "close");
    assert(close);
    await harness.pilot.click(close.hitRect.column, close.hitRect.row);
    await mounted.whenIdle();
    assertEquals(client.killed, [initial.id, initial.id]);
    assertEquals(controller.runtime(initial.id), undefined);
  } finally {
    harness.destroy();
    await controller.dispose();
  }
});

Deno.test("Muxstone Meta-C kills the terminal that was active before generic close changed focus", async () => {
  const initial = session("meta-close", "keyboard target", 0);
  const client = new FakeMuxstoneClient([initial]);
  const controller = await createMuxstoneController({ client, initialSessions: [initial] });
  const mount: MuxstoneAppMountRef = {};
  const { tuiOptions: _tuiOptions, ...headlessOptions } = createMuxstoneTerminalOptions(controller, mount);
  const harness = await createTestTerminalApp({ ...headlessOptions, size: { columns: 96, rows: 28 } });
  try {
    const mounted = mount.current;
    assert(mounted);
    await harness.pilot.press("c", { meta: true });
    await mounted.whenIdle();
    assertEquals(client.killed, [initial.id]);
    assertEquals(controller.runtime(initial.id), undefined);
  } finally {
    harness.destroy();
    await controller.dispose();
  }
});

Deno.test("Muxstone exposes prefix help, forwards a literal prefix, and confirms destructive kills", async () => {
  const initial = session("safe-1", "important shell", 0);
  const client = new FakeMuxstoneClient([initial]);
  const controller = await createMuxstoneController({ client, initialSessions: [initial] });
  const mount: MuxstoneAppMountRef = {};
  const { tuiOptions: _tuiOptions, ...headlessOptions } = createMuxstoneTerminalOptions(controller, mount);
  const harness = await createTestTerminalApp({
    ...headlessOptions,
    size: { columns: 80, rows: 24 },
  });

  try {
    const mounted = mount.current;
    assert(mounted);
    await mounted.whenIdle();

    await harness.pilot.press("n", { ctrl: true, buffer: new Uint8Array([14]) });
    await harness.pilot.press("?");
    await mounted.whenIdle();
    assertEquals(controller.helpVisible.peek(), true);
    assertStringIncludes(harness.pilot.snapshot(), "MUXSTONE KEY REFERENCE");
    await harness.pilot.press("escape");
    await mounted.whenIdle();
    assertEquals(controller.helpVisible.peek(), false);

    await harness.pilot.press("n", { ctrl: true, buffer: new Uint8Array([14]) });
    await harness.pilot.press("n", { ctrl: true, buffer: new Uint8Array([14]) });
    await mounted.whenIdle();
    assertEquals(client.inputs, [{ sessionId: "safe-1", data: "\x0e" }]);

    await harness.pilot.press("n", { ctrl: true, buffer: new Uint8Array([14]) });
    await harness.pilot.press("&");
    await mounted.whenIdle();
    assertEquals(controller.pendingKillSessionId.peek(), "safe-1");
    assertEquals(controller.sessions.peek().length, 1);
    assertStringIncludes(harness.pilot.snapshot(), "TERMINATE HOST SESSION?");
    await harness.pilot.press("escape");
    await mounted.whenIdle();
    assertEquals(controller.pendingKillSessionId.peek(), undefined);
    assertEquals(controller.sessions.peek().length, 1);

    await harness.pilot.press("n", { ctrl: true, buffer: new Uint8Array([14]) });
    await harness.pilot.press("&");
    await harness.pilot.press("y");
    await mounted.whenIdle();
    assertEquals(controller.sessions.peek().length, 0);
  } finally {
    harness.destroy();
    await controller.dispose();
  }
});

Deno.test("Muxstone manager reopens a detached terminal without replacing its host session", async () => {
  const initial = session("persist-1", "persistent", 0);
  const client = new FakeMuxstoneClient([initial]);
  const controller = await createMuxstoneController({ client, initialSessions: [initial] });
  const mount: MuxstoneAppMountRef = {};
  const terminalOptions = createMuxstoneTerminalOptions(controller, mount);
  const { tuiOptions: _tuiOptions, ...headlessOptions } = terminalOptions;
  const harness = await createTestTerminalApp({
    ...headlessOptions,
    size: { columns: 96, rows: 28 },
  });

  try {
    const mounted = mount.current;
    assert(mounted);
    await mounted.whenIdle();
    assertEquals(controller.runtime("persist-1")?.attached.peek(), true);

    await harness.pilot.press("n", { ctrl: true });
    await harness.pilot.press("d");
    await mounted.whenIdle();
    assertEquals(controller.runtime("persist-1")?.attached.peek(), false);
    assertEquals(client.detached, ["persist-1"]);
    assertEquals(
      controller.windowHost.controller.inspect().windows.find((window) => window.id === muxstoneWindowId("persist-1"))
        ?.state,
      "closed",
    );

    await harness.pilot.press("n", { ctrl: true });
    await harness.pilot.press("s");
    await mounted.whenIdle();
    assertEquals(controller.windowHost.controller.inspect().activeWindowId, MUXSTONE_SESSIONS_WINDOW_ID);
    const manager = mounted.windowProjection.peek().windows.find((window) => window.id === MUXSTONE_SESSIONS_WINDOW_ID);
    assert(manager);
    const click = await harness.pilot.click(manager.clientRect.column + 2, manager.clientRect.row + 3);
    assertEquals(click.press.handled, true);
    await mounted.whenIdle();

    assertEquals(controller.runtime("persist-1")?.attached.peek(), true);
    assertEquals(client.listSnapshot().map((entry) => entry.id), ["persist-1"]);
    assertEquals(
      controller.windowHost.controller.inspect().windows.find((window) => window.id === muxstoneWindowId("persist-1"))
        ?.state,
      "normal",
    );
  } finally {
    harness.destroy();
    await controller.dispose();
  }
});

Deno.test("Muxstone pipelines bounded raw batches and fences them around control operations", async () => {
  const initial = session("latency-1", "latency probe", 0);
  const client = new FakeMuxstoneClient([initial]);
  const controller = await createMuxstoneController({ client, initialSessions: [initial] });
  const mount: MuxstoneAppMountRef = {};
  const terminalOptions = createMuxstoneTerminalOptions(controller, mount);
  const { tuiOptions: _tuiOptions, ...headlessOptions } = terminalOptions;
  const harness = await createTestTerminalApp({
    ...headlessOptions,
    size: { columns: 96, rows: 28 },
  });

  try {
    const mounted = mount.current;
    assert(mounted);
    await mounted.whenIdle();
    client.delayInputAcks = true;

    const typed = "abcdefghijklmnopqrstuvwx";
    await Promise.all(([...typed] as Key[]).map((key) => harness.pilot.press(key)));
    await Promise.resolve();
    assert(client.pendingInputAckCount > 0);
    assert(client.inputs.length <= 4);

    let idleSettled = false;
    const idle = mounted.whenIdle().then(() => idleSettled = true);
    await Promise.resolve();
    assertEquals(idleSettled, false);
    await client.resolveAllInputAcks();
    await idle;
    assertEquals(client.inputs.map((input) => input.data).join(""), typed);
    assert(client.inputs.length < typed.length);

    client.inputs.splice(0);
    const themeBefore = controller.themeId.peek();
    await harness.pilot.press("q");
    await harness.pilot.press("n", { ctrl: true, buffer: new Uint8Array([14]) });
    await harness.pilot.press("t");
    await harness.pilot.press("r");
    await Promise.resolve();
    assertEquals(client.inputs.map((input) => input.data).join(""), "q");
    assertEquals(controller.themeId.peek(), themeBefore);

    client.resolveNextInputAck();
    await new Promise((resolve) => setTimeout(resolve, 0));
    assertNotEquals(controller.themeId.peek(), themeBefore);
    assertEquals(client.inputs.map((input) => input.data).join(""), "qr");
    await client.resolveAllInputAcks();
    await mounted.whenIdle();

    client.inputs.splice(0);
    await harness.pilot.press("u");
    const pointerMenu = mounted.handlePointer(mousePointer("down", 52, 0, 71));
    await harness.pilot.press("v");
    await Promise.resolve();
    // The menu press is fenced behind the outstanding ack, so nothing has opened.
    assertEquals(client.inputs.map((input) => input.data).join(""), "u");
    assertEquals(controller.globalConfigVisible.peek(), false);

    client.resolveNextInputAck();
    assertEquals(await pointerMenu, true);
    for (let attempt = 0; attempt < 16; attempt += 1) {
      if (controller.globalConfigVisible.peek()) break;
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    // "v" was queued after the menu press, so the now-open modal claims it
    // instead of the terminal - proving the control op was ordered first.
    assertEquals(controller.globalConfigVisible.peek(), true);
    assertEquals(client.inputs.map((input) => input.data).join(""), "u");
    controller.closeGlobalConfig();
    await client.resolveAllInputAcks();
    await mounted.whenIdle();

    client.inputs.splice(0);
    const protocolSizedPaste = "x".repeat(MUXSTONE_PROTOCOL_LIMITS.inputBytes * 2);
    await harness.pilot.paste(protocolSizedPaste);
    await Promise.resolve();
    assert(client.inputs.length >= 2);
    assert(
      client.inputs.every((input) =>
        new TextEncoder().encode(input.data).byteLength <= MUXSTONE_PROTOCOL_LIMITS.inputBytes
      ),
    );
    await client.resolveAllInputAcks();
    await mounted.whenIdle();

    client.inputs.splice(0);
    await harness.pilot.paste("y".repeat(MUXSTONE_PROTOCOL_LIMITS.inputBytes * 4 + 1));
    await Promise.resolve();
    assertEquals(client.inputs, []);
    assertStringIncludes(controller.status.peek(), "raw input buffer limit exceeded");
  } finally {
    client.delayInputAcks = false;
    await client.resolveAllInputAcks();
    harness.destroy();
    await controller.dispose();
  }
});

Deno.test("Muxstone coalesces printable keys classified behind a control barrier", async () => {
  const initial = session("barrier-latency", "barrier latency", 0);
  const client = new FakeMuxstoneClient([initial]);
  const controller = await createMuxstoneController({ client, initialSessions: [initial] });
  const mount: MuxstoneAppMountRef = {};
  const { tuiOptions: _tuiOptions, ...headlessOptions } = createMuxstoneTerminalOptions(controller, mount);
  const harness = await createTestTerminalApp({ ...headlessOptions, size: { columns: 96, rows: 28 } });

  try {
    const mounted = mount.current;
    assert(mounted);
    await mounted.whenIdle();
    client.delayInputAcks = true;

    await harness.pilot.press("q");
    await Promise.resolve();
    assertEquals(client.inputs.map((input) => input.data).join(""), "q");
    assertEquals(client.pendingInputAckCount, 1);

    await harness.pilot.press("n", { ctrl: true, buffer: new Uint8Array([14]) });
    await harness.pilot.press("t");
    const suffix = "abcdefghijklmnopqrstuvwx";
    await Promise.all(([...suffix] as Key[]).map((key) => harness.pilot.press(key)));
    assertEquals(client.inputs.map((input) => input.data).join(""), "q");

    client.resolveNextInputAck();
    for (let attempt = 0; attempt < 16; attempt += 1) {
      if (client.inputs.map((input) => input.data).join("") === `q${suffix}`) break;
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    assertEquals(client.inputs.map((input) => input.data).join(""), `q${suffix}`);
    assertEquals(client.inputs.length, 2);
    assertEquals(client.pendingInputAckCount, 1);

    await client.resolveAllInputAcks();
    await mounted.whenIdle();
  } finally {
    client.delayInputAcks = false;
    await client.resolveAllInputAcks();
    harness.destroy();
    await controller.dispose();
  }
});

Deno.test("Muxstone bounds classified keys retained behind a stalled barrier", async () => {
  const initial = session("bounded-classifier", "bounded classifier", 0);
  const client = new FakeMuxstoneClient([initial]);
  const controller = await createMuxstoneController({ client, initialSessions: [initial] });
  const mount: MuxstoneAppMountRef = {};
  const { tuiOptions: _tuiOptions, ...headlessOptions } = createMuxstoneTerminalOptions(controller, mount);
  const harness = await createTestTerminalApp({ ...headlessOptions, size: { columns: 96, rows: 28 } });

  let releaseBarrier!: () => void;
  const barrierGate = new Promise<void>((resolve) => releaseBarrier = resolve);
  try {
    const mounted = mount.current;
    assert(mounted);
    await mounted.whenIdle();
    const barrier = mounted.enqueue(() => barrierGate);

    for (let index = 0; index < 5_000; index += 1) {
      harness.app.tui.emit(
        "keyPress",
        createTestKeyPress("a", { buffer: new Uint8Array(["a".charCodeAt(0)]) }),
      );
    }
    assertEquals(client.inputs, []);
    assertStringIncludes(controller.status.peek(), "raw input buffer limit exceeded");

    releaseBarrier();
    await barrier;
    await mounted.whenIdle();
    const forwarded = client.inputs.map((input) => input.data).join("");
    assert(forwarded.length > 0);
    assert(forwarded.length < 5_000);
  } finally {
    releaseBarrier();
    harness.destroy();
    await controller.dispose();
  }
});

Deno.test("Muxstone snapshots reused key events before asynchronous prefix routing", async () => {
  const initial = session("reused-key", "reused key", 0);
  const client = new FakeMuxstoneClient([initial]);
  const controller = await createMuxstoneController({ client, initialSessions: [initial] });
  const mount: MuxstoneAppMountRef = {};
  const { tuiOptions: _tuiOptions, ...headlessOptions } = createMuxstoneTerminalOptions(controller, mount);
  const harness = await createTestTerminalApp({ ...headlessOptions, size: { columns: 96, rows: 28 } });

  try {
    const mounted = mount.current;
    assert(mounted);
    await mounted.whenIdle();
    controller.windowHost.execute(
      { kind: "close", id: MUXSTONE_SESSIONS_WINDOW_ID },
      mounted.bodyRect.peek(),
    );
    controller.windowHost.execute(
      { kind: "focus", id: muxstoneWindowId(initial.id) },
      mounted.bodyRect.peek(),
    );

    const source = new Uint8Array([14, ...new TextEncoder().encode("ca")]);
    for (const event of decodeBuffer(source)) {
      if (event.key !== "mouse" && event.key !== "paste" && event.key !== "focus") {
        harness.app.tui.emit("keyPress", event);
      }
    }
    source.fill("z".charCodeAt(0));
    await mounted.whenIdle();

    assertEquals(client.spawned.length, 1);
    assertEquals(client.inputs, [{ sessionId: "spawned-1", data: "a" }]);
  } finally {
    harness.destroy();
    await controller.dispose();
  }
});

Deno.test("Muxstone repaints Workbench light/dark themes and the six-family T2 theme", async () => {
  const initial = session("theme-render", "theme renderer", 0);
  const client = new FakeMuxstoneClient([initial]);
  const controller = await createMuxstoneController({ client, initialSessions: [initial] });
  const mount: MuxstoneAppMountRef = {};
  const { tuiOptions: _tuiOptions, ...headlessOptions } = createMuxstoneTerminalOptions(controller, mount);
  const harness = await createTestTerminalApp({
    ...headlessOptions,
    size: { columns: 112, rows: 30 },
  });

  try {
    const mounted = mount.current;
    assert(mounted);
    await mounted.whenIdle();

    const initialTheme = controller.themeId.peek();
    assertEquals((await harness.pilot.click(52, 0)).press.handled, true);
    await mounted.whenIdle();
    assertEquals(controller.globalConfigVisible.peek(), true);
    // Pick a different theme straight off the select list.
    const themePick = MUXSTONE_THEMES.findIndex((entry) => entry.id !== initialTheme);
    const themeLayout = muxstoneGlobalConfigLayout(
      mounted.windowProjection.peek().bounds,
      Math.max(0, MUXSTONE_THEMES.findIndex((entry) => entry.id === initialTheme)),
      0,
    );
    const themeRow = themeLayout.themeRows.find((entry) => entry.index === themePick)!;
    assertEquals((await harness.pilot.click(themeRow.rect.column + 2, themeRow.rect.row)).press.handled, true);
    await mounted.whenIdle();
    assertEquals(controller.themeId.peek(), MUXSTONE_THEMES[themePick]!.id);
    assertNotEquals(controller.themeId.peek(), initialTheme);
    controller.closeGlobalConfig();
    await mounted.whenIdle();

    for (const themeId of ["unit01", "parchment", "t2"] as const) {
      cycleToTheme(controller, themeId);
      await harness.pilot.settle();
      const theme = muxstoneTheme(themeId);
      const brandCell = canvasCell(harness.canvas.frameBuffer[0]?.[0]);
      assertStringIncludes(
        brandCell,
        `38;2;${theme.background.join(";")};48;2;${theme.accent.join(";")}`,
      );
      const headerCell = canvasCell(harness.canvas.frameBuffer[0]?.[10]);
      assertStringIncludes(
        headerCell,
        `38;2;${theme.text.join(";")};48;2;${theme.surfaceStrong.join(";")}`,
      );
    }
  } finally {
    harness.destroy();
    await controller.dispose();
  }
});

Deno.test("Muxstone mouse menus, modal buttons, floating chrome, shelf, and tiled separators work", async () => {
  const initial = session("mouse-one", "mouse one", 0);
  const client = new FakeMuxstoneClient([initial]);
  const controller = await createMuxstoneController({ client, initialSessions: [initial] });
  const mount: MuxstoneAppMountRef = {};
  const { tuiOptions: _tuiOptions, ...headlessOptions } = createMuxstoneTerminalOptions(controller, mount);
  const harness = await createTestTerminalApp({
    ...headlessOptions,
    size: { columns: 112, rows: 32 },
  });

  try {
    const mounted = mount.current;
    assert(mounted);
    await mounted.whenIdle();

    assertEquals((await harness.pilot.click(13, 0)).press.handled, true);
    await mounted.whenIdle();
    assertEquals(controller.sessions.peek().length, 2);
    const spawned = controller.sessions.peek().find((entry) => entry.id !== initial.id)!;

    // Background now lives in the global config modal's select list.
    const backgroundBefore = controller.backgroundId.peek();
    assertEquals((await harness.pilot.click(52, 0)).press.handled, true);
    await mounted.whenIdle();
    assertEquals(controller.globalConfigVisible.peek(), true);
    const backgroundPick = MUXSTONE_BACKGROUND_IDS.findIndex((id) => id !== backgroundBefore);
    const backgroundLayout = muxstoneGlobalConfigLayout(
      mounted.windowProjection.peek().bounds,
      0,
      Math.max(0, MUXSTONE_BACKGROUND_IDS.indexOf(backgroundBefore)),
    );
    const backgroundRow = backgroundLayout.backgroundRows.find((entry) => entry.index === backgroundPick)!;
    assertEquals(
      (await harness.pilot.click(backgroundRow.rect.column + 2, backgroundRow.rect.row)).press.handled,
      true,
    );
    await mounted.whenIdle();
    assertEquals(controller.backgroundId.peek(), MUXSTONE_BACKGROUND_IDS[backgroundPick]!);
    assertNotEquals(controller.backgroundId.peek(), backgroundBefore);
    assertEquals(
      (await harness.pilot.click(backgroundLayout.closeRect.column + 1, backgroundLayout.closeRect.row)).press.handled,
      true,
    );
    await mounted.whenIdle();
    assertEquals(controller.globalConfigVisible.peek(), false);

    assertEquals((await harness.pilot.click(65, 0)).press.handled, true);
    await mounted.whenIdle();
    assertEquals(controller.helpVisible.peek(), true);
    const blockedTheme = controller.themeId.peek();
    assertEquals((await harness.pilot.click(38, 0)).press.targetId, "muxstone-modal");
    await mounted.whenIdle();
    assertEquals(controller.themeId.peek(), blockedTheme);
    const helpClose = helpClosePoint(mounted.windowProjection.peek().bounds);
    assertEquals((await harness.pilot.click(helpClose.column, helpClose.row)).press.handled, true);
    await mounted.whenIdle();
    assertEquals(controller.helpVisible.peek(), false);

    controller.requestKillSession(initial.id);
    const killButtons = killButtonPoints(mounted.windowProjection.peek().bounds);
    assertEquals((await harness.pilot.click(killButtons.cancel.column, killButtons.cancel.row)).press.handled, true);
    await mounted.whenIdle();
    assertEquals(controller.pendingKillSessionId.peek(), undefined);
    assertEquals(controller.sessions.peek().length, 2);
    controller.requestKillSession(initial.id);
    assertEquals((await harness.pilot.click(killButtons.confirm.column, killButtons.confirm.row)).press.handled, true);
    await mounted.whenIdle();
    assertEquals(controller.sessions.peek().map((entry) => entry.id), [spawned.id]);

    controller.windowHost.execute({ kind: "close", id: MUXSTONE_SESSIONS_WINDOW_ID }, mounted.bodyRect.peek());
    controller.windowHost.execute(
      {
        kind: "set-placement",
        id: muxstoneWindowId(spawned.id),
        placement: "floating",
        rect: { column: 48, row: 5, width: 40, height: 14 },
      },
      mounted.bodyRect.peek(),
    );
    controller.windowHost.execute({ kind: "focus", id: muxstoneWindowId(spawned.id) }, mounted.bodyRect.peek());
    await harness.pilot.settle();
    let floating = mounted.windowProjection.peek().floatingWindows.find((window) =>
      window.id === muxstoneWindowId(spawned.id)
    );
    assert(floating);
    const minimize = floating.controls.find((control) => control.kind === "minimize");
    assert(minimize);
    assertEquals(
      (await harness.pilot.click(
        minimize.hitRect.column + Math.floor(minimize.hitRect.width / 2),
        minimize.hitRect.row + Math.floor(minimize.hitRect.height / 2),
      )).press.handled,
      true,
    );
    await mounted.whenIdle();
    const terminalButton = projectMuxstoneTerminalBar(
      controller,
      mounted.windowProjection.peek(),
      mounted.shelfBounds.peek(),
    ).commands.find((command) =>
      command.item.action.kind === "session" && command.item.action.sessionId === spawned.id
    );
    assert(terminalButton);
    assertEquals(
      (await harness.pilot.click(
        terminalButton.hitRect.column + Math.floor(terminalButton.hitRect.width / 2),
        terminalButton.hitRect.row,
      )).press.handled,
      true,
    );
    await mounted.whenIdle();

    floating = mounted.windowProjection.peek().floatingWindows.find((window) =>
      window.id === muxstoneWindowId(spawned.id)
    );
    assert(floating);
    const beforeResize = { ...floating.rect };
    const resizeX = floating.rect.column + floating.rect.width - 1;
    const resizeY = floating.rect.row + floating.rect.height - 1;
    assertEquals(
      (await harness.app.mouse.dispatch(createTestMousePress({ x: resizeX, y: resizeY }))).handled,
      true,
    );
    assertEquals(
      (await harness.app.mouse.dispatch(createTestMousePress({
        x: resizeX + 4,
        y: resizeY + 2,
        drag: true,
        movementX: 4,
        movementY: 2,
      }))).handled,
      true,
    );
    assertEquals(
      (await harness.app.mouse.dispatch(createTestMousePress({
        x: resizeX + 4,
        y: resizeY + 2,
        release: true,
        button: undefined,
      }))).handled,
      true,
    );
    await mounted.whenIdle();
    floating = mounted.windowProjection.peek().floatingWindows.find((window) =>
      window.id === muxstoneWindowId(spawned.id)
    );
    assert(floating);
    assertNotEquals(floating.rect.width, beforeResize.width);
    assertNotEquals(floating.rect.height, beforeResize.height);

    controller.windowHost.execute(
      { kind: "set-placement", id: muxstoneWindowId(spawned.id), placement: "tiled" },
      mounted.bodyRect.peek(),
    );
    controller.windowHost.execute(
      { kind: "maximize", id: muxstoneWindowId(spawned.id) },
      mounted.bodyRect.peek(),
    );
    await harness.pilot.settle();
    const fullscreen = mounted.windowProjection.peek().tiledWindows.find((window) =>
      window.id === muxstoneWindowId(spawned.id)
    );
    const restore = fullscreen?.controls.find((control) => control.kind === "restore");
    assert(restore);
    assertEquals(
      (await harness.pilot.click(
        restore.hitRect.column + Math.floor(restore.hitRect.width / 2),
        restore.hitRect.row,
      )).press.handled,
      true,
    );
    await mounted.whenIdle();
    const poppedOut = controller.windowHost.controller.inspect().windows.find((window) =>
      window.id === muxstoneWindowId(spawned.id)
    );
    assertEquals(poppedOut?.state, "normal");
    assertEquals(poppedOut?.placement, "floating");
    controller.windowHost.execute(
      { kind: "set-placement", id: muxstoneWindowId(spawned.id), placement: "tiled" },
      mounted.bodyRect.peek(),
    );
    await controller.spawn({ bounds: mounted.bodyRect.peek(), dock: "right" });
    await harness.pilot.settle();
    const separator = mounted.windowProjection.peek().separators[0];
    assert(separator);
    const separatorX = separator.rect.column + Math.floor(separator.rect.width / 2);
    const separatorY = separator.rect.row + Math.floor(separator.rect.height / 2);
    const beforeRatio = separator.ratio;
    const deltaX = separator.axis === "column" ? 4 : 0;
    const deltaY = separator.axis === "row" ? 3 : 0;
    await harness.app.mouse.dispatch(createTestMousePress({ x: separatorX, y: separatorY }));
    await harness.app.mouse.dispatch(createTestMousePress({
      x: separatorX + deltaX,
      y: separatorY + deltaY,
      drag: true,
      movementX: deltaX,
      movementY: deltaY,
    }));
    await harness.app.mouse.dispatch(createTestMousePress({
      x: separatorX + deltaX,
      y: separatorY + deltaY,
      release: true,
      button: undefined,
    }));
    await mounted.whenIdle();
    assertNotEquals(mounted.windowProjection.peek().separators[0]?.ratio, beforeRatio);
  } finally {
    harness.destroy();
    await controller.dispose();
  }
});

Deno.test("Muxstone terminal bar raises every open terminal, protects floating paint, and collapses for touch", async () => {
  const initialSessions = [
    session("bar-one", "bash", 0),
    session("bar-two", "vim", 0),
    session("bar-three", "asciichurn", 0),
  ];
  const client = new FakeMuxstoneClient(initialSessions);
  const controller = await createMuxstoneController({ client, initialSessions });
  const mount: MuxstoneAppMountRef = {};
  const { tuiOptions: _tuiOptions, ...headlessOptions } = createMuxstoneTerminalOptions(controller, mount);
  const harness = await createTestTerminalApp({
    ...headlessOptions,
    size: { columns: 120, rows: 32 },
  });

  try {
    const mounted = mount.current;
    assert(mounted);
    await mounted.whenIdle();
    const bounds = mounted.bodyRect.peek();
    controller.windowHost.execute({ kind: "close", id: MUXSTONE_SESSIONS_WINDOW_ID }, bounds);
    for (const [index, entry] of initialSessions.slice(0, 2).entries()) {
      controller.windowHost.execute({
        kind: "set-placement",
        id: muxstoneWindowId(entry.id),
        placement: "floating",
        rect: { column: 22 + index * 3, row: 6 + index, width: 48, height: 16 },
      }, bounds);
    }
    controller.windowHost.execute({ kind: "minimize", id: muxstoneWindowId("bar-three") }, bounds);
    await harness.pilot.settle();

    let bar = projectMuxstoneTerminalBar(
      controller,
      mounted.windowProjection.peek(),
      mounted.shelfBounds.peek(),
    );
    assertEquals(bar.collapsed, false);
    assertEquals(
      bar.commands.flatMap((command) => command.item.action.kind === "session" ? [command.item.action.sessionId] : [])
        .sort(),
      initialSessions.map((entry) => entry.id).sort(),
    );
    const firstButton = bar.commands.find((command) =>
      command.item.action.kind === "session" && command.item.action.sessionId === "bar-one"
    );
    assert(firstButton);
    await harness.pilot.click(
      firstButton.hitRect.column + Math.floor(firstButton.hitRect.width / 2),
      firstButton.hitRect.row,
    );
    await mounted.whenIdle();
    assertEquals(
      mounted.windowProjection.peek().floatingWindows.at(-1)?.id,
      muxstoneWindowId("bar-one"),
    );

    for (const entry of initialSessions.slice(0, 2)) {
      controller.windowHost.execute({
        kind: "set-placement",
        id: muxstoneWindowId(entry.id),
        placement: "tiled",
      }, bounds);
    }
    controller.windowHost.execute({ kind: "restore", id: muxstoneWindowId("bar-three") }, bounds);
    controller.windowHost.execute({
      kind: "set-placement",
      id: muxstoneWindowId("bar-three"),
      placement: "floating",
    }, bounds);
    let separator = mounted.windowProjection.peek().separators[0];
    assert(separator);
    let overlapColumn = separator.rect.column + Math.floor(separator.rect.width / 2);
    let overlapRow = separator.rect.row + Math.floor(separator.rect.height / 2);
    controller.windowHost.execute({
      kind: "set-placement",
      id: muxstoneWindowId("bar-three"),
      placement: "floating",
      rect: {
        column: overlapColumn - 4,
        row: overlapRow - 2,
        width: 28,
        height: 10,
      },
    }, bounds);
    await harness.pilot.settle();
    separator = mounted.windowProjection.peek().separators[0];
    assert(separator);
    overlapColumn = separator.rect.column + Math.floor(separator.rect.width / 2);
    overlapRow = separator.rect.row + Math.floor(separator.rect.height / 2);
    const crossingWindow = mounted.windowProjection.peek().floatingWindows.find((window) =>
      window.id === muxstoneWindowId("bar-three")
    );
    assert(crossingWindow);
    assert(
      overlapColumn >= crossingWindow.clientRect.column &&
        overlapColumn < crossingWindow.clientRect.column + crossingWindow.clientRect.width &&
        overlapRow >= crossingWindow.clientRect.row &&
        overlapRow < crossingWindow.clientRect.row + crossingWindow.clientRect.height,
    );
    const crossingCell = canvasCell(harness.canvas.frameBuffer[overlapRow]?.[overlapColumn]);
    assertStringIncludes(crossingCell, `48;2;${controller.theme.peek().surface.join(";")}`);

    controller.windowHost.execute({ kind: "minimize", id: muxstoneWindowId("bar-three") }, bounds);
    controller.windowHost.execute({ kind: "maximize", id: muxstoneWindowId("bar-one") }, bounds);
    await harness.pilot.settle();
    bar = projectMuxstoneTerminalBar(
      controller,
      mounted.windowProjection.peek(),
      mounted.shelfBounds.peek(),
    );
    const secondButton = bar.commands.find((command) =>
      command.item.action.kind === "session" && command.item.action.sessionId === "bar-two"
    );
    assert(secondButton);
    await harness.pilot.click(
      secondButton.hitRect.column + Math.floor(secondButton.hitRect.width / 2),
      secondButton.hitRect.row,
    );
    await mounted.whenIdle();
    assertEquals(controller.windowHost.controller.inspect().maximizedWindowId, muxstoneWindowId("bar-two"));

    await harness.pilot.resize(28, 24);
    bar = projectMuxstoneTerminalBar(
      controller,
      mounted.windowProjection.peek(),
      mounted.shelfBounds.peek(),
    );
    assertEquals(bar.collapsed, true);
    assertEquals(bar.commands.length, 1);
    assertEquals(bar.commands[0]?.item.action, { kind: "sessions" });
    const selector = bar.commands[0]!;
    const touchColumn = selector.hitRect.column + Math.floor(selector.hitRect.width / 2);
    await mounted.handlePointer(touchPointer("down", touchColumn, selector.hitRect.row, 100, 77));
    await mounted.handlePointer(touchPointer("up", touchColumn, selector.hitRect.row, 101, 77));
    await mounted.whenIdle();
    const inspection = controller.windowHost.controller.inspect();
    assertEquals(inspection.maximizedWindowId, undefined);
    assertEquals(inspection.activeWindowId, MUXSTONE_SESSIONS_WINDOW_ID);
  } finally {
    harness.destroy();
    await controller.dispose();
  }
});

Deno.test("Muxstone manager wheel selection never clicks through its fixed header", async () => {
  const initialSessions = Array.from(
    { length: 20 },
    (_, index) => session(`overflow-${index}`, `session ${index}`, 0),
  );
  const client = new FakeMuxstoneClient(initialSessions);
  const controller = await createMuxstoneController({ client, initialSessions });
  const mount: MuxstoneAppMountRef = {};
  const { tuiOptions: _tuiOptions, ...headlessOptions } = createMuxstoneTerminalOptions(controller, mount);
  const harness = await createTestTerminalApp({
    ...headlessOptions,
    size: { columns: 96, rows: 24 },
  });

  try {
    const mounted = mount.current;
    assert(mounted);
    await mounted.whenIdle();
    const sessions = controller.sessions.peek();
    for (const entry of sessions) {
      controller.windowHost.execute({ kind: "minimize", id: muxstoneWindowId(entry.id) }, mounted.bodyRect.peek());
    }
    controller.windowHost.execute({ kind: "restore", id: MUXSTONE_SESSIONS_WINDOW_ID }, mounted.bodyRect.peek());
    controller.windowHost.execute({ kind: "focus", id: MUXSTONE_SESSIONS_WINDOW_ID }, mounted.bodyRect.peek());
    mounted.selectedSessionIndex.value = 12;
    await harness.pilot.settle();
    let manager = mounted.windowProjection.peek().windows.find((window) => window.id === MUXSTONE_SESSIONS_WINDOW_ID);
    assert(manager);

    const headerClick = await harness.pilot.click(manager.clientRect.column + 2, manager.clientRect.row + 1);
    assertEquals(headerClick.press.handled, true);
    await mounted.whenIdle();
    assertEquals(controller.windowHost.controller.inspect().activeWindowId, MUXSTONE_SESSIONS_WINDOW_ID);
    assertEquals(mounted.selectedSessionIndex.peek(), 12);

    assertEquals(
      (await harness.pilot.scroll(1, manager.clientRect.column + 2, manager.clientRect.row + 3)).handled,
      true,
    );
    await mounted.whenIdle();
    assertEquals(mounted.selectedSessionIndex.peek(), 15);
    manager = mounted.windowProjection.peek().windows.find((window) => window.id === MUXSTONE_SESSIONS_WINDOW_ID);
    assert(manager);
    const available = Math.max(0, manager.clientRect.height - 3);
    const offset = Math.max(0, Math.min(15 - Math.floor(available / 2), sessions.length - available));
    const targetIndex = offset + 1;
    const rowClick = await harness.pilot.click(manager.clientRect.column + 2, manager.clientRect.row + 4);
    assertEquals(rowClick.press.handled, true);
    await mounted.whenIdle();
    assertEquals(mounted.selectedSessionIndex.peek(), targetIndex);
    assertEquals(
      controller.windowHost.controller.inspect().activeWindowId,
      muxstoneWindowId(sessions[targetIndex]!.id),
    );
  } finally {
    harness.destroy();
    await controller.dispose();
  }
});

Deno.test("Muxstone wheel and touch input scroll styled history and manipulate windows", async () => {
  const initial = session("touch-shell", "touch shell", 0);
  const transcript = Array.from(
    { length: 48 },
    (_, index) => `\x1b[31mred-${String(index).padStart(2, "0")}\x1b[0m\r\n`,
  ).join("");
  const client = new FakeMuxstoneClient([initial], {
    [initial.id]: [{ sessionId: initial.id, sequence: 1, data: transcript }],
  });
  const controller = await createMuxstoneController({ client, initialSessions: [initial] });
  const mount: MuxstoneAppMountRef = {};
  const { tuiOptions: _tuiOptions, ...headlessOptions } = createMuxstoneTerminalOptions(controller, mount);
  const harness = await createTestTerminalApp({
    ...headlessOptions,
    size: { columns: 100, rows: 28 },
  });

  try {
    const mounted = mount.current;
    assert(mounted);
    await mounted.whenIdle();
    controller.windowHost.execute({ kind: "close", id: MUXSTONE_SESSIONS_WINDOW_ID }, mounted.bodyRect.peek());
    controller.windowHost.execute(
      { kind: "maximize", id: muxstoneWindowId(initial.id) },
      mounted.bodyRect.peek(),
    );
    controller.windowHost.execute({ kind: "focus", id: muxstoneWindowId(initial.id) }, mounted.bodyRect.peek());
    await harness.pilot.settle();
    const runtime = controller.runtime(initial.id)!;
    let terminal = mounted.windowProjection.peek().windows.find((window) => window.id === muxstoneWindowId(initial.id));
    assert(terminal);
    assert(runtime.scrollback.inspect().scrollbackRows > 0);

    const wheelX = terminal.clientRect.column + 2;
    const wheelY = terminal.clientRect.row + 2;
    assertEquals((await harness.pilot.scroll(-1, wheelX, wheelY)).handled, true);
    await mounted.whenIdle();
    assertEquals(runtime.scrollback.inspect().mode, "copy");
    for (let attempt = 0; attempt < 32 && runtime.scrollback.inspect().offset > 0; attempt += 1) {
      await harness.pilot.scroll(-1, wheelX, wheelY);
    }
    await mounted.whenIdle();
    assertEquals(runtime.scrollback.inspect().offset, 0);
    await harness.pilot.settle();
    const styledHistory = canvasCell(
      harness.canvas.frameBuffer[terminal.clientRect.row]?.[terminal.clientRect.column],
    );
    const theme = controller.theme.peek();
    const historyRed = muxstoneTerminalForegroundRgb(31, theme.surface, theme.text)!;
    assertStringIncludes(styledHistory, `38;2;${historyRed.join(";")}`);

    for (let attempt = 0; attempt < 32 && runtime.scrollback.inspect().mode === "copy"; attempt += 1) {
      await harness.pilot.scroll(1, wheelX, wheelY);
    }
    assertEquals(runtime.scrollback.inspect().mode, "live");

    controller.windowHost.execute(
      { kind: "restore", id: muxstoneWindowId(initial.id) },
      mounted.bodyRect.peek(),
    );
    controller.windowHost.execute(
      { kind: "set-placement", id: muxstoneWindowId(initial.id), placement: "floating" },
      mounted.bodyRect.peek(),
    );
    await harness.pilot.settle();
    terminal = mounted.windowProjection.peek().floatingWindows.find((window) =>
      window.id === muxstoneWindowId(initial.id)
    );
    assert(terminal);
    const beforeDrag = { ...terminal.rect };
    const dragX = terminal.titleBarRect.column + 2;
    const dragY = terminal.titleBarRect.row;
    await mounted.handlePointer(touchPointer("down", dragX, dragY, 1));
    await mounted.handlePointer(touchPointer("move", dragX + 5, dragY + 4, 2));
    await mounted.handlePointer(touchPointer("up", dragX + 5, dragY + 4, 3));
    terminal = mounted.windowProjection.peek().floatingWindows.find((window) =>
      window.id === muxstoneWindowId(initial.id)
    );
    assert(terminal);
    assertEquals(terminal.rect, {
      ...beforeDrag,
      column: beforeDrag.column + 5,
      row: beforeDrag.row + 4,
    });

    const beforeCancelledDrag = { ...terminal.rect };
    const cancelX = terminal.titleBarRect.column + Math.max(1, Math.floor(terminal.titleBarRect.width / 2));
    const cancelY = terminal.titleBarRect.row;
    await mounted.handlePointer(touchPointer("down", cancelX, cancelY, 4));
    await mounted.handlePointer(touchPointer("move", cancelX + 4, cancelY + 1, 5));
    await mounted.handlePointer(touchPointerWithoutCell("cancel", 6));
    terminal = mounted.windowProjection.peek().floatingWindows.find((window) =>
      window.id === muxstoneWindowId(initial.id)
    );
    assert(terminal);
    assertEquals(terminal.rect, beforeCancelledDrag);

    const beforeModalDrag = { ...terminal.rect };
    const modalDragX = terminal.titleBarRect.column + Math.max(1, Math.floor(terminal.titleBarRect.width / 2));
    const modalDragY = terminal.titleBarRect.row;
    await mounted.handlePointer(touchPointer("down", modalDragX, modalDragY, 7, 0));
    await mounted.handlePointer(touchPointer("move", modalDragX + 3, modalDragY + 1, 8, 0));
    controller.openHelp();
    await mounted.handlePointer(touchPointer("move", modalDragX + 4, modalDragY + 1, 9, 0));
    terminal = mounted.windowProjection.peek().floatingWindows.find((window) =>
      window.id === muxstoneWindowId(initial.id)
    );
    assert(terminal);
    assertEquals(terminal.rect, beforeModalDrag);
    controller.closeHelp();

    const swipeX = terminal.clientRect.column + 2;
    const swipeY = terminal.clientRect.row + 2;
    await mounted.handlePointer(touchPointer("down", swipeX, swipeY, 10));
    await mounted.handlePointer(touchPointer("move", swipeX, swipeY + 4, 11));
    await mounted.handlePointer(touchPointer("up", swipeX, swipeY + 4, 12));
    assertEquals(runtime.scrollback.inspect().mode, "copy");

    const rightClickTheme = controller.themeId.peek();
    assertEquals(await mounted.handlePointer(mousePointer("down", 38, 0, 13, 2)), false);
    assertEquals(controller.themeId.peek(), rightClickTheme);

    const beforeCancelledNew = controller.sessions.peek().length;
    await mounted.handlePointer(touchPointer("down", 13, 0, 14));
    assertEquals(controller.sessions.peek().length, beforeCancelledNew);
    await mounted.handlePointer(touchPointerWithoutCell("cancel", 15));
    assertEquals(controller.sessions.peek().length, beforeCancelledNew);
    await mounted.handlePointer(touchPointer("down", 13, 0, 16));
    await mounted.handlePointer(touchPointer("move", 18, 0, 17));
    await mounted.handlePointer(touchPointer("up", 18, 0, 18));
    assertEquals(controller.sessions.peek().length, beforeCancelledNew);

    await mounted.handlePointer(touchPointer("down", 65, 0, 19));
    assertEquals(controller.helpVisible.peek(), false);
    await mounted.handlePointer(touchPointer("up", 65, 0, 20));
    assertEquals(controller.helpVisible.peek(), true);
    const close = helpClosePoint(mounted.windowProjection.peek().bounds);
    await mounted.handlePointer(touchPointer("down", close.column, close.row, 21));
    assertEquals(controller.helpVisible.peek(), true);
    await mounted.handlePointer(touchPointer("up", close.column, close.row, 22));
    assertEquals(controller.helpVisible.peek(), false);

    const pointerSource = new FakeMuxstonePointerSource();
    const unbindPointer = bindMuxstonePointerInput(mounted, pointerSource);
    // The config menu only acts on release, and only while the source is bound.
    await pointerSource.emitPointer(touchPointer("down", 52, 0, 23));
    assertEquals(controller.globalConfigVisible.peek(), false);
    await pointerSource.emitPointer(touchPointer("up", 52, 0, 24));
    assertEquals(controller.globalConfigVisible.peek(), true);
    controller.closeGlobalConfig();
    unbindPointer();
    await pointerSource.emitPointer(touchPointer("down", 52, 0, 25));
    await pointerSource.emitPointer(touchPointer("up", 52, 0, 26));
    assertEquals(controller.globalConfigVisible.peek(), false);

    controller.openHelp();
    const orderedClose = helpClosePoint(mounted.windowProjection.peek().bounds);
    let releaseBarrier!: () => void;
    let markBarrierStarted!: () => void;
    const barrierStarted = new Promise<void>((resolve) => markBarrierStarted = resolve);
    const barrier = mounted.enqueue(() => {
      markBarrierStarted();
      return new Promise<void>((resolve) => releaseBarrier = resolve);
    });
    await barrierStarted;
    const closeDown = mounted.handlePointer(touchPointer("down", orderedClose.column, orderedClose.row, 27, 70));
    const closeUp = mounted.handlePointer(touchPointer("up", orderedClose.column, orderedClose.row, 28, 70));
    const configDown = mounted.handlePointer(touchPointer("down", 52, 0, 29, 71));
    const configUp = mounted.handlePointer(touchPointer("up", 52, 0, 30, 71));
    releaseBarrier();
    await Promise.all([barrier, closeDown, closeUp, configDown, configUp]);
    // Help closed first, then the config menu opened - both behind one barrier.
    assertEquals(controller.helpVisible.peek(), false);
    assertEquals(controller.globalConfigVisible.peek(), true);
    controller.closeGlobalConfig();

    controller.requestKillSession(initial.id);
    const kill = killButtonPoints(mounted.windowProjection.peek().bounds);
    await mounted.handlePointer(touchPointer("down", kill.confirm.column, kill.confirm.row, 31));
    assertEquals(controller.sessions.peek().length, 1);
    await mounted.handlePointer(touchPointerWithoutCell("cancel", 32));
    assertEquals(controller.sessions.peek().length, 1);
    controller.cancelKillSession();

    client.delayInputAcks = true;
    await harness.pilot.press("q");
    await Promise.resolve();
    assert(client.pendingInputAckCount > 0);
    const beforeCoalescedSwipe = controller.sessions.peek().length;
    const down = mounted.handlePointer(touchPointer("down", 13, 0, 33, 61));
    const away = mounted.handlePointer(touchPointer("move", 30, 0, 34, 61));
    const back = mounted.handlePointer(touchPointer("move", 13, 0, 35, 61));
    const up = mounted.handlePointer(touchPointer("up", 13, 0, 36, 61));
    await client.resolveAllInputAcks();
    await Promise.all([down, away, back, up]);
    await mounted.whenIdle();
    assertEquals(controller.sessions.peek().length, beforeCoalescedSwipe);
    client.delayInputAcks = false;
  } finally {
    client.delayInputAcks = false;
    await client.resolveAllInputAcks();
    harness.destroy();
    await controller.dispose();
  }
});

Deno.test("Muxstone classifies queued keys against the modal state in arrival order", async () => {
  const initial = session("ordered-keys", "ordered keys", 0);
  const client = new FakeMuxstoneClient([initial]);
  const controller = await createMuxstoneController({ client, initialSessions: [initial] });
  const mount: MuxstoneAppMountRef = {};
  const { tuiOptions: _tuiOptions, ...headlessOptions } = createMuxstoneTerminalOptions(controller, mount);
  const harness = await createTestTerminalApp({
    ...headlessOptions,
    size: { columns: 90, rows: 28 },
  });

  try {
    const mounted = mount.current;
    assert(mounted);
    await mounted.whenIdle();
    const terminalWindowId = muxstoneWindowId(initial.id);
    controller.windowHost.execute(
      { kind: "close", id: MUXSTONE_SESSIONS_WINDOW_ID },
      mounted.bodyRect.peek(),
    );
    controller.windowHost.execute({ kind: "focus", id: terminalWindowId }, mounted.bodyRect.peek());

    harness.app.tui.emit(
      "keyPress",
      createTestKeyPress("n", {
        ctrl: true,
        buffer: new Uint8Array([14]),
      }),
    );
    harness.app.tui.emit(
      "keyPress",
      createTestKeyPress("?", {
        buffer: new TextEncoder().encode("?"),
      }),
    );
    harness.app.tui.emit(
      "keyPress",
      createTestKeyPress("m", {
        meta: true,
        buffer: new TextEncoder().encode("m"),
      }),
    );
    await mounted.whenIdle();

    assertEquals(controller.helpVisible.peek(), true);
    assertEquals(
      mounted.windowProjection.peek().shelf.some((item) => item.id === terminalWindowId),
      false,
    );
    assertEquals(client.inputs, []);

    harness.app.tui.emit("keyPress", createTestKeyPress("escape"));
    harness.app.tui.emit(
      "keyPress",
      createTestKeyPress("a", {
        buffer: new TextEncoder().encode("a"),
      }),
    );
    await mounted.whenIdle();

    assertEquals(controller.helpVisible.peek(), false);
    assertEquals(client.inputs, [{ sessionId: initial.id, data: "a" }]);

    controller.openHelp();
    harness.app.tui.emit("keyPress", createTestKeyPress("escape"));
    harness.app.tui.emit("paste", {
      key: "paste",
      text: "ordered paste",
      buffer: new TextEncoder().encode("ordered paste"),
    });
    await mounted.whenIdle();
    assertEquals(controller.helpVisible.peek(), false);
    assertEquals(client.inputs.at(-1), { sessionId: initial.id, data: "ordered paste" });

    const largePrefixPaste = {
      key: "paste" as const,
      text: "p".repeat(MUXSTONE_PROTOCOL_LIMITS.inputBytes * 2),
      buffer: new Uint8Array(),
    };
    largePrefixPaste.buffer = new TextEncoder().encode(largePrefixPaste.text);
    const prefixPasteStart = client.inputs.length;
    harness.app.tui.emit(
      "keyPress",
      createTestKeyPress("n", {
        ctrl: true,
        buffer: new Uint8Array([14]),
      }),
    );
    harness.app.tui.emit("paste", largePrefixPaste);
    await mounted.whenIdle();
    assertEquals(controller.prefixPending.peek(), false);
    const prefixPasteChunks = client.inputs.slice(prefixPasteStart);
    assert(prefixPasteChunks.length >= 2);
    assert(
      prefixPasteChunks.every((input) =>
        new TextEncoder().encode(input.data).byteLength <= MUXSTONE_PROTOCOL_LIMITS.inputBytes
      ),
    );
    assertEquals(
      prefixPasteChunks.map((input) => input.data).join(""),
      new TextDecoder().decode(encodeTerminalPaste(largePrefixPaste)),
    );

    const oversizedPaste = {
      key: "paste" as const,
      text: "z".repeat(MUXSTONE_PROTOCOL_LIMITS.inputBytes * 4 + 1),
      buffer: new Uint8Array(),
    };
    oversizedPaste.buffer = new TextEncoder().encode(oversizedPaste.text);
    const inputCountBeforeOversizedPaste = client.inputs.length;
    harness.app.tui.emit(
      "keyPress",
      createTestKeyPress("n", {
        ctrl: true,
        buffer: new Uint8Array([14]),
      }),
    );
    harness.app.tui.emit("paste", oversizedPaste);
    await mounted.whenIdle();
    assertEquals(controller.prefixPending.peek(), false);
    assertEquals(client.inputs.length, inputCountBeforeOversizedPaste);
    assertStringIncludes(controller.status.peek(), "raw input buffer limit exceeded");

    const inputCountBeforeModalPaste = client.inputs.length;
    harness.app.tui.emit(
      "keyPress",
      createTestKeyPress("n", {
        ctrl: true,
        buffer: new Uint8Array([14]),
      }),
    );
    harness.app.tui.emit(
      "keyPress",
      createTestKeyPress("?", {
        buffer: new TextEncoder().encode("?"),
      }),
    );
    harness.app.tui.emit("paste", {
      key: "paste",
      text: "blocked by help",
      buffer: new TextEncoder().encode("blocked by help"),
    });
    await mounted.whenIdle();
    assertEquals(controller.helpVisible.peek(), true);
    assertEquals(client.inputs.length, inputCountBeforeModalPaste);
  } finally {
    harness.destroy();
    await controller.dispose();
  }
});

Deno.test("Muxstone coalesced pointer callers share completion and disposal settles pending work", async () => {
  const initial = session("pointer-lifecycle", "pointer lifecycle", 0);
  const client = new FakeMuxstoneClient([initial]);
  const controller = await createMuxstoneController({ client, initialSessions: [initial] });
  const mount: MuxstoneAppMountRef = {};
  const { tuiOptions: _tuiOptions, ...headlessOptions } = createMuxstoneTerminalOptions(controller, mount);
  const harness = await createTestTerminalApp({
    ...headlessOptions,
    size: { columns: 80, rows: 24 },
  });

  try {
    const mounted = mount.current;
    assert(mounted);
    await mounted.whenIdle();

    let releaseFirstBarrier!: () => void;
    let markFirstBarrierStarted!: () => void;
    const firstBarrierStarted = new Promise<void>((resolve) => markFirstBarrierStarted = resolve);
    const firstBarrier = mounted.enqueue(() => {
      markFirstBarrierStarted();
      return new Promise<void>((resolve) => releaseFirstBarrier = resolve);
    });
    await firstBarrierStarted;
    const firstMove = mounted.handlePointer(touchPointer("move", 0, 0, 1, 90));
    const coalescedMove = mounted.handlePointer(touchPointer("move", 1, 0, 2, 90));
    assert(firstMove === coalescedMove);
    releaseFirstBarrier();
    await firstBarrier;
    assertEquals(await firstMove, false);
    assertEquals(await coalescedMove, false);

    let releaseDisposeBarrier!: () => void;
    let markDisposeBarrierStarted!: () => void;
    const disposeBarrierStarted = new Promise<void>((resolve) => markDisposeBarrierStarted = resolve);
    const disposeBarrier = mounted.enqueue(() => {
      markDisposeBarrierStarted();
      return new Promise<void>((resolve) => releaseDisposeBarrier = resolve);
    });
    await disposeBarrierStarted;
    const pendingMove = mounted.handlePointer(touchPointer("move", 0, 0, 3, 91));
    mounted.dispose();
    releaseDisposeBarrier();
    await disposeBarrier;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    const outcome = await Promise.race([
      pendingMove,
      new Promise<"timeout">((resolve) => timeoutId = setTimeout(() => resolve("timeout"), 100)),
    ]);
    if (timeoutId !== undefined) clearTimeout(timeoutId);
    assertEquals(outcome, false);
  } finally {
    harness.destroy();
    await controller.dispose();
  }
});

Deno.test("Muxstone translates wheel into cursor keys for alternate-screen apps without mouse tracking", async () => {
  const initial = session("alt-screen", "alt screen", 0);
  const client = new FakeMuxstoneClient([initial]);
  const controller = await createMuxstoneController({ client, initialSessions: [initial] });
  const mount: MuxstoneAppMountRef = {};
  const { tuiOptions: _tuiOptions, ...headlessOptions } = createMuxstoneTerminalOptions(controller, mount);
  const harness = await createTestTerminalApp({ ...headlessOptions, size: { columns: 100, rows: 28 } });

  try {
    const mounted = mount.current;
    assert(mounted);
    await mounted.whenIdle();
    controller.windowHost.execute({ kind: "close", id: MUXSTONE_SESSIONS_WINDOW_ID }, mounted.bodyRect.peek());
    controller.windowHost.execute({ kind: "focus", id: muxstoneWindowId(initial.id) }, mounted.bodyRect.peek());
    await harness.pilot.settle();
    const runtime = controller.runtime(initial.id)!;
    client.emitOutput({ sessionId: initial.id, sequence: 1, data: "\x1b[?1049h" });
    await waitForCondition(() => runtime.screen.inspect().alternate, 2_000);

    const terminal = mounted.windowProjection.peek().windows.find(
      (window) => window.id === muxstoneWindowId(initial.id),
    );
    assert(terminal);
    const wheelX = terminal.clientRect.column + 2;
    const wheelY = terminal.clientRect.row + 2;
    assertEquals((await harness.pilot.scroll(-1, wheelX, wheelY)).handled, true);
    await mounted.whenIdle();
    assertEquals(runtime.scrollback.inspect().mode, "live");
    assertEquals(client.inputs, [{ sessionId: initial.id, data: "\x1b[A".repeat(3) }]);

    client.inputs.length = 0;
    client.emitOutput({ sessionId: initial.id, sequence: 2, data: "\x1b[?1h" });
    await waitForCondition(() => runtime.screen.inspect().privateModes.includes(1), 2_000);
    assertEquals((await harness.pilot.scroll(1, wheelX, wheelY)).handled, true);
    await mounted.whenIdle();
    assertEquals(runtime.scrollback.inspect().mode, "live");
    assertEquals(client.inputs, [{ sessionId: initial.id, data: "\x1bOB".repeat(3) }]);
  } finally {
    harness.destroy();
    await controller.dispose();
  }
});

Deno.test("Muxstone quit control cancels, detaches, and terminates from the end-session modal", async () => {
  const initial = session("quit-shell", "quit shell", 0);
  const client = new FakeMuxstoneClient([initial]);
  const controller = await createMuxstoneController({ client, initialSessions: [initial] });
  const mount: MuxstoneAppMountRef = {};
  const { tuiOptions: _tuiOptions, ...headlessOptions } = createMuxstoneTerminalOptions(controller, mount);
  const harness = await createTestTerminalApp({ ...headlessOptions, size: { columns: 100, rows: 28 } });

  try {
    const mounted = mount.current;
    assert(mounted);
    await mounted.whenIdle();
    const bounds = harness.app.tui.rectangle.peek();
    const quitX = bounds.column + bounds.width - 3;

    assertEquals((await harness.pilot.click(quitX, 0)).press.handled, true);
    await mounted.whenIdle();
    assertEquals(controller.quitModalVisible.peek(), true);
    await harness.pilot.press("escape");
    await mounted.whenIdle();
    assertEquals(controller.quitModalVisible.peek(), false);

    let destroyed = false;
    harness.app.tui.on("destroy", () => {
      destroyed = true;
    });
    assertEquals((await harness.pilot.click(quitX, 0)).press.handled, true);
    await mounted.whenIdle();
    const layout = muxstoneQuitLayout(mounted.windowProjection.peek().bounds);
    assertEquals(
      (await harness.pilot.click(layout.detachRect.column + 1, layout.detachRect.row)).press.handled,
      true,
    );
    await waitForCondition(() => destroyed, 2_000);
    assertEquals(client.shutdownCalls, 0);
    assertEquals(controller.quitModalVisible.peek(), false);
  } finally {
    harness.destroy();
    await controller.dispose();
  }
});

Deno.test("Muxstone quit modal terminate shuts down the detached host before exiting", async () => {
  const initial = session("terminate-shell", "terminate shell", 0);
  const client = new FakeMuxstoneClient([initial]);
  const controller = await createMuxstoneController({ client, initialSessions: [initial] });
  const mount: MuxstoneAppMountRef = {};
  const { tuiOptions: _tuiOptions, ...headlessOptions } = createMuxstoneTerminalOptions(controller, mount);
  const harness = await createTestTerminalApp({ ...headlessOptions, size: { columns: 100, rows: 28 } });

  try {
    const mounted = mount.current;
    assert(mounted);
    await mounted.whenIdle();
    let destroyed = false;
    harness.app.tui.on("destroy", () => {
      destroyed = true;
    });
    const bounds = harness.app.tui.rectangle.peek();
    assertEquals((await harness.pilot.click(bounds.column + bounds.width - 3, 0)).press.handled, true);
    await mounted.whenIdle();
    assertEquals(controller.quitModalVisible.peek(), true);
    await harness.pilot.press("t");
    await waitForCondition(() => destroyed && client.shutdownCalls === 1, 2_000);
  } finally {
    harness.destroy();
    await controller.dispose();
  }
});

Deno.test("Muxstone network panel lists hosts and tailnet devices, opens SSH, and forgets hosts", async () => {
  const initial = session("net-shell", "net shell", 0);
  const client = new FakeMuxstoneClient([initial]);
  const tailnetResult: TailnetStatusResult = {
    availability: "available",
    detail: "tailscale is running",
    snapshot: {
      backendState: "Running",
      devices: [
        {
          id: "self",
          shortName: "workshop",
          dnsName: "workshop.tail.net",
          os: "linux",
          online: true,
          self: true,
          relayed: false,
          tags: [],
          ipv4: "100.64.0.1",
        },
        {
          id: "peer-1",
          shortName: "studio",
          dnsName: "studio.tail.net",
          os: "linux",
          online: true,
          self: false,
          relayed: false,
          tags: [],
        },
      ],
      capturedAt: 1,
    },
  };
  const controller = await createMuxstoneController({
    client,
    initialSessions: [initial],
    tailnetSource: { fetchStatus: () => Promise.resolve(tailnetResult) },
    tailnetPollIntervalMs: 300_000,
  });
  const mount: MuxstoneAppMountRef = {};
  const { tuiOptions: _tuiOptions, ...headlessOptions } = createMuxstoneTerminalOptions(controller, mount);
  const harness = await createTestTerminalApp({ ...headlessOptions, size: { columns: 100, rows: 28 } });

  try {
    const mounted = mount.current;
    assert(mounted);
    await mounted.whenIdle();

    assertEquals((await harness.pilot.click(23, 0)).press.handled, true);
    await mounted.whenIdle();
    assertEquals(
      controller.windowHost.controller.inspect().activeWindowId,
      MUXSTONE_NETWORK_WINDOW_ID,
    );
    await waitForCondition(() => controller.networkStatus.peek() !== undefined, 2_000);
    await waitForCondition(
      () => controller.networkTree.visibleRows().some((row) => row.id === "dev:peer-1"),
      2_000,
    );

    for (let step = 0; step < 4; step += 1) await harness.pilot.press("down");
    assertEquals(controller.networkTree.selected()?.id, "dev:peer-1");
    await harness.pilot.press("right");
    await harness.pilot.press("down");
    assertEquals(controller.networkTree.selected()?.id, "act:shell:peer-1");
    await harness.pilot.press("return");
    await waitForCondition(() => client.spawned.length === 1, 2_000);
    assertEquals(client.spawned[0]!.command, "ssh");
    assertEquals(client.spawned[0]!.args, ["studio.tail.net"]);
    assertEquals(client.spawned[0]!.title, "studio");
    assertEquals(controller.savedHosts.peek(), ["studio.tail.net"]);

    controller.windowHost.execute(
      { kind: "focus", id: MUXSTONE_NETWORK_WINDOW_ID },
      mounted.bodyRect.peek(),
    );
    await waitForCondition(
      () => controller.networkTree.visibleRows().some((row) => row.id === "host:studio.tail.net"),
      2_000,
    );

    assertEquals(controller.sessionHosts.peek()["spawned-1"], "studio.tail.net");
    controller.networkTree.setExpanded("host:studio.tail.net", true);
    await waitForCondition(
      () => controller.networkTree.visibleRows().some((row) => row.id === "ses:spawned-1"),
      2_000,
    );
    controller.networkTree.setSelectedIndex(
      controller.networkTree.visibleRows().findIndex((row) => row.id === "ses:spawned-1"),
    );
    await harness.pilot.press("return");
    await mounted.whenIdle();
    assertEquals(
      controller.windowHost.controller.inspect().activeWindowId,
      muxstoneWindowId("spawned-1"),
    );

    controller.windowHost.execute(
      { kind: "focus", id: MUXSTONE_NETWORK_WINDOW_ID },
      mounted.bodyRect.peek(),
    );
    controller.networkTree.setSelectedIndex(
      controller.networkTree.visibleRows().findIndex((row) => row.id === "host:studio.tail.net"),
    );
    await harness.pilot.press("delete");
    await mounted.whenIdle();
    assertEquals(controller.savedHosts.peek(), []);
  } finally {
    harness.destroy();
    await controller.dispose();
  }
});

Deno.test("Muxstone paste of a local file path onto an SSH shell offers and runs scp", async () => {
  const initial = session("scp-shell", "scp shell", 0);
  const client = new FakeMuxstoneClient([initial]);
  const controller = await createMuxstoneController({
    client,
    initialSessions: [initial],
    tailnetSource: {
      fetchStatus: () => Promise.resolve({ availability: "unavailable", detail: "off" } as TailnetStatusResult),
    },
    tailnetPollIntervalMs: 300_000,
    statFile: (path) => Promise.resolve(path === "/tmp/report.pdf"),
    scpCwdTimeoutMs: 60,
  });
  const mount: MuxstoneAppMountRef = {};
  const { tuiOptions: _tuiOptions, ...headlessOptions } = createMuxstoneTerminalOptions(controller, mount);
  const harness = await createTestTerminalApp({ ...headlessOptions, size: { columns: 100, rows: 28 } });

  try {
    const mounted = mount.current;
    assert(mounted);
    await mounted.whenIdle();
    controller.sessionHosts.value = Object.freeze({ [initial.id]: "studio.tail.net" });
    controller.windowHost.execute(
      { kind: "focus", id: muxstoneWindowId(initial.id) },
      mounted.bodyRect.peek(),
    );

    harness.app.tui.emit("paste", { key: "paste", text: "/tmp/report.pdf", buffer: new Uint8Array() });
    await waitForCondition(() => controller.pendingScp.peek() !== undefined, 2_000);
    assertEquals(controller.pendingScp.peek()!.target, "studio.tail.net");
    // A typed password fills the masked field.
    await harness.pilot.press("h");
    await harness.pilot.press("i");
    assertEquals(controller.pendingScp.peek()!.password, "hi");
    // Send spawns a dedicated scp terminal window showing progress.
    await harness.pilot.press("return");
    await waitForCondition(() => client.spawned.some((options) => options.command === "scp"), 2_000);
    const scpSpawn = client.spawned.find((options) => options.command === "scp")!;
    assertEquals(scpSpawn.args, [
      "-o",
      "StrictHostKeyChecking=accept-new",
      "--",
      "/tmp/report.pdf",
      "studio.tail.net:",
    ]);
    assertEquals(scpSpawn.title, "scp report.pdf");
    assertEquals(controller.pendingScp.peek(), undefined);
    // The typed password is injected once scp prompts in that window.
    const scpSessionId = client.listSnapshot().find((s) => s.commandLine === "scp")!.id;
    client.emitOutput({ sessionId: scpSessionId, sequence: 1, data: "cos@studio's password: " });
    await waitForCondition(
      () => client.inputs.some((input) => input.sessionId === scpSessionId && input.data === "hi\r"),
      2_000,
    );

    // The "Paste path" button forwards the literal text and skips scp.
    controller.windowHost.execute(
      { kind: "focus", id: muxstoneWindowId(initial.id) },
      mounted.bodyRect.peek(),
    );
    harness.app.tui.emit("paste", { key: "paste", text: "/tmp/report.pdf", buffer: new Uint8Array() });
    await waitForCondition(() => controller.pendingScp.peek() !== undefined, 2_000);
    const pasteRect = muxstoneScpLayout(mounted.windowProjection.peek().bounds).pasteRect;
    await harness.pilot.click(pasteRect.column + 1, pasteRect.row);
    await mounted.whenIdle();
    assertEquals(controller.pendingScp.peek(), undefined);
    assertEquals(client.inputs.at(-1), { sessionId: initial.id, data: "/tmp/report.pdf" });

    harness.app.tui.emit("paste", { key: "paste", text: "plain text, not a path", buffer: new Uint8Array() });
    await mounted.whenIdle();
    assertEquals(controller.pendingScp.peek(), undefined);
    assertEquals(client.inputs.at(-1), { sessionId: initial.id, data: "plain text, not a path" });

    harness.app.tui.emit("paste", { key: "paste", text: "/tmp/missing.pdf", buffer: new Uint8Array() });
    await mounted.whenIdle();
    assertEquals(controller.pendingScp.peek(), undefined);
    assertEquals(client.inputs.at(-1), { sessionId: initial.id, data: "/tmp/missing.pdf" });
  } finally {
    harness.destroy();
    await controller.dispose();
  }
});

Deno.test("Muxstone scp capture runs pwd in the shell and targets the captured directory", async () => {
  const initial = session("cwd-shell", "cwd shell", 0, "ssh studio.tail.net");
  const client = new FakeMuxstoneClient([initial]);
  const controller = await createMuxstoneController({
    client,
    initialSessions: [initial],
    tailnetSource: {
      fetchStatus: () => Promise.resolve({ availability: "unavailable", detail: "off" } as TailnetStatusResult),
    },
    tailnetPollIntervalMs: 300_000,
    statFile: () => Promise.resolve(true),
    scpCwdTimeoutMs: 2_000,
  });
  const mount: MuxstoneAppMountRef = {};
  const { tuiOptions: _tuiOptions, ...headlessOptions } = createMuxstoneTerminalOptions(controller, mount);
  const harness = await createTestTerminalApp({ ...headlessOptions, size: { columns: 100, rows: 28 } });

  try {
    const mounted = mount.current;
    assert(mounted);
    await mounted.whenIdle();
    // The target derives from the session's own `ssh …` command line; no
    // network-panel mapping is seeded. The prompt must be visible so the
    // idle-prompt guard allows the probe.
    client.emitOutput({ sessionId: initial.id, sequence: 1, data: "user@studio:~$ " });
    controller.windowHost.execute(
      { kind: "focus", id: muxstoneWindowId(initial.id) },
      mounted.bodyRect.peek(),
    );
    await waitForCondition(() => controller.runtime(initial.id)!.lastSequence === 1, 2_000);

    harness.app.tui.emit("paste", { key: "paste", text: "/tmp/report.pdf", buffer: new Uint8Array() });
    await waitForCondition(() => controller.pendingScp.peek() !== undefined, 2_000);
    assertEquals(controller.pendingScp.peek()!.remoteDir, undefined);
    await waitForCondition(
      () => client.inputs.some((input) => input.sessionId === initial.id && input.data === " pwd\r"),
      2_000,
    );
    client.emitOutput({
      sessionId: initial.id,
      sequence: 2,
      data: " pwd\r\n\x1b[32m/home/cos/projects\x1b[0m\r\nuser@studio:~$ ",
    });
    await waitForCondition(() => controller.pendingScp.peek()?.remoteDir === "/home/cos/projects", 2_000);

    await harness.pilot.press("return");
    await waitForCondition(() => client.spawned.some((options) => options.command === "scp"), 2_000);
    const scpSpawn = client.spawned.find((options) => options.command === "scp")!;
    assertEquals(scpSpawn.args, [
      "-o",
      "StrictHostKeyChecking=accept-new",
      "--",
      "/tmp/report.pdf",
      "studio.tail.net:/home/cos/projects/",
    ]);
  } finally {
    harness.destroy();
    await controller.dispose();
  }
});

Deno.test("Muxstone workspace state round-trips saved hosts and rejects hostile entries", () => {
  const normalized = normalizeMuxstoneWorkspaceState({
    schemaVersion: 1,
    themeId: "midnight",
    terminalOrdinal: 3,
    savedHosts: ["studio.tail.net", "user@host-1", "-rm -rf /", "studio.tail.net", 42, "ok.example"],
  });
  assertEquals(normalized.savedHosts, ["studio.tail.net", "user@host-1", "ok.example"]);
  assertEquals(normalizeMuxstoneWorkspaceState(undefined).savedHosts, []);
  const withSessions = normalizeMuxstoneWorkspaceState({
    schemaVersion: 1,
    themeId: "midnight",
    terminalOrdinal: 1,
    savedHosts: [],
    sessionHosts: { "spawned-1": "studio.tail.net", "bad id!": "x", "spawned-2": "-rm" },
  });
  assertEquals(withSessions.sessionHosts, { "spawned-1": "studio.tail.net" });
  assertEquals(normalizeMuxstoneWorkspaceState(undefined).sessionHosts, {});
});

class FakeMuxstonePointerSource implements MuxstonePointerInputSource {
  readonly #pointerListeners = new Set<(event: PointerInputEvent) => void | Promise<void>>();
  readonly #scrollListeners = new Set<(event: MouseScrollEvent) => void | Promise<void>>();

  on(type: "pointerInput", listener: (event: PointerInputEvent) => void | Promise<void>): () => void;
  on(type: "mouseScroll", listener: (event: MouseScrollEvent) => void | Promise<void>): () => void;
  on(
    type: "pointerInput" | "mouseScroll",
    listener:
      | ((event: PointerInputEvent) => void | Promise<void>)
      | ((event: MouseScrollEvent) => void | Promise<void>),
  ): () => void {
    if (type === "pointerInput") {
      const typed = listener as (event: PointerInputEvent) => void | Promise<void>;
      this.#pointerListeners.add(typed);
      return () => this.#pointerListeners.delete(typed);
    }
    const typed = listener as (event: MouseScrollEvent) => void | Promise<void>;
    this.#scrollListeners.add(typed);
    return () => this.#scrollListeners.delete(typed);
  }

  async emitPointer(event: PointerInputEvent): Promise<void> {
    for (const listener of this.#pointerListeners) await listener(event);
  }
}

class FakeMuxstoneClient implements MuxstoneClientPort {
  connected = true;
  delayInputAcks = false;
  rejectAttach = false;
  rejectKill = false;
  shutdownCalls = 0;
  readonly inputs: Array<{ sessionId: string; data: string }> = [];
  readonly spawned: MuxstoneSpawnOptions[] = [];
  readonly detached: string[] = [];
  readonly killed: string[] = [];
  readonly #sessions = new Map<string, MuxstoneSessionSummary>();
  readonly #replay = new Map<string, MuxstoneOutputFrame[]>();
  readonly #listeners = new Map<string, (frame: MuxstoneOutputFrame) => void>();
  readonly #pendingInputAcks: Array<() => void> = [];
  #ordinal = 1;

  constructor(
    sessions: readonly MuxstoneSessionSummary[],
    replay: Readonly<Record<string, readonly MuxstoneOutputFrame[]>> = {},
  ) {
    for (const session of sessions) this.#sessions.set(session.id, session);
    for (const [sessionId, frames] of Object.entries(replay)) this.#replay.set(sessionId, [...frames]);
  }

  list(): Promise<readonly MuxstoneSessionSummary[]> {
    return Promise.resolve(this.listSnapshot());
  }

  listSnapshot(): MuxstoneSessionSummary[] {
    return [...this.#sessions.values()];
  }

  spawn(options: MuxstoneSpawnOptions): Promise<MuxstoneSessionSummary> {
    this.spawned.push(options);
    const id = `spawned-${this.#ordinal++}`;
    const summary = session(id, options.title ?? id, 0, options.command);
    this.#sessions.set(id, summary);
    return Promise.resolve(summary);
  }

  attach(
    sessionId: string,
    options: {
      readonly sinceSequence?: number;
      readonly onOutput: (frame: MuxstoneOutputFrame) => void;
      readonly onSession?: (session: MuxstoneSessionSummary) => void;
    },
  ): Promise<MuxstoneAttachResult> {
    if (this.rejectAttach) return Promise.reject(new Error("fake attach rejected"));
    const current = this.#sessions.get(sessionId);
    if (!current) return Promise.reject(new Error("missing fake session"));
    this.#listeners.set(sessionId, options.onOutput);
    return Promise.resolve({
      session: current,
      replay: (this.#replay.get(sessionId) ?? []).filter((frame) => frame.sequence > (options.sinceSequence ?? 0)),
      truncated: false,
    });
  }

  detach(sessionId: string): Promise<boolean> {
    this.detached.push(sessionId);
    this.#listeners.delete(sessionId);
    return Promise.resolve(this.#sessions.has(sessionId));
  }

  input(sessionId: string, data: string | Uint8Array): Promise<boolean> {
    this.inputs.push({
      sessionId,
      data: typeof data === "string" ? data : new TextDecoder().decode(data),
    });
    const accepted = this.#sessions.has(sessionId);
    if (!this.delayInputAcks) return Promise.resolve(accepted);
    return new Promise((resolve) => this.#pendingInputAcks.push(() => resolve(accepted)));
  }

  get pendingInputAckCount(): number {
    return this.#pendingInputAcks.length;
  }

  resolveNextInputAck(): void {
    this.#pendingInputAcks.shift()?.();
  }

  async resolveAllInputAcks(): Promise<void> {
    for (let attempt = 0; attempt < 16; attempt += 1) {
      for (const resolve of this.#pendingInputAcks.splice(0)) resolve();
      await new Promise((resolve) => setTimeout(resolve, 0));
      if (this.#pendingInputAcks.length === 0) return;
    }
    throw new Error("fake input ACK queue did not drain");
  }

  emitOutput(frame: MuxstoneOutputFrame): void {
    this.#listeners.get(frame.sessionId)?.(frame);
  }

  resize(_sessionId: string, _columns: number, _rows: number): Promise<boolean> {
    return Promise.resolve(true);
  }

  kill(sessionId: string): Promise<boolean> {
    this.killed.push(sessionId);
    if (this.rejectKill) return Promise.resolve(false);
    this.#listeners.delete(sessionId);
    return Promise.resolve(this.#sessions.delete(sessionId));
  }

  shutdownHost(): Promise<boolean> {
    this.shutdownCalls += 1;
    this.#sessions.clear();
    this.#listeners.clear();
    return Promise.resolve(true);
  }

  dispose(): Promise<void> {
    this.connected = false;
    this.#listeners.clear();
    return Promise.resolve();
  }
}

async function waitForCondition(predicate: () => boolean, timeoutMs: number): Promise<void> {
  const deadline = performance.now() + timeoutMs;
  while (!predicate()) {
    if (performance.now() >= deadline) throw new Error(`Condition did not become true within ${timeoutMs} ms.`);
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

function cycleToTheme(controller: MuxstoneController, id: string): void {
  for (let attempt = 0; attempt < MUXSTONE_THEMES.length; attempt += 1) {
    if (controller.themeId.peek() === id) return;
    controller.cycleTheme();
  }
  throw new Error(`Muxstone theme was not found: ${id}`);
}

function canvasCell(value: unknown): string {
  return typeof value === "string"
    ? value
    : value instanceof Uint8Array
    ? new TextDecoder().decode(value)
    : String(value ?? "");
}

function helpClosePoint(bounds: { column: number; row: number; width: number; height: number }) {
  const width = Math.min(84, Math.max(24, bounds.width - 4));
  const height = Math.min(15, Math.max(3, bounds.height - 2));
  const column = bounds.column + Math.max(0, Math.floor((bounds.width - width) / 2));
  const row = bounds.row + Math.max(0, Math.floor((bounds.height - height) / 2));
  return {
    column: column + Math.max(1, width - 10),
    row: row + Math.max(1, height - 2),
  };
}

function killButtonPoints(bounds: { column: number; row: number; width: number; height: number }) {
  const width = Math.min(62, Math.max(24, bounds.width - 6));
  const height = Math.min(8, Math.max(3, bounds.height - 2));
  const column = bounds.column + Math.max(0, Math.floor((bounds.width - width) / 2));
  const row = bounds.row + Math.max(0, Math.floor((bounds.height - height) / 2));
  const buttonRow = row + Math.max(1, height - 2);
  return {
    cancel: { column: column + 2, row: buttonRow },
    confirm: { column: column + Math.max(13, width - 10), row: buttonRow },
  };
}

function touchPointer(
  kind: "down" | "move" | "up" | "cancel",
  column: number,
  row: number,
  sequence: number,
  pointerId = 41,
): PointerInputEvent {
  return {
    schemaVersion: POINTER_INPUT_SCHEMA_VERSION,
    sequence,
    timestamp: sequence,
    source: "browser",
    trust: "trusted",
    modifiers: { alt: false, ctrl: false, meta: false, shift: false },
    pointerId,
    device: "touch",
    kind,
    coordinates: { cell: { space: "cell", x: column, y: row } },
    primary: true,
    button: null,
    buttons: kind === "up" || kind === "cancel" ? 0 : 1,
    pressure: kind === "up" || kind === "cancel" ? 0 : 0.5,
    contact: { width: 18, height: 18 },
  };
}

function touchPointerWithoutCell(kind: "up" | "cancel", sequence: number): PointerInputEvent {
  return {
    ...touchPointer(kind, 0, 0, sequence),
    coordinates: { screen: { space: "screen", x: 100, y: 100 } },
  };
}

function mousePointer(
  kind: "down" | "move" | "up" | "cancel",
  column: number,
  row: number,
  sequence: number,
  button: number | null = kind === "down" ? 0 : null,
): PointerInputEvent {
  return {
    schemaVersion: POINTER_INPUT_SCHEMA_VERSION,
    sequence,
    timestamp: sequence,
    source: "browser",
    trust: "trusted",
    modifiers: { alt: false, ctrl: false, meta: false, shift: false },
    pointerId: 51,
    device: "mouse",
    kind,
    coordinates: { cell: { space: "cell", x: column, y: row } },
    primary: true,
    button,
    buttons: kind === "up" || kind === "cancel" ? 0 : button === 2 ? 2 : 1,
  };
}

function mouseHoverPointer(
  column: number,
  row: number,
  sequence: number,
  alt = false,
): PointerInputEvent {
  const event = mousePointer("move", column, row, sequence, null);
  return {
    ...event,
    pointerId: 52,
    modifiers: { ...event.modifiers, alt },
    buttons: 0,
  };
}

function session(
  id: string,
  title: string,
  sequence: number,
  commandLine = "/bin/test-shell",
): MuxstoneSessionSummary {
  return {
    id,
    title,
    commandLine,
    status: "running",
    running: true,
    columns: 80,
    rows: 24,
    sequence,
    createdAt: 1,
    updatedAt: 1,
  };
}

Deno.test("Muxstone window settings cycle, normalize, and reject unknown values", () => {
  const defaults = defaultMuxstoneWindowSettings();
  assertEquals(defaults.themed, true);
  assertEquals(defaults.scrollbackLimit, 2_000);

  // Every spec cycles through its declared values and wraps in both directions.
  for (const spec of MUXSTONE_WINDOW_SETTING_SPECS) {
    let settings = defaults;
    const seen: (boolean | number)[] = [];
    for (let step = 0; step < spec.values.length; step += 1) {
      settings = cycleMuxstoneWindowSetting(settings, spec.id, 1);
      seen.push(settings[spec.id]);
    }
    assertEquals(settings[spec.id], defaults[spec.id], `${spec.id} should return to its start`);
    assertEquals(new Set(seen).size, spec.values.length, `${spec.id} should visit every value`);
    const back = cycleMuxstoneWindowSetting(defaults, spec.id, -1);
    assertEquals(spec.values.includes(back[spec.id]), true);
  }

  // Persisted junk falls back to defaults per field rather than being trusted.
  const restored = normalizeMuxstoneWindowSettings({
    themed: false,
    scrollbackLimit: 999_999,
    mouseReporting: "yes",
    wheelLines: 5,
  });
  assertEquals(restored.themed, false);
  assertEquals(restored.scrollbackLimit, defaults.scrollbackLimit);
  assertEquals(restored.mouseReporting, defaults.mouseReporting);
  assertEquals(restored.wheelLines, 5);
  assertEquals(normalizeMuxstoneWindowSettings(null), defaults);
});

Deno.test("Muxstone titlebar config button opens a per-window settings modal", async () => {
  const initial = session("cfg-shell", "cfg shell", 0);
  const client = new FakeMuxstoneClient([initial]);
  const controller = await createMuxstoneController({ client, initialSessions: [initial] });
  const mount: MuxstoneAppMountRef = {};
  const { tuiOptions: _tuiOptions, ...headlessOptions } = createMuxstoneTerminalOptions(controller, mount);
  const harness = await createTestTerminalApp({ ...headlessOptions, size: { columns: 110, rows: 30 } });

  try {
    const mounted = mount.current;
    assert(mounted);
    await mounted.whenIdle();

    // The terminal window carries a `config` control; the manager window does not.
    const projection = mounted.windowProjection.peek();
    const terminalWindow = projection.windows.find((w) => w.id === muxstoneWindowId("cfg-shell"));
    assert(terminalWindow, "terminal window should be projected");
    const configControl = terminalWindow.controls.find((control) => control.kind === "config");
    assert(configControl, "terminal window should expose a config control");
    const managerWindow = projection.windows.find((w) => w.id === MUXSTONE_SESSIONS_WINDOW_ID);
    assertEquals(managerWindow?.controls.some((control) => control.kind === "config"), false);

    // Clicking it opens the modal for that window.
    assertEquals(controller.configSessionId.peek(), undefined);
    await harness.pilot.click(configControl.hitRect.column, configControl.hitRect.row);
    await mounted.whenIdle();
    assertEquals(controller.configSessionId.peek(), "cfg-shell");

    // Theme colors is the first row; clicking it flips the setting off.
    const layout = muxstoneWindowConfigLayout(mounted.windowProjection.peek().bounds);
    assertEquals(MUXSTONE_WINDOW_SETTING_SPECS[0]!.id, "themed");
    const themedRow = layout.rowRects[0]!;
    await harness.pilot.click(themedRow.column + 2, themedRow.row);
    await mounted.whenIdle();
    assertEquals(controller.windowSettingsFor("cfg-shell").themed, false);

    // Scrollback cycles and reaches the live screen model.
    controller.configRowIndex.value = 1;
    assertEquals(MUXSTONE_WINDOW_SETTING_SPECS[1]!.id, "scrollbackLimit");
    controller.cycleWindowSetting("cfg-shell", "scrollbackLimit", 1);
    const scrollbackLimit = controller.windowSettingsFor("cfg-shell").scrollbackLimit;
    assertNotEquals(scrollbackLimit, 2_000);
    assertEquals(controller.runtime("cfg-shell")?.screen.scrollbackLimit, scrollbackLimit);

    // Reset restores defaults, and Close dismisses the modal.
    await harness.pilot.click(layout.resetRect.column + 1, layout.resetRect.row);
    await mounted.whenIdle();
    assertEquals(controller.windowSettingsFor("cfg-shell"), defaultMuxstoneWindowSettings());
    await harness.pilot.click(layout.closeRect.column + 1, layout.closeRect.row);
    await mounted.whenIdle();
    assertEquals(controller.configSessionId.peek(), undefined);
  } finally {
    harness.destroy();
    await controller.dispose();
  }
});

Deno.test("Muxstone window settings persist and drive scrollback on restore", async () => {
  const initial = session("persist-shell", "persist shell", 0);
  const client = new FakeMuxstoneClient([initial]);
  const controller = await createMuxstoneController({ client, initialSessions: [initial] });

  try {
    controller.cycleWindowSetting("persist-shell", "themed", 1);
    controller.cycleWindowSetting("persist-shell", "scrollbackLimit", 1);
    const expected = controller.windowSettingsFor("persist-shell");
    assertEquals(expected.themed, false);

    const persisted = normalizeMuxstoneWorkspaceState(controller.kernel.appState.peek());
    assertEquals(persisted.windowSettings["persist-shell"], expected);
    assertEquals(controller.runtime("persist-shell")?.screen.scrollbackLimit, expected.scrollbackLimit);
  } finally {
    await controller.dispose();
  }
});

Deno.test("Muxstone confirm-on-close off kills a terminal without the prompt", async () => {
  const initial = session("quick-kill", "quick kill", 0);
  const client = new FakeMuxstoneClient([initial]);
  const controller = await createMuxstoneController({ client, initialSessions: [initial] });

  try {
    // Default asks first.
    assertEquals(controller.requestKillSession("quick-kill"), true);
    assertEquals(controller.pendingKillSessionId.peek(), "quick-kill");
    controller.cancelKillSession();

    // With the prompt disabled the session terminates directly.
    controller.cycleWindowSetting("quick-kill", "confirmClose", 1);
    assertEquals(controller.windowSettingsFor("quick-kill").confirmClose, false);
    assertEquals(controller.requestKillSession("quick-kill"), true);
    assertEquals(controller.pendingKillSessionId.peek(), undefined);
    await waitForCondition(() => controller.runtime("quick-kill") === undefined, 2_000);
  } finally {
    await controller.dispose();
  }
});

Deno.test("Muxstone global config modal picks theme and background from select lists", async () => {
  const initial = session("global-cfg", "global cfg", 0);
  const client = new FakeMuxstoneClient([initial]);
  const controller = await createMuxstoneController({ client, initialSessions: [initial] });
  const mount: MuxstoneAppMountRef = {};
  const { tuiOptions: _tuiOptions, ...headlessOptions } = createMuxstoneTerminalOptions(controller, mount);
  const harness = await createTestTerminalApp({ ...headlessOptions, size: { columns: 110, rows: 34 } });

  try {
    const mounted = mount.current;
    assert(mounted);
    await mounted.whenIdle();

    // The [ Config ] menu button opens it.
    assertEquals((await harness.pilot.click(52, 0)).press.handled, true);
    await mounted.whenIdle();
    assertEquals(controller.globalConfigVisible.peek(), true);
    assertEquals(controller.globalConfigPane.peek(), "theme");

    const bounds = mounted.windowProjection.peek().bounds;
    const layoutFor = () =>
      muxstoneGlobalConfigLayout(
        bounds,
        Math.max(0, MUXSTONE_THEMES.findIndex((entry) => entry.id === controller.themeId.peek())),
        Math.max(0, MUXSTONE_BACKGROUND_IDS.indexOf(controller.backgroundId.peek())),
      );

    // Arrow keys walk the theme list and apply live.
    const themeBefore = controller.themeId.peek();
    await harness.pilot.press("down");
    await mounted.whenIdle();
    assertNotEquals(controller.themeId.peek(), themeBefore);
    await harness.pilot.press("up");
    await mounted.whenIdle();
    assertEquals(controller.themeId.peek(), themeBefore);

    // Tab moves to the background pane, where arrows drive that list instead.
    await harness.pilot.press("tab");
    await mounted.whenIdle();
    assertEquals(controller.globalConfigPane.peek(), "background");
    const backgroundBefore = controller.backgroundId.peek();
    await harness.pilot.press("down");
    await mounted.whenIdle();
    assertNotEquals(controller.backgroundId.peek(), backgroundBefore);
    assertEquals(controller.themeId.peek(), themeBefore);

    // Clicking a background row selects it directly.
    const jungleIndex = MUXSTONE_BACKGROUND_IDS.indexOf("jungle");
    const jungleRow = layoutFor().backgroundRows.find((entry) => entry.index === jungleIndex)!;
    assertEquals((await harness.pilot.click(jungleRow.rect.column + 2, jungleRow.rect.row)).press.handled, true);
    await mounted.whenIdle();
    assertEquals(controller.backgroundId.peek(), "jungle");

    // Tab again reaches the options pane where left/right cycles values.
    await harness.pilot.press("tab");
    await mounted.whenIdle();
    assertEquals(controller.globalConfigPane.peek(), "options");
    assertEquals(controller.globalSettings.peek().overgrowInactive, true);
    await harness.pilot.press("right");
    await mounted.whenIdle();
    assertEquals(controller.globalSettings.peek().overgrowInactive, false);
    await harness.pilot.press("right");
    await mounted.whenIdle();
    assertEquals(controller.globalSettings.peek().overgrowInactive, true);

    // Overgrow time is the second option and clicking its row cycles it.
    assertEquals(MUXSTONE_GLOBAL_SETTING_SPECS[1]!.id, "overgrowFullMs");
    const timeBefore = controller.globalSettings.peek().overgrowFullMs;
    const optionRow = layoutFor().optionRows[1]!;
    assertEquals((await harness.pilot.click(optionRow.column + 2, optionRow.row)).press.handled, true);
    await mounted.whenIdle();
    assertNotEquals(controller.globalSettings.peek().overgrowFullMs, timeBefore);

    // Settings persist with the workspace.
    const persisted = normalizeMuxstoneWorkspaceState(controller.kernel.appState.peek());
    assertEquals(persisted.globalSettings, controller.globalSettings.peek());
    assertEquals(persisted.backgroundId, "jungle");

    // Escape closes.
    await harness.pilot.press("escape");
    await mounted.whenIdle();
    assertEquals(controller.globalConfigVisible.peek(), false);
  } finally {
    harness.destroy();
    await controller.dispose();
  }
});

Deno.test("Muxstone global settings normalize and reject unknown values", () => {
  const defaults = defaultMuxstoneGlobalSettings();
  assertEquals(defaults.overgrowInactive, true);
  assertEquals(normalizeMuxstoneGlobalSettings(null), defaults);
  assertEquals(normalizeMuxstoneGlobalSettings({ overgrowInactive: "yes" }), defaults);
  assertEquals(
    normalizeMuxstoneGlobalSettings({ overgrowInactive: false, overgrowFullMs: 30_000 }),
    { overgrowInactive: false, overgrowFullMs: 30_000 },
  );
  // Unlisted durations fall back rather than being trusted.
  assertEquals(normalizeMuxstoneGlobalSettings({ overgrowFullMs: 7 }).overgrowFullMs, defaults.overgrowFullMs);

  for (const spec of MUXSTONE_GLOBAL_SETTING_SPECS) {
    let settings = defaults;
    for (let step = 0; step < spec.values.length; step += 1) {
      settings = cycleMuxstoneGlobalSetting(settings, spec.id, 1);
    }
    assertEquals(settings[spec.id], defaults[spec.id], `${spec.id} should wrap back to its start`);
  }
});

Deno.test("Muxstone glyph columns classify single- and double-width characters", () => {
  for (const glyph of [" ", "a", "#", "~", "░", "▓", "█", "·", "･", "ﾊ", "─", "│", "✕"]) {
    assertEquals(muxstoneGlyphColumns(glyph), 1, `${JSON.stringify(glyph)} should be one column`);
  }
  for (const glyph of ["日", "中", "ア", "・", "🙂"]) {
    assertEquals(muxstoneGlyphColumns(glyph), 2, `${JSON.stringify(glyph)} should be two columns`);
  }
});

Deno.test("Muxstone background glyph vocabularies stay single-width", async () => {
  // A double-width glyph in a background bleeds one column right. On a window's
  // left edge that lands inside the window, and because the canvas repaints
  // differentially the damage persists until a full repaint.
  const fields = ["matrix", "circuit", "jungle", "biomech", "vaporwave", "skull", "metaball"];
  for (const field of fields) {
    const source = await Deno.readTextFile(`./examples/showcases/muxstone/${field}_background.ts`);
    const wide = new Set<string>();
    for (const glyph of source) {
      if (glyph.codePointAt(0)! >= 0x80 && muxstoneGlyphColumns(glyph) === 2) wide.add(glyph);
    }
    assertEquals([...wide], [], `${field}_background.ts must not contain double-width glyphs`);
  }
});

Deno.test("Muxstone pairs a wide terminal glyph with an empty follower cell", async () => {
  const initial = session("wide-shell", "wide shell", 1);
  const client = new FakeMuxstoneClient([initial], {
    "wide-shell": [{ sessionId: "wide-shell", sequence: 1, data: "\x1b[1;1H日本AB" }],
  });
  const controller = await createMuxstoneController({ client, initialSessions: [initial] });
  const mount: MuxstoneAppMountRef = {};
  const { tuiOptions: _tuiOptions, ...headlessOptions } = createMuxstoneTerminalOptions(controller, mount);
  const harness = await createTestTerminalApp({ ...headlessOptions, size: { columns: 110, rows: 32 } });

  try {
    const mounted = mount.current;
    assert(mounted);
    await mounted.whenIdle();
    controller.windowHost.execute({ kind: "close", id: MUXSTONE_SESSIONS_WINDOW_ID }, mounted.bodyRect.peek());
    await harness.pilot.settle();

    const terminal = mounted.windowProjection.peek().windows.find(
      (window) => window.id === muxstoneWindowId("wide-shell"),
    )!;
    const row = harness.canvas.frameBuffer[terminal.clientRect.row] ?? [];
    const start = terminal.clientRect.column;
    const charAt = (offset: number): string => {
      const value = row[start + offset];
      const text = typeof value === "string" ? value : value ? new TextDecoder().decode(value) : "";
      return stripAnsi(text);
    };

    // Each wide glyph owns two columns: the glyph then an empty follower, so the
    // ASCII after it still lands on its own column instead of being displaced.
    assertEquals(charAt(0), "日");
    assertEquals(charAt(1), "");
    assertEquals(charAt(2), "本");
    assertEquals(charAt(3), "");
    assertEquals(charAt(4), "A");
    assertEquals(charAt(5), "B");

    // Advertised columns match cells consumed, which is what keeps everything to
    // the right - including the neighbouring window's border - on its own column.
    let columns = 0;
    for (let offset = 0; offset < 6; offset += 1) {
      const glyph = charAt(offset);
      if (glyph !== "") columns += muxstoneGlyphColumns(glyph);
    }
    assertEquals(columns, 6);
  } finally {
    harness.destroy();
    await controller.dispose();
  }
});
