import { ClampToEdgeWrapping, LinearFilter, NoColorSpace, Texture } from "npm:three@0.183.2";

export interface AcerolaAsciiLuts {
  edgesTexture: Texture;
  fillTexture: Texture;
}

async function loadImageBytes(source: URL | string): Promise<Uint8Array> {
  const url = source instanceof URL ? source : new URL(source, import.meta.url);

  if (url.protocol === "file:" && typeof Deno !== "undefined") {
    return await Deno.readFile(url);
  }

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load image: ${url} (${response.status})`);
  }

  return new Uint8Array(await response.arrayBuffer());
}

async function loadBitmap(source: URL | string): Promise<ImageBitmap> {
  const bytes = await loadImageBytes(source);
  const arrayBuffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(arrayBuffer).set(bytes);
  const blob = new Blob([arrayBuffer], {
    type: "image/png",
  });
  return await createImageBitmap(blob);
}

function createMaskTexture(bitmap: ImageBitmap): Texture {
  const texture = new Texture(bitmap);
  texture.name = "AcerolaAsciiMask";
  texture.colorSpace = NoColorSpace;
  texture.generateMipmaps = false;
  texture.magFilter = LinearFilter;
  texture.minFilter = LinearFilter;
  texture.wrapS = ClampToEdgeWrapping;
  texture.wrapT = ClampToEdgeWrapping;
  texture.flipY = false;
  texture.needsUpdate = true;
  return texture;
}

export async function loadAsciiLutTextures(
  edgesUrl: URL | string,
  fillUrl: URL | string,
): Promise<AcerolaAsciiLuts> {
  const [edgesBitmap, fillBitmap] = await Promise.all([
    loadBitmap(edgesUrl),
    loadBitmap(fillUrl),
  ]);

  return {
    edgesTexture: createMaskTexture(edgesBitmap),
    fillTexture: createMaskTexture(fillBitmap),
  };
}
