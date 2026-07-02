// Copyright 2023 Im-Beast. MIT license.
import { assertEquals, assertStrictEquals } from "./deps.ts";
import { detectTmuxPassthroughAllowed, WorkbenchKittyGraphicsController } from "../app/workbench_kitty_graphics.ts";

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
    writer: { write: () => {} },
  });

  assertStrictEquals(controller.surfaceFor({ kittyGraphics: false }), controller.autoSurface);
  assertStrictEquals(controller.surfaceFor({ kittyGraphics: true }), controller.forcedSurface);
});
