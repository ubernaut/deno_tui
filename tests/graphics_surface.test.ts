import { assert, assertEquals, assertStrictEquals, assertThrows } from "./deps.ts";
import {
  createKittyGraphicsSurface,
  detectTmuxPassthroughAllowed,
  DiagnosticsCollector,
  formatWorkbenchKittyGraphicsStatus,
  type KittyGraphicsCapability,
  KittyGraphicsSurface,
  NoopGraphicsSurface,
  WorkbenchKittyGraphicsController,
} from "../mod.ts";
import {
  chunkKittyGraphicsCommand,
  createKittyGraphicsDeleteCommand,
  createKittyGraphicsTransmitCommands,
  detectKittyGraphicsCapability,
  encodeKittyGraphicsCommand,
  encodeKittyGraphicsControl,
  encodeKittyGraphicsPayload,
  inspectKittyGraphicsCommand,
  wrapKittyGraphicsForTmux,
} from "../src/runtime/kitty_graphics.ts";

const directKitty: KittyGraphicsCapability = {
  supported: true,
  mode: "direct",
  reason: "test",
  term: "xterm-kitty",
  termProgram: "",
  multiplexer: "none",
  remote: false,
};

const blockedKitty: KittyGraphicsCapability = {
  ...directKitty,
  supported: false,
  mode: "unknown",
  reason: "blocked",
};

const workbenchKittyEncoder = new TextEncoder();

Deno.test("NoopGraphicsSurface tracks handles without writing commands", async () => {
  const surface = new NoopGraphicsSurface();
  const handle = await surface.putImage({ data: new Uint8Array([1]) }, {
    column: 2,
    row: 3,
    width: 10,
    height: 4,
  });

  assertEquals(handle.kind, "none");
  assertEquals(surface.inspect().handles.length, 1);

  await surface.moveImage(handle, { column: 0, row: 0, width: 5, height: 2 });
  assertEquals(surface.inspect().handles[0]!.placement, { column: 0, row: 0, width: 5, height: 2 });

  await surface.deleteImage(handle);
  assertEquals(surface.inspect().handles.length, 0);
  assertEquals(surface.inspect().commandCount, 1);
});

Deno.test("KittyGraphicsSurface writes placed transmit move and delete commands", async () => {
  const writes: string[] = [];
  const surface = new KittyGraphicsSurface({
    capability: directKitty,
    writer: { write: (data) => void writes.push(data) },
    imageIdStart: 10,
    placementIdStart: 20,
    maxChunkBytes: 99,
    quiet: 1,
  });

  const handle = await surface.putImage(
    { data: new Uint8Array([1, 2, 3]), pixelWidth: 30, pixelHeight: 20 },
    { column: 4, row: 2, width: 8, height: 3, zIndex: 5 },
  );

  assertEquals(handle.id, "kitty:10:20");
  assertEquals(writes[0], "\x1b[3;5H\x1b_Ga=T,q=1,f=100,t=d,s=30,v=20,i=10,p=20,c=8,r=3,z=5,m=0;AQID\x1b\\");

  await surface.moveImage(handle, { column: 0, row: 0, width: 4, height: 2 });
  assertEquals(writes[1], "\x1b_Ga=d,q=1,i=10,p=20,d=i;\x1b\\");
  assertEquals(writes[2], "\x1b[1;1H\x1b_Ga=p,q=1,i=10,p=20,c=4,r=2;\x1b\\");
  assertEquals(surface.inspect().handles[0]!.placement, { column: 0, row: 0, width: 4, height: 2 });

  await surface.deleteImage(handle, "image");
  assertEquals(writes[3], "\x1b_Ga=d,q=1,i=10,d=I;\x1b\\");
  assertEquals(surface.inspect().handles.length, 0);
  assertEquals(surface.inspect().commandCount, 4);
});

Deno.test("KittyGraphicsSurface wraps commands for tmux passthrough", async () => {
  const writes: string[] = [];
  const surface = new KittyGraphicsSurface({
    capability: { ...directKitty, mode: "tmux-passthrough", multiplexer: "tmux" },
    writer: { write: (data) => void writes.push(data) },
  });

  await surface.clear("all");

  assert(writes[0]!.startsWith("\x1bPtmux;"));
  assert(writes[0]!.includes("\x1b\x1b_Ga=d,d=A;"));
});

Deno.test("createKittyGraphicsSurface falls back when capability is unsupported", () => {
  const diagnostics = new DiagnosticsCollector();
  const surface = createKittyGraphicsSurface({
    capability: blockedKitty,
    diagnostics,
    writer: { write: () => {} },
  });

  assertEquals(surface.kind, "none");
  assertEquals(diagnostics.entries().map((entry) => [entry.source, entry.code, entry.severity, entry.detail]), [
    ["graphics", "kitty-unavailable", "warning", "blocked"],
  ]);
});

Deno.test("Kitty graphics encoder serializes deterministic control data", () => {
  assertEquals(
    encodeKittyGraphicsControl({ t: "d", a: "T", f: 100, i: 7, m: false }),
    "a=T,f=100,t=d,i=7,m=0",
  );

  assertThrows(
    () => encodeKittyGraphicsControl({ a: "T", i: "bad,value" }),
    TypeError,
    "unescaped ASCII",
  );
});

Deno.test("Kitty graphics encoder wraps command payloads", () => {
  const sequence = encodeKittyGraphicsCommand({
    control: { a: "T", f: 100, t: "d", i: 5 },
    payload: "AQID",
  });

  assertEquals(sequence, "\x1b_Ga=T,f=100,t=d,i=5;AQID\x1b\\");
  assertEquals(inspectKittyGraphicsCommand(sequence), {
    control: "a=T,f=100,t=d,i=5",
    payloadLength: 4,
    sequenceLength: sequence.length,
    tmuxWrappedLength: undefined,
  });
});

Deno.test("Kitty graphics payload helpers encode and chunk base64 data", () => {
  assertEquals(encodeKittyGraphicsPayload(new Uint8Array([1, 2, 3])), "AQID");
  assertEquals(encodeKittyGraphicsPayload("hi", "utf8"), "aGk=");

  const chunks = chunkKittyGraphicsCommand({
    control: { a: "T", f: 100, t: "d", i: 1 },
    payload: new Uint8Array([0, 1, 2, 3, 4, 5]),
    maxChunkBytes: 4,
  });

  assertEquals(chunks, [
    "\x1b_Ga=T,f=100,t=d,i=1,m=1;AAEC\x1b\\",
    "\x1b_Ga=T,f=100,t=d,i=1,m=0;AwQF\x1b\\",
  ]);
});

Deno.test("Kitty graphics transmit and delete helpers use protocol fields", () => {
  assertEquals(
    createKittyGraphicsTransmitCommands({
      data: new Uint8Array([1, 2, 3]),
      imageId: 4,
      placementId: 9,
      columns: 10,
      rows: 5,
      pixelWidth: 800,
      pixelHeight: 400,
      zIndex: -1,
      quiet: 1,
      maxChunkBytes: 99,
    }),
    ["\x1b_Ga=T,q=1,f=100,t=d,s=800,v=400,i=4,p=9,c=10,r=5,z=-1,m=0;AQID\x1b\\"],
  );

  assertEquals(
    createKittyGraphicsDeleteCommand({ mode: "i", imageId: 4, placementId: 9, quiet: 2 }),
    "\x1b_Ga=d,q=2,i=4,p=9,d=i;\x1b\\",
  );
});

Deno.test("Kitty graphics tmux passthrough doubles embedded escapes", () => {
  const command = "\x1b_Ga=d;\x1b\\";
  const wrapped = wrapKittyGraphicsForTmux(command);

  assertEquals(wrapped, "\x1bPtmux;\x1b\x1b_Ga=d;\x1b\x1b\\\x1b\\");
  assertEquals(inspectKittyGraphicsCommand(wrapped).tmuxWrappedLength, wrapped.length);
});

Deno.test("Kitty graphics capability detection is conservative around tmux", () => {
  assertEquals(
    detectKittyGraphicsCapability({
      env: { KITTY_WINDOW_ID: "1", TERM: "xterm-kitty" },
      isTty: true,
    }).mode,
    "direct",
  );

  const tmuxBlocked = detectKittyGraphicsCapability({
    env: { KITTY_WINDOW_ID: "1", TERM: "tmux-256color", TMUX: "/tmp/tmux" },
    isTty: true,
  });
  assertEquals(tmuxBlocked.supported, false);
  assertEquals(tmuxBlocked.mode, "unknown");

  const tmuxPassthrough = detectKittyGraphicsCapability({
    env: {
      KITTY_WINDOW_ID: "1",
      TERM: "tmux-256color",
      TMUX: "/tmp/tmux",
      DENO_TUI_KITTY_TMUX: "1",
    },
    isTty: true,
  });
  assertEquals(tmuxPassthrough.supported, true);
  assertEquals(tmuxPassthrough.mode, "tmux-passthrough");

  const forcedTmuxPassthrough = detectKittyGraphicsCapability({
    env: {
      TERM: "tmux-256color",
      TMUX: "/tmp/tmux",
    },
    force: true,
    tmuxPassthrough: true,
    isTty: true,
  });
  assertEquals(forcedTmuxPassthrough.supported, true);
  assertEquals(forcedTmuxPassthrough.mode, "tmux-passthrough");

  const disabled = detectKittyGraphicsCapability({
    env: { KITTY_WINDOW_ID: "1", DENO_TUI_KITTY: "0" },
    isTty: true,
  });
  assertEquals(disabled.supported, false);
  assertEquals(disabled.mode, "disabled");
});

Deno.test("detectTmuxPassthroughAllowed accepts no tmux and enabled tmux values", async () => {
  assertEquals(await detectTmuxPassthroughAllowed({ tmux: "" }), true);
  assertEquals(
    await detectTmuxPassthroughAllowed({
      tmux: "/tmp/tmux",
      command: () => Promise.resolve({ success: true, stdout: workbenchKittyEncoder.encode("all\n") }),
    }),
    true,
  );
  assertEquals(
    await detectTmuxPassthroughAllowed({
      tmux: "/tmp/tmux",
      command: () => Promise.resolve({ success: true, stdout: workbenchKittyEncoder.encode("yes") }),
    }),
    true,
  );
});

Deno.test("detectTmuxPassthroughAllowed rejects disabled failed and throwing probes", async () => {
  assertEquals(
    await detectTmuxPassthroughAllowed({
      tmux: "/tmp/tmux",
      command: () => Promise.resolve({ success: true, stdout: workbenchKittyEncoder.encode("off") }),
    }),
    false,
  );
  assertEquals(
    await detectTmuxPassthroughAllowed({
      tmux: "/tmp/tmux",
      command: () => Promise.resolve({ success: false, stdout: workbenchKittyEncoder.encode("all") }),
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
