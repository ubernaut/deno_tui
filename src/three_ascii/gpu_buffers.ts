/** Minimal GPU buffer shape needed by reusable three Ascii buffer helpers. */
export interface ThreeAsciiGpuBuffer {
  destroy(): void;
}

/** Minimal GPU device shape needed by reusable three Ascii buffer helpers. */
export interface ThreeAsciiGpuBufferDevice<TBuffer extends ThreeAsciiGpuBuffer = ThreeAsciiGpuBuffer> {
  createBuffer(options: { label: string; size: number; usage: number }): TBuffer;
}

/** Cached GPU buffer slot with its allocated byte size. */
export interface ThreeAsciiGpuBufferSlot<TBuffer extends ThreeAsciiGpuBuffer = ThreeAsciiGpuBuffer> {
  gpu: TBuffer;
  byteLength: number;
}

/** Options for allocating or reusing a three Ascii GPU buffer slot. */
export interface ThreeAsciiGpuBufferSlotOptions {
  label: string;
  byteLength: number;
  usage: number;
}

/** Reuses an existing same-sized GPU buffer slot, or destroys and replaces it when the size changes. */
export function ensureThreeAsciiGpuBufferSlot<TBuffer extends ThreeAsciiGpuBuffer>(
  device: ThreeAsciiGpuBufferDevice<TBuffer>,
  current: ThreeAsciiGpuBufferSlot<TBuffer> | undefined,
  options: ThreeAsciiGpuBufferSlotOptions,
): ThreeAsciiGpuBufferSlot<TBuffer> {
  if (current?.byteLength === options.byteLength) {
    return current;
  }

  destroyThreeAsciiGpuBufferSlot(current);

  return {
    gpu: device.createBuffer({
      label: options.label,
      size: options.byteLength,
      usage: options.usage,
    }),
    byteLength: options.byteLength,
  };
}

/** Destroys an optional three Ascii GPU buffer slot and returns undefined for assignment cleanup. */
export function destroyThreeAsciiGpuBufferSlot<TBuffer extends ThreeAsciiGpuBuffer>(
  current: ThreeAsciiGpuBufferSlot<TBuffer> | undefined,
): undefined {
  current?.gpu.destroy();
  return undefined;
}
