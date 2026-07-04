// Copyright 2023 Im-Beast. MIT license.
import { assertEquals, assertStrictEquals } from "./deps.ts";
import {
  detectTmuxPassthroughAllowed,
  formatWorkbenchKittyGraphicsStatus,
  WorkbenchKittyGraphicsController,
} from "../app/workbench_kitty_graphics.ts";

const encoder = new TextEncoder();

Deno.test("detectTmuxPassthroughAllowed accepts no tmux and enabled tmux values", async () => {
  assertEquals(await detectTmuxPassthroughAllowed({ tmux: "" }), true);
  assertEquals(
    await detectTmuxPassthroughAllowed({
      tmux: "/tmp/tmux",
      command: () => Promise.resolve({ success: true, stdout: encoder.encode("all\n") }),
    }),
    true,
  );
  assertEquals(
    await detectTmuxPassthroughAllowed({
      tmux: "/tmp/tmux",
      command: () => Promise.resolve({ success: true, stdout: encoder.encode("yes") }),
    }),
    true,
  );
});

Deno.test("detectTmuxPassthroughAllowed rejects disabled failed and throwing probes", async () => {
  assertEquals(
    await detectTmuxPassthroughAllowed({
      tmux: "/tmp/tmux",
      command: () => Promise.resolve({ success: true, stdout: encoder.encode("off") }),
    }),
    false,
  );
  assertEquals(
    await detectTmuxPassthroughAllowed({
      tmux: "/tmp/tmux",
      command: () => Promise.resolve({ success: false, stdout: encoder.encode("all") }),
    }),
    false,
  );
  assertEquals(
    await detectTmuxPassthroughAllowed({
      tmux: "/tmp/tmux",
      command: () => Promise.reject(new Error("tmux unavailable")),
    }),
    false,
  );
});

Deno.test("WorkbenchKittyGraphicsController selects auto and forced surfaces", () => {
  const controller = new WorkbenchKittyGraphicsController({
    tmux: null,
    tmuxPassthroughAllowed: true,
    capability: {
      supported: false,
      mode: "disabled",
      reason: "test",
      term: "",
      termProgram: "",
      multiplexer: "none",
      remote: false,
    },
    writer: { write: () => {} },
  });

  assertStrictEquals(controller.surfaceFor({ kittyGraphics: false }), controller.autoSurface);
  assertStrictEquals(controller.surfaceFor({ kittyGraphics: true }), controller.forcedSurface);
});

Deno.test("formatWorkbenchKittyGraphicsStatus projects modal status text", () => {
  assertEquals(
    formatWorkbenchKittyGraphicsStatus({
      selected: { kittyGraphics: true },
      tmux: "/tmp/tmux",
      tmuxPassthroughAllowed: false,
      surface: { kind: "none", available: false, handles: [], commandCount: 0, reason: "blocked" },
    }),
    "[unavailable: tmux allow-passthrough off]",
  );
  assertEquals(
    formatWorkbenchKittyGraphicsStatus({
      selected: { kittyGraphics: true },
      tmux: null,
      tmuxPassthroughAllowed: true,
      surface: { kind: "kitty", available: true, handles: [], commandCount: 0, mode: "direct" },
    }),
    "[direct]",
  );
  assertEquals(
    formatWorkbenchKittyGraphicsStatus({
      selected: { kittyGraphics: false },
      tmux: null,
      tmuxPassthroughAllowed: true,
      surface: { kind: "none", available: false, handles: [], commandCount: 0, reason: "not kitty" },
    }),
    "[unavailable: not kitty]",
  );
  assertEquals(
    formatWorkbenchKittyGraphicsStatus({
      selected: { kittyGraphics: false },
      tmux: null,
      tmuxPassthroughAllowed: true,
      surface: { kind: "none", available: false, handles: [], commandCount: 0 },
    }),
    "[unavailable: not detected]",
  );
});
