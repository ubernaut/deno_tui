export interface ThreeAsciiMappedReadbackBuffer {
  mapAsync(mode: number): Promise<void>;
  getMappedRange(): ArrayBuffer;
  unmap(): void;
}

export interface ThreeAsciiMappedReadbackOptions<T> {
  mapModeRead: number;
  now?: () => number;
  mapError: (error: unknown) => Error;
  read: (source: ArrayBuffer, readbackMs: number) => T;
}

export async function withThreeAsciiMappedReadback<T>(
  buffer: ThreeAsciiMappedReadbackBuffer,
  options: ThreeAsciiMappedReadbackOptions<T>,
): Promise<{ value: T; readbackMs: number }> {
  const now = options.now ?? (() => performance.now());
  const readbackStart = now();
  try {
    await buffer.mapAsync(options.mapModeRead);
  } catch (error) {
    throw options.mapError(error);
  }
  const readbackMs = now() - readbackStart;

  try {
    return {
      value: options.read(buffer.getMappedRange(), readbackMs),
      readbackMs,
    };
  } finally {
    buffer.unmap();
  }
}
