import { assertEquals, assertNotStrictEquals, assertStrictEquals } from "./deps.ts";
import { loadAsciiLutTextures } from "../src/three_ascii/loadAsciiLuts.ts";

Deno.test("loadAsciiLutTextures caches decoded bitmaps while returning fresh textures", async () => {
  const originalCreateImageBitmap = globalThis.createImageBitmap;
  let bitmapCount = 0;
  const bitmaps: ImageBitmap[] = [];
  globalThis.createImageBitmap = (() => {
    const bitmap = { id: bitmapCount++ } as unknown as ImageBitmap;
    bitmaps.push(bitmap);
    return Promise.resolve(bitmap);
  }) as typeof createImageBitmap;

  try {
    const edges = "data:image/png;base64,ZWQ=";
    const fill = "data:image/png;base64,ZmlsbA==";
    const first = await loadAsciiLutTextures(edges, fill);
    const second = await loadAsciiLutTextures(edges, fill);

    assertEquals(bitmapCount, 2);
    assertNotStrictEquals(first.edgesTexture, second.edgesTexture);
    assertNotStrictEquals(first.fillTexture, second.fillTexture);
    assertStrictEquals(first.edgesTexture.image, bitmaps[0]);
    assertStrictEquals(second.edgesTexture.image, bitmaps[0]);
    assertStrictEquals(first.fillTexture.image, bitmaps[1]);
    assertStrictEquals(second.fillTexture.image, bitmaps[1]);
  } finally {
    globalThis.createImageBitmap = originalCreateImageBitmap;
  }
});
