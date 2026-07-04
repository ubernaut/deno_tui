// Copyright 2023 Im-Beast. MIT license.

/** Raw image frame emitted by the Acerola three Ascii renderer. */
export interface ThreeAsciiImageFrame {
  data: Uint8Array;
  encoding: "bytes";
  format: 32;
  pixelWidth: number;
  pixelHeight: number;
}

export interface ThreeAsciiImageFrameSource {
  readonly width: number;
  readonly height: number;
  readonly context: {
    readRGBA(): Uint8Array | Promise<Uint8Array>;
  };
}

export async function readThreeAsciiImageFrame(
  source: ThreeAsciiImageFrameSource,
): Promise<ThreeAsciiImageFrame> {
  return {
    data: await source.context.readRGBA(),
    encoding: "bytes",
    format: 32,
    pixelWidth: source.width,
    pixelHeight: source.height,
  };
}
