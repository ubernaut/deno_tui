import { assert, assertEquals } from "./deps.ts";
import {
  createKittyGraphicsSurface,
  type KittyGraphicsCapability,
  KittyGraphicsSurface,
  NoopGraphicsSurface,
} from "../mod.ts";

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
  const surface = createKittyGraphicsSurface({
    capability: blockedKitty,
    writer: { write: () => {} },
  });

  assertEquals(surface.kind, "none");
});
