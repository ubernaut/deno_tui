import { assertEquals, assertStrictEquals } from "./deps.ts";
import { readThreeAsciiImageFrame } from "../src/three_ascii/image_frame.ts";

Deno.test("readThreeAsciiImageFrame reads raw RGBA bytes with image metadata", async () => {
  const data = new Uint8Array([1, 2, 3, 4]);
  let reads = 0;

  const frame = await readThreeAsciiImageFrame({
    width: 2,
    height: 1,
    context: {
      readRGBA: () => {
        reads += 1;
        return data;
      },
    },
  });

  assertEquals(reads, 1);
  assertStrictEquals(frame.data, data);
  assertEquals(frame.encoding, "bytes");
  assertEquals(frame.format, 32);
  assertEquals(frame.pixelWidth, 2);
  assertEquals(frame.pixelHeight, 1);
});

Deno.test("readThreeAsciiImageFrame awaits async RGBA sources", async () => {
  const data = new Uint8Array([5, 6, 7, 8]);

  const frame = await readThreeAsciiImageFrame({
    width: 1,
    height: 1,
    context: {
      readRGBA: () => Promise.resolve(data),
    },
  });

  assertStrictEquals(frame.data, data);
  assertEquals(frame.pixelWidth, 1);
  assertEquals(frame.pixelHeight, 1);
});
